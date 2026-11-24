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

