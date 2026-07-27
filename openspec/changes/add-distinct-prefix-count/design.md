## Context

`crates/random-input-generator` 是 fhsh.py-dojo `testcase-generator` 的抽出版，經 WASM 提供給 VitePress 前端生成隨機測資輸入。現行 `count` 抽樣為獨立抽選（無相異保證），輸出行首也無法自動宣告個數。需求規格 `.spectra/requirements/testcase-generator-distinct-prefix-count.md`（v4.1）已經四輪 adversarial review 收斂，本 change 依該規格落地 R1（`distinct`）與 R2（`prefix_count`）。目前僅有 Rust 單一實作，需求 I.7 多實作驗收條件不成立、不適用。

## Goals / Non-Goals

**Goals:**

- 依需求 Part I 規範實作 `distinct` 與 `prefix_count` 兩個參數規格頂層欄位，涵蓋追溯矩陣 M1–M22 全部行為。
- conformance fixtures 以「JSON 資料檔 + Rust harness」形態落地，為未來多實作共用預留。
- 採用需求 Part II 的 Q1 順序、Q2 均勻性檢查（固定 seed）；Q3 效能降級為 native release 測試並標明環境。
- CI 增加 release 組態測試，消除 `debug_assert!` 假安全。

**Non-Goals:**

- 不動 JS 套件程式碼（params 為 JSON pass-through），僅補文件。
- 不實作 R3（參數連動／可變行數／dataset 複合型別）與「釘死第 k 筆測資」；僅確保 schema 不堵 R3 的路。
- 不建 WASM + Node 的效能量測環境。
- 不處理 fhsh.py-dojo 回灌與多實作 parity（I.7 條件不成立）。

## Decisions

### 欄位命名採 distinct 與 prefix_count

與需求文件 schema 附錄、追溯矩陣、驗收條款完全一致，零改寫成本。`distinct` 為 SQL／數學標準用語，不會被誤解為全域唯一；`prefix_count` 明確描述位置語意。替代案 `unique` / `with_count` 因需整份需求文件同步改寫且語意較模糊而否決。兩欄位為參數規格頂層欄位（與 `type`、`count` 同層），serde 預設 `false`。

### enum 支援 distinct 而字串型別與 faker 建構期報錯

`enum` distinct 本質與 `int` 相同（有限集合不放回抽樣），實作成本低、教學有用，且單一實作下無多實作同步負擔，故支援（需求 AC-C3 生效；values 先去重再驗證與抽樣）。字串型別依需求初版不支援、宣告即建構期報錯。`faker` 值域大小無法定義，`faker + distinct` 建構期報錯（比照字串型別，明確拒絕不默默忽略）；`faker + prefix_count` 支援（與型別無關）。

### 不放回抽樣採門檻式混合策略

- 值域大小 ≤ 4 × n（實際抽出個數；Round 3 由 count.max 修正為 n，避免 count 區間很寬、實際只抽少量值時展開整個值域）：將值域展開為陣列，partial Fisher–Yates 洗牌取前 n 個。最多展開 4 × 10^4 個元素（MAX_COUNT = 10^4），緊繃情境（值域大小 = n，排列）一次到位。
- 值域大小 > 4 × n：rejection sampling + HashSet 去重，單次碰撞機率 < 1/4，期望重抽次數有上界，巨大值域（如 [1, 10^9] 取 10^4 個）不需展開。
- 兩路徑輸出順序天然隨機，滿足「不得固定排序」規範，無需額外洗牌。門檻常數實作時可微調，但兩種極端行為不變。
- 值域大小一律以飽和運算（`i64::saturating_sub` 後轉 `u64`／`u128`）計算，避免 `max − min + 1` 溢位。

### conformance fixtures 為 JSON 資料檔加 Rust harness

每個 fixture 為一個 JSON 檔：params 設定 + 宣告式期望（期望類型涵蓋：distinct 驗證、prefix_count 格式驗證、值域驗證、建構期錯誤、向後相容輸出語意、排列驗證）。單一 Rust 測試 harness 逐檔載入執行。params 與期望為語言中立資料，未來第二實作只需重寫薄 harness，符合需求「fixture = params + check」的共用定義。完整 check DSL 因 YAGNI 否決；純 Rust 測試因堵死共用路徑否決。

### CI 增加 release 組態測試並移除既有 debug_assert

需求 AC-C1-5 要求錯誤路徑 fixtures 於 release 組態產物上完整執行（防 `debug_assert!` 在 release 被 strip）。做法：CI 對 crate 同時跑 debug 與 `cargo test --release` 兩種組態的同一套測試；`debug_assert!` 被 strip 為 Rust 編譯層行為，native release 測試即可暴露，不需套 WASM 層。同時將 rng 模組內既有的兩處 `debug_assert!`（count 範圍、長度範圍）改為依賴 parse 層保證的處理方式，消除地雷。

### 品質檢查採 Q1 Q2 全量與 Q3 降級

Q1（輸出順序 smoke test：固定 seed 1000 行，完全升冪／降冪各 ≤ 10 行，兩組參數）與 Q2（均勻性卡方檢定：10^4 行、df=19、臨界值 43.82）依需求參數照做，寫成固定 seed 的一般測試。Q3 效能寫成 native release 組態測試（單行 < 100 ms，兩種極端參數組），量測環境於 README 標明為 native release（需求允許環境隨實作標明）；WASM 環境數據待回灌時再量。seed 由本實作自選自持，變更走一般 review 流程。

## Implementation Contract

- **行為**：呼叫端傳入含 `distinct` / `prefix_count` 欄位的 params JSON 後，`generate_challenge` 輸出滿足——`distinct: true` 時同行值兩兩相異且順序非固定排序；`prefix_count: true` 時行首多一個 token 為實際個數 n，整行以 `count.separator` join；`n = 0` 且 `prefix_count: true` 時該行輸出恰為 `0`，未開 `prefix_count` 時為空行；兩欄位未宣告時輸出語意與現行位元級一致。
- **介面／資料形狀**：`CountSpec` 不變；`ParamSpec` 各變體（Int、五種字串型別、Enum、Faker）增加 `distinct: bool` 與 `prefix_count: bool`（serde default false）。公開 API `generate_challenge(params_json, count)` 簽名不變。
- **失敗模式**：以下組合於 `parse_params` 回傳描述性 `Err`（不 panic、不默默忽略）——`distinct` + 字串型別、`distinct` + faker、`distinct` 且值域大小 < count.max、`min > max`、`count.min > count.max`、enum values 去重後個數 < count.max（宣告 distinct 時）。錯誤訊息含 param 名稱與原因。
- **驗收方式**：`cargo test`（debug）與 `cargo test --release` 全綠；conformance harness 覆蓋 M1–M22 對應 fixtures；品質測試 Q1/Q2/Q3 通過；`spectra validate` 通過。
- **範圍邊界**：只動 `crates/random-input-generator`（src、tests、README、Cargo.toml 如需）與 CI workflow 測試步驟；JS packages 程式碼與 examples 不在範圍。

## Risks / Trade-offs

- [rejection sampling 在門檻邊界附近效能抖動] → 門檻 4 × count.max 保證碰撞機率 < 1/4，期望重試次數 < 4/3 倍；Q3 效能測試守住 100 ms 上限。
- [`i64` 全值域（如 [i64::MIN, i64::MAX]）值域大小超過 u64] → 以 u128 或飽和語意計算值域大小；值域大小只需與 count.max（≤ 10^4）比較，飽和到上限即可判定「足夠大」。
- [固定 seed 統計測試在演算法變更時可能翻紅] → seed 與門檻自持並記錄於測試註解，變更時依 Part II 條款由 review 把關。
- [fixtures 宣告式期望類型設計過窄，未來 fixture 表達不了新行為] → 期望類型以 M1–M22 全矩陣驗證過再定案；新增期望類型屬向後相容擴充。
- [release 測試使 CI 時間變長] → 只對本 crate 跑 release 測試，不擴及整個 workspace。

## Round 1 硬化決策（audit + 三方 adversarial review 後新增）

### 未知欄位建構期拒絕

`ParamSpec` 與 `CountSpec` 同時加上 serde 的 deny_unknown_fields（實測缺一不可）。動機：拼錯的 opt-in 欄位（"distnct"、"prefix-count"）原本被靜默忽略、預設 false，等於靜默停用保證並跳過 validate_distinct_domain 守門——對教學 judge 是「學生被錯判且不可重現」的最壞失效模式。相容性依 M22 窄讀（I.2 schema 附錄為規範性，帶未知鍵的 params 非 conforming params）與 baseline spec「SHALL NOT fail silently」條款判定為有意收緊。已知限制：deny_unknown_fields 與 serde flatten 互斥，若 R3（dataset 複合型別）需要 flatten，此保證須另行提供；若未來出現第二實作，I.7 AC-M1 要求欄位集合跨實作一致，第二實作必須同樣嚴格。

### 窄公開 API generate 取代 pub mod

`parser` / `rng` 模組維持私有，改提供 `generate(params_json, count, rng) -> Result<Vec<String>, String>` 作為唯一 native 入口（整合測試與未來 native host 共用），並對 `count` 參數加上限（10^4，與 MAX_COUNT 同階）回傳錯誤。動機：pub mod 使呼叫端可繞過 parse_params 手工建構 spec，實測觸發 4 個 panic 點與無上界配置；窄 API 使 parse → generate 不可分離，rng 模組內的 unreachable 斷言回復為真正不可達。同時把 rng 內部 8 臂 match 的 positional tuple 改為具名 struct 存取器，使 distinct / prefix_count 欄位互換成為編譯錯誤。否決的替代案：恢復 debug_assert!（需求 I.3 點名的反例）、generate_input 回傳 Result（在抽樣邊界重跑驗證製造第二真相來源，與「建構期報錯」的落點矛盾）、separator 建構期拒絕（破 M22/AC-C2 且把 I.8 明文要求不要寫死的「一 param 一行」假設寫進 validator，改為 README 文件註記）。

## Round 2 硬化決策（第二輪 audit + 雙鏡頭 adversarial review 後新增）

### CI 恢復 default features 測試步驟

Round 1 把 `cargo test` 改為 `cargo test --all-features` 造成出貨組態（wasm-pack 以 default features 建置，faker off）在 CI 零覆蓋，`cfg(not(feature = "faker"))` 的拒絕測試也不再執行——這是 Round 1 修法自己引入的覆蓋率退化。修正為三步：`cargo test`（default）、`cargo test --all-features`、`cargo test --release --all-features`。其餘 Round 2 findings 裁決：MAX_TESTCASES 註解改為誠實敘明只上界輸入筆數（aggregate byte budget 與 param 數上限須先在需求 I.5 補錯誤列，進 backlog）；enum values 含 separator 同樣降為 README 註記（全稱式拒絕會誤傷 count.max=1 的既有合法 params）；partial_shuffle_take 加 release 生效的自我描述 `assert!`（與現行 panic 行為等價，僅改善診斷）；rejection 迴圈上限＋fallback 與 separator 建構期拒絕為 Round 1 已否決案的重新包裝，無新事實不重翻；useWasmGenerator 吞錯經查證 UI 實際有錯誤訊息顯示（audit 高估），且 JS 端明文出界，改列 backlog。

**Backlog（不在本 change，供後續提案）：**

- 記憶體 aggregate budget 與 params 鍵數上限：先補需求 I.5 錯誤列與門檻依據（native/wasm32 環境相依）。
- `useWasmGenerator.generateChallenge` 改 discriminated result 以在 UI 呈現 parser 錯誤細節：JS 套件獨立 change（已發佈 API 的 breaking 變更）。
- 拒絕重複 param key（serde last-wins 靜默吞行）：先補 I.5 錯誤列，實作需自訂 serde visitor。
- WASM + Node 環境的 Q3 效能量測：回灌時處理（既存 Non-Goal）。

## Round 3 硬化決策（第三輪 audit + 雙鏡頭 adversarial review 後新增）

### 抽樣分支改用實際抽出個數與內部不變式編譯期化

抽樣策略分支由「值域大小 ≤ 4 × count.max」修正為「≤ 4 × n（實際抽出個數）」：count 區間寬、實際抽出少量值時不再展開整個值域（如 count 1..10^4、值域 3×10^4 抽 1 個值原需展開 3×10^4 筆）。正確性不變（建構期保證值域 ≥ count.max ≥ n；rejection 碰撞率仍 < 1/4 且配置量收緊）；需求 I.3 明文演算法不指定，屬實作自由。既有品質測試參數組皆 count.min = count.max，固定 seed 串流位元不變，fixtures 期望為性質式不受影響。同輪一併：generate_distinct 的萬用臂展開為顯式 variant 列表（新增型別成為編譯錯誤而非 release panic，與 CommonFields 同一原則）；random_len 與 validate_len 統一 div_ceil；CI 補第四步 `cargo test --release`（default features 即出貨組態，滿足 AC-C1-5 字面要求，release 步驟註解改掛 AC-C1-5 論據）；quality.rs 修正 Q1 secondary 的錯誤路徑註解並增列第三組（值域 [1,50]、n=20，覆蓋展開洗牌分支的系統性排序守門——Part II 給定的兩組參數在本實作門檻策略下皆落 rejection 分支）；README 補 multiple_of < 1 視同 1 註記。否決：建構期拒絕 multiple_of: 0（既有合法欄位值、I.5 無對應列，破 M22——與 separator 案同級處置降為文件），進 backlog「I.5 補既有數值欄位值域錯誤列」。
