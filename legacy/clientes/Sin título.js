/**
 * CLIENTES DESDE EL RUT
 * ------------------------------------------------------------
 * Para clientes que solo mandan el RUT en PDF.
 * El script lee el PDF con la API de Drive y crea solo:
 *   - la fila en "Base de datos clientes" (NIT, nombre, celular, ciudad,
 *     dirección, contacto y correo, link del RUT, FECHA y VERIF)
 *   - la carpeta "NIT - NOMBRE" con el PDF adentro
 *
 * Dos formas de que entren los RUT:
 *   A) Los arrastras a la carpeta "RUTs por procesar" en Drive.
 *   B) (Opcional) Los toma de tu Gmail: correos con un PDF adjunto
 *      que sea un RUT. Al procesarlos les pone la etiqueta "RUT procesado".
 *
 * Si el NIT ya existe en la hoja, NO duplica la fila: actualiza el
 * link del RUT, FECHA, VERIF y la carpeta, y solo llena celdas vacías
 * (no pisa contactos que tú ya hayas corregido).
 *
 * INSTALACIÓN (una sola vez)
 *   1. Abre la hoja → Extensiones → Apps Script → pega este archivo.
 *   2. Servicios (+) → agrega "Drive API".
 *   3. Si quieres que lea el correo, pon LEER_GMAIL: true.
 *   4. Guarda y recarga la hoja. La carpeta ya viene configurada
 *      (CARPETA_RAIZ_ID). Para cambiarla: RUTs → "Configurar carpeta".
 *   5. RUTs → "Activar revisión automática (cada 15 min)".
 *   6. Para las filas que ya tienes: RUTs → "Completar filas existentes".
 */

const CONFIG = {
  SPREADSHEET_ID: '1sKxg3d36GtVrN5PxQ9g1Io9WRswjgXT0DbTLoMeQ4NE',
  HOJA: 'Base de datos clientes',
  // Carpeta raíz de RUTs. Se puede cambiar desde el menú RUTs → "Configurar carpeta".
  CARPETA_RAIZ_ID: '1tKfHOlihEtvnJ1vttYWePLMPARUSSYqP',
  NOMBRE_BANDEJA: 'RUTs por procesar',      // se crea sola dentro de la raíz
  NOMBRE_NO_RECONOCIDOS: '_No reconocidos', // PDFs que no son RUT
  ANIO_RUT: 2026,                           // VERIF = TRUE si el RUT es de este año o posterior

  LEER_GMAIL: false,
  GMAIL_BUSQUEDA: 'has:attachment filename:pdf newer_than:30d -label:"RUT procesado"',
  GMAIL_ETIQUETA: 'RUT procesado',

  COL: {                                    // 1 = A
    FECHA: 1, NIT: 2, NOMBRE: 3, CELULAR: 4, CIUDAD: 5, DIRECCION: 6,
    CONTACTO_FACT: 7, CORREO_FACT: 8, CONTACTO_TES: 9, CORREO_TES: 10,
    RUT: 11, FECHA_RUT: 12, VERIF: 13, CORREO: 14, CARPETA: 15
  }
};

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
}

/** Pide el link o ID de la carpeta raíz y lo guarda en las propiedades del script. */
function configurarCarpeta() {
  const ui = SpreadsheetApp.getUi();
  const actual = PropertiesService.getScriptProperties().getProperty('CARPETA_RAIZ_ID') || CONFIG.CARPETA_RAIZ_ID;
  let nombreActual = '';
  if (actual) {
    try { nombreActual = DriveApp.getFolderById(actual).getName(); } catch (e) {}
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
  try { carpeta = DriveApp.getFolderById(m[1]); }
  catch (e) { ui.alert('No pude abrir esa carpeta. Revisa que sea tuya o que tengas permiso de edición.'); return; }

  PropertiesService.getScriptProperties().setProperty('CARPETA_RAIZ_ID', m[1]);
  bandeja_(); // crea "RUTs por procesar"
  ui.alert(`Listo. Carpeta configurada: "${carpeta.getName()}".\n\n` +
    `Suelta los RUT en la subcarpeta "${CONFIG.NOMBRE_BANDEJA}".`);
}

function activarAutomatico() {
  raiz_(); // valida que la carpeta esté configurada
  desactivarAutomatico();
  ScriptApp.newTrigger('procesarTodo').timeBased().everyMinutes(15).create();
  bandeja_(); // crea la carpeta si no existe
  avisar_('Listo. Cada 15 minutos se procesan los RUT de la carpeta "' +
    CONFIG.NOMBRE_BANDEJA + '"' + (CONFIG.LEER_GMAIL ? ' y los del correo.' : '.'));
}

function desactivarAutomatico() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'procesarTodo')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

/* ======================== PROCESO PRINCIPAL ==================== */

function procesarTodo() {
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
function completarFilasExistentes() {
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
function releerFilaSeleccionada() {
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

/**
 * Muestra lo que se lee del RUT de la fila seleccionada y guarda el texto
 * completo que entrega Google en la pestaña "Diagnóstico RUT".
 */
function diagnosticarFila() {
  const ui = SpreadsheetApp.getUi();
  try {
    const hoja = getHoja_();
    const n = filaSeleccionada_();
    const archivo = DriveApp.getFileById(extraerIdDrive_(hoja.getRange(n, CONFIG.COL.RUT).getValue()));
    const texto = textoDePdf_(archivo.getBlob());
    const d = parsearRut_(texto);

    const ss = hoja.getParent();
    const diag = ss.getSheetByName('Diagnóstico RUT') || ss.insertSheet('Diagnóstico RUT');
    diag.clear();
    const lineas = texto.split('\n').filter(l => l.trim()).slice(0, 400).map((l, i) => [i + 1, l]);
    diag.getRange(1, 1, 1, 2).setValues([['Fila ' + n, archivo.getName()]]);
    diag.getRange(2, 1, lineas.length, 2).setValues(lineas);

    ui.alert('Lo que se lee del RUT (fila ' + n + ')',
      JSON.stringify(d, null, 2) + '\n\nEl texto completo quedó en la pestaña "Diagnóstico RUT".',
      ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('No se pudo leer: ' + e.message);
  }
}

/* ======================= LECTURA DEL RUT ====================== */

/** PDF → Google Docs (API de Drive) → texto. El documento temporal se borra. */
function textoDePdf_(blob) {
  const temp = Drive.Files.create(
    { name: 'tmp_lectura_rut', mimeType: MimeType.GOOGLE_DOCS },
    blob,
    { ocrLanguage: 'es', fields: 'id' }
  );
  try {
    return DocumentApp.openById(temp.id).getBody().getText();
  } finally {
    DriveApp.getFileById(temp.id).setTrashed(true);
  }
}

/**
 * Interpreta el texto del formulario 001 de la DIAN.
 * Al convertir el PDF, Drive deja primero los VALORES de la hoja 1, en orden:
 *   nº formulario / NIT+DV + seccional / tipo de contribuyente /
 *   (natural: lugar de expedición) / nombre o razón social / nombre comercial /
 *   PAÍS cód DEPARTAMENTO cód CIUDAD cód / dirección / correo /
 *   código postal + teléfonos
 * y después vienen las etiquetas (4. Número de formulario, 5. NIT, ...).
 */
function parsearRut_(textoCrudo) {
  const texto = String(textoCrudo || '').replace(/\\\./g, '.').replace(/\r/g, '');
  const r = {
    nit: '', dv: '', tipo: '', nombre: '', nombreComercial: '', representante: '',
    pais: '', departamento: '', ciudad: '', direccion: '', correo: '',
    telefono: '', telefono2: '', celular: '', codigoPostal: '',
    fechaGeneracion: '', anioGeneracion: null, esRut: false
  };
  r.esRut = /Registro\s+[ÚU]nico\s+Tributario|N[úu]mero\s+de\s+Identificaci[óo]n\s+Tributaria/i.test(texto);

  // Fecha generación documento PDF: 05-01-2026 04:10:18PM
  const mf = texto.match(/Fecha\s+generaci[óo]n\s+documento\s+PDF\s*:?\s*(\d{2})-(\d{2})-(\d{4})\s*(\d{1,2}:\d{2}:\d{2}\s*[AP]M)?/i);
  if (mf) {
    r.fechaGeneracion = `${mf[1]}-${mf[2]}-${mf[3]} ${(mf[4] || '').replace(/\s/g, '')}`.trim();
    r.anioGeneracion = Number(mf[3]);
  }

  // Solo la hoja 1 del RUT (la hoja 2 trae "Características y formas de las organizaciones", etc.)
  let todas = texto.split('\n').map(s => s.trim()).filter(Boolean);
  const finHoja1 = todas.findIndex((l, i) => i > 10 &&
    /^(Hoja\s*[2-9]\b|Caracter[íi]sticas\s+y\s+formas|Representaci[óo]n$|Revisor\s+Fiscal)/i.test(l));
  if (finHoja1 > 0) todas = todas.slice(0, finHoja1);

  // Firma autorizada → la línea siguiente es el representante (o la persona natural)
  const iFirma = todas.findIndex(l => /Firma\s+autorizada\s*:?\s*$/i.test(l));
  if (iFirma >= 0 && todas[iFirma + 1] && !/^\d/.test(todas[iFirma + 1])) {
    r.representante = todas[iFirma + 1].replace(/\s+/g, ' ').trim();
  }

  // Bloque de valores = líneas antes de la primera etiqueta
  const fin = todas.findIndex(l => /^(50\.|19 20 21|1 2 3 4 5 6 7 8 9 10|4\. N[úu]mero de formulario|5\. N[úu]mero de Identificaci)/i.test(l));
  const L = fin > 0 ? todas.slice(0, fin) : todas;

  // NIT + DV: dígitos en casillas (separados por espacio) antes de la seccional
  for (const l of L) {
    const m = l.match(/^((?:\d\s){6,}\d)\s+[^\d\s]/);
    if (m) {
      const d = m[1].replace(/\s/g, '');
      r.nit = d.slice(0, -1);
      r.dv = d.slice(-1);
      break;
    }
  }

  const iTipo = L.findIndex(l => /^Persona\s+(jur[íi]dica|natural)/i.test(l));
  r.tipo = /Persona\s+natural/i.test(texto) ? 'NATURAL' : 'JURIDICA';

  // Ubicación: "COLOMBIA 1 6 9 Boyacá 1 5 Duitama 2 3 8" (la última es la de UBICACIÓN)
  const reUbic = /^([^\d\s].*?)\s+\d\s\d\s\d\s+([^\d\s].*?)\s+\d\s\d\s+([^\d\s].*?)\s+\d\s\d\s\d$/;
  const idxUbic = [];
  L.forEach((l, i) => { if (reUbic.test(l)) idxUbic.push(i); });
  const iU = idxUbic.length ? idxUbic[idxUbic.length - 1] : -1;
  if (iU >= 0) {
    const m = L[iU].match(reUbic);
    r.pais = m[1].trim();
    r.departamento = m[2].trim();
    r.ciudad = m[3].trim();
  }

  // Nombre / razón social (y nombre comercial) entre el tipo y la ubicación
  if (iTipo >= 0 && iU > iTipo) {
    const nombres = L.slice(iTipo + 1, iU).filter(l => !reUbic.test(l));
    r.nombre = (nombres[0] || '').replace(/\s+/g, ' ').trim();
    r.nombreComercial = (nombres[1] || '').trim();
  }

  // Después de la ubicación: dirección, correo y la línea de números
  if (iU >= 0) {
    const resto = [];
    let lineaNumeros = '';
    for (let i = iU + 1; i < L.length; i++) {
      if (/^[\d\s]+$/.test(L[i]) && L[i].replace(/\s/g, '').length >= 7) { lineaNumeros = L[i]; break; }
      resto.push(L[i]);
    }
    const unido = resto.join(' ');
    const mc = unido.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    if (mc) r.correo = mc[0].toLowerCase();
    r.direccion = (mc ? unido.replace(mc[0], '') : unido).replace(/\s+/g, ' ').trim();

    // [código postal (6)][teléfono 1 (10)][teléfono 2 (10)]
    let d = lineaNumeros.replace(/\s/g, '');
    if (d.length % 10 === 6) { r.codigoPostal = d.slice(0, 6); d = d.slice(6); }
    if (d.length >= 20) { r.telefono = d.slice(0, 10); r.telefono2 = d.slice(10, 20); }
    else r.telefono = d;
    r.celular = [r.telefono, r.telefono2].find(t => /^3\d{9}$/.test(t)) || r.telefono;
  }

  // Si el PDF fue reimpreso o guardado desde el navegador, el orden cambia:
  // se completan los datos que falten buscando por etiquetas y patrones.
  // Descartar valores que en realidad son etiquetas del formulario
  ['nombre', 'nombreComercial', 'ciudad', 'departamento', 'direccion'].forEach(k => {
    if (r[k] && !esValorValido_(r[k])) r[k] = '';
  });
  if (r.representante && !esValorValido_(r.representante)) r.representante = '';

  completarPorEtiquetas_(r, todas.join('\n'), todas);
  return r;
}

/** Palabras que son etiquetas del formulario de la DIAN, nunca datos del cliente. */
const ETIQUETAS_RUT_ = new RegExp('(' + [
  '^establecimientos?$', 'n[úu]mero\\s+establecimientos', 'caracter[íi]sticas y formas',
  'actividad (principal|secundaria|econ[óo]mica)', '^otras actividades', '^ocupaci[óo]n$',
  '^c[óo]digo$', 'n[úu]mero de (formulario|identificaci|folios)', 'fecha (inicio|generaci|de expedici)',
  'responsabilidades', 'calidades y atributos',
  'usuarios aduaneros', '^exportadores$', '^anexos', 'firma (autorizada|del solicitante)',
  '^cargo$', '^identificaci[óo]n$', '^ubicaci[óo]n$', '^clasificaci[óo]n$', '^\\d*\\.?\\s*departamento$',
  'ciudad/municipio', 'raz[óo]n social', 'nombre comercial', '^\\d*\\.?\\s*sigla$', 'primer apellido',
  'segundo apellido', 'primer nombre', 'otros nombres', 'tipo de contribuyente', 'tipo de documento',
  'lugar de expedici', 'direcci[óo]n seccional', 'buz[óo]n electr', '^concepto$', 'tel[ée]fono [12]',
  'correo electr', 'direcci[óo]n principal', 'c[óo]digo postal', 'actuaci[óo]n de oficio',
  '^importante', 'sin perjuicio', 'espacio reservado', 'uso exclusivo', '^persona natural',
  '^persona jur[íi]dica', 'impuestos y aduanas', 'sucesi[óo]n il[íi]quida',
  '^naturaleza$', 'formas asociativas', '^p[áa]gina'
].join('|') + ')', 'i');

function esValorValido_(v) {
  v = String(v || '').trim();
  return v.length >= 2 && !ETIQUETAS_RUT_.test(v) && !/^\d{1,3}\.\s/.test(v);
}

/** Dígito de verificación oficial DIAN (módulo 11). */
function dvDian_(nit) {
  const pesos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const d = String(nit).replace(/\D/g, '').split('').reverse();
  let suma = 0;
  d.forEach((x, i) => { suma += Number(x) * pesos[i]; });
  const res = suma % 11;
  return String(res > 1 ? 11 - res : res);
}

function completarPorEtiquetas_(r, texto, todas) {
  const esEtiqueta = l => /^\d{1,3}\.\s/.test(l) ||
    /^(IDENTIFICACI[ÓO]N|UBICACI[ÓO]N|CLASIFICACI[ÓO]N|Lugar de expedici|Actividad|Ocupaci|Responsabilidades|Usuarios aduaneros|Exportadores|Para uso exclusivo|Firma|IMPORTANTE|Sin perjuicio|Espacio reservado|Hoja \d|P[áa]gina)/i.test(l);
  const soloLetras = l => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ&.,'\- ]+$/.test(l) && !esEtiqueta(l) && esValorValido_(l);

  // Valor que sigue a una etiqueta (misma línea o líneas siguientes)
  const valorTras = (reEtiqueta, filtro) => {
    for (let i = 0; i < todas.length; i++) {
      const m = todas[i].match(reEtiqueta);
      if (!m) continue;
      const resto = todas[i].slice(m.index + m[0].length).replace(/\s\d{1,3}\.\s.*$/, '').trim();
      if (resto && (!filtro || filtro(resto))) return resto;
      for (let j = i + 1; j < Math.min(i + 4, todas.length); j++) {
        if (esEtiqueta(todas[j])) continue;
        if (!filtro || filtro(todas[j])) return todas[j];
      }
    }
    return '';
  };

  // NIT y DV: primera secuencia de dígitos en casillas, validada con el DV
  if (!r.nit || dvDian_(r.nit) !== r.dv) {
    for (const l of todas) {
      const m = l.match(/(?:^|\s)((?:\d ){6,}\d)(?=\s|$)/);
      if (!m) continue;
      const d = m[1].replace(/\s/g, '');
      if (dvDian_(d.slice(0, -1)) === d.slice(-1)) { r.nit = d.slice(0, -1); r.dv = d.slice(-1); }
      else { r.nit = d; r.dv = dvDian_(d); }
      break;
    }
  }

  // Correo: el primero que aparezca
  if (!r.correo) {
    const mc = texto.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    if (mc) r.correo = mc[0].toLowerCase();
  }

  // Teléfonos: secuencias de 10 dígitos en casillas (con o sin código postal delante)
  if (!r.telefono) {
    const tels = [];
    todas.forEach(l => {
      (l.match(/(?:\d ){6,}\d(?!\d)/g) || []).forEach(run => {
        let d = run.replace(/\s/g, '');
        if (d === r.nit + r.dv || d === r.nit) return;
        if (d.length % 10 === 6) d = d.slice(6);
        if (d.length % 10 !== 0) return;
        for (let k = 0; k < d.length; k += 10) {
          const t = d.slice(k, k + 10);
          if (/^(3|60)\d+$/.test(t)) tels.push(t);
        }
      });
    });
    r.telefono = tels[0] || '';
    r.telefono2 = tels[1] || '';
    r.celular = tels.find(t => /^3/.test(t)) || r.telefono;
  }

  // Departamento: "1 6 9 Boyacá" (se toma el último: el de UBICACIÓN)
  if (!r.departamento) {
    const deps = [];
    todas.forEach(l => {
      const m = l.match(/1\s6\s9\s+([A-Za-zÁÉÍÓÚÑáéíóúñ][^\d]*?)(?=\s+\d|\s*$)/);
      if (m) deps.push(m[1].trim());
    });
    if (deps.length) { r.departamento = deps[deps.length - 1]; r.pais = r.pais || 'COLOMBIA'; }
  }

  // Ciudad: "1 5 Toca" o "1 5 Toca 8 1 4" (la última es la de UBICACIÓN)
  if (!r.ciudad) {
    const ciudades = [];
    todas.forEach(l => {
      const m = l.match(/(?:^|\s)\d\s\d\s+([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ.,' ]*?)(?:\s+\d\s\d\s\d)?\s*$/);
      if (m && m[1].trim() !== r.departamento && esValorValido_(m[1])) ciudades.push(m[1].trim());
    });
    if (ciudades.length) r.ciudad = ciudades[ciudades.length - 1];
  }

  // Dirección
  if (!r.direccion) {
    r.direccion = valorTras(/41\.\s*Direcci[óo]n\s+principal/i,
      v => !/@/.test(v) && !/^(\d\s)+\d$/.test(v)).replace(/\s+/g, ' ').trim();
  }

  // Nombre
  if (!r.nombre) {
    if (r.tipo === 'NATURAL') {
      // Apellidos y nombres (31 a 34): líneas de solo letras después de "33. Primer nombre"
      const i = todas.findIndex(l => /33\.\s*Primer\s+nombre/i.test(l));
      const partes = [];
      if (i >= 0) {
        for (let j = i + 1; j < Math.min(i + 8, todas.length) && partes.length < 4; j++) {
          if (/34\.\s*Otros\s+nombres/i.test(todas[j])) continue;
          if (soloLetras(todas[j]) && esMayusculas_(todas[j])) partes.push(todas[j]);
          else if (partes.length) break;
        }
      }
      r.nombre = partes.join(' ').replace(/\s+/g, ' ').trim();

      // Último recurso: el primer bloque de líneas en MAYÚSCULAS que no sean
      // país, departamento, ciudad ni etiquetas (en el RUT los nombres van en mayúsculas)
      if (!r.nombre) {
        const excluir = new Set(['COLOMBIA', String(r.departamento).toUpperCase(), String(r.ciudad).toUpperCase()]);
        const bloque = [];
        for (const l of todas) {
          const ok = soloLetras(l) && esMayusculas_(l) && !excluir.has(l.toUpperCase());
          if (ok) { bloque.push(l); if (bloque.length === 4) break; }
          else if (bloque.length && !esEtiqueta(l)) break;
        }
        r.nombre = bloque.join(' ').replace(/\s+/g, ' ').trim();
      }
    } else {
      r.nombre = valorTras(/35\.\s*Raz[óo]n\s+social/i, soloLetrasONumeros_).replace(/\s+/g, ' ').trim();
    }
  }
  if (!r.nombreComercial) {
    const nc = valorTras(/36\.\s*Nombre\s+comercial(\s+37\.\s*Sigla)?/i, v => soloLetras(v));
    if (nc && nc !== r.nombre && !/^(UBICACI|COLOMBIA)/i.test(nc)) r.nombreComercial = nc;
  }
}

function soloLetrasONumeros_(v) {
  return /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(v) && !/^(UBICACI|COLOMBIA|36\.)/i.test(v) && esValorValido_(v);
}

function esMayusculas_(v) {
  return v === v.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(v);
}

/* ===================== CARPETAS Y ARCHIVOS ==================== */

function raiz_() {
  const id = PropertiesService.getScriptProperties().getProperty('CARPETA_RAIZ_ID') || CONFIG.CARPETA_RAIZ_ID;
  if (!id) throw new Error('Primero configura la carpeta en el menú RUTs → "⚙️ Configurar carpeta".');
  return DriveApp.getFolderById(id);
}

function subcarpeta_(nombre) {
  const it = raiz_().getFoldersByName(nombre);
  return it.hasNext() ? it.next() : raiz_().createFolder(nombre);
}

function bandeja_() { return subcarpeta_(CONFIG.NOMBRE_BANDEJA); }

function obtenerCarpetaCliente_(nit, nombre) {
  const it = raiz_().searchFolders(`title contains '${nit}' and trashed = false`);
  while (it.hasNext()) {
    const c = it.next();
    if (c.getName().indexOf(nit) === 0) return c; // ya existe
  }
  return raiz_().createFolder(`${nit} - ${limpiarNombreCarpeta_(nombre)}`);
}

function ubicarArchivo_(archivo, carpeta, nombre) {
  nombre = nombre.replace(/\s+/g, ' ');
  const p = archivo.getParents();
  while (p.hasNext()) {
    if (p.next().getId() === carpeta.getId()) { archivo.setName(nombre); return archivo; }
  }
  try { archivo.moveTo(carpeta); archivo.setName(nombre); return archivo; }
  catch (e) { return archivo.makeCopy(nombre, carpeta); } // si no eres dueño del archivo
}

/* =========================== UTILIDADES ======================= */

function getHoja_() {
  const hoja = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.HOJA);
  if (!hoja) throw new Error('No existe la hoja "' + CONFIG.HOJA + '"');
  return hoja;
}

function asegurarEncabezados_(hoja) {
  const c = hoja.getRange(1, CONFIG.COL.CARPETA);
  if (!c.getValue()) c.setValue('CARPETA');
}

// Compara el NIT sin DV: sirve para "9008911954", "900891195-4" o "900891195"
function buscarFilaPorNit_(hoja, nit) {
  const ult = hoja.getLastRow();
  if (ult < 2) return -1;
  const vals = hoja.getRange(2, CONFIG.COL.NIT, ult - 1, 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) {
    const s = String(vals[i][0]).trim();
    const d = s.replace(/\D/g, '');
    const base = s.indexOf('-') >= 0 ? s.split('-')[0].replace(/\D/g, '') : d;
    if (base === nit || d === nit || d.slice(0, -1) === nit) return i + 2;
  }
  return -1;
}

function extraerIdDrive_(url) {
  const s = String(url || '');
  const m = s.match(/\/d\/([\w-]{20,})/) || s.match(/[?&]id=([\w-]{20,})/);
  if (!m) throw new Error('Link de Drive inválido');
  return m[1];
}

function limpiarNombreCarpeta_(n) {
  return String(n || '').replace(/[\/\\:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

function avisar_(msg) {
  try { SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).toast(msg, 'RUTs', 8); } catch (e) {}
  console.log(msg);
}