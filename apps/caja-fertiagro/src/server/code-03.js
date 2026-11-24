function exportarArqueo_(tk, fecha) {
  try {
    ses_(tk);
    var sh = ss_().getSheetByName(HOJA_ARQ);
    var n = sh.getLastRow();
    var p = String(fecha).split('-');
    var dmy = p[2] + '/' + p[1] + '/' + p[0];
    var v = null;
    if (n >= FILA_INI) {
      var da = sh.getRange(FILA_INI, 1, n - FILA_INI + 1, 33).getDisplayValues();
      for (var i = 0; i < da.length; i++) if (da[i][0] === dmy) { v = da[i]; break; }
    }
    if (!v) return { ok: false, error: 'Ese dia todavia no tiene arqueo registrado.' };

    var DEN = ['100.000', '50.000', '20.000', '10.000', '5.000', '2.000', '1.000', '500', '200', '100', '50'];
    var cel = '';
    for (var k = 0; k < 11; k++) {
      cel += '<td><small>$' + DEN[k] + '</small><b>' + (v[3 + k] === '' ? '0' : esc_(v[3 + k])) + '</b></td>';
      if (k === 5) cel += '</tr><tr>';
    }

    var html = '<html><head><meta charset="utf-8"><style>' +
      '@page{size:21.59cm 13.97cm;margin:.9cm}' +
      'body{font-family:Arial,Helvetica,sans-serif;color:#15201A;font-size:8pt;margin:0}' +
      '.hd{border-bottom:2.5px solid #1A4C8B;padding-bottom:5px;margin-bottom:8px;' +
      'display:flex;justify-content:space-between;align-items:flex-end}' +
      '.hd .e{font-size:6.5pt;letter-spacing:1.1px;color:#1A4C8B;font-weight:bold}' +
      '.hd h1{font-size:12.5pt;margin:3px 0 0}.hd .f{font-size:11pt;font-weight:bold}' +
      'table{width:100%;border-collapse:collapse}' +
      '.den td{border:1px solid #CBDAEC;padding:3px 2px;text-align:center;width:16.6%}' +
      '.den small{display:block;font-size:6pt;color:#1A4C8B;font-weight:bold}' +
      '.den b{font-size:11pt}' +
      '.res td{padding:3px 6px;border-bottom:1px solid #E2E7E3;font-size:8.5pt}' +
      '.res td.n{text-align:right;font-weight:bold;white-space:nowrap}' +
      '.res tr.t td{border-top:1.5px solid #15201A;border-bottom:0;font-size:10pt;padding-top:5px}' +
      '.fir{margin-top:14px}' +
      '.fir td{padding-top:24px;border-bottom:1px solid #15201A;width:31%;font-size:7pt}' +
      '.fir td.g{border:0;width:3.5%}' +
      '.rot{font-size:6.5pt;color:#6B726D;padding-top:3px}' +
      '</style></head><body>' +
      '<div class="hd"><div><div class="e">FERTIAGRO ALARC&Oacute;N S.A.S. &middot; NIT 901.999.718-5</div>' +
      '<h1>Arqueo y cierre de caja</h1></div><div class="f">' + esc_(v[0]) + '</div></div>' +
      '<table class="den"><tr>' + cel + '</tr></table>' +
      '<table class="res" style="margin-top:8px"><tr><td>Efectivo contado</td><td class="n">' + esc_(dot_(v[16])) + '</td>' +
      '<td style="padding-left:14px">Consignaci&oacute;n No.</td><td class="n">' + esc_(v[24] || '-') + '</td></tr>' +
      '<tr><td>Saldo inicial</td><td class="n">' + esc_(dot_(v[17])) + '</td>' +
      '<td style="padding-left:14px">Banco</td><td class="n">' + esc_(v[25] || '-') + '</td></tr>' +
      '<tr><td>Entradas en efectivo</td><td class="n">' + esc_(dot_(v[18])) + '</td>' +
      '<td style="padding-left:14px">Valor consignado</td><td class="n">' + esc_(dot_(v[26]) || '-') + '</td></tr>' +
      '<tr><td>Salidas en efectivo</td><td class="n">' + esc_(dot_(v[19])) + '</td>' +
      '<td style="padding-left:14px">Lleva al banco</td><td class="n">' + esc_(v[27] || '-') + '</td></tr>' +
      '<tr><td>Saldo esperado</td><td class="n">' + esc_(dot_(v[20])) + '</td>' +
      '<td style="padding-left:14px">Estado</td><td class="n">' + esc_(v[22]) + '</td></tr>' +
      '<tr class="t"><td><b>Diferencia</b></td><td class="n">' + esc_(dot_(v[21])) + '</td>' +
      '<td style="padding-left:14px">Saldo que pasa</td><td class="n">' + esc_(dot_(v[23])) + '</td></tr></table>' +
      (v[32] ? '<div style="margin-top:7px;font-size:7.5pt"><b>Observaciones:</b> ' + esc_(v[32]) + '</div>' : '') +
      '<table class="fir"><tr>' +
      '<td>' + esc_(v[1] || '') + '<div class="rot">CAJERO DEL D&Iacute;A &mdash; FIRMA</div></td><td class="g"></td>' +
      '<td>' + esc_(v[2] || '') + '<div class="rot">QUIEN HIZO EL ARQUEO &mdash; FIRMA</div></td><td class="g"></td>' +
      '<td><div class="rot">REVIS&Oacute; CONTABILIDAD &mdash; FIRMA</div></td></tr></table>' +
      '<div style="margin-top:8px;font-size:6.5pt;color:#6B726D">Cerrado en el sistema por ' +
      esc_(v[30] || '-') + ' el ' + esc_(v[31] || '-') +
      '. Contadores &Oacute;ptima &middot; Angie C&eacute;spedes Portela, C.P. T.P. 323611-T</div>' +
      '</body></html>';

    var blob = Utilities.newBlob(html, 'text/html', 'x.html').getAs('application/pdf')
               .setName('ARQUEO FERTIAGRO ' + dmy.replace(/\//g, '-') + '.pdf');
    return publicar_(carpetaDesc_(), blob);
  } catch (err) { return { ok: false, error: String(err) }; }
}

/* ===================== ANALITICA GERENCIA ===================== */

function analitica_(tk, desde, hasta) {
  try {
    var yo = ses_(tk);
    if (yo.rol !== 'ADMIN' && yo.rol !== 'GERENTE')
      return { ok: false, error: 'Esta pantalla es solo para gerencia y contabilidad.' };

    var ss = ss_();
    var sh = ss.getSheetByName(HOJA_MOV);
    var n = sh.getLastRow();
    var par = ss.getSheetByName(HOJA_PAR).getRange('A1:AA60').getDisplayValues();
    var numf = function (x) { return Number(String(x).replace(/[^0-9.-]/g, '')) || 0; };
    var uvt = uvtDelAno_(new Date(desde + 'T00:00:00').getFullYear()) || numf(celdaDerecha_(par, 'UVT 2026'));
    var uvt100 = uvt * 100;

    var a = new Date(desde + 'T00:00:00'), b = new Date(hasta + 'T23:59:59');
    var pa = new Date(a); pa.setMonth(pa.getMonth() - 1);
    var pb = new Date(a); pb.setDate(pb.getDate() - 1);
    var anoIni = new Date(a.getFullYear(), 0, 1);

    var K = { ventas: 0, entro: 0, salio: 0, cartera: 0, banco: 0, egresos: 0,
                 contado: 0, credito: 0, porconf: 0, recaudo: 0 };
    var PREV = { ventas: 0, egresos: 0 };
    var R = { uvtN: 0, uvtV: 0, sinDS: 0, sinConf: 0, efAno: 0, tope: uvt * 40000, porConf: 0, porConfV: 0 };
    var dias = {}, cat = {}, G = {};

    if (n >= FILA_INI) {
      var rg = sh.getRange(FILA_INI, 2, n - FILA_INI + 1, 23);
      var d = rg.getDisplayValues(), x = rg.getValues();
      for (var i = 0; i < d.length; i++) {
        var f = x[i][0];
        if (!(f instanceof Date)) continue;
        if (String(d[i][3]).trim() === '') continue;
        if (String(d[i][19]).trim().toUpperCase() === 'ANULADO') continue;

        var tipo = String(d[i][3]).toUpperCase();
        var medio = String(d[i][4]).toUpperCase();
        var val = Number(x[i][11]) || 0;
        var caja = Number(x[i][12]) || 0;
        var esEgreso = tipo.indexOf('EGRESO') >= 0;

        if (f >= anoIni && f <= b && esEgreso && medio.indexOf('EFECTIVO') >= 0) R.efAno += val;

        if (f >= pa && f <= pb) {
          if (tipo.indexOf('VENTA') >= 0) PREV.ventas += val;
          if (esEgreso) PREV.egresos += val;
        }
        if (f < a || f > b) continue;

        var dia = Utilities.formatDate(f, TZ, 'yyyy-MM-dd');
        dias[dia] = 1;
        if (tipo.indexOf('VENTA') >= 0) {
          K.ventas += val;
          var medioS = medio.replace(/\u00C9/g, 'E');
          if (medioS.indexOf('CREDITO') >= 0) K.credito += val;
          else if (medioS.indexOf('POR CONFIRMAR') >= 0) K.porconf += val;
          else K.contado += val;
        }
        if (tipo.indexOf('RECAUDO') >= 0) K.recaudo += val;
        if (caja > 0) K.entro += caja; else K.salio += -caja;
        K.banco += Number(x[i][13]) || 0;
        K.cartera += Number(x[i][14]) || 0;

        var quien = String(d[i][15]).trim() || '(sin asignar)';
        if (!G[quien]) G[quien] = { nombre: quien, movs: 0, ingresos: 0, egresos: 0,
                                     valIng: 0, valEgr: 0, uvt: 0, sinDS: 0, sinConf: 0,
                                     cierres: 0, difArq: 0 };
        var g = G[quien];
        g.movs++;

        if (esEgreso) {
          K.egresos += val;
          g.egresos++; g.valEgr += val;
          var c = String(d[i][10]).trim() || 'POR CLASIFICAR';
          cat[c] = (cat[c] || 0) + val;
          if (medio.indexOf('EFECTIVO') >= 0 && val > uvt100) { R.uvtN++; R.uvtV += val; g.uvt++; }
          if (String(d[i][16]).trim().toUpperCase() !== 'NO' && String(d[i][17]).trim() === '') { R.sinDS++; g.sinDS++; }
        } else {
          g.ingresos++; g.valIng += val;
          if (medio.indexOf('EFECTIVO') < 0 && medio.indexOf('CR') < 0 &&
              String(d[i][18]).trim().toUpperCase() !== 'SI') { R.sinConf++; g.sinConf++; }
          if (medio.indexOf('POR CONFIRMAR') >= 0) { R.porConf++; R.porConfV += val; }
        }
      }
    }

    var D = { dias: Object.keys(dias).length, cerrados: 0, sinFirmar: 0, noCuadran: 0, difAcum: 0 };
    var sa = ss.getSheetByName(HOJA_ARQ);
    var m = sa.getLastRow();
    if (m >= FILA_INI) {
      var ra = sa.getRange(FILA_INI, 1, m - FILA_INI + 1, 33);
      var da = ra.getDisplayValues(), xa = ra.getValues();
      for (var k = 0; k < da.length; k++) {
        var fa = xa[k][0];
        if (!(fa instanceof Date)) continue;
        if (fa < a || fa > b) continue;
        var est = String(da[k][29]).trim().toUpperCase();
        var dif = Number(xa[k][21]) || 0;
        if (est === 'CERRADO') D.cerrados++; else D.sinFirmar++;
        if (String(da[k][22]).trim().toUpperCase() !== 'CUADRA' && da[k][22] !== '') D.noCuadran++;
        D.difAcum += dif;
        var cp = String(da[k][30]).trim() || String(da[k][1]).trim();
        if (cp && est === 'CERRADO') {
          if (!G[cp]) G[cp] = { nombre: cp, movs: 0, ingresos: 0, egresos: 0, valIng: 0,
                                 valEgr: 0, uvt: 0, sinDS: 0, sinConf: 0, cierres: 0, difArq: 0 };
          G[cp].cierres++; G[cp].difArq += dif;
        }
      }
    }

    var gente = Object.keys(G).map(function (k2) { return G[k2]; })
                 .sort(function (p, q) { return q.movs - p.movs; });
    var porCat = Object.keys(cat).map(function (k3) { return { cat: k3, val: cat[k3] }; })
                 .sort(function (p, q) { return q.val - p.val; }).slice(0, 10);

    return { ok: true, k: K, prev: PREV, disc: D, riesgo: R, gente: gente, porCat: porCat, uvt100: uvt100 };
  } catch (err) { return { ok: false, error: String(err) }; }
}

function registrosPersona_(tk, desde, hasta, nombre) {
  try {
    var yo = ses_(tk);
    if (yo.rol !== 'ADMIN' && yo.rol !== 'GERENTE')
      return { ok: false, error: 'Solo gerencia y contabilidad.' };
    var sh = ss_().getSheetByName(HOJA_MOV);
    var n = sh.getLastRow();
    var out = { ok: true, filas: [] };
    if (n < FILA_INI) return out;
    var rg = sh.getRange(FILA_INI, 2, n - FILA_INI + 1, 23);
    var d = rg.getDisplayValues(), x = rg.getValues();
    var a = new Date(desde + 'T00:00:00'), b = new Date(hasta + 'T23:59:59');
    var obj = String(nombre).trim().toUpperCase();
    for (var i = 0; i < d.length; i++) {
      var f = x[i][0];
      if (!(f instanceof Date)) continue;
      if (f < a || f > b) continue;
      if (String(d[i][3]).trim() === '') continue;
      if (String(d[i][19]).trim().toUpperCase() === 'ANULADO') continue;
      var q = String(d[i][15]).trim().toUpperCase() || '(SIN ASIGNAR)';
      if (q !== obj) continue;
      out.filas.push({ fecha: d[i][0], tipo: d[i][3], medio: d[i][4], doc: d[i][6],
                       tercero: d[i][7], concepto: d[i][9], valor: d[i][11], alerta: d[i][21] });
      if (out.filas.length >= 300) break;
    }
    return out;
  } catch (err) { return { ok: false, error: String(err) }; }
}

