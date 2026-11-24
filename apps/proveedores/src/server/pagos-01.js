/**
 * Pagos — hoja 11 PAGOS Y SOPORTES.
 *
 * Una sola hoja para todos los pagos: los que salen de una orden de compra y los
 * que no (nomina, PSE, impuestos). Tesoreria los sube uno por uno, con su soporte,
 * para que quede la trazabilidad.
 *
 * Columnas que NO se escriben nunca porque son formula:
 *   O VALIDACION CON EXTRACTO, R/S/T NOVEDADES, V/W bloque de control.
 * Aqui solo se escribe de la columna 1 a la 14.
 */

var PG_COL = {
  numero: 1, fecha: 2, orden: 3, nit: 4, proveedor: 5, tipo: 6, valor: 7,
  banco: 8, comprobante: 9, soporte: 10, registra: 11, observa: 12,
  saldo: 13, aviso: 14, validacion: 15
};

var PG_TIPOS = ['PROVEEDOR', 'NOMINA', 'PSE'];
var PG_ANCHO = 15;

/* ---------- lectura ---------- */

function ocPagoFila_(d, i) {
  var p = {
    numero: String(d[i][PG_COL.numero - 1]).trim(),
    fecha: ocFecha_(d[i][PG_COL.fecha - 1]),
    orden: String(d[i][PG_COL.orden - 1]).trim(),
    nit: String(d[i][PG_COL.nit - 1]).trim(),
    proveedor: String(d[i][PG_COL.proveedor - 1]).trim(),
    tipo: String(d[i][PG_COL.tipo - 1]).trim(),
    valor: ocNum_(d[i][PG_COL.valor - 1]),
    banco: String(d[i][PG_COL.banco - 1]).trim(),
    comprobante: String(d[i][PG_COL.comprobante - 1]).trim(),
    soporte: String(d[i][PG_COL.soporte - 1]).trim(),
    registra: String(d[i][PG_COL.registra - 1]).trim(),
    observa: String(d[i][PG_COL.observa - 1]).trim(),
    aviso: String(d[i][PG_COL.aviso - 1]).trim(),
    validacion: String(d[i][PG_COL.validacion - 1]).trim()
  };
  p.falta = ocPagoFalta_(p);
  p.completo = p.falta.length === 0;
  p.noSalio = p.validacion.indexOf('NO SALIO') === 0;
  return p;
}

function ocPagoFalta_(p) {
  var falta = [];
  if (!p.nit) falta.push('identificacion');
  if (!p.proveedor) falta.push('a nombre de quien');
  if (!p.comprobante) falta.push('comprobante de egreso');
  if (!p.soporte) falta.push('soporte');
  return falta;
}

function ocPagos_(ses, filtro) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false };
  if (!ocPuede_(u.rol, 'pagar') && !ocPuede_(u.rol, 'vertodo')) {
    return { ok: false, mensaje: 'No tiene permiso para ver los pagos.' };
  }

  var hoja = ocHoja_(OC_H_PAG);
  if (!hoja) return { ok: false, mensaje: 'No encontre la hoja ' + OC_H_PAG + '.' };

  var ult = ocUltimaFila_(hoja);
  if (ult < 2) {
    return { ok: true, filas: [], resumen: ocPagosResumen_([]),
             puedePagar: ocPuede_(u.rol, 'pagar'), tipos: PG_TIPOS };
  }

  var d = hoja.getRange(2, 1, ult - 1, PG_ANCHO).getValues();
  var todos = [], filas = [];

  for (var i = 0; i < d.length; i++) {
    if (String(d[i][0]).trim() === '') continue;
    var p = ocPagoFila_(d, i);
    todos.push(p);
    if (ocPagoPasa_(p, filtro)) filas.push(p);
  }

  filas.reverse();
  return { ok: true, filas: filas, resumen: ocPagosResumen_(todos),
           puedePagar: ocPuede_(u.rol, 'pagar'), tipos: PG_TIPOS };
}

function ocPagoPasa_(p, filtro) {
  if (filtro === 'incompletos') return !p.completo;
  if (filtro === 'nosalio')     return p.noSalio;
  if (filtro === 'sinaviso')    return p.tipo === 'PROVEEDOR' && !!p.soporte && !p.aviso;
  return true;
}

function ocPagosResumen_(lista) {
  var r = { total: lista.length, valor: 0, incompletos: 0, sinNit: 0,
            sinComprobante: 0, sinSoporte: 0, noSalieron: 0, valorNoSalio: 0,
            sinAviso: 0 };
  for (var i = 0; i < lista.length; i++) {
    var p = lista[i];
    r.valor += p.valor;
    if (!p.completo) r.incompletos++;
    if (!p.nit) r.sinNit++;
    if (!p.comprobante) r.sinComprobante++;
    if (!p.soporte) r.sinSoporte++;
    if (p.noSalio) { r.noSalieron++; r.valorNoSalio += p.valor; }
    if (p.tipo === 'PROVEEDOR' && p.soporte && !p.aviso) r.sinAviso++;
  }
  return r;
}

/* ---------- numeracion: una sola serie consecutiva ---------- */

function ocPagoNumero_(hoja) {
  var ult = ocUltimaFila_(hoja);
  var max = 0;
  if (ult >= 2) {
    var col = hoja.getRange(2, 1, ult - 1, 1).getValues();
    for (var i = 0; i < col.length; i++) {
      var n = parseInt(String(col[i][0]).replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > max && n < 1000000) max = n;
    }
  }
  return max + 1;
}

function ocFilaPago_(hoja, numero) {
  var ult = ocUltimaFila_(hoja);
  if (ult < 2) return 0;
  var col = hoja.getRange(2, 1, ult - 1, 1).getValues();
  for (var i = 0; i < col.length; i++) {
    if (ocIgual_(col[i][0], numero)) return i + 2;
  }
  return 0;
}

/* ---------- registrar un pago que no viene de una orden ---------- */

function ocPagoDirecto_(ses, d, soporte) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u.rol, 'pagar')) {
    return { ok: false, mensaje: 'No tiene permiso para registrar pagos.' };
  }

  var revisado = ocPagoRevisar_(d);
  if (revisado) return { ok: false, mensaje: revisado };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) {
    return { ok: false, mensaje: 'El sistema esta ocupado. Intente otra vez.' };
  }

  try {
    var hoja = ocHoja_(OC_H_PAG);
    var num = ocPagoNumero_(hoja);
    var fp = ocFilaNueva_(hoja);
    var link = ocGuardarArchivo_('PAGO ' + num, soporte, 'SOPORTE DE PAGO');

    hoja.getRange(fp, 1, 1, 12).setValues([[
      num,
      d.fecha ? d.fecha : new Date(),
      '',
      String(d.nit || '').replace(/\D/g, ''),
      String(d.proveedor || '').trim(),
      String(d.tipo || 'PROVEEDOR').toUpperCase(),
      ocNum_(d.valor),
      String(d.banco || '').trim(),
      String(d.comprobante || '').trim(),
      link,
      u.nombre,
      String(d.observaciones || '').trim()
    ]]);
    SpreadsheetApp.flush();
    return { ok: true, pago: num, link: link };
  } finally {
    lock.releaseLock();
  }
}

function ocPagoRevisar_(d) {
  if (ocNum_(d.valor) <= 0) return 'Escriba el valor pagado.';
  if (!String(d.proveedor || '').trim()) return 'Escriba a nombre de quien va el pago.';
  if (PG_TIPOS.indexOf(String(d.tipo || '').toUpperCase()) < 0) {
    return 'El tipo de pago debe ser ' + PG_TIPOS.join(', ') + '.';
  }
  return '';
}

/* ---------- completar lo que le falta a un pago ya subido ---------- */

function ocCompletarPago_(ses, numero, d, soporte) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u.rol, 'pagar')) {
    return { ok: false, mensaje: 'No tiene permiso para completar pagos.' };
  }

  var hoja = ocHoja_(OC_H_PAG);
  var fila = ocFilaPago_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre el pago ' + numero + '.' };

  var cambios = ocPagoCambios_(d);
  for (var col in cambios) {
    if (Object.prototype.hasOwnProperty.call(cambios, col)) {
      hoja.getRange(fila, parseInt(col, 10)).setValue(cambios[col]);
    }
  }

  if (soporte && soporte.datos) {
    var link = ocGuardarArchivo_('PAGO ' + numero, soporte, 'SOPORTE DE PAGO');
    if (link) hoja.getRange(fila, PG_COL.soporte).setValue(link);
  }

  var hecho = ocMarcarQuienCompleto_(hoja, fila, u);
  SpreadsheetApp.flush();
  return { ok: true, pago: String(numero), completo: hecho };
}

/* Solo se escribe lo que la persona efectivamente lleno: un campo vacio
   nunca borra lo que ya estaba en la hoja. */
function ocPagoCambios_(d) {
  var c = {};
  if (String(d.nit || '').trim())         c[PG_COL.nit] = String(d.nit).replace(/\D/g, '');
  if (String(d.proveedor || '').trim())   c[PG_COL.proveedor] = String(d.proveedor).trim();
  if (String(d.banco || '').trim())       c[PG_COL.banco] = String(d.banco).trim();
  if (String(d.comprobante || '').trim()) c[PG_COL.comprobante] = String(d.comprobante).trim();
  if (String(d.orden || '').trim())       c[PG_COL.orden] = String(d.orden).trim();
  if (PG_TIPOS.indexOf(String(d.tipo || '').toUpperCase()) >= 0) {
    c[PG_COL.tipo] = String(d.tipo).toUpperCase();
  }
  if (String(d.observaciones || '').trim()) c[PG_COL.observa] = String(d.observaciones).trim();
  return c;
}

/* La marca de COMPLETAR se quita sola cuando ya no falta nada. */
function ocMarcarQuienCompleto_(hoja, fila, u) {
  var d = hoja.getRange(fila, 1, 1, PG_ANCHO).getValues();
  var p = ocPagoFila_(d, 0);
  if (p.falta.length > 0) return false;

  var obs = String(hoja.getRange(fila, PG_COL.observa).getValue());
  if (obs.indexOf('COMPLETAR') === 0) hoja.getRange(fila, PG_COL.observa).setValue('');
  if (!String(hoja.getRange(fila, PG_COL.registra).getValue()).trim()) {
    hoja.getRange(fila, PG_COL.registra).setValue(u.nombre);
  }
  return true;
}
