/**
 * Regla de seguridad: en la app web todo `function nombre()` de nivel superior que no termine en `_`
 * se puede llamar desde el navegador con google.script.run, sin pasar por el login.
 * Solo se permiten las funciones de esta lista blanca (las que llaman Google, el menú o los activadores),
 * más las que cada app declara en apps/<app>/globales.json (todas llevan guarda).
 */
const fs = require('fs');
const path = require('path');

const PERMITIDAS = new Set([
  'doGet', 'api', 'onOpen', 'tareaDiariaSaldo',
  'menuAbrirApp', 'menuRevisarRelacion', 'menuRespaldo', 'menuInstalar', 'menuProduccion', 'menuPrueba'
]);

let errores = 0;
for (const app of fs.readdirSync('apps')) {
  const dir = path.join('apps', app, 'src', 'server');
  if (!fs.existsSync(dir)) continue;
  const propias = path.join('apps', app, 'globales.json');
  const permitidas = new Set([...PERMITIDAS, ...(fs.existsSync(propias) ? JSON.parse(fs.readFileSync(propias, 'utf8')) : [])]);
  for (const archivo of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const texto = fs.readFileSync(path.join(dir, archivo), 'utf8');
    for (const m of texto.matchAll(/^function\s+([A-Za-z0-9_$]+)\s*\(/gm)) {
      const nombre = m[1];
      if (nombre.endsWith('_') || permitidas.has(nombre)) continue;
      console.error(`${dir}/${archivo}: función global pública no permitida «${nombre}». Muévala a un módulo o termínela en _.`);
      errores++;
    }
  }
}
if (errores) process.exit(1);
console.log('Funciones globales: OK');
