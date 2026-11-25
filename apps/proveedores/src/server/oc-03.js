/* ---------- tesoreria ---------- */

function ocRegistrarPago_(ses, numero, d, soporte) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u.rol, 'pagar')) return { ok: false, mensaje: 'No tiene permiso para registrar pagos.' };

  var ho = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(ho, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };

  var estado = String(ho.getRange(fila, 21).getValue()).trim().toUpperCase();
  if (estado === 'SOLICITADA')  return { ok: false, mensaje: 'Gerencia todavia no la ha aprobado.' };
  if (estado === 'RECHAZADA')   return { ok: false, mensaje: 'Esa orden fue rechazada.' };

  var valor = ocNum_(d.valor);
  if (valor <= 0) return { ok: false, mensaje: 'Escriba el valor pagado.' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { ok: false, mensaje: 'El sistema esta ocupado.' }; }

  try {
    var hp  = ocHoja_(OC_H_PAG);
    var num = ocPagoNumero_(hp);   /* una sola serie consecutiva en la hoja 11 */
    var fp  = ocFilaNueva_(hp);
    var link = ocGuardarArchivo_(numero, soporte, 'SOPORTE DE PAGO');

    hp.getRange(fp, 1).setValue(num);
    hp.getRange(fp, 2).setValue(d.fecha ? d.fecha : new Date());
    hp.getRange(fp, 3).setValue(numero);
    /* El tercero se toma de la orden, no de la pantalla: asi el pago queda
       identificado y se puede cruzar con el extracto y mandarle el soporte. */
    hp.getRange(fp, 4).setValue(String(ho.getRange(fila, 8).getValue()).replace(/\D/g, ''));
    hp.getRange(fp, 5).setValue(String(ho.getRange(fila, 9).getValue()).trim());
    hp.getRange(fp, 6).setValue('PROVEEDOR');
    hp.getRange(fp, 7).setValue(valor);
    hp.getRange(fp, 8).setValue(d.banco || '');
    hp.getRange(fp, 9).setValue(d.comprobante || '');
    hp.getRange(fp, 10).setValue(link);
    hp.getRange(fp, 11).setValue(u.nombre);
    /* La columna F la usa el cruce con el extracto, asi que lleva PROVEEDOR.
       Si el pago fue un abono y no el total, queda dicho en las observaciones. */
    var esAbono = String(d.tipo).toUpperCase() === 'ABONO';
    hp.getRange(fp, 12).setValue(((esAbono ? 'ABONO. ' : '') + (d.observaciones || '')).trim());

    if (String(d.tipo).toUpperCase() !== 'ABONO') ho.getRange(fila, 21).setValue('PAGADA');
    SpreadsheetApp.flush();

    var saldo = ocNum_(ho.getRange(fila, 27).getValue());
    return { ok: true, pago: num, link: link, saldo: saldo };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- compras: mercancia y factura ---------- */

function ocRegistrarFactura_(ses, numero, d, archivo) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u.rol, 'facturar')) return { ok: false, mensaje: 'No tiene permiso para registrar facturas.' };

  var hoja = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };

  if (d.mercancia)      hoja.getRange(fila, 29).setValue(d.mercancia);
  if (d.fechaRecibido)  hoja.getRange(fila, 30).setValue(d.fechaRecibido);
  if (d.recibidoPor)    hoja.getRange(fila, 31).setValue(d.recibidoPor);

  var aviso = '';
  if (d.tipoDoc && String(d.tipoDoc).toUpperCase() !== 'PENDIENTE') {
    var total     = ocNum_(hoja.getRange(fila, 15).getValue());
    var facturado = ocNum_(d.valorFacturado);
    if (facturado > 0 && Math.abs(facturado - total) > 1) {
      return { ok: false, mensaje: 'El valor facturado (' + ocPesos_(facturado) +
        ') no coincide con la orden (' + ocPesos_(total) + '). Revise antes de cerrar.' };
    }
    hoja.getRange(fila, 32).setValue(d.tipoDoc);
    hoja.getRange(fila, 33).setValue(d.numeroFactura || '');
    if (d.fechaFactura) hoja.getRange(fila, 34).setValue(d.fechaFactura);
    hoja.getRange(fila, 35).setValue(facturado);
    var link = ocGuardarArchivo_(numero, archivo, 'FACTURA');
    if (link) hoja.getRange(fila, 36).setValue(link);
    hoja.getRange(fila, 21).setValue('FACTURADA');
    aviso = 'Queda en contabilidad para causar.';
  }

  if (d.observaciones) {
    var obs = String(hoja.getRange(fila, 40).getValue());
    hoja.getRange(fila, 40).setValue((obs ? obs + ' | ' : '') + d.observaciones);
  }
  return { ok: true, aviso: aviso };
}

function ocCausar_(ses, numero, comentario) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u.rol, 'causar')) return { ok: false, mensaje: 'No tiene permiso.' };

  var hoja = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };
  if (String(hoja.getRange(fila, 33).getValue()).trim() === '' &&
      String(hoja.getRange(fila, 32).getValue()).trim() === '') {
    return { ok: false, mensaje: 'Todavia no hay factura ni documento soporte.' };
  }

  hoja.getRange(fila, 37).setValue('SI');
  hoja.getRange(fila, 21).setValue('CAUSADA');
  if (comentario) {
    var obs = String(hoja.getRange(fila, 40).getValue());
    hoja.getRange(fila, 40).setValue((obs ? obs + ' | ' : '') + comentario);
  }
  return { ok: true };
}

/* ---------- consultas ---------- */

function ocOrdenes_(ses, filtro) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false };

  var hoja = ocHoja_(OC_H_ORD);
  var ult = ocUltimaFila_(hoja);
  if (ult < 2) return { ok: true, filas: [], resumen: ocResumen_([]), rol: u.rol, vertodo: ocPuede_(u.rol, 'vertodo'), area: u.area };

  var d = hoja.getRange(2, 1, ult - 1, 40).getValues();
  var todo = ocPuede_(u.rol, 'vertodo');
  var filas = [], mias = [];

  for (var i = 0; i < d.length; i++) {
    if (String(d[i][0]).trim() === '') continue;
    /* Quien no ve todo, ve las ordenes de SU AREA (no solo las suyas):
       asi un ingeniero ve lo de ingenieria y la persona del sistema de
       gestion ve lo del sistema de gestion. */
    if (!todo && !ocIgual_(d[i][5], u.area)) continue;

    var o = {
      numero: String(d[i][0]),
      fecha: ocFecha_(d[i][1]),
      usuario: String(d[i][3]),
      solicita: String(d[i][4]),
      area: String(d[i][5]),
      centro: String(d[i][6]),
      nit: String(d[i][7]),
      proveedor: String(d[i][8]),
      estadoProv: String(d[i][9]),
      descripcion: String(d[i][10]),
      concepto: String(d[i][11]),
      base: ocNum_(d[i][12]),
      iva: ocNum_(d[i][13]),
      total: ocNum_(d[i][14]),
      retefuente: ocNum_(d[i][15]),
      reteiva: ocNum_(d[i][16]),
      reteica: ocNum_(d[i][17]),
      neto: ocNum_(d[i][18]),
      cotizacion: String(d[i][19]),
      estado: String(d[i][20]),
      decidePor: String(d[i][21]),
      comentario: String(d[i][23]),
      fechaPago: ocFecha_(d[i][24]),
      pagado: ocNum_(d[i][25]),
      saldo: ocNum_(d[i][26]),
      soporte: String(d[i][27]),
      mercancia: String(d[i][28]),
      tipoDoc: String(d[i][31]),
      factura: String(d[i][32]),
      linkFactura: String(d[i][35]),
      dias: d[i][37] === '' ? '' : ocNum_(d[i][37]),
      falta: String(d[i][38]),
      esMia: ocIgual_(d[i][3], u.usuario)
    };

    mias.push(o);

    if (filtro === 'aprobar'   && o.estado.toUpperCase() !== 'SOLICITADA') continue;
    if (filtro === 'pagar'     && (o.estado.toUpperCase() !== 'APROBADA' || o.saldo <= 0)) continue;
    if (filtro === 'facturar'  && o.falta.indexOf('FALTA FACTURA') !== 0 &&
                                  o.falta.indexOf('FALTA ELABORAR') !== 0) continue;
    if (filtro === 'causar'    && o.falta !== 'FALTA CAUSAR EN WORLD OFFICE') continue;
    if (filtro === 'legalizar' && (o.falta === 'LISTA' || o.falta === '' ||
                                   o.falta === 'FALTA PAGAR' || o.falta === 'RECHAZADA')) continue;
    if (filtro === 'mias'      && !o.esMia) continue;

    filas.push(o);
  }

  filas.reverse();
  return { ok: true, filas: filas, resumen: ocResumen_(mias),
           rol: u.rol, vertodo: todo, area: u.area };
}

function ocResumen_(filas) {
  var r = { total: filas.length, esperando: 0, porPagar: 0, pagadas: 0,
            sinFactura: 0, sinDocSoporte: 0, porCausar: 0, listas: 0,
            valorTotal: 0, valorPagado: 0, platapendiente: 0 };
  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    var e = String(f.estado).toUpperCase();
    r.valorTotal  += f.total;
    r.valorPagado += f.pagado;
    if (e === 'SOLICITADA') r.esperando++;
    if (e === 'APROBADA' && f.saldo > 0) r.porPagar++;
    if (f.pagado > 0) r.pagadas++;
    if (f.falta === 'FALTA FACTURA ELECTRONICA') { r.sinFactura++; r.platapendiente += f.pagado; }
    if (f.falta === 'FALTA ELABORAR DOCUMENTO SOPORTE') { r.sinDocSoporte++; r.platapendiente += f.pagado; }
    if (f.falta === 'FALTA CAUSAR EN WORLD OFFICE') r.porCausar++;
    if (f.falta === 'LISTA') r.listas++;
  }
  return r;
}

/* ---------- mensaje para el proveedor ---------- */

function ocMensajeProveedor_(ses, numero) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false };

  var hoja = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };

  var d = hoja.getRange(fila, 1, 1, 40).getValues()[0];
  var prov = ocBuscarProveedor_(ses, d[7]);
  var esFE = prov.encontrado && prov.tipoDoc.toUpperCase().indexOf('FACTURADOR') >= 0;

  var txt;
  if (esFE) {
    txt = 'Buen dia. SOCIAL SOLAR S.A.S., NIT 901.128.826-6. Les escribimos por la compra "' +
          d[10] + '"' + (ocNum_(d[25]) > 0 ? ', ya cancelada el ' + ocFecha_(d[24]) + ' por ' + ocPesos_(d[25]) : '') +
          '. Nos hace falta la FACTURA ELECTRONICA para poder causarla. Favor enviarla al correo de facturacion. Gracias.';
  } else {
    txt = 'Este proveedor no esta obligado a facturar electronicamente. No hay que pedirle nada: ' +
          'contabilidad debe elaborar el DOCUMENTO SOPORTE de la compra "' + d[10] + '".';
  }
  return { ok: true, esFacturadorElectronico: esFE, texto: txt, proveedor: String(d[8]) };
}

/* ---------- entrada web ---------- */

function ocDoGet_(e) {
  return HtmlService.createTemplateFromFile('Portal').evaluate()
    .setTitle('Social Solar — Ordenes de compra')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function ocMostrarLink() { Guardas_.persona();
  var url = ScriptApp.getService().getUrl();
  var html = HtmlService.createHtmlOutput(
      '<div style="font-family:Arial;font-size:13px;line-height:1.7;padding:6px">'
    + '<b>Link del portal de ordenes de compra</b><br>'
    + 'Es el mismo para todos. Cada persona entra con su usuario y su contrase\u00f1a.<br><br>'
    + '<input style="width:100%;padding:8px;font-size:12px" readonly value="' + url + '?p=portal" onclick="this.select()">'
    + '<br><br>Los usuarios y contrase\u00f1as se administran en la hoja <b>07 USUARIOS Y ROLES</b>, o desde la pesta\u00f1a <b>Usuarios</b> del portal.'
    + '</div>').setWidth(520).setHeight(230);
  SpreadsheetApp.getUi().showModalDialog(html, 'Portal de ordenes de compra');
}

function ocRenombrarEnOrdenes_(viejo, nuevo) {
  var h = ocHoja_(OC_H_ORD);
  if (!h) return;
  var n = ocUltimaFila_(h);
  if (n < 2) return;
  var r = h.getRange(2, 4, n - 1, 1);
  var v = r.getValues();
  var cambio = false;
  for (var i = 0; i < v.length; i++) {
    if (ocIgual_(v[i][0], viejo)) { v[i][0] = nuevo; cambio = true; }
  }
  if (cambio) r.setValues(v);
}

