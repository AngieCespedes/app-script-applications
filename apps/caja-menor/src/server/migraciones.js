/**
 * Migraciones — llevan el libro a la versión de esquema que espera el código.
 * Cada paso es idempotente: se puede correr varias veces sin daño.
 * Regla: todo cambio de estructura del libro va aquí, como un paso nuevo, y sube Config.VERSION_ESQUEMA.
 */
var Migraciones = (function () {
  var DESC_PROTECCION = 'Caja menor v4 — estructura (no editar)';

  /** Rangos con nombre de la versión 1, tomados de las posiciones de la v3. Solo se crean si faltan. */
  var RANGOS_V1 = {
    REL_NUMERO: "'Relación'!C5", REL_FECHA: "'Relación'!E5", REL_RESPONSABLE: "'Relación'!H5",
    REL_DESDE: "'Relación'!C6", REL_HASTA: "'Relación'!E6", REL_SALDO_ANTERIOR: "'Relación'!H6",
    REL_ALERTAS: "'Relación'!K6", REL_INGRESOS: "'Relación'!K59", REL_EGRESOS: "'Relación'!L59",
    REL_SALDO_FINAL: "'Relación'!L63", REL_CONTADO: "'Relación'!L64", REL_DIFERENCIA: "'Relación'!L65",
    REL_ESTADO_ARQUEO: "'Relación'!L66", REL_ALERTA_SALDO: "'Relación'!L67",
    REL_ENCABEZADO: "'Relación'!B8:AA8", REL_DATOS: "'Relación'!B9:AA58",
    PAR_OBJETIVO: 'Listas!H2', PAR_MINIMO: 'Listas!H3', PAR_TOPE_GASTO: 'Listas!H4', PAR_TOPE_EFECTIVO: 'Listas!H5',
    PAR_TOPE_POS: 'Listas!H6', PAR_PLAZO_DSE: 'Listas!H7', PAR_UVT: 'Listas!H10', PAR_TOPE_GLOBAL: 'Listas!H11',
    PAR_NIT_GENERICO: 'Listas!H12', PAR_CORREO_AUX: 'Listas!H13', PAR_CORREO_CTD: 'Listas!H14', PAR_CORREO_GER: 'Listas!H15',
    LISTA_CATEGORIAS: 'Listas!A2:A60', LISTA_CENTROS: 'Listas!C2:C60', LISTA_SOPORTES: 'Listas!E2:E60',
    LISTA_MEDIOS: 'Listas!J2:J60', LISTA_RECIBIO: 'Listas!L2:L60', LISTA_ESTADOS: 'Listas!N2:N60',
    LISTA_CUENTAS: 'Listas!P2:P60', LISTA_RETENCIONES: 'Listas!R2:R60', LISTA_ORIGENES: 'Listas!T2:T60',
    LISTA_DESTINOS: 'Listas!V2:V60', RESP_HOY: 'Responsables!D2',
    ARQ_FECHA: 'Arqueo!B5', ARQ_CANTIDADES: 'Arqueo!B10:B19', ARQ_TOTAL: 'Arqueo!C21', ARQ_SISTEMA: 'Arqueo!C23',
    ARQ_ESTADO: 'Arqueo!C26', ARQ_CHECKLIST: 'Arqueo!E5:F13', ARQ_OBSERVACIONES: 'Arqueo!E16',
    ENT_PENDIENTE: 'Entregas!E47',
    TAB_MOVIMIENTOS: 'Movimientos!A1:AF1', TAB_HISTORIAL: 'Historial!A1:S1', TAB_TERCEROS: 'Terceros!A1:Q1',
    TAB_ENTREGAS: 'Entregas!A4:L4', CUERPO_ENTREGAS: 'Entregas!A5:L44', TAB_BANCO: 'Banco!A4:I4',
    CUERPO_BANCO: 'Banco!A5:I45', TAB_CASOS: 'Casos!A4:N4', CUERPO_CASOS: 'Casos!A5:N44',
    TAB_RESPONSABLES: 'Responsables!A5:N5', CUERPO_RESPONSABLES: 'Responsables!A6:N30',
    TAB_USUARIOS: 'Usuarios!A4:I4', TAB_ARQUEOS: 'Arqueos!A1:H1',
    TAB_SITUACION: 'Tablero!A5:B21', TAB_ALERTA: 'Tablero!D5:E13', TAB_SEMAFORO: 'Tablero!G5:G14', TAB_PASOS: 'Tablero!G17:G23',
    GES_ANIO: "'Gestión'!B4", GES_RESPONSABLE: "'Gestión'!B5", GES_INDICADORES: "'Gestión'!A8:D30", GES_NOTAS: "'Gestión'!F5:G19",
    POL_TABLA: "'Políticas'!B5:D22", POL_TOPES: "'Políticas'!B26:D31", POL_ANTES: "'Políticas'!F5:F11", POL_ERRORES: "'Políticas'!F14:F21",
    BZA_CONSULTA: "'Bancarización'!B25:B30", BZA_TERCEROS: "'Bancarización'!D6:D65"
  };

  function hojaNueva_(ss, nombre, encabezados, oculta) {
    var h = ss.getSheetByName(nombre);
    if (h) return h;
    h = ss.insertSheet(nombre);
    h.getRange(1, 1, 1, encabezados.length).setValues([encabezados])
      .setFontWeight('bold').setBackground('#1A1A1A').setFontColor('#FFFFFF');
    h.setFrozenRows(1);
    if (oculta) h.hideSheet();
    return h;
  }

  function rangosConNombre_(ss) {
    var existentes = ss.getNamedRanges().map(function (n) { return n.getName(); });
    Object.keys(RANGOS_V1).forEach(function (nombre) {
      if (existentes.indexOf(nombre) === -1) ss.setNamedRange(nombre, ss.getRange(RANGOS_V1[nombre]));
    });
  }

  function meta_(ss) {
    var h = hojaNueva_(ss, Config.HOJAS.meta, ['clave', 'valor'], true);
    if (!ss.getRangeByName('META_VERSION')) {
      h.getRange('A2').setValue('schema_version');
      ss.setNamedRange('META_VERSION', h.getRange('B2'));
    }
    return h;
  }

  function ejecutar() {
    var ss = Libro.abrir();
    var inicial = Esquema.versionDelLibro();
    meta_(ss);
    if (inicial < 1) {
      hojaNueva_(ss, Config.HOJAS.arqueos, ['Fecha y hora', 'N.° relación', 'Quién contó', 'Total contado',
        'Saldo según el sistema', 'Diferencia', 'Detalle', 'Observaciones'], false);
      rangosConNombre_(ss);
      MigracionV1.corregirFormulas(ss);
      MigracionV1.normalizarDatos(ss);
      MigracionV1.sacarNotasDeTablas();
    }
    proteger(ss);
    ss.getRangeByName('META_VERSION').setValue(Config.VERSION_ESQUEMA);
    SpreadsheetApp.flush();
    return { antes: inicial, ahora: Config.VERSION_ESQUEMA };
  }

  /** Protecciones estrictas (no solo aviso): encabezados de tablas, fórmulas y _meta. Solo la dueña edita. */
  function proteger(ss) {
    ss.getProtections(SpreadsheetApp.ProtectionType.RANGE).concat(ss.getProtections(SpreadsheetApp.ProtectionType.SHEET))
      .forEach(function (p) {
        var d = p.getDescription();
        if (d === DESC_PROTECCION || d === 'Fórmula de la caja menor') p.remove();
      });
    var rangos = Object.keys(Config.TABLAS).map(function (k) { return ss.getRangeByName(Config.TABLAS[k].encabezado); });
    var rel = ss.getSheetByName(Config.HOJAS.relacion);
    ['M9:M58', 'R9:R58', 'T9:T58', 'K59:L67', 'H5', 'K6'].forEach(function (a1) { rangos.push(rel.getRange(a1)); });
    rangos.forEach(function (r) { soloDuena_(r.protect()); });
    soloDuena_(ss.getSheetByName(Config.HOJAS.meta).protect());
  }

  function soloDuena_(p) {
    p.setDescription(DESC_PROTECCION).setWarningOnly(false);
    var yo = Session.getEffectiveUser();
    p.addEditor(yo);
    p.removeEditors(p.getEditors().filter(function (u) { return u.getEmail() !== yo.getEmail(); }));
    if (p.canDomainEdit()) p.setDomainEdit(false);
  }

  return { ejecutar: ejecutar, proteger: proteger, RANGOS_V1: RANGOS_V1 };
})();
