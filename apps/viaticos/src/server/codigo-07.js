// Tesorería (o gerencia) registra: "le entregué a tal persona tanta plata para este proyecto".
// p = { sol, recibe, valor, fecha, medio, comprobante, uid }. Se descuenta de lo "Por pagar" de esa solicitud;
// si se entrega menos, el resto sigue por pagar; si no había nada por pagar, queda como una entrega más.
function appRegistrarEntrega_(token, p) {
  const yo = sesion_(token);
  if (!registraEntregas_(yo)) throw new Error('Solo tesorería o gerencia registran las entregas de plata.');
  const candado = candado_();
  try {
    p = p || {};
    const cache = CacheService.getScriptCache();
    const uid = String(p.uid || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 60);
    if (uid && cache.get('UE_' + uid)) return appDatos_(token);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!String(p.sol || '').trim()) throw new Error('Elige el viático abierto al que se le carga la entrega.');
    const reg = ss.getSheetByName(HOJA_REG), filaReg = filaRegistro_(reg, String(p.sol || ''));
    if (!filaReg) throw new Error('Elige la solicitud.');
    const d = reg.getRange(filaReg, 1, 1, REG.length).getValues()[0];
    // Viáticos activos: solicitados (aún sin aprobar), aprobados o en revisión. Legalizados o rechazados ya no reciben plata.
    if (['Solicitado', 'Aprobado', 'En revisión'].indexOf(String(d[C.estado - 1])) === -1) throw new Error('La solicitud ' + d[C.id - 1] + ' ya está ' + String(d[C.estado - 1]).toLowerCase() + '; no recibe más entregas.');
    const t = leerTrabajadores_(ss).filter(function (x) { return x.nombre.toUpperCase() === norm_(p.recibe).toUpperCase(); })[0];
    if (!t) throw new Error('Elige de la lista a quién se le entregó la plata.');
    const infoSol = (datosTesoreria_(ss, [d], yo, leerTrabajadores_(ss)) || { solicitudes: [] }).solicitudes[0];
    if (infoSol && infoSol.puedenRecibir.length && infoSol.puedenRecibir.map(function (x) { return x.toUpperCase(); }).indexOf(t.nombre.toUpperCase()) === -1) {
      throw new Error(t.nombre + ' no es técnico del proyecto ni viaja en ' + d[C.id - 1] + '. Pueden recibir: ' + infoSol.puedenRecibir.join(', ') + '.');
    }
    const valor = typeof p.valor === 'number' ? Math.round(p.valor) : aNumero_(p.valor);
    if (!(valor > 0) || valor > VALOR_MAXIMO) throw new Error('Escribe el valor entregado.');
    const fecha = aFecha_(p.fecha) || new Date();
    if (fecha.getTime() > Date.now() + 86400000) throw new Error('La fecha de entrega no puede ser futura.');
    const medio = txt_(p.medio, 40), comp = txt_(p.comprobante, 60);
    const h = hojaEnt_(ss), sol = String(d[C.id - 1]), proy = String(d[C.proy - 1]);
    let resta = valor;
    leerEntregas_(ss).filter(function (e) { return e.sol === sol && (e.estado === 'Por pagar' || e.estado === 'Pendiente'); }).forEach(function (e) {
      if (resta <= 0) return;
      if (resta >= e.valor) { // se paga completa (si se entregó más, el excedente se suma a esta entrega)
        const ultima = resta - e.valor < 1 || leerEntregas_(ss).filter(function (x) { return x.sol === sol && (x.estado === 'Por pagar' || x.estado === 'Pendiente'); }).length === 1;
        const v = ultima ? resta : e.valor;
        h.getRange(e.fila, CE.fecha, 1, 1).setValue(fecha);
        h.getRange(e.fila, CE.recibe, 1, 2).setValues([[t.nombre, v]]);
        h.getRange(e.fila, CE.estado, 1, 4).setValues([['Entregado', yo.correo, medio, comp]]);
        resta -= v;
      } else {                  // pago parcial: lo entregado queda aparte y el resto sigue por pagar
        h.getRange(e.fila, CE.valor).setValue(e.valor - resta);
        const n = leerEntregas_(ss).filter(function (x) { return x.sol === sol; }).length + 1;
        h.appendRow(['E-' + sol + '-' + n, fecha, sol, proy, t.nombre, resta, e.detalle + ' (parcial)', 'Entregado', yo.correo, medio, comp]);
        resta = 0;
      }
    });
    if (resta > 0) { // no había nada por pagar (o se entregó de más): entrega adicional
      const n = leerEntregas_(ss).filter(function (x) { return x.sol === sol; }).length + 1;
      h.appendRow(['E-' + sol + '-' + n, fecha, sol, proy, t.nombre, resta, 'Entrega registrada por tesorería', 'Entregado', yo.correo, medio, comp]);
    }
    reg.getRange(filaReg, C.resp).setValue(t.nombre);
    // Si el viático estaba solicitado (sin aprobar), entregar la plata lo deja aprobado; lo que falte queda por pagar
    const aprobadaAlEntregar = String(d[C.estado - 1]) === 'Solicitado';
    if (aprobadaAlEntregar) {
      reg.getRange(filaReg, C.estado).setValue('Aprobado');
      reg.getRange(filaReg, C.fdec).setValue(fecha);
      reg.getRange(filaReg, C.por).setValue(yo.correo);
      leerEntregas_(ss).forEach(function (e) { if (e.sol === sol && e.estado === 'Pendiente') h.getRange(e.fila, CE.estado).setValue('Por pagar'); });
    }
    SpreadsheetApp.flush();
    intentar_(function () {
      const f = hojaFormato_(Aislamiento_.abrirLibro(d[C.idFormato - 1])), dd = reg.getRange(filaReg, 1, 1, REG.length).getValues()[0];
      if (aprobadaAlEntregar) intentar_(function () { firmar_(f, mapa_(f).firmaJefe, 'Aprobado al entregar la plata: ' + yo.nombre + ' (' + yo.correo + ')', false); });
      llenarEntregado_(f, dd); llenarControl_(ss, dd, f);
    });
    marcarControl_(proy);
    // Aviso a quien pidió y a quien recibió (si tiene correo)
    const resumen = tabla_([['Solicitud', sol], ['Proyecto', proy], ['Se le entregó a', t.nombre], ['Valor', pesos_(valor)],
      ['Fecha', fmt_(fecha)], ['Medio de pago', medio || '—'], ['N.° comprobante', comp || '—'], ['Registró', yo.nombre]]);
    [String(d[C.correo - 1] || ''), t.correo].filter(function (c, i, l) { return c && l.indexOf(c) === i; }).forEach(function (c) {
      correo_(c, 'Viáticos ' + sol + ': entrega de ' + pesos_(valor) + ' a ' + t.nombre, '<p>Se registró la entrega de plata.</p>' + resumen +
        '<p>Quien recibió la plata la relaciona con sus soportes en la app, pestaña <b>Legalización</b>.</p>');
    });
    if (uid) cache.put('UE_' + uid, '1', 21600);
    return appDatos_(token);
  } finally {
    candado.releaseLock();
  }
}

// Entrega directa: "le entregué a tal persona tanta plata para este proyecto", sin que nadie haya subido una solicitud.
// Se crea el formato del viaje a nombre de quien recibió (ya aprobado y entregado), para que él lo legalice en la app.
function entregaDirecta_(ss, yo, p) {
  const proy = buscar_(leerProyectos_(ss), p.proyecto || '');
  if (!proy) throw new Error('Elige el proyecto.');
  const t = leerTrabajadores_(ss).filter(function (x) { return x.nombre.toUpperCase() === norm_(p.recibe).toUpperCase(); })[0];
  if (!t) throw new Error('Elige de la lista a quién se le entregó la plata.');
  const valor = typeof p.valor === 'number' ? Math.round(p.valor) : aNumero_(p.valor);
  if (!(valor > 0) || valor > VALOR_MAXIMO) throw new Error('Escribe el valor entregado.');
  const fecha = aFecha_(p.fecha) || new Date();
  if (fecha.getTime() > Date.now() + 86400000) throw new Error('La fecha de entrega no puede ser futura.');
  if (fecha.getTime() < Date.now() - 120 * 86400000) throw new Error('La fecha de entrega es demasiado antigua. Revísala.');
  const conceptos = leerConceptos_(ss);
  const concepto = conceptos.indexOf(norm_(p.concepto)) > -1 ? norm_(p.concepto) : (conceptos.indexOf('Otros') > -1 ? 'Otros' : conceptos[0]);
  const para = txt_(p.para, 120) || 'Viáticos del proyecto';
  const regreso = new Date(fecha.getTime() + 30 * 86400000);
  const r = crearSolicitud_({
    trab: t, proy: proy, ciudad: txt_(p.destino, 80) || '—', salida: fecha, regreso: regreso, objeto: para,
    lineas: [[fecha, concepto, txt_(p.destino, 80) || '—', valor]], notas: ['Entregado por ' + yo.nombre + (p.medio ? ' · ' + txt_(p.medio, 40) : '') + (p.comprobante ? ' · ' + txt_(p.comprobante, 60) : '')],
    viajan: [], resp: { nombre: t.nombre, cedula: t.cedula }, extra: [],
    directa: { yo: yo, fecha: fecha, medio: txt_(p.medio, 40), comp: txt_(p.comprobante, 60) }
  });
  marcarControl_(proy.nombre); // el control del proyecto y el dashboard se actualizan
  return r;
}

// Tesorería / gerencia anula una entrega mal registrada (persona o valor equivocado). Lo que estaba dentro de lo
// aprobado vuelve a quedar "Por pagar" para registrarlo bien; lo que era de más queda "Anulada". Se corrige el formato.
function appAnularEntrega_(token, idEntrega) {
  const yo = sesion_(token);
  if (!registraEntregas_(yo)) throw new Error('Solo tesorería o gerencia anulan entregas.');
  const candado = candado_();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), h = hojaEnt_(ss);
    const e = leerEntregas_(ss).filter(function (x) { return x.id === String(idEntrega) && x.estado === 'Entregado'; })[0];
    if (!e) throw new Error('Esa entrega ya no está registrada (actualiza la pantalla).');
    const reg = ss.getSheetByName(HOJA_REG), filaReg = filaRegistro_(reg, e.sol);
    const d = filaReg ? reg.getRange(filaReg, 1, 1, REG.length).getValues()[0] : null;
    if (d && ['Legalizado', 'Rechazado'].indexOf(String(d[C.estado - 1])) > -1) throw new Error('La solicitud ' + e.sol + ' ya está ' + String(d[C.estado - 1]).toLowerCase() + '.');
    const aprobado = d ? Number(d[C.solic - 1]) || 0 : 0;
    const otras = leerEntregas_(ss).filter(function (x) { return x.sol === e.sol && x.id !== e.id && ['Entregado', 'Por pagar', 'Pendiente'].indexOf(x.estado) > -1; })
      .reduce(function (t, x) { return t + x.valor; }, 0);
    const vuelve = d ? Math.max(0, Math.min(e.valor, aprobado - otras)) : 0;
    const nota = ' (anulada por ' + yo.nombre + ' ' + fmt_(new Date(), 'dd/MM HH:mm') + ': era a ' + e.recibe + ')';
    h.getRange(e.fila, CE.valor).setValue(vuelve || e.valor);
    h.getRange(e.fila, CE.detalle, 1, 5).setValues([[e.detalle + nota, vuelve ? 'Por pagar' : 'Anulada', yo.correo, '', '']]);
    if (vuelve && vuelve < e.valor) {
      const n = leerEntregas_(ss).filter(function (x) { return x.sol === e.sol; }).length + 1;
      h.appendRow(['E-' + e.sol + '-' + n, new Date(), e.sol, e.proy, e.recibe, e.valor - vuelve, e.detalle + nota, 'Anulada', yo.correo, '', '']);
    }
    if (d) {
      // El responsable del dinero vuelve a ser quien todavía tenga plata entregada (o el técnico que se había elegido)
      const quedan = leerEntregas_(ss).filter(function (x) { return x.sol === e.sol && x.estado === 'Entregado'; });
      if (quedan.length) reg.getRange(filaReg, C.resp).setValue(quedan[quedan.length - 1].recibe);
      else if (norm_(d[C.resp - 1]).toUpperCase() === e.recibe.toUpperCase()) {
        const pend = leerEntregas_(ss).filter(function (x) { return x.sol === e.sol && x.estado === 'Por pagar' && x.recibe.toUpperCase() !== e.recibe.toUpperCase(); })[0];
        const tec = String(d[C.viajan - 1] || '').split(',').map(norm_).filter(String)[0];
        reg.getRange(filaReg, C.resp).setValue(pend ? pend.recibe : (tec || d[C.trab - 1]));
      }
      SpreadsheetApp.flush();
      intentar_(function () {
        const f = hojaFormato_(Aislamiento_.abrirLibro(d[C.idFormato - 1])), dd = reg.getRange(filaReg, 1, 1, REG.length).getValues()[0];
        llenarEntregado_(f, dd); llenarControl_(ss, dd, f);
      });
    }
    marcarControl_(e.proy);
    return appDatos_(token);
  } finally {
    candado.releaseLock();
  }
}

// Entregas de solicitudes que ya no existen en "Registro" (por ejemplo, si se cambió el número a mano): se quitan
function limpiarEntregasHuerfanas_(ss) {
  const reg = ss.getSheetByName(HOJA_REG), h = ss.getSheetByName(HOJA_ENT);
  if (!reg || !h || h.getLastRow() < 2) return [];
  const ids = {};
  if (reg.getLastRow() >= 2) reg.getRange(2, C.id, reg.getLastRow() - 1, 1).getValues().forEach(function (r) { ids[String(r[0]).trim()] = true; });
  const quitar = leerEntregas_(ss).filter(function (e) { return !ids[e.sol]; });
  quitar.map(function (e) { return e.fila; }).sort(function (a, b) { return b - a; }).forEach(function (f) { h.deleteRow(f); });
  return quitar.map(function (e) { return e.id + ' (' + e.sol + ', ' + pesos_(e.valor) + ', ' + e.recibe + ')'; });
}

// Lo que ve tesorería / gerencia para registrar entregas: solicitudes aprobadas con lo aprobado, lo entregado y lo por pagar
function datosTesoreria_(ss, filas, yo, trabajadores) {
  if (!registraEntregas_(yo)) return null;
  const ents = leerEntregas_(ss), sols = [], proyectos = leerProyectos_(ss);
  filas.forEach(function (f) {
    if (!f[C.id - 1] || ['Solicitado', 'Aprobado', 'En revisión'].indexOf(String(f[C.estado - 1])) === -1) return; // viáticos activos
    // Pueden recibir la plata: los técnicos del proyecto, los que viajan y quien pidió (no cualquier persona de la empresa)
    const pueden = [];
    const sumar = function (n) { n = norm_(n); if (n && pueden.map(function (x) { return x.toUpperCase(); }).indexOf(n.toUpperCase()) === -1) pueden.push(n); };
    String(f[C.viajan - 1] || '').split(',').forEach(sumar);
    trabajadores.filter(esTecnico_).forEach(function (t) { sumar(t.nombre); }); // cualquier técnico de la lista
    sumar(f[C.trab - 1]);
    const id = String(f[C.id - 1]), mias = ents.filter(function (e) { return e.sol === id; });
    const suma = function (est) { return mias.filter(function (e) { return e.estado === est; }).reduce(function (t, e) { return t + e.valor; }, 0); };
    const pp = mias.filter(function (e) { return (e.estado === 'Por pagar' || e.estado === 'Pendiente'); });
    sols.push({ id: id, proyecto: String(f[C.proy - 1]), solicitante: String(f[C.trab - 1]), objeto: String(f[C.obj - 1] || ''),
      aprobado: Number(f[C.solic - 1]) || 0, entregado: suma('Entregado'), porPagar: suma('Por pagar') + suma('Pendiente'), estado: String(f[C.estado - 1]),
      sugerido: pp.length ? pp[0].recibe : String(f[C.resp - 1] || f[C.trab - 1]), puedenRecibir: pueden });
  });
  sols.forEach(function (s) { if (!s.porPagar && !s.entregado) s.porPagar = s.aprobado; });
  sols.sort(function (a, b) { return b.porPagar - a.porPagar; });
  const recientes = ents.filter(function (e) { return e.estado === 'Entregado'; }).slice(-8).reverse()
    .map(function (e) { return { id: e.id, sol: e.sol, proyecto: e.proy, recibe: e.recibe, valor: e.valor, fecha: fmt_(e.fecha), medio: e.medio, comp: e.comp }; });
  return { solicitudes: sols, personas: trabajadores.map(function (t) { return t.nombre; }), recientes: recientes, conTesoreria: hayTesoreria_(trabajadores),
    proyectos: leerProyectos_(ss).map(function (x) { return x.nombre; }), conceptos: leerConceptos_(ss) };
}

// Entregas hechas, con la parte de lo legalizado que le toca a cada una (si una solicitud tiene varias
// entregas, lo legalizado se reparte en proporción a lo que recibió cada persona).
function entregasHechas_(filas, entregas) {
  const porSol = {};
  filas.forEach(function (f) { if (f[C.id - 1]) porSol[String(f[C.id - 1])] = f; });
  const totalSol = {};
  entregas.forEach(function (e) { if (e.estado === 'Entregado') totalSol[e.sol] = (totalSol[e.sol] || 0) + e.valor; });
  return entregas.filter(function (e) { return e.estado === 'Entregado' && porSol[e.sol]; }).map(function (e) {
    const f = porSol[e.sol], legal = Number(f[C.legal - 1]) || 0, estado = String(f[C.estado - 1]);
    const parte = totalSol[e.sol] ? Math.round(legal * e.valor / totalSol[e.sol]) : 0;
    return { sol: e.sol, proy: e.proy || norm_(f[C.proy - 1]), recibe: e.recibe, valor: e.valor, legalizado: parte, detalle: e.detalle,
      fecha: e.fecha, estadoSol: estado, falta: estado !== 'Legalizado' ? Math.max(e.valor - parte, 0) : 0, fila: f };
  });
}

function plataPorTrabajador_(filas, yo, proyectos, trabajadores) {
  const todo = esAdmin_(yo) || esGerente_(yo);
  const misProy = {};
  proyectos.forEach(function (p) { if (p.correo && p.correo === yo.correo) misProy[p.nombre.toUpperCase()] = true; });
  const grupos = {}, mia = { entregado: 0, legalizado: 0, porRelacionar: 0, entregas: [] };
  const hechas = entregasHechas_(filas, leerEntregas_(SpreadsheetApp.getActiveSpreadsheet()));
  hechas.forEach(function (x) {
    const e = { id: x.sol, proyecto: x.proy, fecha: fmt_(x.fecha, 'dd/MM'), valor: x.valor, legalizado: x.legalizado, falta: x.falta, estado: x.estadoSol, detalle: x.detalle };
    if (x.recibe.toUpperCase() === yo.nombre.toUpperCase()) {
      mia.entregado += x.valor; mia.legalizado += x.legalizado; mia.porRelacionar += x.falta; mia.entregas.push(e);
    }
    const ve = todo || misProy[x.proy.toUpperCase()] || esAprobadorDe_(x.fila, yo, trabajadores, proyectos);
    if (!ve) return;
    const k = x.recibe.toUpperCase(), gr = grupos[k] = grupos[k] || { nombre: x.recibe, entregado: 0, legalizado: 0, porRelacionar: 0, n: 0, proyectos: [] };
    gr.entregado += x.valor; gr.legalizado += x.legalizado; gr.porRelacionar += x.falta; gr.n++;
    if (gr.proyectos.indexOf(x.proy) === -1) gr.proyectos.push(x.proy);
  });
  mia.entregas.reverse();
  const equipo = Object.keys(grupos).map(function (k) { return grupos[k]; })
    .sort(function (a, b) { return b.porRelacionar - a.porRelacionar || b.entregado - a.entregado; });
  return { mia: mia, equipo: equipo };
}

function filaPropia_(id, yo) {
  const reg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_REG);
  const filaReg = filaRegistro_(reg, id);
  if (!filaReg) throw new Error(MOTIVOS.no_existe);
  const d = reg.getRange(filaReg, 1, 1, REG.length).getValues()[0];
  if (!esDe_(d, yo)) throw new Error('Esa solicitud es de otra persona.');
  return d;
}

function appEstado_(token) {
  try {
    const yo = sesion_(token);
    return { token: String(token), correo: yo.correo, nombre: yo.nombre };
  } catch (err) {}
  // Si la cuenta de Google es de la misma organización, Google ya nos dice quién es
  let correoGoogle = '';
  try { correoGoogle = Session.getActiveUser().getEmail() || ''; } catch (err) {}
  const yo = trabajadorPorCorreo_(SpreadsheetApp.getActiveSpreadsheet(), correoGoogle);
  if (yo) return { token: crearSesion_(yo.correo), correo: yo.correo, nombre: yo.nombre };
  return { token: '', correoGoogle: correoGoogle };
}

