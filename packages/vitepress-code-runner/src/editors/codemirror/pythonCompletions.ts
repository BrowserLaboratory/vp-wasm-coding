import type { Completion, CompletionContext, CompletionResult, CompletionSource } from '@codemirror/autocomplete'

interface ModuleEntry {
  name: string
  functions: string[]
  variables: string[]
}

// os and sys are intentionally excluded — they behave unexpectedly in Pyodide (WebAssembly) environment.
const STDLIB_MODULES: ModuleEntry[] = [
  {
    name: 'math',
    functions: ['floor', 'ceil', 'gcd', 'pow', 'sqrt', 'log', 'fabs', 'factorial', 'isnan', 'isinf'],
    variables: ['pi', 'e', 'tau', 'inf', 'nan'],
  },
  {
    name: 'string',
    functions: [],
    variables: ['ascii_lowercase', 'ascii_uppercase', 'ascii_letters', 'digits', 'hexdigits', 'octdigits', 'printable', 'punctuation', 'whitespace'],
  },
  {
    name: 'hashlib',
    functions: ['md5', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512', 'new', 'pbkdf2_hmac'],
    variables: ['algorithms_available', 'algorithms_guaranteed'],
  },
  {
    name: 'binascii',
    functions: ['hexlify', 'unhexlify', 'b2a_hex', 'a2b_hex', 'b2a_base64', 'a2b_base64', 'crc32'],
    variables: [],
  },
  {
    name: 'collections',
    functions: ['namedtuple'],
    variables: ['Counter', 'defaultdict', 'OrderedDict', 'deque', 'ChainMap'],
  },
  {
    name: 'itertools',
    functions: ['chain', 'product', 'combinations', 'combinations_with_replacement', 'permutations', 'cycle', 'repeat', 'islice', 'starmap', 'takewhile', 'dropwhile', 'groupby', 'accumulate'],
    variables: [],
  },
  {
    name: 'functools',
    functions: ['reduce', 'partial', 'wraps', 'lru_cache', 'cache', 'total_ordering', 'cmp_to_key'],
    variables: [],
  },
  {
    name: 're',
    functions: ['match', 'search', 'findall', 'finditer', 'sub', 'subn', 'split', 'compile', 'fullmatch', 'escape', 'purge'],
    variables: ['IGNORECASE', 'MULTILINE', 'DOTALL', 'VERBOSE', 'ASCII', 'UNICODE'],
  },
]

function buildCompletions(): Completion[] {
  const completions: Completion[] = []

  for (const mod of STDLIB_MODULES) {
    // Module name itself
    completions.push({
      label: mod.name,
      type: 'namespace',
      detail: 'module',
    })

    // Function symbols — apply ends with '(' to trigger closeBrackets
    for (const fn of mod.functions) {
      completions.push({
        label: fn,
        type: 'function',
        detail: mod.name,
        apply: fn + '(',
      })
    }

    // Variable / constant symbols
    for (const variable of mod.variables) {
      completions.push({
        label: variable,
        type: 'variable',
        detail: mod.name,
      })
    }
  }

  return completions
}

const COMPLETIONS = buildCompletions()

/**
 * A CodeMirror CompletionSource that returns completions for common Python
 * standard library symbols. Intended to be registered via:
 *   pythonLanguage.data.of({ autocomplete: pythonStdlibCompletions() })
 */
export function pythonStdlibCompletions(): CompletionSource {
  return function (context: CompletionContext): CompletionResult | null {
    const word = context.matchBefore(/\w*/)
    if (!word) return null

    return {
      from: word.from,
      options: COMPLETIONS,
      validFor: /^\w*$/,
    }
  }
}
