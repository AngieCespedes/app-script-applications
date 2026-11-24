/**
 * Responsables y Entregas — quién tiene la caja y el efectivo entregado a terceros.
 */
var Responsables = (function () {
  function tabla_() { return Libro.tabla('responsables'); }

  /** Todas las filas del cuerpo (también las vacías), para poder reusar filas sin nombre. */
  function filas_() {
    var t = tabla_();
    var vals = t.hoja.getRange(t.filaIni, t.col, t.filaFin - t.filaIni + 1, t.encabezados.length).getValues();
    return vals.map(function (v, i) { var o = Filas.aObjeto(t.encabezados, v); o._fila = t.filaIni + i; return o; });
  }

  function buscar_(nombre) {
    var n = String(nombre || '').toUpperCase().trim();
    return filas_().filter(function (o) { return String(o['Nombre completo']).toUpperCase().trim() === n; })[0];
  }

  /** Usa la primera fila sin nombre (aunque ya tenga número u observaciones). */
  function nuevaFila_(datos) {
    var t = tabla_();
    var libre = filas_().filter(function (o) { return !String(o['Nombre completo']).trim(); })[0];
    if (!libre) throw new Error('No hay filas libres en Responsables.');
    if (!libre['N.°']) datos['N.°'] = libre._fila - t.filaIni + 1;
    Libro.actualizar(t, libre._fila, datos);
    return libre._fila;
  }

  function listar() {
    return filas_().filter(function (o) { return o['Nombre completo']; }).map(function (o) {
      return { nombre: o['Nombre completo'], cedula: o['Cédula'], correo: o['Correo'], celular: o['Celular'],
        desde: Util.fmt(o['Fecha de inicio']), hasta: Util.fmt(o['Fecha de retiro']), estado: o['Estado'], fila: o._fila };
    });
  }

  function agregar(d) {
    if (!Util.txt(d.nombre, 120)) throw new Error('Escriba el nombre.');
    var datos = { 'Nombre completo': Util.txt(d.nombre, 120).toUpperCase(), 'Cédula': Util.txt(d.cedula, 20),
      'Correo': Util.correo(d.correo), 'Celular': Util.txt(d.celular, 20), 'Fecha de inicio': Util.aFecha(d.desde) || '' };
    if (d.hasta) datos['Fecha de retiro'] = Util.aFecha(d.hasta);
    nuevaFila_(datos);
  }

  /** Cierra la ventana de quien entrega y abre la de quien recibe, con el acta enlazada. */
  function registrarEmpalme(entrega, recibe, fecha, numero, urlActa, d) {
    var t = tabla_();
    var colActa = Libro.columna(t, 'Acta de entrega');
    var sale = buscar_(entrega);
    if (sale) {
      var cambios = { 'Relación final': numero };
      if (!sale['Fecha de retiro']) cambios['Fecha de retiro'] = Util.soloFecha(fecha);
      Libro.actualizar(t, sale._fila, cambios);
      Libro.enlazar(t.hoja, sale._fila, colActa, 'Acta ' + Util.fmt(fecha), urlActa);
    }
    var inicio = Util.soloFecha(Util.sumarDias(fecha, 1));
    var entra = buscar_(recibe);
    var fila = entra ? entra._fila : nuevaFila_({ 'Nombre completo': recibe.toUpperCase(),
      'Cédula': Util.txt(d.cedulaRecibe, 20), 'Correo': Util.correo(d.correoRecibe) });
    Libro.actualizar(t, fila, { 'Fecha de inicio': inicio, 'Relación inicial': numero });
    Libro.enlazar(t.hoja, fila, colActa, 'Acta ' + Util.fmt(fecha), urlActa);
  }

  return { listar: listar, agregar: agregar, registrarEmpalme: registrarEmpalme };
})();

var Entregas = (function () {
  function tabla_() { return Esquema.tablaCompleta('entregas'); }

  function listar() {
    return Libro.leer(tabla_(), true).map(function (o) {
      return { consecutivo: o['N.° comprobante'], fecha: o['Fecha y hora'], entrega: o['Entrega'], recibe: o['Recibe'],
        valor: o['Valor'], concepto: o['Concepto'], centro: o['Centro de costo'], soporte: o['Soporte de la entrega'],
        confirmado: o['¿Confirmó quien recibe?'], fechaConf: o['Fecha de confirmación'], relacion: o['N.° relación'],
        nota: o['Observaciones'] };
    });
  }

  function porConfirmar() {
    return Libro.leer(tabla_(), true).filter(function (o) { return o['¿Confirmó quien recibe?'] === 'Por confirmar'; }).length;
  }

  function confirmar(consecutivo, quien) {
    var t = tabla_();
    var e = Libro.leer(t).filter(function (o) { return String(o['N.° comprobante']) === String(consecutivo); })[0];
    if (!e) throw new Error('No se encontró la entrega ' + consecutivo + '.');
    Libro.actualizar(t, e._fila, { '¿Confirmó quien recibe?': 'Sí', 'Fecha de confirmación': new Date(),
      'Observaciones': (e['Observaciones'] ? e['Observaciones'] + ' · ' : '') + 'Confirmó: ' + quien });
    return 'Entrega ' + consecutivo + ' confirmada.';
  }

  return { listar: listar, porConfirmar: porConfirmar, confirmar: confirmar };
})();
