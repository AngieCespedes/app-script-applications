/**
 * Esquema — el contrato entre el código y el libro.
 * El libro declara su versión en la hoja oculta _meta (rango META_VERSION).
 * Si no coincide con la que espera el código, no se lee ni se escribe nada.
 */
var Esquema = (function () {
  var verificado_ = false;

  /** Columnas que el código necesita, por tabla. */
  var REQUERIDAS = {
    relacion: function () {
      return Object.keys(Config.COL_REL).map(function (k) { return Config.COL_REL[k]; });
    },
    movimientos: function () {
      return ['N.° relación', 'N.°', 'Fecha', 'Egreso', 'Ingreso', 'Revisión', 'Fecha de cierre',
        'Responsable de la caja'];
    },
    historial: function () {
      return ['N.° relación', 'Fecha', 'Periodo desde', 'Periodo hasta', 'Aprobada por', 'Enlace al PDF'];
    },
    entregas: function () { return ['N.° comprobante', 'Valor', '¿Confirmó quien recibe?']; },
    usuarios: function () { return ['Usuario', 'Clave (cifrada)', 'Sal', 'Rol', 'Activo']; }
  };

  function versionDelLibro() {
    var r = Libro.abrir().getRangeByName('META_VERSION');
    return r ? Number(r.getValue()) || 0 : 0;
  }

  /** Lanza error si el libro no tiene la versión de esquema esperada. */
  function verificar() {
    if (verificado_) return;
    var v = versionDelLibro();
    if (v !== Config.VERSION_ESQUEMA) {
      throw new Error('El libro está en la versión de esquema ' + v + ' y el código espera la ' +
        Config.VERSION_ESQUEMA + '. La dueña debe correr Caja menor › Instalar o actualizar.');
    }
    verificado_ = true;
  }

  /** Verifica que una tabla tenga las columnas que el código va a usar. */
  function tablaCompleta(clave) {
    var t = Libro.tabla(clave);
    var req = REQUERIDAS[clave];
    if (req) Filas.exigir(t.mapa, req(), t.hoja.getName());
    return t;
  }

  return { verificar: verificar, versionDelLibro: versionDelLibro, tablaCompleta: tablaCompleta };
})();
