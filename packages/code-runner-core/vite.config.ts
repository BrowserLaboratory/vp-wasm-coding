import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

/**
 * Library build for @cxphoenix/vp-wasm-coding-core.
 *
 * Two entries are emitted as ESM:
 *   - `index`           → the framework-agnostic engine entry
 *   - `pyodide.worker`  → the module Web Worker
 *
 * The engine instantiates the worker with
 * `new Worker(new URL('../worker/pyodide.worker.ts', import.meta.url), { type: 'module' })`.
 * Vite's worker handling rewrites that reference to a sibling asset in `dist`,
 * which a downstream Vite/VitePress build re-resolves and bundles — so the
 * worker survives the package boundary (verified end-to-end in task 8.1).
 */
export default defineConfig({
  // Relative base so the emitted worker reference is a sibling-relative
  // `new URL('./assets/…', import.meta.url)` rather than a root-absolute
  // `/assets/…`. The absolute form breaks the package boundary (it resolves
  // against the origin, ignoring the consumer's base and node_modules path);
  // the relative form is re-resolved and bundled by the downstream Vite build.
  base: './',
  build: {
    target: 'es2022',
    minify: false,
    sourcemap: true,
    lib: {
      entry: {
        'index': 'src/index.ts',
        'worker/pyodide.worker': 'src/worker/pyodide.worker.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      // `pyodide` is loaded at runtime by URL (see ensurePyodide), never bundled.
      external: ['pyodide'],
      output: { entryFileNames: '[name].mjs' },
    },
  },
  worker: {
    format: 'es',
  },
  plugins: [
    dts({
      include: ['src'],
      entryRoot: 'src',
      // Skip emitting declarations for the test files.
      exclude: ['src/__tests__/**'],
    }),
  ],
})
