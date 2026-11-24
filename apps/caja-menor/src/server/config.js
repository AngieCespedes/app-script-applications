/**
 * Config — constantes de la caja menor y configuración guardada en
 * las propiedades del script (IDs de libro y carpetas, modo).
 * Nada de IDs escritos en el código: los pone el menú «Instalar».
 */
var Config = (function () {
  var ZONA = 'America/Bogota';
  var VERSION_ESQUEMA = 1;

  var HOJAS = {
    relacion: 'Relación', listas: 'Listas', responsables: 'Responsables',
    movimientos: 'Movimientos', historial: 'Historial', terceros: 'Terceros',
    entregas: 'Entregas', banco: 'Banco', casos: 'Casos', bancarizacion: 'Bancarización',
    arqueo: 'Arqueo', arqueos: 'Arqueos', politicas: 'Políticas', tablero: 'Tablero',
    gestion: 'Gestión', usuarios: 'Usuarios', meta: '_meta'
  };

  /** Tablas: rango con nombre del encabezado y, si tiene límite, del cuerpo. */
  var TABLAS = {
    relacion:     { encabezado: 'REL_ENCABEZADO', cuerpo: 'REL_DATOS' },
    movimientos:  { encabezado: 'TAB_MOVIMIENTOS' },
    historial:    { encabezado: 'TAB_HISTORIAL' },
    terceros:     { encabezado: 'TAB_TERCEROS' },
    entregas:     { encabezado: 'TAB_ENTREGAS', cuerpo: 'CUERPO_ENTREGAS' },
    banco:        { encabezado: 'TAB_BANCO', cuerpo: 'CUERPO_BANCO' },
    casos:        { encabezado: 'TAB_CASOS', cuerpo: 'CUERPO_CASOS' },
    responsables: { encabezado: 'TAB_RESPONSABLES', cuerpo: 'CUERPO_RESPONSABLES' },
    usuarios:     { encabezado: 'TAB_USUARIOS' },
    arqueos:      { encabezado: 'TAB_ARQUEOS' }
  };

  /** Columnas de la Relación por clave interna → texto del encabezado. */
  var COL_REL = {
    fecha: 'Fecha', soporte: 'N.° factura / soporte',
    tercero: 'Tercero del documento (vendedor)', nit: 'NIT / C.C.',
    descripcion: 'Descripción', categoria: 'Categoría', centro: 'Centro de costo',
    tipoSoporte: 'Tipo de soporte', medio: 'Medio de pago', ingreso: 'Ingreso',
    egreso: 'Egreso', revision: 'Revisión', recibio: 'Recibió el efectivo',
    estadoSoporte: 'Estado del soporte', cuenta: 'Cuenta contable (World Office)',
    retencion: 'Concepto de retención', plazo: 'Plazo DSE',
    nota: 'Nota para la contadora', deducible: '¿Deducible?',
    origen: 'Origen del ingreso', cliente: 'Cliente o pagador',
    recibo: 'N.° recibo de caja', factura: 'N.° factura que cruza',
    cruce: '¿Cruce aplicado en WO?', quien: 'Registrado por',
    cuando: 'Fecha y hora del registro'
  };

  /** Parámetros de la hoja Listas (rangos con nombre). */
  var PAR = {
    objetivo: 'PAR_OBJETIVO', minimo: 'PAR_MINIMO', topeGasto: 'PAR_TOPE_GASTO',
    topeEfectivo: 'PAR_TOPE_EFECTIVO', topePOS: 'PAR_TOPE_POS', plazoDSE: 'PAR_PLAZO_DSE',
    uvt: 'PAR_UVT', topeGlobal: 'PAR_TOPE_GLOBAL', nitGenerico: 'PAR_NIT_GENERICO',
    correoAux: 'PAR_CORREO_AUX', correoCtd: 'PAR_CORREO_CTD', correoGer: 'PAR_CORREO_GER'
  };

  /** Listas desplegables (rangos con nombre de una columna). */
  var LISTAS = {
    categorias: 'LISTA_CATEGORIAS', centros: 'LISTA_CENTROS', soportes: 'LISTA_SOPORTES',
    medios: 'LISTA_MEDIOS', benef: 'LISTA_RECIBIO', estados: 'LISTA_ESTADOS',
    cuentas: 'LISTA_CUENTAS', retenciones: 'LISTA_RETENCIONES',
    origenes: 'LISTA_ORIGENES', destinos: 'LISTA_DESTINOS'
  };

  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
    'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  var CARPETA_POR_SOPORTE = {
    'Factura electrónica': 'Factura electronica',
    'Documento equivalente electrónico (POS)': 'Documento equivalente y POS',
    'Documento equivalente (tiquete POS en papel)': 'Documento equivalente y POS',
    'Documento soporte (DSE)': 'Documento soporte DSE',
    'Recibo de caja / cuenta de cobro': 'Sin soporte - no deducible',
    'Sin soporte': 'Sin soporte - no deducible'
  };

  var DENOMINACIONES = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];

  /** Texto que se pone cuando el soporte no tiene número (no cuenta como repetido). */
  var SIN_NUMERO = 'S/N';

  var CLAVES = {
    libro: 'LIBRO_ID', raiz: 'CARPETA_RAIZ', respaldos: 'CARPETA_RESPALDOS',
    plantillas: 'CARPETA_PLANTILLAS', modo: 'MODO'
  };

  function propiedades_() { return PropertiesService.getScriptProperties(); }

  function leer(clave) {
    var v = propiedades_().getProperty(CLAVES[clave] || clave);
    if (!v) throw new Error('Falta configurar «' + clave + '». La dueña debe correr Caja menor › Instalar.');
    return v;
  }

  function leerOpcional(clave) { return propiedades_().getProperty(CLAVES[clave] || clave) || ''; }

  function guardar(valores) {
    var p = {};
    Object.keys(valores).forEach(function (k) { p[CLAVES[k] || k] = String(valores[k]); });
    propiedades_().setProperties(p);
  }

  function enProduccion() { return leerOpcional('modo') === 'PRODUCCION'; }

  return {
    ZONA: ZONA, VERSION_ESQUEMA: VERSION_ESQUEMA, HOJAS: HOJAS, TABLAS: TABLAS,
    COL_REL: COL_REL, PAR: PAR, LISTAS: LISTAS, MESES: MESES,
    CARPETA_POR_SOPORTE: CARPETA_POR_SOPORTE, DENOMINACIONES: DENOMINACIONES,
    SIN_NUMERO: SIN_NUMERO,
    leer: leer, leerOpcional: leerOpcional, guardar: guardar, enProduccion: enProduccion
  };
})();
