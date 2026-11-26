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
  if (p === 'portal') return ocDoGet_(e);

  return HtmlService.createTemplateFromFile('Formulario')
    .evaluate()
    .setTitle('Registro de Proveedores - Social Solar')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 2. Procesamiento central del proveedor
 * Controla duplicados, crea carpetas en Drive, guarda PDFs e inserta datos en Sheets.
 */
function procesarProveedor_(datos, archivoRut, archivoCert, archivoEstado) {
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
    var carpetaPrincipal = Aislamiento_.carpeta(Config_.id('SSV_RAIZ'));

    // Crear subcarpeta exclusiva para el nuevo proveedor
    var nombreCarpeta = datos.nit + " - " + datos.nombre;
    var subcarpeta = carpetaPrincipal.createFolder(nombreCarpeta);
    var urlCarpetaDrive = subcarpeta.getUrl();

    // Almacenar de manera independiente los 3 documentos PDF obligatorios
    var urlRut = guardarArchivoEnDrive_(archivoRut, subcarpeta, "RUT_2026_" + datos.nit);
    var urlCert = guardarArchivoEnDrive_(archivoCert, subcarpeta, "Certificacion_Bancaria_" + datos.nit);
    var urlEstado = guardarArchivoEnDrive_(archivoEstado, subcarpeta, "Estado_Cuenta_" + datos.nit);

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
    enviarAlertaCorreo_(datos, urlCarpetaDrive, urlRut, urlCert, urlEstado);

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
function guardarArchivoEnDrive_(archivoObjeto, carpetaTarget, prefijoNombre) {
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
function enviarAlertaCorreo_(datos, urlCarpeta, urlRut, urlCert, urlEstado) {
  /* A quien le avisa el sistema cuando se registra un proveedor. Va en las
     propiedades del script, no escrito aqui: el dia que cambie la persona,
     se cambia desde el menu «Instalar» y no tocando el codigo. Si no esta
     configurado, le llega a la dueña del libro para que no se pierda. */
  var correoDestinatario = Config_.id('CORREO_AVISOS') || Session.getEffectiveUser().getEmail();
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
        <p style="margin: 2px 0; color: #777; font-style: italic;">Aviso automático del portal de proveedores</p>
        <p style="margin: 2px 0; font-size: 14px; color: #444;"><strong>Área Contable y Administrativa</strong></p>
        <p style="margin: 2px 0; font-size: 11px; color: #fbb03b; font-weight: bold; text-transform: uppercase;">Social Solar S.A.S. – Energía Solar</p>
      </div>
    </div>
  </div>
  `;

  try {
    // Se utiliza GmailApp para asegurar permisos y entrega efectiva en Apps Script
    Correo_.enviarGmail(correoDestinatario, "📋 Nuevo Proveedor Registrado: " + datos.nombre, "", {
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
function ejecutarPruebaDeAlerta_() {
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
    enviarAlertaCorreo_(datosFicticios, urlFalsa, urlFalsa, urlFalsa, urlFalsa);
    Logger.log("✅ Envío de prueba finalizado. Revisa la bandeja de entrada.");
  } catch (error) {
    Logger.log("❌ Error en la ejecución de la prueba: " + error.toString());
  }
}

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

function consultarNit_(nit) {
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

