/* ---------- almacen: como llego la mercancia ---------- */

var OC_COMO_LLEGO = ['LLEGO BIEN', 'LLEGO AVERIADA', 'LLEGO INCOMPLETA', 'NO LLEGO'];

/**
 * Deja la constancia de almacen y se la muestra a quien pidio la orden en su
 * linea de tiempo. La foto es obligatoria cuando algo llego mal: es el soporte
 * para reclamarle al proveedor o a la transportadora, y la fecha demuestra que
 * se reclamo a tiempo.
 */
function ocRegistrarLlegada_(ses, numero, d, foto) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u, 'almacen')) {
    return { ok: false, mensaje: 'No tiene permiso para confirmar la llegada de mercancia.' };
  }

  var como = String((d && d.comoLlego) || '').toUpperCase();
  if (OC_COMO_LLEGO.indexOf(como) < 0) {
    return { ok: false, mensaje: 'Escoja como llego: bien, averiada, incompleta o no llego.' };
  }
  var bien = como === 'LLEGO BIEN';
  if (!bien && !String((d && d.observaciones) || '').trim()) {
    return { ok: false, mensaje: 'Cuente que paso con la mercancia: que falto o que llego averiado.' };
  }
  if (!bien && !(foto && foto.datos)) {
    return { ok: false, mensaje: 'Suba una foto de como llego. Sin la foto no hay con que reclamarle al proveedor.' };
  }

  var hoja = ocHoja_(OC_H_ORD);
  var fila = ocFilaOrden_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre esa orden.' };

  var enlace = ocFotoDeLlegada_(numero, foto);
  if (enlace && enlace.error) return { ok: false, mensaje: enlace.error };

  hoja.getRange(fila, 29).setValue(bien ? 'SI' : 'PARCIAL');
  hoja.getRange(fila, 30).setValue(d.fechaRecibido || new Date());
  hoja.getRange(fila, 31).setValue(d.recibidoPor || u.nombre);
  hoja.getRange(fila, OC_ORD_COMO).setValue(como);
  if (enlace) hoja.getRange(fila, OC_ORD_FOTO).setValue(enlace);
  if (d.observaciones) hoja.getRange(fila, OC_ORD_OBSA).setValue(String(d.observaciones));

  return { ok: true, foto: enlace || '',
           mensaje: bien
             ? 'Listo. Quien pidio la orden ya lo ve en su linea de tiempo.'
             : 'Registrado con la novedad y la foto. Quien pidio la orden ya lo ve, y queda el soporte para reclamar.' };
}

/** Guarda la foto de la llegada en la carpeta de la orden. */
function ocFotoDeLlegada_(numero, foto) {
  if (!(foto && foto.datos)) return '';
  try {
    var ext = (foto.nombre && foto.nombre.indexOf('.') > 0)
      ? foto.nombre.substring(foto.nombre.lastIndexOf('.')) : '.jpg';
    var blob = Utilities.newBlob(Utilities.base64Decode(foto.datos), foto.tipo || 'image/jpeg',
      'LLEGADA ' + numero + ' ' + Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd') + ext);
    return ocCarpeta_(numero).createFile(blob).getUrl();
  } catch (e) {
    return { error: 'No se pudo guardar la foto: ' + e.message };
  }
}
