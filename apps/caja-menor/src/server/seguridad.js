/**
 * Seguridad — claves cifradas, sesiones con token y guardas de contexto.
 *
 * La app web corre con la cuenta de la dueña y admite anónimos, así que
 * Google no dice quién está al otro lado: la identidad sale del token.
 */
var Seguridad = (function () {
  var SESION_HORAS = 6;              // máximo que guarda CacheService
  var INTENTOS_MAX = 5;
  var BLOQUEO_SEG = 15 * 60;

  function sal() {
    return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  }

  function cifrar(clave, salUsuario) {
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      String(salUsuario) + '·' + String(clave), Utilities.Charset.UTF_8);
    return bytes.map(function (b) { return ((b < 0 ? b + 256 : b)).toString(16).padStart(2, '0'); }).join('');
  }

  function igual(a, b) {
    a = String(a); b = String(b);
    if (a.length !== b.length) return false;
    var dif = 0;
    for (var i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return dif === 0;
  }

  function cache_() { return CacheService.getScriptCache(); }

  function abrirSesion(u) {
    var token = Utilities.getUuid() + '.' + Utilities.getUuid();
    cache_().put('ses_' + token, JSON.stringify({ usuario: u.usuario, vence: Date.now() + SESION_HORAS * 3600000 }),
      SESION_HORAS * 3600);
    return token;
  }

  /** Devuelve el usuario de la sesión, leído de nuevo de la hoja (rol y estado al día). */
  function sesion(token) {
    var t = String(token || '');
    var crudo = t ? cache_().get('ses_' + t) : null;
    if (!crudo) throw new Error('SIN_SESION');
    var s = JSON.parse(crudo);
    if (!s.vence || s.vence < Date.now()) throw new Error('SIN_SESION');
    var u = Usuarios.buscar(s.usuario);
    if (!u || !u.activo) throw new Error('SIN_SESION');
    return u;
  }

  function cerrarSesion(token) {
    try { cache_().remove('ses_' + String(token || '')); } catch (e) { /* ya no existía */ }
    return true;
  }

  /* ---------- freno a los intentos de clave ---------- */

  function intentosBloqueados(usuario) {
    return Number(cache_().get('int_' + usuario) || 0) >= INTENTOS_MAX;
  }

  function registrarFallo(usuario) {
    var n = Number(cache_().get('int_' + usuario) || 0) + 1;
    cache_().put('int_' + usuario, String(n), BLOQUEO_SEG);
  }

  function limpiarFallos(usuario) { cache_().remove('int_' + usuario); }

  /* ---------- guardas para las funciones globales fuera de la API ---------- */

  /**
   * Solo deja seguir si la llama una persona con su cuenta de Google desde la hoja.
   * Desde la app web anónima getActiveUser() viene vacío: ahí se corta.
   */
  function exigirPersonaEnLaHoja() {
    var activo = (Session.getActiveUser().getEmail() || '').toLowerCase();
    var efectivo = (Session.getEffectiveUser().getEmail() || '').toLowerCase();
    if (!activo || activo !== efectivo) throw new Error('Esta acción solo se ejecuta desde el menú de la hoja.');
    return activo;
  }

  /** Como la anterior, pero además exige que sea la dueña del libro. */
  function exigirDuena() {
    var yo = exigirPersonaEnLaHoja();
    var duena = (Libro.abrir().getOwner().getEmail() || '').toLowerCase();
    if (yo !== duena) throw new Error('Solo la dueña del libro (' + duena + ') puede hacer esto.');
    return yo;
  }

  /** Para funciones que corre un activador: el evento debe traer un activador real de este proyecto. */
  function exigirActivador(e) {
    var uid = e && e.triggerUid;
    var existe = !!uid && ScriptApp.getProjectTriggers().some(function (t) { return t.getUniqueId() === String(uid); });
    if (!existe) throw new Error('Esta función solo la corre el activador programado.');
  }

  return {
    sal: sal, cifrar: cifrar, igual: igual, abrirSesion: abrirSesion, sesion: sesion,
    cerrarSesion: cerrarSesion, intentosBloqueados: intentosBloqueados, registrarFallo: registrarFallo,
    limpiarFallos: limpiarFallos, exigirPersonaEnLaHoja: exigirPersonaEnLaHoja,
    exigirDuena: exigirDuena, exigirActivador: exigirActivador
  };
})();
