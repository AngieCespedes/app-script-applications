/**
 * Libro — único punto de acceso al Google Sheet.
 * Celdas por rango con nombre y tablas por encabezado: si alguien mueve
 * o inserta filas y columnas, el código las sigue encontrando.
 */
var Libro = (function () {
  var cache_ = null;

  function abrir() {
    if (!cache_) cache_ = SpreadsheetApp.openById(Config.leer('libro'));
    return cache_;
  }

  function hoja(nombre) {
    var h = abrir().getSheetByName(nombre);
    if (!h) throw new Error('Falta la hoja «' + nombre + '». No renombre las hojas del libro.');
    return h;
  }

  function rango(nombre) {
    var r = abrir().getRangeByName(nombre);
    if (!r) throw new Error('Esquema roto: falta el rango «' + nombre + '». La dueña debe correr Caja menor › Instalar.');
    return r;
  }

  function valor(nombre) { return rango(nombre).getValue(); }
  function numero(nombre) { return Number(rango(nombre).getValue()) || 0; }
  function texto(nombre) { return rango(nombre).getDisplayValue(); }
  function poner(nombre, v) { rango(nombre).setValue(v); }

  /** Valores no vacíos de un rango de una columna. */
  function lista(nombre) {
    return rango(nombre).getDisplayValues()
      .map(function (f) { return String(f[0] || '').trim(); }).filter(String);
  }

  /** Bloque de celdas como texto (para las pantallas que solo muestran la hoja). */
  function bloque(nombre) { return rango(nombre).getDisplayValues(); }

  /* ------------------------- TABLAS ------------------------- */

  function tabla(clave) {
    var def = Config.TABLAS[clave];
    if (!def) throw new Error('Tabla desconocida: ' + clave);
    var enc = rango(def.encabezado);
    var h = enc.getSheet();
    var filaIni = enc.getRow() + 1;
    var filaFin = def.cuerpo ? rango(def.cuerpo).getLastRow() : Math.max(h.getMaxRows(), filaIni);
    var encabezados = enc.getDisplayValues()[0];
    return { clave: clave, hoja: h, col: enc.getColumn(), filaIni: filaIni, filaFin: filaFin,
      encabezados: encabezados, mapa: Filas.mapa(encabezados) };
  }

  function columna(t, encabezado) {
    var i = t.mapa[String(encabezado).replace(/\s+/g, ' ').trim()];
    if (i === undefined) throw new Error('Esquema roto: falta la columna «' + encabezado + '» en ' + t.hoja.getName());
    return t.col + i;
  }

  function cuerpo_(t) {
    var n = Math.max(t.filaFin - t.filaIni + 1, 1);
    return t.hoja.getRange(t.filaIni, t.col, n, t.encabezados.length);
  }

  /** Filas con dato en la primera columna, como objetos { encabezado: valor }. */
  function leer(t, comoTexto) {
    var r = cuerpo_(t);
    var vals = comoTexto ? r.getDisplayValues() : r.getValues();
    var out = [];
    vals.forEach(function (v, i) {
      if (v[0] === '' || v[0] === null) return;
      var o = Filas.aObjeto(t.encabezados, v);
      o._fila = t.filaIni + i;
      out.push(o);
    });
    return out;
  }

  function primeraLibre_(t) {
    var col = t.hoja.getRange(t.filaIni, t.col, Math.max(t.filaFin - t.filaIni + 1, 1), 1).getValues();
    for (var i = 0; i < col.length; i++) if (col[i][0] === '' || col[i][0] === null) return t.filaIni + i;
    if (Config.TABLAS[t.clave].cuerpo) throw new Error('La tabla ' + t.hoja.getName() + ' está llena.');
    t.hoja.insertRowAfter(t.filaFin);
    return t.filaFin + 1;
  }

  /** Agrega una fila al final, sin tocar las columnas con fórmula. Devuelve el número de fila. */
  function agregar(t, obj) {
    var fila = primeraLibre_(t);
    escribirFila(t, fila, obj);
    return fila;
  }

  /** Agrega varias filas de una vez (un solo setValues). */
  function agregarVarias(t, objs) {
    if (!objs.length) return 0;
    var fila = primeraLibre_(t);
    var faltan = fila + objs.length - 1 - t.filaFin;
    if (faltan > 0) {
      if (Config.TABLAS[t.clave].cuerpo) throw new Error('La tabla ' + t.hoja.getName() + ' no tiene espacio.');
      t.hoja.insertRowsAfter(t.hoja.getMaxRows(), faltan);
    }
    var r = t.hoja.getRange(fila, t.col, objs.length, t.encabezados.length);
    var forms = r.getFormulas(), base = r.getValues();
    r.setValues(objs.map(function (o, i) { return Filas.construir(t.encabezados, forms[i], o, base[i]); }));
    return fila;
  }

  function escribirFila(t, fila, obj) {
    var r = t.hoja.getRange(fila, t.col, 1, t.encabezados.length);
    var nueva = Filas.construir(t.encabezados, r.getFormulas()[0], obj, r.getValues()[0]);
    r.setValues([nueva]);
  }

  /** Cambia solo las celdas indicadas de una fila. */
  function actualizar(t, fila, obj) {
    Object.keys(obj).forEach(function (k) { t.hoja.getRange(fila, columna(t, k)).setValue(obj[k]); });
  }

  function enlazar(hojaObj, fila, col, textoVisible, url) {
    hojaObj.getRange(fila, col).setNumberFormat('@').setRichTextValue(
      SpreadsheetApp.newRichTextValue().setText(textoVisible).setLinkUrl(url).build());
  }

  return {
    abrir: abrir, hoja: hoja, rango: rango, valor: valor, numero: numero, texto: texto,
    poner: poner, lista: lista, bloque: bloque, tabla: tabla, columna: columna, leer: leer,
    agregar: agregar, agregarVarias: agregarVarias, escribirFila: escribirFila, actualizar: actualizar, enlazar: enlazar
  };
})();
