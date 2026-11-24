/* Actualiza la tabla a las bases vigentes desde el 1-jul-2026 (Decreto 572 de 2025
   nuevamente vigente tras revocarse la suspension provisional) y la UVT 2026. */
function actualizarTarifas2026_() {
  var t = ss_().getSheetByName(HOJA_TAR);
  if (!t) throw new Error('Primero ejecute instalarPagos');
  t.getRange(2, 1, 40, 6).clearContent();
  t.getRange(2, 1, 40, 6).setBackground(null).setFontColor('#000000').setFontWeight('normal');
  var tar = [
    ['COMPRAS GENERALES', 0.025, 0.035, 10, 'SI', 'Decreto 572 de 2025 - vigente desde el 1-jul-2026'],
    ['COMPRA DE MERCANCIA', 0.025, 0.035, 10, 'SI', 'Igual a compras generales'],
    ['SERVICIOS GENERALES', 0.04, 0.06, 2, 'SI', 'Decreto 572 de 2025 - base bajo de 4 a 2 UVT'],
    ['HONORARIOS Y COMISIONES', 0.11, 0.10, 0, 'SI', '11% PJ y PN declarante / 10% PN no declarante - sin base minima'],
    ['ARRENDAMIENTO DE INMUEBLES', 0.035, 0.035, 10, 'SI', 'Decreto 572 de 2025 - base bajo de 27 a 10 UVT'],
    ['ARRENDAMIENTO DE MUEBLES', 0.04, 0.04, 0, 'SI', 'Sin base minima'],
    ['TRANSPORTE DE CARGA', 0.01, 0.01, 2, 'SI', 'Decreto 572 de 2025 - base bajo de 4 a 2 UVT'],
    ['TRANSPORTE DE PASAJEROS', 0.035, 0.035, 10, 'SI', 'VERIFICAR con el texto del decreto antes de usar'],
    ['PRODUCTOS AGRICOLAS SIN PROCESAR', 0.015, 0.015, 70, 'SI', 'Decreto 572 de 2025 - base bajo de 92 a 70 UVT'],
    ['SIN RETENCION', 0, 0, 0, 'SI', 'Para pagos que no estan sujetos a retencion']
  ];
  t.getRange(2, 1, tar.length, 6).setValues(tar);
  t.getRange(2, 2, tar.length, 2).setNumberFormat('0.00%');
  var fr = tar.length + 3;
  t.getRange(fr, 1).setValue('Tarifa de reteIVA (sobre el IVA facturado):');
  t.getRange(fr, 2).setValue(0.15).setNumberFormat('0.00%');
  var fu = tar.length + 5;
  t.getRange(fu, 1, 1, 2).setValues([['UVT POR ANO', 'VALOR DE LA UVT']]);
  t.getRange(fu, 1, 1, 2).setBackground('#157347').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(9);
  t.getRange(fu + 1, 1, 4, 2).setValues([[2026, 52374], [2027, ''], [2028, ''], [2029, '']]);
  t.getRange(fu + 1, 2, 4, 1).setNumberFormat('"$" #,##0');
  t.getRange(fu + 6, 1).setValue('Cada ano escriba aqui la UVT de la resolucion DIAN. Con eso se recalculan solas las bases minimas.');
  SpreadsheetApp.flush();
  return 'Listo. UVT 2026 = ' + uvtDelAno_(2026) + '  |  compras 10 UVT  |  servicios 2 UVT  |  reteIVA 15%';
}

/* ==================== ANULACIONES ==================== */

function anularMovimiento_(tk, fila, motivo) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var yo = ses_(tk);
    motivo = String(motivo || '').trim();
    if (motivo.length < 5) return { ok: false, error: 'Escriba el motivo de la anulacion.' };
    var sh = ss_().getSheetByName(HOJA_MOV);
    fila = Number(fila) || 0;
    if (fila < FILA_INI || fila > sh.getLastRow()) return { ok: false, error: 'No encontre ese registro.' };
    if (String(sh.getRange(fila, 5).getDisplayValue()).trim() === '')
      return { ok: false, error: 'Esa fila del libro esta vacia.' };
    if (String(sh.getRange(fila, 21).getDisplayValue()).trim().toUpperCase() === 'ANULADO')
      return { ok: false, error: 'Ese registro ya estaba anulado.' };
    var sello = 'ANULADO por ' + yo.nombre + ' el ' +
      Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm') + '. Motivo: ' + motivo;
    sh.getRange(fila, 21).setValue('ANULADO');
    var obs = String(sh.getRange(fila, 24).getDisplayValue() || '');
    sh.getRange(fila, 24).setValue((obs ? obs + '  |  ' : '') + sello);
    SpreadsheetApp.flush();
    var id = String(sh.getRange(fila, 1).getDisplayValue()).trim() || ('FILA ' + fila);
    return { ok: true, fila: fila, id: id };
  } catch (e) { return { ok: false, error: String(e) }; }
  finally { lock.releaseLock(); }
}

function anularPagoBanco_(tk, fila, motivo) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var yo = ses_(tk);
    motivo = String(motivo || '').trim();
    if (motivo.length < 5) return { ok: false, error: 'Escriba el motivo de la anulacion.' };
    var sh = ss_().getSheetByName(HOJA_PAG);
    if (!sh) return { ok: false, error: 'Falta la hoja PAGOS BANCO.' };
    fila = Number(fila) || 0;
    if (fila < 2 || fila > sh.getLastRow()) return { ok: false, error: 'No encontre ese pago.' };
    if (String(sh.getRange(fila, 23).getDisplayValue()).trim().toUpperCase() === 'ANULADO')
      return { ok: false, error: 'Ese pago ya estaba anulado.' };
    var sello = 'ANULADO por ' + yo.nombre + ' el ' +
      Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm') + '. Motivo: ' + motivo;
    sh.getRange(fila, 23).setValue('ANULADO');
    var obs = String(sh.getRange(fila, 24).getDisplayValue() || '');
    sh.getRange(fila, 24).setValue((obs ? obs + '  |  ' : '') + sello);
    SpreadsheetApp.flush();
    return { ok: true, fila: fila };
  } catch (e) { return { ok: false, error: String(e) }; }
  finally { lock.releaseLock(); }
}

function exportarBanco_(tk, desde, hasta) {
  try {
    var yo = ses_(tk);
    var r = pagosBanco_(tk, desde, hasta);
    if (!r.ok) return r;
    var tot = 0, trtf = 0, triva = 0, tneto = 0;
    var fil = '';
    for (var i = 0; i < r.filas.length; i++) {
      var p = r.filas[i];
      var nt = Number(String(p.neto).replace(/[^0-9.-]/g, '').replace(/\./g, '')) || 0;
      fil += '<tr><td>' + esc_(p.fecha) + '</td><td>' + esc_(p.proveedor) + '</td>'
           + '<td>' + esc_(p.factura || '') + '</td><td>' + esc_(p.concepto || '') + '</td>'
           + '<td class="n">' + dot_(p.total) + '</td><td class="n">' + dot_(p.rtf) + '</td>'
           + '<td class="n">' + dot_(p.riva) + '</td><td class="n"><b>' + dot_(p.neto) + '</b></td>'
           + '<td>' + esc_(p.banco || '') + '</td><td>' + esc_(p.quien || '') + '</td>'
           + '<td>' + esc_(p.conf || '') + '</td></tr>';
      tneto += nt;
    }
    if (!fil) fil = '<tr><td colspan="11" style="text-align:center;color:#6B726D">Sin pagos desde el banco en este periodo.</td></tr>';
    var h = '<html><head><meta charset="utf-8"><style>'
      + '@page{size:letter landscape;margin:1.1cm}'
      + 'body{font-family:Arial,Helvetica,sans-serif;font-size:8.5px;color:#15201A}'
      + 'h1{font-size:14px;margin:0 0 2px}.sub{font-size:9px;color:#6B726D;margin-bottom:9px}'
      + 'table{width:100%;border-collapse:collapse}'
      + 'th{background:#12201A;color:#fff;font-size:8px;padding:5px 4px;text-align:left}'
      + 'td{border-bottom:1px solid #E3E7E4;padding:4px;vertical-align:top}'
      + '.n{text-align:right;white-space:nowrap}'
      + '.fir{margin-top:26px;display:flex;gap:26px}'
      + '.fir div{flex:1;border-top:1px solid #15201A;padding-top:5px;font-size:8.5px}'
      + '</style></head><body>'
      + '<h1>FERTIAGRO ALARCON S.A.S. &mdash; Relacion de pagos desde el banco</h1>'
      + '<div class="sub">NIT 901.999.718-5 &middot; Del ' + esc_(desde) + ' al ' + esc_(hasta)
      + ' &middot; Generado por ' + esc_(yo.nombre) + ' el '
      + Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm') + '</div>'
      + '<table><tr><th>Fecha</th><th>Proveedor</th><th>Factura</th><th>Concepto</th>'
      + '<th class="n">Total factura</th><th class="n">Retefuente</th><th class="n">ReteIVA</th>'
      + '<th class="n">Neto pagado</th><th>Banco</th><th>Pago</th><th>Extracto</th></tr>'
      + fil
      + '<tr><td colspan="7" style="text-align:right"><b>TOTAL NETO PAGADO</b></td>'
      + '<td class="n"><b>' + pes_(tneto) + '</b></td><td colspan="3"></td></tr>'
      + '</table>'
      + '<div class="fir"><div>Elaborado por<br><br>&nbsp;</div>'
      + '<div>Revisado por<br><br>&nbsp;</div>'
      + '<div>Aprobado por<br><br>&nbsp;</div></div>'
      + '</body></html>';
    var blob = Utilities.newBlob(h, 'text/html', 'x.html').getAs('application/pdf')
      .setName('PAGOS BANCO FERTIAGRO ' + desde + ' a ' + hasta + '.pdf');
    return publicar_(carpetaDesc_(), blob);
  } catch (e) { return { ok: false, error: String(e) }; }
}

function arreglarFechaBanco_() {
  var sh = ss_().getSheetByName(HOJA_PAG);
  sh.getRange('B2:B2000').setNumberFormat('dd/MM/yyyy');
  sh.getRange('U2:U2000').setNumberFormat('dd/MM/yyyy HH:mm');
  return 'Fechas de PAGOS BANCO en formato colombiano';
}

