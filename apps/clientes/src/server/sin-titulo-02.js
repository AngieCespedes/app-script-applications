/**
 * Muestra lo que se lee del RUT de la fila seleccionada y guarda el texto
 * completo que entrega Google en la pestaña "Diagnóstico RUT".
 */
function diagnosticarFila() { Guardas_.persona();
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

