/* ============================ MENÚ ============================ */

function onOpen() {
  let ui;
  try { ui = SpreadsheetApp.getUi(); }
  catch (e) {
    console.log('El menú RUTs aparece al abrir la hoja (no al ejecutar onOpen desde el editor). ' +
      'Si no aparece, el código debe estar en Extensiones → Apps Script de la hoja.');
    return;
  }
  ui.createMenu('RUTs')
    .addItem('⚙️ Configurar carpeta', 'configurarCarpeta')
    .addSeparator()
    .addItem('Procesar RUTs ahora', 'procesarTodo')
    .addItem('Completar filas existentes desde su RUT', 'completarFilasExistentes')
    .addItem('Volver a leer el RUT de la fila seleccionada', 'releerFilaSeleccionada')
    .addItem('Ver lo que se lee del RUT (fila seleccionada)', 'diagnosticarFila')
    .addSeparator()
    .addItem('Activar revisión automática (cada 15 min)', 'activarAutomatico')
    .addItem('Desactivar revisión automática', 'desactivarAutomatico')
    .addToUi();

  Instalacion_.menu();
}

/** Pide el link o ID de la carpeta raíz y lo guarda en las propiedades del script. */
function configurarCarpeta() { Guardas_.persona();
  const ui = SpreadsheetApp.getUi();
  const actual = PropertiesService.getScriptProperties().getProperty('CARPETA_RAIZ_ID') || CONFIG.CARPETA_RAIZ_ID;
  let nombreActual = '';
  if (actual) {
    try { nombreActual = Aislamiento_.carpeta(actual).getName(); } catch (e) {}
  }
  const r = ui.prompt(
    'Carpeta de RUTs',
    (actual ? `Carpeta actual: ${nombreActual || actual}\n\n` : '') +
    'Pega el link de la carpeta de Drive (o solo su ID).\n' +
    'Ahí se crearán "RUTs por procesar" y las carpetas de cada cliente.',
    ui.ButtonSet.OK_CANCEL
  );
  if (r.getSelectedButton() !== ui.Button.OK) return;

  const texto = r.getResponseText().trim();
  const m = texto.match(/folders\/([\w-]{20,})/) || texto.match(/[?&]id=([\w-]{20,})/) || texto.match(/^([\w-]{20,})$/);
  if (!m) { ui.alert('No reconocí ese link o ID. Copia la URL de la carpeta desde el navegador.'); return; }

  let carpeta;
  try { carpeta = Aislamiento_.carpeta(m[1]); }
  catch (e) { ui.alert('No pude abrir esa carpeta. Revisa que sea tuya o que tengas permiso de edición.'); return; }

  PropertiesService.getScriptProperties().setProperty('CARPETA_RAIZ_ID', m[1]);
  bandeja_(); // crea "RUTs por procesar"
  ui.alert(`Listo. Carpeta configurada: "${carpeta.getName()}".\n\n` +
    `Suelta los RUT en la subcarpeta "${CONFIG.NOMBRE_BANDEJA}".`);
}

function activarAutomatico() { Guardas_.persona();
  raiz_(); // valida que la carpeta esté configurada
  desactivarAutomatico();
  ScriptApp.newTrigger('procesarTodo').timeBased().everyMinutes(15).create();
  bandeja_(); // crea la carpeta si no existe
  avisar_('Listo. Cada 15 minutos se procesan los RUT de la carpeta "' +
    CONFIG.NOMBRE_BANDEJA + '"' + (CONFIG.LEER_GMAIL ? ' y los del correo.' : '.'));
}

function desactivarAutomatico() { Guardas_.persona();
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'procesarTodo')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

/* ======================== PROCESO PRINCIPAL ==================== */

function procesarTodo() { Guardas_.personaOActivador(arguments[0]);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // ya hay una ejecución en curso
  const res = { nuevos: 0, actualizados: 0, noRut: 0 };
  const inicio = Date.now();
  try {
    if (CONFIG.LEER_GMAIL) traerDeGmail_(inicio);
    procesarBandeja_(res, inicio);
  } finally {
    lock.releaseLock();
  }
  if (res.nuevos + res.actualizados + res.noRut > 0) {
    avisar_(`Nuevos: ${res.nuevos} · Actualizados: ${res.actualizados} · No eran RUT: ${res.noRut}`);
  }
  return res;
}

function procesarBandeja_(res, inicio) {
  const hoja = getHoja_();
  asegurarEncabezados_(hoja);
  const it = bandeja_().getFilesByType(MimeType.PDF);
  while (it.hasNext()) {
    if (Date.now() - inicio > 5 * 60 * 1000) break; // límite de 6 min de Apps Script
    const archivo = it.next();
    try {
      const r = registrarRut_(hoja, archivo);
      r.nuevo ? res.nuevos++ : res.actualizados++;
    } catch (e) {
      archivo.moveTo(subcarpeta_(CONFIG.NOMBRE_NO_RECONOCIDOS));
      archivo.setDescription('No procesado: ' + e.message);
      res.noRut++;
    }
  }
}

/** Lee un PDF de RUT, crea/actualiza la fila y lo archiva en la carpeta del cliente. */
function registrarRut_(hoja, archivo, extra) {
  const sobrescribir = !!(extra && extra.sobrescribir);
  const rut = parsearRut_(textoDePdf_(archivo.getBlob()));
  if (!rut.esRut || !rut.nit) throw new Error('El PDF no parece un RUT de la DIAN');

  const carpeta = obtenerCarpetaCliente_(rut.nit, rut.nombre);
  ubicarArchivo_(archivo, carpeta,
    `RUT ${rut.anioGeneracion || ''} - ${rut.nit} - ${rut.nombre}.pdf`);

  const C = CONFIG.COL;
  const correo = rut.correo || (extra && extra.remitente) || '';
  const contacto = rut.tipo === 'NATURAL' ? rut.nombre : (rut.representante || rut.nombre);
  const verif = !!rut.anioGeneracion && rut.anioGeneracion >= CONFIG.ANIO_RUT;

  // Datos del cliente: solo se escriben si la celda está vacía
  const datos = {};
  datos[C.FECHA] = new Date();
  datos[C.NIT] = rut.nit; // sin dígito de verificación
  datos[C.NOMBRE] = rut.nombre;
  datos[C.CELULAR] = rut.celular;
  datos[C.CIUDAD] = rut.ciudad;
  datos[C.DIRECCION] = rut.direccion;
  datos[C.CONTACTO_FACT] = contacto;
  datos[C.CORREO_FACT] = correo;
  datos[C.CONTACTO_TES] = contacto;
  datos[C.CORREO_TES] = correo;

  // Datos del RUT: se actualizan siempre
  const siempre = {};
  siempre[C.RUT] = archivo.getUrl();
  siempre[C.FECHA_RUT] = rut.fechaGeneracion || 'Sin fecha';
  siempre[C.VERIF] = verif;
  siempre[C.CARPETA] = carpeta.getUrl();

  let n = buscarFilaPorNit_(hoja, rut.nit);
  const nuevo = n < 0;
  if (nuevo) {
    n = hoja.getLastRow() + 1;
    hoja.getRange(n, C.NIT).setNumberFormat('@'); // que el NIT no se vuelva número
    const fila = new Array(C.CARPETA).fill('');
    Object.keys(datos).forEach(k => fila[k - 1] = datos[k]);
    Object.keys(siempre).forEach(k => fila[k - 1] = siempre[k]);
    hoja.getRange(n, 1, 1, C.CARPETA).setValues([fila]);
  } else {
    const actual = hoja.getRange(n, 1, 1, C.CARPETA).getValues()[0];
    Object.keys(datos).forEach(k => {
      if (k == C.FECHA || !datos[k]) return;
      if (sobrescribir || String(actual[k - 1]).trim() === '') {
        if (k == C.NIT) hoja.getRange(n, C.NIT).setNumberFormat('@');
        hoja.getRange(n, Number(k)).setValue(datos[k]);
      }
    });
    Object.keys(siempre).forEach(k => hoja.getRange(n, Number(k)).setValue(siempre[k]));
  }
  return { nuevo: nuevo, fila: n, rut: rut };
}

/* ============================ GMAIL ============================ */

/** Copia a la bandeja los PDF adjuntos de correos recientes y etiqueta el hilo. */
function traerDeGmail_(inicio) {
  const etiqueta = GmailApp.getUserLabelByName(CONFIG.GMAIL_ETIQUETA) ||
                   GmailApp.createLabel(CONFIG.GMAIL_ETIQUETA);
  const hilos = GmailApp.search(CONFIG.GMAIL_BUSQUEDA, 0, 30);
  const bandeja = bandeja_();
  hilos.forEach(hilo => {
    if (Date.now() - inicio > 2 * 60 * 1000) return;
    let huboRut = false;
    hilo.getMessages().forEach(msg => {
      msg.getAttachments({ includeInlineImages: false }).forEach(adj => {
        const esPdf = adj.getContentType() === MimeType.PDF || /\.pdf$/i.test(adj.getName());
        if (!esPdf) return;
        // Solo se guardan los que de verdad son RUT
        const blob = adj.copyBlob().setContentType(MimeType.PDF);
        let rut;
        try { rut = parsearRut_(textoDePdf_(blob)); } catch (e) { return; }
        if (!rut.esRut || !rut.nit) return;
        const f = bandeja.createFile(blob);
        f.setDescription('Recibido de: ' + remitente_(msg.getFrom()));
        huboRut = true;
      });
    });
    if (huboRut) hilo.addLabel(etiqueta);
  });
}

function remitente_(from) {
  const m = String(from || '').match(/<([^>]+)>/);
  return (m ? m[1] : String(from || '')).trim().toLowerCase();
}

/* ================== FILAS QUE YA EXISTEN EN LA HOJA ================ */

/** Para filas con link de RUT y sin carpeta: lee el RUT, llena vacíos y crea carpeta. */
function completarFilasExistentes() { Guardas_.persona();
  const hoja = getHoja_();
  asegurarEncabezados_(hoja);
  const C = CONFIG.COL;
  const ult = hoja.getLastRow();
  const datos = hoja.getRange(2, 1, ult - 1, C.CARPETA).getValues();
  const inicio = Date.now();
  let ok = 0, err = 0;
  for (let i = 0; i < datos.length; i++) {
    if (Date.now() - inicio > 5 * 60 * 1000) break;
    const v = datos[i];
    if (!v[C.RUT - 1] || v[C.CARPETA - 1]) continue;
    const n = i + 2;
    try {
      const archivo = DriveApp.getFileById(extraerIdDrive_(v[C.RUT - 1]));
      const rut = parsearRut_(textoDePdf_(archivo.getBlob()));
      if (!rut.esRut || !rut.nit) throw new Error('No es un RUT');
      const rellenar = (col, valor) => {
        if (String(v[col - 1]).trim() === '' && valor) hoja.getRange(n, col).setValue(valor);
      };
      rellenar(C.NIT, rut.nit);
      rellenar(C.NOMBRE, rut.nombre);
      rellenar(C.CELULAR, rut.celular);
      rellenar(C.CIUDAD, rut.ciudad);
      rellenar(C.DIRECCION, rut.direccion);
      rellenar(C.CORREO_FACT, rut.correo);
      rellenar(C.CORREO_TES, rut.correo);
      hoja.getRange(n, C.FECHA_RUT).setValue(rut.fechaGeneracion || 'Sin fecha');
      hoja.getRange(n, C.VERIF).setValue(!!rut.anioGeneracion && rut.anioGeneracion >= CONFIG.ANIO_RUT);
      const carpeta = obtenerCarpetaCliente_(rut.nit, rut.nombre);
      ubicarArchivo_(archivo, carpeta, `RUT ${rut.anioGeneracion || ''} - ${rut.nit} - ${rut.nombre}.pdf`);
      hoja.getRange(n, C.CARPETA).setValue(carpeta.getUrl());
      hoja.getRange(n, C.FECHA_RUT).setNote('');
      ok++;
    } catch (e) {
      hoja.getRange(n, C.FECHA_RUT).setValue('Error técnico')
        .setNote('Motivo: ' + (e && e.message ? e.message : e)); // pasa el mouse por la celda para verlo
      hoja.getRange(n, C.VERIF).setValue(false);
      err++;
    }
  }
  avisar_(`Filas completadas: ${ok}. Con error: ${err} (el motivo queda como nota en la columna FECHA).`);
}

/** Fila seleccionada en la hoja (la que tiene el cursor). */
function filaSeleccionada_() {
  const hojaActiva = SpreadsheetApp.getActiveSheet();
  if (hojaActiva.getName() !== CONFIG.HOJA) throw new Error('Selecciona una fila en la hoja "' + CONFIG.HOJA + '".');
  const n = hojaActiva.getActiveRange().getRow();
  if (n < 2) throw new Error('Selecciona una fila de cliente (no el encabezado).');
  return n;
}

/** Vuelve a leer el RUT de la fila seleccionada y SOBRESCRIBE los datos del cliente. */
function releerFilaSeleccionada() { Guardas_.persona();
  const ui = SpreadsheetApp.getUi();
  try {
    const hoja = getHoja_();
    const n = filaSeleccionada_();
    const archivo = DriveApp.getFileById(extraerIdDrive_(hoja.getRange(n, CONFIG.COL.RUT).getValue()));
    const r = registrarRut_(hoja, archivo, { sobrescribir: true });
    ui.alert(`Fila ${r.fila} actualizada:\n\n${r.rut.nit} - ${r.rut.nombre}\n${r.rut.ciudad} · ${r.rut.direccion}\n${r.rut.celular} · ${r.rut.correo}`);
  } catch (e) {
    ui.alert('No se pudo leer: ' + e.message);
  }
}

