const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../miniprogram/domain/sync-rules.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const sourceModule = { exports: {} }
Function('exports', 'module', compiled)(sourceModule.exports, sourceModule)
const { mergeRecords, newerRecord } = sourceModule.exports

function record(date, updatedAt, bodyArea, intensity) {
  return { date, createdAt: '2026-01-01T00:00:00.000Z', updatedAt, bodyArea, intensity }
}

test('newerRecord resolves a date conflict using updatedAt', () => {
  const local = record('2026-07-21', '2026-07-21T09:00:00.000Z', 'upper', 2)
  const cloud = record('2026-07-21', '2026-07-21T10:00:00.000Z', 'lower', 4)
  assert.equal(newerRecord(local, cloud), cloud)
})

test('mergeRecords deduplicates by date and preserves partial records', () => {
  const local = record('2026-07-20', '2026-07-20T10:00:00.000Z', 'upper', undefined)
  const cloud = record('2026-07-21', '2026-07-21T10:00:00.000Z', undefined, 3)
  assert.deepEqual(mergeRecords([local], [cloud]), [local, cloud])
})

test('local wins when timestamps are equal', () => {
  const local = record('2026-07-21', '2026-07-21T10:00:00.000Z', 'full', 5)
  const cloud = record('2026-07-21', '2026-07-21T10:00:00.000Z', 'lower', 1)
  assert.equal(mergeRecords([local], [cloud])[0], local)
})
