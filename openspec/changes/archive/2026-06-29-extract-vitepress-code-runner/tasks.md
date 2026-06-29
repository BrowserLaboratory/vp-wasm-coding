## 1. 專案骨架與工作區

- [x] 1.1 依「採雙套件分層：純 TS core 與 VitePress adapter」決策，建立 pnpm workspace 與 packages/code-runner-core、packages/vitepress-code-runner、crates/random-input-generator 三個工作區骨架。行為：pnpm install 後三個工作區可被解析並互相 import。驗證：pnpm install 成功且 pnpm -r list 列出三個工作區。

## 2. random-input-generator（Rust → WASM）

- [x] 2.1 [P] 依「拆出 random-input-generator Rust crate（移除加密相依）」決策，建立只含 parser 與 rng 模組、匯出 generate_challenge 的 crate，實作 "Generate random stdin inputs from a parameter specification"。行為：generate_challenge(params_json, count) 回傳 count 筆符合規格的隨機 stdin 字串。驗證：cargo test 通過（沿用來源 generate_challenge_returns_correct_count 測試）。
- [x] 2.2 實作並驗證 "Decoupled from the encrypted pool and judge logic"：Cargo.toml 不含 aes-gcm/zeroize，產物不連結 pool/crypto/key_material/judge。行為：產生器 WASM 僅提供輸入產生、無加密相依。驗證：cargo tree -e normal 無 aes-gcm，且 wasm-pack build --target web 產物匯出僅 generate_challenge。
- [x] 2.3 實作 "Report generation failures explicitly"：無效 params_json 回傳可辨識錯誤而非 panic 或靜默。行為：malformed spec 導致回傳 Err。驗證：cargo test 針對 invalid json 斷言回傳 Err（沿用來源 parse_params invalid 測試）。

## 3. code-runner-core：Python 執行引擎

- [x] 3.1 [P] 建立 code-runner-core 的 vitest 設定並移植來源核心測試（worker-utils、useExecutor、pyodide-worker-execute）。行為：測試 harness 可執行並涵蓋本群組需求。驗證：pnpm --filter code-runner-core test 可執行。
- [x] 3.2 實作 "Execute Python in an isolated worker" 與 "Capture standard input and output"：移植 pyodide module Worker 與 buildWrappedCode 的 stdin/stdout 重導向。行為：於 Worker 載入 Pyodide、餵入 stdin、回傳擷取的 stdout。驗證：pyodide-worker-execute 與 worker-utils(buildWrappedCode) 等價測試綠。
- [x] 3.3 實作 "Produce a verdict by comparing trimmed output"：移植 computeVerdict 與 buildTestcaseResultFields，以 trimEnd 後比對分類 AC/WA/RE/TLE。行為：testcase 完成後產生對應 verdict。驗證：worker-utils 等價測試（含 AC/WA 邊界）綠。
- [x] 3.4 依「以 worker.terminate() 作為唯一硬性 time limit，移除失效的 sandbox 與 op-counter 賣點」決策，實作 "Enforce a hard time limit by terminating the worker"：保留主執行緒 wall-clock kill，並移除/降級 import 黑名單與 settrace 的對外保證宣稱。行為：超時時終止 Worker 並回報 TLE。驗證：useExecutor 等價超時測試綠，且程式碼與文件審查確認不再宣稱黑名單為保證。
- [x] 3.5 實作 "Operate without cross-origin isolation"：core 不使用 SharedArrayBuffer/Atomics、不要求 COOP/COEP。行為：於無特殊 header 環境執行 Python 成功。驗證：grep 確認無 SharedArrayBuffer/Atomics，且測試在無 header 設定下通過。

## 4. dev-style runner

- [x] 4.1 移植 dev-style runner，串接 generator 產生輸入 → 於 core 執行學生碼 → 以 trimEnd 比對輸出的完整 "Execute Python in an isolated worker" 流程。行為：單次 run 回傳每筆 AC/WA/RE/TLE。驗證：useChallengeRunner-dev 等價測試綠。

## 5. pluggable-code-editor

- [x] 5.1 [P] 依「編輯器以注入式 adapter 介面實作，預設 CodeMirror」決策，定義 "Language-agnostic editor adapter contract"（modelValue 雙向、language、readOnly）。行為：任一符合契約的編輯器皆可被 runner 使用。驗證：以 stub adapter 進行雙向綁定單元測試綠。
- [x] 5.2 實作 "Default CodeMirror adapter"：移植 CodeEditor 為 CodeMirror adapter（lazy import、loading skeleton、Python autocomplete），自帶必要樣式與容器高度、不假設 consumer 使用 Tailwind。行為：未指定編輯器時預設可編輯 Python。驗證：元件測試（mount → 編輯 → emit update:modelValue）綠，且審查確認無 consumer Tailwind 依賴。
- [x] 5.3 實作 "Host can replace the editor implementation"：runner UI 以 prop 注入動態元件為主、scoped slot 為逃生口。行為：注入自訂編輯器後 runner 仍能讀寫程式碼。驗證：注入 stub editor 的元件測試綠。
- [x] 5.4 依「SSR 安全：執行層與編輯器一律 client-only 動態載入」決策，實作 "Editor renders client-only"：adapter 僅 onMounted 後載入、SSR 不觸及瀏覽器 API。行為：SSG build 不存取 browser-only API。驗證：consumer build 成功且 import.meta.env.SSR 守衛審查通過。

## 6. vitepress-code-runner 封裝與資產

- [x] 6.1 實作 "SSR-safe components and composables for VitePress"：以多入口 exports 匯出 CodeRunner 元件與 composables，瀏覽器資源僅 mount 後載入。行為：VitePress 頁面註冊並渲染 runner 不報 SSR 錯誤。驗證：最小 consumer build 無 server-side 錯誤。
- [x] 6.2 依「資產載入採可設定 base 並由 Vite 外掛 emit/serve」決策，實作 "Configurable asset base"：core 接受可設定 asset base，預設由 import.meta.url 推導，取代硬編碼 root 絕對路徑。行為：non-root base 下資產可正確載入。驗證：non-root base 的 consumer 範例載入 Pyodide 與 generator 成功。
- [x] 6.3 實作 "Vite plugin makes assets available in dev and build"：Vite 外掛於 dev serve、build emit Pyodide 與 generator WASM 資產。行為：consumer 免手動複製資產。驗證：consumer dev 與 preview 兩模式資產皆可解析（整合驗證）。
- [x] 6.4 驗證 "Works on a static host without special headers"：於無 COOP/COEP 的靜態環境執行。行為：靜態主機可跑 Python 與產生器。驗證：以未設 header 的靜態伺服器跑 consumer preview，Python 執行與 generate_challenge 成功。
- [x] 6.5 [P] 實作 "Documented security boundary"：撰寫安全文件，明載 Worker isolation + CSP connect-src self + worker.terminate() 為真正邊界，且不宣稱 import 黑名單為安全機制。行為：consumer 能讀到正確威脅模型。驗證：文件內容審查涵蓋上述三項邊界敘述。

## 7. 整合驗證

- [x] 7.1 建立最小 VitePress consumer 範例，端到端串接四項能力：於 dev 與 build/preview 跑通一段 Python（含 AC 與 WA 結果）、以 generate_challenge 產生隨機輸入，且免任何 COOP/COEP。行為：完整純前端 coding 平台流程可運作。驗證：手動或整合腳本確認 dev 與 preview 皆完成流程。
