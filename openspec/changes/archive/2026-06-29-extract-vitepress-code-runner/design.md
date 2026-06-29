## Context

本 repo（vitepress-wasm-coding）目前為 greenfield，僅有 openspec 與 temp-refs/fhsh.py-dojo（抽出來源）。來源已驗證可在純前端以 Pyodide module Worker 執行 Python、以自製 Rust→WASM 產生隨機輸入並判題。研究與評估報告位於 .spectra/research/（00 總覽、01 VitePress 封裝、02 Pyodide、03 Rust/WASM、04 C/C++、05 編輯器與產生器解耦），皆經 adversarial review。

關鍵既有事實（已驗證）：

- Pyodide 現行用法不需 SharedArrayBuffer/COOP/COEP；production 無相關 header 仍可執行。
- Python import 黑名單在 Pyodide 的 Python 3.13 失效（legacy finder 協定已於 3.12 移除）；settrace op-counter 為 per-line 且可被一行關閉。真正硬性 time limit 只有 worker.terminate()。
- 來源的 vite-plugin-wasm 與 vite-plugin-top-level-await 對 @vite-ignore 載入 public 資產的方式不生效，可不沿用。
- 編輯器為 CodeMirror 6，對外契約僅單一 v-model，唯一使用點在 ChallengeView；但 skeleton/尺寸依賴 Tailwind utility class 且假設父層有高度。
- Rust 模組為兩個不相交子圖：產生器（parser、rng）與 OJ（pool、crypto、key_material、judge）；aes-gcm/zeroize 僅 OJ 使用，產生器 crate 可安全移除。

## Goals / Non-Goals

**Goals:**

- 將與應用無關的「Python 執行引擎 + 隨機輸入產生器 + 可插拔編輯器」抽成可重用、可在其他 VitePress 專案 drop-in 的 library。
- 任何靜態主機（含 GitHub Pages）免設特殊 header 即可使用；資產 base 可設定，不再硬編碼 root 絕對路徑。
- 預設行為與來源等價：CodeMirror 編輯器、Pyodide 執行、stdout 比對判題、隨機輸入產生。

**Non-Goals:**

- 不抽 OJ 加密題庫層（load_pool、select_testcases、get_expected、judge、AES-GCM、pool/crypto/key_material 模組）；留在應用層。
- 本次不處理 COOP/COEP / cross-origin isolation 與其衍生功能（interrupt-buffer TLE、阻塞式 input()、多執行緒）；列為未來。
- 本次不實作 Monaco adapter，也不擴充 C/C++ 執行；僅確保 adapter 介面與 language 欄位為其預留位置。
- 不提供強隔離 sandbox；不宣稱可安全執行敵意程式碼。

## Decisions

### 採雙套件分層：純 TS core 與 VitePress adapter

把執行引擎放在不相依 Vue/VitePress 的 code-runner-core（Worker、executor、runner、judge），UI 與整合放在 vitepress-code-runner（Vue 元件、composables、Vite 外掛）。理由：最大化重用（core 可被非 VitePress 專案使用），並讓 VitePress/SSR 專屬問題集中在 adapter 層。替代方案：單一 VitePress-only 套件（較快但綁死框架，與「轉換到其他專案」目標衝突），已否決。

### 拆出 random-input-generator Rust crate（移除加密相依）

由 testcase-generator 取出 parser 與 rng 兩模組成獨立 crate，只匯出 generate_challenge，移除 aes-gcm 與 zeroize，並以 wasm-pack --target web 編譯。理由：grep 已證實兩子圖不相交，可得到更小且無 OJ 相依的產生器 WASM。替代方案：沿用整包 testcase-generator 僅匯出部分函式（仍拖入加密相依、體積較大），已否決。

### 編輯器以注入式 adapter 介面實作，預設 CodeMirror

定義語言無關的 EditorAdapter 契約（modelValue 雙向、language、readOnly），runner UI 以 prop 注入動態元件為主要 API、scoped slot 為逃生口；預設提供 CodeMirror adapter（含 Python 自動完成）。語言自動完成等工具屬各 adapter 內部，不進共用介面。理由：現況耦合度低（單一 v-model、單一使用點），插件化成本低且為未來 Monaco/C-C++ 預留。替代方案：provide/inject 作為公開 API（隱性耦合、不利型別與文件），已排除於公開 API。

### 以 worker.terminate() 作為唯一硬性 time limit，移除失效的 sandbox 與 op-counter 賣點

保留主執行緒 wall-clock kill 終止 Worker 為唯一硬性保證；不再把 Python import 黑名單與 settrace op-counter 當成安全或時間保證對外宣稱，並於文件明載真正邊界為 Worker isolation + CSP connect-src self + terminate。理由：兩者已被本機重現證實失效/可繞過。替代方案：改用 setInterruptBuffer（需 COOP/COEP，屬未來），本次不採。

### 資產載入採可設定 base 並由 Vite 外掛 emit/serve

Pyodide runtime 與產生器 WASM 不再硬編碼 root 絕對路徑；core 接受可設定的 asset base（預設由 import.meta.url 推導），vitepress-code-runner 提供 Vite 外掛負責在 build 時 emit 資產、在 dev serve 資產，並可切換 bundled 或 CDN 來源。理由：解決跨 base path 與跨 consumer 專案的可攜性。替代方案：要求 consumer 自行手動複製資產到 public（易錯、與 drop-in 目標衝突），降為備援。

### SSR 安全：執行層與編輯器一律 client-only 動態載入

所有 Worker、WASM、Pyodide、編輯器實作只在 onMounted 後動態 import，元件以 ClientOnly 或等價守衛包裹，避免 VitePress SSG build 觸及瀏覽器專屬 API。理由：VitePress 以 SSR/SSG 建置，瀏覽器專屬資源在 build 期會失敗。替代方案：無（為硬性限制）。

## Implementation Contract

**對外可觀察行為與介面：**

- code-runner-core 匯出（至少）：建立並管理 Pyodide Worker 的 executor（提供 run、execute、stop、isRunning），dev-style runner（由隨機輸入 → 執行學生碼 → 以 trimEnd 後字串比對產生 AC/WA/RE/TLE），以及純函式 computeVerdict 與 buildWrappedCode。資料形狀沿用來源的 RunRequest／TestcaseResult／ExecuteRequest／ExecuteResult 訊息協定。
- 時間上限：當單筆或整批執行超過設定的 wall-clock 預算時，主執行緒呼叫 worker.terminate() 並回報 TLE；此為唯一硬性保證。
- random-input-generator：WASM 匯出 generate_challenge(params_json: string, count: number) 回傳 { inputs: string[] }；params 規格沿用來源 parser 支援的型別（int/float/string/list，min/max/len/separator/multiple_of，及可選 faker）。
- EditorAdapter：任一編輯器元件以 modelValue 雙向綁定提供程式碼字串、接受 language 與 readOnly props；預設 CodeMirror adapter 行為與來源 CodeEditor 等價（lazy import、loading skeleton、Python 自動完成）。
- vitepress-code-runner：提供可在 Markdown/Vue 使用的 CodeRunner 元件與其 Vite 外掛；外掛使 Pyodide 與產生器 WASM 資產在 dev 與 build 皆可正確解析，且支援設定 asset base。

**失敗模式：**

- WASM 產生失敗、generator 執行失敗、Worker error 皆需回傳可辨識的錯誤訊息（沿用來源的 errorMessage 模式），不可靜默吞掉。
- 超時一律呈現為 TLE 並終止 Worker。

**驗收標準：**

- 由 code-runner-core 與產生器抽出的純函式與 Worker 邏輯，沿用並通過來源既有對應單元測試（worker-utils、useExecutor、pyodide-worker、useWasm 等的等價測試）。
- 在一個最小 VitePress consumer 範例中，CodeRunner 能於 dev 與 build/preview 兩種模式載入、執行一段 Python、回傳正確 AC/WA、並能以 generate_challenge 產生隨機輸入；且不需設定任何 COOP/COEP header。
- random-input-generator crate 以 cargo test 通過（沿用來源 generate_challenge 測試），且編譯產物不含 aes-gcm/zeroize。
- 預設 CodeMirror adapter 可被替換：以一個 stub adapter 注入後，runner 仍能取得/更新程式碼字串。

**範圍邊界：**

- 範圍內：上述四個 capability 的抽出、解耦、SSR 安全化、資產可攜化、安全模型文件化。
- 範圍外：OJ 加密題庫、COOP/COEP、Monaco adapter、C/C++ 執行、CDN 資產模式的完整實作（僅保留切換點，不必完成 CDN 串接）。

## Risks / Trade-offs

- [Rust crate 拆分需在來源側重構成兩個 WASM module] → 本 repo 以新 crate 重建產生器，OJ 留在來源/應用；以 cargo test 與產出檢查驗證無加密相依。
- [VitePress 2.0 仍為 alpha，theme/markdown 介面易破壞] → peerDependencies 採保守範圍、整合測試鎖定目前 alpha；版本相依點集中於 adapter 層。
- [編輯器尚有 Tailwind 與父層高度的隱性耦合] → adapter 自帶必要樣式與容器高度策略，不假設 consumer 使用 Tailwind。
- [移除對外宣稱的 sandbox 可能被誤解為降級] → 文件明載真正邊界與威脅模型，避免使用者誤把 library 當成可安全執行敵意程式碼。
- [資產 base 設定錯誤導致載入失敗] → Vite 外掛提供預設推導與明確錯誤訊息，並在 consumer 範例中涵蓋 build/preview 驗證。

## Open Questions

- 「monica/Monaco」預設編輯器：本次以 CodeMirror 為預設、Monaco 列未來可選 adapter（依討論預設值處理；若使用者要改預設為 Monaco，於後續 change 處理）。
- .spectra/ 目前在 .gitignore，研究報告是否納入版控待使用者決定（不影響本 change 實作）。
