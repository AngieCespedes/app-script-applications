/**
 * Config_ — IDs y modo de la app, guardados en las propiedades del script por «Instalar».
 * (Núcleo compartido de las apps traídas con migrar-legado. No editar aquí: editar packages/nucleo-legado.)
 */
var Config_ = (function () {
  function props_() { return PropertiesService.getScriptProperties(); }
  /** No lanza error al cargar: si falta, devuelve '' y la operación que lo use fallará con aviso. */
  function id(nombre) {
    var v = props_().getProperty('ID_' + nombre);
    if (!v) console.warn('Falta configurar ' + nombre + ': la dueña debe correr el menú «Instalar».');
    return v || '';
  }
  function poner(nombre, valor) { props_().setProperty('ID_' + nombre, String(valor)); }
  function modo() { return props_().getProperty('MODO') || 'PRUEBA'; }
  function ponerModo(m) { props_().setProperty('MODO', m); }
  function enProduccion() { return modo() === 'PRODUCCION'; }
  return { id: id, poner: poner, modo: modo, ponerModo: ponerModo, enProduccion: enProduccion };
})();
