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

