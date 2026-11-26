/**
 * EL DOBLE CHEQUEO DE LA FECHA DE PAGO.
 *
 * Quien pide la orden dice cuando necesita la compra. Eso es un deseo, no una
 * fecha de pago: el no sabe si con ese proveedor hay credito ni desde cuando
 * cuenta. Compras si lo sabe, porque es quien negocia. Aqui compras rectifica
 * y el sistema calcula el vencimiento y el viernes en que sale la plata.
 *
 * Los pagos de Social Solar salen los viernes, con corte el jueves al mediodia.
 * Por eso una obligacion que vence un martes se paga el viernes ANTERIOR.
 */

/** El viernes en que hay que pagar algo que vence el dia dado. */
function ocViernesDePago_(vence) {
  var d = new Date(vence.getTime());
  d.setHours(12, 0, 0, 0);
  /* 5 es viernes. Si ya cae viernes, ese mismo; si no, el viernes anterior. */
  var atras = (d.getDay() - 5 + 7) % 7;
  d.setDate(d.getDate() - atras);
  return d;
}

/** Suma dias calendario a una fecha. */
function ocSumarDias_(f, dias) {
  var d = new Date(f.getTime());
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + (Number(dias) || 0));
  return d;
}

/** Lo que compras necesita ver de una orden para poder rectificar la fecha. */
function ocDatosCompras_(ses, numero) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false, mensaje: 'Vuelva a entrar.' };
  if (!ocPuede_(u, 'proveedores') && !ocPuede_(u, 'facturar') && !ocPuede_(u, 'pagar')) {
    return { ok: false, mensaje: 'Su rol no revisa las fechas de pago.' };
  }

  var hoja = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };

  return {
    ok: true,
    numero: numero,
    proveedor: String(hoja.getRange(fila, 9).getValue()).trim(),
    nit: String(hoja.getRange(fila, 8).getValue()).replace(/\D/g, ''),
    descripcion: String(hoja.getRange(fila, 11).getValue()).trim(),
    centro: String(hoja.getRange(fila, 7).getValue()).trim(),
    neto: ocNum_(hoja.getRange(fila, 19).getValue()),
    solicita: String(hoja.getRange(fila, 5).getValue()).trim(),
    fechaNecesidad: ocFecha_(hoja.getRange(fila, 3).getValue()),
    docEsperado: ocLeerCol_(hoja, fila, OC_ORD_DOCESP),
    tipoDoc: String(hoja.getRange(fila, 32).getValue()).trim(),
    numeroFactura: String(hoja.getRange(fila, 33).getValue()).trim(),
    fechaFactura: ocFechaISO_(hoja.getRange(fila, 34).getValue()),
    diasCredito: ocLeerCol_(hoja, fila, OC_ORD_DIASCR),
    fechaVence: ocFecha_(ocLeerColBruto_(hoja, fila, OC_ORD_FVENCE)),
    revisadaPor: ocLeerCol_(hoja, fila, OC_ORD_REVCOM),
    fechaProyectada: ocFecha_(ocLeerColBruto_(hoja, fila, OC_ORD_FPROY))
  };
}

/** Una fecha en aaaa-mm-dd, que es lo que pide un campo de fecha del navegador. */
function ocFechaISO_(v) {
  if (!(v instanceof Date)) return '';
  return Utilities.formatDate(v, 'America/Bogota', 'yyyy-MM-dd');
}

/** El valor crudo de una columna que puede no existir todavia. */
function ocLeerColBruto_(hoja, fila, col) {
  if (hoja.getMaxColumns() < col) return '';
  return hoja.getRange(fila, col).getValue();
}

/**
 * Desde que fecha se cuentan los dias de credito.
 * Si la factura ya llego, se guarda y se cuenta desde ella, que es el dato del
 * que cuelga todo. Si no ha llegado, se cuenta desde la fecha de la orden y la
 * nota dira que es provisional.
 */
function ocBaseDeCalculo_(hoja, fila, d) {
  if (!d.llegoFactura) {
    var f = hoja.getRange(fila, 2).getValue();
    return { ok: true, base: (f instanceof Date) ? f : new Date() };
  }
  if (!d.fechaFactura) return { ok: false, mensaje: 'Escriba la fecha de la factura.' };
  var base = new Date(String(d.fechaFactura) + 'T12:00:00');
  if (isNaN(base.getTime())) return { ok: false, mensaje: 'Esa fecha de factura no se entiende.' };
  if (d.tipoDoc) hoja.getRange(fila, 32).setValue(d.tipoDoc);
  if (d.numeroFactura) hoja.getRange(fila, 33).setValue(d.numeroFactura);
  hoja.getRange(fila, 34).setValue(base);
  return { ok: true, base: base };
}

/** Lo que va a leer quien pidio la orden, en sus propias palabras. */
function ocNotaCompras_(d, dias, u) {
  var nota = d.hayCredito
    ? 'Con este proveedor hay ' + dias + ' días de crédito.'
    : 'Este proveedor es de contado.';
  if (!d.llegoFactura) nota += ' La factura todavía no llega, así que la fecha es provisional.';
  if (d.nota) nota += ' ' + String(d.nota).trim();
  return nota + ' — ' + u.nombre + ', ' + ocFecha_(new Date());
}

/**
 * Compras deja la fecha de pago como debe quedar.
 *
 * Si hay credito, el vencimiento sale de la fecha de la factura (o de la
 * orden, si asi lo escogen) mas los dias pactados. Si es de contado, el
 * vencimiento es esa misma fecha. De ahi sale el viernes de pago.
 */
function ocRevisarCompras_(ses, numero, d) {
  var u = ocUsuario_(ses);
  if (!u || (!ocPuede_(u, 'proveedores') && !ocPuede_(u, 'facturar'))) {
    return { ok: false, mensaje: 'Solo compras rectifica la fecha de pago.' };
  }

  var hoja = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };

  var estado = String(hoja.getRange(fila, 21).getValue()).trim().toUpperCase();
  if (estado === 'RECHAZADA') return { ok: false, mensaje: 'Esa orden esta rechazada.' };

  var b = ocBaseDeCalculo_(hoja, fila, d);
  if (!b.ok) return b;
  var base = b.base;

  var dias = d.hayCredito ? Math.max(0, Math.round(ocNum_(d.diasCredito))) : 0;
  if (d.hayCredito && !dias) {
    return { ok: false, mensaje: 'Escriba a cuantos dias es el credito.' };
  }
  var vence = ocSumarDias_(base, dias);
  var pago  = ocViernesDePago_(vence);

  ocEscribirCol_(hoja, fila, OC_ORD_DIASCR, dias);
  ocEscribirCol_(hoja, fila, OC_ORD_FVENCE, vence);
  ocEscribirCol_(hoja, fila, OC_ORD_FPROY,  pago);
  ocEscribirCol_(hoja, fila, OC_ORD_REVCOM, u.nombre + ' — ' + ocFecha_(new Date()));

  ocEscribirCol_(hoja, fila, OC_ORD_NOTASOL, ocNotaCompras_(d, dias, u));
  SpreadsheetApp.flush();

  return { ok: true, vence: ocFecha_(vence), pago: ocFecha_(pago), dias: dias,
           mensaje: 'Vence el ' + ocFecha_(vence) + '. Se paga el viernes ' + ocFecha_(pago) + '.' };
}
