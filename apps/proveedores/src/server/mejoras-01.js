/**
 * MEJORAS Y FALLAS — el boton rojo que ve cualquier rol.
 * Quien usa la plataforma reporta desde adentro, sin salir a buscar a nadie,
 * y el reporte llega con quien lo escribio, su rol y en que pantalla estaba.
 * Hoja: 16 MEJORAS Y FALLAS.
 */

var MJ_COL = {
  numero: 1, fecha: 2, usuario: 3, nombre: 4, rol: 5, pantalla: 6,
  tipo: 7, titulo: 8, detalle: 9, pantallazo: 10, estado: 11, respuesta: 12, fechaCierre: 13
};
var MJ_ANCHO = 13;
var MJ_TIPOS = ['FALLA', 'MEJORA', 'DUDA'];

function mjHoja_() {
  var h = SpreadsheetApp.openById(OC_SS).getSheetByName(OC_H_MEJ);
  if (!h) throw new Error('Falta la hoja ' + OC_H_MEJ + '. Corra «Instalar o actualizar» desde el menu.');
  return h;
}

function mjNumero_(hoja) {
  var ult = ocUltimaFila_(hoja);
  if (ult < 2) return 1;
  var v = hoja.getRange(2, MJ_COL.numero, ult - 1, 1).getValues();
  var max = 0;
  for (var i = 0; i < v.length; i++) {
    var n = Number(v[i][0]);
    if (!isNaN(n) && n > max && n < 1000000) max = n;
  }
  return max + 1;
}

/**
 * Guarda un reporte. El pantallazo es opcional pero se pide siempre:
 * sin imagen casi nunca se puede reproducir la falla.
 */
function mjReportar_(ses, d, imagen) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false, mensaje: 'Vuelva a entrar.' };

  var tipo = String((d && d.tipo) || '').toUpperCase();
  if (MJ_TIPOS.indexOf(tipo) < 0) tipo = 'MEJORA';

  var titulo = String((d && d.titulo) || '').trim();
  if (titulo.length < 5) return { ok: false, mensaje: 'Escriba en una linea que paso o que mejoraria.' };

  var detalle = String((d && d.detalle) || '').trim();
  if (tipo === 'FALLA' && detalle.length < 10) {
    return { ok: false, mensaje: 'Para una falla, cuente que estaba haciendo justo antes: en que pantalla estaba y que boton oprimio.' };
  }

  var enlace = '';
  if (imagen && imagen.datos) {
    try {
      enlace = mjGuardarImagen_(imagen, u);
    } catch (e) {
      enlace = 'NO SE PUDO GUARDAR LA IMAGEN: ' + e.message;
    }
  }

  var hoja = mjHoja_();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var num;
  try {
    num = mjNumero_(hoja);
    var fila = ocUltimaFila_(hoja) + 1;
    var v = new Array(MJ_ANCHO);
    v[MJ_COL.numero - 1]     = num;
    v[MJ_COL.fecha - 1]      = new Date();
    v[MJ_COL.usuario - 1]    = u.usuario;
    v[MJ_COL.nombre - 1]     = u.nombre;
    v[MJ_COL.rol - 1]        = u.rol;
    v[MJ_COL.pantalla - 1]   = String((d && d.pantalla) || '');
    v[MJ_COL.tipo - 1]       = tipo;
    v[MJ_COL.titulo - 1]     = titulo;
    v[MJ_COL.detalle - 1]    = detalle;
    v[MJ_COL.pantallazo - 1] = enlace;
    v[MJ_COL.estado - 1]     = 'NUEVO';
    hoja.getRange(fila, 1, 1, MJ_ANCHO).setValues([v]);
  } finally {
    lock.releaseLock();
  }

  mjAvisar_(u, tipo, titulo, detalle, enlace, num);

  return { ok: true, numero: num,
           mensaje: tipo === 'FALLA'
             ? 'Reporte ' + num + ' enviado. Gracias: con el pantallazo se puede arreglar mucho mas rapido.'
             : 'Mejora ' + num + ' enviada. Gracias por ayudar a mejorar la plataforma.' };
}

function mjCarpeta_() {
  var raiz = Aislamiento_.carpeta(OC_RAIZ);
  var it = raiz.getFoldersByName('REPORTES DE LA PLATAFORMA');
  return it.hasNext() ? it.next() : raiz.createFolder('REPORTES DE LA PLATAFORMA');
}

function mjGuardarImagen_(imagen, u) {
  var blob = Utilities.newBlob(
    Utilities.base64Decode(imagen.datos),
    imagen.tipo || 'image/png',
    mjFechaArchivo_() + ' ' + u.usuario + ' ' + (imagen.nombre || 'pantallazo.png')
  );
  return mjCarpeta_().createFile(blob).getUrl();
}

function mjFechaArchivo_() {
  return Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd HHmm');
}

function mjAvisar_(u, tipo, titulo, detalle, enlace, num) {
  try {
    Correo_.enviar({
      to: Session.getEffectiveUser().getEmail(),
      subject: '[Portal] ' + tipo + ' ' + num + ' — ' + titulo,
      body: 'Reporto: ' + u.nombre + ' (' + u.usuario + ', ' + u.rol + ')\n\n' +
            'Tipo: ' + tipo + '\n' +
            'Titulo: ' + titulo + '\n\n' +
            'Detalle:\n' + (detalle || '(sin detalle)') + '\n\n' +
            (enlace ? 'Pantallazo: ' + enlace + '\n' : 'Sin pantallazo.\n')
    });
  } catch (e) { /* el reporte ya quedo guardado: el correo es un extra */ }
}

/** Lista para el administrador: que se ha reportado y que falta por resolver. */
function mjListar_(ses) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false };
  var mio = !ocPuede_(u.rol, 'usuarios');

  var hoja = mjHoja_();
  var ult = ocUltimaFila_(hoja);
  if (ult < 2) return { ok: true, filas: [], resumen: { total: 0, nuevos: 0 } };

  var d = hoja.getRange(2, 1, ult - 1, MJ_ANCHO).getValues();
  var filas = [], nuevos = 0;
  for (var i = 0; i < d.length; i++) {
    if (String(d[i][0]).trim() === '') continue;
    if (mio && !ocIgual_(d[i][MJ_COL.usuario - 1], u.usuario)) continue;
    var r = {
      numero: d[i][MJ_COL.numero - 1],
      fecha: ocFecha_(d[i][MJ_COL.fecha - 1]),
      nombre: String(d[i][MJ_COL.nombre - 1]),
      rol: String(d[i][MJ_COL.rol - 1]),
      pantalla: String(d[i][MJ_COL.pantalla - 1]),
      tipo: String(d[i][MJ_COL.tipo - 1]),
      titulo: String(d[i][MJ_COL.titulo - 1]),
      detalle: String(d[i][MJ_COL.detalle - 1]),
      pantallazo: String(d[i][MJ_COL.pantallazo - 1]),
      estado: String(d[i][MJ_COL.estado - 1] || 'NUEVO'),
      respuesta: String(d[i][MJ_COL.respuesta - 1] || '')
    };
    if (r.estado.toUpperCase() === 'NUEVO') nuevos++;
    filas.push(r);
  }
  filas.reverse();
  return { ok: true, filas: filas, resumen: { total: filas.length, nuevos: nuevos }, admin: !mio };
}
