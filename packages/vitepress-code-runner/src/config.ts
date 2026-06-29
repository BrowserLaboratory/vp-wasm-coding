/**
 * Configurable asset base (task 6.2).
 *
 * The runner needs to locate two sets of runtime files at *runtime* in the
 * browser:
 *   - the Pyodide runtime directory (`pyodide.mjs`, `pyodide.asm.wasm`, …)
 *   - the generator wasm glue (`random_input_generator.js` + its `_bg.wasm`)
 *
 * Instead of hardcoding a root-absolute path (the source used `/pyodide/` and
 * `/wasm/...`), the default base is derived from `import.meta.env.BASE_URL` so
 * the runner keeps working when the consuming VitePress site is deployed under
 * a NON-ROOT base path (e.g. GitHub Pages at `/my-repo/`). When `BASE_URL` is
 * unavailable (plain Node, tests) it falls back to `'/'`, which reproduces the
 * original behaviour.
 *
 * A consumer can override the base in two ways:
 *   1. Per-component, via the `config` prop on {@link ../components/CodeRunner.vue}.
 *   2. App-wide, via provide/inject — call {@link provideCodeRunnerConfig} in
 *      VitePress `enhanceApp` (or any ancestor `setup`) and the component will
 *      pick it up through {@link injectCodeRunnerConfig}.
 */
import { inject, provide, type InjectionKey } from 'vue'

/**
 * Asset-base configuration. Every field is optional; unset fields fall back to
 * the derived defaults documented on each resolver below.
 */
export interface AssetBaseConfig {
  /**
   * Site base URL. Defaults to `import.meta.env.BASE_URL` (which respects a
   * non-root VitePress `base`) and ultimately to `'/'`.
   */
  base?: string
  /** Subdirectory (under {@link base}) holding the Pyodide runtime. Default `'pyodide'`. */
  pyodideDir?: string
  /** Subdirectory (under {@link base}) holding the generator wasm glue. Default `'wasm'`. */
  generatorDir?: string
  /** Generator glue filename. Default `'random_input_generator.js'`. */
  generatorGlue?: string
}

/** The default Pyodide subdirectory name. */
export const DEFAULT_PYODIDE_DIR = 'pyodide'
/** The default generator subdirectory name. */
export const DEFAULT_GENERATOR_DIR = 'wasm'
/** The default generator glue filename (wasm-pack `--target web` output). */
export const DEFAULT_GENERATOR_GLUE = 'random_input_generator.js'

function withTrailingSlash(s: string): string {
  return s.endsWith('/') ? s : `${s}/`
}

function trimSlashes(s: string): string {
  return s.replace(/^\/+|\/+$/g, '')
}

/**
 * Read `import.meta.env.BASE_URL` defensively. Bundlers (Vite/VitePress) inject
 * it; plain Node / vitest do not, so any access error falls back to `'/'`.
 */
function envBaseURL(): string {
  try {
    const env = (import.meta as unknown as { env?: { BASE_URL?: unknown } }).env
    if (env && typeof env.BASE_URL === 'string' && env.BASE_URL.length > 0) {
      return env.BASE_URL
    }
  } catch {
    // import.meta.env not available — fall through to default.
  }
  return '/'
}

/**
 * Resolve the effective site base URL, always with a trailing slash.
 * An explicit `config.base` wins; otherwise `import.meta.env.BASE_URL`; otherwise `'/'`.
 */
export function resolveBaseUrl(config: AssetBaseConfig = {}): string {
  return withTrailingSlash(config.base ?? envBaseURL())
}

/**
 * Resolve the Pyodide index URL passed to the core worker (`config` message /
 * `setPyodideIndexURL`). Always ends in a trailing slash, e.g. `'/my-repo/pyodide/'`.
 */
export function resolvePyodideIndexURL(config: AssetBaseConfig = {}): string {
  const base = resolveBaseUrl(config)
  const dir = trimSlashes(config.pyodideDir ?? DEFAULT_PYODIDE_DIR)
  return withTrailingSlash(base + dir)
}

/**
 * Resolve the base directory URL for the generator wasm glue. Always ends in a
 * trailing slash, e.g. `'/my-repo/wasm/'`.
 */
export function resolveGeneratorBase(config: AssetBaseConfig = {}): string {
  const base = resolveBaseUrl(config)
  const dir = trimSlashes(config.generatorDir ?? DEFAULT_GENERATOR_DIR)
  return withTrailingSlash(base + dir)
}

/**
 * Resolve the full URL to the generator glue module, e.g.
 * `'/my-repo/wasm/random_input_generator.js'`.
 */
export function resolveGeneratorGlueURL(config: AssetBaseConfig = {}): string {
  return resolveGeneratorBase(config) + (config.generatorGlue ?? DEFAULT_GENERATOR_GLUE)
}

/** Injection key for app-wide {@link AssetBaseConfig}. */
export const CODE_RUNNER_CONFIG_KEY: InjectionKey<AssetBaseConfig> =
  Symbol('vp-code-runner:config')

/** Provide an app-wide {@link AssetBaseConfig} (call from `enhanceApp` / an ancestor setup). */
export function provideCodeRunnerConfig(config: AssetBaseConfig): void {
  provide(CODE_RUNNER_CONFIG_KEY, config)
}

/**
 * Read the app-wide {@link AssetBaseConfig}, merged with an optional per-call
 * override (the override wins field-by-field). Safe to call outside an active
 * component instance — `inject` simply yields the empty default.
 */
export function injectCodeRunnerConfig(override?: AssetBaseConfig): AssetBaseConfig {
  const injected = inject(CODE_RUNNER_CONFIG_KEY, {} as AssetBaseConfig)
  return { ...injected, ...override }
}
