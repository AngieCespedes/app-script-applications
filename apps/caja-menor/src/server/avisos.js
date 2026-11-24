/**
 * Avisos — correo cuando el saldo de la caja sale del rango (uno por tipo y por día).
 */
var Avisos = (function () {
  function revisarSaldo() {
    SpreadsheetApp.flush();
    var s = Consultas.saldos();
    var tipo = s.saldo > s.objetivo ? 'alto' : s.saldo < s.minimo ? 'bajo' : '';
    if (!tipo) return 'Saldo dentro del rango: ' + Util.pesos(s.saldo);

    var hoy = Util.compacta(new Date());
    var props = PropertiesService.getScriptProperties();
    if (props.getProperty('aviso_' + tipo) === hoy) return 'Ya se avisó hoy.';

    var aux = Libro.texto(Config.PAR.correoAux), ctd = Libro.texto(Config.PAR.correoCtd), ger = Libro.texto(Config.PAR.correoGer);
    var msg;
    if (tipo === 'alto') {
      var exc = s.saldo - s.objetivo;
      msg = { to: [aux, ger].filter(String).join(','), cc: ctd,
        subject: 'Caja menor — excedente de ' + Util.pesos(exc) + ' por consignar',
        htmlBody: '<p>Buen día.</p><p>El saldo de la caja menor de Social Solar S.A.S. está en <b>' + Util.pesos(s.saldo) +
          '</b>, por encima del objetivo de ' + Util.pesos(s.objetivo) + '.</p><p><b>Excedente por consignar: ' +
          Util.pesos(exc) + '</b></p><p>Por favor consignar el excedente en la cuenta de Bancolombia y registrar el comprobante el mismo día.</p>' };
    } else {
      var reem = s.objetivo - s.saldo;
      msg = { to: ger, cc: aux, subject: 'Caja menor — saldo por debajo del mínimo, se requiere reembolso',
        htmlBody: '<p>Buen día.</p><p>El saldo de la caja menor está en <b>' + Util.pesos(s.saldo) + '</b>, por debajo del mínimo de ' +
          Util.pesos(s.minimo) + '.</p><p><b>Reembolso solicitado: ' + Util.pesos(reem) + '</b></p><p>Sin ese reembolso no se pueden atender los gastos menores.</p>' };
    }
    if (!msg.to) return 'No hay correos configurados en la hoja Listas.';
    msg.htmlBody += '<p style="font-size:12px;color:#666">— Enviado automáticamente por la caja menor · responsable: ' +
      Util.esc(Relacion.responsableHoy()) + '</p>';
    var a = Correo.enviar(msg);
    props.setProperty('aviso_' + tipo, hoy);
    return 'Aviso enviado a ' + a;
  }

  return { revisarSaldo: revisarSaldo };
})();
