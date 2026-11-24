/**
 * SISTEMA DE VIÁTICOS POR PROYECTO - SOCIAL SOLAR S.A.S
 * Usa el "FORMATO DE SOLICITUD Y LEGALIZACIÓN DE VIÁTICOS" tal como está.
 *
 * CÓMO FUNCIONA
 *  - Todo se hace en la APP DE VIÁTICOS (una sola dirección para celular o computador).
 *  - ACCESO: solo entran los correos de la columna E de "Trabajadores", con su clave.
 *    La primera vez (o si la olvidan) reciben un código en el correo y crean la clave;
 *    el administrador también puede escribirla en la columna F, al lado del correo.
 *  - PROYECTOS: cada proyecto tiene su jefe y sus técnicos encargados. Un trabajador solo ve
 *    los proyectos donde figura como técnico. El administrador y los jefes crean proyectos
 *    y cambian los técnicos desde la pestaña "Proyectos" de la app (o en la hoja).
 *  - SOLICITAR: el trabajador elige proyecto (solo ve los suyos), fechas y
 *    conceptos. Se crea el formato del viaje en Drive:
 *       <carpeta principal> / <Nombre del proyecto> / <VIA-00001 fecha trabajador> /
 *  - LEGALIZAR: cada día del viaje toma la foto de sus recibos y los envía. Cada gasto se
 *    escribe en el bloque LEGALIZADO del formato (que crece solo si pasa de 20 filas), queda
 *    con el correo y la hora de quien lo registró, y se acumula en la pestaña "Gastos".
 *  - APROBAR (conducto regular): el GERENTE (cargo "GERENTE" en Trabajadores) aprueba a
 *    ingeniería, comercial y demás áreas; los INGENIEROS aprueban a los técnicos (el ingeniero
 *    a cargo del proyecto). Entran a la misma app y aprueban, rechazan, legalizan o
 *    devuelven. En "Registro" queda quién decidió y cuándo. Nadie decide su propia solicitud.
 *    El administrador también puede cambiar el Estado a mano en "Registro".
 *  - La pestaña "Tablero" se calcula sola.
 *
 * QUIÉN PUEDE QUÉ
 *  - Administrador (dueño de esta hoja): menús, listas, claves y todo lo de la hoja.
 *  - Jefes y trabajadores: solo la app. No necesitan (ni deben tener) permiso sobre esta hoja.
 *
 * INSTALACIÓN (una sola vez, con la cuenta de Google de la empresa)
 *  1. Abre la hoja de cálculo de control de viáticos (formato Hojas de cálculo de Google).
 *  2. Extensiones > Apps Script. Borra lo que haya, pega TODO este código y guarda.
 *  3. Recarga la hoja. Aparece el menú "Viáticos".
 *  4. Viáticos > 1. Instalar sistema (acepta los permisos y vuelve a darle clic).
 *  5. Completa "Trabajadores" (correo en E, clave en F) y "Proyectos" (jefe, correo del jefe
 *     y, si quieres restringir, los trabajadores asignados). El jefe debe estar también en
 *     "Trabajadores" para poder entrar a aprobar.
 *  6. Viáticos > 2. Sincronizar listas. Lee los avisos: dicen qué falta.
 *  7. Publica la app: en Apps Script, Implementar > Nueva implementación > tipo
 *     "Aplicación web"; Ejecutar como: Yo; Quién tiene acceso: Cualquier usuario;
 *     Implementar. Copia el enlace (/exec).
 *  8. Viáticos > 3. Guardar enlace de la app, y pégalo.
 *  9. Viáticos > 4. Enlace para los trabajadores, y compártelo.
 *
 *  Al actualizar desde una versión anterior: pega este código, usa "2. Sincronizar listas"
 *  y publica una versión nueva (Implementar > Administrar implementaciones > editar >
 *  Versión: Nueva versión).
 */

const CARPETA_RAIZ = 'Viáticos por Proyecto';
// Carpeta de Drive de Social Solar donde se guarda todo. Si esta cuenta no puede abrirla, se crea una carpeta nueva.
const CARPETA_DESTINO_ID = '10TCTepTgaBmpg0_J6mnaMVrLkTWtUYyO';
const HOJA_FORMATO = 'Formato Legalizacion de Viatic';
const HOJA_TRAB = 'Trabajadores';
const HOJA_PROY = 'Proyectos';
const HOJA_REG = 'Registro';
// Colores corporativos de Social Solar (tomados del logo)
const NEGRO = '#1A1A1A';
const AMARILLO = '#FFB41D';
const AMARILLO_CLARO = '#FFE7B0';

const HOJA_GASTOS = 'Gastos';
const HOJA_TABLERO = 'Tablero';
const HOJA_PRESU = 'Presupuesto';
const PRESU_INI = 6; // primera fila de proyectos en la hoja Presupuesto (la 5 es el total)

// Filas de detalle del formato (N.° 1 a 20)
// Hora de Colombia para firmas, fechas y registros, sin importar la zona configurada en la cuenta o en la hoja
const ZONA = 'America/Bogota';
const FILA_INI = 19, FILA_FIN = 38;
const N_FILAS = FILA_FIN - FILA_INI + 1;
// FILA_INI es la de la plantilla original. Cada formato calcula la suya con filaIni_(f), porque las casillas
// adicionales del encabezado (pestaña "Casillas") empujan la tabla hacia abajo.
const HOJA_CASILLAS = 'Casillas';
const MAX_CASILLAS = 10;
const DIAS_SESION = 30; // días que un celular queda con la sesión abierta antes de pedir código otra vez
const MAX_FILAS = 200; // el formato crece solo cuando se llenan las 20 filas

const ESTADOS = ['Solicitado', 'Aprobado', 'Rechazado', 'En revisión', 'Legalizado'];
const ABIERTOS = ['Solicitado', 'Aprobado'];
const POR_DECIDIR = ['Solicitado', 'En revisión'];
// Estados en los que quien aprueba (el ingeniero a cargo o el gerente) todavía puede agregar gastos al formato
const ABIERTOS_APROBADOR = ['Solicitado', 'Aprobado', 'En revisión'];
const VALOR_MAXIMO = 50000000; // tope por gasto o por concepto, para atajar errores de digitación

const REG = [
  'ID', 'Fecha de solicitud', 'Trabajador', 'Cédula', 'Proyecto', 'Destino', 'Salida', 'Regreso',
  'Objeto del viaje', 'Valor solicitado', 'Total legalizado', 'Saldo a reintegrar', 'Saldo a favor',
  'N.° de soportes', 'Estado', 'Observaciones del jefe', 'Fecha de decisión', 'Formato', 'Carpeta',
  'Correo del trabajador', 'ID formato (no tocar)', 'ID carpeta (no tocar)', 'Decidido por',
  'Observaciones de la solicitud', 'Técnicos que viajan', 'Técnico responsable del dinero', 'Casillas adicionales'
];
const GAS = [
  'ID', 'Fecha de registro', 'Fecha del gasto', 'Trabajador', 'Proyecto', 'Concepto', 'Tercero (proveedor / NIT)',
  'N.° de soporte', 'Valor gastado', 'Observaciones', 'Soporte', 'N.° en el formato', 'Acumulado de la solicitud',
  'Registrado por (correo)', 'N.° de factura contable'
];
const C = {
  id: 1, fecha: 2, trab: 3, ced: 4, proy: 5, dest: 6, sal: 7, reg: 8, obj: 9, solic: 10, legal: 11,
  reint: 12, favor: 13, nsop: 14, estado: 15, obs: 16, fdec: 17, formato: 18, carpeta: 19,
  correo: 20, idFormato: 21, idCarpeta: 22, por: 23, notas: 24, viajan: 25, resp: 26, extra: 27
};

/* ============================== MENÚ ============================== */

function onOpen() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName('Formato') && !ss.getSheetByName(HOJA_TRAB)) return; // es el archivo de un viaje, no el principal
  SpreadsheetApp.getUi().createMenu('Viáticos')
    .addItem('1. Instalar sistema', 'instalar')
    .addItem('2. Sincronizar listas', 'sincronizar')
    .addItem('Asignar clave a un trabajador', 'asignarClave')
    .addItem('Agregar varios proyectos', 'dialogoProyectos')
    .addItem('Actualizar formatos por proyecto', 'actualizarFormatosProyecto')
    .addItem('Eliminar una solicitud (repetida o de prueba)', 'eliminarSolicitud')
    .addItem('Elegir carpeta de Drive donde se guarda todo', 'elegirCarpeta')
    .addSeparator()
    .addItem('3. Guardar enlace de la app', 'guardarEnlaceApp')
    .addItem('4. Enlace para los trabajadores', 'mostrarEnlaces')
    .addToUi();
}

/* ============================ UTILIDADES ============================ */

function hojaFormato_(ss) {
  const h = ss.getSheetByName(HOJA_FORMATO);
  if (h) return h;
  const todas = ss.getSheets();
  for (let i = 0; i < todas.length; i++) {
    if (/^formato/i.test(todas[i].getName())) return todas[i];
  }
  return null;
}

function leerTrabajadores_(ss) {
  return ss.getSheetByName(HOJA_TRAB).getRange(3, 1, 40, 5).getValues()
    .filter(function (f) { return norm_(f[0]) !== ''; })
    .map(function (f) {
      return { nombre: norm_(f[0]), cedula: f[1], cargo: f[2], area: f[3], correo: String(f[4]).trim().toLowerCase() };
    });
}

const CLAVE_OK = 'Asignada ✔';

// La lista de conceptos está bajo el título "CONCEPTOS DE GASTO" (columna F, o G cuando existe la columna de clave)
function colConceptos_(tr) {
  const fila1 = tr.getRange(1, 1, 1, Math.max(tr.getLastColumn(), 6)).getValues()[0];
  for (let i = 4; i < fila1.length; i++) {
    if (String(fila1[i]).toUpperCase().indexOf('CONCEPTOS') > -1) return i + 1;
  }
  return 6;
}

// Columna "Clave" de "Trabajadores" (0 si aún no existe)
function colClave_(tr) {
  const fila2 = tr.getRange(2, 1, 1, Math.max(tr.getLastColumn(), 6)).getValues()[0];
  for (let i = 4; i < fila2.length; i++) {
    if (String(fila2[i]).trim().toLowerCase().indexOf('clave') === 0) return i + 1;
  }
  return 0;
}

// Toma las claves escritas en la hoja, las guarda protegidas y deja la celda marcada.
// Así la clave no queda a la vista de quienes pueden abrir la hoja.
function procesarClaves_(ss) {
  const tr = ss.getSheetByName(HOJA_TRAB);
  const col = tr ? colClave_(tr) : 0;
  if (!col) return 0;
  const correos = tr.getRange(3, 5, 40, 1).getValues();
  const claves = tr.getRange(3, col, 40, 1).getDisplayValues();
  let n = 0;
  for (let i = 0; i < claves.length; i++) {
    const clave = String(claves[i][0]).trim();
    if (!clave || clave === CLAVE_OK || clave.indexOf('ERROR') === 0) continue;
    const correo = String(correos[i][0]).trim().toLowerCase();
    let marca = CLAVE_OK;
    if (!correo) marca = 'ERROR: primero escribe el correo';
    else if (clave.length < 6) marca = 'ERROR: mínimo 6 caracteres';
    else { guardarClave_(correo, clave); CacheService.getScriptCache().remove('INT_' + correo); n++; }
    tr.getRange(i + 3, col).setValue(marca);
  }
  return n;
}

function leerConceptos_(ss) {
  const hojaTrab = ss.getSheetByName(HOJA_TRAB);
  return hojaTrab.getRange(2, colConceptos_(hojaTrab), 41, 1).getValues()
    .map(function (f) { return norm_(f[0]); })
    .filter(function (c) { return c !== ''; });
}

function leerProyectos_(ss) {
  const h = ss.getSheetByName(HOJA_PROY);
  if (!h || h.getLastRow() < 2) return [];
  const colAsig = colAsignados_(h);
  return h.getRange(2, 1, h.getLastRow() - 1, Math.max(5, colAsig)).getValues()
    .map(function (f, i) {
      return {
        fila: i + 2, nombre: norm_(f[0]), jefe: norm_(f[1]), correo: String(f[2]).trim().toLowerCase(), carpetaId: String(f[4]).trim(),
        // correos o nombres de quienes pueden usar el proyecto; lista vacía = todos
        asignados: colAsig ? String(f[colAsig - 1]).split(/[,;\n]/).map(function (x) { return x.trim().toLowerCase(); }).filter(function (x) { return x; }) : []
      };
    })
    .filter(function (p) { return p.nombre !== ''; });
}

const TITULO_ASIGNADOS = 'Trabajadores asignados';

// Columna de "Proyectos" donde se escribe quién puede usar cada proyecto (0 si aún no existe)
function colAsignados_(hoja) {
  const titulos = hoja.getRange(1, 1, 1, Math.max(hoja.getLastColumn(), 1)).getValues()[0];
  for (let i = 0; i < titulos.length; i++) {
    if (String(titulos[i]).trim().toLowerCase().indexOf(TITULO_ASIGNADOS.toLowerCase()) === 0) return i + 1;
  }
  return 0;
}

// Un proyecto solo lo ve quien figura como técnico encargado (o su jefe). Sin técnicos asignados, no lo ve nadie más.
function puedeUsar_(proy, yo) {
  return proy.asignados.indexOf(yo.correo) > -1 || proy.asignados.indexOf(yo.nombre.toLowerCase()) > -1 ||
    (!!proy.correo && proy.correo === yo.correo);
}

// ¿La persona es del área técnica? (según la columna "Área" de la pestaña Trabajadores, con o sin tilde)
function esTecnico_(t) {
  return String(t.area || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().indexOf('TECNIC') > -1;
}

function sinTildes_(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}
function esIngeniero_(t) { return sinTildes_(t.area).indexOf('INGENIER') > -1; }
function esGerente_(t) { return sinTildes_(t.cargo).indexOf('GERENT') > -1; }
// Tesorería: cargo o área con "TESORER" en "Trabajadores". Registra a quién se le entregó la plata (también gerencia).
function esTesoreria_(t) { return (sinTildes_(t.cargo) + ' ' + sinTildes_(t.area)).indexOf('TESORER') > -1; }
function registraEntregas_(yo) { return esTesoreria_(yo) || esGerente_(yo) || esAdmin_(yo); }
// Si hay alguien de tesorería con correo, aprobar deja la plata "Por pagar" hasta que tesorería o gerencia registre la entrega
function hayTesoreria_(trabajadores) { return trabajadores.some(function (t) { return t.correo && esTesoreria_(t); }); }

// CONDUCTO REGULAR: quién aprueba una solicitud, según quién la pidió
//  - La pide un técnico (área TÉCNICA): la aprueba el ingeniero a cargo del proyecto
//    (si el jefe del proyecto no es de ingeniería, cualquier ingeniero).
//  - La pide cualquier otra persona (ingeniería, comercial, administrativa…): el gerente
//    (quien tenga "GERENTE" en el cargo, en la pestaña Trabajadores).
//  - Si no hay gerente registrado: el jefe del proyecto, como antes.
//  - Nadie aprueba lo suyo: las solicitudes del gerente las decide el administrador en "Registro".
function aprobadores_(fila, trabajadores, proyectos) {
  const correoSol = String(fila[C.correo - 1] || '').trim().toLowerCase();
  const porCorreo = function (c) {
    for (let i = 0; i < trabajadores.length; i++) if (trabajadores[i].correo && trabajadores[i].correo === c) return trabajadores[i];
    return null;
  };
  const sol = porCorreo(correoSol);
  const proy = buscar_(proyectos, fila[C.proy - 1]);
  const jefe = proy && proy.correo ? porCorreo(proy.correo) : null;
  const gerentes = trabajadores.filter(function (t) { return t.correo && esGerente_(t); });
  let lista;
  if (sol && esTecnico_(sol)) {
    lista = (jefe && esIngeniero_(jefe)) ? [jefe] : trabajadores.filter(function (t) { return t.correo && esIngeniero_(t); });
  } else if (gerentes.length) {
    lista = gerentes;
  } else {
    lista = jefe ? [jefe] : [];
  }
  return lista.filter(function (t) { return t.correo !== correoSol; });
}

function esAdmin_(yo) {
  const admin = String(PropertiesService.getScriptProperties().getProperty('ADMIN') || '').toLowerCase();
  return !!admin && admin === yo.correo;
}

// Crean proyectos y asignan técnicos: el administrador y quienes ya son jefes de algún proyecto
function puedeGestionar_(proyectos, yo) {
  return esAdmin_(yo) || proyectos.some(function (p) { return p.correo && p.correo === yo.correo; });
}

// Nombres de los técnicos encargados de un proyecto (lo escrito en la hoja puede ser correo o nombre)
function tecnicosDe_(proy, trabajadores) {
  return proy.asignados.map(function (a) {
    for (let i = 0; i < trabajadores.length; i++) {
      if (trabajadores[i].correo === a || trabajadores[i].nombre.toLowerCase() === a) return trabajadores[i].nombre;
    }
    return a;
  });
}

function buscar_(lista, nombre) {
  const n = norm_(nombre).toUpperCase();
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].nombre.toUpperCase() === n) return lista[i];
  }
  return null;
}

// Convierte "2026-10-07" en una fecha a medianoche en la zona horaria de la hoja ('' si no es válida)
function aFecha_(texto) {
  const t = String(texto || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return '';
  const a = Number(m[1]), mes = Number(m[2]), dia = Number(m[3]);
  if (a < 2020 || a > 2100 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return '';
  const d = Utilities.parseDate(t, ZONA, 'yyyy-MM-dd');
  return isNaN(d.getTime()) ? '' : d;
}

function fmt_(fecha, patron) {
  if (!(fecha instanceof Date)) return String(fecha || '');
  return Utilities.formatDate(fecha, ZONA, patron || 'dd/MM/yyyy');
}

function pesos_(n) {
  return '$ ' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function aNumero_(texto) {
  return Number(String(texto == null ? '' : texto).replace(/[^0-9]/g, '')) || 0;
}

function limpiarNombre_(texto) {
  return String(texto).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
}

function esc_(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Quita espacios repetidos (un nombre con dos espacios seguidos no coincide con las listas de la app)
function norm_(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
}

// Texto escrito por un usuario: una sola línea, con largo máximo y sin empezar como fórmula (= + - @)
function txt_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/^[\s=+\-@]+/, '').replace(/\s+/g, ' ').trim().slice(0, max || 300);
}

function esCorreo_(v) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || ''));
}

// Un solo proceso a la vez escribe en las hojas; si está ocupado, avisa en español en vez de fallar
function candado_() {
  const c = LockService.getScriptLock();
  if (!c.tryLock(45000)) throw new Error('El sistema está ocupado en este momento. Intenta de nuevo en un minuto.');
  return c;
}

function instalado_() {
  const p = PropertiesService.getScriptProperties();
  return !!(p.getProperty('INSTALADO') || p.getProperty('FORM_SOL_ID'));
}

// Los menús solo los usa el administrador (el dueño de la hoja) y nunca se pueden llamar desde la app web
function soloAdmin_() {
  const ui = SpreadsheetApp.getUi(); // desde la app web esta línea falla, y así debe ser
  const props = PropertiesService.getScriptProperties();
  const yo = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  let admin = props.getProperty('ADMIN');
  if (!admin) {
    let dueno = '';
    try { dueno = String(SpreadsheetApp.getActiveSpreadsheet().getOwner().getEmail() || '').toLowerCase(); } catch (err) {}
    admin = dueno || yo;
    if (admin) props.setProperty('ADMIN', admin);
  }
  if (admin && yo && yo !== admin) {
    ui.alert('Este menú solo lo puede usar ' + admin + '.');
    throw new Error('Menú reservado para el administrador.');
  }
  return ui;
}

function tabla_(pares) {
  return '<table cellpadding="6" style="border-collapse:collapse">' + pares.map(function (p) {
    return '<tr><td style="border:1px solid #ccc"><b>' + esc_(p[0]) + '</b></td><td style="border:1px solid #ccc">' + esc_(p[1]) + '</td></tr>';
  }).join('') + '</table>';
}

function avisarAdmin_(asunto, html) {
  correo_(PropertiesService.getScriptProperties().getProperty('ADMIN'), asunto, html);
}

function correo_(para, asunto, html) {
  if (!para) return;
  try {
    MailApp.sendEmail({ to: para, subject: asunto, htmlBody: html });
  } catch (err) {
    console.error('No se pudo enviar correo a ' + para + ': ' + err);
  }
}

// Siguiente número de solicitud: nunca repite uno que ya esté en "Registro" (aunque el contador se haya reiniciado,
// por ejemplo al pegar el código en un proyecto de Apps Script nuevo)
function numeroId_(id) { const m = /^VIA-(\d+)$/.exec(String(id).trim()); return m ? Number(m[1]) : 0; }
function siguienteId_(ss) {
  const props = PropertiesService.getScriptProperties(), reg = ss.getSheetByName(HOJA_REG);
  let n = Number(props.getProperty('CONSECUTIVO') || 0);
  if (reg && reg.getLastRow() >= 2) reg.getRange(2, C.id, reg.getLastRow() - 1, 1).getValues().forEach(function (r) { n = Math.max(n, numeroId_(r[0])); });
  n += 1;
  props.setProperty('CONSECUTIVO', String(n));
  return 'VIA-' + ('0000' + n).slice(-5);
}

// Si dos solicitudes quedaron con el mismo número, la más nueva recibe un número nuevo. Sus gastos y entregas
// (los que son de su proyecto y trabajador) y los nombres de su formato y su carpeta se corrigen también.
function repararDuplicados_(ss) {
  const reg = ss.getSheetByName(HOJA_REG);
  if (!reg || reg.getLastRow() < 3) return [];
  const ids = reg.getRange(2, C.id, reg.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]).trim(); });
  const vistos = {}, dup = {};
  ids.forEach(function (id) { if (id) { if (vistos[id]) dup[id] = true; vistos[id] = true; } });
  if (!Object.keys(dup).length) return [];
  const filas = reg.getRange(2, 1, reg.getLastRow() - 1, REG.length).getValues();
  const cambios = [];
  Object.keys(dup).forEach(function (id) {
    const grupo = [];
    filas.forEach(function (d, i) { if (String(d[C.id - 1]).trim() === id) grupo.push({ i: i, d: d, nuevo: id }); });
    grupo.slice(1).forEach(function (x) { x.nuevo = siguienteId_(ss); reg.getRange(x.i + 2, C.id).setValue(x.nuevo); });
    // ¿De cuál de las solicitudes con ese número es este gasto / esta entrega?
    const dueno = function (proy, trab, fecha) {
      let mejor = null, pMejor = -1;
      grupo.forEach(function (x) {
        let pts = 0;
        if (norm_(x.d[C.proy - 1]).toUpperCase() === norm_(proy).toUpperCase()) pts += 4;
        if (trab && (norm_(x.d[C.trab - 1]).toUpperCase() === norm_(trab).toUpperCase() || norm_(x.d[C.resp - 1]).toUpperCase() === norm_(trab).toUpperCase())) pts += 2;
        const fs = x.d[C.fecha - 1] instanceof Date ? x.d[C.fecha - 1].getTime() : 0;
        if (fecha instanceof Date && fs && fs <= fecha.getTime() + 60000) pts += 1 + fs / 1e14; // la más reciente que ya existía
        if (pts > pMejor) { pMejor = pts; mejor = x; }
      });
      return mejor;
    };
    const gas = ss.getSheetByName(HOJA_GASTOS);
    if (gas && gas.getLastRow() >= 2) {
      gas.getRange(2, 1, gas.getLastRow() - 1, 5).getValues().forEach(function (r, i) {
        if (String(r[0]).trim() !== id) return;
        const x = dueno(r[4], r[3], r[1]);
        if (x && x.nuevo !== id) gas.getRange(i + 2, 1).setValue(x.nuevo);
      });
    }
    const h = ss.getSheetByName(HOJA_ENT);
    if (h && h.getLastRow() >= 2) {
      h.getRange(2, 1, h.getLastRow() - 1, 5).getValues().forEach(function (r, i) {
        if (String(r[2]).trim() !== id) return;
        const x = dueno(r[3], r[4], r[1]);
        if (x && x.nuevo !== id) h.getRange(i + 2, 1, 1, 3).setValues([[String(r[0]).replace(id, x.nuevo), r[1], x.nuevo]]);
      });
    }
    grupo.slice(1).forEach(function (x) {
      intentar_(function () {
        const css = SpreadsheetApp.openById(x.d[C.idFormato - 1]);
        css.rename(String(css.getName()).replace(id, x.nuevo));
        const dd = reg.getRange(x.i + 2, 1, 1, REG.length).getValues()[0];
        llenarEntregado_(hojaFormato_(css), dd);
      });
      intentar_(function () { const c = DriveApp.getFolderById(x.d[C.idCarpeta - 1]); c.setName(String(c.getName()).replace(id, x.nuevo)); });
      cambios.push(id + ' de ' + x.d[C.trab - 1] + ' (' + x.d[C.proy - 1] + ') ahora es ' + x.nuevo);
    });
  });
  SpreadsheetApp.flush();
  return cambios;
}

// ¿De cuál de las solicitudes que comparten número es un gasto o una entrega? (por proyecto, trabajador y fecha)
function duenoEntre_(grupo, proy, trab, fecha) {
  let mejor = null, pMejor = -1;
  grupo.forEach(function (x) {
    let pts = 0;
    if (norm_(x.d[C.proy - 1]).toUpperCase() === norm_(proy).toUpperCase()) pts += 4;
    if (trab && (norm_(x.d[C.trab - 1]).toUpperCase() === norm_(trab).toUpperCase() || norm_(x.d[C.resp - 1]).toUpperCase() === norm_(trab).toUpperCase())) pts += 2;
    const fs = x.d[C.fecha - 1] instanceof Date ? x.d[C.fecha - 1].getTime() : 0;
    if (fecha instanceof Date && fs && fs <= fecha.getTime() + 60000) pts += 1 + fs / 1e14;
    if (pts > pMejor) { pMejor = pts; mejor = x; }
  });
  return mejor;
}

// Menú Viáticos > Eliminar una solicitud. Borra la fila de "Registro", sus gastos y sus entregas, y manda a la
// papelera de Drive su formato y su carpeta (se pueden recuperar desde la papelera durante 30 días).
function eliminarSolicitud() {
  const ui = soloAdmin_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reg = ss.getSheetByName(HOJA_REG);
  const r1 = ui.prompt('Eliminar una solicitud', 'Número de la solicitud que quieres eliminar (por ejemplo VIA-00001):', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  const id = String(r1.getResponseText() || '').trim().toUpperCase();
  const filas = reg.getLastRow() >= 2 ? reg.getRange(2, 1, reg.getLastRow() - 1, REG.length).getValues() : [];
  const grupo = [];
  filas.forEach(function (d, i) { if (String(d[C.id - 1]).trim().toUpperCase() === id) grupo.push({ i: i, d: d }); });
  if (!grupo.length) { ui.alert('No hay ninguna solicitud con el número ' + id + ' en "Registro".'); return; }
  const linea = function (x) { return x.d[C.id - 1] + ' · ' + x.d[C.trab - 1] + ' · ' + x.d[C.proy - 1] + ' · ' + pesos_(Number(x.d[C.solic - 1]) || 0) + ' · ' + x.d[C.estado - 1]; };
  let x = grupo[0];
  if (grupo.length > 1) {
    const r2 = ui.prompt('Eliminar una solicitud', 'Hay ' + grupo.length + ' solicitudes con el número ' + id + '. Escribe el número de la que quieres eliminar:\n\n' +
      grupo.map(function (y, k) { return (k + 1) + ') ' + linea(y); }).join('\n'), ui.ButtonSet.OK_CANCEL);
    if (r2.getSelectedButton() !== ui.Button.OK) return;
    x = grupo[Number(String(r2.getResponseText()).trim()) - 1];
    if (!x) { ui.alert('Esa opción no está en la lista. No se eliminó nada.'); return; }
  }
  const r3 = ui.prompt('Confirmar', 'Se va a eliminar:\n\n' + linea(x) + '\n\nSe borran su fila en "Registro", sus gastos y sus entregas, y su formato y su carpeta van a la papelera de Drive.' +
    '\n\nEscribe ELIMINAR para confirmar:', ui.ButtonSet.OK_CANCEL);
  if (r3.getSelectedButton() !== ui.Button.OK || String(r3.getResponseText()).trim().toUpperCase() !== 'ELIMINAR') { ui.alert('No se eliminó nada.'); return; }
  const candado = candado_();
  let res;
  try { res = eliminarSolicitud_(ss, grupo, x); } finally { candado.releaseLock(); }
  ui.alert('Solicitud eliminada: ' + linea(x) + '\n\nGastos borrados: ' + res.gastos + '\nEntregas borradas: ' + res.entregas + '\nFormato y carpeta: ' + (res.drive ? 'en la papelera de Drive' : 'no se encontraron'));
}
function eliminarSolicitud_(ss, grupo, x) {
  const id = String(x.d[C.id - 1]).trim(), reg = ss.getSheetByName(HOJA_REG);
  const mio = function (proy, trab, fecha) { return grupo.length === 1 || duenoEntre_(grupo, proy, trab, fecha) === x; };
  const borrar = function (h, filasBorrar) { filasBorrar.sort(function (a, b) { return b - a; }).forEach(function (f) { h.deleteRow(f); }); return filasBorrar.length; };
  let gastos = 0, entregas = 0, drive = false;
  const gas = ss.getSheetByName(HOJA_GASTOS);
  if (gas && gas.getLastRow() >= 2) {
    const fb = [];
    gas.getRange(2, 1, gas.getLastRow() - 1, 5).getValues().forEach(function (r, i) { if (String(r[0]).trim() === id && mio(r[4], r[3], r[1])) fb.push(i + 2); });
    gastos = borrar(gas, fb);
  }
  const h = ss.getSheetByName(HOJA_ENT);
  if (h && h.getLastRow() >= 2) {
    const fb = [];
    h.getRange(2, 1, h.getLastRow() - 1, 5).getValues().forEach(function (r, i) { if (String(r[2]).trim() === id && mio(r[3], r[4], r[1])) fb.push(i + 2); });
    entregas = borrar(h, fb);
  }
  intentar_(function () { DriveApp.getFileById(x.d[C.idFormato - 1]).setTrashed(true); drive = true; });
  intentar_(function () { DriveApp.getFolderById(x.d[C.idCarpeta - 1]).setTrashed(true); drive = true; });
  reg.deleteRow(x.i + 2);
  SpreadsheetApp.flush();
  intentar_(function () { marcarControl_(String(x.d[C.proy - 1])); });
  return { gastos: gastos, entregas: entregas, drive: drive };
}

function filaRegistro_(hojaReg, id) {
  if (hojaReg.getLastRow() < 2) return 0;
  const celda = hojaReg.getRange(2, C.id, hojaReg.getLastRow() - 1, 1)
    .createTextFinder(String(id)).matchEntireCell(true).findNext();
  return celda ? celda.getRow() : 0;
}

/* ============================ INSTALACIÓN ============================ */

function instalar() {
  const ui = soloAdmin_();
  const props = PropertiesService.getScriptProperties();
  if (instalado_()) { ui.alert('El sistema ya está instalado.\n\nPara actualizar hojas y listas usa "2. Sincronizar listas".'); return; }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  construirFormato_(ss); // solo crea lo que falte; nunca pisa hojas que ya existen
  const formato = hojaFormato_(ss);
  if (!formato || !leerTrabajadores_(ss).length || !leerConceptos_(ss).length) {
    ui.alert('La pestaña "Trabajadores" debe tener al menos un trabajador y un concepto de gasto.');
    return;
  }

  // Carpeta principal en Drive (si la instalación se repite, se reutiliza la que ya quedó)
  let raiz = null;
  try { raiz = DriveApp.getFolderById(props.getProperty('ROOT_ID') || CARPETA_DESTINO_ID); raiz.getName(); } catch (err) { raiz = null; }
  if (!raiz) raiz = DriveApp.createFolder(CARPETA_RAIZ);
  try { DriveApp.getFileById(ss.getId()).moveTo(raiz); } catch (err) { console.error('La hoja no se pudo mover: ' + err); }
  props.setProperty('ROOT_ID', raiz.getId());

  // Pestaña Proyectos (conserva los proyectos que ya vengan cargados, p. ej. desde el Excel)
  const pro = ss.getSheetByName(HOJA_PROY) || ss.insertSheet(HOJA_PROY);
  const yaHayProyectos = pro.getLastRow() >= 2;
  if (!yaHayProyectos) pro.clear();
  pro.getRange(1, 1, 1, 5)
    .setValues([['Proyecto', 'Jefe inmediato (nombre)', 'Correo del jefe', 'Carpeta en Drive', 'ID carpeta (no tocar)']])
    .setFontWeight('bold').setBackground(NEGRO).setFontColor('#ffffff');
  pro.setFrozenRows(1);
  intentar_(function () { pro.setColumnWidths(1, 4, 240); });
  const proyEjemplo = String(formato.getRange('E12').getValue()).trim() || PLANTILLA.semilla[0];
  const jefeEjemplo = String(formato.getRange('H49').getValue()).replace(/^Nombre:\s*/i, '').trim() || PLANTILLA.semilla[1];
  if (!yaHayProyectos && proyEjemplo) pro.getRange(2, 1, 1, 2).setValues([[proyEjemplo, jefeEjemplo]]);

  asegurarHojas_(ss); // Registro, Gastos, Tablero y columnas de control
  activador_();
  props.setProperty('INSTALADO', '1'); // se marca al final: si algo falla antes, se puede volver a instalar

  ss.setActiveSheet(pro);
  ui.alert('Instalación lista',
    'Siguiente paso:\n\n' +
    '1) Completa "Trabajadores" (con correo y clave) y "Proyectos" (con el correo del jefe).\n' +
    '2) Viáticos > 2. Sincronizar listas.\n' +
    '3) En Apps Script: Implementar > Nueva implementación > Aplicación web, y copia el enlace.\n' +
    '4) Viáticos > 3. Guardar enlace de la app.\n' +
    '5) Viáticos > 4. Enlace para los trabajadores.',
    ui.ButtonSet.OK);
}

// Activador que reacciona a los cambios hechos a mano en "Registro" y "Trabajadores" (se crea una sola vez)
function activador_() {
  const hay = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'alEditar'; });
  if (!hay) ScriptApp.newTrigger('alEditar').forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onEdit().create();
}

// Los formularios de Google de versiones anteriores se cierran: aceptaban correos sin verificar
function cerrarFormularios_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('FORMS_CERRADOS')) return;
  ['FORM_SOL_ID', 'FORM_GAS_ID'].forEach(function (k) {
    const id = props.getProperty(k);
    if (!id) return;
    try { FormApp.openById(id).setAcceptingResponses(false); } catch (err) { console.error(err); }
  });
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (['alEnviarSolicitud', 'alEnviarGasto'].indexOf(t.getHandlerFunction()) > -1) ScriptApp.deleteTrigger(t);
    });
  } catch (err) { console.error(err); }
  props.setProperty('FORMS_CERRADOS', '1');
}

// Quedan definidas por si algún activador viejo sigue vivo; ya no hacen nada
function alEnviarSolicitud() {}
function alEnviarGasto() {}

/* ====================== SINCRONIZAR LISTAS Y CARPETAS ====================== */

function sincronizar() {
  const ui = soloAdmin_();
  const props = PropertiesService.getScriptProperties();
  if (!instalado_()) { ui.alert('Primero usa "1. Instalar sistema".'); return; }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  asegurarHojas_(ss);
  activador_();
  cerrarFormularios_();
  const trabajadores = leerTrabajadores_(ss);
  const conceptos = leerConceptos_(ss);
  const proyectos = leerProyectos_(ss);
  if (!trabajadores.length || !conceptos.length || !proyectos.length) {
    ui.alert('Debe haber al menos un trabajador, un concepto de gasto y un proyecto.');
    return;
  }

  // Carpeta por proyecto. El jefe solo puede VER la carpeta de su proyecto; aprueba desde la app.
  const raiz = DriveApp.getFolderById(props.getProperty('ROOT_ID'));
  const pro = ss.getSheetByName(HOJA_PROY);
  let creadas = 0;
  proyectos.forEach(function (p) {
    if (!p.carpetaId) {
      const carpeta = raiz.createFolder(limpiarNombre_(p.nombre));
      pro.getRange(p.fila, 4, 1, 2).setValues([[carpeta.getUrl(), carpeta.getId()]]);
      p.carpetaId = carpeta.getId();
      creadas++;
    }
    if (esCorreo_(p.correo)) {
      try { DriveApp.getFolderById(p.carpetaId).addViewer(p.correo); } catch (err) {}
    }
  });

  // Revisión de datos: lo que impediría que alguien entre o apruebe
  const avisos = [];
  const sinCorreo = trabajadores.filter(function (t) { return !t.correo; }).length;
  if (sinCorreo) avisos.push(sinCorreo + ' trabajador(es) sin correo en la columna E de "Trabajadores": no podrán entrar a la app.');
  const vistos = {}, repetidos = [], conocidos = {};
  trabajadores.forEach(function (t) {
    conocidos[t.nombre.toLowerCase()] = true;
    if (!t.correo) return;
    if (vistos[t.correo]) repetidos.push(t.correo);
    vistos[t.correo] = true; conocidos[t.correo] = true;
  });
  if (repetidos.length) avisos.push('Correos repetidos en "Trabajadores" (cada persona necesita el suyo): ' + repetidos.join(', '));
  const sinJefe = proyectos.filter(function (p) { return !esCorreo_(p.correo); }).length;
  if (sinJefe) avisos.push(sinJefe + ' proyecto(s) sin correo del jefe: nadie recibirá el aviso para aprobarlos.');
  const sinTecnicos = proyectos.filter(function (p) { return !p.asignados.length; }).map(function (p) { return p.nombre; });
  if (sinTecnicos.length) avisos.push(sinTecnicos.length + ' proyecto(s) sin técnicos encargados (ningún trabajador los verá en la app): ' + sinTecnicos.slice(0, 8).join(', ') + (sinTecnicos.length > 8 ? '…' : ''));
  const jefesFuera = [];
  proyectos.forEach(function (p) {
    if (esCorreo_(p.correo) && !vistos[p.correo] && jefesFuera.indexOf(p.correo) === -1) jefesFuera.push(p.correo);
  });
  if (jefesFuera.length) avisos.push('Jefes que no están en "Trabajadores" y por eso no pueden entrar a aprobar: ' + jefesFuera.join(', '));
  const desconocidos = [];
  proyectos.forEach(function (p) {
    p.asignados.forEach(function (a) { if (!conocidos[a]) desconocidos.push(a + ' (' + p.nombre + ')'); });
  });
  if (desconocidos.length) avisos.push('Asignados en "Proyectos" que no coinciden con ningún trabajador: ' + desconocidos.slice(0, 10).join(', '));
  let editores = [];
  try { editores = ss.getEditors().map(function (u) { return u.getEmail(); }).filter(function (c) { return c && c.toLowerCase() !== props.getProperty('ADMIN'); }); } catch (err) {}
  if (editores.length) avisos.push('Estas cuentas pueden EDITAR esta hoja (ven cédulas y pueden cambiar datos): ' + editores.join(', ') + '. Los jefes ya no lo necesitan; quítalas en Compartir si no son administradores.');
  const gerentesS = trabajadores.filter(function (t) { return esGerente_(t); });
  if (!gerentesS.length) avisos.push('No hay gerente en "Trabajadores" (cargo GERENTE): mientras tanto aprueba el jefe de cada proyecto.');
  gerentesS.filter(function (t) { return !t.correo; }).forEach(function (t) { avisos.push('El gerente ' + t.nombre + ' no tiene correo: no podrá aprobar en la app.'); });
  if (!trabajadores.some(function (t) { return t.correo && esIngeniero_(t); })) avisos.push('Ningún ingeniero tiene correo: nadie podrá aprobar las solicitudes de los técnicos.');
  if (trabajadores.length >= 40) avisos.push('La lista de trabajadores llegó al máximo de 40 filas.');
  repararDuplicados_(ss).forEach(function (c) { avisos.push('Número repetido corregido: ' + c + '.'); });
  limpiarEntregasHuerfanas_(ss).forEach(function (c) { avisos.push('Entrega de una solicitud que ya no existe, quitada de "Entregas": ' + c + '.'); });

  ui.alert('Listas sincronizadas.\n\nTrabajadores: ' + trabajadores.length +
    '\nProyectos: ' + proyectos.length + '\nCarpetas nuevas: ' + creadas +
    (avisos.length ? '\n\nPARA REVISAR:\n- ' + avisos.join('\n- ') : '\n\nTodo en orden.'));
}

/* ================= 1) EL TRABAJADOR ENVÍA UNA SOLICITUD ================= */

// Crea el formato del viaje en la carpeta del proyecto y avisa al jefe.
// s: { nombre, proyecto, ciudad, salida, regreso, objeto, correo, lineas: [[fecha, concepto, ciudad, valor]] }
// Archivo del viaje: solo la hoja del formato (sin cédulas de otros, sin registro y sin copia del código)
function crearArchivoFormato_(ss, nombreArchivo, carpeta) {
  let nueva = null;
  try {
    nueva = SpreadsheetApp.create(nombreArchivo);
    try {
      nueva.setSpreadsheetLocale(ss.getSpreadsheetLocale());
      nueva.setSpreadsheetTimeZone(ZONA);
    } catch (err) {}
    const f = hojaFormato_(ss).copyTo(nueva);
    nueva.getSheets().forEach(function (h) { if (h.getSheetId() !== f.getSheetId()) nueva.deleteSheet(h); });
    f.setName('Formato');
    DriveApp.getFileById(nueva.getId()).moveTo(carpeta);
    return nueva;
  } catch (err) {
    // Plan B: copiar el archivo completo y dejarle solo el formato
    console.error('No se pudo crear el archivo liviano; se usa la copia completa: ' + err);
    if (nueva) { try { DriveApp.getFileById(nueva.getId()).setTrashed(true); } catch (e2) {} }
    const css = SpreadsheetApp.openById(DriveApp.getFileById(ss.getId()).makeCopy(nombreArchivo, carpeta).getId());
    const f = hojaFormato_(css);
    css.getNamedRanges().forEach(function (nr) { nr.remove(); });
    css.getSheets().forEach(function (h) { if (h.getSheetId() !== f.getSheetId()) css.deleteSheet(h); });
    f.setName('Formato');
    return css;
  }
}

// Crea el formato del viaje en la carpeta del proyecto y avisa al jefe.
// s: { trab, proy, ciudad, salida, regreso, objeto, lineas: [[fecha, concepto, ciudad, valor]], notas: [observación de cada línea] }
function crearSolicitud_(s) {
  const props = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  zonaColombia_(ss);
  const trab = s.trab, proy = s.proy, lineas = s.lineas, viajan = s.viajan || [];
  const resp = s.resp || { nombre: trab.nombre, cedula: trab.cedula }; // quien recibe y responde por el anticipo
  intentar_(function () { presupuesto_(ss); }); // por si el proyecto es nuevo y aún no está en "Presupuesto"
  const conceptos = leerConceptos_(ss);
  const hoy = new Date();
  const totalSolicitado = lineas.reduce(function (t, l) { return t + l[3]; }, 0);
  // Observaciones escritas por el trabajador, una por concepto: "Alimentación (14/10, $ 100.000): motivo"
  const notas = [];
  lineas.forEach(function (l, i) {
    const nota = (s.notas && s.notas[i]) || '';
    if (nota) notas.push(l[1] + ' (' + fmt_(l[0], 'dd/MM') + ', ' + pesos_(l[3]) + '): ' + nota);
  });

  const id = siguienteId_(ss);

  // Carpeta del viaje dentro de la carpeta del proyecto
  const carpeta = carpetaProyecto_(ss, proy.nombre).createFolder(limpiarNombre_(id + ' ' + fmt_(hoy, 'dd-MM') + ' ' + trab.nombre));
  let css = null;
  try {
    css = crearArchivoFormato_(ss, limpiarNombre_(proy.nombre + ' - Viaticos ' + fmt_(hoy, 'dd-MM') + ' - ' + s.objeto + ' - ' + trab.nombre + ' (' + id + ')'), carpeta);
    const f = hojaFormato_(css);
    const fi = filaIni_(f), ff = fi + N_FILAS - 1, m0 = mapa_(f); // por si el formato maestro tiene filas de más

    // Si la plantilla ya trae la columna "Observaciones" en SOLICITUD DE VIÁTICOS, todo lo que está a la
    // derecha de "Valor solicitado" va una columna más allá. Si no la trae, se agrega al final.
    const oT = desfase_(f);
    const P = function (a1) { return desplazar_(a1, oT); };
    f.getRangeList(['E10', P('J10'), 'E11', P('J11'), 'E12', P('J12'), 'E13', P('J13'), 'E14', P('J15'), 'E16', P('J16'),
      P('C' + fi + ':K' + ff), m0.notas]).clearContent();
    // Sin reglas que rechacen datos: el control lo hace la app, y así una regla no puede frenar la escritura
    f.getRangeList(['E10', P('C' + fi + ':K' + ff)]).clearDataValidations();
    f.getRange('E10').setValue(trab.nombre);
    f.getRange(P('J10')).setValue(trab.cedula);
    f.getRange('E11').setValue(trab.cargo);
    f.getRange(P('J11')).setValue(trab.area);
    f.getRange('E12').setValue(proy.nombre);
    f.getRange(P('J12')).setValue(s.ciudad);
    f.getRange('E13').setValue(s.salida);
    f.getRange(P('J13')).setValue(s.regreso);
    f.getRange('E14').setValue(s.objeto);
    f.getRange(P('J15')).setValue(hoy);
    casillaResponsable_(f, P);
    f.getRange('E16').setValue(resp.nombre);
    f.getRange(P('J16')).setValue(resp.cedula || '');
    f.getRange(m0.jefeNombre).setValue('Nombre:');
    f.getRange(m0.jefeCedula).setValue('C.C.:');
    f.getRange(fi, 3, lineas.length, 4).setValues(lineas);
    const pie = [];
    if (viajan.length) pie.push('Técnicos que viajan: ' + viajan.join(', '));
    if (pie.length) f.getRange(m0.notas).setValue(pie.join('\n')).setWrap(true);
    f.getRange(fi, 7 + oT, N_FILAS, 1).setNumberFormat('@');
    const listaConceptos = SpreadsheetApp.newDataValidation().requireValueInList(conceptos, true).setAllowInvalid(true).build();
    f.getRange(fi, 4, N_FILAS, 1).setDataValidation(listaConceptos);
    f.getRange(fi, 9 + oT, N_FILAS, 1).setDataValidation(listaConceptos);
    asegurarColQuien_(f, mapa_(f));
    // Observación de cada concepto, en su misma fila dentro de SOLICITUD DE VIÁTICOS (columna G)
    if (oT) f.getRange(fi, 7, N_FILAS, 1).setNumberFormat('@').setWrap(true);
    else agregarColObsSolicitud_(f, N_FILAS);
    f.getRange(fi, 7, lineas.length, 1).setValues(lineas.map(function (l, i) { return [(s.notas && s.notas[i]) || '']; }));
    if (s.directa) firmar_(f, mapa_(f).firmaJefe, 'Entrega registrada por ' + s.directa.yo.nombre + ' (' + s.directa.yo.correo + ')', false);
    else firmar_(f, mapa_(f).firmaTrab, 'Firmado electrónicamente por ' + trab.correo, false);
    casillasExtra_(f, s.extra || []);
    bloqueControl_(f);
    SpreadsheetApp.flush();
  } catch (err) {
    // Si el archivo quedó a medias, se retira para no dejar carpetas huérfanas ni datos sueltos
    try { carpeta.setTrashed(true); } catch (e2) {}
    throw err;
  }

  try { carpeta.addViewer(trab.correo); } catch (err) {}

  const fila = [];
  fila[C.id - 1] = id;
  fila[C.fecha - 1] = hoy;
  fila[C.trab - 1] = trab.nombre;
  fila[C.ced - 1] = trab.cedula;
  fila[C.proy - 1] = proy.nombre;
  fila[C.dest - 1] = s.ciudad;
  fila[C.sal - 1] = s.salida;
  fila[C.reg - 1] = s.regreso;
  fila[C.obj - 1] = s.objeto;
  fila[C.solic - 1] = totalSolicitado;
  fila[C.legal - 1] = 0;
  fila[C.reint - 1] = totalSolicitado;
  fila[C.favor - 1] = 0;
  fila[C.nsop - 1] = 0;
  fila[C.estado - 1] = s.directa ? 'Aprobado' : 'Solicitado'; // la entrega directa ya está entregada
  fila[C.obs - 1] = s.directa ? 'Entrega directa registrada por tesorería / gerencia' : '';
  fila[C.fdec - 1] = s.directa ? s.directa.fecha : '';
  fila[C.formato - 1] = css.getUrl();
  fila[C.carpeta - 1] = carpeta.getUrl();
  fila[C.correo - 1] = trab.correo;
  fila[C.idFormato - 1] = css.getId();
  fila[C.idCarpeta - 1] = carpeta.getId();
  fila[C.por - 1] = s.directa ? s.directa.yo.correo : '';
  fila[C.notas - 1] = notas.join('\n');
  fila[C.viajan - 1] = viajan.join(', ');
  fila[C.resp - 1] = resp.nombre;
  fila[C.extra - 1] = (s.extra || []).filter(function (c) { return c[1]; }).map(function (c) { return c[0] + ': ' + c[1]; }).join('\n');
  const hojaReg = ss.getSheetByName(HOJA_REG);
  [C.resp, C.extra].forEach(function (col) { // hoja instalada antes de estas columnas
    if (String(hojaReg.getRange(1, col).getValue()) !== REG[col - 1]) {
      hojaReg.getRange(1, col).setValue(REG[col - 1]).setFontWeight('bold').setBackground(NEGRO).setFontColor('#ffffff');
    }
  });
  intentar_(function () { hojaEnt_(ss); }); // si la hoja no existía, se arma con lo anterior (sin esta fila)
  hojaReg.appendRow(fila);
  if (s.directa) {
    hojaEnt_(ss).appendRow(['E-' + id + '-1', s.directa.fecha, id, proy.nombre, resp.nombre, totalSolicitado, 'Entrega directa (sin solicitud previa)', 'Entregado',
      s.directa.yo.correo, s.directa.medio, s.directa.comp]);
    intentar_(function () { llenarEntregado_(hojaFormato_(css), fila); });
  } else {
    intentar_(function () { nuevaEntrega_(ss, id, proy.nombre, resp.nombre, totalSolicitado, 'Anticipo inicial'); });
  }
  intentar_(function () { llenarControl_(ss, fila, hojaFormato_(css)); });

  const resumen = tabla_([
    ['ID', id], ['Trabajador', trab.nombre], ['Proyecto', proy.nombre], ['Destino', s.ciudad],
    ['Salida', fmt_(s.salida)], ['Regreso', fmt_(s.regreso)], ['Objeto del viaje', s.objeto],
    ['Técnicos que viajan', viajan.length ? viajan.join(', ') : 'Ninguno'],
    ['Técnico responsable del dinero', resp.nombre + (resp.cedula ? ' (C.C. ' + resp.cedula + ')' : '')],
    ['Valor solicitado', pesos_(totalSolicitado)]
  ].concat((s.extra || []).filter(function (c) { return c[1]; })).concat(lineas.map(function (l, i) {
    return ['   ' + l[1], pesos_(l[3]) + ((s.notas && s.notas[i]) ? ' — ' + s.notas[i] : '')];
  })));
  const app = appUrl_();
  if (s.directa) { // no hay nada que aprobar: solo se le avisa a quien recibió la plata
    correo_(trab.correo, 'Viáticos ' + id + ': te entregaron ' + pesos_(totalSolicitado) + ' para ' + proy.nombre,
      '<p>' + esc_(s.directa.yo.nombre) + ' registró que te entregó plata para el proyecto.</p>' + resumen +
      '<p><a href="' + css.getUrl() + '">Ver el formato</a></p>' +
      '<p>Relaciona los gastos con sus soportes en la app, pestaña <b>Legalización</b> (solicitud <b>' + id + '</b>).' +
      (app ? '<br><a href="' + enlaceGastos_(id) + '">Legalizar mis gastos</a>' : '') + '</p>');
    return { id: id, url: css.getUrl(), total: totalSolicitado };
  }
  const aprueban = aprobadores_(fila, leerTrabajadores_(ss), leerProyectos_(ss));
  if (!aprueban.length) avisarAdmin_('Solicitud ' + id + ' sin aprobador en la app', '<p>' + esc_(trab.nombre) +
    ' pidió viáticos y, por el conducto regular, nadie puede aprobarla en la app (por ejemplo, es una solicitud del gerente). ' +
    'Decídela en la pestaña <b>Registro</b>, columna Estado.</p>' + resumen);
  aprueban.forEach(function (a) {
    correo_(a.correo, 'Viáticos por aprobar ' + id + ' - ' + proy.nombre + ' - ' + trab.nombre,
      '<p>Hay una solicitud de viáticos por revisar.</p>' + resumen +
      '<p><a href="' + css.getUrl() + '">Ver el formato</a></p>' +
      '<p>Para aprobar y entregar la plata (o rechazar), entra a la app de viáticos con tu correo y tu clave, pestaña <b>Entrega</b>.' +
      (app ? '<br><a href="' + app + '?vista=aprobar">Abrir la app</a>' : '') + '</p>');
  });
  correo_(trab.correo, 'Solicitud de viáticos ' + id + ' registrada',
    '<p>Tu solicitud quedó registrada.</p>' + resumen +
    '<p><a href="' + css.getUrl() + '">Ver tu formato</a></p>' +
    '<p>Durante el viaje, registra cada recibo con su foto en la app (solicitud <b>' + id + '</b>).' +
    (app ? '<br><a href="' + enlaceGastos_(id) + '">Legalizar mis gastos</a>' : '') + '</p>');
  return { id: id, url: css.getUrl(), total: totalSolicitado };
}

// Solicitud enviada desde la app. Todo llega del celular, así que todo se valida aquí otra vez.
function appCrearSolicitud(token, p) {
  const trab = sesion_(token); // la solicitud siempre queda a nombre de quien entró
  const candado = candado_();
  try {
    p = p || {};
    const cache = CacheService.getScriptCache();
    const uid = String(p.uid || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 60);
    const previa = uid ? cache.get('US_' + uid) : null;
    if (previa) return JSON.parse(previa); // reintento de un envío que sí había llegado: no se duplica

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const proy = buscar_(leerProyectos_(ss), p.proyecto || '');
    if (!proy) throw new Error('Elige un proyecto de la lista.');
    if (!puedeUsar_(proy, trab)) throw new Error('Ese proyecto no está asignado a ti. Pide a administración que te lo asigne.');
    const ciudad = txt_(p.ciudad, 80);
    const objeto = txt_(p.objeto, 120);
    if (!ciudad || !objeto) throw new Error('Escribe la ciudad de destino y el objeto del viaje.');
    const salida = aFecha_(p.salida);
    const regreso = aFecha_(p.regreso);
    if (!salida || !regreso) throw new Error('Revisa las fechas de salida y de regreso.');
    if (regreso.getTime() < salida.getTime()) throw new Error('La fecha de regreso no puede ser anterior a la de salida.');
    if (regreso.getTime() - salida.getTime() > 90 * 86400000) throw new Error('El viaje no puede durar más de 90 días. Revisa las fechas.');
    if (salida.getTime() < Date.now() - 60 * 86400000) throw new Error('La fecha de salida es demasiado antigua. Revísala.');

    // Técnicos que viajan: solo personas del área técnica de la pestaña "Trabajadores"
    const delAreaTecnica = {};
    leerTrabajadores_(ss).forEach(function (t) { if (esTecnico_(t)) delAreaTecnica[t.nombre.toUpperCase()] = t.nombre; });
    const viajan = [];
    (Array.isArray(p.viajan) ? p.viajan : []).forEach(function (v) {
      const nombre = delAreaTecnica[norm_(v).toUpperCase()];
      if (!nombre) throw new Error('"' + txt_(v, 60) + '" no está en el área técnica.');
      if (viajan.indexOf(nombre) === -1) viajan.push(nombre);
    });

    const conceptos = leerConceptos_(ss);
    const lineas = [], notas = [];
    (p.lineas || []).forEach(function (l) {
      const valor = typeof l.valor === 'number' ? Math.round(l.valor) : aNumero_(l.valor);
      const concepto = norm_(l.concepto);
      if (!concepto && !valor) return;
      if (conceptos.indexOf(concepto) === -1) throw new Error('El concepto "' + concepto + '" no está en la lista.');
      if (!(valor > 0) || valor > VALOR_MAXIMO) throw new Error('Revisa el valor de "' + concepto + '".');
      let fecha = aFecha_(l.fecha) || salida;
      if (fecha.getTime() < salida.getTime() || fecha.getTime() > regreso.getTime()) fecha = salida;
      lineas.push([fecha, concepto, ciudad, valor]);
      notas.push(txt_(l.obs, 150)); // observación opcional de ese concepto
    });
    if (!lineas.length) throw new Error('Agrega al menos un concepto con su valor.');
    if (lineas.length > N_FILAS) throw new Error('El formato admite máximo ' + N_FILAS + ' conceptos.');

    const reg = ss.getSheetByName(HOJA_REG);
    if (reg.getLastRow() >= 2) {
      const abiertas = reg.getRange(2, 1, reg.getLastRow() - 1, REG.length).getValues().filter(function (f) {
        return f[C.id - 1] && ABIERTOS.indexOf(f[C.estado - 1]) > -1 && esDe_(f, trab);
      }).length;
      // El ingeniero pide plata para varios técnicos a la vez: puede tener más solicitudes abiertas
      const tope = (esIngeniero_(trab) || esGerente_(trab)) ? 40 : 10;
      if (abiertas >= tope) throw new Error('Tienes ' + tope + ' solicitudes abiertas. Legaliza las anteriores antes de pedir otra.');
    }

    // Técnico responsable del dinero: una persona del área técnica (si no se elige, responde quien solicita)
    let resp = { nombre: trab.nombre, cedula: trab.cedula };
    if (norm_(p.responsable)) {
      const t = validarReceptor_(ss, proy.nombre, p.responsable, viajan);
      resp = { nombre: t.nombre, cedula: t.cedula };
    }

    // Casillas adicionales definidas en la pestaña "Casillas"
    const extra = leerCasillas_(ss).map(function (c) {
      const v = txt_(p.extra && typeof p.extra === 'object' ? p.extra[c.nombre] : '', 150);
      if (c.obligatoria && !v) throw new Error('Llena la casilla "' + c.nombre + '".');
      return [c.nombre, v];
    });

    const r = crearSolicitud_({ trab: trab, proy: proy, ciudad: ciudad, salida: salida, regreso: regreso, objeto: objeto, lineas: lineas, notas: notas, viajan: viajan, resp: resp, extra: extra });
    const res = { id: r.id, url: r.url, total: r.total, texto: [r.id, trab.nombre, proy.nombre, fmt_(salida, 'dd/MM')].join(' · ') };
    if (uid) cache.put('US_' + uid, JSON.stringify(res), 21600);
    return res;
  } finally {
    candado.releaseLock();
  }
}

// Agregar conceptos a una solicitud propia que todavía no han aprobado (estado "Solicitado").
// p = { id, uid, lineas: [{ concepto, fecha, valor, obs }] }. Se escriben en SOLICITUD DE VIÁTICOS del mismo formato.
function appAmpliarSolicitud(token, p) {
  const yo = sesion_(token);
  const candado = candado_();
  try {
    p = p || {};
    const cache = CacheService.getScriptCache();
    const uid = String(p.uid || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 60);
    const previa = uid ? cache.get('UA_' + uid) : null;
    if (previa) return JSON.parse(previa); // reintento: no se duplica

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reg = ss.getSheetByName(HOJA_REG);
    const id = String(p.id || '').trim();
    const d = filaPropia_(id, yo);
    const filaReg = filaRegistro_(reg, id);
    const estadoAntes = String(d[C.estado - 1]);
    if (['Solicitado', 'Aprobado'].indexOf(estadoAntes) === -1) {
      const como = { 'Rechazado': 'rechazada', 'En revisión': 'enviada a revisión', 'Legalizado': 'legalizada' }[estadoAntes] || 'decidida';
      throw new Error('La solicitud ' + d[C.id - 1] + ' ya fue ' + como +
        '. Solo se le pueden hacer adiciones mientras está pendiente o aprobada; haz una solicitud nueva.');
    }
    // A quién se le entrega la plata de esta adición (si no se dice, a quien recibió la última vez)
    const recibe = norm_(p.entregaA) ? validarReceptor_(ss, String(d[C.proy - 1]), p.entregaA, String(d[C.viajan - 1] || '').split(',')).nombre
      : (p.entregaA === '' ? String(d[C.trab - 1]) : String(d[C.resp - 1] || d[C.trab - 1])); // '' = a quien solicita
    const salida = d[C.sal - 1] instanceof Date ? d[C.sal - 1] : aFecha_(d[C.sal - 1]);
    const regreso = d[C.reg - 1] instanceof Date ? d[C.reg - 1] : aFecha_(d[C.reg - 1]);
    const ciudad = String(d[C.dest - 1] || '');
    const conceptos = leerConceptos_(ss);
    const lineas = [], notas = [];
    (p.lineas || []).forEach(function (l) {
      const valor = typeof l.valor === 'number' ? Math.round(l.valor) : aNumero_(l.valor);
      const concepto = norm_(l.concepto);
      if (!concepto && !valor) return;
      if (conceptos.indexOf(concepto) === -1) throw new Error('El concepto "' + concepto + '" no está en la lista.');
      if (!(valor > 0) || valor > VALOR_MAXIMO) throw new Error('Revisa el valor de "' + concepto + '".');
      let fecha = aFecha_(l.fecha) || salida;
      if (salida && regreso && (fecha.getTime() < salida.getTime() || fecha.getTime() > regreso.getTime())) fecha = salida;
      lineas.push([fecha, concepto, ciudad, valor]);
      notas.push(txt_(l.obs, 150));
    });
    if (!lineas.length) throw new Error('Agrega al menos un concepto con su valor.');

    const f = hojaFormato_(SpreadsheetApp.openById(d[C.idFormato - 1]));
    // Filas libres del bloque SOLICITUD (columnas C a F), después del último concepto ya escrito
    const libres = function () {
      const m = mapa_(f), v = f.getRange(m.fi, 3, m.n, 4).getValues();
      let ult = -1;
      v.forEach(function (r, i) { if (r.join('') !== '') ult = i; });
      return { m: m, desde: ult + 1, cupo: m.n - ult - 1 };
    };
    let lib = libres();
    while (lib.cupo < lineas.length) {
      if (!lib.m.encontrado || lib.m.n >= MAX_FILAS) throw new Error('El formato ya no tiene espacio para ' + lineas.length + ' conceptos más.');
      ampliarFormato_(f, lib.m);
      lib = libres();
    }
    f.getRange(lib.m.fi + lib.desde, 3, lineas.length, 4).setValues(lineas);
    if (lib.m.o) { // la columna "Observaciones" de la solicitud (G) existe en este formato
      f.getRange(lib.m.fi + lib.desde, 7, lineas.length, 1).setNumberFormat('@')
        .setValues(notas.map(function (n) { return [n]; }));
    }
    firmar_(f, lib.m.firmaTrab, 'Solicitud ampliada electrónicamente por ' + yo.correo, true);
    SpreadsheetApp.flush();
    actualizarTotales_(reg, filaReg, f);
    const agregadoAntes = lineas.reduce(function (t, l) { return t + l[3]; }, 0);
    // Si aún no la aprueban y ya hay una entrega pendiente para esa misma persona, se suma ahí; si no, entrega nueva
    const pend = leerEntregas_(ss).filter(function (e) { return e.sol === id && e.estado === 'Pendiente' && e.recibe.toUpperCase() === recibe.toUpperCase(); })[0];
    if (estadoAntes === 'Solicitado' && pend) hojaEnt_(ss).getRange(pend.fila, CE.valor).setValue(pend.valor + agregadoAntes);
    else nuevaEntrega_(ss, id, String(d[C.proy - 1]), recibe, agregadoAntes, estadoAntes === 'Aprobado' ? 'Adición (' + fmt_(new Date(), 'dd/MM') + ')' : 'Ampliación (' + fmt_(new Date(), 'dd/MM') + ')');
    // Si ya estaba aprobada, la adición vuelve a aprobación; lo ya entregado no cambia
    if (estadoAntes === 'Aprobado') reg.getRange(filaReg, C.estado).setValue('Solicitado');

    // Observaciones nuevas en Registro, con el mismo formato que al crear la solicitud
    const nuevas = [];
    lineas.forEach(function (l, i) { if (notas[i]) nuevas.push(l[1] + ' (' + fmt_(l[0], 'dd/MM') + ', ' + pesos_(l[3]) + '): ' + notas[i]); });
    if (nuevas.length) {
      const previo = String(reg.getRange(filaReg, C.notas).getValue() || '');
      reg.getRange(filaReg, C.notas).setValue((previo ? previo + '\n' : '') + nuevas.join('\n'));
    }
    const agregado = lineas.reduce(function (t, l) { return t + l[3]; }, 0);
    const total = Number(reg.getRange(filaReg, C.solic).getValue()) || 0;

    const resumen = tabla_([
      ['ID', id], ['Trabajador', d[C.trab - 1]], ['Proyecto', d[C.proy - 1]], ['Destino', ciudad],
      ['Se agregó', pesos_(agregado)], ['Se le entrega a', recibe], ['Nuevo total presupuestado', pesos_(total)]
    ].concat(lineas.map(function (l, i) { return ['   ' + l[1], pesos_(l[3]) + (notas[i] ? ' — ' + notas[i] : '')]; })));
    const fila = reg.getRange(filaReg, 1, 1, REG.length).getValues()[0];
    const aprueban = aprobadores_(fila, leerTrabajadores_(ss), leerProyectos_(ss));
    if (!aprueban.length) avisarAdmin_('Solicitud ' + id + ' ampliada (sin aprobador en la app)', '<p>' + esc_(yo.nombre) +
      ' agregó conceptos a su solicitud. Decídela en la pestaña <b>Registro</b>.</p>' + resumen);
    const app = appUrl_();
    aprueban.forEach(function (a) {
      correo_(a.correo, 'Viáticos por aprobar ' + id + ' (ampliada) - ' + d[C.proy - 1] + ' - ' + d[C.trab - 1],
        '<p>' + esc_(yo.nombre) + (estadoAntes === 'Aprobado' ? ' hizo una adición a su solicitud ya aprobada. Lo ya entregado no cambia; la adición necesita tu aprobación.</p>'
          : ' agregó conceptos a su solicitud, que sigue pendiente de tu aprobación.</p>') + resumen +
        '<p><a href="' + d[C.formato - 1] + '">Ver el formato</a></p>' +
        '<p>Para aprobar y entregar la plata (o rechazar), entra a la app de viáticos, pestaña <b>Entrega</b>.' +
        (app ? '<br><a href="' + app + '?vista=aprobar">Abrir la app</a>' : '') + '</p>');
    });
    const res = { id: id, url: String(d[C.formato - 1]), agregado: agregado, total: total, recibe: recibe, adicion: estadoAntes === 'Aprobado' };
    if (uid) cache.put('UA_' + uid, JSON.stringify(res), 21600);
    return res;
  } finally {
    candado.releaseLock();
  }
}

/* ================== 2) EL TRABAJADOR REGISTRA GASTOS ================== */

// Carpeta con el nombre del proyecto (la crea si todavía no existe)
function carpetaProyecto_(ss, proyNombre) {
  const raiz = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('ROOT_ID'));
  const nombre = limpiarNombre_(proyNombre) || 'Sin proyecto';
  const proy = buscar_(leerProyectos_(ss), proyNombre);
  if (proy && proy.carpetaId) {
    try { return DriveApp.getFolderById(proy.carpetaId); } catch (err) {}
  }
  const existentes = raiz.getFoldersByName(nombre);
  const carpeta = existentes.hasNext() ? existentes.next() : raiz.createFolder(nombre);
  if (proy) ss.getSheetByName(HOJA_PROY).getRange(proy.fila, 4, 1, 2).setValues([[carpeta.getUrl(), carpeta.getId()]]);
  return carpeta;
}

// El detalle del formato empieza en la fila 19 y termina justo antes de "TOTAL SOLICITADO".
// Como el formato puede crecer, las posiciones se calculan cada vez.
function mapa_(f) {
  const fi = filaIni_(f);
  let total = fi + N_FILAS, encontrado = false;
  try {
    const alto = Math.min(MAX_FILAS + 20, f.getMaxRows() - fi + 1);
    const celda = f.getRange(fi, 2, alto, 1).createTextFinder('^\\s*TOTAL (SOLICITADO|PRESUPUESTADO)\\s*:?\\s*$').useRegularExpression(true).findNext();
    if (celda) { total = celda.getRow(); encontrado = true; }
  } catch (err) { console.error(err); }
  const fin = total - 1;
  const o = desfase_(f); // 1 si el formato tiene la columna "Observaciones" en el bloque de solicitud
  const colJefe = String.fromCharCode(72 + o); // H, o I cuando existe esa columna
  return {
    fin: fin, n: fin - fi + 1, fi: fi, encontrado: encontrado, o: o,
    jefeNombre: colJefe + (total + 10), jefeCedula: colJefe + (total + 11), notas: 'B' + (total + 14),
    firmaTrab: 'B' + (total + 8), firmaJefe: colJefe + (total + 8) // líneas de firma del formato
  };
}

// Firma electrónica: correo de quien firma, con fecha y hora, sobre la línea de firma del formato
function firmar_(f, celda, texto, agregar) {
  const c = f.getRange(celda);
  const previo = agregar ? String(c.getValue() || '') : '';
  c.setValue((previo ? previo + '\n' : '') + texto + ' · ' + fmt_(new Date(), 'dd/MM/yyyy HH:mm'));
  intentar_(function () { c.setFontSize(8).setFontColor('#444444').setHorizontalAlignment('center').setVerticalAlignment('bottom').setWrap(true); });
}

// Los formatos nuevos llevan "Observaciones" en la columna G, dentro de SOLICITUD DE VIÁTICOS,
// y por eso la RELACIÓN DE GASTOS se corre una columna. Los formatos creados antes no la tienen.
// Al aprobar: a quién se le entrega el dinero. '' = a quien solicita; si no, un técnico de "Trabajadores".
// Queda en Registro (Técnico responsable del dinero) y en la casilla de la fila 16 del formato.
function entregarA_(ss, reg, filaReg, d, nombre) {
  const trabajadores = leerTrabajadores_(ss);
  const pedido = norm_(nombre).toUpperCase();
  let t = null;
  if (pedido) {
    t = validarReceptor_(ss, String(d[C.proy - 1]), nombre, String(d[C.viajan - 1] || '').split(','));
  } else {
    t = trabajadores.filter(function (x) { return x.nombre.toUpperCase() === String(d[C.trab - 1]).toUpperCase(); })[0] ||
      { nombre: String(d[C.trab - 1]), cedula: d[C.ced - 1] };
  }
  reg.getRange(filaReg, C.resp).setValue(t.nombre);
  intentar_(function () { cambiarReceptorPendiente_(ss, String(d[C.id - 1]), t.nombre); });
  intentar_(function () {
    const f = hojaFormato_(SpreadsheetApp.openById(d[C.idFormato - 1]));
    const o = desfase_(f), P = function (a1) { return desplazar_(a1, o); };
    casillaResponsable_(f, P);
    f.getRange('E16').setValue(t.nombre);
    f.getRange(P('J16')).setValue(t.cedula || '');
  });
}

// Bloque "CONTROL DEL PROYECTO" al final del formato (debajo de "Observaciones adicionales"):
//   Presupuesto del proyecto      | Gastado en el proyecto
//   Plata entregada a (trabajador)| Valor entregado
//   Legalización de gastos        | Por legalizar
// Se crea una vez (formato maestro al sincronizar, o el formato del viaje) y el código lo mantiene al día.
const TITULO_CONTROL = 'CONTROL DEL PROYECTO';
const ETIQUETAS_CONTROL = [
  ['Presupuesto del proyecto:', 'Gastado en el proyecto:'],
  ['Plata entregada a:', 'Valor entregado:'],
  ['Legalización de gastos:', 'Por legalizar:']
];
function filaControl_(f) {
  try {
    const c = f.getRange(1, 2, 80, 1).createTextFinder('^\\s*' + TITULO_CONTROL + '\\s*$').useRegularExpression(true).findNext();
    return c ? c.getRow() : 0;
  } catch (err) { return 0; }
}
function bloqueControl_(f) {
  const ya = filaControl_(f);
  if (ya) return ya;
  // Va al final del formato, después de "Observaciones adicionales": así no se mueve nada del formato oficial
  const m = mapa_(f), total = m.fin + 1, o = m.o;
  const P = function (a1) { return desplazar_(a1, o); };
  const r = total + 18;
  if (f.getMaxRows() < r + ETIQUETAS_CONTROL.length) f.insertRowsAfter(f.getMaxRows(), r + ETIQUETAS_CONTROL.length - f.getMaxRows());
  intentar_(function () {
    // mismo estilo del bloque "RESUMEN DE LA LEGALIZACIÓN" (título y filas)
    f.getRange('B' + (total + 2) + ':' + P('L' + (total + 2))).copyTo(f.getRange('B' + r + ':' + P('L' + r)), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    f.getRange('B' + r + ':' + P('L' + r)).setBackground('#1A1A1A').setFontColor('#FFB41D').setFontWeight('bold');
    ETIQUETAS_CONTROL.forEach(function (e, i) {
      const k = r + 1 + i;
      f.getRange('B' + (total + 3) + ':' + P('L' + (total + 3))).copyTo(f.getRange('B' + k + ':' + P('L' + k)), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      f.setRowHeight(k, 22);
    });
  });
  f.getRange('B' + r).setValue(TITULO_CONTROL);
  ETIQUETAS_CONTROL.forEach(function (e, i) {
    f.getRange('B' + (r + 1 + i)).setValue(e[0]);
    f.getRange(P('G' + (r + 1 + i))).setValue(e[1]);
  });
  return r;
}
// Llena el bloque con los datos del viaje (fila de Registro "d") y del proyecto
function llenarControl_(ss, d, f) {
  const r = filaControl_(f);
  if (!r) return;
  const o = desfase_(f), P = function (a1) { return desplazar_(a1, o); };
  const proy = String(d[C.proy - 1] || '');
  const presu = leerPresupuestos_(ss)[proy.toUpperCase()];
  let gastadoProy = 0;
  const hg = ss.getSheetByName(HOJA_GASTOS);
  if (hg && hg.getLastRow() >= 2) {
    hg.getRange(2, 5, hg.getLastRow() - 1, 5).getValues().forEach(function (x) {
      if (norm_(x[0]).toUpperCase() === proy.toUpperCase()) gastadoProy += Number(x[4]) || 0;
    });
  }
  const estado = String(d[C.estado - 1] || 'Solicitado');
  const ents = leerEntregas_(ss).filter(function (e) { return e.sol === String(d[C.id - 1]) && e.estado === 'Entregado'; });
  const entregada = ents.length > 0;
  const anticipo = ents.reduce(function (t, e) { return t + e.valor; }, 0), legal = Number(d[C.legal - 1]) || 0;
  const nombres = []; ents.forEach(function (e) { if (nombres.indexOf(e.recibe) === -1) nombres.push(e.recibe); });
  const quien = nombres.length ? nombres.join(', ') : String(d[C.resp - 1] || d[C.trab - 1] || '');
  const fijar = function (a1, v) {
    const c = f.getRange(a1);
    if (typeof v === 'number') c.setNumberFormat('$ #,##0'); else c.setNumberFormat('@');
    c.setValue(v);
  };
  fijar('E' + (r + 1), presu && presu.presupuesto ? presu.presupuesto : 'Sin presupuesto');
  fijar(P('J' + (r + 1)), gastadoProy);
  fijar('E' + (r + 2), quien);
  fijar(P('J' + (r + 2)), entregada ? anticipo : (estado === 'Rechazado' ? 'No se entregó (rechazada)' : 'Pendiente de aprobación'));
  fijar('E' + (r + 3), legal);
  fijar(P('J' + (r + 3)), entregada ? anticipo - legal : '');
}
// Cuando cambia el presupuesto, se actualizan los formatos abiertos de ese proyecto
function refrescarControlProyecto_(ss, nombreProyecto) {
  const reg = ss.getSheetByName(HOJA_REG);
  if (!reg || reg.getLastRow() < 2) return;
  let n = 0;
  reg.getRange(2, 1, reg.getLastRow() - 1, REG.length).getValues().forEach(function (d) {
    if (n >= 25 || !d[C.id - 1] || norm_(d[C.proy - 1]).toUpperCase() !== nombreProyecto.toUpperCase()) return;
    if (['Legalizado', 'Rechazado'].indexOf(d[C.estado - 1]) > -1) return;
    n++;
    intentar_(function () { llenarControl_(ss, d, hojaFormato_(SpreadsheetApp.openById(d[C.idFormato - 1]))); });
  });
}

// Fila 16 del formato: "Técnico responsable del dinero" (nombre y cédula de quien recibe el anticipo).
// Si la plantilla ya la trae, solo se llena; si no, se arma con el mismo estilo de la fila 14.
function casillaResponsable_(f, P) {
  if (!/responsable/i.test(String(f.getRange('B16').getValue()))) {
    intentar_(function () {
      f.setRowHeight(16, 21);
      f.getRange('B14:' + P('K14')).copyTo(f.getRange('B16:' + P('K16')), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      f.getRange('B16:D16').merge(); f.getRange('E16:' + P('G16')).merge();
      f.getRange(P('H16') + ':' + P('I16')).merge(); f.getRange(P('J16') + ':' + P('K16')).merge();
      f.getRange('E16').setBackground('#FFF7DC');
    });
    f.getRange('B16').setValue('Técnico responsable del dinero:');
    f.getRange(P('H16')).setValue('C.C. del responsable:');
  }
}

// La hoja maestra queda en hora de Colombia (así también se ven bien las fechas de Registro y Gastos)
function zonaColombia_(ss) {
  intentar_(function () { if (ss.getSpreadsheetTimeZone() !== ZONA) ss.setSpreadsheetTimeZone(ZONA); });
}

// Casillas adicionales: una por fila en la pestaña "Casillas" (A: nombre, B: obligatoria SÍ/NO, C: ayuda)
function leerCasillas_(ss) {
  const h = ss.getSheetByName(HOJA_CASILLAS);
  if (!h || h.getLastRow() < 2) return [];
  const vistas = {};
  return h.getRange(2, 1, Math.min(h.getLastRow() - 1, 50), 3).getValues().map(function (r) {
    return { nombre: norm_(r[0]).replace(/:\s*$/, ''), obligatoria: /^s/i.test(sinTildes_(r[1])), ayuda: norm_(r[2]) };
  }).filter(function (c) {
    if (!c.nombre || vistas[c.nombre.toUpperCase()]) return false;
    vistas[c.nombre.toUpperCase()] = true;
    return true;
  }).slice(0, MAX_CASILLAS);
}

// Escribe las casillas adicionales en el encabezado del formato, encima de la tabla, con el estilo de la fila 14.
// extra: [[nombre, valor], ...]. Las filas se insertan, así que todo lo de abajo (tabla, totales, firmas) baja junto.
function casillasExtra_(f, extra) {
  if (!extra.length) return;
  const titulo = filaIni_(f) - 2, o = desfase_(f);
  const P = function (a1) { return desplazar_(a1, o); };
  f.insertRowsBefore(titulo, extra.length);
  extra.forEach(function (c, i) {
    const r = titulo + i;
    intentar_(function () {
      f.setRowHeight(r, 21);
      f.getRange('B14:' + P('G14')).copyTo(f.getRange('B' + r + ':' + P('G' + r)), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      f.getRange('B' + r + ':D' + r).merge(); f.getRange('E' + r + ':' + P('G' + r)).merge();
      f.getRange('E' + r).setBackground('#FFF7DC').setWrap(true);
    });
    f.getRange('B' + r).setValue(c[0] + ':');
    f.getRange('E' + r).setNumberFormat('@').setValue(c[1]);
  });
}

// Formato con tres bloques: 1. PRESUPUESTADO (B:G) · 2. ENTREGADO (H:K) · 3. LEGALIZADO (L:P).
// Todo lo que en la plantilla original estaba de la G en adelante queda 5 columnas más a la derecha
// (1 por "Observaciones" y 4 por el bloque ENTREGADO). Los formatos anteriores siguen funcionando igual.
const ANCHO_ENTREGA = 4;
function desfase_(f) {
  const fi = filaIni_(f);
  if (String(f.getRange(fi - 1, 7).getValue()).trim() !== 'Observaciones') return 0;
  return /ENTREGADO/i.test(String(f.getRange(fi - 2, 8).getValue())) ? 1 + ANCHO_ENTREGA : 1;
}

// Convierte el formato maestro a los tres bloques (lo hace "Sincronizar"; no hay que tocar la hoja a mano)
function bloqueEntregado_(f) {
  // Propiedad FORMATO_CLASICO = 1: deja el formato de dos bloques (solicitud y relación de gastos)
  if (PropertiesService.getScriptProperties().getProperty('FORMATO_CLASICO') === '1') return false;
  if (desfase_(f) === 0) agregarColObsSolicitud_(f, mapa_(f).n);
  if (desfase_(f) !== 1) return false;
  const fi = filaIni_(f), m = mapa_(f), total = m.fin + 1;
  f.insertColumnsAfter(7, ANCHO_ENTREGA); // columnas H a K
  intentar_(function () {
    f.getRange(fi - 2, 12, total - fi + 3, 1).copyTo(f.getRange(fi - 2, 8, total - fi + 3, ANCHO_ENTREGA), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    f.getRange(fi - 2, 8, 1, ANCHO_ENTREGA).breakApart().merge();
    f.getRange(total, 8, 1, 3).breakApart().merge();
    f.getRange(fi, 8, m.n, ANCHO_ENTREGA).setBackground('#F2F2F2').setDataValidation(null);
    f.setColumnWidth(8, 95); f.setColumnWidth(9, 95); f.setColumnWidth(10, 190); f.setColumnWidth(11, 120);
  });
  f.getRange(fi - 2, 8).setValue('2. ENTREGADO');
  f.getRange(fi - 1, 8, 1, ANCHO_ENTREGA).setValues([['Fecha de entrega', 'N.° solicitud', 'Trabajador que recibió la plata', 'Valor entregado']]);
  f.getRange(total, 8).setValue('TOTAL ENTREGADO');
  f.getRange(total, 11).setFormula('=SUM(K' + fi + ':K' + m.fin + ')');
  intentar_(function () {
    f.getRange(fi, 8, m.n, 1).setNumberFormat('dd/mm/yyyy'); f.getRange(fi, 9, m.n, 2).setNumberFormat('@');
    f.getRange(fi, 11, m.n + 1, 1).setNumberFormat('$ #,##0');
  });
  // Nombres de los bloques, como en el control por proyecto
  f.getRange(fi - 2, 2).setValue('1. PRESUPUESTADO');
  f.getRange(fi - 2, 12).setValue('3. LEGALIZADO');
  f.getRange(fi - 1, 6).setValue('Valor presupuestado');
  f.getRange(fi - 1, 15).setValue('Valor legalizado');
  f.getRange(total, 2).setValue('TOTAL PRESUPUESTADO');
  if (/^Instructivo/i.test(String(f.getRange('B7').getValue()))) f.getRange('B7').setValue('Instructivo:  1) Seleccione su nombre en la lista desplegable: cédula, cargo y centro de costo se completan solos.  2) Antes del viaje diligencie el bloque 1. PRESUPUESTADO (fecha, concepto, ciudad y valor).  3) El bloque 2. ENTREGADO lo llena el sistema al aprobar: fecha, solicitud y a qué trabajador se le entregó la plata.  4) Al regresar, complete en 3. LEGALIZADO el soporte, el tercero, el concepto y el valor gastado.  5) Diligencie únicamente las casillas crema; las grises se calculan solas.');
  return true;
}

// Bloque ENTREGADO del formato del viaje: fecha, solicitud, a quién se le entregó la plata y cuánto
function llenarEntregado_(f, d) {
  if (desfase_(f) !== 1 + ANCHO_ENTREGA) return;
  const m = mapa_(f), fi = m.fi;
  const lista = leerEntregas_(SpreadsheetApp.getActiveSpreadsheet())
    .filter(function (e) { return e.sol === String(d[C.id - 1]) && e.estado === 'Entregado'; })
    .map(function (e) { return [e.fecha instanceof Date ? e.fecha : '', e.sol + (e.detalle && e.detalle !== 'Anticipo inicial' ? ' · ' + e.detalle : ''), e.recibe, e.valor]; });
  const filas = [];
  for (let i = 0; i < m.n; i++) filas.push(lista[i] || ['', '', '', '']);
  f.getRange(fi, 8, m.n, ANCHO_ENTREGA).setValues(filas);
}

// Primera fila de la tabla: dos filas debajo del título "SOLICITUD DE VIÁTICOS" (columna B)
function filaIni_(f) {
  try {
    const c = f.getRange(1, 2, 80, 1).createTextFinder('^\\s*(SOLICITUD DE VI[AÁ]TICOS|(1\\.\\s*)?PRESUPUESTADO)\\s*$').useRegularExpression(true).findNext();
    if (c) return c.getRow() + 2;
  } catch (err) { console.error(err); }
  return FILA_INI;
}

// Corre una referencia A1 (o un rango) una columna a la derecha si está de la G en adelante
function desplazar_(a1, o) {
  if (!o) return a1;
  return String(a1).replace(/([A-Z]+)(\d+)/g, function (_, letras, fila) {
    const n = letras.split('').reduce(function (t, ch) { return t * 26 + ch.charCodeAt(0) - 64; }, 0);
    if (n < 7) return letras + fila;
    let m = n + o, s = '';
    while (m > 0) { const r = (m - 1) % 26; s = String.fromCharCode(65 + r) + s; m = Math.floor((m - 1) / 26); }
    return s + fila;
  });
}

function agregarColObsSolicitud_(f, n) {
  const fi = filaIni_(f);
  f.insertColumnAfter(6);
  intentar_(function () {
    f.getRange(fi - 2, 2, 1, 5).breakApart();  // el título "SOLICITUD DE VIÁTICOS" pasa a cubrir también la columna nueva
    f.getRange(fi - 2, 2, 1, 6).merge();
    f.setColumnWidth(7, 190);
  });
  f.getRange(fi - 1, 7).setValue('Observaciones');
  f.getRange(fi, 7, n, 1).clearDataValidations().setNumberFormat('@').setHorizontalAlignment('left').setWrap(true);
}

// Columna L del formato: quién registró cada gasto. Queda al lado de "Observaciones",
// fuera del área de impresión, para no alterar el formato oficial al imprimirlo.
const COL_QUIEN = 12;
function asegurarColQuien_(f, m) {
  const o = m.o || 0, col = COL_QUIEN + o;
  if (f.getMaxColumns() < col) f.insertColumnsAfter(f.getMaxColumns(), col - f.getMaxColumns());
  if (String(f.getRange(m.fi - 1, col).getValue()) !== '') return;
  intentar_(function () {
    f.getRange(m.fi - 1, 11 + o, m.n + 1, 1).copyTo(f.getRange(m.fi - 1, col, m.n + 1, 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    f.getRange(m.fi - 2, 7 + o).copyTo(f.getRange(m.fi - 2, col), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    f.setColumnWidth(col, 250);
  });
  f.getRange(m.fi - 2, col).setValue('CONTROL');
  f.getRange(m.fi - 1, col).setValue('Registrado por (correo, fecha y hora)');
}

// Agrega una fila al final del detalle (las sumas del formato se amplían solas). Devuelve su posición.
function ampliarFormato_(f, m) {
  f.insertRowBefore(m.fin);                                        // la última fila baja una posición
  const ancho = 11 + (m.o || 0);
  f.getRange(m.fin + 1, 2, 1, ancho).copyTo(f.getRange(m.fin, 2, 1, ancho)); // su contenido vuelve a su lugar
  f.getRange(m.fin + 1, 3, 1, ancho - 1).clearContent();                  // y queda una fila nueva en blanco al final
  f.getRange(m.fin + 1, 2).setValue(m.n + 1);
  SpreadsheetApp.flush();
  return m.n;
}

// Escribe un gasto en el formato del viaje. fuentes: [{ blob, ext }] con la foto o el PDF del soporte
function registrarGasto_(id, g, fuentes, estados) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reg = ss.getSheetByName(HOJA_REG);
  const filaReg = filaRegistro_(reg, id);
  if (!filaReg) return { ok: false, motivo: 'no_existe' };
  const d = reg.getRange(filaReg, 1, 1, REG.length).getValues()[0];
  if ((estados || ABIERTOS).indexOf(d[C.estado - 1]) === -1) return { ok: false, motivo: 'cerrada' };
  const carpeta = DriveApp.getFolderById(d[C.idCarpeta - 1]);
  const f = hojaFormato_(SpreadsheetApp.openById(d[C.idFormato - 1]));

  // Primera fila libre de RELACIÓN DE GASTOS (columnas G a K)
  const m = mapa_(f);
  asegurarColQuien_(f, m); // antes de ampliar: la fila nueva se copia con esa columna incluida
  const bloque = f.getRange(m.fi, 7 + m.o, m.n, 5).getValues();
  let libre = -1;
  for (let i = 0; i < bloque.length; i++) {
    if (bloque[i].join('') === '') { libre = i; break; }
  }
  if (libre === -1 && m.encontrado && m.n < MAX_FILAS) { // solo crece si ubicó bien dónde termina el detalle
    try { libre = ampliarFormato_(f, m); } catch (err) { console.error('No se pudo ampliar el formato: ' + err); }
  }
  const numero = libre > -1 ? libre + 1 : 'X';

  // Guardar los soportes en la carpeta del viaje (dentro de la carpeta del proyecto)
  const enlaces = [];
  fuentes.forEach(function (fu, i) {
    try {
      const archivo = carpeta.createFile(fu.blob);
      const ext = fu.ext || '';
      const sufijo = fuentes.length > 1 ? '_' + (i + 1) : '';
      archivo.setName(limpiarNombre_(d[C.proy - 1] + '_' + id + '_Soporte ' + numero + sufijo + '_' + g.concepto + '_' + g.valor) + ext);
      enlaces.push(archivo.getUrl());
    } catch (err) {
      console.error('Soporte ' + (i + 1) + ' de ' + id + ': ' + err);
    }
  });

  if (libre === -1) {
    const celdaNotas = f.getRange(mapa_(f).notas);
    const nota = String(celdaNotas.getValue());
    celdaNotas.setValue((nota ? nota + '\n' : '') + 'Gasto sin espacio en el formato: ' + fmt_(g.fecha) +
      ', ' + g.concepto + ', ' + g.tercero + ', ' + pesos_(g.valor) + '.');
    return { ok: false, motivo: 'lleno' };
  }

  const filaFmt = m.fi + libre;
  const partesObs = [fmt_(g.fecha)];
  if (g.factura) partesObs.push('Factura contable N.° ' + g.factura);
  if (g.obs) partesObs.push(g.obs);
  if (!enlaces.length) partesObs.push('Sin foto del soporte');
  if (enlaces.length > 1) partesObs.push(enlaces.length + ' fotos en la carpeta');

  const celdaSoporte = f.getRange(filaFmt, 7 + m.o).setNumberFormat('@');
  const textoSoporte = g.nSoporte || (enlaces.length ? 'Ver soporte' : 'Sin n.°');
  if (enlaces.length) {
    celdaSoporte.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(textoSoporte).setLinkUrl(enlaces[0]).build());
  } else {
    celdaSoporte.setValue(textoSoporte);
  }
  f.getRange(filaFmt, 8 + m.o, 1, 4).setValues([[g.tercero, g.concepto, g.valor, partesObs.join('. ')]]);
  f.getRange(filaFmt, COL_QUIEN + m.o).setValue((g.por || 'Sin identificar') + ' · ' + fmt_(new Date(), 'dd/MM/yyyy HH:mm'));
  SpreadsheetApp.flush();

  // Bitácora de gastos (alimenta el tablero y la app)
  if (!ss.getSheetByName(HOJA_GASTOS)) asegurarHojas_(ss);
  const hg = ss.getSheetByName(HOJA_GASTOS);
  hg.appendRow([
    id, new Date(), g.fecha, d[C.trab - 1], d[C.proy - 1], g.concepto, g.tercero, g.nSoporte,
    g.valor, g.obs, enlaces.join('\n'), numero
  ]);
  const fg = hg.getLastRow();
  hg.getRange(fg, 14).setValue(g.por || '');
  if (g.factura) hg.getRange(fg, 15).setNumberFormat('@').setValue(g.factura);
  if (String(hg.getRange(1, 15).getValue()) !== GAS[14]) hg.getRange(1, 15).setValue(GAS[14]).setFontWeight('bold').setBackground(NEGRO).setFontColor('#ffffff');
  hg.getRange(fg, 13).setFormula(formulaAcumulado_(fg)); // lo que lleva gastado esa solicitud hasta este gasto

  actualizarTotales_(reg, filaReg, f);
  return { ok: true, numero: numero };
}

const MOTIVOS = {
  no_existe: 'No se encontró la solicitud de viáticos. Primero llena la solicitud.',
  cerrada: 'Esta solicitud ya no recibe gastos (está en revisión, legalizada o rechazada).',
  lleno: 'Esta solicitud llegó al máximo de gastos. Este quedó anotado en "Observaciones adicionales"; para más gastos crea otra solicitud.'
};

/* ============== ACCESO RESTRINGIDO POR CORREO ============== */
// Solo entran a la app los correos escritos en la columna E de "Trabajadores".
// La primera vez cada persona confirma su correo con un código y crea su propia clave;
// después entra con correo y clave, y solo ve sus propias solicitudes.

function trabajadorPorCorreo_(ss, correo) {
  const c = String(correo || '').trim().toLowerCase();
  if (!c) return null;
  const lista = leerTrabajadores_(ss);
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].correo === c) return lista[i];
  }
  return null;
}

// Huella SHA-256 en hexadecimal (para no guardar tal cual ni las claves ni las llaves de sesión)
function hex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function sha_(texto) {
  return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(texto), Utilities.Charset.UTF_8));
}

// Cierra las sesiones abiertas de un correo (al cambiarle la clave) y de paso borra las vencidas
function limpiarSesiones_(correo) {
  const props = PropertiesService.getScriptProperties();
  const ahora = Date.now();
  const todas = props.getProperties();
  Object.keys(todas).forEach(function (k) {
    if (k.indexOf('S_') !== 0) return;
    let s = {};
    try { s = JSON.parse(todas[k]); } catch (err) {}
    if (!(s.exp > ahora) || (correo && s.correo === correo)) props.deleteProperty(k);
  });
}

function crearSesion_(correo) {
  limpiarSesiones_('');
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('S_' + sha_(token),
    JSON.stringify({ correo: correo, exp: Date.now() + DIAS_SESION * 86400000 }));
  return token;
}

// Devuelve el trabajador dueño de la sesión, o lanza un error que la app reconoce
function sesion_(token) {
  let correo = '';
  const bruto = token ? PropertiesService.getScriptProperties().getProperty('S_' + sha_(token)) : null;
  if (bruto) {
    try { const s = JSON.parse(bruto); if (s.exp > Date.now()) correo = s.correo; } catch (err) {}
  }
  const yo = trabajadorPorCorreo_(SpreadsheetApp.getActiveSpreadsheet(), correo);
  if (!yo) throw new Error('SESION: Tu sesión terminó. Entra de nuevo con tu correo.');
  return yo;
}

// ¿La fila de "Registro" es de este trabajador?
function esDe_(fila, yo) {
  const correo = String(fila[C.correo - 1]).trim().toLowerCase();
  if (correo) return correo === yo.correo;           // lo normal: el correo con el que se hizo la solicitud
  return norm_(fila[C.trab - 1]).toUpperCase() === yo.nombre.toUpperCase(); // filas antiguas sin correo
}

// Solicitud del trabajador o de alguien a quien yo apruebo (conducto regular), mientras no esté legalizada.
// Devuelve { d: fila de Registro, propia: true/false }
function filaAccesible_(id, yo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reg = ss.getSheetByName(HOJA_REG);
  const filaReg = filaRegistro_(reg, id);
  if (!filaReg) throw new Error(MOTIVOS.no_existe);
  const d = reg.getRange(filaReg, 1, 1, REG.length).getValues()[0];
  if (esDe_(d, yo)) return { d: d, propia: true };
  if (norm_(d[C.resp - 1]).toUpperCase() === yo.nombre.toUpperCase() || recibioDe_(ss, yo)[String(d[C.id - 1])]) { // la plata se le entregó a él: él la legaliza
    if (ABIERTOS.indexOf(d[C.estado - 1]) > -1) return { d: d, propia: false, resp: true };
    throw new Error(MOTIVOS.cerrada);
  }
  if (esAprobadorDe_(d, yo, leerTrabajadores_(ss), leerProyectos_(ss))) {
    if (ABIERTOS_APROBADOR.indexOf(d[C.estado - 1]) > -1) return { d: d, propia: false };
    throw new Error(MOTIVOS.cerrada);
  }
  throw new Error('Esa solicitud es de otra persona.');
}

// A quién se le puede entregar plata en un proyecto: los técnicos que el ingeniero asignó al proyecto.
// Si el proyecto no tiene técnicos asignados, a cualquier técnico.
// Solicitudes en las que esta persona recibió plata (según la hoja Entregas), aunque la haya pedido otro
function recibioDe_(ss, yo) {
  const mias = {}, nombre = String(yo.nombre || '').toUpperCase();
  intentar_(function () {
    leerEntregas_(ss).forEach(function (e) { if (e.estado === 'Entregado' && String(e.recibe).toUpperCase() === nombre) mias[e.sol] = true; });
  });
  return mias;
}

function recibenPlata_(proy, trabajadores) {
  if (!proy) return [];
  return trabajadores.filter(function (t) {
    return esTecnico_(t) && ((!!t.correo && proy.asignados.indexOf(t.correo) > -1) || proy.asignados.indexOf(t.nombre.toLowerCase()) > -1);
  });
}
// viajan: técnicos que van en el viaje; cualquiera de ellos también puede ser el responsable del dinero
function validarReceptor_(ss, nombreProyecto, nombre, viajan) {
  const trabajadores = leerTrabajadores_(ss), pedido = norm_(nombre).toUpperCase();
  const t = trabajadores.filter(function (x) { return x.nombre.toUpperCase() === pedido; })[0];
  if (!t || !esTecnico_(t)) throw new Error('"' + txt_(nombre, 60) + '" no es del área técnica. El responsable del dinero debe ser un técnico.');
  const proy = buscar_(leerProyectos_(ss), nombreProyecto);
  const permitidos = recibenPlata_(proy, trabajadores);
  if (false && permitidos.indexOf(t) === -1) { // ya no se restringe: sirve cualquier técnico de la lista de Trabajadores
    throw new Error('A ' + t.nombre + ' no se le puede entregar plata en ' + (proy ? proy.nombre : 'este proyecto') +
      '. Pueden recibir: ' + permitidos.map(function (x) { return x.nombre; }).join(', ') + ' (el ingeniero a cargo las elige en la pestaña Presupuesto).');
  }
  return t;
}

function esAprobadorDe_(fila, yo, trabajadores, proyectos) {
  return aprobadores_(fila, trabajadores, proyectos).some(function (a) { return a.correo === yo.correo; });
}

// Plata entregada agrupada por trabajador: si a Calixto le entregaron 4 veces $100.000, debe relacionar $400.000.
// "mia": lo de quien entra. "equipo": lo de cada trabajador que esa persona puede ver (gerencia y administración: todos;
// el ingeniero: los de los proyectos a su cargo y los que él aprueba).
const ESTADOS_ENTREGADA = ['Aprobado', 'En revisión', 'Legalizado'];

// Cada entrega de plata queda en "Entregas": el anticipo inicial y cada adición al mismo presupuesto,
// con la persona que recibe la plata. Una solicitud puede tener varias entregas a personas distintas.
const HOJA_ENT = 'Entregas';
const ENT = ['ID entrega', 'Fecha', 'Solicitud', 'Proyecto', 'Recibe la plata', 'Valor', 'Detalle', 'Estado', 'Registrado por', 'Medio de pago', 'N.° comprobante'];
const CE = { id: 1, fecha: 2, sol: 3, proy: 4, recibe: 5, valor: 6, detalle: 7, estado: 8, por: 9, medio: 10, comp: 11 };
// Estados de una entrega: Pendiente (falta aprobar) · Por pagar (aprobada; falta que tesorería registre la entrega) · Entregado · Rechazado
function hojaEnt_(ss) {
  let h = ss.getSheetByName(HOJA_ENT);
  if (h) return h;
  h = ss.insertSheet(HOJA_ENT);
  h.getRange(1, 1, 1, ENT.length).setValues([ENT]).setFontWeight('bold').setBackground(NEGRO).setFontColor('#ffffff');
  h.setFrozenRows(1);
  intentar_(function () {
    [130, 130, 110, 240, 200, 120, 260, 110, 220, 130, 150].forEach(function (w, i) { h.setColumnWidth(i + 1, w); });
    h.getRange('B2:B').setNumberFormat('dd/mm/yyyy hh:mm'); h.getRange('F2:F').setNumberFormat('$ #,##0');
  });
  h.getRange('M1').setValue('Esta hoja la llena el sistema: una fila por cada entrega de plata (anticipo inicial, adiciones y lo que registra tesorería), con quién la recibe.')
    .setFontStyle('italic').setFontColor('#666666');
  // Solicitudes que ya existían: su entrega se arma con lo que hay en "Registro"
  const reg = ss.getSheetByName(HOJA_REG);
  if (reg && reg.getLastRow() >= 2) {
    const filas = [];
    reg.getRange(2, 1, reg.getLastRow() - 1, REG.length).getValues().forEach(function (d) {
      const estado = String(d[C.estado - 1]);
      if (!d[C.id - 1] || estado === 'Rechazado') return;
      const ok = ESTADOS_ENTREGADA.indexOf(estado) > -1;
      filas.push(['E-' + d[C.id - 1] + '-1', ok ? (d[C.fdec - 1] || d[C.fecha - 1]) : d[C.fecha - 1], String(d[C.id - 1]), String(d[C.proy - 1]),
        String(d[C.resp - 1] || d[C.trab - 1]), Number(d[C.solic - 1]) || 0, 'Anticipo inicial', ok ? 'Entregado' : 'Pendiente', ok ? String(d[C.por - 1] || '') : '', '', '']);
    });
    if (filas.length) h.getRange(2, 1, filas.length, ENT.length).setValues(filas);
  }
  return h;
}
function leerEntregas_(ss) {
  const h = hojaEnt_(ss);
  if (h.getLastRow() < 2) return [];
  return h.getRange(2, 1, h.getLastRow() - 1, ENT.length).getValues().map(function (r, i) {
    return { fila: i + 2, id: String(r[0]), fecha: r[1], sol: String(r[2]), proy: norm_(r[3]), recibe: norm_(r[4]), valor: Number(r[5]) || 0,
      detalle: String(r[6] || ''), estado: String(r[7] || ''), por: String(r[8] || ''), medio: String(r[9] || ''), comp: String(r[10] || '') };
  }).filter(function (e) { return e.sol; });
}
function nuevaEntrega_(ss, sol, proy, recibe, valor, detalle) {
  const h = hojaEnt_(ss);
  const n = leerEntregas_(ss).filter(function (e) { return e.sol === String(sol); }).length + 1;
  h.appendRow(['E-' + sol + '-' + n, new Date(), String(sol), String(proy), String(recibe), valor, detalle, 'Pendiente', '', '', '']);
}
// Pasa las entregas pendientes de una solicitud a "Entregado" (o "Rechazado"). Devuelve cuántas cambió.
function decidirEntregas_(ss, sol, estado, quien, recibe) {
  const h = hojaEnt_(ss);
  let n = 0;
  leerEntregas_(ss).forEach(function (e) {
    if (e.sol !== String(sol) || e.estado !== 'Pendiente') return;
    h.getRange(e.fila, CE.fecha).setValue(new Date());
    if (recibe) h.getRange(e.fila, CE.recibe).setValue(recibe);
    h.getRange(e.fila, CE.estado, 1, 2).setValues([[estado, quien || '']]);
    n++;
  });
  return n;
}
function cambiarReceptorPendiente_(ss, sol, recibe) {
  const h = hojaEnt_(ss);
  leerEntregas_(ss).forEach(function (e) { if (e.sol === String(sol) && (e.estado === 'Pendiente' || e.estado === 'Por pagar')) h.getRange(e.fila, CE.recibe).setValue(recibe); });
}
// Tesorería (o gerencia) registra: "le entregué a tal persona tanta plata para este proyecto".
// p = { sol, recibe, valor, fecha, medio, comprobante, uid }. Se descuenta de lo "Por pagar" de esa solicitud;
// si se entrega menos, el resto sigue por pagar; si no había nada por pagar, queda como una entrega más.
function appRegistrarEntrega(token, p) {
  const yo = sesion_(token);
  if (!registraEntregas_(yo)) throw new Error('Solo tesorería o gerencia registran las entregas de plata.');
  const candado = candado_();
  try {
    p = p || {};
    const cache = CacheService.getScriptCache();
    const uid = String(p.uid || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 60);
    if (uid && cache.get('UE_' + uid)) return appDatos(token);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!String(p.sol || '').trim()) throw new Error('Elige el viático abierto al que se le carga la entrega.');
    const reg = ss.getSheetByName(HOJA_REG), filaReg = filaRegistro_(reg, String(p.sol || ''));
    if (!filaReg) throw new Error('Elige la solicitud.');
    const d = reg.getRange(filaReg, 1, 1, REG.length).getValues()[0];
    // Viáticos activos: solicitados (aún sin aprobar), aprobados o en revisión. Legalizados o rechazados ya no reciben plata.
    if (['Solicitado', 'Aprobado', 'En revisión'].indexOf(String(d[C.estado - 1])) === -1) throw new Error('La solicitud ' + d[C.id - 1] + ' ya está ' + String(d[C.estado - 1]).toLowerCase() + '; no recibe más entregas.');
    const t = leerTrabajadores_(ss).filter(function (x) { return x.nombre.toUpperCase() === norm_(p.recibe).toUpperCase(); })[0];
    if (!t) throw new Error('Elige de la lista a quién se le entregó la plata.');
    const infoSol = (datosTesoreria_(ss, [d], yo, leerTrabajadores_(ss)) || { solicitudes: [] }).solicitudes[0];
    if (infoSol && infoSol.puedenRecibir.length && infoSol.puedenRecibir.map(function (x) { return x.toUpperCase(); }).indexOf(t.nombre.toUpperCase()) === -1) {
      throw new Error(t.nombre + ' no es técnico del proyecto ni viaja en ' + d[C.id - 1] + '. Pueden recibir: ' + infoSol.puedenRecibir.join(', ') + '.');
    }
    const valor = typeof p.valor === 'number' ? Math.round(p.valor) : aNumero_(p.valor);
    if (!(valor > 0) || valor > VALOR_MAXIMO) throw new Error('Escribe el valor entregado.');
    const fecha = aFecha_(p.fecha) || new Date();
    if (fecha.getTime() > Date.now() + 86400000) throw new Error('La fecha de entrega no puede ser futura.');
    const medio = txt_(p.medio, 40), comp = txt_(p.comprobante, 60);
    const h = hojaEnt_(ss), sol = String(d[C.id - 1]), proy = String(d[C.proy - 1]);
    let resta = valor;
    leerEntregas_(ss).filter(function (e) { return e.sol === sol && (e.estado === 'Por pagar' || e.estado === 'Pendiente'); }).forEach(function (e) {
      if (resta <= 0) return;
      if (resta >= e.valor) { // se paga completa (si se entregó más, el excedente se suma a esta entrega)
        const ultima = resta - e.valor < 1 || leerEntregas_(ss).filter(function (x) { return x.sol === sol && (x.estado === 'Por pagar' || x.estado === 'Pendiente'); }).length === 1;
        const v = ultima ? resta : e.valor;
        h.getRange(e.fila, CE.fecha, 1, 1).setValue(fecha);
        h.getRange(e.fila, CE.recibe, 1, 2).setValues([[t.nombre, v]]);
        h.getRange(e.fila, CE.estado, 1, 4).setValues([['Entregado', yo.correo, medio, comp]]);
        resta -= v;
      } else {                  // pago parcial: lo entregado queda aparte y el resto sigue por pagar
        h.getRange(e.fila, CE.valor).setValue(e.valor - resta);
        const n = leerEntregas_(ss).filter(function (x) { return x.sol === sol; }).length + 1;
        h.appendRow(['E-' + sol + '-' + n, fecha, sol, proy, t.nombre, resta, e.detalle + ' (parcial)', 'Entregado', yo.correo, medio, comp]);
        resta = 0;
      }
    });
    if (resta > 0) { // no había nada por pagar (o se entregó de más): entrega adicional
      const n = leerEntregas_(ss).filter(function (x) { return x.sol === sol; }).length + 1;
      h.appendRow(['E-' + sol + '-' + n, fecha, sol, proy, t.nombre, resta, 'Entrega registrada por tesorería', 'Entregado', yo.correo, medio, comp]);
    }
    reg.getRange(filaReg, C.resp).setValue(t.nombre);
    // Si el viático estaba solicitado (sin aprobar), entregar la plata lo deja aprobado; lo que falte queda por pagar
    const aprobadaAlEntregar = String(d[C.estado - 1]) === 'Solicitado';
    if (aprobadaAlEntregar) {
      reg.getRange(filaReg, C.estado).setValue('Aprobado');
      reg.getRange(filaReg, C.fdec).setValue(fecha);
      reg.getRange(filaReg, C.por).setValue(yo.correo);
      leerEntregas_(ss).forEach(function (e) { if (e.sol === sol && e.estado === 'Pendiente') h.getRange(e.fila, CE.estado).setValue('Por pagar'); });
    }
    SpreadsheetApp.flush();
    intentar_(function () {
      const f = hojaFormato_(SpreadsheetApp.openById(d[C.idFormato - 1])), dd = reg.getRange(filaReg, 1, 1, REG.length).getValues()[0];
      if (aprobadaAlEntregar) intentar_(function () { firmar_(f, mapa_(f).firmaJefe, 'Aprobado al entregar la plata: ' + yo.nombre + ' (' + yo.correo + ')', false); });
      llenarEntregado_(f, dd); llenarControl_(ss, dd, f);
    });
    marcarControl_(proy);
    // Aviso a quien pidió y a quien recibió (si tiene correo)
    const resumen = tabla_([['Solicitud', sol], ['Proyecto', proy], ['Se le entregó a', t.nombre], ['Valor', pesos_(valor)],
      ['Fecha', fmt_(fecha)], ['Medio de pago', medio || '—'], ['N.° comprobante', comp || '—'], ['Registró', yo.nombre]]);
    [String(d[C.correo - 1] || ''), t.correo].filter(function (c, i, l) { return c && l.indexOf(c) === i; }).forEach(function (c) {
      correo_(c, 'Viáticos ' + sol + ': entrega de ' + pesos_(valor) + ' a ' + t.nombre, '<p>Se registró la entrega de plata.</p>' + resumen +
        '<p>Quien recibió la plata la relaciona con sus soportes en la app, pestaña <b>Legalización</b>.</p>');
    });
    if (uid) cache.put('UE_' + uid, '1', 21600);
    return appDatos(token);
  } finally {
    candado.releaseLock();
  }
}

// Entrega directa: "le entregué a tal persona tanta plata para este proyecto", sin que nadie haya subido una solicitud.
// Se crea el formato del viaje a nombre de quien recibió (ya aprobado y entregado), para que él lo legalice en la app.
function entregaDirecta_(ss, yo, p) {
  const proy = buscar_(leerProyectos_(ss), p.proyecto || '');
  if (!proy) throw new Error('Elige el proyecto.');
  const t = leerTrabajadores_(ss).filter(function (x) { return x.nombre.toUpperCase() === norm_(p.recibe).toUpperCase(); })[0];
  if (!t) throw new Error('Elige de la lista a quién se le entregó la plata.');
  const valor = typeof p.valor === 'number' ? Math.round(p.valor) : aNumero_(p.valor);
  if (!(valor > 0) || valor > VALOR_MAXIMO) throw new Error('Escribe el valor entregado.');
  const fecha = aFecha_(p.fecha) || new Date();
  if (fecha.getTime() > Date.now() + 86400000) throw new Error('La fecha de entrega no puede ser futura.');
  if (fecha.getTime() < Date.now() - 120 * 86400000) throw new Error('La fecha de entrega es demasiado antigua. Revísala.');
  const conceptos = leerConceptos_(ss);
  const concepto = conceptos.indexOf(norm_(p.concepto)) > -1 ? norm_(p.concepto) : (conceptos.indexOf('Otros') > -1 ? 'Otros' : conceptos[0]);
  const para = txt_(p.para, 120) || 'Viáticos del proyecto';
  const regreso = new Date(fecha.getTime() + 30 * 86400000);
  const r = crearSolicitud_({
    trab: t, proy: proy, ciudad: txt_(p.destino, 80) || '—', salida: fecha, regreso: regreso, objeto: para,
    lineas: [[fecha, concepto, txt_(p.destino, 80) || '—', valor]], notas: ['Entregado por ' + yo.nombre + (p.medio ? ' · ' + txt_(p.medio, 40) : '') + (p.comprobante ? ' · ' + txt_(p.comprobante, 60) : '')],
    viajan: [], resp: { nombre: t.nombre, cedula: t.cedula }, extra: [],
    directa: { yo: yo, fecha: fecha, medio: txt_(p.medio, 40), comp: txt_(p.comprobante, 60) }
  });
  marcarControl_(proy.nombre); // el control del proyecto y el dashboard se actualizan
  return r;
}

// Tesorería / gerencia anula una entrega mal registrada (persona o valor equivocado). Lo que estaba dentro de lo
// aprobado vuelve a quedar "Por pagar" para registrarlo bien; lo que era de más queda "Anulada". Se corrige el formato.
function appAnularEntrega(token, idEntrega) {
  const yo = sesion_(token);
  if (!registraEntregas_(yo)) throw new Error('Solo tesorería o gerencia anulan entregas.');
  const candado = candado_();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), h = hojaEnt_(ss);
    const e = leerEntregas_(ss).filter(function (x) { return x.id === String(idEntrega) && x.estado === 'Entregado'; })[0];
    if (!e) throw new Error('Esa entrega ya no está registrada (actualiza la pantalla).');
    const reg = ss.getSheetByName(HOJA_REG), filaReg = filaRegistro_(reg, e.sol);
    const d = filaReg ? reg.getRange(filaReg, 1, 1, REG.length).getValues()[0] : null;
    if (d && ['Legalizado', 'Rechazado'].indexOf(String(d[C.estado - 1])) > -1) throw new Error('La solicitud ' + e.sol + ' ya está ' + String(d[C.estado - 1]).toLowerCase() + '.');
    const aprobado = d ? Number(d[C.solic - 1]) || 0 : 0;
    const otras = leerEntregas_(ss).filter(function (x) { return x.sol === e.sol && x.id !== e.id && ['Entregado', 'Por pagar', 'Pendiente'].indexOf(x.estado) > -1; })
      .reduce(function (t, x) { return t + x.valor; }, 0);
    const vuelve = d ? Math.max(0, Math.min(e.valor, aprobado - otras)) : 0;
    const nota = ' (anulada por ' + yo.nombre + ' ' + fmt_(new Date(), 'dd/MM HH:mm') + ': era a ' + e.recibe + ')';
    h.getRange(e.fila, CE.valor).setValue(vuelve || e.valor);
    h.getRange(e.fila, CE.detalle, 1, 5).setValues([[e.detalle + nota, vuelve ? 'Por pagar' : 'Anulada', yo.correo, '', '']]);
    if (vuelve && vuelve < e.valor) {
      const n = leerEntregas_(ss).filter(function (x) { return x.sol === e.sol; }).length + 1;
      h.appendRow(['E-' + e.sol + '-' + n, new Date(), e.sol, e.proy, e.recibe, e.valor - vuelve, e.detalle + nota, 'Anulada', yo.correo, '', '']);
    }
    if (d) {
      // El responsable del dinero vuelve a ser quien todavía tenga plata entregada (o el técnico que se había elegido)
      const quedan = leerEntregas_(ss).filter(function (x) { return x.sol === e.sol && x.estado === 'Entregado'; });
      if (quedan.length) reg.getRange(filaReg, C.resp).setValue(quedan[quedan.length - 1].recibe);
      else if (norm_(d[C.resp - 1]).toUpperCase() === e.recibe.toUpperCase()) {
        const pend = leerEntregas_(ss).filter(function (x) { return x.sol === e.sol && x.estado === 'Por pagar' && x.recibe.toUpperCase() !== e.recibe.toUpperCase(); })[0];
        const tec = String(d[C.viajan - 1] || '').split(',').map(norm_).filter(String)[0];
        reg.getRange(filaReg, C.resp).setValue(pend ? pend.recibe : (tec || d[C.trab - 1]));
      }
      SpreadsheetApp.flush();
      intentar_(function () {
        const f = hojaFormato_(SpreadsheetApp.openById(d[C.idFormato - 1])), dd = reg.getRange(filaReg, 1, 1, REG.length).getValues()[0];
        llenarEntregado_(f, dd); llenarControl_(ss, dd, f);
      });
    }
    marcarControl_(e.proy);
    return appDatos(token);
  } finally {
    candado.releaseLock();
  }
}

// Entregas de solicitudes que ya no existen en "Registro" (por ejemplo, si se cambió el número a mano): se quitan
function limpiarEntregasHuerfanas_(ss) {
  const reg = ss.getSheetByName(HOJA_REG), h = ss.getSheetByName(HOJA_ENT);
  if (!reg || !h || h.getLastRow() < 2) return [];
  const ids = {};
  if (reg.getLastRow() >= 2) reg.getRange(2, C.id, reg.getLastRow() - 1, 1).getValues().forEach(function (r) { ids[String(r[0]).trim()] = true; });
  const quitar = leerEntregas_(ss).filter(function (e) { return !ids[e.sol]; });
  quitar.map(function (e) { return e.fila; }).sort(function (a, b) { return b - a; }).forEach(function (f) { h.deleteRow(f); });
  return quitar.map(function (e) { return e.id + ' (' + e.sol + ', ' + pesos_(e.valor) + ', ' + e.recibe + ')'; });
}

// Lo que ve tesorería / gerencia para registrar entregas: solicitudes aprobadas con lo aprobado, lo entregado y lo por pagar
function datosTesoreria_(ss, filas, yo, trabajadores) {
  if (!registraEntregas_(yo)) return null;
  const ents = leerEntregas_(ss), sols = [], proyectos = leerProyectos_(ss);
  filas.forEach(function (f) {
    if (!f[C.id - 1] || ['Solicitado', 'Aprobado', 'En revisión'].indexOf(String(f[C.estado - 1])) === -1) return; // viáticos activos
    // Pueden recibir la plata: los técnicos del proyecto, los que viajan y quien pidió (no cualquier persona de la empresa)
    const pueden = [];
    const sumar = function (n) { n = norm_(n); if (n && pueden.map(function (x) { return x.toUpperCase(); }).indexOf(n.toUpperCase()) === -1) pueden.push(n); };
    String(f[C.viajan - 1] || '').split(',').forEach(sumar);
    trabajadores.filter(esTecnico_).forEach(function (t) { sumar(t.nombre); }); // cualquier técnico de la lista
    sumar(f[C.trab - 1]);
    const id = String(f[C.id - 1]), mias = ents.filter(function (e) { return e.sol === id; });
    const suma = function (est) { return mias.filter(function (e) { return e.estado === est; }).reduce(function (t, e) { return t + e.valor; }, 0); };
    const pp = mias.filter(function (e) { return (e.estado === 'Por pagar' || e.estado === 'Pendiente'); });
    sols.push({ id: id, proyecto: String(f[C.proy - 1]), solicitante: String(f[C.trab - 1]), objeto: String(f[C.obj - 1] || ''),
      aprobado: Number(f[C.solic - 1]) || 0, entregado: suma('Entregado'), porPagar: suma('Por pagar') + suma('Pendiente'), estado: String(f[C.estado - 1]),
      sugerido: pp.length ? pp[0].recibe : String(f[C.resp - 1] || f[C.trab - 1]), puedenRecibir: pueden });
  });
  sols.forEach(function (s) { if (!s.porPagar && !s.entregado) s.porPagar = s.aprobado; });
  sols.sort(function (a, b) { return b.porPagar - a.porPagar; });
  const recientes = ents.filter(function (e) { return e.estado === 'Entregado'; }).slice(-8).reverse()
    .map(function (e) { return { id: e.id, sol: e.sol, proyecto: e.proy, recibe: e.recibe, valor: e.valor, fecha: fmt_(e.fecha), medio: e.medio, comp: e.comp }; });
  return { solicitudes: sols, personas: trabajadores.map(function (t) { return t.nombre; }), recientes: recientes, conTesoreria: hayTesoreria_(trabajadores),
    proyectos: leerProyectos_(ss).map(function (x) { return x.nombre; }), conceptos: leerConceptos_(ss) };
}

// Entregas hechas, con la parte de lo legalizado que le toca a cada una (si una solicitud tiene varias
// entregas, lo legalizado se reparte en proporción a lo que recibió cada persona).
function entregasHechas_(filas, entregas) {
  const porSol = {};
  filas.forEach(function (f) { if (f[C.id - 1]) porSol[String(f[C.id - 1])] = f; });
  const totalSol = {};
  entregas.forEach(function (e) { if (e.estado === 'Entregado') totalSol[e.sol] = (totalSol[e.sol] || 0) + e.valor; });
  return entregas.filter(function (e) { return e.estado === 'Entregado' && porSol[e.sol]; }).map(function (e) {
    const f = porSol[e.sol], legal = Number(f[C.legal - 1]) || 0, estado = String(f[C.estado - 1]);
    const parte = totalSol[e.sol] ? Math.round(legal * e.valor / totalSol[e.sol]) : 0;
    return { sol: e.sol, proy: e.proy || norm_(f[C.proy - 1]), recibe: e.recibe, valor: e.valor, legalizado: parte, detalle: e.detalle,
      fecha: e.fecha, estadoSol: estado, falta: estado !== 'Legalizado' ? Math.max(e.valor - parte, 0) : 0, fila: f };
  });
}
function plataPorTrabajador_(filas, yo, proyectos, trabajadores) {
  const todo = esAdmin_(yo) || esGerente_(yo);
  const misProy = {};
  proyectos.forEach(function (p) { if (p.correo && p.correo === yo.correo) misProy[p.nombre.toUpperCase()] = true; });
  const grupos = {}, mia = { entregado: 0, legalizado: 0, porRelacionar: 0, entregas: [] };
  const hechas = entregasHechas_(filas, leerEntregas_(SpreadsheetApp.getActiveSpreadsheet()));
  hechas.forEach(function (x) {
    const e = { id: x.sol, proyecto: x.proy, fecha: fmt_(x.fecha, 'dd/MM'), valor: x.valor, legalizado: x.legalizado, falta: x.falta, estado: x.estadoSol, detalle: x.detalle };
    if (x.recibe.toUpperCase() === yo.nombre.toUpperCase()) {
      mia.entregado += x.valor; mia.legalizado += x.legalizado; mia.porRelacionar += x.falta; mia.entregas.push(e);
    }
    const ve = todo || misProy[x.proy.toUpperCase()] || esAprobadorDe_(x.fila, yo, trabajadores, proyectos);
    if (!ve) return;
    const k = x.recibe.toUpperCase(), gr = grupos[k] = grupos[k] || { nombre: x.recibe, entregado: 0, legalizado: 0, porRelacionar: 0, n: 0, proyectos: [] };
    gr.entregado += x.valor; gr.legalizado += x.legalizado; gr.porRelacionar += x.falta; gr.n++;
    if (gr.proyectos.indexOf(x.proy) === -1) gr.proyectos.push(x.proy);
  });
  mia.entregas.reverse();
  const equipo = Object.keys(grupos).map(function (k) { return grupos[k]; })
    .sort(function (a, b) { return b.porRelacionar - a.porRelacionar || b.entregado - a.entregado; });
  return { mia: mia, equipo: equipo };
}

function filaPropia_(id, yo) {
  const reg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_REG);
  const filaReg = filaRegistro_(reg, id);
  if (!filaReg) throw new Error(MOTIVOS.no_existe);
  const d = reg.getRange(filaReg, 1, 1, REG.length).getValues()[0];
  if (!esDe_(d, yo)) throw new Error('Esa solicitud es de otra persona.');
  return d;
}

function appEstado(token) {
  try {
    const yo = sesion_(token);
    return { token: String(token), correo: yo.correo, nombre: yo.nombre };
  } catch (err) {}
  // Si la cuenta de Google es de la misma organización, Google ya nos dice quién es
  let correoGoogle = '';
  try { correoGoogle = Session.getActiveUser().getEmail() || ''; } catch (err) {}
  const yo = trabajadorPorCorreo_(SpreadsheetApp.getActiveSpreadsheet(), correoGoogle);
  if (yo) return { token: crearSesion_(yo.correo), correo: yo.correo, nombre: yo.nombre };
  return { token: '', correoGoogle: correoGoogle };
}

function appPedirCodigo(correo) {
  const yo = trabajadorPorCorreo_(SpreadsheetApp.getActiveSpreadsheet(), correo);
  if (!yo) throw new Error('Ese correo no está autorizado. Pide a administración que lo registre en la lista de trabajadores.');
  const cache = CacheService.getScriptCache();
  if (cache.get('OTPE_' + yo.correo)) throw new Error('Ya te enviamos un código hace un momento. Revisa tu correo (también en spam) o espera un minuto.');
  const pedidos = Number(cache.get('OTPD_' + yo.correo) || 0);
  if (pedidos >= 5) throw new Error('Pediste demasiados códigos. Intenta en unas horas o pide a administración que te asigne la clave.');
  let cupo = 100;
  try { cupo = MailApp.getRemainingDailyQuota(); } catch (err) {}
  if (cupo < 5) throw new Error('El sistema llegó al límite de correos de hoy. Pide a administración que te asigne la clave.');

  // Si ya hay un código vigente se reenvía el mismo: nadie puede invalidarle el código a otra persona pidiendo más
  let o = null;
  try { o = JSON.parse(cache.get('OTP_' + yo.correo)); } catch (err) {}
  if (!o || !o.c) {
    o = { c: String(parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 8), 16) % 900000 + 100000), n: 0 };
    cache.put('OTP_' + yo.correo, JSON.stringify(o), 600);
  }
  cache.put('OTPE_' + yo.correo, '1', 60);
  cache.put('OTPD_' + yo.correo, String(pedidos + 1), 21600);
  MailApp.sendEmail({
    to: yo.correo,
    subject: 'Tu código para Viáticos Social Solar',
    htmlBody: '<p>Hola, ' + esc_(yo.nombre) + '.</p><p>Tu código para entrar a la app de viáticos es:</p>' +
      '<p style="font-size:28px;font-weight:bold;letter-spacing:4px">' + o.c + '</p>' +
      '<p>Con este código creas o cambias tu clave. Vence en 10 minutos. Si no lo pediste, ignora este correo.</p>'
  });
  return { ok: true };
}

// La clave nunca se guarda tal cual: solo una huella (SHA-256 con sal) que no permite leerla
function huella_(sal, clave, rondas) {
  let bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + String(clave), Utilities.Charset.UTF_8);
  for (let i = 1; i < (rondas || 1); i++) bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  return hex_(bytes);
}

const RONDAS_CLAVE = 300;
function guardarClave_(correo, clave) {
  const sal = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('K_' + correo, 'v2:' + sal + ':' + huella_(sal, clave, RONDAS_CLAVE));
  limpiarSesiones_(correo); // con clave nueva, las sesiones abiertas en otros celulares dejan de servir
}

function claveCorrecta_(guardada, clave) {
  if (!guardada) return false;
  const p = guardada.split(':');
  if (p[0] === 'v2') return huella_(p[1], clave, RONDAS_CLAVE) === p[2];
  return huella_(p[0], clave, 1) === p[1]; // claves guardadas con la versión anterior
}

// Entrada normal: correo y clave
function appEntrar(correo, clave) {
  const c = String(correo || '').trim().toLowerCase();
  const candado = candado_(); // el conteo de intentos no se puede saltar con llamadas simultáneas
  try {
    const cache = CacheService.getScriptCache();
    const intentos = Number(cache.get('INT_' + c) || 0);
    if (intentos >= 5) throw new Error('Demasiados intentos. Espera 10 minutos o usa "Primera vez u olvidé mi clave".');
    const yo = trabajadorPorCorreo_(SpreadsheetApp.getActiveSpreadsheet(), c);
    const guardada = yo ? PropertiesService.getScriptProperties().getProperty('K_' + yo.correo) : null;
    if (!claveCorrecta_(guardada, clave)) {
      cache.put('INT_' + c, String(intentos + 1), 600);
      throw new Error(yo && !guardada
        ? 'Todavía no has creado tu clave. Toca "Primera vez u olvidé mi clave".'
        : 'Correo o clave incorrectos.');
    }
    cache.remove('INT_' + c);
    return { token: crearSesion_(yo.correo), correo: yo.correo, nombre: yo.nombre };
  } finally {
    candado.releaseLock();
  }
}

// Primera vez u olvido: confirma el código que llegó al correo y deja creada la clave
function appVerificarCodigo(correo, codigo, claveNueva) {
  if (String(claveNueva || '').length < 6) throw new Error('La clave debe tener al menos 6 caracteres.');
  const c = String(correo || '').trim().toLowerCase();
  const candado = candado_();
  try {
    const cache = CacheService.getScriptCache();
    const bruto = cache.get('OTP_' + c);
    if (!bruto) throw new Error('El código venció. Pide uno nuevo.');
    const o = JSON.parse(bruto);
    if (o.n >= 5) { cache.remove('OTP_' + c); throw new Error('Demasiados intentos. Pide un código nuevo.'); }
    if (String(codigo || '').replace(/\D/g, '') !== o.c) {
      o.n++;
      cache.put('OTP_' + c, JSON.stringify(o), 600);
      throw new Error('Código incorrecto. Revísalo e intenta de nuevo.');
    }
    cache.remove('OTP_' + c);
    const yo = trabajadorPorCorreo_(SpreadsheetApp.getActiveSpreadsheet(), c);
    if (!yo) throw new Error('Ese correo ya no está autorizado.');
    guardarClave_(yo.correo, claveNueva);
    cache.remove('INT_' + c);
    return { token: crearSesion_(yo.correo), correo: yo.correo, nombre: yo.nombre };
  } finally {
    candado.releaseLock();
  }
}

function appSalir(token) {
  if (token) PropertiesService.getScriptProperties().deleteProperty('S_' + sha_(token));
  return { ok: true };
}

// Menú: el administrador le pone (o le cambia) la clave a un trabajador
function asignarClave() {
  const ui = soloAdmin_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const conCorreo = leerTrabajadores_(ss).filter(function (t) { return t.correo; });
  if (!conCorreo.length) {
    ui.alert('Primero escribe los correos en la columna E de la pestaña "Trabajadores".');
    return;
  }
  const r1 = ui.prompt('Asignar clave', 'Correo del trabajador (como está en la pestaña "Trabajadores"):\n\n' +
    conCorreo.map(function (t) { return t.nombre + ' - ' + t.correo; }).join('\n'), ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  const yo = trabajadorPorCorreo_(ss, r1.getResponseText());
  if (!yo) { ui.alert('Ese correo no está en la pestaña "Trabajadores".'); return; }
  const r2 = ui.prompt('Asignar clave', 'Clave para ' + yo.nombre + ' (mínimo 6 caracteres):', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  const clave = r2.getResponseText().trim();
  if (clave.length < 6) { ui.alert('La clave debe tener al menos 6 caracteres. No se cambió nada.'); return; }
  guardarClave_(yo.correo, clave);
  CacheService.getScriptCache().remove('INT_' + yo.correo);
  intentar_(function () {
    const tr = ss.getSheetByName(HOJA_TRAB);
    const col = colClave_(tr);
    const correos = tr.getRange(3, 5, 40, 1).getValues();
    for (let i = 0; col && i < correos.length; i++) {
      if (String(correos[i][0]).trim().toLowerCase() === yo.correo) tr.getRange(i + 3, col).setValue(CLAVE_OK);
    }
  });
  ui.alert('Clave asignada a ' + yo.nombre + '.\n\nEntrégasela en persona. Puede cambiarla en la app con "Primera vez u olvidé mi clave".');
}

/* ===================== APP WEB PARA EL CELULAR ===================== */

function doGet(e) {
  const id = (e && e.parameter && e.parameter.id) ? String(e.parameter.id).replace(/[^A-Za-z0-9-]/g, '') : '';
  const pedida = (e && e.parameter) ? String(e.parameter.vista || '') : '';
  const vista = ['solicitud', 'aprobar', 'proyectos'].indexOf(pedida) > -1 ? pedida : '';
  return HtmlService.createHtmlOutput(APP_HTML.replace('__ID_INICIAL__', id).replace('__VISTA_INICIAL__', vista))
    .setTitle('Viáticos - Social Solar')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function appUrl_() {
  const guardada = PropertiesService.getScriptProperties().getProperty('APP_URL');
  if (guardada) return guardada;
  try {
    const url = ScriptApp.getService().getUrl() || '';
    if (/\/exec$/.test(url)) return url;
  } catch (err) {}
  return '';
}

function enlaceGastos_(id) {
  const app = appUrl_();
  return app ? app + '?id=' + encodeURIComponent(id) : '';
}

function appDatos(token) {
  const yo = sesion_(token);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  intentar_(function () {
    const r0 = ss.getSheetByName(HOJA_REG);
    if (!r0 || r0.getLastRow() < 3) return;
    const ids = r0.getRange(2, C.id, r0.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]).trim(); }).filter(String);
    if (ids.length === new Set(ids).size) return; // lo normal: ningún número repetido
    const l = candado_();
    try { const c = repararDuplicados_(ss); if (c.length) avisarAdmin_('Números de solicitud repetidos corregidos', '<p>' + c.map(esc_).join('<br>') + '</p>'); }
    finally { l.releaseLock(); }
  });
  const reg = ss.getSheetByName(HOJA_REG);
  const filas = (reg && reg.getLastRow() >= 2) ? reg.getRange(2, 1, reg.getLastRow() - 1, REG.length).getValues() : [];
  const proyectos = leerProyectos_(ss), trabajadores = leerTrabajadores_(ss);
  const lista = [], recibi = recibioDe_(ss, yo);
  filas.forEach(function (f) {
    if (!f[C.id - 1]) return;
    const texto = [f[C.id - 1], f[C.trab - 1], f[C.proy - 1], fmt_(f[C.sal - 1], 'dd/MM')].join(' · ');
    if (ABIERTOS.indexOf(f[C.estado - 1]) > -1 && esDe_(f, yo)) {
      lista.push({ id: String(f[C.id - 1]), texto: texto });
    } else if (ABIERTOS.indexOf(f[C.estado - 1]) > -1 && (norm_(f[C.resp - 1]).toUpperCase() === yo.nombre.toUpperCase() || recibi[String(f[C.id - 1])])) {
      lista.push({ id: String(f[C.id - 1]), texto: texto + ' · plata a tu nombre', aMiNombre: true }); // me entregaron la plata: la legalizo yo
    } else if (ABIERTOS_APROBADOR.indexOf(f[C.estado - 1]) > -1 && !esDe_(f, yo) && esAprobadorDe_(f, yo, trabajadores, proyectos)) {
      // Las de las personas que yo apruebo: puedo agregarles gastos antes de legalizar
      lista.push({ id: String(f[C.id - 1]), texto: texto + (f[C.estado - 1] === 'En revisión' ? ' · en revisión' : ''), equipo: true });
    }
  });
  const equipos = {}, presu = leerPresupuestos_(ss), admin = esAdmin_(yo), lineasP = leerLineasPresupuesto_(ss);
  const entregasDe_ = {}; // por solicitud: cada entrega con su estado y quién la recibe
  leerEntregas_(ss).forEach(function (e) { (entregasDe_[e.sol] = entregasDe_[e.sol] || []).push({ recibe: e.recibe, valor: e.valor, detalle: e.detalle, estado: e.estado }); });
  proyectos.forEach(function (p) {
    if (!puedeUsar_(p, yo)) return;
    const prueba = []; prueba[C.correo - 1] = yo.correo; prueba[C.proy - 1] = p.nombre;
    const aprueba = aprobadores_(prueba, trabajadores, proyectos).map(function (a) { return a.nombre; });
    equipos[p.nombre] = {
      jefe: p.jefe, tecnicos: tecnicosDe_(p, trabajadores), aprueba: aprueba.length ? aprueba.join(' o ') : 'administración',
      presu: presu[p.nombre.toUpperCase()] || { presupuesto: null, entregado: 0, gastado: 0, por: '' }, // paso 1: presupuesto del proyecto
      aCargo: admin || (!!p.correo && p.correo === yo.correo),                                            // puede subir el presupuesto
      lineas: (lineasP[p.nombre.toUpperCase()] || []).map(function (l) { return { id: l.id, concepto: l.concepto, detalle: l.detalle, valor: l.valor }; }),
      recibenPlata: recibenPlata_(p, trabajadores).map(function (t) { return t.nombre; }), // a quién se le puede entregar plata
      control: urlControl_(p.nombre)                                                                         // formato del proyecto (presupuestado · entregado · legalizado)
    };
  });
  return {
    solicitudes: lista.reverse(),
    plata: plataPorTrabajador_(filas, yo, proyectos, trabajadores), // lo entregado a cada trabajador y lo que le falta relacionar
    libroControl: urlControl_(''), // el libro con todos los proyectos (presupuestado · entregado · legalizado)
    conceptos: leerConceptos_(ss),
    trabajadores: [{ nombre: yo.nombre, cargo: String(yo.cargo), area: String(yo.area) }],
    proyectos: proyectos.filter(function (p) { return puedeUsar_(p, yo); }).map(function (p) { return p.nombre; }),
    equipos: equipos,       // de cada proyecto que ve: quién aprueba y qué técnicos están encargados
    tecnicos: trabajadores.filter(esTecnico_).map(function (t) { return t.nombre; }), // área técnica: para elegir quiénes viajan
    casillas: leerCasillas_(ss), // casillas adicionales de la pestaña "Casillas"
    gestion: gestion_(proyectos, trabajadores, yo), // null si no puede crear proyectos ni asignar técnicos
    porAprobar: porAprobar_(ss, yo, filas), // null si la persona no es jefe de ningún proyecto
    tesoreria: datosTesoreria_(ss, filas, yo, trabajadores), // null si no registra entregas
    // Paso 2 (entrega) para quien no aprueba: cómo van sus viáticos y a quién se le entregó la plata
    misViaticos: filas.filter(function (f) { return f[C.id - 1] && esDe_(f, yo); }).slice(-10).reverse().map(function (f) {
      return {
        id: String(f[C.id - 1]), proyecto: String(f[C.proy - 1]), estado: String(f[C.estado - 1]), fecha: fmt_(f[C.fecha - 1], 'dd/MM'),
        solicitado: Number(f[C.solic - 1]) || 0, legalizado: Number(f[C.legal - 1]) || 0, entregadaA: String(f[C.resp - 1] || f[C.trab - 1] || ''),
        entregas: entregasDe_[String(f[C.id - 1])] || []
      };
    }),
    // Mis solicitudes que aún no aprueban: se les pueden agregar conceptos
    ampliables: filas.filter(function (f) { return f[C.id - 1] && ['Solicitado', 'Aprobado'].indexOf(f[C.estado - 1]) > -1 && esDe_(f, yo); }).map(function (f) {
      return {
        id: String(f[C.id - 1]), proyecto: String(f[C.proy - 1]), destino: String(f[C.dest - 1]), objeto: String(f[C.obj - 1]),
        estado: String(f[C.estado - 1]), responsable: String(f[C.resp - 1] || f[C.trab - 1] || ''),
        total: Number(f[C.solic - 1]) || 0, salida: fmt_(f[C.sal - 1], 'yyyy-MM-dd'), regreso: fmt_(f[C.reg - 1], 'yyyy-MM-dd')
      };
    }).reverse()
  };
}

// Lo que necesita la pestaña "Proyectos": los proyectos que la persona maneja y la lista de trabajadores
function gestion_(proyectos, trabajadores, yo) {
  if (!puedeGestionar_(proyectos, yo)) return null;
  const admin = esAdmin_(yo);
  const asignado = function (p, t) { return (!!t.correo && p.asignados.indexOf(t.correo) > -1) || p.asignados.indexOf(t.nombre.toLowerCase()) > -1; };
  const presu = leerPresupuestos_(SpreadsheetApp.getActiveSpreadsheet());
  return {
    // Todos los trabajadores de la hoja, tengan o no correo. "clave" es lo que identifica a cada uno al marcarlo.
    personas: trabajadores.map(function (t) {
      return { nombre: t.nombre, correo: t.correo, area: String(t.area || ''), clave: t.correo || t.nombre.toLowerCase(), tecnico: esTecnico_(t) };
    }),
    proyectos: proyectos.filter(function (p) { return admin || p.correo === yo.correo; }).map(function (p) {
      return {
        nombre: p.nombre, jefe: p.jefe, aCargo: p.correo === yo.correo || admin, // puede subir el presupuesto
        presu: presu[p.nombre.toUpperCase()] || { presupuesto: null, entregado: 0, gastado: 0, por: '' },
        tecnicos: trabajadores.filter(function (t) { return asignado(p, t); }).map(function (t) { return t.correo || t.nombre.toLowerCase(); })
      };
    })
  };
}

// Valida la lista de técnicos marcados contra "Trabajadores" y devuelve lo que se guarda en la hoja
function tecnicosValidos_(lista, trabajadores) {
  const salida = [];
  (Array.isArray(lista) ? lista : []).forEach(function (c) {
    const clave = norm_(c).toLowerCase();
    let t = null;
    trabajadores.forEach(function (x) { if (!t && ((x.correo && x.correo === clave) || x.nombre.toLowerCase() === clave)) t = x; });
    if (!t) throw new Error('"' + txt_(c, 60) + '" no está en la lista de trabajadores.');
    const guardado = t.correo || t.nombre; // con correo si lo tiene; si no, por nombre (cuando le pongan correo ya verá el proyecto)
    if (salida.indexOf(guardado) === -1) salida.push(guardado);
  });
  return salida;
}

function hojaProyectos_(ss) {
  const hoja = ss.getSheetByName(HOJA_PROY);
  if (!colAsignados_(hoja)) asegurarHojas_(ss);
  return hoja;
}

// Crear un proyecto desde la app, con su jefe y sus técnicos encargados. Se crea también su carpeta en Drive.
function appCrearProyecto(token, p) {
  const yo = sesion_(token);
  const candado = candado_();
  try {
    p = p || {};
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const proyectos = leerProyectos_(ss), trabajadores = leerTrabajadores_(ss);
    if (!puedeGestionar_(proyectos, yo)) throw new Error('Solo el administrador y los jefes de proyecto pueden crear proyectos.');
    const nombre = limpiarNombre_(txt_(p.nombre, 80));
    if (nombre.length < 3) throw new Error('Escribe el nombre del proyecto.');
    if (buscar_(proyectos, nombre)) throw new Error('Ya existe un proyecto con ese nombre.');
    if (proyectos.length >= 300) throw new Error('Se llegó al máximo de proyectos. Habla con administración.');
    const jefe = trabajadorPorCorreo_(ss, p.jefe || yo.correo);
    if (!jefe) throw new Error('Elige quién aprueba el proyecto.');
    const tecnicos = tecnicosValidos_(p.tecnicos, trabajadores);
    if (!tecnicos.length) throw new Error('Marca al menos un técnico encargado.');

    const hoja = hojaProyectos_(ss);
    const fila = Math.max(hoja.getLastRow(), 1) + 1;
    hoja.getRange(fila, 1, 1, 3).setValues([[nombre, jefe.nombre, jefe.correo]]);
    hoja.getRange(fila, colAsignados_(hoja)).setValue(tecnicos.join(', '));
    SpreadsheetApp.flush();
    const carpeta = carpetaProyecto_(ss, nombre);
    try { carpeta.addViewer(jefe.correo); } catch (err) {}
    intentar_(function () { presupuesto_(ss); dashboard_(ss); });
    return appDatos(token);
  } finally {
    candado.releaseLock();
  }
}

// Cambiar los técnicos encargados de un proyecto (su jefe o el administrador)
function appGuardarTecnicos(token, nombreProyecto, lista) {
  const yo = sesion_(token);
  const candado = candado_();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const proy = buscar_(leerProyectos_(ss), nombreProyecto);
    if (!proy) throw new Error('Ese proyecto ya no existe.');
    if (!esAdmin_(yo) && proy.correo !== yo.correo) throw new Error('Ese proyecto no está a tu cargo.');
    const tecnicos = tecnicosValidos_(lista, leerTrabajadores_(ss));
    const hoja = hojaProyectos_(ss);
    hoja.getRange(proy.fila, colAsignados_(hoja)).setValue(tecnicos.join(', '));
    SpreadsheetApp.flush();
    return appDatos(token);
  } finally {
    candado.releaseLock();
  }
}

// Solicitudes que esperan decisión de este jefe (solo las de proyectos donde su correo figura como jefe)
function porAprobar_(ss, yo, filas) {
  const trabajadores = leerTrabajadores_(ss), proyectos = leerProyectos_(ss);
  const hayGerente = trabajadores.some(function (t) { return t.correo && esGerente_(t); });
  const esJefe = proyectos.some(function (p) { return p.correo && p.correo === yo.correo; });
  if (!esGerente_(yo) && !esIngeniero_(yo) && !(esJefe && !hayGerente)) return null; // no aprueba a nadie: sin pestaña
  const lista = [];
  filas.forEach(function (f) {
    if (!f[C.id - 1] || POR_DECIDIR.indexOf(f[C.estado - 1]) === -1) return;
    if (!aprobadores_(f, trabajadores, proyectos).some(function (a) { return a.correo === yo.correo; })) return;
    lista.push({
      id: String(f[C.id - 1]), trabajador: String(f[C.trab - 1]), proyecto: String(f[C.proy - 1]), destino: String(f[C.dest - 1]),
      salida: fmt_(f[C.sal - 1]), regreso: fmt_(f[C.reg - 1]), objeto: String(f[C.obj - 1]), estado: String(f[C.estado - 1]),
      solicitado: Number(f[C.solic - 1]) || 0, legalizado: Number(f[C.legal - 1]) || 0, soportes: Number(f[C.nsop - 1]) || 0,
      formato: String(f[C.formato - 1]), carpeta: String(f[C.carpeta - 1]), propia: false,
      notas: String(f[C.notas - 1] || ''), viajan: String(f[C.viajan - 1] || ''), responsable: String(f[C.resp - 1] || f[C.trab - 1] || ''), extra: String(f[C.extra - 1] || ''),
      pendientes: leerEntregas_(ss).filter(function (e) { return e.sol === String(f[C.id - 1]) && e.estado === 'Pendiente'; })
        .map(function (e) { return { recibe: e.recibe, valor: e.valor, detalle: e.detalle }; }),
      yaEntregado: leerEntregas_(ss).filter(function (e) { return e.sol === String(f[C.id - 1]) && (e.estado === 'Entregado' || e.estado === 'Por pagar'); })
        .reduce(function (t, e) { return t + e.valor; }, 0),
      puedenRecibir: (function () { // a quién se le puede entregar la plata en ese proyecto
        return trabajadores.filter(esTecnico_).map(function (t) { return t.nombre; }); // cualquier técnico de la lista
      })()
    });
  });
  return lista;
}

// El jefe decide desde la app: queda registrado quién decidió y cuándo
function appDecidir(token, id, accion, obs, entregaA) {
  const yo = sesion_(token);
  const candado = candado_();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reg = ss.getSheetByName(HOJA_REG);
    const filaReg = filaRegistro_(reg, id);
    if (!filaReg) throw new Error(MOTIVOS.no_existe);
    const d = reg.getRange(filaReg, 1, 1, REG.length).getValues()[0];
    if (esDe_(d, yo)) throw new Error('No puedes decidir sobre tu propia solicitud. Debe hacerlo administración.');
    const quienes = aprobadores_(d, leerTrabajadores_(ss), leerProyectos_(ss));
    if (!quienes.some(function (a) { return a.correo === yo.correo; })) {
      throw new Error('Según el conducto regular, esta solicitud la aprueba ' + (quienes.length ? quienes.map(function (a) { return a.nombre; }).join(' o ') : 'administración') + '.');
    }
    const reglas = {
      'Solicitado': { aprobar: 'Aprobado', rechazar: 'Rechazado' },
      'En revisión': { legalizar: 'Legalizado', devolver: 'Aprobado' }
    };
    let nuevo = (reglas[d[C.estado - 1]] || {})[String(accion)];
    if (!nuevo) throw new Error('Esa solicitud ya cambió de estado. Vuelve a abrir la app.');
    // ¿Es una adición a una solicitud que ya tenía plata entregada?
    const adicion = d[C.estado - 1] === 'Solicitado' && leerEntregas_(ss).some(function (e) { return e.sol === String(id) && (e.estado === 'Entregado' || e.estado === 'Por pagar'); });
    if (adicion && accion === 'rechazar') nuevo = 'Aprobado'; // se rechaza solo la adición: la solicitud sigue aprobada
    FIRMA_ESPECIAL = adicion ? (accion === 'rechazar' ? 'Adición rechazada por ' : 'Adición aprobada electrónicamente por ') : '';
    if (adicion && accion === 'rechazar') decidirEntregas_(ss, id, 'Rechazado', yo.correo);
    const nota = txt_(obs, 500);
    if ((accion === 'rechazar' || accion === 'devolver') && !nota) throw new Error('Escribe el motivo en observaciones.');
    if (accion === 'aprobar' && entregaA !== undefined && entregaA !== null) entregarA_(ss, reg, filaReg, d, entregaA);
    reg.getRange(filaReg, C.estado, 1, 2).setValues([[nuevo, nota]]);
    try { aplicarDecision_(ss, reg, filaReg, yo.correo, yo); } finally { FIRMA_ESPECIAL = ''; }
    const filas = reg.getRange(2, 1, reg.getLastRow() - 1, REG.length).getValues();
    return { porAprobar: porAprobar_(ss, yo, filas) || [], estado: nuevo };
  } finally {
    candado.releaseLock();
  }
}

function appDetalle(token, idPedido) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const acceso = filaAccesible_(idPedido, sesion_(token)), d = acceso.d;
  const id = String(d[C.id - 1]);
  const gastos = [];
  const gas = ss.getSheetByName(HOJA_GASTOS);
  if (gas && gas.getLastRow() >= 2) {
    gas.getRange(2, 1, gas.getLastRow() - 1, GAS.length).getValues().forEach(function (g) {
      if (String(g[0]) !== String(id)) return;
      gastos.push({
        n: String(g[11]), fecha: fmt_(g[2]), concepto: String(g[5]), tercero: String(g[6]),
        valor: Number(g[8]) || 0, url: String(g[10]).split('\n')[0]
      });
    });
  }
  return {
    id: String(id), trabajador: String(d[C.trab - 1]), proyecto: String(d[C.proy - 1]), destino: String(d[C.dest - 1]),
    salida: fmt_(d[C.sal - 1]), regreso: fmt_(d[C.reg - 1]), estado: String(d[C.estado - 1]),
    solicitado: Number(d[C.solic - 1]) || 0, legalizado: Number(d[C.legal - 1]) || 0,
    cupo: Math.max(MAX_FILAS - (Number(d[C.nsop - 1]) || 0), 0), gastos: gastos,
    propia: acceso.propia, // false: la abre quien aprueba, para agregar gastos (no puede enviarla a revisión)
    resp: !!acceso.resp,   // la plata se le entregó a quien la abre: la legaliza y la envía a revisión
    puedeEnviar: acceso.propia || !!acceso.resp,
    entregadaA: String(d[C.resp - 1] || d[C.trab - 1] || '') // a quién se le entregó la plata
  };
}

function appGuardarGasto(token, p) {
  const yo = sesion_(token);
  const candado = candado_();
  try {
    p = p || {};
    // Confirma que la solicitud es de quien entró, o de alguien a quien él aprueba (ingeniero a cargo / gerente)
    const acceso = filaAccesible_(String(p.id || '').trim(), yo), d = acceso.d;
    const id = String(d[C.id - 1]);
    const cache = CacheService.getScriptCache();
    const uid = String(p.uid || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 60);
    if (uid && cache.get('UG_' + uid)) return appDetalle(token, id); // reintento de un gasto que sí había llegado

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const g = {
      fecha: aFecha_(p.fecha),
      concepto: norm_(p.concepto),
      valor: typeof p.valor === 'number' ? Math.round(p.valor) : aNumero_(p.valor),
      tercero: txt_(p.tercero, 150),
      nSoporte: txt_(p.nSoporte, 40),
      factura: txt_(p.factura, 40),
      obs: txt_(p.obs, 300),
      por: yo.correo
    };
    if (!g.fecha) throw new Error('Revisa la fecha del gasto.');
    if (g.fecha.getTime() > Date.now()) throw new Error('La fecha del gasto no puede ser futura.');
    if (g.fecha.getTime() < Date.now() - 120 * 86400000) throw new Error('La fecha del gasto es demasiado antigua. Revísala.');
    if (leerConceptos_(ss).indexOf(g.concepto) === -1) throw new Error('Elige el concepto de la lista.');
    if (!(g.valor > 0)) throw new Error('Escribe el valor gastado.');
    if (g.valor > VALOR_MAXIMO) throw new Error('El valor es demasiado alto. Revísalo.');
    if (!g.tercero) throw new Error('Escribe a quién le pagaste.');

    const fuentes = [];
    const foto = p.foto;
    if (foto && typeof foto.base64 === 'string' && foto.base64) {
      const tipos = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic', 'image/heif': '.heif', 'application/pdf': '.pdf' };
      const ext = tipos[String(foto.tipo || '').toLowerCase()];
      if (!ext) throw new Error('El soporte debe ser una foto o un PDF.');
      if (foto.base64.length > 14000000) throw new Error('El archivo pesa más de 10 MB.');
      fuentes.push({ blob: Utilities.newBlob(Utilities.base64Decode(foto.base64), String(foto.tipo).toLowerCase(), 'soporte' + ext), ext: ext });
    } else if (!g.obs) {
      throw new Error('Si no hay soporte, explica el motivo en observaciones.');
    }

    const res = registrarGasto_(id, g, fuentes, (acceso.propia || acceso.resp) ? ABIERTOS : ABIERTOS_APROBADOR);
    if (!res.ok) throw new Error(MOTIVOS[res.motivo]);
    if (uid) cache.put('UG_' + uid, '1', 21600);
    if (!acceso.propia) avisarGastoAgregado_(d, yo, g);
    return appDetalle(token, id);
  } finally {
    candado.releaseLock();
  }
}

// Si quien aprueba agrega gastos a la solicitud de otra persona, se le avisa a esa persona (un correo cada 30 min como máximo)
function avisarGastoAgregado_(d, yo, g) {
  const para = String(d[C.correo - 1] || '').trim().toLowerCase();
  if (!para || para === yo.correo) return;
  const cache = CacheService.getScriptCache(), clave = 'AG_' + d[C.id - 1] + '_' + yo.correo;
  if (cache.get(clave)) return;
  cache.put(clave, '1', 1800);
  correo_(para, 'Viáticos ' + d[C.id - 1] + ': ' + yo.nombre + ' agregó gastos a tu formato',
    '<p>' + esc_(yo.nombre) + ' agregó gastos a tu solicitud de viáticos ' + esc_(d[C.id - 1]) + ' (' + esc_(d[C.proy - 1]) + ').</p>' +
    tabla_([['Concepto', g.concepto], ['Tercero', g.tercero], ['Valor', pesos_(g.valor)]]) +
    '<p>En la columna CONTROL del formato queda quién registró cada gasto. <a href="' + d[C.formato - 1] + '">Ver el formato</a></p>');
}

function appEnviarRevision(token, id) {
  const yo = sesion_(token);
  const candado = candado_();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reg = ss.getSheetByName(HOJA_REG);
    const filaReg = filaRegistro_(reg, id);
    const acceso = filaAccesible_(id, yo);
    if (!acceso.propia && !acceso.resp) throw new Error('Esa solicitud es de otra persona.');
    const d = acceso.d;
    if (ABIERTOS.indexOf(d[C.estado - 1]) === -1) throw new Error(MOTIVOS.cerrada);
    reg.getRange(filaReg, C.estado).setValue('En revisión');
    SpreadsheetApp.flush();

    const aprueban = aprobadores_(d, leerTrabajadores_(ss), leerProyectos_(ss));
    if (!aprueban.length) avisarAdmin_('Viáticos ' + id + ' para legalizar sin aprobador en la app', '<p>' + esc_(d[C.trab - 1]) +
      ' envió a revisión la solicitud ' + esc_(id) + '. Decídela en la pestaña <b>Registro</b>.</p>');
    aprueban.forEach(function (a) {
      correo_(a.correo, 'Viáticos para legalizar ' + id + ' - ' + d[C.proy - 1] + ' - ' + d[C.trab - 1],
        '<p>' + esc_(d[C.trab - 1]) + ' terminó de registrar sus gastos.</p>' + tabla_([
          ['ID', id], ['Proyecto', d[C.proy - 1]], ['Destino', d[C.dest - 1]],
          ['Valor solicitado', pesos_(d[C.solic - 1])], ['Total legalizado', pesos_(d[C.legal - 1])],
          ['Saldo a reintegrar por el trabajador', pesos_(d[C.reint - 1])],
          ['Saldo a favor del trabajador', pesos_(d[C.favor - 1])], ['N.° de soportes', d[C.nsop - 1]]
        ]) +
        '<p><a href="' + d[C.formato - 1] + '">Ver el formato</a> · <a href="' + d[C.carpeta - 1] + '">Ver los soportes</a></p>' +
        '<p>Para legalizarla o devolverla al trabajador, entra a la app de viáticos, pestaña <b>Legalización</b>.' +
        (appUrl_() ? '<br><a href="' + appUrl_() + '?vista=legalizar">Abrir la app</a>' : '') + '</p>');
    });
    return { ok: true };
  } finally {
    candado.releaseLock();
  }
}

function actualizarTotales_(reg, filaReg, f) {
  const mp = mapa_(f), filas = mp.n, o = mp.o;
  const suma = function (col) {
    return f.getRange(mp.fi, col, filas, 1).getValues()
      .reduce(function (s, v) { return s + (Number(v[0]) || 0); }, 0);
  };
  const solicitado = suma(6);
  const legalizado = suma(10 + o);
  const soportes = f.getRange(mp.fi, 7 + o, filas, 1).getDisplayValues()
    .filter(function (v) { return v[0] !== ''; }).length;
  reg.getRange(filaReg, C.solic, 1, 5).setValues([[
    solicitado, legalizado, Math.max(solicitado - legalizado, 0), Math.max(legalizado - solicitado, 0), soportes
  ]]);
  intentar_(function () { llenarControl_(SpreadsheetApp.getActiveSpreadsheet(), reg.getRange(filaReg, 1, 1, REG.length).getValues()[0], f); });
  marcarControl_(String(reg.getRange(filaReg, C.proy).getValue() || ''));
}

/* ============ 3) DECISIONES: EL JEFE EN LA APP, O EL ADMINISTRADOR EN "Registro" ============ */

// Aplica una decisión que ya quedó escrita en la columna Estado: fecha, quién, firma, totales y aviso al trabajador
let FIRMA_ESPECIAL = ''; // texto de la firma cuando se decide una adición (lo pone appDecidir)
function aplicarDecision_(ss, reg, fila, quien, firmante) {
  const d = reg.getRange(fila, 1, 1, REG.length).getValues()[0];
  const id = d[C.id - 1];
  const estado = d[C.estado - 1];
  if (!id || !estado) return;
  // Entregas: al aprobar, lo pendiente pasa a entregado; al rechazar la solicitud, a rechazado
  intentar_(function () {
    if (estado === 'Aprobado') decidirEntregas_(ss, id, hayTesoreria_(leerTrabajadores_(ss)) ? 'Por pagar' : 'Entregado', quien);
    if (estado === 'Rechazado') decidirEntregas_(ss, id, 'Rechazado', quien);
  });

  reg.getRange(fila, C.fdec).setValue(estado === 'Solicitado' ? '' : new Date());
  reg.getRange(fila, C.por).setValue(estado === 'Solicitado' ? '' : quien);

  let f = null;
  try { f = hojaFormato_(SpreadsheetApp.openById(d[C.idFormato - 1])); } catch (err) {}
  if (f) intentar_(function () { // firma electrónica del jefe sobre su línea de firma
    const celda = mapa_(f).firmaJefe;
    const yaFirmado = String(f.getRange(celda).getValue() || '') !== '';
    if (estado === 'Aprobado') firmar_(f, celda, (FIRMA_ESPECIAL || (yaFirmado ? 'Devuelto para corregir y reabierto por ' : 'Aprobado electrónicamente por ')) + quien, yaFirmado);
    if (estado === 'Rechazado') firmar_(f, celda, 'Rechazado por ' + quien, true);
    if (estado === 'Legalizado') firmar_(f, celda, 'Legalizado electrónicamente por ' + quien, true);
  });
  if (f) intentar_(function () { llenarControl_(ss, reg.getRange(fila, 1, 1, REG.length).getValues()[0], f); });
  if (f) intentar_(function () { llenarEntregado_(f, reg.getRange(fila, 1, 1, REG.length).getValues()[0]); });
  marcarControl_(String(d[C.proy - 1] || ''));
  if (f && estado === 'Aprobado') {
    // En la firma va quien aprobó de verdad (gerente o ingeniero); si se aprobó en la hoja, quien hizo el cambio
    let quienFirma = firmante || trabajadorPorCorreo_(ss, String(quien || '').replace(/\s*\(en la hoja\)\s*$/, ''));
    if (!quienFirma) {
      const proy = buscar_(leerProyectos_(ss), d[C.proy - 1]);
      if (proy && proy.jefe) quienFirma = buscar_(leerTrabajadores_(ss), proy.jefe) || { nombre: proy.jefe, cedula: '' };
    }
    if (quienFirma) {
      const pos = mapa_(f);
      f.getRange(pos.jefeNombre).setValue('Nombre: ' + quienFirma.nombre);
      f.getRange(pos.jefeCedula).setValue('C.C.: ' + (quienFirma.cedula || ''));
    }
  }
  if (f) actualizarTotales_(reg, fila, f);
  if (estado === 'Solicitado') return;

  const t = reg.getRange(fila, 1, 1, REG.length).getValues()[0];
  const pares = [['Proyecto', t[C.proy - 1]], ['Destino', t[C.dest - 1]], ['Valor solicitado', pesos_(t[C.solic - 1])]];
  if (estado === 'Legalizado') {
    pares.push(['Total legalizado', pesos_(t[C.legal - 1])]);
    pares.push(['Saldo a reintegrar por el trabajador', pesos_(t[C.reint - 1])]);
    pares.push(['Saldo a favor del trabajador', pesos_(t[C.favor - 1])]);
  }
  if (t[C.obs - 1]) pares.push(['Observaciones del jefe', t[C.obs - 1]]);
  correo_(t[C.correo - 1], 'Viáticos ' + id + ': ' + String(estado).toLowerCase(),
    '<p>Tu solicitud de viáticos <b>' + esc_(id) + '</b> quedó en estado <b>' + esc_(String(estado).toUpperCase()) + '</b>.</p>' +
    tabla_(pares) + '<p><a href="' + t[C.formato - 1] + '">Ver el formato</a></p>');
}

// Cambios hechos a mano en la hoja por el administrador
function alEditar(e) {
  if (!e || !e.range) return;
  const hoja = e.range.getSheet();
  const nombre = hoja.getName();
  if (nombre === HOJA_TRAB) { procesarClaves_(SpreadsheetApp.getActiveSpreadsheet()); return; }
  if (nombre !== HOJA_REG) return;
  if (e.range.getColumn() > C.estado || e.range.getLastColumn() < C.estado) return;
  if (e.oldValue !== undefined && e.value !== undefined && e.oldValue === e.value) return; // no cambió: no se repite el aviso

  let quien = '';
  try { quien = e.user ? String(e.user.getEmail() || '') : ''; } catch (err) {}
  const candado = candado_();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    for (let fila = Math.max(e.range.getRow(), 2); fila <= e.range.getLastRow(); fila++) {
      aplicarDecision_(ss, hoja, fila, (quien || 'Cambio hecho en la hoja') + ' (en la hoja)');
    }
  } finally {
    candado.releaseLock();
  }
}

/* ================== HOJAS DE APOYO: GASTOS Y TABLERO ================== */

function formulaAcumulado_(fila) {
  return '=SUMIFS($I$2:$I' + fila + ';$A$2:$A' + fila + ';$A' + fila + ')';
}

const NOTA_TRABAJADORES = "Cómo mantener este maestro:\n• Un trabajador por fila (filas 3 a 42), sin dejar filas vacías en medio.\n• Columna E: el correo con el que la persona entra a la app. Columna F: su clave inicial (al guardarla, el sistema la oculta).\n• El jefe de un proyecto también debe estar en esta lista para poder entrar a aprobar.\n• Complete la cédula y el cargo de cada persona: son los datos que aparecen en el formato de su viaje.\n• Los conceptos de la columna G alimentan las listas del formato y de la app. Agregue o modifique conceptos ahí.";

function asegurarHojas_(ss) {
  zonaColombia_(ss);
  // Columna de "Proyectos" para asignar trabajadores a cada proyecto
  const pr = ss.getSheetByName(HOJA_PROY);
  if (pr && !colAsignados_(pr)) {
    const titulos = pr.getRange(1, 1, 1, Math.max(pr.getLastColumn(), 5)).getValues()[0];
    let col = 6;
    while (col <= titulos.length && String(titulos[col - 1]).trim() !== '') col++;
    if (col > pr.getMaxColumns()) pr.insertColumnsAfter(pr.getMaxColumns(), col - pr.getMaxColumns());
    pr.getRange(1, col).setValue(TITULO_ASIGNADOS + ' (técnicos encargados: correos separados por coma)')
      .setFontWeight('bold').setBackground(NEGRO).setFontColor('#ffffff').setWrap(true);
    intentar_(function () { pr.setColumnWidth(col, 340); });
  }

  if (pr && colAsignados_(pr)) { // el título viejo decía "vacío = todos"; ahora un proyecto sin técnicos no lo ve nadie
    const celdaTitulo = pr.getRange(1, colAsignados_(pr));
    if (String(celdaTitulo.getValue()).indexOf('todos') > -1) celdaTitulo.setValue(TITULO_ASIGNADOS + ' (técnicos encargados: correos separados por coma)');
  }

  // Columna de correos en "Trabajadores": define quién puede entrar a la app
  const tr = ss.getSheetByName(HOJA_TRAB);
  if (tr && String(tr.getRange('E2').getValue()).trim() === '') {
    intentar_(function () {
      tr.getRange('D2').copyTo(tr.getRange('E2'), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      tr.getRange('D3:D42').copyTo(tr.getRange('E3:E42'), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      tr.setColumnWidth(5, 240);
    });
    tr.getRange('E2').setValue('Correo (para entrar a la app)');
  }
  // Columna de clave, al lado del correo (la lista de conceptos se corre una columna a la derecha)
  if (tr && !colClave_(tr)) {
    tr.insertColumnAfter(5);
    intentar_(function () {
      tr.getRange('E2:E42').copyTo(tr.getRange('F2:F42'), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      tr.getRange('F3:F42').setNumberFormat('@');
      tr.setColumnWidth(6, 230);
    });
    tr.getRange('F2').setValue('Clave (escríbela aquí; se guarda y se oculta)');
  }
  if (tr) intentar_(function () { procesarClaves_(ss); });
  if (tr) intentar_(function () { // la nota de ayuda de la hoja se mantiene al día con cómo funciona la app
    if (String(tr.getRange('A45').getValue()).indexOf('Cómo mantener') === 0) tr.getRange('A45').setValue(NOTA_TRABAJADORES);
  });
  // Pestaña "Casillas": el administrador agrega aquí casillas nuevas para el formato, sin tocar el código
  if (!ss.getSheetByName(HOJA_CASILLAS)) {
    const hc = ss.insertSheet(HOJA_CASILLAS);
    hc.getRange(1, 1, 1, 3).setValues([['Casilla (nombre que sale en el formato y en la app)', 'Obligatoria (SÍ / NO)', 'Ayuda para quien solicita (opcional)']])
      .setFontWeight('bold').setBackground(NEGRO).setFontColor('#ffffff').setWrap(true);
    hc.getRange(2, 1, MAX_CASILLAS, 3).setBackground('#FFF7DC');
    hc.getRange(2, 2, MAX_CASILLAS, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['SÍ', 'NO'], true).build());
    hc.getRange('E1').setValue('Cómo usar esta hoja:\n• Escriba una casilla por fila (máximo ' + MAX_CASILLAS + '), por ejemplo "Placa del vehículo" o "Centro de costo".\n' +
      '• La app la pide al hacer la solicitud y el sistema la agrega sola en el encabezado del formato, encima de la tabla.\n' +
      '• No hay que mover nada en el formato: las solicitudes anteriores siguen igual.\n• Para quitar una casilla, borre su fila.');
    hc.getRange('E1').setWrap(true).setFontStyle('italic').setFontColor('#595959').setVerticalAlignment('top');
    intentar_(function () { hc.setColumnWidth(1, 300); hc.setColumnWidth(2, 140); hc.setColumnWidth(3, 300); hc.setColumnWidth(4, 20); hc.setColumnWidth(5, 420); hc.setFrozenRows(1); });
  }
  // Formato maestro: la casilla "Técnico responsable del dinero" (fila 16) la pone el código
  intentar_(function () {
    const fm = hojaFormato_(ss);
    if (fm) { const om = desfase_(fm); casillaResponsable_(fm, function (a1) { return desplazar_(a1, om); }); bloqueControl_(fm); bloqueEntregado_(fm); }
  });
  // Registro: una fila por solicitud. Nunca se borra lo que ya tenga.
  const reg = ss.getSheetByName(HOJA_REG) || ss.insertSheet(HOJA_REG);
  if (reg.getMaxColumns() < REG.length) reg.insertColumnsAfter(reg.getMaxColumns(), REG.length - reg.getMaxColumns());
  reg.getRange(1, 1, 1, REG.length).setValues([REG])
    .setFontWeight('bold').setBackground(NEGRO).setFontColor('#ffffff');
  reg.setFrozenRows(1);
  const filasReg = reg.getMaxRows() - 1;
  reg.getRange(2, C.fecha, filasReg, 1).setNumberFormat('dd/mm/yyyy hh:mm');
  reg.getRange(2, C.sal, filasReg, 2).setNumberFormat('dd/mm/yyyy');
  reg.getRange(2, C.solic, filasReg, 4).setNumberFormat('$ #,##0');
  reg.getRange(2, C.fdec, filasReg, 1).setNumberFormat('dd/mm/yyyy hh:mm');
  reg.getRange(2, C.estado, filasReg, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).setAllowInvalid(false).build());
  const gas = ss.getSheetByName(HOJA_GASTOS) || ss.insertSheet(HOJA_GASTOS);
  gas.getRange(1, 1, 1, GAS.length).setValues([GAS])
    .setFontWeight('bold').setBackground(NEGRO).setFontColor('#ffffff');
  gas.setFrozenRows(1);
  const filasGas = gas.getMaxRows() - 1;
  gas.getRange(2, 2, filasGas, 1).setNumberFormat('dd/mm/yyyy hh:mm');
  gas.getRange(2, 3, filasGas, 1).setNumberFormat('dd/mm/yyyy');
  gas.getRangeList(['I2:I', 'M2:M']).setNumberFormat('$ #,##0');
  gas.getRangeList(['G2:H', 'J2:J']).setNumberFormat('@'); // texto tal cual: un recibo "00123" no se vuelve 123
  if (gas.getLastRow() >= 2) { // gastos registrados antes de existir la columna de acumulado
    const acum = gas.getRange(2, 13, gas.getLastRow() - 1, 1);
    const formulas = acum.getFormulas();
    for (let k = 0; k < formulas.length; k++) {
      if (!formulas[k][0]) gas.getRange(k + 2, 13).setFormula(formulaAcumulado_(k + 2));
    }
  }
  if (!ss.getSheetByName(HOJA_TABLERO)) construirTablero_(ss);
  intentar_(function () { hojaEnt_(ss); });
  intentar_(function () { presupuesto_(ss); hojaPdet_(ss); });
  intentar_(function () { dashboard_(ss); });
  intentar_(function () { PropertiesService.getScriptProperties().setProperty('MAESTRO_ID', ss.getId()); });
  intentar_(function () { bloqueDiario_(ss.getSheetByName(HOJA_TABLERO)); });
  intentar_(function () { aplicarColores_(ss); });
}

// Gastos día por día: total diario y lo que cada solicitud gastó cada día
function bloqueDiario_(t) {
  if (!t || String(t.getRange('AE4').getValue()) !== '') return;
  if (t.getMaxColumns() < 40) t.insertColumnsAfter(t.getMaxColumns(), 40 - t.getMaxColumns());
  const G = HOJA_GASTOS;
  t.getRange('AE4').setValue('Gastos por día');
  t.getRange('AI4').setValue('Gastos de cada solicitud por día');
  t.getRange('AE5').setFormula('=IFERROR(QUERY(' + G + "!A1:M;\"select C, count(A), sum(I) where A is not null group by C order by C desc label C 'Fecha del gasto', count(A) 'Gastos', sum(I) 'Valor gastado'\";1);\"Sin datos\")");
  t.getRange('AI5').setFormula('=IFERROR(QUERY(' + G + "!A1:M;\"select A, D, E, C, sum(I) where A is not null group by A, D, E, C order by A, C label A 'Solicitud', D 'Trabajador', E 'Proyecto', C 'Fecha del gasto', sum(I) 'Gastado ese día'\";1);\"Sin datos\")");
  t.getRangeList(['AE6:AE', 'AL6:AL']).setNumberFormat('dd/mm/yyyy');
  t.getRangeList(['AG6:AG', 'AM6:AM']).setNumberFormat('$ #,##0');
  [30, 34].forEach(function (c) { t.setColumnWidth(c, 24); });
  t.setColumnWidth(36, 200); t.setColumnWidth(37, 220);
}

// Encabezados en negro y amarillo corporativo (también actualiza hojas ya instaladas)
function aplicarColores_(ss) {
  [HOJA_REG, HOJA_PROY, HOJA_GASTOS].forEach(function (nombre) {
    const h = ss.getSheetByName(nombre);
    if (h) h.getRange(1, 1, 1, Math.max(h.getLastColumn(), 1)).setBackground(NEGRO).setFontColor('#ffffff').setFontWeight('bold');
  });
  const t = ss.getSheetByName(HOJA_TABLERO);
  if (t) {
    t.getRangeList(['A4', 'D4', 'K4', 'R4', 'V4', 'AE4', 'AI4']).setBackground(NEGRO).setFontColor(AMARILLO).setFontWeight('bold');
    t.getRangeList(['D5:I5', 'K5:P5', 'R5:T5', 'V5:AC5', 'AE5:AG5', 'AI5:AM5']).setBackground(AMARILLO_CLARO).setFontWeight('bold');
  }
}

function construirTablero_(ss) {
  const t = ss.insertSheet(HOJA_TABLERO, 0);
  if (t.getMaxColumns() < 30) t.insertColumnsAfter(t.getMaxColumns(), 30 - t.getMaxColumns());
  const R = HOJA_REG, G = HOJA_GASTOS;
  t.getRange('A1').setValue('TABLERO DE VIÁTICOS').setFontSize(14).setFontWeight('bold');
  t.getRange('A2').setValue('Se calcula solo a partir de las pestañas "' + R + '" y "' + G + '". No escribir en esta hoja.')
    .setFontStyle('italic').setFontColor('#666666');

  const titulos = { A4: 'Resumen', D4: 'Por proyecto', K4: 'Por trabajador', R4: 'Por concepto de gasto', V4: 'Solicitudes sin cerrar' };
  Object.keys(titulos).forEach(function (a1) {
    t.getRange(a1).setValue(titulos[a1]).setFontWeight('bold').setFontColor('#ffffff').setBackground(NEGRO);
  });

  const resumen = [
    ['Solicitudes registradas', '=COUNTA(' + R + '!A2:A)'],
    ['Pendientes de aprobar', '=COUNTIF(' + R + '!O2:O;"Solicitado")'],
    ['Aprobadas (en viaje)', '=COUNTIF(' + R + '!O2:O;"Aprobado")'],
    ['En revisión del jefe', '=COUNTIF(' + R + '!O2:O;"En revisión")'],
    ['Legalizadas', '=COUNTIF(' + R + '!O2:O;"Legalizado")'],
    ['Valor solicitado', '=SUM(' + R + '!J2:J)'],
    ['Total legalizado', '=SUM(' + R + '!K2:K)'],
    ['Saldo a reintegrar por trabajadores', '=SUM(' + R + '!L2:L)'],
    ['Saldo a favor de trabajadores', '=SUM(' + R + '!M2:M)']
  ];
  resumen.forEach(function (f, i) {
    t.getRange(5 + i, 1).setValue(f[0]);
    t.getRange(5 + i, 2).setFormula(f[1]);
  });
  t.getRange('B10:B13').setNumberFormat('$ #,##0');

  const agrupado = function (col, titulo) {
    return '=IFERROR(QUERY(' + R + '!A1:V;"select ' + col + ', count(A), sum(J), sum(K), sum(L), sum(M) where A is not null group by ' + col +
      " label " + col + " '" + titulo + "', count(A) 'Solicitudes', sum(J) 'Solicitado', sum(K) 'Legalizado', sum(L) 'A reintegrar', sum(M) 'A favor'\";1);\"Sin datos\")";
  };
  t.getRange('D5').setFormula(agrupado('E', 'Proyecto'));
  t.getRange('K5').setFormula(agrupado('C', 'Trabajador'));
  t.getRange('R5').setFormula('=IFERROR(QUERY(' + G + "!A1:L;\"select F, count(A), sum(I) where A is not null group by F label F 'Concepto', count(A) 'Gastos', sum(I) 'Valor gastado'\";1);\"Sin datos\")");
  t.getRange('V5').setFormula('=IFERROR(QUERY(' + R + "!A1:V;\"select A, C, E, G, J, K, L, O where O = 'Solicitado' or O = 'Aprobado' or O = 'En revisión' order by B desc\";1);\"Sin datos\")");

  intentar_(function () {
    t.getRangeList(['D5:I5', 'K5:P5', 'R5:T5', 'V5:AC5']).setFontWeight('bold').setBackground(AMARILLO_CLARO);
    t.getRangeList(['F6:I', 'M6:P', 'T6:T', 'Z6:AB']).setNumberFormat('$ #,##0');
    t.getRange('Y6:Y').setNumberFormat('dd/mm/yyyy');
    t.setColumnWidth(1, 250); t.setColumnWidth(4, 220); t.setColumnWidth(11, 200); t.setColumnWidth(18, 190);
    t.setColumnWidth(23, 220); t.setColumnWidth(24, 220);
    [3, 10, 17, 21].forEach(function (c) { t.setColumnWidth(c, 24); });
    t.setFrozenRows(2);
  });
}

/* ============ PRESUPUESTO POR PROYECTO: presupuesto, dinero entregado y relación de gastos ============ */

// Hoja "Presupuesto": una fila por proyecto. Administración escribe el presupuesto (columna B, crema);
// lo demás se calcula solo desde "Registro" y "Gastos". Nunca borra un presupuesto ya escrito.
function presupuesto_(ss) {
  let h = ss.getSheetByName(HOJA_PRESU);
  if (!h) {
    h = ss.insertSheet(HOJA_PRESU, 1);
    h.getRange('A1').setValue('PRESUPUESTO POR PROYECTO').setFontSize(14).setFontWeight('bold');
    h.getRange('A2').setValue('El ingeniero a cargo sube el presupuesto desde la app (pestaña Proyectos); administración también puede escribirlo en la columna B. ' +
      'Lo demás se calcula solo desde "' + HOJA_REG + '" y "' + HOJA_GASTOS + '". Los proyectos nuevos se agregan solos al final.').setFontStyle('italic').setFontColor('#666666');
    h.getRange(4, 1, 1, 8).setValues([['Proyecto', 'Presupuesto', 'Dinero entregado (anticipos aprobados)', 'Relación de gastos (gastado con soporte)',
      'Por legalizar (entregado − gastado)', 'Saldo del presupuesto (presupuesto − gastado)', '% ejecutado', 'Presupuesto subido por']])
      .setFontWeight('bold').setBackground(NEGRO).setFontColor('#ffffff').setWrap(true).setVerticalAlignment('middle');
    h.getRange(5, 1).setValue('TOTAL');
    h.getRange(5, 2, 1, 6).setFormulas([[
      '=SUM(B' + PRESU_INI + ':B)', '=SUM(C' + PRESU_INI + ':C)', '=SUM(D' + PRESU_INI + ':D)', '=SUM(E' + PRESU_INI + ':E)',
      '=IF(B5=0;"";B5-D5)', '=IF(N(B5)=0;"";D5/B5)']]);
    h.getRange(5, 1, 1, 8).setFontWeight('bold').setBackground(AMARILLO_CLARO);
    // Dinero entregado: a qué técnico se le entregó, por proyecto (solo solicitudes aprobadas)
    const R = HOJA_REG, L = letraCol_;
    h.getRange('J4').setValue('Dinero entregado por técnico').setFontWeight('bold').setBackground(NEGRO).setFontColor(AMARILLO);
    h.getRange('J5').setFormula('=IFERROR(QUERY(' + R + '!A1:' + L(REG.length) + ';"select ' + L(C.proy) + ', ' + L(C.resp) + ', count(' + L(C.id) + '), sum(' + L(C.solic) + ')' +
      " where " + L(C.estado) + " = 'Aprobado' or " + L(C.estado) + " = 'En revisión' or " + L(C.estado) + " = 'Legalizado'" +
      ' group by ' + L(C.proy) + ', ' + L(C.resp) + " order by " + L(C.proy) + " label " + L(C.proy) + " 'Proyecto', " + L(C.resp) + " 'Recibió el dinero', count(" + L(C.id) +
      ") 'Entregas', sum(" + L(C.solic) + ") 'Dinero entregado'\";1);\"Sin entregas todavía\")");
    intentar_(function () {
      h.setColumnWidth(1, 300); [2, 3, 4, 5, 6].forEach(function (c) { h.setColumnWidth(c, 170); }); h.setColumnWidth(7, 110);
      h.setColumnWidth(8, 230); h.setColumnWidth(9, 24); h.setColumnWidth(10, 260); h.setColumnWidth(11, 220); h.setColumnWidth(12, 80); h.setColumnWidth(13, 150);
      h.getRange('J5:M5').setFontWeight('bold').setBackground(AMARILLO_CLARO); h.getRange('M6:M').setNumberFormat('$ #,##0');
      h.setRowHeight(4, 48); h.setFrozenRows(5);
      h.getRange('B5:F').setNumberFormat('$ #,##0'); h.getRange('G5:G').setNumberFormat('0%');
      const rojo = SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setFontColor('#c62828').setBold(true)
        .setRanges([h.getRange('E' + PRESU_INI + ':F')]).build();
      const alto = SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(1).setBackground('#F8D7DA')
        .setRanges([h.getRange('G' + PRESU_INI + ':G')]).build();
      h.setConditionalFormatRules([rojo, alto]);
    });
  }
  // Proyectos que todavía no están en la hoja: se agregan al final con sus fórmulas
  const ya = {};
  if (h.getLastRow() >= PRESU_INI) {
    h.getRange(PRESU_INI, 1, h.getLastRow() - PRESU_INI + 1, 1).getValues().forEach(function (v) { ya[norm_(v[0]).toUpperCase()] = true; });
  }
  if (h.getLastRow() >= PRESU_INI) {
    const nF = h.getLastRow() - PRESU_INI + 1, fs = [];
    for (let i = 0; i < nF; i++) fs.push([formulasPresupuesto_(PRESU_INI + i)[0]]);
    h.getRange(PRESU_INI, 3, nF, 1).setFormulas(fs);
  }
  let fila = Math.max(h.getLastRow(), PRESU_INI - 1) + 1, nuevos = 0;
  leerProyectos_(ss).forEach(function (p) {
    if (ya[p.nombre.toUpperCase()]) return;
    ya[p.nombre.toUpperCase()] = true;
    h.getRange(fila, 1).setValue(p.nombre);
    h.getRange(fila, 3, 1, 5).setFormulas([formulasPresupuesto_(fila)]);
    intentar_(function () { h.getRange(fila, 2).setBackground('#FFF7DC'); });
    fila++; nuevos++;
  });
  return nuevos;
}

function letraCol_(n) {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// Fila de un proyecto en la hoja "Presupuesto" (la agrega si falta)
function filaPresupuesto_(ss, nombre) {
  presupuesto_(ss);
  const h = ss.getSheetByName(HOJA_PRESU);
  const v = h.getRange(PRESU_INI, 1, Math.max(h.getLastRow() - PRESU_INI + 1, 1), 1).getValues();
  for (let i = 0; i < v.length; i++) if (norm_(v[i][0]).toUpperCase() === nombre.toUpperCase()) return { h: h, fila: PRESU_INI + i };
  return null;
}

// Presupuesto, entregado y gastado de cada proyecto, para mostrarlos en la app
function leerPresupuestos_(ss) {
  const h = ss.getSheetByName(HOJA_PRESU), m = {};
  if (!h || h.getLastRow() < PRESU_INI) return m;
  h.getRange(PRESU_INI, 1, h.getLastRow() - PRESU_INI + 1, 8).getValues().forEach(function (r) {
    const n = norm_(r[0]).toUpperCase();
    if (!n) return;
    const num = function (x) { return typeof x === 'number' ? x : 0; };
    m[n] = { presupuesto: r[1] === '' ? null : num(r[1]), entregado: num(r[2]), gastado: num(r[3]), por: String(r[7] || '') };
  });
  return m;
}

// El ingeniero a cargo del proyecto (o administración) sube el presupuesto desde la app
function appGuardarPresupuesto(token, nombreProyecto, valor) {
  const yo = sesion_(token);
  const candado = candado_();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const proy = buscar_(leerProyectos_(ss), nombreProyecto);
    if (!proy) throw new Error('Ese proyecto ya no existe.');
    if (!esAdmin_(yo) && proy.correo !== yo.correo) throw new Error('Solo el ingeniero a cargo del proyecto puede subir su presupuesto.');
    if ((leerLineasPresupuesto_(ss)[proy.nombre.toUpperCase()] || []).length) throw new Error('Este proyecto tiene el presupuesto por conceptos: agrégalo o quítalo en la pestaña Presupuesto.');
    const v = typeof valor === 'number' ? Math.round(valor) : aNumero_(valor);
    if (!(v > 0)) throw new Error('Escribe el valor del presupuesto.');
    if (v > 100000000000) throw new Error('El presupuesto es demasiado alto. Revísalo.');
    const p = filaPresupuesto_(ss, proy.nombre);
    if (!p) throw new Error('No se encontró el proyecto en la hoja Presupuesto.');
    p.h.getRange(p.fila, 2).setValue(v);
    p.h.getRange(p.fila, 8).setValue(yo.correo + ' · ' + fmt_(new Date(), 'dd/MM/yyyy HH:mm'));
    SpreadsheetApp.flush();
    refrescarControlProyecto_(ss, proy.nombre);
    marcarControl_(proy.nombre);
    return appDatos(token);
  } finally {
    candado.releaseLock();
  }
}

function formulasPresupuesto_(r) {
  const R = HOJA_REG, G = HOJA_GASTOS;
  const col = letraCol_;
  const sol = R + '!$' + col(C.solic) + ':$' + col(C.solic), pro = R + '!$' + col(C.proy) + ':$' + col(C.proy), est = R + '!$' + col(C.estado) + ':$' + col(C.estado);
  const entregado = 'SUMIFS(' + HOJA_ENT + '!$F:$F;' + HOJA_ENT + '!$D:$D;$A' + r + ';' + HOJA_ENT + '!$H:$H;"Entregado")'; void sol; void est; void pro;
  return [
    '=' + entregado,
    '=SUMIFS(' + G + '!$I:$I;' + G + '!$E:$E;$A' + r + ')',
    '=C' + r + '-D' + r,
    '=IF(B' + r + '="";"";B' + r + '-D' + r + ')',
    '=IF(N(B' + r + ')=0;"";D' + r + '/B' + r + ')'
  ];
}

/* ======== FORMATO POR PROYECTO: PRESUPUESTADO · ENTREGADO · LEGALIZADO (lo arma y lo actualiza el sistema) ======== */

// Presupuesto por conceptos: una fila por línea (lo sube el ingeniero a cargo desde la app)
const HOJA_PDET = 'Presupuesto detalle';
const PDET = ['Proyecto', 'Concepto', 'Detalle', 'Valor', 'Subido por', 'Fecha', 'ID línea (no tocar)'];
function hojaPdet_(ss) {
  let h = ss.getSheetByName(HOJA_PDET);
  if (!h) {
    h = ss.insertSheet(HOJA_PDET);
    h.getRange(1, 1, 1, PDET.length).setValues([PDET]).setFontWeight('bold').setBackground(NEGRO).setFontColor('#ffffff');
    h.setFrozenRows(1);
    intentar_(function () {
      h.setColumnWidth(1, 260); h.setColumnWidth(2, 200); h.setColumnWidth(3, 260); h.setColumnWidth(4, 130);
      h.setColumnWidth(5, 220); h.setColumnWidth(6, 130); h.setColumnWidth(7, 160);
      h.getRange('D2:D').setNumberFormat('$ #,##0'); h.getRange('F2:F').setNumberFormat('dd/mm/yyyy hh:mm');
    });
    h.getRange('I1').setValue('Esta hoja la llena la app (pestaña Presupuesto). El total de cada proyecto pasa solo a la hoja "' + HOJA_PRESU + '".')
      .setFontStyle('italic').setFontColor('#666666');
  }
  return h;
}

function leerLineasPresupuesto_(ss) {
  const h = ss.getSheetByName(HOJA_PDET), m = {};
  if (!h || h.getLastRow() < 2) return m;
  h.getRange(2, 1, h.getLastRow() - 1, PDET.length).getValues().forEach(function (r, i) {
    const n = norm_(r[0]).toUpperCase();
    if (!n || !(Number(r[3]) > 0)) return;
    (m[n] = m[n] || []).push({ id: String(r[6] || ''), fila: i + 2, concepto: String(r[1]), detalle: String(r[2] || ''), valor: Number(r[3]) || 0, por: String(r[4] || '') });
  });
  return m;
}

// Pasa el total de las líneas a la hoja "Presupuesto" (columna B) y deja quién lo cambió
function totalPresupuesto_(ss, nombre, quien) {
  const lineas = leerLineasPresupuesto_(ss)[nombre.toUpperCase()] || [];
  const p = filaPresupuesto_(ss, nombre);
  if (!p) return 0;
  const total = lineas.reduce(function (t, l) { return t + l.valor; }, 0);
  p.h.getRange(p.fila, 2).setValue(total || '');
  p.h.getRange(p.fila, 8).setValue(quien + ' · ' + fmt_(new Date(), 'dd/MM/yyyy HH:mm'));
  return total;
}

function puedePresupuestar_(ss, yo, nombreProyecto) {
  const proy = buscar_(leerProyectos_(ss), nombreProyecto);
  if (!proy) throw new Error('Ese proyecto ya no existe.');
  if (!esAdmin_(yo) && proy.correo !== yo.correo) throw new Error('Solo el ingeniero a cargo del proyecto puede subir su presupuesto.');
  return proy;
}

// Agrega una línea al presupuesto del proyecto. p = { concepto, detalle, valor, uid }
function appAgregarPresupuesto(token, nombreProyecto, p) {
  const yo = sesion_(token);
  const candado = candado_();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const proy = puedePresupuestar_(ss, yo, nombreProyecto);
    p = p || {};
    const cache = CacheService.getScriptCache();
    const uid = String(p.uid || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 60);
    if (uid && cache.get('UP_' + uid)) return appDatos(token);
    const concepto = norm_(p.concepto);
    if (leerConceptos_(ss).indexOf(concepto) === -1) throw new Error('Elige el concepto de la lista.');
    const valor = typeof p.valor === 'number' ? Math.round(p.valor) : aNumero_(p.valor);
    if (!(valor > 0)) throw new Error('Escribe el valor presupuestado.');
    if (valor > 10000000000) throw new Error('El valor es demasiado alto. Revísalo.');
    const h = hojaPdet_(ss);
    // Si el proyecto tenía un presupuesto global (sin detalle), pasa a ser la primera línea para no perderlo
    if (!(leerLineasPresupuesto_(ss)[proy.nombre.toUpperCase()] || []).length) {
      const previo = (leerPresupuestos_(ss)[proy.nombre.toUpperCase()] || {}).presupuesto;
      if (previo > 0) h.appendRow([proy.nombre, 'Presupuesto general', 'Valor que tenía el proyecto antes del detalle', previo, yo.correo, new Date(), 'L' + Date.now() + 'g']);
    }
    h.appendRow([proy.nombre, concepto, txt_(p.detalle, 150), valor, yo.correo, new Date(), 'L' + Date.now() + Math.floor(Math.random() * 1000)]);
    totalPresupuesto_(ss, proy.nombre, yo.correo);
    if (uid) cache.put('UP_' + uid, '1', 21600);
    SpreadsheetApp.flush();
    refrescarControlProyecto_(ss, proy.nombre);
    marcarControl_(proy.nombre);
    return appDatos(token);
  } finally {
    candado.releaseLock();
  }
}

function appQuitarPresupuesto(token, nombreProyecto, idLinea) {
  const yo = sesion_(token);
  const candado = candado_();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const proy = puedePresupuestar_(ss, yo, nombreProyecto);
    const l = (leerLineasPresupuesto_(ss)[proy.nombre.toUpperCase()] || []).filter(function (x) { return x.id && x.id === String(idLinea); })[0];
    if (!l) throw new Error('Esa línea ya no está en el presupuesto.');
    hojaPdet_(ss).deleteRow(l.fila);
    totalPresupuesto_(ss, proy.nombre, yo.correo);
    SpreadsheetApp.flush();
    refrescarControlProyecto_(ss, proy.nombre);
    marcarControl_(proy.nombre);
    return appDatos(token);
  } finally {
    candado.releaseLock();
  }
}

// ---- El formato del proyecto se actualiza en segundo plano (la app no espera) ----
function marcarControl_(nombreProyecto) {
  return; // DESACTIVADO 11/11/2026: ya no se generan los archivos de control por proyecto
  if (!nombreProyecto) return;
  intentar_(function () {
    const props = PropertiesService.getScriptProperties();
    const pend = JSON.parse(props.getProperty('CTL_PEND') || '[]');
    if (pend.indexOf(nombreProyecto) === -1) pend.push(nombreProyecto);
    props.setProperty('CTL_PEND', JSON.stringify(pend.slice(-60)));
    if (!props.getProperty('MAESTRO_ID')) props.setProperty('MAESTRO_ID', SpreadsheetApp.getActiveSpreadsheet().getId());
    const desde = Number(props.getProperty('CTL_TRIG') || 0);
    if (Date.now() - desde > 10 * 60 * 1000) { // un solo activador pendiente a la vez
      ScriptApp.newTrigger('actualizarControles').timeBased().after(20 * 1000).create();
      props.setProperty('CTL_TRIG', String(Date.now()));
    }
  });
}

// Lo llama el activador: arma o actualiza el formato de cada proyecto que cambió
function actualizarControles() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('CTL_TRIG');
  intentar_(function () {
    ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'actualizarControles') ScriptApp.deleteTrigger(t); });
  });
  const pend = JSON.parse(props.getProperty('CTL_PEND') || '[]');
  props.setProperty('CTL_PEND', '[]');
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(props.getProperty('MAESTRO_ID'));
  pend.forEach(function (n) {
    try { llenarControlProyecto_(ss, n); } catch (err) { console.error('Formato del proyecto ' + n + ': ' + err); }
  });
  if (pend.length) { try { llenarResumenControl_(ss); } catch (err) { console.error('Resumen de control: ' + err); } }
}

// Menú: arma o actualiza el formato de todos los proyectos
function actualizarFormatosProyecto() {
  const ui = soloAdmin_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let n = 0;
  leerProyectos_(ss).forEach(function (p) {
    try { llenarControlProyecto_(ss, p.nombre); n++; } catch (err) { console.error(p.nombre + ': ' + err); }
  });
  try { llenarResumenControl_(ss); } catch (err) { console.error(err); }
  ui.alert(n + ' formatos actualizados: cada proyecto tiene "Control de viáticos - <proyecto>" en su carpeta de Drive. ' +
    'El resumen de todos ("Resumen" y "Por trabajador") está en "Resumen de viáticos por proyecto - Social Solar", en la carpeta principal.');
}

// Archivo "Control de viáticos - <proyecto>" en la carpeta del proyecto (lo crea la primera vez)
function libroControl_(ss) {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('CTL_LIBRO');
  if (id) {
    try { if (!DriveApp.getFileById(id).isTrashed()) return SpreadsheetApp.openById(id); } catch (err) {}
  }
  const libro = SpreadsheetApp.create('Resumen de viáticos por proyecto - Social Solar');
  intentar_(function () { libro.setSpreadsheetLocale(ss.getSpreadsheetLocale()); libro.setSpreadsheetTimeZone(ZONA); });
  intentar_(function () { DriveApp.getFileById(libro.getId()).moveTo(DriveApp.getFolderById(props.getProperty('ROOT_ID'))); });
  libro.getSheets()[0].setName('Resumen');
  libro.insertSheet('Por trabajador', 1);
  props.setProperty('CTL_LIBRO', libro.getId());
  return libro;
}

// Hoja del proyecto dentro del libro de control (la crea la primera vez)
// "Control de viáticos - <proyecto>": un archivo en la carpeta de Drive de cada proyecto (lo crea la primera vez)
function docControl_(ss, nombre) {
  const props = PropertiesService.getScriptProperties();
  const clave = 'CTL_' + nombre.toUpperCase().slice(0, 80);
  const id = props.getProperty(clave);
  if (id) {
    try {
      if (!DriveApp.getFileById(id).isTrashed()) return SpreadsheetApp.openById(id);
    } catch (err) {}
  }
  const css = SpreadsheetApp.create(limpiarNombre_('Control de viáticos - ' + nombre));
  intentar_(function () { css.setSpreadsheetLocale(ss.getSpreadsheetLocale()); css.setSpreadsheetTimeZone(ZONA); });
  DriveApp.getFileById(css.getId()).moveTo(carpetaProyecto_(ss, nombre));
  const h = css.getSheets()[0];
  h.setName('Control');
  baseControl_(h);
  props.setProperty(clave, css.getId());
  const proy = buscar_(leerProyectos_(ss), nombre);
  if (proy && proy.correo) { try { DriveApp.getFileById(css.getId()).addViewer(proy.correo); } catch (err) {} }
  return css;
}
function hojaControl_(ss, nombre) {
  const css = docControl_(ss, nombre);
  return css.getSheetByName('Control') || css.getSheets()[0];
}

// Enlace al formato del proyecto; sin proyecto, al resumen de todos
function urlControl_(nombre) {
  const props = PropertiesService.getScriptProperties();
  const id = nombre ? props.getProperty('CTL_' + String(nombre).toUpperCase().slice(0, 80)) : props.getProperty('CTL_LIBRO');
  return id ? 'https://docs.google.com/spreadsheets/d/' + id + '/edit' : '';
}

const CTL_FILA = 17; // primera fila de los tres bloques
// Partes fijas: encabezado con el logo, instructivo, títulos de los bloques
function baseControl_(h) {
  if (h.getMaxColumns() < 20) h.insertColumnsAfter(h.getMaxColumns(), 20 - h.getMaxColumns());
  h.setHiddenGridlines(true);
  [2, 5, 24, 24, 16, 2, 11, 12, 22, 24, 15, 2, 11, 13, 13, 22, 20, 20, 15].forEach(function (w, i) { h.setColumnWidth(i + 1, Math.round(w * 7.5)); });
  const caja = function (a1, v) { const r = h.getRange(a1); r.merge(); if (v !== undefined) r.setValue(v); r.setBorder(true, true, true, true, true, true, '#808080', SpreadsheetApp.BorderStyle.SOLID); return r; };
  caja('B2:D5');
  caja('E2:O2', 'SOCIAL SOLAR S.A.S').setFontWeight('bold').setFontSize(13).setHorizontalAlignment('center');
  caja('E3:O3', 'NIT. 901.128.826-6').setFontWeight('bold').setHorizontalAlignment('center');
  caja('E4:O5', 'FORMATO DE CONTROL DE VIÁTICOS POR PROYECTO\nPresupuestado · Entregado · Legalizado').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  [['CÓDIGO', 'PR-'], ['FECHA', fmt_(new Date())], ['VERSIÓN', '1'], ['PÁGINA', '1 de 1']].forEach(function (x, i) {
    caja('P' + (i + 2) + ':Q' + (i + 2), x[0]).setFontWeight('bold').setHorizontalAlignment('center');
    caja('R' + (i + 2) + ':S' + (i + 2), x[1]).setHorizontalAlignment('center').setNumberFormat('@');
  });
  intentar_(function () {
    const blob = Utilities.newBlob(Utilities.base64Decode(PLANTILLA.logo), 'image/png', 'logo.png');
    h.insertImage(blob, 2, 2).setWidth(107).setHeight(66);
  });
  caja('B7:S7', 'Este formato lo arma y lo actualiza el sistema de viáticos. 1) PRESUPUESTADO: lo sube el ingeniero a cargo en la app (pestaña Presupuesto).  ' +
    '2) ENTREGADO: cada solicitud aprobada y el trabajador al que se le entregó la plata.  3) LEGALIZADO: cada gasto con su soporte y su N.° de factura contable.  ' +
    'No se escribe a mano: los cambios se hacen en la app.').setFontStyle('italic').setFontSize(9).setWrap(true);
  h.setRowHeight(7, 36);
  [['B9:C9', 'Proyecto:'], ['B10:C10', 'Ingeniero a cargo:'], ['K9:M9', 'Razón social:'], ['K10:M10', 'Técnicos asignados:']].forEach(function (x) {
    h.getRange(x[0]).merge().setValue(x[1]).setFontWeight('bold');
  });
  ['D9:J9', 'D10:J10', 'N9:S9', 'N10:S10'].forEach(function (a1) { caja(a1).setBackground('#F2F2F2'); });
  const res = [['B12:C12', 'B13:C13', 'PRESUPUESTADO'], ['D12:E12', 'D13:E13', 'ENTREGADO'], ['G12:H12', 'G13:H13', 'LEGALIZADO'],
    ['I12:K12', 'I13:K13', 'SALDO DEL PRESUPUESTO\n(presupuestado − legalizado)'], ['M12:O12', 'M13:O13', 'POR LEGALIZAR\n(entregado − legalizado)'],
    ['P12:Q12', 'P13:Q13', '% EJECUTADO'], ['R12:S12', 'R13:S13', 'ACTUALIZADO']];
  res.forEach(function (x) {
    caja(x[0], x[2]).setBackground('#1A1A1A').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(8).setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
    caja(x[1]).setBackground('#F2F2F2').setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');
  });
  h.setRowHeight(12, 32); h.setRowHeight(13, 26);
  [['B15:E15', '1. PRESUPUESTADO'], ['G15:K15', '2. ENTREGADO'], ['M15:S15', '3. LEGALIZADO']].forEach(function (x) {
    caja(x[0], x[1]).setBackground('#1A1A1A').setFontColor('#FFB41D').setFontWeight('bold').setHorizontalAlignment('center');
  });
  h.getRange('B16:E16').setValues([['N.°', 'Concepto', 'Detalle', 'Valor presupuestado']]);
  h.getRange('G16:K16').setValues([['Fecha de entrega', 'N.° solicitud', 'Trabajador que recibió la plata', 'Objeto del viaje', 'Valor entregado']]);
  h.getRange('M16:S16').setValues([['Fecha', 'N.° solicitud / soporte', 'N.° factura contable', 'Tercero (proveedor / NIT)', 'Concepto', 'Trabajador', 'Valor legalizado']]);
  h.getRangeList(['B16:E16', 'G16:K16', 'M16:S16']).setBackground('#E7E6E6').setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center')
    .setVerticalAlignment('middle').setWrap(true).setBorder(true, true, true, true, true, true, '#808080', SpreadsheetApp.BorderStyle.SOLID);
  h.setRowHeight(16, 34);
  h.setFrozenRows(16);
  h.getRange('A1:S200').setFontFamily('Arial');
}

// Datos del proyecto: presupuesto (líneas), entregas (solicitudes aprobadas) y legalización (gastos)
function datosControl_(ss, nombre) {
  const N = nombre.toUpperCase();
  const lineas = leerLineasPresupuesto_(ss)[N] || [];
  const presu = leerPresupuestos_(ss)[N] || {};
  const pres = lineas.length ? lineas.map(function (l) { return [l.concepto, l.detalle, l.valor]; })
    : (presu.presupuesto > 0 ? [['Presupuesto general', 'Sin detalle por conceptos', presu.presupuesto]] : []);
  const ent = [], leg = [];
  const reg = ss.getSheetByName(HOJA_REG), objetos = {};
  if (reg && reg.getLastRow() >= 2) reg.getRange(2, 1, reg.getLastRow() - 1, REG.length).getValues().forEach(function (d) { objetos[String(d[C.id - 1])] = String(d[C.obj - 1] || ''); });
  leerEntregas_(ss).forEach(function (e) {
    if (e.estado !== 'Entregado' || e.proy.toUpperCase() !== N) return;
    ent.push([e.fecha, e.sol, e.recibe, (objetos[e.sol] || '') + (e.detalle && e.detalle !== 'Anticipo inicial' ? ' · ' + e.detalle : ''), e.valor]);
  });
  const hg = ss.getSheetByName(HOJA_GASTOS);
  if (hg && hg.getLastRow() >= 2) {
    hg.getRange(2, 1, hg.getLastRow() - 1, GAS.length).getValues().forEach(function (g) {
      if (!g[0] || norm_(g[4]).toUpperCase() !== N) return;
      leg.push([g[2], String(g[0]) + (g[7] ? ' / ' + g[7] : ''), String(g[14] || ''), String(g[6] || ''), String(g[5] || ''), String(g[3] || ''), Number(g[8]) || 0]);
    });
  }
  return { pres: pres, ent: ent, leg: leg };
}

function llenarControlProyecto_(ss, nombre) {
  return null; // DESACTIVADO 11/11/2026: no crear "Control de viáticos - <proyecto>"; solo se genera el formato de cada solicitud
  const proy = buscar_(leerProyectos_(ss), nombre);
  if (!proy) return null;
  const h = hojaControl_(ss, proy.nombre);
  const dat = datosControl_(ss, proy.nombre);
  const suma = function (a, i) { return a.reduce(function (t, x) { return t + (Number(x[i]) || 0); }, 0); };
  const tp = suma(dat.pres, 2), te = suma(dat.ent, 4), tl = suma(dat.leg, 6);
  // Datos del proyecto y resumen
  let razon = '';
  intentar_(function () {
    const hp = ss.getSheetByName(HOJA_PROY), tit = hp.getRange(1, 1, 1, hp.getLastColumn()).getValues()[0];
    const k = tit.map(function (x) { return String(x).toLowerCase(); }).indexOf('razón social');
    if (k > -1) razon = String(hp.getRange(proy.fila, k + 1).getValue() || '');
  });
  const tec = tecnicosDe_(proy, leerTrabajadores_(ss)).join(', ');
  h.getRange('D9').setValue(proy.nombre); h.getRange('D10').setValue(proy.jefe || '');
  h.getRange('N9').setValue(razon); h.getRange('N10').setValue(tec);
  h.getRange('B13').setValue(tp || 0); h.getRange('D13').setValue(te); h.getRange('G13').setValue(tl);
  h.getRange('I13').setValue(tp ? tp - tl : 'Sin presupuesto'); h.getRange('M13').setValue(te - tl);
  h.getRange('P13').setValue(tp ? tl / tp : ''); h.getRange('R13').setValue(fmt_(new Date(), 'dd/MM/yyyy HH:mm'));
  h.getRangeList(['B13', 'D13', 'G13', 'I13', 'M13']).setNumberFormat('$ #,##0;[Red]-$ #,##0'); h.getRange('P13').setNumberFormat('0%');
  h.getRange('R13').setFontSize(9);

  // Tres bloques, lado a lado: se borra de la fila 17 hacia abajo y se vuelve a escribir
  const n = Math.max(10, dat.pres.length, dat.ent.length, dat.leg.length);
  const alto = h.getMaxRows() - CTL_FILA + 1;
  if (alto > 0) { const viejo = h.getRange(CTL_FILA, 1, alto, 20); viejo.breakApart(); viejo.clear(); }
  const necesarias = CTL_FILA + n + 40;
  if (h.getMaxRows() < necesarias) h.insertRowsAfter(h.getMaxRows(), necesarias - h.getMaxRows());
  const filas = [];
  for (let i = 0; i < n; i++) {
    const p = dat.pres[i] || ['', '', ''], e = dat.ent[i] || ['', '', '', '', ''], l = dat.leg[i] || ['', '', '', '', '', '', ''];
    filas.push([i + 1].concat(p, [''], e, [''], l));
  }
  const tot = CTL_FILA + n;
  filas.push(['', 'TOTAL PRESUPUESTADO', '', tp, '', '', '', '', 'TOTAL ENTREGADO', te, '', '', '', '', '', '', 'TOTAL LEGALIZADO', tl]);
  h.getRange(CTL_FILA, 2, filas.length, 18).setValues(filas);
  const borde = function (a1) { h.getRange(a1).setBorder(true, true, true, true, true, true, '#808080', SpreadsheetApp.BorderStyle.SOLID); };
  ['B' + CTL_FILA + ':E' + tot, 'G' + CTL_FILA + ':K' + tot, 'M' + CTL_FILA + ':S' + tot].forEach(borde);
  h.getRange(CTL_FILA, 2, n, 1).setFontColor('#808080').setHorizontalAlignment('center').setBackground('#F2F2F2');
  h.getRangeList(['E' + CTL_FILA + ':E' + tot, 'K' + CTL_FILA + ':K' + tot, 'S' + CTL_FILA + ':S' + tot]).setNumberFormat('$ #,##0');
  h.getRangeList(['G' + CTL_FILA + ':G' + tot, 'M' + CTL_FILA + ':M' + tot]).setNumberFormat('dd/mm/yyyy').setHorizontalAlignment('center');
  h.getRange(CTL_FILA, 2, n, 18).setFontSize(9).setVerticalAlignment('middle');
  h.getRangeList(['B' + tot + ':E' + tot, 'G' + tot + ':K' + tot, 'M' + tot + ':S' + tot]).setBackground('#F2F2F2').setFontWeight('bold');
  h.getRangeList(['C' + tot, 'J' + tot, 'R' + tot]).setHorizontalAlignment('right');

  // Plata entregada y legalizada por trabajador
  const r1 = tot + 2, porT = {};
  dat.ent.forEach(function (e) { (porT[e[2]] = porT[e[2]] || [0, 0])[0] += e[4]; });
  dat.leg.forEach(function (l) { if (l[5]) (porT[l[5]] = porT[l[5]] || [0, 0])[1] += l[6]; });
  const nombres = Object.keys(porT).sort();
  h.getRange('B' + r1 + ':K' + r1).merge().setValue('PLATA ENTREGADA Y LEGALIZADA POR TRABAJADOR').setBackground('#1A1A1A').setFontColor('#FFB41D')
    .setFontWeight('bold').setHorizontalAlignment('center');
  const filasT = [['Trabajador', '', '', 'Entregado', '', 'Legalizado', '', 'Por legalizar (entregado − legalizado)', '', '']];
  nombres.forEach(function (k) { filasT.push([k, '', '', porT[k][0], '', porT[k][1], '', porT[k][0] - porT[k][1], '', '']); });
  if (!nombres.length) filasT.push(['Todavía no hay entregas ni gastos en este proyecto.', '', '', '', '', '', '', '', '', '']);
  h.getRange(r1 + 1, 2, filasT.length, 10).setValues(filasT);
  for (let i = 0; i < filasT.length; i++) {
    const r = r1 + 1 + i;
    h.getRange('B' + r + ':D' + r).merge(); h.getRange('G' + r + ':H' + r).merge(); h.getRange('I' + r + ':K' + r).merge();
  }
  h.getRange('B' + (r1 + 1) + ':K' + (r1 + 1)).setBackground('#E7E6E6').setFontWeight('bold').setHorizontalAlignment('center').setFontSize(9);
  borde('B' + (r1 + 1) + ':K' + (r1 + filasT.length));
  h.getRangeList(['E' + (r1 + 2) + ':E' + (r1 + filasT.length), 'G' + (r1 + 2) + ':G' + (r1 + filasT.length), 'I' + (r1 + 2) + ':I' + (r1 + filasT.length)])
    .setNumberFormat('$ #,##0;[Red]-$ #,##0');
  // Firmas
  const rs = r1 + filasT.length + 4;
  h.getRange('B' + rs + ':E' + rs).merge().setValue('Elaborado por (ingeniero a cargo)').setFontWeight('bold').setHorizontalAlignment('center')
    .setBorder(true, null, null, null, null, null, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  h.getRange('M' + rs + ':S' + rs).merge().setValue('Revisado por (gerencia)').setFontWeight('bold').setHorizontalAlignment('center')
    .setBorder(true, null, null, null, null, null, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  h.getRange('B' + (rs + 1)).setValue('Nombre: ' + (proy.jefe || '')); h.getRange('M' + (rs + 1)).setValue('Nombre:');
  SpreadsheetApp.flush();
  return h;
}

// Hojas "Resumen" (todos los proyectos) y "Por trabajador" (lo entregado a cada uno y lo que le falta relacionar)
function llenarResumenControl_(ss) {
  return; // DESACTIVADO 11/11/2026: no crear el libro "Resumen de viáticos por proyecto"
  const libro = libroControl_(ss), props = PropertiesService.getScriptProperties();
  const reg = ss.getSheetByName(HOJA_REG), hg = ss.getSheetByName(HOJA_GASTOS);
  const filas = reg && reg.getLastRow() >= 2 ? reg.getRange(2, 1, reg.getLastRow() - 1, REG.length).getValues() : [];
  const gastos = hg && hg.getLastRow() >= 2 ? hg.getRange(2, 1, hg.getLastRow() - 1, GAS.length).getValues() : [];
  const presu = leerPresupuestos_(ss), por = {}, trab = {};
  const P = function (n) { const k = norm_(n).toUpperCase(); return por[k] = por[k] || { e: 0, l: 0, f: 0 }; };
  entregasHechas_(filas, leerEntregas_(ss)).forEach(function (x) {
    const p = P(x.proy); p.e += x.valor; p.f += x.falta;
    const k = x.recibe.toUpperCase() + '|' + x.proy;
    const t = trab[k] = trab[k] || { quien: x.recibe, proy: x.proy, n: 0, e: 0, l: 0, f: 0 };
    t.n++; t.e += x.valor; t.l += x.legalizado; t.f += x.falta;
  });
  gastos.forEach(function (x) { if (x[0]) P(x[4]).l += Number(x[8]) || 0; });

  // Resumen
  const r = libro.getSheetByName('Resumen') || libro.insertSheet('Resumen', 0);
  r.clear();
  r.getRange('A1').setValue('CONTROL DE VIÁTICOS POR PROYECTO - SOCIAL SOLAR S.A.S').setFontWeight('bold').setFontSize(14);
  r.getRange('A2').setValue('Lo arma el sistema de viáticos con cada cambio en la app. Actualizado: ' + fmt_(new Date(), 'dd/MM/yyyy HH:mm') +
    '. El formato de cada proyecto está en su carpeta de Drive ("Control de viáticos - …"); "Por trabajador" muestra lo que se le entregó a cada uno.').setFontStyle('italic').setFontColor('#666666');
  const tit = ['Proyecto', 'Ingeniero a cargo', 'Presupuestado', 'Entregado', 'Legalizado', 'Saldo del presupuesto', 'Por relacionar', '% ejecutado', 'Formato del proyecto'];
  const datos = [];
  leerProyectos_(ss).forEach(function (p) {
    const k = p.nombre.toUpperCase(), x = por[k] || { e: 0, l: 0, f: 0 }, pr = (presu[k] || {}).presupuesto || 0;
    const url = urlControl_(p.nombre);
    datos.push([p.nombre, p.jefe || '', pr || '', x.e, x.l, pr ? pr - x.l : '', x.f, pr ? x.l / pr : '',
      url ? '=HYPERLINK("' + url + '";"Abrir")' : '']);
  });
  const sum = function (i) { return datos.reduce(function (t, d) { return t + (Number(d[i]) || 0); }, 0); };
  datos.push(['TOTAL', '', sum(2), sum(3), sum(4), sum(2) ? sum(2) - sum(4) : '', sum(6), sum(2) ? sum(4) / sum(2) : '', '']);
  r.getRange(4, 1, 1, tit.length).setValues([tit]).setFontWeight('bold').setBackground('#1A1A1A').setFontColor('#FFFFFF').setWrap(true).setVerticalAlignment('middle');
  r.getRange(5, 1, datos.length, tit.length).setValues(datos);
  r.getRange(5, 3, datos.length, 5).setNumberFormat('$ #,##0;[Red]-$ #,##0'); r.getRange(5, 8, datos.length, 1).setNumberFormat('0%');
  r.getRange(4 + datos.length, 1, 1, tit.length).setFontWeight('bold').setBackground('#FFE7B0');
  r.getRange(4, 1, datos.length + 1, tit.length).setBorder(true, true, true, true, true, true, '#BFBFBF', SpreadsheetApp.BorderStyle.SOLID);
  intentar_(function () { r.setColumnWidth(1, 260); r.setColumnWidth(2, 170); [3, 4, 5, 6, 7].forEach(function (c) { r.setColumnWidth(c, 130); }); r.setFrozenRows(4); });

  // Por trabajador: una fila por trabajador y proyecto, con el subtotal de cada trabajador
  const t = libro.getSheetByName('Por trabajador') || libro.insertSheet('Por trabajador', 1);
  t.clear();
  t.getRange('A1').setValue('PLATA ENTREGADA POR TRABAJADOR').setFontWeight('bold').setFontSize(14);
  t.getRange('A2').setValue('Si a un trabajador se le entregó plata varias veces, aquí se suma: "Por relacionar" es lo que todavía debe legalizar.')
    .setFontStyle('italic').setFontColor('#666666');
  const tt = ['Trabajador', 'Proyecto', 'N.° de entregas', 'Entregado', 'Legalizado', 'Por relacionar'];
  t.getRange(4, 1, 1, tt.length).setValues([tt]).setFontWeight('bold').setBackground('#1A1A1A').setFontColor('#FFFFFF');
  const claves = Object.keys(trab).sort(), salida = [], negritas = [];
  let actual = null, sub = null;
  const cerrar = function () { if (sub) { salida.push(['TOTAL ' + sub.quien, '', sub.n, sub.e, sub.l, sub.f]); negritas.push(salida.length); } };
  claves.forEach(function (k) {
    const x = trab[k];
    if (x.quien !== actual) { cerrar(); actual = x.quien; sub = { quien: x.quien, n: 0, e: 0, l: 0, f: 0 }; }
    salida.push([x.quien, x.proy, x.n, x.e, x.l, x.f]);
    sub.n += x.n; sub.e += x.e; sub.l += x.l; sub.f += x.f;
  });
  cerrar();
  if (!salida.length) salida.push(['Todavía no se ha entregado plata.', '', '', '', '', '']);
  t.getRange(5, 1, salida.length, tt.length).setValues(salida);
  t.getRange(5, 4, salida.length, 3).setNumberFormat('$ #,##0');
  negritas.forEach(function (i) { t.getRange(4 + i, 1, 1, tt.length).setFontWeight('bold').setBackground('#FFE7B0'); });
  t.getRange(4, 1, salida.length + 1, tt.length).setBorder(true, true, true, true, true, true, '#BFBFBF', SpreadsheetApp.BorderStyle.SOLID);
  intentar_(function () { t.setColumnWidth(1, 220); t.setColumnWidth(2, 260); [4, 5, 6].forEach(function (c) { t.setColumnWidth(c, 130); }); t.setFrozenRows(4); });
}

/* ==================== DASHBOARD: PRESUPUESTADO · ENTREGADO · LEGALIZADO ==================== */
// Hoja "Dashboard" de la hoja maestra: cifras grandes, tabla por proyecto y dos gráficas. Se calcula sola con
// fórmulas desde "Registro" y "Gastos"; el código solo pone la lista de proyectos (al sincronizar y al crear proyectos).
const HOJA_DASH = 'Dashboard';
const DASH_T0 = 10;                                   // fila del encabezado de la tabla
const DASH_COLORES = ['#2F6FB0', '#E8A317', '#3A9A5B']; // presupuestado, entregado, legalizado (validados para daltonismo)
function dashboard_(ss) {
  let d = ss.getSheetByName(HOJA_DASH);
  const nueva = !d;
  if (nueva) {
    d = ss.insertSheet(HOJA_DASH, 0);
    d.setHiddenGridlines(true);
    [260, 130, 130, 130, 150, 110, 110].forEach(function (w, i) { d.setColumnWidth(i + 1, w); });
    d.getRange('A1').setValue('DASHBOARD DE VIÁTICOS').setFontSize(16).setFontWeight('bold');
    d.getRange('A2:G2').merge().setValue('Compara por proyecto lo PRESUPUESTADO (solicitudes no rechazadas), lo ENTREGADO (solicitudes aprobadas) y lo LEGALIZADO ' +
      '(gastos registrados). Se calcula solo desde "' + HOJA_REG + '" y "' + HOJA_GASTOS + '": no escribir en esta hoja.')
      .setFontStyle('italic').setFontSize(9).setFontColor('#666666').setWrap(true);
    d.setRowHeight(2, 32);
    d.getRange(DASH_T0, 1, 1, 7).setValues([['Proyecto', 'Presupuestado', 'Entregado', 'Legalizado', 'Por relacionar (entregado − legalizado)',
      '% entregado de lo presupuestado', '% legalizado de lo entregado']])
      .setBackground(NEGRO).setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(9).setWrap(true).setHorizontalAlignment('center').setVerticalAlignment('middle');
    d.setRowHeight(DASH_T0, 36);
    d.getRange('A7').setValue('La tabla trae las cifras exactas de cada proyecto; las gráficas están a la derecha.').setFontStyle('italic').setFontSize(9).setFontColor('#666666');
  }
  // Lista de proyectos (se rehace; las fórmulas usan el nombre de cada fila)
  const proy = leerProyectos_(ss).map(function (p) { return p.nombre; });
  const f0 = DASH_T0 + 1, n = Math.max(proy.length, 1), f1 = f0 + n - 1, tot = f1 + 1;
  const viejo = d.getMaxRows() - f0 + 1;
  if (viejo > 0) d.getRange(f0, 1, viejo, 7).clear();
  const R = HOJA_REG, G = HOJA_GASTOS, filas = [];
  for (let i = 0; i < n; i++) {
    const r = f0 + i;
    filas.push([proy[i] || '',
      '=IF($A' + r + '="";"";SUMIFS(' + R + '!$J:$J;' + R + '!$E:$E;$A' + r + ';' + R + '!$O:$O;"<>Rechazado"))',
      '=IF($A' + r + '="";"";SUMIFS(' + HOJA_ENT + '!$F:$F;' + HOJA_ENT + '!$D:$D;$A' + r + ';' + HOJA_ENT + '!$H:$H;"Entregado"))',
      '=IF($A' + r + '="";"";SUMIFS(' + G + '!$I:$I;' + G + '!$E:$E;$A' + r + '))',
      '=IF($A' + r + '="";"";C' + r + '-D' + r + ')',
      '=IF(N(B' + r + ')=0;"";C' + r + '/B' + r + ')',
      '=IF(N(C' + r + ')=0;"";D' + r + '/C' + r + ')']);
  }
  filas.push(['TOTAL', '=SUM(B' + f0 + ':B' + f1 + ')', '=SUM(C' + f0 + ':C' + f1 + ')', '=SUM(D' + f0 + ':D' + f1 + ')', '=SUM(E' + f0 + ':E' + f1 + ')',
    '=IF(N(B' + tot + ')=0;"";C' + tot + '/B' + tot + ')', '=IF(N(C' + tot + ')=0;"";D' + tot + '/C' + tot + ')']);
  d.getRange(f0, 1, filas.length, 7).setValues(filas);
  intentar_(function () {
    d.getRange(f0, 2, filas.length, 4).setNumberFormat('$ #,##0;[Red]-$ #,##0');
    d.getRange(f0, 6, filas.length, 2).setNumberFormat('0%');
    d.getRange(f0, 1, n, 1).setFontSize(9);
    d.getRange(DASH_T0, 1, filas.length + 1, 7).setBorder(true, true, true, true, true, true, '#D9D9D9', SpreadsheetApp.BorderStyle.SOLID);
    d.getRange(tot, 1, 1, 7).setBackground('#FFE7B0').setFontWeight('bold');
    d.setFrozenRows(DASH_T0);
  });
  // Cifras grandes
  const tarjetas = [['A', 'PRESUPUESTADO', 'B', DASH_COLORES[0]], ['B', 'ENTREGADO', 'C', DASH_COLORES[1]], ['C', 'LEGALIZADO', 'D', DASH_COLORES[2]],
    ['D', 'POR RELACIONAR', 'E', null], ['E', '% ENTREGADO', 'F', null], ['F', '% LEGALIZADO', 'G', null]];
  tarjetas.forEach(function (t) {
    d.getRange(t[0] + '4').setValue(t[1]).setFontSize(8).setFontWeight('bold').setFontColor('#595959').setHorizontalAlignment('center').setBackground('#F2F2F2');
    d.getRange(t[0] + '5').setFormula('=' + t[2] + tot).setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#F2F2F2')
      .setNumberFormat(t[1].charAt(0) === '%' ? '0%' : '$ #,##0;[Red]-$ #,##0');
    if (t[3]) intentar_(function () { d.getRange(t[0] + '4').setBorder(true, null, null, null, null, null, t[3], SpreadsheetApp.BorderStyle.SOLID_THICK); });
  });
  d.setRowHeight(5, 34);
  // Gráficas: se rehacen para que tomen todas las filas
  intentar_(function () {
    d.getCharts().forEach(function (c) { d.removeChart(c); });
    d.insertChart(d.newChart().setChartType(Charts.ChartType.COLUMN)
      .addRange(d.getRange(DASH_T0, 2, 1, 3)).addRange(d.getRange(tot, 2, 1, 3))
      .setTransposeRowsAndColumns(true).setNumHeaders(1)
      .setOption('title', 'Total: presupuestado vs. entregado vs. legalizado').setOption('legend', { position: 'none' })
      .setOption('colors', DASH_COLORES).setOption('vAxis', { format: '$#,##0' })
      .setPosition(1, 9, 0, 0).setOption('width', 620).setOption('height', 300).build());
    d.insertChart(d.newChart().setChartType(Charts.ChartType.BAR)
      .addRange(d.getRange(DASH_T0, 1, n + 1, 4)).setNumHeaders(1)
      .setOption('title', 'Por proyecto').setOption('legend', { position: 'bottom' })
      .setOption('colors', DASH_COLORES).setOption('hAxis', { format: '$#,##0' })
      .setPosition(18, 9, 0, 0).setOption('width', 620).setOption('height', Math.max(320, 26 * n + 80)).build());
  });
  return d;
}

/* ==================== AGREGAR VARIOS PROYECTOS ==================== */

function dialogoProyectos() {
  const ui = soloAdmin_();
  if (!instalado_()) { ui.alert('Primero usa "1. Instalar sistema".'); return; }
  // Llave de un solo uso: sin ella nadie puede llamar "agregarProyectos" desde fuera de este cuadro
  const llave = Utilities.getUuid();
  CacheService.getScriptCache().put('ADM_' + llave, '1', 1800);
  const html = '<div style="font-family:Arial;font-size:13px">' +
    '<p style="margin:0 0 6px"><b>Un proyecto por línea.</b> Puedes pegar la lista desde Excel.<br>' +
    'Si un proyecto tiene otro jefe, escríbelo así: <i>Proyecto ; Nombre del jefe ; correo</i></p>' +
    '<textarea id="lista" style="width:100%;height:170px;font-size:13px" placeholder="00525.MARIO GONZALES F2&#10;00526.OTRO PROYECTO"></textarea>' +
    '<p style="margin:10px 0 4px">Jefe inmediato para todos (opcional)</p>' +
    '<input id="jefe" style="width:48%" placeholder="Nombre del jefe"> <input id="correo" style="width:48%" placeholder="correo@empresa.com">' +
    '<p><button id="crear" style="padding:8px 16px;background:' + AMARILLO + ';border:0;border-radius:6px;font-weight:bold;cursor:pointer">Crear proyectos</button> ' +
    '<span id="estado"></span></p></div>' +
    '<script>document.getElementById("crear").onclick=function(){var b=this,e=document.getElementById("estado");b.disabled=true;' +
    'e.textContent="Creando carpetas…";google.script.run.withSuccessHandler(function(m){e.textContent=m;b.disabled=false;document.getElementById("lista").value="";})' +
    '.withFailureHandler(function(x){e.textContent=x.message;b.disabled=false;})' +
    '.agregarProyectos("' + llave + '",document.getElementById("lista").value,document.getElementById("jefe").value,document.getElementById("correo").value);};<\/script>';
  ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(380), 'Agregar varios proyectos');
}

// Crea de una vez la fila en "Proyectos" y la carpeta en Drive de cada proyecto de la lista
function agregarProyectos(llave, textoLista, jefeComun, correoComun) {
  if (!llave || !CacheService.getScriptCache().get('ADM_' + String(llave))) {
    throw new Error('Esta ventana venció. Ciérrala y vuelve a abrir Viáticos > Agregar varios proyectos.');
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const correoPorDefecto = String(correoComun || '').trim().toLowerCase();
  if (correoPorDefecto && !esCorreo_(correoPorDefecto)) throw new Error('El correo del jefe no es válido.');
  const hoja = ss.getSheetByName(HOJA_PROY);
  const existentes = leerProyectos_(ss).map(function (p) { return p.nombre.toUpperCase(); });
  const nuevos = [];
  let repetidos = 0;
  String(textoLista || '').split(/\r?\n/).forEach(function (linea) {
    const partes = linea.split(/\t|;/).map(function (x) { return txt_(x, 120); });
    const nombre = partes[0];
    if (!nombre) return;
    const correoJefe = String(partes[2] || correoPorDefecto).toLowerCase();
    if (correoJefe && !esCorreo_(correoJefe)) throw new Error('Correo no válido en la línea de "' + nombre + '".');
    if (existentes.indexOf(nombre.toUpperCase()) > -1) { repetidos++; return; }
    existentes.push(nombre.toUpperCase());
    nuevos.push([nombre, partes[1] || txt_(jefeComun, 120), correoJefe]);
  });
  if (!nuevos.length) throw new Error(repetidos ? 'Todos esos proyectos ya existen.' : 'Escribe al menos un proyecto.');

  hoja.getRange(Math.max(hoja.getLastRow(), 1) + 1, 1, nuevos.length, 3).setValues(nuevos);
  SpreadsheetApp.flush();
  nuevos.forEach(function (p) {
    const carpeta = carpetaProyecto_(ss, p[0]);
    if (p[2]) {
      try { carpeta.addViewer(p[2]); } catch (err) {} // el jefe solo ve la carpeta de su proyecto
    }
  });

  intentar_(function () { presupuesto_(ss); });
  return nuevos.length + (nuevos.length === 1 ? ' proyecto creado' : ' proyectos creados') + ' con su carpeta.' +
    (repetidos ? ' ' + repetidos + ' ya existían y se omitieron.' : '');
}

/* ================= ELEGIR LA CARPETA DE DRIVE ================= */

// Hace que las carpetas de proyectos (con sus formatos y soportes) vivan dentro de la carpeta indicada
function elegirCarpeta() {
  const ui = soloAdmin_();
  const props = PropertiesService.getScriptProperties();
  if (!instalado_()) { ui.alert('Primero usa "1. Instalar sistema".'); return; }
  const r = ui.prompt('Carpeta de Drive para los viáticos',
    'Pega el enlace de la carpeta donde se deben guardar los proyectos:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const m = /[-\w]{25,}/.exec(r.getResponseText());
  let destino = null;
  try { destino = DriveApp.getFolderById(m[0]); destino.getName(); } catch (err) { destino = null; }
  if (!destino) {
    ui.alert('No se pudo abrir esa carpeta. Revisa el enlace y que esta cuenta de Google tenga permiso de edición sobre ella.');
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let movidas = 0, creadas = 0;
  leerProyectos_(ss).forEach(function (p) {
    if (!p.carpetaId) return;
    try { DriveApp.getFolderById(p.carpetaId).moveTo(destino); movidas++; } catch (err) { console.error(p.nombre + ': ' + err); }
  });
  props.setProperty('ROOT_ID', destino.getId());
  leerProyectos_(ss).forEach(function (p) {
    if (!p.carpetaId) { carpetaProyecto_(ss, p.nombre); creadas++; }
  });
  ui.alert('Listo. Los viáticos se guardan ahora en "' + destino.getName() + '".\n\n' +
    'Carpetas de proyecto movidas: ' + movidas + '\nCarpetas de proyecto creadas: ' + creadas);
}

/* ============================== ENLACES ============================== */

function guardarEnlaceApp() {
  const ui = soloAdmin_();
  const r = ui.prompt('Enlace de la app de viáticos',
    'Pega aquí el enlace que te dio "Implementar > Nueva implementación" (termina en /exec):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const url = r.getResponseText().trim();
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) {
    ui.alert('Ese enlace no es válido. Debe empezar por https://script.google.com/ y terminar en /exec.');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('APP_URL', url);
  ui.alert('Enlace guardado. Desde ahora los correos a los trabajadores llevan el enlace directo a su solicitud.');
}

function mostrarEnlaces() {
  const ui = soloAdmin_();
  if (!instalado_()) { ui.alert('Primero usa "1. Instalar sistema".'); return; }
  const app = appUrl_();
  if (!app) {
    ui.alert('La app todavía no está publicada.\n\nEn Apps Script: Implementar > Nueva implementación > Aplicación web. ' +
      'Luego pega el enlace en Viáticos > 3. Guardar enlace de la app.');
    return;
  }
  dialogo_('Enlace para los trabajadores', [
    ['App de viáticos: solicitar, legalizar y aprobar (es el único enlace que se comparte)', app]
  ]);
}

function dialogo_(titulo, enlaces) {
  const html = '<div style="font-family:Arial;font-size:13px">' + enlaces.map(function (p) {
    return '<p><b>' + esc_(p[0]) + '</b><br><a href="' + esc_(p[1]) + '" target="_blank">Abrir</a></p>' +
      '<input style="width:100%" value="' + esc_(p[1]) + '" onclick="this.select()" readonly>';
  }).join('') + '</div>';
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(520).setHeight(110 * enlaces.length + 40), titulo);
}

/* ============ CONSTRUCCIÓN DEL FORMATO (si el archivo está vacío) ============ */

function intentar_(fn) {
  try { fn(); } catch (err) { console.error('Detalle de formato omitido: ' + err); }
}

function construirFormato_(ss) {
  // Solo se construye lo que falta: una hoja que ya existe (con datos reales) nunca se pisa
  const t = ss.getSheetByName(HOJA_TRAB) || construirHoja_(ss, PLANTILLA.trabajadores);
  if (hojaFormato_(ss)) return;
  const f = construirHoja_(ss, PLANTILLA.formato);

  // Listas desplegables y validaciones del formato
  intentar_(function () {
    const regla = function () { return SpreadsheetApp.newDataValidation(); };
    f.getRange('E10').setDataValidation(regla().requireValueInRange(t.getRange('A3:A42'), true).setAllowInvalid(false).build());
    const conceptos = regla().requireValueInRange(t.getRange(2, colConceptos_(t), 41, 1), true).setAllowInvalid(false).build();
    f.getRange('D19:D38').setDataValidation(conceptos);
    f.getRange('I19:I38').setDataValidation(conceptos);
    const valor = regla().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).build();
    f.getRange('F19:F38').setDataValidation(valor);
    f.getRange('J19:J38').setDataValidation(valor);
    f.getRange('C19:C38').setDataValidation(regla().requireDateOnOrAfter(new Date(2020, 0, 1)).setAllowInvalid(false).build());
  });

  // Logo
  intentar_(function () {
    const blob = Utilities.newBlob(Utilities.base64Decode(PLANTILLA.logo), 'image/png', 'logo.png');
    f.insertImage(blob, 2, 2).setWidth(107).setHeight(66);
  });

  // Quitar la hoja vacía inicial y dejar el formato de primero
  ss.getSheets().forEach(function (h) {
    if (h.getSheetId() !== t.getSheetId() && h.getSheetId() !== f.getSheetId() && h.getLastRow() === 0) {
      intentar_(function () { ss.deleteSheet(h); });
    }
  });
  intentar_(function () { ss.setActiveSheet(f); ss.moveActiveSheet(1); });
  SpreadsheetApp.flush();
}

function construirHoja_(ss, sp) {
  const h = ss.insertSheet(sp.nombre);
  if (h.getMaxRows() < sp.filas) h.insertRowsAfter(h.getMaxRows(), sp.filas - h.getMaxRows());
  if (h.getMaxColumns() < sp.cols) h.insertColumnsAfter(h.getMaxColumns(), sp.cols - h.getMaxColumns());

  // Contenido y fórmulas
  sp.celdas.forEach(function (c) {
    const celda = h.getRange(c[0]);
    const v = c[1];
    if (v !== null && typeof v === 'object') celda.setValue(new Date(v.d[0], v.d[1] - 1, v.d[2]));
    else if (typeof v === 'string' && v.charAt(0) === '=') celda.setFormula(v);
    else celda.setValue(v);
  });

  // Apariencia
  Object.keys(sp.fondo).forEach(function (color) {
    intentar_(function () { h.getRangeList(sp.fondo[color]).setBackground(color); });
  });
  sp.fuente.forEach(function (g) {
    intentar_(function () {
      h.getRangeList(g[1]).setFontFamily(g[0][0]).setFontSize(g[0][1])
        .setFontWeight(g[0][2] ? 'bold' : 'normal').setFontStyle(g[0][3] ? 'italic' : 'normal').setFontColor(g[0][4]);
    });
  });
  sp.alin.forEach(function (g) {
    intentar_(function () {
      const lista = h.getRangeList(g[1]);
      if (g[0][0]) lista.setHorizontalAlignment(g[0][0]);
      if (g[0][1]) lista.setVerticalAlignment(g[0][1]);
      if (g[0][2]) lista.setWrap(true);
    });
  });
  Object.keys(sp.numf).forEach(function (formato) {
    intentar_(function () { h.getRangeList(sp.numf[formato]).setNumberFormat(formato); });
  });
  sp.borde.forEach(function (g) {
    intentar_(function () {
      const m = g[1];
      const lado = function (letra) { return m.indexOf(letra) > -1 ? true : null; };
      const estilo = g[0] === 'medium' ? SpreadsheetApp.BorderStyle.SOLID_MEDIUM : SpreadsheetApp.BorderStyle.SOLID;
      h.getRangeList(g[2]).setBorder(lado('t'), lado('l'), lado('b'), lado('r'),
        (lado('l') || lado('r')) ? true : null, (lado('t') || lado('b')) ? true : null, '#000000', estilo);
    });
  });
  sp.merge.forEach(function (rango) {
    intentar_(function () { h.getRange(rango).merge(); });
  });
  sp.anchos.forEach(function (a) { intentar_(function () { h.setColumnWidth(a[0], a[1]); }); });
  sp.altos.forEach(function (a) { intentar_(function () { h.setRowHeight(a[0], a[1]); }); });
  intentar_(function () { h.setHiddenGridlines(true); });
  if (sp.congelar) intentar_(function () { h.setFrozenRows(sp.congelar); });
  return h;
}

// Diseño del formato de Social Solar (generado a partir del Excel original). No editar.
const PLANTILLA = {"formato":{"nombre":"Formato Legalizacion de Viatic","filas":55,"cols":11,"celdas":[["D2","SOCIAL SOLAR S.A.S"],["I2","CÓDIGO"],["J2","PR-"],["D3","NIT. 901.128.826-6"],["I3","FECHA"],["J3",{"d":[2024,1,1]}],["D4","FORMATO DE SOLICITUD Y LEGALIZACIÓN DE VIÁTICOS"],["I4","VERSIÓN"],["J4",7],["I5","PÁGINA"],["J5","1 de 1"],["B7","Instructivo:  1) Seleccione su nombre en la lista desplegable: cédula, cargo y centro de costo se completan solos.  2) Antes del viaje diligencie el bloque SOLICITUD DE VIÁTICOS (fecha, concepto, ciudad y valor que solicita).  3) Al regresar, complete en la misma fila el bloque RELACIÓN DE GASTOS con el soporte, el tercero, el concepto y el valor realmente gastado.  4) Diligencie únicamente las casillas crema; las grises se calculan solas."],["B10","Nombre del trabajador:"],["H10","Cédula:"],["J10","=IFERROR(INDEX(Trabajadores!$B$3:$B$42;MATCH($E$10;Trabajadores!$A$3:$A$42;0));\"\")"],["B11","Cargo:"],["E11","=IFERROR(INDEX(Trabajadores!$C$3:$C$42;MATCH($E$10;Trabajadores!$A$3:$A$42;0));\"\")"],["H11","Área / Centro de costo:"],["J11","=IFERROR(INDEX(Trabajadores!$D$3:$D$42;MATCH($E$10;Trabajadores!$A$3:$A$42;0));\"\")"],["B12","Proyecto:"],["H12","Ciudad(es) de destino:"],["B13","Fecha de salida:"],["H13","Fecha de regreso:"],["B14","Objeto del viaje:"],["H14","N.° de días:"],["J14","=IF(OR($E$13=\"\";$J$13=\"\");\"\";$J$13-$E$13+1)"],["B15","VALOR TOTAL SOLICITADO (anticipo):"],["E15","=SUM($F$19:$F$38)"],["H15","Fecha de la solicitud:"],["B17","SOLICITUD DE VIÁTICOS"],["G17","RELACIÓN DE GASTOS"],["B18","N.°"],["C18","Fecha"],["D18","Concepto del gasto"],["E18","Ciudad"],["F18","Valor solicitado"],["G18","N.° de soporte"],["H18","Tercero (proveedor / NIT)"],["I18","Concepto"],["J18","Valor gastado"],["K18","Observaciones"],["B19",1],["B20",2],["B21",3],["B22",4],["B23",5],["B24",6],["B25",7],["B26",8],["B27",9],["B28",10],["B29",11],["B30",12],["B31",13],["B32",14],["B33",15],["B34",16],["B35",17],["B36",18],["B37",19],["B38",20],["B39","TOTAL SOLICITADO"],["F39","=SUM(F19:F38)"],["G39","TOTAL LEGALIZADO"],["J39","=SUM(J19:J38)"],["K39","=IF(COUNTA(G19:G38)=0;\"\";COUNTA(G19:G38)&\" soporte(s)\")"],["B41","RESUMEN DE LA LEGALIZACIÓN"],["B42","Valor solicitado (anticipo):"],["E42","=$F$39"],["G42","Total legalizado:"],["J42","=$J$39"],["B43","Saldo a reintegrar por el trabajador:"],["E43","=IF($E$42-$J$42>0;$E$42-$J$42;0)"],["G43","Saldo a favor del trabajador:"],["J43","=IF($J$42-$E$42>0;$J$42-$E$42;0)"],["B44","=IF(SUMPRODUCT(($J$19:$J$38>0)*($I$19:$I$38=\"\"))=0;\"\";\"ATENCIÓN: hay \"&SUMPRODUCT(($J$19:$J$38>0)*($I$19:$I$38=\"\"))&\" gasto(s) con valor pero sin concepto. Complete la columna Concepto del bloque Relación de gastos.\")"],["B48","Firma del trabajador"],["H48","Firma del jefe inmediato"],["B49","=IF($E$10=\"\";\"Nombre:\";\"Nombre: \"&$E$10)"],["H49","Nombre:"],["B50","=IF($J$10=\"\";\"C.C.:\";\"C.C. \"&TEXT($J$10;\"#,##0\"))"],["H50","C.C.:"],["B52","Observaciones adicionales:"]],"fondo":{"#FFF7DC":["E10","J12:J13","E12:E14","J15","C19:K38","B53"],"#F2F2F2":["J10:J11","E11","J14","E15","E42:E43","J42:J43"],"#E4EDF5":["B17","B18:F18"],"#EDEDED":["G17","G18:K18"],"#D9D9D9":["B19:B38"],"#E8E8E8":["B39","F39:G39","J39:K39","B41"]},"fuente":[[["Arial",13.0,true,false,"#000000"],["D2"]],[["Arial",11.0,true,false,"#000000"],["I2:I5","D3:D4","B17","G17","B41","E43","J43"]],[["Arial",11.0,false,false,"#000000"],["J2:J5","E42","J42"]],[["Arial",9.0,false,true,"#000000"],["B7","K39"]],[["Arial",10.0,true,false,"#000000"],["B10:B15","H10:H15","B39","F39:G39","J39","B43","G43","B48","H48","B52"]],[["Arial",10.0,false,false,"#000000"],["E10:E14","J10:J15","B42","G42","B49:B50","H49:H50"]],[["Arial",12.0,true,false,"#000000"],["E15"]],[["Arial",9.0,true,false,"#000000"],["B18:K18"]],[["Arial",9.0,false,false,"#808080"],["B19:B38"]],[["Arial",9.0,false,false,"#000000"],["C19:K38"]],[["Arial",9.0,true,false,"#C00000"],["B44"]]],"alin":[[["center","middle",true],["D2:D4","I2:J5","J10:J15","B17","G17","B18:K18","B19:C38","G19:G38","K39","B41","B48","H48"]],[["left","middle",true],["B7","E10:E14","B10:B15","H10:H15","D19:E38","H19:I38","K19:K38","B44","B49:B50","H49:H50","B52"]],[["right","middle",false],["E15","F19:F39","J19:J39","E42:E43","J42:J43"]],[["right","middle",true],["B39","G39","B42:B43","G42:G43"]],[["left","top",true],["B53"]]],"borde":[["thin","tlbr",["B2","D2:D4","I2:J5","B7","E10:E15","J10:J15","B17","B18:F38","H18:K38","B39","F39","J39:K39","B41:B43","E42:E43","G42:G43","J42:J43","B53"]],["thin","tr",["C2","H4","K53"]],["thin","tb",["E2:G3","C7:J7","F10:F15","C17:E17","H17:J17","C39:D39","H39","C41:J41","C42:C43","H42:H43"]],["thin","tbr",["H2:H3","K2:K5","K7","G10:G15","K10:K15","F17:G17","K17","G18:G39","E39","I39","K41:K43","D42:D43","F42:F43","I42:I43"]],["thin","l",["B3:B4","B54"]],["thin","r",["C3:C4","K54"]],["thin","t",["E4:G4","C53:J53"]],["thin","lb",["B5","D5","B55"]],["thin","br",["C5","H5","K55"]],["thin","b",["E5:G5","B47:E47","H47:K47","C55:J55"]],["medium","l",["G17:G39"]]],"numf":{"dd/mm/yyyy":["J3","E13","J13","J15","C19:C38"],"\"$ \"#,##0;\"-$ \"#,##0;\"$ -\"":["E15","F19:F39","J19:J39","E42:E43","J42:J43"]},"merge":["B10:D10","B11:D11","B12:D12","B13:D13","B14:D14","B15:D15","B17:F17","B2:C5","B39:E39","B41:K41","B42:D42","B43:D43","B44:K44","B47:E47","B48:E48","B49:E49","B50:E50","B52:K52","B53:K55","B7:K7","D2:H2","D3:H3","D4:H5","E10:G10","E11:G11","E12:G12","E13:G13","E14:G14","E15:G15","E42:F42","E43:F43","G17:K17","G39:I39","G42:I42","G43:I43","H10:I10","H11:I11","H12:I12","H13:I13","H14:I14","H15:I15","H47:K47","H48:K48","H49:K49","H50:K50","J10:K10","J11:K11","J12:K12","J13:K13","J14:K14","J15:K15","J2:K2","J3:K3","J42:K42","J43:K43","J4:K4","J5:K5"],"anchos":[[1,19],[2,33],[3,82],[4,145],[5,89],[6,96],[7,82],[8,177],[9,145],[10,96],[11,145]],"altos":[[2,26],[3,26],[4,26],[5,26],[7,53],[9,8],[10,26],[11,26],[12,26],[13,26],[14,26],[15,40],[16,8],[17,26],[18,40],[19,50],[20,50],[21,50],[22,50],[23,50],[24,50],[25,50],[26,50],[27,50],[28,50],[29,50],[30,24],[31,24],[32,24],[33,24],[34,24],[35,24],[36,24],[37,24],[38,24],[39,26],[41,26],[42,29],[43,29],[44,18],[46,42],[48,20],[49,20],[50,20],[52,20]],"congelar":0},"trabajadores":{"nombre":"Trabajadores","filas":52,"cols":6,"celdas":[["A1","MAESTRO DE TRABAJADORES  —  alimenta las listas del formato"],["F1","CONCEPTOS DE GASTO"],["A2","Nombre del trabajador"],["B2","Cédula"],["C2","Cargo"],["D2","Área / Centro de costo"],["F2","Transporte intermunicipal"],["A3","ANDRES NUVAN"],["B3",1010101010],["C3","COMERCIAL"],["D3","COMERCIAL"],["F3","Transporte urbano / taxi"],["A4","FABIAN MESA"],["B4",1053610962],["C4","COORDINADOR DE PROYECTOS"],["D4","INGENIERIA"],["F4","Combustible"],["A5","ANTONIO PUENTES"],["B5",1055272992],["C5","INGENIERO DE SOPORTE"],["D5","INGENIERIA"],["F5","Peajes"],["F6","Parqueadero"],["F7","Alimentación"],["F8","Hospedaje"],["F9","Papelería"],["F10","Otros"],["A45","Cómo mantener este maestro:\n• Escriba un trabajador por fila, sin dejar filas vacías intermedias. El nombre aparecerá en la lista desplegable del formato y la cédula, el cargo y el centro de costo se completarán solos.\n• La fila 3 trae datos de ejemplo (la cédula 1.010.101.010 es ficticia); reemplácela por información real.\n• Para ampliar el maestro más allá de 40 trabajadores, edite el rango del nombre definido LISTA_TRABAJADORES en Fórmulas ▸ Administrador de nombres.\n• Los conceptos de la columna F alimentan las dos listas desplegables del formato: la del bloque Solicitud de viáticos y la del bloque Relación de gastos. Agregue o modifique conceptos aquí."]],"fondo":{"#EDEDED":["A1","F1"],"#D9D9D9":["A2:D2"],"#FFF7DC":["F2:F10","A3:D42"]},"fuente":[[["Arial",11.0,true,false,"#000000"],["A1","F1"]],[["Arial",10.0,true,false,"#000000"],["A2:D2"]],[["Arial",10.0,false,false,"#000000"],["F2:F10","A3:D42"]],[["Arial",9.0,false,false,"#000000"],["A45"]]],"alin":[[["left","middle",true],["A1","F2:F10","A3:A42","C3:D42"]],[["center","middle",true],["F1","A2:D2","B3:B42"]],[["left","top",true],["A45"]]],"borde":[["thin","tlbr",["A1","F1:F10","A2:D42","A45"]],["thin","tb",["B1:C1"]],["thin","tbr",["D1"]],["thin","t",["B45:C45"]],["thin","tr",["D45"]],["thin","l",["A46:A51"]],["thin","r",["D46:D51"]],["thin","lb",["A52"]],["thin","b",["B52:C52"]],["thin","br",["D52"]]],"numf":{"#,##0":["B3:B42"]},"merge":["A1:D1","A45:D52"],"anchos":[[1,229],[2,117],[3,173],[5,26],[6,215]],"altos":[[1,20],[3,22],[4,22],[5,22],[6,22],[7,22],[8,22],[9,22],[10,22],[11,22],[12,22],[13,22],[14,22],[15,22],[16,22],[17,22],[18,22],[19,22],[20,22],[21,22],[22,22],[23,22],[24,22],[25,22],[26,22],[27,22],[28,22],[29,22],[30,22],[31,22],[32,22],[33,22],[34,22],[35,22],[36,22],[37,22],[38,22],[39,22],[40,22],[41,22],[42,22],[45,20],[46,20],[47,20],[48,20],[49,20],[50,20],[51,20],[52,20]],"congelar":2},"logo":"iVBORw0KGgoAAAANSUhEUgAAATgAAADDCAMAAAAhg/02AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAALNUExURQAAAP//AP+zHP+0Hf6zHP2zG/yyG/6zG/2zGv60HP60HP+qDP+1Gf+zG/2zG/20G/+SAP6zHP2xGf6zG/2zG/+AAP+zAP6zHP+vGf+4Dv8AAP+qAP2zGv60Hf+0G/60HP+2Gv+zFwAAAAAAAPuvG/yzHAAAAP+2Ev6zHAAAAP21HAAAAAAAAAAAAP+0Gf+yHf21HQAAAAAAAP6wHP+qAP2zHf2yGv+1GwAAAAAAAAAAAAAAAAAAAAAAAAAAAP+0G/6yHP+0GgAAAAAAAAAAAAAAAAAAAAAAAP21G/6zG/2zHP2xGv6zGwAAAP6xG/6zG/+zGgAAAAAAAAAAAP2xGf+2Gv2zGwAAAAAAAAAAAAAAAAAAAP61HP+yGwAAAP2xGf6zHAAAAAAAAAAAAAAAAP2yHP+xGdWAAP+1HAAAAP+xG/2yG/6zHAAAAAAAAP6yGv+2AAAAAMeMFv6zHP2yG+ijGv6yG/6zG/60HP6zGwAAAAAAAAAAAP+zGQAAAAAAAAAAAP+2EgAAAP+AAP6zG/60G+CdGP2zG/+vFgAAAAAAAMOJFQAAAP+yGP6yGv6zHAAAAAAAAP+xGv+0F/21G/+0DwAAAP6zHP6yGv2zHf+zGP+0GQAAAP6zHP60HQAAAAAAAAAAAAAAAAAAAP+ZAP6zHP+5F/+/Ff2xG/6yHP2zGAAAAAAAAP60G/60GwAAAP+yG/+fAP+0Gv+1Gv6zHP+2Hf6zHAAAAAAAAP+0HP6zHAAAAAAAAAAAAAAAAP+wHP+qAP+5AP+xGv+uG/+wGv+dAP+0GgAAAP+zHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHNLKUAAADvdFJOUwABgP/7g8mqpav1FR98kHoH/XnrjQIKtjMSAQOJzXryMU3/wUNkVBzphKJxPIwzcan25qwMp5wmrCHq0QQ601+tYi9I+R1pIobo46T3AsruMmo//aFiqOBe+gYe4kwkb9kn3G40o1wGSFZz1v65R8EH4f/66v/q1vz2khDSUY23Gg4yBO/J/+8jCZH/6T+34wvxOyyNEcfmvZ1AegW009kYNrFbBd4WDM+1noX85NuQVghOeOpQ8+4lUtiO8qYNLQYLWCYdDViT8GvwT/61RfSelKk+c2gzNwMu3jvXXxI4lUukQH7rvvvU+GRXdI+vl5UeGQAAAAlwSFlzAAAh1QAAIdUBBJy0nQAACS1JREFUeF7tnIeXZEUVxmt95oyKAUTlmRBUXBOKWcEVZBVFBURRMWcwY8IcADNgIog5YM45J8QICibMYv4bPJXv/arqvdfdw57p7u939kzX++6tmr6/fTO707szxhBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEEEIIIYQQsiPZcolOckmskwqXUs4il8Y2orgMCpNcFrtJ4HKoCrj8FXAHMeaKV0JPFa7c4bZ1Bw21uQpuXWdQzjC4e21BMePgCWvJVdHKNPCYtQOFTAYPWjNQxwzgUevETigjczXfgbEET1sf0IQHu8zVt2CL5xrYuC6gCAv2JLDRgU3rAVroup2xRYHdFuxZB9DBBAm4Y9KmFeOa8xi41rVx17R9KwR6w3oT2DfL1pVg7tn1xll3Lz0LTa43z7x9mVFzXwero6jt62Ru8anVCXOesXxsxMjyjK7bBcurSZp3V6xMR3mb3/9S4Ue9LsYzosXthuUV5Hobd4sIc1haQeyY18dwTtZLHAYLcIMkbncs7WD6HpMNZycMFmGz3HJ9vwPMbSybwtwNl1DcjW68CcTdZAnF3TTdc1jZkSyhOGP22ATiTH8zTDY/m+GOW0qiuD2xMI29bo5J4BZ7YXKxccu9MQnsfStMNpIFbjn7uanv+62NvPWZK1VvLS+xS9FuuE3j6cexuu62EN9OXg+Sz6i8A3P7UNgHC6MkAXqmHBelonyHhjjcVzREGoPlGEqD4tCOPqVU18pHkAJyekcZ65Jl37KcFgLcVjQEGnPJWNcWEVcYasQj4PyeO+nYcufmJkdN3F36/q7yuiWuMZeOVW1I3N267u4qwENQUUjvAfEw90zTyrHvpSwUSvaTyf5uee+yy2/ctm2bDmRDwD3v+8TFATKNUx6oZx4SJ9qKwB8C3/hwX58epNMRxLC4FCPq6+2VckVvJcIGz/3yZEKOEmWMub+7PjgV5xKn3oPOinQYOUpau3EfINv8PSb6+gfKsq0UlswhRQQNAfukHyTWaVERkK22xJUb9XVRNubBfs9DdDpMbZRDbXiYzg632UPd0sk4Qper4kIySRxmtflEtoC4h2E57Xk4pEMcWRsFBUBYLW+0uGJ6yyM2Qhxepqx7JKYDPKrv+6Mge3R9vJiinkjVUiXKV5HWJJgJnW1x3tuQqdrRxZ5RKqPY6DGQCWH2wX/MVupoqRLlq0jlOT+2klk2vTiIHEIclixVS5UoX0Xsc35cGenEMyru8VHcE3J2sYmDWcrE4/MnDpVlKXkbFfek8kmXiefJXdc9ZUic36i3j4sLsiEdxo0m/wh9at/3TxPXCT91ffaFxFV+v/E6EQoLiHt65eyjdy2ewSjFdI3hfOWYdhnOOcpePGPi2eF3fIsKVEdkRNwz/R35LLW/1FievUs1HSSaixO1hguVZlmf4i+7Z6usuXnPYK57TgiaY4yIi/va4ureWvEgYeI4U2u4MXGw04vrpolL91x88l3XPRdbHIuKk+9E0YiHUebaw80iLnjz4lSa2jXPU+aaYwyLs9Vj7eKAUpZA7fG4byLBcALPz+aaw72g7/sXtst1cfqWG9icB4xLLDtCYUAcrkpxLxI7EnLDbLgJtxrz4r7vj8OixU89MDsqcs/SHfuSSkcNP9jQGLk+Lu6lIhXIDZl2ZZR4b7Sm8/nLWmW10Z3ln2c8FjrqvDw8/9YYNt+jKc5WX+GXrxQnZGeNUy1DtTEmiWuWC3Gv8s90JnHm1X4A+/Y1WBPjtcVV1mJTW85QbYzX+rns28Oxpm/I8kUlS9ZyvF16b90Jdn0idjTxA7yuMceguNejuDfkZVrUTrUMlMbxc72xPl5M31QvKy1OsgI7moQB7MObsZYnr4qzxbfEi32yibQ6qW3n5HZpAmEuMamu+bBatmhBGuxoIsQVg+SwKU6Tc9Gh9iTalXHihIeJUbEWl6fociqkBaI7kLemVRygMuPbclYTl31lUkH0vF3tCrxDNE3hRDmKmk9PqBK33leVU54bAN2hkM85jbtbHjxwkEgWEVf1Y/N3YjhEHqpY5hFPhWu4tP/qFeNU3ypQhbQtIabBZXea7hICquKOFdTEDZo7HbMhvINT4+IMFWcfeuJ3heRMURZa7OO7c7cx75EVWfC8103zPmPej3IcHzDGfDCsP5RrKM6WPywD98OWYkV21cTtXI8HCHPn8WuxKhljPoLFQpzs1hXJWb4cFXnSLh1bPtoqgZ7cJB9TWFP0sWo6hBykEUOpVQ6PZ5btNvl4ZVcQpzx8Im+TseWTzYoxn/IPEpt8GsV9puyzfPZztXSYPEcj7vv+86pUlL+QouoNp0qSKE6IOFpu+2LO9bgqdyVoSF0ornHLfakWjhGm+DLmX4nzfRUrjjT+10Qwpzjz9WRAc7BwI0hpKhYtLXHfsJfflG2OynYyga7rvoUZGcfehd/GkEyAH6lzQm9zQnHzwY/UOaG3OaG4OaG3+fgOxc1H911MyBS672Gy2nwfgwbFSw7Imn2gjvqIjDb+AAPiGBVH6lDcnKy2OPeKsFvI15B/mJc2Ta8l+1/hRep8SD7FmDPS0h8bX3B254stS04esTf2n3XCtFAzZ//IL4M4WYdOvzwnLuX5P079y0+c3Qo5W0dheYxbHRKCIC58K+xPYuN2/3COMT8NSZAWDnNX4uDl52fhMc8ol5afh0wWf5GvFHLrWfLSfj8HNi8154q1EHdeJUsLIUDGiOp0d5wqLzlymEJSLdM6tBnLL2WSyr+yH8CrJS5xvpSU45zlon28wP84gBi7o36t7MTO39hTzl85cZV1bUAUF66htTcm//CZ8NnQt6yLuPCHZAbEtRz35rdibX/9zl+snDiJsJFm/H143C8GdXHx8UJj/hCWvu2P4eJPKyeuYkt9/o+ERH7xUBEnl3+2a9lQHrrMxG8PABvhDkMh8SsHodFzaGo6MvxPIK3qLysnLowjx7SPf/1brsXY/UQUb+2Iv/tyarjoH/btP/9l03/7mn8Tj79g5cSZC/u+/49dSHHy631FdOHL23OL/LuL/CLfvhqw3d2cteNWnjT0Wk6/EfwXAzJMuNN4w83M/+xnroswJYQQQgghhBBCCCGEEEIIIYQQQgghhBBCCCGEELIg/wesQKePWhDTEAAAAABJRU5ErkJggg==","semilla":["00525.MARIO GONZALES F2","Fabian Mesa"]};

// Pantalla de la app de viáticos. No editar.
const APP_HTML = "<!DOCTYPE html>\n<html lang=\"es\">\n<head>\n<base target=\"_top\">\n<meta charset=\"utf-8\">\n<style>\n  * { box-sizing: border-box; }\n  [hidden] { display: none !important; }\n  body { margin: 0; font-family: -apple-system, \"Segoe UI\", Roboto, Arial, sans-serif; background: #f6f5f1; color: #1A1A1A; font-size: 16px; }\n  header { background: #fff; color: #1A1A1A; padding: 10px 16px; font-weight: 700; font-size: 16px; border-bottom: 4px solid #FFB41D; display: flex; align-items: center; gap: 14px; }\n  header img { height: 46px; width: auto; flex: none; }\n  header small { display: block; font-weight: 400; color: #5c5c5c; font-size: 13px; margin-top: 2px; }\n  main { max-width: 540px; margin: 0 auto; padding: 12px 12px 90px; }\n  .tarjeta { background: #fff; border-radius: 12px; padding: 14px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }\n  h2 { font-size: 15px; margin: 0 0 10px; color: #1A1A1A; }\n  label { display: block; font-size: 13px; color: #5c5c5c; margin: 10px 0 4px; }\n  input, select, textarea { width: 100%; font-size: 16px; padding: 11px 10px; border: 1px solid #d9d2bd; border-radius: 8px; background: #fff7dc; color: #1A1A1A; font-family: inherit; }\n  input:focus, select:focus, textarea:focus { outline: 2px solid #FFB41D; outline-offset: 1px; }\n  button:focus-visible { outline: 3px solid #1A1A1A; outline-offset: 2px; }\n  textarea { min-height: 60px; resize: vertical; }\n  .fila { display: flex; gap: 10px; } .fila > div { flex: 1; min-width: 0; }\n  .totales { display: flex; gap: 8px; }\n  .paso { background: #1A1A1A; color: #fff; padding: 10px 14px; }\n  .ppLineas { list-style: none; padding: 0; margin: 8px 0; } .ppLineas li { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid #eee5cc; }\n  .ppLineas .txt { flex: 1; min-width: 0; } .ppLineas small { display: block; color: #5c5c5c; font-size: 12px; } .ppLineas .val { font-weight: 700; white-space: nowrap; }\n  .ppNuevo { margin-top: 6px; padding-top: 6px; border-top: 1px dashed #d9d2bd; }\n  .plata { width: 100%; border-collapse: collapse; font-size: 13px; } .plata th { text-align: left; color: #5c5c5c; font-weight: 600; padding: 6px 4px; border-bottom: 2px solid #eee5cc; }\n  .plata td { padding: 8px 4px; border-bottom: 1px solid #f0ead8; vertical-align: top; } .plata td.n { text-align: right; white-space: nowrap; } .plata small { display: block; color: #5c5c5c; }\n  .ppPersonas { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; } .ppPersonas label { display: flex; align-items: center; gap: 6px; margin: 0; padding: 6px 10px; border: 1px solid #d9d2bd; border-radius: 16px; font-size: 13px; color: #1A1A1A; background: #fff; }\n  .ppPersonas input { width: auto; }\n  .paso b { display: block; color: #FFB41D; font-size: 15px; } .paso span { font-size: 13px; color: #e6e6e6; }\n  .subtitulo { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #5c5c5c; margin: 14px 4px 8px; }\n  .estado { display: inline-block; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 10px; background: #f6f5f1; }\n  .estado.Aprobado, .estado.Legalizado { background: #e3f4e5; color: #1b5e20; } .estado.Rechazado { background: #fde2e1; color: #b71c1c; }\n  .estado.Solicitado { background: #fff3cd; } .estado.En { background: #e3ecfa; color: #0d47a1; }\n  .presu { margin-top: 14px; padding-top: 10px; border-top: 1px solid #eee5cc; }\n  .avisoEquipo { display: block; margin-top: 8px; padding: 8px 10px; background: #fff3cd; border-left: 4px solid #FFB41D; border-radius: 6px; font-size: 13px; color: #1A1A1A; }\n  .total { flex: 1; background: #f6f5f1; border-radius: 10px; padding: 10px 8px; text-align: center; min-width: 0; }\n  .total span { display: block; font-size: 12px; color: #5c5c5c; }\n  .total b { display: block; font-size: 16px; margin-top: 3px; white-space: nowrap; }\n  .barra { height: 8px; background: #e9e6dd; border-radius: 4px; margin-top: 12px; overflow: hidden; }\n  .barra i { display: block; height: 100%; width: 0; background: #FFB41D; transition: width .3s; }\n  .verde { color: #2e7d32; } .rojo { color: #c62828; }\n  .datos { font-size: 13px; color: #5c5c5c; margin: 0 0 10px; line-height: 1.5; }\n  button { font-size: 16px; font-family: inherit; border: 0; border-radius: 10px; padding: 13px 14px; width: 100%; font-weight: 600; cursor: pointer; }\n  .primario { background: #FFB41D; color: #1A1A1A; } .secundario { background: #fff; color: #1A1A1A; box-shadow: inset 0 0 0 1.5px #1A1A1A; } .exito { background: #1A1A1A; color: #fff; }\n  button:disabled { opacity: .5; }\n  .foto { display: flex; align-items: center; gap: 10px; margin-top: 4px; }\n  .foto img { width: 64px; height: 64px; object-fit: cover; border-radius: 8px; border: 1px solid #d9d2bd; }\n  .check { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 14px; color: #1A1A1A; }\n  .check input { width: 20px; height: 20px; padding: 0; }\n  ul { list-style: none; margin: 0; padding: 0; }\n  li { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid #eeebe3; }\n  li:first-child { border-top: 0; }\n  li img, li .sin { width: 44px; height: 44px; border-radius: 6px; object-fit: cover; flex: none; background: #ece9e0; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #5c5c5c; }\n  li .txt { flex: 1; min-width: 0; font-size: 14px; }\n  li .txt small { display: block; color: #5c5c5c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n  li .val { font-weight: 600; white-space: nowrap; font-size: 14px; }\n  li .quitar { width: auto; padding: 6px 10px; background: #fdecea; color: #c62828; font-size: 13px; }\n  a { color: #1A1A1A; font-weight: 600; }\n  #aviso { position: fixed; left: 12px; right: 12px; bottom: 14px; max-width: 516px; margin: 0 auto; padding: 12px 14px; border-radius: 10px; color: #fff; background: #1A1A1A; font-size: 14px; }\n  #aviso.error { background: #c62828; } #aviso.bien { background: #2e7d32; }\n  .espacio { margin-top: 12px; }\n  .pestanas { display: flex; background: #ece9e0; border-radius: 12px; padding: 4px; margin-bottom: 12px; }\n  .pestanas button { flex: 1; background: transparent; color: #5c5c5c; padding: 10px 4px; font-size: 14px; border-radius: 9px; }\n  .pestanas button.activa { background: #1A1A1A; color: #FFB41D; }\n  .linea { border-top: 1px solid #eeebe3; padding: 10px 0 12px; } .linea:first-child { border-top: 0; padding-top: 0; }\n  .linea .fila { align-items: center; margin-top: 8px; } .linea .fila:first-child { margin-top: 0; }\n  .linea .quitar { width: auto; flex: none; padding: 10px 12px; background: #fdecea; color: #c62828; font-size: 13px; }\n  .totalSol { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding: 12px 14px; background: #1A1A1A; color: #fff; border-radius: 10px; }\n  .totalSol b { color: #FFB41D; font-size: 20px; }\n  .mal { color: #c62828; }\n  .pestanas { flex-wrap: wrap; }\n  .marcas { display: grid; grid-template-columns: 1fr; gap: 2px; margin-top: 4px; }\n  .marcas label { display: flex; align-items: center; gap: 10px; margin: 0; padding: 8px 6px; font-size: 14px; color: #1A1A1A; border-radius: 8px; }\n  .marcas input { width: 20px; height: 20px; padding: 0; flex: none; }\n  .marcas small { display: block; font-size: 12px; color: #5c5c5c; }\n  details { border-top: 1px solid #eeebe3; padding: 10px 0; } details:first-of-type { border-top: 0; }\n  summary { cursor: pointer; font-weight: 600; font-size: 14px; } summary small { display: block; font-weight: 400; color: #5c5c5c; margin: 2px 0 0 18px; }\n  li.dia { background: #f6f5f1; border-radius: 8px; padding: 7px 10px; margin-top: 8px; border-top: 0; font-size: 13px; font-weight: 700; justify-content: space-between; }\n  li.dia + li { border-top: 0; }\n  #hoyTxt { margin: 10px 0 0; }\n  .sesion { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px; color: #5c5c5c; margin: 0 4px 10px; }\n  .sesion span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n  .sesion button { width: auto; flex: none; padding: 6px 12px; font-size: 13px; background: #ece9e0; color: #1A1A1A; }\n  #aCodigo { font-size: 24px; letter-spacing: 6px; text-align: center; }\n  .botones { display: flex; gap: 10px; } .botones button { flex: 1; padding: 12px 8px; font-size: 15px; }\n  #camara { position: fixed; inset: 0; background: #000; z-index: 20; display: flex; flex-direction: column; }\n  #camara video { flex: 1; min-height: 0; width: 100%; object-fit: contain; background: #000; }\n  #camara .botones { padding: 14px; background: #111; }\n<\/style>\n<\/head>\n<body>\n<header><img src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAARYAAABwCAYAAADbl1+8AAAOLElEQVR42u2de4xcVR3Hf+fc6RYKFKlht92ZoVoIIJFqKFiihlQjhnRnuga0SHg0IiYKCQgl0RQiTQiihqeI/sNDCypFFLozC+EPNUQJkWDRoDE8RGBmto9NoOWx23b33uMf3ZaZu/fOPa/7mvl+kkm7M+d1zz2/7/n9zr33XCIAAAAAAAAAAAAAYApDFwAQP0IQo3rpJmLsJvW8YpZXmwsgLAD0OW6teDNn/Ebr5Xre84V1rdUQFgD6BK9WfJQx/rVE6xTub5zqxMUQFgB6TVDqpd8xYl9NLcwiMcWm9nyMrX9/EsICQI4R48uWk8cvJcZvzozACe9uzvg1rNJI3a4hLACoCEq9LHLhRZF3g1Np/RDCAgAExb6Bp+S9QFgA6EFBSVtgICwABAnKT2khrSjv68VjS0JkICwA9KiXkqa4cAwjAPpLVJI4TngsABCRVyu5jLFEJlrPnd3kjO64NQvCFpfnAmEB8FJiMmYbRuvVipOs0hqk8bIXi8gJ7w6n2toIYQEgw6KSxMJoHEJou90QFgBRMeWFhsM2k5fb9scgLhAWAFHJsHeStMDYOiZcFQL9JSg1WmRqiKzSYFkRFSIiIcRTNDN7ZpZECh4L6CtRIVb+IO8eSiLCYHis8FhA/6ApKlnzUPIgUPBYAAwl515KbOJgcOwQFgBRCaKw96PsvHff7nvPQ1NcICwAotJDXkocAqPTH1hjARCVNgPq1bUUk+MSGg5IAcMP9DVTjQJbTy46ogv1skeKwoRQCPSVt+IJ9ydOdeJ76Bdlr2U7rzRWwWMBfSwqxU22w4FeDYlkhYYRnaFSD9ZYQA/Cb+mcbcV7EBU5obEFPBYAg+l7HXbPIM/ZHukJ1oaqrLqrBo8lYQ987gPSPhFCeOgFBRFeO/GiXMKBMeky0a3WRAX9CvI/kCXWXGS8QXgs5jyDLgC9wuyM9yVXiG8ZR1foSmPuQReAXqGwcPrlQrV5n6lXA2Ex5zF0AegV2Nq3m0REQojd8FgycD7m/r2FsL4CemFAMzYIYcmOuNyIbgD9gDte2mJbWK4los/H3O7b5uoBGUfUl60SY+VYz5UYK1/rjpe3orcTnCUjrvxwwS6VceEjz22X36aJaJHp2FEMOayOW4k0O4hoWDFvGiFRIpe9vSdKj7ECu0B3UEaLleTzLFONY9h6el+3bE/QI061cVH2xTudrR/cseH7OHe+GV6Jdwobab2i67FEHdSRpH9jmOpNZTZvQlMpa9lc2scSEAaR9UHeTVR0DeFQPqW8i8rv5eGVqMrHlZE6nXUTV3QVKMFf1g2FVI1elo8bGpBJ3t0G+S+gPr67VmWgqg5qEyNIw3B78ZzZhFs2Xpk8/ySi1y3N7gWNPMcnFD6p8tm2/7/UCwNUNo+twZ9FcRH14obDoddY6fe9Ji6iPnx50PdhhvkpyXUD1QafR0QrNdYlwuqZUVhH2B8VlgZ8VyaitwK+vzKGc/Rs2/8/SUQr2v5+nTKIx7xbnZHWpm4D2KsVd/Jqa6nOoA9zw91aqcEZK4WGapl6AJH/8vDxcHa+jRK7HV/oPjS10gyvNhdonWfX/TV3nIsD6xPsXiJ6QNZj+Yek4THF2fypLkbNIoxeVXT8xzmgUXYj5PdfJDAi/9v2SVdAthWfDxrc7aISNuAZ40OqRhC1RaRTbZZZpcGE8N4JLLc2fAb1KWF9xxjT3snAGZ24JLQ+xo/QWWOJ8iSifosSgKtI7coFI6IDGuIStPXgGo26ieK50pLprRGZw8/qnMFmt+jMprKiIu0LVFtLAtMz5+9ZDR+TCteC+sWobu6GXh1ya8VHdIVFxuhYl9n/jYDvNhDRzzXqWjgXAvkZUBC05aT38GBcLnaublR0RndskJk1VTen1n7VhG0j6hEEEw1rQrV24oHQwSvoYZkBfVIMx7g84LstBuUNaKyhtPMWgUzN5KbrIp47+130rM+4R5onxO0FHRQwdruMsDgBsb4JV8c088uUIRL0OrTtrN8NwMZiqzO64+4seS3d6u41b4oxdrKMsPhvejnRsF7/CT8rRSNdiHksXdyx0kNZFiiQ39j+BZtjSTH9AZxyC+q9bdkl2gOOs0t6XQz+vTl0ve/DPhwvnQdhyae7vj4PNpoPN8O7vjPuKDyU1aZ6nvefjr9rpcT3vz3tzPJ+v3jOE1DBnsrdhKIQwnEFT0AQ0WWKbXna93eSKr3V0LsBhzputHV70CDL4lqBs651mi/+79vz7o0N2902lTeOoKmG1P0wqqHQr0jtQbkvRwhNHOHQmzk576/5v3jutsHMejahVwTmBEYICPech9QRbgshRJs3NanrAWidM+6cY7W8tbSfrSeXKg1uIixRAyWrT+KekJMxOG9R/OxTF9LOh4azazRMhIdA42VP1MvCGyvu7mdhYYx13DbPq03e5k0NJtWOOC7pH6Zejgwvo5RH9pJuv14yDbshUPsEDh3nZPZgnZHmZVGDk3F+vPTDh6JzPQQkvxZi03ttpyBpPDLuuMA6hvy5DxgMlJf+ZZUG8+qlWUbM6Ta4I0WI8U/0skEL4U0HiOmu9uendB6aTGvjpw+PgRiNm3ksQbPzPSoGkwAf8f39Ug8M0My3kVeahahb9vv9tnpebS0K+G5p8gNq9nybxTFGsbz+42rq/kTwVNv/7/D9FsclNv8Trit7WEgyuQDTTWDwzI7E+X9yyeJYz011x+OJi6qFNQY/R7b9f6PvtyQvN6/KgDel7dWFiE0rywbCKg1GLzQWpNq588IRsTuder094QPA69yGwjtqb5JinwdhIcruusr2PMxWb9y/lHoJtplmPZ9RdX1u5vHBE2Md4NXmUEph0HHhYWRrtQ3RSFs84hYWovm79HeblW3eVq/qhaR9KXreg3LLh8In+L/8OHAXzV1ZFxeni1GRN7Om4+8FC1/Lu5h6Y8PGIb5XK2lvcZDFbSMKlsqZ7vLb0UQdr2iI01X2d/C7RNQev76Zsod1dcCgUC1jMM9GyNbtfMYf5oltw59joxPP2g5HEjsm7vhC/AOnR2fyTmnf5Z6FbLUpLUzMu4MLfl0yYd+xxyUlLN34IMTTMDVwmUF0bEA6XBbPnIvj/NX0nMR6Q5gyAy9FLshblkBnpLVR1MvX+fskjj5glb3viPriREKhqG7aYLlrTfdZeS6F0SYyWpaqyz5hPjDtuu7e2PAf0+oPm16SaVlB/erWyvdbP+ba0jVRaXhIDC98H9OQZItFAxGGbSEiOpsOvl8oNwadJoefB6qXBWNsmQ0DEQGL6zqG5dWK04w7X8yOt5ItOKPL7cd+C/7c+cXsDTLCMqRoUKavR5XNv6BLWqZR9/EKdfO2tLbEZVrxkymhMQ1JeKWxKiy/VyvVZdsRtEt8mqIihDet8rEfpsS/kOuvQ1DhIpM1FkEH95qdiTCwVyIMXESIi+q7i2QH0TI6+A7msLpXE9HzknWrrtP4yxkjolHF83kxUcemxcmtFbUaA1QsH5jnxQjxP15triAiEk8PDdLMwC7VARooRIyNHP7+qH3HsC9MHl78d7cVX+QO/3RoR3viybQE1hMzDzrVnUoegqgVbyTGb457XcTqcW/udEh4pXG6ilHqqpzuXrRx1dXOLUS0KYa6o17Gbutl7ar1qOKGTTa6s56MkVh7EyJ5LV5plZJax/CXpSsIUeXo1BP3YrZXL77KiJ8U6pFaNFqVPCwFUSEiuiGFuj8T4+RxV1KzlNag9LwLYyvbz2TjyChRseutDK+Lrezx4e+bh2RiMrb2PVn+Cgm2NGrtwJYBsQSEgejgs0EsQWFo52SNvH+zKKr+vNck6QIrCQBvHMHWtR5VK1tcoNsu9g3al2xA4GyzJY7zt610bjVtHa82B2PzDF3xI8bY0SbCImMIdxoYy6GHGd+TSPvbubRLLIYysu1ePJf2VepzWKXBaFasjDT0tUrveZrL1/wDqzQYCXeVtKDg6k84U415b6UQT9NRFkTr1CRCEgBAH9Hh+bjuRWx0IrZXrAIA+k1UiIhcth0eCwDAqriEhaLwWAAAWnRb34KwAACsA2EBAGiFQRAWAEBiYRCEBQAAAAAIhQAAvSQqTwxLv6cGwgIAkKPgvEW7GovREQAAayGQqA9/HT0BgDz3ZN2usyAsSs4NxhTo98mY8GiLRC+JvegEAHpP/HIFFm8BABAWAACEBfS2ex71/inRJX0YV5Hae63C0oWVISJCjHfJ7L1aQiH/ywZ1+fPNSvY/ALmL+UXI33dJliEM6yMi2kPBr1YREsKiWr9JO8PSegr9KptuHEMW5FVUwmbJPQZldUv7Zkg6V2KWDytzRZe85xpGAO2C8b7isQrJPhMRxwtAZnlAUVhspfXzM02hCqtzq6GgkuVjndXIe5nlNgOQCOfE6N1stFyebTETltLEJUQqIRMAuQqD4hCCLAiLIPN1lkN8OyZhWRUQYkFYQG6EReazWjMUkvnELSyOr77vGIigIKKVmsYe1c7XA/plNYQFwGOxP/BNhUXE1Nb2vFOGwrK1S1syIyy4jwVkhbTHYpzPDLE2Iz/XsKyVhGebADwcq+sIGyJ+36/YJt0rWDq/t78a+GzNdt4bkWcEoRCAWJhdbtZpn+pduHGFdTJpHw5Ir9oGCAvIDQdiEpYoj8PUcKPuvFURpDDekGzTSUR0TAwCsQbCAnrRa1E1CP/vPyCiSUNR8YuBIKIrJcTkBCL6k6QghTFDRP8K+H4fEV0RUO6FiqIo0/cOhAXkmSU+473eYvhg8hCgztqFTN2c1O97UX2IUlaw/Q9K8hDvCsICQIyeFMIDAECs3IkuAADY9FrgrQAAtHmc5q9dzKBbAAAAAAAAAAAAAECe+D95lBcvLzU6ggAAAABJRU5ErkJggg==\" alt=\"Social Solar\"><div>Viáticos<small>Presupuesto, entrega y legalización de viáticos<\/small><\/div><\/header>\n<main>\n  <div class=\"tarjeta\" id=\"carga\">Cargando…<\/div>\n\n  <div class=\"tarjeta\" id=\"acceso\" hidden>\n    <div id=\"pasoCorreo\">\n      <h2>Entra con tu correo y tu clave<\/h2>\n      <p class=\"datos\">Solo entran los correos registrados por Social Solar.<\/p>\n      <label for=\"aCorreo\">Tu correo<\/label>\n      <input type=\"email\" id=\"aCorreo\" autocomplete=\"username\" placeholder=\"nombre@correo.com\">\n      <label for=\"aClave\">Tu clave<\/label>\n      <input type=\"password\" id=\"aClave\" autocomplete=\"current-password\">\n      <button type=\"button\" class=\"primario espacio\" id=\"aEntrarClave\">Entrar<\/button>\n      <button type=\"button\" class=\"secundario espacio\" id=\"aPedir\">Primera vez u olvidé mi clave<\/button>\n    <\/div>\n    <div id=\"pasoCodigo\" hidden>\n      <h2>Crea tu clave<\/h2>\n      <p class=\"datos\" id=\"aTexto\"><\/p>\n      <label for=\"aCodigo\">Código de 6 dígitos que llegó a tu correo<\/label>\n      <input type=\"text\" id=\"aCodigo\" inputmode=\"numeric\" maxlength=\"6\" autocomplete=\"one-time-code\">\n      <label for=\"aClaveNueva\">Tu clave nueva (mínimo 6 caracteres)<\/label>\n      <input type=\"password\" id=\"aClaveNueva\" autocomplete=\"new-password\">\n      <button type=\"button\" class=\"primario espacio\" id=\"aEntrar\">Guardar clave y entrar<\/button>\n      <button type=\"button\" class=\"secundario espacio\" id=\"aCambiar\">Volver<\/button>\n    <\/div>\n  <\/div>\n\n  <div class=\"sesion\" id=\"quien\" hidden><span id=\"quienTxt\"><\/span><button type=\"button\" id=\"salir\">Salir<\/button><\/div>\n\n  <div class=\"pestanas\" id=\"pestanas\" hidden>\n    <button type=\"button\" id=\"tabSolicitar\">Presupuesto<\/button>\n    <button type=\"button\" id=\"tabAprobar\">Entrega<\/button>\n    <button type=\"button\" id=\"tabLegalizar\">Legalización<\/button>\n    <button type=\"button\" id=\"tabProyectos\" hidden>Proyectos<\/button>\n  <\/div>\n\n  <div id=\"vistaAprobar\" hidden>\n    <div class=\"tarjeta paso\"><b>2. Entrega de viáticos<\/b><span>Se aprueba la solicitud y tesorería o gerencia registra a quién se le entregó la plata y cuánto.<\/span><\/div>\n    <div id=\"cajaMiPlata\" hidden><h3 class=\"subtitulo\">Mi plata<\/h3><div id=\"miPlata\"><\/div><\/div>\n    <div id=\"cajaAprobar\" hidden><h3 class=\"subtitulo\">Por entregar<\/h3><div id=\"listaAprobar\"><\/div><\/div>\n    <div id=\"cajaTes\" hidden>\n      <h3 class=\"subtitulo\">Registrar entrega de plata (tesorería / gerencia)<\/h3>\n      <div class=\"tarjeta\">\n        <label for=\"tProyecto\">Proyecto<\/label><select id=\"tProyecto\"><\/select>\n        <label for=\"tSol\">Viático abierto<\/label><select id=\"tSol\"><\/select>\n        <p class=\"datos\" id=\"tInfo\" style=\"margin:6px 0 0\"><\/p>\n        <div id=\"tDirecta\">\n          <label for=\"tPara\">¿Para qué es la plata?<\/label><input type=\"text\" id=\"tPara\" maxlength=\"120\" autocomplete=\"off\" placeholder=\"Ej.: Viáticos instalación Yopal\">\n          <label for=\"tConcepto\">Concepto<\/label><select id=\"tConcepto\"><\/select>\n        <\/div>\n        <label for=\"tRecibe\">¿A quién se le entregó la plata?<\/label><select id=\"tRecibe\"><\/select>\n        <div class=\"fila\">\n          <div><label for=\"tValor\">Valor entregado<\/label><input type=\"text\" id=\"tValor\" inputmode=\"numeric\" placeholder=\"$ 0\" autocomplete=\"off\"><\/div>\n          <div><label for=\"tFecha\">Fecha<\/label><input type=\"date\" id=\"tFecha\"><\/div>\n        <\/div>\n        <div class=\"fila\">\n          <div><label for=\"tMedio\">Medio de pago<\/label><select id=\"tMedio\"><option>Transferencia<\/option><option>Efectivo<\/option><option>Consignación<\/option><option>Otro<\/option><\/select><\/div>\n          <div><label for=\"tComp\">N.° comprobante<\/label><input type=\"text\" id=\"tComp\" maxlength=\"60\" autocomplete=\"off\" placeholder=\"Opcional\"><\/div>\n        <\/div>\n        <button type=\"button\" class=\"primario espacio\" id=\"tRegistrar\">Registrar entrega<\/button>\n        <div id=\"tRecientes\"><\/div>\n      <\/div>\n    <\/div>\n    <div id=\"cajaPlata\" hidden><h3 class=\"subtitulo\">Plata entregada por trabajador<\/h3><div id=\"plataEquipo\"><\/div><\/div>\n    <h3 class=\"subtitulo\">Mis viáticos<\/h3>\n    <div id=\"misViaticos\"><\/div>\n  <\/div>\n\n  <div id=\"vistaProyectos\" hidden>\n    <div class=\"tarjeta\">\n      <h2>Crear un proyecto nuevo<\/h2>\n      <label for=\"pNombre\">Nombre del proyecto<\/label>\n      <input type=\"text\" id=\"pNombre\" maxlength=\"80\" placeholder=\"Ej.: C033 Nombre del cliente\" autocomplete=\"off\">\n      <label for=\"pJefe\">Ingeniero a cargo del proyecto (aprueba a los técnicos)<\/label>\n      <select id=\"pJefe\"><\/select>\n      <label>Técnicos encargados (área técnica)<\/label>\n      <div class=\"marcas\" id=\"pTecnicos\"><\/div>\n      <button type=\"button\" class=\"primario espacio\" id=\"pCrear\">Crear proyecto<\/button>\n    <\/div>\n    <div class=\"tarjeta\">\n      <h2 id=\"pTitulo\">Proyectos a tu cargo<\/h2>\n      <div id=\"pLista\"><\/div>\n    <\/div>\n  <\/div>\n\n  <div id=\"vistaSolicitar\" hidden>\n    <div class=\"tarjeta paso\"><b>1. Presupuesto<\/b><span>Presupuesto del proyecto y lo que se necesita para el viaje.<\/span><\/div>\n    <div class=\"tarjeta\" id=\"ppCaja\" hidden><!-- el presupuesto se sube solo en \"Presupuesto del viaje\" -->\n      <h2>Presupuesto del proyecto<\/h2>\n      <select id=\"ppProyecto\" aria-label=\"Proyecto\"><\/select>\n      <div id=\"ppInfo\"><\/div>\n    <\/div>\n    <div id=\"sForm\">\n      <div class=\"tarjeta\" id=\"sModoCaja\" hidden>\n        <h2>¿Nueva solicitud o agregar a una anterior?<\/h2>\n        <select id=\"sModo\" aria-label=\"Tipo de solicitud\"><\/select>\n        <p class=\"datos\" id=\"sModoInfo\" style=\"margin:6px 0 0\" hidden><\/p>\n        <div id=\"sAmpRespCaja\" hidden>\n          <label for=\"sAmpResp\">¿A quién se le entrega la plata de esta adición?<\/label>\n          <select id=\"sAmpResp\"><\/select>\n        <\/div>\n      <\/div>\n      <div class=\"tarjeta\" id=\"sDatosViaje\">\n        <h2>Datos del viaje<\/h2>\n        <label for=\"sNombre\">Tu nombre<\/label>\n        <select id=\"sNombre\"><\/select>\n        <p class=\"datos\" id=\"sCargo\" style=\"margin:6px 0 0\" hidden><\/p>\n        <label for=\"sCorreo\">Tu correo (para avisarte cuando aprueben)<\/label>\n        <input type=\"email\" id=\"sCorreo\" autocomplete=\"email\" placeholder=\"nombre@correo.com\">\n        <label for=\"sProyecto\">Proyecto<\/label>\n        <select id=\"sProyecto\"><\/select>\n        <p class=\"datos\" id=\"sEquipo\" style=\"margin:6px 0 0\" hidden><\/p>\n        <div id=\"sViajanCaja\" hidden>\n          <label>Técnicos que viajan<\/label>\n          <div class=\"marcas\" id=\"sViajan\"><\/div>\n        <\/div>\n        <div id=\"sRespCaja\" hidden>\n          <label for=\"sResp\">Técnico responsable del dinero (recibe el anticipo)<\/label>\n          <select id=\"sResp\"><\/select>\n        <\/div>\n        <label for=\"sCiudad\">Ciudad(es) de destino<\/label>\n        <input type=\"text\" id=\"sCiudad\" autocomplete=\"off\">\n        <div class=\"fila\">\n          <div><label for=\"sSalida\">Fecha de salida<\/label><input type=\"date\" id=\"sSalida\"><\/div>\n          <div><label for=\"sRegreso\">Fecha de regreso<\/label><input type=\"date\" id=\"sRegreso\"><\/div>\n        <\/div>\n        <p class=\"datos\" id=\"sDias\" style=\"margin:6px 0 0\" hidden><\/p>\n        <label for=\"sObjeto\">Objeto del viaje<\/label>\n        <input type=\"text\" id=\"sObjeto\" placeholder=\"Ej.: Visita de mantenimiento\" autocomplete=\"off\">\n        <div id=\"sExtra\"><\/div>\n      <\/div>\n      <div class=\"tarjeta\">\n        <h2 id=\"sTituloLineas\">Presupuesto del viaje: ¿qué necesitas?<\/h2>\n        <div id=\"lineas\"><\/div>\n        <button type=\"button\" class=\"secundario espacio\" id=\"sAgregar\">Agregar otro concepto<\/button>\n        <div class=\"totalSol\"><span id=\"sTotalTitulo\">Total solicitado<\/span><b id=\"sTotal\">$ 0<\/b><\/div>\n        <p class=\"datos\" id=\"sNuevoTotal\" style=\"margin:8px 0 0;text-align:right\" hidden><\/p>\n      <\/div>\n      <button type=\"button\" class=\"primario\" id=\"sEnviar\">Enviar solicitud<\/button>\n    <\/div>\n    <div class=\"tarjeta\" id=\"sHecho\" hidden>\n      <h2 id=\"sHechoTitulo\">Solicitud enviada<\/h2>\n      <p class=\"datos\" id=\"sHechoTexto\"><\/p>\n      <button type=\"button\" class=\"primario\" id=\"sIrGastos\">Registrar gastos de este viaje<\/button>\n      <button type=\"button\" class=\"secundario espacio\" id=\"sOtra\">Hacer otra solicitud<\/button>\n    <\/div>\n  <\/div>\n\n  <div id=\"vistaLegalizar\" hidden>\n  <div class=\"tarjeta paso\"><b>3. Legalización de viáticos<\/b><span>Se registran los gastos con su soporte y se envían a revisión.<\/span><\/div>\n  <div id=\"cajaRevision\" hidden><h3 class=\"subtitulo\">Legalizaciones por revisar<\/h3><div id=\"listaRevision\"><\/div><\/div>\n  <div id=\"cajaMiPlata2\" hidden><div id=\"miPlata2\"><\/div><\/div>\n  <div class=\"tarjeta\" id=\"selector\">\n    <h2>Tu solicitud de viáticos<\/h2>\n    <select id=\"solicitud\"><\/select>\n  <\/div>\n\n  <div class=\"tarjeta\" id=\"resumen\" hidden>\n    <p class=\"datos\" id=\"datos\"><\/p>\n    <div class=\"totales\">\n      <div class=\"total\"><span>Anticipo<\/span><b id=\"tAnticipo\">$ 0<\/b><\/div>\n      <div class=\"total\"><span>Gastado<\/span><b id=\"tGastado\">$ 0<\/b><\/div>\n      <div class=\"total\"><span id=\"tSaldoTitulo\">Te queda<\/span><b id=\"tSaldo\">$ 0<\/b><\/div>\n    <\/div>\n    <div class=\"barra\"><i id=\"barra\"><\/i><\/div>\n    <p class=\"datos\" id=\"hoyTxt\"><\/p>\n  <\/div>\n\n  <div class=\"tarjeta\" id=\"nuevo\" hidden>\n    <h2>Agregar un gasto<\/h2>\n    <label>Foto del recibo o factura<\/label>\n    <div class=\"botones\">\n      <button type=\"button\" class=\"primario\" id=\"tomar\">Tomar foto<\/button>\n      <button type=\"button\" class=\"secundario\" id=\"elegir\">Elegir archivo<\/button>\n    <\/div>\n    <input type=\"file\" id=\"fotoCam\" accept=\"image/*\" capture=\"environment\" hidden>\n    <input type=\"file\" id=\"foto\" accept=\"image/*,application/pdf\" hidden>\n    <div class=\"foto\" id=\"vista\" hidden><img id=\"miniatura\" alt=\"\"><span id=\"nombreFoto\"><\/span><\/div>\n    <div class=\"check\"><input type=\"checkbox\" id=\"sinSoporte\"><label for=\"sinSoporte\" style=\"margin:0;font-size:14px;color:#1A1A1A\">No tengo soporte de este gasto<\/label><\/div>\n    <div class=\"fila\">\n      <div><label for=\"valor\">Valor gastado<\/label><input type=\"text\" id=\"valor\" inputmode=\"numeric\" placeholder=\"$ 0\" autocomplete=\"off\"><\/div>\n      <div><label for=\"fecha\">Fecha<\/label><input type=\"date\" id=\"fecha\"><\/div>\n    <\/div>\n    <label for=\"concepto\">Concepto<\/label>\n    <select id=\"concepto\"><\/select>\n    <label for=\"tercero\">Proveedor y NIT o cédula<\/label>\n    <input type=\"text\" id=\"tercero\" placeholder=\"Ej.: Restaurante La Plaza NIT 900.123.456-7\" autocomplete=\"off\">\n    <label for=\"nSoporte\">N.° de factura o recibo (opcional)<\/label>\n    <input type=\"text\" id=\"nSoporte\" autocomplete=\"off\">\n    <label for=\"factura\">N.° de factura contable (opcional)<\/label>\n    <input type=\"text\" id=\"factura\" maxlength=\"40\" autocomplete=\"off\" placeholder=\"Ej.: FC-0001\">\n    <label for=\"obs\" id=\"obsEtiqueta\">Observaciones (opcional)<\/label>\n    <textarea id=\"obs\"><\/textarea>\n    <button class=\"secundario espacio\" id=\"agregar\">Agregar a la lista<\/button>\n  <\/div>\n\n  <div class=\"tarjeta\" id=\"pendientes\" hidden>\n    <h2>Por enviar<\/h2>\n    <ul id=\"listaPend\"><\/ul>\n    <button class=\"primario espacio\" id=\"enviar\">Enviar gastos<\/button>\n  <\/div>\n\n  <div class=\"tarjeta\" id=\"registrados\" hidden>\n    <h2 id=\"tituloReg\">Gastos registrados<\/h2>\n    <ul id=\"listaReg\"><\/ul>\n  <\/div>\n\n  <div class=\"tarjeta\" id=\"cierre\" hidden>\n    <h2>¿Ya registraste todos los gastos?<\/h2>\n    <p class=\"datos\">Al enviar a revisión, tu jefe recibe el resumen y ya no podrás agregar más gastos a esta solicitud.<\/p>\n    <button class=\"exito\" id=\"revision\">Enviar a revisión<\/button>\n  <\/div>\n\n  <div class=\"tarjeta\" id=\"hecho\" hidden>\n    <h2>Enviado a revisión<\/h2>\n    <p class=\"datos\" id=\"textoHecho\"><\/p>\n  <\/div>\n  <\/div>\n<\/main>\n<div id=\"camara\" hidden>\n  <video id=\"video\" autoplay playsinline muted><\/video>\n  <div class=\"botones\">\n    <button type=\"button\" class=\"secundario\" id=\"cancelarCam\" style=\"box-shadow:none\">Cancelar<\/button>\n    <button type=\"button\" class=\"primario\" id=\"capturar\">Capturar<\/button>\n  <\/div>\n<\/div>\n<div id=\"aviso\" hidden><\/div>\n\n<script>\n(function () {\n  var ID_INICIAL = '__ID_INICIAL__', VISTA_INICIAL = '__VISTA_INICIAL__';\n  var datos = null, lineas = [], creando = false, ultimaSolicitud = null;\n  var token = '', sesion = null, entrando = false, decidiendo = false, llaveSolicitud = '';\n  // Llave única por envío: si la respuesta se pierde y se reintenta, el servidor no lo registra dos veces\n  function llave() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12); }\n  var detalle = null, pendientes = [], fotoActual = null, ocupado = false;\n  var $ = function (id) { return document.getElementById(id); };\n\n  function pesos(n) {\n    n = Math.round(Number(n) || 0);\n    return (n < 0 ? '-$ ' : '$ ') + String(Math.abs(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');\n  }\n  function numero(t) { return Number(String(t || '').replace(/[^0-9]/g, '')) || 0; }\n  function texto(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/<\/g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;'); }\n  function hoy() {\n    var d = new Date();\n    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);\n  }\n  function fechaCorta(iso) { var p = String(iso).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; }\n\n  var temporizador = null;\n  function aviso(mensaje, tipo, fijo) {\n    var a = $('aviso');\n    a.textContent = mensaje; a.className = tipo || ''; a.hidden = false;\n    clearTimeout(temporizador);\n    if (!fijo) temporizador = setTimeout(function () { a.hidden = true; }, 5000);\n  }\n  function fallo(err) {\n    ocupado = false; entrando = false; pintarAcceso();\n    if (err && err.message && err.message.indexOf('SESION:') > -1) { cerrarSesion(err.message.split('SESION:')[1].trim()); return; }\n    pintar();\n    aviso((err && err.message) ? err.message : 'No se pudo conectar. Revisa tu señal e intenta de nuevo.', 'error');\n  }\n  function guardar(clave, valor) { try { localStorage.setItem(clave, valor); } catch (e) {} }\n  function guardado(clave) { try { return localStorage.getItem(clave) || ''; } catch (e) { return ''; } }\n  function recordar(id) { guardar('viaticos_id', id); }\n  function recordado() { return guardado('viaticos_id'); }\n  function opciones(lista, vacio) {\n    return '<option value=\"\">' + vacio + '<\/option>' + lista.map(function (c) { return '<option value=\"' + texto(c) + '\">' + texto(c) + '<\/option>'; }).join('');\n  }\n\n  /* ---------- Carga inicial ---------- */\n  /* ---------- Acceso con correo y clave ---------- */\n  function pintarAcceso() {\n    ['aPedir', 'aEntrar', 'aEntrarClave'].forEach(function (id) { $(id).disabled = entrando; });\n    $('aEntrarClave').textContent = entrando ? 'Un momento…' : 'Entrar';\n    $('aEntrar').textContent = entrando ? 'Un momento…' : 'Guardar clave y entrar';\n  }\n  function mostrarAcceso(correo) {\n    ['carga', 'pestanas', 'vistaSolicitar', 'vistaLegalizar', 'vistaAprobar', 'vistaProyectos', 'quien'].forEach(function (id) { $(id).hidden = true; });\n    $('acceso').hidden = false; $('pasoCorreo').hidden = false; $('pasoCodigo').hidden = true;\n    $('aCorreo').value = correo || guardado('viaticos_correo');\n    ['aClave', 'aCodigo', 'aClaveNueva'].forEach(function (id) { $(id).value = ''; });\n    pintarAcceso();\n  }\n  function cerrarSesion(mensaje) {\n    token = ''; sesion = null; datos = null; detalle = null; pendientes = [];\n    guardar('viaticos_token', '');\n    mostrarAcceso('');\n    if (mensaje) aviso(mensaje, 'error');\n  }\n  function entrar(r) {\n    entrando = false; pintarAcceso();\n    token = r.token; sesion = r;\n    guardar('viaticos_token', token); guardar('viaticos_correo', r.correo);\n    $('aviso').hidden = true;\n    $('acceso').hidden = true; $('carga').hidden = false;\n    $('quienTxt').textContent = r.nombre + ' · ' + r.correo; $('quien').hidden = false;\n    iniciar();\n  }\n  function falloCarga(err) {\n    if (err && err.message && err.message.indexOf('SESION:') > -1) { fallo(err); return; }\n    $('carga').hidden = false;\n    $('carga').innerHTML = 'No se pudo conectar. Revisa tu señal.<button type=\"button\" class=\"primario espacio\" id=\"reintentar\">Reintentar<\/button>';\n    $('reintentar').addEventListener('click', function () { $('carga').textContent = 'Cargando…'; arrancar(); });\n  }\n  function arrancar() {\n    google.script.run.withFailureHandler(falloCarga).withSuccessHandler(function (r) {\n      if (r.token) entrar(r); else mostrarAcceso(r.correoGoogle);\n    }).appEstado(guardado('viaticos_token'));\n  }\n  function correoEscrito() {\n    var correo = $('aCorreo').value.trim().toLowerCase();\n    if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(correo)) { aviso('Escribe tu correo completo.', 'error'); return ''; }\n    return correo;\n  }\n  $('aEntrarClave').addEventListener('click', function () {\n    var correo = correoEscrito();\n    if (entrando || !correo) return;\n    if (!$('aClave').value) return aviso('Escribe tu clave. Si es tu primera vez, toca el botón de abajo.', 'error');\n    entrando = true; pintarAcceso();\n    google.script.run.withFailureHandler(fallo).withSuccessHandler(entrar).appEntrar(correo, $('aClave').value);\n  });\n  $('aPedir').addEventListener('click', function () {\n    var correo = correoEscrito();\n    if (entrando || !correo) return;\n    entrando = true; pintarAcceso();\n    aviso('Enviando el código a tu correo…', '', true);\n    google.script.run.withFailureHandler(fallo).withSuccessHandler(function () {\n      entrando = false; pintarAcceso(); $('aviso').hidden = true;\n      $('pasoCorreo').hidden = true; $('pasoCodigo').hidden = false;\n      $('aTexto').textContent = 'Enviamos un código a ' + correo + '. Vence en 10 minutos; si no lo ves, revisa la carpeta de spam.';\n      $('aCodigo').focus();\n    }).appPedirCodigo(correo);\n  });\n  $('aEntrar').addEventListener('click', function () {\n    var codigo = $('aCodigo').value.replace(/[^0-9]/g, '');\n    if (entrando) return;\n    if (codigo.length !== 6) return aviso('El código tiene 6 dígitos.', 'error');\n    if ($('aClaveNueva').value.length < 6) return aviso('La clave debe tener al menos 6 caracteres.', 'error');\n    entrando = true; pintarAcceso();\n    google.script.run.withFailureHandler(fallo).withSuccessHandler(entrar)\n      .appVerificarCodigo($('aCorreo').value.trim().toLowerCase(), codigo, $('aClaveNueva').value);\n  });\n  $('aCambiar').addEventListener('click', function () { mostrarAcceso($('aCorreo').value); });\n  $('salir').addEventListener('click', function () {\n    if (!confirm('¿Cerrar tu sesión en este dispositivo?')) return;\n    google.script.run.appSalir(token);\n    cerrarSesion('');\n  });\n\n  function iniciar() {\n    $('fecha').value = hoy(); $('fecha').max = hoy();\n    google.script.run.withFailureHandler(falloCarga).withSuccessHandler(function (r) {\n      datos = r;\n      $('carga').hidden = true; $('pestanas').hidden = false;\n      llenarSolicitudes();\n      $('concepto').innerHTML = opciones(r.conceptos, 'Elige…');\n      prepararSolicitud();\n      var inicial = ID_INICIAL || recordado();\n      var existe = !!inicial && r.solicitudes.some(function (x) { return x.id === inicial; });\n      if (existe) $('solicitud').value = inicial;\n      pintarAprobar(); pintarProyectos();\n      var porEntregar = (r.porAprobar || []).some(function (s) { return s.estado !== 'En revisión'; });\n      var porRevisar = (r.porAprobar || []).some(function (s) { return s.estado === 'En revisión'; });\n      if (r.gestion && VISTA_INICIAL === 'proyectos') mostrarVista('proyectos');\n      else if (VISTA_INICIAL === 'aprobar' || (porEntregar && !ID_INICIAL && !VISTA_INICIAL)) mostrarVista('aprobar');\n      else if (porRevisar && !ID_INICIAL && !VISTA_INICIAL) mostrarVista('legalizar');\n      else mostrarVista(VISTA_INICIAL !== 'solicitud' && (ID_INICIAL ? existe : r.solicitudes.length > 0) ? 'legalizar' : 'solicitar');\n      if (existe) cargar(inicial);\n    }).appDatos(token);\n  }\n\n  function llenarSolicitudes() {\n    var s = $('solicitud'), lista = datos.solicitudes;\n    s.disabled = !lista.length;\n    var opcion = function (x) { return '<option value=\"' + texto(x.id) + '\">' + texto(x.texto) + '<\/option>'; };\n    var mias = lista.filter(function (x) { return !x.equipo && !x.aMiNombre; }), equipo = lista.filter(function (x) { return x.equipo; });\n    var aMi = lista.filter(function (x) { return x.aMiNombre; });\n    var grupo = function (t, l) { return l.length ? '<optgroup label=\"' + t + '\">' + l.map(opcion).join('') + '<\/optgroup>' : ''; };\n    s.innerHTML = !lista.length ? '<option value=\"\">No hay solicitudes abiertas<\/option>' :\n      '<option value=\"\">Elige la solicitud…<\/option>' +\n      (equipo.length || aMi.length ? grupo('Mis solicitudes', mias) + grupo('Plata a mi nombre (la legalizo yo)', aMi) + grupo('De las personas que apruebo (agregar gastos)', equipo)\n        : mias.map(opcion).join(''));\n  }\n\n  function mostrarVista(v) {\n    $('vistaSolicitar').hidden = v !== 'solicitar';\n    $('vistaLegalizar').hidden = v !== 'legalizar';\n    $('vistaAprobar').hidden = v !== 'aprobar';\n    $('tabAprobar').className = v === 'aprobar' ? 'activa' : '';\n    $('vistaProyectos').hidden = v !== 'proyectos';\n    $('tabProyectos').className = v === 'proyectos' ? 'activa' : '';\n    $('tabSolicitar').className = v === 'solicitar' ? 'activa' : '';\n    $('tabLegalizar').className = v === 'legalizar' ? 'activa' : '';\n    window.scrollTo(0, 0);\n  }\n  $('tabSolicitar').addEventListener('click', function () { mostrarVista('solicitar'); });\n  $('tabLegalizar').addEventListener('click', function () { mostrarVista('legalizar'); });\n  $('tabAprobar').addEventListener('click', function () { mostrarVista('aprobar'); });\n  $('tabProyectos').addEventListener('click', function () { mostrarVista('proyectos'); });\n\n  /* ---------- Proyectos (administrador y jefes): crear y asignar técnicos ---------- */\n  var gestionando = false;\n  function marcas(personas, marcados) {\n    // Solo el área técnica (más quien ya esté asignado, para no quitarlo sin querer). Si nadie tiene esa área, se muestran todos.\n    var hayTecnicos = personas.some(function (x) { return x.tecnico; });\n    return personas.filter(function (x) { return !hayTecnicos || x.tecnico || marcados.indexOf(x.clave) > -1; }).map(function (x) {\n      return '<label><input type=\"checkbox\" value=\"' + texto(x.clave) + '\"' + (marcados.indexOf(x.clave) > -1 ? ' checked' : '') + '><span>' + texto(x.nombre) +\n        '<small>' + texto(x.area || 'Sin área') + '<\/small><\/span><\/label>';\n    }).join('');\n  }\n  function marcados(caja) {\n    return Array.prototype.slice.call(caja.querySelectorAll('input:checked')).map(function (i) { return i.value; });\n  }\n  function pintarProyectos() {\n    var ge = datos ? datos.gestion : null;\n    $('tabProyectos').hidden = !ge;\n    // Con cuatro pestañas los nombres largos no caben en un celular\n    var extra = !!ge || !!(datos && datos.porAprobar);\n    void extra;\n    if (!ge) return;\n    $('pJefe').innerHTML = ge.personas.filter(function (x) { return x.correo; }).map(function (x) { // quien aprueba necesita correo para entrar\n      return '<option value=\"' + texto(x.correo) + '\"' + (x.correo === sesion.correo ? ' selected' : '') + '>' + texto(x.nombre) + '<\/option>';\n    }).join('');\n    $('pTecnicos').innerHTML = marcas(ge.personas, []);\n    $('pTitulo').textContent = 'Proyectos a tu cargo (' + ge.proyectos.length + ')';\n    $('pLista').innerHTML = !ge.proyectos.length ? '<p class=\"datos\">Todavía no tienes proyectos a tu cargo.<\/p>' : ge.proyectos.map(function (p, i) {\n      var nombres = ge.personas.filter(function (x) { return p.tecnicos.indexOf(x.clave) > -1; }).map(function (x) { return x.nombre; });\n      return '<details data-i=\"' + i + '\"><summary>' + texto(p.nombre) +\n        '<small>' + (nombres.length ? texto(nombres.join(', ')) : '<span class=\"mal\">Sin técnicos encargados<\/span>') + (p.jefe ? ' · A cargo: ' + texto(p.jefe) : '') + '<\/small><\/summary>' +\n        '<div class=\"marcas\">' + marcas(ge.personas, p.tecnicos) + '<\/div>' +\n        '<button type=\"button\" class=\"secundario espacio pGuardar\">Guardar técnicos<\/button>' + cajaPresupuesto(p) + '<\/details>';\n    }).join('');\n  }\n  // Presupuesto del proyecto: lo sube el ingeniero a cargo; debajo, lo entregado y lo gastado\n  function cajaPresupuesto(p) {\n    var q = p.presu || {}, saldo = q.presupuesto === null || q.presupuesto === undefined ? null : q.presupuesto - q.gastado;\n    return '<div class=\"presu\"><label>Presupuesto del proyecto<\/label>' +\n      (false ? '<div class=\"fila\"><div><input type=\"text\" class=\"pPresuValor\" inputmode=\"numeric\" placeholder=\"$ 0\" autocomplete=\"off\" value=\"' +\n        (q.presupuesto ? pesos(q.presupuesto) : '') + '\"><\/div><div style=\"flex:0 0 auto\"><button type=\"button\" class=\"primario pPresu\">Guardar<\/button><\/div><\/div>'\n        : '<p class=\"datos\">' + (q.presupuesto ? pesos(q.presupuesto) : 'Sin presupuesto') + '' + '<\/p>') +\n      '<div class=\"totales espacio\"><div class=\"total\"><span>Entregado<\/span><b>' + pesos(q.entregado || 0) + '<\/b><\/div>' +\n      '<div class=\"total\"><span>Gastado<\/span><b>' + pesos(q.gastado || 0) + '<\/b><\/div>' +\n      '<div class=\"total\"><span>Saldo<\/span><b class=\"' + (saldo !== null && saldo < 0 ? 'rojo' : 'verde') + '\">' + (saldo === null ? '—' : pesos(saldo)) + '<\/b><\/div><\/div>' +\n      (q.por ? '<p class=\"datos\" style=\"margin:6px 0 0\">Subido por ' + texto(q.por) + '<\/p>' : '') + '<\/div>';\n  }\n  function trasGestion(mensaje) {\n    return function (r) {\n      gestionando = false;\n      r.porAprobar = r.porAprobar || null; datos = r;\n      llenarSolicitudes(); pintarAprobar(); pintarProyectos();\n      var elegido = $('sProyecto').value;\n      $('sProyecto').innerHTML = opciones(datos.proyectos, datos.proyectos.length ? 'Elige el proyecto…' : 'No tienes proyectos asignados');\n      $('sProyecto').disabled = !datos.proyectos.length; $('sProyecto').value = elegido; if ($('sProyecto').selectedIndex < 0) $('sProyecto').value = '';\n      pintarEquipo(); pintarPresupuesto();\n      aviso(mensaje, 'bien');\n    };\n  }\n  function falloGestion(err) { gestionando = false; fallo(err); }\n  $('pCrear').addEventListener('click', function () {\n    if (gestionando) return;\n    var p = { nombre: $('pNombre').value.trim(), jefe: $('pJefe').value, tecnicos: marcados($('pTecnicos')) };\n    if (p.nombre.length < 3) return aviso('Escribe el nombre del proyecto.', 'error');\n    if (!p.tecnicos.length) return aviso('Marca al menos un técnico encargado.', 'error');\n    gestionando = true;\n    aviso('Creando el proyecto y su carpeta…', '', true);\n    google.script.run.withFailureHandler(falloGestion).withSuccessHandler(function (r) {\n      $('pNombre').value = '';\n      trasGestion('Proyecto \"' + p.nombre + '\" creado con ' + p.tecnicos.length + (p.tecnicos.length === 1 ? ' técnico.' : ' técnicos.'))(r);\n    }).appCrearProyecto(token, p);\n  });\n  $('pLista').addEventListener('input', function (e) {\n    if (String(e.target.className).indexOf('pPresuValor') === -1) return;\n    var n = numero(e.target.value); e.target.value = n ? pesos(n) : '';\n  });\n  $('pLista').addEventListener('click', function (e) {\n    if (!gestionando && e.target.className && String(e.target.className).indexOf('pPresu') > -1 && String(e.target.className).indexOf('pPresuValor') === -1) {\n      var caja = e.target; while (caja && !(caja.getAttribute && caja.getAttribute('data-i') !== null)) caja = caja.parentNode;\n      var pr = datos.gestion.proyectos[Number(caja.getAttribute('data-i'))], valor = numero(caja.querySelector('.pPresuValor').value);\n      if (!valor) return aviso('Escribe el valor del presupuesto.', 'error');\n      if (!confirm('¿Guardar ' + pesos(valor) + ' como presupuesto de \"' + pr.nombre + '\"?')) return;\n      gestionando = true;\n      aviso('Guardando el presupuesto…', '', true);\n      google.script.run.withFailureHandler(falloGestion).withSuccessHandler(trasGestion('Presupuesto de \"' + pr.nombre + '\" guardado.')).appGuardarPresupuesto(token, pr.nombre, valor);\n      return;\n    }\n    if (gestionando || !e.target.className || String(e.target.className).indexOf('pGuardar') === -1) return;\n    var caja = e.target.parentNode, p = datos.gestion.proyectos[Number(caja.getAttribute('data-i'))];\n    var lista = marcados(caja);\n    if (!lista.length && !confirm('\"' + p.nombre + '\" quedará sin técnicos encargados. ¿Guardar así?')) return;\n    gestionando = true;\n    aviso('Guardando…', '', true);\n    google.script.run.withFailureHandler(falloGestion).withSuccessHandler(trasGestion('Técnicos de \"' + p.nombre + '\" actualizados.')).appGuardarTecnicos(token, p.nombre, lista);\n  });\n\n  /* ---------- Aprobaciones (solo para jefes de proyecto) ---------- */\n  function pintarAprobar() {\n    var lista = datos ? datos.porAprobar : null;\n    pintarMisViaticos(); pintarPlata(); pintarTesoreria();\n    $('cajaAprobar').hidden = !lista; $('cajaRevision').hidden = !lista;\n    var entregas = (lista || []).filter(function (s) { return s.estado !== 'En revisión'; });\n    var revisiones = (lista || []).filter(function (s) { return s.estado === 'En revisión'; });\n    var porPagar = datos && datos.tesoreria ? datos.tesoreria.solicitudes.filter(function (s) { return s.porPagar > 0; }).length : 0;\n    $('tabAprobar').textContent = 'Entrega' + (entregas.length + porPagar ? ' (' + (entregas.length + porPagar) + ')' : '');\n    $('tabLegalizar').textContent = 'Legalización' + (revisiones.length ? ' (' + revisiones.length + ')' : '');\n    if (!lista) return;\n    $('listaAprobar').innerHTML = !entregas.length ? '<div class=\"tarjeta\">No hay viáticos por entregar.<\/div>' : entregas.map(tarjetaDecision).join('');\n    $('cajaRevision').hidden = !revisiones.length;\n    $('listaRevision').innerHTML = revisiones.map(tarjetaDecision).join('');\n  }\n  // \"Mi plata\": todo lo que se le entregó a quien entra, sumado (4 entregas de $100.000 = debe relacionar $400.000)\n  function cajaMiPlata(m) {\n    return '<div class=\"tarjeta\"><div class=\"totales\"><div class=\"total\"><span>Te entregaron (' + m.entregas.length + ')<\/span><b>' + pesos(m.entregado) + '<\/b><\/div>' +\n      '<div class=\"total\"><span>Relacionado<\/span><b>' + pesos(m.legalizado) + '<\/b><\/div>' +\n      '<div class=\"total\"><span>Te falta relacionar<\/span><b class=\"' + (m.porRelacionar > 0 ? 'rojo' : 'verde') + '\">' + pesos(m.porRelacionar) + '<\/b><\/div><\/div>' +\n      '<table class=\"plata espacio\"><tr><th>Entrega<\/th><th class=\"n\">Valor<\/th><th class=\"n\">Falta<\/th><\/tr>' + m.entregas.map(function (e) {\n        var abrir = datos.solicitudes.some(function (x) { return x.id === e.id; });\n        return '<tr><td>' + (abrir ? '<a href=\"#\" class=\"irGastos\" data-ir=\"' + texto(e.id) + '\">' + texto(e.id) + '<\/a>' : texto(e.id)) + '<small>' + texto(e.proyecto) + ' · ' + texto(e.fecha) + ' · ' + texto(e.estado) + '<\/small><\/td>' +\n          '<td class=\"n\">' + pesos(e.valor) + '<\/td><td class=\"n\">' + (e.falta ? pesos(e.falta) : '—') + '<\/td><\/tr>';\n      }).join('') + '<\/table><\/div>';\n  }\n  function pintarPlata() {\n    var pl = (datos && datos.plata) || { mia: { entregas: [] }, equipo: [] };\n    var hayMia = pl.mia && pl.mia.entregas.length > 0;\n    $('cajaMiPlata').hidden = !hayMia; $('cajaMiPlata2').hidden = !hayMia;\n    if (hayMia) { $('miPlata').innerHTML = cajaMiPlata(pl.mia); $('miPlata2').innerHTML = cajaMiPlata(pl.mia).replace('<div class=\"tarjeta\">', '<div class=\"tarjeta\"><h2>Plata a tu nombre<\/h2>'); }\n    var otros = (pl.equipo || []).filter(function (x) { return x.nombre !== sesion.nombre; });\n    $('cajaPlata').hidden = !otros.length;\n    $('plataEquipo').innerHTML = !otros.length ? '' : '<div class=\"tarjeta\"><table class=\"plata\"><tr><th>Trabajador<\/th><th class=\"n\">Entregado<\/th><th class=\"n\">Por relacionar<\/th><\/tr>' +\n      otros.map(function (x) {\n        return '<tr><td><b>' + texto(x.nombre) + '<\/b><small>' + x.n + (x.n === 1 ? ' entrega' : ' entregas') + ' · ' + texto(x.proyectos.join(', ')) + '<\/small><\/td>' +\n          '<td class=\"n\">' + pesos(x.entregado) + '<small>relacionado ' + pesos(x.legalizado) + '<\/small><\/td>' +\n          '<td class=\"n\"><b class=\"' + (x.porRelacionar > 0 ? 'rojo' : 'verde') + '\">' + pesos(x.porRelacionar) + '<\/b><\/td><\/tr>';\n      }).join('') + '<\/table>' +\n      (datos.libroControl ? '<p class=\"datos\" style=\"margin:10px 0 0\"><a href=\"' + texto(datos.libroControl) + '\" target=\"_blank\">Ver el resumen de todos los proyectos y trabajadores<\/a><\/p>' : '') + '<\/div>';\n  }\n  $('miPlata').addEventListener('click', irAGastos);\n  $('miPlata2').addEventListener('click', irAGastos);\n  function irAGastos(e) {\n    var ir = e.target.getAttribute && e.target.getAttribute('data-ir');\n    if (!ir) return;\n    e.preventDefault();\n    mostrarVista('legalizar'); $('solicitud').value = ir; cargar(ir);\n  }\n  // Tesorería / gerencia: \"le entregué a tal persona tanta plata para este proyecto\"\n  function pintarTesoreria() {\n    var te = datos && datos.tesoreria;\n    $('cajaTes').hidden = !te;\n    if (!te) return;\n    var previo = $('tProyecto').value, proys = [];\n    te.solicitudes.forEach(function (s) { if (proys.indexOf(s.proyecto) === -1) proys.push(s.proyecto); });\n    $('tProyecto').innerHTML = proys.length ? opciones(proys, 'Elige el proyecto…') : '<option value=\"\">No hay viáticos abiertos<\/option>';\n    var cPrev = $('tConcepto').value; $('tConcepto').innerHTML = opciones(te.conceptos || [], 'Elige…');\n    $('tConcepto').value = cPrev || ((te.conceptos || []).indexOf('Otros') > -1 ? 'Otros' : '');\n    $('tProyecto').value = proys.indexOf(previo) > -1 ? previo : (proys.length === 1 ? proys[0] : '');\n    if (!$('tFecha').value) $('tFecha').value = hoy();\n    pintarSolTes.call(window);\n    $('tRecientes').innerHTML = te.recientes.length ? '<table class=\"plata espacio\"><tr><th>Últimas entregas<\/th><th class=\"n\">Valor<\/th><\/tr>' + te.recientes.map(function (e) {\n      return '<tr><td>' + texto(e.recibe) + '<small>' + texto(e.proyecto) + ' · ' + texto(e.sol) + ' · ' + texto(e.fecha) + (e.medio ? ' · ' + texto(e.medio) : '') +\n        (e.comp ? ' · ' + texto(e.comp) : '') + '<\/small><\/td><td class=\"n\">' + pesos(e.valor) +\n        '<br><button type=\"button\" class=\"tAnular\" data-id=\"' + texto(e.id) + '\" style=\"padding:4px 8px;font-size:12px;margin-top:4px;background:#fff;border:1px solid #c62828;color:#c62828;border-radius:6px\">Anular<\/button><\/td><\/tr>'; }).join('') + '<\/table>' : '';\n  }\n  $('tRecientes').addEventListener('click', function (ev) {\n    var b = ev.target.closest ? ev.target.closest('.tAnular') : null;\n    if (!b || gestionando) return;\n    var e = null; datos.tesoreria.recientes.forEach(function (x) { if (x.id === b.getAttribute('data-id')) e = x; });\n    if (!e || !confirm('¿Anular la entrega de ' + pesos(e.valor) + ' a ' + e.recibe + ' (' + e.sol + ')?\\n\\nSe quita del formato. Si estaba dentro de lo aprobado, vuelve a quedar por entregar para registrarla bien.')) return;\n    gestionando = true;\n    aviso('Anulando la entrega…', '', true);\n    google.script.run.withFailureHandler(falloGestion).withSuccessHandler(trasGestion('Entrega anulada: ' + pesos(e.valor) + ' a ' + e.recibe + '.')).appAnularEntrega(token, e.id);\n  });\n  function solTes() {\n    var te = datos.tesoreria, id = $('tSol').value, s = null;\n    te.solicitudes.forEach(function (x) { if (x.id === id) s = x; });\n    return s;\n  }\n  function pintarSolTes() {\n    var te = datos.tesoreria, pr = $('tProyecto').value, previo = $('tSol').value;\n    var lista = te.solicitudes.filter(function (s) { return s.proyecto === pr; });\n    $('tSol').innerHTML = !pr ? '<option value=\"\">Primero elige el proyecto<\/option>' : lista.map(function (s) {\n      return '<option value=\"' + texto(s.id) + '\">' + texto(s.id) + ' · ' + texto(s.solicitante) + (s.estado === 'Solicitado' ? ' · sin aprobar' : '') + (s.porPagar ? ' · por entregar ' + pesos(s.porPagar) : '') + '<\/option>';\n    }).join('');\n    if (this === $('tSol') || this === window) { if (lista.some(function (s) { return s.id === previo; })) $('tSol').value = previo; }\n    else { var pp = lista.filter(function (s) { return s.porPagar > 0; })[0] || lista[0]; $('tSol').value = pp ? pp.id : ''; } // el viático activo del proyecto va primero\n    var s = solTes(), rPrev = $('tRecibe').value;\n    var pueden = s && s.puedenRecibir && s.puedenRecibir.length ? s.puedenRecibir : te.personas;\n    $('tRecibe').innerHTML = opciones(pueden, 'Elige la persona…');\n    if (pueden.indexOf(rPrev) > -1) $('tRecibe').value = rPrev;\n    $('tDirecta').hidden = true;\n    $('tInfo').innerHTML = !s ? '' :\n      texto(s.objeto) + '<br>' + (s.estado === 'Solicitado' ? 'Solicitado (al registrar la entrega queda aprobado) ' : 'Aprobado ') + pesos(s.aprobado) +\n      ' · entregado ' + pesos(s.entregado) + ' · <b>por entregar ' + pesos(s.porPagar) + '<\/b><br>La entrega se escribe en el bloque 2. ENTREGADO de este formato.';\n    if (s && this === $('tSol')) { $('tRecibe').value = s.sugerido; $('tValor').value = s.porPagar ? pesos(s.porPagar) : ''; }\n    else if (s && !$('tValor').value) { $('tRecibe').value = s.sugerido; $('tValor').value = s.porPagar ? pesos(s.porPagar) : ''; }\n  }\n  $('tProyecto').addEventListener('change', function () { $('tValor').value = ''; pintarSolTes.call(this); });\n  $('tSol').addEventListener('change', pintarSolTes);\n  $('tValor').addEventListener('input', function () { var n = numero(this.value); this.value = n ? pesos(n) : ''; });\n  $('tRegistrar').addEventListener('click', function () {\n    if (gestionando) return;\n    var s = solTes(), p = { sol: $('tSol').value, proyecto: $('tProyecto').value, recibe: $('tRecibe').value, valor: numero($('tValor').value), fecha: $('tFecha').value,\n      medio: $('tMedio').value, comprobante: $('tComp').value.trim(), para: $('tPara').value.trim(), concepto: $('tConcepto').value, uid: llave() };\n    if (!p.proyecto) return aviso('Elige el proyecto.', 'error');\n    if (!s) return aviso('Elige el viático abierto.', 'error');\n    if (!p.recibe) return aviso('Elige a quién se le entregó la plata.', 'error');\n    if (!p.valor) return aviso('Escribe el valor entregado.', 'error');\n    if (!confirm('¿Registrar que se le entregaron ' + pesos(p.valor) + ' a ' + p.recibe + ' para ' + p.proyecto + ' (' + s.id + (s.estado === 'Solicitado' ? ', queda aprobado' : '') + ')?')) return;\n    gestionando = true;\n    aviso('Registrando la entrega…', '', true);\n    google.script.run.withFailureHandler(falloGestion).withSuccessHandler(function (r) {\n      $('tComp').value = ''; $('tPara').value = ''; $('tValor').value = '';\n      trasGestion('Entrega registrada: ' + pesos(p.valor) + ' a ' + p.recibe + (r.entregaDirecta ? ' · formato ' + r.entregaDirecta.id + ' creado para legalizar' : '') + '.')(r);\n    }).appRegistrarEntrega(token, p);\n  });\n  function pintarMisViaticos() {\n    var lista = (datos && datos.misViaticos) || [];\n    $('misViaticos').innerHTML = !lista.length ? '<div class=\"tarjeta\"><p class=\"datos\" style=\"margin:0\">Todavía no tienes solicitudes de viáticos.<\/p><\/div>' : lista.map(function (v) {\n      var entregada = ['Aprobado', 'En revisión', 'Legalizado'].indexOf(v.estado) > -1;\n      return '<div class=\"tarjeta\"><h2>' + texto(v.id) + ' · ' + texto(v.proyecto) + '<\/h2>' +\n        '<p class=\"datos\" style=\"margin:0 0 8px\"><span class=\"estado ' + texto(v.estado) + '\">' + texto(v.estado) + '<\/span> · ' + texto(v.fecha) + '<\/p>' +\n        ((v.entregas || []).length > 1 || (v.entregas || []).some(function (e) { return e.estado === 'Por pagar'; }) ? '<p class=\"datos\" style=\"margin:0 0 8px\">' + v.entregas.map(function (e) {\n          return texto(e.detalle) + ': ' + pesos(e.valor) + ' a <b>' + texto(e.recibe) + '<\/b> · ' + texto(e.estado.toLowerCase()); }).join('<br>') + '<\/p>' : '') +\n        '<p class=\"datos\" style=\"margin:0 0 8px\">' + (entregada ? 'Plata entregada a: <b>' + texto((v.entregas || []).filter(function (e) { return e.estado === 'Entregado'; })\n          .map(function (e) { return e.recibe; }).filter(function (n, i, l) { return l.indexOf(n) === i; }).join(', ') || v.entregadaA) + '<\/b>' :\n          (v.estado === 'Rechazado' ? 'No se entregó la plata.' : 'Pendiente de aprobación. Se entregará a: <b>' + texto(v.entregadaA) + '<\/b>')) + '<\/p>' +\n        '<div class=\"totales\"><div class=\"total\"><span>' + (entregada ? 'Entregado' : 'Pedido') + '<\/span><b>' + pesos(v.solicitado) + '<\/b><\/div>' +\n        '<div class=\"total\"><span>Legalizado<\/span><b>' + pesos(v.legalizado) + '<\/b><\/div><\/div><\/div>';\n    }).join('');\n  }\n  function tarjetaDecision(s) {\n      var revision = s.estado === 'En revisión', saldo = s.solicitado - s.legalizado;\n      return '<div class=\"tarjeta\" data-id=\"' + texto(s.id) + '\">' +\n        '<h2>' + texto(s.id) + ' · ' + texto(s.trabajador) + '<\/h2>' +\n        '<p class=\"datos\">' + texto(s.proyecto) + ' · ' + texto(s.destino) + '<br>' + texto(s.salida) + ' a ' + texto(s.regreso) + '<br>' + texto(s.objeto) + '<\/p>' +\n        (s.viajan ? '<p class=\"datos\" style=\"margin:0 0 10px\"><b>Técnicos que viajan<\/b><br>' + texto(s.viajan) + '<\/p>' : '') +\n        (s.responsable ? '<p class=\"datos\" style=\"margin:0 0 10px\"><b>Técnico responsable del dinero<\/b><br>' + texto(s.responsable) + '<\/p>' : '') +\n        (s.extra ? '<p class=\"datos\" style=\"margin:0 0 10px\">' + texto(s.extra).replace(/\\n/g, '<br>') + '<\/p>' : '') +\n        (s.notas ? '<p class=\"datos\" style=\"margin:0 0 10px\"><b>Observaciones del trabajador<\/b><br>' + texto(s.notas).replace(/\\n/g, '<br>') + '<\/p>' : '') +\n        (!revision && s.yaEntregado ? '<p class=\"datos\" style=\"margin:0 0 10px\"><b>Adición al presupuesto<\/b><br>Ya entregado: ' + pesos(s.yaEntregado) + '<\/p>' : '') +\n        (!revision && s.pendientes && s.pendientes.length ? '<p class=\"datos\" style=\"margin:0 0 10px\"><b>Por entregar<\/b><br>' + s.pendientes.map(function (e) {\n          return pesos(e.valor) + ' a ' + texto(e.recibe) + (e.detalle ? ' · ' + texto(e.detalle) : ''); }).join('<br>') + '<\/p>' : '') +\n        '<div class=\"totales\"><div class=\"total\"><span>' + (revision ? 'Anticipo' : (s.yaEntregado ? 'Presupuesto total' : 'Pide')) + '<\/span><b>' + pesos(s.solicitado) + '<\/b><\/div>' +\n        (revision ? '<div class=\"total\"><span>Gastó (' + s.soportes + ' soportes)<\/span><b>' + pesos(s.legalizado) + '<\/b><\/div>' +\n          '<div class=\"total\"><span>' + (saldo >= 0 ? 'Reintegra' : 'A su favor') + '<\/span><b class=\"' + (saldo >= 0 ? 'verde' : 'rojo') + '\">' + pesos(Math.abs(saldo)) + '<\/b><\/div>' : '') + '<\/div>' +\n        '<p class=\"datos\" style=\"margin:10px 0 0\"><a href=\"' + texto(s.formato) + '\" target=\"_blank\">Ver el formato<\/a>' +\n        (revision ? ' · <a href=\"' + texto(s.carpeta) + '\" target=\"_blank\">Ver los soportes<\/a>' : '') +\n        (!s.propia ? ' · <a href=\"#\" class=\"irGastos\" data-ir=\"' + texto(s.id) + '\">Agregar gastos al formato<\/a>' : '') + '<\/p>' +\n        (s.propia ? '<p class=\"datos mal\" style=\"margin:10px 0 0\">Es tu propia solicitud: la decide administración.<\/p>' :\n          (!revision ? '<label>' + (s.yaEntregado ? 'Entregar la adición a' : 'Entregar el dinero a') + '<\/label><select class=\"dEntrega\">' +\n            '<option value=\"\">' + texto(s.trabajador) + ' (quien solicita)<\/option>' +\n            (s.puedenRecibir || datos.tecnicos || []).filter(function (n) { return n !== s.trabajador; }).map(function (n) {\n              var elegido = s.pendientes && s.pendientes.length ? s.pendientes[s.pendientes.length - 1].recibe : s.responsable;\n              return '<option value=\"' + texto(n) + '\"' + (n === elegido ? ' selected' : '') + '>' + texto(n) + ' (técnico)<\/option>';\n            }).join('') + '<\/select>' : '') +\n          '<label>Observaciones (obligatorias para ' + (revision ? 'devolver' : 'rechazar') + ')<\/label><textarea class=\"dObs\"><\/textarea>' +\n          '<div class=\"botones espacio\"><button type=\"button\" class=\"secundario\" data-accion=\"' + (revision ? 'devolver' : 'rechazar') + '\">' + (revision ? 'Devolver' : 'Rechazar') + '<\/button>' +\n          '<button type=\"button\" class=\"primario\" data-accion=\"' + (revision ? 'legalizar' : 'aprobar') + '\">' + (revision ? 'Legalizar' : 'Aprobar y entregar') + '<\/button><\/div>') +\n        '<\/div>';\n  }\n  function clicDecision(e) {\n    var ir = e.target.getAttribute && e.target.getAttribute('data-ir');\n    if (ir) {\n      e.preventDefault();\n      if (!datos.solicitudes.some(function (x) { return x.id === ir; })) return aviso('Esa solicitud ya no recibe gastos.', 'error');\n      mostrarVista('legalizar'); $('solicitud').value = ir; cargar(ir);\n      return;\n    }\n    var accion = e.target.getAttribute && e.target.getAttribute('data-accion');\n    if (!accion || decidiendo) return;\n    var tarjeta = e.target;\n    while (tarjeta && !(tarjeta.getAttribute && tarjeta.getAttribute('data-id'))) tarjeta = tarjeta.parentNode;\n    var id = tarjeta.getAttribute('data-id'), obs = tarjeta.querySelector('.dObs').value.trim();\n    var sel = tarjeta.querySelector('.dEntrega'), entrega = sel ? sel.value : null;\n    if ((accion === 'rechazar' || accion === 'devolver') && !obs) return aviso('Escribe el motivo en observaciones.', 'error');\n    var verbos = { aprobar: 'Aprobar y entregar la plata de', rechazar: 'Rechazar', legalizar: 'Legalizar', devolver: 'Devolver al trabajador' };\n    var aQuien = accion === 'aprobar' && sel ? '\\n\\nEl dinero se le entrega a: ' + sel.options[sel.selectedIndex].text : '';\n    if (!confirm('¿' + verbos[accion] + ' la solicitud ' + id + '?' + aQuien)) return;\n    decidiendo = true;\n    aviso('Guardando la decisión…', '', true);\n    google.script.run.withFailureHandler(function (err) { decidiendo = false; fallo(err); }).withSuccessHandler(function (r) {\n      decidiendo = false;\n      datos.porAprobar = r.porAprobar; pintarAprobar();\n      if (r.estado === 'Legalizado' || r.estado === 'Rechazado') { // ya no recibe gastos\n        datos.solicitudes = datos.solicitudes.filter(function (x) { return x.id !== id; });\n        llenarSolicitudes();\n        if (detalle && detalle.id === id) { detalle = null; pendientes = []; pintar(); }\n      }\n      (datos.misViaticos || []).forEach(function (v) { if (v.id === id) v.estado = r.estado; });\n      aviso('Solicitud ' + id + ': ' + r.estado + '. Se avisó al trabajador.', 'bien');\n    }).appDecidir(token, id, accion, obs, accion === 'aprobar' ? entrega : null);\n  }\n  $('listaAprobar').addEventListener('click', clicDecision);\n  $('listaRevision').addEventListener('click', clicDecision);\n\n  /* ---------- Solicitud de viáticos ---------- */\n  function prepararSolicitud() {\n    $('sNombre').innerHTML = opciones(datos.trabajadores.map(function (t) { return t.nombre; }), 'Elige tu nombre…');\n    $('sProyecto').innerHTML = opciones(datos.proyectos, datos.proyectos.length ? 'Elige el proyecto…' : 'No tienes proyectos asignados');\n    $('sProyecto').disabled = !datos.proyectos.length;\n    pintarEquipo();\n    $('sNombre').value = sesion.nombre; $('sNombre').disabled = true;\n    $('sCorreo').value = sesion.correo; $('sCorreo').readOnly = true;\n    lineas = [{ concepto: '', fecha: '', valor: 0, obs: '' }];\n    pintarCasillas(); pintarModo(); pintarLineas(); pintarTrabajador(); pintarDias(); pintarPresupuesto();\n  }\n  function pintarPresupuesto() {\n    var previo = $('ppProyecto').value;\n    $('ppProyecto').innerHTML = opciones(datos.proyectos, datos.proyectos.length ? 'Elige el proyecto…' : 'No tienes proyectos asignados');\n    $('ppProyecto').value = datos.proyectos.indexOf(previo) > -1 ? previo : ($('sProyecto').value || '');\n    infoPresupuesto();\n  }\n  function infoPresupuesto() {\n    var e = (datos.equipos || {})[$('ppProyecto').value];\n    if (!e) { $('ppInfo').innerHTML = '<p class=\"datos\" style=\"margin:8px 0 0\">Elige un proyecto para ver su presupuesto, lo entregado y lo legalizado.<\/p>'; return; }\n    var q = e.presu || {}, lineas = e.lineas || [], saldo = q.presupuesto ? q.presupuesto - q.gastado : null;\n    var lista = lineas.length ? '<ul class=\"ppLineas\">' + lineas.map(function (l) {\n        return '<li><span class=\"txt\">' + texto(l.concepto) + (l.detalle ? '<small>' + texto(l.detalle) + '<\/small>' : '') + '<\/span><span class=\"val\">' + pesos(l.valor) + '<\/span>' +\n          (e.aCargo ? '<button type=\"button\" class=\"quitar ppQuitar\" data-id=\"' + texto(l.id) + '\">Quitar<\/button>' : '') + '<\/li>';\n      }).join('') + '<\/ul>'\n      : '<p class=\"datos\" style=\"margin:8px 0\">' + (q.presupuesto ? 'Presupuesto general: <b>' + pesos(q.presupuesto) + '<\/b> (sin detalle por conceptos)' : 'Este proyecto todavía no tiene presupuesto.') + '<\/p>';\n    var form = !e.aCargo ? '' : '<div class=\"ppNuevo\"><label>Agregar al presupuesto (lo sube el ingeniero a cargo)<\/label>' +\n      '<select id=\"ppConcepto\" aria-label=\"Concepto\">' + opciones(datos.conceptos, 'Concepto…') + '<\/select>' +\n      '<div class=\"fila\"><div><input type=\"text\" id=\"ppDetalle\" maxlength=\"150\" placeholder=\"Detalle (opcional)\" autocomplete=\"off\"><\/div>' +\n      '<div><input type=\"text\" id=\"ppValor\" inputmode=\"numeric\" placeholder=\"$ 0\" autocomplete=\"off\"><\/div><\/div>' +\n      '<button type=\"button\" class=\"primario espacio\" id=\"ppAgregar\">Agregar al presupuesto<\/button><\/div>';\n    var personas = '<div class=\"ppNuevo\"><label>Personas a las que se les puede entregar plata en este proyecto<\/label>' +\n      (e.aCargo ? '<div class=\"ppPersonas\">' + (datos.tecnicos || []).map(function (n) {\n          return '<label><input type=\"checkbox\" class=\"ppPersona\" value=\"' + texto(n) + '\"' + ((e.recibenPlata || []).indexOf(n) > -1 ? ' checked' : '') + '>' + texto(n) + '<\/label>';\n        }).join('') + '<\/div><button type=\"button\" class=\"secundario\" id=\"ppGuardarPersonas\">Guardar personas<\/button>'\n        : '<p class=\"datos\" style=\"margin:4px 0\">' + ((e.recibenPlata || []).length ? texto(e.recibenPlata.join(', ')) : 'Cualquier técnico (el ingeniero no ha elegido personas).') + '<\/p>') + '<\/div>';\n    $('ppInfo').innerHTML = lista + form + personas +\n      '<div class=\"totales espacio\"><div class=\"total\"><span>Presupuestado<\/span><b>' + (q.presupuesto ? pesos(q.presupuesto) : '—') + '<\/b><\/div>' +\n      '<div class=\"total\"><span>Entregado<\/span><b>' + pesos(q.entregado || 0) + '<\/b><\/div>' +\n      '<div class=\"total\"><span>Legalizado<\/span><b>' + pesos(q.gastado || 0) + '<\/b><\/div><\/div>' +\n      (saldo !== null ? '<p class=\"datos\" style=\"margin:8px 0 0\">Saldo del presupuesto: <b class=\"' + (saldo < 0 ? 'rojo' : 'verde') + '\">' + pesos(saldo) + '<\/b>' +\n        (q.por ? ' · actualizado por ' + texto(q.por) : '') + '<\/p>' : '') +\n      (e.control ? '<p class=\"datos\" style=\"margin:8px 0 0\"><a href=\"' + texto(e.control) + '\" target=\"_blank\">Ver el formato del proyecto (presupuestado · entregado · legalizado)<\/a><\/p>' : '');\n  }\n\n  $('ppProyecto').addEventListener('change', function () {\n    infoPresupuesto();\n    if (!ampliando() && datos.proyectos.indexOf(this.value) > -1) { $('sProyecto').value = this.value; pintarEquipo(); }\n  });\n  $('ppInfo').addEventListener('input', function (e) {\n    if (e.target.id !== 'ppValor') return;\n    var n = numero(e.target.value); e.target.value = n ? pesos(n) : '';\n  });\n  $('ppInfo').addEventListener('click', function (e) {\n    var proyecto = $('ppProyecto').value;\n    if (gestionando) return;\n    if (e.target.id === 'ppAgregar') {\n      var p = { concepto: $('ppConcepto').value, detalle: $('ppDetalle').value.trim(), valor: numero($('ppValor').value), uid: llave() };\n      if (!p.concepto) return aviso('Elige el concepto.', 'error');\n      if (!p.valor) return aviso('Escribe el valor presupuestado.', 'error');\n      gestionando = true;\n      aviso('Agregando al presupuesto…', '', true);\n      google.script.run.withFailureHandler(falloGestion).withSuccessHandler(function (r) {\n        trasGestion(p.concepto + ' por ' + pesos(p.valor) + ' agregado al presupuesto de \"' + proyecto + '\".')(r);\n        $('ppProyecto').value = proyecto; infoPresupuesto();\n      }).appAgregarPresupuesto(token, proyecto, p);\n      return;\n    }\n    if (e.target.id === 'ppGuardarPersonas') {\n      var eq = datos.equipos[proyecto], tec = datos.tecnicos || [];\n      var marcadas = Array.prototype.slice.call($('ppInfo').querySelectorAll('.ppPersona:checked')).map(function (x) { return x.value; });\n      // Se conservan las personas asignadas que no son técnicos (ven el proyecto, pero no reciben plata)\n      var otros = (eq.tecnicos || []).filter(function (n) { return tec.indexOf(n) === -1; });\n      gestionando = true;\n      aviso('Guardando…', '', true);\n      google.script.run.withFailureHandler(falloGestion).withSuccessHandler(function (r) {\n        trasGestion('Personas que pueden recibir plata en \"' + proyecto + '\" guardadas.')(r);\n        $('ppProyecto').value = proyecto; infoPresupuesto();\n      }).appGuardarTecnicos(token, proyecto, otros.concat(marcadas).map(function (n) { return n.toLowerCase(); }));\n      return;\n    }\n    var id = e.target.className && String(e.target.className).indexOf('ppQuitar') > -1 ? e.target.getAttribute('data-id') : null;\n    if (id) {\n      if (!confirm('¿Quitar esta línea del presupuesto de \"' + proyecto + '\"?')) return;\n      gestionando = true;\n      aviso('Quitando…', '', true);\n      google.script.run.withFailureHandler(falloGestion).withSuccessHandler(function (r) {\n        trasGestion('Línea quitada del presupuesto.')(r);\n        $('ppProyecto').value = proyecto; infoPresupuesto();\n      }).appQuitarPresupuesto(token, proyecto, id);\n    }\n  });\n\n  // Casillas adicionales que el administrador define en la pestaña \"Casillas\"\n  function pintarCasillas() {\n    $('sExtra').innerHTML = (datos.casillas || []).map(function (c, i) {\n      return '<label for=\"sExtra' + i + '\">' + texto(c.nombre) + (c.obligatoria ? ' *' : ' (opcional)') + '<\/label>' +\n        '<input type=\"text\" id=\"sExtra' + i + '\" class=\"cExtra\" data-i=\"' + i + '\" maxlength=\"150\" autocomplete=\"off\"' +\n        (c.ayuda ? ' placeholder=\"' + texto(c.ayuda) + '\"' : '') + '>';\n    }).join('');\n  }\n  function valoresCasillas() {\n    var v = {};\n    (datos.casillas || []).forEach(function (c, i) { v[c.nombre] = $('sExtra' + i).value.trim(); });\n    return v;\n  }\n  // Agregar conceptos a una solicitud propia que todavía no han aprobado\n  function ampliando() {\n    var id = $('sModo').value, a = null;\n    (datos.ampliables || []).forEach(function (x) { if (x.id === id) a = x; });\n    return a;\n  }\n  function pintarModo() {\n    var lista = datos.ampliables || [], previo = $('sModo').value;\n    $('sModoCaja').hidden = !lista.length;\n    $('sModo').innerHTML = '<option value=\"\">Nueva solicitud<\/option>' + lista.map(function (x) {\n      return '<option value=\"' + texto(x.id) + '\">' + (x.estado === 'Aprobado' ? 'Adición a ' : 'Agregar a ') + texto(x.id) + ' · ' + texto(x.proyecto) + ' · ' + pesos(x.total) + '<\/option>';\n    }).join('');\n    $('sModo').value = lista.some(function (x) { return x.id === previo; }) ? previo : '';\n    cambioModo();\n  }\n  function cambioModo() {\n    var a = ampliando();\n    $('sDatosViaje').hidden = !!a;\n    $('sModoInfo').hidden = !a;\n    $('sTituloLineas').textContent = a ? '¿Qué más necesitas para el viaje?' : 'Presupuesto del viaje: ¿qué necesitas?';\n    $('sTotalTitulo').textContent = a ? 'Se agrega' : 'Total solicitado';\n    $('sAmpRespCaja').hidden = !a;\n    if (a) {\n      $('sModoInfo').innerHTML = texto(a.destino) + ' · ' + texto(a.objeto) + '<br>' + texto(fechaCorta(a.salida)) + ' a ' + texto(fechaCorta(a.regreso)) +\n        '<br>Presupuesto actual: <b>' + pesos(a.total) + '<\/b>.' + (a.estado === 'Aprobado'\n          ? ' Ya está aprobada: la adición vuelve a aprobación y lo ya entregado no cambia.'\n          : ' Todavía no la han aprobado.');\n      var eqA = (datos.equipos || {})[a.proyecto], perm = eqA && eqA.recibenPlata && eqA.recibenPlata.length ? eqA.recibenPlata : (datos.tecnicos || []);\n      var ops = [sesion.nombre].concat(perm.filter(function (n) { return n !== sesion.nombre; }));\n      $('sAmpResp').innerHTML = ops.map(function (n) {\n        return '<option value=\"' + (n === sesion.nombre ? '' : texto(n)) + '\">' + texto(n) + (n === sesion.nombre ? ' (yo)' : '') + '<\/option>';\n      }).join('');\n      $('sAmpResp').value = ops.indexOf(a.responsable) > 0 ? a.responsable : '';\n      $('sSalida').value = a.salida; $('sRegreso').value = a.regreso;\n    } else if ($('sDatosViaje').getAttribute('data-ampliaba')) {\n      $('sSalida').value = ''; $('sRegreso').value = '';\n    }\n    if (a) $('sDatosViaje').setAttribute('data-ampliaba', '1'); else $('sDatosViaje').removeAttribute('data-ampliaba');\n    pintarDias();\n  }\n  $('sModo').addEventListener('change', cambioModo);\n  function pintarTrabajador() {\n    var n = $('sNombre').value, t = null;\n    datos.trabajadores.forEach(function (x) { if (x.nombre === n) t = x; });\n    $('sCargo').hidden = !t;\n    if (t) $('sCargo').textContent = [t.cargo, t.area].filter(function (x) { return x; }).join(' · ');\n  }\n  function dias() {\n    var a = $('sSalida').value, b = $('sRegreso').value;\n    if (!a || !b) return 0;\n    return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000) + 1;\n  }\n  function pintarDias() {\n    var a = $('sSalida').value, b = $('sRegreso').value, n = dias(), p = $('sDias');\n    $('sRegreso').min = a || '';\n    p.hidden = !(a && b);\n    p.className = 'datos' + (n < 1 ? ' mal' : '');\n    p.textContent = n < 1 ? 'La fecha de regreso no puede ser anterior a la de salida.' : (n === 1 ? '1 día de viaje' : n + ' días de viaje');\n    // Las fechas de cada concepto se mantienen dentro del viaje\n    lineas.forEach(function (l) { if (a && (!l.fecha || l.fecha < a || (b && b >= a && l.fecha > b))) l.fecha = a; });\n    pintarLineas();\n  }\n  function pintarLineas() {\n    var a = $('sSalida').value, b = $('sRegreso').value;\n    $('lineas').innerHTML = lineas.map(function (l, i) {\n      return '<div class=\"linea\" data-i=\"' + i + '\"><div class=\"fila\"><div><select class=\"lConcepto\" aria-label=\"Concepto\">' +\n        '<option value=\"\">Concepto…<\/option>' + datos.conceptos.map(function (c) {\n          return '<option value=\"' + texto(c) + '\"' + (c === l.concepto ? ' selected' : '') + '>' + texto(c) + '<\/option>';\n        }).join('') + '<\/select><\/div>' +\n        (lineas.length > 1 ? '<button type=\"button\" class=\"quitar lQuitar\">Quitar<\/button>' : '') + '<\/div>' +\n        '<div class=\"fila\"><div><input type=\"date\" class=\"lFecha\" aria-label=\"Fecha\" value=\"' + texto(l.fecha) + '\"' +\n        (a ? ' min=\"' + a + '\"' : '') + (b && b >= a ? ' max=\"' + b + '\"' : '') + '><\/div>' +\n        '<div><input type=\"text\" class=\"lValor\" inputmode=\"numeric\" placeholder=\"$ 0\" aria-label=\"Valor\" autocomplete=\"off\" value=\"' + (l.valor ? pesos(l.valor) : '') + '\"><\/div><\/div>' +\n        '<div class=\"fila\"><div><input type=\"text\" class=\"lObs\" maxlength=\"150\" placeholder=\"Observación (opcional)\" aria-label=\"Observación\" autocomplete=\"off\" value=\"' + texto(l.obs || '') + '\"><\/div><\/div><\/div>';\n    }).join('');\n    pintarTotal();\n  }\n  function totalSolicitud() { return lineas.reduce(function (s, l) { return s + (l.concepto ? l.valor : 0); }, 0); }\n  function pintarTotal() {\n    var a = datos && $('sModo').value ? ampliando() : null;\n    $('sTotal').textContent = pesos(totalSolicitud());\n    $('sNuevoTotal').hidden = !a;\n    if (a) $('sNuevoTotal').innerHTML = 'Nuevo total de ' + texto(a.id) + ': <b>' + pesos(a.total + totalSolicitud()) + '<\/b>';\n    $('sAgregar').hidden = lineas.length >= 20;\n    $('sEnviar').disabled = creando;\n    $('sEnviar').textContent = creando ? (a ? 'Agregando…' : 'Creando tu formato…') : (a ? 'Agregar a ' + a.id : 'Enviar solicitud');\n  }\n  function lineaDe(el) {\n    while (el && !(el.getAttribute && el.getAttribute('data-i') !== null)) el = el.parentNode;\n    return el ? lineas[Number(el.getAttribute('data-i'))] : null;\n  }\n  function cambioLinea(e) {\n    var l = lineaDe(e.target), c = e.target.className;\n    if (!l) return;\n    if (c === 'lConcepto') l.concepto = e.target.value;\n    if (c === 'lFecha') l.fecha = e.target.value;\n    if (c === 'lValor') { l.valor = numero(e.target.value); e.target.value = l.valor ? pesos(l.valor) : ''; }\n    if (c === 'lObs') l.obs = e.target.value;\n    pintarTotal();\n  }\n  $('lineas').addEventListener('input', cambioLinea);\n  $('lineas').addEventListener('change', cambioLinea);\n  $('lineas').addEventListener('click', function (e) {\n    if (e.target.className.indexOf('lQuitar') === -1) return;\n    var l = lineaDe(e.target);\n    lineas.splice(lineas.indexOf(l), 1); pintarLineas();\n  });\n  $('sAgregar').addEventListener('click', function () {\n    lineas.push({ concepto: '', fecha: $('sSalida').value, valor: 0, obs: '' }); pintarLineas();\n    var sel = $('lineas').querySelectorAll('.lConcepto'); sel[sel.length - 1].focus();\n  });\n  $('sNombre').addEventListener('change', pintarTrabajador);\n  // Debajo del proyecto elegido: quién aprueba y qué técnicos están encargados\n  function pintarEquipo() {\n    var e = (datos.equipos || {})[$('sProyecto').value];\n    $('sEquipo').hidden = !e;\n    pintarViajan(e);\n    if (e) $('sEquipo').textContent = 'Técnicos encargados: ' + (e.tecnicos.length ? e.tecnicos.join(', ') : 'sin asignar') + (e.aprueba ? ' · Aprueba: ' + e.aprueba : '');\n  }\n  // Personas del área técnica: se marcan las que van al viaje (vienen marcados los encargados del proyecto)\n  function pintarViajan(equipo) {\n    var lista = datos.tecnicos || [];\n    $('sViajanCaja').hidden = !lista.length || !$('sProyecto').value;\n    var encargados = equipo ? equipo.tecnicos : [];\n    $('sViajan').innerHTML = lista.map(function (n) {\n      return '<label><input type=\"checkbox\" value=\"' + texto(n) + '\"' + (encargados.indexOf(n) > -1 ? ' checked' : '') + '><span>' + texto(n) + '<\/span><\/label>';\n    }).join('');\n    pintarResponsable();\n  }\n  $('sProyecto').addEventListener('change', function () {\n    pintarEquipo(); pintarResponsable();\n    if (this.value) { $('ppProyecto').value = this.value; infoPresupuesto(); }\n  });\n  // Técnico responsable del dinero: cualquier técnico de la lista (primero los marcados que viajan)\n  function pintarResponsable() {\n    var previo = $('sResp').value, tecnicos = datos.tecnicos || [];\n    var permitidos = tecnicos; // cualquier técnico de la lista de Trabajadores\n    var viajan = marcados($('sViajan')); // los técnicos marcados que viajan también pueden recibir la plata\n    var lista = viajan.concat(permitidos.filter(function (n) { return viajan.indexOf(n) === -1; }));\n    var yoTecnico = tecnicos.indexOf(sesion.nombre) > -1;\n    $('sRespCaja').hidden = !tecnicos.length || !$('sProyecto').value;\n    $('sResp').innerHTML = (yoTecnico ? '' : '<option value=\"\">Elige el técnico…<\/option>') + lista.map(function (n) {\n      return '<option value=\"' + texto(n) + '\">' + texto(n) + (n === sesion.nombre ? ' (yo)' : '') + '<\/option>';\n    }).join('');\n    $('sResp').value = viajan.indexOf(previo) > -1 ? previo : viajan.length === 1 ? viajan[0] : lista.indexOf(previo) > -1 ? previo : (yoTecnico && lista.indexOf(sesion.nombre) > -1 ? sesion.nombre : (viajan.length === 1 ? viajan[0] : (lista.length === 1 ? lista[0] : '')));\n  }\n  $('sViajan').addEventListener('change', pintarResponsable);\n  $('sForm').addEventListener('input', function () { llaveSolicitud = ''; });\n  $('sForm').addEventListener('change', function () { llaveSolicitud = ''; });\n  $('sSalida').addEventListener('change', function () {\n    if (!$('sRegreso').value || $('sRegreso').value < this.value) $('sRegreso').value = this.value;\n    pintarDias();\n  });\n  $('sRegreso').addEventListener('change', pintarDias);\n\n  $('sEnviar').addEventListener('click', function () {\n    if (creando) return;\n    if (ampliando()) return enviarAmpliacion(ampliando());\n    var p = {\n      nombre: $('sNombre').value, correo: $('sCorreo').value.trim(), proyecto: $('sProyecto').value,\n      ciudad: $('sCiudad').value.trim(), salida: $('sSalida').value, regreso: $('sRegreso').value,\n      objeto: $('sObjeto').value.trim(), viajan: marcados($('sViajan')), responsable: $('sResp').value, extra: valoresCasillas(),\n      lineas: lineas.filter(function (l) { return l.concepto && l.valor > 0; })\n    };\n    llaveSolicitud = llaveSolicitud || llave();\n    p.uid = llaveSolicitud;\n    if (!p.nombre) return aviso('Elige tu nombre.', 'error');\n    if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(p.correo)) return aviso('Escribe tu correo para poder avisarte.', 'error');\n    if (!p.proyecto) return aviso('Elige el proyecto.', 'error');\n    if (!p.ciudad) return aviso('Escribe la ciudad de destino.', 'error');\n    if (!p.salida || !p.regreso) return aviso('Elige las fechas de salida y de regreso.', 'error');\n    if (dias() < 1) return aviso('La fecha de regreso no puede ser anterior a la de salida.', 'error');\n    if (!p.objeto) return aviso('Escribe el objeto del viaje.', 'error');\n    if (!$('sRespCaja').hidden && p.viajan.length && !p.responsable) return aviso('Elige el técnico responsable del dinero.', 'error');\n    var falta = (datos.casillas || []).filter(function (c) { return c.obligatoria && !p.extra[c.nombre]; })[0];\n    if (falta) return aviso('Llena la casilla \"' + falta.nombre + '\".', 'error');\n    if (lineas.some(function (l) { return (l.concepto && !l.valor) || (!l.concepto && l.valor); })) return aviso('Hay un concepto sin valor o un valor sin concepto.', 'error');\n    if (!p.lineas.length) return aviso('Agrega al menos un concepto con su valor.', 'error');\n    guardar('viaticos_nombre', p.nombre); guardar('viaticos_correo', p.correo);\n    creando = true; pintarTotal();\n    aviso('Creando tu formato de viáticos. Puede tardar unos segundos…', '', true);\n    google.script.run.withFailureHandler(function (err) { creando = false; pintarTotal(); fallo(err); })\n      .withSuccessHandler(function (r) {\n        creando = false; $('aviso').hidden = true; llaveSolicitud = '';\n        ultimaSolicitud = r;\n        datos.solicitudes.unshift({ id: r.id, texto: r.texto }); llenarSolicitudes();\n        (datos.ampliables = datos.ampliables || []).unshift({ id: r.id, proyecto: p.proyecto, destino: p.ciudad, objeto: p.objeto, total: r.total, salida: p.salida, regreso: p.regreso });\n        $('sHechoTitulo').textContent = 'Solicitud ' + r.id + ' enviada';\n        $('sHechoTexto').innerHTML = 'Pediste <b>' + pesos(r.total) + '<\/b> para ' + texto(p.proyecto) + '. Tu jefe ya recibió el aviso para aprobarla.' +\n          (p.responsable ? '<br>Técnico responsable del dinero: <b>' + texto(p.responsable) + '<\/b>' : '') +\n          (r.url ? '<br><a href=\"' + texto(r.url) + '\" target=\"_blank\">Ver mi formato<\/a>' : '');\n        $('sForm').hidden = true; $('sHecho').hidden = false; window.scrollTo(0, 0);\n        ['sCiudad', 'sSalida', 'sRegreso', 'sObjeto'].forEach(function (id) { $(id).value = ''; });\n        $('sProyecto').value = ''; $('sResp').value = ''; pintarEquipo(); pintarCasillas();\n        lineas = [{ concepto: '', fecha: '', valor: 0, obs: '' }]; pintarModo();\n      }).appCrearSolicitud(token, p);\n  });\n  function enviarAmpliacion(a) {\n    var p = { id: a.id, lineas: lineas.filter(function (l) { return l.concepto && l.valor > 0; }), entregaA: $('sAmpResp').value };\n    if (lineas.some(function (l) { return (l.concepto && !l.valor) || (!l.concepto && l.valor); })) return aviso('Hay un concepto sin valor o un valor sin concepto.', 'error');\n    if (!p.lineas.length) return aviso('Agrega al menos un concepto con su valor.', 'error');\n    if (!confirm('¿Agregar ' + pesos(totalSolicitud()) + ' a la solicitud ' + a.id + '?\\n\\nLa plata se le entrega a: ' + $('sAmpResp').options[$('sAmpResp').selectedIndex].text)) return;\n    llaveSolicitud = llaveSolicitud || llave();\n    p.uid = llaveSolicitud;\n    creando = true; pintarTotal();\n    aviso('Agregando a ' + a.id + '…', '', true);\n    google.script.run.withFailureHandler(function (err) { creando = false; pintarTotal(); fallo(err); })\n      .withSuccessHandler(function (r) {\n        creando = false; $('aviso').hidden = true; llaveSolicitud = '';\n        a.total = r.total;\n        ultimaSolicitud = { id: r.id };\n        $('sHechoTitulo').textContent = 'Solicitud ' + r.id + ' ampliada';\n        a.estado = 'Solicitado';\n        $('sHechoTexto').innerHTML = 'Agregaste <b>' + pesos(r.agregado) + '<\/b> para <b>' + texto(r.recibe) + '<\/b>. El presupuesto queda en <b>' + pesos(r.total) + '<\/b>. ' +\n          (r.adicion ? 'La adición quedó por aprobar; lo ya entregado no cambia.' : 'Quien aprueba ya recibió el aviso.') +\n          (r.url ? '<br><a href=\"' + texto(r.url) + '\" target=\"_blank\">Ver mi formato<\/a>' : '');\n        $('sForm').hidden = true; $('sHecho').hidden = false; window.scrollTo(0, 0);\n        lineas = [{ concepto: '', fecha: '', valor: 0, obs: '' }];\n        $('sModo').value = ''; pintarModo();\n      }).appAmpliarSolicitud(token, p);\n  }\n  $('sOtra').addEventListener('click', function () { $('sHecho').hidden = true; $('sForm').hidden = false; window.scrollTo(0, 0); });\n  $('sIrGastos').addEventListener('click', function () {\n    $('sHecho').hidden = true; $('sForm').hidden = false;\n    mostrarVista('legalizar');\n    if (ultimaSolicitud) { $('solicitud').value = ultimaSolicitud.id; cargar(ultimaSolicitud.id); }\n  });\n\n  function cargar(id) {\n    detalle = null; pendientes = []; pintar();\n    $('hecho').hidden = true;\n    if (!id) return;\n    recordar(id);\n    aviso('Cargando…', '', true);\n    google.script.run.withFailureHandler(function (err) {\n      // Si no se pudo abrir, se deja la lista en \"Elige…\" para poder volver a elegirla (y el aviso no se borra solo)\n      if ($('solicitud').value === id) $('solicitud').value = '';\n      fallo(err);\n      if (!(err && err.message && err.message.indexOf('SESION:') > -1)) {\n        aviso('No se pudo abrir ' + id + ': ' + ((err && err.message) || 'sin conexión') + ' Vuelve a elegirla en la lista.', 'error', true);\n      }\n    }).withSuccessHandler(function (d) {\n      if ($('solicitud').value !== d.id) return; // llegó tarde: ya se eligió otra solicitud\n      $('aviso').hidden = true;\n      detalle = d; pintar();\n    }).appDetalle(token, id);\n  }\n\n  /* ---------- Pantalla ---------- */\n  function pintar() {\n    var hay = !!detalle;\n    ['resumen', 'nuevo', 'cierre'].forEach(function (id) { $(id).hidden = !hay; });\n    $('pendientes').hidden = !hay || !pendientes.length;\n    $('registrados').hidden = !hay || !detalle.gastos.length;\n    if (!hay) return;\n\n    var porEnviar = pendientes.reduce(function (s, p) { return s + p.valor; }, 0);\n    var gastado = detalle.legalizado + porEnviar;\n    var saldo = detalle.solicitado - gastado;\n    var ajena = detalle.propia === false && !detalle.resp;\n    $('datos').innerHTML = '<b>' + texto(detalle.trabajador) + '<\/b><br>' + texto(detalle.proyecto) +\n      ' · ' + texto(detalle.destino) + '<br>' + texto(detalle.salida) + ' a ' + texto(detalle.regreso) + ' · ' + texto(detalle.estado) +\n      (detalle.entregadaA ? '<br>Plata entregada a: <b>' + texto(detalle.entregadaA) + '<\/b>' : '') +\n      (ajena ? '<br><span class=\"avisoEquipo\">Estás agregando gastos al formato de ' + texto(detalle.trabajador) +\n        '. Quedan registrados con tu correo en la columna CONTROL y se le avisa por correo.<\/span>' : '');\n    $('cierre').hidden = detalle.puedeEnviar === false || ajena;\n    $('tAnticipo').textContent = pesos(detalle.solicitado);\n    $('tGastado').textContent = pesos(gastado);\n    $('tSaldoTitulo').textContent = ajena ? (saldo >= 0 ? 'Le queda' : 'A su favor') : (saldo >= 0 ? 'Te queda' : 'A tu favor');\n    $('tSaldo').textContent = pesos(Math.abs(saldo));\n    $('tSaldo').className = saldo >= 0 ? 'verde' : 'rojo';\n    var pct = detalle.solicitado > 0 ? Math.min(100, Math.round(gastado * 100 / detalle.solicitado)) : (gastado > 0 ? 100 : 0);\n    $('barra').style.width = pct + '%';\n    $('barra').style.background = saldo >= 0 ? '#FFB41D' : '#c62828';\n\n    var cupo = detalle.cupo - pendientes.length;\n    $('agregar').disabled = ocupado || cupo <= 0;\n    $('agregar').textContent = cupo <= 0 ? 'Esta solicitud llegó al máximo de gastos' : 'Agregar a la lista';\n\n    $('listaPend').innerHTML = pendientes.map(function (p, i) {\n      return '<li>' + (p.miniatura ? '<img src=\"' + p.miniatura + '\" alt=\"\">' : '<span class=\"sin\">' + (p.foto ? 'PDF' : 'Sin soporte') + '<\/span>') +\n        '<span class=\"txt\">' + texto(p.concepto) + '<small>' + texto(fechaCorta(p.fecha)) + ' · ' + texto(p.tercero) + '<\/small><\/span>' +\n        '<span class=\"val\">' + pesos(p.valor) + '<\/span>' +\n        (ocupado ? '' : '<button class=\"quitar\" data-i=\"' + i + '\">Quitar<\/button>') + '<\/li>';\n    }).join('');\n    $('enviar').disabled = ocupado;\n    $('enviar').textContent = ocupado ? 'Enviando…' : 'Enviar ' + pendientes.length + (pendientes.length === 1 ? ' gasto' : ' gastos') + ' · ' + pesos(porEnviar);\n\n    $('tituloReg').textContent = 'Gastos registrados (' + detalle.gastos.length + ')';\n    // Gastos agrupados por día, con el subtotal de cada día\n    var porDia = {}, ordenDias = [];\n    detalle.gastos.forEach(function (g) {\n      if (!porDia[g.fecha]) { porDia[g.fecha] = { total: 0, items: [] }; ordenDias.push(g.fecha); }\n      porDia[g.fecha].total += g.valor; porDia[g.fecha].items.push(g);\n    });\n    $('listaReg').innerHTML = ordenDias.map(function (dia) {\n      return '<li class=\"dia\"><span>' + texto(dia) + '<\/span><span>' + pesos(porDia[dia].total) + '<\/span><\/li>' +\n        porDia[dia].items.map(function (g) {\n          return '<li><span class=\"sin\">' + texto(g.n) + '<\/span><span class=\"txt\">' + texto(g.concepto) +\n            '<small>' + texto(g.tercero) + '<\/small>' +\n            (g.url ? '<small><a href=\"' + texto(g.url) + '\" target=\"_blank\">Ver soporte<\/a><\/small>' : '') + '<\/span>' +\n            '<span class=\"val\">' + pesos(g.valor) + '<\/span><\/li>';\n        }).join('');\n    }).join('');\n    var hoyCorto = fechaCorta(hoy());\n    var deHoy = (porDia[hoyCorto] ? porDia[hoyCorto].total : 0) + pendientes.reduce(function (s, p) { return s + (fechaCorta(p.fecha) === hoyCorto ? p.valor : 0); }, 0);\n    $('hoyTxt').textContent = 'Hoy llevas ' + pesos(deHoy) + ' · ' + ordenDias.length + (ordenDias.length === 1 ? ' día con gastos' : ' días con gastos') + '. Puedes volver cada día a agregar más.';\n    $('revision').disabled = ocupado || pendientes.length > 0;\n  }\n\n  /* ---------- Foto ---------- */\n  function leerFoto(archivo, listo) {\n    var lector = new FileReader();\n    lector.onerror = function () { listo(null); };\n    lector.onload = function () {\n      var url = lector.result;\n      var crudo = { nombre: archivo.name || 'soporte', tipo: archivo.type || 'application/octet-stream', base64: String(url).split(',')[1] || '', miniatura: '' };\n      if (!/^image\\//.test(archivo.type)) { listo(crudo); return; }\n      var img = new Image();\n      img.onerror = function () { listo(crudo); };\n      img.onload = function () {\n        try {\n          var max = 1600, w = img.width, h = img.height, k = Math.min(1, max / Math.max(w, h));\n          var c = document.createElement('canvas');\n          c.width = Math.round(w * k); c.height = Math.round(h * k);\n          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);\n          var grande = c.toDataURL('image/jpeg', 0.8);\n          var m = document.createElement('canvas'), km = 120 / Math.max(w, h);\n          m.width = Math.max(1, Math.round(w * km)); m.height = Math.max(1, Math.round(h * km));\n          m.getContext('2d').drawImage(img, 0, 0, m.width, m.height);\n          listo({ nombre: 'soporte.jpg', tipo: 'image/jpeg', base64: grande.split(',')[1], miniatura: m.toDataURL('image/jpeg', 0.7) });\n        } catch (e) { listo(crudo); }\n      };\n      img.src = url;\n    };\n    lector.readAsDataURL(archivo);\n  }\n\n  function usarArchivo(archivo) {\n    fotoActual = null; $('vista').hidden = true;\n    if (!archivo) return;\n    if (archivo.size > 10 * 1024 * 1024) { aviso('El archivo pesa más de 10 MB. Toma la foto de nuevo.', 'error'); return; }\n    if (!/^image\\//.test(archivo.type) && archivo.type !== 'application/pdf') { aviso('El soporte debe ser una foto o un PDF.', 'error'); return; }\n    $('sinSoporte').checked = false; ajustarObs();\n    leerFoto(archivo, function (f) {\n      if (!f || !f.base64) { aviso('No se pudo leer la foto. Intenta de nuevo.', 'error'); return; }\n      fotoActual = f;\n      $('miniatura').hidden = !f.miniatura; $('miniatura').src = f.miniatura || '';\n      $('nombreFoto').textContent = f.miniatura ? 'Foto lista' : (archivo.name || 'Archivo listo');\n      $('vista').hidden = false;\n    });\n  }\n  ['foto', 'fotoCam'].forEach(function (id) {\n    $(id).addEventListener('change', function () {\n      var archivo = this.files && this.files[0];\n      this.value = '';\n      usarArchivo(archivo);\n    });\n  });\n  $('elegir').addEventListener('click', function () { $('foto').click(); });\n\n  /* ---------- Cámara ---------- */\n  var flujo = null;\n  var esCelular = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);\n  function cerrarCamara() {\n    if (flujo) { flujo.getTracks().forEach(function (t) { t.stop(); }); flujo = null; }\n    $('video').srcObject = null; $('camara').hidden = true;\n  }\n  $('tomar').addEventListener('click', function () {\n    // En el celular se abre la cámara del teléfono; en el computador, la cámara web.\n    if (esCelular || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $('fotoCam').click(); return; }\n    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })\n      .then(function (s) {\n        flujo = s; $('video').srcObject = s; $('camara').hidden = false;\n      })\n      .catch(function () {\n        aviso('No se pudo abrir la cámara. Revisa el permiso de cámara del navegador o usa \"Elegir archivo\".', 'error');\n      });\n  });\n  $('cancelarCam').addEventListener('click', cerrarCamara);\n  $('capturar').addEventListener('click', function () {\n    var v = $('video');\n    if (!v.videoWidth) { aviso('La cámara todavía no está lista.', 'error'); return; }\n    var c = document.createElement('canvas');\n    c.width = v.videoWidth; c.height = v.videoHeight;\n    c.getContext('2d').drawImage(v, 0, 0);\n    cerrarCamara();\n    c.toBlob(function (blob) {\n      if (!blob) { aviso('No se pudo tomar la foto. Intenta de nuevo.', 'error'); return; }\n      usarArchivo(blob);\n    }, 'image/jpeg', 0.9);\n  });\n\n  function ajustarObs() {\n    $('obsEtiqueta').textContent = $('sinSoporte').checked ? 'Explica por qué no hay soporte' : 'Observaciones (opcional)';\n  }\n  $('sinSoporte').addEventListener('change', function () {\n    if (this.checked) { fotoActual = null; $('vista').hidden = true; }\n    ajustarObs();\n  });\n\n  $('valor').addEventListener('input', function () {\n    var n = numero(this.value);\n    this.value = n ? pesos(n) : '';\n  });\n\n  /* ---------- Acciones ---------- */\n  $('solicitud').addEventListener('change', function () {\n    if (pendientes.length && !confirm('Tienes ' + pendientes.length + ' gasto(s) sin enviar. Si cambias de solicitud se pierden. ¿Cambiar?')) {\n      this.value = detalle ? detalle.id : '';\n      return;\n    }\n    cargar(this.value);\n  });\n\n  $('agregar').addEventListener('click', function () {\n    var p = {\n      fecha: $('fecha').value, concepto: $('concepto').value, valor: numero($('valor').value),\n      tercero: $('tercero').value.trim(), nSoporte: $('nSoporte').value.trim(), factura: $('factura').value.trim(), obs: $('obs').value.trim(),\n      sinSoporte: $('sinSoporte').checked, foto: fotoActual, miniatura: fotoActual ? fotoActual.miniatura : '', uid: llave()\n    };\n    if (!p.foto && !p.sinSoporte) return aviso('Toma la foto del recibo o marca \"No tengo soporte\".', 'error');\n    if (!p.valor) return aviso('Escribe el valor gastado.', 'error');\n    if (!p.fecha) return aviso('Elige la fecha del gasto.', 'error');\n    if (!p.concepto) return aviso('Elige el concepto.', 'error');\n    if (!p.tercero) return aviso('Escribe a quién le pagaste.', 'error');\n    if (p.sinSoporte && !p.obs) return aviso('Explica en observaciones por qué no hay soporte.', 'error');\n    pendientes.push(p);\n    fotoActual = null;\n    ['valor', 'tercero', 'nSoporte', 'factura', 'obs'].forEach(function (id) { $(id).value = ''; });\n    $('concepto').value = ''; $('sinSoporte').checked = false; $('vista').hidden = true; ajustarObs();\n    pintar();\n    aviso('Gasto agregado. Puedes agregar otro o enviar.', 'bien');\n  });\n\n  $('listaPend').addEventListener('click', function (e) {\n    var i = e.target.getAttribute && e.target.getAttribute('data-i');\n    if (i === null || i === undefined) return;\n    pendientes.splice(Number(i), 1); pintar();\n  });\n\n  function enviarSiguiente(total) {\n    if (!pendientes.length) {\n      ocupado = false; pintar();\n      aviso(total === 1 ? 'Gasto registrado en tu formato.' : total + ' gastos registrados en tu formato.', 'bien');\n      return;\n    }\n    var p = pendientes[0];\n    aviso('Enviando gasto ' + (total - pendientes.length + 1) + ' de ' + total + '…', '', true);\n    google.script.run.withFailureHandler(fallo).withSuccessHandler(function (d) {\n      pendientes.shift(); detalle = d; pintar();\n      enviarSiguiente(total);\n    }).appGuardarGasto(token, {\n      id: detalle.id, fecha: p.fecha, concepto: p.concepto, valor: p.valor, tercero: p.tercero,\n      nSoporte: p.nSoporte, factura: p.factura, obs: p.obs, uid: p.uid,\n      foto: p.foto ? { nombre: p.foto.nombre, tipo: p.foto.tipo, base64: p.foto.base64 } : null\n    });\n  }\n  $('enviar').addEventListener('click', function () {\n    if (ocupado || !pendientes.length) return;\n    ocupado = true; pintar();\n    enviarSiguiente(pendientes.length);\n  });\n\n  $('revision').addEventListener('click', function () {\n    if (ocupado || !detalle) return;\n    var saldo = detalle.solicitado - detalle.legalizado;\n    var resumen = 'Gastado: ' + pesos(detalle.legalizado) + ' de ' + pesos(detalle.solicitado) + '.\\n' +\n      (saldo >= 0 ? 'Debes reintegrar ' + pesos(saldo) + '.' : 'Tienes a favor ' + pesos(-saldo) + '.');\n    if (!confirm('¿Enviar ' + detalle.id + ' a revisión?\\n\\n' + resumen + '\\n\\nYa no podrás agregar más gastos.')) return;\n    ocupado = true; pintar();\n    aviso('Enviando a revisión…', '', true);\n    var id = detalle.id;\n    google.script.run.withFailureHandler(fallo).withSuccessHandler(function () {\n      ocupado = false; detalle = null; pendientes = []; pintar();\n      $('aviso').hidden = true;\n      datos.solicitudes = datos.solicitudes.filter(function (x) { return x.id !== id; });\n      llenarSolicitudes();\n      $('textoHecho').textContent = 'La solicitud ' + id + ' quedó en revisión de tu jefe. ' + resumen.replace('\\n', ' ');\n      $('hecho').hidden = false;\n    }).appEnviarRevision(token, id);\n  });\n\n  arrancar();\n})();\n<\/script>\n<\/body>\n<\/html>\n";