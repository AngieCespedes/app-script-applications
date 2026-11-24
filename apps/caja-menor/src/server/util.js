/**
 * Util — funciones puras de texto, números y fechas.
 * Sin acceso a hojas ni a Drive: se pueden probar en Node.
 */
var Util = (function () {
  var CORREO_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  function txt(v, max) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 200);
  }

  function entero(v) {
    return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9]/g, ''))) || 0;
  }

  /** NIT o cédula sin puntos, espacios ni dígito de verificación: «830.054.581-2» → «830054581». */
  function nit(v) {
    var base = String(v == null ? '' : v).split('-')[0];
    return base.replace(/[^0-9]/g, '').slice(0, 15);
  }

  function correo(v, etiqueta) {
    var s = String(v == null ? '' : v).trim().toLowerCase();
    if (s && !CORREO_RE.test(s)) throw new Error('El correo de ' + (etiqueta || 'la persona') + ' no parece válido: ' + s);
    return s;
  }

  function pesos(n) {
    return '$ ' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function limpiarNombreArchivo(s) {
    return String(s).replace(/[\\/:*?"<>|#]/g, '-').replace(/\s+/g, ' ').trim();
  }

  /** Acepta Date, «aaaa-mm-dd» o «dd/mm/aaaa». Devuelve null si no entiende. */
  function aFecha(v) {
    if (v instanceof Date) return v;
    var s = String(v || '').trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    return null;
  }

  function soloFecha(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function sumarDias(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

  function dosDigitos_(n) { return ('0' + n).slice(-2); }
  function fmt(d) {
    if (!(d instanceof Date)) return String(d || '');
    return dosDigitos_(d.getDate()) + '/' + dosDigitos_(d.getMonth() + 1) + '/' + d.getFullYear();
  }
  function compacta(d) {
    return d.getFullYear() + dosDigitos_(d.getMonth() + 1) + dosDigitos_(d.getDate());
  }
  function anioMes(d) { return d.getFullYear() + '-' + dosDigitos_(d.getMonth() + 1); }

  /** AAAAMMDD_TERCERO_NUMERO, la convención de nombres de soportes. */
  function nombreArchivo(fecha, tercero, numero) {
    var f = aFecha(fecha);
    var t = limpiarNombreArchivo(String(tercero || 'SIN TERCERO')).toUpperCase().slice(0, 40);
    var n = limpiarNombreArchivo(String(numero || 'SN')).toUpperCase().slice(0, 25);
    return (f ? compacta(f) : 'sinfecha') + '_' + t + '_' + n;
  }

  function tablaHtml(pares) {
    return '<table style="border-collapse:collapse;font-family:Arial;font-size:13px">' +
      pares.map(function (p) {
        return '<tr><td style="padding:5px 12px;background:#FFE7B0;border:1px solid #ddd"><b>' +
          esc(p[0]) + '</b></td><td style="padding:5px 12px;border:1px solid #ddd">' +
          esc(p[1]) + '</td></tr>';
      }).join('') + '</table>';
  }

  return {
    txt: txt, entero: entero, nit: nit, correo: correo, pesos: pesos, esc: esc,
    limpiarNombreArchivo: limpiarNombreArchivo, aFecha: aFecha, soloFecha: soloFecha,
    sumarDias: sumarDias, fmt: fmt, compacta: compacta, anioMes: anioMes,
    nombreArchivo: nombreArchivo, tablaHtml: tablaHtml
  };
})();
