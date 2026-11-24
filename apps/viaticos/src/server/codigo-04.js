// Solicitud enviada desde la app. Todo llega del celular, así que todo se valida aquí otra vez.
function appCrearSolicitud_(token, p) {
  const trab = sesion_(token); // la solicitud siempre queda a nombre de quien entró
  const candado = candado_();
  try {
    p = p || {};
    const cache = CacheService.getScriptCache();
    const uid = String(p.uid || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 60);
    const previa = uid ? cache.get('US_' + uid) : null;
    if (previa) return JSON.parse(previa); // reintento de un envío que sí había llegado: no se duplica

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const proy = buscar_(leerProyectos_(ss), p.proyecto || '');
    if (!proy) throw new Error('Elige un proyecto de la lista.');
    if (!puedeUsar_(proy, trab)) throw new Error('Ese proyecto no está asignado a ti. Pide a administración que te lo asigne.');
    const ciudad = txt_(p.ciudad, 80);
    const objeto = txt_(p.objeto, 120);
    if (!ciudad || !objeto) throw new Error('Escribe la ciudad de destino y el objeto del viaje.');
    const salida = aFecha_(p.salida);
    const regreso = aFecha_(p.regreso);
    if (!salida || !regreso) throw new Error('Revisa las fechas de salida y de regreso.');
    if (regreso.getTime() < salida.getTime()) throw new Error('La fecha de regreso no puede ser anterior a la de salida.');
    if (regreso.getTime() - salida.getTime() > 90 * 86400000) throw new Error('El viaje no puede durar más de 90 días. Revisa las fechas.');
    if (salida.getTime() < Date.now() - 60 * 86400000) throw new Error('La fecha de salida es demasiado antigua. Revísala.');

    // Técnicos que viajan: solo personas del área técnica de la pestaña "Trabajadores"
    const delAreaTecnica = {};
    leerTrabajadores_(ss).forEach(function (t) { if (esTecnico_(t)) delAreaTecnica[t.nombre.toUpperCase()] = t.nombre; });
    const viajan = [];
    (Array.isArray(p.viajan) ? p.viajan : []).forEach(function (v) {
      const nombre = delAreaTecnica[norm_(v).toUpperCase()];
      if (!nombre) throw new Error('"' + txt_(v, 60) + '" no está en el área técnica.');
      if (viajan.indexOf(nombre) === -1) viajan.push(nombre);
    });

    const conceptos = leerConceptos_(ss);
    const lineas = [], notas = [];
    (p.lineas || []).forEach(function (l) {
      const valor = typeof l.valor === 'number' ? Math.round(l.valor) : aNumero_(l.valor);
      const concepto = norm_(l.concepto);
      if (!concepto && !valor) return;
      if (conceptos.indexOf(concepto) === -1) throw new Error('El concepto "' + concepto + '" no está en la lista.');
      if (!(valor > 0) || valor > VALOR_MAXIMO) throw new Error('Revisa el valor de "' + concepto + '".');
      let fecha = aFecha_(l.fecha) || salida;
      if (fecha.getTime() < salida.getTime() || fecha.getTime() > regreso.getTime()) fecha = salida;
      lineas.push([fecha, concepto, ciudad, valor]);
      notas.push(txt_(l.obs, 150)); // observación opcional de ese concepto
    });
    if (!lineas.length) throw new Error('Agrega al menos un concepto con su valor.');
    if (lineas.length > N_FILAS) throw new Error('El formato admite máximo ' + N_FILAS + ' conceptos.');

    const reg = ss.getSheetByName(HOJA_REG);
    if (reg.getLastRow() >= 2) {
      const abiertas = reg.getRange(2, 1, reg.getLastRow() - 1, REG.length).getValues().filter(function (f) {
        return f[C.id - 1] && ABIERTOS.indexOf(f[C.estado - 1]) > -1 && esDe_(f, trab);
      }).length;
      // El ingeniero pide plata para varios técnicos a la vez: puede tener más solicitudes abiertas
      const tope = (esIngeniero_(trab) || esGerente_(trab)) ? 40 : 10;
      if (abiertas >= tope) throw new Error('Tienes ' + tope + ' solicitudes abiertas. Legaliza las anteriores antes de pedir otra.');
    }

    // Técnico responsable del dinero: una persona del área técnica (si no se elige, responde quien solicita)
    let resp = { nombre: trab.nombre, cedula: trab.cedula };
    if (norm_(p.responsable)) {
      const t = validarReceptor_(ss, proy.nombre, p.responsable, viajan);
      resp = { nombre: t.nombre, cedula: t.cedula };
    }

    // Casillas adicionales definidas en la pestaña "Casillas"
    const extra = leerCasillas_(ss).map(function (c) {
      const v = txt_(p.extra && typeof p.extra === 'object' ? p.extra[c.nombre] : '', 150);
      if (c.obligatoria && !v) throw new Error('Llena la casilla "' + c.nombre + '".');
      return [c.nombre, v];
    });

    const r = crearSolicitud_({ trab: trab, proy: proy, ciudad: ciudad, salida: salida, regreso: regreso, objeto: objeto, lineas: lineas, notas: notas, viajan: viajan, resp: resp, extra: extra });
    const res = { id: r.id, url: r.url, total: r.total, texto: [r.id, trab.nombre, proy.nombre, fmt_(salida, 'dd/MM')].join(' · ') };
    if (uid) cache.put('US_' + uid, JSON.stringify(res), 21600);
    return res;
  } finally {
    candado.releaseLock();
  }
}

// Agregar conceptos a una solicitud propia que todavía no han aprobado (estado "Solicitado").
// p = { id, uid, lineas: [{ concepto, fecha, valor, obs }] }. Se escriben en SOLICITUD DE VIÁTICOS del mismo formato.
function appAmpliarSolicitud_(token, p) {
  const yo = sesion_(token);
  const candado = candado_();
  try {
    p = p || {};
    const cache = CacheService.getScriptCache();
    const uid = String(p.uid || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 60);
    const previa = uid ? cache.get('UA_' + uid) : null;
    if (previa) return JSON.parse(previa); // reintento: no se duplica

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reg = ss.getSheetByName(HOJA_REG);
    const id = String(p.id || '').trim();
    const d = filaPropia_(id, yo);
    const filaReg = filaRegistro_(reg, id);
    const estadoAntes = String(d[C.estado - 1]);
    if (['Solicitado', 'Aprobado'].indexOf(estadoAntes) === -1) {
      const como = { 'Rechazado': 'rechazada', 'En revisión': 'enviada a revisión', 'Legalizado': 'legalizada' }[estadoAntes] || 'decidida';
      throw new Error('La solicitud ' + d[C.id - 1] + ' ya fue ' + como +
        '. Solo se le pueden hacer adiciones mientras está pendiente o aprobada; haz una solicitud nueva.');
    }
    // A quién se le entrega la plata de esta adición (si no se dice, a quien recibió la última vez)
    const recibe = norm_(p.entregaA) ? validarReceptor_(ss, String(d[C.proy - 1]), p.entregaA, String(d[C.viajan - 1] || '').split(',')).nombre
      : (p.entregaA === '' ? String(d[C.trab - 1]) : String(d[C.resp - 1] || d[C.trab - 1])); // '' = a quien solicita
    const salida = d[C.sal - 1] instanceof Date ? d[C.sal - 1] : aFecha_(d[C.sal - 1]);
    const regreso = d[C.reg - 1] instanceof Date ? d[C.reg - 1] : aFecha_(d[C.reg - 1]);
    const ciudad = String(d[C.dest - 1] || '');
    const conceptos = leerConceptos_(ss);
    const lineas = [], notas = [];
    (p.lineas || []).forEach(function (l) {
      const valor = typeof l.valor === 'number' ? Math.round(l.valor) : aNumero_(l.valor);
      const concepto = norm_(l.concepto);
      if (!concepto && !valor) return;
      if (conceptos.indexOf(concepto) === -1) throw new Error('El concepto "' + concepto + '" no está en la lista.');
      if (!(valor > 0) || valor > VALOR_MAXIMO) throw new Error('Revisa el valor de "' + concepto + '".');
      let fecha = aFecha_(l.fecha) || salida;
      if (salida && regreso && (fecha.getTime() < salida.getTime() || fecha.getTime() > regreso.getTime())) fecha = salida;
      lineas.push([fecha, concepto, ciudad, valor]);
      notas.push(txt_(l.obs, 150));
    });
    if (!lineas.length) throw new Error('Agrega al menos un concepto con su valor.');

    const f = hojaFormato_(Aislamiento_.abrirLibro(d[C.idFormato - 1]));
    // Filas libres del bloque SOLICITUD (columnas C a F), después del último concepto ya escrito
    const libres = function () {
      const m = mapa_(f), v = f.getRange(m.fi, 3, m.n, 4).getValues();
      let ult = -1;
      v.forEach(function (r, i) { if (r.join('') !== '') ult = i; });
      return { m: m, desde: ult + 1, cupo: m.n - ult - 1 };
    };
    let lib = libres();
    while (lib.cupo < lineas.length) {
      if (!lib.m.encontrado || lib.m.n >= MAX_FILAS) throw new Error('El formato ya no tiene espacio para ' + lineas.length + ' conceptos más.');
      ampliarFormato_(f, lib.m);
      lib = libres();
    }
    f.getRange(lib.m.fi + lib.desde, 3, lineas.length, 4).setValues(lineas);
    if (lib.m.o) { // la columna "Observaciones" de la solicitud (G) existe en este formato
      f.getRange(lib.m.fi + lib.desde, 7, lineas.length, 1).setNumberFormat('@')
        .setValues(notas.map(function (n) { return [n]; }));
    }
    firmar_(f, lib.m.firmaTrab, 'Solicitud ampliada electrónicamente por ' + yo.correo, true);
    SpreadsheetApp.flush();
    actualizarTotales_(reg, filaReg, f);
    const agregadoAntes = lineas.reduce(function (t, l) { return t + l[3]; }, 0);
    // Si aún no la aprueban y ya hay una entrega pendiente para esa misma persona, se suma ahí; si no, entrega nueva
    const pend = leerEntregas_(ss).filter(function (e) { return e.sol === id && e.estado === 'Pendiente' && e.recibe.toUpperCase() === recibe.toUpperCase(); })[0];
    if (estadoAntes === 'Solicitado' && pend) hojaEnt_(ss).getRange(pend.fila, CE.valor).setValue(pend.valor + agregadoAntes);
    else nuevaEntrega_(ss, id, String(d[C.proy - 1]), recibe, agregadoAntes, estadoAntes === 'Aprobado' ? 'Adición (' + fmt_(new Date(), 'dd/MM') + ')' : 'Ampliación (' + fmt_(new Date(), 'dd/MM') + ')');
    // Si ya estaba aprobada, la adición vuelve a aprobación; lo ya entregado no cambia
    if (estadoAntes === 'Aprobado') reg.getRange(filaReg, C.estado).setValue('Solicitado');

    // Observaciones nuevas en Registro, con el mismo formato que al crear la solicitud
    const nuevas = [];
    lineas.forEach(function (l, i) { if (notas[i]) nuevas.push(l[1] + ' (' + fmt_(l[0], 'dd/MM') + ', ' + pesos_(l[3]) + '): ' + notas[i]); });
    if (nuevas.length) {
      const previo = String(reg.getRange(filaReg, C.notas).getValue() || '');
      reg.getRange(filaReg, C.notas).setValue((previo ? previo + '\n' : '') + nuevas.join('\n'));
    }
    const agregado = lineas.reduce(function (t, l) { return t + l[3]; }, 0);
    const total = Number(reg.getRange(filaReg, C.solic).getValue()) || 0;

    const resumen = tabla_([
      ['ID', id], ['Trabajador', d[C.trab - 1]], ['Proyecto', d[C.proy - 1]], ['Destino', ciudad],
      ['Se agregó', pesos_(agregado)], ['Se le entrega a', recibe], ['Nuevo total presupuestado', pesos_(total)]
    ].concat(lineas.map(function (l, i) { return ['   ' + l[1], pesos_(l[3]) + (notas[i] ? ' — ' + notas[i] : '')]; })));
    const fila = reg.getRange(filaReg, 1, 1, REG.length).getValues()[0];
    const aprueban = aprobadores_(fila, leerTrabajadores_(ss), leerProyectos_(ss));
    if (!aprueban.length) avisarAdmin_('Solicitud ' + id + ' ampliada (sin aprobador en la app)', '<p>' + esc_(yo.nombre) +
      ' agregó conceptos a su solicitud. Decídela en la pestaña <b>Registro</b>.</p>' + resumen);
    const app = appUrl_();
    aprueban.forEach(function (a) {
      correo_(a.correo, 'Viáticos por aprobar ' + id + ' (ampliada) - ' + d[C.proy - 1] + ' - ' + d[C.trab - 1],
        '<p>' + esc_(yo.nombre) + (estadoAntes === 'Aprobado' ? ' hizo una adición a su solicitud ya aprobada. Lo ya entregado no cambia; la adición necesita tu aprobación.</p>'
          : ' agregó conceptos a su solicitud, que sigue pendiente de tu aprobación.</p>') + resumen +
        '<p><a href="' + d[C.formato - 1] + '">Ver el formato</a></p>' +
        '<p>Para aprobar y entregar la plata (o rechazar), entra a la app de viáticos, pestaña <b>Entrega</b>.' +
        (app ? '<br><a href="' + app + '?vista=aprobar">Abrir la app</a>' : '') + '</p>');
    });
    const res = { id: id, url: String(d[C.formato - 1]), agregado: agregado, total: total, recibe: recibe, adicion: estadoAntes === 'Aprobado' };
    if (uid) cache.put('UA_' + uid, JSON.stringify(res), 21600);
    return res;
  } finally {
    candado.releaseLock();
  }
}

/* ================== 2) EL TRABAJADOR REGISTRA GASTOS ================== */

// Carpeta con el nombre del proyecto (la crea si todavía no existe)
function carpetaProyecto_(ss, proyNombre) {
  const raiz = Aislamiento_.carpeta(PropertiesService.getScriptProperties().getProperty('ROOT_ID'));
  const nombre = limpiarNombre_(proyNombre) || 'Sin proyecto';
  const proy = buscar_(leerProyectos_(ss), proyNombre);
  if (proy && proy.carpetaId) {
    try { return Aislamiento_.carpeta(proy.carpetaId); } catch (err) {}
  }
  const existentes = raiz.getFoldersByName(nombre);
  const carpeta = existentes.hasNext() ? existentes.next() : raiz.createFolder(nombre);
  if (proy) ss.getSheetByName(HOJA_PROY).getRange(proy.fila, 4, 1, 2).setValues([[carpeta.getUrl(), carpeta.getId()]]);
  return carpeta;
}

// El detalle del formato empieza en la fila 19 y termina justo antes de "TOTAL SOLICITADO".
// Como el formato puede crecer, las posiciones se calculan cada vez.
function mapa_(f) {
  const fi = filaIni_(f);
  let total = fi + N_FILAS, encontrado = false;
  try {
    const alto = Math.min(MAX_FILAS + 20, f.getMaxRows() - fi + 1);
    const celda = f.getRange(fi, 2, alto, 1).createTextFinder('^\\s*TOTAL (SOLICITADO|PRESUPUESTADO)\\s*:?\\s*$').useRegularExpression(true).findNext();
    if (celda) { total = celda.getRow(); encontrado = true; }
  } catch (err) { console.error(err); }
  const fin = total - 1;
  const o = desfase_(f); // 1 si el formato tiene la columna "Observaciones" en el bloque de solicitud
  const colJefe = String.fromCharCode(72 + o); // H, o I cuando existe esa columna
  return {
    fin: fin, n: fin - fi + 1, fi: fi, encontrado: encontrado, o: o,
    jefeNombre: colJefe + (total + 10), jefeCedula: colJefe + (total + 11), notas: 'B' + (total + 14),
    firmaTrab: 'B' + (total + 8), firmaJefe: colJefe + (total + 8) // líneas de firma del formato
  };
}

// Firma electrónica: correo de quien firma, con fecha y hora, sobre la línea de firma del formato
function firmar_(f, celda, texto, agregar) {
  const c = f.getRange(celda);
  const previo = agregar ? String(c.getValue() || '') : '';
  c.setValue((previo ? previo + '\n' : '') + texto + ' · ' + fmt_(new Date(), 'dd/MM/yyyy HH:mm'));
  intentar_(function () { c.setFontSize(8).setFontColor('#444444').setHorizontalAlignment('center').setVerticalAlignment('bottom').setWrap(true); });
}

// Los formatos nuevos llevan "Observaciones" en la columna G, dentro de SOLICITUD DE VIÁTICOS,
// y por eso la RELACIÓN DE GASTOS se corre una columna. Los formatos creados antes no la tienen.
// Al aprobar: a quién se le entrega el dinero. '' = a quien solicita; si no, un técnico de "Trabajadores".
// Queda en Registro (Técnico responsable del dinero) y en la casilla de la fila 16 del formato.
function entregarA_(ss, reg, filaReg, d, nombre) {
  const trabajadores = leerTrabajadores_(ss);
  const pedido = norm_(nombre).toUpperCase();
  let t = null;
  if (pedido) {
    t = validarReceptor_(ss, String(d[C.proy - 1]), nombre, String(d[C.viajan - 1] || '').split(','));
  } else {
    t = trabajadores.filter(function (x) { return x.nombre.toUpperCase() === String(d[C.trab - 1]).toUpperCase(); })[0] ||
      { nombre: String(d[C.trab - 1]), cedula: d[C.ced - 1] };
  }
  reg.getRange(filaReg, C.resp).setValue(t.nombre);
  intentar_(function () { cambiarReceptorPendiente_(ss, String(d[C.id - 1]), t.nombre); });
  intentar_(function () {
    const f = hojaFormato_(Aislamiento_.abrirLibro(d[C.idFormato - 1]));
    const o = desfase_(f), P = function (a1) { return desplazar_(a1, o); };
    casillaResponsable_(f, P);
    f.getRange('E16').setValue(t.nombre);
    f.getRange(P('J16')).setValue(t.cedula || '');
  });
}

function filaControl_(f) {
  try {
    const c = f.getRange(1, 2, 80, 1).createTextFinder('^\\s*' + TITULO_CONTROL + '\\s*$').useRegularExpression(true).findNext();
    return c ? c.getRow() : 0;
  } catch (err) { return 0; }
}

