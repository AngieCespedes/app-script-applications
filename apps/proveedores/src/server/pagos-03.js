/**
 * Informe de pagos para descargar en Excel o en PDF.
 *
 * La pagina manda los numeros de los pagos que tiene en pantalla, ya filtrados,
 * asi el informe sale exactamente igual a lo que la persona esta viendo.
 *
 * El informe se arma en una hoja de Google dentro de la carpeta de la app y se
 * devuelven los dos enlaces de descarga. Siempre se reusa el mismo archivo: no
 * se llena Drive de informes viejos.
 */

var PG_INF_CARPETA = 'INFORMES DE PAGOS';
var PG_INF_ARCHIVO = 'INFORME DE PAGOS';

var PG_INF_COLS = [
  ['N° PAGO', 'numero', 60], ['FECHA', 'fecha', 80], ['N° ORDEN', 'orden', 95],
  ['NIT / CC', 'nit', 95], ['TERCERO', 'proveedor', 250], ['TIPO', 'tipo', 90],
  ['VALOR PAGADO', 'valor', 110], ['BANCO / CUENTA', 'banco', 160],
  ['COMPROBANTE DE EGRESO', 'comprobante', 130], ['OBSERVACIONES', 'observa', 250],
  ['VALIDACION CON EXTRACTO', 'validacion', 150], ['SOPORTE', 'soporte', 220],
  ['AVISO ENVIADO', 'aviso', 180]
];

function ocCarpetaInformes_() {
  var raiz = Aislamiento_.carpeta(OC_RAIZ);
  var it = raiz.getFoldersByName(PG_INF_CARPETA);
  return it.hasNext() ? it.next() : raiz.createFolder(PG_INF_CARPETA);
}

function ocLibroInforme_() {
  var carpeta = ocCarpetaInformes_();
  var it = carpeta.getFilesByName(PG_INF_ARCHIVO);
  if (it.hasNext()) return SpreadsheetApp.open(it.next());
  var libro = SpreadsheetApp.create(PG_INF_ARCHIVO);
  DriveApp.getFileById(libro.getId()).moveTo(carpeta);
  return libro;
}

function ocPagosDeNumeros_(numeros) {
  var pedidos = {};
  for (var i = 0; i < numeros.length; i++) pedidos[String(numeros[i]).trim()] = i;

  var hoja = ocHoja_(OC_H_PAG);
  var ult = ocUltimaFila_(hoja);
  if (ult < 2) return [];

  var d = hoja.getRange(2, 1, ult - 1, PG_ANCHO).getValues();
  var fuera = [];
  for (var j = 0; j < d.length; j++) {
    var n = String(d[j][0]).trim();
    if (n === '' || !(n in pedidos)) continue;
    var p = ocPagoFila_(d, j);
    p.__orden = pedidos[n];
    fuera.push(p);
  }
  fuera.sort(function (a, b) { return a.__orden - b.__orden; });
  return fuera;
}

function ocFilasInforme_(pagos) {
  var filas = [PG_INF_COLS.map(function (c) { return c[0]; })];
  var total = 0;
  for (var i = 0; i < pagos.length; i++) {
    var p = pagos[i];
    total += p.valor;
    filas.push(PG_INF_COLS.map(function (c) {
      return c[1] === 'valor' ? p.valor : String(p[c[1]] || '');
    }));
  }
  var cierre = PG_INF_COLS.map(function () { return ''; });
  cierre[4] = 'TOTAL  (' + pagos.length + ' pagos)';
  cierre[6] = total;
  filas.push(cierre);
  return { filas: filas, total: total };
}

function ocPintarInforme_(hoja, filas, titulo) {
  hoja.clear();
  hoja.clearConditionalFormatRules();
  var cols = PG_INF_COLS.length;

  hoja.getRange(1, 1).setValue('SOCIAL SOLAR S.A.S.  ·  NIT 901.128.826-6  ·  INFORME DE PAGOS');
  hoja.getRange(2, 1).setValue(titulo);
  hoja.getRange(3, 1).setValue('Generado el ' +
    Utilities.formatDate(new Date(), 'America/Bogota', "dd/MM/yyyy 'a las' HH:mm"));
  hoja.getRange(1, 1, 1, cols).merge().setFontWeight('bold').setFontSize(12);
  hoja.getRange(2, 1, 1, cols).merge().setFontWeight('bold').setFontColor('#16394F');
  hoja.getRange(3, 1, 1, cols).merge().setFontSize(9).setFontColor('#5A6670');

  hoja.getRange(5, 1, filas.length, cols).setValues(filas);
  hoja.getRange(5, 1, 1, cols).setFontWeight('bold').setFontColor('#FFFFFF')
      .setBackground('#16394F').setWrap(true).setVerticalAlignment('middle');
  hoja.getRange(5 + filas.length - 1, 1, 1, cols).setFontWeight('bold').setBackground('#F4F6F8');
  hoja.getRange(6, 7, filas.length - 1, 1).setNumberFormat('$ #,##0');
  hoja.getRange(5, 1, filas.length, cols).setBorder(true, true, true, true, true, true,
      '#D7DDE2', SpreadsheetApp.BorderStyle.SOLID);
  hoja.setFrozenRows(5);

  for (var i = 0; i < cols; i++) hoja.setColumnWidth(i + 1, PG_INF_COLS[i][2]);
  hoja.getRange(6, 1, filas.length - 1, cols).setVerticalAlignment('top').setFontSize(9);
  hoja.setRowHeight(5, 34);
}

function ocInformePagos_(ses, numeros, titulo) {
  var u = ocUsuario_(ses);
  if (!u || (!ocPuede_(u, 'pagar') && !ocPuede_(u, 'vertodo'))) {
    return { ok: false, mensaje: 'No tiene permiso.' };
  }
  if (!numeros || !numeros.length) {
    return { ok: false, mensaje: 'No hay pagos para incluir en el informe.' };
  }

  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (e) {
    return { ok: false, mensaje: 'Hay otro informe generandose. Espere un momento.' };
  }

  try {
    var pagos = ocPagosDeNumeros_(numeros);
    if (!pagos.length) return { ok: false, mensaje: 'No encontre esos pagos en la hoja.' };

    var armado = ocFilasInforme_(pagos);
    var libro = ocLibroInforme_();
    ocPintarInforme_(libro.getSheets()[0], armado.filas, String(titulo || 'Todos los pagos'));
    SpreadsheetApp.flush();

    var id = libro.getId();
    return {
      ok: true,
      n: pagos.length,
      total: armado.total,
      totalTexto: ocPesos_(armado.total),
      excel: 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx',
      pdf: 'https://docs.google.com/spreadsheets/d/' + id +
           '/export?format=pdf&portrait=false&size=A4&scale=4&gridlines=false&printtitle=false&sheetnames=false',
      hoja: libro.getUrl()
    };
  } finally {
    lock.releaseLock();
  }
}
