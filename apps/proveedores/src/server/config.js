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
   vertodo     = ve todas las ordenes de la empresa
   verarea     = ve solo las ordenes de su propia area
   verequipo   = ve todas las ordenes de su area aunque las pidan otros (lider)
   proveedores = gestiona el maestro: pide documentos, negociacion, estados de cuenta
   verproveedor= ve RUT, certificacion y negociacion, sin poder cambiarlos
   almacen     = confirma como llego la mercancia
   verpagos    = ve los pagos y descarga soportes, sin poder tocarlos
   informes    = descarga en Excel o PDF lo que esa persona ve */
var OC_PERMISOS = {
  'ADMINISTRADOR':     ['solicitar', 'aprobar', 'pagar', 'facturar', 'causar', 'almacen',
                        'proveedores', 'verproveedor', 'verpagos', 'vertodo', 'informes', 'usuarios'],
  'GERENTE':           ['solicitar', 'aprobar', 'verproveedor', 'verpagos', 'vertodo', 'informes'],
  'GERENCIA':          ['solicitar', 'aprobar', 'verproveedor', 'verpagos', 'vertodo', 'informes'],
  'TESORERIA':         ['pagar', 'verproveedor', 'vertodo', 'informes'],
  'COMPRAS':           ['solicitar', 'facturar', 'almacen', 'proveedores', 'verproveedor',
                        'verpagos', 'vertodo', 'informes'],
  'CONTABILIDAD':      ['causar', 'verproveedor', 'vertodo', 'informes'],
  'LIDER AREA':        ['solicitar', 'verequipo', 'verpagos', 'informes'],
  'INGENIERIA':        ['solicitar', 'informes'],
  'COMERCIAL':         ['solicitar', 'informes'],
  'HSE':               ['solicitar', 'informes'],
  'SOLICITANTE':       ['solicitar', 'informes']
};

/**
 * Contrasenas a la vista.
 * true  = se quedan tal como esten escritas en la hoja 07, para poder
 *         consultarlas. Es lo que pidio la duena.
 * false = la primera vez que la persona entra, su clave se cifra sola y ya
 *         nadie la puede leer, ni siquiera la duena.
 *
 * OJO: con esto en true, cualquiera que pueda abrir el libro lee todas las
 * claves y puede entrar como cualquier persona. Mientras el libro siga
 * compartido «con el enlace», eso incluye a cualquiera que tenga el enlace.
 */
var OC_CLAVES_A_LA_VISTA = true;

/* Hoja 07: columnas. A..J venian de antes; de la K en adelante son nuevas.
   OC_USU_PERM es donde empieza una columna por permiso. */
var OC_USU_CED   = 11;   /* CEDULA */
var OC_USU_PERM  = 12;   /* primera columna de permisos */

/* Los permisos que la duena marca persona por persona.
   [clave, nombre en pantalla, que significa] */
var OC_PERMISOS_LISTA = [
  ['solicitar',    'Pedir compras',        'Crear ordenes de compra y ver las suyas.'],
  ['aprobar',      'Aprobar',              'Aprobar o rechazar las ordenes que esperan decision.'],
  ['pagar',        'Pagar',                'Registrar pagos y subir soportes. Es de tesoreria.'],
  ['facturar',     'Registrar factura',    'Anotar la factura del proveedor y el numero de World Office.'],
  ['almacen',      'Confirmar llegada',    'Decir como llego la mercancia y subir la foto.'],
  ['causar',       'Causar',               'Marcar la orden como causada en World Office.'],
  ['proveedores',  'Gestionar proveedores','Completar datos y pedirle documentos a los proveedores.'],
  ['verproveedor', 'Ver proveedores',      'Consultar RUT, certificacion y negociacion, sin cambiar nada.'],
  ['verpagos',     'Ver pagos',            'Consultar pagos y descargar soportes, sin tocarlos.'],
  ['verequipo',    'Ver toda su area',     'Ver las ordenes de su area, aunque las pidan otros.'],
  ['vertodo',      'Ver toda la empresa',  'Ver las ordenes de todas las areas.'],
  ['informes',     'Descargar informes',   'Bajar en Excel o PDF lo que esa persona ve.'],
  ['usuarios',     'Administrar usuarios', 'Crear personas, cambiar claves y dar permisos.']
];

var OC_USU_ANCHO = OC_USU_PERM + OC_PERMISOS_LISTA.length - 1;   /* 24 */

/* Hojas nuevas del gestor de proveedores */
var OC_H_SOL     = '14 SOLICITUDES A PROVEEDORES';
var OC_H_EDO     = '15 ESTADOS DE CUENTA';
var OC_H_MEJ     = '16 MEJORAS Y FALLAS';

/* Dias habiles que se esperan antes de marcar vencida una solicitud */
var OC_DIAS_SOL  = 5;

/**
 * Videos de capacitacion (carpeta 01 APLICACION / VIDEOS DE CAPACITACION).
 * Se ven dentro del portal, sin descargar nada. A cada persona le salen los
 * que le sirven segun lo que puede hacer, no segun el nombre de su rol: si
 * manana le da el permiso de pagar a alguien, le aparece el video del tema.
 */
var OC_VIDEOS = {
  carpeta: 'https://drive.google.com/drive/folders/14DEKHe8yvU1qdwdey33-v4og802ctbQb',
  proveedor: { id: '1WfEPoKK-1sQfYBAeehLHxiGRQ6nUEWC5',
               titulo: 'Como registrarse como proveedor',
               dura: '5 minutos' },
  lista: [
    { id: '14-IKMWUTp3ecwhlSiSgeqoRCv2VtZzVx',
      titulo: '1 — Como pedir una compra',
      dura: '9 minutos',
      para: 'Para quien pide compras y para gerencia.',
      cuando: ['solicitar', 'aprobar'] },
    { id: '1EHYa1jTXy-NTmGiJHapQs8_k7bBnZx3w',
      titulo: '2 — Como funciona por dentro',
      dura: '12 minutos',
      para: 'Para tesoreria, compras y contabilidad.',
      cuando: ['pagar', 'facturar', 'causar', 'almacen'] },
    { id: '1i-MQIIZOVVdBDn0Qki8y9rxfSo7p4HpC',
      titulo: '4 — El gestor de proveedores',
      dura: '11 minutos',
      para: 'Para compras: proveedores, facturas, almacen e informes.',
      cuando: ['proveedores'] }
  ]
};

/** Los videos que le sirven a una persona, por lo que puede hacer. */
function ocVideosDe_(u) {
  var out = [];
  OC_VIDEOS.lista.forEach(function (v) {
    for (var i = 0; i < v.cuando.length; i++) {
      if (ocPuede_(u, v.cuando[i])) { out.push(v); return; }
    }
  });
  /* Si por lo que sea no le toca ninguno, al menos el primero. */
  return out.length ? out : [OC_VIDEOS.lista[0]];
}

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

