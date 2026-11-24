/**
 * Correo_ — todo envío pasa por aquí. En modo PRUEBA solo le llega a la dueña, con el asunto marcado.
 * Acepta las dos firmas de Google: (objeto) o (para, asunto, cuerpo, opciones).
 */
var Correo_ = (function () {
  function normalizar_(a) {
    if (a.length === 1 && typeof a[0] === 'object') return Object.assign({}, a[0]);
    var o = Object.assign({}, a[3] || {});
    o.to = a[0]; o.subject = a[1]; o.body = a[2];
    return o;
  }

  function prueba_(m) {
    var yo = Session.getEffectiveUser().getEmail();
    var nota = 'MODO PRUEBA. En producción iría a: ' + m.to + (m.cc ? ' (copia: ' + m.cc + ')' : '') + (m.bcc ? ' (oculta: ' + m.bcc + ')' : '');
    var r = Object.assign({}, m, { to: yo, cc: '', bcc: '', subject: '[PRUEBA] ' + (m.subject || '') });
    r.body = nota + '\n\n' + (m.body || '');
    if (m.htmlBody) r.htmlBody = '<p style="background:#FFF4D6;padding:8px">' + nota + '</p>' + m.htmlBody;
    return r;
  }

  function enviar() {
    var m = normalizar_(arguments);
    MailApp.sendEmail(Config_.enProduccion() ? m : prueba_(m));
  }

  function enviarGmail() {
    var m = normalizar_(arguments);
    if (!Config_.enProduccion()) m = prueba_(m);
    var opciones = Object.assign({}, m);
    ['to', 'subject', 'body'].forEach(function (k) { delete opciones[k]; });
    GmailApp.sendEmail(m.to, m.subject, m.body || '', opciones);
  }

  return { enviar: enviar, enviarGmail: enviarGmail };
})();

