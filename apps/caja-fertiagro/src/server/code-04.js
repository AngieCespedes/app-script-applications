function instalarPagos_() {
  var ss = ss_();

  var t = ss.getSheetByName(HOJA_TAR);
  if (!t) t = ss.insertSheet(HOJA_TAR);
  t.clear();
  t.getRange(1, 1, 1, 6).setValues([['CONCEPTO', 'TARIFA DECLARANTE', 'TARIFA NO DECLARANTE',
    'BASE MINIMA (UVT)', 'ACTIVO', 'NOTA']]);
  t.getRange(1, 1, 1, 6).setBackground('#15201A').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(9);
  var tar = [
    ['COMPRAS GENERALES', 0.025, 0.035, 27, 'SI', 'Art. 392 E.T. / DUR 1625 de 2016'],
    ['SERVICIOS GENERALES', 0.04, 0.06, 4, 'SI', 'Art. 392 E.T.'],
    ['HONORARIOS Y COMISIONES', 0.11, 0.10, 0, 'SI', '11% PJ y PN declarante / 10% PN no declarante'],
    ['ARRENDAMIENTO DE INMUEBLES', 0.035, 0.035, 27, 'SI', 'Art. 401 E.T.'],
    ['ARRENDAMIENTO DE MUEBLES', 0.04, 0.04, 0, 'SI', ''],
    ['TRANSPORTE DE CARGA', 0.01, 0.01, 4, 'SI', ''],
    ['TRANSPORTE DE PASAJEROS', 0.035, 0.035, 27, 'SI', ''],
    ['COMPRA DE MERCANCIA', 0.025, 0.035, 27, 'SI', 'Igual a compras generales'],
    ['SIN RETENCION', 0, 0, 0, 'SI', 'Para pagos que no estan sujetos']
  ];
  t.getRange(2, 1, tar.length, 6).setValues(tar);
  t.getRange(2, 2, tar.length, 2).setNumberFormat('0.00%');
  t.setColumnWidth(1, 240); t.setColumnWidth(6, 320);
  t.setFrozenRows(1);
  t.getRange(tar.length + 3, 1).setValue('Tarifa de reteIVA (sobre el IVA facturado):');
  t.getRange(tar.length + 3, 2).setValue(0.15).setNumberFormat('0.00%');

  var fu = tar.length + 5;
  t.getRange(fu, 1, 1, 2).setValues([['UVT POR ANO', 'VALOR DE LA UVT']]);
  t.getRange(fu, 1, 1, 2).setBackground('#157347').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(9);
  t.getRange(fu + 1, 1, 4, 2).setValues([[2026, 52370], [2027, ''], [2028, ''], [2029, '']]);
  t.getRange(fu + 1, 2, 4, 1).setNumberFormat('"$" #,##0');
  t.getRange(fu + 6, 1).setValue('Cada ano escriba aqui la UVT de la resolucion DIAN. Con eso se recalculan solas las bases minimas y la alerta de 100 UVT.');

  var p = ss.getSheetByName(HOJA_PAG);
  if (!p) p = ss.insertSheet(HOJA_PAG);
  p.clear();
  var enc = ['ID', 'FECHA', 'PERIODO', 'PROVEEDOR', 'NIT o CC', 'REGIMEN', 'CONCEPTO',
    'DECLARANTE', 'No. FACTURA', 'DESCRIPCION', 'BASE', 'IVA', 'TOTAL FACTURA',
    'TARIFA RTF', 'RETEFUENTE', 'RETEIVA', 'NETO PAGADO', 'BANCO', 'No. TRANSACCION',
    'PAGADO POR', 'FECHA Y HORA', 'CONFIRMADO EN EXTRACTO', 'ESTADO', 'OBSERVACIONES',
    'NETO CALCULADO', 'DIFERENCIA VS CALCULO'];
  p.getRange(1, 1, 1, enc.length).setValues([enc]);
  p.getRange(1, 1, 1, enc.length).setBackground('#1A4C8B').setFontColor('#FFFFFF')
   .setFontWeight('bold').setFontSize(8).setWrap(true);
  p.setFrozenRows(1);
  p.setColumnWidth(4, 220); p.setColumnWidth(10, 240);
  p.getRange(2, 11, p.getMaxRows() - 1, 7).setNumberFormat('"$" #,##0');
  p.getRange(2, 25, p.getMaxRows() - 1, 2).setNumberFormat('"$" #,##0');
  p.getRange(2, 14, p.getMaxRows() - 1, 1).setNumberFormat('0.00%');
  var u = ss.getSheetByName(HOJA_USU);
  if (u && String(u.getRange(1, 10).getValue()).trim() === '') {
    u.getRange(1, 10).setValue('PAGA DESDE BANCO')
     .setBackground('#1F2421').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(9);
    var nu = u.getLastRow();
    if (nu >= 2) {
      var vals = u.getRange(2, 4, nu - 1, 1).getValues();
      for (var q = 0; q < vals.length; q++)
        if (String(vals[q][0]).trim().toUpperCase() === 'ADMIN') u.getRange(q + 2, 10).setValue('SI');
    }
  }
  return 'Listas las hojas ' + HOJA_TAR + ' y ' + HOJA_PAG;
}

function uvtDelAno_(ano) {
  try {
    var t = ss_().getSheetByName(HOJA_TAR);
    if (t) {
      var n = t.getLastRow();
      var v = t.getRange(1, 1, n, 2).getValues();
      var mejor = 0, mejorAno = 0;
      for (var i = 0; i < v.length; i++) {
        var a = Number(v[i][0]), u = Number(v[i][1]);
        if (a >= 2020 && a <= 2100 && u > 0) {
          if (a === ano) return u;
          if (a < ano && a > mejorAno) { mejorAno = a; mejor = u; }
        }
      }
      if (mejor) return mejor;
    }
  } catch (e) {}
  try {
    var p = ss_().getSheetByName(HOJA_PAR).getRange('A1:AA60').getDisplayValues();
    return Number(String(celdaDerecha_(p, 'UVT 2026')).replace(/[^0-9.-]/g, '')) || 0;
  } catch (e) { return 0; }
}

function tarifas_() {
  var t = ss_().getSheetByName(HOJA_TAR);
  if (!t) throw new Error('Falta la hoja TARIFAS RETENCION. Pida a contabilidad que ejecute la instalacion.');
  var n = t.getLastRow();
  var v = t.getRange(1, 1, n, 6).getValues();
  var lista = [], reteiva = 0.15;
  for (var i = 1; i < v.length; i++) {
    var c = String(v[i][0]).trim();
    if (/RETEIVA/i.test(c)) { reteiva = Number(v[i][1]) || 0.15; continue; }
    if (String(v[i][0]).indexOf('Tarifa de reteIVA') === 0) { reteiva = Number(v[i][1]) || 0.15; continue; }
    if (!c || String(v[i][4]).trim().toUpperCase() === 'NO') continue;
    if (typeof v[i][1] !== 'number') continue;
    lista.push({ concepto: c, decl: Number(v[i][1]) || 0, nodecl: Number(v[i][2]) || 0,
                 baseUvt: Number(v[i][3]) || 0, nota: String(v[i][5] || '') });
  }
  return { lista: lista, reteiva: reteiva };
}

function datosPago_(tk) {
  try {
    var yo = ses_(tk);
    var v = ss_().getSheetByName(HOJA_PAR).getRange('A1:AA60').getDisplayValues();
    var numf = function (x) { return Number(String(x).replace(/[^0-9.-]/g, '')) || 0; };
    var T = tarifas_();
    return { ok: true, yo: yo, conceptos: T.lista, reteiva: T.reteiva,
             bancos: listaPorEncabezado_(v, 'BANCO'),
             uvt: uvtDelAno_(new Date().getFullYear()),
             uvt100: uvtDelAno_(new Date().getFullYear()) * 100,
             hoy: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd') };
  } catch (err) { return { ok: false, error: String(err) }; }
}

function calcularPago_(d, T, uvt) {
  var base = Number(d.base) || 0;
  var iva = Number(d.iva) || 0;
  var reg = String(d.regimen || '').toUpperCase();
  var r = { base: base, iva: iva, total: base + iva, tarifa: 0, retefuente: 0,
            reteiva: 0, neto: 0, nombreRtf: '', notas: [] };

  if (reg.indexOf('SIMPLE') >= 0) {
    r.reteiva = Math.round(iva * T.reteiva);
    r.notas.push('Proveedor del regimen SIMPLE: no se le practica retefuente de renta (Art. 911 E.T.).');
    if (iva > 0) r.notas.push('Si se le practica reteIVA del ' + (T.reteiva * 100).toFixed(0) +
      '% (Art. 437-2 num. 9 y Art. 437-1 E.T.).');
    else r.notas.push('No facturo IVA, asi que no hay reteIVA.');
  } else if (reg.indexOf('NO RESPONSABLE') >= 0) {
    r.iva = 0; r.total = base;
    r.notas.push('Proveedor no responsable de IVA: la factura no lleva IVA.');
  }

  if (reg.indexOf('SIMPLE') < 0) {
    var c = null;
    for (var i = 0; i < T.lista.length; i++)
      if (T.lista[i].concepto === String(d.concepto).toUpperCase()) c = T.lista[i];
    if (c) {
      var tf = d.declarante === 'NO' ? c.nodecl : c.decl;
      var minimo = c.baseUvt * uvt;
      if (c.baseUvt > 0 && base < minimo) {
        r.notas.push('No hay retefuente: la base ($ ' + Math.round(base).toLocaleString('es-CO') +
          ') no llega a la base minima de ' + c.baseUvt + ' UVT ($ ' +
          Math.round(minimo).toLocaleString('es-CO') + ').');
      } else if (tf > 0) {
        r.tarifa = tf;
        r.retefuente = Math.round(base * tf);
        r.nombreRtf = c.concepto + ' al ' + (tf * 100).toFixed(2).replace('.', ',') + '%' +
          (d.declarante === 'NO' ? ' (no declarante)' : ' (declarante)');
        r.notas.push('Retefuente de renta por ' + r.nombreRtf + ' sobre la base.');
      }
    }
    if (d.declarante === 'NOSE')
      r.notas.push('AVISO: no sabe si el proveedor es declarante. Se calculo con la tarifa de declarante. Confirmelo con contabilidad antes de girar.');
  }

  r.neto = r.total - r.retefuente - r.reteiva;
  return r;
}

function simularPago_(tk, d) {
  try {
    ses_(tk);
    var ano = Number(String(d.fecha || '').substring(0, 4)) || new Date().getFullYear();
    return { ok: true, r: calcularPago_(d, tarifas_(), uvtDelAno_(ano)) };
  } catch (err) { return { ok: false, error: String(err) }; }
}

function registrarPagoBanco_(tk, d) {
  var lock = LockService.getScriptLock();
  try {
    var yo = ses_(tk);
    if (!yo.banco && yo.rol !== 'ADMIN')
      return { ok: false, error: 'Su usuario no tiene permiso para registrar pagos desde el banco.' };
    if (!String(d.proveedor || '').trim()) return { ok: false, error: 'Falta el proveedor.' };
    if (!(Number(d.base) > 0)) return { ok: false, error: 'Falta la base.' };
    lock.waitLock(30000);

    var ss = ss_();
    var ano = Number(String(d.fecha || '').substring(0, 4)) || new Date().getFullYear();
    var r = calcularPago_(d, tarifas_(), uvtDelAno_(ano));

    var sh = ss.getSheetByName(HOJA_PAG);
    var f = sh.getLastRow() + 1;
    if (f < 2) f = 2;
    var fecha = new Date(d.fecha + 'T12:00:00');
    var pagado = (d.netoPagado === '' || d.netoPagado === null || d.netoPagado === undefined)
                 ? r.neto : Number(d.netoPagado) || 0;
    var dif = pagado - r.neto;
    var obs = [d.observaciones || '', r.nombreRtf || ''];
    if (dif !== 0) obs.push('GIRO DISTINTO AL CALCULO: se calcularon $ ' +
      Math.round(r.neto).toLocaleString('es-CO') + ' y se giraron $ ' +
      Math.round(pagado).toLocaleString('es-CO') + '.');

    sh.getRange(f, 1, 1, 26).setValues([[
      f - 1, fecha, Utilities.formatDate(fecha, TZ, 'yyyyMM'),
      String(d.proveedor).trim().toUpperCase(), d.nit || '', d.regimen || '', d.concepto || '',
      d.declarante || '', d.factura || '', d.descripcion || '',
      r.base, r.iva, r.total, r.tarifa, r.retefuente, r.reteiva, pagado,
      d.banco || '', d.transaccion || '', yo.nombre,
      Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm'), 'PENDIENTE', 'VIGENTE',
      obs.filter(String).join('  |  '), r.neto, dif
    ]]);
    SpreadsheetApp.flush();
    return { ok: true, fila: f, r: r, pagado: pagado, dif: dif };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function pagosBanco_(tk, desde, hasta) {
  try {
    ses_(tk);
    var sh = ss_().getSheetByName(HOJA_PAG);
    var out = { ok: true, filas: [], total: 0, rtf: 0, riva: 0, sinConf: 0 };
    if (!sh) return out;
    var n = sh.getLastRow();
    if (n < 2) return out;
    var rg = sh.getRange(2, 1, n - 1, 26);
    var d = rg.getDisplayValues(), x = rg.getValues();
    var a = new Date(desde + 'T00:00:00'), b = new Date(hasta + 'T23:59:59');
    for (var i = 0; i < d.length; i++) {
      var f = x[i][1];
      if (!(f instanceof Date)) continue;
      if (f < a || f > b) continue;
      if (String(d[i][22]).trim().toUpperCase() === 'ANULADO') continue;
      out.filas.push({ fila: 2 + i, nit: d[i][4], regimen: d[i][5],
                       fecha: d[i][1], proveedor: d[i][3], concepto: d[i][6],
                       factura: d[i][8], total: d[i][12], rtf: d[i][14], riva: d[i][15],
                       neto: d[i][16], banco: d[i][17], quien: d[i][19], conf: d[i][21],
                       dif: Number(x[i][25]) || 0 });
      if (Number(x[i][25])) out.conDif = (out.conDif || 0) + 1;
      out.total += Number(x[i][16]) || 0;
      out.rtf += Number(x[i][14]) || 0;
      out.riva += Number(x[i][15]) || 0;
      if (String(d[i][21]).trim().toUpperCase() !== 'CONFIRMADO') out.sinConf++;
    }
    return out;
  } catch (err) { return { ok: false, error: String(err) }; }
}

