---
title: CodeRunner Example
---

<script setup>
// Fixed testcases for the "read an int, print it doubled" exercise.
// input "3" → expected "6"; input "10" → expected "20".
const doubleTestcases = [
  { input: '3', expected_output: '6' },
  { input: '10', expected_output: '20' },
]

// A correct reference solution and a deliberately wrong one.
const correctCode = 'print(int(input()) * 2)'
const wrongCode = 'print(int(input()) + 2)' // adds 2 instead of doubling → WA

// generate_challenge params: one int line in [1, 25].
const generatorParams = { n: { type: 'int', min: 1, max: 25 } }
// The reference solution doubles as the generator that derives expected output.
const generatorCode = 'print(int(input()) * 2)'
</script>

# CodeRunner — VitePress consumer example

This page proves the extracted **`@vp-code-runner/vitepress`** library runs Python
fully client-side via Pyodide, on a plain static host with **no COOP/COEP** headers.

## Exercise: double the number

Read one integer from stdin and print it doubled.
`3 → 6`, `10 → 20`.

### 1. Correct solution → AC

The starter code already solves it, so running against the fixed testcases
yields all **AC**.

<CodeRunner
  language="python"
  :starter-code="correctCode"
  :testcases="doubleTestcases"
  verdict-detail="full"
/>

### 2. Wrong solution → WA

This one adds `2` instead of multiplying by `2`, so `3 → 5 ≠ 6` is a **WA**.

<CodeRunner
  language="python"
  :starter-code="wrongCode"
  :testcases="doubleTestcases"
  verdict-detail="full"
/>

### 3. Random inputs via `generate_challenge`

Here the Rust→WASM generator produces 5 random integers in `[1, 25]`, the
reference solution computes each expected output, and the student code is judged
against them.

<CodeRunner
  language="python"
  :starter-code="correctCode"
  :generator-code="generatorCode"
  :generator-params="generatorParams"
  :testcase-count="5"
  verdict-detail="full"
/>
