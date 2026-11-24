/**
 * SISTEMA DE REGISTRO DE PROVEEDORES - SOCIAL SOLAR (2026)
 * Desarrollado para Google Apps Script (Web App)
 * Coordinación Contable y Administrativa
 */

/**
 * 1. Renderizado de la interfaz web
 * Carga el archivo Formulario.html en el navegador del usuario.
 */
function doGet(e) {
  // Enrutador: con ?p=portal abre el portal interno de ordenes de compra;
  // sin parametro sigue siendo el formulario publico de proveedores.
  var p = (e && e.parameter && e.parameter.p) ? String(e.parameter.p) : '';
  if (p === 'portal') return ocDoGet(e);

  return HtmlService.createTemplateFromFile('Formulario')
    .evaluate()
    .setTitle('Registro de Proveedores - Social Solar')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 2. Procesamiento central del proveedor
 * Controla duplicados, crea carpetas en Drive, guarda PDFs e inserta datos en Sheets.
 */
function procesarProveedor(datos, archivoRut, archivoCert, archivoEstado) {
  try {
    // Validación de seguridad para campos obligatorios del frontend
    if (!datos || !datos.nit || !datos.nombre) {
      return { exito: false, mensaje: "⚠ El NIT y la Razón Social son campos obligatorios." };
    }

    var libro = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = libro.getSheets()[0];
    var ultimaFila = hoja.getLastRow();

    // --- CONTROL DE DUPLICADOS POR NIT ---
    if (ultimaFila > 1) {
      // Extrae la columna B (donde se almacenan los NITs)
      var nitsExistentes = hoja.getRange(2, 2, ultimaFila - 1, 1).getValues();
      var nitNuevoLimpio = datos.nit.toString().replace(/[\s-]/g, "");

      for (var i = 0; i < nitsExistentes.length; i++) {
        // Acceso correcto a la matriz bidimensional [i][0]
        var nitExistenteLimpio = nitsExistentes[i][0].toString().replace(/[\s-]/g, "");
        if (nitExistenteLimpio === nitNuevoLimpio) {
          return { exito: false, mensaje: "⚠ El NIT " + datos.nit + " ya se encuentra registrado en nuestra base de datos corporativa." };
        }
      }
    }

    // --- GESTIÓN DE REPOSITORIO EN GOOGLE DRIVE ---
    // Conexión con la carpeta raíz corporativa de Social Solar
    var carpetaPrincipal = DriveApp.getFolderById("1WKnC49pfy6rDqBzR0CQLf6paT7rNe9GZ");

    // Crear subcarpeta exclusiva para el nuevo proveedor
    var nombreCarpeta = datos.nit + " - " + datos.nombre;
    var subcarpeta = carpetaPrincipal.createFolder(nombreCarpeta);
    var urlCarpetaDrive = subcarpeta.getUrl();

    // Almacenar de manera independiente los 3 documentos PDF obligatorios
    var urlRut = guardarArchivoEnDrive(archivoRut, subcarpeta, "RUT_2026_" + datos.nit);
    var urlCert = guardarArchivoEnDrive(archivoCert, subcarpeta, "Certificacion_Bancaria_" + datos.nit);
    var urlEstado = guardarArchivoEnDrive(archivoEstado, subcarpeta, "Estado_Cuenta_" + datos.nit);

    // --- INSERCIÓN DE FILA EN GOOGLE SHEETS ---
    hoja.appendRow([
      new Date(), // Columna A: Marca temporal
      datos.nit, // Columna B: NIT
      datos.nombre, // Columna C: Razón Social
      datos.contacto || "No registra",// Columna D: Nombre de contacto
      datos.telefono || "No registra",// Columna E: Teléfono
      datos.ciudad || "No registra", // Columna F: Ciudad de operación
      datos.regimen || "No registra", // Columna G: Régimen tributario
      urlRut, // Columna H: Enlace al RUT
      urlCert, // Columna I: Enlace a Certificación
      urlEstado, // Columna J: Enlace a Estado de Cuenta
      false // Columna K: Estado de aprobación (Por defecto: Falso/No verificado)
    ]);

    // --- NOTIFICACIÓN AUTOMÁTICA POR EMAIL ---
    enviarAlertaCorreo(datos, urlCarpetaDrive, urlRut, urlCert, urlEstado);

    return { exito: true, mensaje: "✅ ¡Registro Exitoso! El proveedor se ha almacenado correctamente y se envió la notificación." };

  } catch (error) {
    console.error("Error en procesarProveedor: " + error.toString());
    return { exito: false, mensaje: "❌ Error interno en el sistema: " + error.toString() };
  }
}

/**
 * 3. Procesador binario de archivos binarios
 * Limpia el formato de transferencia Base64 y construye el archivo PDF legible.
 */
function guardarArchivoEnDrive(archivoObjeto, carpetaTarget, prefijoNombre) {
  if (!archivoObjeto || !archivoObjeto.base64 || archivoObjeto.base64.trim() === "") {
    return "No adjunto";
  }

  // Eliminar el prefijo data URI (ej: "data:application/pdf;base64,") si lo incluye el navegador
  var partes = archivoObjeto.base64.split(",");
  var base64Limpio = partes.length > 1 ? partes[1] : partes[0];

  // Decodificación e inyección a un objeto binario puro (Blob)
  var bytes = Utilities.base64Decode(base64Limpio);
  var tipoMime = archivoObjeto.tipo || "application/pdf";
  var blob = Utilities.newBlob(bytes, tipoMime, prefijoNombre + ".pdf");

  // Guardar archivo y habilitar permisos globales de lectura para el equipo contable
  var archivoCreado = carpetaTarget.createFile(blob);
  try {
    archivoCreado.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (eUsoCompartido) {
    // Google ya no permite cambiar el uso compartido por script en cuentas personales.
    // No importa: el archivo queda dentro de la carpeta corporativa de proveedores,
    // que ya tiene sus propios permisos para el equipo.
  }

  return archivoCreado.getUrl();
}

/**
 * 4. Alerta corporativa por correo electrónico
 * Diseña y despacha el correo formal con estilos inline compatibles con clientes de correo.
 */
function enviarAlertaCorreo(datos, urlCarpeta, urlRut, urlCert, urlEstado) {
  var correoDestinatario = "asistentecontablesocialsolar@gmail.com"; 
  var urlLogo = "https://socialsolar.com.co";

  var htmlBody = `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    <div style="background-color: #ffffff; padding: 25px 20px 15px 20px; text-align: center; border-bottom: 3px solid #fbb03b;">
      <img src="${urlLogo}" alt="Social Solar" style="max-height: 55px; width: auto;">
    </div>
    <div style="padding: 25px; background-color: #ffffff;">
      <h2 style="color: #1a1a1a; margin-top: 0; font-size: 20px; border-bottom: 2px solid #f4f6f9; padding-bottom: 10px;">⚡ Alerta: Nuevo Registro de Proveedor</h2>
      <p style="color: #555; font-size: 15px; line-height: 1.5;">Se han recibido los datos y soportes de un nuevo aliado comercial a través del portal web:</p>
      
      <table style="width: 100%; margin-top: 15px; border-collapse: collapse; font-size: 14px;">
        <tr style="background-color: #f9f9f9;"><td style="padding: 10px; font-weight: bold; color: #1a1a1a; width: 35%;">NIT:</td><td style="padding: 10px; color: #444;">${datos.nit}</td></tr>
        <tr><td style="padding: 10px; font-weight: bold; color: #1a1a1a;">Razón Social:</td><td style="padding: 10px; color: #444;">${datos.nombre}</td></tr>
        <tr style="background-color: #f9f9f9;"><td style="padding: 10px; font-weight: bold; color: #1a1a1a;">Contacto:</td><td style="padding: 10px; color: #444;">${datos.contacto || 'No registra'}</td></tr>
        <tr><td style="padding: 10px; font-weight: bold; color: #1a1a1a;">Teléfono:</td><td style="padding: 10px; color: #444;">${datos.telefono || 'No registra'}</td></tr>
        <tr style="background-color: #f9f9f9;"><td style="padding: 10px; font-weight: bold; color: #1a1a1a;">Ciudad:</td><td style="padding: 10px; color: #444;">${datos.ciudad || 'No registra'}</td></tr>
        <tr><td style="padding: 10px; font-weight: bold; color: #1a1a1a;">Régimen:</td><td style="padding: 10px; color: #444;">${datos.regimen || 'No registra'}</td></tr>
      </table>
      
      <h3 style="color: #1a1a1a; font-size: 16px; margin-top: 25px; margin-bottom: 10px;">📂 Documentación y Repositorio:</h3>
      <div style="background-color: #f4f6f9; padding: 15px; border-radius: 6px; font-size: 14px; margin-bottom: 30px;">
        <p style="margin: 5px 0;">• <a href="${urlCarpeta}" target="_blank" style="color: #fbb03b; font-weight: bold; text-decoration: none;">Abrir Carpeta del Proveedor en Drive ↗</a></p>
        <p style="margin: 5px 0;">• <a href="${urlRut}" target="_blank" style="color: #1a1a1a; text-decoration: none;">Ver RUT 2026 (PDF) ↗</a></p>
        <p style="margin: 5px 0;">• <a href="${urlCert}" target="_blank" style="color: #1a1a1a; text-decoration: none;">Ver Certificación Bancaria (PDF) ↗</a></p>
        <p style="margin: 5px 0;">• <a href="${urlEstado}" target="_blank" style="color: #1a1a1a; text-decoration: none;">Ver Estado de Cuenta (PDF) ↗</a></p>
      </div>
      
      <div style="border-top: 2px dashed #eee; padding-top: 15px; margin-top: 20px; font-size: 13px; color: #555;">
        <p style="margin: 2px 0; font-weight: bold; color: #1a1a1a;">Elaborado por:</p>
        <p style="margin: 2px 0; font-size: 14px; color: #444;"><strong>Paula Catalina Martínez Villate</strong></p>
        <p style="margin: 2px 0; color: #777; font-style: italic;">Coordinadora Contable y Administrativa</p>
        <p style="margin: 2px 0; font-size: 11px; color: #fbb03b; font-weight: bold; text-transform: uppercase;">Social Solar – Energía Solar</p>
      </div>
    </div>
  </div>
  `;

  try {
    // Se utiliza GmailApp para asegurar permisos y entrega efectiva en Apps Script
    GmailApp.sendEmail(correoDestinatario, "📋 Nuevo Proveedor Registrado: " + datos.nombre, "", {
      htmlBody: htmlBody
    });
    console.log("✔ Correo enviado con éxito a: " + correoDestinatario);
  } catch (err) {
    console.error("❌ Error crítico al enviar correo: " + err.toString());
    throw new Error("Error en el servicio de correo: " + err.message);
  }
}

/**
 * 5. Función de prueba automatizada
 * Te permite forzar el envío de la alerta de forma inmediata a la administración contable.
 */
function ejecutarPruebaDeAlerta() {
  var datosFicticios = {
    nit: "901.234.567-8",
    nombre: "EMPRESA DE PRUEBA DE TRANSFERENCIA S.A.S.",
    contacto: "Juan Diego Gómez",
    telefono: "3159876543",
    ciudad: "Yopal",
    regimen: "Responsable de IVA"
  };
  
  var urlFalsa = "https://google.com";
  
  try {
    enviarAlertaCorreo(datosFicticios, urlFalsa, urlFalsa, urlFalsa, urlFalsa);
    Logger.log("✅ Envío de prueba finalizado. Revisa la bandeja de entrada.");
  } catch (error) {
    Logger.log("❌ Error en la ejecución de la prueba: " + error.toString());
  }
}


/** =========================================================
 *  EXTENSION COMERCIAL - SOCIAL SOLAR S.A.S. - nov 2026
 *  Un solo link: consulta el NIT y pide solo lo que falta.
 *  Escribe la negociacion en la hoja PROVEEDORES 2026.
 *  ========================================================= */

var SSV_PROV = '02 MAESTRO PROVEEDORES 2026';
var SSV_REG  = '01 REGISTRO Y DOCUMENTOS';
var SSV_RAIZ = '1WKnC49pfy6rDqBzR0CQLf6paT7rNe9GZ';

function ssvNit_(v) {
  var d = String(v == null ? '' : v).replace(/[^0-9]/g, '');
  if (d.length === 10 && (d.charAt(0) === '8' || d.charAt(0) === '9')) d = d.substring(0, 9);
  return d;
}

function ssvFilaReg_(clave) {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SSV_REG);
  if (!h || h.getLastRow() < 2) return 0;
  var v = h.getRange(2, 2, h.getLastRow() - 1, 1).getValues();
  for (var i = v.length - 1; i >= 0; i--) if (ssvNit_(v[i][0]) === clave) return i + 2;
  return 0;
}

function ssvFilaProv_(clave) {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SSV_PROV);
  if (!h || h.getLastRow() < 2) return 0;
  var v = h.getRange(2, 1, h.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < v.length; i++) if (ssvNit_(v[i][0]) === clave) return i + 2;
  return 0;
}

function consultarNit(nit) {
  var out = { ok: false, clave: '', registrado: false, nombre: '', fechaRut: '', pide: 'COMPLETO', mensaje: '' };
  try {
    var clave = ssvNit_(nit);
    if (!clave) { out.mensaje = 'Escriba el NIT o la cedula, solo numeros.'; return out; }
    out.ok = true; out.clave = clave;
    var libro = SpreadsheetApp.getActiveSpreadsheet();

    var fr = ssvFilaReg_(clave);
    if (fr) {
      var hr = libro.getSheetByName(SSV_REG);
      out.registrado = true;
      out.nombre = String(hr.getRange(fr, 3).getValue() || '');
      out.fechaRut = String(hr.getRange(fr, 10).getValue() || '');
      var m = out.fechaRut.match(/[0-9]{4}/);
      var vigente = !!(m && Number(m[0]) === new Date().getFullYear());
      out.pide = vigente ? 'COMERCIAL' : 'RUT';
    }

    var fp = ssvFilaProv_(clave);
    if (fp && !out.nombre) {
      out.nombre = String(libro.getSheetByName(SSV_PROV).getRange(fp, 2).getValue() || '');
    }
    return out;
  } catch (e) {
    out.ok = false; out.mensaje = 'Error al consultar: ' + e.toString();
    return out;
  }
}

function ssvNum_(v) {
  var s = String(v == null ? '' : v).replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.');
  return s === '' ? '' : Number(s);
}

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
  var raiz = DriveApp.getFolderById(SSV_RAIZ);
  var nom = clave + ' - ' + (datos.nombre || '');
  var it = raiz.getFoldersByName(nom);
  var carpeta = it.hasNext() ? it.next() : raiz.createFolder(nom);
  var msj = [];
  if (datos.contacto) hr.getRange(fila, 4).setValue(datos.contacto);
  if (datos.telefono) hr.getRange(fila, 5).setValue(datos.telefono);
  if (datos.ciudad)   hr.getRange(fila, 6).setValue(datos.ciudad);
  if (datos.regimen)  hr.getRange(fila, 7).setValue(datos.regimen);
  if (fRut) {
    var u = guardarArchivoEnDrive(fRut, carpeta, 'RUT_' + new Date().getFullYear() + '_' + clave);
    hr.getRange(fila, 8).setValue(u);
    hr.getRange(fila, 10).setValue('');
    msj.push('RUT actualizado en la carpeta.');
  }
  if (fCert) {
    var u2 = guardarArchivoEnDrive(fCert, carpeta, 'Certificacion_Bancaria_' + clave);
    hr.getRange(fila, 9).setValue(u2);
    msj.push('Certificacion bancaria actualizada.');
  }
  return msj.join(' ');
}

function registrarProveedorCompleto(datos, fRut, fCert) {
  try {
    if (!datos || !datos.nit || !datos.nombre) {
      return { exito: false, mensaje: 'Faltan el NIT o la razon social.' };
    }
    var est = consultarNit(datos.nit);
    var msj = [];
    if (!est.registrado) {
      var r = procesarProveedor(datos, fRut, fCert);
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

function menuClavesCertificados() {
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

function menuVerClavesPendientes() {
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
