## Why

fhsh.py-dojo 已驗證可在純前端（Pyodide + 自製 WASM）執行 Python 並判題，但整套執行能力與 UI 與該 OJ 應用緊綁、資產路徑硬編碼（root 絕對路徑），且把已失效的 Python import 黑名單當成安全機制。為了能快速建立其他「純前端 coding 平台」，需把與應用無關的執行引擎、隨機輸入產生器、可插拔編輯器抽成可重用、可 drop-in 的 library；OJ 加密題庫與 cross-origin isolation 留待後續。

## What Changes

- 新增純 TS 執行引擎核心：Pyodide module Worker、Worker 生命週期管理、dev-style runner（隨機輸入 → 學生碼執行 → stdout 比對）、以 worker.terminate() 為硬性 time limit。
- 新增隨機輸入產生器 WASM：由 testcase-generator 拆出 parser + rng 兩個模組成獨立 Rust crate，移除 aes-gcm/zeroize，提供由 JSON 參數規格快速產生多筆隨機 stdin 的能力，讓使用者免於手打大量 stdin。
- 新增語言無關的編輯器 adapter 介面與預設 CodeMirror 6 adapter（保留現況的 Python 自動完成）；Monaco 等列為未來可選 adapter。
- 新增 VitePress library 封裝：SSR-safe Vue 元件與 composables、Vite 外掛（emit/serve 自帶資產、資產 base 可設定）、npm 多入口打包與 peerDependencies。
- 安全模型文件化：明載真正邊界為 Worker isolation + CSP connect-src self + terminate；移除誤導性的 COOP/COEP 註解與失效的 Python import 黑名單（或標為非邊界的 defense-in-depth）。

## Capabilities

### New Capabilities

- `python-code-execution`: 在瀏覽器 Worker 內執行 Python（Pyodide）、擷取 stdin/stdout、以 terminate 強制時間上限、並以 stdout 比對產生判題結果的核心執行引擎。
- `random-input-generator`: 由 JSON 參數規格快速產生多筆隨機 stdin 輸入的 WASM 產生器，與 OJ 加密題庫完全解耦。
- `pluggable-code-editor`: 語言無關的編輯器 adapter 介面與預設 CodeMirror adapter，供 runner UI 注入或替換編輯器實作。
- `vitepress-code-runner-package`: 把上述能力打包成 SSR-safe、資產路徑可設定、可在其他 VitePress 專案 drop-in 的 library 與 Vite 外掛。

### Modified Capabilities

(none)

## Impact

- Affected specs: 新增 python-code-execution、random-input-generator、pluggable-code-editor、vitepress-code-runner-package 四個 capability。
- Affected code:
  - New:
    - package.json
    - pnpm-workspace.yaml
    - crates/random-input-generator/Cargo.toml
    - crates/random-input-generator/src/lib.rs
    - crates/random-input-generator/src/parser.rs
    - crates/random-input-generator/src/rng.rs
    - packages/code-runner-core/package.json
    - packages/code-runner-core/src/worker/pyodide.worker.ts
    - packages/code-runner-core/src/worker/worker-utils.ts
    - packages/code-runner-core/src/runtime/useExecutor.ts
    - packages/code-runner-core/src/runtime/runner.ts
    - packages/code-runner-core/src/index.ts
    - packages/vitepress-code-runner/package.json
    - packages/vitepress-code-runner/src/components/CodeRunner.vue
    - packages/vitepress-code-runner/src/composables/useWasmGenerator.ts
    - packages/vitepress-code-runner/src/editors/EditorAdapter.ts
    - packages/vitepress-code-runner/src/editors/codemirror/CodeMirrorEditor.vue
    - packages/vitepress-code-runner/src/vite/plugin.ts
    - packages/vitepress-code-runner/src/index.ts
  - Modified: (none — 本 repo 為 greenfield library，無既有程式碼需改)
  - Removed: (none)
- 抽出依據（不在本 repo 修改）：temp-refs/fhsh.py-dojo 內對應實作，以及 .spectra/research/ 的研究與評估報告。
- 相依：pyodide、vue、vitepress（peerDependencies）；CodeMirror 6 套件（預設 adapter）；wasm-bindgen 與 wasm-pack（建置 Rust crate）。
