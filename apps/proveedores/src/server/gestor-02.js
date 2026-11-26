/**
 * SOLICITUDES A PROVEEDORES — la trazabilidad.
 *
 * Cada vez que compras le pide algo a un proveedor, por correo o por WhatsApp,
 * queda una fila: que se pidio, a quien, cuando y por donde. De ahi salen los
 * dias sin respuesta y el indicador de gestion.
 *
 * Una solicitud se da por CONTESTADA cuando la informacion quedo completa en el
 * sistema, no cuando el proveedor dijo que la iba a mandar. Asi el indicador
 * mide resultado y no correos enviados.
 *
 * Hoja: 14 SOLICITUDES A PROVEEDORES
 */

var GS = { numero: 1, fecha: 2, nit: 3, proveedor: 4, medio: 5, quePidio: 6,
           destino: 7, quienPidio: 8, fechaRespuesta: 9, dias: 10, estado: 11, nota: 12 };
var GS_ANCHO = 12;
var GS_MEDIOS = ['CORREO', 'WHATSAPP'];

function gsHoja_() {
  var h = SpreadsheetApp.openById(OC_SS).getSheetByName(OC_H_SOL);
  if (!h) throw new Error('Falta la hoja ' + OC_H_SOL + '. Corra «Instalar o actualizar» desde el menu.');
  return h;
}

function gsTodas_() {
  var hoja = gsHoja_();
  var ult = ocUltimaFila_(hoja);
  if (ult < 2) return [];
  var d = hoja.getRange(2, 1, ult - 1, GS_ANCHO).getValues();
  var out = [];
  for (var i = 0; i < d.length; i++) {
    if (String(d[i][0]).trim() === '') continue;
    var s = {
      numero: d[i][GS.numero - 1],
      fecha: ocFecha_(d[i][GS.fecha - 1]),
      fechaMs: gsMs_(d[i][GS.fecha - 1]),
      nit: String(d[i][GS.nit - 1]).replace(/\D/g, ''),
      proveedor: String(d[i][GS.proveedor - 1]),
      medio: String(d[i][GS.medio - 1]),
      quePidio: String(d[i][GS.quePidio - 1]),
      destino: String(d[i][GS.destino - 1]),
      quienPidio: String(d[i][GS.quienPidio - 1]),
      fechaRespuesta: ocFecha_(d[i][GS.fechaRespuesta - 1]),
      estado: String(d[i][GS.estado - 1] || 'SIN RESPUESTA'),
      nota: String(d[i][GS.nota - 1] || ''),
      fila: i + 2
    };
    s.dias = s.estado.toUpperCase() === 'CONTESTADA'
      ? gsDias_(d[i][GS.fecha - 1], d[i][GS.fechaRespuesta - 1])
      : gsDias_(d[i][GS.fecha - 1], new Date());
    out.push(s);
  }
  return out;
}

function gsMs_(v) { var f = gsFecha_(v); return f ? f.getTime() : 0; }

function gsFecha_(v) {
  if (v instanceof Date) return v;
  var s = String(v || '').trim();
  if (!s) return null;
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function gsDias_(desde, hasta) {
  var a = gsFecha_(desde), b = gsFecha_(hasta);
  if (!a || !b) return '';
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function gsSolicitudesPorNit_() {
  var idx = {};
  gsTodas_().forEach(function (s) {
    if (!idx[s.nit]) idx[s.nit] = [];
    idx[s.nit].push(s);
  });
  return idx;
}

function gsSolicitudesDe_(nit) {
  nit = String(nit || '').replace(/\D/g, '');
  return gsTodas_().filter(function (s) { return s.nit === nit; })
                   .sort(function (a, b) { return a.fechaMs - b.fechaMs; });
}

/** El estado que se ve en la lista: sin pedir / esperando / vencida / contesto. */
function gsSeguimiento_(lista) {
  if (!lista || !lista.length) return { estado: 'Sin pedir', dias: 0, veces: 0 };
  var ult = lista[lista.length - 1];
  var veces = lista.length;
  if (ult.estado.toUpperCase() === 'CONTESTADA') {
    return { estado: 'Contesto', dias: ult.dias, veces: veces, ultima: ult.fecha };
  }
  if (ult.estado.toUpperCase() === 'LLEGO MALO') {
    return { estado: 'Llego malo', dias: ult.dias, veces: veces, ultima: ult.fecha };
  }
  return { estado: (ult.dias >= OC_DIAS_SOL ? 'Vencida' : 'Pedido, esperando'),
           dias: ult.dias, veces: veces, ultima: ult.fecha };
}

function gsNumero_(hoja) {
  var ult = ocUltimaFila_(hoja);
  if (ult < 2) return 1;
  var v = hoja.getRange(2, GS.numero, ult - 1, 1).getValues();
  var max = 0;
  for (var i = 0; i < v.length; i++) {
    var n = Number(v[i][0]);
    if (!isNaN(n) && n > max && n < 1000000) max = n;
  }
  return max + 1;
}

/* --------- los textos que se le mandan al proveedor --------- */

function gsPie_(u) {
  return '\n\nQuedo atenta y agradezco su gestion.\n\n' + u.nombre +
         '\nSOCIAL SOLAR S.A.S. — NIT 901.128.826-6';
}

function gsSaludo_(p) {
  return 'Buen dia, ' + (p.asesor || p.nombre) + '.';
}

function gsTextoDocumentos_(p, u, corto) {
  var f = p.faltantes.filter(function (x) { return x !== 'Correo estado de cuenta'; });
  var t = gsSaludo_(p) + '\n\nLe escribo de Social Solar S.A.S. Estamos actualizando nuestra base de ' +
          'proveedores y nos hace falta lo siguiente de ustedes:\n\n';
  f.forEach(function (x) { t += '  - ' + x + '\n'; });
  t += '\nPuede subirlo en este enlace, que le pide unicamente lo que falta:\n' + gsEnlaceRegistro_() + '\n';
  if (!corto) t += '\nSi la certificacion bancaria viene con contrasena, por favor indiquenos cual es.\n';
  return t + gsPie_(u);
}

function gsTextoEstadoCuenta_(p, u) {
  return gsSaludo_(p) + '\n\nLe escribo de Social Solar S.A.S. Para nuestra conciliacion de cartera, ' +
         'le agradezco enviarnos el estado de cuenta de Social Solar S.A.S. (NIT 901.128.826-6) con ' +
         'corte a la fecha, detallando las facturas pendientes y sus vencimientos.\n\n' +
         'Si aparecen facturas que no tengamos registradas, por favor adjuntelas.' + gsPie_(u);
}

function gsTextoCredito_(p, u) {
  return gsSaludo_(p) + '\n\nLe escribo de Social Solar S.A.S. (NIT 901.128.826-6). Durante 2026 hemos ' +
         'realizado compras con ustedes por ' + ocPlata_(p.compras) + ' y nos interesa formalizar un ' +
         'cupo de credito.\n\nLe agradezco indicarnos:\n\n' +
         '  - Si es posible asignarnos cupo y por que monto\n' +
         '  - El plazo en dias que manejan\n' +
         '  - Si otorgan descuento por pronto pago\n' +
         '  - Que documentacion debemos radicar y a que correo' + gsPie_(u);
}

function gsEnlaceRegistro_() {
  var url = '';
  try { url = ScriptApp.getService().getUrl(); } catch (e) { url = ''; }
  return url || '[enlace del formulario de registro]';
}

function ocPlata_(n) {
  return '$' + Utilities.formatString('%s', Math.round(ocNum_(n)))
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Arma la solicitud sin enviarla: la pantalla la muestra para que compras la
 * edite antes. tipo: documentos | estadocuenta | credito | otra
 */
function ocArmarSolicitud_(ses, nit, tipo, medio) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false, mensaje: 'Vuelva a entrar.' };
  if (!ocPuede_(u, 'proveedores')) return { ok: false, mensaje: 'Su rol no puede pedirle documentos a un proveedor.' };

  var r = ocProveedor_(ses, nit);
  if (!r.ok) return r;
  var p = r.proveedor;
  medio = String(medio || 'CORREO').toUpperCase();
  if (GS_MEDIOS.indexOf(medio) < 0) medio = 'CORREO';

  var texto, asunto, que, destino;
  if (tipo === 'estadocuenta') {
    texto = gsTextoEstadoCuenta_(p, u);
    asunto = 'Social Solar S.A.S. — solicitud de estado de cuenta';
    que = 'Estado de cuenta';
    destino = medio === 'CORREO' ? (p.correoEdoCta || p.correoAsesor || p.correoFac)
                                 : (p.celAsesor || p.celular || p.fijo);
  } else if (tipo === 'credito') {
    texto = gsTextoCredito_(p, u);
    asunto = 'Social Solar S.A.S. — solicitud de cupo de credito';
    que = 'Cupo de credito';
    destino = medio === 'CORREO' ? (p.correoCredito || p.correoAsesor || p.correoFac)
                                 : (p.celAsesor || p.celular || p.fijo);
  } else if (tipo === 'otra') {
    texto = gsSaludo_(p) + '\n\nLe escribo de Social Solar S.A.S. (NIT 901.128.826-6).\n\n' +
            '[Escriba aqui que necesita.]' + gsPie_(u);
    asunto = 'Social Solar S.A.S. — solicitud';
    que = '';
    destino = medio === 'CORREO' ? (p.correoAsesor || p.correoFac) : (p.celAsesor || p.celular || p.fijo);
  } else {
    texto = gsTextoDocumentos_(p, u, medio === 'WHATSAPP');
    asunto = 'Social Solar — documentos pendientes de su registro como proveedor';
    que = 'Documentos: ' + p.faltantes.filter(function (x) { return x !== 'Correo estado de cuenta'; }).join(', ');
    destino = medio === 'CORREO' ? (p.correoAsesor || p.correoFac) : (p.celAsesor || p.celular || p.fijo);
  }

  return { ok: true, proveedor: p, medio: medio, tipo: tipo, destino: destino || '',
           asunto: asunto, texto: texto, quePidio: que,
           whatsapp: destino ? gsEnlaceWa_(destino, texto) : '' };
}

function gsEnlaceWa_(cel, texto) {
  var n = String(cel).replace(/\D/g, '');
  if (!n) return '';
  if (n.length === 10) n = '57' + n;
  return 'https://wa.me/' + n + '?text=' + encodeURIComponent(texto);
}

/**
 * Registra la solicitud. Por correo tambien la envia; por WhatsApp solo la
 * registra, porque el mensaje lo manda la persona desde su propio WhatsApp.
 */
function ocEnviarSolicitud_(ses, d) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false, mensaje: 'Vuelva a entrar.' };
  if (!ocPuede_(u, 'proveedores')) return { ok: false, mensaje: 'Su rol no puede pedirle documentos a un proveedor.' };

  var nit = String((d && d.nit) || '').replace(/\D/g, '');
  var medio = String((d && d.medio) || 'CORREO').toUpperCase();
  var destino = String((d && d.destino) || '').trim();
  var que = String((d && d.quePidio) || '').trim();
  var texto = String((d && d.texto) || '').trim();

  if (!nit) return { ok: false, mensaje: 'Falta el proveedor.' };
  if (!destino) return { ok: false, mensaje: medio === 'CORREO'
    ? 'No hay correo registrado para esto. Completelo en la ficha y vuelva a intentar.'
    : 'No hay celular registrado para esto. Completelo en la ficha y vuelva a intentar.' };
  if (!que) return { ok: false, mensaje: 'Escriba que le esta pidiendo, para que quede en la trazabilidad.' };

  var r = ocProveedor_(ses, nit);
  if (!r.ok) return r;

  if (medio === 'CORREO') {
    try {
      Correo_.enviar({ to: destino,
                       subject: String((d && d.asunto) || 'Social Solar S.A.S.'),
                       body: texto });
    } catch (e) {
      return { ok: false, mensaje: 'No se pudo enviar el correo: ' + e.message };
    }
  }

  var hoja = gsHoja_();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var num;
  try {
    num = gsNumero_(hoja);
    var fila = ocUltimaFila_(hoja) + 1;
    var v = new Array(GS_ANCHO);
    v[GS.numero - 1]      = num;
    v[GS.fecha - 1]       = new Date();
    v[GS.nit - 1]         = nit;
    v[GS.proveedor - 1]   = r.proveedor.nombre;
    v[GS.medio - 1]       = medio;
    v[GS.quePidio - 1]    = que;
    v[GS.destino - 1]     = destino;
    v[GS.quienPidio - 1]  = u.nombre;
    v[GS.estado - 1]      = 'SIN RESPUESTA';
    hoja.getRange(fila, 1, 1, GS_ANCHO).setValues([v]);
  } finally {
    lock.releaseLock();
  }

  /* Deja la marca en el maestro, para saber cuando se le escribio por ultima vez.
     Si la ficha no tenia el dato y aqui lo escribieron a mano, se guarda, para
     no volverlo a teclear. Nunca pisa un dato que ya estaba: solo llena el vacio.
     Son columnas de datos (J y M), no de formula. */
  try {
    var hp = gpHoja_();
    var f = gpBuscarFila_(hp, nit);
    if (f) {
      hp.getRange(f, GP.fechaEnvioLink).setValue(new Date());
      var col = medio === 'CORREO' ? GP.correoFac : GP.celular;
      if (!String(hp.getRange(f, col).getValue()).trim()) {
        hp.getRange(f, col).setValue(destino);
      }
    }
  } catch (e) { /* no es critico */ }

  return { ok: true, numero: num,
           mensaje: medio === 'CORREO'
             ? 'Correo enviado y registrado en la trazabilidad.'
             : 'Registrado. Ahora mande el mensaje desde WhatsApp con el boton verde.' };
}

/** Cierra una solicitud: contestada, o el documento llego pero no abre. */
function ocCerrarSolicitud_(ses, numero, resultado, nota) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false, mensaje: 'Vuelva a entrar.' };
  if (!ocPuede_(u, 'proveedores')) return { ok: false, mensaje: 'Su rol no puede cerrar solicitudes.' };

  var hoja = gsHoja_();
  var ult = ocUltimaFila_(hoja);
  if (ult < 2) return { ok: false, mensaje: 'No hay solicitudes.' };

  var v = hoja.getRange(2, GS.numero, ult - 1, 1).getValues();
  var fila = 0;
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]) === String(numero)) { fila = i + 2; break; }
  }
  if (!fila) return { ok: false, mensaje: 'No encontre esa solicitud.' };

  var estado = String(resultado || '').toUpperCase() === 'MALO' ? 'LLEGO MALO' : 'CONTESTADA';
  hoja.getRange(fila, GS.estado).setValue(estado);
  hoja.getRange(fila, GS.fechaRespuesta).setValue(new Date());
  var dias = gsDias_(hoja.getRange(fila, GS.fecha).getValue(), new Date());
  hoja.getRange(fila, GS.dias).setValue(dias);
  if (nota) hoja.getRange(fila, GS.nota).setValue(String(nota));

  return { ok: true, mensaje: estado === 'CONTESTADA'
    ? 'Listo. Contesto en ' + dias + ' dias.'
    : 'Marcada. El proveedor queda otra vez en pendientes para volver a pedirle.' };
}

/** Indicador de gestion de quien maneja compras. */
function ocGestionSolicitudes_(ses) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false };
  if (!ocPuede_(u, 'proveedores')) return { ok: false, mensaje: 'Su rol no tiene este indicador.' };

  var todas = gsTodas_();
  var resp = todas.filter(function (s) { return s.estado.toUpperCase() === 'CONTESTADA'; });
  var venc = todas.filter(function (s) {
    return s.estado.toUpperCase() !== 'CONTESTADA' && s.dias >= OC_DIAS_SOL;
  });
  var suma = 0;
  resp.forEach(function (s) { suma += Number(s.dias) || 0; });

  return { ok: true,
           enviadas: todas.length,
           contestadas: resp.length,
           vencidas: venc.length,
           promedio: resp.length ? Math.round(suma / resp.length) : 0,
           pendientes: venc.sort(function (a, b) { return b.dias - a.dias; }) };
}
