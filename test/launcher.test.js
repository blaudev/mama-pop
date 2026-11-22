import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launcherLayout, launcherPositions, hitsLauncher, NEXT_SCALE, inCancelZone, readyToShoot, SHOT_COOLDOWN } from '../src/launcher.js';

const SHOOTER = { x: 200, y: 600 };
const R = 18;
const L = launcherLayout(SHOOTER);
const close = (a, b) => Math.abs(a - b) < 1e-9;
const onRing = (p) => close(Math.hypot(p.x - L.cx, p.y - L.cy), L.r);

test('en reposo la burbuja actual está en el cañón y la siguiente abajo a la derecha', () => {
  const { current, next } = launcherPositions(L, 1);
  assert.ok(close(current.x, SHOOTER.x) && close(current.y, SHOOTER.y));
  assert.equal(current.scale, 1);
  assert.ok(next.x > L.cx && next.y > L.cy);
  assert.equal(next.scale, NEXT_SCALE);
});

test('al empezar el giro cada burbuja está en el sitio de la otra', () => {
  const rest = launcherPositions(L, 1);
  const start = launcherPositions(L, 0);
  assert.ok(close(start.current.x, rest.next.x) && close(start.current.y, rest.next.y));
  assert.ok(close(start.next.x, rest.current.x) && close(start.next.y, rest.current.y));
});

test('durante el giro las dos burbujas recorren el aro, sin cruzarse por dentro', () => {
  for (const k of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    const { current, next } = launcherPositions(L, k);
    assert.ok(onRing(current) && onRing(next), `fuera del aro en k=${k}`);
    assert.ok(Math.hypot(current.x - next.x, current.y - next.y) > R, `se solapan en k=${k}`);
  }
});

test('hitsLauncher: tocar cualquiera de las dos burbujas cuenta, tocar lejos no', () => {
  const { current, next } = launcherPositions(L, 1);
  assert.ok(hitsLauncher(L, current, R));
  assert.ok(hitsLauncher(L, { x: next.x + 5, y: next.y - 5 }, R));
  assert.ok(hitsLauncher(L, { x: L.cx, y: L.cy }, R), 'el contador del centro también cuenta');
  assert.ok(!hitsLauncher(L, { x: SHOOTER.x, y: SHOOTER.y - 120 }, R));
  assert.ok(!hitsLauncher(L, { x: SHOOTER.x - 120, y: SHOOTER.y }, R));
});

test('hover: las dos burbujas avanzan un poco por el aro en el sentido del giro', () => {
  const rest = launcherPositions(L, 1, 0);
  const hover = launcherPositions(L, 1, 1);
  const big = launcherLayout(SHOOTER, 1);
  const onBig = (p) => close(Math.hypot(p.x - big.cx, p.y - big.cy), big.r);
  assert.ok(onBig(hover.current) && onBig(hover.next), 'fuera del aro');
  // sentido de las agujas del reloj: la de arriba va hacia la derecha, la de la derecha hacia abajo
  assert.ok(hover.current.x > rest.current.x);
  assert.ok(hover.next.y > rest.next.y);
  // solo un empujón, no un giro
  assert.ok(Math.hypot(hover.current.x - rest.current.x, hover.current.y - rest.current.y) < R);
});

test('hover: el aro crece pero su punto más alto sigue en el cañón', () => {
  const big = launcherLayout(SHOOTER, 1);
  assert.ok(big.r > L.r);
  assert.ok(close(big.cy - big.r, SHOOTER.y));
});

test('inCancelZone: volver con el dedo al lanzador (o muy cerca) anula el tiro', () => {
  assert.ok(inCancelZone(L, { x: L.cx, y: L.cy }, R), 'sobre el lanzador');
  assert.ok(inCancelZone(L, { x: L.cx + L.r + R, y: L.cy }, R), 'justo al lado');
  assert.ok(!inCancelZone(L, { x: L.cx, y: L.cy - 200 }, R), 'apuntando hacia arriba');
  assert.ok(!inCancelZone(L, { x: L.cx + 150, y: L.cy - 60 }, R), 'apuntando a un lado');
});

test('readyToShoot: hay una pausa mínima entre que se pega una bola y el siguiente disparo', () => {
  assert.ok(SHOT_COOLDOWN >= 0.2 && SHOT_COOLDOWN <= 0.6);
  assert.equal(readyToShoot(10, 10), false);
  assert.equal(readyToShoot(10 + SHOT_COOLDOWN / 2, 10), false);
  assert.equal(readyToShoot(10 + SHOT_COOLDOWN, 10), true);
  assert.equal(readyToShoot(5, -Infinity), true, 'al empezar se puede disparar');
});
