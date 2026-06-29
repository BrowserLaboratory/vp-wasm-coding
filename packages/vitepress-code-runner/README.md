# @vp-code-runner/vitepress

VitePress packaging layer for the pure-TS `@vp-code-runner/core` Python
execution engine. Drop a `CodeRunner` into any VitePress / Vue 3 page to get an
editor + run button + per-testcase AC/WA/RE/TLE results — running Python fully
client-side via Pyodide, with random inputs from a Rust→WASM generator.

Works on a plain static host (e.g. GitHub Pages) with **no COOP/COEP** headers.

## Install

```sh
pnpm add @vp-code-runner/vitepress @vp-code-runner/core
```

## Quick start

1. Fetch the pinned Pyodide runtime files:

   ```sh
   bash node_modules/@vp-code-runner/vitepress/scripts/download-pyodide.sh public/pyodide
   ```

2. Register the Vite plugin in `.vitepress/config.ts` so the Pyodide + generator
   assets are served in dev and emitted in build:

   ```ts
   import { defineConfig } from 'vitepress'
   import { codeRunnerAssets } from '@vp-code-runner/vitepress/vite'

   export default defineConfig({
     base: '/my-repo/', // non-root base is supported
     vite: {
       plugins: [
         codeRunnerAssets({
           pyodideDir: 'public/pyodide',
           generatorDir: 'node_modules/random-input-generator/pkg',
           base: '/my-repo/',
         }),
       ],
     },
   })
   ```

3. Use the component (and its CSS) in a page / theme:

   ```vue
   <script setup lang="ts">
   import { CodeRunner } from '@vp-code-runner/vitepress'
   import '@vp-code-runner/vitepress/style.css' // optional theming variables
   </script>

   <template>
     <CodeRunner
       language="python"
       starter-code="print(int(input()) * 2)"
       :testcases="[{ input: '21', expected_output: '42' }]"
     />
   </template>
   ```

## Configurable asset base

Asset URLs default to `import.meta.env.BASE_URL` (so a non-root `base` like
`/my-repo/` Just Works) and fall back to `/`. Override per component with the
`config` prop, or app-wide via `provideCodeRunnerConfig({ base, pyodideDir,
generatorDir })` in `enhanceApp`.

## Security

This runner does **not** safely sandbox hostile code. The real boundary is
**Web Worker isolation + a CSP `connect-src 'self'` restriction +
`worker.terminate()`**. The Python-level import blocklist and `sys.settrace`
op-counter are best-effort only and are **not a security guarantee**. See
[SECURITY.md](./SECURITY.md) for the full threat model and a recommended CSP.
