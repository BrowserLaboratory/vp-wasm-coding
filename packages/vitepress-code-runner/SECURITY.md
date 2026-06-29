# Security model

`@cxphoenix/vp-wasm-coding` runs **arbitrary user-supplied Python** in the
visitor's own browser via Pyodide. Read this before deploying it anywhere that
matters.

## TL;DR

- **This library does NOT safely sandbox hostile code.** Do not treat it as a
  secure jail for untrusted, adversarial programs.
- The Python-level **import blocklist** and the **`sys.settrace` op-counter**
  are **best-effort only and are NOT a security guarantee**. Do not rely on them
  as a security boundary.
- The real boundary is three browser-platform mechanisms working together:
  **Web Worker isolation**, a **Content-Security-Policy `connect-src 'self'`**
  restriction, and the main thread calling **`worker.terminate()`** as the only
  authoritative time limit.

## What actually protects you

### 1. Web Worker isolation

All Python execution happens inside a dedicated **Worker**. A Worker has no DOM
access, no access to the page's `window`/`document`, and runs off the main
thread. Code running in the Worker cannot read or mutate your page, cookies, or
DOM. This is the primary isolation boundary.

### 2. CSP `connect-src 'self'`

Set a **Content-Security-Policy** on the served site, in particular
**`connect-src 'self'`** (plus the CDN origin you load Pyodide assets from, if
any). This is what prevents executed code from exfiltrating data to an
attacker-controlled origin via `fetch`/`XMLHttpRequest`/WebSocket. Without a CSP,
code in the Worker can make arbitrary network requests.

A reasonable starting policy (adjust the asset origin to your hosting):

```
Content-Security-Policy: default-src 'self'; connect-src 'self'; worker-src 'self' blob:; script-src 'self' 'wasm-unsafe-eval'
```

### 3. `worker.terminate()` — the only hard time limit

The main thread enforces a wall-clock budget and, on timeout (or an explicit
stop), calls **`worker.terminate()`**. Terminating the Worker is the **only
authoritative** way to stop runaway code — it kills the thread outright. This is
reported to the user as a `TLE` verdict.

## What is NOT a security boundary

The core engine injects two cheap guards into the executed Python. They exist as
UX hints, not as defenses, and **must not be presented as security guarantees**:

- **Import blocklist** (`js`, `pyodide`, `pyodide_js`, …). On Pyodide's
  Python 3.13 runtime the legacy meta-path finder protocol it relies on has been
  removed, so this blocklist is **bypassable**. It is **not a security
  guarantee** and does not prevent a determined program from reaching the
  Pyodide/JS bridge.
- **`sys.settrace` op-counter "TLE"**. It increments per Python line and is
  trivially defeated (e.g. a single C-level call such as a large comprehension
  never trips it). It is a best-effort hint, **not** a hard time limit and **not
  a security guarantee**. The real time limit is `worker.terminate()`.

## Cross-origin isolation

The runner is deliberately built to work **without COOP/COEP** headers
(no `SharedArrayBuffer`/`Atomics`), so it deploys to plain static hosts such as
GitHub Pages. That also means it does not use a cross-origin-isolated, interrupt-
buffer-based time limit; `worker.terminate()` remains the hard stop.

## Recommendations for operators

- Serve over HTTPS with a strict CSP including `connect-src 'self'`.
- Keep the runner on an origin that has nothing sensitive to exfiltrate (no
  session cookies for valuable services on the same origin).
- Treat any "sandbox" expectation as false: assume executed code can do anything
  the browser sandbox + your CSP allow, and nothing your CSP forbids.
