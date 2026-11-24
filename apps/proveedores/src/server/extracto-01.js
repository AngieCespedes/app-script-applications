/**
 * Extracto_ — revisa el extracto del banco contra la hoja de pagos.
 *
 * Lo que hace el boton «Actualizar y revisar pagos» del menu:
 *   1. Lee la hoja 13 EXTRACTO BANCOS (la que se alimenta pegando el CSV del banco).
 *   2. Busca las salidas que el banco debito y no estan en la hoja 11 PAGOS Y SOPORTES.
 *   3. Crea una fila por cada una, con lo que el banco si dice, marcada para completar.
 *   4. Avisa cuantas creo, cuales pagos registrados no salieron del banco y que falta llenar.
 *
 * No inventa datos: lo que el extracto no trae (concepto, cuenta destino, soporte) queda vacio.
 */
var Extracto_ = (function () {
  /* Columnas de la hoja 13, en el orden en que queda al pegar el CSV del banco. */
  var EXT = { fecha: 11, valor: 6, descripcion: 8, cruce: 15, tipo: 19 };
  /* Columnas de la hoja 11. */
  var PAG = { numero: 1, fecha: 2, nit: 4, nombre: 5, tipo: 6, valor: 7, soporte: 10, observa: 12, validacion: 15 };

  var MARCA = 'COMPLETAR - detectado en el extracto del banco, falta el soporte y el concepto';
  var PREFIJOS = ['PAGO A PROVEEDORES', 'PAGO A PROVE', 'PAGO A PROV', 'PAGO A NOMIN', 'PAGO PSE', 'PAGO DE PROV'];

  function hoja_(nombre) {
    var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
    if (!h) throw new Error('No encontre la hoja «' + nombre + '». Reviselo antes de volver a intentar.');
    return h;
  }

  function datos_(hoja, ancho) {
    var ultima = hoja.getLastRow();
    if (ultima < 2) return [];
    return hoja.getRange(2, 1, ultima - 1, ancho).getValues();
  }

  /** Quita el prefijo que el banco le pone a la descripcion y deja el nombre del tercero. */
  function nombreDelBanco_(descripcion) {
    var t = String(descripcion || '').trim();
    for (var i = 0; i < PREFIJOS.length; i++) {
      if (t.toUpperCase().indexOf(PREFIJOS[i]) === 0) return t.substring(PREFIJOS[i].length).trim() || t;
    }
    return t;
  }

  /** Busca el NIT de un tercero entre los pagos ya registrados. Devuelve '' si no esta seguro. */
  function nitConocido_(nombre, pagos) {
    var buscado = String(nombre || '').toUpperCase().replace(/\s+/g, ' ').trim();
    if (buscado.length < 4) return '';
    for (var i = 0; i < pagos.length; i++) {
      var registrado = String(pagos[i][PAG.nombre - 1] || '').toUpperCase().replace(/\s+/g, ' ').trim();
      if (!registrado) continue;
      if (registrado.indexOf(buscado) === 0 || buscado.indexOf(registrado) === 0) {
        return String(pagos[i][PAG.nit - 1] || '');
      }
    }
    return '';
  }

  function yaRegistrado_(pagos, fecha, valor) {
    var dia = fecha instanceof Date ? fecha.getTime() : null;
    for (var i = 0; i < pagos.length; i++) {
      var f = pagos[i][PAG.fecha - 1];
      var v = Math.round(Number(pagos[i][PAG.valor - 1]) || 0);
      if (v !== valor) continue;
      if (dia === null || !(f instanceof Date)) return true;
      if (Math.abs(f.getTime() - dia) <= 6 * 24 * 60 * 60 * 1000) return true;
    }
    return false;
  }

  function consecutivo_(pagos) {
    var max = 0;
    for (var i = 0; i < pagos.length; i++) {
      var n = Number(pagos[i][PAG.numero - 1]);
      if (!isNaN(n) && n > max) max = n;
    }
    return max;
  }

  /** Arma las filas que hay que crear en la hoja 11. */
  function pendientes_(movimientos, pagos) {
    var nuevas = [];
    for (var i = 0; i < movimientos.length; i++) {
      var m = movimientos[i];
      if (String(m[EXT.cruce - 1]).trim().toUpperCase() !== 'REVISAR') continue;
      var valor = Math.round(Math.abs(Number(m[EXT.valor - 1]) || 0));
      if (valor <= 0) continue;
      var fecha = m[EXT.fecha - 1];
      if (yaRegistrado_(pagos, fecha, valor)) continue;
      var nombre = nombreDelBanco_(m[EXT.descripcion - 1]);
      nuevas.push({
        fecha: fecha,
        nit: nitConocido_(nombre, pagos),
        nombre: nombre,
        tipo: String(m[EXT.tipo - 1] || 'PROVEEDOR'),
        valor: valor
      });
    }
    return nuevas;
  }

  /** Primera fila libre mirando SOLO la columna del consecutivo: a la derecha hay formulas que se extienden solas. */
  function filaLibre_(pagos) {
    var ultima = 1;
    for (var i = 0; i < pagos.length; i++) {
      if (String(pagos[i][PAG.numero - 1]).trim() !== '') ultima = i + 2;
    }
    return ultima + 1;
  }

  function escribir_(hoja, nuevas, desde, fila) {
    var filas = nuevas.map(function (n, i) {
      var f = new Array(14).fill('');
      f[PAG.numero - 1] = desde + i + 1;
      f[PAG.fecha - 1] = n.fecha;
      f[PAG.nit - 1] = n.nit;
      f[PAG.nombre - 1] = n.nombre;
      f[PAG.tipo - 1] = n.tipo;
      f[PAG.valor - 1] = n.valor;
      f[PAG.observa - 1] = MARCA;
      return f;
    });
    hoja.getRange(fila, 1, filas.length, 14).setValues(filas);
  }

  /** Lo que quedo pendiente despues de actualizar. */
  function pendiente_(pagos) {
    var r = { noSalieron: [], sinNit: 0, sinSoporte: 0 };
    for (var i = 0; i < pagos.length; i++) {
      if (!String(pagos[i][PAG.numero - 1]).trim()) continue;
      if (String(pagos[i][PAG.validacion - 1]).toUpperCase().indexOf('NO SALIO') === 0) {
        r.noSalieron.push(pagos[i][PAG.nombre - 1] + ' ' + Utilities.formatString('$%s', pagos[i][PAG.valor - 1]));
      }
      if (!String(pagos[i][PAG.nit - 1]).trim()) r.sinNit++;
      if (!String(pagos[i][PAG.soporte - 1]).trim()) r.sinSoporte++;
    }
    return r;
  }

  function actualizar() {
    Guardas_.persona();
    var hp = hoja_(OC_H_PAG);
    var he = hoja_(OC_H_EXT);

    var pagos = datos_(hp, 15);
    var movimientos = datos_(he, 19);
    if (!movimientos.length) return { creadas: 0, mensaje: 'La hoja «' + OC_H_EXT + '» esta vacia: pegue primero el extracto del banco.' };

    var nuevas = pendientes_(movimientos, pagos);
    if (nuevas.length) {
      escribir_(hp, nuevas, consecutivo_(pagos), filaLibre_(pagos));
      SpreadsheetApp.flush();
      pagos = datos_(hp, 15);
    }

    var p = pendiente_(pagos);
    var partes = [];
    partes.push(nuevas.length
      ? 'Se crearon ' + nuevas.length + ' pagos que el banco debito y no estaban registrados. Quedaron marcados COMPLETAR.'
      : 'No hay pagos del banco sin registrar: todo lo que salio esta en la hoja.');
    if (p.noSalieron.length) {
      partes.push('\nOJO: ' + p.noSalieron.length + ' pago(s) registrados NO salieron del banco y hay que volver a hacerlos:\n  ' +
        p.noSalieron.join('\n  '));
    }
    partes.push('\nPor completar: ' + p.sinNit + ' sin NIT o cedula, ' + p.sinSoporte + ' sin soporte archivado.');
    return { creadas: nuevas.length, mensaje: partes.join('\n') };
  }

  return { actualizar: actualizar };
})();

function menuActualizarRevisar() {
  var r = Extracto_.actualizar();
  SpreadsheetApp.getUi().alert('Revision de pagos con el extracto', r.mensaje, SpreadsheetApp.getUi().ButtonSet.OK);
}
