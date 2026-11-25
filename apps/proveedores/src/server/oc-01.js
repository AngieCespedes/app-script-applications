/* ---------- utilidades ---------- */

function ocLibro_()      { return Aislamiento_.abrirLibro(OC_SS); }

function ocHoja_(nombre) { return ocLibro_().getSheetByName(nombre); }

/* Ultima fila con contenido en la columna A.
   getLastRow() miente cuando hay formulas regadas por la hoja. */
function ocUltimaFila_(hoja) {
  var col = hoja.getRange(1, 1, hoja.getMaxRows(), 1).getValues();
  for (var i = col.length - 1; i >= 0; i--) {
    if (String(col[i][0]).trim() !== '') return i + 1;
  }
  return 1;
}

function ocFilaNueva_(hoja) {
  var ult = ocUltimaFila_(hoja);
  var fila = ult + 1;
  if (fila > hoja.getMaxRows()) hoja.insertRowsAfter(hoja.getMaxRows(), 50);
  return fila;
}

/* NIT sin puntos, sin guiones y sin digito de verificacion */
function ocNit_(v) {
  var s = String(v || '').replace(/\D/g, '');
  if (s.length === 10 && (s.charAt(0) === '8' || s.charAt(0) === '9')) s = s.substring(0, 9);
  return s;
}

/* Convierte a numero. Si ya viene como numero (por ejemplo una tarifa
   0,025 leida de la hoja) se devuelve tal cual: solo se interpreta el
   formato colombiano 1.234.567,89 cuando llega como texto. */
function ocNum_(v) {
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;

  var s = String(v).trim().replace(/[^0-9,.\-]/g, '');
  if (s === '') return 0;

  if (s.indexOf(',') >= 0) {
    s = s.replace(/\./g, '').replace(/,/g, '.');
  } else {
    var p = s.split('.');
    if (p.length > 2) s = p.join('');
    else if (p.length === 2 && p[1].length === 3) s = p.join('');
  }

  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function ocPesos_(n) {
  return '$' + Math.round(ocNum_(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function ocFecha_(d) {
  if (!d) return '';
  if (Object.prototype.toString.call(d) !== '[object Date]') return String(d);
  return Utilities.formatDate(d, 'America/Bogota', 'dd/MM/yyyy');
}

function ocIgual_(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

/* ---------- entrada al portal ---------- */

function ocFilasUsuarios_() {
  var hoja = ocHoja_(OC_H_USU);
  var ult  = ocUltimaFila_(hoja);
  if (ult < 2) return { hoja: hoja, datos: [] };
  return { hoja: hoja, datos: hoja.getRange(2, 1, ult - 1, OC_USU_ANCHO).getValues() };
}

/* ses viene del navegador: usuario + separador + contrasena.
   Se vuelve a validar en cada llamada; no hay sesiones guardadas. */
function ocUsuario_(ses) {
  var p = String(ses || '').split(OC_SEP);
  var usu = String(p[0] || '').trim();
  var pwd = String(p[1] === undefined ? '' : p[1]);
  if (usu === '') return null;

  var t = ocFilasUsuarios_();
  for (var i = 0; i < t.datos.length; i++) {
    var f = t.datos[i];
    if (!ocIgual_(f[1], usu)) continue;
    if (String(f[5]).trim().toUpperCase() !== 'ACTIVO') return null;
    if (!ClavesOC_.verificar(f[2], pwd, usu, i + 2)) return null;

    var rol = String(f[3]).trim().toUpperCase();
    return {
      fila:     i + 2,
      nombre:   String(f[0]),
      usuario:  String(f[1]).trim(),
      rol:      rol,
      area:     String(f[4]).trim(),
      celular:  String(f[8]).replace(/\D/g, ''),
      cedula:   String(f[OC_USU_CED - 1] || '').replace(/\D/g, ''),
      permisos: ocPermisosDe_(f, rol)
    };
  }
  return null;
}

/**
 * Que puede hacer una persona.
 * Acepta la persona (lo normal) o un rol suelto.
 * Manda lo que la duena marco en la hoja 07; el rol solo es la plantilla
 * con la que se llenan las casillas la primera vez.
 */
function ocPuede_(quien, accion) {
  if (quien && typeof quien === 'object') {
    if (quien.permisos) return quien.permisos.indexOf(accion) >= 0;
    quien = quien.rol;
  }
  var lista = OC_PERMISOS[String(quien || '').trim().toUpperCase()] || [];
  return lista.indexOf(accion) >= 0;
}

/** Lee las casillas de la fila. Si no hay ninguna marcada, usa la plantilla del rol. */
function ocPermisosDe_(fila, rol) {
  var marcados = [];
  var hayColumnas = false;
  for (var i = 0; i < OC_PERMISOS_LISTA.length; i++) {
    var v = fila[OC_USU_PERM + i - 1];
    if (v !== '' && v !== null && v !== undefined) hayColumnas = true;
    if (ocSi_(v)) marcados.push(OC_PERMISOS_LISTA[i][0]);
  }
  if (!hayColumnas) return (OC_PERMISOS[String(rol || '').toUpperCase()] || []).slice();
  return marcados;
}

function ocSi_(v) {
  var s = String(v === null || v === undefined ? '' : v).trim().toUpperCase();
  return s === 'SI' || s === 'SÍ' || s === 'X' || s === 'TRUE' || s === 'VERDADERO' || s === '1';
}

function ocContextoDe_(u) {
  return {
    ok: true,
    nombre: u.nombre,
    usuario: u.usuario,
    rol: u.rol,
    area: u.area,
    puede: {
      solicitar:    ocPuede_(u, 'solicitar'),
      aprobar:      ocPuede_(u, 'aprobar'),
      pagar:        ocPuede_(u, 'pagar'),
      facturar:     ocPuede_(u, 'facturar'),
      causar:       ocPuede_(u, 'causar'),
      almacen:      ocPuede_(u, 'almacen'),
      proveedores:  ocPuede_(u, 'proveedores'),
      verproveedor: ocPuede_(u, 'verproveedor'),
      verpagos:     ocPuede_(u, 'verpagos'),
      verequipo:    ocPuede_(u, 'verequipo'),
      informes:     ocPuede_(u, 'informes'),
      vertodo:      ocPuede_(u, 'vertodo'),
      usuarios:     ocPuede_(u, 'usuarios')
    },
    videos: ocVideosDe_(u)
  };
}

function ocEntrar_(usuario, contrasena) {
  var ses = String(usuario || '').trim() + OC_SEP + String(contrasena === undefined ? '' : contrasena);
  var u = ocUsuario_(ses);
  if (!u) {
    return { ok: false, mensaje: 'Usuario o contrasena incorrectos. Si no se acuerda, pidale a Angie Cespedes que se la cambie.' };
  }
  var ctx = ocContextoDe_(u);
  ctx.ses = ses;
  return ctx;
}

function ocContexto_(ses) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false, mensaje: 'Su sesion se cerro. Vuelva a entrar.' };
  return ocContextoDe_(u);
}

function ocCambiarMiContrasena_(ses, actual, nueva) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false, mensaje: 'Vuelva a entrar.' };
  if (String(nueva || '').length < 6) return { ok: false, mensaje: 'La contrasena nueva debe tener al menos 6 caracteres.' };

  var hoja = ocHoja_(OC_H_USU);
  if (!ClavesOC_.verificar(hoja.getRange(u.fila, 3).getValue(), String(actual), u.usuario, u.fila)) {
    return { ok: false, mensaje: 'La contrasena actual no coincide.' };
  }
  hoja.getRange(u.fila, 3).setValue(ClavesOC_.cifrar(String(nueva)));
  return { ok: true, ses: u.usuario + OC_SEP + String(nueva) };
}

/* ---------- administracion de usuarios ---------- */

function ocUsuarios_(ses) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u, 'usuarios')) return { ok: false, mensaje: 'No tiene permiso.' };

  var t = ocFilasUsuarios_();
  var filas = [];
  for (var i = 0; i < t.datos.length; i++) {
    var f = t.datos[i];
    if (String(f[1]).trim() === '') continue;
    filas.push({
      nombre: String(f[0]),
      usuario: String(f[1]).trim(),
      contrasena: '', // ya no se muestra: se guarda cifrada
      rol: String(f[3]).trim().toUpperCase(),
      area: String(f[4]).trim(),
      estado: String(f[5]).trim().toUpperCase(),
      ordenes: ocNum_(f[6]),
      celular: String(f[8]),
      cedula: String(f[OC_USU_CED - 1] || '').replace(/\D/g, ''),
      permisos: ocPermisosDe_(f, String(f[3]).trim().toUpperCase()),
      clave: ocEstadoClave_(f[2]),
      fila: i + 2
    });
  }
  return { ok: true, filas: filas, roles: Object.keys(OC_PERMISOS),
           permisos: OC_PERMISOS_LISTA, plantillas: OC_PERMISOS,
           areas: ['Ingenieria', 'Administracion', 'Sistema de gestion', 'Comercial', 'Compras', 'Tesoreria', 'Contabilidad', 'Gerencia'] };
}

/** No devuelve la clave: solo si esta cifrada, en texto plano o sin poner. */
function ocEstadoClave_(v) {
  var s = String(v === null || v === undefined ? '' : v);
  if (s.trim() === '') return 'SIN ASIGNAR';
  return s.indexOf('sha256$') === 0 ? 'CIFRADA' : 'SIN CIFRAR';
}

/**
 * Genera una contrasena, la guarda cifrada y la devuelve UNA sola vez
 * para que la duena se la pase a la persona. Despues ya no se puede ver.
 */
function ocNuevaClave_(ses, usuario) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u, 'usuarios')) return { ok: false, mensaje: 'No tiene permiso.' };

  var busca = String(usuario || '').trim().toLowerCase();
  var t = ocFilasUsuarios_();
  var fila = 0;
  for (var i = 0; i < t.datos.length; i++) {
    if (ocIgual_(t.datos[i][1], busca)) { fila = i + 2; break; }
  }
  if (!fila) return { ok: false, mensaje: 'No encontre ese usuario.' };

  var clave = ocClaveAlAzar_();
  t.hoja.getRange(fila, 3).setValue(ClavesOC_.cifrar(clave));
  SpreadsheetApp.flush();

  return { ok: true, usuario: busca, clave: clave,
           mensaje: 'Anotela y mandesela a la persona. No se vuelve a ver.' };
}

/* Sin letras ni numeros que se confundan al dictarla: ni O ni 0, ni I ni 1. */
function ocClaveAlAzar_() {
  var letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  var numeros = '23456789';
  var s = '';
  for (var i = 0; i < 4; i++) s += letras.charAt(Math.floor(Math.random() * letras.length));
  s += '-';
  for (var j = 0; j < 4; j++) s += numeros.charAt(Math.floor(Math.random() * numeros.length));
  return s;
}

/** Guarda la fila de permisos de una persona (las casillas de la pantalla). */
function ocGuardarPermisos_(ses, usuario, permisos) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u, 'usuarios')) return { ok: false, mensaje: 'No tiene permiso.' };

  var busca = String(usuario || '').trim().toLowerCase();
  var t = ocFilasUsuarios_();
  var fila = 0;
  for (var i = 0; i < t.datos.length; i++) {
    if (ocIgual_(t.datos[i][1], busca)) { fila = i + 2; break; }
  }
  if (!fila) return { ok: false, mensaje: 'No encontre ese usuario.' };

  var marcados = permisos || [];
  /* Nadie se puede quitar a si mismo la administracion: si no, el libro
     queda sin quien administre y toca entrar a la hoja a arreglarlo. */
  if (ocIgual_(busca, u.usuario) && marcados.indexOf('usuarios') < 0) {
    return { ok: false, mensaje: 'No puede quitarse a usted misma el permiso de administrar usuarios.' };
  }

  var valores = OC_PERMISOS_LISTA.map(function (p) {
    return marcados.indexOf(p[0]) >= 0 ? 'SI' : 'NO';
  });
  t.hoja.getRange(fila, OC_USU_PERM, 1, valores.length).setValues([valores]);
  SpreadsheetApp.flush();
  return { ok: true, mensaje: 'Permisos guardados.' };
}

function ocGuardarUsuario_(ses, d) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u, 'usuarios')) return { ok: false, mensaje: 'No tiene permiso.' };

  var usu = String(d.usuario || '').trim().toLowerCase().replace(/\s+/g, '');
  var nom = String(d.nombre || '').trim();
  if (usu === '') return { ok: false, mensaje: 'Escriba el usuario.' };
  if (nom === '') return { ok: false, mensaje: 'Escriba el nombre de la persona.' };
  if (!OC_PERMISOS[String(d.rol || '').toUpperCase()]) return { ok: false, mensaje: 'Escoja un rol valido.' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return { ok: false, mensaje: 'El sistema esta ocupado.' }; }

  try {
    var t = ocFilasUsuarios_();
    var hoja = t.hoja;
    var ant = String(d.usuarioOriginal || '').trim().toLowerCase().replace(/\s+/g, '');
    var busca = (ant !== '') ? ant : usu;
    var fila = 0;
    for (var i = 0; i < t.datos.length; i++) {
      if (ocIgual_(t.datos[i][1], busca)) { fila = i + 2; break; }
    }
    var renombra = (ant !== '' && fila !== 0 && !ocIgual_(ant, usu));
    if (renombra) {
      for (var j = 0; j < t.datos.length; j++) {
        if (ocIgual_(t.datos[j][1], usu)) {
          return { ok: false, mensaje: 'Ese usuario ya lo tiene otra persona. Escoja otro.' };
        }
      }
    }

    var nuevo = (fila === 0);
    if (nuevo) {
      if (String(d.contrasena || '').length < 6) {
        return { ok: false, mensaje: 'La contrasena debe tener al menos 6 caracteres.' };
      }
      fila = ocFilaNueva_(hoja);
      hoja.getRange(fila, 8).setValue(new Date());
    }

    hoja.getRange(fila, 1).setValue(nom);
    hoja.getRange(fila, 2).setValue(usu);
    if (renombra) ocRenombrarEnOrdenes_(ant, usu);
    if (String(d.contrasena || '') !== '') {
      if (String(d.contrasena).length < 6) return { ok: false, mensaje: 'La contrasena debe tener al menos 6 caracteres.' };
      hoja.getRange(fila, 3).setValue(ClavesOC_.cifrar(String(d.contrasena)));
    }
    hoja.getRange(fila, 4).setValue(String(d.rol).toUpperCase());
    hoja.getRange(fila, 5).setValue(String(d.area || ''));
    hoja.getRange(fila, 6).setValue(String(d.estado || 'ACTIVO').toUpperCase());
    hoja.getRange(fila, 9).setValue(String(d.celular || '').replace(/\D/g, ''));
    if (d.observaciones !== undefined) hoja.getRange(fila, 10).setValue(String(d.observaciones));
    if (d.cedula !== undefined) hoja.getRange(fila, OC_USU_CED).setValue(String(d.cedula).replace(/\D/g, ''));
    /* Una persona nueva arranca con las casillas de su rol; de ahi en
       adelante manda lo que la duena marque en la pantalla. */
    if (nuevo) {
      var base = (OC_PERMISOS[String(d.rol).toUpperCase()] || []);
      var v = OC_PERMISOS_LISTA.map(function (p) { return base.indexOf(p[0]) >= 0 ? 'SI' : 'NO'; });
      hoja.getRange(fila, OC_USU_PERM, 1, v.length).setValues([v]);
    }
    SpreadsheetApp.flush();

    return { ok: true, nuevo: nuevo, usuario: usu };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- listas ---------- */

function ocListas_(ses) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false };

  var hc = ocHoja_(OC_H_CEN);
  var uc = ocUltimaFila_(hc);
  var centros = [];
  if (uc >= 2) {
    var dc = hc.getRange(2, 1, uc - 1, 5).getValues();
    for (var i = 0; i < dc.length; i++) {
      if (String(dc[i][0]).trim() === '') continue;
      if (String(dc[i][4]).trim().toUpperCase() === 'CERRADO') continue;
      centros.push({ codigo: String(dc[i][0]), nombre: String(dc[i][1]) });
    }
  }

  var hk = ocHoja_(OC_H_CON);
  var conceptos = [];
  var dk = hk.getRange(3, 1, 58, 1).getValues();
  for (var j = 0; j < dk.length; j++) {
    if (String(dk[j][0]).trim() !== '') conceptos.push(String(dk[j][0]));
  }

  return {
    ok: true,
    centros: centros,
    conceptos: conceptos,
    areas: ['Ingenieria', 'Administracion', 'Sistema de gestion', 'Comercial', 'Compras', 'Tesoreria', 'Contabilidad', 'Gerencia']
  };
}

