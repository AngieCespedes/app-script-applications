// Escribe un gasto en el formato del viaje. fuentes: [{ blob, ext }] con la foto o el PDF del soporte
function registrarGasto_(id, g, fuentes, estados) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reg = ss.getSheetByName(HOJA_REG);
  const filaReg = filaRegistro_(reg, id);
  if (!filaReg) return { ok: false, motivo: 'no_existe' };
  const d = reg.getRange(filaReg, 1, 1, REG.length).getValues()[0];
  if ((estados || ABIERTOS).indexOf(d[C.estado - 1]) === -1) return { ok: false, motivo: 'cerrada' };
  const carpeta = Aislamiento_.carpeta(d[C.idCarpeta - 1]);
  const f = hojaFormato_(Aislamiento_.abrirLibro(d[C.idFormato - 1]));

  // Primera fila libre de RELACIÓN DE GASTOS (columnas G a K)
  const m = mapa_(f);
  asegurarColQuien_(f, m); // antes de ampliar: la fila nueva se copia con esa columna incluida
  const bloque = f.getRange(m.fi, 7 + m.o, m.n, 5).getValues();
  let libre = -1;
  for (let i = 0; i < bloque.length; i++) {
    if (bloque[i].join('') === '') { libre = i; break; }
  }
  if (libre === -1 && m.encontrado && m.n < MAX_FILAS) { // solo crece si ubicó bien dónde termina el detalle
    try { libre = ampliarFormato_(f, m); } catch (err) { console.error('No se pudo ampliar el formato: ' + err); }
  }
  const numero = libre > -1 ? libre + 1 : 'X';

  // Guardar los soportes en la carpeta del viaje (dentro de la carpeta del proyecto)
  const enlaces = [];
  fuentes.forEach(function (fu, i) {
    try {
      const archivo = carpeta.createFile(fu.blob);
      const ext = fu.ext || '';
      const sufijo = fuentes.length > 1 ? '_' + (i + 1) : '';
      archivo.setName(limpiarNombre_(d[C.proy - 1] + '_' + id + '_Soporte ' + numero + sufijo + '_' + g.concepto + '_' + g.valor) + ext);
      enlaces.push(archivo.getUrl());
    } catch (err) {
      console.error('Soporte ' + (i + 1) + ' de ' + id + ': ' + err);
    }
  });

  if (libre === -1) {
    const celdaNotas = f.getRange(mapa_(f).notas);
    const nota = String(celdaNotas.getValue());
    celdaNotas.setValue((nota ? nota + '\n' : '') + 'Gasto sin espacio en el formato: ' + fmt_(g.fecha) +
      ', ' + g.concepto + ', ' + g.tercero + ', ' + pesos_(g.valor) + '.');
    return { ok: false, motivo: 'lleno' };
  }

  const filaFmt = m.fi + libre;
  const partesObs = [fmt_(g.fecha)];
  if (g.factura) partesObs.push('Factura contable N.° ' + g.factura);
  if (g.obs) partesObs.push(g.obs);
  if (!enlaces.length) partesObs.push('Sin foto del soporte');
  if (enlaces.length > 1) partesObs.push(enlaces.length + ' fotos en la carpeta');

  const celdaSoporte = f.getRange(filaFmt, 7 + m.o).setNumberFormat('@');
  const textoSoporte = g.nSoporte || (enlaces.length ? 'Ver soporte' : 'Sin n.°');
  if (enlaces.length) {
    celdaSoporte.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(textoSoporte).setLinkUrl(enlaces[0]).build());
  } else {
    celdaSoporte.setValue(textoSoporte);
  }
  f.getRange(filaFmt, 8 + m.o, 1, 4).setValues([[g.tercero, g.concepto, g.valor, partesObs.join('. ')]]);
  f.getRange(filaFmt, COL_QUIEN + m.o).setValue((g.por || 'Sin identificar') + ' · ' + fmt_(new Date(), 'dd/MM/yyyy HH:mm'));
  SpreadsheetApp.flush();

  // Bitácora de gastos (alimenta el tablero y la app)
  if (!ss.getSheetByName(HOJA_GASTOS)) asegurarHojas_(ss);
  const hg = ss.getSheetByName(HOJA_GASTOS);
  hg.appendRow([
    id, new Date(), g.fecha, d[C.trab - 1], d[C.proy - 1], g.concepto, g.tercero, g.nSoporte,
    g.valor, g.obs, enlaces.join('\n'), numero
  ]);
  const fg = hg.getLastRow();
  hg.getRange(fg, 14).setValue(g.por || '');
  if (g.factura) hg.getRange(fg, 15).setNumberFormat('@').setValue(g.factura);
  if (String(hg.getRange(1, 15).getValue()) !== GAS[14]) hg.getRange(1, 15).setValue(GAS[14]).setFontWeight('bold').setBackground(NEGRO).setFontColor('#ffffff');
  hg.getRange(fg, 13).setFormula(formulaAcumulado_(fg)); // lo que lleva gastado esa solicitud hasta este gasto

  actualizarTotales_(reg, filaReg, f);
  return { ok: true, numero: numero };
}

/* ============== ACCESO RESTRINGIDO POR CORREO ============== */
// Solo entran a la app los correos escritos en la columna E de "Trabajadores".
// La primera vez cada persona confirma su correo con un código y crea su propia clave;
// después entra con correo y clave, y solo ve sus propias solicitudes.

function trabajadorPorCorreo_(ss, correo) {
  const c = String(correo || '').trim().toLowerCase();
  if (!c) return null;
  const lista = leerTrabajadores_(ss);
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].correo === c) return lista[i];
  }
  return null;
}

// Huella SHA-256 en hexadecimal (para no guardar tal cual ni las claves ni las llaves de sesión)
function hex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

function sha_(texto) {
  return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(texto), Utilities.Charset.UTF_8));
}

// Cierra las sesiones abiertas de un correo (al cambiarle la clave) y de paso borra las vencidas
function limpiarSesiones_(correo) {
  const props = PropertiesService.getScriptProperties();
  const ahora = Date.now();
  const todas = props.getProperties();
  Object.keys(todas).forEach(function (k) {
    if (k.indexOf('S_') !== 0) return;
    let s = {};
    try { s = JSON.parse(todas[k]); } catch (err) {}
    if (!(s.exp > ahora) || (correo && s.correo === correo)) props.deleteProperty(k);
  });
}

function crearSesion_(correo) {
  limpiarSesiones_('');
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('S_' + sha_(token),
    JSON.stringify({ correo: correo, exp: Date.now() + DIAS_SESION * 86400000 }));
  return token;
}

// Devuelve el trabajador dueño de la sesión, o lanza un error que la app reconoce
function sesion_(token) {
  let correo = '';
  const bruto = token ? PropertiesService.getScriptProperties().getProperty('S_' + sha_(token)) : null;
  if (bruto) {
    try { const s = JSON.parse(bruto); if (s.exp > Date.now()) correo = s.correo; } catch (err) {}
  }
  const yo = trabajadorPorCorreo_(SpreadsheetApp.getActiveSpreadsheet(), correo);
  if (!yo) throw new Error('SESION: Tu sesión terminó. Entra de nuevo con tu correo.');
  return yo;
}

// ¿La fila de "Registro" es de este trabajador?
function esDe_(fila, yo) {
  const correo = String(fila[C.correo - 1]).trim().toLowerCase();
  if (correo) return correo === yo.correo;           // lo normal: el correo con el que se hizo la solicitud
  return norm_(fila[C.trab - 1]).toUpperCase() === yo.nombre.toUpperCase(); // filas antiguas sin correo
}

// Solicitud del trabajador o de alguien a quien yo apruebo (conducto regular), mientras no esté legalizada.
// Devuelve { d: fila de Registro, propia: true/false }
function filaAccesible_(id, yo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reg = ss.getSheetByName(HOJA_REG);
  const filaReg = filaRegistro_(reg, id);
  if (!filaReg) throw new Error(MOTIVOS.no_existe);
  const d = reg.getRange(filaReg, 1, 1, REG.length).getValues()[0];
  if (esDe_(d, yo)) return { d: d, propia: true };
  if (norm_(d[C.resp - 1]).toUpperCase() === yo.nombre.toUpperCase() || recibioDe_(ss, yo)[String(d[C.id - 1])]) { // la plata se le entregó a él: él la legaliza
    if (ABIERTOS.indexOf(d[C.estado - 1]) > -1) return { d: d, propia: false, resp: true };
    throw new Error(MOTIVOS.cerrada);
  }
  if (esAprobadorDe_(d, yo, leerTrabajadores_(ss), leerProyectos_(ss))) {
    if (ABIERTOS_APROBADOR.indexOf(d[C.estado - 1]) > -1) return { d: d, propia: false };
    throw new Error(MOTIVOS.cerrada);
  }
  throw new Error('Esa solicitud es de otra persona.');
}

// A quién se le puede entregar plata en un proyecto: los técnicos que el ingeniero asignó al proyecto.
// Si el proyecto no tiene técnicos asignados, a cualquier técnico.
// Solicitudes en las que esta persona recibió plata (según la hoja Entregas), aunque la haya pedido otro
function recibioDe_(ss, yo) {
  const mias = {}, nombre = String(yo.nombre || '').toUpperCase();
  intentar_(function () {
    leerEntregas_(ss).forEach(function (e) { if (e.estado === 'Entregado' && String(e.recibe).toUpperCase() === nombre) mias[e.sol] = true; });
  });
  return mias;
}

function recibenPlata_(proy, trabajadores) {
  if (!proy) return [];
  return trabajadores.filter(function (t) {
    return esTecnico_(t) && ((!!t.correo && proy.asignados.indexOf(t.correo) > -1) || proy.asignados.indexOf(t.nombre.toLowerCase()) > -1);
  });
}

// viajan: técnicos que van en el viaje; cualquiera de ellos también puede ser el responsable del dinero
function validarReceptor_(ss, nombreProyecto, nombre, viajan) {
  const trabajadores = leerTrabajadores_(ss), pedido = norm_(nombre).toUpperCase();
  const t = trabajadores.filter(function (x) { return x.nombre.toUpperCase() === pedido; })[0];
  if (!t || !esTecnico_(t)) throw new Error('"' + txt_(nombre, 60) + '" no es del área técnica. El responsable del dinero debe ser un técnico.');
  const proy = buscar_(leerProyectos_(ss), nombreProyecto);
  const permitidos = recibenPlata_(proy, trabajadores);
  if (false && permitidos.indexOf(t) === -1) { // ya no se restringe: sirve cualquier técnico de la lista de Trabajadores
    throw new Error('A ' + t.nombre + ' no se le puede entregar plata en ' + (proy ? proy.nombre : 'este proyecto') +
      '. Pueden recibir: ' + permitidos.map(function (x) { return x.nombre; }).join(', ') + ' (el ingeniero a cargo las elige en la pestaña Presupuesto).');
  }
  return t;
}

function esAprobadorDe_(fila, yo, trabajadores, proyectos) {
  return aprobadores_(fila, trabajadores, proyectos).some(function (a) { return a.correo === yo.correo; });
}

// Estados de una entrega: Pendiente (falta aprobar) · Por pagar (aprobada; falta que tesorería registre la entrega) · Entregado · Rechazado
function hojaEnt_(ss) {
  let h = ss.getSheetByName(HOJA_ENT);
  if (h) return h;
  h = ss.insertSheet(HOJA_ENT);
  h.getRange(1, 1, 1, ENT.length).setValues([ENT]).setFontWeight('bold').setBackground(NEGRO).setFontColor('#ffffff');
  h.setFrozenRows(1);
  intentar_(function () {
    [130, 130, 110, 240, 200, 120, 260, 110, 220, 130, 150].forEach(function (w, i) { h.setColumnWidth(i + 1, w); });
    h.getRange('B2:B').setNumberFormat('dd/mm/yyyy hh:mm'); h.getRange('F2:F').setNumberFormat('$ #,##0');
  });
  h.getRange('M1').setValue('Esta hoja la llena el sistema: una fila por cada entrega de plata (anticipo inicial, adiciones y lo que registra tesorería), con quién la recibe.')
    .setFontStyle('italic').setFontColor('#666666');
  // Solicitudes que ya existían: su entrega se arma con lo que hay en "Registro"
  const reg = ss.getSheetByName(HOJA_REG);
  if (reg && reg.getLastRow() >= 2) {
    const filas = [];
    reg.getRange(2, 1, reg.getLastRow() - 1, REG.length).getValues().forEach(function (d) {
      const estado = String(d[C.estado - 1]);
      if (!d[C.id - 1] || estado === 'Rechazado') return;
      const ok = ESTADOS_ENTREGADA.indexOf(estado) > -1;
      filas.push(['E-' + d[C.id - 1] + '-1', ok ? (d[C.fdec - 1] || d[C.fecha - 1]) : d[C.fecha - 1], String(d[C.id - 1]), String(d[C.proy - 1]),
        String(d[C.resp - 1] || d[C.trab - 1]), Number(d[C.solic - 1]) || 0, 'Anticipo inicial', ok ? 'Entregado' : 'Pendiente', ok ? String(d[C.por - 1] || '') : '', '', '']);
    });
    if (filas.length) h.getRange(2, 1, filas.length, ENT.length).setValues(filas);
  }
  return h;
}

function leerEntregas_(ss) {
  const h = hojaEnt_(ss);
  if (h.getLastRow() < 2) return [];
  return h.getRange(2, 1, h.getLastRow() - 1, ENT.length).getValues().map(function (r, i) {
    return { fila: i + 2, id: String(r[0]), fecha: r[1], sol: String(r[2]), proy: norm_(r[3]), recibe: norm_(r[4]), valor: Number(r[5]) || 0,
      detalle: String(r[6] || ''), estado: String(r[7] || ''), por: String(r[8] || ''), medio: String(r[9] || ''), comp: String(r[10] || '') };
  }).filter(function (e) { return e.sol; });
}

function nuevaEntrega_(ss, sol, proy, recibe, valor, detalle) {
  const h = hojaEnt_(ss);
  const n = leerEntregas_(ss).filter(function (e) { return e.sol === String(sol); }).length + 1;
  h.appendRow(['E-' + sol + '-' + n, new Date(), String(sol), String(proy), String(recibe), valor, detalle, 'Pendiente', '', '', '']);
}

// Pasa las entregas pendientes de una solicitud a "Entregado" (o "Rechazado"). Devuelve cuántas cambió.
function decidirEntregas_(ss, sol, estado, quien, recibe) {
  const h = hojaEnt_(ss);
  let n = 0;
  leerEntregas_(ss).forEach(function (e) {
    if (e.sol !== String(sol) || e.estado !== 'Pendiente') return;
    h.getRange(e.fila, CE.fecha).setValue(new Date());
    if (recibe) h.getRange(e.fila, CE.recibe).setValue(recibe);
    h.getRange(e.fila, CE.estado, 1, 2).setValues([[estado, quien || '']]);
    n++;
  });
  return n;
}

function cambiarReceptorPendiente_(ss, sol, recibe) {
  const h = hojaEnt_(ss);
  leerEntregas_(ss).forEach(function (e) { if (e.sol === String(sol) && (e.estado === 'Pendiente' || e.estado === 'Por pagar')) h.getRange(e.fila, CE.recibe).setValue(recibe); });
}

