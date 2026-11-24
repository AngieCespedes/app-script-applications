function doGet(e) {
  var t = HtmlService.createTemplateFromFile('App');
  t.ver = (e && e.parameter && e.parameter.ver) || '';
  return t.evaluate()
    .setTitle('Caja Fertiagro')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

function ss_() { return Aislamiento_.abrirLibro(SS_ID); }

/* ===================== USUARIOS ===================== */

function hash_(clave) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(clave) + SAL);
  return b.map(function (x) { return ((x & 0xFF) + 0x100).toString(16).slice(1); }).join('');
}

function instalar_() {
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

function login_(usuario, clave) {
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

function salir_(tk) {
  try { CacheService.getScriptCache().remove('s_' + tk); } catch (e) {}
  return { ok: true };
}

function listarUsuarios_(tk) {
  try {
    var yo = ses_(tk);
    if (yo.rol !== 'ADMIN') return { ok: false, error: 'Solo contabilidad puede ver esta parte.' };
    return { ok: true, lista: usuarios_().map(publico_) };
  } catch (err) { return { ok: false, error: String(err) }; }
}

function guardarUsuario_(tk, d) {
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

function getDatos_(tk) {
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
  var f = Aislamiento_.carpeta(Config_.id('CARPETA_SOPORTES_ID'));
  var p = b64.indexOf(',');
  var tipo = b64.substring(5, b64.indexOf(';'));
  var blob = Utilities.newBlob(Utilities.base64Decode(b64.substring(p + 1)), tipo, nombre);
  var file = f.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function registrarMovimiento_(tk, d) {
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

