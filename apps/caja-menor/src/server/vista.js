/**
 * Vista — arma la página a partir de archivos parciales (client/*).
 * Se usa desde la plantilla: <?!= Vista.incluir('client/estilos') ?>
 */
var Vista = (function () {
  function incluir(nombre) { return HtmlService.createHtmlOutputFromFile(nombre).getContent(); }
  return { incluir: incluir };
})();
