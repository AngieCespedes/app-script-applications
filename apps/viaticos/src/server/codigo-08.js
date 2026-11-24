function appPedirCodigo_(correo) {
  const yo = trabajadorPorCorreo_(SpreadsheetApp.getActiveSpreadsheet(), correo);
  if (!yo) throw new Error('Ese correo no está autorizado. Pide a administración que lo registre en la lista de trabajadores.');
  const cache = CacheService.getScriptCache();
  if (cache.get('OTPE_' + yo.correo)) throw new Error('Ya te enviamos un código hace un momento. Revisa tu correo (también en spam) o espera un minuto.');
  const pedidos = Number(cache.get('OTPD_' + yo.correo) || 0);
  if (pedidos >= 5) throw new Error('Pediste demasiados códigos. Intenta en unas horas o pide a administración que te asigne la clave.');
  let cupo = 100;
  try { cupo = MailApp.getRemainingDailyQuota(); } catch (err) {}
  if (cupo < 5) throw new Error('El sistema llegó al límite de correos de hoy. Pide a administración que te asigne la clave.');

  // Si ya hay un código vigente se reenvía el mismo: nadie puede invalidarle el código a otra persona pidiendo más
  let o = null;
  try { o = JSON.parse(cache.get('OTP_' + yo.correo)); } catch (err) {}
  if (!o || !o.c) {
    o = { c: String(parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 8), 16) % 900000 + 100000), n: 0 };
    cache.put('OTP_' + yo.correo, JSON.stringify(o), 600);
  }
  cache.put('OTPE_' + yo.correo, '1', 60);
  cache.put('OTPD_' + yo.correo, String(pedidos + 1), 21600);
  Correo_.enviar({
    to: yo.correo,
    subject: 'Tu código para Viáticos Social Solar',
    htmlBody: '<p>Hola, ' + esc_(yo.nombre) + '.</p><p>Tu código para entrar a la app de viáticos es:</p>' +
      '<p style="font-size:28px;font-weight:bold;letter-spacing:4px">' + o.c + '</p>' +
      '<p>Con este código creas o cambias tu clave. Vence en 10 minutos. Si no lo pediste, ignora este correo.</p>'
  });
  return { ok: true };
}

// La clave nunca se guarda tal cual: solo una huella (SHA-256 con sal) que no permite leerla
function huella_(sal, clave, rondas) {
  let bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + String(clave), Utilities.Charset.UTF_8);
  for (let i = 1; i < (rondas || 1); i++) bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  return hex_(bytes);
}

function guardarClave_(correo, clave) {
  const sal = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('K_' + correo, 'v2:' + sal + ':' + huella_(sal, clave, RONDAS_CLAVE));
  limpiarSesiones_(correo); // con clave nueva, las sesiones abiertas en otros celulares dejan de servir
}

function claveCorrecta_(guardada, clave) {
  if (!guardada) return false;
  const p = guardada.split(':');
  if (p[0] === 'v2') return huella_(p[1], clave, RONDAS_CLAVE) === p[2];
  return huella_(p[0], clave, 1) === p[1]; // claves guardadas con la versión anterior
}

// Entrada normal: correo y clave
function appEntrar_(correo, clave) {
  const c = String(correo || '').trim().toLowerCase();
  const candado = candado_(); // el conteo de intentos no se puede saltar con llamadas simultáneas
  try {
    const cache = CacheService.getScriptCache();
    const intentos = Number(cache.get('INT_' + c) || 0);
    if (intentos >= 5) throw new Error('Demasiados intentos. Espera 10 minutos o usa "Primera vez u olvidé mi clave".');
    const yo = trabajadorPorCorreo_(SpreadsheetApp.getActiveSpreadsheet(), c);
    const guardada = yo ? PropertiesService.getScriptProperties().getProperty('K_' + yo.correo) : null;
    if (!claveCorrecta_(guardada, clave)) {
      cache.put('INT_' + c, String(intentos + 1), 600);
      throw new Error(yo && !guardada
        ? 'Todavía no has creado tu clave. Toca "Primera vez u olvidé mi clave".'
        : 'Correo o clave incorrectos.');
    }
    cache.remove('INT_' + c);
    return { token: crearSesion_(yo.correo), correo: yo.correo, nombre: yo.nombre };
  } finally {
    candado.releaseLock();
  }
}

// Primera vez u olvido: confirma el código que llegó al correo y deja creada la clave
function appVerificarCodigo_(correo, codigo, claveNueva) {
  if (String(claveNueva || '').length < 6) throw new Error('La clave debe tener al menos 6 caracteres.');
  const c = String(correo || '').trim().toLowerCase();
  const candado = candado_();
  try {
    const cache = CacheService.getScriptCache();
    const bruto = cache.get('OTP_' + c);
    if (!bruto) throw new Error('El código venció. Pide uno nuevo.');
    const o = JSON.parse(bruto);
    if (o.n >= 5) { cache.remove('OTP_' + c); throw new Error('Demasiados intentos. Pide un código nuevo.'); }
    if (String(codigo || '').replace(/\D/g, '') !== o.c) {
      o.n++;
      cache.put('OTP_' + c, JSON.stringify(o), 600);
      throw new Error('Código incorrecto. Revísalo e intenta de nuevo.');
    }
    cache.remove('OTP_' + c);
    const yo = trabajadorPorCorreo_(SpreadsheetApp.getActiveSpreadsheet(), c);
    if (!yo) throw new Error('Ese correo ya no está autorizado.');
    guardarClave_(yo.correo, claveNueva);
    cache.remove('INT_' + c);
    return { token: crearSesion_(yo.correo), correo: yo.correo, nombre: yo.nombre };
  } finally {
    candado.releaseLock();
  }
}

function appSalir_(token) {
  if (token) PropertiesService.getScriptProperties().deleteProperty('S_' + sha_(token));
  return { ok: true };
}

// Menú: el administrador le pone (o le cambia) la clave a un trabajador
function asignarClave() { Guardas_.persona();
  const ui = soloAdmin_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const conCorreo = leerTrabajadores_(ss).filter(function (t) { return t.correo; });
  if (!conCorreo.length) {
    ui.alert('Primero escribe los correos en la columna E de la pestaña "Trabajadores".');
    return;
  }
  const r1 = ui.prompt('Asignar clave', 'Correo del trabajador (como está en la pestaña "Trabajadores"):\n\n' +
    conCorreo.map(function (t) { return t.nombre + ' - ' + t.correo; }).join('\n'), ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  const yo = trabajadorPorCorreo_(ss, r1.getResponseText());
  if (!yo) { ui.alert('Ese correo no está en la pestaña "Trabajadores".'); return; }
  const r2 = ui.prompt('Asignar clave', 'Clave para ' + yo.nombre + ' (mínimo 6 caracteres):', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  const clave = r2.getResponseText().trim();
  if (clave.length < 6) { ui.alert('La clave debe tener al menos 6 caracteres. No se cambió nada.'); return; }
  guardarClave_(yo.correo, clave);
  CacheService.getScriptCache().remove('INT_' + yo.correo);
  intentar_(function () {
    const tr = ss.getSheetByName(HOJA_TRAB);
    const col = colClave_(tr);
    const correos = tr.getRange(3, 5, 40, 1).getValues();
    for (let i = 0; col && i < correos.length; i++) {
      if (String(correos[i][0]).trim().toLowerCase() === yo.correo) tr.getRange(i + 3, col).setValue(CLAVE_OK);
    }
  });
  ui.alert('Clave asignada a ' + yo.nombre + '.\n\nEntrégasela en persona. Puede cambiarla en la app con "Primera vez u olvidé mi clave".');
}

/* ===================== APP WEB PARA EL CELULAR ===================== */

function doGet(e) {
  const id = (e && e.parameter && e.parameter.id) ? String(e.parameter.id).replace(/[^A-Za-z0-9-]/g, '') : '';
  const pedida = (e && e.parameter) ? String(e.parameter.vista || '') : '';
  const vista = ['solicitud', 'aprobar', 'proyectos'].indexOf(pedida) > -1 ? pedida : '';
  return HtmlService.createHtmlOutput(APP_HTML.replace('__ID_INICIAL__', id).replace('__VISTA_INICIAL__', vista))
    .setTitle('Viáticos - Social Solar')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function appUrl_() {
  const guardada = PropertiesService.getScriptProperties().getProperty('APP_URL');
  if (guardada) return guardada;
  try {
    const url = ScriptApp.getService().getUrl() || '';
    if (/\/exec$/.test(url)) return url;
  } catch (err) {}
  return '';
}

function enlaceGastos_(id) {
  const app = appUrl_();
  return app ? app + '?id=' + encodeURIComponent(id) : '';
}

function appDatos_(token) {
  const yo = sesion_(token);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  intentar_(function () {
    const r0 = ss.getSheetByName(HOJA_REG);
    if (!r0 || r0.getLastRow() < 3) return;
    const ids = r0.getRange(2, C.id, r0.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]).trim(); }).filter(String);
    if (ids.length === new Set(ids).size) return; // lo normal: ningún número repetido
    const l = candado_();
    try { const c = repararDuplicados_(ss); if (c.length) avisarAdmin_('Números de solicitud repetidos corregidos', '<p>' + c.map(esc_).join('<br>') + '</p>'); }
    finally { l.releaseLock(); }
  });
  const reg = ss.getSheetByName(HOJA_REG);
  const filas = (reg && reg.getLastRow() >= 2) ? reg.getRange(2, 1, reg.getLastRow() - 1, REG.length).getValues() : [];
  const proyectos = leerProyectos_(ss), trabajadores = leerTrabajadores_(ss);
  const lista = [], recibi = recibioDe_(ss, yo);
  filas.forEach(function (f) {
    if (!f[C.id - 1]) return;
    const texto = [f[C.id - 1], f[C.trab - 1], f[C.proy - 1], fmt_(f[C.sal - 1], 'dd/MM')].join(' · ');
    if (ABIERTOS.indexOf(f[C.estado - 1]) > -1 && esDe_(f, yo)) {
      lista.push({ id: String(f[C.id - 1]), texto: texto });
    } else if (ABIERTOS.indexOf(f[C.estado - 1]) > -1 && (norm_(f[C.resp - 1]).toUpperCase() === yo.nombre.toUpperCase() || recibi[String(f[C.id - 1])])) {
      lista.push({ id: String(f[C.id - 1]), texto: texto + ' · plata a tu nombre', aMiNombre: true }); // me entregaron la plata: la legalizo yo
    } else if (ABIERTOS_APROBADOR.indexOf(f[C.estado - 1]) > -1 && !esDe_(f, yo) && esAprobadorDe_(f, yo, trabajadores, proyectos)) {
      // Las de las personas que yo apruebo: puedo agregarles gastos antes de legalizar
      lista.push({ id: String(f[C.id - 1]), texto: texto + (f[C.estado - 1] === 'En revisión' ? ' · en revisión' : ''), equipo: true });
    }
  });
  const equipos = {}, presu = leerPresupuestos_(ss), admin = esAdmin_(yo), lineasP = leerLineasPresupuesto_(ss);
  const entregasDe_ = {}; // por solicitud: cada entrega con su estado y quién la recibe
  leerEntregas_(ss).forEach(function (e) { (entregasDe_[e.sol] = entregasDe_[e.sol] || []).push({ recibe: e.recibe, valor: e.valor, detalle: e.detalle, estado: e.estado }); });
  proyectos.forEach(function (p) {
    if (!puedeUsar_(p, yo)) return;
    const prueba = []; prueba[C.correo - 1] = yo.correo; prueba[C.proy - 1] = p.nombre;
    const aprueba = aprobadores_(prueba, trabajadores, proyectos).map(function (a) { return a.nombre; });
    equipos[p.nombre] = {
      jefe: p.jefe, tecnicos: tecnicosDe_(p, trabajadores), aprueba: aprueba.length ? aprueba.join(' o ') : 'administración',
      presu: presu[p.nombre.toUpperCase()] || { presupuesto: null, entregado: 0, gastado: 0, por: '' }, // paso 1: presupuesto del proyecto
      aCargo: admin || (!!p.correo && p.correo === yo.correo),                                            // puede subir el presupuesto
      lineas: (lineasP[p.nombre.toUpperCase()] || []).map(function (l) { return { id: l.id, concepto: l.concepto, detalle: l.detalle, valor: l.valor }; }),
      recibenPlata: recibenPlata_(p, trabajadores).map(function (t) { return t.nombre; }), // a quién se le puede entregar plata
      control: urlControl_(p.nombre)                                                                         // formato del proyecto (presupuestado · entregado · legalizado)
    };
  });
  return {
    solicitudes: lista.reverse(),
    plata: plataPorTrabajador_(filas, yo, proyectos, trabajadores), // lo entregado a cada trabajador y lo que le falta relacionar
    libroControl: urlControl_(''), // el libro con todos los proyectos (presupuestado · entregado · legalizado)
    conceptos: leerConceptos_(ss),
    trabajadores: [{ nombre: yo.nombre, cargo: String(yo.cargo), area: String(yo.area) }],
    proyectos: proyectos.filter(function (p) { return puedeUsar_(p, yo); }).map(function (p) { return p.nombre; }),
    equipos: equipos,       // de cada proyecto que ve: quién aprueba y qué técnicos están encargados
    tecnicos: trabajadores.filter(esTecnico_).map(function (t) { return t.nombre; }), // área técnica: para elegir quiénes viajan
    casillas: leerCasillas_(ss), // casillas adicionales de la pestaña "Casillas"
    gestion: gestion_(proyectos, trabajadores, yo), // null si no puede crear proyectos ni asignar técnicos
    porAprobar: porAprobar_(ss, yo, filas), // null si la persona no es jefe de ningún proyecto
    tesoreria: datosTesoreria_(ss, filas, yo, trabajadores), // null si no registra entregas
    // Paso 2 (entrega) para quien no aprueba: cómo van sus viáticos y a quién se le entregó la plata
    misViaticos: filas.filter(function (f) { return f[C.id - 1] && esDe_(f, yo); }).slice(-10).reverse().map(function (f) {
      return {
        id: String(f[C.id - 1]), proyecto: String(f[C.proy - 1]), estado: String(f[C.estado - 1]), fecha: fmt_(f[C.fecha - 1], 'dd/MM'),
        solicitado: Number(f[C.solic - 1]) || 0, legalizado: Number(f[C.legal - 1]) || 0, entregadaA: String(f[C.resp - 1] || f[C.trab - 1] || ''),
        entregas: entregasDe_[String(f[C.id - 1])] || []
      };
    }),
    // Mis solicitudes que aún no aprueban: se les pueden agregar conceptos
    ampliables: filas.filter(function (f) { return f[C.id - 1] && ['Solicitado', 'Aprobado'].indexOf(f[C.estado - 1]) > -1 && esDe_(f, yo); }).map(function (f) {
      return {
        id: String(f[C.id - 1]), proyecto: String(f[C.proy - 1]), destino: String(f[C.dest - 1]), objeto: String(f[C.obj - 1]),
        estado: String(f[C.estado - 1]), responsable: String(f[C.resp - 1] || f[C.trab - 1] || ''),
        total: Number(f[C.solic - 1]) || 0, salida: fmt_(f[C.sal - 1], 'yyyy-MM-dd'), regreso: fmt_(f[C.reg - 1], 'yyyy-MM-dd')
      };
    }).reverse()
  };
}

// Lo que necesita la pestaña "Proyectos": los proyectos que la persona maneja y la lista de trabajadores
function gestion_(proyectos, trabajadores, yo) {
  if (!puedeGestionar_(proyectos, yo)) return null;
  const admin = esAdmin_(yo);
  const asignado = function (p, t) { return (!!t.correo && p.asignados.indexOf(t.correo) > -1) || p.asignados.indexOf(t.nombre.toLowerCase()) > -1; };
  const presu = leerPresupuestos_(SpreadsheetApp.getActiveSpreadsheet());
  return {
    // Todos los trabajadores de la hoja, tengan o no correo. "clave" es lo que identifica a cada uno al marcarlo.
    personas: trabajadores.map(function (t) {
      return { nombre: t.nombre, correo: t.correo, area: String(t.area || ''), clave: t.correo || t.nombre.toLowerCase(), tecnico: esTecnico_(t) };
    }),
    proyectos: proyectos.filter(function (p) { return admin || p.correo === yo.correo; }).map(function (p) {
      return {
        nombre: p.nombre, jefe: p.jefe, aCargo: p.correo === yo.correo || admin, // puede subir el presupuesto
        presu: presu[p.nombre.toUpperCase()] || { presupuesto: null, entregado: 0, gastado: 0, por: '' },
        tecnicos: trabajadores.filter(function (t) { return asignado(p, t); }).map(function (t) { return t.correo || t.nombre.toLowerCase(); })
      };
    })
  };
}

// Valida la lista de técnicos marcados contra "Trabajadores" y devuelve lo que se guarda en la hoja
function tecnicosValidos_(lista, trabajadores) {
  const salida = [];
  (Array.isArray(lista) ? lista : []).forEach(function (c) {
    const clave = norm_(c).toLowerCase();
    let t = null;
    trabajadores.forEach(function (x) { if (!t && ((x.correo && x.correo === clave) || x.nombre.toLowerCase() === clave)) t = x; });
    if (!t) throw new Error('"' + txt_(c, 60) + '" no está en la lista de trabajadores.');
    const guardado = t.correo || t.nombre; // con correo si lo tiene; si no, por nombre (cuando le pongan correo ya verá el proyecto)
    if (salida.indexOf(guardado) === -1) salida.push(guardado);
  });
  return salida;
}

function hojaProyectos_(ss) {
  const hoja = ss.getSheetByName(HOJA_PROY);
  if (!colAsignados_(hoja)) asegurarHojas_(ss);
  return hoja;
}

