/**
 * Cierre — cerrar la relación (PDF, Movimientos, Historial) y aprobarla.
 */
var Cierre = (function () {
  function datos() {
    var r = Relacion.revisar(), c = Relacion.cabecera();
    return {
      numero: r.numero, desde: c.desde, hasta: c.hasta, responsable: Relacion.responsableHoy(),
      saldoAnterior: Util.pesos(c.saldoAnterior), ingresos: Util.pesos(c.ingresos), egresos: Util.pesos(c.egresos),
      saldoFinal: r.saldoTxt, contado: Libro.texto('REL_CONTADO'), estadoArqueo: c.estadoArqueo,
      movimientos: r.lineas.length, errores: r.errores, avisos: r.avisos,
      correoGer: Libro.texto(Config.PAR.correoGer), correoCtd: Libro.texto(Config.PAR.correoCtd)
    };
  }

  function crearPdf_(numero, d1, d2) {
    var ss = Libro.abrir(), rel = Libro.hoja(Config.HOJAS.relacion);
    var filaFin = Libro.rango('REL_ALERTA_SALDO').getRow() + 5;
    var colFin = Libro.columna(Relacion.tabla(), Config.COL_REL.revision);
    var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=pdf&gid=' + rel.getSheetId() +
      '&r1=0&c1=0&r2=' + filaFin + '&c2=' + colFin + '&size=letter&portrait=false&fitw=true&gridlines=false' +
      '&printtitle=false&sheetnames=false&pagenum=UNDEFINED&fzr=false' +
      '&top_margin=0.4&bottom_margin=0.4&left_margin=0.4&right_margin=0.4';
    var resp = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) throw new Error('Google respondió ' + resp.getResponseCode() + ' al generar el PDF. La relación no se movió.');
    var nombre = Util.compacta(d1) + '-' + Util.compacta(d2) + '_REL-' + numero + '.pdf';
    return Soportes.subcarpeta(Soportes.carpetaDelMes(d2), '05 RELACIONES CERRADAS').createFile(resp.getBlob().setName(nombre));
  }

  function filaMovimiento_(cab, l, ahora, url) {
    var v = l.v, f = v.fecha;
    return {
      'N.° relación': cab.numero, 'N.°': l.n, 'Fecha': f, 'N.° factura / soporte': v.soporte,
      'Tercero del documento': v.tercero, 'NIT / C.C.': v.nit, 'Descripción': v.descripcion,
      'Categoría': v.categoria, 'Centro de costo': v.centro, 'Tipo de soporte': v.tipoSoporte,
      'Medio de pago': v.medio, 'Ingreso': v.ingreso, 'Egreso': v.egreso, 'Recibió el efectivo': v.recibio,
      'Estado del soporte': v.estadoSoporte, 'Cuenta contable (WO)': v.cuenta, 'Concepto de retención': v.retencion,
      '¿Deducible?': l.t.deducible, 'Nota para la contadora': v.nota,
      'Año': f instanceof Date ? f.getFullYear() : '', 'Mes': f instanceof Date ? f.getMonth() + 1 : '',
      'Revisión': l.t.revision, 'Fecha de cierre': ahora, 'Enlace a la foto': url || '',
      'Origen del ingreso': v.origen, 'Cliente o pagador': v.cliente, 'N.° recibo de caja': v.recibo,
      'N.° factura que cruza': v.factura, '¿Cruce aplicado en WO?': v.cruce, 'Responsable de la caja': cab.responsable
    };
  }

  function avisarPorCorreo_(cab, d1, d2, n, pdf, paraQuien) {
    var para = String(paraQuien || Libro.texto(Config.PAR.correoGer)).trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) return '';
    var urlPdf = pdf.getUrl();
    return Correo.enviar({
      to: para, cc: Libro.texto(Config.PAR.correoCtd),
      subject: 'Caja menor — relación N.° ' + cab.numero + ' para aprobación',
      htmlBody: '<p>Se cerró la relación de caja menor N.° <b>' + cab.numero + '</b>.</p>' + Util.tablaHtml([
        ['Responsable', cab.responsable], ['Periodo', Util.fmt(d1) + ' a ' + Util.fmt(d2)],
        ['Saldo anterior', Util.pesos(cab.saldoAnterior)], ['Ingresos', Util.pesos(cab.ingresos)],
        ['Egresos', Util.pesos(cab.egresos)], ['Saldo final', Util.pesos(cab.saldoFinal)],
        ['Efectivo contado', cab.contado === '' ? 'Sin arqueo' : Util.pesos(cab.contado)], ['Movimientos', n]
      ]) + '<p>El PDF va adjunto. <a href="' + urlPdf + '">Verlo en Drive</a></p>',
      attachments: [pdf.getBlob()]
    });
  }

  function cerrar(desde, hasta, modo, paraQuien) {
    var candado = LockService.getDocumentLock();
    if (!candado.tryLock(60000)) throw new Error('Otra persona está cerrando la caja.');
    try {
      var r = Relacion.revisar();
      if (r.errores.length) throw new Error('Falta corregir:\n\n' + r.errores.join('\n'));
      var d1 = Util.aFecha(desde), d2 = Util.aFecha(hasta);
      if (!d1 || !d2) throw new Error('Indique la fecha inicial y la fecha final.');
      if (d2 < d1) throw new Error('La fecha final es anterior a la inicial.');
      Libro.poner('REL_DESDE', d1); Libro.poner('REL_HASTA', d2);
      SpreadsheetApp.flush();

      var cab = Relacion.cabecera();
      cab.responsable = Relacion.responsableHoy();
      var pdf = crearPdf_(cab.numero, d1, d2);
      var ahora = new Date(), enlaces = Relacion.enlaces();
      Libro.agregarVarias(Esquema.tablaCompleta('movimientos'),
        r.lineas.map(function (l) { return filaMovimiento_(cab, l, ahora, enlaces[l.fila]); }));
      Libro.agregar(Esquema.tablaCompleta('historial'), {
        'N.° relación': cab.numero, 'Fecha': ahora, 'Periodo desde': d1, 'Periodo hasta': d2,
        'Responsable': cab.responsable, 'Saldo anterior': cab.saldoAnterior, 'Ingresos': cab.ingresos,
        'Egresos': cab.egresos, 'Saldo final': cab.saldoFinal, 'Efectivo contado': cab.contado,
        'Diferencia': cab.diferencia, 'Movimientos': r.lineas.length, 'Entrega': modo === 'digital' ? 'Digital' : 'Física',
        'Enlace al PDF': pdf.getUrl(), 'Carpeta de soportes': Soportes.carpetaDelMes(d2).getUrl()
      });
      var enviado = modo === 'digital' ? avisarPorCorreo_(cab, d1, d2, r.lineas.length, pdf, paraQuien) : '';

      Relacion.vaciar();
      Libro.poner('REL_NUMERO', Number(cab.numero) + 1);
      Libro.poner('REL_FECHA', Util.soloFecha(ahora));
      Libro.poner('REL_DESDE', Util.sumarDias(d2, 1));
      Libro.rango('REL_HASTA').clearContent();
      Libro.poner('REL_SALDO_ANTERIOR', cab.saldoFinal);
      Libro.rango('ARQ_CANTIDADES').clearContent();
      SpreadsheetApp.flush();
      return { numero: cab.numero, siguiente: Number(cab.numero) + 1, url: pdf.getUrl(), enviado: enviado,
        movimientos: r.lineas.length, saldo: Util.pesos(cab.saldoFinal) };
    } finally { candado.releaseLock(); }
  }

  function historial_() { return Esquema.tablaCompleta('historial'); }

  function paraAprobar() {
    return Libro.leer(historial_(), true).filter(function (o) {
      return /^\d+$/.test(String(o['N.° relación']).trim());
    }).map(function (o) {
      return { numero: o['N.° relación'], fecha: o['Fecha'], desde: o['Periodo desde'], hasta: o['Periodo hasta'],
        responsable: o['Responsable'], saldoAnterior: o['Saldo anterior'], ingresos: o['Ingresos'],
        egresos: o['Egresos'], saldoFinal: o['Saldo final'], contado: o['Efectivo contado'],
        diferencia: o['Diferencia'], movimientos: o['Movimientos'], sinSoporte: o['Sin soporte'],
        entrega: o['Entrega'], aprobadaPor: o['Aprobada por'], fechaAprobacion: o['Fecha aprobación'],
        pdf: o['Enlace al PDF'], carpeta: o['Carpeta de soportes'], observaciones: o['Observaciones'],
        pendiente: !o['Aprobada por'] };
    });
  }

  function aprobar(numero, decision, observacion, quien) {
    var t = historial_();
    var rel = Libro.leer(t, true).filter(function (o) { return String(o['N.° relación']) === String(numero); })[0];
    if (!rel) throw new Error('No se encontró la relación N.° ' + numero + ' en el historial.');
    var d = Util.txt(decision, 60) || 'Aprobada';
    var cambios = { 'Aprobada por': d + ' — ' + quien, 'Fecha aprobación': new Date() };
    if (observacion) {
      var marca = '[' + Util.fmt(new Date()) + '] ' + Util.txt(observacion, 400);
      cambios['Observaciones'] = rel['Observaciones'] ? rel['Observaciones'] + ' · ' + marca : marca;
    }
    Libro.actualizar(t, rel._fila, cambios);
    Correo.enviar({ to: Libro.texto(Config.PAR.correoCtd),
      subject: 'Caja menor — relación N.° ' + numero + ': ' + d,
      htmlBody: '<p>La relación N.° <b>' + Util.esc(numero) + '</b> quedó marcada como <b>' + Util.esc(d) +
        '</b> por ' + Util.esc(quien) + '.</p>' + (observacion ? '<p><b>Observación:</b> ' + Util.esc(observacion) + '</p>' : '') });
    return 'Relación N.° ' + numero + ' marcada como ' + d + '.';
  }

  return { filaMovimiento: filaMovimiento_, datos: datos, cerrar: cerrar, paraAprobar: paraAprobar, aprobar: aprobar };
})();
