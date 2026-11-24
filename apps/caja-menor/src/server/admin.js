/**
 * Admin — parámetros, listas, enlaces y accesos de Drive (pantallas de la contadora).
 *
 * Política de acceso a Drive (cambio frente a v3, donde todos quedaban como editores):
 *   Contadora → edita el libro y la carpeta · Gerencia → solo lectura del libro y la carpeta
 *   Auxiliar  → solo lectura de la carpeta de soportes (registra todo por la app)
 */
var Admin = (function () {
  var CELDA_ROL = { Auxiliar: 'correoAux', Contadora: 'correoCtd', Gerencia: 'correoGer' };
  var LISTA_EDITABLE = { centro: 'centros', beneficiario: 'benef', categoria: 'categorias', destino: 'destinos' };

  function roles_() {
    return { aux: Libro.texto(Config.PAR.correoAux).toLowerCase().trim(),
      ctd: Libro.texto(Config.PAR.correoCtd).toLowerCase().trim(),
      ger: Libro.texto(Config.PAR.correoGer).toLowerCase().trim() };
  }

  function datosParams() {
    var P = Config.PAR;
    var par = [['Saldo objetivo de la caja', P.objetivo], ['Saldo mínimo', P.minimo], ['Tope por gasto', P.topeGasto],
      ['Pago en efectivo (100 UVT)', P.topeEfectivo], ['Tiquete POS en papel (5 UVT)', P.topePOS],
      ['Plazo del DSE (días)', P.plazoDSE], ['UVT del año', P.uvt], ['Correo de quien maneja la caja', P.correoAux],
      ['Correo de la contadora', P.correoCtd], ['Correo de gerencia', P.correoGer]]
      .map(function (p) { return { etiqueta: p[0], valor: Libro.texto(p[1]) }; });
    return { responsables: Responsables.listar(), parametros: par, actual: Relacion.responsableHoy(),
      roles: roles_(), puedeEditar: true };
  }

  function agregarResponsable(d) { Responsables.agregar(d); return datosParams(); }

  /** Correos a los que llegan los avisos (ya no deciden permisos: eso lo hace el usuario de la plataforma). */
  function guardarRoles(d) {
    var ctd = Util.correo(d.contadora, 'la contadora');
    if (!ctd) throw new Error('El correo de la contadora no puede quedar vacío.');
    Libro.poner(Config.PAR.correoCtd, ctd);
    Libro.poner(Config.PAR.correoAux, Util.correo(d.auxiliar, 'la auxiliar'));
    Libro.poner(Config.PAR.correoGer, Util.correo(d.gerencia, 'gerencia'));
    return datosParams();
  }

  function agregarALista(cual, valor) {
    var clave = LISTA_EDITABLE[String(cual)];
    if (!clave) throw new Error('Lista desconocida: ' + cual);
    var v = Util.txt(valor, 80);
    if (!v) throw new Error('Escriba el nombre.');
    var r = Libro.rango(Config.LISTAS[clave]);
    var actuales = r.getDisplayValues().map(function (f) { return String(f[0] || '').trim(); });
    var ya = actuales.filter(function (x) { return x.toUpperCase() === v.toUpperCase(); })[0];
    if (ya) return { ya: true, valor: ya, lista: actuales.filter(String) };
    var libre = actuales.indexOf('');
    if (libre === -1) throw new Error('La lista está llena.');
    r.getCell(libre + 1, 1).setValue(v);
    Panel.olvidarListas();
    return { ya: false, valor: v, lista: Libro.lista(Config.LISTAS[clave]) };
  }

  function datosUbicacion(rol) {
    var libro = Libro.abrir(), mes = Soportes.carpetaDelMes(new Date());
    var TODOS = 'contadora gerencia auxiliar', CTD = 'contadora', CTD_GER = 'contadora gerencia';
    var l = function (titulo, nota, nombre, url, ver) { return { titulo: titulo, nota: nota, nombre: nombre, url: url, ver: ver }; };
    var plantillas = Config.leerOpcional('plantillas');
    var fijos = [
      l('LA PLATAFORMA', 'Esta misma página. Guárdela en favoritos.', 'Abrir la caja menor', ScriptApp.getService().getUrl() || '', TODOS),
      l('El libro', 'Relación, arqueo, tablero e histórico.', libro.getName(), libro.getUrl(), CTD_GER),
      l('Carpeta raíz', 'De aquí cuelga todo lo demás.', 'Soportes caja menor', Soportes.raiz().getUrl(), CTD),
      l('Carpeta del año', 'Todos los meses, con sus soportes.', String(new Date().getFullYear()), Soportes.carpetaDelAnio(new Date()).getUrl(), TODOS),
      l('El mes en curso', 'Aquí caen los soportes de este mes.', mes.getName(), mes.getUrl(), TODOS),
      l('Respaldos', 'El .zip de cada mes cuando se genera.', '99 RESPALDOS', DriveApp.getFolderById(Config.leer('respaldos')).getUrl(), CTD)
    ];
    if (plantillas) fijos.splice(3, 0, l('Plantillas y políticas', 'El libro, las circulares y el manual.',
      '00 PLANTILLAS Y POLÍTICAS', DriveApp.getFolderById(plantillas).getUrl(), CTD));
    var docs = [], delMes = [];
    if (plantillas) {
      var it = DriveApp.getFolderById(plantillas).getFiles();
      while (it.hasNext() && docs.length < 25) { var f = it.next(); docs.push({ nombre: f.getName(), url: f.getUrl(), tipo: f.getMimeType() }); }
    }
    var sub = mes.getFolders();
    while (sub.hasNext()) { var c = sub.next(); delMes.push({ nombre: c.getName(), url: c.getUrl() }); }
    var porNombre = function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); };
    return { fijos: fijos.filter(function (x) { return x.ver.indexOf(rol) > -1; }), documentos: docs.sort(porNombre),
      carpetasDelMes: delMes.sort(porNombre), mes: mes.getName() };
  }

  /* ------------------------- ACCESOS EN DRIVE ------------------------- */

  function datosAccesos() {
    var libro = Libro.abrir(), r = roles_();
    var dueno = libro.getOwner().getEmail().toLowerCase();
    var correos = function (us) { return us.map(function (u) { return u.getEmail().toLowerCase(); }); };
    var editores = correos(libro.getEditors()), lectores = correos(libro.getViewers());
    var rolDe = function (c) { return !c ? '—' : c === r.ctd ? 'Contadora' : c === r.aux ? 'Auxiliar' : c === r.ger ? 'Gerencia' : 'Sin rol asignado'; };
    var gente = Responsables.listar().map(function (p) {
      var c = String(p.correo || '').toLowerCase().trim();
      return { fila: p.fila, nombre: p.nombre, cedula: p.cedula, correo: c, celular: p.celular, desde: p.desde,
        hasta: p.hasta, estado: p.estado, rol: rolDe(c), esDueno: c === dueno,
        tieneAcceso: !!c && (c === dueno || editores.indexOf(c) > -1 || lectores.indexOf(c) > -1) };
    });
    var conocidos = gente.map(function (g) { return g.correo; });
    var sueltos = editores.concat(lectores).filter(function (c) { return c !== dueno && conocidos.indexOf(c) === -1; })
      .map(function (c) { return { correo: c, rol: rolDe(c) }; });
    var acceso = DriveApp.getFileById(libro.getId()).getSharingAccess();
    return { gente: gente, sueltos: sueltos, dueno: dueno, roles: r, puedeEditar: true,
      enlacePublico: acceso === DriveApp.Access.ANYONE_WITH_LINK || acceso === DriveApp.Access.ANYONE };
  }

  function darAcceso(d) {
    var correo = Util.correo(d.correo);
    if (!correo) throw new Error('Escriba el correo.');
    var r = roles_();
    var rol = d.rol || (correo === r.ctd ? 'Contadora' : correo === r.ger ? 'Gerencia' : 'Auxiliar');
    var libro = DriveApp.getFileById(Libro.abrir().getId()), raiz = Soportes.raiz();
    if (rol === 'Contadora') { libro.addEditor(correo); raiz.addEditor(correo); }
    else if (rol === 'Gerencia') { libro.addViewer(correo); raiz.addViewer(correo); }
    else raiz.addViewer(correo);
    if (d.nombre && !Responsables.listar().some(function (p) { return String(p.correo).toLowerCase() === correo; })) {
      Responsables.agregar({ nombre: d.nombre, correo: correo, cedula: d.cedula, celular: d.celular, desde: d.desde || new Date() });
    }
    if (CELDA_ROL[rol]) Libro.poner(Config.PAR[CELDA_ROL[rol]], correo);
    return datosAccesos();
  }

  function quitarAcceso(correo) {
    var c = Util.correo(correo);
    var libro = Libro.abrir();
    if (c === libro.getOwner().getEmail().toLowerCase()) throw new Error('No se le puede quitar el acceso a la dueña del libro.');
    var archivo = DriveApp.getFileById(libro.getId()), raiz = Soportes.raiz();
    [archivo, raiz].forEach(function (x) {
      try { x.removeEditor(c); } catch (e) { /* no era editor */ }
      try { x.removeViewer(c); } catch (e) { /* no era lector */ }
    });
    Object.keys(CELDA_ROL).forEach(function (rol) {
      var nombre = Config.PAR[CELDA_ROL[rol]];
      if (Libro.texto(nombre).toLowerCase().trim() === c) Libro.rango(nombre).clearContent();
    });
    return datosAccesos();
  }

  function asignarRol(rol, correo) {
    if (!CELDA_ROL[rol]) throw new Error('Rol no válido.');
    if (rol === 'Contadora' && !String(correo || '').trim()) throw new Error('El rol de contadora no puede quedar vacío.');
    Libro.poner(Config.PAR[CELDA_ROL[rol]], Util.correo(correo));
    return datosAccesos();
  }

  return { datosParams: datosParams, agregarResponsable: agregarResponsable, guardarRoles: guardarRoles,
    agregarALista: agregarALista, datosUbicacion: datosUbicacion, datosAccesos: datosAccesos,
    darAcceso: darAcceso, quitarAcceso: quitarAcceso, asignarRol: asignarRol };
})();
