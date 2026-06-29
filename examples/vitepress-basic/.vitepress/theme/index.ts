import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { CodeRunner } from '@cxphoenix/vp-wasm-coding'
// Optional --vpcr-* theming variables. CodeRunner ships its own scoped styles,
// so the component renders fine even without this import.
import '@cxphoenix/vp-wasm-coding/style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // Register CodeRunner globally so markdown pages can use <CodeRunner …/>.
    app.component('CodeRunner', CodeRunner)
  },
} satisfies Theme
