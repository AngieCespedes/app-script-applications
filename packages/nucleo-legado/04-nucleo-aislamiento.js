/**
 * Aislamiento_ — en modo PRUEBA la copia solo puede abrir hojas, formularios y carpetas que estén
 * dentro de su propia carpeta (la que contiene el libro). Así, aunque los datos copiados apunten a
 * archivos de producción (p. ej. formatos por proyecto), la copia no los toca.
 * En PRODUCCIÓN deja pasar todo, como la app original.
 */
var Aislamiento_ = (function () {
  var NIVELES = 8;

  function raiz_() {
    var c = CacheService.getScriptCache();
    var r = c.get('aisl_raiz');
    if (r) return r;
    var libro = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(Config_.id(Object.keys(IDS_).filter(function (k) { return IDS_[k] === 'libro'; })[0]));
    r = DriveApp.getFileById(libro.getId()).getParents().next().getId();
    c.put('aisl_raiz', r, 21600);
    return r;
  }

  function dentro_(item, raiz) {
    var actual = item;
    for (var i = 0; i < NIVELES; i++) {
      var ps = actual.getParents();
      if (!ps.hasNext()) return false;
      actual = ps.next();
      if (actual.getId() === raiz) return true;
    }
    return false;
  }

  function permitido_(id, esCarpeta) {
    if (Config_.enProduccion()) return true;
    var raiz = raiz_();
    if (id === raiz) return true;
    var c = CacheService.getScriptCache();
    var k = 'aisl_' + id;
    var guardado = c.get(k);
    if (guardado) return guardado === '1';
    var item = esCarpeta ? DriveApp.getFolderById(id) : DriveApp.getFileById(id);
    var ok = dentro_(item, raiz);
    c.put(k, ok ? '1' : '0', 3600);
    return ok;
  }

  function exigir_(id, esCarpeta) {
    if (!permitido_(String(id), esCarpeta)) {
      throw new Error('Modo PRUEBA: la copia no puede abrir el archivo ' + id + ' porque está fuera de su carpeta. ' +
        'Así se protege la información de producción.');
    }
  }

  function abrirLibro(id) { exigir_(id, false); return SpreadsheetApp.openById(id); }
  function abrirFormulario(id) { exigir_(id, false); return FormApp.openById(id); }
  function carpeta(id) { exigir_(id, true); return DriveApp.getFolderById(id); }

  return { abrirLibro: abrirLibro, abrirFormulario: abrirFormulario, carpeta: carpeta };
})();
