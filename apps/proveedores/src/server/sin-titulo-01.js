// ============================================================
//  MENÚ
// ============================================================
// Ejecuta ESTA función desde el editor (botón Ejecutar) la primera vez para dar permisos.
function autorizar_() {
  const ss = SpreadsheetApp.getActive();
  DriveApp.getRootFolder();
  let drive = 'NO activado (Servicios + > Drive API)';
  try { if (typeof Drive !== 'undefined' && Drive.Files) drive = 'activado'; } catch (e) { /* no activo */ }
  console.log(`Permisos OK en "${ss.getName()}". Drive API: ${drive}. Ahora recarga la hoja para ver el menú.`);
}

function onOpen() {
  let ui;
  try {
    ui = SpreadsheetApp.getUi();
  } catch (e) {
    console.log('El menú solo se crea al abrir la hoja de cálculo. No ejecutes onOpen desde el editor: ejecuta "autorizar" y luego recarga la hoja.');
    return;
  }
  // ===== MENÚ ÚNICO: reúne todas las herramientas del proyecto =====
  ui.createMenu('☀️ Social Solar')
    .addSubMenu(ui.createMenu('🧾 Ordenes de compra')
      .addItem('Ver el link del portal', 'ocMostrarLink'))
    .addSubMenu(ui.createMenu('📄 Validar Documentos (RUT)')
      .addItem('Validar fila(s) seleccionada(s)', 'menuValidarSeleccion')
      .addItem('Validar pendientes', 'menuValidarPendientes')
      .addItem('Revalidar todas las filas', 'menuRevalidarTodo')
      .addSeparator()
      .addItem('Sincronizar hoja Regimenes (todas)', 'menuSincronizarRegimenes')
      .addItem('Diagnosticar fila seleccionada', 'menuDiagnostico')
      .addSeparator()
      .addItem('Activar validación automática', 'activarAutomatico')
      .addItem('Desactivar validación automática', 'desactivarAutomatico'))
    .addSubMenu(ui.createMenu('🏦 Bancolombia')
      .addItem('🔍 Verificar Cuentas y NITs', 'verificarCuentasEnProveedores'))
    .addSubMenu(ui.createMenu('\ud83d\udd13 Quitar contrase\u00f1as de certificados bancarios')
      .addItem('1. Buscar los que tienen clave y anotarla', 'menuClavesCertificados')
      .addItem('2. Ver la lista lista para destrabar', 'menuVerClavesPendientes'))
    .addSubMenu(ui.createMenu('🗂️ Carpetas de proveedores')
      .addItem('Revisar duplicados (sin hacer cambios)', 'menuRevisarSinCambios')
      .addItem('Limpiar duplicados (mover y borrar)', 'menuLimpiarDuplicados'))
    .addSeparator()
    .addSubMenu(ui.createMenu('⚙️ Configuración y pruebas')
      .addItem('Autorizar permisos', 'menuAutorizar')
      .addItem('Enviar correo de prueba de alerta', 'menuPruebaAlerta'))
    .addToUi();

  Instalacion_.menu();
}

// ===== Funciones puente del menú (llaman a las funciones originales, que no se modificaron) =====
function menuAutorizar() { Guardas_.persona();
  autorizar_();
  SpreadsheetApp.getUi().alert('Permisos revisados. Recarga la hoja si algún menú no aparece.');
}

function menuRevisarSinCambios() { Guardas_.persona();
  revisarSinCambios_();
  mostrarRegistro_('Revisión de carpetas duplicadas (sin cambios)');
}

function menuLimpiarDuplicados() { Guardas_.persona();
  const ui = SpreadsheetApp.getUi();
  const r = ui.alert('Limpiar carpetas duplicadas',
    'Esto MOVERÁ archivos y enviará a la papelera las carpetas repetidas (se pueden restaurar durante 30 días).\n' +
    'Debe ejecutarlo la cuenta propietaria de la carpeta. Se recomienda usar antes "Revisar duplicados".\n\n¿Deseas continuar?',
    ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  limpiarDuplicados_();
  mostrarRegistro_('Limpieza de carpetas duplicadas');
}

function menuPruebaAlerta() { Guardas_.persona();
  const ui = SpreadsheetApp.getUi();
  const r = ui.alert('Prueba de alerta', 'Se enviará un correo de prueba de alerta. ¿Continuar?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  ejecutarPruebaDeAlerta_();
  ui.alert('Prueba de alerta ejecutada. Revisa el correo.');
}

function mostrarRegistro_(titulo) {
  let log = Logger.getLog() || 'Sin mensajes.';
  if (log.length > 1500) log = log.slice(0, 1500) + '\n… (registro completo en Apps Script > Ejecuciones)';
  SpreadsheetApp.getUi().alert(titulo, log, SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuValidarSeleccion() { Guardas_.persona();
  const ctx = contexto_();
  const rango = SpreadsheetApp.getActiveRange();
  if (rango.getSheet().getName() !== CFG.HOJA) return alerta_(`Selecciona filas en "${CFG.HOJA}".`);
  const R = abrirRegimenes_();
  const res = [];
  for (let f = Math.max(2, rango.getRow()); f <= rango.getLastRow(); f++) {
    if (ctx.sh.isRowHiddenByFilter(f)) continue;
    const r = procesarFila_(ctx, f, R);
    if (r) res.push(`Fila ${f} - ${r.nombre}: ${r.resumen}`);
  }
  guardarRegimenes_(R);
  alerta_(res.join('\n') || 'No había filas con datos en la selección.');
}

function menuValidarPendientes() { Guardas_.persona();
  const r = validarPendientes_();
  alerta_(`Procesadas: ${r.procesadas}\nVerificadas OK: ${r.ok}\nCon observaciones: ${r.conAlertas}\nErrores de lectura: ${r.errores}` +
    (r.quedan ? `\n\nQuedan ${r.quedan} pendientes (límite de tiempo). Ejecuta de nuevo.` : ''));
}

function menuRevalidarTodo() { Guardas_.persona();
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Revalidar todo', 'Se volverán a leer TODOS los RUT y se reescribirán las columnas FECHA RUT, Verif, Correo, Responsabilidades y Observaciones. ¿Continuar?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const props = PropertiesService.getDocumentProperties();
  const ctx = contexto_();
  const R = abrirRegimenes_();
  const inicio = Date.now();
  let f = Number(props.getProperty('cursor_revalidar')) || 2;
  const ultima = ctx.sh.getLastRow();
  let n = 0;
  for (; f <= ultima; f++) {
    if (Date.now() - inicio > CFG.TIEMPO_MAX_MS) break;
    if (procesarFila_(ctx, f, R)) n++;
  }
  guardarRegimenes_(R);
  if (f <= ultima) {
    props.setProperty('cursor_revalidar', String(f));
    alerta_(`Se procesaron ${n} filas (hasta la ${f - 1}). Ejecuta "Revalidar todas las filas" otra vez para continuar desde la fila ${f}.`);
  } else {
    props.deleteProperty('cursor_revalidar');
    alerta_(`Listo: ${n} filas revalidadas.`);
  }
}

// Usa lo que ya está en "Responsabilidades" (no vuelve a leer PDFs)
function menuSincronizarRegimenes() { Guardas_.persona();
  const ctx = contexto_();
  const datos = ctx.sh.getRange(2, 1, Math.max(ctx.sh.getLastRow() - 1, 1), ctx.sh.getLastColumn()).getValues();
  const R = abrirRegimenes_();
  let n = 0;
  datos.forEach(v => {
    const nit = v[ctx.c.nit];
    if (!nit) return;
    const cods = analizarRut_(String(v[ctx.c.resp] || '')).codigos;
    if (!cods.length) return;
    regimenUpsert_(R, { nit, nombre: v[ctx.c.nombre], ciudad: v[ctx.c.ciudad], codigos: cods });
    n++;
  });
  guardarRegimenes_(R);
  alerta_(`Hoja "${CFG.HOJA_REGIMENES}" sincronizada: ${n} proveedores revisados, ${R.nuevas} agregados.`);
}

function menuDiagnostico() { Guardas_.persona();
  const ctx = contexto_();
  const f = SpreadsheetApp.getActiveRange().getRow();
  const v = ctx.sh.getRange(f, 1, 1, ctx.sh.getLastColumn()).getValues()[0];
  const id = idDeUrl_(v[ctx.c.rut]);
  const ss = SpreadsheetApp.getActive();
  const hd = ss.getSheetByName(CFG.HOJA_DIAGNOSTICO) || ss.insertSheet(CFG.HOJA_DIAGNOSTICO);
  hd.clear();
  let info = `Fila ${f} | NIT hoja: ${v[ctx.c.nit]} | ID RUT: ${id || '(sin enlace)'}\n`;
  let texto = '';
  try {
    const file = DriveApp.getFileById(id);
    info += `Archivo: ${file.getName()} | Tipo: ${file.getMimeType()} | Tamaño: ${Math.round(file.getSize() / 1024)} KB\n`;
    texto = textoDeArchivo_(id);
    const a = analizarRut_(texto);
    info += `Fecha detectada: ${a.fecha || '-'}\nCorreo: ${a.correo || '-'}\nCódigos: ${a.codigos.join(', ') || '-'}\n` +
      `NIT de la hoja aparece en el RUT: ${a.sinEspacios.includes(nitBase_(v[ctx.c.nit])) ? 'SÍ' : 'NO'}`;
  } catch (e) {
    info += '❌ ' + e.message;
  }
  hd.getRange('A1').setValue(info).setWrap(true);
  hd.getRange('A3').setValue(texto ? texto.slice(0, 45000) : '(sin texto)').setWrap(true);
  hd.setColumnWidth(1, 900);
  ss.setActiveSheet(hd);
}

// ============================================================
//  AUTOMATIZACIÓN
// ============================================================
function activarAutomatico() { Guardas_.persona();
  desactivarAutomatico(true);
  const ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger('alEnviarFormulario').forSpreadsheet(ss).onFormSubmit().create();
  ScriptApp.newTrigger('validarPendientesAutomatico').timeBased().everyMinutes(CFG.MINUTOS_AUTOMATICO).create();
  alerta_(`Validación automática activada:\n• Cada respuesta nueva del formulario se valida al llegar.\n• Cada ${CFG.MINUTOS_AUTOMATICO} minutos se revisan las filas pendientes.`);
}

function desactivarAutomatico(silencioso) { Guardas_.persona();
  ScriptApp.getProjectTriggers()
    .filter(t => ['alEnviarFormulario', 'validarPendientesAutomatico'].includes(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));
  if (silencioso !== true) alerta_('Validación automática desactivada.');
}

function alEnviarFormulario(e) { Guardas_.activador(arguments[0]);
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(60000)) return;
  try {
    if (!e || !e.range || e.range.getSheet().getName() !== CFG.HOJA) return;
    Utilities.sleep(3000); // da tiempo a que Drive termine de guardar los adjuntos
    const R = abrirRegimenes_();
    procesarFila_(contexto_(), e.range.getRow(), R);
    guardarRegimenes_(R);
  } finally {
    lock.releaseLock();
  }
}

function validarPendientesAutomatico() { Guardas_.activador(arguments[0]);
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(1000)) return;
  try { validarPendientes_(); } finally { lock.releaseLock(); }
}

function validarPendientes_() {
  const ctx = contexto_();
  const ultima = ctx.sh.getLastRow();
  const res = { procesadas: 0, ok: 0, conAlertas: 0, errores: 0, quedan: 0 };
  if (ultima < 2) return res;
  const datos = ctx.sh.getRange(2, 1, ultima - 1, ctx.sh.getLastColumn()).getValues();
  const pendientes = [];
  datos.forEach((v, i) => {
    if (!v[ctx.c.nit] && !v[ctx.c.nombre]) return;
    if (!idDeUrl_(v[ctx.c.rut]) && norm_(v[ctx.c.fecha]) === 'NO ADJUNTO') return;
    if (PENDIENTE.includes(norm_(v[ctx.c.fecha]))) pendientes.push(i + 2);
  });
  const R = abrirRegimenes_();
  const inicio = Date.now();
  for (const f of pendientes) {
    if (Date.now() - inicio > CFG.TIEMPO_MAX_MS) { res.quedan++; continue; }
    const r = procesarFila_(ctx, f, R);
    if (!r) continue;
    res.procesadas++;
    if (r.estado === 'OK') res.ok++;
    else if (r.estado === 'ERROR') res.errores++;
    else res.conAlertas++;
  }
  guardarRegimenes_(R);
  return res;
}

// ============================================================
//  PROCESO DE UNA FILA
// ============================================================
function contexto_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(CFG.HOJA);
  if (!sh) throw new Error(`No existe la hoja "${CFG.HOJA}"`);
  let enc = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const busca = (...n) => enc.findIndex(h => n.includes(norm_(h)));
  let obs = busca('OBSERVACIONES');
  if (obs < 0) {
    obs = enc.length;
    if (obs + 1 > sh.getMaxColumns()) sh.insertColumnAfter(sh.getMaxColumns());
    sh.getRange(1, obs + 1).setValue('Observaciones')
      .setFontWeight('bold').setFontColor('#ffffff').setBackground('#2e6b4f');
    sh.setColumnWidth(obs + 1, 380);
    enc = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  }
  const c = {
    nit: busca('NIT'),
    nombre: busca('NOMBRE'),
    ciudad: busca('CIUDAD'),
    regimen: busca('REGIMEN TRIBUTARIO'),
    rut: enc.findIndex(h => /^RUT\b/.test(norm_(h))),
    cert: enc.findIndex(h => norm_(h).startsWith('CERTIFICACION')),
    fecha: busca('FECHA RUT'),
    verif: busca('VERIF'),
    correo: busca('CORREO ELECTRONICO', 'CORREO'),
    resp: busca('RESPONSABILIDADES'),
    obs,
  };
  ['nit', 'rut', 'fecha', 'verif', 'correo', 'resp'].forEach(k => {
    if (c[k] < 0) throw new Error(`No encuentro la columna "${k}" en "${CFG.HOJA}"`);
  });
  return { sh, c };
}

