/**
 * Panel — datos de arranque de la app (saldo, topes, listas desplegables).
 * Las listas se guardan 10 minutos en caché: cambian poco y son la lectura más pesada.
 */
var Panel = (function () {
  var CLAVE_CACHE = 'listas_v1';

  function listas_() {
    var cache = CacheService.getScriptCache();
    var guardadas = cache.get(CLAVE_CACHE);
    if (guardadas) return JSON.parse(guardadas);
    var l = {};
    Object.keys(Config.LISTAS).forEach(function (k) { l[k] = Libro.lista(Config.LISTAS[k]); });
    cache.put(CLAVE_CACHE, JSON.stringify(l), 600);
    return l;
  }

  function olvidarListas() { CacheService.getScriptCache().remove(CLAVE_CACHE); }

  function datos() {
    SpreadsheetApp.flush();
    var s = Consultas.saldos();
    var l = listas_();
    return {
      responsable: Relacion.responsableHoy(), numero: Libro.valor('REL_NUMERO'), desde: Libro.texto('REL_DESDE'),
      saldo: s.saldo, saldoTxt: Util.pesos(s.saldo), objetivo: s.objetivo, minimo: s.minimo,
      excedente: s.excedente, reembolso: s.reembolso, alertas: Libro.texto('REL_ALERTAS'),
      libres: Relacion.filasLibres().length,
      topeGasto: Libro.numero(Config.PAR.topeGasto), topeEfectivo: Libro.numero(Config.PAR.topeEfectivo),
      topePOS: Libro.numero(Config.PAR.topePOS), plazoDSE: Libro.numero(Config.PAR.plazoDSE),
      categorias: l.categorias, centros: l.centros, soportes: l.soportes, medios: l.medios, benef: l.benef,
      estados: l.estados, cuentas: l.cuentas, retenciones: l.retenciones, origenes: l.origenes, destinos: l.destinos,
      pendientes: Relacion.pendientesDSE().length
    };
  }

  /** Lo que pide la página al arrancar. */
  function web() {
    var d = datos();
    d.correoAux = Libro.texto(Config.PAR.correoAux);
    d.correoCtd = Libro.texto(Config.PAR.correoCtd);
    d.correoGer = Libro.texto(Config.PAR.correoGer);
    d.casos = Casos.pendientes();
    d.porConfirmar = Entregas.porConfirmar();
    d.porAprobar = Cierre.paraAprobar().filter(function (r) { return r.pendiente; }).length;
    d.quienes = Responsables.listar().map(function (r) { return r.nombre; });
    d.modoPrueba = !Config.enProduccion();
    return d;
  }

  return { datos: datos, web: web, olvidarListas: olvidarListas };
})();
