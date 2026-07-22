const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../miniprogram/domain/critical-quips.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const sourceModule = { exports: {} }
Function('exports', 'module', compiled)(sourceModule.exports, sourceModule)
const { CRITICAL_QUIPS, getCriticalQuip, weightedQuipForRoll } = sourceModule.exports

test('quip weight boundaries use 50/30/20/10/2 within a multiplier', () => {
  const quips = CRITICAL_QUIPS[1.5]
  assert.equal(weightedQuipForRoll(quips, 0), quips[0].text)
  assert.equal(weightedQuipForRoll(quips, 49), quips[0].text)
  assert.equal(weightedQuipForRoll(quips, 50), quips[1].text)
  assert.equal(weightedQuipForRoll(quips, 79), quips[1].text)
  assert.equal(weightedQuipForRoll(quips, 80), quips[2].text)
  assert.equal(weightedQuipForRoll(quips, 99), quips[2].text)
  assert.equal(weightedQuipForRoll(quips, 100), quips[3].text)
  assert.equal(weightedQuipForRoll(quips, 109), quips[3].text)
  assert.equal(weightedQuipForRoll(quips, 110), quips[4].text)
  assert.equal(weightedQuipForRoll(quips, 111), quips[4].text)
})

test('a generated quip is fixed for the record and current multiplier', () => {
  const record = { date: '2026-07-21', createdAt: '2026-07-21T08:15:30.000Z' }
  assert.equal(getCriticalQuip(record, 2), getCriticalQuip({ ...record }, 2))
  assert.ok(CRITICAL_QUIPS[2].some(quip => quip.text === getCriticalQuip(record, 2)))
  assert.equal(getCriticalQuip(record, 1), '')
})
