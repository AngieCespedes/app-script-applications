/* ---------- tesoreria ---------- */

function ocRegistrarPago_(ses, numero, d, soporte) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u, 'pagar')) return { ok: false, mensaje: 'No tiene permiso para registrar pagos.' };

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

/* ---------- almacen: como llego la mercancia ---------- */

var OC_COMO_LLEGO = ['LLEGO BIEN', 'LLEGO AVERIADA', 'LLEGO INCOMPLETA', 'NO LLEGO'];

/**
 * Deja la constancia de almacen y se la muestra a quien pidio la orden en su
 * linea de tiempo. La foto es obligatoria cuando algo llego mal: es el soporte
 * para reclamarle al proveedor o a la transportadora, y la fecha demuestra que
 * se reclamo a tiempo.
 */
function ocRegistrarLlegada_(ses, numero, d, foto) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u, 'almacen')) {
    return { ok: false, mensaje: 'No tiene permiso para confirmar la llegada de mercancia.' };
  }

  var como = String((d && d.comoLlego) || '').toUpperCase();
  if (OC_COMO_LLEGO.indexOf(como) < 0) {
    return { ok: false, mensaje: 'Escoja como llego: bien, averiada, incompleta o no llego.' };
  }
  var bien = como === 'LLEGO BIEN';
  if (!bien && !String((d && d.observaciones) || '').trim()) {
    return { ok: false, mensaje: 'Cuente que paso con la mercancia: que falto o que llego averiado.' };
  }
  if (!bien && !(foto && foto.datos)) {
    return { ok: false, mensaje: 'Suba una foto de como llego. Sin la foto no hay con que reclamarle al proveedor.' };
  }

  var hoja = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };

  var enlace = '';
  if (foto && foto.datos) {
    try {
      var blob = Utilities.newBlob(Utilities.base64Decode(foto.datos),
        foto.tipo || 'image/jpeg',
        'LLEGADA ' + numero + ' ' + Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd') +
          (foto.nombre && foto.nombre.indexOf('.') > 0
            ? foto.nombre.substring(foto.nombre.lastIndexOf('.')) : '.jpg'));
      enlace = ocCarpeta_(numero).createFile(blob).getUrl();
    } catch (e) {
      return { ok: false, mensaje: 'No se pudo guardar la foto: ' + e.message };
    }
  }

  hoja.getRange(fila, 29).setValue(bien ? 'SI' : 'PARCIAL');
  hoja.getRange(fila, 30).setValue(d.fechaRecibido || new Date());
  hoja.getRange(fila, 31).setValue(d.recibidoPor || u.nombre);
  hoja.getRange(fila, OC_ORD_COMO).setValue(como);
  if (enlace) hoja.getRange(fila, OC_ORD_FOTO).setValue(enlace);
  if (d.observaciones) hoja.getRange(fila, OC_ORD_OBSA).setValue(String(d.observaciones));

  return { ok: true, foto: enlace,
           mensaje: bien
             ? 'Listo. Quien pidio la orden ya lo ve en su linea de tiempo.'
             : 'Registrado con la novedad y la foto. Quien pidio la orden ya lo ve, y queda el soporte para reclamar.' };
}

/* ---------- compras: mercancia y factura ---------- */

function ocRegistrarFactura_(ses, numero, d, archivo) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u, 'facturar')) return { ok: false, mensaje: 'No tiene permiso para registrar facturas.' };

  var hoja = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };

  if (d.mercancia)      hoja.getRange(fila, 29).setValue(d.mercancia);
  if (d.fechaRecibido)  hoja.getRange(fila, 30).setValue(d.fechaRecibido);
  if (d.recibidoPor)    hoja.getRange(fila, 31).setValue(d.recibidoPor);
  /* El numero con que quedo en World Office no es el mismo con que llego la
     factura del proveedor: se guardan los dos para poder rastrearla. */
  if (d.numeroWO)       hoja.getRange(fila, OC_ORD_WO).setValue(d.numeroWO);

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

/**
 * Contabilidad cierra la orden en World Office.
 * Acepta un comentario suelto (como antes) o un objeto con los datos del
 * documento: cuando la factura o el documento soporte le llegan directo a
 * contabilidad, aqui mismo pone el tipo, el numero y la fecha, sin tener que
 * devolverle la orden a compras.
 */
function ocCausar_(ses, numero, d) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u, 'causar')) return { ok: false, mensaje: 'No tiene permiso.' };
  if (typeof d === 'string' || d === null || d === undefined) d = { comentario: d || '' };

  var hoja = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };

  if (d.tipoDoc && String(d.tipoDoc).toUpperCase() !== 'PENDIENTE') {
    hoja.getRange(fila, 32).setValue(d.tipoDoc);
    if (d.numeroFactura) hoja.getRange(fila, 33).setValue(d.numeroFactura);
    if (d.fechaFactura)  hoja.getRange(fila, 34).setValue(d.fechaFactura);
  }

  if (String(hoja.getRange(fila, 33).getValue()).trim() === '' &&
      String(hoja.getRange(fila, 32).getValue()).trim() === '') {
    return { ok: false, mensaje: 'Todavia no hay factura ni documento soporte. ' +
                                 'Escriba el tipo, el numero y la fecha antes de causar.' };
  }
  if (String(hoja.getRange(fila, 34).getValue()).trim() === '') {
    return { ok: false, mensaje: 'Falta la fecha del documento. Sin ella no se puede causar.' };
  }

  hoja.getRange(fila, 37).setValue('SI');
  hoja.getRange(fila, 21).setValue('CAUSADA');
  if (d.numeroWO) hoja.getRange(fila, OC_ORD_WO).setValue(d.numeroWO);
  if (d.comentario) {
    var obs = String(hoja.getRange(fila, 40).getValue());
    hoja.getRange(fila, 40).setValue((obs ? obs + ' | ' : '') + d.comentario);
  }
  return { ok: true };
}

/* ---------- consultas ---------- */

/* Columnas nuevas de la hoja 10 (las crea migracionAlmacen_). */
var OC_ORD_COMO  = 41;   /* COMO LLEGO LA MERCANCIA */
var OC_ORD_FOTO  = 42;   /* FOTO DE LA LLEGADA */
var OC_ORD_OBSA  = 43;   /* OBSERVACION DE ALMACEN */
var OC_ORD_WO    = 44;   /* N° EN WORLD OFFICE */
/* Las de la revision de retencion, que hace tesoreria contra el RUT. */
var OC_ORD_DOCESP = 45;  /* QUE DOCUMENTO VA A DAR EL PROVEEDOR */
var OC_ORD_ASUME  = 46;  /* QUIEN ASUME LA RETENCION */
var OC_ORD_RETPOR = 47;  /* RETENCION REVISADA POR */
var OC_ORD_RETNOTA= 48;  /* NOTA DE LA RETENCION */
/* Cuando tesoreria calcula pagarla, y que quiere que sepa quien la pidio. */
var OC_ORD_FPROY  = 49;  /* FECHA PROYECTADA DE PAGO */
var OC_ORD_NOTASOL= 50;  /* NOTA PARA QUIEN PIDIO LA ORDEN */
/* El primer chequeo: compras mira la negociacion con el proveedor. */
var OC_ORD_DIASCR = 51;  /* DIAS DE CREDITO */
var OC_ORD_FVENCE = 52;  /* FECHA DE VENCIMIENTO */
var OC_ORD_REVCOM = 53;  /* REVISADA POR COMPRAS */
var OC_ORD_ANCHO = 53;

/* Lee una celda de la fila aunque la hoja todavia no tenga esa columna.
   Mientras no se corra «Instalar o actualizar», la hoja va hasta la 44 y
   las nuevas simplemente salen vacias, sin romper nada. */
function ocCol_(fila, n) {
  var v = fila[n - 1];
  return (v === undefined || v === null) ? '' : v;
}

/* Semaforo de la orden: verde solo cuando esta todo.
   Lo ve igual compras, gerencia y quien pidio la orden. */
function ocTraza_(o) {
  if (String(o.estado).toUpperCase() === 'RECHAZADA') return { estado: 'RECHAZADA', color: 'gris', detalle: '' };
  var mal = o.comoLlego && String(o.comoLlego).toUpperCase().indexOf('BIEN') < 0;
  if (mal) return { estado: 'CON NOVEDAD', color: 'rojo', detalle: o.obsAlmacen || 'La mercancia no llego bien' };

  var falta = [];
  if (o.saldo > 0) falta.push('pagar');
  if (!o.factura) falta.push('factura');
  if (o.factura && !o.numeroWO) falta.push('cruce contable');
  if (!o.comoLlego) falta.push('almacen');

  if (!falta.length) return { estado: 'OK', color: 'verde', detalle: 'Factura cruzada y mercancia completa' };
  return { estado: 'FALTA ' + falta.join(' y ').toUpperCase(), color: 'ambar', detalle: '' };
}

/* La linea de tiempo que ve cada area de SU orden. */
function ocLineaTiempo_(o) {
  var p = [];
  p.push({ hito: 'La pidio ' + o.solicita + ' (' + o.area + ')', fecha: o.fecha, ok: true });
  p.push({ hito: String(o.estado).toUpperCase() === 'RECHAZADA'
             ? 'Gerencia la rechazo: ' + (o.comentario || 'sin comentario')
             : 'Gerencia la aprobo',
           fecha: o.fechaDecision || '', ok: String(o.estado).toUpperCase() !== 'SOLICITADA',
           alerta: String(o.estado).toUpperCase() === 'RECHAZADA' });
  p.push({ hito: o.pagado > 0 ? 'Tesoreria pago' + (o.saldo > 0 ? ' un abono, queda saldo' : '') : 'Falta el pago',
           fecha: o.fechaPago || '', ok: o.pagado > 0 && o.saldo <= 0, alerta: o.pagado > 0 && o.saldo > 0,
           soporte: o.soporte || '' });
  p.push({ hito: o.factura
             ? 'Llego la factura ' + o.factura + (o.numeroWO ? ' — en World Office como ' + o.numeroWO
                                                             : ' — falta cruzarla con contabilidad')
             : 'Falta la factura',
           fecha: o.fechaFactura || '', ok: !!(o.factura && o.numeroWO), alerta: !!(o.factura && !o.numeroWO),
           soporte: o.linkFactura || '' });
  p.push({ hito: o.comoLlego
             ? 'Almacen: ' + o.comoLlego + (o.obsAlmacen ? ' — ' + o.obsAlmacen : '')
             : 'Falta confirmar la llegada a almacen',
           fecha: o.fechaRecibido || '', ok: !!(o.comoLlego && String(o.comoLlego).toUpperCase().indexOf('BIEN') >= 0),
           alerta: !!(o.comoLlego && String(o.comoLlego).toUpperCase().indexOf('BIEN') < 0),
           soporte: o.fotoLlegada || '' });
  return p;
}

function ocOrdenes_(ses, filtro) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false };

  var hoja = ocHoja_(OC_H_ORD);
  var ult = ocUltimaFila_(hoja);
  if (ult < 2) return { ok: true, filas: [], resumen: ocResumen_([]), rol: u.rol, vertodo: ocPuede_(u, 'vertodo'), area: u.area };

  /* Se lee hasta donde llegue la hoja: si todavia no se han creado las
     columnas nuevas, ocCol_ devuelve vacio en vez de reventar. */
  var ancho = Math.min(OC_ORD_ANCHO, hoja.getMaxColumns());
  var d = hoja.getRange(2, 1, ult - 1, ancho).getValues();
  var todo = ocPuede_(u, 'vertodo');
  var equipo = ocPuede_(u, 'verequipo');
  var filas = [], mias = [], decididas = [];

  for (var i = 0; i < d.length; i++) {
    if (String(d[i][0]).trim() === '') continue;
    /* Quien ve todo, ve la empresa entera.
       El lider de un area ve todas las ordenes de su area, aunque las pidan otros.
       Los demas ven solo las ordenes que ellos mismos pidieron. */
    if (!todo) {
      if (equipo) { if (!ocIgual_(d[i][5], u.area)) continue; }
      else if (!ocIgual_(d[i][3], u.usuario)) continue;
    }

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
      fechaDecision: ocFecha_(d[i][22]),
      comentario: String(d[i][23]),
      fechaPago: ocFecha_(d[i][24]),
      pagado: ocNum_(d[i][25]),
      saldo: ocNum_(d[i][26]),
      soporte: String(d[i][27]),
      mercancia: String(d[i][28]),
      fechaRecibido: ocFecha_(d[i][29]),
      recibidoPor: String(d[i][30]),
      tipoDoc: String(d[i][31]),
      factura: String(d[i][32]),
      fechaFactura: ocFecha_(d[i][33]),
      valorFacturado: ocNum_(d[i][34]),
      linkFactura: String(d[i][35]),
      causada: String(d[i][36]),
      dias: d[i][37] === '' ? '' : ocNum_(d[i][37]),
      falta: String(d[i][38]),
      comoLlego: String(ocCol_(d[i], OC_ORD_COMO)),
      fotoLlegada: String(ocCol_(d[i], OC_ORD_FOTO)),
      obsAlmacen: String(ocCol_(d[i], OC_ORD_OBSA)),
      numeroWO: String(ocCol_(d[i], OC_ORD_WO)),
      docEsperado: String(ocCol_(d[i], OC_ORD_DOCESP)),
      asumeRet: String(ocCol_(d[i], OC_ORD_ASUME)),
      retRevisadaPor: String(ocCol_(d[i], OC_ORD_RETPOR)),
      retNota: String(ocCol_(d[i], OC_ORD_RETNOTA)),
      fechaProyectada: ocFecha_(ocCol_(d[i], OC_ORD_FPROY)),
      notaSolicitante: String(ocCol_(d[i], OC_ORD_NOTASOL)),
      diasCredito: ocCol_(d[i], OC_ORD_DIASCR),
      fechaVence: ocFecha_(ocCol_(d[i], OC_ORD_FVENCE)),
      revisadaCompras: String(ocCol_(d[i], OC_ORD_REVCOM)),
      esMia: ocIgual_(d[i][3], u.usuario)
    };
    o.traza = ocTraza_(o);
    o.linea = ocLineaTiempo_(o);

    mias.push(o);

    /* En «Por aprobar» lo que hay que decidir va arriba, pero las que ya se
       decidieron se mandan aparte: quien aprueba quiere ver el ciclo completo,
       no solo su bandeja de pendientes. */
    if (filtro === 'aprobar' && o.estado.toUpperCase() !== 'SOLICITADA') {
      if (o.estado.toUpperCase() !== '') decididas.push(o);
      continue;
    }
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
  decididas.reverse();
  return { ok: true, filas: filas, decididas: decididas, resumen: ocResumen_(mias),
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

