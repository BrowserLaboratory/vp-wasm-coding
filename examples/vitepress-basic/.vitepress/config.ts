import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vitepress'
import { codeRunnerAssets } from '@vp-code-runner/vitepress/vite'

// Resolve asset source dirs relative to THIS file so the config works no matter
// what cwd `vitepress build/preview` is invoked from.
const here = dirname(fileURLToPath(import.meta.url)) // examples/vitepress-basic/.vitepress

// Pyodide runtime fetched by scripts/download-pyodide.sh into ../vendor/pyodide
const pyodideDir = resolve(here, '../vendor/pyodide')
// Generator wasm-pack output lives at the repo root (../../../ from .vitepress).
const generatorDir = resolve(here, '../../../crates/random-input-generator/pkg')

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'CodeRunner Example',
  description:
    'Minimal VitePress consumer for @vp-code-runner/vitepress — Python in the browser, no COOP/COEP.',
  // Plain root base; the configurable asset base resolves /pyodide/ and /wasm/.
  base: '/',

  head: [
    // CSP that lets Pyodide run WITHOUT cross-origin isolation (no COOP/COEP):
    //   - script-src 'wasm-unsafe-eval' → WebAssembly compile/instantiate
    //   - worker-src 'self' blob:        → the Pyodide module worker
    //   - connect-src 'self'             → fetch the runtime + generator assets
    // 'unsafe-inline' is for VitePress' own hydration/inline scripts & styles.
    [
      'meta',
      {
        'http-equiv': 'Content-Security-Policy',
        content:
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; connect-src 'self'; img-src 'self' data:; font-src 'self';",
      },
    ],
  ],

  vite: {
    plugins: [
      codeRunnerAssets({
        pyodideDir,
        generatorDir,
        base: '/',
        // Defaults: served at /pyodide/ and /wasm/ — matches the config.ts resolvers.
      }),
    ],
  },
})
