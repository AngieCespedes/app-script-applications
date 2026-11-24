/*************************************************************
 * SOCIAL SOLAR S.A.S. — PORTAL DE ORDENES DE COMPRA
 * Hojas: 07 USUARIOS Y ROLES / 08 CENTROS DE COSTO
 *        09 CONCEPTOS Y RETENCIONES / 10 ORDENES DE COMPRA
 *        11 PAGOS Y SOPORTES / 12 TABLERO DE CONTROL
 *
 * Entrada al portal: usuario y contrasena de la hoja 07.
 * Quien administra usuarios y contrasenas es el rol ADMINISTRADOR.
 *************************************************************/

var OC_SS        = '1vzbtgF0vUZsIDL6n3c-mjjHnQQE55C41YQ7_XSm7kd4';
var OC_H_USU     = '07 USUARIOS Y ROLES';
var OC_H_CEN     = '08 CENTROS DE COSTO';
var OC_H_CON     = '09 CONCEPTOS Y RETENCIONES';
var OC_H_ORD     = '10 ORDENES DE COMPRA';
var OC_H_PAG     = '11 PAGOS Y SOPORTES';
var OC_H_PROV    = '02 MAESTRO PROVEEDORES 2026';
var OC_RAIZ      = '1WKnC49pfy6rDqBzR0CQLf6paT7rNe9GZ';
var OC_CARPETA   = 'ORDENES DE COMPRA';
var OC_SEP       = '\u0001';

/* Que puede hacer cada rol.
   vertodo  = ve todas las ordenes de la empresa
   verarea  = ve solo las ordenes de su propia area */
var OC_PERMISOS = {
  'ADMINISTRADOR': ['solicitar', 'aprobar', 'pagar', 'facturar', 'causar', 'vertodo', 'usuarios'],
  'GERENCIA':      ['aprobar', 'vertodo'],
  'TESORERIA':     ['pagar', 'vertodo'],
  'COMPRAS':       ['solicitar', 'facturar', 'vertodo'],
  'CONTABILIDAD':  ['causar', 'vertodo'],
  'SOLICITANTE':   ['solicitar', 'verarea']
};

/* ---------- utilidades ---------- */

function ocLibro_()      { return SpreadsheetApp.openById(OC_SS); }
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
  return { hoja: hoja, datos: hoja.getRange(2, 1, ult - 1, 10).getValues() };
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
    if (String(f[2]) !== pwd) return null;

    return {
      fila:    i + 2,
      nombre:  String(f[0]),
      usuario: String(f[1]).trim(),
      rol:     String(f[3]).trim().toUpperCase(),
      area:    String(f[4]).trim(),
      celular: String(f[8]).replace(/\D/g, '')
    };
  }
  return null;
}

function ocPuede_(rol, accion) {
  var lista = OC_PERMISOS[rol] || [];
  return lista.indexOf(accion) >= 0;
}

function ocContextoDe_(u) {
  return {
    ok: true,
    nombre: u.nombre,
    usuario: u.usuario,
    rol: u.rol,
    area: u.area,
    puede: {
      solicitar: ocPuede_(u.rol, 'solicitar'),
      aprobar:   ocPuede_(u.rol, 'aprobar'),
      pagar:     ocPuede_(u.rol, 'pagar'),
      facturar:  ocPuede_(u.rol, 'facturar'),
      causar:    ocPuede_(u.rol, 'causar'),
      vertodo:   ocPuede_(u.rol, 'vertodo'),
      usuarios:  ocPuede_(u.rol, 'usuarios')
    }
  };
}

function ocEntrar(usuario, contrasena) {
  var ses = String(usuario || '').trim() + OC_SEP + String(contrasena === undefined ? '' : contrasena);
  var u = ocUsuario_(ses);
  if (!u) {
    return { ok: false, mensaje: 'Usuario o contrasena incorrectos. Si no se acuerda, pidale a Angie Cespedes que se la cambie.' };
  }
  var ctx = ocContextoDe_(u);
  ctx.ses = ses;
  return ctx;
}

function ocContexto(ses) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false, mensaje: 'Su sesion se cerro. Vuelva a entrar.' };
  return ocContextoDe_(u);
}

function ocCambiarMiContrasena(ses, actual, nueva) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false, mensaje: 'Vuelva a entrar.' };
  if (String(nueva || '').length < 6) return { ok: false, mensaje: 'La contrasena nueva debe tener al menos 6 caracteres.' };

  var hoja = ocHoja_(OC_H_USU);
  if (String(hoja.getRange(u.fila, 3).getValue()) !== String(actual)) {
    return { ok: false, mensaje: 'La contrasena actual no coincide.' };
  }
  hoja.getRange(u.fila, 3).setValue(String(nueva));
  return { ok: true, ses: u.usuario + OC_SEP + String(nueva) };
}

/* ---------- administracion de usuarios ---------- */

function ocUsuarios(ses) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u.rol, 'usuarios')) return { ok: false, mensaje: 'No tiene permiso.' };

  var t = ocFilasUsuarios_();
  var filas = [];
  for (var i = 0; i < t.datos.length; i++) {
    var f = t.datos[i];
    if (String(f[1]).trim() === '') continue;
    filas.push({
      nombre: String(f[0]),
      usuario: String(f[1]).trim(),
      contrasena: String(f[2]),
      rol: String(f[3]).trim().toUpperCase(),
      area: String(f[4]).trim(),
      estado: String(f[5]).trim().toUpperCase(),
      ordenes: ocNum_(f[6]),
      celular: String(f[8]),
      fila: i + 2
    });
  }
  return { ok: true, filas: filas, roles: Object.keys(OC_PERMISOS),
           areas: ['Ingenieria', 'Administracion', 'Sistema de gestion', 'Comercial', 'Compras', 'Tesoreria', 'Contabilidad', 'Gerencia'] };
}

function ocGuardarUsuario(ses, d) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u.rol, 'usuarios')) return { ok: false, mensaje: 'No tiene permiso.' };

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
      hoja.getRange(fila, 3).setValue(String(d.contrasena));
    }
    hoja.getRange(fila, 4).setValue(String(d.rol).toUpperCase());
    hoja.getRange(fila, 5).setValue(String(d.area || ''));
    hoja.getRange(fila, 6).setValue(String(d.estado || 'ACTIVO').toUpperCase());
    hoja.getRange(fila, 9).setValue(String(d.celular || '').replace(/\D/g, ''));
    if (d.observaciones !== undefined) hoja.getRange(fila, 10).setValue(String(d.observaciones));
    SpreadsheetApp.flush();

    return { ok: true, nuevo: nuevo, usuario: usu };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- listas ---------- */

function ocListas(ses) {
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

/* Crea un centro de costo desde la misma orden, cuando el proyecto
   todavia no esta en la lista. Entra como POR VALIDAR para que Angie
   lo confirme despues; la orden no se frena por eso. */
function ocCrearCentro(ses, codigo, nombre) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false };

  var cod = String(codigo || '').trim().toUpperCase().replace(/\s+/g, ' ');
  var nom = String(nombre || '').trim();
  if (cod === '') return { ok: false, mensaje: 'Escriba el codigo del centro de costo.' };
  if (nom === '') return { ok: false, mensaje: 'Escriba el nombre del proyecto.' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return { ok: false, mensaje: 'El sistema esta ocupado.' }; }

  try {
    var hoja = ocHoja_(OC_H_CEN);
    var ult = ocUltimaFila_(hoja);
    if (ult >= 2) {
      var col = hoja.getRange(2, 1, ult - 1, 2).getValues();
      for (var i = 0; i < col.length; i++) {
        if (String(col[i][0]).trim().toUpperCase() === cod) {
          return { ok: false, mensaje: 'Ese codigo ya existe: ' + col[i][0] + ' - ' + col[i][1] + '. Escojalo de la lista.' };
        }
      }
    }

    var fila = ocFilaNueva_(hoja);
    hoja.getRange(fila, 1).setValue(cod);
    hoja.getRange(fila, 2).setValue(nom);
    hoja.getRange(fila, 4).setValue('PROYECTO');
    hoja.getRange(fila, 5).setValue('POR VALIDAR');
    SpreadsheetApp.flush();

    return { ok: true, codigo: cod, nombre: nom };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- proveedor ---------- */

function ocBuscarProveedor(ses, nit) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false };

  var n = ocNit_(nit);
  if (n === '') return { ok: false, mensaje: 'Escriba el NIT' };

  var hoja = ocHoja_(OC_H_PROV);
  var ult  = ocUltimaFila_(hoja);
  var datos = hoja.getRange(2, 1, ult - 1, 9).getValues();

  for (var i = 0; i < datos.length; i++) {
    if (ocNit_(datos[i][0]) !== n) continue;
    var estadoRut = String(datos[i][7]).trim();
    return {
      ok: true, encontrado: true, nit: n,
      nombre: String(datos[i][1]),
      tipoDoc: String(datos[i][2]).trim(),
      estadoRut: estadoRut,
      pendiente: String(datos[i][8]).trim(),
      vigente: (estadoRut.toUpperCase().indexOf('OK') >= 0)
    };
  }
  return { ok: true, encontrado: false, nit: n,
           mensaje: 'Ese NIT no esta en la base de proveedores. Hay que registrarlo primero con el link de proveedores.' };
}

/* ---------- retenciones ---------- */

function ocRetenciones(ses, concepto, base, iva, declarante, tarifaIca) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false };

  var b = ocNum_(base), v = ocNum_(iva);
  var hoja = ocHoja_(OC_H_CON);
  var uvt  = ocNum_(hoja.getRange(1, 2).getValue());
  var datos = hoja.getRange(3, 1, 58, 8).getValues();

  var rf = 0, ri = 0, rc = 0, nota = '', baseMin = 0;

  for (var i = 0; i < datos.length; i++) {
    if (String(datos[i][0]).trim() !== String(concepto).trim()) continue;

    baseMin = ocNum_(datos[i][1]) * uvt;
    var pctDec = ocNum_(datos[i][3]);
    var pctNo  = ocNum_(datos[i][4]);
    var aplicaIva = String(datos[i][5]).trim().toUpperCase();
    var pctIva = ocNum_(datos[i][6]);
    var ica    = (tarifaIca !== '' && tarifaIca !== null && tarifaIca !== undefined)
                 ? ocNum_(tarifaIca) : ocNum_(datos[i][7]);

    if (b >= baseMin) {
      rf = Math.round(b * (declarante ? pctDec : pctNo));
      if (aplicaIva === 'SEGUN CASO' && v > 0) ri = Math.round(v * pctIva);
      if (ica > 0) rc = Math.round(b * ica / 1000);
    } else {
      nota = 'La base ' + ocPesos_(b) + ' no llega al minimo de ' + ocPesos_(baseMin) +
             ' para este concepto, asi que no se practica retefuente.';
    }
    break;
  }

  if (rc === 0 && nota === '') nota = 'Reteica en cero: falta la tarifa del municipio en la hoja 09.';

  return {
    ok: true,
    base: b, iva: v, total: b + v,
    retefuente: rf, reteiva: ri, reteica: rc,
    neto: b + v - rf - ri - rc,
    baseMinima: baseMin,
    nota: nota
  };
}

/* ---------- archivos ---------- */

function ocCarpeta_(numero) {
  var raiz = DriveApp.getFolderById(OC_RAIZ);
  var it = raiz.getFoldersByName(OC_CARPETA);
  var base = it.hasNext() ? it.next() : raiz.createFolder(OC_CARPETA);
  var it2 = base.getFoldersByName(numero);
  return it2.hasNext() ? it2.next() : base.createFolder(numero);
}

function ocGuardarArchivo_(numero, archivo, etiqueta) {
  if (!archivo || !archivo.datos) return '';
  var bytes = Utilities.base64Decode(archivo.datos);
  var nombre = numero + ' ' + etiqueta + ' - ' + (archivo.nombre || 'archivo');
  var blob = Utilities.newBlob(bytes, archivo.tipo || 'application/octet-stream', nombre);
  var f = ocCarpeta_(numero).createFile(blob);
  try {
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    /* Google ya no deja cambiar el uso compartido por script en cuentas
       personales. El archivo queda dentro de la carpeta corporativa. */
  }
  return f.getUrl();
}

/* ---------- ordenes ---------- */

function ocNumeroNuevo_(hoja) {
  var ult = ocUltimaFila_(hoja);
  var anio = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy');
  var max = 0;
  if (ult >= 2) {
    var col = hoja.getRange(2, 1, ult - 1, 1).getValues();
    for (var i = 0; i < col.length; i++) {
      var m = String(col[i][0]).match(/^OC-(\d{4})-(\d+)$/);
      if (m && m[1] === anio) max = Math.max(max, parseInt(m[2], 10));
    }
  }
  var n = String(max + 1);
  while (n.length < 4) n = '0' + n;
  return 'OC-' + anio + '-' + n;
}

function ocFilaOrden_(hoja, numero) {
  var ult = ocUltimaFila_(hoja);
  if (ult < 2) return 0;
  var col = hoja.getRange(2, 1, ult - 1, 1).getValues();
  for (var i = 0; i < col.length; i++) {
    if (String(col[i][0]).trim() === String(numero).trim()) return i + 2;
  }
  return 0;
}

function ocCrearOrden(ses, d, cotizacion) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u.rol, 'solicitar')) return { ok: false, mensaje: 'No tiene permiso para crear ordenes.' };

  var prov = ocBuscarProveedor(ses, d.nit);
  if (!prov.encontrado) return { ok: false, mensaje: prov.mensaje };
  if (!String(d.centro || '').trim()) return { ok: false, mensaje: 'Escoja el centro de costo.' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { ok: false, mensaje: 'El sistema esta ocupado, intente otra vez.' }; }

  try {
    var hoja = ocHoja_(OC_H_ORD);
    var numero = ocNumeroNuevo_(hoja);
    var fila = ocFilaNueva_(hoja);

    var r = ocRetenciones(ses, d.concepto, d.base, d.iva, d.declarante !== false, d.tarifaIca);
    var link = ocGuardarArchivo_(numero, cotizacion, 'COTIZACION');

    hoja.getRange(fila, 1).setValue(numero);
    hoja.getRange(fila, 2).setValue(new Date());
    if (d.fechaNecesidad) hoja.getRange(fila, 3).setValue(d.fechaNecesidad);
    hoja.getRange(fila, 4).setValue(u.usuario);
    hoja.getRange(fila, 5).setValue(u.nombre);
    hoja.getRange(fila, 6).setValue(d.area || u.area);
    hoja.getRange(fila, 7).setValue(d.centro || '');
    hoja.getRange(fila, 8).setValue("'" + prov.nit);
    hoja.getRange(fila, 11).setValue(d.descripcion || '');
    hoja.getRange(fila, 12).setValue(d.concepto || '');
    hoja.getRange(fila, 13).setValue(ocNum_(d.base));
    hoja.getRange(fila, 14).setValue(ocNum_(d.iva));
    hoja.getRange(fila, 16).setValue(r.retefuente);
    hoja.getRange(fila, 17).setValue(r.reteiva);
    hoja.getRange(fila, 18).setValue(r.reteica);
    hoja.getRange(fila, 20).setValue(link);
    hoja.getRange(fila, 21).setValue('SOLICITADA');
    if (d.observaciones) hoja.getRange(fila, 40).setValue(d.observaciones);

    SpreadsheetApp.flush();
    return { ok: true, numero: numero, neto: r.neto, aviso: prov.vigente ? '' :
      'Ojo: el proveedor tiene ' + prov.estadoRut + '. La orden se creo, pero no se puede pagar hasta que actualice sus documentos.' };
  } finally {
    lock.releaseLock();
  }
}

function ocReemplazarCotizacion(ses, numero, archivo) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false };
  var hoja = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };

  var estado = String(hoja.getRange(fila, 21).getValue()).trim().toUpperCase();
  if (estado !== 'SOLICITADA') return { ok: false, mensaje: 'Ya no se puede cambiar: la orden esta en ' + estado + '.' };
  if (!ocPuede_(u.rol, 'vertodo') && !ocIgual_(hoja.getRange(fila, 4).getValue(), u.usuario)) {
    return { ok: false, mensaje: 'Esa orden no es suya.' };
  }

  var link = ocGuardarArchivo_(numero, archivo, 'COTIZACION CORREGIDA');
  hoja.getRange(fila, 20).setValue(link);
  var obs = String(hoja.getRange(fila, 40).getValue());
  hoja.getRange(fila, 40).setValue((obs ? obs + ' | ' : '') +
    'Cotizacion reemplazada el ' + ocFecha_(new Date()) + ' por ' + u.nombre);
  return { ok: true, link: link };
}

/* ---------- gerencia ---------- */

function ocDecidir(ses, numero, decision, comentario) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u.rol, 'aprobar')) return { ok: false, mensaje: 'No tiene permiso para aprobar.' };

  var hoja = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };

  var estado = String(hoja.getRange(fila, 21).getValue()).trim().toUpperCase();
  if (estado !== 'SOLICITADA') return { ok: false, mensaje: 'Esa orden ya esta en ' + estado + '.' };

  var dec = String(decision).toUpperCase() === 'APROBADA' ? 'APROBADA' : 'RECHAZADA';
  if (dec === 'RECHAZADA' && !String(comentario || '').trim()) {
    return { ok: false, mensaje: 'Para rechazar hay que escribir el motivo.' };
  }

  hoja.getRange(fila, 21).setValue(dec);
  hoja.getRange(fila, 22).setValue(u.nombre);
  hoja.getRange(fila, 23).setValue(new Date());
  hoja.getRange(fila, 24).setValue(comentario || '');
  return { ok: true, estado: dec };
}

/* ---------- tesoreria ---------- */

function ocRegistrarPago(ses, numero, d, soporte) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u.rol, 'pagar')) return { ok: false, mensaje: 'No tiene permiso para registrar pagos.' };

  var ho = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(ho, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };

  var estado = String(ho.getRange(fila, 21).getValue()).trim().toUpperCase();
  if (estado === 'SOLICITADA')  return { ok: false, mensaje: 'Gerencia todavia no la ha aprobado.' };
  if (estado === 'RECHAZADA')   return { ok: false, mensaje: 'Esa orden fue rechazada.' };

  var valor = ocNum_(d.valor);
  if (valor <= 0) return { ok: false, mensaje: 'Escriba el valor pagado.' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { ok: false, mensaje: 'El sistema esta ocupado.' }; }

  try {
    var hp  = ocHoja_(OC_H_PAG);
    var fp  = ocFilaNueva_(hp);
    var num = 'PG-' + Utilities.formatDate(new Date(), 'America/Bogota', 'yyyyMMdd-HHmmss');
    var link = ocGuardarArchivo_(numero, soporte, 'SOPORTE DE PAGO');

    hp.getRange(fp, 1).setValue(num);
    hp.getRange(fp, 2).setValue(d.fecha ? d.fecha : new Date());
    hp.getRange(fp, 3).setValue(numero);
    hp.getRange(fp, 6).setValue(d.tipo || 'PAGO TOTAL');
    hp.getRange(fp, 7).setValue(valor);
    hp.getRange(fp, 8).setValue(d.banco || '');
    hp.getRange(fp, 9).setValue(d.comprobante || '');
    hp.getRange(fp, 10).setValue(link);
    hp.getRange(fp, 11).setValue(u.nombre);
    hp.getRange(fp, 12).setValue(d.observaciones || '');

    if (String(d.tipo).toUpperCase() !== 'ABONO') ho.getRange(fila, 21).setValue('PAGADA');
    SpreadsheetApp.flush();

    var saldo = ocNum_(ho.getRange(fila, 27).getValue());
    return { ok: true, pago: num, link: link, saldo: saldo };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- compras: mercancia y factura ---------- */

function ocRegistrarFactura(ses, numero, d, archivo) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u.rol, 'facturar')) return { ok: false, mensaje: 'No tiene permiso para registrar facturas.' };

  var hoja = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };

  if (d.mercancia)      hoja.getRange(fila, 29).setValue(d.mercancia);
  if (d.fechaRecibido)  hoja.getRange(fila, 30).setValue(d.fechaRecibido);
  if (d.recibidoPor)    hoja.getRange(fila, 31).setValue(d.recibidoPor);

  var aviso = '';
  if (d.tipoDoc && String(d.tipoDoc).toUpperCase() !== 'PENDIENTE') {
    var total     = ocNum_(hoja.getRange(fila, 15).getValue());
    var facturado = ocNum_(d.valorFacturado);
    if (facturado > 0 && Math.abs(facturado - total) > 1) {
      return { ok: false, mensaje: 'El valor facturado (' + ocPesos_(facturado) +
        ') no coincide con la orden (' + ocPesos_(total) + '). Revise antes de cerrar.' };
    }
    hoja.getRange(fila, 32).setValue(d.tipoDoc);
    hoja.getRange(fila, 33).setValue(d.numeroFactura || '');
    if (d.fechaFactura) hoja.getRange(fila, 34).setValue(d.fechaFactura);
    hoja.getRange(fila, 35).setValue(facturado);
    var link = ocGuardarArchivo_(numero, archivo, 'FACTURA');
    if (link) hoja.getRange(fila, 36).setValue(link);
    hoja.getRange(fila, 21).setValue('FACTURADA');
    aviso = 'Queda en contabilidad para causar.';
  }

  if (d.observaciones) {
    var obs = String(hoja.getRange(fila, 40).getValue());
    hoja.getRange(fila, 40).setValue((obs ? obs + ' | ' : '') + d.observaciones);
  }
  return { ok: true, aviso: aviso };
}

function ocCausar(ses, numero, comentario) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u.rol, 'causar')) return { ok: false, mensaje: 'No tiene permiso.' };

  var hoja = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };
  if (String(hoja.getRange(fila, 33).getValue()).trim() === '' &&
      String(hoja.getRange(fila, 32).getValue()).trim() === '') {
    return { ok: false, mensaje: 'Todavia no hay factura ni documento soporte.' };
  }

  hoja.getRange(fila, 37).setValue('SI');
  hoja.getRange(fila, 21).setValue('CAUSADA');
  if (comentario) {
    var obs = String(hoja.getRange(fila, 40).getValue());
    hoja.getRange(fila, 40).setValue((obs ? obs + ' | ' : '') + comentario);
  }
  return { ok: true };
}

/* ---------- consultas ---------- */

function ocOrdenes(ses, filtro) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false };

  var hoja = ocHoja_(OC_H_ORD);
  var ult = ocUltimaFila_(hoja);
  if (ult < 2) return { ok: true, filas: [], resumen: ocResumen_([]), rol: u.rol, vertodo: ocPuede_(u.rol, 'vertodo'), area: u.area };

  var d = hoja.getRange(2, 1, ult - 1, 40).getValues();
  var todo = ocPuede_(u.rol, 'vertodo');
  var filas = [], mias = [];

  for (var i = 0; i < d.length; i++) {
    if (String(d[i][0]).trim() === '') continue;
    /* Quien no ve todo, ve las ordenes de SU AREA (no solo las suyas):
       asi un ingeniero ve lo de ingenieria y la persona del sistema de
       gestion ve lo del sistema de gestion. */
    if (!todo && !ocIgual_(d[i][5], u.area)) continue;

    var o = {
      numero: String(d[i][0]),
      fecha: ocFecha_(d[i][1]),
      usuario: String(d[i][3]),
      solicita: String(d[i][4]),
      area: String(d[i][5]),
      centro: String(d[i][6]),
      nit: String(d[i][7]),
      proveedor: String(d[i][8]),
      estadoProv: String(d[i][9]),
      descripcion: String(d[i][10]),
      concepto: String(d[i][11]),
      base: ocNum_(d[i][12]),
      iva: ocNum_(d[i][13]),
      total: ocNum_(d[i][14]),
      retefuente: ocNum_(d[i][15]),
      reteiva: ocNum_(d[i][16]),
      reteica: ocNum_(d[i][17]),
      neto: ocNum_(d[i][18]),
      cotizacion: String(d[i][19]),
      estado: String(d[i][20]),
      decidePor: String(d[i][21]),
      comentario: String(d[i][23]),
      fechaPago: ocFecha_(d[i][24]),
      pagado: ocNum_(d[i][25]),
      saldo: ocNum_(d[i][26]),
      soporte: String(d[i][27]),
      mercancia: String(d[i][28]),
      tipoDoc: String(d[i][31]),
      factura: String(d[i][32]),
      linkFactura: String(d[i][35]),
      dias: d[i][37] === '' ? '' : ocNum_(d[i][37]),
      falta: String(d[i][38]),
      esMia: ocIgual_(d[i][3], u.usuario)
    };

    mias.push(o);

    if (filtro === 'aprobar'   && o.estado.toUpperCase() !== 'SOLICITADA') continue;
    if (filtro === 'pagar'     && (o.estado.toUpperCase() !== 'APROBADA' || o.saldo <= 0)) continue;
    if (filtro === 'facturar'  && o.falta.indexOf('FALTA FACTURA') !== 0 &&
                                  o.falta.indexOf('FALTA ELABORAR') !== 0) continue;
    if (filtro === 'causar'    && o.falta !== 'FALTA CAUSAR EN WORLD OFFICE') continue;
    if (filtro === 'legalizar' && (o.falta === 'LISTA' || o.falta === '' ||
                                   o.falta === 'FALTA PAGAR' || o.falta === 'RECHAZADA')) continue;
    if (filtro === 'mias'      && !o.esMia) continue;

    filas.push(o);
  }

  filas.reverse();
  return { ok: true, filas: filas, resumen: ocResumen_(mias),
           rol: u.rol, vertodo: todo, area: u.area };
}

function ocResumen_(filas) {
  var r = { total: filas.length, esperando: 0, porPagar: 0, pagadas: 0,
            sinFactura: 0, sinDocSoporte: 0, porCausar: 0, listas: 0,
            valorTotal: 0, valorPagado: 0, platapendiente: 0 };
  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    var e = String(f.estado).toUpperCase();
    r.valorTotal  += f.total;
    r.valorPagado += f.pagado;
    if (e === 'SOLICITADA') r.esperando++;
    if (e === 'APROBADA' && f.saldo > 0) r.porPagar++;
    if (f.pagado > 0) r.pagadas++;
    if (f.falta === 'FALTA FACTURA ELECTRONICA') { r.sinFactura++; r.platapendiente += f.pagado; }
    if (f.falta === 'FALTA ELABORAR DOCUMENTO SOPORTE') { r.sinDocSoporte++; r.platapendiente += f.pagado; }
    if (f.falta === 'FALTA CAUSAR EN WORLD OFFICE') r.porCausar++;
    if (f.falta === 'LISTA') r.listas++;
  }
  return r;
}

/* ---------- mensaje para el proveedor ---------- */

function ocMensajeProveedor(ses, numero) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false };

  var hoja = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };

  var d = hoja.getRange(fila, 1, 1, 40).getValues()[0];
  var prov = ocBuscarProveedor(ses, d[7]);
  var esFE = prov.encontrado && prov.tipoDoc.toUpperCase().indexOf('FACTURADOR') >= 0;

  var txt;
  if (esFE) {
    txt = 'Buen dia. SOCIAL SOLAR S.A.S., NIT 901.128.826-6. Les escribimos por la compra "' +
          d[10] + '"' + (ocNum_(d[25]) > 0 ? ', ya cancelada el ' + ocFecha_(d[24]) + ' por ' + ocPesos_(d[25]) : '') +
          '. Nos hace falta la FACTURA ELECTRONICA para poder causarla. Favor enviarla al correo de facturacion. Gracias.';
  } else {
    txt = 'Este proveedor no esta obligado a facturar electronicamente. No hay que pedirle nada: ' +
          'contabilidad debe elaborar el DOCUMENTO SOPORTE de la compra "' + d[10] + '".';
  }
  return { ok: true, esFacturadorElectronico: esFE, texto: txt, proveedor: String(d[8]) };
}

/* ---------- entrada web ---------- */

function ocDoGet(e) {
  return HtmlService.createTemplateFromFile('Portal').evaluate()
    .setTitle('Social Solar — Ordenes de compra')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


function ocMostrarLink() {
  var url = ScriptApp.getService().getUrl();
  var html = HtmlService.createHtmlOutput(
      '<div style="font-family:Arial;font-size:13px;line-height:1.7;padding:6px">'
    + '<b>Link del portal de ordenes de compra</b><br>'
    + 'Es el mismo para todos. Cada persona entra con su usuario y su contrase\u00f1a.<br><br>'
    + '<input style="width:100%;padding:8px;font-size:12px" readonly value="' + url + '?p=portal" onclick="this.select()">'
    + '<br><br>Los usuarios y contrase\u00f1as se administran en la hoja <b>07 USUARIOS Y ROLES</b>, o desde la pesta\u00f1a <b>Usuarios</b> del portal.'
    + '</div>').setWidth(520).setHeight(230);
  SpreadsheetApp.getUi().showModalDialog(html, 'Portal de ordenes de compra');
}


function ocRenombrarEnOrdenes_(viejo, nuevo) {
  var h = ocHoja_(OC_H_ORD);
  if (!h) return;
  var n = ocUltimaFila_(h);
  if (n < 2) return;
  var r = h.getRange(2, 4, n - 1, 1);
  var v = r.getValues();
  var cambio = false;
  for (var i = 0; i < v.length; i++) {
    if (ocIgual_(v[i][0], viejo)) { v[i][0] = nuevo; cambio = true; }
  }
  if (cambio) r.setValues(v);
}
