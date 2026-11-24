/**
 * Soportes — archivos en Drive: carpeta del mes, fotos de soportes,
 * lotes por clasificar y respaldo mensual.
 * Estructura: <raíz>/<año>/<aaaa-mm Mes>/<bloque>/<subcarpeta>
 */
var Soportes = (function () {
  var TIPOS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'application/pdf': '.pdf' };
  var MAX_BYTES = 20 * 1024 * 1024;

  function sub_(padre, nombre) {
    var it = padre.getFoldersByName(nombre);
    return it.hasNext() ? it.next() : padre.createFolder(nombre);
  }

  function raiz() { return DriveApp.getFolderById(Config.leer('raiz')); }

  function carpetaDelAnio(fecha) {
    var f = fecha instanceof Date ? fecha : new Date();
    return sub_(raiz(), String(f.getFullYear()));
  }

  function carpetaDelMes(fecha) {
    var f = fecha instanceof Date ? fecha : new Date();
    return sub_(carpetaDelAnio(f), Util.anioMes(f) + ' ' + Config.MESES[f.getMonth()]);
  }

  function subcarpeta(padre, nombre) { return sub_(padre, nombre); }

  function bytes_(archivo) {
    if (!archivo || !archivo.base64) throw new Error('No llegó el archivo.');
    var tipo = String(archivo.tipo || '').toLowerCase();
    if (!TIPOS[tipo]) throw new Error('«' + archivo.nombre + '»: use una foto JPG o PNG, o un PDF.');
    var b = Utilities.base64Decode(archivo.base64);
    if (b.length > MAX_BYTES) throw new Error('«' + archivo.nombre + '» pesa más de 20 MB.');
    return b;
  }

  /** Guarda el archivo en la carpeta del mes y devuelve su URL. */
  function guardar(archivo, fecha, bloque, subcarpetaNombre, nombre) {
    var b = bytes_(archivo);
    var carpeta = sub_(carpetaDelMes(fecha), bloque);
    if (subcarpetaNombre) carpeta = sub_(carpeta, subcarpetaNombre);
    var tipo = String(archivo.tipo).toLowerCase();
    return carpeta.createFile(Utilities.newBlob(b, tipo, nombre + TIPOS[tipo])).getUrl();
  }

  /** Sube hasta 20 archivos a «00 POR CLASIFICAR» del mes. */
  function subirLote(archivos) {
    if (!archivos || !archivos.length) throw new Error('No llegó ningún archivo.');
    if (archivos.length > 20) throw new Error('Máximo 20 archivos por tanda.');
    var carpeta = sub_(carpetaDelMes(new Date()), '00 POR CLASIFICAR');
    var out = archivos.map(function (a) {
      try {
        var b = bytes_(a);
        var tipo = String(a.tipo).toLowerCase();
        var nombre = Utilities.formatDate(new Date(), Config.ZONA, 'yyyyMMdd_HHmmss') + '_' +
          Util.limpiarNombreArchivo(String(a.nombre || 'soporte')).slice(0, 40);
        var f = carpeta.createFile(Utilities.newBlob(b, tipo, nombre + TIPOS[tipo]));
        return { ok: true, nombre: a.nombre, id: f.getId(), url: f.getUrl() };
      } catch (e) {
        return { ok: false, nombre: a.nombre, error: e.message };
      }
    });
    return { archivos: out, carpeta: carpeta.getUrl() };
  }

  /** Mueve un archivo del lote a su carpeta definitiva y lo renombra. Solo acepta archivos de «00 POR CLASIFICAR». */
  function clasificar(idArchivo, ficha) {
    var arch = DriveApp.getFileById(idArchivo);
    var padres = arch.getParents();
    var dePorClasificar = padres.hasNext() && padres.next().getName() === '00 POR CLASIFICAR';
    if (!dePorClasificar) throw new Error('Ese archivo no está en la carpeta de soportes por clasificar.');
    var destino = sub_(sub_(carpetaDelMes(Util.aFecha(ficha.fecha) || new Date()), '01 SOPORTES DE EGRESOS'),
      Config.CARPETA_POR_SOPORTE[ficha.tipoSoporte] || 'Sin soporte - no deducible');
    arch.setName(Util.nombreArchivo(ficha.fecha, ficha.proveedor, ficha.soporte) + '.' +
      (arch.getName().split('.').pop() || 'jpg'));
    arch.moveTo(destino);
    return arch.getUrl();
  }

  function agregarArchivos_(carpeta, blobs, nivel) {
    if (nivel > 3 || blobs.length > 300) return;
    var it = carpeta.getFiles();
    while (it.hasNext()) {
      var a = it.next();
      if (a.getSize() > 25 * 1024 * 1024) continue;
      try { blobs.push(a.getBlob().setName(carpeta.getName() + ' - ' + a.getName())); } catch (e) { console.error('No se pudo agregar ' + a.getName()); }
    }
    var subs = carpeta.getFolders();
    while (subs.hasNext()) agregarArchivos_(subs.next(), blobs, nivel + 1);
  }

  /** Comprime el libro y los soportes del mes en «99 RESPALDOS». */
  function respaldoDelMes() {
    var hoy = new Date();
    var nombre = Util.anioMes(hoy) + ' ' + Config.MESES[hoy.getMonth()];
    var blobs = [Libro.abrir().getBlob().setName('CAJA_MENOR_' + nombre + '.xlsx')];
    agregarArchivos_(carpetaDelMes(hoy), blobs, 0);
    var zip = DriveApp.getFolderById(Config.leer('respaldos')).createFile(Utilities.zip(blobs, nombre + '.zip'));
    return { url: zip.getUrl(), archivos: blobs.length, nombre: nombre };
  }

  return { raiz: raiz, carpetaDelAnio: carpetaDelAnio, carpetaDelMes: carpetaDelMes, subcarpeta: subcarpeta,
    guardar: guardar, subirLote: subirLote, clasificar: clasificar, respaldoDelMes: respaldoDelMes };
})();
