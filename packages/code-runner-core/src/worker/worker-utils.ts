/**
 * Pure utility functions for the Pyodide worker.
 * Extracted for testability — no Worker globals or Pyodide dependency.
 */

export type Verdict = 'AC' | 'WA'

export type VerdictDetail = 'hidden' | 'actual' | 'full'

/**
 * Build the optional expected/actual fields for a TestcaseResult
 * based on the verdictDetail setting.
 *
 * - hidden: omit both
 * - actual: include actual only
 * - full:   include both
 */
export function buildTestcaseResultFields(
  actual: string,
  expected: string,
  verdictDetail: VerdictDetail,
): { actual?: string; expected?: string } {
  switch (verdictDetail) {
    case 'hidden':
      return {}
    case 'actual':
      return { actual }
    case 'full':
      return { actual, expected }
  }
}

/**
 * Compare actual output to expected output.
 * Strips trailing whitespace/newlines before comparison (mirrors typical judge behaviour).
 */
export function computeVerdict(actual: string, expected: string): Verdict {
  return actual.trimEnd() === expected.trimEnd() ? 'AC' : 'WA'
}

/**
 * Build the Python code that will be executed inside Pyodide.
 * Injects:
 *   1. sys.settrace op-counter — BEST-EFFORT only (see warning below)
 *   2. _SandboxFinder import blocklist — BEST-EFFORT only (see warning below)
 *   3. sys.stdin simulation via io.StringIO
 *   4. sys.stdout capture via io.StringIO
 *   5. User code
 *   6. sys.settrace removal + output extraction
 *
 * SECURITY / TIME-LIMIT WARNING
 * -----------------------------
 * Neither the op-counter nor the import blocklist is a guarantee:
 *   - The `sys.settrace` op-counter is per-line and trivially defeatable
 *     (e.g. a single C-level call such as a large comprehension or a blocking
 *     builtin never increments it). It is NOT a hard time limit.
 *   - The `_SandboxFinder` import blocklist is bypassable on Pyodide's
 *     Python 3.13 runtime and must NOT be relied on as a security boundary.
 *
 * The ONLY authoritative time limit is `worker.terminate()` enforced by the
 * main-thread controller. The real isolation boundary is the Worker itself
 * (plus a `connect-src 'self'` CSP). The two guards below are kept solely as
 * cheap, best-effort hints and are intentionally not claimed as guarantees.
 */
export function buildWrappedCode(
  userCode: string,
  input: string,
  opLimit: number,
): string {
  // Escape input for embedding in a Python string literal
  const escapedInput = input.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"')

  return `
import sys
import sys as _sys
import io

# ── op-count "TLE" hint — BEST-EFFORT ONLY, NOT a time-limit guarantee ──────
# Per-line and defeatable; the authoritative limit is worker.terminate().
_op_count = 0
_op_limit = ${opLimit}

def _tracer(frame, event, arg):
    global _op_count
    _op_count += 1
    if _op_count > _op_limit:
        raise TimeoutError("Operation limit exceeded (${opLimit} ops)")
    return _tracer

sys.settrace(_tracer)

# ── import blocklist — BEST-EFFORT ONLY, NOT a security boundary ────────────
# Circumventable on Pyodide's Python 3.13; do not rely on it for isolation.
class _SandboxFinder:
    def find_module(self, fullname, path=None):
        if fullname in ('js', 'pyodide_js', 'pyodide') or \
           fullname.startswith(('js.', 'pyodide_js.', 'pyodide.')):
            return self
        return None
    def load_module(self, fullname):
        raise ImportError(f"Module '{fullname}' is not available")

_sys.meta_path.insert(0, _SandboxFinder())
for _n in list(_sys.modules):
    if _n in ('js', 'pyodide_js', 'pyodide') or \
       _n.startswith(('js.', 'pyodide_js.', 'pyodide.')):
        del _sys.modules[_n]

# ── stdin / stdout redirect ───────────────────────────────────────
sys.stdin = io.StringIO("""${escapedInput}""")
_captured_stdout = io.StringIO()
sys.stdout = _captured_stdout

# ── user code ─────────────────────────────────────────────────────
${userCode}

# ── teardown ──────────────────────────────────────────────────────
sys.settrace(None)
_output = _captured_stdout.getvalue()
`.trimStart()
}
