/**
 * Terceros y Casos — directorio de proveedores y casos que decide la contadora.
 */
var Terceros = (function () {
  /** Crea el tercero si no existe (por NIT sin DV o, si no hay NIT, por nombre) y marca la última vez. */
  function registrar(d) {
    var t = Libro.tabla('terceros');
    var base = Util.nit(d.nit);
    var nombre = Util.txt(d.proveedor, 120).toUpperCase();
    if (!base && !nombre) return;
    var existente = Libro.leer(t).filter(function (o) {
      return base ? Util.nit(o['NIT / C.C.']) === base : String(o['Nombre o razón social']).toUpperCase() === nombre;
    })[0];
    if (existente) { Libro.actualizar(t, existente._fila, { 'Última vez': new Date() }); return; }
    Libro.agregar(t, {
      'NIT / C.C.': base, 'Nombre o razón social': nombre,
      'Categoría habitual': Util.txt(d.categoria, 60), 'Centro de costo habitual': Util.txt(d.centro, 60),
      'Tipo de soporte habitual': Util.txt(d.tipoSoporte, 60), 'Última vez': new Date()
    });
  }

  return { registrar: registrar };
})();

var Casos = (function () {
  function tabla_() { return Libro.tabla('casos'); }

  function abrir(fila, d, valor) {
    var t = tabla_();
    var n = Libro.leer(t).length + 1;
    Libro.agregar(t, {
      'N.°': n, 'Fecha': Util.aFecha(d.fecha) || new Date(), 'N.° relación': Libro.valor('REL_NUMERO'),
      'Fila': fila - Relacion.tabla().filaIni + 1, 'Recibió el efectivo': Util.txt(d.beneficiario, 60),
      'Vendedor del documento': Util.txt(d.proveedor, 120).toUpperCase() || 'NO IDENTIFICADO',
      'Identificación': Util.nit(d.nit) || '—', 'Valor': valor,
      'Estado del soporte': Util.txt(d.estadoSoporte, 80), 'Nota de la auxiliar': Util.txt(d.nota, 400)
    });
  }

  function listar() {
    return Libro.leer(tabla_()).map(function (o) {
      return { n: o['N.°'], fecha: Util.fmt(o['Fecha']), beneficiario: o['Recibió el efectivo'],
        vendedor: o['Vendedor del documento'], id: o['Identificación'], valor: Util.pesos(o['Valor']),
        estado: o['Estado del soporte'], nota: o['Nota de la auxiliar'],
        decision: o['Decisión de la contadora'], resuelto: String(o['¿Resuelto?'] || '') };
    });
  }

  function pendientes() {
    return Libro.leer(tabla_(), true).filter(function (o) { return o['¿Resuelto?'] === 'PENDIENTE'; }).length;
  }

  function decidir(n, decision, instruccion) {
    var t = tabla_();
    var caso = Libro.leer(t).filter(function (o) { return Number(o['N.°']) === Number(n); })[0];
    if (!caso) throw new Error('No se encontró el caso ' + n + '.');
    Libro.actualizar(t, caso._fila, {
      'Decisión de la contadora': Util.txt(decision, 200),
      'Instrucción para la causación': Util.txt(instruccion, 300), 'Fecha de la decisión': new Date()
    });
    return true;
  }

  return { abrir: abrir, listar: listar, pendientes: pendientes, decidir: decidir };
})();
