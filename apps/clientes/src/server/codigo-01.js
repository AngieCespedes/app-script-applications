function doGet() {
  return HtmlService.createTemplateFromFile('Formulario')
      .evaluate()
      .setTitle('Portal de Clientes - Social Solar')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function procesarCliente_(datos, archivoRut) {
  try {
    var libro = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = libro.getSheets()[0]; 
    var ultimaFila = hoja.getLastRow();
    
    // 1. Control estricto de duplicados por Cédula o NIT
    if (ultimaFila > 1) {
      var idExistentes = hoja.getRange(2, 2, ultimaFila - 1, 1).getValues();
      var idNuevoLimpio = datos.identificacion.toString().replace(/[\s-]/g, "");
      
      for (var i = 0; i < idExistentes.length; i++) {
        var idExistenteLimpio = idExistentes[i].toString().replace(/[\s-]/g, "");
        if (idExistenteLimpio === idNuevoLimpio) {
          return { 
            exito: false, 
            mensaje: "⚠️ Este Documento o NIT ya se encuentra registrado en el sistema de clientes." 
          };
        }
      }
    }

    // 2. Conexión con tu carpeta de Drive de clientes
    var carpetaPrincipal = Aislamiento_.carpeta(Config_.id('CARPETA_CLIENTES'));
    var nombreCarpeta = datos.identificacion + " - " + datos.nombre;
    var subcarpeta = carpetaPrincipal.createFolder(nombreCarpeta);
    var urlCarpetaDrive = subcarpeta.getUrl();
    
    // 3. Guardar el RUT en Drive de forma limpia
    var urlRut = guardarArchivoEnDrive_(archivoRut, subcarpeta, "RUT_2026_" + datos.identificacion);
    
    // 4. Inserción de datos en orden lineal en Google Sheets
    hoja.appendRow([
      new Date(), 
      datos.identificacion, 
      datos.nombre, 
      datos.telefono,
      datos.ciudad,      
      datos.direccion,
      datos.contactoFacturas,
      datos.correoFacturas,
      datos.contactoTesoreria,
      datos.correoTesoreria,
      urlRut, 
      false // Inicia desmarcado en la casilla Viable
    ]);
    
    // 5. Envío de correo de alerta interna (Para el equipo de Social Solar)
    enviarAlertaInterna_(datos, urlCarpetaDrive, urlRut);
    
    // 6. Envío de correo de confirmación automático (Para el Cliente)
    enviarConfirmacionCliente_(datos);
    
    return { exito: true, mensaje: "✅ ¡Inscripción Exitosa! Los datos y el RUT han sido cargados al sistema contable." };
    
  } catch (error) {
    return { exito: false, mensaje: "❌ Error en el sistema: " + error.toString() };
  }
}

function guardarArchivoEnDrive_(archivoObjeto, carpetaTarget, prefijoNombre) {
  if (!archivoObjeto || !archivoObjeto.base64) return "No adjunto";
  var partes = archivoObjeto.base64.split(",");
  var base64Limpio = partes.length > 1 ? partes[1] : partes[0];
  var bytes = Utilities.base64Decode(base64Limpio);
  var blob = Utilities.newBlob(bytes, archivoObjeto.tipo, prefijoNombre + ".pdf");
  var archivoCreado = carpetaTarget.createFile(blob);
  archivoCreado.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return archivoCreado.getUrl();
}

function enviarAlertaInterna_(datos, urlCarpeta, urlRut) {
  // ⚠️ REEMPLAZA ESTE CORREO POR TU CORREO CORPORATIVO REAL
  var correoDestinatario = "asesorcomercialsocialsolar@gmail.com"; 
  
  var htmlBody = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
      <div style="background-color: #ffffff; padding: 25px 20px 15px 20px; text-align: center; border-bottom: 3px solid #fbb03b;">
        <h2 style="margin:0; font-size:28px; color:#1a1a1a; font-family:'Arial Black', sans-serif;">SOCIAL <span style="color:#fbb03b; font-weight:normal;">SOLAR</span></h2>
      </div>
      <div style="padding: 25px; background-color: #ffffff;">
        <h2 style="color: #1a1a1a; margin-top: 0; font-size: 20px; border-bottom: 2px solid #f4f6f9; padding-bottom: 10px;">☀️ Registro de Datos de Cliente</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr style="background-color: #f9f9f9;"><td style="padding: 8px; font-weight: bold; width: 40%;">Cédula / NIT:</td><td style="padding: 8px;">${datos.identificacion}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Razón Social:</td><td style="padding: 8px;">${datos.nombre}</td></tr>
          <tr style="background-color: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Contacto Facturas:</td><td style="padding: 8px;">${datos.contactoFacturas}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Correo Facturas:</td><td style="padding: 8px;">${datos.correoFacturas}</td></tr>
          <tr style="background-color: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Contacto Tesorería:</td><td style="padding: 8px;">${datos.contactoTesoreria}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Correo Tesorería:</td><td style="padding: 8px;">${datos.correoTesoreria}</td></tr>
        </table>
        <h3 style="color: #1a1a1a; font-size: 16px; margin-top: 25px;">📂 Repositorio Digital:</h3>
        <div style="background-color: #f4f6f9; padding: 15px; border-radius: 6px; font-size: 14px;">
          <p style="margin: 5px 0;">• <a href="${urlCarpeta}" target="_blank" style="color: #fbb03b; font-weight: bold; text-decoration: none;">Abrir Carpeta de Cliente en Drive ↗</a></p>
          <p style="margin: 5px 0;">• <a href="${urlRut}" target="_blank" style="color: #1a1a1a; text-decoration: none;">Ver RUT 2026 (PDF) ↗</a></p>
        </div>
      </div>
    </div>
  `;

  Correo_.enviar({
    to: correoDestinatario,
    subject: "📋 Nuevo Cliente Registrado: " + datos.nombre,
    htmlBody: htmlBody
  });
}

function enviarConfirmacionCliente_(datos) {
  var htmlCliente = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
      <div style="background-color: #ffffff; padding: 25px 20px 15px 20px; text-align: center; border-bottom: 3px solid #fbb03b;">
        <h2 style="margin:0; font-size:28px; color:#1a1a1a; font-family:'Arial Black', sans-serif;">SOCIAL <span style="color:#fbb03b; font-weight:normal;">SOLAR</span></h2>
      </div>
      <div style="padding: 25px; background-color: #ffffff;">
        <p style="font-size: 16px; color: #1a1a1a; margin-top: 0;"><strong>Estimado(a) ${datos.contactoFacturas},</strong></p>
        <p style="color: #444; font-size: 14.5px; line-height: 1.6;">
          Confirmamos que los datos comerciales y fiscales de la empresa <strong>${datos.nombre}</strong> han sido registrados con éxito en el sistema contable y de facturación de <strong>Social Solar</strong> para el periodo 2026.
        </p>
        <p style="color: #444; font-size: 14.5px; line-height: 1.6;">
          Nuestro departamento administrativo procederá con la verificación de su Registro Único Tributario (RUT). En caso de requerir alguna aclaración, nos comunicaremos directamente con los contactos de facturación o tesorería suministrados.
        </p>
        <p style="color: #444; font-size: 14.5px; line-height: 1.6; font-weight: bold;">
          Agradecemos su colaboración para la optimización de nuestros procesos administrativos comunes.
        </p>
        <div style="border-top: 1px solid #eee; padding-top: 18px; margin-top: 25px; font-size: 13px; color: #555;">
          <p style="margin: 2px 0; font-weight: bold; color: #1a1a1a;">Cordialmente,</p>
          <p style="margin: 4px 0; font-size: 14px; color: #222;"><strong>Paula Catalina Martínez Villate</strong></p>
          <p style="margin: 2px 0; color: #666; font-style: italic;">Coordinadora Contable y Administrativa</p>
          <p style="margin: 2px 0; font-size: 11px; color: #fbb03b; font-weight: bold; text-transform: uppercase;">Social Solar – Energía Solar</p>
        </div>
      </div>
    </div>
  `;

  Correo_.enviar({
    to: datos.correoFacturas,
    subject: "Confirmación de Registro de Datos Comerciales - Social Solar",
    htmlBody: htmlCliente
  });
}

