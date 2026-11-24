/*************************************************************
 * TOMA FISICA DE INVENTARIO 2026 - FERTIAGRO ALARCON S.A.S.
 * NIT 901.999.718-5
 *************************************************************/

var SHEET_ID = Config_.id('SHEET_ID');

/* Los usuarios y sus PIN ya no están en el código: viven cifrados en la hoja oculta USUARIOS_APP (ver usuarios.js). */

var CUENTA   = { ALMACEN: true, AUDITOR: true, GERENCIA: true, ADMIN: true };

var VE_PANEL = { AUDITOR: true, GERENCIA: true, ADMIN: true };

var CARPETA_FOTOS = 'Fotos toma fisica 2026';

var TZ = 'America/Bogota';

var FILA_INI = 6;

var MAX_CONTEO = 2005;

var MIN_OCUPADA = 90;

