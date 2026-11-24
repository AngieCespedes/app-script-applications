 // texto de la firma cuando se decide una adición (lo pone appDecidir)
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
  try { f = hojaFormato_(Aislamiento_.abrirLibro(d[C.idFormato - 1])); } catch (err) {}
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
function alEditar(e) { Guardas_.activador(arguments[0]);
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

