/**
 * ============================================================
 *  VALIDADOR DE RUT – BASE DE DATOS PROVEEDORES
 *  Social Solar S.A.S.
 *
 *  - Lee el RUT (PDF o imagen) enlazado en la columna "RUT 2026"
 *  - Completa: FECHA RUT, Verif, Correo electronico, Responsabilidades
 *  - Escribe alertas en la columna "Observaciones" (se crea sola)
 *  - Crea / actualiza al proveedor en la hoja "Regimenes"
 *  - Se ejecuta solo cuando llega un formulario nuevo y cada 15 min
 *
 *  REQUISITO: Servicios (+) > "Drive API" activado (identificador: Drive)
 * ============================================================
 */

const CFG = {
  HOJA: '01 REGISTRO Y DOCUMENTOS',
  HOJA_REGIMENES: '05 REGIMENES TRIBUTARIOS',
  HOJA_DIAGNOSTICO: 'Diagnostico_RUT',
  MESES_VIGENCIA_RUT: 12,          // RUT generado hace más de N meses = desactualizado
  RUT_VENCIDO_ES_ERROR: true,      // true = Verif queda en FALSE si el RUT está desactualizado
  VALIDAR_CERTIFICACION: true,     // revisa que la certificación bancaria tenga el mismo NIT/CC
  MINUTOS_AUTOMATICO: 15,
  TIEMPO_MAX_MS: 4.5 * 60 * 1000,  // Apps Script corta a los 6 min
};

// Responsabilidades DIAN (texto como aparece en el RUT)
const RESP = {
  '01': 'Aporte especial para la administración de justicia',
  '02': 'Gravamen a los movimientos financieros',
  '03': 'Impuesto al patrimonio',
  '04': 'Impto renta y compl. régimen especial',
  '05': 'Impto. renta y compl. régimen ordinar',
  '06': 'Ingresos y patrimonio',
  '07': 'Retención en la fuente a título de rent',
  '08': 'Retención timbre nacional',
  '09': 'Retención en la fuente en el impuesto',
  '10': 'Obligado aduanero',
  '13': 'Gran contribuyente',
  '14': 'Informante de exogena',
  '15': 'Autorretenedor',
  '16': 'Obligación facturar por ingresos bienes',
  '17': 'Profesionales de compra y venta de divisas',
  '18': 'Precios de transferencia',
  '19': 'Productor de bienes y/o servicios exentos',
  '20': 'Obtención NIT',
  '21': 'Declarar ingreso o salida del país de divisas',
  '22': 'Obligado a cumplir deberes formales a',
  '23': 'Agente de retención en ventas',
  '24': 'Declaración consolidada precios de transf',
  '26': 'Declaración individual precios de tran',
  '32': 'Impuesto nacional a la gasolina y al ACPM',
  '33': 'Impuesto nacional al consumo',
  '36': 'Establecimiento permanente',
  '37': 'Obligado a facturar electrónicamente',
  '38': 'Facturación electrónica voluntaria',
  '39': 'Proveedor de servicios tecnológicos',
  '41': 'Declaración anual de activos en el exte',
  '42': 'Obligado a llevar contabilidad',
  '45': 'Autorretenedor de rendimientos financieros',
  '46': 'IVA prestadores de servicios desde el exterior',
  '47': 'Régimen Simple de Tributación',
  '48': 'Impuesto sobre las ventas - IVA',
  '49': 'No responsable de IVA',
  '50': 'No responsable de Consumo restaurantes',
  '51': 'Agente retención impoconsumo bienes inmuebles',
  '52': 'Facturador electrónico',
  '53': 'Persona jurídica no responsable de IVA',
  '55': 'Informante de Beneficiarios Finales',
};

const ENC_REGIMENES = ['NIT', 'NOMBRE', 'Ica Paipa', 'Paipa', '52 - Facturador electrónico',
  '05- Impto. renta y compl. régimen ordinar', '15- Autorretenedor', '47 - Régimen Simple de Tributación'];

const PENDIENTE = ['', 'NO ADJUNTO', 'ERROR DE LECTURA', 'NO DETECTADA'];

// ============================================================
//  MENÚ
// ============================================================
// Ejecuta ESTA función desde el editor (botón Ejecutar) la primera vez para dar permisos.
function autorizar() {
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
}

// ===== Funciones puente del menú (llaman a las funciones originales, que no se modificaron) =====
function menuAutorizar() {
  autorizar();
  SpreadsheetApp.getUi().alert('Permisos revisados. Recarga la hoja si algún menú no aparece.');
}

function menuRevisarSinCambios() {
  revisarSinCambios();
  mostrarRegistro_('Revisión de carpetas duplicadas (sin cambios)');
}

function menuLimpiarDuplicados() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.alert('Limpiar carpetas duplicadas',
    'Esto MOVERÁ archivos y enviará a la papelera las carpetas repetidas (se pueden restaurar durante 30 días).\n' +
    'Debe ejecutarlo la cuenta propietaria de la carpeta. Se recomienda usar antes "Revisar duplicados".\n\n¿Deseas continuar?',
    ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  limpiarDuplicados();
  mostrarRegistro_('Limpieza de carpetas duplicadas');
}

function menuPruebaAlerta() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.alert('Prueba de alerta', 'Se enviará un correo de prueba de alerta. ¿Continuar?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  ejecutarPruebaDeAlerta();
  ui.alert('Prueba de alerta ejecutada. Revisa el correo.');
}

function mostrarRegistro_(titulo) {
  let log = Logger.getLog() || 'Sin mensajes.';
  if (log.length > 1500) log = log.slice(0, 1500) + '\n… (registro completo en Apps Script > Ejecuciones)';
  SpreadsheetApp.getUi().alert(titulo, log, SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuValidarSeleccion() {
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

function menuValidarPendientes() {
  const r = validarPendientes_();
  alerta_(`Procesadas: ${r.procesadas}\nVerificadas OK: ${r.ok}\nCon observaciones: ${r.conAlertas}\nErrores de lectura: ${r.errores}` +
    (r.quedan ? `\n\nQuedan ${r.quedan} pendientes (límite de tiempo). Ejecuta de nuevo.` : ''));
}

function menuRevalidarTodo() {
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
function menuSincronizarRegimenes() {
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

function menuDiagnostico() {
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
function activarAutomatico() {
  desactivarAutomatico(true);
  const ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger('alEnviarFormulario').forSpreadsheet(ss).onFormSubmit().create();
  ScriptApp.newTrigger('validarPendientesAutomatico').timeBased().everyMinutes(CFG.MINUTOS_AUTOMATICO).create();
  alerta_(`Validación automática activada:\n• Cada respuesta nueva del formulario se valida al llegar.\n• Cada ${CFG.MINUTOS_AUTOMATICO} minutos se revisan las filas pendientes.`);
}

function desactivarAutomatico(silencioso) {
  ScriptApp.getProjectTriggers()
    .filter(t => ['alEnviarFormulario', 'validarPendientesAutomatico'].includes(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));
  if (silencioso !== true) alerta_('Validación automática desactivada.');
}

function alEnviarFormulario(e) {
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

function validarPendientesAutomatico() {
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

function procesarFila_(ctx, fila, R) {
  const { sh, c } = ctx;
  if (fila < 2 || fila > sh.getLastRow()) return null;
  const v = sh.getRange(fila, 1, 1, sh.getLastColumn()).getValues()[0];
  const nit = v[c.nit], nombre = String(v[c.nombre] || '').trim();
  if (!nit && !nombre) return null;

  const escribir = (fecha, verif, correo, resp, obs) => {
    sh.getRange(fila, c.fecha + 1).setValue(fecha);
    sh.getRange(fila, c.verif + 1).setValue(verif);
    if (correo !== null) sh.getRange(fila, c.correo + 1).setValue(correo);
    if (resp !== null) sh.getRange(fila, c.resp + 1).setValue(resp);
    sh.getRange(fila, c.obs + 1).setValue(obs).setWrap(true)
      .setBackground(verif ? '#d9ead3' : (obs.includes('❌') ? '#f4cccc' : '#fff2cc'));
  };

  const idRut = idDeUrl_(v[c.rut]);
  if (!idRut) {
    escribir('No adjunto', false, null, null, '❌ Falta el enlace del RUT');
    return { nombre, estado: 'ERROR', resumen: 'sin RUT' };
  }

  let texto;
  try {
    texto = textoDeArchivo_(idRut);
  } catch (e) {
    escribir('Error de lectura', false, null, null, '❌ No se pudo leer el RUT: ' + e.message);
    return { nombre, estado: 'ERROR', resumen: 'error de lectura' };
  }
  if (!texto || texto.replace(/\s/g, '').length < 80) {
    escribir('Error de lectura', false, null, null, '❌ El archivo del RUT no tiene texto legible (imagen borrosa o archivo vacío). Pedir el PDF original de la DIAN.');
    return { nombre, estado: 'ERROR', resumen: 'sin texto' };
  }

  const a = analizarRut_(texto);
  const alertas = [];
  if (!/TRIBUTARIO|DIAN/i.test(texto)) alertas.push('❌ El archivo adjunto no parece un RUT de la DIAN');

  // NIT
  const base = nitBase_(nit);
  if (!base) alertas.push('❌ La fila no tiene NIT');
  else if (!a.sinEspacios.includes(base)) alertas.push(`❌ El NIT de la hoja (${nit}) no aparece en el RUT`);
  else {
    if (/^[89]\d{9}$/.test(String(nit).replace(/\D/g, ''))) alertas.push('ℹ️ El NIT en la hoja tiene el DV pegado; se sugiere escribirlo como 900000000-0');
    const dvRut = a.sinEspacios.charAt(a.sinEspacios.indexOf(base) + base.length);
    const dvHoja = String(nit).includes('-') ? String(nit).split('-')[1].trim() : '';
    if (dvHoja && /\d/.test(dvRut) && dvHoja !== dvRut && dvHoja !== dv_(base)) alertas.push(`❌ El DV de la hoja (${dvHoja}) no coincide con el del RUT (${dv_(base)})`);
  }

  // Fecha / vigencia
  if (!a.fecha) alertas.push('⚠ No se detectó la fecha de generación del RUT');
  else {
    const d = fechaDe_(a.fecha);
    if (d) {
      const meses = (new Date() - d) / (1000 * 60 * 60 * 24 * 30.44);
      if (meses > CFG.MESES_VIGENCIA_RUT) {
        alertas.push(`${CFG.RUT_VENCIDO_ES_ERROR ? '❌' : '⚠'} RUT desactualizado: generado hace ${Math.floor(meses)} meses. Pedir RUT reciente`);
      }
    }
  }

  // Régimen vs responsabilidades
  alertas.push(...revisarRegimen_(v[c.regimen], a.codigos, base));

  // Nombre
  if (nombre && !coincideNombre_(nombre, texto)) alertas.push(`⚠ El nombre "${nombre}" no coincide con el RUT (puede ser nombre comercial)`);

  // Correo
  if (!a.correo) alertas.push('⚠ No se detectó correo en el RUT');

  // Certificación bancaria
  if (CFG.VALIDAR_CERTIFICACION && c.cert >= 0) {
    const idCert = idDeUrl_(v[c.cert]);
    if (!idCert) alertas.push('⚠ Falta la certificación bancaria');
    else {
      try {
        const tc = textoDeArchivo_(idCert);
        if (base && !tc.replace(/[\s.,]/g, '').includes(base)) alertas.push('❌ La certificación bancaria no muestra el mismo NIT/CC');
      } catch (e) {
        alertas.push('⚠ No se pudo leer la certificación bancaria');
      }
    }
  }

  const correoActual = String(v[c.correo] || '').trim();
  const correo = a.correo || (correoActual && correoActual !== 'No detectado' ? correoActual : 'No detectado');
  const resp = a.codigos.map(k => `${k} - ${RESP[k]}`).join('\n') || 'No detectadas';
  const verif = !alertas.some(x => x.startsWith('❌'));
  escribir(a.fecha || 'No detectada', verif, correo, resp, alertas.join('\n') || '✔ OK');

  if (a.codigos.length && R) {
    regimenUpsert_(R, { nit, nombre, ciudad: v[c.ciudad], codigos: a.codigos });
  }
  return { nombre, estado: verif ? (alertas.length ? 'OBS' : 'OK') : 'ALERTA', resumen: verif ? 'verificado' + (alertas.length ? ' con notas' : '') : 'con alertas' };
}

function revisarRegimen_(regimen, cods, nitBase) {
  const G = norm_(regimen);
  const t = k => cods.includes(k);
  const al = [];
  if (!G) { al.push('⚠ Régimen tributario vacío en la hoja'); return al; }
  if (!cods.length) { al.push('⚠ No se detectaron responsabilidades en el RUT'); return al; }
  const noResp = G.includes('NO RESPONSABLE');
  if (t('49') && !noResp && G.includes('RESPONSABLE DE IVA')) al.push('❌ El RUT dice 49 - No responsable de IVA, pero la hoja dice Responsable de IVA');
  if (t('48') && noResp) al.push('❌ El RUT dice 48 - Responsable de IVA, pero la hoja dice No responsable');
  if (t('47') && !G.includes('SIMPLE')) al.push(`❌ El RUT es Régimen Simple (47), pero la hoja dice "${regimen}"`);
  if (!t('47') && G.includes('SIMPLE')) al.push('❌ La hoja dice Régimen Simple, pero el RUT no tiene la responsabilidad 47');
  if (G.includes('GRAN CONTRIBUYENTE') && !t('13')) al.push('❌ La hoja dice Gran Contribuyente, pero el RUT no tiene la responsabilidad 13');
  if (t('13') && !G.includes('GRAN')) al.push('ℹ️ El RUT es Gran Contribuyente (13)');
  if (G.includes('AUTO') && !t('15')) al.push('❌ La hoja dice Autorretenedor, pero el RUT no tiene la responsabilidad 15');
  if (t('15') && !G.includes('AUTO')) al.push('ℹ️ El RUT es Autorretenedor (15)');
  if (G.includes('PERSONA NATURAL') && /^[89]\d{8}$/.test(nitBase)) al.push('❌ La hoja dice Persona Natural, pero el NIT es de persona jurídica');
  return al;
}

// ============================================================
//  LECTURA DEL ARCHIVO (PDF / imagen / Google Doc)
// ============================================================
function textoDeArchivo_(id) {
  const file = DriveApp.getFileById(id);
  const mime = file.getMimeType();
  if (mime === MimeType.GOOGLE_DOCS) return DocumentApp.openById(id).getBody().getText();
  if (mime === MimeType.FOLDER || mime === 'application/vnd.google-apps.shortcut') throw new Error('El enlace no es un archivo');

  let blob = file.getBlob();
  const nombre = file.getName().toLowerCase();
  if (!/pdf|image\//.test(blob.getContentType())) {
    if (nombre.endsWith('.pdf')) blob = blob.setContentType('application/pdf');
    else if (/\.(jpe?g)$/.test(nombre)) blob = blob.setContentType('image/jpeg');
    else if (nombre.endsWith('.png')) blob = blob.setContentType('image/png');
    else throw new Error(`Tipo de archivo no soportado (${blob.getContentType()}). Debe ser PDF o imagen.`);
  }

  let docId = null, err3 = null;
  try { // Drive API v3 (versión por defecto hoy en Apps Script)
    docId = Drive.Files.create(
      { name: 'tmp_rut_' + id, mimeType: MimeType.GOOGLE_DOCS }, blob,
      { ocrLanguage: 'es', supportsAllDrives: true, fields: 'id' }).id;
  } catch (e) {
    err3 = e;
    try { // Drive API v2 (si el servicio está configurado en v2)
      docId = Drive.Files.insert({ title: 'tmp_rut_' + id, mimeType: MimeType.GOOGLE_DOCS }, blob,
        { ocr: true, ocrLanguage: 'es', convert: true }).id;
    } catch (e2) {
      throw new Error('No se pudo convertir el archivo: ' + (err3.message || e2.message));
    }
  }
  try {
    return DocumentApp.openById(docId).getBody().getText();
  } finally {
    try { DriveApp.getFileById(docId).setTrashed(true); } catch (e) { /* sin acción */ }
  }
}

// ============================================================
//  ANÁLISIS DEL TEXTO DEL RUT
// ============================================================
function analizarRut_(texto) {
  const t = String(texto || '').replace(/\r/g, '');
  const r = { fecha: '', correo: '', codigos: [], sinEspacios: t.replace(/\s+/g, '') };

  let m = t.match(/generaci[oó]n\s+documento\s+PDF\s*:?\s*(\d{2}-\d{2}-\d{4})\s*(\d{1,2}:\d{2}:\d{2}\s*[AP]M)?/i);
  if (m) r.fecha = m[1] + (m[2] ? ' ' + m[2].replace(/\s+/g, '').toUpperCase() : '');
  else {
    m = t.match(/(\d{4})-(\d{2})-(\d{2})\s*\/\s*\d{1,2}:\d{2}/);
    if (m) r.fecha = `${m[3]}-${m[2]}-${m[1]}`;
  }

  const correos = (t.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])
    .map(x => x.toLowerCase()).filter(x => !/dian\.gov/.test(x));
  r.correo = correos[0] || '';

  const re = /(^|[^\d])(\d{1,2})\s?-\s?([A-Za-zÁÉÍÓÚáéíóúÑñ][^\n]*?)(?=\s+\d{1,2}\s?-\s?[A-Za-zÁÉÍÓÚáéíóúÑñ]|\n|$)/g;
  const set = new Set();
  let x;
  while ((x = re.exec(t)) !== null) {
    const cod = ('0' + x[2]).slice(-2);
    if (RESP[cod] && primeraLetra_(x[3]) === primeraLetra_(RESP[cod])) set.add(cod);
  }
  r.codigos = [...set].sort();
  return r;
}

function coincideNombre_(nombre, texto) {
  const ignorar = ['SAS', 'S', 'A', 'SA', 'LTDA', 'DE', 'LA', 'EL', 'Y', 'DEL', 'LOS', 'LAS', 'E', 'O', 'BIC', 'ZOMAC', 'NOMBRE', 'COMERCIAL'];
  const tokens = norm_(nombre).split(' ').filter(w => w.length >= 3 && !ignorar.includes(w));
  if (!tokens.length) return true;
  const plano = norm_(texto).replace(/\s+/g, '');
  const hallados = tokens.filter(w => plano.includes(w)).length;
  return hallados / tokens.length >= 0.5;
}

// ============================================================
//  HOJA REGIMENES
// ============================================================
function abrirRegimenes_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CFG.HOJA_REGIMENES);
  if (!sh) {
    sh = ss.insertSheet(CFG.HOJA_REGIMENES);
    sh.getRange(1, 1, 1, ENC_REGIMENES.length).setValues([ENC_REGIMENES]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  const datos = sh.getDataRange().getValues();
  return { sh, enc: datos[0], filas: datos.slice(1), cambios: new Set(), nuevas: 0 };
}

function regimenUpsert_(R, p) {
  const iNit = R.enc.findIndex(h => norm_(h) === 'NIT');
  const iNom = R.enc.findIndex(h => norm_(h) === 'NOMBRE');
  if (iNit < 0) throw new Error(`La hoja "${CFG.HOJA_REGIMENES}" no tiene columna NIT`);
  const clave = nitBase_(p.nit);
  let i = R.filas.findIndex(f => nitBase_(f[iNit]) === clave);
  if (i < 0) {
    R.filas.push(R.enc.map(() => ''));
    i = R.filas.length - 1;
    R.nuevas++;
    R.filas[i][iNit] = p.nit;
  }
  const fila = R.filas[i];
  if (iNom >= 0 && !String(fila[iNom]).trim()) fila[iNom] = p.nombre;
  R.enc.forEach((h, j) => {
    if (norm_(h) === 'PAIPA') fila[j] = norm_(p.ciudad).includes('PAIPA');
    const m = String(h).trim().match(/^(\d{1,2})\s*-/);
    if (m) fila[j] = p.codigos.includes(('0' + m[1]).slice(-2));
  });
  R.cambios.add(i);
}

function guardarRegimenes_(R) {
  if (!R || !R.cambios.size) return;
  const ancho = R.enc.length;
  const colsBool = R.enc.map((h, j) => (norm_(h) === 'PAIPA' || /^\d{1,2}\s*-/.test(String(h).trim())) ? j + 1 : 0).filter(Boolean);
  R.cambios.forEach(i => {
    const filaHoja = i + 2;
    R.sh.getRange(filaHoja, 1, 1, ancho).setValues([R.filas[i]]);
    colsBool.forEach(col => {
      const celda = R.sh.getRange(filaHoja, col);
      if (!celda.getDataValidation()) celda.insertCheckboxes();
    });
  });
  R.cambios.clear();
}

// ============================================================
//  UTILIDADES
// ============================================================
function norm_(s) {
  return String(s == null ? '' : s).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function primeraLetra_(s) { return (norm_(s).replace(/[^A-Z]/g, '') || ' ').charAt(0); }
function idDeUrl_(url) {
  const m = String(url || '').match(/(?:\/d\/|id=)([-\w]{20,})/) || String(url || '').match(/[-\w]{25,}/);
  return m ? (m[1] || m[0]) : '';
}
function nitBase_(nit) {
  let d = String(nit == null ? '' : nit).split('-')[0].replace(/\D/g, '');
  if (/^[89]\d{9}$/.test(d)) d = d.slice(0, 9); // NIT de empresa con el DV pegado
  return d;
}
function dv_(nit) {
  const pesos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const s = String(nit).split('').reverse().reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
  const r = s % 11;
  return String(r > 1 ? 11 - r : r);
}
function fechaDe_(txt) {
  const m = String(txt).match(/(\d{2})-(\d{2})-(\d{4})/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
}
function alerta_(msg) {
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { console.log(msg); }
}