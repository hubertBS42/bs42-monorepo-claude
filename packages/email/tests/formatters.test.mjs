import assert from "node:assert/strict"
import test from "node:test"
import { formatCurrencyGhs, formatDuration } from "../dist/src/formatters.js"

test("formats durations using the largest unit", () => {
  assert.equal(formatDuration(30), "30 seconds")
  assert.equal(formatDuration(60), "1 minute")
  assert.equal(formatDuration(3600), "1 hour")
  assert.equal(formatDuration(172800), "2 days")
})

test("rejects invalid durations", () => {
  assert.throws(() => formatDuration(0), RangeError)
  assert.throws(() => formatDuration(1.5), RangeError)
})

test("formats GHS amounts and rejects non-finite values", () => {
  assert.match(formatCurrencyGhs(125.5), /125\.50/)
  assert.throws(() => formatCurrencyGhs(Number.NaN), TypeError)
})
