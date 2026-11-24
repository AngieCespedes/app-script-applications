/**
 * ClavesOC_ — contraseñas del portal de órdenes de compra.
 * Antes se guardaban en texto plano en la hoja de usuarios y la pantalla de usuarios las mostraba.
 * Ahora se guardan como «sha256$sal$hash». Las que siguen en texto plano se cifran solas la
 * primera vez que la persona entra con ellas (no hay que pedirle a nadie que cambie la clave).
 * Tras 5 intentos fallidos el usuario queda bloqueado 15 minutos.
 */
var ClavesOC_ = (function () {
  var PREFIJO = 'sha256$';
  var MAX_FALLOS = 5;

  function hash_(clave, sal) {
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + '·' + clave, Utilities.Charset.UTF_8)
      .map(function (b) { return ((b < 0 ? b + 256 : b)).toString(16).padStart(2, '0'); }).join('');
  }

  function cifrar(clave) {
    var sal = Utilities.getUuid().replace(/-/g, '');
    return PREFIJO + sal + '$' + hash_(String(clave), sal);
  }

  function igual_(a, b) {
    a = String(a); b = String(b);
    if (a.length !== b.length) return false;
    var d = 0;
    for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
  }

  /** Compara la clave escrita con la guardada. Si la guardada estaba en texto plano y coincide, la cifra en la hoja. */
  function verificar(guardada, escrita, usuario, fila) {
    var cache = CacheService.getScriptCache();
    var llave = 'oc_fallos_' + String(usuario).toLowerCase();
    if (Number(cache.get(llave) || 0) >= MAX_FALLOS) return false;
    var g = String(guardada || '');
    var ok;
    if (g.indexOf(PREFIJO) === 0) {
      var partes = g.split('$');
      ok = igual_(hash_(String(escrita), partes[1]), partes[2]);
    } else {
      ok = g !== '' && igual_(g, String(escrita));
      if (ok && fila) ocHoja_(OC_H_USU).getRange(fila, 3).setValue(cifrar(escrita));
    }
    if (!ok) cache.put(llave, String(Number(cache.get(llave) || 0) + 1), 900);
    return ok;
  }

  return { cifrar: cifrar, verificar: verificar };
})();
