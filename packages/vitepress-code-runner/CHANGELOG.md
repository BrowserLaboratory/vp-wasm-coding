# @cxphoenix/vp-wasm-coding

## 0.2.0

### Minor Changes

- cb86054: `generate_challenge` params 支援兩個新的參數規格頂層欄位（預設皆為 `false`，未宣告時行為完全不變）：

  - `distinct: true` — 同一行抽出的值兩兩相異。`int` 與 `enum`（values 先去重）支援；字串型別與 `faker` 宣告即於建構期報錯。值域不足 `count.max` 時建構期報錯；值域恰好等於 `count.max` 時輸出為隨機排列。
  - `prefix_count: true` — 行首以 `count.separator` join 語意輸出實際個數 `n`（APCS 慣例的 `n x1 … xn` 格式）；適用所有型別；`n = 0` 時該行輸出恰為 `0`。

  **行為收緊（請注意）**：params 內的**未知欄位名**（含 `count` 巢狀內）從「靜默忽略」改為**建構期報錯**——拼錯的欄位（如 `"distnct"`、`"prefix-count"`）過去會被無聲丟棄並停用其保證，現在會使 `generate_challenge` 回傳錯誤。若你的 params 夾帶額外鍵（如註解用途的 `"description"`），升級後需移除。完整 schema 見 `crates/random-input-generator/README.md`。

## 0.1.0

### Minor Changes

- 8344ec1: Initial public release.

  A client-side Python coding playground for VitePress: runs Python in an isolated
  Pyodide Web Worker with AC/WA/RE/TLE verdicts, a bundled Rust→WASM random-input
  generator (`generate_challenge`), and a pluggable editor (default CodeMirror).
  Works on a plain static host — no COOP/COEP required.

  - `@cxphoenix/vp-wasm-coding` — VitePress component, composables, configurable
    asset base, and the `codeRunnerAssets` Vite plugin.
  - `@cxphoenix/vp-wasm-coding-core` — framework-agnostic Pyodide execution engine.

### Patch Changes

- Updated dependencies [8344ec1]
  - @cxphoenix/vp-wasm-coding-core@0.1.0
