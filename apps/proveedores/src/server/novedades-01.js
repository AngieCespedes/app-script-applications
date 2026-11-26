/**
 * NOVEDADES — quien se inscribio y que se destrabo con eso.
 *
 * Un aviso que solo diga «entro un proveedor nuevo» se vuelve ruido y a la
 * semana nadie lo lee. Por eso cada novedad se cruza por el NIT contra las
 * ordenes que estaban esperando a ese proveedor: asi el aviso le dice a quien
 * pidio la orden que ya puede seguir, que es lo unico que le interesa.
 *
 * No necesita hoja nueva: todo sale de la hoja 01 y de la hoja 10. Lo unico
 * que se guarda es la fecha en que cada persona miro por ultima vez.
 */

var NOV_DIAS = 20;            /* hasta donde se mira para atras */
var NOV_TOPE = 40;            /* cuantas novedades se mandan como mucho */

/** La ultima vez que esta persona abrio las novedades. */
function novVisto_(usuario) {
  var v = PropertiesService.getScriptProperties().getProperty('NOV_VISTO_' + String(usuario).toLowerCase());
  var d = v ? new Date(v) : null;
  return (d && !isNaN(d.getTime())) ? d : new Date(0);
}

function novMarcarVisto_(ses) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false, mensaje: 'Vuelva a entrar.' };
  PropertiesService.getScriptProperties()
    .setProperty('NOV_VISTO_' + String(u.usuario).toLowerCase(), new Date().toISOString());
  return { ok: true };
}

/** Las ordenes que todavia esperan algo, agrupadas por NIT. */
function novOrdenesPorNit_() {
  var hoja = ocHoja_(OC_H_ORD);
  var ult = hoja.getLastRow();
  var mapa = {};
  if (ult < 2) return mapa;
  var d = hoja.getRange(2, 1, ult - 1, 21).getValues();
  for (var i = 0; i < d.length; i++) {
    var num = String(d[i][0]).trim();
    if (!num) continue;
    var estado = String(d[i][20]).trim().toUpperCase();
    if (estado === 'RECHAZADA' || estado === 'CAUSADA') continue;
    var nit = String(d[i][7]).replace(/\D/g, '');
    if (!nit) continue;
    if (!mapa[nit]) mapa[nit] = [];
    mapa[nit].push({
      numero: num,
      usuario: String(d[i][3]).trim(),
      solicita: String(d[i][4]).trim(),
      centro: String(d[i][6]).trim(),
      total: ocNum_(d[i][14]),
      estado: estado
    });
  }
  return mapa;
}

/**
 * Lo que paso con los proveedores en los ultimos dias.
 * Compras y tesoreria ven todas; los demas ven las que destraban una orden
 * suya, y pueden pedir el resto con todas = true.
 */
function ocNovedades_(ses, todas) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false, mensaje: 'Vuelva a entrar.' };

  var hoja = ocHoja_(SSV_REG);
  var ult = hoja.getLastRow();
  if (ult < 2) return { ok: true, filas: [], nuevas: 0, verTodas: false };

  var desde = new Date();
  desde.setDate(desde.getDate() - NOV_DIAS);
  var visto = novVisto_(u.usuario);
  var porNit = novOrdenesPorNit_();
  var manda = ocPuede_(u, 'proveedores') || ocPuede_(u, 'pagar') || ocPuede_(u, 'usuarios');

  var d = hoja.getRange(2, 1, ult - 1, 14).getValues();
  var filas = [], nuevas = 0;

  for (var i = d.length - 1; i >= 0 && filas.length < NOV_TOPE; i--) {
    var f = d[i][0];
    if (!(f instanceof Date)) f = new Date(f);
    if (isNaN(f.getTime()) || f < desde) continue;

    var nit = String(d[i][1]).replace(/\D/g, '');
    if (!nit) continue;

    var ordenes = porNit[nit] || [];
    var mias = ordenes.filter(function (o) { return ocIgual_(o.usuario, u.usuario); });
    if (!manda && !todas && !mias.length) continue;

    var rut  = String(d[i][7] || '').trim();
    var cert = String(d[i][8] || '').trim();
    var falta = [];
    if (!rut)  falta.push('el RUT');
    if (!cert) falta.push('la certificación bancaria');

    var esNueva = f > visto;
    if (esNueva) nuevas++;

    filas.push({
      nit: nit,
      nombre: String(d[i][2] || '').trim(),
      fecha: ocFecha_(f),
      cuando: novHace_(f),
      regimen: String(d[i][6] || '').trim(),
      completo: !falta.length,
      falta: falta.join(' y '),
      nueva: esNueva,
      ordenes: (mias.length ? mias : ordenes).slice(0, 3),
      cuantasOrdenes: ordenes.length,
      mia: !!mias.length
    });
  }

  return { ok: true, filas: filas, nuevas: nuevas, verTodas: manda || !!todas, manda: manda };
}

/** «hace 12 minutos», «hoy a las 11:20», «hace 3 días». */
function novHace_(f) {
  var min = Math.round((new Date().getTime() - f.getTime()) / 60000);
  if (min < 2)   return 'hace un momento';
  if (min < 60)  return 'hace ' + min + ' minutos';
  var hoy = new Date();
  if (f.getDate() === hoy.getDate() && f.getMonth() === hoy.getMonth() && f.getFullYear() === hoy.getFullYear()) {
    return 'hoy a las ' + Utilities.formatDate(f, 'America/Bogota', 'h:mm a').toLowerCase();
  }
  var dias = Math.round((hoy.getTime() - f.getTime()) / 86400000);
  if (dias <= 1) return 'ayer';
  return 'hace ' + dias + ' días';
}
