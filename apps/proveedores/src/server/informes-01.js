/**
 * INFORMES — cada rol descarga en Excel o PDF lo que esa persona ve en pantalla,
 * para que nadie tenga que entrar al libro que estamos alimentando.
 *
 * El informe se arma en un solo archivo reutilizable por rol: no se llena Drive
 * de copias. Lo que sale es exactamente lo que el rol puede ver, ni una fila mas.
 */

var INF_CARPETA = 'INFORMES DEL PORTAL';

function infCarpeta_() {
  var raiz = Aislamiento_.carpeta(OC_RAIZ);
  var it = raiz.getFoldersByName(INF_CARPETA);
  return it.hasNext() ? it.next() : raiz.createFolder(INF_CARPETA);
}

function infLibro_(nombre) {
  var carpeta = infCarpeta_();
  var it = carpeta.getFilesByName(nombre);
  if (it.hasNext()) return SpreadsheetApp.openById(it.next().getId());
  var libro = SpreadsheetApp.create(nombre);
  var archivo = DriveApp.getFileById(libro.getId());
  carpeta.addFile(archivo);
  try { DriveApp.getRootFolder().removeFile(archivo); } catch (e) { /* ya estaba movido */ }
  return libro;
}

function infEscribir_(libro, titulo, encabezados, filas) {
  var hoja = libro.getSheets()[0];
  hoja.clear();
  hoja.setName(titulo.substring(0, 95));
  hoja.getRange(1, 1).setValue(titulo).setFontWeight('bold').setFontSize(13);
  hoja.getRange(2, 1).setValue('Social Solar S.A.S. — generado el ' +
    Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy HH:mm'));
  hoja.getRange(4, 1, 1, encabezados.length).setValues([encabezados])
      .setFontWeight('bold').setBackground('#16394F').setFontColor('#FFFFFF');
  if (filas.length) hoja.getRange(5, 1, filas.length, encabezados.length).setValues(filas);
  hoja.setFrozenRows(4);
  hoja.autoResizeColumns(1, encabezados.length);
  SpreadsheetApp.flush();
  return hoja;
}

function infEnlaces_(libro, hoja) {
  var id = libro.getId();
  var gid = hoja.getSheetId();
  return {
    excel: 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx',
    pdf: 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=pdf&portrait=false&size=A4' +
         '&scale=4&gridlines=false&fitw=true&top_margin=0.4&bottom_margin=0.4' +
         '&left_margin=0.4&right_margin=0.4&gid=' + gid
  };
}

/**
 * que: ordenes | proveedores | pagos | solicitudes
 * Cada rol solo puede pedir lo que su pantalla ya le muestra.
 */
function ocInforme_(ses, que, filtro) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false, mensaje: 'Vuelva a entrar.' };
  if (!ocPuede_(u.rol, 'informes')) return { ok: false, mensaje: 'Su rol no descarga informes.' };

  que = String(que || 'ordenes').toLowerCase();
  if (que === 'proveedores') return infProveedores_(ses, u, filtro);
  if (que === 'pagos')       return infPagos_(ses, u, filtro);
  if (que === 'solicitudes') return infSolicitudes_(ses, u);
  return infOrdenes_(ses, u, filtro);
}

function infOrdenes_(ses, u, filtro) {
  var r = ocOrdenes_(ses, (filtro && filtro.filtro) || '');
  if (!r.ok) return r;

  var filas = r.filas.map(function (o) {
    return [o.numero, o.fecha, o.area, o.solicita, o.centro, o.nit, o.proveedor,
            o.descripcion, o.total, o.neto, o.estado, o.fechaPago, o.pagado, o.saldo,
            o.factura, o.numeroWO, o.comoLlego, o.fechaRecibido,
            o.traza ? o.traza.estado : '', o.falta];
  });
  var titulo = 'ORDENES DE COMPRA — ' +
    (r.vertodo ? 'toda la empresa' : (ocPuede_(u.rol, 'verequipo') ? 'area de ' + u.area : u.nombre));

  var libro = infLibro_('INFORME DE ORDENES — ' + u.rol);
  var hoja = infEscribir_(libro, titulo,
    ['N° ORDEN', 'FECHA', 'AREA', 'SOLICITANTE', 'CENTRO DE COSTO', 'NIT', 'PROVEEDOR',
     'DESCRIPCION', 'VALOR TOTAL', 'NETO A PAGAR', 'ESTADO', 'FECHA DE PAGO', 'PAGADO', 'SALDO',
     'N° FACTURA', 'N° EN WORLD OFFICE', 'COMO LLEGO', 'FECHA DE LLEGADA',
     'TRAZABILIDAD', 'QUE FALTA'], filas);

  var e = infEnlaces_(libro, hoja);
  return { ok: true, n: filas.length, titulo: titulo, excel: e.excel, pdf: e.pdf };
}

function infProveedores_(ses, u, filtro) {
  if (!ocPuede_(u.rol, 'proveedores') && !ocPuede_(u.rol, 'verproveedor')) {
    return { ok: false, mensaje: 'Su rol no ve el maestro de proveedores.' };
  }
  var r = ocProveedores_(ses, filtro);
  if (!r.ok) return r;

  var filas = r.filas.map(function (p) {
    return [p.nit, p.nombre, p.tipoDoc, p.estadoRut, p.compras, p.ultCompra,
            p.faltantes.join(', ') || 'COMPLETO',
            p.creditoHoy, p.tenemosCupo, p.cupo, p.plazo, p.dcto, p.pctDcto,
            p.asesor, p.celAsesor, p.correoAsesor, p.correoEdoCta,
            p.seguimiento ? p.seguimiento.estado : '',
            p.seguimiento ? p.seguimiento.dias : ''];
  });
  var titulo = 'MAESTRO DE PROVEEDORES — que hay y que falta';

  var libro = infLibro_('INFORME DE PROVEEDORES');
  var hoja = infEscribir_(libro, titulo,
    ['NIT', 'PROVEEDOR', 'NOS FACTURA', 'ESTADO DEL RUT', 'COMPRAS 2026', 'ULTIMA COMPRA',
     'QUE LE FALTA', 'CREDITO HOY', 'TENEMOS CUPO', 'CUPO', 'PLAZO (DIAS)',
     'DESCUENTO', '% DESCUENTO', 'ASESOR', 'CELULAR ASESOR', 'CORREO ASESOR',
     'CORREO ESTADO DE CUENTA', 'SEGUIMIENTO', 'DIAS'], filas);

  var e = infEnlaces_(libro, hoja);
  return { ok: true, n: filas.length, titulo: titulo, excel: e.excel, pdf: e.pdf };
}

function infPagos_(ses, u, filtro) {
  if (!ocPuede_(u.rol, 'pagar') && !ocPuede_(u.rol, 'verpagos')) {
    return { ok: false, mensaje: 'Su rol no ve los pagos.' };
  }
  var r = ocPagos_(ses, (filtro && filtro.filtro) || '');
  if (!r.ok) return r;

  var filas = r.filas.map(function (p) {
    return [p.numero, p.fecha, p.orden, p.nit, p.proveedor, p.tipo, p.valor,
            p.banco, p.comprobante, p.registra, p.observa];
  });
  var titulo = 'PAGOS — ' + (ocPuede_(u.rol, 'pagar') ? 'tesoreria' : 'consulta');

  var libro = infLibro_('INFORME DE PAGOS — ' + u.rol);
  var hoja = infEscribir_(libro, titulo,
    ['N° PAGO', 'FECHA', 'N° ORDEN', 'NIT', 'TERCERO', 'TIPO', 'VALOR',
     'BANCO', 'COMPROBANTE DE EGRESO', 'REGISTRADO POR', 'OBSERVACIONES'], filas);

  var e = infEnlaces_(libro, hoja);
  return { ok: true, n: filas.length, titulo: titulo, excel: e.excel, pdf: e.pdf };
}

function infSolicitudes_(ses, u) {
  if (!ocPuede_(u.rol, 'proveedores')) return { ok: false, mensaje: 'Su rol no ve las solicitudes.' };
  var todas = gsTodas_();
  var filas = todas.map(function (s) {
    return [s.numero, s.fecha, s.nit, s.proveedor, s.medio, s.quePidio,
            s.destino, s.quienPidio, s.estado, s.fechaRespuesta, s.dias];
  });
  var titulo = 'SOLICITUDES A PROVEEDORES — trazabilidad';

  var libro = infLibro_('INFORME DE SOLICITUDES');
  var hoja = infEscribir_(libro, titulo,
    ['N°', 'FECHA', 'NIT', 'PROVEEDOR', 'MEDIO', 'QUE SE PIDIO',
     'A QUIEN', 'QUIEN LO PIDIO', 'ESTADO', 'FECHA DE RESPUESTA', 'DIAS'], filas);

  var e = infEnlaces_(libro, hoja);
  return { ok: true, n: filas.length, titulo: titulo, excel: e.excel, pdf: e.pdf };
}
