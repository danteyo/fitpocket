const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../miniprogram/domain/body-feedback.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const sourceModule = { exports: {} }
Function('exports', 'module', compiled)(sourceModule.exports, sourceModule)
const { getBodyAreaFeedback } = sourceModule.exports

test('body feedback is fixed for the same day and body area', () => {
  assert.equal(getBodyAreaFeedback('upper', '2026-07-22'), getBodyAreaFeedback('upper', '2026-07-22'))
  assert.equal(getBodyAreaFeedback('', '2026-07-22'), '')
})
