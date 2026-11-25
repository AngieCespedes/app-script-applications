/**
 * ESTADOS DE CUENTA — en el año se piden varios por proveedor.
 * Se guardan todos, se pueden ver y descargar desde el portal sin entrar a
 * Drive, y se compara el saldo que reporta el proveedor contra el saldo que
 * tenemos nosotros. Esa comparacion es la que saca a la luz las facturas que
 * ellos tienen y nosotros no.
 *
 * Hoja: 15 ESTADOS DE CUENTA. Archivos: carpeta ESTADOS DE CUENTA / <NIT NOMBRE>.
 */

var GE = { numero: 1, nit: 2, proveedor: 3, corte: 4, recibido: 5,
           saldoProveedor: 6, saldoNuestro: 7, diferencia: 8,
           archivo: 9, quien: 10, estado: 11, observaciones: 12 };
var GE_ANCHO = 12;

function geHoja_() {
  var h = SpreadsheetApp.openById(OC_SS).getSheetByName(OC_H_EDO);
  if (!h) throw new Error('Falta la hoja ' + OC_H_EDO + '. Corra «Instalar o actualizar» desde el menu.');
  return h;
}

function geNumero_(hoja) {
  var ult = ocUltimaFila_(hoja);
  if (ult < 2) return 1;
  var v = hoja.getRange(2, GE.numero, ult - 1, 1).getValues();
  var max = 0;
  for (var i = 0; i < v.length; i++) {
    var n = Number(v[i][0]);
    if (!isNaN(n) && n > max && n < 1000000) max = n;
  }
  return max + 1;
}

function geEstadosDe_(nit) {
  nit = String(nit || '').replace(/\D/g, '');
  var hoja = geHoja_();
  var ult = ocUltimaFila_(hoja);
  if (ult < 2) return [];
  var d = hoja.getRange(2, 1, ult - 1, GE_ANCHO).getValues();
  var out = [];
  for (var i = 0; i < d.length; i++) {
    if (String(d[i][GE.nit - 1]).replace(/\D/g, '') !== nit) continue;
    out.push({
      numero: d[i][GE.numero - 1],
      corte: ocFecha_(d[i][GE.corte - 1]),
      recibido: ocFecha_(d[i][GE.recibido - 1]),
      saldoProveedor: ocNum_(d[i][GE.saldoProveedor - 1]),
      saldoNuestro: ocNum_(d[i][GE.saldoNuestro - 1]),
      diferencia: ocNum_(d[i][GE.diferencia - 1]),
      archivo: String(d[i][GE.archivo - 1] || ''),
      quien: String(d[i][GE.quien - 1] || ''),
      estado: String(d[i][GE.estado - 1] || ''),
      observaciones: String(d[i][GE.observaciones - 1] || '')
    });
  }
  return out;
}

function geCarpeta_(nit, nombre) {
  var raiz = Aislamiento_.carpeta(OC_RAIZ);
  var it = raiz.getFoldersByName('ESTADOS DE CUENTA');
  var base = it.hasNext() ? it.next() : raiz.createFolder('ESTADOS DE CUENTA');
  var sub = nit + ' ' + String(nombre || '').substring(0, 50);
  var it2 = base.getFoldersByName(sub);
  return it2.hasNext() ? it2.next() : base.createFolder(sub);
}

/**
 * Sube el estado de cuenta que mando el proveedor y lo compara con lo nuestro.
 * El saldo nuestro sale de las ordenes: lo facturado menos lo pagado.
 */
function ocSubirEstadoCuenta_(ses, d, archivo) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false, mensaje: 'Vuelva a entrar.' };
  if (!ocPuede_(u.rol, 'proveedores')) return { ok: false, mensaje: 'Su rol no puede cargar estados de cuenta.' };

  var nit = String((d && d.nit) || '').replace(/\D/g, '');
  if (!nit) return { ok: false, mensaje: 'Falta el proveedor.' };
  if (!d || !d.corte) return { ok: false, mensaje: 'Escriba a que corte es el estado de cuenta.' };

  var r = ocProveedor_(ses, nit);
  if (!r.ok) return r;
  var nombre = r.proveedor.nombre;

  var enlace = '';
  if (archivo && archivo.datos) {
    try {
      var blob = Utilities.newBlob(
        Utilities.base64Decode(archivo.datos),
        archivo.tipo || 'application/pdf',
        'EDOCTA ' + nombre.substring(0, 30) + ' ' + String(d.corte).replace(/\//g, '-') +
          (archivo.nombre && archivo.nombre.indexOf('.') > 0
            ? archivo.nombre.substring(archivo.nombre.lastIndexOf('.')) : '.pdf')
      );
      enlace = geCarpeta_(nit, nombre).createFile(blob).getUrl();
    } catch (e) {
      return { ok: false, mensaje: 'No se pudo guardar el archivo: ' + e.message };
    }
  }

  var saldoProv = ocNum_(d.saldoProveedor);
  var saldoNuestro = geSaldoNuestro_(nit);
  var dif = Math.round((saldoProv - saldoNuestro) * 100) / 100;

  var hoja = geHoja_();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var num;
  try {
    num = geNumero_(hoja);
    var fila = ocUltimaFila_(hoja) + 1;
    var v = new Array(GE_ANCHO);
    v[GE.numero - 1]         = num;
    v[GE.nit - 1]            = nit;
    v[GE.proveedor - 1]      = nombre;
    v[GE.corte - 1]          = d.corte;
    v[GE.recibido - 1]       = new Date();
    v[GE.saldoProveedor - 1] = saldoProv;
    v[GE.saldoNuestro - 1]   = saldoNuestro;
    v[GE.diferencia - 1]     = dif;
    v[GE.archivo - 1]        = enlace;
    v[GE.quien - 1]          = u.nombre;
    v[GE.estado - 1]         = dif === 0 ? 'CUADRO' : 'DIFERENCIA';
    v[GE.observaciones - 1]  = String((d && d.observaciones) || '');
    hoja.getRange(fila, 1, 1, GE_ANCHO).setValues([v]);
  } finally {
    lock.releaseLock();
  }

  return { ok: true, numero: num, diferencia: dif, saldoNuestro: saldoNuestro,
           mensaje: dif === 0
             ? 'Guardado. El saldo cuadra con el nuestro.'
             : 'Guardado. Hay una diferencia de ' + ocPlata_(Math.abs(dif)) + ' ' +
               (dif > 0 ? 'a favor del proveedor: puede haber facturas que no tengamos registradas.'
                        : 'a favor nuestro: puede haber pagos que ellos no han aplicado.') };
}

/** Lo que le debemos segun nuestras ordenes: facturado menos pagado. */
function geSaldoNuestro_(nit) {
  var hoja = ocHoja_(OC_H_ORD);
  var ult = ocUltimaFila_(hoja);
  if (ult < 2) return 0;
  var d = hoja.getRange(2, 1, ult - 1, OC_ORD_ANCHO).getValues();
  var saldo = 0;
  for (var i = 0; i < d.length; i++) {
    if (String(d[i][7]).replace(/\D/g, '') !== String(nit).replace(/\D/g, '')) continue;
    if (String(d[i][20]).toUpperCase() === 'RECHAZADA') continue;
    saldo += ocNum_(d[i][26]);
  }
  return Math.round(saldo * 100) / 100;
}

/** Abre un solo archivo en modo lectura, sin exponer la carpeta. */
function ocEnlaceArchivo_(ses, enlace) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false, mensaje: 'Vuelva a entrar.' };
  var m = String(enlace || '').match(/[-\w]{25,}/);
  if (!m) return { ok: false, mensaje: 'Ese archivo no tiene un enlace valido.' };
  try {
    var archivo = DriveApp.getFileById(m[0]);
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { ok: true, nombre: archivo.getName(),
             ver: 'https://drive.google.com/file/d/' + m[0] + '/view',
             descargar: 'https://drive.google.com/uc?export=download&id=' + m[0] };
  } catch (e) {
    return { ok: false, mensaje: 'No se pudo abrir el archivo: ' + e.message };
  }
}
