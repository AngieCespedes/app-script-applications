// Crear el menú personalizado automáticamente al abrir el documento
// Antes era onOpen(). El menú 'Bancolombia' ahora está dentro del menú único '☀️ Social Solar' (archivo Sin título.gs).
function menuBancolombiaAnterior_() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Bancolombia')
    .addItem('🔍 Verificar Cuentas y NITs', 'verificarCuentasEnProveedores')
    .addToUi();
}

// Función principal para cruzar los datos
function verificarCuentasEnProveedores() { Guardas_.persona();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojas = ss.getSheets();
  
  // 1. Vincular las pestañas por su posición física en la barra inferior
  var hojaNuevos = hojas[0];   // La PRIMERA pestaña de la izquierda (donde recibes correos)
  var hojaMaestra = hojas[1];  // La SEGUNDA pestaña (tu base maestra de cuentas inscritas)
  
  if (!hojaNuevos || !hojaMaestra) {
    SpreadsheetApp.getUi().alert("Error: Asegúrate de tener al menos dos pestañas creadas en tu documento.");
    return;
  }
  
  var lastRowMaestra = hojaMaestra.getLastRow();
  var mapaProveedores = {}; 
  
  // 2. Mapear los datos de la base de datos maestra de proveedores
  if (lastRowMaestra >= 2) {
    // Tomamos desde la columna A hasta la F de la hoja maestra para extraer NIT, Cuenta y Banco
    var datosMaestros = hojaMaestra.getRange(2, 1, lastRowMaestra - 1, 6).getValues();
    
    for (var i = 0; i < datosMaestros.length; i++) {
      var nitMaestro = datosMaestros[i][1].toString().trim();   // Columna B (NIT)
      var numCuenta = datosMaestros[i][2].toString().trim();    // Columna C (Número de Cuenta)
      var nombreBanco = datosMaestros[i][5].toString().trim();  // Columna F (Banco)
      
      if (nitMaestro !== "") {
        mapaProveedores[nitMaestro] = {
          cuenta: numCuenta,
          banco: nombreBanco
        };
      }
    }
  }
  
  // 3. Procesar los registros actuales de la hoja de nuevos ingresos
  var lastRowNuevos = hojaNuevos.getLastRow();
  if (lastRowNuevos < 2) return; 
  
  var nitsNuevos = hojaNuevos.getRange(2, 2, lastRowNuevos - 1, 1).getValues(); // Columna B
  
  var arregloInscrita = [];  // Resultados para Columna O (inscrita)
  var arregloDetalle = [];   // Resultados para Columna P (Columna 1)
  
  // 4. Cruzar fila por fila
  for (var j = 0; j < nitsNuevos.length; j++) {
    var nitActual = nitsNuevos[j].toString().trim();
    
    if (nitActual === "") {
      arregloInscrita.push([""]);
      arregloDetalle.push([""]);
    } else if (mapaProveedores[nitActual]) {
      var datosEncontrados = mapaProveedores[nitActual];
      arregloInscrita.push(["✔️ INSCRITA"]);
      arregloDetalle.push(["Cuenta: " + datosEncontrados.cuenta + " (" + datosEncontrados.banco + ")"]);
    } else {
      arregloInscrita.push(["❌ FALTA POR INSCRIBIR"]);
      arregloDetalle.push(["Sin cuenta registrada"]);
    }
  }
  
  // 5. Inyectar los datos procesados en la primera hoja de un solo golpe
  hojaNuevos.getRange(2, 15, arregloInscrita.length, 1).setValues(arregloInscrita); // Escribe en Columna O
  hojaNuevos.getRange(2, 16, arregloDetalle.length, 1).setValues(arregloDetalle);   // Escribe en Columna P
  
  SpreadsheetApp.getUi().alert("🔄 ¡Verificación completada con éxito! Revisa las columnas O y P.");
}

