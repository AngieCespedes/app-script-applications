/**
 * Lo que tesoreria necesita ANTES de pagar.
 *
 * Quien pide la orden sabe que compro y por cuanto, pero no sabe si al
 * proveedor se le retiene ni a que tarifa: eso depende del RUT y de si es
 * declarante, y eso lo revisa tesoreria. Aqui vive esa revision.
 */

/** Lo que se ve en «Por pagar» de un proveedor: sus documentos y su regimen. */
function ocDatosPago_(ses, numero) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false, mensaje: 'Vuelva a entrar.' };
  if (!ocPuede_(u, 'pagar') && !ocPuede_(u, 'verproveedor')) {
    return { ok: false, mensaje: 'Su rol no revisa retenciones.' };
  }

  var hoja = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };

  var nit = String(hoja.getRange(fila, 8).getValue()).replace(/\D/g, '');
  var r = { ok: true, numero: numero, nit: nit,
            proveedor: String(hoja.getRange(fila, 9).getValue()).trim(),
            concepto:  String(hoja.getRange(fila, 12).getValue()).trim(),
            base:      ocNum_(hoja.getRange(fila, 13).getValue()),
            iva:       ocNum_(hoja.getRange(fila, 14).getValue()),
            total:     ocNum_(hoja.getRange(fila, 15).getValue()),
            retefuente: ocNum_(hoja.getRange(fila, 16).getValue()),
            reteiva:    ocNum_(hoja.getRange(fila, 17).getValue()),
            reteica:    ocNum_(hoja.getRange(fila, 18).getValue()),
            neto:       ocNum_(hoja.getRange(fila, 19).getValue()),
            asume:      String(ocLeerCol_(hoja, fila, OC_ORD_ASUME)) || 'PROVEEDOR',
            revisadaPor: String(ocLeerCol_(hoja, fila, OC_ORD_RETPOR)),
            nota:        String(ocLeerCol_(hoja, fila, OC_ORD_RETNOTA)),
            docEsperado: String(ocLeerCol_(hoja, fila, OC_ORD_DOCESP)),
            conceptos: ocConceptos_() };

  /* El maestro manda los documentos. Si el proveedor no esta registrado,
     no se cae la pantalla: se dice que falta todo y se puede pedir. */
  r.rut = ''; r.certificacion = ''; r.estadoRut = 'NO ESTA EN LA BASE';
  r.responsabilidades = ''; r.regimen = ''; r.enLaBase = false;
  try {
    var p = ocProveedor_(ses, nit);
    if (p.ok) {
      r.enLaBase = true;
      r.rut = p.proveedor.rutArchivo || '';
      r.certificacion = p.proveedor.certArchivo || '';
      r.estadoRut = p.proveedor.estadoRut || '';
      r.responsabilidades = p.proveedor.responsabilidades || '';
      r.regimen = p.proveedor.regimen || '';
      r.fechaRut = p.proveedor.fechaRut || '';
    }
  } catch (e) { /* sin maestro, la pantalla igual sirve */ }

  r.faltaDocs = [];
  if (!r.rut) r.faltaDocs.push('RUT');
  if (!r.certificacion) r.faltaDocs.push('certificacion bancaria');

  /* El RUT dice si es declarante de renta. La responsabilidad 05 es «Regimen
     ordinario»: ese es el declarante. Es una pista, no una decision: quien
     firma la retencion es tesoreria. */
  r.pistaDeclarante = ocPistaDeclarante_(r.responsabilidades);
  return r;
}

/** Lee una columna que puede no existir todavia en la hoja. */
function ocLeerCol_(hoja, fila, col) {
  if (hoja.getMaxColumns() < col) return '';
  var v = hoja.getRange(fila, col).getValue();
  return (v === null || v === undefined) ? '' : String(v).trim();
}

/** Los conceptos de la hoja 09, para que tesoreria pueda cambiarlo. */
function ocConceptos_() {
  var hoja = ocHoja_(OC_H_CON);
  var d = hoja.getRange(3, 1, 58, 1).getValues();
  var out = [];
  for (var i = 0; i < d.length; i++) {
    var c = String(d[i][0]).trim();
    if (c && out.indexOf(c) < 0) out.push(c);
  }
  return out;
}

/** Pista de si es declarante, leida de las responsabilidades del RUT. */
function ocPistaDeclarante_(resp) {
  var s = String(resp || '').toUpperCase();
  if (!s) return { sabe: false, texto: 'El RUT no esta cargado, asi que no se sabe si es declarante.' };
  if (s.indexOf('05') >= 0 || s.indexOf('ORDINARIO') >= 0) {
    return { sabe: true, declarante: true,
             texto: 'El RUT trae la responsabilidad 05 (regimen ordinario): es declarante de renta.' };
  }
  return { sabe: true, declarante: false,
           texto: 'El RUT no trae la responsabilidad 05, asi que se trata como NO declarante. Verifiquelo.' };
}

/**
 * Tesoreria deja la retencion como debe quedar.
 *
 * Tres maneras, y siempre queda quien la reviso y por que:
 *   modo CALCULAR : se escoge el concepto y si es declarante, y la calcula el sistema.
 *   modo MANUAL   : tesoreria escribe los valores y el motivo (obligatorio).
 *   asume EMPRESA : no se le descuenta al proveedor. Se le paga el total y la
 *                   empresa declara igual la retencion. Por eso el neto sube.
 */
function ocRevisarRetencion_(ses, numero, d) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u, 'pagar')) {
    return { ok: false, mensaje: 'Solo tesoreria revisa la retencion.' };
  }

  var hoja = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };

  var estado = String(hoja.getRange(fila, 21).getValue()).trim().toUpperCase();
  if (estado === 'RECHAZADA') return { ok: false, mensaje: 'Esa orden esta rechazada.' };
  if (ocNum_(hoja.getRange(fila, 26).getValue()) > 0) {
    return { ok: false, mensaje: 'Esa orden ya tiene pagos registrados: la retencion no se puede cambiar.' };
  }

  var base = ocNum_(hoja.getRange(fila, 13).getValue());
  var iva  = ocNum_(hoja.getRange(fila, 14).getValue());
  var modo = String(d.modo || 'CALCULAR').toUpperCase();
  var rf, ri, rc, concepto = String(d.concepto || hoja.getRange(fila, 12).getValue()).trim();

  if (modo === 'MANUAL') {
    if (!String(d.motivo || '').trim()) {
      return { ok: false, mensaje: 'Escriba por que la esta poniendo a mano. Queda en la trazabilidad.' };
    }
    rf = ocNum_(d.retefuente); ri = ocNum_(d.reteiva); rc = ocNum_(d.reteica);
    if (rf < 0 || ri < 0 || rc < 0) return { ok: false, mensaje: 'Las retenciones no pueden ser negativas.' };
    if (rf + ri + rc > base + iva) {
      return { ok: false, mensaje: 'Las retenciones no pueden ser mayores que el valor de la orden.' };
    }
  } else {
    var c = ocRetenciones_(ses, concepto, base, iva, !!d.declarante, d.tarifaIca);
    if (!c.ok) return { ok: false, mensaje: 'No pude calcular con ese concepto.' };
    rf = c.retefuente; ri = c.reteiva; rc = c.reteica;
  }

  var asume = String(d.asume || 'PROVEEDOR').toUpperCase() === 'EMPRESA' ? 'EMPRESA' : 'PROVEEDOR';
  /* Si la asume la empresa, al proveedor se le paga completo. La retencion se
     declara igual, pero no sale de lo que el proveedor recibe. */
  var neto = asume === 'EMPRESA' ? base + iva : base + iva - rf - ri - rc;

  hoja.getRange(fila, 12).setValue(concepto);
  hoja.getRange(fila, 16).setValue(rf);
  hoja.getRange(fila, 17).setValue(ri);
  hoja.getRange(fila, 18).setValue(rc);
  hoja.getRange(fila, 19).setValue(neto);
  ocEscribirCol_(hoja, fila, OC_ORD_ASUME, asume);
  ocEscribirCol_(hoja, fila, OC_ORD_RETPOR, u.nombre + ' — ' + ocFecha_(new Date()));
  ocEscribirCol_(hoja, fila, OC_ORD_RETNOTA,
    (modo === 'MANUAL' ? 'A mano: ' + String(d.motivo).trim() : 'Calculada por el sistema') +
    (asume === 'EMPRESA' ? ' | La asume la empresa, al proveedor se le paga completo.' : '') +
    (d.nota ? ' | ' + String(d.nota).trim() : ''));
  SpreadsheetApp.flush();

  return { ok: true, retefuente: rf, reteiva: ri, reteica: rc, neto: neto, asume: asume,
           mensaje: 'Retencion guardada. Neto a pagar: ' + ocPesos_(neto) +
                    (asume === 'EMPRESA' ? ' (la retencion la asume la empresa).' : '.') };
}

/**
 * Tesoreria programa cuando se va a pagar, y le deja la razon a quien pidio.
 *
 * Es la pregunta que mas hacen los que piden una orden. Unas se pagan de una,
 * pero otras dependen de la negociacion con el proveedor, y hasta ahora eso
 * solo lo sabia tesoreria. Ahora queda escrito y lo ve quien pidio la orden.
 */
function ocProgramarPago_(ses, numero, d) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u, 'pagar')) {
    return { ok: false, mensaje: 'Solo tesoreria programa los pagos.' };
  }
  var hoja = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };

  var estado = String(hoja.getRange(fila, 21).getValue()).trim().toUpperCase();
  if (estado === 'RECHAZADA') return { ok: false, mensaje: 'Esa orden esta rechazada.' };
  if (estado === 'SOLICITADA') {
    return { ok: false, mensaje: 'Esa orden todavia no esta aprobada: no se puede programar su pago.' };
  }

  var f = String(d.fecha || '').trim();
  if (!f) return { ok: false, mensaje: 'Escriba la fecha en que se proyecta pagarla.' };
  var fecha = new Date(f + 'T12:00:00');
  if (isNaN(fecha.getTime())) return { ok: false, mensaje: 'Esa fecha no se entiende.' };

  ocEscribirCol_(hoja, fila, OC_ORD_FPROY, fecha);
  ocEscribirCol_(hoja, fila, OC_ORD_NOTASOL,
    String(d.nota || '').trim() + (d.nota ? ' — ' : '') + u.nombre + ', ' + ocFecha_(new Date()));
  SpreadsheetApp.flush();
  return { ok: true, mensaje: 'Pago proyectado para el ' + ocFecha_(fecha) + '. Quien pidio la orden ya lo ve.' };
}

/** Escribe en una columna nueva; si la hoja no la tiene, avisa que falta migrar. */
function ocEscribirCol_(hoja, fila, col, valor) {
  if (hoja.getMaxColumns() < col) {
    throw new Error('A la hoja 10 le faltan columnas. Corra «Instalar o actualizar» desde el menu.');
  }
  hoja.getRange(fila, col).setValue(valor);
}
