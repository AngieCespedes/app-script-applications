/*************************************************************
 * TOMA FISICA DE INVENTARIO 2026 - FERTIAGRO ALARCON S.A.S.
 * NIT 901.999.718-5
 *************************************************************/

var SHEET_ID = '1KgcC4L-vY6j15iq5xT2X9UShfFa8txkg0eRUVxPY26w';

var USUARIOS = {
  'liliana':   { nombre: 'Liliana',   clave: '[RETIRADA]', rol: 'ALMACEN',  cargo: 'Almacen'  },
  'johan':     { nombre: 'Johan',     clave: '[RETIRADA]', rol: 'ALMACEN',  cargo: 'Almacen'  },
  'sebastian': { nombre: 'Sebastian', clave: '[RETIRADA]', rol: 'ALMACEN',  cargo: 'Almacen'  },
  'vannesa':   { nombre: 'Vannesa',   clave: '[RETIRADA]', rol: 'AUDITOR',  cargo: 'Auditoria'},
  'erika':     { nombre: 'Erika',     clave: '[RETIRADA]', rol: 'GERENCIA', cargo: 'Gerencia' },
  'angie':     { nombre: 'Angie',     clave: '[RETIRADA]', rol: 'ADMIN',    cargo: 'Administradora' }
};

var CUENTA   = { ALMACEN: true, AUDITOR: true, GERENCIA: true, ADMIN: true };
var VE_PANEL = { AUDITOR: true, GERENCIA: true, ADMIN: true };

var CARPETA_FOTOS = 'Fotos toma fisica 2026';
var TZ = 'America/Bogota';
var FILA_INI = 6;
var MAX_CONTEO = 2005;
var MIN_OCUPADA = 90;

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Toma fisica - Fertiagro Alarcon')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

function libro_() { return SpreadsheetApp.openById(SHEET_ID); }
function hoja_(n) { return libro_().getSheetByName(n); }

function configurarBase() {
  var m = hoja_('MAESTRO');
  var n = m.getLastRow() - FILA_INI + 1;
  var vacio = [];
  for (var i = 0; i < n; i++) vacio.push(['Se asigna en bodega', '']);
  m.getRange(FILA_INI, 8, n, 2).setValues(vacio);

  var p = hoja_('PARAMETROS');
  var nombres = Object.keys(USUARIOS).map(function (u) { return [USUARIOS[u].nombre]; });
  p.getRange(FILA_INI, 4, nombres.length, 1).setValues(nombres);

  var c = hoja_('CONTEO');
  if (String(c.getRange(FILA_INI, 1).getValue()).indexOf('EJEMPLO') === 0) {
    [[1, 3], [5, 3], [9, 12], [22, 2]].forEach(function (b) {
      c.getRange(FILA_INI, b[0], 1, b[1]).clearContent().setBackground(null).setFontStyle('normal');
    });
  }
  var msg = 'Listo. ' + n + ' productos cargados. La zona se escoge en bodega.';
  Logger.log(msg);
  return msg;
}

function autenticar_(usuario, clave) {
  var k = String(usuario || '').trim().toLowerCase();
  var u = USUARIOS[k];
  if (!u || String(clave).trim() !== u.clave) return null;
  return { id: k, nombre: u.nombre, rol: u.rol, cargo: u.cargo };
}

function entrar(usuario, clave) {
  var u = autenticar_(usuario, clave);
  if (!u) return { ok: false, msg: 'Usuario o contrasena incorrectos.' };
  return { ok: true, usuario: u, cuenta: !!CUENTA[u.rol], panel: !!VE_PANEL[u.rol] };
}

function getCategorias(usuario, clave) {
  var u = autenticar_(usuario, clave);
  if (!u) return { ok: false, msg: 'Sesion vencida. Vuelva a entrar.' };

  var m = hoja_('MAESTRO');
  var nm = m.getLastRow() - FILA_INI + 1;
  var cats = m.getRange(FILA_INI, 2, nm, 9).getValues();

  var c = hoja_('CONTEO');
  var reg = c.getRange(FILA_INI, 2, MAX_CONTEO - FILA_INI + 1, 19).getValues()
    .filter(function (f) { return f[0] !== '' && f[0] !== null; });

  var total = {}, hechos = {}, activos = {}, ids = {}, todosIds = {};
  cats.forEach(function (f) {
    if (String(f[8]).trim().toUpperCase() === 'DESCONTINUADO') return;
    var k = String(f[0]).trim();
    total[k] = (total[k] || 0) + 1;
  });
  var corte = new Date().getTime() - MIN_OCUPADA * 60000;
  reg.forEach(function (f) {
    var cat = String(f[16]).trim();
    var quien = String(f[15]).trim();
    var id = f[0];
    if (!ids[cat]) ids[cat] = {};
    ids[cat][id] = true;
    todosIds[id] = true;
    var t = f[18] ? new Date(f[18]).getTime() : 0;
    if (t > corte && quien && quien !== u.nombre) {
      if (!activos[cat]) activos[cat] = {};
      activos[cat][quien] = true;
    }
  });
  Object.keys(ids).forEach(function (cat) { hechos[cat] = Object.keys(ids[cat]).length; });

  var lista = Object.keys(total).sort().map(function (k) {
    return {
      categoria: k,
      total: total[k],
      hechos: hechos[k] || 0,
      ocupadaPor: activos[k] ? Object.keys(activos[k]) : []
    };
  });
  return { ok: true, categorias: lista, todos: { total: nm, hechos: Object.keys(todosIds).length } };
}

function getLista(usuario, clave, categoria) {
  var u = autenticar_(usuario, clave);
  if (!u) return { ok: false, msg: 'Sesion vencida. Vuelva a entrar.' };
  if (!categoria) return { ok: false, msg: 'Escoja primero que va a contar.' };

  var m = hoja_('MAESTRO');
  var n = m.getLastRow() - FILA_INI + 1;
  var datos = m.getRange(FILA_INI, 1, n, 14).getValues();

  var contados = {};
  var c = hoja_('CONTEO');
  var reg = c.getRange(FILA_INI, 2, MAX_CONTEO - FILA_INI + 1, 16).getValues();
  reg.forEach(function (f) {
    if (f[0] === '' || f[0] === null) return;
    var p = contados[f[0]];
    if (!p) p = contados[f[0]] = { cant: 0, uni: '', quien: '', n: 0 };
    p.cant += Number(f[3]) || 0;
    p.uni = f[4];
    p.n++;
    var qq = String(f[15]).trim();
    if (qq && p.quien.indexOf(qq) < 0) p.quien = p.quien ? p.quien + ', ' + qq : qq;
  });

  var items = [];
  datos.forEach(function (f) {
    if (String(f[9]).trim().toUpperCase() === 'DESCONTINUADO') return;
    if (categoria !== '__TODOS__' && String(f[1]).trim() !== String(categoria).trim()) return;
    var h = contados[f[0]];
    items.push({
      id: f[0], categoria: f[1], codigo: f[2], producto: f[3],
      presentacion: f[4], unidad: f[5],
      confirmar: String(f[6]).trim().toUpperCase() === 'SI',
      alerta: f[13],
      contado: !!h,
      cantidad: h ? h.cant : '',
      unidadContada: h ? h.uni : '',
      contadoPor: h ? h.quien : '',
      registros: h ? h.n : 0
    });
  });

  return {
    ok: true, categoria: categoria, rol: u.rol, total: items.length,
    unidades: listaParametro_(1), estados: listaParametro_(2), items: items
  };
}

function listaParametro_(col) {
  var p = hoja_('PARAMETROS');
  return p.getRange(FILA_INI, col, 10, 1).getValues()
    .map(function (f) { return String(f[0]).trim(); })
    .filter(function (v) { return v !== ''; });
}

function estadoProducto(usuario, clave, idProducto) {
  var u = autenticar_(usuario, clave);
  if (!u) return { ok: false, msg: 'Sesion vencida. Vuelva a entrar.' };
  var c = hoja_('CONTEO');
  var reg = c.getRange(FILA_INI, 2, MAX_CONTEO - FILA_INI + 1, 21).getValues();
  var total = 0, uni = '', quienes = [], n = 0, ultima = '';
  for (var i = 0; i < reg.length; i++) {
    if (reg[i][0] === '' || reg[i][0] === null) break;
    if (Number(reg[i][0]) !== Number(idProducto)) continue;
    n++;
    total += Number(reg[i][3]) || 0;
    uni = reg[i][4];
    var q = String(reg[i][15]).trim();
    if (q && quienes.indexOf(q) < 0) quienes.push(q);
    if (reg[i][18]) ultima = Utilities.formatDate(new Date(reg[i][18]), TZ, 'dd/MM HH:mm');
  }
  if (!n) return { ok: true, contado: false };
  return {
    ok: true, contado: true, registros: n,
    cantidad: total, unidad: uni, quien: quienes.join(', '),
    cuando: ultima, puedeRecontar: !!CUENTA[u.rol]
  };
}

function guardarConteo(d) {
  var u = autenticar_(d.usuario, d.clave);
  if (!u) return { ok: false, msg: 'Sesion vencida. Vuelva a entrar.' };
  if (!CUENTA[u.rol]) return { ok: false, msg: 'Su usuario no registra conteos.' };

  var cant = Number(d.cantidad);
  var venc = Number(d.vencidos || 0);
  if (isNaN(cant) || cant < 0) return { ok: false, msg: 'La cantidad no es valida.' };
  if (venc > cant) return { ok: false, msg: 'Los vencidos no pueden ser mas que el total contado.' };
  if (venc > 0 && !String(d.obsVencido || '').trim())
    return { ok: false, msg: 'Escriba que encontro en los vencidos.' };
  if (String(d.sinFactura) === 'SI' && !String(d.motivoSinFactura || '').trim())
    return { ok: false, msg: 'Explique por que no tiene factura de compra.' };

  // La foto se sube a Drive ANTES de pedir el turno: es lo que mas demora
  // y no necesita leer la hoja. Asi el bloqueo dura lo minimo.
  var foto = d.foto ? guardarFoto_(d.foto, d.codigo + '_' + u.nombre) : '';

  var lock = LockService.getScriptLock();
  lock.waitLock(45000);
  try {
    var c = hoja_('CONTEO');
    var bloque = c.getRange(FILA_INI, 2, MAX_CONTEO - FILA_INI + 1, 4).getValues();
    var ids = bloque, cants = bloque;
    var fila = -1, previo = -1, consec = 0, yaHabia = 0;
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === '' || ids[i][0] === null) { fila = i + FILA_INI; break; }
      consec++;
      if (Number(ids[i][0]) === Number(d.idProducto)) {
        previo = i + FILA_INI;
        yaHabia += Number(cants[i][3]) || 0;
      }
    }
    if (fila === -1) return { ok: false, msg: 'La hoja CONTEO esta llena. Avise a la supervision.' };

    var num = 1;
    if (previo > 0) {
      var quienAntes = String(c.getRange(previo, 17).getValue()).trim();
      // Cualquiera puede agregar o corregir; queda en la bitacora.
      if (!String(d.motivoCorreccion || '').trim()) {
        return { ok: false, msg: 'PEDIR_MOTIVO|Ya hay un conteo de este producto (' +
          (quienAntes || 'otra persona') + '). Escriba el motivo del recuento.' };
      }
      var ant = c.getRange(previo, 5, 1, 3).getValues()[0];
      num = Number(c.getRange(previo, 22).getValue() || 1) + 1;
      var esSuma = (String(d.modo || '') === 'SUMA');
      var antes = esSuma ? (yaHabia + ' ' + d.unidad) : (ant[0] + ' ' + ant[1]);
      var despues = esSuma ? ((yaHabia + cant) + ' ' + d.unidad + ' (sumo ' + cant + ')')
                           : (cant + ' ' + d.unidad);
      registrarBitacora_(u.nombre, d.idProducto, d.producto,
        esSuma ? 'Agrego hallazgo' : 'Corrigio', antes, despues, d.motivoCorreccion);
    }

    var ahora = new Date();
    var ini = d.horaInicio ? new Date(d.horaInicio) : ahora;

    var suma = (String(d.modo || '') === 'SUMA');
    var reemplaza = (previo > 0 && !suma);
    var destino = reemplaza ? previo : fila;
    var idConteo = reemplaza ? c.getRange(previo, 1).getValue() : (consec + 1);
    c.getRange(destino, 1, 1, 3).setValues([[idConteo, d.idProducto, d.codigo]]);
    c.getRange(destino, 5, 1, 3).setValues([[cant, d.unidad, venc]]);
    c.getRange(destino, 9, 1, 12).setValues([[
      d.fechaVencimiento || '', d.obsVencido || '', Number(d.sobrante || 0),
      d.presentacionConfirmada || '', d.sinFactura || 'NO', d.motivoSinFactura || '',
      d.estado || 'Bueno', d.observacion || '', u.nombre, d.categoria || '', ini, ahora
    ]]);
    c.getRange(destino, 22, 1, 2).setValues([[num, foto]]);

    return { ok: true, conteoNum: num };
  } finally {
    lock.releaseLock();
  }
}

function crearNoListado(d) {
  var u = autenticar_(d.usuario, d.clave);
  if (!u) return { ok: false, msg: 'Sesion vencida. Vuelva a entrar.' };
  if (!CUENTA[u.rol]) return { ok: false, msg: 'Su usuario no registra conteos.' };
  if (!String(d.producto || '').trim()) return { ok: false, msg: 'Escriba el nombre del producto.' };
  if (!String(d.motivo || '').trim()) return { ok: false, msg: 'Explique por que lo esta creando.' };
  // La foto quedo opcional.

  var foto = d.foto ? guardarFoto_(d.foto, 'NUEVO_' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd_HHmmss') + '_' + u.nombre) : '';

  var lock = LockService.getScriptLock();
  lock.waitLock(45000);
  try {
    var h = hoja_('NO_LISTADOS');
    var ids = h.getRange(FILA_INI, 1, 500, 1).getValues();
    var fila = -1, consec = 0;
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === '' || ids[i][0] === null) { fila = i + FILA_INI; break; }
      consec++;
    }
    if (fila === -1) return { ok: false, msg: 'No hay espacio en NO_LISTADOS.' };


    h.getRange(fila, 1, 1, 13).setValues([[
      'N' + (consec + 1), d.producto, d.presentacion || '', d.unidad || '',
      Number(d.cantidad || 0), Number(d.vencidos || 0), d.fechaVencimiento || '',
      d.ubicacion || '', d.sinFactura || 'NO', d.motivo, foto, u.nombre, new Date()
    ]]);
    registrarBitacora_(u.nombre, '', d.producto, 'Creo', '',
      d.cantidad + ' ' + (d.unidad || ''), d.motivo);
    return { ok: true, id: 'N' + (consec + 1) };
  } finally {
    lock.releaseLock();
  }
}

function registrarBitacora_(quien, idProd, producto, accion, antes, despues, motivo) {
  var b = hoja_('BITACORA');
  var vals = b.getRange(FILA_INI, 1, 2000, 1).getValues();
  var fila = -1;
  for (var i = 0; i < vals.length; i++) {
    if (vals[i][0] === '' || vals[i][0] === null) { fila = i + FILA_INI; break; }
  }
  if (fila === -1) return;
  b.getRange(fila, 1, 1, 8).setValues([[new Date(), quien, idProd, producto,
    accion, antes, despues, motivo]]);
}

function guardarFoto_(base64, nombre) {
  try {
    var padres = DriveApp.getFileById(SHEET_ID).getParents();
    var raiz = padres.hasNext() ? padres.next() : DriveApp.getRootFolder();
    var it = raiz.getFoldersByName(CARPETA_FOTOS);
    var carpeta = it.hasNext() ? it.next() : raiz.createFolder(CARPETA_FOTOS);
    var partes = base64.split(',');
    var blob = Utilities.newBlob(
      Utilities.base64Decode(partes[1]), 'image/jpeg',
      nombre + '_' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd_HHmmss') + '.jpg');
    return carpeta.createFile(blob).getUrl();
  } catch (e) {
    return 'ERROR AL GUARDAR FOTO: ' + e.message;
  }
}


/* Deja la respuesta en texto y numeros simples: cualquier fecha o valor raro
   de la hoja hacia caer el panel al pasarlo al navegador. */
function limpio_(o) {
  if (o === null || o === undefined) return '';
  if (o instanceof Date) return isNaN(o.getTime()) ? '' : Utilities.formatDate(o, TZ, 'dd/MM/yyyy');
  if (Object.prototype.toString.call(o) === '[object Array]') {
    var a = []; for (var i = 0; i < o.length; i++) a.push(limpio_(o[i])); return a;
  }
  if (typeof o === 'object') {
    var x = {}; for (var k in o) x[k] = limpio_(o[k]); return x;
  }
  if (typeof o === 'number') return isFinite(o) ? o : 0;
  if (typeof o === 'boolean') return o;
  return String(o);
}

function getPanel(usuario, clave) {
  var u = autenticar_(usuario, clave);
  if (!u || !VE_PANEL[u.rol]) return { ok: false, msg: 'Su usuario no tiene acceso al panel.' };

  var m = hoja_('MAESTRO');
  var nm = m.getLastRow() - FILA_INI + 1;
  var cats = m.getRange(FILA_INI, 2, nm, 9).getValues();
  var totalCat = {}, nActivos = 0;
  cats.forEach(function (f) {
    if (String(f[8]).trim().toUpperCase() === 'DESCONTINUADO') return;
    nActivos++;
    var k = String(f[0]).trim();
    totalCat[k] = (totalCat[k] || 0) + 1;
  });

  var c = hoja_('CONTEO');
  var filas = c.getRange(FILA_INI, 1, MAX_CONTEO - FILA_INI + 1, 23).getValues()
    .filter(function (f) { return f[1] !== '' && f[1] !== null; });

  var hechosCat = {}, porPersona = {}, vencidos = [], sinFactura = [], vistos = {};
  filas.forEach(function (f) {
    var cat = String(f[17]).trim(), q = String(f[16]).trim();
    if (!vistos[f[1]]) { vistos[f[1]] = true; hechosCat[cat] = (hechosCat[cat] || 0) + 1; }
    if (!porPersona[q]) porPersona[q] = { contados: 0, segundos: 0, recuentos: 0, cats: {} };
    porPersona[q].contados++;
    porPersona[q].cats[cat] = true;
    porPersona[q].segundos += Math.max(0, (new Date(f[19]) - new Date(f[18])) / 1000);
    if (Number(f[21]) > 1) porPersona[q].recuentos++;
    if (Number(f[6]) > 0) vencidos.push({
      producto: f[3] || f[2], total: f[4], vencidos: f[6],
      fecha: f[8], nota: f[9], quien: q
    });
    if (String(f[12]).toUpperCase() === 'SI') sinFactura.push({
      producto: f[3] || f[2], cantidad: f[4], motivo: f[13], quien: q, origen: 'En lista'
    });
  });

  var nl = hoja_('NO_LISTADOS').getRange(FILA_INI, 1, 500, 13).getValues()
    .filter(function (f) { return f[0] !== '' && f[0] !== null; });
  nl.forEach(function (f) {
    if (String(f[8]).toUpperCase() === 'SI') sinFactura.push({
      producto: f[1], cantidad: f[4], motivo: f[9], quien: f[11], origen: 'Creado en campo'
    });
  });

  var bit = hoja_('BITACORA').getRange(FILA_INI, 1, 2000, 8).getValues()
    .filter(function (f) { return f[0] !== '' && f[0] !== null; })
    .slice(-40).reverse()
    .map(function (f) {
      return {
        hora: Utilities.formatDate(new Date(f[0]), TZ, 'dd/MM HH:mm'),
        quien: f[1], producto: f[3], accion: f[4],
        cambio: (f[5] || '-') + ' -> ' + (f[6] || '-'), motivo: f[7]
      };
    });

  var personas = Object.keys(porPersona).map(function (q) {
    var p = porPersona[q];
    return {
      nombre: q, contados: p.contados,
      minutos: Math.round(p.segundos / 60),
      ritmo: p.contados ? (p.segundos / 60 / p.contados).toFixed(1) : '-',
      recuentos: p.recuentos,
      categorias: Object.keys(p.cats).length
    };
  });

  var res = {
    ok: true, rol: u.rol, total: nActivos,
    contados: Object.keys(vistos).length,
    vencidosUnidades: vencidos.reduce(function (s, v) { return s + Number(v.vencidos || 0); }, 0),
    creados: nl.length,
    categorias: Object.keys(totalCat).sort().map(function (k) {
      return { categoria: k, total: totalCat[k], hechos: hechosCat[k] || 0 };
    }),
    personas: personas,
    vencidos: vencidos.slice(0, 60),
    sinFactura: sinFactura.slice(0, 60),
    bitacora: bit
  };
  return limpio_(res);
}


/* ===== CARGA DEL GRUPO DE FERRETERIA ==================== */

















