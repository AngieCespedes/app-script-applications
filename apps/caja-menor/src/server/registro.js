/**
 * Registro — pagos, ingresos, entregas de efectivo y lotes de soportes.
 * Todo se escribe con candado para que dos personas no tomen la misma fila.
 */
var Registro = (function () {
  function conCandado_(fn) {
    var candado = LockService.getDocumentLock();
    if (!candado.tryLock(30000)) throw new Error('Otra persona está escribiendo en la caja. Intente de nuevo.');
    try { return fn(); } finally { candado.releaseLock(); }
  }

  function valorPositivo_(v, mensaje) {
    var n = Util.entero(v);
    if (!(n > 0)) throw new Error(mensaje);
    return n;
  }

  function camposPago_(d, valor) {
    return {
      fecha: Util.aFecha(d.fecha) || '', soporte: Util.txt(d.soporte, 40) || Config.SIN_NUMERO,
      tercero: Util.txt(d.proveedor, 120).toUpperCase(), nit: Util.nit(d.nit),
      descripcion: Util.txt(d.descripcion, 200), categoria: Util.txt(d.categoria, 60),
      centro: Util.txt(d.centro, 60), tipoSoporte: Util.txt(d.tipoSoporte, 60), medio: Util.txt(d.medio, 60),
      egreso: valor, recibio: Util.txt(d.beneficiario, 60), estadoSoporte: Util.txt(d.estadoSoporte, 80),
      cuenta: Util.txt(d.cuenta, 60), retencion: Util.txt(d.retencion, 60), nota: Util.txt(d.nota, 300)
    };
  }

  function despuesDelPago_(fila, d, valor, url) {
    if (url) Relacion.enlazarSoporte(fila, Util.txt(d.soporte, 40), url);
    if (d.nit || d.proveedor) Terceros.registrar(d);
    if (/no se pudo|no quiso/i.test(String(d.estadoSoporte || ''))) Casos.abrir(fila, d, valor);
    SpreadsheetApp.flush();
    var f = Relacion.leerFila(fila);
    return { fila: fila, n: fila - Relacion.tabla().filaIni + 1, revision: f.revision, plazo: f.plazo, deducible: f.deducible };
  }

  function guardarPago(d, quien) {
    var valor = valorPositivo_(d.valor, 'Escriba el valor del pago.');
    return conCandado_(function () {
      var url = (d.archivo && d.archivo.base64)
        ? Soportes.guardar(d.archivo, Util.aFecha(d.fecha) || new Date(), '01 SOPORTES DE EGRESOS',
          Config.CARPETA_POR_SOPORTE[d.tipoSoporte] || 'Sin soporte - no deducible',
          Util.nombreArchivo(d.fecha, d.proveedor, d.soporte))
        : (d.urlYaSubido || '');
      var fila = Relacion.escribir(camposPago_(d, valor), quien);
      return despuesDelPago_(fila, d, valor, url);
    });
  }

  function guardarIngreso(d, quien) {
    var valor = valorPositivo_(d.valor, 'Escriba el valor recibido.');
    var esCliente = /cliente/i.test(String(d.origen || ''));
    if (esCliente) {
      if (!Util.txt(d.cliente, 120)) throw new Error('Falta el nombre del cliente.');
      if (!Util.txt(d.reciboCaja, 40)) throw new Error('Falta el N.° de recibo de caja.');
      if (!Util.txt(d.facturaCruza, 40)) throw new Error('Falta la factura que cruza.');
    }
    return conCandado_(function () {
      var url = subirSi_(d.archivo, function () {
        return Soportes.guardar(d.archivo, Util.aFecha(d.fecha) || new Date(), '02 SOPORTES DE INGRESOS',
          esCliente ? 'Recaudos de clientes' : 'Reposiciones del banco',
          Util.nombreArchivo(d.fecha, d.cliente || d.origen, d.reciboCaja || d.soporte));
      });
      var fila = Relacion.escribir(camposIngreso_(d, valor), quien);
      if (url) Relacion.enlazarSoporte(fila, Util.txt(d.soporte, 40), url);
      if (/banco/i.test(String(d.origen || ''))) {
        Libro.agregar(Libro.tabla('banco'), filaBanco_(Util.aFecha(d.fecha) || new Date(),
          'Retiro del banco para reponer caja', Util.txt(d.soporte, 40), valor, url, Util.txt(d.descripcion, 200)));
      }
      SpreadsheetApp.flush();
      return { fila: fila, n: fila - Relacion.tabla().filaIni + 1, revision: Relacion.leerFila(fila).revision };
    });
  }

  function subirSi_(archivo, subir) { return (archivo && archivo.base64) ? subir() : ''; }

  function camposIngreso_(d, valor) {
    return {
      fecha: Util.aFecha(d.fecha) || '', soporte: Util.txt(d.soporte, 40) || Config.SIN_NUMERO,
      tercero: Util.txt(d.cliente, 120).toUpperCase(), nit: Util.nit(d.nit),
      descripcion: Util.txt(d.descripcion, 200), categoria: Util.txt(d.categoria, 60),
      centro: Util.txt(d.centro, 60), tipoSoporte: Util.txt(d.tipoSoporte, 60), medio: Util.txt(d.medio, 60),
      ingreso: valor, origen: Util.txt(d.origen, 60), cliente: Util.txt(d.cliente, 120),
      recibo: Util.txt(d.reciboCaja, 40), factura: Util.txt(d.facturaCruza, 40),
      cruce: Util.txt(d.cruceAplicado, 20) || 'Pendiente'
    };
  }

  function filaBanco_(fecha, tipo, comprobante, valor, url, nota) {
    return { 'Fecha': fecha, 'Tipo de movimiento': tipo, 'N.° comprobante / transacción': comprobante,
      'Valor': valor, 'Quién lo hizo': Relacion.responsableHoy(), 'N.° relación': Libro.valor('REL_NUMERO'),
      'Soporte': url ? 'Sí' : 'No', '¿Verificado contra el extracto?': 'Pendiente', 'Observaciones': nota };
  }

  function guardarEntrega(d, quien) {
    var valor = valorPositivo_(d.valor, 'Escriba el valor entregado.');
    if (!Util.txt(d.destino, 120)) throw new Error('Elija a dónde va el efectivo.');
    return conCandado_(function () {
      var saldo = Libro.numero('REL_SALDO_FINAL');
      if (valor > saldo) throw new Error('En caja hay ' + Util.pesos(saldo) + ' y está entregando ' + Util.pesos(valor) + '.');
      var ent = Libro.tabla('entregas');
      var consecutivo = 'EE-' + ('0000' + (Libro.leer(ent).length + 1)).slice(-4);
      var ahora = new Date();
      var esBanco = /banco|consignaci/i.test(d.destino);
      var url = subirSi_(d.archivo, function () {
        return Soportes.guardar(d.archivo, ahora, '03 SOPORTES DE ENTREGAS DE EFECTIVO', null,
          Util.nombreArchivo(ahora, consecutivo, Util.limpiarNombreArchivo(d.destino)));
      });
      Libro.agregar(ent, filaEntrega_(d, { valor: valor, consecutivo: consecutivo, ahora: ahora, esBanco: esBanco, url: url, quien: quien }));
      var fila = Relacion.escribir(camposEntrega_(d, valor, consecutivo, ahora, esBanco), quien);
      if (url) Relacion.enlazarSoporte(fila, consecutivo, url);
      if (esBanco) {
        Libro.agregar(Libro.tabla('banco'), filaBanco_(ahora, 'Consignación del excedente de caja', consecutivo,
          valor, url, Util.txt(d.concepto, 200)));
      }
      SpreadsheetApp.flush();
      return { consecutivo: consecutivo, url: url };
    });
  }

  function filaEntrega_(d, x) {
    return {
      'N.° comprobante': x.consecutivo, 'Fecha y hora': x.ahora, 'Entrega': Util.txt(x.quien, 80) || Relacion.responsableHoy(),
      'Recibe': Util.txt(d.destino, 120), 'Valor': x.valor, 'Concepto': Util.txt(d.concepto, 200),
      'Centro de costo': Util.txt(d.centro, 60), 'Soporte de la entrega': x.url ? 'Foto adjunta' : 'Pendiente',
      '¿Confirmó quien recibe?': x.esBanco ? 'Sí' : 'Por confirmar', 'Fecha de confirmación': x.esBanco ? x.ahora : '',
      'N.° relación': Libro.valor('REL_NUMERO')
    };
  }

  function camposEntrega_(d, valor, consecutivo, ahora, esBanco) {
    return {
      fecha: Util.soloFecha(ahora), soporte: consecutivo, tercero: Util.txt(d.destino, 120).toUpperCase(),
      descripcion: Util.txt(d.concepto, 200) || 'Entrega de efectivo', categoria: 'Entrega de efectivo',
      centro: Util.txt(d.centro, 60) || 'Administración', tipoSoporte: 'Formato interno (entrega de efectivo)',
      medio: 'Efectivo (billetes y monedas)', egreso: valor, recibio: Util.txt(d.destino, 60),
      estadoSoporte: 'Ya tiene soporte válido',
      // Consignar es un traslado al banco; entregarle a un colaborador es un anticipo: lo clasifica la contadora.
      cuenta: esBanco ? '111005 · Bancos — Bancolombia' : Util.txt(d.cuenta, 60),
      retencion: 'No aplica (cuantía menor)', nota: 'Entrega de efectivo ' + consecutivo
    };
  }

  /** Registra las fichas de un lote de soportes ya subidos. */
  function registrarLote(fichas, quien) {
    if (!fichas || !fichas.length) throw new Error('No hay fichas para registrar.');
    var resultados = fichas.map(function (f) {
      try {
        var ficha = Object.assign({}, f, { archivo: null });
        if (f.idArchivo) ficha.urlYaSubido = Soportes.clasificar(f.idArchivo, f);
        var r = guardarPago(ficha, quien);
        return { ok: true, nombre: f.nombreArchivo, n: r.n, revision: r.revision };
      } catch (e) {
        return { ok: false, nombre: f.nombreArchivo, error: e.message };
      }
    });
    return { resultados: resultados };
  }

  return { guardarPago: guardarPago, guardarIngreso: guardarIngreso, guardarEntrega: guardarEntrega,
    registrarLote: registrarLote };
})();
