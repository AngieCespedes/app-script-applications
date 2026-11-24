/**
 * API — única puerta de la página: google.script.run.api('accion', ...argumentos).
 * tipo 'web'  → la función valida su propia sesión o es un formulario público (revisado en MIGRACION.md).
 * tipo 'hoja' → solo desde un diálogo dentro de la hoja, con cuenta de Google.
 * Generado por scripts/migrar-legado.js; si se agrega una pantalla, se agrega su ruta aquí.
 */
var Rutas_ = {
  crearNoListado: { tipo: 'web', fn: function () { return crearNoListado_.apply(null, arguments); } },
  entrar: { tipo: 'web', fn: function () { return entrar_.apply(null, arguments); } },
  estadoProducto: { tipo: 'web', fn: function () { return estadoProducto_.apply(null, arguments); } },
  getCategorias: { tipo: 'web', fn: function () { return getCategorias_.apply(null, arguments); } },
  getLista: { tipo: 'web', fn: function () { return getLista_.apply(null, arguments); } },
  getPanel: { tipo: 'web', fn: function () { return getPanel_.apply(null, arguments); } },
  guardarConteo: { tipo: 'web', fn: function () { return guardarConteo_.apply(null, arguments); } }
};

function api(accion) {
  var ruta = Rutas_[String(accion || '')];
  if (!ruta) throw new Error('Operación no permitida: ' + accion);
  if (ruta.tipo === 'hoja') Guardas_.persona();
  return ruta.fn.apply(null, Array.prototype.slice.call(arguments, 1));
}
