import { describe, it, expect, beforeEach } from 'vitest'
import {
  useWasmGenerator,
  resetWasmGeneratorCache,
  type WasmGeneratorModule,
} from './useWasmGenerator'

/** A fake wasm-pack glue module that needs no real wasm fetch. */
function fakeModule(generate: WasmGeneratorModule['generate_challenge']): WasmGeneratorModule {
  return {
    default: async () => undefined,
    generate_challenge: generate,
  }
}

describe('useWasmGenerator', () => {
  beforeEach(() => resetWasmGeneratorCache())

  it('returns inputs from the loaderOverride module', async () => {
    const mod = fakeModule(() => ({ inputs: ['HELLO\n3', 'WORLD\n7'] }))
    const { generateChallenge } = useWasmGenerator({ loaderOverride: async () => mod })

    const result = await generateChallenge('{"shift":{"type":"int","min":1,"max":25}}', 2)

    expect(result).toEqual({ inputs: ['HELLO\n3', 'WORLD\n7'] })
  })

  it('forwards params_json and count to generate_challenge', async () => {
    const calls: Array<[string, number]> = []
    const mod = fakeModule((p, c) => {
      calls.push([p, c])
      return { inputs: [] }
    })
    const { generateChallenge } = useWasmGenerator({ loaderOverride: async () => mod })

    await generateChallenge('{"a":1}', 5)

    expect(calls).toEqual([['{"a":1}', 5]])
  })

  it('parses a JSON-string result', async () => {
    const mod = fakeModule(() => JSON.stringify({ inputs: ['x'] }))
    const { generateChallenge } = useWasmGenerator({ loaderOverride: async () => mod })

    expect(await generateChallenge('{}', 1)).toEqual({ inputs: ['x'] })
  })

  it('returns null when generate_challenge throws', async () => {
    const mod = fakeModule(() => {
      throw new Error('bad params')
    })
    const { generateChallenge } = useWasmGenerator({ loaderOverride: async () => mod })

    expect(await generateChallenge('{}', 1)).toBeNull()
  })

  it('derives the default glue path under the root base', () => {
    const { glueURL } = useWasmGenerator()
    expect(glueURL()).toBe('/wasm/random_input_generator.js')
  })

  it('derives the glue path under a non-root base', () => {
    const { glueURL } = useWasmGenerator({ assetBase: { base: '/py-dojo/' } })
    expect(glueURL()).toBe('/py-dojo/wasm/random_input_generator.js')
  })

  it('honours a custom generator subdirectory under a non-root base', () => {
    const { glueURL } = useWasmGenerator({
      assetBase: { base: '/sub/', generatorDir: 'assets/gen' },
    })
    expect(glueURL()).toBe('/sub/assets/gen/random_input_generator.js')
  })
})
