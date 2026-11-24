/**
 * Hoja — menú «Caja menor» dentro del libro, instalación y activador diario.
 *
 * Estas funciones son globales porque el menú y los activadores las llaman por nombre.
 * Por eso cada una empieza con una guarda: desde la app web anónima no corren.
 */
var Instalacion = (function () {
  function carpeta_(padre, nombre) {
    var it = padre.getFoldersByName(nombre);
    return it.hasNext() ? it.next() : padre.createFolder(nombre);
  }

  /** Guarda IDs del libro y carpetas en las propiedades y deja el libro en el esquema actual. */
  function instalar() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var yo = Seguridad.exigirPersonaEnLaHoja();
    if (yo !== ss.getOwner().getEmail().toLowerCase()) throw new Error('Solo la dueña del libro puede instalar.');
    var archivo = DriveApp.getFileById(ss.getId());
    var padre = archivo.getParents().next();
    var abuelo = padre.getParents().hasNext() ? padre.getParents().next() : null;
    var config = {
      libro: ss.getId(), raiz: carpeta_(padre, 'Soportes caja menor').getId(),
      respaldos: carpeta_(padre, '99 RESPALDOS').getId(), plantillas: abuelo ? abuelo.getId() : ''
    };
    if (!Config.leerOpcional('modo')) config.modo = 'PRUEBA';
    Config.guardar(config);
    ss.setSpreadsheetTimeZone(Config.ZONA);
    return Migraciones.ejecutar();
  }

  function cambiarModo(produccion) {
    Seguridad.exigirDuena();
    Config.guardar({ modo: produccion ? 'PRODUCCION' : 'PRUEBA' });
    ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'tareaDiariaSaldo'; })
      .forEach(function (t) { ScriptApp.deleteTrigger(t); });
    if (produccion) ScriptApp.newTrigger('tareaDiariaSaldo').timeBased().everyDays(1).atHour(7).create();
  }

  return { instalar: instalar, cambiarModo: cambiarModo };
})();

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Caja menor')
    .addItem('Abrir la aplicación', 'menuAbrirApp')
    .addItem('Revisar la relación', 'menuRevisarRelacion')
    .addItem('Generar respaldo del mes', 'menuRespaldo')
    .addSeparator()
    .addItem('Instalar o actualizar (dueña)', 'menuInstalar')
    .addItem('Pasar a producción (dueña)', 'menuProduccion')
    .addItem('Volver a modo prueba (dueña)', 'menuPrueba')
    .addToUi();
}

function alerta_(titulo, texto) { SpreadsheetApp.getUi().alert(titulo, texto, SpreadsheetApp.getUi().ButtonSet.OK); }

function menuAbrirApp() {
  Seguridad.exigirPersonaEnLaHoja();
  var url = ScriptApp.getService().getUrl();
  if (!url) { alerta_('Caja menor', 'La aplicación web todavía no está publicada.'); return; }
  var html = HtmlService.createHtmlOutput('<p style="font-family:Arial">Abra la caja menor aquí:</p>' +
    '<p><a href="' + url + '" target="_blank" style="font-family:Arial;font-size:15px">Abrir la caja menor</a></p>')
    .setWidth(380).setHeight(130);
  SpreadsheetApp.getUi().showModalDialog(html, 'Caja menor');
}

function menuRevisarRelacion() {
  Seguridad.exigirPersonaEnLaHoja();
  Esquema.verificar();
  var r = Relacion.revisar();
  if (!r.errores.length && !r.avisos.length) {
    alerta_('Relación N.° ' + r.numero, 'Todo en orden: ' + r.lineas.length + ' movimientos, saldo final ' + r.saldoTxt + '.');
    return;
  }
  var t = (r.errores.length ? 'Corregir antes de cerrar:\n' + r.errores.join('\n') + '\n\n' : '') +
    (r.avisos.length ? 'Tener en cuenta:\n' + r.avisos.join('\n') : '');
  alerta_('Relación N.° ' + r.numero, t.trim());
}

function menuRespaldo() {
  Seguridad.exigirDuena();
  var r = Soportes.respaldoDelMes();
  alerta_('Respaldo listo', r.nombre + '.zip con ' + r.archivos + ' archivo(s).\n\n' + r.url);
}

function menuInstalar() {
  var r = Instalacion.instalar();
  alerta_('Caja menor instalada', 'El libro quedó en la versión de esquema ' + r.ahora + ' (antes: ' + r.antes + ').\n\n' +
    'Modo actual: ' + (Config.enProduccion() ? 'PRODUCCIÓN' : 'PRUEBA (los correos solo le llegan a usted)') + '.');
}

function menuProduccion() {
  Instalacion.cambiarModo(true);
  alerta_('Caja menor', 'Modo PRODUCCIÓN: los correos salen a sus destinatarios y el aviso de saldo corre todos los días a las 7 a. m.');
}

function menuPrueba() {
  Instalacion.cambiarModo(false);
  alerta_('Caja menor', 'Modo PRUEBA: los correos solo le llegan a usted y el aviso diario quedó apagado.');
}

/** La llama el activador diario. Rechaza cualquier llamada que no venga de un activador real. */
function tareaDiariaSaldo(e) {
  Seguridad.exigirActivador(e);
  Esquema.verificar();
  console.log(Avisos.revisarSaldo());
}
