<script setup lang="ts">
/**
 * CodeRunner — the main reusable component (tasks 6.1, reinforces 5.4).
 *
 * Captures the essential UX of the source ChallengeView WITHOUT the OJ /
 * encrypted-pool specifics: an editor (via {@link EditorHost}, default
 * CodeMirror, replaceable through the `editor` prop or `#editor` slot), a
 * run/stop button, and a results panel showing per-testcase AC/WA/RE/TLE.
 *
 * Two ways to provide work:
 *   1. `testcases` — run student code directly against fixed testcases.
 *   2. `generatorCode` (+ optional `generatorParams` / `testcaseCount`) — drive
 *      the random-input generator wasm → Pyodide generator → submit flow.
 *
 * SSR safety (task 5.4 / 6.1): no Worker / wasm / browser global is touched at
 * module or setup scope. The editor lazy-loads itself after mount; the runner
 * and generator are created on first interaction (a click, i.e. client-only).
 *
 * Styling: fully self-contained scoped CSS below — NO Tailwind utility classes
 * and no assumption that the consumer uses any utility framework. A handful of
 * `--vpcr-*` CSS custom properties (see `style.css`) allow optional theming.
 */
import { ref, computed, watch, onBeforeUnmount, type Component } from 'vue'
import type { Testcase, VerdictDetail } from '@vp-code-runner/core'
import EditorHost from '../editors/EditorHost.vue'
import type { EditorAdapter } from '../editors/EditorAdapter'
import { useCodeRunner } from '../composables/useCodeRunner'
import { useWasmGenerator } from '../composables/useWasmGenerator'
import { injectCodeRunnerConfig, type AssetBaseConfig } from '../config'

const props = withDefaults(
  defineProps<{
    /** Source code (v-model). When omitted the component is uncontrolled and seeds from `starterCode`. */
    modelValue?: string
    /** Initial code when `v-model` is not used. */
    starterCode?: string
    /** Language hint forwarded to the editor. */
    language?: string
    /** Render the editor read-only. */
    readOnly?: boolean
    /** Editor component to inject (defaults to the bundled CodeMirror adapter via EditorHost). */
    editor?: EditorAdapter | Component
    /** Fixed testcases to run against. Takes precedence over the generator flow. */
    testcases?: Testcase[]
    /** Python generator code (run in Pyodide to derive expected outputs). */
    generatorCode?: string
    /** Params spec passed to the random-input generator wasm. */
    generatorParams?: Record<string, unknown>
    /** Number of testcases to generate. Default 5. */
    testcaseCount?: number
    /** How much per-testcase detail to surface. Default 'hidden'. */
    verdictDetail?: VerdictDetail
    /** Best-effort op limit forwarded to the worker. */
    opLimit?: number
    /** Wall-clock kill budget per testcase (ms). */
    wallClockKillMs?: number
    /** Asset-base override (merged over any app-wide provided config). */
    config?: AssetBaseConfig
  }>(),
  {
    starterCode: '',
    language: 'python',
    readOnly: false,
    testcaseCount: 5,
    verdictDetail: 'hidden',
  },
)

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

// ── code (v-model + uncontrolled fallback) ────────────────────────────────
const code = ref(props.modelValue ?? props.starterCode)
watch(
  () => props.modelValue,
  (v) => {
    if (v !== undefined && v !== code.value) code.value = v
  },
)
watch(code, (v) => emit('update:modelValue', v))

// ── runner + generator wiring (merged asset-base config) ───────────────────
const assetBase = injectCodeRunnerConfig(props.config)

const runner = useCodeRunner({
  assetBase,
  verdictDetail: props.verdictDetail,
  ...(props.opLimit !== undefined ? { opLimit: props.opLimit } : {}),
  ...(props.wallClockKillMs !== undefined ? { wallClockKillMs: props.wallClockKillMs } : {}),
})
const { status, results, total, errorMessage, isRunning, passedCount } = runner

const wasmGen = useWasmGenerator({ assetBase })

/** True while the generator phase runs (before the submit worker starts). */
const generating = ref(false)

const allPassed = computed(() => total.value > 0 && passedCount.value === total.value)

async function onRun(): Promise<void> {
  // Direct testcases take precedence.
  if (props.testcases && props.testcases.length > 0) {
    await runner.run(code.value, props.testcases)
    return
  }

  // Generator flow.
  if (props.generatorCode) {
    generating.value = true
    try {
      const paramsJson = JSON.stringify(props.generatorParams ?? {})
      const generated = await wasmGen.generateChallenge(paramsJson, props.testcaseCount)
      if (!generated) {
        errorMessage.value = 'WASM 生成失敗，請確認 params 格式正確'
        return
      }
      const testcases = await runner.runGenerator(props.generatorCode, generated.inputs)
      if (!testcases) return // errorMessage already set by the runner
      await runner.submit(code.value, testcases)
    } finally {
      generating.value = false
    }
    return
  }

  errorMessage.value = '未提供 testcases 或 generatorCode'
}

function onStop(): void {
  generating.value = false
  runner.stop()
}

const verdictClass: Record<string, string> = {
  AC: 'vpcr-verdict--ac',
  WA: 'vpcr-verdict--wa',
  RE: 'vpcr-verdict--re',
  TLE: 'vpcr-verdict--tle',
}

onBeforeUnmount(() => runner.cleanup())

defineExpose({ run: onRun, stop: onStop, code })
</script>

<template>
  <div class="vpcr">
    <div class="vpcr-editor">
      <EditorHost v-model="code" :editor="editor" :language="language" :read-only="readOnly">
        <template v-if="$slots.editor" #editor="slotProps">
          <slot name="editor" v-bind="slotProps" />
        </template>
      </EditorHost>
    </div>

    <div class="vpcr-toolbar">
      <button v-if="generating" class="vpcr-btn vpcr-btn--busy" disabled data-testid="run-button">
        生成中…
      </button>
      <button
        v-else-if="!isRunning"
        class="vpcr-btn vpcr-btn--run"
        type="button"
        data-testid="run-button"
        @click="onRun"
      >
        執行
      </button>
      <button
        v-else
        class="vpcr-btn vpcr-btn--stop"
        type="button"
        data-testid="stop-button"
        @click="onStop"
      >
        停止 <span class="vpcr-progress">({{ results.length }} / {{ total }})</span>
      </button>

      <span
        v-if="status === 'done'"
        class="vpcr-summary"
        :class="allPassed ? 'vpcr-summary--pass' : 'vpcr-summary--fail'"
        data-testid="summary"
      >
        {{ passedCount }} / {{ total }} 通過
      </span>
    </div>

    <p v-if="errorMessage" class="vpcr-error" data-testid="error">{{ errorMessage }}</p>

    <div
      v-if="results.length > 0 || isRunning"
      class="vpcr-results"
      data-testid="result-panel"
    >
      <table class="vpcr-table">
        <thead>
          <tr>
            <th class="vpcr-col-idx">#</th>
            <th class="vpcr-col-verdict">結果</th>
            <th class="vpcr-col-time">時間</th>
            <th class="vpcr-col-detail">詳細</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="result in results" :key="result.index" data-testid="result-row">
            <td class="vpcr-col-idx">{{ result.index + 1 }}</td>
            <td class="vpcr-col-verdict">
              <span class="vpcr-verdict" :class="verdictClass[result.verdict]">
                {{ result.verdict }}
              </span>
            </td>
            <td class="vpcr-col-time">{{ result.elapsed_ms.toFixed(0) }} ms</td>
            <td class="vpcr-col-detail">
              <template v-if="result.verdict === 'WA' && verdictDetail === 'full'">
                預期 <code class="vpcr-expected">{{ result.expected }}</code> · 實際
                <code class="vpcr-actual">{{ result.actual }}</code>
              </template>
              <template v-else-if="result.verdict === 'WA' && verdictDetail === 'actual'">
                實際 <code class="vpcr-actual">{{ result.actual }}</code>
              </template>
              <template v-else-if="result.verdict === 'RE'">
                {{ result.error }}
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
/* Self-contained — no Tailwind / consumer utility classes. Optional theming via
   --vpcr-* custom properties (defaults provided here and in style.css). */
.vpcr {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: var(--vpcr-font, inherit);
  color: var(--vpcr-fg, inherit);
}

.vpcr-editor {
  min-height: var(--vpcr-editor-height, 240px);
  height: var(--vpcr-editor-height, 240px);
  border: 1px solid var(--vpcr-border, #d0d7de);
  border-radius: 6px;
  overflow: hidden;
}

.vpcr-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.vpcr-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  color: #fff;
  transition: background-color 0.15s ease;
}

.vpcr-btn--run {
  background-color: var(--vpcr-run-bg, #059669);
}
.vpcr-btn--run:hover {
  background-color: var(--vpcr-run-bg-hover, #047857);
}

.vpcr-btn--stop {
  background-color: var(--vpcr-stop-bg, #dc2626);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.vpcr-btn--stop:hover {
  background-color: var(--vpcr-stop-bg-hover, #b91c1c);
}

.vpcr-btn--busy {
  background-color: var(--vpcr-busy-bg, #9ca3af);
  cursor: not-allowed;
}

.vpcr-progress {
  font-size: 12px;
  opacity: 0.8;
}

.vpcr-summary {
  font-size: 14px;
  font-weight: 600;
}
.vpcr-summary--pass {
  color: var(--vpcr-ac-fg, #059669);
}
.vpcr-summary--fail {
  color: var(--vpcr-tle-fg, #b45309);
}

.vpcr-error {
  margin: 0;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--vpcr-re-fg, #c2410c);
  background-color: var(--vpcr-error-bg, rgba(220, 38, 38, 0.08));
}

.vpcr-results {
  border: 1px solid var(--vpcr-border, #d0d7de);
  border-radius: 6px;
  overflow: auto;
  max-height: var(--vpcr-results-height, 320px);
}

.vpcr-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.vpcr-table th,
.vpcr-table td {
  padding: 6px 10px;
  text-align: left;
  border-bottom: 1px solid var(--vpcr-border-subtle, #eaecef);
}

.vpcr-table th {
  font-weight: 500;
  color: var(--vpcr-muted, #6e7781);
}

.vpcr-col-idx {
  width: 40px;
}
.vpcr-col-verdict {
  width: 72px;
}
.vpcr-col-time {
  width: 80px;
}

.vpcr-verdict {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 12px;
}
.vpcr-verdict--ac {
  color: var(--vpcr-ac-fg, #059669);
  background-color: var(--vpcr-ac-bg, rgba(5, 150, 105, 0.12));
}
.vpcr-verdict--wa {
  color: var(--vpcr-wa-fg, #dc2626);
  background-color: var(--vpcr-wa-bg, rgba(220, 38, 38, 0.12));
}
.vpcr-verdict--re {
  color: var(--vpcr-re-fg, #c2410c);
  background-color: var(--vpcr-re-bg, rgba(194, 65, 12, 0.12));
}
.vpcr-verdict--tle {
  color: var(--vpcr-tle-fg, #b45309);
  background-color: var(--vpcr-tle-bg, rgba(180, 83, 9, 0.12));
}

.vpcr-col-detail {
  font-family: var(--vpcr-mono, ui-monospace, monospace);
  color: var(--vpcr-muted, #6e7781);
}
.vpcr-expected {
  color: var(--vpcr-ac-fg, #059669);
}
.vpcr-actual {
  color: var(--vpcr-wa-fg, #dc2626);
}
</style>
