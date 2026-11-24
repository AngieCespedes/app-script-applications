/**
 * Instalacion_ — deja la copia lista: IDs propios (nunca los de la app original), carpetas y modo PRUEBA.
 * Tipos en IDS_: 'libro' = este libro · 'carpeta' = carpeta nueva junto al libro · {externo: id} = se usa tal cual
 * · {igualA: 'OTRO'} = el mismo valor que otra clave.
 */
var Instalacion_ = (function () {
  function carpeta_(padre, nombre) {
    var it = padre.getFoldersByName(nombre);
    return it.hasNext() ? it.next() : padre.createFolder(nombre);
  }

  function instalar() {
    Guardas_.duena();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var padre = DriveApp.getFileById(ss.getId()).getParents().next();
    var archivos = carpeta_(padre, 'Archivos de la app');
    var hechos = [];
    Object.keys(IDS_).forEach(function (k) {
      var t = IDS_[k];
      if (t === 'libro') Config_.poner(k, ss.getId());
      else if (t === 'carpeta') Config_.poner(k, carpeta_(archivos, k).getId());
      else if (t && t.externo) Config_.poner(k, t.externo);
      hechos.push(k);
    });
    Object.keys(IDS_).forEach(function (k) {
      var t = IDS_[k];
      if (t && t.igualA) Config_.poner(k, Config_.id(t.igualA));
    });
    if (!PropertiesService.getScriptProperties().getProperty('MODO')) Config_.ponerModo('PRUEBA');
    return hechos;
  }

  function menu() {
    SpreadsheetApp.getUi().createMenu('Instalación')
      .addItem('Instalar o actualizar (dueña)', 'menuInstalarApp')
      .addItem('Pasar a producción (dueña)', 'menuModoProduccion')
      .addItem('Volver a modo prueba (dueña)', 'menuModoPrueba')
      .addToUi();
  }

  return { instalar: instalar, menu: menu };
})();

function menuInstalarApp() {
  var h = Instalacion_.instalar();
  SpreadsheetApp.getUi().alert('Instalación', 'Configurados: ' + h.join(', ') + '.\nModo: ' + Config_.modo() +
    '\n\nSi la app usaba activadores (formularios, horarios), créelos de nuevo desde su menú: no se copian con el libro.',
  SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuModoProduccion() {
  Guardas_.duena();
  Config_.ponerModo('PRODUCCION');
  SpreadsheetApp.getUi().alert('Modo PRODUCCIÓN: los correos salen a sus destinatarios.');
}

function menuModoPrueba() {
  Guardas_.duena();
  Config_.ponerModo('PRUEBA');
  SpreadsheetApp.getUi().alert('Modo PRUEBA: los correos solo le llegan a la dueña.');
}
