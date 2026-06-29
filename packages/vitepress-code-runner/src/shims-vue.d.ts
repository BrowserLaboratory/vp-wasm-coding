/**
 * Ambient shim so plain `tsc` can resolve `*.vue` imports (vue-tsc is not
 * installed in this workspace). Without vue-tsc the `.vue` internals are not
 * type-checked — this only makes the module importable as a generic component.
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
