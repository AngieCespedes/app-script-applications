/**
 * LAS COLUMNAS DE LA HOJA 10.
 *
 * Aqui viven los numeros de columna que se le fueron agregando a la hoja
 * original, para que ningun modulo los escriba a mano. Las crea
 * gpMigrarColumnasOrdenes_ desde «Instalar o actualizar»; mientras no se
 * corra, ocCol_ y ocLeerCol_ devuelven vacio en vez de reventar.
 *
 * Regla: una columna nueva se agrega AL FINAL y se declara aqui. Nunca se
 * inserta una columna en la mitad — la hoja es la base de datos, y hay
 * formulas, filtros y vistas colgando de las posiciones que ya existen.
 */

/* Lo que registra almacen cuando llega la mercancia. */
var OC_ORD_COMO  = 41;   /* COMO LLEGO LA MERCANCIA */
var OC_ORD_FOTO  = 42;   /* FOTO DE LA LLEGADA */
var OC_ORD_OBSA  = 43;   /* OBSERVACION DE ALMACEN */
var OC_ORD_WO    = 44;   /* N° EN WORLD OFFICE */
/* Las de la revision de retencion, que hace tesoreria contra el RUT. */
var OC_ORD_DOCESP = 45;  /* QUE DOCUMENTO VA A DAR EL PROVEEDOR */
var OC_ORD_ASUME  = 46;  /* QUIEN ASUME LA RETENCION */
var OC_ORD_RETPOR = 47;  /* RETENCION REVISADA POR */
var OC_ORD_RETNOTA = 48; /* NOTA DE LA RETENCION */
/* Cuando tesoreria calcula pagarla, y que quiere que sepa quien la pidio. */
var OC_ORD_FPROY  = 49;  /* FECHA PROYECTADA DE PAGO */
var OC_ORD_NOTASOL = 50; /* NOTA PARA QUIEN PIDIO LA ORDEN */
/* El primer chequeo: compras mira la negociacion con el proveedor. */
var OC_ORD_DIASCR = 51;  /* DIAS DE CREDITO */
var OC_ORD_FVENCE = 52;  /* FECHA DE VENCIMIENTO */
var OC_ORD_REVCOM = 53;  /* REVISADA POR COMPRAS */
/* El cierre del ciclo: quien causa dice como quedo la orden. */
var OC_ORD_FACEST = 54;  /* ESTADO DE LA FACTURA */
var OC_ORD_FACPOR = 55;  /* FACTURA REGISTRADA POR */
var OC_ORD_FACFEC = 56;  /* FECHA DEL REGISTRO */
var OC_ORD_ANCHO  = 56;

/** Una celda de una fila ya leida, aunque la hoja no tenga todavia esa columna. */
function ocCol_(fila, n) {
  var v = fila[n - 1];
  return (v === undefined || v === null) ? '' : v;
}
