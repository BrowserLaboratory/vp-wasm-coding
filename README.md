# vitepress-wasm-coding

Drop a **client-side coding playground** into a [VitePress](https://vitepress.dev) site: students write Python in the browser, it runs in an isolated [Pyodide](https://pyodide.org) Web Worker, and per-testcase **AC / WA / RE / TLE** verdicts render inline. A bundled Rust→WASM random-input generator (`generate_challenge`) produces stdin so users don't have to type test inputs by hand.

Everything runs in the browser — **no server, and no COOP/COEP / cross-origin isolation required.** It works on a plain static host (GitHub Pages, Netlify, …).

## Packages

| Package | What it is |
| ------- | ---------- |
| [`@cxphoenix/vp-wasm-coding`](packages/vitepress-code-runner) | VitePress layer: the SSR-safe `CodeRunner` component, composables, a configurable asset base, a Vite asset plugin, and a pluggable editor (default CodeMirror). |
| [`@cxphoenix/vp-wasm-coding-core`](packages/code-runner-core) | Framework-agnostic engine (pure TypeScript, no Vue): the Pyodide module Worker and the executor/runner controllers. Use it directly outside VitePress. |

The generator WASM ships **inside** `@cxphoenix/vp-wasm-coding` — a single install enables `generate_challenge` with zero extra configuration.

## Install

```bash
npm install @cxphoenix/vp-wasm-coding
```

`@cxphoenix/vp-wasm-coding-core`, `vue`, and `vitepress` are resolved automatically (core is a dependency; `vue`/`vitepress` are peer dependencies you already have in a VitePress project).

## Usage (VitePress)

**1. Register the Vite plugin** in `.vitepress/config.ts`. It serves/emits the runtime assets — the generator WASM is bundled, so you only point it at a Pyodide runtime directory:

```ts
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'vitepress'
import { codeRunnerAssets } from '@cxphoenix/vp-wasm-coding/vite'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  vite: {
    plugins: [
      codeRunnerAssets({
        // Pyodide is consumer-supplied (it is large); download it first (step 2).
        pyodideDir: resolve(here, '../vendor/pyodide'),
        // generatorDir defaults to the WASM bundled in the package — omit it.
      }),
    ],
  },
})
```

**2. Fetch the Pyodide runtime** once (it is too large to bundle). The package ships a helper:

```bash
bash node_modules/@cxphoenix/vp-wasm-coding/scripts/download-pyodide.sh .vitepress/vendor/pyodide
```

**3. Register the component and its stylesheet** in `.vitepress/theme/index.ts`:

```ts
import DefaultTheme from 'vitepress/theme'
import { CodeRunner } from '@cxphoenix/vp-wasm-coding'
import '@cxphoenix/vp-wasm-coding/style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('CodeRunner', CodeRunner)
  },
}
```

**4. Use it in Markdown:**

```md
<CodeRunner
  starter-code="print(int(input()) * 2)"
  :testcases="[{ input: '5', expected_output: '10' }]"
/>
```

A non-root site `base` (e.g. GitHub Pages at `/my-repo/`) is handled automatically — asset URLs derive from `import.meta.env.BASE_URL`.

See [`examples/vitepress-basic`](examples/vitepress-basic) for a complete, runnable consumer site, including the recommended Content-Security-Policy.

## Security boundary

This runner does **not** safely sandbox hostile code, and it is not designed to. The real boundary is:

- **Web Worker isolation** + a `connect-src 'self'` **Content-Security-Policy**, and
- **`worker.terminate()`** as the only authoritative time limit.

The Python-level import blocklist and the in-worker op-counter are **best-effort only** and are **not** security guarantees. See the package [`SECURITY.md`](packages/vitepress-code-runner/SECURITY.md).

## Development

This is a pnpm + Cargo monorepo.

```bash
pnpm install
pnpm build:wasm                 # wasm-pack build the generator crate
pnpm -r build                   # build both JS packages
pnpm -r test                    # run the JS + (cargo) test suites
```

## License

[ECL-2.0](LICENSE) (Educational Community License, Version 2.0).
