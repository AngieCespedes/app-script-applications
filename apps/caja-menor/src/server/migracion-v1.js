/**
 * MigracionV1 — correcciones de fórmulas y datos heredados de la v3.
 * Cada función revisa antes de cambiar, para poder correrse más de una vez.
 */
var MigracionV1 = (function () {
  var FILA_INI = 9, FILA_FIN = 58;

  /** Plazo del DSE: solo cuenta días si el soporte es un DSE o el estado dice que falta. */
  function formulaPlazo_(f) {
    return '=IF(B' + f + '="","",IF(AND(NOT(ISNUMBER(SEARCH("DSE",I' + f + '))),NOT(ISNUMBER(SEARCH("DSE",O' + f + '))),' +
      'NOT(ISNUMBER(SEARCH("no quiso",O' + f + '))),NOT(ISNUMBER(SEARCH("No se pudo",O' + f + ')))),"No requiere",' +
      'IF(OR(ISNUMBER(SEARCH("Ya tiene",O' + f + ')),ISNUMBER(SEARCH("generado",O' + f + '))),"Generado",' +
      'IF(TODAY()>B' + f + '+Listas!$H$7,"VENCIDO",B' + f + '+Listas!$H$7-TODAY()&" días"))))';
  }

  /** «S/N» (sin número) no cuenta como soporte repetido. */
  function ajustarRevision(x) {
    if (!x || x.indexOf('<>"S/N"') > -1) return x;
    return x.replace(/AND\(C(\d+)<>"",COUNTIF/, 'AND(C$1<>"",C$1<>"S/N",COUNTIF');
  }

  function corregirFormulas(ss) {
    var rel = ss.getSheetByName(Config.HOJAS.relacion);
    var n = FILA_FIN - FILA_INI + 1;

    var rev = rel.getRange('M' + FILA_INI + ':M' + FILA_FIN);
    rev.setFormulas(rev.getFormulas().map(function (f) { return [ajustarRevision(f[0])]; }));

    // Plazo DSE.
    var plazos = [];
    for (var i = 0; i < n; i++) plazos.push([formulaPlazo_(FILA_INI + i)]);
    rel.getRange('R' + FILA_INI + ':R' + FILA_FIN).setFormulas(plazos);

    // Efectivo contado: solo vale un arqueo hecho después del último movimiento.
    rel.getRange('L64').setFormula('=IF(OR(Arqueo!B5="",Arqueo!B5<MAX(B9:B58)),"",Arqueo!C21)');
    var arq = ss.getSheetByName(Config.HOJAS.arqueo);
    arq.getRange('C24').setFormula('=IF(\'Relación\'!L64="","",C21)');
    arq.getRange('C25').setFormula('=IF(C24="","",C24-C23)');
    arq.getRange('C26').setFormula('=IF(C24="","Sin arqueo vigente",IF(C25=0,"Cuadra",IF(C25>0,"Sobra efectivo","Falta efectivo")))');

    // Terceros: el control de 100 UVT también mira la relación en curso, no solo las cerradas.
    var ter = ss.getSheetByName(Config.HOJAS.terceros);
    var filas = Math.min(ter.getMaxRows(), 1000) - 1;
    var hi = [];
    for (var r = 2; r < filas + 2; r++) {
      var enRel = "SUMIFS('Relación'!$L$9:$L$58,'Relación'!$E$9:$E$58,$A" + r;
      hi.push([
        '=IF($A' + r + '="","",SUMIFS(Movimientos!$M$2:$M$3000,Movimientos!$F$2:$F$3000,$A' + r +
          ',Movimientos!$K$2:$K$3000,"Efectivo*")+' + enRel + ",'Relación'!$J$9:$J$58,\"Efectivo*\"))",
        '=IF($A' + r + '="","",SUMIFS(Movimientos!$M$2:$M$3000,Movimientos!$F$2:$F$3000,$A' + r + ')+' + enRel + ')-H' + r + ')'
      ]);
    }
    ter.getRange(2, 8, filas, 2).setFormulas(hi);
  }

  /** NIT sin DV, y «Ver soporte» → «S/N» conservando el enlace a la foto. */
  function normalizarDatos(ss) {
    var rel = ss.getSheetByName(Config.HOJAS.relacion);
    var nits = rel.getRange('E' + FILA_INI + ':E' + FILA_FIN);
    nits.setValues(nits.getValues().map(function (f) { return [f[0] === '' ? '' : Util.nit(f[0])]; }));

    var sop = rel.getRange('C' + FILA_INI + ':C' + FILA_FIN);
    var rich = sop.getRichTextValues();
    rich.forEach(function (r, i) {
      if (r[0] && r[0].getText() === 'Ver soporte') {
        var url = r[0].getLinkUrl();
        var nuevo = SpreadsheetApp.newRichTextValue().setText(Config.SIN_NUMERO);
        if (url) nuevo.setLinkUrl(url);
        rel.getRange(FILA_INI + i, 3).setRichTextValue(nuevo.build());
      }
    });

    var ter = ss.getSheetByName(Config.HOJAS.terceros);
    var col = ter.getRange(2, 1, Math.max(ter.getLastRow() - 1, 1), 1);
    col.setValues(col.getValues().map(function (f) { return [f[0] === '' ? '' : Util.nit(f[0])]; }));
  }

  /** Mueve las notas explicativas que quedaron dentro de las tablas a la nota del encabezado. */
  function sacarNotasDeTablas() {
    ['movimientos', 'historial'].forEach(function (clave) {
      var t = Libro.tabla(clave);
      Libro.leer(t).forEach(function (o) {
        var primero = String(o[t.encabezados[0]] || '');
        if (/^\d+$/.test(primero) || primero.length < 40) return;
        var celdaEnc = t.hoja.getRange(t.filaIni - 1, t.col);
        celdaEnc.setNote([celdaEnc.getNote(), primero].filter(String).join('\n\n'));
        t.hoja.getRange(o._fila, t.col, 1, t.encabezados.length).clearContent();
      });
    });
  }

  return { ajustarRevision: ajustarRevision, formulaPlazo: formulaPlazo_, corregirFormulas: corregirFormulas, normalizarDatos: normalizarDatos, sacarNotasDeTablas: sacarNotasDeTablas };
})();
