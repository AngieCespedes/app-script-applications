/**
 * API — única puerta de la página: google.script.run.api('accion', ...argumentos).
 * tipo 'web'  → la función valida su propia sesión o es un formulario público (revisado en MIGRACION.md).
 * tipo 'hoja' → solo desde un diálogo dentro de la hoja, con cuenta de Google.
 * Generado por scripts/migrar-legado.js; si se agrega una pantalla, se agrega su ruta aquí.
 */
var Rutas_ = {
  procesarCliente: { tipo: 'web', fn: function () { return procesarCliente_.apply(null, arguments); } }
};

function api(accion) {
  var ruta = Rutas_[String(accion || '')];
  if (!ruta) throw new Error('Operación no permitida: ' + accion);
  if (ruta.tipo === 'hoja') Guardas_.persona();
  return ruta.fn.apply(null, Array.prototype.slice.call(arguments, 1));
}
