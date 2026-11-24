// Archivo "Control de viáticos - <proyecto>" en la carpeta del proyecto (lo crea la primera vez)
function libroControl_(ss) {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('CTL_LIBRO');
  if (id) {
    try { if (!DriveApp.getFileById(id).isTrashed()) return Aislamiento_.abrirLibro(id); } catch (err) {}
  }
  const libro = SpreadsheetApp.create('Resumen de viáticos por proyecto - Social Solar');
  intentar_(function () { libro.setSpreadsheetLocale(ss.getSpreadsheetLocale()); libro.setSpreadsheetTimeZone(ZONA); });
  intentar_(function () { DriveApp.getFileById(libro.getId()).moveTo(Aislamiento_.carpeta(props.getProperty('ROOT_ID'))); });
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
      if (!DriveApp.getFileById(id).isTrashed()) return Aislamiento_.abrirLibro(id);
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

 // primera fila de los tres bloques
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

