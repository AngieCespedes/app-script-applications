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

  Instalacion_.menu();
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

