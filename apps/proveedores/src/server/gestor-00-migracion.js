/**
 * MIGRACION del gestor de proveedores.
 * Cada paso es idempotente: se puede correr las veces que sea sin duplicar nada.
 * Lo llama «Instalar o actualizar» desde el menu de la hoja.
 */

function gpMigrar_() {
  var hecho = [];
  hecho.push(gpMigrarColumnasOrdenes_());
  hecho.push(gpMigrarHoja_(OC_H_SOL, [
    'N° SOLICITUD', 'FECHA', 'NIT', 'PROVEEDOR', 'MEDIO', 'QUE SE PIDIO',
    'A QUIEN SE LE PIDIO', 'QUIEN LO PIDIO', 'FECHA DE RESPUESTA', 'DIAS',
    'ESTADO', 'NOTA'
  ]));
  hecho.push(gpMigrarHoja_(OC_H_EDO, [
    'N°', 'NIT', 'PROVEEDOR', 'CORTE', 'FECHA RECIBIDO',
    'SALDO SEGUN EL PROVEEDOR', 'SALDO SEGUN NOSOTROS', 'DIFERENCIA',
    'ARCHIVO', 'QUIEN LO CARGO', 'ESTADO', 'OBSERVACIONES'
  ]));
  hecho.push(gpMigrarHoja_(OC_H_MEJ, [
    'N°', 'FECHA', 'USUARIO', 'NOMBRE', 'ROL', 'PANTALLA', 'TIPO',
    'QUE PASO O QUE MEJORARIA', 'DETALLE', 'PANTALLAZO', 'ESTADO',
    'RESPUESTA', 'FECHA DE CIERRE'
  ]));
  return hecho.filter(function (x) { return x; }).join('\n');
}

/** Agrega al final de la hoja 10 las columnas de almacen y del cruce contable. */
function gpMigrarColumnasOrdenes_() {
  var hoja = ocHoja_(OC_H_ORD);
  var nuevas = [
    { col: OC_ORD_COMO, titulo: 'COMO LLEGO LA MERCANCIA' },
    { col: OC_ORD_FOTO, titulo: 'FOTO DE LA LLEGADA' },
    { col: OC_ORD_OBSA, titulo: 'OBSERVACION DE ALMACEN' },
    { col: OC_ORD_WO,   titulo: 'N° EN WORLD OFFICE' }
  ];
  var agregadas = [];
  nuevas.forEach(function (n) {
    if (hoja.getMaxColumns() < n.col) hoja.insertColumnsAfter(hoja.getMaxColumns(), n.col - hoja.getMaxColumns());
    var actual = String(hoja.getRange(1, n.col).getValue()).trim();
    if (actual === n.titulo) return;
    if (actual !== '') {
      throw new Error('La columna ' + n.col + ' de «' + OC_H_ORD + '» ya tiene el titulo «' + actual +
        '». No la sobrescribo: revise la hoja antes de seguir.');
    }
    hoja.getRange(1, n.col).setValue(n.titulo);
    agregadas.push(n.titulo);
  });
  if (!agregadas.length) return '';
  gpProtegerEncabezado_(hoja);
  return OC_H_ORD + ': columnas nuevas — ' + agregadas.join(', ');
}

/** Crea una hoja con sus encabezados si no existe. Si existe, no la toca. */
function gpMigrarHoja_(nombre, encabezados) {
  var libro = SpreadsheetApp.openById(OC_SS);
  var hoja = libro.getSheetByName(nombre);
  if (hoja) {
    var actual = hoja.getRange(1, 1, 1, encabezados.length).getValues()[0]
                     .map(function (x) { return String(x).trim(); });
    var faltan = [];
    for (var i = 0; i < encabezados.length; i++) {
      if (actual[i] !== encabezados[i]) faltan.push(encabezados[i]);
    }
    if (!faltan.length) return '';
    throw new Error('La hoja «' + nombre + '» ya existe con otros encabezados. ' +
      'Reviselos antes de seguir; no la sobrescribo.');
  }

  hoja = libro.insertSheet(nombre);
  hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
  hoja.setFrozenRows(1);
  hoja.getRange(1, 1, 1, encabezados.length)
      .setFontWeight('bold').setBackground('#16394F').setFontColor('#FFFFFF');
  if (hoja.getMaxColumns() > encabezados.length) {
    hoja.deleteColumns(encabezados.length + 1, hoja.getMaxColumns() - encabezados.length);
  }
  hoja.autoResizeColumns(1, encabezados.length);
  gpProtegerEncabezado_(hoja);
  return nombre + ': hoja creada';
}

/** El encabezado se protege estricto; las filas de datos quedan libres. */
function gpProtegerEncabezado_(hoja) {
  try {
    hoja.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) {
      if (p.getDescription() === 'Encabezado') p.remove();
    });
    var p = hoja.getRange(1, 1, 1, hoja.getMaxColumns()).protect();
    p.setDescription('Encabezado');
    p.setWarningOnly(false);
    p.removeEditors(p.getEditors());
  } catch (e) { /* si el libro no deja proteger, la app sigue funcionando */ }
}
