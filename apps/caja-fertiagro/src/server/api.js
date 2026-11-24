/**
 * API — única puerta de la página: google.script.run.api('accion', ...argumentos).
 * tipo 'web'  → la función valida su propia sesión o es un formulario público (revisado en MIGRACION.md).
 * tipo 'hoja' → solo desde un diálogo dentro de la hoja, con cuenta de Google.
 * Generado por scripts/migrar-legado.js; si se agrega una pantalla, se agrega su ruta aquí.
 */
var Rutas_ = {
  analitica: { tipo: 'web', fn: function () { return analitica_.apply(null, arguments); } },
  anularMovimiento: { tipo: 'web', fn: function () { return anularMovimiento_.apply(null, arguments); } },
  anularPagoBanco: { tipo: 'web', fn: function () { return anularPagoBanco_.apply(null, arguments); } },
  datosPago: { tipo: 'web', fn: function () { return datosPago_.apply(null, arguments); } },
  exportar: { tipo: 'web', fn: function () { return exportar_.apply(null, arguments); } },
  exportarArqueo: { tipo: 'web', fn: function () { return exportarArqueo_.apply(null, arguments); } },
  exportarBanco: { tipo: 'web', fn: function () { return exportarBanco_.apply(null, arguments); } },
  getDatos: { tipo: 'web', fn: function () { return getDatos_.apply(null, arguments); } },
  guardarUsuario: { tipo: 'web', fn: function () { return guardarUsuario_.apply(null, arguments); } },
  listarUsuarios: { tipo: 'web', fn: function () { return listarUsuarios_.apply(null, arguments); } },
  login: { tipo: 'web', fn: function () { return login_.apply(null, arguments); } },
  movimientos: { tipo: 'web', fn: function () { return movimientos_.apply(null, arguments); } },
  pagosBanco: { tipo: 'web', fn: function () { return pagosBanco_.apply(null, arguments); } },
  registrarCierre: { tipo: 'web', fn: function () { return registrarCierre_.apply(null, arguments); } },
  registrarMovimiento: { tipo: 'web', fn: function () { return registrarMovimiento_.apply(null, arguments); } },
  registrarPagoBanco: { tipo: 'web', fn: function () { return registrarPagoBanco_.apply(null, arguments); } },
  registrosPersona: { tipo: 'web', fn: function () { return registrosPersona_.apply(null, arguments); } },
  salir: { tipo: 'web', fn: function () { return salir_.apply(null, arguments); } }
};

function api(accion) {
  var ruta = Rutas_[String(accion || '')];
  if (!ruta) throw new Error('Operación no permitida: ' + accion);
  if (ruta.tipo === 'hoja') Guardas_.persona();
  return ruta.fn.apply(null, Array.prototype.slice.call(arguments, 1));
}
