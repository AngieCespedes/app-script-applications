/** CAJA FERTIAGRO ALARCON S.A.S. - Plataforma de caja
 *  Contadores Optima - Angie Cespedes Portela
 */

var SS_ID = '1_fOW4YDhAeenvxc2UFP079SzipkkYlaHKP6IMdOe4Tg';
var TZ = 'America/Bogota';
var HOJA_MOV = 'MOVIMIENTOS';
var HOJA_ARQ = 'ARQUEO Y CIERRE';
var HOJA_PAR = 'PARAM';
var HOJA_USU = 'USUARIOS';
var FILA_INI = 7;
var CARPETA_SOPORTES = 'SOPORTES CAJA FERTIAGRO';
var SAL = 'FertiagroCaja2026#901999718';

function doGet(e) {
  var t = HtmlService.createTemplateFromFile('App');
  t.ver = (e && e.parameter && e.parameter.ver) || '';
  return t.evaluate()
    .setTitle('Caja Fertiagro')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

function ss_() { return SpreadsheetApp.openById(SS_ID); }

/* ===================== USUARIOS ===================== */

function hash_(clave) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(clave) + SAL);
  return b.map(function (x) { return ((x & 0xFF) + 0x100).toString(16).slice(1); }).join('');
}

function instalar() {
  var ss = ss_();
  var sh = ss.getSheetByName(HOJA_USU);
  if (!sh) sh = ss.insertSheet(HOJA_USU);
  sh.clear();
  sh.getRange(1, 1, 1, 10).setValues([['NOMBRE COMPLETO', 'USUARIO', 'CLAVE (CIFRADA)', 'ROL',
    'MANEJA CAJA', 'HACE ARQUEO', 'CONSIGNA', 'AUTORIZA PAGOS', 'ACTIVO', 'PAGA DESDE BANCO']]);
  sh.getRange(1, 1, 1, 10).setBackground('#1F2421').setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(9);
  sh.getRange(2, 1, 1, 10).setValues([['ANGIE CESPEDES PORTELA', 'angie', hash_('fertiagro2026'),
    'ADMIN', 'NO', 'SI', 'NO', 'SI', 'SI', 'SI']]);
  sh.setColumnWidth(1, 240); sh.setColumnWidth(3, 120);
  sh.setFrozenRows(1);
  sh.getRange(1, 3, sh.getMaxRows(), 1).setFontColor('#BBBBBB').setFontSize(7);
  return 'Hoja USUARIOS creada. Usuario: angie / Clave: fertiagro2026';
}

function usuarios_() {
  var sh = ss_().getSheetByName(HOJA_USU);
  if (!sh) throw new Error('Falta la hoja USUARIOS. Pida a contabilidad que ejecute la instalacion.');
  var n = sh.getLastRow();
  if (n < 2) return [];
  var v = sh.getRange(2, 1, n - 1, 10).getValues();
  var out = [];
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][1]).trim() === '') continue;
    out.push({
      fila: i + 2,
      nombre: String(v[i][0]).trim(),
      usuario: String(v[i][1]).trim().toLowerCase(),
      hash: String(v[i][2]).trim(),
      rol: String(v[i][3]).trim().toUpperCase() || 'CAJERO',
      caja: String(v[i][4]).trim().toUpperCase() === 'SI',
      arqueo: String(v[i][5]).trim().toUpperCase() === 'SI',
      consigna: String(v[i][6]).trim().toUpperCase() === 'SI',
      autoriza: String(v[i][7]).trim().toUpperCase() === 'SI',
      activo: String(v[i][8]).trim().toUpperCase() !== 'NO',
      banco: String(v[i][9]).trim().toUpperCase() === 'SI'
    });
  }
  return out;
}

function publico_(u) {
  return { nombre: u.nombre, usuario: u.usuario, rol: u.rol, caja: u.caja,
           arqueo: u.arqueo, consigna: u.consigna, autoriza: u.autoriza,
           banco: u.banco, activo: u.activo };
}

function login(usuario, clave) {
  try {
    var us = usuarios_();
    var u = null;
    for (var i = 0; i < us.length; i++) {
      if (us[i].usuario === String(usuario).trim().toLowerCase()) { u = us[i]; break; }
    }
    if (!u) return { ok: false, error: 'Ese usuario no existe.' };
    if (!u.activo) return { ok: false, error: 'Ese usuario esta inactivo. Hable con contabilidad.' };
    if (u.hash !== hash_(clave)) return { ok: false, error: 'La contrasena no es correcta.' };
    var tk = Utilities.getUuid();
    CacheService.getScriptCache().put('s_' + tk, JSON.stringify(publico_(u)), 21600);
    return { ok: true, token: tk, yo: publico_(u) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function ses_(tk) {
  var j = CacheService.getScriptCache().get('s_' + tk);
  if (!j) throw new Error('La sesion se vencio. Vuelva a entrar.');
  return JSON.parse(j);
}

function salir(tk) {
  try { CacheService.getScriptCache().remove('s_' + tk); } catch (e) {}
  return { ok: true };
}

function listarUsuarios(tk) {
  try {
    var yo = ses_(tk);
    if (yo.rol !== 'ADMIN') return { ok: false, error: 'Solo contabilidad puede ver esta parte.' };
    return { ok: true, lista: usuarios_().map(publico_) };
  } catch (err) { return { ok: false, error: String(err) }; }
}

function guardarUsuario(tk, d) {
  try {
    var yo = ses_(tk);
    if (yo.rol !== 'ADMIN') return { ok: false, error: 'Solo contabilidad puede crear o cambiar usuarios.' };
    var sh = ss_().getSheetByName(HOJA_USU);
    var us = usuarios_();
    var user = String(d.usuario || '').trim().toLowerCase();
    if (!user) return { ok: false, error: 'Falta el usuario.' };
    if (!String(d.nombre || '').trim()) return { ok: false, error: 'Falta el nombre completo.' };
    var fila = 0, viejo = null;
    for (var i = 0; i < us.length; i++) if (us[i].usuario === user) { fila = us[i].fila; viejo = us[i]; }
    if (!fila) {
      if (!d.clave) return { ok: false, error: 'Falta la contrasena para el usuario nuevo.' };
      fila = sh.getLastRow() + 1;
    }
    var h = d.clave ? hash_(d.clave) : (viejo ? viejo.hash : '');
    sh.getRange(fila, 1, 1, 10).setValues([[String(d.nombre).trim().toUpperCase(), user, h,
      (d.rol || 'CAJERO').toUpperCase(), d.caja ? 'SI' : 'NO', d.arqueo ? 'SI' : 'NO',
      d.consigna ? 'SI' : 'NO', d.autoriza ? 'SI' : 'NO', d.activo === false ? 'NO' : 'SI',
      d.banco ? 'SI' : 'NO']]);
    sh.getRange(fila, 3).setFontColor('#BBBBBB').setFontSize(7);
    SpreadsheetApp.flush();
    sincronizarParam_();
    return { ok: true, lista: usuarios_().map(publico_) };
  } catch (err) { return { ok: false, error: String(err) }; }
}

function sincronizarParam_() {
  try {
    var sh = ss_().getSheetByName(HOJA_PAR);
    var v = sh.getRange('A1:AA60').getDisplayValues();
    var fr = -1, fc = -1;
    for (var r = 0; r < v.length && fr < 0; r++) {
      for (var c = 0; c < v[r].length; c++) {
        if (String(v[r][c]).trim().toUpperCase() === 'NOMBRE COMPLETO') { fr = r + 1; fc = c + 1; break; }
      }
    }
    if (fr < 0) return;
    var us = usuarios_().filter(function (u) { return u.activo; });
    sh.getRange(fr + 1, fc, 30, 8).clearContent();
    if (!us.length) return;
    var filas = us.map(function (u) {
      return [u.nombre, '', u.rol, u.caja ? 'SI' : 'NO', u.arqueo ? 'SI' : 'NO',
              u.consigna ? 'SI' : 'NO', u.autoriza ? 'SI' : 'NO', 'SI'];
    });
    sh.getRange(fr + 1, fc, filas.length, 8).setValues(filas);
  } catch (e) {}
}

/* ===================== LISTAS ===================== */

function listaPorEncabezado_(v, titulo) {
  titulo = titulo.trim().toUpperCase();
  for (var r = 0; r < v.length; r++) {
    for (var c = 0; c < v[r].length; c++) {
      if (String(v[r][c]).trim().toUpperCase() === titulo) {
        var out = [];
        for (var k = r + 1; k < v.length; k++) {
          var x = String(v[k][c]).trim();
          if (x === '') { if (out.length) break; else continue; }
          out.push(x);
        }
        return out;
      }
    }
  }
  return [];
}

function celdaDerecha_(v, titulo) {
  titulo = titulo.trim().toUpperCase();
  for (var r = 0; r < v.length; r++) {
    for (var c = 0; c < v[r].length - 1; c++) {
      if (String(v[r][c]).trim().toUpperCase() === titulo) return v[r][c + 1];
    }
  }
  return '';
}

function getDatos(tk) {
  try {
    var yo = ses_(tk);
    var v = ss_().getSheetByName(HOJA_PAR).getRange('A1:AA60').getDisplayValues();
    var num = function (x) { return Number(String(x).replace(/[^0-9.-]/g, '')) || 0; };
    return {
      ok: true, yo: yo,
      tipos: listaPorEncabezado_(v, 'TIPO DE MOVIMIENTO'),
      medios: listaPorEncabezado_(v, 'MEDIO DE PAGO'),
      categorias: listaPorEncabezado_(v, 'CATEGORIA').concat(listaPorEncabezado_(v, 'CATEGORÍA')),
      bancos: listaPorEncabezado_(v, 'BANCO'),
      clientes: listaPorEncabezado_(v, 'CLIENTE'),
      gente: usuarios_().filter(function (u) { return u.activo; }).map(publico_),
      uvt100: (uvtDelAno_(new Date().getFullYear()) * 100) || num(celdaDerecha_(v, '100 UVT')),
      hoy: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd')
    };
  } catch (err) { return { ok: false, error: String(err) }; }
}

/* ===================== ESCRITURA ===================== */

function primeraFilaLibre_(sh, col) {
  var n = sh.getMaxRows();
  var v = sh.getRange(FILA_INI, col, n - FILA_INI + 1, 1).getValues();
  for (var i = 0; i < v.length; i++) if (String(v[i][0]).trim() === '') return FILA_INI + i;
  return FILA_INI + v.length;
}

function guardarFoto_(b64, nombre) {
  if (!b64) return '';
  var it = DriveApp.getFoldersByName(CARPETA_SOPORTES);
  var f = it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA_SOPORTES);
  var p = b64.indexOf(',');
  var tipo = b64.substring(5, b64.indexOf(';'));
  var blob = Utilities.newBlob(Utilities.base64Decode(b64.substring(p + 1)), tipo, nombre);
  var file = f.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function registrarMovimiento(tk, d) {
  var lock = LockService.getScriptLock();
  try {
    var yo = ses_(tk);
    if (d.tipo === 'EGRESO' && !yo.caja && !yo.autoriza) return { ok: false, error: 'Su usuario no tiene permiso para registrar salidas.' };
    lock.waitLock(30000);
    var sh = ss_().getSheetByName(HOJA_MOV);
    var f = primeraFilaLibre_(sh, 2);
    var url = '';
    if (d.foto) url = guardarFoto_(d.foto, 'soporte_' + d.fecha + '_' + new Date().getTime() + '.jpg');
    var sello = 'Registro: ' + yo.nombre + ' (' + yo.usuario + ') ' +
                Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm');
    var obs = [d.observaciones || '', sello, url].filter(String).join('  |  ');

    sh.getRange(f, 2).setValue(new Date(d.fecha + 'T12:00:00'));
    sh.getRange(f, 5, 1, 2).setValues([[d.tipo, d.medio]]);
    sh.getRange(f, 8, 1, 6).setValues([[d.documento || '', d.tercero || '', d.identificacion || '',
                                        d.concepto || '', d.categoria || '', Number(d.valor) || 0]]);
    sh.getRange(f, 17, 1, 6).setValues([[yo.nombre, d.requiereDS || '', d.numeroDS || '',
                                         d.llegoBanco || '', 'VIGENTE', d.anulaId || '']]);
    sh.getRange(f, 24).setValue(obs);
    SpreadsheetApp.flush();
    return { ok: true, fila: f };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function registrarCierre(tk, d) {
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

function movimientos(tk, desde, hasta) {
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

/* ===================== DESCARGAS ===================== */

var CARPETA_DESC = 'DESCARGAS CAJA FERTIAGRO';

function carpetaDesc_() {
  var it = DriveApp.getFoldersByName(CARPETA_DESC);
  var f = it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA_DESC);
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

function exportar(tk, desde, hasta, formato, etiqueta) {
  try {
    ses_(tk);
    var r = movimientos(tk, desde, hasta);
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

function exportarArqueo(tk, fecha) {
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

function analitica(tk, desde, hasta) {
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

function registrosPersona(tk, desde, hasta, nombre) {
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

/* ===================== PAGOS DESDE EL BANCO ===================== */

var HOJA_PAG = 'PAGOS BANCO';
var HOJA_TAR = 'TARIFAS RETENCION';

function instalarPagos() {
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

function datosPago(tk) {
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

function simularPago(tk, d) {
  try {
    ses_(tk);
    var ano = Number(String(d.fecha || '').substring(0, 4)) || new Date().getFullYear();
    return { ok: true, r: calcularPago_(d, tarifas_(), uvtDelAno_(ano)) };
  } catch (err) { return { ok: false, error: String(err) }; }
}

function registrarPagoBanco(tk, d) {
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

function pagosBanco(tk, desde, hasta) {
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

/* Actualiza la tabla a las bases vigentes desde el 1-jul-2026 (Decreto 572 de 2025
   nuevamente vigente tras revocarse la suspension provisional) y la UVT 2026. */
function actualizarTarifas2026() {
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

function anularMovimiento(tk, fila, motivo) {
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

function anularPagoBanco(tk, fila, motivo) {
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


function exportarBanco(tk, desde, hasta) {
  try {
    var yo = ses_(tk);
    var r = pagosBanco(tk, desde, hasta);
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


function arreglarFechaBanco() {
  var sh = ss_().getSheetByName(HOJA_PAG);
  sh.getRange('B2:B2000').setNumberFormat('dd/MM/yyyy');
  sh.getRange('U2:U2000').setNumberFormat('dd/MM/yyyy HH:mm');
  return 'Fechas de PAGOS BANCO en formato colombiano';
}
