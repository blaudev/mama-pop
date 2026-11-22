import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Comprueba que el juego se puede instalar como app (PWA) y funcionar sin conexión.

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

function pngSize(file) {
  const b = fs.readFileSync(path.join(root, file));
  assert.equal(b.toString('latin1', 1, 4), 'PNG', `${file} no es un PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

/** Archivos que el service worker guarda al instalarse (lista ASSETS de sw.js). */
function precached() {
  const m = read('sw.js').match(/const ASSETS = \[([\s\S]*?)\];/);
  assert.ok(m, 'sw.js no tiene la lista ASSETS');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1].replace(/^\.\//, ''));
}

test('el manifiesto tiene lo que Chrome pide para instalar', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.ok(m.name && m.short_name);
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.equal(m.display, 'standalone');
  assert.ok(m.background_color && m.theme_color);
  for (const want of ['192x192', '512x512']) {
    const icon = m.icons.find((i) => i.sizes === want && i.type === 'image/png');
    assert.ok(icon, `falta el icono de ${want}`);
    assert.deepEqual(pngSize(icon.src), want.split('x').map(Number), `${icon.src} no mide ${want}`);
  }
  assert.ok(m.icons.some((i) => i.purpose?.includes('maskable')), 'falta un icono adaptable (maskable)');
});

test('index.html enlaza el manifiesto, el icono de iOS y registra el service worker', () => {
  const html = read('index.html');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest"/);
  assert.match(html, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png"/);
  assert.match(html, /serviceWorker\.register\('\.\/sw\.js', \{ updateViaCache: 'none' \}\)/);
  assert.deepEqual(pngSize('icons/apple-touch-icon.png'), [180, 180]);
});

test('el service worker guarda todos los archivos del juego para jugar sin conexión', () => {
  const list = precached();
  const needed = [
    '',
    'index.html',
    'styles.css',
    'manifest.webmanifest',
    ...fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.js')).map((f) => `src/${f}`),
    ...fs.readdirSync(path.join(root, 'icons')).map((f) => `icons/${f}`),
  ];
  for (const f of needed) assert.ok(list.includes(f), `sw.js no guarda «${f || './'}»`);
  for (const f of list) if (f) assert.ok(fs.existsSync(path.join(root, f)), `sw.js guarda «${f}», que no existe`);
});

test('el service worker no usa la copia de 10 minutos del navegador: lo publicado llega al momento', () => {
  const sw = read('sw.js');
  // los archivos del juego se piden al servidor preguntando siempre si hay versión nueva
  assert.match(sw, /fetch\(request, \{ cache: 'no-cache' \}\)/);
  // y la copia para jugar sin conexión también se hace con lo último del servidor
  assert.match(sw, /new Request\(url, \{ cache: 'no-cache' \}\)/);
  // el propio sw.js se busca sin caché del navegador al comprobar si hay versión nueva
  assert.match(read('index.html'), /updateViaCache: 'none'/);
});
