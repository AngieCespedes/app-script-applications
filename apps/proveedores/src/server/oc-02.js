/* Crea un centro de costo desde la misma orden, cuando el proyecto
   todavia no esta en la lista. Entra como POR VALIDAR para que Angie
   lo confirme despues; la orden no se frena por eso. */
function ocCrearCentro_(ses, codigo, nombre) {
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

function ocBuscarProveedor_(ses, nit) {
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

function ocRetenciones_(ses, concepto, base, iva, declarante, tarifaIca) {
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
  var raiz = Aislamiento_.carpeta(OC_RAIZ);
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

function ocCrearOrden_(ses, d, cotizacion) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u.rol, 'solicitar')) return { ok: false, mensaje: 'No tiene permiso para crear ordenes.' };

  var prov = ocBuscarProveedor_(ses, d.nit);
  if (!prov.encontrado) return { ok: false, mensaje: prov.mensaje };
  if (!String(d.centro || '').trim()) return { ok: false, mensaje: 'Escoja el centro de costo.' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { ok: false, mensaje: 'El sistema esta ocupado, intente otra vez.' }; }

  try {
    var hoja = ocHoja_(OC_H_ORD);
    var numero = ocNumeroNuevo_(hoja);
    var fila = ocFilaNueva_(hoja);

    var r = ocRetenciones_(ses, d.concepto, d.base, d.iva, d.declarante !== false, d.tarifaIca);
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

function ocReemplazarCotizacion_(ses, numero, archivo) {
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

function ocDecidir_(ses, numero, decision, comentario) {
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

