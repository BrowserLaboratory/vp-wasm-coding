import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { codeRunnerAssets } from './plugin'

/**
 * Regression for the audit finding: an explicitly-configured asset dir that is
 * missing must surface a per-asset warning instead of being silently dropped
 * (which previously happened whenever the *other* asset still mounted).
 */
interface FakeBundleCtx {
  emitFile: ReturnType<typeof vi.fn>
  warn: ReturnType<typeof vi.fn>
}

async function runGenerateBundle(plugin: ReturnType<typeof codeRunnerAssets>, ctx: FakeBundleCtx) {
  const fn = plugin.generateBundle as (this: FakeBundleCtx) => Promise<void>
  await fn.call(ctx)
}

describe('codeRunnerAssets', () => {
  it('warns when an explicitly-set generatorDir is not a usable directory', async () => {
    const ctx: FakeBundleCtx = { emitFile: vi.fn(), warn: vi.fn() }
    await runGenerateBundle(codeRunnerAssets({ generatorDir: '/no/such/generator/dir' }), ctx)
    expect(ctx.warn).toHaveBeenCalledWith(expect.stringContaining('generatorDir was set'))
  })

  it('warns when an explicitly-set pyodideDir is not a usable directory', async () => {
    const ctx: FakeBundleCtx = { emitFile: vi.fn(), warn: vi.fn() }
    await runGenerateBundle(codeRunnerAssets({ pyodideDir: '/no/such/pyodide/dir' }), ctx)
    expect(ctx.warn).toHaveBeenCalledWith(expect.stringContaining('pyodideDir was set'))
  })

  it('emits assets from a usable generatorDir without warning about it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vpcr-gen-'))
    writeFileSync(join(dir, 'random_input_generator.js'), '// glue')
    writeFileSync(join(dir, 'random_input_generator_bg.wasm'), 'wasm-bytes')

    const ctx: FakeBundleCtx = { emitFile: vi.fn(), warn: vi.fn() }
    await runGenerateBundle(codeRunnerAssets({ generatorDir: dir }), ctx)

    const emitted = ctx.emitFile.mock.calls.map((c) => (c[0] as { fileName: string }).fileName)
    expect(emitted).toContain('wasm/random_input_generator.js')
    expect(emitted).toContain('wasm/random_input_generator_bg.wasm')
    expect(ctx.warn).not.toHaveBeenCalledWith(expect.stringContaining('generatorDir was set'))
  })
})
