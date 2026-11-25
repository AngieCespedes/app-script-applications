/**
 * GESTOR DE PROVEEDORES — la pantalla de compras.
 *
 * Regla de oro: esta pantalla NO toca la identidad del proveedor.
 * El NIT, el nombre, el estado del RUT y las compras salen del registro que
 * diligencia el proveedor y del historico de compras. Desde aqui solo se
 * escriben las columnas de CONTACTO y de NEGOCIACION.
 *
 * Hojas: 02 MAESTRO PROVEEDORES 2026 (lee y escribe parcial)
 *        01 REGISTRO Y DOCUMENTOS     (solo lee: RUT, certificacion, clave)
 */

/* Columnas de la hoja 02 */
var GP = {
  nit: 1, nombre: 2, tipoDoc: 3, primeraFE: 4, seVolvio: 5, registrado: 6,
  fechaRut: 7, estadoRut: 8, quePedirle: 9,
  celular: 10, fijo: 11, otros: 12, correoFac: 13,
  docs: 14, compras: 15, ultCompra: 16,
  creditoHoy: 17, tenemosCupo: 18, cupo: 19, plazo: 20,
  dcto: 21, pctDcto: 22, diasDcto: 23,
  asesor: 24, celAsesor: 25, correoAsesor: 26,
  correoCredito: 27, docsCredito: 28, correoEdoCta: 29, correoSoportes: 30,
  observaciones: 31, fechaEnvioLink: 32, fechaDiligenciado: 33, estado: 34, proxima: 35
};
var GP_ANCHO = 35;

/* Lo unico que esta pantalla puede escribir. Todo lo demas es de solo lectura
   aunque llegue en la peticion: asi una pantalla no puede dañar el maestro. */
var GP_EDITABLES = ['celular', 'fijo', 'otros', 'correoFac',
                    'creditoHoy', 'tenemosCupo', 'cupo', 'plazo',
                    'dcto', 'pctDcto', 'diasDcto',
                    'asesor', 'celAsesor', 'correoAsesor',
                    'correoCredito', 'docsCredito', 'correoEdoCta', 'correoSoportes',
                    'observaciones'];

/* Columnas de la hoja 01 (lo que subio el proveedor) */
var GR = { fecha: 1, nit: 2, nombre: 3, contacto: 4, celular: 5, ciudad: 6, regimen: 7,
           rut: 8, certificacion: 9, fechaRut: 10, verif: 11, correo: 12,
           responsabilidades: 13, observaciones: 14, inscrita: 15, clave: 17 };
var GR_ANCHO = 17;

function gpHoja_() { return ocHoja_(OC_H_PROV); }

function gpTexto_(v) { return v === null || v === undefined ? '' : String(v).trim(); }

/** Lo que le falta a un proveedor. Es la lista que manda toda la pantalla. */
function gpFaltantes_(p) {
  var f = [];
  if (!p.rutArchivo || gpTexto_(p.estadoRut).toUpperCase().indexOf('OK') < 0) f.push('RUT');
  if (!p.certArchivo) f.push('Cert. bancaria');
  if (!p.asesor && !p.correoAsesor) f.push('Asesor comercial');
  if (!p.creditoHoy || (gpTexto_(p.creditoHoy).toUpperCase() === 'SI' && !p.plazo)) f.push('Negociacion');
  if (!p.correoEdoCta) f.push('Correo estado de cuenta');
  return f;
}

/** Indice de la hoja 01 por NIT: documentos, clave del PDF y datos del registro. */
function gpRegistro_() {
  var hoja = ocHoja_('01 REGISTRO Y DOCUMENTOS');
  var ult = ocUltimaFila_(hoja);
  var idx = {};
  if (ult < 2) return idx;
  var d = hoja.getRange(2, 1, ult - 1, GR_ANCHO).getValues();
  for (var i = 0; i < d.length; i++) {
    var nit = gpTexto_(d[i][GR.nit - 1]).replace(/\D/g, '');
    if (!nit) continue;
    /* si el proveedor diligencio varias veces, se queda el ultimo */
    idx[nit] = {
      rut: gpTexto_(d[i][GR.rut - 1]),
      certificacion: gpTexto_(d[i][GR.certificacion - 1]),
      fecha: ocFecha_(d[i][GR.fecha - 1]),
      ciudad: gpTexto_(d[i][GR.ciudad - 1]),
      regimen: gpTexto_(d[i][GR.regimen - 1]),
      contacto: gpTexto_(d[i][GR.contacto - 1]),
      celular: gpTexto_(d[i][GR.celular - 1]),
      correo: gpTexto_(d[i][GR.correo - 1]),
      responsabilidades: gpTexto_(d[i][GR.responsabilidades - 1]),
      clave: gpTexto_(d[i][GR.clave - 1]),
      inscrita: gpTexto_(d[i][GR.inscrita - 1])
    };
  }
  return idx;
}

function gpFila_(fila, reg) {
  var p = {};
  Object.keys(GP).forEach(function (k) { p[k] = fila[GP[k] - 1]; });
  Object.keys(p).forEach(function (k) {
    if (k !== 'compras' && k !== 'docs' && k !== 'cupo' && k !== 'plazo' &&
        k !== 'pctDcto' && k !== 'diasDcto') p[k] = gpTexto_(p[k]);
  });
  p.nit = gpTexto_(p.nit).replace(/\D/g, '');
  p.compras = ocNum_(fila[GP.compras - 1]);
  p.ultCompra = ocFecha_(fila[GP.ultCompra - 1]);

  var r = reg[p.nit] || {};
  p.rutArchivo = r.rut || '';
  p.certArchivo = r.certificacion || '';
  p.clavePdf = r.clave || '';
  p.ciudad = r.ciudad || '';
  p.regimen = r.regimen || '';
  p.responsabilidades = r.responsabilidades || '';
  p.cuentaInscrita = r.inscrita || '';
  p.fechaRegistro = r.fecha || '';

  p.faltantes = gpFaltantes_(p);
  p.completo = p.faltantes.length === 0;
  p.esDocSoporte = gpTexto_(p.tipoDoc).toUpperCase().indexOf('SOPORTE') >= 0;
  return p;
}

/**
 * Lista para la pantalla. filtro: { falta, seguimiento, texto }
 * Solo la ven los roles con 'proveedores' o 'verproveedor'.
 * Quien solo tiene 'verproveedor' (gerencia, tesoreria, contabilidad) la ve,
 * pero el guardar se lo niega gpGuardar_.
 */
function ocProveedores_(ses, filtro) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false, mensaje: 'Vuelva a entrar.' };
  if (!ocPuede_(u.rol, 'proveedores') && !ocPuede_(u.rol, 'verproveedor')) {
    return { ok: false, mensaje: 'Su rol no tiene esta pantalla.' };
  }

  var hoja = gpHoja_();
  var ult = ocUltimaFila_(hoja);
  if (ult < 2) return { ok: true, filas: [], resumen: gpResumen_([]) };

  var d = hoja.getRange(2, 1, ult - 1, GP_ANCHO).getValues();
  var reg = gpRegistro_();
  var sol = gsSolicitudesPorNit_();

  var todos = [], filas = [];
  for (var i = 0; i < d.length; i++) {
    if (gpTexto_(d[i][0]) === '') continue;
    var p = gpFila_(d[i], reg);
    p.fila = i + 2;
    p.seguimiento = gsSeguimiento_(sol[p.nit] || []);
    todos.push(p);

    if (filtro) {
      if (filtro.falta && p.faltantes.indexOf(filtro.falta) < 0) continue;
      if (filtro.seguimiento && p.seguimiento.estado !== filtro.seguimiento) continue;
      if (filtro.texto) {
        var q = String(filtro.texto).toLowerCase();
        if (p.nombre.toLowerCase().indexOf(q) < 0 && p.nit.indexOf(q) < 0) continue;
      }
    }
    filas.push(p);
  }

  return { ok: true, filas: filas, resumen: gpResumen_(todos),
           puedeEditar: ocPuede_(u.rol, 'proveedores') };
}

function gpResumen_(lista) {
  var r = { total: lista.length, sinRut: 0, sinCert: 0, sinNegociacion: 0,
            esperando: 0, vencidas: 0, completos: 0, compras: 0 };
  lista.forEach(function (p) {
    r.compras += p.compras;
    if (p.faltantes.indexOf('RUT') >= 0) r.sinRut++;
    if (p.faltantes.indexOf('Cert. bancaria') >= 0) r.sinCert++;
    if (p.faltantes.indexOf('Negociacion') >= 0) r.sinNegociacion++;
    if (p.completo) r.completos++;
    if (p.seguimiento && p.seguimiento.estado === 'Pedido, esperando') r.esperando++;
    if (p.seguimiento && p.seguimiento.estado === 'Vencida') r.vencidas++;
  });
  return r;
}

/** La ficha completa de un proveedor, con sus solicitudes y estados de cuenta. */
function ocProveedor_(ses, nit) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false, mensaje: 'Vuelva a entrar.' };
  if (!ocPuede_(u.rol, 'proveedores') && !ocPuede_(u.rol, 'verproveedor')) {
    return { ok: false, mensaje: 'Su rol no tiene esta pantalla.' };
  }

  nit = String(nit || '').replace(/\D/g, '');
  var hoja = gpHoja_();
  var fila = gpBuscarFila_(hoja, nit);
  if (!fila) return { ok: false, mensaje: 'No encontre ese proveedor.' };

  var p = gpFila_(hoja.getRange(fila, 1, 1, GP_ANCHO).getValues()[0], gpRegistro_());
  p.fila = fila;
  var sol = gsSolicitudesDe_(nit);
  p.seguimiento = gsSeguimiento_(sol);

  return { ok: true, proveedor: p, solicitudes: sol, estados: geEstadosDe_(nit),
           puedeEditar: ocPuede_(u.rol, 'proveedores') };
}

function gpBuscarFila_(hoja, nit) {
  var ult = ocUltimaFila_(hoja);
  if (ult < 2) return 0;
  var v = hoja.getRange(2, GP.nit, ult - 1, 1).getValues();
  for (var i = 0; i < v.length; i++) {
    if (gpTexto_(v[i][0]).replace(/\D/g, '') === nit) return i + 2;
  }
  return 0;
}

/**
 * Guarda contacto y negociacion. Un campo que llegue vacio NO borra lo que ya
 * estaba: asi se puede completar de a poquitos sin perder nada.
 */
function ocGuardarProveedor_(ses, nit, d) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false, mensaje: 'Vuelva a entrar.' };
  if (!ocPuede_(u.rol, 'proveedores')) {
    return { ok: false, mensaje: 'Su rol puede consultar, pero no modificar el maestro de proveedores.' };
  }

  nit = String(nit || '').replace(/\D/g, '');
  var hoja = gpHoja_();
  var fila = gpBuscarFila_(hoja, nit);
  if (!fila) return { ok: false, mensaje: 'No encontre ese proveedor.' };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var cambios = 0;
  try {
    GP_EDITABLES.forEach(function (k) {
      if (!(k in d)) return;
      var nuevo = d[k];
      if (nuevo === null || nuevo === undefined || String(nuevo).trim() === '') return;
      var celda = hoja.getRange(fila, GP[k]);
      if (gpTexto_(celda.getValue()) === gpTexto_(nuevo)) return;
      celda.setValue(nuevo);
      cambios++;
    });
    if (cambios) {
      hoja.getRange(fila, GP.estado).setValue('DILIGENCIADO');
      hoja.getRange(fila, GP.fechaDiligenciado).setValue(new Date());
      var obs = gpTexto_(hoja.getRange(fila, GP.observaciones).getValue());
      var marca = 'Completado por ' + u.nombre + ' el ' + ocHoyTexto_();
      if (obs.indexOf('Completado por') < 0) {
        hoja.getRange(fila, GP.observaciones).setValue((obs ? obs + ' | ' : '') + marca);
      }
    }
  } finally {
    lock.releaseLock();
  }

  return { ok: true, cambios: cambios,
           mensaje: cambios ? 'Guardado. Se actualizaron ' + cambios + ' datos.'
                            : 'No habia nada nuevo que guardar.' };
}

function ocHoyTexto_() {
  return Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy');
}
