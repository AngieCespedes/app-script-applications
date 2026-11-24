const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cargar, ENCABEZADOS } = require('./cargar');

const G = cargar();

test('Filas.construir respeta fórmulas y coloca por encabezado', () => {
  const enc = ['A', 'B', 'C'];
  const fila = G.Filas.construir(enc, ['', '=1+1', ''], { C: 3, A: 1 }, ['', '', '']);
  assert.deepEqual(fila, [1, '=1+1', 3]);
});

test('Filas.construir no deja escribir en una columna con fórmula ni en una inexistente', () => {
  assert.throws(() => G.Filas.construir(['A', 'B'], ['', '=X'], { B: 1 }), /fórmula/);
  assert.throws(() => G.Filas.construir(['A'], [''], { Z: 1 }), /no existe/);
});

test('Filas.libre ignora las celdas con fórmula', () => {
  assert.equal(G.Filas.libre(['', 'OK', ''], ['', '=F()', '']), true);
  assert.equal(G.Filas.libre(['x', '', ''], ['', '', '']), false);
});

test('Util.nit quita puntos, espacios y dígito de verificación', () => {
  assert.equal(G.Util.nit('830.054.581-2'), '830054581');
  assert.equal(G.Util.nit('46673343-6'), '46673343');
  assert.equal(G.Util.nit(' 891800043 '), '891800043');
});

test('Util.aFecha entiende ISO y dd/mm/aaaa', () => {
  assert.equal(G.Util.fmt(G.Util.aFecha('2026-11-13')), '13/11/2026');
  assert.equal(G.Util.fmt(G.Util.aFecha('5/1/2027')), '05/01/2027');
  assert.equal(G.Util.aFecha('ayer'), null);
});

test('Util.nombreArchivo sigue la convención AAAAMMDD_TERCERO_NUMERO', () => {
  assert.equal(G.Util.nombreArchivo('2026-11-18', 'Papelería Luckis', '0074'), '20261118_PAPELERÍA LUCKIS_0074');
});

test('Las columnas que usa el código existen en la Relación real', () => {
  const m = G.Filas.mapa(ENCABEZADOS.relacion);
  for (const k of Object.keys(G.Config.COL_REL)) assert.ok(m[G.Config.COL_REL[k]] !== undefined, k);
});

test('Al cerrar, cada dato cae en su columna de Movimientos (antes se corrían)', () => {
  const linea = { n: 3, v: { fecha: new Date(2026, 10, 18), recibio: 'Ing. X', estadoSoporte: 'Falta el DSE', cuenta: '513595' },
    t: { revision: 'OK', deducible: 'SÍ' } };
  const obj = G.Cierre.filaMovimiento({ numero: 202, responsable: 'R' }, linea, new Date(), 'https://foto');
  const fila = G.Filas.construir(ENCABEZADOS.movimientos, null, obj);
  const m = G.Filas.mapa(ENCABEZADOS.movimientos);
  assert.equal(fila[m['Recibió el efectivo']], 'Ing. X');
  assert.equal(fila[m['Estado del soporte']], 'Falta el DSE');
  assert.equal(fila[m['Revisión']], 'OK');
  assert.equal(fila[m['Enlace a la foto']], 'https://foto');
});

test('Permisos de la API por rol', () => {
  const R = G.Api.RUTAS, motivo = G.Api.motivoRechazo;
  const aux = { rol: 'Auxiliar' }, ctd = { rol: 'Contadora' }, ger = { rol: 'Gerencia' };
  assert.equal(motivo(R.iniciarSesion, null), '');
  assert.equal(motivo(R.guardarPago, null), 'SIN_SESION');
  assert.equal(motivo(R.guardarPago, aux), '');
  assert.match(motivo(R.restablecerClave, aux), /contadora/);
  assert.equal(motivo(R.restablecerClave, ctd), '');
  assert.equal(motivo(R.aprobarRelacion, ger), '');
  assert.match(motivo(R.aprobarRelacion, aux), /gerencia/);
  assert.match(motivo(R.guardarPago, { rol: 'Contadora', debeCambiar: true }), /cambie la contraseña/);
  assert.equal(motivo(R.cambiarMiClave, { rol: 'Auxiliar', debeCambiar: true }), '');
  assert.equal(motivo(undefined, ctd), 'Operación no permitida.');
});

test('Toda acción que pide la página existe en la API', () => {
  const dir = path.join(__dirname, '..', 'src', 'client');
  const archivos = [];
  (function recorrer(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) recorrer(p); else if (p.endsWith('.html')) archivos.push(p);
    }
  })(dir);
  const pedidas = new Set();
  for (const a of archivos) {
    for (const m of fs.readFileSync(a, 'utf8').matchAll(/(?:servidor|crudo)\('([A-Za-z]+)'/g)) pedidas.add(m[1]);
  }
  const faltan = [...pedidas].filter((x) => !G.Api.RUTAS[x]);
  assert.deepEqual(faltan, []);
});

test('Migración: «S/N» no cuenta como soporte repetido y el plazo DSE solo aplica a DSE', () => {
  const vieja = '=IF(AND(C9<>"",COUNTIF($C$9:$C$58,C9)>1),"N.° de soporte repetido","OK")';
  const nueva = G.MigracionV1.ajustarRevision(vieja);
  assert.match(nueva, /C9<>"S\/N"/);
  assert.equal(G.MigracionV1.ajustarRevision(nueva), nueva);
  const plazo = G.MigracionV1.formulaPlazo(12);
  assert.match(plazo, /SEARCH\("DSE",I12\)/);
  assert.match(plazo, /"No requiere"/);
});
