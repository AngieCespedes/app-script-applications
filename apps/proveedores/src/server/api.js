/**
 * API — única puerta de la página: google.script.run.api('accion', ...argumentos).
 * tipo 'web'  → la función valida su propia sesión o es un formulario público (revisado en MIGRACION.md).
 * tipo 'hoja' → solo desde un diálogo dentro de la hoja, con cuenta de Google.
 * Generado por scripts/migrar-legado.js; si se agrega una pantalla, se agrega su ruta aquí.
 */
var Rutas_ = {
  consultarNit: { tipo: 'web', fn: function () { return consultarNit_.apply(null, arguments); } },
  ocBuscarProveedor: { tipo: 'web', fn: function () { return ocBuscarProveedor_.apply(null, arguments); } },
  ocCambiarMiContrasena: { tipo: 'web', fn: function () { return ocCambiarMiContrasena_.apply(null, arguments); } },
  ocCausar: { tipo: 'web', fn: function () { return ocCausar_.apply(null, arguments); } },
  ocCrearCentro: { tipo: 'web', fn: function () { return ocCrearCentro_.apply(null, arguments); } },
  ocCompletarPago: { tipo: 'web', fn: function () { return ocCompletarPago_.apply(null, arguments); } },
  ocCrearOrden: { tipo: 'web', fn: function () { return ocCrearOrden_.apply(null, arguments); } },
  ocDatosEnvio: { tipo: 'web', fn: function () { return ocDatosEnvio_.apply(null, arguments); } },
  ocDecidir: { tipo: 'web', fn: function () { return ocDecidir_.apply(null, arguments); } },
  ocEditarOrden: { tipo: 'web', fn: function () { return ocEditarOrden_.apply(null, arguments); } },
  ocReemplazarCotizacion: { tipo: 'web', fn: function () { return ocReemplazarCotizacion_.apply(null, arguments); } },
  ocEnlaceSoporte: { tipo: 'web', fn: function () { return ocEnlaceSoporte_.apply(null, arguments); } },
  ocEnviarSoporte: { tipo: 'web', fn: function () { return ocEnviarSoporte_.apply(null, arguments); } },
  ocEntrar: { tipo: 'web', fn: function () { return ocEntrar_.apply(null, arguments); } },
  ocMarcarWhatsapp: { tipo: 'web', fn: function () { return ocMarcarWhatsapp_.apply(null, arguments); } },
  ocGuardarPermisos: { tipo: 'web', fn: function () { return ocGuardarPermisos_.apply(null, arguments); } },
  ocGuardarUsuario: { tipo: 'web', fn: function () { return ocGuardarUsuario_.apply(null, arguments); } },
  ocNuevaClave: { tipo: 'web', fn: function () { return ocNuevaClave_.apply(null, arguments); } },
  ocInformePagos: { tipo: 'web', fn: function () { return ocInformePagos_.apply(null, arguments); } },
  ocListas: { tipo: 'web', fn: function () { return ocListas_.apply(null, arguments); } },
  ocMensajeProveedor: { tipo: 'web', fn: function () { return ocMensajeProveedor_.apply(null, arguments); } },
  ocOrdenes: { tipo: 'web', fn: function () { return ocOrdenes_.apply(null, arguments); } },
  ocDatosPago: { tipo: 'web', fn: function () { return ocDatosPago_.apply(null, arguments); } },
  ocRevisarRetencion: { tipo: 'web', fn: function () { return ocRevisarRetencion_.apply(null, arguments); } },
  ocPagoDirecto: { tipo: 'web', fn: function () { return ocPagoDirecto_.apply(null, arguments); } },
  ocPagos: { tipo: 'web', fn: function () { return ocPagos_.apply(null, arguments); } },
  ocArmarSolicitud: { tipo: 'web', fn: function () { return ocArmarSolicitud_.apply(null, arguments); } },
  ocCerrarSolicitud: { tipo: 'web', fn: function () { return ocCerrarSolicitud_.apply(null, arguments); } },
  ocEnlaceArchivo: { tipo: 'web', fn: function () { return ocEnlaceArchivo_.apply(null, arguments); } },
  ocEnviarSolicitud: { tipo: 'web', fn: function () { return ocEnviarSolicitud_.apply(null, arguments); } },
  ocGestionSolicitudes: { tipo: 'web', fn: function () { return ocGestionSolicitudes_.apply(null, arguments); } },
  ocGuardarProveedor: { tipo: 'web', fn: function () { return ocGuardarProveedor_.apply(null, arguments); } },
  ocInforme: { tipo: 'web', fn: function () { return ocInforme_.apply(null, arguments); } },
  ocProveedor: { tipo: 'web', fn: function () { return ocProveedor_.apply(null, arguments); } },
  ocProveedores: { tipo: 'web', fn: function () { return ocProveedores_.apply(null, arguments); } },
  ocRegistrarLlegada: { tipo: 'web', fn: function () { return ocRegistrarLlegada_.apply(null, arguments); } },
  ocSubirEstadoCuenta: { tipo: 'web', fn: function () { return ocSubirEstadoCuenta_.apply(null, arguments); } },
  mjListar: { tipo: 'web', fn: function () { return mjListar_.apply(null, arguments); } },
  mjReportar: { tipo: 'web', fn: function () { return mjReportar_.apply(null, arguments); } },
  ocRegistrarFactura: { tipo: 'web', fn: function () { return ocRegistrarFactura_.apply(null, arguments); } },
  ocRegistrarPago: { tipo: 'web', fn: function () { return ocRegistrarPago_.apply(null, arguments); } },
  ocRetenciones: { tipo: 'web', fn: function () { return ocRetenciones_.apply(null, arguments); } },
  ocUsuarios: { tipo: 'web', fn: function () { return ocUsuarios_.apply(null, arguments); } },
  registrarProveedorCompleto: { tipo: 'web', fn: function () { return registrarProveedorCompleto_.apply(null, arguments); } }
};

function api(accion) {
  var ruta = Rutas_[String(accion || '')];
  if (!ruta) throw new Error('Operación no permitida: ' + accion);
  if (ruta.tipo === 'hoja') Guardas_.persona();
  return ruta.fn.apply(null, Array.prototype.slice.call(arguments, 1));
}
