/**
 * API — única puerta de la página: google.script.run.api('accion', ...argumentos).
 * tipo 'web'  → la función valida su propia sesión o es un formulario público (revisado en MIGRACION.md).
 * tipo 'hoja' → solo desde un diálogo dentro de la hoja, con cuenta de Google.
 * Generado por scripts/migrar-legado.js; si se agrega una pantalla, se agrega su ruta aquí.
 */
var Rutas_ = {
  agregarProyectos: { tipo: 'hoja', fn: function () { return agregarProyectos_.apply(null, arguments); } },
  appAgregarPresupuesto: { tipo: 'web', fn: function () { return appAgregarPresupuesto_.apply(null, arguments); } },
  appAmpliarSolicitud: { tipo: 'web', fn: function () { return appAmpliarSolicitud_.apply(null, arguments); } },
  appAnularEntrega: { tipo: 'web', fn: function () { return appAnularEntrega_.apply(null, arguments); } },
  appCrearProyecto: { tipo: 'web', fn: function () { return appCrearProyecto_.apply(null, arguments); } },
  appCrearSolicitud: { tipo: 'web', fn: function () { return appCrearSolicitud_.apply(null, arguments); } },
  appDatos: { tipo: 'web', fn: function () { return appDatos_.apply(null, arguments); } },
  appDecidir: { tipo: 'web', fn: function () { return appDecidir_.apply(null, arguments); } },
  appDetalle: { tipo: 'web', fn: function () { return appDetalle_.apply(null, arguments); } },
  appEntrar: { tipo: 'web', fn: function () { return appEntrar_.apply(null, arguments); } },
  appEnviarRevision: { tipo: 'web', fn: function () { return appEnviarRevision_.apply(null, arguments); } },
  appEstado: { tipo: 'web', fn: function () { return appEstado_.apply(null, arguments); } },
  appGuardarGasto: { tipo: 'web', fn: function () { return appGuardarGasto_.apply(null, arguments); } },
  appGuardarPresupuesto: { tipo: 'web', fn: function () { return appGuardarPresupuesto_.apply(null, arguments); } },
  appGuardarTecnicos: { tipo: 'web', fn: function () { return appGuardarTecnicos_.apply(null, arguments); } },
  appPedirCodigo: { tipo: 'web', fn: function () { return appPedirCodigo_.apply(null, arguments); } },
  appQuitarPresupuesto: { tipo: 'web', fn: function () { return appQuitarPresupuesto_.apply(null, arguments); } },
  appRegistrarEntrega: { tipo: 'web', fn: function () { return appRegistrarEntrega_.apply(null, arguments); } },
  appSalir: { tipo: 'web', fn: function () { return appSalir_.apply(null, arguments); } },
  appVerificarCodigo: { tipo: 'web', fn: function () { return appVerificarCodigo_.apply(null, arguments); } }
};

function api(accion) {
  var ruta = Rutas_[String(accion || '')];
  if (!ruta) throw new Error('Operación no permitida: ' + accion);
  if (ruta.tipo === 'hoja') Guardas_.persona();
  return ruta.fn.apply(null, Array.prototype.slice.call(arguments, 1));
}
