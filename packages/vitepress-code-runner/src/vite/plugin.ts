/**
 * codeRunnerAssets — a Vite plugin that makes the Pyodide runtime files and the
 * generator wasm resolvable in BOTH dev (serve) and build (emit), so the
 * consumer never has to manually copy assets into `public/` (task 6.3).
 *
 * It does NOT require COOP/COEP — the runner works on a plain static host.
 *
 * The `vite` package is intentionally NOT imported. The minimal `Plugin`
 * surface we use is inlined below (mirroring the source
 * `.vitepress/plugins/strip-generator.ts`) so this file carries no hard
 * dependency on `vite` and is safe to publish in a library.
 *
 * Usage (VitePress `.vitepress/config.ts`):
 *
 *   import { codeRunnerAssets } from '@cxphoenix/vp-wasm-coding/vite'
 *   export default defineConfig({
 *     base: '/my-repo/',
 *     vite: {
 *       plugins: [
 *         codeRunnerAssets({
 *           // run scripts/download-pyodide.sh first to populate this dir
 *           pyodideDir: 'node_modules/.pyodide',
 *           generatorDir: 'node_modules/random-input-generator/pkg',
 *           base: '/my-repo/',
 *         }),
 *       ],
 *     },
 *   })
 */
import { promises as fs, existsSync, statSync } from 'node:fs'
import { join, posix, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Inlined minimal Vite types (no `import` from 'vite') ─────────────────────

interface ViteDevServer {
  middlewares: {
    use(handler: (req: IncomingLike, res: ServerResponseLike, next: () => void) => void): void
  }
}

interface IncomingLike {
  url?: string
  method?: string
}

interface ServerResponseLike {
  statusCode: number
  setHeader(name: string, value: string): void
  end(chunk?: unknown): void
}

interface EmitFileContext {
  emitFile(file: { type: 'asset'; fileName: string; source: Uint8Array | string }): void
  warn(message: string): void
}

interface Plugin {
  name: string
  apply?: 'build' | 'serve'
  enforce?: 'pre' | 'post'
  configResolved?(config: { base?: string }): void
  configureServer?(server: ViteDevServer): void
  generateBundle?(this: EmitFileContext): Promise<void> | void
}

// ── Options ──────────────────────────────────────────────────────────────────

export interface CodeRunnerAssetsOptions {
  /**
   * Filesystem path to the directory containing the Pyodide runtime files
   * (`pyodide.mjs`, `pyodide.asm.wasm`, `python_stdlib.zip`, …). Populate it
   * with `scripts/download-pyodide.sh` first. When unset or missing the plugin
   * warns and serves/emits nothing for Pyodide.
   */
  pyodideDir?: string
  /**
   * Filesystem path to the generator's wasm-pack `pkg` directory (contains
   * `random_input_generator.js` and `random_input_generator_bg.wasm`).
   *
   * Defaults to the WASM bundled inside this package (`dist/generator`), so a
   * plain `npm install` works with no configuration. Set this only to override
   * with a self-hosted generator build.
   */
  generatorDir?: string
  /** Public site base (must match Vite/VitePress `base`). Default `'/'`. */
  base?: string
  /** Public subdirectory served for Pyodide. Default `'pyodide'`. */
  pyodidePublicDir?: string
  /** Public subdirectory served for the generator wasm. Default `'wasm'`. */
  generatorPublicDir?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const MIME: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.zip': 'application/zip',
  '.ts': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

function contentType(file: string): string {
  const dot = file.lastIndexOf('.')
  const ext = dot >= 0 ? file.slice(dot).toLowerCase() : ''
  return MIME[ext] ?? 'application/octet-stream'
}

function withTrailingSlash(s: string): string {
  return s.endsWith('/') ? s : `${s}/`
}

/** Collect every regular file under `dir`, returned as POSIX-style relative paths. */
async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const abs = join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(abs)
      } else if (entry.isFile()) {
        out.push(relative(dir, abs).split(sep).join('/'))
      }
    }
  }
  await walk(dir)
  return out
}

function isUsableDir(dir: string | undefined): dir is string {
  return !!dir && existsSync(dir) && statSync(dir).isDirectory()
}

/**
 * The generator WASM bundled inside this package, resolved relative to this
 * module. In the published build the plugin lives at `dist/vite/plugin.mjs`, so
 * `../generator` resolves to `dist/generator` (populated by the package build).
 * Returns undefined if the location can't be resolved.
 */
function bundledGeneratorDir(): string | undefined {
  try {
    return fileURLToPath(new URL('../generator', import.meta.url))
  } catch {
    return undefined
  }
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export function codeRunnerAssets(options: CodeRunnerAssetsOptions = {}): Plugin {
  const pyodidePublic = (options.pyodidePublicDir ?? 'pyodide').replace(/^\/+|\/+$/g, '')
  const generatorPublic = (options.generatorPublicDir ?? 'wasm').replace(/^\/+|\/+$/g, '')

  // Generator defaults to the WASM bundled inside this package; an explicit
  // option overrides it (self-hosted build).
  const generatorDir = options.generatorDir ?? bundledGeneratorDir()

  // `base` may be refined from the resolved Vite config when not passed explicitly.
  let base = withTrailingSlash(options.base ?? '/')

  /** [publicDir, sourceDir] pairs for each configured asset group that exists. */
  function mounts(): Array<[string, string]> {
    const result: Array<[string, string]> = []
    if (isUsableDir(options.pyodideDir)) result.push([pyodidePublic, options.pyodideDir])
    if (isUsableDir(generatorDir)) result.push([generatorPublic, generatorDir])
    return result
  }

  /**
   * Surface per-asset silent failures: a directory that was configured (or, for
   * the generator, expected via the bundled default) but is not usable would
   * otherwise be dropped without a trace, even when the other asset mounts. Only
   * fires for dirs that are present-but-broken, so it stays noise-free for the
   * legitimate "no Pyodide / bundled generator present" cases.
   */
  function warnMissing(warn: (msg: string) => void): void {
    if (options.pyodideDir !== undefined && !isUsableDir(options.pyodideDir)) {
      warn(
        `[vp-code-runner:assets] pyodideDir was set but is not a usable directory: ` +
          `${options.pyodideDir} — Pyodide assets will not be served.`,
      )
    }
    if (generatorDir !== undefined && !isUsableDir(generatorDir)) {
      const src = options.generatorDir !== undefined ? 'generatorDir was set' : 'the bundled generator'
      warn(
        `[vp-code-runner:assets] ${src} but is not a usable directory: ` +
          `${generatorDir} — generate_challenge will be unavailable.`,
      )
    }
  }

  return {
    name: 'vp-code-runner:assets',

    configResolved(config) {
      if (options.base === undefined && typeof config.base === 'string') {
        base = withTrailingSlash(config.base)
      }
    },

    // Dev: serve the files straight from their source directories.
    configureServer(server) {
      warnMissing((msg) => console.warn(msg))
      const active = mounts()
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next()
        let pathname = req.url.split('?')[0] ?? ''
        try {
          pathname = decodeURIComponent(pathname)
        } catch {
          return next()
        }
        // Normalise away the site base so matching works under a non-root base.
        if (pathname.startsWith(base)) pathname = '/' + pathname.slice(base.length)
        if (!pathname.startsWith('/')) pathname = '/' + pathname

        for (const [publicDir, srcDir] of active) {
          const prefix = `/${publicDir}/`
          if (!pathname.startsWith(prefix)) continue
          const rel = pathname.slice(prefix.length)
          if (rel.includes('..')) return next()
          const filePath = join(srcDir, ...rel.split('/'))
          if (!existsSync(filePath) || !statSync(filePath).isFile()) return next()
          void fs
            .readFile(filePath)
            .then((buf) => {
              res.statusCode = 200
              res.setHeader('Content-Type', contentType(filePath))
              res.setHeader('Cache-Control', 'no-cache')
              res.end(buf)
            })
            .catch(() => next())
          return
        }
        return next()
      })
    },

    // Build: emit every file under each source dir at `${publicDir}/<rel>`,
    // verbatim (no hashing) so the runtime URLs from `resolvePyodideIndexURL` /
    // `resolveGeneratorGlueURL` resolve after `base` is applied.
    async generateBundle() {
      warnMissing((msg) => this.warn(msg))
      const active = mounts()
      if (active.length === 0) {
        this.warn(
          '[vp-code-runner:assets] no pyodideDir/generatorDir found — emitted no assets. ' +
            'Did you run scripts/download-pyodide.sh and point pyodideDir/generatorDir at real dirs?',
        )
        return
      }
      for (const [publicDir, srcDir] of active) {
        const files = await listFiles(srcDir)
        for (const rel of files) {
          const source = await fs.readFile(join(srcDir, ...rel.split('/')))
          this.emitFile({
            type: 'asset',
            fileName: posix.join(publicDir, rel),
            source,
          })
        }
      }
    },
  }
}

export default codeRunnerAssets
