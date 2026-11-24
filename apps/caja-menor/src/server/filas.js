/**
 * Filas — lógica pura para convertir entre objetos y filas de una tabla
 * usando los encabezados. Nunca se escribe por posición fija.
 */
var Filas = (function () {
  function normal_(t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); }

  /** { 'Fecha': 0, 'Valor': 4, ... } a partir de la fila de encabezados. */
  function mapa(encabezados) {
    var m = {};
    encabezados.forEach(function (e, i) {
      var k = normal_(e);
      if (k && m[k] === undefined) m[k] = i;
    });
    return m;
  }

  /** Lanza error si falta algún encabezado requerido. */
  function exigir(mapaCols, requeridos, donde) {
    var faltan = requeridos.filter(function (r) { return mapaCols[normal_(r)] === undefined; });
    if (faltan.length) {
      throw new Error('Esquema roto en «' + donde + '»: faltan las columnas ' + faltan.join(', ') +
        '. No se escribió nada.');
    }
  }

  /**
   * Arma la fila a escribir: pone los valores del objeto en su columna,
   * respeta las fórmulas existentes y deja lo demás como estaba en `base`.
   */
  function construir(encabezados, formulas, obj, base) {
    var m = mapa(encabezados);
    var fila = encabezados.map(function (e, i) {
      if (formulas && formulas[i]) return formulas[i];
      return base ? base[i] : '';
    });
    Object.keys(obj).forEach(function (k) {
      var i = m[normal_(k)];
      if (i === undefined) throw new Error('La columna «' + k + '» no existe.');
      if (formulas && formulas[i]) throw new Error('La columna «' + k + '» es una fórmula: no se escribe.');
      fila[i] = obj[k];
    });
    return fila;
  }

  /** Convierte una fila en objeto { encabezado: valor }. */
  function aObjeto(encabezados, valores) {
    var o = {};
    encabezados.forEach(function (e, i) { var k = normal_(e); if (k) o[k] = valores[i]; });
    return o;
  }

  /** Una fila está libre si todas sus celdas sin fórmula están vacías. */
  function libre(valores, formulas) {
    return valores.every(function (v, i) {
      return (formulas && formulas[i]) || v === '' || v === null;
    });
  }

  return { mapa: mapa, exigir: exigir, construir: construir, aObjeto: aObjeto, libre: libre };
})();
