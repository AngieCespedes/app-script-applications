/**
 * Correo — todo envío pasa por aquí.
 * En modo PRUEBA (el predeterminado) nada sale a terceros: llega solo a la
 * dueña del script, con el asunto marcado y los destinatarios originales a la vista.
 */
var Correo = (function () {
  function enviar(msg) {
    if (!msg.to) return '';
    if (Config.enProduccion()) {
      MailApp.sendEmail(msg);
      return msg.to;
    }
    var yo = Session.getEffectiveUser().getEmail();
    var aviso = '<p style="background:#FFF4D6;padding:8px;border:1px solid #E8C66A">' +
      '<b>Modo PRUEBA.</b> En producción este correo iría a: ' + Util.esc(msg.to) +
      (msg.cc ? ' (copia: ' + Util.esc(msg.cc) + ')' : '') + '</p>';
    MailApp.sendEmail({ to: yo, subject: '[PRUEBA] ' + msg.subject, htmlBody: aviso + (msg.htmlBody || ''),
      attachments: msg.attachments });
    return yo + ' (modo prueba)';
  }

  return { enviar: enviar };
})();
