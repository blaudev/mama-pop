import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCameo, cameoPose } from '../src/cameo.js';

const left = () => 0.9; // dir = -1
const right = () => 0.1; // dir = 1

test('cameoPose: empieza y acaba fuera de la pantalla, cruzándola', () => {
  const c = makeCameo(378, 680, right);
  assert.equal(c.dir, 1);
  assert.ok(cameoPose(c, 0).x < 0, 'empieza a la izquierda, fuera');
  assert.ok(cameoPose(c, c.dur).x > 378, 'acaba a la derecha, fuera');
  assert.equal(cameoPose(c, c.dur).done, true);
  const back = makeCameo(378, 680, left);
  assert.equal(back.dir, -1);
  assert.ok(cameoPose(back, 0).x > 378);
  assert.ok(cameoPose(back, back.dur).x < 0);
});

test('cameoPose: a mitad de camino se para a saludar', () => {
  const c = makeCameo(378, 680, right);
  const a = cameoPose(c, c.waveStart + 0.1);
  const b = cameoPose(c, c.waveStart + c.waveLen - 0.1);
  assert.equal(a.waving, true);
  assert.equal(a.x, b.x, 'quieto mientras saluda');
  assert.ok(b.waveK > a.waveK);
  assert.ok(a.x > 0 && a.x < 378, 'saluda dentro de la pantalla');
  assert.equal(cameoPose(c, c.waveStart - 0.1).waving, false);
  assert.equal(cameoPose(c, c.waveStart + c.waveLen + 0.1).waving, false);
});

test('cameoPose: avanza sin saltos al acabar el saludo', () => {
  const c = makeCameo(378, 680, right);
  const end = c.waveStart + c.waveLen;
  assert.ok(Math.abs(cameoPose(c, end - 0.001).x - cameoPose(c, end + 0.001).x) < 1);
});
