/**
 * Envio del soporte de pago.
 *
 * Por correo va el PDF ADJUNTO de verdad: el script lo baja de Drive con su propio
 * permiso y lo manda en el mensaje. El proveedor no necesita acceso a Drive y nunca
 * ve la carpeta de soportes, que tiene los pagos de todos los demas.
 *
 * Por WhatsApp solo se puede mandar texto. A un proveedor se le manda el aviso sin
 * enlace; a alguien de la empresa si se le manda el enlace, porque si tiene acceso.
 *
 * Los contactos del proveedor se LEEN del maestro 02. Esta hoja no se modifica nunca
 * desde aqui: si se escribe otro correo, se usa solo para ese envio.
 */

/* ---------- contactos (solo lectura) ---------- */

function ocContactosProveedor_(nit) {
  var limpio = String(nit || '').replace(/\D/g, '');
  var vacio = { correos: [], celulares: [], nombre: '' };
  if (!limpio) return vacio;

  var hoja = ocHoja_(OC_H_PROV);
  if (!hoja) return vacio;
  var ult = ocUltimaFila_(hoja);
  if (ult < 2) return vacio;

  var d = hoja.getRange(2, 1, ult - 1, 31).getValues();
  for (var i = 0; i < d.length; i++) {
    if (String(d[i][0]).replace(/\D/g, '') !== limpio) continue;
    return {
      nombre: String(d[i][1]).trim(),
      correos: ocCorreosDe_([
        { valor: d[i][29], etiqueta: 'correo para soportes de pago' },
        { valor: d[i][12], etiqueta: 'correo de las facturas' },
        { valor: d[i][25], etiqueta: 'correo del asesor' }
      ]),
      celulares: ocCelularesDe_([
        { valor: d[i][9],  etiqueta: 'celular del proveedor' },
        { valor: d[i][24], etiqueta: 'celular del asesor' }
      ])
    };
  }
  return vacio;
}

function ocCorreosDe_(lista) {
  var r = [], vistos = {};
  for (var i = 0; i < lista.length; i++) {
    var v = String(lista[i].valor || '').trim().split(/[;,\s]+/)[0];
    if (v.indexOf('@') < 1 || vistos[v.toLowerCase()]) continue;
    vistos[v.toLowerCase()] = true;
    r.push({ correo: v, etiqueta: lista[i].etiqueta });
  }
  return r;
}

function ocCelularesDe_(lista) {
  var r = [], vistos = {};
  for (var i = 0; i < lista.length; i++) {
    var v = String(lista[i].valor || '').replace(/\D/g, '');
    if (v.length < 7 || vistos[v]) continue;
    vistos[v] = true;
    r.push({ celular: v, etiqueta: lista[i].etiqueta });
  }
  return r;
}

/* ---------- lo que la pantalla necesita para armar el envio ---------- */

function ocDatosEnvio_(ses, numero) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u, 'pagar')) return { ok: false, mensaje: 'No tiene permiso.' };

  var hoja = ocHoja_(OC_H_PAG);
  var fila = ocFilaPago_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre el pago ' + numero + '.' };

  var p = ocPagoFila_(hoja.getRange(fila, 1, 1, PG_ANCHO).getValues(), 0);
  if (!p.soporte) return { ok: false, mensaje: 'Ese pago todavia no tiene soporte archivado.' };

  var c = ocContactosProveedor_(p.nit);
  return {
    ok: true, pago: p, contactos: c,
    asunto: ocAsuntoSoporte_(p),
    mensaje: ocTextoSoporte_(p, false),
    whatsapp: ocTextoSoporte_(p, true),
    produccion: Config_.enProduccion()
  };
}

function ocAsuntoSoporte_(p) {
  return 'Social Solar S.A.S. - Soporte de pago ' + p.fecha +
         (p.comprobante ? ' - CE ' + p.comprobante : '');
}

function ocTextoSoporte_(p, corto) {
  var quien = p.proveedor || 'senores';
  if (corto) {
    return 'Buen dia. SOCIAL SOLAR S.A.S. le informa que el ' + p.fecha +
           ' se realizo el pago por ' + ocPesos_(p.valor) +
           (p.comprobante ? ', comprobante de egreso ' + p.comprobante : '') +
           '. Le adjuntamos el soporte del pago. Gracias.';
  }
  return 'Buen dia, ' + quien + '.\n\n' +
         'SOCIAL SOLAR S.A.S., NIT 901.128.826-6, les informa que se realizo el siguiente pago:\n\n' +
         '  Fecha: ' + p.fecha + '\n' +
         '  Valor: ' + ocPesos_(p.valor) + '\n' +
         (p.banco ? '  Medio: ' + p.banco + '\n' : '') +
         (p.comprobante ? '  Comprobante de egreso: ' + p.comprobante + '\n' : '') +
         (p.orden ? '  Orden de compra: ' + p.orden + '\n' : '') +
         '\nAdjuntamos el soporte del pago.\n\n' +
         'Cordialmente,\nSOCIAL SOLAR S.A.S.\nTesoreria';
}

/* ---------- envio ---------- */

function ocEnviarSoporte_(ses, numero, destino) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u, 'pagar')) return { ok: false, mensaje: 'No tiene permiso.' };

  var hoja = ocHoja_(OC_H_PAG);
  var fila = ocFilaPago_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre el pago ' + numero + '.' };

  var p = ocPagoFila_(hoja.getRange(fila, 1, 1, PG_ANCHO).getValues(), 0);
  if (!p.soporte) return { ok: false, mensaje: 'Ese pago todavia no tiene soporte archivado.' };

  var correo = String((destino && destino.correo) || '').trim();
  if (correo.indexOf('@') < 1) return { ok: false, mensaje: 'Escriba un correo valido.' };

  var adjunto = ocBlobDelSoporte_(p.soporte);
  if (!adjunto) {
    return { ok: false, mensaje: 'No pude abrir el soporte en Drive. Revise el enlace de la hoja 11.' };
  }

  Correo_.enviarGmail({
    to: correo,
    subject: String((destino && destino.asunto) || ocAsuntoSoporte_(p)),
    body: String((destino && destino.mensaje) || ocTextoSoporte_(p, false)),
    attachments: [adjunto],
    name: 'Social Solar S.A.S.'
  });

  ocMarcarAviso_(hoja, fila, correo, u);
  return { ok: true, correo: correo, produccion: Config_.enProduccion() };
}

/* El soporte se baja de Drive con el permiso del script, no del proveedor. */
function ocBlobDelSoporte_(link) {
  var m = String(link || '').match(/[-\w]{25,}/);
  if (!m) return null;
  try {
    return DriveApp.getFileById(m[0]).getBlob();
  } catch (e) {
    return null;
  }
}

function ocMarcarAviso_(hoja, fila, correo, u) {
  var marca = Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy') +
              ' a ' + correo + ' (' + u.nombre + ')';
  hoja.getRange(fila, PG_COL.aviso).setValue(marca);
}

/* ---------- enlace de descarga para un solo soporte ---------- */

/* Abre SOLO ese PDF a quien tenga el enlace, nunca la carpeta. Se usa cuando
   el soporte se manda por WhatsApp, que no deja adjuntar archivos. */
function ocEnlaceSoporte_(ses, numero) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u, 'pagar')) return { ok: false, mensaje: 'No tiene permiso.' };

  var hoja = ocHoja_(OC_H_PAG);
  var fila = ocFilaPago_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre el pago ' + numero + '.' };

  var p = ocPagoFila_(hoja.getRange(fila, 1, 1, PG_ANCHO).getValues(), 0);
  if (!p.soporte) return { ok: false, mensaje: 'Ese pago todavia no tiene soporte archivado.' };

  var m = String(p.soporte).match(/[-\w]{25,}/);
  if (!m) return { ok: false, mensaje: 'El enlace del soporte en la hoja 11 no sirve.' };

  try {
    var archivo = DriveApp.getFileById(m[0]);
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return {
      ok: true,
      enlace: 'https://drive.google.com/uc?export=download&id=' + m[0],
      nombre: archivo.getName()
    };
  } catch (e) {
    return { ok: false, mensaje: 'Google no dejo abrir ese archivo por enlace (' + e.message +
      '). Mande el PDF adjunto por correo, o bajelo y adjuntelo en el chat.' };
  }
}

/* ---------- WhatsApp: la pagina abre el chat, el servidor solo deja la marca ---------- */

function ocMarcarWhatsapp_(ses, numero, celular) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u, 'pagar')) return { ok: false, mensaje: 'No tiene permiso.' };

  var hoja = ocHoja_(OC_H_PAG);
  var fila = ocFilaPago_(hoja, numero);
  if (!fila) return { ok: false, mensaje: 'No encontre el pago ' + numero + '.' };

  var marca = Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy') +
              ' WhatsApp a ' + String(celular || '').replace(/\D/g, '') + ' (' + u.nombre + ')';
  var ya = String(hoja.getRange(fila, PG_COL.aviso).getValue()).trim();
  hoja.getRange(fila, PG_COL.aviso).setValue(ya ? ya + ' | ' + marca : marca);
  return { ok: true };
}
