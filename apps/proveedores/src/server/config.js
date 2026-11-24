/** =========================================================
 *  EXTENSION COMERCIAL - SOCIAL SOLAR S.A.S. - nov 2026
 *  Un solo link: consulta el NIT y pide solo lo que falta.
 *  Escribe la negociacion en la hoja PROVEEDORES 2026.
 *  ========================================================= */

var SSV_PROV = '02 MAESTRO PROVEEDORES 2026';

var SSV_REG  = '01 REGISTRO Y DOCUMENTOS';

var SSV_RAIZ = Config_.id('SSV_RAIZ');

/*************************************************************
 * SOCIAL SOLAR S.A.S. — PORTAL DE ORDENES DE COMPRA
 * Hojas: 07 USUARIOS Y ROLES / 08 CENTROS DE COSTO
 *        09 CONCEPTOS Y RETENCIONES / 10 ORDENES DE COMPRA
 *        11 PAGOS Y SOPORTES / 12 TABLERO DE CONTROL
 *
 * Entrada al portal: usuario y contrasena de la hoja 07.
 * Quien administra usuarios y contrasenas es el rol ADMINISTRADOR.
 *************************************************************/

var OC_SS        = Config_.id('OC_SS');

var OC_H_USU     = '07 USUARIOS Y ROLES';

var OC_H_CEN     = '08 CENTROS DE COSTO';

var OC_H_CON     = '09 CONCEPTOS Y RETENCIONES';

var OC_H_ORD     = '10 ORDENES DE COMPRA';

var OC_H_PAG     = '11 PAGOS Y SOPORTES';

var OC_H_EXT     = '13 EXTRACTO BANCOS';

var OC_H_PROV    = '02 MAESTRO PROVEEDORES 2026';

var OC_RAIZ      = Config_.id('OC_RAIZ');

var OC_CARPETA   = 'ORDENES DE COMPRA';

var OC_SEP       = '\u0001';

/* Que puede hacer cada rol.
   vertodo  = ve todas las ordenes de la empresa
   verarea  = ve solo las ordenes de su propia area */
var OC_PERMISOS = {
  'ADMINISTRADOR': ['solicitar', 'aprobar', 'pagar', 'facturar', 'causar', 'vertodo', 'usuarios'],
  'GERENCIA':      ['aprobar', 'vertodo'],
  'TESORERIA':     ['pagar', 'vertodo'],
  'COMPRAS':       ['solicitar', 'facturar', 'vertodo'],
  'CONTABILIDAD':  ['causar', 'vertodo'],
  'SOLICITANTE':   ['solicitar', 'verarea']
};

/**
 * ============================================================
 *  VALIDADOR DE RUT – BASE DE DATOS PROVEEDORES
 *  Social Solar S.A.S.
 *
 *  - Lee el RUT (PDF o imagen) enlazado en la columna "RUT 2026"
 *  - Completa: FECHA RUT, Verif, Correo electronico, Responsabilidades
 *  - Escribe alertas en la columna "Observaciones" (se crea sola)
 *  - Crea / actualiza al proveedor en la hoja "Regimenes"
 *  - Se ejecuta solo cuando llega un formulario nuevo y cada 15 min
 *
 *  REQUISITO: Servicios (+) > "Drive API" activado (identificador: Drive)
 * ============================================================
 */

const CFG = {
  HOJA: '01 REGISTRO Y DOCUMENTOS',
  HOJA_REGIMENES: '05 REGIMENES TRIBUTARIOS',
  HOJA_DIAGNOSTICO: 'Diagnostico_RUT',
  MESES_VIGENCIA_RUT: 12,          // RUT generado hace más de N meses = desactualizado
  RUT_VENCIDO_ES_ERROR: true,      // true = Verif queda en FALSE si el RUT está desactualizado
  VALIDAR_CERTIFICACION: true,     // revisa que la certificación bancaria tenga el mismo NIT/CC
  MINUTOS_AUTOMATICO: 15,
  TIEMPO_MAX_MS: 4.5 * 60 * 1000,  // Apps Script corta a los 6 min
};

// Responsabilidades DIAN (texto como aparece en el RUT)
const RESP = {
  '01': 'Aporte especial para la administración de justicia',
  '02': 'Gravamen a los movimientos financieros',
  '03': 'Impuesto al patrimonio',
  '04': 'Impto renta y compl. régimen especial',
  '05': 'Impto. renta y compl. régimen ordinar',
  '06': 'Ingresos y patrimonio',
  '07': 'Retención en la fuente a título de rent',
  '08': 'Retención timbre nacional',
  '09': 'Retención en la fuente en el impuesto',
  '10': 'Obligado aduanero',
  '13': 'Gran contribuyente',
  '14': 'Informante de exogena',
  '15': 'Autorretenedor',
  '16': 'Obligación facturar por ingresos bienes',
  '17': 'Profesionales de compra y venta de divisas',
  '18': 'Precios de transferencia',
  '19': 'Productor de bienes y/o servicios exentos',
  '20': 'Obtención NIT',
  '21': 'Declarar ingreso o salida del país de divisas',
  '22': 'Obligado a cumplir deberes formales a',
  '23': 'Agente de retención en ventas',
  '24': 'Declaración consolidada precios de transf',
  '26': 'Declaración individual precios de tran',
  '32': 'Impuesto nacional a la gasolina y al ACPM',
  '33': 'Impuesto nacional al consumo',
  '36': 'Establecimiento permanente',
  '37': 'Obligado a facturar electrónicamente',
  '38': 'Facturación electrónica voluntaria',
  '39': 'Proveedor de servicios tecnológicos',
  '41': 'Declaración anual de activos en el exte',
  '42': 'Obligado a llevar contabilidad',
  '45': 'Autorretenedor de rendimientos financieros',
  '46': 'IVA prestadores de servicios desde el exterior',
  '47': 'Régimen Simple de Tributación',
  '48': 'Impuesto sobre las ventas - IVA',
  '49': 'No responsable de IVA',
  '50': 'No responsable de Consumo restaurantes',
  '51': 'Agente retención impoconsumo bienes inmuebles',
  '52': 'Facturador electrónico',
  '53': 'Persona jurídica no responsable de IVA',
  '55': 'Informante de Beneficiarios Finales',
};

const ENC_REGIMENES = ['NIT', 'NOMBRE', 'Ica Paipa', 'Paipa', '52 - Facturador electrónico',
  '05- Impto. renta y compl. régimen ordinar', '15- Autorretenedor', '47 - Régimen Simple de Tributación'];

const PENDIENTE = ['', 'NO ADJUNTO', 'ERROR DE LECTURA', 'NO DETECTADA'];

