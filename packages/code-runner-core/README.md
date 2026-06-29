# @cxphoenix/vp-wasm-coding-core

Framework-agnostic, **client-side Python execution engine**. Pure TypeScript — no Vue, no VitePress. It runs Python in an isolated [Pyodide](https://pyodide.org) module Web Worker, captures stdin/stdout, and produces **AC / WA / RE / TLE** verdicts. Works on a plain static host; **no COOP/COEP / cross-origin isolation required.**

For the VitePress component built on top of this engine, see [`@cxphoenix/vp-wasm-coding`](https://www.npmjs.com/package/@cxphoenix/vp-wasm-coding).

## Install

```bash
npm install @cxphoenix/vp-wasm-coding-core
```

## Use

```ts
import { createExecutor } from '@cxphoenix/vp-wasm-coding-core'

const executor = createExecutor({ pyodideIndexURL: '/pyodide/' })
const summary = await executor.run('print(int(input()) * 2)', [
  { input: '5', expected_output: '10' },
])
console.log(summary.passed, '/', summary.total)
```

The Pyodide runtime is fetched at runtime from `pyodideIndexURL`; host those files yourself (or via a CDN). The worker is exposed at the `./worker` subpath export for advanced custom setups.

## Security boundary

This engine does **not** safely sandbox hostile code. The real boundary is Web Worker isolation + a `connect-src 'self'` CSP + `worker.terminate()` (the only authoritative time limit). The in-worker op-counter and import blocklist are best-effort, **not** security guarantees.

## License

[ECL-2.0](./LICENSE) (Educational Community License, Version 2.0).
