function registrarCierre_(tk, d) {
  var lock = LockService.getScriptLock();
  try {
    var yo = ses_(tk);
    if (!yo.arqueo && yo.rol !== 'ADMIN') return { ok: false, error: 'Su usuario no tiene permiso para cerrar la caja.' };
    lock.waitLock(30000);
    var sh = ss_().getSheetByName(HOJA_ARQ);
    var fecha = new Date(d.fecha + 'T12:00:00');
    var n = sh.getMaxRows();
    var col = sh.getRange(FILA_INI, 1, n - FILA_INI + 1, 1).getValues();
    var f = 0;
    for (var i = 0; i < col.length; i++) {
      var c = col[i][0];
      if (c instanceof Date && Utilities.formatDate(c, TZ, 'yyyy-MM-dd') === d.fecha) { f = FILA_INI + i; break; }
      if (String(c).trim() === '' && !f) { f = FILA_INI + i; break; }
    }
    if (!f) f = FILA_INI + col.length;

    var den = d.denominaciones || [];
    var fila = [];
    for (var k = 0; k < 11; k++) fila.push(Number(den[k]) || '');

    sh.getRange(f, 1).setValue(fecha);
    sh.getRange(f, 2, 1, 2).setValues([[d.cajero || '', yo.nombre]]);
    sh.getRange(f, 4, 1, 11).setValues([fila]);
    sh.getRange(f, 25, 1, 5).setValues([[d.consignacion || '', d.banco || '',
                                         Number(d.valorConsignado) || '', d.quienConsigna || '',
                                         d.consignacion ? fecha : '']]);
    sh.getRange(f, 30, 1, 4).setValues([['CERRADO', yo.nombre,
                                         Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm'),
                                         d.observaciones || '']]);
    SpreadsheetApp.flush();
    return { ok: true, fila: f,
             esperado: sh.getRange(f, 21).getDisplayValue(),
             diferencia: sh.getRange(f, 22).getDisplayValue(),
             estado: sh.getRange(f, 23).getDisplayValue() };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function movimientos_(tk, desde, hasta) {
  try {
    ses_(tk);
    var sh = ss_().getSheetByName(HOJA_MOV);
    var n = sh.getLastRow();
    var out = { ok: true, ingresos: [], egresos: [], entro: 0, salio: 0, banco: 0,
                cartera: 0, cerrado: '', dias: 0, porCat: [] };
    if (n < FILA_INI) return out;
    var r = sh.getRange(FILA_INI, 2, n - FILA_INI + 1, 23);
    var d = r.getDisplayValues(), x = r.getValues();
    var a = new Date(desde + 'T00:00:00'), b = new Date(hasta + 'T23:59:59');
    var vistos = {}, cat = {};
    for (var i = 0; i < d.length; i++) {
      var f = x[i][0];
      if (!(f instanceof Date)) continue;
      if (f < a || f > b) continue;
      if (String(d[i][3]).trim() === '') continue;
      if (String(d[i][19]).trim().toUpperCase() === 'ANULADO') continue;
      var caja = Number(x[i][12]) || 0;
      var val = Number(x[i][11]) || 0;
      var reg = { fila: FILA_INI + i, ident: d[i][8], categoria2: d[i][10],
                  fecha: d[i][0], tipo: d[i][3], medio: d[i][4], doc: d[i][6], tercero: d[i][7],
                  concepto: d[i][9], categoria: d[i][10], valor: d[i][11],
                  quien: d[i][15], alerta: d[i][21] };
      var esEgreso = String(d[i][3]).toUpperCase().indexOf('EGRESO') >= 0 ||
                     String(d[i][3]).toUpperCase().indexOf('CAJA A BANCO') >= 0;
      if (esEgreso) {
        out.egresos.push(reg);
        var k = String(d[i][10]).trim() || 'POR CLASIFICAR';
        cat[k] = (cat[k] || 0) + val;
      } else out.ingresos.push(reg);
      if (caja > 0) out.entro += caja; else out.salio += -caja;
      out.banco += Number(x[i][13]) || 0;
      out.cartera += Number(x[i][14]) || 0;
      vistos[Utilities.formatDate(f, TZ, 'yyyy-MM-dd')] = 1;
    }
    out.dias = Object.keys(vistos).length;
    out.porCat = Object.keys(cat).map(function (k) { return { cat: k, val: cat[k] }; })
                  .sort(function (p, q) { return q.val - p.val; }).slice(0, 8);
    if (desde === hasta) {
      var p = String(desde).split('-');
      var dmy = p[2] + '/' + p[1] + '/' + p[0];
      var sa = ss_().getSheetByName(HOJA_ARQ);
      var m = sa.getLastRow();
      if (m >= FILA_INI) {
        var da = sa.getRange(FILA_INI, 1, m - FILA_INI + 1, 32).getDisplayValues();
        for (var q2 = 0; q2 < da.length; q2++) {
          if (da[q2][0] === dmy) { out.cerrado = String(da[q2][29] || '') + (da[q2][30] ? ' por ' + da[q2][30] : ''); break; }
        }
      }
    }
    return out;
  } catch (err) { return { ok: false, error: String(err) }; }
}

function carpetaDesc_() {
  var f = Aislamiento_.carpeta(Config_.id('CARPETA_DESC_ID'));
  var lim = new Date().getTime() - 86400000;
  var fs = f.getFiles();
  while (fs.hasNext()) {
    var x = fs.next();
    if (x.getDateCreated().getTime() < lim) { try { x.setTrashed(true); } catch (e) {} }
  }
  return f;
}

function publicar_(f, blob) {
  var file = f.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: 'https://drive.google.com/uc?export=download&id=' + file.getId(),
           ver: 'https://drive.google.com/file/d/' + file.getId() + '/view', nombre: blob.getName() };
}

function pes_(n) {
  n = Number(n) || 0;
  var s = Math.abs(Math.round(n)).toString(), o = '', c = 0;
  for (var i = s.length - 1; i >= 0; i--) { o = s.charAt(i) + o; if (++c % 3 === 0 && i > 0) o = '.' + o; }
  return (n < 0 ? '-$ ' : '$ ') + o;
}

function dot_(s) { return String(s == null ? '' : s).replace(/,/g, '.'); }

function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function exportar_(tk, desde, hasta, formato, etiqueta) {
  try {
    ses_(tk);
    var r = movimientos_(tk, desde, hasta);
    if (!r.ok) return r;
    var f = carpetaDesc_();
    var lim = String(etiqueta || '').replace(/[\\/:*?"<>|]/g, '-');
    var blob;

    if (formato === 'csv') {
      var L = [];
      L.push('sep=;');
      L.push('FECHA;CLASE;TIPO;DOCUMENTO;TERCERO;CONCEPTO;CATEGORIA;MEDIO DE PAGO;VALOR;REGISTRADO POR');
      var fila = function (m, clase) {
        return [m.fecha, clase, m.tipo, m.doc, m.tercero, m.concepto, m.categoria, m.medio,
                String(m.valor).replace(/[^0-9-]/g, ''), m.quien]
               .map(function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; }).join(';');
      };
      r.ingresos.forEach(function (m) { L.push(fila(m, 'INGRESO')); });
      r.egresos.forEach(function (m) { L.push(fila(m, 'EGRESO')); });
      L.push('');
      L.push('"";"RESUMEN";"";"";"";"";"";"";"";""');
      L.push('"";"ENTRO A CAJA";"";"";"";"";"";"";"' + Math.round(r.entro) + '";""');
      L.push('"";"SALIO DE CAJA";"";"";"";"";"";"";"' + Math.round(r.salio) + '";""');
      L.push('"";"QUEDA EN CAJA";"";"";"";"";"";"";"' + Math.round(r.entro - r.salio) + '";""');
      L.push('"";"MOVIMIENTO DE CARTERA";"";"";"";"";"";"";"' + Math.round(r.cartera) + '";""');
      blob = Utilities.newBlob('\ufeff' + L.join('\r\n'), 'text/csv',
             'CAJA FERTIAGRO ' + lim + '.csv').setContentType('text/csv');
      return publicar_(f, blob);
    }

    var filas = function (arr, color) {
      if (!arr.length) return '<tr><td colspan="6" class="v">Sin movimientos</td></tr>';
      return arr.map(function (m) {
        return '<tr><td>' + esc_(m.fecha) + '</td><td><b>' + esc_(m.tipo) + '</b></td><td>' +
               esc_(m.doc) + '</td><td>' + esc_(m.concepto || m.tercero) + '</td><td>' +
               esc_(m.medio) + '</td><td class="n">' + esc_(String(m.valor).replace(/,/g, '.')) + '</td></tr>';
      }).join('');
    };
    var cats = r.porCat.map(function (c) {
      return '<tr><td colspan="5">' + esc_(c.cat) + '</td><td class="n">' + pes_(c.val) + '</td></tr>';
    }).join('');

    var html = '<html><head><meta charset="utf-8"><style>' +
      '@page{size:21.59cm 27.94cm;margin:1.4cm}' +
      'body{font-family:Arial,Helvetica,sans-serif;color:#15201A;font-size:9pt;margin:0}' +
      '.hd{border-bottom:3px solid #157347;padding-bottom:8px;margin-bottom:12px}' +
      '.hd .e{font-size:7.5pt;letter-spacing:1.2px;color:#157347;font-weight:bold}' +
      '.hd h1{font-size:15pt;margin:4px 0 2px}.hd p{margin:0;color:#6B726D;font-size:9pt}' +
      '.st{width:100%;border-collapse:collapse;margin-bottom:14px}' +
      '.st td{border:1px solid #D7DED9;padding:7px 9px;width:25%}' +
      '.st small{display:block;font-size:7pt;letter-spacing:.5px;color:#6B726D}' +
      '.st b{font-size:12pt}' +
      'h2{font-size:9.5pt;letter-spacing:1px;color:#fff;padding:5px 9px;margin:14px 0 0}' +
      'table.d{width:100%;border-collapse:collapse}' +
      'table.d th{background:#F0F3F1;font-size:7pt;letter-spacing:.5px;text-align:left;padding:5px 7px;border-bottom:1px solid #D7DED9}' +
      'table.d td{padding:4px 7px;border-bottom:1px solid #EDF0EE;font-size:8.5pt}' +
      'table.d td.n{text-align:right;font-weight:bold;white-space:nowrap}' +
      'td.v{text-align:center;color:#6B726D;padding:12px}' +
      '.pie{margin-top:18px;border-top:1px solid #D7DED9;padding-top:8px;font-size:7.5pt;color:#6B726D}' +
      '</style></head><body>' +
      '<div class="hd"><div class="e">FERTIAGRO ALARC&Oacute;N S.A.S. &nbsp;&middot;&nbsp; NIT 901.999.718-5</div>' +
      '<h1>Movimientos de caja</h1><p>' + esc_(etiqueta) + '</p></div>' +
      '<table class="st"><tr>' +
      '<td><small>ENTR&Oacute; A CAJA</small><b style="color:#157347">' + pes_(r.entro) + '</b></td>' +
      '<td><small>SALI&Oacute; DE CAJA</small><b style="color:#B3261E">' + pes_(r.salio) + '</b></td>' +
      '<td><small>QUEDA EN CAJA</small><b>' + pes_(r.entro - r.salio) + '</b></td>' +
      '<td><small>CARTERA</small><b>' + pes_(r.cartera) + '</b></td></tr></table>' +
      '<h2 style="background:#157347">INGRESOS &mdash; ' + r.ingresos.length + ' movimientos</h2>' +
      '<table class="d"><tr><th>FECHA</th><th>TIPO</th><th>DOC.</th><th>CONCEPTO</th><th>MEDIO</th><th style="text-align:right">VALOR</th></tr>' +
      filas(r.ingresos) + '</table>' +
      '<h2 style="background:#B3261E">EGRESOS &mdash; ' + r.egresos.length + ' movimientos</h2>' +
      '<table class="d"><tr><th>FECHA</th><th>TIPO</th><th>DOC.</th><th>CONCEPTO</th><th>MEDIO</th><th style="text-align:right">VALOR</th></tr>' +
      filas(r.egresos) + (cats ? '<tr><th colspan="5">EN QU&Eacute; SE GAST&Oacute;</th><th style="text-align:right">VALOR</th></tr>' + cats : '') +
      '</table>' +
      '<div class="pie">Generado el ' + Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm') +
      ' desde el libro de caja. Art. 771-5 E.T.: los pagos individuales superiores a 100 UVT deben hacerse por medio financiero.<br>' +
      'Contadores &Oacute;ptima &middot; Angie C&eacute;spedes Portela, Contadora P&uacute;blica T.P. 323611-T</div>' +
      '</body></html>';

    blob = Utilities.newBlob(html, 'text/html', 'x.html').getAs('application/pdf')
           .setName('CAJA FERTIAGRO ' + lim + '.pdf');
    return publicar_(f, blob);
  } catch (err) { return { ok: false, error: String(err) }; }
}

