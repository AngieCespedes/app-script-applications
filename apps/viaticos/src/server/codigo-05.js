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
    intentar_(function () { llenarControl_(ss, d, hojaFormato_(Aislamiento_.abrirLibro(d[C.idFormato - 1]))); });
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

