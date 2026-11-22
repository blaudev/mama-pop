import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeliberateShot, MIN_SHOT_MS, MIN_SHOT_MOVE } from '../src/input.js';

test('isDeliberateShot: un toque rápido y quieto con el dedo no dispara', () => {
  assert.equal(isDeliberateShot({ pointerType: 'touch', durationMs: 60, movedPx: 2 }), false);
  assert.equal(isDeliberateShot({ pointerType: 'pen', durationMs: 60, movedPx: 0 }), false);
});

test('isDeliberateShot: mantener pulsado un momento o arrastrar sí dispara', () => {
  assert.equal(isDeliberateShot({ pointerType: 'touch', durationMs: MIN_SHOT_MS, movedPx: 0 }), true);
  assert.equal(isDeliberateShot({ pointerType: 'touch', durationMs: 60, movedPx: MIN_SHOT_MOVE }), true);
});

test('isDeliberateShot: con ratón un clic dispara', () => {
  assert.equal(isDeliberateShot({ pointerType: 'mouse', durationMs: 40, movedPx: 0 }), true);
});
