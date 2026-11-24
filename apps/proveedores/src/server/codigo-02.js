function ssvGuardarComercial_(datos) {
  var clave = ssvNit_(datos.nit);
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SSV_PROV);
  if (!h) return false;
  var fila = ssvFilaProv_(clave);
  if (!fila) {
    var colA = h.getRange(1, 1, h.getMaxRows(), 1).getValues();
    var ult = 1;
    for (var k = colA.length - 1; k >= 0; k--) {
      if (String(colA[k][0]).trim() !== '') { ult = k + 1; break; }
    }
    fila = ult + 1;
    if (fila > h.getMaxRows()) h.insertRowsAfter(h.getMaxRows(), 20);
    h.getRange(ult, 3, 1, 7).copyTo(h.getRange(fila, 3, 1, 7));
    h.getRange(ult, 14, 1, 4).copyTo(h.getRange(fila, 14, 1, 4));
    h.getRange(ult, 34, 1, 2).copyTo(h.getRange(fila, 34, 1, 2));
    h.getRange(fila, 1).setValue(clave);
    h.getRange(fila, 2).setValue(datos.nombre || '');
    h.getRange(fila, 10, 1, 4).clearContent();
    if (datos.telefono) h.getRange(fila, 10).setValue(String(datos.telefono).replace(/[^0-9]/g, ''));
  }
  var pct = ssvNum_(datos.descuento);
  h.getRange(fila, 18, 1, 14).setValues([[
    datos.credito || '',
    ssvNum_(datos.cupo),
    ssvNum_(datos.plazo),
    datos.prontoPago || '',
    pct === '' ? '' : pct / 100,
    ssvNum_(datos.diasDescuento),
    datos.asesor || '',
    datos.asesorCel || '',
    datos.asesorMail || '',
    datos.correoCredito || '',
    datos.docsCredito || '',
    datos.correoEstados || '',
    datos.correoPagos || '',
    datos.observaciones || ''
  ]]);
  h.getRange(fila, 33).setValue(new Date());
  return true;
}

function ssvActualizarDocs_(datos, fRut, fCert) {
  var clave = ssvNit_(datos.nit);
  var fila = ssvFilaReg_(clave);
  if (!fila) return '';
  var hr = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SSV_REG);
  var raiz = Aislamiento_.carpeta(SSV_RAIZ);
  var nom = clave + ' - ' + (datos.nombre || '');
  var it = raiz.getFoldersByName(nom);
  var carpeta = it.hasNext() ? it.next() : raiz.createFolder(nom);
  var msj = [];
  if (datos.contacto) hr.getRange(fila, 4).setValue(datos.contacto);
  if (datos.telefono) hr.getRange(fila, 5).setValue(datos.telefono);
  if (datos.ciudad)   hr.getRange(fila, 6).setValue(datos.ciudad);
  if (datos.regimen)  hr.getRange(fila, 7).setValue(datos.regimen);
  if (fRut) {
    var u = guardarArchivoEnDrive_(fRut, carpeta, 'RUT_' + new Date().getFullYear() + '_' + clave);
    hr.getRange(fila, 8).setValue(u);
    hr.getRange(fila, 10).setValue('');
    msj.push('RUT actualizado en la carpeta.');
  }
  if (fCert) {
    var u2 = guardarArchivoEnDrive_(fCert, carpeta, 'Certificacion_Bancaria_' + clave);
    hr.getRange(fila, 9).setValue(u2);
    msj.push('Certificacion bancaria actualizada.');
  }
  return msj.join(' ');
}

function registrarProveedorCompleto_(datos, fRut, fCert) {
  try {
    if (!datos || !datos.nit || !datos.nombre) {
      return { exito: false, mensaje: 'Faltan el NIT o la razon social.' };
    }
    var est = consultarNit_(datos.nit);
    var msj = [];
    if (!est.registrado) {
      var r = procesarProveedor_(datos, fRut, fCert);
      if (!r || !r.exito) return r || { exito: false, mensaje: 'No fue posible crear el registro.' };
      msj.push('Registro creado.');
    } else {
      var t = ssvActualizarDocs_(datos, fRut, fCert);
      if (t) msj.push(t);
    }
    ssvGuardarComercial_(datos);
    msj.push('Informacion comercial guardada.');
    return { exito: true, mensaje: 'Listo. ' + msj.join(' ') + ' Gracias por actualizar sus datos con Social Solar.' };
  } catch (e) {
    return { exito: false, mensaje: 'Error: ' + e.toString() };
  }
}

/** =========================================================
 *  CERTIFICADOS BANCARIOS CON CONTRASENA
 *  La hoja no puede abrir un PDF protegido, pero si puede
 *  detectar cuales estan con clave y anotar la clave probable.
 *  ========================================================= */

function ssvColClave_(h) {
  var ancho = Math.max(h.getLastColumn(), 14);
  var cab = h.getRange(1, 1, 1, ancho).getValues()[0];
  for (var i = 0; i < cab.length; i++) {
    if (String(cab[i]).toUpperCase().indexOf('CLAVE PDF') > -1) return i + 1;
  }
  var col = ancho + 1;
  h.getRange(1, col).setValue('CLAVE PDF').setFontWeight('bold');
  h.setColumnWidth(col, 120);
  return col;
}

function ssvIlegible_(obs) {
  var t = String(obs || '').toLowerCase();
  return t.indexOf('no se pudo leer la certific') > -1 ||
         t.indexOf('no se pudo leer el rut') > -1 ||
         t.indexOf('no se pudo convertir el archivo') > -1;
}

function ssvFilasConClave_() {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SSV_REG);
  var ult = h.getLastRow();
  if (ult < 2) return { hoja: h, col: 0, filas: [] };
  var col = ssvColClave_(h);
  var d = h.getRange(2, 1, ult - 1, Math.max(col, 14)).getValues();
  var out = [];
  for (var i = 0; i < d.length; i++) {
    if (!ssvIlegible_(d[i][13])) continue;
    out.push({
      fila: i + 2,
      nit: String(d[i][1] || ''),
      nombre: String(d[i][2] || ''),
      clave: String(d[i][col - 1] || '').trim(),
      rut: String(d[i][7] || ''),
      cert: String(d[i][8] || ''),
      obs: String(d[i][13] || '')
    });
  }
  return { hoja: h, col: col, filas: out };
}

function menuClavesCertificados() { Guardas_.persona();
  var ui = SpreadsheetApp.getUi();
  var r = ssvFilasConClave_();
  if (!r.col) { ui.alert('No hay proveedores en la hoja.'); return; }
  var nuevos = 0, yaTenian = 0;
  for (var i = 0; i < r.filas.length; i++) {
    var f = r.filas[i];
    if (f.clave) { yaTenian++; continue; }
    var clave = ssvNit_(f.nit);
    if (!clave) continue;
    r.hoja.getRange(f.fila, r.col).setValue(clave);
    nuevos++;
  }
  ui.alert('Certificados y RUT con contrasena',
    'Documentos que no se pudieron leer: ' + r.filas.length + '\n' +
    'Claves anotadas ahora: ' + nuevos + '\n' +
    'Ya tenian clave escrita: ' + yaTenian + '\n\n' +
    'La clave que anote es el NIT o la cedula, que es la que usan casi todos los bancos. ' +
    'Si alguno tiene otra distinta, escribela a mano en la columna CLAVE PDF.\n\n' +
    'IMPORTANTE: la hoja no puede abrir un PDF protegido por si sola. Con esta lista ' +
    'lista, el archivo se destraba en un paso aparte y se reemplaza por la version sin clave.',
    ui.ButtonSet.OK);
}

function menuVerClavesPendientes() { Guardas_.persona();
  var ui = SpreadsheetApp.getUi();
  var r = ssvFilasConClave_();
  if (!r.filas.length) {
    ui.alert('No hay documentos pendientes de destrabar. Todos se leyeron bien.');
    return;
  }
  var html = '<style>body{font-family:Arial,sans-serif;font-size:13px;margin:0;padding:14px;color:#222}' +
    'h3{margin:0 0 4px;font-size:15px;color:#0F3B5C}' +
    'p.sub{margin:0 0 14px;color:#666;font-size:12px;line-height:1.5}' +
    'table{border-collapse:collapse;width:100%}' +
    'th{background:#0F3B5C;color:#fff;text-align:left;padding:7px 9px;font-size:11.5px}' +
    'td{border-bottom:1px solid #e3e7ea;padding:7px 9px;vertical-align:top}' +
    'td.k{font-weight:700;color:#2E6B2E}a{color:#1a73e8}' +
    '</style>';
  html += '<h3>Documentos con contrasena: ' + r.filas.length + '</h3>';
  html += '<p class="sub">Esta es la lista lista para destrabar. La columna <b>CLAVE PDF</b> de la hoja 01 REGISTRO Y DOCUMENTOS ' +
          'tiene la misma informacion, por si prefiere copiarla desde alli.</p>';
  html += '<table><tr><th>Fila</th><th>Proveedor</th><th>NIT / CC</th><th>Clave</th><th>Archivo</th><th>Problema</th></tr>';
  for (var i = 0; i < r.filas.length; i++) {
    var f = r.filas[i];
    var esRut = f.obs.toLowerCase().indexOf('certific') === -1;
    var url = esRut ? f.rut : f.cert;
    html += '<tr><td>' + f.fila + '</td><td>' + f.nombre + '</td><td>' + f.nit + '</td>' +
            '<td class="k">' + (f.clave || ssvNit_(f.nit)) + '</td>' +
            '<td>' + (url ? '<a href="' + url + '" target="_blank">' + (esRut ? 'RUT' : 'Certificacion') + '</a>' : '-') + '</td>' +
            '<td>' + (esRut ? 'No se pudo leer el RUT' : 'No se pudo leer la certificacion') + '</td></tr>';
  }
  html += '</table>';
  ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(820).setHeight(520),
                     'Certificados y RUT con contrasena');
}

