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
function appGuardarPresupuesto_(token, nombreProyecto, valor) {
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
    return appDatos_(token);
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
function appAgregarPresupuesto_(token, nombreProyecto, p) {
  const yo = sesion_(token);
  const candado = candado_();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const proy = puedePresupuestar_(ss, yo, nombreProyecto);
    p = p || {};
    const cache = CacheService.getScriptCache();
    const uid = String(p.uid || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 60);
    if (uid && cache.get('UP_' + uid)) return appDatos_(token);
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
    return appDatos_(token);
  } finally {
    candado.releaseLock();
  }
}

function appQuitarPresupuesto_(token, nombreProyecto, idLinea) {
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
    return appDatos_(token);
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
function actualizarControles() { Guardas_.activador(arguments[0]);
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('CTL_TRIG');
  intentar_(function () {
    ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'actualizarControles') ScriptApp.deleteTrigger(t); });
  });
  const pend = JSON.parse(props.getProperty('CTL_PEND') || '[]');
  props.setProperty('CTL_PEND', '[]');
  const ss = SpreadsheetApp.getActiveSpreadsheet() || Aislamiento_.abrirLibro(props.getProperty('MAESTRO_ID'));
  pend.forEach(function (n) {
    try { llenarControlProyecto_(ss, n); } catch (err) { console.error('Formato del proyecto ' + n + ': ' + err); }
  });
  if (pend.length) { try { llenarResumenControl_(ss); } catch (err) { console.error('Resumen de control: ' + err); } }
}

// Menú: arma o actualiza el formato de todos los proyectos
function actualizarFormatosProyecto() { Guardas_.persona();
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

