/**
 * Relacion — la relación de gastos en curso (hoja Relación).
 * Lee y escribe por encabezado; las columnas con fórmula nunca se tocan.
 */
var Relacion = (function () {
  function tabla() { return Esquema.tablaCompleta('relacion'); }

  /** { clave interna: valor } → { encabezado: valor } */
  function aEncabezados_(o) {
    var r = {};
    Object.keys(o).forEach(function (k) {
      if (!Config.COL_REL[k]) throw new Error('Campo desconocido de la Relación: ' + k);
      r[Config.COL_REL[k]] = o[k];
    });
    return r;
  }

  /** { encabezado: valor } → { clave interna: valor } */
  function aClaves_(o) {
    var r = {};
    Object.keys(Config.COL_REL).forEach(function (k) { r[k] = o[Config.COL_REL[k]]; });
    return r;
  }

  function rangoDatos_(t) {
    return t.hoja.getRange(t.filaIni, t.col, t.filaFin - t.filaIni + 1, t.encabezados.length);
  }

  /** Movimientos de la relación: [{ fila, n, v: valores, t: textos }]. */
  function lineas() {
    var t = tabla();
    var r = rangoDatos_(t);
    var vals = r.getValues(), forms = r.getFormulas(), txts = r.getDisplayValues();
    var out = [];
    vals.forEach(function (v, i) {
      if (Filas.libre(v, forms[i])) return;
      out.push({ fila: t.filaIni + i, n: i + 1,
        v: aClaves_(Filas.aObjeto(t.encabezados, v)), t: aClaves_(Filas.aObjeto(t.encabezados, txts[i])) });
    });
    return out;
  }

  function filasLibres() {
    var t = tabla();
    var r = rangoDatos_(t);
    var vals = r.getValues(), forms = r.getFormulas();
    var libres = [];
    vals.forEach(function (v, i) { if (Filas.libre(v, forms[i])) libres.push(t.filaIni + i); });
    return libres;
  }

  /** Escribe un movimiento en la primera fila libre y lo sella con quién y cuándo. */
  function escribir(campos, quien) {
    var libres = filasLibres();
    if (!libres.length) throw new Error('La relación ya no tiene filas libres. Ciérrela para abrir la siguiente.');
    var fila = libres[0];
    var datos = {};
    Object.keys(campos).forEach(function (k) { datos[k] = campos[k]; });
    datos.quien = Util.txt(quien, 80) || 'sin identificar';
    datos.cuando = new Date();
    Libro.escribirFila(tabla(), fila, aEncabezados_(datos));
    return fila;
  }

  function enlazarSoporte(fila, textoVisible, url) {
    var t = tabla();
    Libro.enlazar(t.hoja, fila, Libro.columna(t, Config.COL_REL.soporte), textoVisible || Config.SIN_NUMERO, url);
  }

  /** { fila: url } con los enlaces a las fotos de los soportes. */
  function enlaces() {
    var t = tabla();
    var col = Libro.columna(t, Config.COL_REL.soporte);
    var rich = t.hoja.getRange(t.filaIni, col, t.filaFin - t.filaIni + 1, 1).getRichTextValues();
    var out = {};
    rich.forEach(function (r, i) { var u = r[0] && r[0].getLinkUrl(); if (u) out[t.filaIni + i] = u; });
    return out;
  }

  function leerFila(fila) {
    var t = tabla();
    var txt = t.hoja.getRange(fila, t.col, 1, t.encabezados.length).getDisplayValues()[0];
    return aClaves_(Filas.aObjeto(t.encabezados, txt));
  }

  function anotar(fila, nota) {
    var t = tabla();
    var col = Libro.columna(t, Config.COL_REL.nota);
    var previo = String(t.hoja.getRange(fila, col).getDisplayValue() || '');
    t.hoja.getRange(fila, col).setValue(previo ? previo + ' · ' + nota : nota);
  }

  /** Deja todas las filas vacías pero conserva las fórmulas. */
  function vaciar() {
    var t = tabla();
    var r = rangoDatos_(t);
    var forms = r.getFormulas();
    var limpias = forms.map(function (f) { return f.map(function (x) { return x || ''; }); });
    r.setValues(limpias);
  }

  function cabecera() {
    return {
      numero: Libro.valor('REL_NUMERO'), desde: Libro.texto('REL_DESDE'), hasta: Libro.texto('REL_HASTA'),
      responsable: Libro.texto('REL_RESPONSABLE'), saldoAnterior: Libro.numero('REL_SALDO_ANTERIOR'),
      ingresos: Libro.numero('REL_INGRESOS'), egresos: Libro.numero('REL_EGRESOS'),
      saldoFinal: Libro.numero('REL_SALDO_FINAL'), contado: Libro.valor('REL_CONTADO'),
      diferencia: Libro.valor('REL_DIFERENCIA'), estadoArqueo: Libro.texto('REL_ESTADO_ARQUEO'),
      alertaSaldo: Libro.texto('REL_ALERTA_SALDO'), alertas: Libro.texto('REL_ALERTAS')
    };
  }

  function responsableHoy() { return Libro.texto('RESP_HOY') || 'Sin definir'; }

  var RE_PENDIENTE_DSE = /falta el dse|no quiso|no se pudo/i;

  function pendientesDSE() {
    return lineas().filter(function (l) { return RE_PENDIENTE_DSE.test(String(l.v.estadoSoporte || '')); })
      .map(function (l) {
        var valor = Number(l.v.egreso) || 0;
        return { fila: l.fila, fecha: l.t.fecha, proveedor: String(l.v.tercero || ''), nit: String(l.v.nit || ''),
          valor: valor, valorTxt: Util.pesos(valor), estado: String(l.v.estadoSoporte || ''), plazo: l.t.plazo };
      });
  }

  /** Lo que impide cerrar (errores) y lo que conviene mirar (avisos). */
  function revisar() {
    SpreadsheetApp.flush();
    var ls = lineas(), errores = [], avisos = [];
    ls.forEach(function (l) {
      var nota = String(l.t.revision || '');
      if (nota && nota.indexOf('OK') !== 0) errores.push('Fila ' + l.n + ': ' + nota);
      if (l.t.plazo === 'VENCIDO') errores.push('Fila ' + l.n + ': el DSE está vencido');
      if (nota.indexOf('no deducible') > -1) avisos.push('Fila ' + l.n + ': gasto no deducible');
    });
    if (!ls.length) errores.push('La relación no tiene movimientos.');
    if (responsableHoy() === 'Sin definir') errores.push('No hay responsable de la caja: revise la hoja Responsables.');
    var sinConfirmar = Libro.numero('ENT_PENDIENTE');
    if (sinConfirmar > 0) errores.push('Hay ' + Util.pesos(sinConfirmar) + ' en entregas sin confirmar.');
    var casos = Casos.pendientes();
    if (casos > 0) avisos.push(casos + ' caso(s) esperan decisión de la contadora.');
    var cab = cabecera();
    if (cab.contado === '' || cab.contado === null) avisos.push('No hay un arqueo posterior al último movimiento.');
    else if (Math.abs(Number(cab.contado) - cab.saldoFinal) >= 1) avisos.push('El arqueo no cuadra: ' + cab.estadoArqueo + '.');
    return { numero: cab.numero, lineas: ls, errores: errores, avisos: avisos,
      saldoFinal: cab.saldoFinal, saldoTxt: Util.pesos(cab.saldoFinal) };
  }

  return { tabla: tabla, lineas: lineas, filasLibres: filasLibres, escribir: escribir,
    enlazarSoporte: enlazarSoporte, enlaces: enlaces, leerFila: leerFila, anotar: anotar, vaciar: vaciar,
    cabecera: cabecera, responsableHoy: responsableHoy, pendientesDSE: pendientesDSE, revisar: revisar };
})();
