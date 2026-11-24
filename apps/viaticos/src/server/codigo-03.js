/* ====================== SINCRONIZAR LISTAS Y CARPETAS ====================== */

function sincronizar() { Guardas_.persona();
  const ui = soloAdmin_();
  const props = PropertiesService.getScriptProperties();
  if (!instalado_()) { ui.alert('Primero usa "1. Instalar sistema".'); return; }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  asegurarHojas_(ss);
  activador_();
  cerrarFormularios_();
  const trabajadores = leerTrabajadores_(ss);
  const conceptos = leerConceptos_(ss);
  const proyectos = leerProyectos_(ss);
  if (!trabajadores.length || !conceptos.length || !proyectos.length) {
    ui.alert('Debe haber al menos un trabajador, un concepto de gasto y un proyecto.');
    return;
  }

  // Carpeta por proyecto. El jefe solo puede VER la carpeta de su proyecto; aprueba desde la app.
  const raiz = Aislamiento_.carpeta(props.getProperty('ROOT_ID'));
  const pro = ss.getSheetByName(HOJA_PROY);
  let creadas = 0;
  proyectos.forEach(function (p) {
    if (!p.carpetaId) {
      const carpeta = raiz.createFolder(limpiarNombre_(p.nombre));
      pro.getRange(p.fila, 4, 1, 2).setValues([[carpeta.getUrl(), carpeta.getId()]]);
      p.carpetaId = carpeta.getId();
      creadas++;
    }
    if (esCorreo_(p.correo)) {
      try { Aislamiento_.carpeta(p.carpetaId).addViewer(p.correo); } catch (err) {}
    }
  });

  // Revisión de datos: lo que impediría que alguien entre o apruebe
  const avisos = [];
  const sinCorreo = trabajadores.filter(function (t) { return !t.correo; }).length;
  if (sinCorreo) avisos.push(sinCorreo + ' trabajador(es) sin correo en la columna E de "Trabajadores": no podrán entrar a la app.');
  const vistos = {}, repetidos = [], conocidos = {};
  trabajadores.forEach(function (t) {
    conocidos[t.nombre.toLowerCase()] = true;
    if (!t.correo) return;
    if (vistos[t.correo]) repetidos.push(t.correo);
    vistos[t.correo] = true; conocidos[t.correo] = true;
  });
  if (repetidos.length) avisos.push('Correos repetidos en "Trabajadores" (cada persona necesita el suyo): ' + repetidos.join(', '));
  const sinJefe = proyectos.filter(function (p) { return !esCorreo_(p.correo); }).length;
  if (sinJefe) avisos.push(sinJefe + ' proyecto(s) sin correo del jefe: nadie recibirá el aviso para aprobarlos.');
  const sinTecnicos = proyectos.filter(function (p) { return !p.asignados.length; }).map(function (p) { return p.nombre; });
  if (sinTecnicos.length) avisos.push(sinTecnicos.length + ' proyecto(s) sin técnicos encargados (ningún trabajador los verá en la app): ' + sinTecnicos.slice(0, 8).join(', ') + (sinTecnicos.length > 8 ? '…' : ''));
  const jefesFuera = [];
  proyectos.forEach(function (p) {
    if (esCorreo_(p.correo) && !vistos[p.correo] && jefesFuera.indexOf(p.correo) === -1) jefesFuera.push(p.correo);
  });
  if (jefesFuera.length) avisos.push('Jefes que no están en "Trabajadores" y por eso no pueden entrar a aprobar: ' + jefesFuera.join(', '));
  const desconocidos = [];
  proyectos.forEach(function (p) {
    p.asignados.forEach(function (a) { if (!conocidos[a]) desconocidos.push(a + ' (' + p.nombre + ')'); });
  });
  if (desconocidos.length) avisos.push('Asignados en "Proyectos" que no coinciden con ningún trabajador: ' + desconocidos.slice(0, 10).join(', '));
  let editores = [];
  try { editores = ss.getEditors().map(function (u) { return u.getEmail(); }).filter(function (c) { return c && c.toLowerCase() !== props.getProperty('ADMIN'); }); } catch (err) {}
  if (editores.length) avisos.push('Estas cuentas pueden EDITAR esta hoja (ven cédulas y pueden cambiar datos): ' + editores.join(', ') + '. Los jefes ya no lo necesitan; quítalas en Compartir si no son administradores.');
  const gerentesS = trabajadores.filter(function (t) { return esGerente_(t); });
  if (!gerentesS.length) avisos.push('No hay gerente en "Trabajadores" (cargo GERENTE): mientras tanto aprueba el jefe de cada proyecto.');
  gerentesS.filter(function (t) { return !t.correo; }).forEach(function (t) { avisos.push('El gerente ' + t.nombre + ' no tiene correo: no podrá aprobar en la app.'); });
  if (!trabajadores.some(function (t) { return t.correo && esIngeniero_(t); })) avisos.push('Ningún ingeniero tiene correo: nadie podrá aprobar las solicitudes de los técnicos.');
  if (trabajadores.length >= 40) avisos.push('La lista de trabajadores llegó al máximo de 40 filas.');
  repararDuplicados_(ss).forEach(function (c) { avisos.push('Número repetido corregido: ' + c + '.'); });
  limpiarEntregasHuerfanas_(ss).forEach(function (c) { avisos.push('Entrega de una solicitud que ya no existe, quitada de "Entregas": ' + c + '.'); });

  ui.alert('Listas sincronizadas.\n\nTrabajadores: ' + trabajadores.length +
    '\nProyectos: ' + proyectos.length + '\nCarpetas nuevas: ' + creadas +
    (avisos.length ? '\n\nPARA REVISAR:\n- ' + avisos.join('\n- ') : '\n\nTodo en orden.'));
}

/* ================= 1) EL TRABAJADOR ENVÍA UNA SOLICITUD ================= */

// Crea el formato del viaje en la carpeta del proyecto y avisa al jefe.
// s: { nombre, proyecto, ciudad, salida, regreso, objeto, correo, lineas: [[fecha, concepto, ciudad, valor]] }
// Archivo del viaje: solo la hoja del formato (sin cédulas de otros, sin registro y sin copia del código)
function crearArchivoFormato_(ss, nombreArchivo, carpeta) {
  let nueva = null;
  try {
    nueva = SpreadsheetApp.create(nombreArchivo);
    try {
      nueva.setSpreadsheetLocale(ss.getSpreadsheetLocale());
      nueva.setSpreadsheetTimeZone(ZONA);
    } catch (err) {}
    const f = hojaFormato_(ss).copyTo(nueva);
    nueva.getSheets().forEach(function (h) { if (h.getSheetId() !== f.getSheetId()) nueva.deleteSheet(h); });
    f.setName('Formato');
    DriveApp.getFileById(nueva.getId()).moveTo(carpeta);
    return nueva;
  } catch (err) {
    // Plan B: copiar el archivo completo y dejarle solo el formato
    console.error('No se pudo crear el archivo liviano; se usa la copia completa: ' + err);
    if (nueva) { try { DriveApp.getFileById(nueva.getId()).setTrashed(true); } catch (e2) {} }
    const css = Aislamiento_.abrirLibro(DriveApp.getFileById(ss.getId()).makeCopy(nombreArchivo, carpeta).getId());
    const f = hojaFormato_(css);
    css.getNamedRanges().forEach(function (nr) { nr.remove(); });
    css.getSheets().forEach(function (h) { if (h.getSheetId() !== f.getSheetId()) css.deleteSheet(h); });
    f.setName('Formato');
    return css;
  }
}

// Crea el formato del viaje en la carpeta del proyecto y avisa al jefe.
// s: { trab, proy, ciudad, salida, regreso, objeto, lineas: [[fecha, concepto, ciudad, valor]], notas: [observación de cada línea] }
function crearSolicitud_(s) {
  const props = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  zonaColombia_(ss);
  const trab = s.trab, proy = s.proy, lineas = s.lineas, viajan = s.viajan || [];
  const resp = s.resp || { nombre: trab.nombre, cedula: trab.cedula }; // quien recibe y responde por el anticipo
  intentar_(function () { presupuesto_(ss); }); // por si el proyecto es nuevo y aún no está en "Presupuesto"
  const conceptos = leerConceptos_(ss);
  const hoy = new Date();
  const totalSolicitado = lineas.reduce(function (t, l) { return t + l[3]; }, 0);
  // Observaciones escritas por el trabajador, una por concepto: "Alimentación (14/10, $ 100.000): motivo"
  const notas = [];
  lineas.forEach(function (l, i) {
    const nota = (s.notas && s.notas[i]) || '';
    if (nota) notas.push(l[1] + ' (' + fmt_(l[0], 'dd/MM') + ', ' + pesos_(l[3]) + '): ' + nota);
  });

  const id = siguienteId_(ss);

  // Carpeta del viaje dentro de la carpeta del proyecto
  const carpeta = carpetaProyecto_(ss, proy.nombre).createFolder(limpiarNombre_(id + ' ' + fmt_(hoy, 'dd-MM') + ' ' + trab.nombre));
  let css = null;
  try {
    css = crearArchivoFormato_(ss, limpiarNombre_(proy.nombre + ' - Viaticos ' + fmt_(hoy, 'dd-MM') + ' - ' + s.objeto + ' - ' + trab.nombre + ' (' + id + ')'), carpeta);
    const f = hojaFormato_(css);
    const fi = filaIni_(f), ff = fi + N_FILAS - 1, m0 = mapa_(f); // por si el formato maestro tiene filas de más

    // Si la plantilla ya trae la columna "Observaciones" en SOLICITUD DE VIÁTICOS, todo lo que está a la
    // derecha de "Valor solicitado" va una columna más allá. Si no la trae, se agrega al final.
    const oT = desfase_(f);
    const P = function (a1) { return desplazar_(a1, oT); };
    f.getRangeList(['E10', P('J10'), 'E11', P('J11'), 'E12', P('J12'), 'E13', P('J13'), 'E14', P('J15'), 'E16', P('J16'),
      P('C' + fi + ':K' + ff), m0.notas]).clearContent();
    // Sin reglas que rechacen datos: el control lo hace la app, y así una regla no puede frenar la escritura
    f.getRangeList(['E10', P('C' + fi + ':K' + ff)]).clearDataValidations();
    f.getRange('E10').setValue(trab.nombre);
    f.getRange(P('J10')).setValue(trab.cedula);
    f.getRange('E11').setValue(trab.cargo);
    f.getRange(P('J11')).setValue(trab.area);
    f.getRange('E12').setValue(proy.nombre);
    f.getRange(P('J12')).setValue(s.ciudad);
    f.getRange('E13').setValue(s.salida);
    f.getRange(P('J13')).setValue(s.regreso);
    f.getRange('E14').setValue(s.objeto);
    f.getRange(P('J15')).setValue(hoy);
    casillaResponsable_(f, P);
    f.getRange('E16').setValue(resp.nombre);
    f.getRange(P('J16')).setValue(resp.cedula || '');
    f.getRange(m0.jefeNombre).setValue('Nombre:');
    f.getRange(m0.jefeCedula).setValue('C.C.:');
    f.getRange(fi, 3, lineas.length, 4).setValues(lineas);
    const pie = [];
    if (viajan.length) pie.push('Técnicos que viajan: ' + viajan.join(', '));
    if (pie.length) f.getRange(m0.notas).setValue(pie.join('\n')).setWrap(true);
    f.getRange(fi, 7 + oT, N_FILAS, 1).setNumberFormat('@');
    const listaConceptos = SpreadsheetApp.newDataValidation().requireValueInList(conceptos, true).setAllowInvalid(true).build();
    f.getRange(fi, 4, N_FILAS, 1).setDataValidation(listaConceptos);
    f.getRange(fi, 9 + oT, N_FILAS, 1).setDataValidation(listaConceptos);
    asegurarColQuien_(f, mapa_(f));
    // Observación de cada concepto, en su misma fila dentro de SOLICITUD DE VIÁTICOS (columna G)
    if (oT) f.getRange(fi, 7, N_FILAS, 1).setNumberFormat('@').setWrap(true);
    else agregarColObsSolicitud_(f, N_FILAS);
    f.getRange(fi, 7, lineas.length, 1).setValues(lineas.map(function (l, i) { return [(s.notas && s.notas[i]) || '']; }));
    if (s.directa) firmar_(f, mapa_(f).firmaJefe, 'Entrega registrada por ' + s.directa.yo.nombre + ' (' + s.directa.yo.correo + ')', false);
    else firmar_(f, mapa_(f).firmaTrab, 'Firmado electrónicamente por ' + trab.correo, false);
    casillasExtra_(f, s.extra || []);
    bloqueControl_(f);
    SpreadsheetApp.flush();
  } catch (err) {
    // Si el archivo quedó a medias, se retira para no dejar carpetas huérfanas ni datos sueltos
    try { carpeta.setTrashed(true); } catch (e2) {}
    throw err;
  }

  try { carpeta.addViewer(trab.correo); } catch (err) {}

  const fila = [];
  fila[C.id - 1] = id;
  fila[C.fecha - 1] = hoy;
  fila[C.trab - 1] = trab.nombre;
  fila[C.ced - 1] = trab.cedula;
  fila[C.proy - 1] = proy.nombre;
  fila[C.dest - 1] = s.ciudad;
  fila[C.sal - 1] = s.salida;
  fila[C.reg - 1] = s.regreso;
  fila[C.obj - 1] = s.objeto;
  fila[C.solic - 1] = totalSolicitado;
  fila[C.legal - 1] = 0;
  fila[C.reint - 1] = totalSolicitado;
  fila[C.favor - 1] = 0;
  fila[C.nsop - 1] = 0;
  fila[C.estado - 1] = s.directa ? 'Aprobado' : 'Solicitado'; // la entrega directa ya está entregada
  fila[C.obs - 1] = s.directa ? 'Entrega directa registrada por tesorería / gerencia' : '';
  fila[C.fdec - 1] = s.directa ? s.directa.fecha : '';
  fila[C.formato - 1] = css.getUrl();
  fila[C.carpeta - 1] = carpeta.getUrl();
  fila[C.correo - 1] = trab.correo;
  fila[C.idFormato - 1] = css.getId();
  fila[C.idCarpeta - 1] = carpeta.getId();
  fila[C.por - 1] = s.directa ? s.directa.yo.correo : '';
  fila[C.notas - 1] = notas.join('\n');
  fila[C.viajan - 1] = viajan.join(', ');
  fila[C.resp - 1] = resp.nombre;
  fila[C.extra - 1] = (s.extra || []).filter(function (c) { return c[1]; }).map(function (c) { return c[0] + ': ' + c[1]; }).join('\n');
  const hojaReg = ss.getSheetByName(HOJA_REG);
  [C.resp, C.extra].forEach(function (col) { // hoja instalada antes de estas columnas
    if (String(hojaReg.getRange(1, col).getValue()) !== REG[col - 1]) {
      hojaReg.getRange(1, col).setValue(REG[col - 1]).setFontWeight('bold').setBackground(NEGRO).setFontColor('#ffffff');
    }
  });
  intentar_(function () { hojaEnt_(ss); }); // si la hoja no existía, se arma con lo anterior (sin esta fila)
  hojaReg.appendRow(fila);
  if (s.directa) {
    hojaEnt_(ss).appendRow(['E-' + id + '-1', s.directa.fecha, id, proy.nombre, resp.nombre, totalSolicitado, 'Entrega directa (sin solicitud previa)', 'Entregado',
      s.directa.yo.correo, s.directa.medio, s.directa.comp]);
    intentar_(function () { llenarEntregado_(hojaFormato_(css), fila); });
  } else {
    intentar_(function () { nuevaEntrega_(ss, id, proy.nombre, resp.nombre, totalSolicitado, 'Anticipo inicial'); });
  }
  intentar_(function () { llenarControl_(ss, fila, hojaFormato_(css)); });

  const resumen = tabla_([
    ['ID', id], ['Trabajador', trab.nombre], ['Proyecto', proy.nombre], ['Destino', s.ciudad],
    ['Salida', fmt_(s.salida)], ['Regreso', fmt_(s.regreso)], ['Objeto del viaje', s.objeto],
    ['Técnicos que viajan', viajan.length ? viajan.join(', ') : 'Ninguno'],
    ['Técnico responsable del dinero', resp.nombre + (resp.cedula ? ' (C.C. ' + resp.cedula + ')' : '')],
    ['Valor solicitado', pesos_(totalSolicitado)]
  ].concat((s.extra || []).filter(function (c) { return c[1]; })).concat(lineas.map(function (l, i) {
    return ['   ' + l[1], pesos_(l[3]) + ((s.notas && s.notas[i]) ? ' — ' + s.notas[i] : '')];
  })));
  const app = appUrl_();
  if (s.directa) { // no hay nada que aprobar: solo se le avisa a quien recibió la plata
    correo_(trab.correo, 'Viáticos ' + id + ': te entregaron ' + pesos_(totalSolicitado) + ' para ' + proy.nombre,
      '<p>' + esc_(s.directa.yo.nombre) + ' registró que te entregó plata para el proyecto.</p>' + resumen +
      '<p><a href="' + css.getUrl() + '">Ver el formato</a></p>' +
      '<p>Relaciona los gastos con sus soportes en la app, pestaña <b>Legalización</b> (solicitud <b>' + id + '</b>).' +
      (app ? '<br><a href="' + enlaceGastos_(id) + '">Legalizar mis gastos</a>' : '') + '</p>');
    return { id: id, url: css.getUrl(), total: totalSolicitado };
  }
  const aprueban = aprobadores_(fila, leerTrabajadores_(ss), leerProyectos_(ss));
  if (!aprueban.length) avisarAdmin_('Solicitud ' + id + ' sin aprobador en la app', '<p>' + esc_(trab.nombre) +
    ' pidió viáticos y, por el conducto regular, nadie puede aprobarla en la app (por ejemplo, es una solicitud del gerente). ' +
    'Decídela en la pestaña <b>Registro</b>, columna Estado.</p>' + resumen);
  aprueban.forEach(function (a) {
    correo_(a.correo, 'Viáticos por aprobar ' + id + ' - ' + proy.nombre + ' - ' + trab.nombre,
      '<p>Hay una solicitud de viáticos por revisar.</p>' + resumen +
      '<p><a href="' + css.getUrl() + '">Ver el formato</a></p>' +
      '<p>Para aprobar y entregar la plata (o rechazar), entra a la app de viáticos con tu correo y tu clave, pestaña <b>Entrega</b>.' +
      (app ? '<br><a href="' + app + '?vista=aprobar">Abrir la app</a>' : '') + '</p>');
  });
  correo_(trab.correo, 'Solicitud de viáticos ' + id + ' registrada',
    '<p>Tu solicitud quedó registrada.</p>' + resumen +
    '<p><a href="' + css.getUrl() + '">Ver tu formato</a></p>' +
    '<p>Durante el viaje, registra cada recibo con su foto en la app (solicitud <b>' + id + '</b>).' +
    (app ? '<br><a href="' + enlaceGastos_(id) + '">Legalizar mis gastos</a>' : '') + '</p>');
  return { id: id, url: css.getUrl(), total: totalSolicitado };
}

