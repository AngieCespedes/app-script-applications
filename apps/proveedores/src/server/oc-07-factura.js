/**
 * MERCANCIA Y FACTURA — lo que registra quien causa.
 *
 * Aqui se cierra el ciclo de la orden. Quien causa deja tres cosas:
 *
 *   1. El documento que llego: el numero del proveedor (el externo) y el
 *      numero con que quedo en World Office (el interno). No son el mismo y
 *      se guardan los dos, que es lo unico que permite rastrear una factura
 *      desde la orden hasta el comprobante contable.
 *   2. Si la mercancia o el servicio ya llego.
 *   3. Como queda la orden: RECTIFICADO, CON NOVEDAD o DEBE CORREGIRSE.
 *
 * Lo tercero es lo importante. Una orden no se puede dejar «rectificada» si
 * la factura no cuadra con ella: esa diferencia es casi siempre obra adicional
 * que nadie registro, y taparla deja un costo sin soporte. Entonces se marca
 * con novedad o para corregir, se escribe que paso, y la orden se le devuelve
 * a quien la pidio para que la arregle.
 */

var OC_VEREDICTOS = ['RECTIFICADO', 'CON NOVEDAD', 'DEBE CORREGIRSE'];

/** Lo que carga la pantalla de «Mercancia y factura» para una orden. */
function ocDatosFactura_(ses, numero) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u, 'facturar')) return { ok: false, mensaje: 'Su rol no registra facturas.' };

  var hoja = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };

  return {
    ok: true,
    numero: numero,
    proveedor: String(hoja.getRange(fila, 9).getValue()).trim(),
    descripcion: String(hoja.getRange(fila, 11).getValue()).trim(),
    centro: String(hoja.getRange(fila, 7).getValue()).trim(),
    solicita: String(hoja.getRange(fila, 5).getValue()).trim(),
    estado: String(hoja.getRange(fila, 21).getValue()).trim(),
    total: ocNum_(hoja.getRange(fila, 15).getValue()),
    pagado: ocNum_(hoja.getRange(fila, 26).getValue()),
    fechaPago: ocFecha_(hoja.getRange(fila, 25).getValue()),
    docEsperado: ocLeerCol_(hoja, fila, OC_ORD_DOCESP),
    tipoDoc: String(hoja.getRange(fila, 32).getValue()).trim(),
    numeroFactura: String(hoja.getRange(fila, 33).getValue()).trim(),
    fechaFactura: ocFechaISO_(hoja.getRange(fila, 34).getValue()),
    valorFacturado: ocNum_(hoja.getRange(fila, 35).getValue()),
    numeroWO: ocLeerCol_(hoja, fila, OC_ORD_WO),
    mercancia: String(hoja.getRange(fila, 29).getValue()).trim(),
    fechaRecibido: ocFechaISO_(hoja.getRange(fila, 30).getValue()),
    recibidoPor: String(hoja.getRange(fila, 31).getValue()).trim(),
    causada: String(hoja.getRange(fila, 37).getValue()).trim(),
    diasCredito: ocLeerCol_(hoja, fila, OC_ORD_DIASCR),
    fechaVence: ocFecha_(ocLeerColBruto_(hoja, fila, OC_ORD_FVENCE)),
    veredicto: ocLeerCol_(hoja, fila, OC_ORD_FACEST),
    registradaPor: ocLeerCol_(hoja, fila, OC_ORD_FACPOR),
    nota: ocLeerCol_(hoja, fila, OC_ORD_NOTASOL)
  };
}

/** Una fecha escrita en aaaa-mm-dd, como la manda un campo de fecha del navegador. */
function ocFechaDeTexto_(v) {
  if (v instanceof Date) return v;
  var s = String(v || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var f = new Date(s + 'T12:00:00');
  return isNaN(f.getTime()) ? s : f;
}

/**
 * Revisa que lo que se va a guardar sea coherente con el veredicto.
 * Para dejar una orden RECTIFICADA hay que tener el documento completo y que
 * el valor cuadre; para las otras dos, hay que contar que paso.
 */
function ocValidarRegistro_(hoja, fila, d) {
  var ver = String(d.veredicto || '').trim().toUpperCase();
  if (OC_VEREDICTOS.indexOf(ver) < 0) {
    return { ok: false, mensaje: 'Diga como queda la orden: rectificada, con novedad o para corregir.' };
  }
  var tipo = String(d.tipoDoc || '').trim().toUpperCase();
  var hayDoc = tipo !== '' && tipo !== 'PENDIENTE';

  if (ver !== 'RECTIFICADO') {
    if (!String(d.nota || '').trim()) {
      return { ok: false, mensaje: 'Escriba que paso o que hay que corregir: eso es lo que le llega a quien pidio la orden.' };
    }
    return { ok: true, veredicto: ver, hayDoc: hayDoc };
  }

  if (!hayDoc) return { ok: false, mensaje: 'Para dejarla rectificada escoja que documento llego.' };
  if (!String(d.numeroFactura || '').trim()) return { ok: false, mensaje: 'Falta el numero del documento del proveedor.' };
  if (!d.fechaFactura) return { ok: false, mensaje: 'Falta la fecha del documento.' };

  var total = ocNum_(hoja.getRange(fila, 15).getValue());
  var fact  = ocNum_(d.valorFacturado);
  if (fact > 0 && Math.abs(fact - total) > 1) {
    return { ok: false, mensaje: 'El documento dice ' + ocPesos_(fact) + ' y la orden ' + ocPesos_(total) +
      ' — diferencia de ' + ocPesos_(Math.abs(fact - total)) + '. No la puede dejar rectificada asi: ' +
      'marquela con novedad o para corregir, y escriba que paso.' };
  }
  return { ok: true, veredicto: ver, hayDoc: hayDoc };
}

/** Deja en la fila lo que diga el documento, sin tocar lo que no vino. */
function ocEscribirDocumento_(hoja, fila, numero, d, archivo) {
  var tipo = String(d.tipoDoc || '').trim();
  if (tipo && tipo.toUpperCase() !== 'PENDIENTE') hoja.getRange(fila, 32).setValue(tipo);
  if (d.numeroFactura) hoja.getRange(fila, 33).setValue(String(d.numeroFactura).trim());
  if (d.fechaFactura)  hoja.getRange(fila, 34).setValue(ocFechaDeTexto_(d.fechaFactura));
  if (ocNum_(d.valorFacturado) > 0) hoja.getRange(fila, 35).setValue(ocNum_(d.valorFacturado));

  var link = ocGuardarArchivo_(numero, archivo, 'FACTURA');
  if (link) hoja.getRange(fila, 36).setValue(link);

  if (d.observaciones) {
    var obs = String(hoja.getRange(fila, 40).getValue());
    hoja.getRange(fila, 40).setValue((obs ? obs + ' | ' : '') + d.observaciones);
  }
}

/**
 * Los dias de credito que quien causa lee en la factura.
 * Se calcula con las mismas funciones que usa compras (ocSumarDias_ y
 * ocViernesDePago_), para que no existan dos formas de sacar el mismo
 * vencimiento y terminen dando fechas distintas.
 */
function ocCreditoDeLaFactura_(hoja, fila, d) {
  if (d.diasCredito === '' || d.diasCredito === undefined || d.diasCredito === null) return '';
  var dias = Math.max(0, Math.round(ocNum_(d.diasCredito)));
  var base = ocFechaDeTexto_(d.fechaFactura);
  if (!(base instanceof Date)) base = hoja.getRange(fila, 34).getValue();
  if (!(base instanceof Date)) return '';

  var vence = ocSumarDias_(base, dias);
  ocEscribirCol_(hoja, fila, OC_ORD_DIASCR, dias);
  ocEscribirCol_(hoja, fila, OC_ORD_FVENCE, vence);
  ocEscribirCol_(hoja, fila, OC_ORD_FPROY,  ocViernesDePago_(vence));
  return ocFecha_(vence);
}

/**
 * El correo de una persona de la hoja 07, si lo tiene registrado.
 * Se lee la celda suelta y no la fila entera a proposito: ocFilasUsuarios_
 * solo trae hasta la columna de los permisos, y ensancharla haria mas lento
 * cada ingreso al portal por un dato que solo se necesita al devolver.
 */
function ocCorreoDeUsuario_(usuario) {
  var t = ocFilasUsuarios_();
  if (t.hoja.getMaxColumns() < OC_USU_MAIL) return '';
  for (var i = 0; i < t.datos.length; i++) {
    if (!ocIgual_(t.datos[i][1], usuario)) continue;
    var c = String(t.hoja.getRange(i + 2, OC_USU_MAIL).getValue()).trim();
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c) ? c : '';
  }
  return '';
}

/**
 * La orden se le devuelve a quien la pidio.
 * La nota queda en la hoja, que es la trazabilidad, y ademas se le intenta
 * avisar por correo. El correo es opcional: si esa persona no lo tiene
 * registrado en la hoja 07, igual le aparece marcada en «Mis ordenes».
 */
function ocDevolver_(hoja, fila, numero, d, u, veredicto) {
  var quien = String(hoja.getRange(fila, 5).getValue()).trim();
  var nota = veredicto + ': ' + String(d.nota).trim() + ' — ' + u.nombre + ', ' + ocFecha_(new Date());
  ocEscribirCol_(hoja, fila, OC_ORD_NOTASOL, nota);

  var correo = ocCorreoDeUsuario_(String(hoja.getRange(fila, 4).getValue()));
  if (!correo) {
    return 'Le queda marcada a ' + quien + ' en «Mis ordenes». No tiene correo registrado en la hoja 07, ' +
           'asi que por ahora no le llega aviso.';
  }
  try {
    Correo_.enviar({
      to: correo,
      subject: 'Orden ' + numero + ' — ' + veredicto,
      body: quien + ',\n\n' + nota + '\n\nEntre al portal, busque la orden ' + numero +
            ' en «Mis ordenes» y resuelvala.\n\nSocial Solar S.A.S. — Area Contable y Administrativa'
    });
  } catch (e) {
    return 'Quedo marcada para ' + quien + ', pero no se pudo enviar el correo: ' + e.message;
  }
  return 'Se le devolvio a ' + quien + ' y se le aviso a ' + correo + '.';
}

/** Cuando una orden queda rectificada y ya esta aprobada, avanza a FACTURADA. */
function ocAvanzarAFacturada_(hoja, fila, v) {
  if (v.veredicto !== 'RECTIFICADO' || !v.hayDoc) return;
  if (String(hoja.getRange(fila, 21).getValue()).trim().toUpperCase() !== 'APROBADA') return;
  hoja.getRange(fila, 21).setValue('FACTURADA');
}

/** Quien causa registra la factura o el documento soporte y dice como queda la orden. */
function ocRegistrarFactura_(ses, numero, d, archivo) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u, 'facturar')) return { ok: false, mensaje: 'No tiene permiso para registrar facturas.' };
  d = d || {};

  var hoja = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };
  if (String(hoja.getRange(fila, 21).getValue()).trim().toUpperCase() === 'RECHAZADA') {
    return { ok: false, mensaje: 'Esa orden fue rechazada.' };
  }

  var v = ocValidarRegistro_(hoja, fila, d);
  if (!v.ok) return v;

  if (d.mercancia)     hoja.getRange(fila, 29).setValue(d.mercancia);
  if (d.fechaRecibido) hoja.getRange(fila, 30).setValue(ocFechaDeTexto_(d.fechaRecibido));
  if (d.recibidoPor)   hoja.getRange(fila, 31).setValue(d.recibidoPor);
  if (d.numeroWO)      ocEscribirCol_(hoja, fila, OC_ORD_WO, String(d.numeroWO).trim());

  ocEscribirDocumento_(hoja, fila, numero, d, archivo);
  var vence = ocCreditoDeLaFactura_(hoja, fila, d);

  ocEscribirCol_(hoja, fila, OC_ORD_FACEST, v.veredicto);
  ocEscribirCol_(hoja, fila, OC_ORD_FACPOR, u.nombre);
  ocEscribirCol_(hoja, fila, OC_ORD_FACFEC, new Date());
  ocAvanzarAFacturada_(hoja, fila, v);

  var aviso = (v.veredicto === 'RECTIFICADO')
    ? (v.hayDoc ? 'Queda lista para causar en World Office.' : 'Registrada.')
    : ocDevolver_(hoja, fila, numero, d, u, v.veredicto);

  SpreadsheetApp.flush();
  return { ok: true, veredicto: v.veredicto, vence: vence, aviso: aviso };
}

/** Deja constancia de que ya quedo causada en World Office. */
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
    if (d.fechaFactura)  hoja.getRange(fila, 34).setValue(ocFechaDeTexto_(d.fechaFactura));
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
  if (d.numeroWO) ocEscribirCol_(hoja, fila, OC_ORD_WO, String(d.numeroWO).trim());
  if (d.comentario) {
    var obs = String(hoja.getRange(fila, 40).getValue());
    hoja.getRange(fila, 40).setValue((obs ? obs + ' | ' : '') + d.comentario);
  }
  return { ok: true };
}
