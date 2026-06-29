/**
 * useWasmGenerator — lazily load the random-input-generator wasm glue and
 * expose `generateChallenge` (port of the source `useWasm.ts`, task 6.1).
 *
 * Two extension seams keep this SSR-safe and testable:
 *   - `loaderOverride`: inject a fake module in tests (no real wasm fetch).
 *   - `generatorBase` / `glueURL`: a configurable asset base (task 6.2) so the
 *     glue resolves under a NON-ROOT site base. The default is derived from
 *     {@link ../config.resolveGeneratorGlueURL} (i.e. `import.meta.env.BASE_URL`).
 *
 * The dynamic `import()` uses a runtime-built path string with `@vite-ignore`
 * so the bundler never tries to statically resolve / inline the public asset —
 * exactly like the source. The module is never imported at module scope, so
 * importing this file during SSR/SSG is side-effect free.
 */
import { resolveGeneratorGlueURL, type AssetBaseConfig } from '../config'

/** Result shape returned by the generator wasm `generate_challenge`. */
export interface GeneratedInputs {
  inputs: string[]
}

/** Minimal surface of the wasm-pack `--target web` glue module we depend on. */
export interface WasmGeneratorModule {
  /** wasm-pack default init (`__wbg_init`); fetches the `_bg.wasm` when called with no args. */
  default: (moduleOrPath?: unknown) => Promise<unknown>
  /** Returns `{ inputs: string[] }` (or a JSON string thereof). */
  generate_challenge: (params_json: string, count: number) => unknown
}

export interface UseWasmGeneratorOptions {
  /**
   * Full URL to the generator glue module. When set it takes precedence over
   * the derived base. Mainly an explicit-override / advanced escape hatch.
   */
  glueURL?: string
  /** Asset-base config used to derive the glue URL when {@link glueURL} is unset. */
  assetBase?: AssetBaseConfig
  /** Replace the module loader (tests / custom hosting). Receives no args. */
  loaderOverride?: () => Promise<WasmGeneratorModule>
}

// Module-level cache — the wasm module is a singleton shared across instances,
// mirroring the source. `resetWasmGeneratorCache` clears it for tests.
let wasmModule: WasmGeneratorModule | null = null
let wasmInitPromise: Promise<void> | null = null

/** Clear the cached wasm module/init promise. Intended for tests. */
export function resetWasmGeneratorCache(): void {
  wasmModule = null
  wasmInitPromise = null
}

export function useWasmGenerator(options: UseWasmGeneratorOptions = {}) {
  /** The resolved glue module URL (explicit > derived-from-base). */
  function glueURL(): string {
    return options.glueURL ?? resolveGeneratorGlueURL(options.assetBase)
  }

  const loader: () => Promise<WasmGeneratorModule> =
    options.loaderOverride ??
    (() => import(/* @vite-ignore */ glueURL()) as Promise<WasmGeneratorModule>)

  /** Load + init the wasm module once; concurrent callers await the same promise. */
  async function loadWasm(): Promise<void> {
    if (wasmModule) return
    if (!wasmInitPromise) {
      wasmInitPromise = (async () => {
        const mod = await loader()
        await mod.default()
        wasmModule = mod
      })()
    }
    await wasmInitPromise
  }

  /**
   * Generate random stdin input strings from a JSON params specification.
   * Resolves `null` (never throws) when the wasm is unavailable or errors.
   */
  async function generateChallenge(
    paramsJson: string,
    count: number,
  ): Promise<GeneratedInputs | null> {
    await loadWasm()
    if (!wasmModule) return null
    try {
      const result = wasmModule.generate_challenge(paramsJson, count)
      return (typeof result === 'object' ? result : JSON.parse(String(result))) as GeneratedInputs
    } catch (e) {
      console.error('[useWasmGenerator] generate_challenge error:', e)
      return null
    }
  }

  return { loadWasm, generateChallenge, glueURL }
}
