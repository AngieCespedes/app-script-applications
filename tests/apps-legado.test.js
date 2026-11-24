/**
 * Contrato de seguridad de las apps traídas con migrar-legado:
 *  - toda llamada de la página pasa por api('accion') y la acción existe en Rutas_;
 *  - ninguna página llama otra función del servidor directamente;
 *  - el código carga completo (sin errores de sintaxis) en un solo ámbito, como en Apps Script.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const apps = fs.readdirSync('apps').filter((a) => fs.existsSync(path.join('apps', a, '.legado')));

function leerTodo(dir, ext) {
  const out = [];
  (function r(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) r(p); else if (p.endsWith(ext)) out.push(fs.readFileSync(p, 'utf8'));
    }
  })(dir);
  return out.join('\n');
}

for (const app of apps) {
  const src = path.join('apps', app, 'src');
  const servidor = leerTodo(path.join(src, 'server'), '.js');
  const cliente = leerTodo(src, '.html') + '\n' + servidor;

  test(`${app}: el código del servidor carga sin errores de sintaxis`, () => {
    assert.doesNotThrow(() => new vm.Script(servidor, { filename: app }));
  });

  test(`${app}: cada acción que pide la página existe en la API`, () => {
    const ctx = vm.createContext({ console, PropertiesService: { getScriptProperties: () => ({ getProperty: () => '' }) } });
    vm.runInContext(fs.readFileSync(path.join(src, 'server', 'api.js'), 'utf8'), ctx);
    const rutas = vm.runInContext('Rutas_', ctx);
    const pedidas = new Set([...cliente.matchAll(/\.api\(\s*['"]([A-Za-z0-9_]+)['"]/g)].map((m) => m[1]));
    const faltan = [...pedidas].filter((x) => x !== 'accion' && !rutas[x]);
    assert.deepEqual(faltan, []);
  });

  test(`${app}: la página no llama funciones del servidor sin pasar por api()`, () => {
    const publicas = [...servidor.matchAll(/^function ([A-Za-z0-9]+[^_])\s*\(/gm)].map((m) => m[1]).filter((n) => n !== 'api');
    const html = leerTodo(src, '.html');
    const directas = publicas.filter((n) => new RegExp('google\\.script\\.run[\\s\\S]{0,400}?\\.' + n + '\\(').test(html));
    assert.deepEqual(directas, []);
  });
}
