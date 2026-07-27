## Why

資料結構系列示範題（deque / stack 模擬）需要「一行 n 個相異數字」與 APCS 慣例的「行首宣告個數」輸入格式；現行 `random-input-generator` 的 `count` 抽樣既無相異保證、也無法在行首自動輸出個數，導致「答案依賴元素相異性」的題目可能誤判學生為 WA（公平性問題）。需求規格已於 `.spectra/requirements/testcase-generator-distinct-prefix-count.md`（v4.1）經四輪 adversarial review 收斂，現落地實作。

## What Changes

- 參數規格（ParamSpec）新增兩個頂層欄位，預設皆為 `false`、未宣告時行為與現行完全一致（向後相容）：
  - `distinct: true` — 同一 param 同一行（同一 count 批次）內的值兩兩相異。`int` 必須支援；`enum` 支援（values 先去重）；字串型別與 `faker` 宣告即於建構期報錯。
  - `prefix_count: true` — 將「實際個數 n」與抽出的 n 個值視為同一 token 序列以 `count.separator` join；適用所有型別（含 `faker`）；`n = 0` 時輸出僅為 `0`。
- 建構期驗證擴充：`distinct` 宣告時以不溢位方式（飽和運算）驗證「值域大小 ≥ count.max」，失敗即報錯，不得默默生出重複值或無限迴圈。
- 不放回抽樣採門檻式混合策略：值域小（≤ 4 × count.max）走展開 + partial Fisher–Yates；值域大走 rejection sampling + HashSet。輸出順序不得為固定排序。
- conformance fixtures 改為「JSON 資料檔 + Rust harness」形態（宣告式期望類型），對應需求追溯矩陣 M1–M22，為未來多實作共用預留。
- 品質檢查：新增輸出順序 smoke test（Q1）、選值均勻性卡方檢定（Q2）、效能參考測試（Q3，native release 環境並於文件標明）。
- CI 新增 `cargo test --release` 步驟（防 `debug_assert!` 在 release 被 strip 的假安全）；一併移除 `rng.rs` 既有 `debug_assert!` 地雷。
- 文件：crate README 補齊 `distinct` / `prefix_count` 欄位規格與全部邊界行為（release checklist 項）。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `random-input-generator`: 參數規格新增 `distinct` 與 `prefix_count` 頂層欄位，含逐型別支援決議、建構期驗證、輸出格式與邊界行為（追溯矩陣 M1–M22）。

## Impact

- Affected specs: `random-input-generator`（修改）
- Affected code:
  - New: crates/random-input-generator/tests/conformance.rs、crates/random-input-generator/tests/fixtures/（JSON fixtures 目錄）、crates/random-input-generator/tests/quality.rs
  - Modified: crates/random-input-generator/src/parser.rs、crates/random-input-generator/src/rng.rs、crates/random-input-generator/README.md、.github/workflows/（CI 測試步驟）
  - Removed: （無）
- 相依套件：不新增外部 crate（HashSet 用標準函式庫）
- npm 套件：實作完成後由 changesets 出 minor 版；JS 端程式碼不動
