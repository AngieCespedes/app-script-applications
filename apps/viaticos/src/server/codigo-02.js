function avisarAdmin_(asunto, html) {
  correo_(PropertiesService.getScriptProperties().getProperty('ADMIN'), asunto, html);
}

function correo_(para, asunto, html) {
  if (!para) return;
  try {
    Correo_.enviar({ to: para, subject: asunto, htmlBody: html });
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
        const css = Aislamiento_.abrirLibro(x.d[C.idFormato - 1]);
        css.rename(String(css.getName()).replace(id, x.nuevo));
        const dd = reg.getRange(x.i + 2, 1, 1, REG.length).getValues()[0];
        llenarEntregado_(hojaFormato_(css), dd);
      });
      intentar_(function () { const c = Aislamiento_.carpeta(x.d[C.idCarpeta - 1]); c.setName(String(c.getName()).replace(id, x.nuevo)); });
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
function eliminarSolicitud() { Guardas_.persona();
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
  intentar_(function () { Aislamiento_.carpeta(x.d[C.idCarpeta - 1]).setTrashed(true); drive = true; });
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

function instalar() { Guardas_.persona();
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
  try { raiz = Aislamiento_.carpeta(props.getProperty('ROOT_ID') || CARPETA_DESTINO_ID); raiz.getName(); } catch (err) { raiz = null; }
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
    try { Aislamiento_.abrirFormulario(id).setAcceptingResponses(false); } catch (err) { console.error(err); }
  });
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (['alEnviarSolicitud', 'alEnviarGasto'].indexOf(t.getHandlerFunction()) > -1) ScriptApp.deleteTrigger(t);
    });
  } catch (err) { console.error(err); }
  props.setProperty('FORMS_CERRADOS', '1');
}

// Quedan definidas por si algún activador viejo sigue vivo; ya no hacen nada
function alEnviarSolicitud_() {}

function alEnviarGasto_() {}

