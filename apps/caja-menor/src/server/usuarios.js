/**
 * Usuarios — cuentas propias de la plataforma (hoja Usuarios).
 * Las claves se guardan como SHA-256 de (sal + clave), con sal por usuario.
 */
var Usuarios = (function () {
  var ROLES = ['Auxiliar', 'Contadora', 'Gerencia'];
  var USUARIO_RE = /^[a-z0-9._-]{3,30}$/;
  var C = {
    nombre: 'Nombre completo', usuario: 'Usuario', hash: 'Clave (cifrada)', sal: 'Sal',
    rol: 'Rol', activo: 'Activo', creado: 'Creado', ultimo: 'Último ingreso',
    debeCambiar: 'Debe cambiar la clave'
  };

  function tabla_() { return Esquema.tablaCompleta('usuarios'); }

  function todos() {
    return Libro.leer(tabla_()).map(function (o) {
      return {
        fila: o._fila, nombre: String(o[C.nombre] || ''),
        usuario: String(o[C.usuario] || '').toLowerCase().trim(),
        hash: String(o[C.hash] || ''), sal: String(o[C.sal] || ''), rol: String(o[C.rol] || ''),
        activo: String(o[C.activo] || '').toUpperCase() !== 'NO',
        creado: o[C.creado], ultimo: o[C.ultimo],
        debeCambiar: String(o[C.debeCambiar] || '').toUpperCase() === 'SÍ'
      };
    }).filter(function (u) { return u.usuario; });
  }

  function buscar(usuario) {
    var u = String(usuario || '').toLowerCase().trim();
    return todos().filter(function (x) { return x.usuario === u; })[0] || null;
  }

  function hayUsuarios() { return todos().length > 0; }

  function validarClave_(clave) {
    if (String(clave || '').length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }

  function alta(d) {
    var nombre = Util.txt(d.nombre, 120);
    var usuario = String(d.usuario || '').toLowerCase().trim();
    var rol = String(d.rol || 'Auxiliar');
    if (!nombre) throw new Error('Escriba el nombre completo.');
    if (!USUARIO_RE.test(usuario)) throw new Error('El usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo.');
    validarClave_(d.clave);
    if (ROLES.indexOf(rol) === -1) throw new Error('Rol no válido: ' + rol);
    if (buscar(usuario)) throw new Error('Ya existe un usuario con ese nombre: ' + usuario);
    var s = Seguridad.sal();
    var obj = {};
    obj[C.nombre] = nombre.toUpperCase(); obj[C.usuario] = usuario;
    obj[C.hash] = Seguridad.cifrar(d.clave, s); obj[C.sal] = s; obj[C.rol] = rol;
    obj[C.activo] = 'Sí'; obj[C.creado] = new Date(); obj[C.ultimo] = '';
    obj[C.debeCambiar] = d.debeCambiar === false ? 'No' : 'Sí';
    Libro.agregar(tabla_(), obj);
    return { nombre: nombre, usuario: usuario, rol: rol };
  }

  /** Solo funciona cuando todavía no hay ningún usuario. */
  function crearAdministradora(d) {
    var candado = LockService.getScriptLock();
    candado.waitLock(20000);
    try {
      if (hayUsuarios()) throw new Error('Ya hay usuarios creados. Entre con el suyo.');
      alta({ nombre: d.nombre, usuario: d.usuario, clave: d.clave, rol: 'Contadora', debeCambiar: false });
    } finally { candado.releaseLock(); }
    return iniciarSesion(d.usuario, d.clave);
  }

  function iniciarSesion(usuario, clave) {
    var nombreU = String(usuario || '').toLowerCase().trim();
    var falla = 'Usuario o contraseña incorrectos.';
    if (Seguridad.intentosBloqueados(nombreU)) throw new Error('Demasiados intentos. Espere 15 minutos o pida a la contadora que le restablezca la clave.');
    var u = buscar(nombreU);
    if (!u || !Seguridad.igual(Seguridad.cifrar(clave, u.sal), u.hash)) {
      Seguridad.registrarFallo(nombreU);
      Utilities.sleep(400);
      throw new Error(falla);
    }
    if (!u.activo) throw new Error('Ese usuario está desactivado. Hable con la contadora.');
    Seguridad.limpiarFallos(nombreU);
    Libro.actualizar(tabla_(), u.fila, (function () { var o = {}; o[C.ultimo] = new Date(); return o; })());
    return { token: Seguridad.abrirSesion(u), nombre: u.nombre, usuario: u.usuario, rol: u.rol, debeCambiar: u.debeCambiar };
  }

  function listar() {
    return todos().map(function (u) {
      return { nombre: u.nombre, usuario: u.usuario, rol: u.rol, activo: u.activo,
        creado: u.creado instanceof Date ? Util.fmt(u.creado) : '',
        ultimo: u.ultimo instanceof Date ? Utilities.formatDate(u.ultimo, Config.ZONA, 'dd/MM/yyyy HH:mm') : 'Nunca',
        debeCambiar: u.debeCambiar };
    });
  }

  function exigir_(usuario) { var u = buscar(usuario); if (!u) throw new Error('No existe ese usuario.'); return u; }

  function quedaOtraContadora_(u) {
    return todos().some(function (x) { return x.rol === 'Contadora' && x.activo && x.usuario !== u.usuario; });
  }

  function cambiarRol(usuario, rol) {
    var u = exigir_(usuario);
    if (ROLES.indexOf(rol) === -1) throw new Error('Rol no válido.');
    if (u.rol === 'Contadora' && rol !== 'Contadora' && !quedaOtraContadora_(u))
      throw new Error('No puede quitar la última contadora: nadie podría volver a administrar usuarios.');
    var o = {}; o[C.rol] = rol;
    Libro.actualizar(tabla_(), u.fila, o);
    return listar();
  }

  function activar(usuario, activo) {
    var u = exigir_(usuario);
    if (!activo && u.rol === 'Contadora' && !quedaOtraContadora_(u)) throw new Error('No puede desactivar la última contadora activa.');
    var o = {}; o[C.activo] = activo ? 'Sí' : 'No';
    Libro.actualizar(tabla_(), u.fila, o);
    return listar();
  }

  function ponerClave_(u, clave, debeCambiar) {
    var s = Seguridad.sal();
    var o = {}; o[C.hash] = Seguridad.cifrar(clave, s); o[C.sal] = s; o[C.debeCambiar] = debeCambiar ? 'Sí' : 'No';
    Libro.actualizar(tabla_(), u.fila, o);
  }

  function restablecer(usuario, claveNueva, debeCambiar) {
    var u = exigir_(usuario);
    validarClave_(claveNueva);
    ponerClave_(u, claveNueva, debeCambiar !== false);
    return listar();
  }

  function cambiarMiClave(usuario, claveVieja, claveNueva) {
    var u = exigir_(usuario);
    if (!Seguridad.igual(Seguridad.cifrar(claveVieja, u.sal), u.hash)) throw new Error('La contraseña actual no coincide.');
    validarClave_(claveNueva);
    if (claveVieja === claveNueva) throw new Error('La contraseña nueva no puede ser igual a la actual.');
    ponerClave_(u, claveNueva, false);
    return true;
  }

  return { ROLES: ROLES, buscar: buscar, hayUsuarios: hayUsuarios, alta: alta,
    crearAdministradora: crearAdministradora, iniciarSesion: iniciarSesion, listar: listar,
    cambiarRol: cambiarRol, activar: activar, restablecer: restablecer, cambiarMiClave: cambiarMiClave };
})();
