## 1. Schema 與建構期驗證（parser）

- [x] 1.1 依 design「欄位命名採 distinct 與 prefix_count」決策，在 crates/random-input-generator/src/parser.rs 的 ParamSpec 全部變體（Int、五種字串型別、Enum、Faker）新增 `distinct: bool` 與 `prefix_count: bool` 頂層欄位（serde default `false`）。行為契約：未宣告欄位的既有 params JSON 解析結果與現行完全一致（Backward compatibility of new fields）。驗證：新增 parser 單元測試——省略欄位時兩欄位為 `false`、宣告 `true`/`false` 時正確反序列化；既有 parser/rng 測試在僅補上新欄位預設值（`distinct: false, prefix_count: false`）的機械性修改後全數通過、斷言邏輯不變（`cargo test -p random-input-generator`）。
- [x] 1.2 依 design「enum 支援 distinct 而字串型別與 faker 建構期報錯」決策，在 parse_params 實作 distinct 建構期驗證（Construction-time validation for distinct feasibility）：(a) 字串型別或 faker 宣告 `distinct: true` 即回傳含 param 名稱的描述性 Err；(b) int 以飽和／寬型別運算計算值域大小 `max − min + 1`，enum 以去重後 values 個數為值域大小，驗證值域大小 ≥ count.max，不足即 Err；(c) 全 i64 範圍（i64::MIN..=i64::MAX）不溢位。既有基本合法性檢查（min ≤ max、count.min ≤ count.max）不論 distinct 皆維持生效。驗證：parser 單元測試覆蓋 M13（值域不足）、M16/M17（不支援型別，含併用 prefix_count）、M21（enum 去重後不足）、全範圍不溢位案例。

## 2. 生成邏輯（rng）

- [x] 2.1 依 design「不放回抽樣採門檻式混合策略」，在 crates/random-input-generator/src/rng.rs 實作 distinct 抽樣（Distinct values within a line）：值域大小 ≤ 4 × count.max 走展開 + partial Fisher–Yates 取前 n；否則 rejection sampling + HashSet。int 與去重後 enum 共用同一策略。行為契約：同行值兩兩相異、個數 ∈ [count.min, count.max]、值在值域內、輸出順序非固定排序；緊繃情境（值域大小 = count.max）輸出為值域的隨機排列（M7–M9）。驗證：rng 單元測試以固定 seed 覆蓋一般／緊繃／巨大值域三情境。
- [x] 2.2 在 rng.rs 實作 prefix_count 輸出（Prefix count line format）：行 = [n, v1..vn] 以 count.separator join；適用所有型別含 faker；n=0 時輸出恰為 `0`（M10）、未開 prefix_count 時 n=0 輸出空行（M11）；count 省略時輸出 `1<sep>值`（M12）；與 distinct 併用時兩者同時滿足（M6）。驗證:rng 單元測試覆蓋 M2–M6、M10–M12,含非空格 separator。
- [x] 2.3 依 design「CI 增加 release 組態測試並移除既有 debug_assert」決策的 rng 部分,移除 rng.rs 中 generate_one 與 random_len 的兩處 `debug_assert!`,改為依賴 parse 層保證的註解說明(不引入 panic 路徑)。行為契約:release 與 debug 組態行為一致,無僅 debug 生效的驗證。驗證:`grep -c "debug_assert" crates/random-input-generator/src/rng.rs` 為 0,且 `cargo test -p random-input-generator` 全綠。

## 3. Conformance fixtures（JSON 資料檔 + harness）

- [x] 3.1 依 design「conformance fixtures 為 JSON 資料檔加 Rust harness」決策，建立 crates/random-input-generator/tests/fixtures/ 目錄與 crates/random-input-generator/tests/conformance.rs harness。fixture JSON 形狀：`{ "params": {...}, "expect": {...} }`，宣告式期望類型至少涵蓋：distinct 驗證、prefix_count 格式（正規表示式或 token 檢查）、值域檢查、建構期錯誤、排列驗證、向後相容輸出語意。行為契約：harness 逐檔載入 fixtures、每檔生成多行並逐一驗證期望，任一 fixture 失敗即測試失敗並輸出 fixture 檔名。驗證：`cargo test -p random-input-generator --test conformance` 執行且列出載入的 fixture 數。
- [x] 3.2 撰寫追溯矩陣 M1–M21 對應的 fixture JSON 檔（AC-C1 行為組：M1 distinct 基本、M2–M4 三種代表型別的 prefix_count 格式、M5 非空格 separator、M6 併用、M7–M12 邊界、M13–M17 錯誤路徑；AC-C3 enum 組：M18–M21）。行為契約：每列矩陣情境至少一個 fixture，錯誤路徑 fixtures 期望建構期 Err。驗證：conformance harness 全綠，fixture 檔名對應矩陣編號可追溯。
- [x] 3.3 撰寫 M22 向後相容 fixture（Backward compatibility of new fields）：取既有型別各一組未宣告新欄位的 params，期望輸出語意與現行一致（行數、token 數、值域、separator）。驗證：conformance harness 全綠。

## 4. 品質檢查測試（Part II）

- [x] 4.1 [P] 依 design「品質檢查採 Q1 Q2 全量與 Q3 降級」，在 crates/random-input-generator/tests/quality.rs 實作 Q1 輸出順序 smoke test：固定 seed，主要參數組 n=10、值域 [1, 10^6] 生成 1000 行，次要參數組 n=20、值域 [1, 100]，「整行完全升冪」與「整行完全降冪」各 ≤ 10 行。行為契約：擋系統性排序（Distinct values within a line 的順序條款）。驗證：`cargo test -p random-input-generator --test quality` 全綠。
- [x] 4.2 [P] 在 quality.rs 實作 Q2 選值均勻性卡方檢定：min=1、max=20、count.min=count.max=10、固定 seed 生成 10^4 行，X² = Σ(O_v−E)²/E，E=5000，df=19，臨界值 43.82，X² < 43.82 通過。驗證：`cargo test -p random-input-generator --test quality` 全綠，seed 與門檻以註解記錄。
- [x] 4.3 [P] 在 quality.rs 實作 Q3 效能參考測試（release 組態執行）：count.max = 10^4、值域 [1, 10^9] 單行 < 100 ms；值域 [1, 10^4] 取滿（排列情境）< 100 ms。debug 組態下以 `#[ignore]` 或組態判斷跳過，避免 debug 慢速誤報。驗證：`cargo test -p random-input-generator --release --test quality` 全綠。

## 5. CI 與文件

- [x] 5.1 依 design「CI 增加 release 組態測試並移除既有 debug_assert」決策的 CI 部分，在 .github/workflows/ci.yml 的 Rust 測試步驟後新增 `cargo test --release`（working-directory: crates/random-input-generator）。行為契約：錯誤路徑 fixtures 於 release 組態產物上完整執行（Construction-time validation for distinct feasibility 的 release 條款）。驗證：本機 `cargo test --release -p random-input-generator` 全綠，CI workflow 檔案含 release 測試步驟。
- [x] 5.2 [P] 更新 crates/random-input-generator/README.md：新增 `distinct` 與 `prefix_count` 欄位規格（含 schema 範例、逐型別支援表、n=0 與 count 省略等全部邊界行為、Q3 效能量測環境標明為 native release）。行為契約：文件涵蓋 spec delta 全部 Requirement 的使用者可見行為（AC-C4 release checklist 項）。驗證：人工比對 README 與 spec delta 的 Requirement 清單，逐項有對應段落。
- [x] 5.3 新增 changeset（minor）描述兩個新欄位，供後續發版使用。行為契約：`.changeset/` 內有一筆 minor bump 條目涵蓋受影響 npm 套件。驗證：`ls .changeset/*.md` 有新檔且內容標明 minor。

## 6. Round 1 硬化（audit + adversarial review 產出）

- [x] 6.1 依 design「未知欄位建構期拒絕」決策，ParamSpec 與 CountSpec 加 `#[serde(deny_unknown_fields)]`（Unknown parameter fields are rejected）。行為契約：頂層與 count 巢狀的拼錯欄位名於建構期報 `unknown field` 錯誤。驗證：parser 三個 typo 單元測試 + fixtures m23a/m23b 於 conformance harness 通過。
- [x] 6.2 依 design「窄公開 API generate 取代 pub mod」決策，crates/random-input-generator/src/lib.rs 收回 `pub mod`，新增 `pub fn generate(params_json, count, rng) -> Result<Vec<String>, String>`（含 `count > 10_000` 上限錯誤），tests/conformance.rs 與 tests/quality.rs 改用此 API；rng.rs 的 positional tuple 改為具名 CommonFields 存取器。行為契約：繞過 parse_params 的建構路徑自 crate 外不可達；count 超限回傳描述性錯誤。驗證：lib.rs 上限測試 2 例 + 全測試套件 debug/release/--all-features 全綠。
- [x] 6.3 .github/workflows/ci.yml 兩個 Rust 測試步驟加 `--all-features`（faker 路徑納入 CI 編譯與執行）；README 補「未知鍵拒絕」與「separator 為作者責任」節。驗證：本機 `cargo test --all-features` 與 `cargo test --release --all-features` 全綠；README 含兩節內容。

## 7. Round 2 硬化（第二輪 audit + adversarial review 產出）

- [x] 7.1 依 design「CI 恢復 default features 測試步驟」決策，.github/workflows/ci.yml 補回 `cargo test`（default features）步驟，形成 default / --all-features / --release --all-features 三步。行為契約：出貨組態（faker off）與 `cfg(not(feature = "faker"))` 拒絕測試在 CI 每次執行。驗證：本機三種組態全綠；ci.yml 含三個 Rust 測試步驟。
- [x] 7.2 lib.rs 的 MAX_TESTCASES doc comment 改為誠實敘明僅上界輸入筆數（不宣稱防住 unbounded allocation）；README separator 節補 enum values 情形；rng.rs partial_shuffle_take 加 release 生效的自我描述 assert!。行為契約：合法輸入行為位元級不變，僅診斷與文件正確性改善。驗證：全測試套件三組態全綠。
