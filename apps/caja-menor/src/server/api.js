/**
 * API — la única puerta de la app web.
 *
 * Cada acción declara quién la puede usar:
 *   publica   → sin sesión (entrar, salir, primer uso)
 *   todos     → cualquier usuario con sesión
 *   contadora → solo rol Contadora
 *   aprobador → Contadora o Gerencia
 * Quien está registrando (s.nombre) lo pone el servidor, nunca la página.
 */
var Api = (function () {
  var RUTAS = {
    hayUsuarios:         { rol: 'publica', fn: function () { return Usuarios.hayUsuarios(); } },
    iniciarSesion:       { rol: 'publica', fn: function (s, a) { return Usuarios.iniciarSesion(a[0], a[1]); } },
    cerrarSesion:        { rol: 'publica', fn: function (s, a) { return Seguridad.cerrarSesion(a[0]); } },
    crearAdministradora: { rol: 'publica', fn: function (s, a) { return Usuarios.crearAdministradora(a[0] || {}); } },

    cambiarMiClave:   { rol: 'todos', clave: true, fn: function (s, a) { return Usuarios.cambiarMiClave(s.usuario, a[1], a[2]); } },
    datosWeb:         { rol: 'todos', clave: true, fn: function () { return Panel.web(); } },
    datosRelacion:    { rol: 'todos', fn: function () { return Consultas.relacion(); } },
    guardarPago:      { rol: 'todos', fn: function (s, a) { return conPanel_(Registro.guardarPago(a[0] || {}, s.nombre)); } },
    guardarIngreso:   { rol: 'todos', fn: function (s, a) { return conPanel_(Registro.guardarIngreso(a[0] || {}, s.nombre)); } },
    guardarEntrega:   { rol: 'todos', fn: function (s, a) { return conPanel_(Registro.guardarEntrega(a[0] || {}, s.nombre)); } },
    subirLote:        { rol: 'todos', fn: function (s, a) { return conPanel_(Soportes.subirLote(a[0])); } },
    registrarLote:    { rol: 'todos', fn: function (s, a) { return conPanel_(Registro.registrarLote(a[0], s.nombre)); } },
    guardarArqueo:    { rol: 'todos', fn: function (s, a) { return conPanel_(Arqueo.guardar(a[0] || {}, a[1], s.nombre)); } },
    datosCierre:      { rol: 'todos', fn: function () { return Cierre.datos(); } },
    cerrarRelacion:   { rol: 'todos', fn: function (s, a) { return Cierre.cerrar(a[0], a[1], a[2], a[3]); } },
    listaPendientes:  { rol: 'todos', fn: function () { return Relacion.pendientesDSE(); } },
    linkWhatsApp:     { rol: 'todos', fn: function (s, a) { return Consultas.linkWhatsApp(a[0], a[1], a[2], a[3], a[4]); } },
    consultaTercero:  { rol: 'todos', fn: function (s, a) { return Consultas.consultaTercero(a[0]); } },
    listaTercerosBanca: { rol: 'todos', fn: function () { return Consultas.tercerosBanca(); } },
    datosTablero:     { rol: 'todos', fn: function () { return Consultas.tablero(); } },
    datosBanco:       { rol: 'todos', fn: function () { return Consultas.banco(); } },
    datosPoliticas:   { rol: 'todos', fn: function () { return Consultas.politicas(); } },
    datosInformes:    { rol: 'todos', fn: function () { return Consultas.informes(); } },
    datosEntregas:    { rol: 'todos', fn: function () { return Entregas.listar(); } },
    confirmarEntrega: { rol: 'todos', fn: function (s, a) { return Entregas.confirmar(a[0], s.nombre); } },
    datosAuditoria:   { rol: 'todos', fn: function () { return Consultas.auditoria(); } },
    datosUbicacion:   { rol: 'todos', fn: function (s) { return Admin.datosUbicacion(rolWeb(s.rol)); } },
    datosEmpalme:     { rol: 'todos', fn: function () { return Arqueo.datosEmpalme(); } },
    generarEmpalme:   { rol: 'todos', fn: function (s, a) { return conPanel_(Arqueo.generarEmpalme(a[0] || {})); } },
    agregarALista:    { rol: 'todos', fn: function (s, a) { return Admin.agregarALista(a[0], a[1]); } },

    relacionesParaAprobar: { rol: 'aprobador', fn: function () { return Cierre.paraAprobar(); } },
    aprobarRelacion:  { rol: 'aprobador', fn: function (s, a) { return Cierre.aprobar(a[0], a[1], a[2], s.nombre); } },

    datosGestion:     { rol: 'contadora', fn: function () { return Consultas.gestion(); } },
    listaCasos:       { rol: 'contadora', fn: function () { return Casos.listar(); } },
    guardarDecision:  { rol: 'contadora', fn: function (s, a) { return Casos.decidir(a[0], a[1], a[2]); } },
    datosRevision:    { rol: 'contadora', fn: function (s, a) { return Consultas.revision(a[0]); } },
    anotarFila:       { rol: 'contadora', fn: function (s, a) { return Consultas.anotarFila(a[0], a[1]); } },
    datosParams:      { rol: 'contadora', fn: function () { return Admin.datosParams(); } },
    agregarResponsable: { rol: 'contadora', fn: function (s, a) { return Admin.agregarResponsable(a[0] || {}); } },
    guardarRoles:     { rol: 'contadora', fn: function (s, a) { return Admin.guardarRoles(a[0] || {}); } },
    datosAccesos:     { rol: 'contadora', fn: function () { return Admin.datosAccesos(); } },
    darAcceso:        { rol: 'contadora', fn: function (s, a) { return Admin.darAcceso(a[0] || {}); } },
    quitarAcceso:     { rol: 'contadora', fn: function (s, a) { return Admin.quitarAcceso(a[0]); } },
    asignarRol:       { rol: 'contadora', fn: function (s, a) { return Admin.asignarRol(a[0], a[1]); } },
    listarUsuarios:   { rol: 'contadora', fn: function () { return Usuarios.listar(); } },
    crearUsuario:     { rol: 'contadora', fn: function (s, a) { Usuarios.alta(a[0] || {}); return Usuarios.listar(); } },
    cambiarRolUsuario: { rol: 'contadora', fn: function (s, a) { return Usuarios.cambiarRol(a[0], a[1]); } },
    activarUsuario:   { rol: 'contadora', fn: function (s, a) { return Usuarios.activar(a[0], a[1]); } },
    restablecerClave: { rol: 'contadora', fn: function (s, a) { return Usuarios.restablecer(a[0], a[1], a[2]); } }
  };

  function rolWeb(rol) { return rol === 'Contadora' ? 'contadora' : rol === 'Gerencia' ? 'gerencia' : 'auxiliar'; }

  function conPanel_(r) { r.panel = Panel.datos(); return r; }

  /**
   * Decide si una sesión puede ejecutar una ruta. Pura: se prueba en Node.
   * Devuelve '' si puede, o el motivo si no.
   */
  function motivoRechazo(ruta, sesion) {
    if (!ruta) return 'Operación no permitida.';
    if (ruta.rol === 'publica') return '';
    if (!sesion) return 'SIN_SESION';
    if (sesion.debeCambiar && !ruta.clave) return 'Primero cambie la contraseña que le dieron.';
    if (ruta.rol === 'todos') return '';
    if (ruta.rol === 'contadora') return sesion.rol === 'Contadora' ? '' : 'Esa pantalla es solo de la contadora.';
    if (ruta.rol === 'aprobador') return (sesion.rol === 'Contadora' || sesion.rol === 'Gerencia') ? '' : 'Esa operación es de gerencia o de la contadora.';
    return 'Operación no permitida.';
  }

  function despachar(token, accion, args) {
    Esquema.verificar();
    var ruta = RUTAS[String(accion || '')];
    var s = (ruta && ruta.rol !== 'publica') ? Seguridad.sesion(token) : null;
    var motivo = motivoRechazo(ruta, s);
    if (motivo) throw new Error(motivo);
    var r = ruta.fn(s, Array.isArray(args) ? args : []);
    if (s && r && typeof r === 'object' && accion === 'datosWeb') {
      r.rol = rolWeb(s.rol); r.quien = s.nombre; r.usuario = s.usuario; r.debeCambiar = s.debeCambiar;
    }
    return r;
  }

  return { RUTAS: RUTAS, motivoRechazo: motivoRechazo, despachar: despachar, rolWeb: rolWeb };
})();

/* ===== Funciones globales: las ÚNICAS que la página puede llamar ===== */

/** Sirve la página. */
function doGet() {
  return HtmlService.createTemplateFromFile('client/index').evaluate()
    .setTitle('Caja Menor — Social Solar S.A.S.')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Puerta única: api(token, 'accion', [argumentos]). */
function api(token, accion, args) {
  return Api.despachar(token, accion, args);
}
