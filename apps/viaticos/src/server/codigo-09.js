// Crear un proyecto desde la app, con su jefe y sus técnicos encargados. Se crea también su carpeta en Drive.
function appCrearProyecto_(token, p) {
  const yo = sesion_(token);
  const candado = candado_();
  try {
    p = p || {};
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const proyectos = leerProyectos_(ss), trabajadores = leerTrabajadores_(ss);
    if (!puedeGestionar_(proyectos, yo)) throw new Error('Solo el administrador y los jefes de proyecto pueden crear proyectos.');
    const nombre = limpiarNombre_(txt_(p.nombre, 80));
    if (nombre.length < 3) throw new Error('Escribe el nombre del proyecto.');
    if (buscar_(proyectos, nombre)) throw new Error('Ya existe un proyecto con ese nombre.');
    if (proyectos.length >= 300) throw new Error('Se llegó al máximo de proyectos. Habla con administración.');
    const jefe = trabajadorPorCorreo_(ss, p.jefe || yo.correo);
    if (!jefe) throw new Error('Elige quién aprueba el proyecto.');
    const tecnicos = tecnicosValidos_(p.tecnicos, trabajadores);
    if (!tecnicos.length) throw new Error('Marca al menos un técnico encargado.');

    const hoja = hojaProyectos_(ss);
    const fila = Math.max(hoja.getLastRow(), 1) + 1;
    hoja.getRange(fila, 1, 1, 3).setValues([[nombre, jefe.nombre, jefe.correo]]);
    hoja.getRange(fila, colAsignados_(hoja)).setValue(tecnicos.join(', '));
    SpreadsheetApp.flush();
    const carpeta = carpetaProyecto_(ss, nombre);
    try { carpeta.addViewer(jefe.correo); } catch (err) {}
    intentar_(function () { presupuesto_(ss); dashboard_(ss); });
    return appDatos_(token);
  } finally {
    candado.releaseLock();
  }
}

// Cambiar los técnicos encargados de un proyecto (su jefe o el administrador)
function appGuardarTecnicos_(token, nombreProyecto, lista) {
  const yo = sesion_(token);
  const candado = candado_();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const proy = buscar_(leerProyectos_(ss), nombreProyecto);
    if (!proy) throw new Error('Ese proyecto ya no existe.');
    if (!esAdmin_(yo) && proy.correo !== yo.correo) throw new Error('Ese proyecto no está a tu cargo.');
    const tecnicos = tecnicosValidos_(lista, leerTrabajadores_(ss));
    const hoja = hojaProyectos_(ss);
    hoja.getRange(proy.fila, colAsignados_(hoja)).setValue(tecnicos.join(', '));
    SpreadsheetApp.flush();
    return appDatos_(token);
  } finally {
    candado.releaseLock();
  }
}

// Solicitudes que esperan decisión de este jefe (solo las de proyectos donde su correo figura como jefe)
function porAprobar_(ss, yo, filas) {
  const trabajadores = leerTrabajadores_(ss), proyectos = leerProyectos_(ss);
  const hayGerente = trabajadores.some(function (t) { return t.correo && esGerente_(t); });
  const esJefe = proyectos.some(function (p) { return p.correo && p.correo === yo.correo; });
  if (!esGerente_(yo) && !esIngeniero_(yo) && !(esJefe && !hayGerente)) return null; // no aprueba a nadie: sin pestaña
  const lista = [];
  filas.forEach(function (f) {
    if (!f[C.id - 1] || POR_DECIDIR.indexOf(f[C.estado - 1]) === -1) return;
    if (!aprobadores_(f, trabajadores, proyectos).some(function (a) { return a.correo === yo.correo; })) return;
    lista.push({
      id: String(f[C.id - 1]), trabajador: String(f[C.trab - 1]), proyecto: String(f[C.proy - 1]), destino: String(f[C.dest - 1]),
      salida: fmt_(f[C.sal - 1]), regreso: fmt_(f[C.reg - 1]), objeto: String(f[C.obj - 1]), estado: String(f[C.estado - 1]),
      solicitado: Number(f[C.solic - 1]) || 0, legalizado: Number(f[C.legal - 1]) || 0, soportes: Number(f[C.nsop - 1]) || 0,
      formato: String(f[C.formato - 1]), carpeta: String(f[C.carpeta - 1]), propia: false,
      notas: String(f[C.notas - 1] || ''), viajan: String(f[C.viajan - 1] || ''), responsable: String(f[C.resp - 1] || f[C.trab - 1] || ''), extra: String(f[C.extra - 1] || ''),
      pendientes: leerEntregas_(ss).filter(function (e) { return e.sol === String(f[C.id - 1]) && e.estado === 'Pendiente'; })
        .map(function (e) { return { recibe: e.recibe, valor: e.valor, detalle: e.detalle }; }),
      yaEntregado: leerEntregas_(ss).filter(function (e) { return e.sol === String(f[C.id - 1]) && (e.estado === 'Entregado' || e.estado === 'Por pagar'); })
        .reduce(function (t, e) { return t + e.valor; }, 0),
      puedenRecibir: (function () { // a quién se le puede entregar la plata en ese proyecto
        return trabajadores.filter(esTecnico_).map(function (t) { return t.nombre; }); // cualquier técnico de la lista
      })()
    });
  });
  return lista;
}

// El jefe decide desde la app: queda registrado quién decidió y cuándo
function appDecidir_(token, id, accion, obs, entregaA) {
  const yo = sesion_(token);
  const candado = candado_();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reg = ss.getSheetByName(HOJA_REG);
    const filaReg = filaRegistro_(reg, id);
    if (!filaReg) throw new Error(MOTIVOS.no_existe);
    const d = reg.getRange(filaReg, 1, 1, REG.length).getValues()[0];
    if (esDe_(d, yo)) throw new Error('No puedes decidir sobre tu propia solicitud. Debe hacerlo administración.');
    const quienes = aprobadores_(d, leerTrabajadores_(ss), leerProyectos_(ss));
    if (!quienes.some(function (a) { return a.correo === yo.correo; })) {
      throw new Error('Según el conducto regular, esta solicitud la aprueba ' + (quienes.length ? quienes.map(function (a) { return a.nombre; }).join(' o ') : 'administración') + '.');
    }
    const reglas = {
      'Solicitado': { aprobar: 'Aprobado', rechazar: 'Rechazado' },
      'En revisión': { legalizar: 'Legalizado', devolver: 'Aprobado' }
    };
    let nuevo = (reglas[d[C.estado - 1]] || {})[String(accion)];
    if (!nuevo) throw new Error('Esa solicitud ya cambió de estado. Vuelve a abrir la app.');
    // ¿Es una adición a una solicitud que ya tenía plata entregada?
    const adicion = d[C.estado - 1] === 'Solicitado' && leerEntregas_(ss).some(function (e) { return e.sol === String(id) && (e.estado === 'Entregado' || e.estado === 'Por pagar'); });
    if (adicion && accion === 'rechazar') nuevo = 'Aprobado'; // se rechaza solo la adición: la solicitud sigue aprobada
    FIRMA_ESPECIAL = adicion ? (accion === 'rechazar' ? 'Adición rechazada por ' : 'Adición aprobada electrónicamente por ') : '';
    if (adicion && accion === 'rechazar') decidirEntregas_(ss, id, 'Rechazado', yo.correo);
    const nota = txt_(obs, 500);
    if ((accion === 'rechazar' || accion === 'devolver') && !nota) throw new Error('Escribe el motivo en observaciones.');
    if (accion === 'aprobar' && entregaA !== undefined && entregaA !== null) entregarA_(ss, reg, filaReg, d, entregaA);
    reg.getRange(filaReg, C.estado, 1, 2).setValues([[nuevo, nota]]);
    try { aplicarDecision_(ss, reg, filaReg, yo.correo, yo); } finally { FIRMA_ESPECIAL = ''; }
    const filas = reg.getRange(2, 1, reg.getLastRow() - 1, REG.length).getValues();
    return { porAprobar: porAprobar_(ss, yo, filas) || [], estado: nuevo };
  } finally {
    candado.releaseLock();
  }
}

function appDetalle_(token, idPedido) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const acceso = filaAccesible_(idPedido, sesion_(token)), d = acceso.d;
  const id = String(d[C.id - 1]);
  const gastos = [];
  const gas = ss.getSheetByName(HOJA_GASTOS);
  if (gas && gas.getLastRow() >= 2) {
    gas.getRange(2, 1, gas.getLastRow() - 1, GAS.length).getValues().forEach(function (g) {
      if (String(g[0]) !== String(id)) return;
      gastos.push({
        n: String(g[11]), fecha: fmt_(g[2]), concepto: String(g[5]), tercero: String(g[6]),
        valor: Number(g[8]) || 0, url: String(g[10]).split('\n')[0]
      });
    });
  }
  return {
    id: String(id), trabajador: String(d[C.trab - 1]), proyecto: String(d[C.proy - 1]), destino: String(d[C.dest - 1]),
    salida: fmt_(d[C.sal - 1]), regreso: fmt_(d[C.reg - 1]), estado: String(d[C.estado - 1]),
    solicitado: Number(d[C.solic - 1]) || 0, legalizado: Number(d[C.legal - 1]) || 0,
    cupo: Math.max(MAX_FILAS - (Number(d[C.nsop - 1]) || 0), 0), gastos: gastos,
    propia: acceso.propia, // false: la abre quien aprueba, para agregar gastos (no puede enviarla a revisión)
    resp: !!acceso.resp,   // la plata se le entregó a quien la abre: la legaliza y la envía a revisión
    puedeEnviar: acceso.propia || !!acceso.resp,
    entregadaA: String(d[C.resp - 1] || d[C.trab - 1] || '') // a quién se le entregó la plata
  };
}

function appGuardarGasto_(token, p) {
  const yo = sesion_(token);
  const candado = candado_();
  try {
    p = p || {};
    // Confirma que la solicitud es de quien entró, o de alguien a quien él aprueba (ingeniero a cargo / gerente)
    const acceso = filaAccesible_(String(p.id || '').trim(), yo), d = acceso.d;
    const id = String(d[C.id - 1]);
    const cache = CacheService.getScriptCache();
    const uid = String(p.uid || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 60);
    if (uid && cache.get('UG_' + uid)) return appDetalle_(token, id); // reintento de un gasto que sí había llegado

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const g = {
      fecha: aFecha_(p.fecha),
      concepto: norm_(p.concepto),
      valor: typeof p.valor === 'number' ? Math.round(p.valor) : aNumero_(p.valor),
      tercero: txt_(p.tercero, 150),
      nSoporte: txt_(p.nSoporte, 40),
      factura: txt_(p.factura, 40),
      obs: txt_(p.obs, 300),
      por: yo.correo
    };
    if (!g.fecha) throw new Error('Revisa la fecha del gasto.');
    if (g.fecha.getTime() > Date.now()) throw new Error('La fecha del gasto no puede ser futura.');
    if (g.fecha.getTime() < Date.now() - 120 * 86400000) throw new Error('La fecha del gasto es demasiado antigua. Revísala.');
    if (leerConceptos_(ss).indexOf(g.concepto) === -1) throw new Error('Elige el concepto de la lista.');
    if (!(g.valor > 0)) throw new Error('Escribe el valor gastado.');
    if (g.valor > VALOR_MAXIMO) throw new Error('El valor es demasiado alto. Revísalo.');
    if (!g.tercero) throw new Error('Escribe a quién le pagaste.');

    const fuentes = [];
    const foto = p.foto;
    if (foto && typeof foto.base64 === 'string' && foto.base64) {
      const tipos = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic', 'image/heif': '.heif', 'application/pdf': '.pdf' };
      const ext = tipos[String(foto.tipo || '').toLowerCase()];
      if (!ext) throw new Error('El soporte debe ser una foto o un PDF.');
      if (foto.base64.length > 14000000) throw new Error('El archivo pesa más de 10 MB.');
      fuentes.push({ blob: Utilities.newBlob(Utilities.base64Decode(foto.base64), String(foto.tipo).toLowerCase(), 'soporte' + ext), ext: ext });
    } else if (!g.obs) {
      throw new Error('Si no hay soporte, explica el motivo en observaciones.');
    }

    const res = registrarGasto_(id, g, fuentes, (acceso.propia || acceso.resp) ? ABIERTOS : ABIERTOS_APROBADOR);
    if (!res.ok) throw new Error(MOTIVOS[res.motivo]);
    if (uid) cache.put('UG_' + uid, '1', 21600);
    if (!acceso.propia) avisarGastoAgregado_(d, yo, g);
    return appDetalle_(token, id);
  } finally {
    candado.releaseLock();
  }
}

// Si quien aprueba agrega gastos a la solicitud de otra persona, se le avisa a esa persona (un correo cada 30 min como máximo)
function avisarGastoAgregado_(d, yo, g) {
  const para = String(d[C.correo - 1] || '').trim().toLowerCase();
  if (!para || para === yo.correo) return;
  const cache = CacheService.getScriptCache(), clave = 'AG_' + d[C.id - 1] + '_' + yo.correo;
  if (cache.get(clave)) return;
  cache.put(clave, '1', 1800);
  correo_(para, 'Viáticos ' + d[C.id - 1] + ': ' + yo.nombre + ' agregó gastos a tu formato',
    '<p>' + esc_(yo.nombre) + ' agregó gastos a tu solicitud de viáticos ' + esc_(d[C.id - 1]) + ' (' + esc_(d[C.proy - 1]) + ').</p>' +
    tabla_([['Concepto', g.concepto], ['Tercero', g.tercero], ['Valor', pesos_(g.valor)]]) +
    '<p>En la columna CONTROL del formato queda quién registró cada gasto. <a href="' + d[C.formato - 1] + '">Ver el formato</a></p>');
}

function appEnviarRevision_(token, id) {
  const yo = sesion_(token);
  const candado = candado_();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reg = ss.getSheetByName(HOJA_REG);
    const filaReg = filaRegistro_(reg, id);
    const acceso = filaAccesible_(id, yo);
    if (!acceso.propia && !acceso.resp) throw new Error('Esa solicitud es de otra persona.');
    const d = acceso.d;
    if (ABIERTOS.indexOf(d[C.estado - 1]) === -1) throw new Error(MOTIVOS.cerrada);
    reg.getRange(filaReg, C.estado).setValue('En revisión');
    SpreadsheetApp.flush();

    const aprueban = aprobadores_(d, leerTrabajadores_(ss), leerProyectos_(ss));
    if (!aprueban.length) avisarAdmin_('Viáticos ' + id + ' para legalizar sin aprobador en la app', '<p>' + esc_(d[C.trab - 1]) +
      ' envió a revisión la solicitud ' + esc_(id) + '. Decídela en la pestaña <b>Registro</b>.</p>');
    aprueban.forEach(function (a) {
      correo_(a.correo, 'Viáticos para legalizar ' + id + ' - ' + d[C.proy - 1] + ' - ' + d[C.trab - 1],
        '<p>' + esc_(d[C.trab - 1]) + ' terminó de registrar sus gastos.</p>' + tabla_([
          ['ID', id], ['Proyecto', d[C.proy - 1]], ['Destino', d[C.dest - 1]],
          ['Valor solicitado', pesos_(d[C.solic - 1])], ['Total legalizado', pesos_(d[C.legal - 1])],
          ['Saldo a reintegrar por el trabajador', pesos_(d[C.reint - 1])],
          ['Saldo a favor del trabajador', pesos_(d[C.favor - 1])], ['N.° de soportes', d[C.nsop - 1]]
        ]) +
        '<p><a href="' + d[C.formato - 1] + '">Ver el formato</a> · <a href="' + d[C.carpeta - 1] + '">Ver los soportes</a></p>' +
        '<p>Para legalizarla o devolverla al trabajador, entra a la app de viáticos, pestaña <b>Legalización</b>.' +
        (appUrl_() ? '<br><a href="' + appUrl_() + '?vista=legalizar">Abrir la app</a>' : '') + '</p>');
    });
    return { ok: true };
  } finally {
    candado.releaseLock();
  }
}

function actualizarTotales_(reg, filaReg, f) {
  const mp = mapa_(f), filas = mp.n, o = mp.o;
  const suma = function (col) {
    return f.getRange(mp.fi, col, filas, 1).getValues()
      .reduce(function (s, v) { return s + (Number(v[0]) || 0); }, 0);
  };
  const solicitado = suma(6);
  const legalizado = suma(10 + o);
  const soportes = f.getRange(mp.fi, 7 + o, filas, 1).getDisplayValues()
    .filter(function (v) { return v[0] !== ''; }).length;
  reg.getRange(filaReg, C.solic, 1, 5).setValues([[
    solicitado, legalizado, Math.max(solicitado - legalizado, 0), Math.max(legalizado - solicitado, 0), soportes
  ]]);
  intentar_(function () { llenarControl_(SpreadsheetApp.getActiveSpreadsheet(), reg.getRange(filaReg, 1, 1, REG.length).getValues()[0], f); });
  marcarControl_(String(reg.getRange(filaReg, C.proy).getValue() || ''));
}

