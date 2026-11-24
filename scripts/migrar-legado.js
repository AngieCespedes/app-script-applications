#!/usr/bin/env node
/**
 * migrar-legado — trae una app vieja de Apps Script al repo con las reglas de seguridad y estructura.
 *
 *   node scripts/migrar-legado.js <carpeta-original> apps/<app> [config.json]
 *
 * Qué hace (sin cambiar la lógica de negocio):
 *  1. Las funciones que la página llama (google.script.run.X) dejan de ser globales: pasan por api('X', …).
 *  2. Toda otra función global se vuelve privada (X → X_), salvo doGet/doPost/onOpen/onEdit, las del menú
 *     (addItem) y las de activadores (newTrigger), que quedan globales pero con guarda.
 *  3. Los IDs de Drive escritos en el código pasan a la configuración (Config_.id('NOMBRE')).
 *  4. Los envíos de correo pasan por Correo_ (modo PRUEBA).
 *  5. El código se reparte en archivos de máximo ~280 líneas.
 * Deja un informe en apps/<app>/MIGRACION.md con lo que hay que revisar a mano.
 */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');

const [, , ORIGEN, DESTINO, CONFIG] = process.argv;
if (!ORIGEN || !DESTINO) { console.error('Uso: migrar-legado.js <origen> <destino> [config.json]'); process.exit(1); }
const cfg = CONFIG ? JSON.parse(fs.readFileSync(CONFIG, 'utf8')) : {};
const MAX_LINEAS = 280;
const ENTRADAS = new Set(['doGet', 'doPost', 'onOpen', 'onEdit', 'onInstall', 'onSelectionChange', 'onFormSubmit']);
const ID_RE = /^[A-Za-z0-9_-]{25,60}$/;

const archivos = fs.readdirSync(ORIGEN).filter((f) => !f.startsWith('.'));
const excluir = new Set(cfg.excluir || []);
const jsArch = archivos.filter((f) => /\.(js|gs)$/.test(f) && !excluir.has(f));
const htmlArch = archivos.filter((f) => f.endsWith('.html'));
const parse = (t, f) => acorn.parse(t, { ecmaVersion: 'latest', sourceType: 'script', locations: true, sourceFile: f, allowHashBang: true });

/* ---------- 1. lectura ---------- */
const reemplazar = (t) => (cfg.reemplazos || []).reduce((x, [a, b]) => x.split(a).join(b), t);
const fuentes = jsArch.map((f) => { const texto = reemplazar(fs.readFileSync(path.join(ORIGEN, f), 'utf8')); return { f, texto, ast: parse(texto, f) }; });
if (cfg.stubs) {
  const t = Object.keys(cfg.stubs).map((k) => `/** Retirado en la migración: ${cfg.stubs[k]} */\nfunction ${k}() {\n  throw new Error(${JSON.stringify(cfg.stubs[k])});\n}\n`).join('\n');
  fuentes.push({ f: 'retirados.js', texto: t, ast: parse(t, 'retirados.js') });
}
const html = htmlArch.map((f) => ({ f, texto: reemplazar(fs.readFileSync(path.join(ORIGEN, f), 'utf8')) }));

const funciones = new Set();
fuentes.forEach((s) => s.ast.body.forEach((n) => { if (n.type === 'FunctionDeclaration') funciones.add(n.id.name); }));

/* Texto «de cliente»: archivos HTML + literales de texto del JS (páginas armadas dentro del código). */
function literales(s) {
  const out = [];
  walk.full(s.ast, (n) => {
    if (n.type === 'TemplateLiteral') n.quasis.forEach((q) => out.push([q.start, q.end]));
    else if (n.type === 'Literal' && typeof n.value === 'string') out.push([n.start, n.end]);
  });
  return out;
}
const textoCliente = html.map((h) => h.texto).concat(fuentes.map((s) => literales(s).map(([a, b]) => s.texto.slice(a, b)).join('\n'))).join('\n');

const llamadas = new Set([...funciones].filter((n) => new RegExp('\\.' + n + '\\s*\\(').test(textoCliente)));
const menu = new Set(), activadores = new Set();
fuentes.forEach((s) => {
  for (const m of s.texto.matchAll(/addItem\(\s*['"`][^'"`]*['"`]\s*,\s*['"`]([A-Za-z0-9_$]+)['"`]/g)) menu.add(m[1]);
  for (const m of s.texto.matchAll(/newTrigger\(\s*['"`]([A-Za-z0-9_$]+)['"`]/g)) activadores.add(m[1]);
});
(cfg.menuExtra || []).forEach((x) => menu.add(x));
(cfg.activadoresExtra || []).forEach((x) => activadores.add(x));

const globales = new Set([...funciones].filter((n) => ENTRADAS.has(n) || menu.has(n) || activadores.has(n)));
const renombrar = new Map();
[...funciones].forEach((n) => {
  if (globales.has(n) || n.endsWith('_')) return;
  let nuevo = n + '_';
  while (funciones.has(nuevo)) nuevo += '_';
  renombrar.set(n, nuevo);
});
const nombreReal = (n) => renombrar.get(n) || n;

/* ---------- 2. transformaciones de texto por archivo ---------- */
const avisos = [];
const idsEncontrados = new Map();

function editar(s) {
  const cambios = [];
  // identificadores renombrados (no toca propiedades ni claves de objeto)
  walk.ancestor(s.ast, {
    Identifier(n, _st, anc) {
      if (!renombrar.has(n.name)) return;
      const p = anc[anc.length - 2];
      if (p && p.type === 'MemberExpression' && p.property === n && !p.computed) return;
      if (p && p.type === 'Property' && p.key === n && !p.computed && !p.shorthand) return;
      if (p && (p.type === 'MethodDefinition' || p.type === 'PropertyDefinition') && p.key === n) return;
      cambios.push([n.start, n.end, renombrar.get(n.name)]);
    }
  });
  // nombres de las declaraciones (acorn-walk no visita el id de una FunctionDeclaration)
  walk.full(s.ast, (n) => {
    if ((n.type === 'FunctionDeclaration') && n.id && renombrar.has(n.id.name)) cambios.push([n.id.start, n.id.end, renombrar.get(n.id.name)]);
  });
  // llamadas del cliente dentro de literales: .X( → .api('X', …)
  literales(s).forEach(([a, b]) => {
    const t = s.texto.slice(a, b);
    const delim = s.texto[a - 1] === '`' || s.texto[a] === '`' ? '`' : s.texto[a];
    const r = reescribirCliente(t, delim === "'" ? '"' : "'");
    if (r !== t) cambios.push([a, b, r]);
  });
  // IDs de Drive en declaraciones de nivel superior → Config_.id('NOMBRE')
  s.ast.body.forEach((n) => {
    if (n.type !== 'VariableDeclaration') return;
    n.declarations.forEach((d) => {
      if (d.init && d.init.type === 'Literal' && typeof d.init.value === 'string' && ID_RE.test(d.init.value) && /\d/.test(d.init.value)) {
        idsEncontrados.set(d.id.name, d.init.value);
        cambios.push([d.init.start, d.init.end, "Config_.id('" + d.id.name + "')"]);
      } else if (d.init && d.init.type === 'ObjectExpression') {
        d.init.properties.forEach((p) => {
          const v = p.value;
          if (p.key && v && v.type === 'Literal' && typeof v.value === 'string' && ID_RE.test(v.value) && /\d/.test(v.value)) {
            const k = d.id.name + '_' + (p.key.name || p.key.value);
            idsEncontrados.set(k, v.value);
            cambios.push([v.start, v.end, "Config_.id('" + k + "')"]);
          }
        });
      }
    });
  });
  // IDs sueltos dentro de funciones: se reportan
  walk.full(s.ast, (n) => {
    if (n.type === 'Literal' && typeof n.value === 'string' && ID_RE.test(n.value) && /\d/.test(n.value) && /[A-Z]/.test(n.value) &&
        ![...idsEncontrados.values()].includes(n.value)) {
      avisos.push(`ID suelto en ${s.f}:${n.loc.start.line}: ${n.value} (revisar a mano)`);
    }
  });
  // aislamiento: en modo PRUEBA solo se abre lo que está dentro de la carpeta de la copia
  for (const m of s.texto.matchAll(/\b(SpreadsheetApp\.openById|FormApp\.openById|DriveApp\.getFolderById)\(/g)) {
    const r = { 'SpreadsheetApp.openById': 'Aislamiento_.abrirLibro(', 'FormApp.openById': 'Aislamiento_.abrirFormulario(', 'DriveApp.getFolderById': 'Aislamiento_.carpeta(' }[m[1]];
    if (!dentroDeLiteral(s, m.index)) cambios.push([m.index, m.index + m[0].length, r]);
  }
  // correo
  for (const m of s.texto.matchAll(/\b(MailApp|GmailApp)\.sendEmail\(/g)) if (!dentroDeLiteral(s, m.index)) cambios.push([m.index, m.index + m[0].length, m[1] === 'MailApp' ? 'Correo_.enviar(' : 'Correo_.enviarGmail(']);
  // guardas al inicio de funciones globales de menú y activadores
  s.ast.body.forEach((n) => {
    if (n.type !== 'FunctionDeclaration') return;
    const nom = n.id.name;
    const pos = n.body.start + 1;
    if (menu.has(nom) && activadores.has(nom)) cambios.push([pos, pos, ' Guardas_.personaOActivador(arguments[0]);']);
    else if (menu.has(nom) && !ENTRADAS.has(nom)) cambios.push([pos, pos, ' Guardas_.persona();']);
    else if (activadores.has(nom) && !ENTRADAS.has(nom)) cambios.push([pos, pos, ' Guardas_.activador(arguments[0]);']);
    else if (['onEdit', 'onFormSubmit', 'onSelectionChange'].includes(nom)) cambios.push([pos, pos, ' Guardas_.eventoReal(arguments[0]);']);
    if (nom === 'onOpen') cambios.push([n.body.end - 1, n.body.end - 1, '\n  Instalacion_.menu();\n']);
  });
  return aplicar(s.texto, cambios);
}

function dentroDeLiteral(s, pos) {
  return literales(s).some(([a, b]) => pos >= a && pos < b);
}

function reescribirCliente(t, q) {
  q = q || "'";
  let r = t;
  llamadas.forEach((n) => {
    r = r.replace(new RegExp('\\.' + n + '\\s*\\(\\s*\\)', 'g'), '.api(' + q + n + q + ')');
    r = r.replace(new RegExp('\\.' + n + '\\s*\\(', 'g'), '.api(' + q + n + q + ', ');
  });
  return r;
}

function aplicar(texto, cambios) {
  cambios.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  let out = texto, ultimo = Infinity;
  cambios.forEach(([a, b, r]) => {
    if (b > ultimo) return; // solapado: se ignora (el más interno ya se aplicó)
    out = out.slice(0, a) + r + out.slice(b);
    ultimo = a;
  });
  return out;
}

/* ---------- 3. reparto en archivos ---------- */
const destinoSrc = path.join(DESTINO, 'src');
fs.mkdirSync(path.join(destinoSrc, 'server'), { recursive: true });

const bloquesConfig = [];
const bloquesCodigo = [];
fuentes.forEach((s) => {
  const nuevo = editar(s);
  const ast = parse(nuevo, s.f);
  let previo = 0;
  ast.body.forEach((n, i) => {
    const ini = i === 0 ? 0 : previo;
    const fin = n.end;
    const texto = nuevo.slice(ini, fin).replace(/^\n+/, '') + '\n';
    previo = fin;
    const nombre = n.type === 'FunctionDeclaration' ? n.id.name : null;
    (nombre ? bloquesCodigo : bloquesConfig).push({ origen: s.f, nombre, texto });
  });
});

const base = (f) => f.replace(/\.(js|gs)$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'codigo';
const lineas = (t) => t.split('\n').length;

const salida = new Map();
function poner(nombre, texto) { salida.set(nombre, (salida.get(nombre) || '') + texto + '\n'); }

bloquesConfig.forEach((b) => poner('server/config.js', b.texto));
let actual = null, n = 0, cuenta = 0, origenActual = null;
bloquesCodigo.forEach((b) => {
  const l = lineas(b.texto);
  if (b.origen !== origenActual || cuenta + l > MAX_LINEAS) {
    if (b.origen !== origenActual) { n = 0; origenActual = b.origen; }
    n++; cuenta = 0; actual = `server/${base(b.origen)}-${String(n).padStart(2, '0')}.js`;
  }
  poner(actual, b.texto); cuenta += l;
});

/* ---------- 4. puerta única y núcleo ---------- */
const hoja = new Set(cfg.rutasHoja || []);
const rutas = [...llamadas].sort().map((nm) => `  ${nm}: { tipo: '${hoja.has(nm) ? 'hoja' : 'web'}', fn: function () { return ${nombreReal(nm)}.apply(null, arguments); } }`);
poner('server/api.js', `/**
 * API — única puerta de la página: google.script.run.api('accion', ...argumentos).
 * tipo 'web'  → la función valida su propia sesión o es un formulario público (revisado en MIGRACION.md).
 * tipo 'hoja' → solo desde un diálogo dentro de la hoja, con cuenta de Google.
 * Generado por scripts/migrar-legado.js; si se agrega una pantalla, se agrega su ruta aquí.
 */
var Rutas_ = {
${rutas.join(',\n')}
};

function api(accion) {
  var ruta = Rutas_[String(accion || '')];
  if (!ruta) throw new Error('Operación no permitida: ' + accion);
  if (ruta.tipo === 'hoja') Guardas_.persona();
  return ruta.fn.apply(null, Array.prototype.slice.call(arguments, 1));
}`);

if (!funciones.has('onOpen')) poner('server/menu-instalacion.js', '/** Menú de instalación de la copia. */\nfunction onOpen() {\n  Instalacion_.menu();\n}');
const nucleo = path.join(__dirname, '..', 'packages', 'nucleo-legado');
fs.readdirSync(nucleo).forEach((f) => poner('server/' + f, fs.readFileSync(path.join(nucleo, f), 'utf8')));

const ids = cfg.ids || {};
[...idsEncontrados.keys()].forEach((k) => { if (!ids[k]) ids[k] = 'carpeta'; });
poner('server/ids.js', `/** Qué es cada ID que antes estaba escrito en el código. Lo usa «Instalar» para crear o asignar el de la copia. */
var IDS_ = ${JSON.stringify(ids, null, 2)};`);

/* ---------- 5. escritura ---------- */
salida.forEach((texto, nombre) => {
  const p = path.join(destinoSrc, nombre);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, texto.replace(/\n{3,}/g, '\n\n'));
});
html.forEach((h) => fs.writeFileSync(path.join(destinoSrc, h.f), reescribirCliente(h.texto)));
const manifiesto = JSON.parse(fs.readFileSync(path.join(ORIGEN, 'appsscript.json'), 'utf8'));
fs.writeFileSync(path.join(destinoSrc, 'appsscript.json'), JSON.stringify(manifiesto, null, 2) + '\n');
const orden = ['src/server/00-nucleo-config.js', 'src/server/01-nucleo-guardas.js', 'src/server/02-nucleo-correo.js',
  'src/server/03-nucleo-instalacion.js', 'src/server/04-nucleo-aislamiento.js', 'src/server/ids.js', 'src/server/config.js'];
fs.writeFileSync(path.join(DESTINO, '.clasp.json'), JSON.stringify({ scriptId: cfg.scriptId || 'PENDIENTE', rootDir: 'src',
  scriptExtensions: ['.js'], htmlExtensions: ['.html'], jsonExtensions: ['.json'], filePushOrder: orden }, null, 2) + '\n');
fs.writeFileSync(path.join(DESTINO, 'globales.json'), JSON.stringify([...new Set([...globales, 'onOpen', 'api', 'menuInstalarApp', 'menuModoProduccion', 'menuModoPrueba'])].sort(), null, 2) + '\n');
fs.writeFileSync(path.join(DESTINO, '.legado'), 'App traída con scripts/migrar-legado.js: límites de función en advertencia hasta refactorizar.\n');

const informe = `# Informe de migración — ${path.basename(DESTINO)}

Generado por \`scripts/migrar-legado.js\` desde \`${ORIGEN}\`.

## Rutas que la página puede llamar (revisar que cada una valide sesión o sea pública a propósito)
${[...llamadas].sort().map((x) => `- [ ] \`${x}\` → \`${nombreReal(x)}\`${hoja.has(x) ? ' (solo hoja)' : ''}`).join('\n')}

## Funciones globales que quedan (con guarda)
${[...globales].sort().map((x) => `- \`${x}\`${menu.has(x) ? ' — menú' : ''}${activadores.has(x) ? ' — activador' : ''}`).join('\n')}

## Funciones que dejaron de ser públicas
${[...renombrar.keys()].filter((x) => !llamadas.has(x)).sort().map((x) => `\`${x}\``).join(', ') || '—'}

## IDs movidos a configuración
${[...idsEncontrados.keys()].map((k) => `- \`${k}\` → tipo \`${ids[k]}\``).join('\n') || '—'}

## Para revisar a mano
${avisos.map((a) => '- ' + a).join('\n') || '—'}
`;
fs.writeFileSync(path.join(DESTINO, 'MIGRACION.md'), informe);
console.log(`Listo: ${llamadas.size} rutas, ${globales.size} globales con guarda, ${renombrar.size} funciones privadas, ${idsEncontrados.size} IDs, ${avisos.length} avisos.`);
