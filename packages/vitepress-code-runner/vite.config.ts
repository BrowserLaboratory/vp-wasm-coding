import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from 'node:fs'
import { resolve } from 'node:path'

/**
 * After the bundle is written: copy the wasm-pack generator output into
 * `dist/generator` (so the published package carries the WASM) and append the
 * standalone theming defaults (`src/style.css`) to the SFC-extracted
 * `dist/style.css`, giving consumers a single `./style.css`.
 *
 * Fails loudly if the WASM was not built — the generator must never be silently
 * dropped from a published build.
 */
function bundleGeneratorAndCss() {
  const here = import.meta.dirname
  const pkgDir = resolve(here, '../../crates/random-input-generator/pkg')
  const distGen = resolve(here, 'dist/generator')
  const cssSrc = resolve(here, 'src/style.css')
  const cssDest = resolve(here, 'dist/style.css')
  return {
    name: 'vp-wasm-coding:bundle-generator-and-css',
    closeBundle() {
      const glue = resolve(pkgDir, 'random_input_generator.js')
      const wasm = resolve(pkgDir, 'random_input_generator_bg.wasm')
      if (!existsSync(glue) || !existsSync(wasm)) {
        throw new Error(
          `[bundle-generator] generator WASM not found at ${pkgDir}. ` +
            'Run `wasm-pack build crates/random-input-generator --target web --out-dir pkg` first.',
        )
      }
      mkdirSync(distGen, { recursive: true })
      copyFileSync(glue, resolve(distGen, 'random_input_generator.js'))
      copyFileSync(wasm, resolve(distGen, 'random_input_generator_bg.wasm'))
      if (existsSync(cssDest)) {
        appendFileSync(cssDest, '\n' + readFileSync(cssSrc, 'utf8'))
      } else {
        copyFileSync(cssSrc, cssDest)
      }
    },
  }
}

/**
 * Library build for @cxphoenix/vp-wasm-coding.
 *
 * Three ESM entries are emitted:
 *   - `index`             → SSR-safe component + composables + asset-base config
 *   - `vite`              → the `codeRunnerAssets` Node-side Vite plugin
 *   - `editors/codemirror`→ the default CodeMirror editor adapter
 *
 * SFC `<style scoped>` blocks are extracted into a single `dist/style.css`
 * (cssCodeSplit: false). The standalone theming defaults in `src/style.css` are
 * appended to it by the build script, so consumers import one `./style.css`.
 *
 * All runtime dependencies, peer deps, and node builtins are externalized — the
 * library ships only first-party source; the consumer resolves the rest.
 *
 * Declarations are emitted by a separate `vue-tsc --emitDeclarationOnly` step
 * (see the package build script): vite-plugin-dts did not emit `.vue` types in
 * this toolchain, and vue-tsc handles both `.ts` and `.vue` reliably.
 */
const EXTERNAL_EXACT = new Set([
  'vue',
  'vitepress',
  '@cxphoenix/vp-wasm-coding-core',
  'codemirror',
])

export default defineConfig({
  build: {
    target: 'es2022',
    minify: false,
    sourcemap: true,
    cssCodeSplit: false,
    lib: {
      entry: {
        'index': 'src/index.ts',
        'vite/plugin': 'src/vite/plugin.ts',
        'editors/codemirror/index': 'src/editors/codemirror/index.ts',
      },
      formats: ['es'],
      cssFileName: 'style',
    },
    rollupOptions: {
      external: (id) =>
        EXTERNAL_EXACT.has(id) || /^node:/.test(id) || id.startsWith('@codemirror/'),
      output: { entryFileNames: '[name].mjs' },
    },
  },
  plugins: [vue(), bundleGeneratorAndCss()],
})
