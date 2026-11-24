/**
 * Consultas — datos de solo lectura para las pantallas.
 */
var Consultas = (function () {
  function relacion() {
    SpreadsheetApp.flush();
    var c = Relacion.cabecera();
    return {
      numero: String(c.numero), desde: c.desde, hasta: c.hasta, responsable: c.responsable,
      saldoAnterior: Util.pesos(c.saldoAnterior), ingresos: Util.pesos(c.ingresos), egresos: Util.pesos(c.egresos),
      saldoFinal: Util.pesos(c.saldoFinal), alertas: c.alertas,
      filas: Relacion.lineas().map(function (l) { var o = l.t; o.n = l.n; return o; })
    };
  }

  var FILTROS = {
    alerta: function (x) { return x.revision && x.revision.indexOf('OK') !== 0; },
    nodeducible: function (x) { return x.deducible === 'NO'; },
    pordefinir: function (x) { return /definir/i.test(x.deducible); },
    sinsoporte: function (x) { return /falta el dse|no quiso|no se pudo/i.test(x.estadoSoporte); },
    efectivo: function (x) { return /efectivo/i.test(x.medio); }
  };

  function revision(filtro) {
    var r = relacion();
    var f = FILTROS[String(filtro || '')];
    var conteos = { todos: r.filas.length };
    Object.keys(FILTROS).forEach(function (k) { conteos[k] = r.filas.filter(FILTROS[k]).length; });
    return { cabecera: r, filas: f ? r.filas.filter(f) : r.filas, conteos: conteos, totalEgresos: r.egresos };
  }

  function anotarFila(n, nota) {
    var t = Relacion.tabla();
    var fila = t.filaIni + Number(n) - 1;
    if (!(fila >= t.filaIni && fila <= t.filaFin)) throw new Error('Fila fuera de la relación.');
    Relacion.anotar(fila, '[' + Util.fmt(new Date()) + ' contadora] ' + Util.txt(nota, 250));
    return 'Nota guardada en la fila ' + n + '.';
  }

  function pares_(nombre) {
    return Libro.bloque(nombre).filter(function (f) { return f[0]; }).map(function (f) { return { etiqueta: f[0], valor: f[1] }; });
  }
  function lineas_(nombre) { return Libro.bloque(nombre).map(function (f) { return f[0]; }).filter(String); }

  function tablero() {
    SpreadsheetApp.flush();
    return { situacion: pares_('TAB_SITUACION'), alerta: pares_('TAB_ALERTA'),
      semaforo: lineas_('TAB_SEMAFORO'), pasos: lineas_('TAB_PASOS') };
  }

  function gestion() {
    SpreadsheetApp.flush();
    return {
      anio: Libro.texto('GES_ANIO'), responsable: Libro.texto('GES_RESPONSABLE'),
      indicadores: Libro.bloque('GES_INDICADORES').filter(function (f) { return f[0]; })
        .map(function (f) { return { indicador: f[0], resultado: f[1], meta: f[2], estado: f[3] }; }),
      notas: Libro.bloque('GES_NOTAS').filter(function (f) { return f[0] && f[1]; })
        .map(function (f) { return { titulo: f[0], texto: f[1] }; })
    };
  }

  function politicas() {
    return {
      tabla: Libro.bloque('POL_TABLA').filter(function (f) { return f[0]; })
        .map(function (f) { return { caso: f[0], dse: f[1], soporte: f[2] }; }),
      topes: Libro.bloque('POL_TOPES').filter(function (f) { return f[0]; })
        .map(function (f) { return { concepto: f[0], valor: f[1], nota: f[2] }; }),
      antes: lineas_('POL_ANTES'), errores: lineas_('POL_ERRORES')
    };
  }

  function saldos_() {
    var saldo = Libro.numero('REL_SALDO_FINAL'), objetivo = Libro.numero(Config.PAR.objetivo), minimo = Libro.numero(Config.PAR.minimo);
    return { saldo: saldo, objetivo: objetivo, minimo: minimo,
      excedente: saldo > objetivo ? saldo - objetivo : 0, reembolso: saldo < minimo ? objetivo - saldo : 0 };
  }

  function banco() {
    SpreadsheetApp.flush();
    var s = saldos_();
    return {
      filas: Libro.leer(Libro.tabla('banco'), true).map(function (o) {
        return { fecha: o['Fecha'], tipo: o['Tipo de movimiento'], comprobante: o['N.° comprobante / transacción'],
          valor: o['Valor'], quien: o['Quién lo hizo'], relacion: o['N.° relación'], soporte: o['Soporte'],
          verificado: o['¿Verificado contra el extracto?'], nota: o['Observaciones'] };
      }),
      saldo: s.saldo, saldoTxt: Util.pesos(s.saldo), objetivo: s.objetivo, objetivoTxt: Util.pesos(s.objetivo),
      minimo: s.minimo, minimoTxt: Util.pesos(s.minimo), excedente: s.excedente, reembolso: s.reembolso,
      estado: Libro.texto('REL_ALERTA_SALDO')
    };
  }

  function informes() {
    return Cierre.paraAprobar().map(function (o) {
      return { numero: o.numero, fecha: o.fecha, desde: o.desde, hasta: o.hasta, responsable: o.responsable,
        saldoAnterior: o.saldoAnterior, ingresos: o.ingresos, egresos: o.egresos, saldoFinal: o.saldoFinal,
        contado: o.contado, diferencia: o.diferencia, movimientos: o.movimientos, aprobacion: o.entrega,
        pdf: o.pdf, carpeta: o.carpeta };
    });
  }

  function auditoria() {
    var r = Relacion.revisar();
    return {
      errores: r.errores, avisos: r.avisos, movimientos: r.lineas.length, saldo: r.saldoTxt,
      semaforo: lineas_('TAB_SEMAFORO'),
      conAlerta: r.lineas.filter(function (l) { return l.t.revision && l.t.revision.indexOf('OK') !== 0; })
        .map(function (l) { return { n: l.n, fecha: l.t.fecha, tercero: l.t.tercero,
          valor: Util.pesos(Number(l.v.egreso) || 0), revision: l.t.revision }; })
    };
  }

  /** Consulta de bancarización: escribe el tercero en la casilla de consulta y lee el resultado. */
  function consultaTercero(nombre) {
    var n = Util.txt(nombre, 120);
    if (!n) return null;
    var r = Libro.rango('BZA_CONSULTA');
    r.getCell(1, 1).setValue(n);
    SpreadsheetApp.flush();
    var v = r.getDisplayValues();
    return { tercero: n, efectivo: v[1][0], banco: v[2][0], porcentaje: v[3][0], sobreTope: v[4][0], veredicto: v[5][0] };
  }

  function tercerosBanca() { return Libro.lista('BZA_TERCEROS'); }

  function linkWhatsApp(celular, nombre, valor, fecha, link) {
    var cel = String(celular || '').replace(/\D/g, '');
    if (cel.length !== 10) throw new Error('El celular debe tener 10 dígitos.');
    var msg = 'Buen día, ' + Util.txt(nombre, 80) + '.\n\nLe escribo de SOCIAL SOLAR S.A.S. (NIT 901.128.826-6). El ' +
      Util.txt(fecha, 20) + ' le pagamos ' + Util.txt(valor, 30) + ' en efectivo y necesitamos legalizar ese pago.\n\n' +
      'Por favor diligencie este formulario con sus datos (nombre completo, cédula, dirección, correo y celular):\n' +
      Util.txt(link, 300) + '\n\nEs rápido y nos permite expedirle el documento soporte. Cualquier duda me escribe por aquí.\n\n' +
      'Gracias,\n' + Relacion.responsableHoy() + ' — Caja menor Social Solar';
    return 'https://wa.me/57' + cel + '?text=' + encodeURIComponent(msg);
  }

  return { relacion: relacion, revision: revision, anotarFila: anotarFila, tablero: tablero, gestion: gestion,
    politicas: politicas, banco: banco, informes: informes, auditoria: auditoria, saldos: saldos_,
    consultaTercero: consultaTercero, tercerosBanca: tercerosBanca, linkWhatsApp: linkWhatsApp };
})();
