/**
 * Arqueo — conteo del efectivo (hoja Arqueo), historial de arqueos y
 * acta de entrega del cargo (empalme).
 *
 * Cambio frente a v3: cada arqueo queda en la hoja «Arqueos» con su fecha, y la
 * Relación solo toma como «efectivo contado» un arqueo posterior al último movimiento.
 */
var Arqueo = (function () {
  function guardar(conteo, observaciones, quien) {
    var cant = Config.DENOMINACIONES.map(function (d) { return [Number(conteo[String(d)]) || '']; });
    Libro.rango('ARQ_CANTIDADES').setValues(cant);
    var hoy = Util.soloFecha(new Date());
    Libro.poner('ARQ_FECHA', hoy);
    if (observaciones) Libro.poner('ARQ_OBSERVACIONES', Util.txt(observaciones, 400));
    SpreadsheetApp.flush();

    var total = Libro.numero('ARQ_TOTAL'), sistema = Libro.numero('ARQ_SISTEMA');
    Libro.agregar(Libro.tabla('arqueos'), {
      'Fecha y hora': new Date(), 'N.° relación': Libro.valor('REL_NUMERO'), 'Quién contó': Util.txt(quien, 80),
      'Total contado': total, 'Saldo según el sistema': sistema, 'Diferencia': total - sistema,
      'Detalle': Config.DENOMINACIONES.map(function (d, i) { return cant[i][0] ? cant[i][0] + '×' + d : ''; })
        .filter(String).join(', '),
      'Observaciones': Util.txt(observaciones, 400)
    });
    return {
      total: total, totalTxt: Util.pesos(total), sistema: sistema, sistemaTxt: Util.pesos(sistema),
      diferencia: total - sistema, diferenciaTxt: Util.pesos(Math.abs(total - sistema)),
      estado: Libro.texto('ARQ_ESTADO'),
      checklist: Libro.bloque('ARQ_CHECKLIST').filter(function (f) { return f[0]; })
        .map(function (f) { return { texto: f[0], estado: f[1] }; })
    };
  }

  function responsables_() { return Libro.tabla('responsables'); }

  function datosEmpalme() {
    var r = Relacion.revisar(), c = Relacion.cabecera();
    return {
      numero: String(c.numero), entrega: Relacion.responsableHoy(), saldo: c.saldoFinal, saldoTxt: Util.pesos(c.saldoFinal),
      contado: c.contado === '' ? null : Number(c.contado),
      contadoTxt: c.contado === '' ? 'Sin arqueo' : Util.pesos(Number(c.contado)),
      estadoArqueo: c.estadoArqueo, movimientos: r.lineas.length,
      pendientes: { alertas: r.errores, avisos: r.avisos, dse: Relacion.pendientesDSE().length,
        casos: Casos.pendientes(), entregas: Entregas.porConfirmar() },
      responsables: Libro.leer(responsables_(), true).filter(function (o) { return o['Nombre completo']; })
        .map(function (o) { return { nombre: o['Nombre completo'], desde: o['Fecha de inicio'],
          hasta: o['Fecha de retiro'], estado: o['Estado'] }; })
    };
  }

  function listaPendientes_(e) {
    var p = e.pendientes;
    return [].concat(p.alertas, p.avisos,
      p.dse ? [p.dse + ' documento(s) soporte por conseguir'] : [],
      p.casos ? [p.casos + ' caso(s) esperando decisión de la contadora'] : [],
      p.entregas ? [p.entregas + ' entrega(s) de efectivo sin confirmar'] : []);
  }

  function actaHtml_(d) {
    var fila = function (a, b) {
      return '<tr><td style="padding:6px 10px;background:#FFE7B0;border:1px solid #ddd;width:38%"><b>' + Util.esc(a) +
        '</b></td><td style="padding:6px 10px;border:1px solid #ddd">' + Util.esc(b) + '</td></tr>';
    };
    var dif = d.contado - d.saldo;
    return '<html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;font-size:12px;color:#1A1A1A;padding:28px">' +
      '<h2 style="margin:0">ACTA DE ENTREGA DE CAJA MENOR</h2>' +
      '<p style="color:#6B6761;margin:4px 0 18px">SOCIAL SOLAR S.A.S. · NIT 901.128.826-6 · Paipa, Boyacá</p>' +
      '<table style="border-collapse:collapse;width:100%">' + fila('Fecha de la entrega', Util.fmt(d.fecha)) +
      fila('Relación en curso', 'N.° ' + d.numero) + fila('Entrega la caja', d.entrega) + fila('Recibe la caja', d.recibe) +
      fila('Saldo según el sistema', Util.pesos(d.saldo)) + fila('Efectivo contado y entregado', Util.pesos(d.contado)) +
      fila('Diferencia', dif === 0 ? 'Ninguna — la caja cuadra' : (dif > 0 ? 'Sobrante de ' : 'Faltante de ') + Util.pesos(Math.abs(dif))) +
      fila('Movimientos de la relación', String(d.movimientos)) + '</table>' +
      '<h3 style="margin:22px 0 6px">Asuntos pendientes que se entregan</h3>' +
      (d.pendientes.length ? '<ul style="margin:0;padding-left:18px">' + d.pendientes.map(function (x) {
        return '<li style="margin-bottom:3px">' + Util.esc(x) + '</li>'; }).join('') + '</ul>'
        : '<p style="margin:0">Ninguno. La caja se entrega al día.</p>') +
      (d.observaciones ? '<h3 style="margin:22px 0 6px">Observaciones</h3><p style="margin:0">' + Util.esc(d.observaciones) + '</p>' : '') +
      '<p style="margin:26px 0 0;font-size:11.5px;color:#6B6761">Quien recibe declara haber contado el efectivo relacionado y haber recibido los soportes físicos y digitales de la relación en curso.</p>' +
      '<table style="width:100%;margin-top:46px"><tr><td style="width:46%;border-top:1px solid #1A1A1A;padding-top:6px;font-size:11.5px">Entrega<br><b>' +
      Util.esc(d.entrega) + '</b><br>C.C.</td><td style="width:8%"></td><td style="width:46%;border-top:1px solid #1A1A1A;padding-top:6px;font-size:11.5px">Recibe<br><b>' +
      Util.esc(d.recibe) + '</b><br>C.C.</td></tr></table></body></html>';
  }

  function generarEmpalme(d) {
    var entrega = Util.txt(d.entrega, 120) || Relacion.responsableHoy();
    var recibe = Util.txt(d.recibe, 120);
    if (!recibe) throw new Error('Escriba el nombre de quien recibe la caja.');
    var fecha = Util.aFecha(d.fecha) || new Date();
    var contado = Util.entero(d.contado);
    if (!(contado > 0)) throw new Error('Escriba el efectivo contado al momento de la entrega.');
    var e = datosEmpalme();
    var nombre = 'ACTA_ENTREGA_CAJA_' + Util.compacta(fecha) + '.pdf';
    var html = actaHtml_({ fecha: fecha, numero: e.numero, entrega: entrega, recibe: recibe, saldo: e.saldo,
      contado: contado, movimientos: e.movimientos, pendientes: listaPendientes_(e), observaciones: Util.txt(d.observaciones, 800) });
    var pdf = Soportes.subcarpeta(Soportes.carpetaDelMes(fecha), '05 RELACIONES CERRADAS')
      .createFile(Utilities.newBlob(html, 'text/html', 'acta.html').getAs('application/pdf').setName(nombre));
    Responsables.registrarEmpalme(entrega, recibe, fecha, e.numero, pdf.getUrl(), d);
    SpreadsheetApp.flush();
    return { url: pdf.getUrl(), nombre: nombre, diferencia: contado - e.saldo, entrega: entrega, recibe: recibe };
  }

  return { guardar: guardar, datosEmpalme: datosEmpalme, generarEmpalme: generarEmpalme };
})();
