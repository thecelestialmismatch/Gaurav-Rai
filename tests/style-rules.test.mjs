import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findStyleProblems } from './style-rules.mjs';

test('clean text passes', () => {
  assert.deepEqual(findStyleProblems('Built dashboards in Power BI that managers used every week.'), []);
});

test('each forbidden character is caught', () => {
  assert.ok(findStyleProblems('Skills: SQL').includes('contains a colon'));
  assert.ok(findStyleProblems('SQL; Excel').includes('contains a semicolon'));
  assert.ok(findStyleProblems('real-time routing').includes('contains a hyphen'));
  assert.ok(findStyleProblems('fast — and cheap').includes('contains a em dash'));
  assert.ok(findStyleProblems('2021 – 2022').includes('contains a en dash'));
});

test('spacing mistakes are caught', () => {
  assert.ok(findStyleProblems('two  spaces').includes('contains a double space'));
  assert.ok(findStyleProblems(' leading').includes('starts or ends with a space'));
  assert.ok(findStyleProblems('word , comma').includes('has a space before punctuation'));
});

test('stock phrases are caught as whole words only', () => {
  assert.ok(findStyleProblems('Leveraged data to drive outcomes.').includes('uses "leveraged"'));
  assert.ok(findStyleProblems('A robust pipeline.').includes('uses "robust"'));
  assert.deepEqual(findStyleProblems('Robustness testing.'), [], 'robustness is a different word');
});
