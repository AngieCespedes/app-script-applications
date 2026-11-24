/**
 * Guardas_ — impiden que la app web anónima ejecute funciones del menú o de activadores.
 */
var Guardas_ = (function () {
  /** Una persona con su cuenta de Google desde la hoja. Desde la app web anónima, getActiveUser() viene vacío. */
  function persona() {
    var activo = (Session.getActiveUser().getEmail() || '').toLowerCase();
    var efectivo = (Session.getEffectiveUser().getEmail() || '').toLowerCase();
    if (!activo || activo !== efectivo) throw new Error('Esta acción solo se ejecuta desde la hoja de cálculo, con su cuenta de Google.');
    return activo;
  }

  function duena() {
    var yo = persona();
    var duenaLibro = SpreadsheetApp.getActiveSpreadsheet().getOwner().getEmail().toLowerCase();
    if (yo !== duenaLibro) throw new Error('Solo la dueña del libro (' + duenaLibro + ') puede hacer esto.');
    return yo;
  }

  /** El evento debe venir de un activador real de este proyecto. */
  function activador(e) {
    var uid = e && e.triggerUid;
    var real = !!uid && ScriptApp.getProjectTriggers().some(function (t) { return t.getUniqueId() === String(uid); });
    if (!real) throw new Error('Esta función solo la corre un activador programado.');
  }

  /** Activadores simples (onEdit…): el evento real trae objetos de Google que no se pueden falsificar desde la página. */
  function eventoReal(e) {
    var ok = e && ((e.source && typeof e.source.getId === 'function') ||
      (e.range && typeof e.range.getA1Notation === 'function') || e.triggerUid);
    if (!ok) throw new Error('Evento no válido.');
  }

  /** Para funciones que están en el menú y además las corre un activador. */
  function personaOActivador(e) {
    if (e && e.triggerUid) return activador(e);
    return persona();
  }

  return { personaOActivador: personaOActivador, persona: persona, duena: duena, activador: activador, eventoReal: eventoReal };
})();
