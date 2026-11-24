/**
 * UsuariosApp_ — usuarios de la toma física en la hoja oculta USUARIOS_APP, con el PIN cifrado (SHA-256 + sal).
 * Antes los PIN estaban escritos en el código, en texto plano.
 *
 * Para dar o cambiar un PIN: la dueña escribe el PIN en la columna «PIN nuevo» y usa
 * Instalación › Cifrar PIN nuevos. El PIN se cifra y la casilla queda vacía.
 */
var UsuariosApp_ = (function () {
  var HOJA = 'USUARIOS_APP';
  var ENC = ['Usuario', 'Nombre', 'Rol', 'Cargo', 'PIN nuevo', 'PIN cifrado', 'Sal', 'Activo'];
  /* Quiénes estaban en la versión anterior (sin PIN: la dueña los asigna). */
  var INICIALES = [
    ['liliana', 'Liliana', 'ALMACEN', 'Almacen'], ['johan', 'Johan', 'ALMACEN', 'Almacen'],
    ['sebastian', 'Sebastian', 'ALMACEN', 'Almacen'], ['vannesa', 'Vannesa', 'AUDITOR', 'Auditoria'],
    ['erika', 'Erika', 'GERENCIA', 'Gerencia'], ['angie', 'Angie', 'ADMIN', 'Administradora']
  ];
  var MAX_FALLOS = 5;

  function hoja_() {
    var ss = libro_();
    var h = ss.getSheetByName(HOJA);
    if (h) return h;
    h = ss.insertSheet(HOJA);
    h.getRange(1, 1, 1, ENC.length).setValues([ENC]).setFontWeight('bold');
    h.getRange(2, 1, INICIALES.length, 8).setValues(INICIALES.map(function (u) { return u.concat(['', '', '', 'Sí']); }));
    h.hideColumns(6, 2);
    h.hideSheet();
    return h;
  }

  function filas_() {
    var h = hoja_();
    var n = Math.max(h.getLastRow() - 1, 0);
    if (!n) return [];
    return h.getRange(2, 1, n, 8).getValues().map(function (f, i) {
      return { fila: i + 2, id: String(f[0]).trim().toLowerCase(), nombre: f[1], rol: f[2], cargo: f[3],
        pinNuevo: String(f[4]), hash: String(f[5]), sal: String(f[6]), activo: String(f[7]).toUpperCase() !== 'NO' };
    }).filter(function (u) { return u.id; });
  }

  function cifrar_(pin, sal) {
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + '·' + pin, Utilities.Charset.UTF_8)
      .map(function (b) { return ((b < 0 ? b + 256 : b)).toString(16).padStart(2, '0'); }).join('');
  }

  function todos() { return filas_().filter(function (u) { return u.activo; }); }

  function autenticar(usuario, clave) {
    var k = String(usuario || '').trim().toLowerCase();
    var cache = CacheService.getScriptCache();
    var fallos = Number(cache.get('fallos_' + k) || 0);
    if (fallos >= MAX_FALLOS) return null;
    var u = todos().filter(function (x) { return x.id === k; })[0];
    if (!u || !u.hash || cifrar_(String(clave).trim(), u.sal) !== u.hash) {
      cache.put('fallos_' + k, String(fallos + 1), 900);
      return null;
    }
    return { id: k, nombre: u.nombre, rol: u.rol, cargo: u.cargo };
  }

  /** Cifra los PIN escritos en «PIN nuevo» y borra la casilla. */
  function cifrarPinsNuevos() {
    var h = hoja_(), n = 0;
    filas_().forEach(function (u) {
      if (!u.pinNuevo.trim()) return;
      if (!/^\d{4,8}$/.test(u.pinNuevo.trim())) throw new Error('El PIN de ' + u.id + ' debe tener de 4 a 8 dígitos.');
      var sal = Utilities.getUuid().replace(/-/g, '');
      h.getRange(u.fila, 5, 1, 3).setValues([['', cifrar_(u.pinNuevo.trim(), sal), sal]]);
      n++;
    });
    return n;
  }

  return { todos: todos, autenticar: autenticar, cifrarPinsNuevos: cifrarPinsNuevos, hoja: hoja_ };
})();

/** Menú: cifra los PIN nuevos. Solo la dueña. */
function menuCifrarPins() {
  Guardas_.duena();
  var n = UsuariosApp_.cifrarPinsNuevos();
  SpreadsheetApp.getUi().alert('Listo: ' + n + ' PIN cifrado(s). La hoja USUARIOS_APP está oculta: Ver › Hojas ocultas para abrirla.');
}

/** Menú: muestra la hoja de usuarios para asignar PIN. Solo la dueña. */
function menuVerUsuarios() {
  Guardas_.duena();
  UsuariosApp_.hoja().showSheet().activate();
}
