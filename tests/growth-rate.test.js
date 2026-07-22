const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../miniprogram/domain/growth-rate.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const sourceModule = { exports: {} }
Function('exports', 'module', compiled)(sourceModule.exports, sourceModule)
const { calculateGrowthWithMultiplier, calculateWorkoutGrowth, criticalMultiplierForRoll, deterministicCriticalRoll, getCriticalMultiplier } = sourceModule.exports

const record = { date: '2026-07-21', createdAt: '2026-07-21T08:15:30.000Z', intensity: 3 }

test('critical probability boundaries match 80/15/4/1 percent bands', () => {
  assert.equal(criticalMultiplierForRoll(0), 1)
  assert.equal(criticalMultiplierForRoll(7999), 1)
  assert.equal(criticalMultiplierForRoll(8000), 1.5)
  assert.equal(criticalMultiplierForRoll(9499), 1.5)
  assert.equal(criticalMultiplierForRoll(9500), 2)
  assert.equal(criticalMultiplierForRoll(9899), 2)
  assert.equal(criticalMultiplierForRoll(9900), 5)
  assert.equal(criticalMultiplierForRoll(9999), 5)
})

test('a record always produces the same roll and multiplier', () => {
  assert.equal(deterministicCriticalRoll(record), deterministicCriticalRoll({ ...record, intensity: 5 }))
  assert.equal(getCriticalMultiplier(record), getCriticalMultiplier({ ...record }))
})

test('growth uses the existing base formula and critical multiplier', () => {
  const multiplier = getCriticalMultiplier(record)
  assert.equal(calculateWorkoutGrowth(record), (0.5 + record.intensity * 0.1) * multiplier)
  assert.equal(calculateGrowthWithMultiplier(1, 1), 0.6)
  assert.equal(calculateGrowthWithMultiplier(2, 1.5), 1.05)
  assert.equal(calculateGrowthWithMultiplier(3, 2), 1.6)
  assert.equal(calculateGrowthWithMultiplier(5, 5), 5)
})
