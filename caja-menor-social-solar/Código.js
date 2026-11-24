/**
 * ============================================================
 *  CAJA MENOR — SOCIAL SOLAR S.A.S.  ·  versión 3
 *  Va con el libro "CAJA MENOR SOCIAL SOLAR V3" en Google Sheets.
 * ------------------------------------------------------------
 *  No hay usuario ni contraseña propios: la persona entra con su
 *  cuenta de Google y el sistema le da el rol según su correo.
 * ============================================================
 */

const ZONA = 'America/Bogota';

const CARPETA_RAIZ   = '15FQKe2-j0Yt3ifax33j8Kms3ek-WGipu';
const CARPETA_ANIOS  = '19fUxNgSzW3WdbbX37YbuSz5-aOBsQPzu';
const CARPETA_RESP   = '190ZIIFJulBL_V8P-RD6ZM_g8p3rsufsE';

/* El libro, abierto por identificador: una pagina web no tiene "hoja activa". */
const LIBRO_ID = '1_U-CdTkIN4sfJxqdRHLopepy9FTTpXR20B_wIJHOAuM';
const CARPETA_PLANTILLAS = '165odhmVLTVatbwEstZfq3Ei7j-_vlXw2';
function libro_(){ return SpreadsheetApp.openById(LIBRO_ID); }

const H_REL='Relación', H_LIS='Listas', H_RESP='Responsables', H_MOV='Movimientos',
      H_HIS='Historial', H_TER='Terceros', H_ENT='Entregas', H_BAN='Banco',
      H_CAS='Casos', H_BZA='Bancarización', H_ARQ='Arqueo',
      H_POL='Políticas', H_TAB='Tablero', H_GES='Gestión';

const REL = {
  numero:'C5', fecha:'E5', responsable:'H5',
  desde:'C6',  hasta:'E6', saldoAnterior:'H6', alertas:'K6',
  ingresos:'K59', egresos:'L59', saldoFinal:'L63',
  contado:'L64', diferencia:'L65', estadoArqueo:'L66', alertaSaldo:'L67'
};
const FILA_INI = 9, FILA_FIN = 58, N_COLS = 25;

const PAR = {
  objetivo:'H2', minimo:'H3', topeGasto:'H4', topeEfectivo:'H5', topePOS:'H6',
  plazoDSE:'H7', uvt:'H10', topeGlobal:'H11', nitGenerico:'H12',
  correoAux:'H13', correoCtd:'H14', correoGer:'H15'
};

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const CARPETA_POR_SOPORTE = {
  'Factura electrónica'                          : 'Factura electronica',
  'Documento equivalente electrónico (POS)'      : 'Documento equivalente y POS',
  'Documento equivalente (tiquete POS en papel)' : 'Documento equivalente y POS',
  'Documento soporte (DSE)'                      : 'Documento soporte DSE',
  'Recibo de caja / cuenta de cobro'             : 'Sin soporte - no deducible',
  'Sin soporte'                                  : 'Sin soporte - no deducible'
};

/* ========================== MENÚ ========================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Caja menor')
    .addItem('Abrir panel', 'abrirPanel')
    .addSeparator()
    .addItem('Revisar la relación', 'revisarRelacion')
    .addItem('Cerrar y entregar la relación', 'abrirCierre')
    .addSeparator()
    .addItem('Revisar el saldo y avisar', 'revisarSaldoYAvisar')
    .addItem('Generar respaldo del mes', 'respaldoDelMes')
    .addSeparator()
    .addItem('Configurar (primera vez)', 'configurar')
    .addToUi();
}

function abrirPanel() {
  const html = HtmlService.createHtmlOutputFromFile('Panel').setTitle('Caja menor');
  SpreadsheetApp.getUi().showSidebar(html);
}

function abrirCierre() {
  const html = HtmlService.createHtmlOutputFromFile('Cierre').setWidth(900).setHeight(620);
  SpreadsheetApp.getUi().showModalDialog(html, 'Entregar la relación');
}

/* ======================= CONFIGURAR ======================= */

function configurar() {
  const ss = libro_();
  const ui = SpreadsheetApp.getUi();
  ss.setSpreadsheetTimeZone(ZONA);

  const rel = hoja_(H_REL);
  rel.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) {
    if (p.getDescription() === 'Fórmula de la caja menor') p.remove();
  });
  ['M9:M58','R9:R58','T9:T58','K59:L59','L60:L63','L65:L67','H5','K6'].forEach(function (a1) {
    rel.getRange(a1).protect().setDescription('Fórmula de la caja menor').setWarningOnly(true);
  });

  carpetaDelMes_(new Date());

  ui.alert('Caja menor',
    'Listo.\n\n' +
    '1. Revise en la hoja Responsables quién tiene la caja hoy.\n' +
    '2. Revise en Listas los topes y los correos.\n' +
    '3. Use Caja menor > Abrir panel para trabajar.\n\n' +
    'Para que los avisos de saldo salgan solos, cree un activador diario\n' +
    'sobre la función revisarSaldoYAvisar.', ui.ButtonSet.OK);
}

/* ===================== ROL DE QUIEN ENTRA ===================== */

function rolActual_() {
  const li = hoja_(H_LIS);
  const yo = (Session.getActiveUser().getEmail() || '').toLowerCase().trim();
  const correo = function (c) { return String(li.getRange(c).getValue() || '').toLowerCase().trim(); };
  if (yo && yo === correo(PAR.correoCtd)) return 'contadora';
  if (yo && yo === correo(PAR.correoGer)) return 'gerencia';
  return 'auxiliar';
}

function responsableHoy_() {
  return hoja_(H_RESP).getRange('D2').getDisplayValue() || 'Sin definir';
}

/* ====================== DATOS DEL PANEL ====================== */

function panelDatos() {
  const rel = hoja_(H_REL), li = hoja_(H_LIS);
  SpreadsheetApp.flush();

  const col = function (letra, hasta) {
    return li.getRange(letra + '2:' + letra + (hasta || 40)).getValues()
             .map(function (f) { return String(f[0]).trim(); }).filter(String);
  };
  const num = function (c) { return Number(li.getRange(c).getValue()) || 0; };

  const saldo = Number(rel.getRange(REL.saldoFinal).getValue()) || 0;
  const objetivo = num(PAR.objetivo), minimo = num(PAR.minimo);

  return {
    rol: rolActual_(), responsable: responsableHoy_(),
    numero: rel.getRange(REL.numero).getValue(),
    desde: rel.getRange(REL.desde).getDisplayValue(),
    saldo: saldo, saldoTxt: pesos_(saldo),
    objetivo: objetivo, minimo: minimo,
    excedente: saldo > objetivo ? saldo - objetivo : 0,
    reembolso: saldo < minimo ? objetivo - saldo : 0,
    alertas: rel.getRange(REL.alertas).getDisplayValue(),
    libres: filasLibres_(rel).length,
    topeGasto: num(PAR.topeGasto), topeEfectivo: num(PAR.topeEfectivo),
    topePOS: num(PAR.topePOS), plazoDSE: num(PAR.plazoDSE),
    categorias: col('A'), centros: col('C'), soportes: col('E'),
    medios: col('J'), benef: col('L'), estados: col('N'),
    cuentas: col('P'), retenciones: col('R'), origenes: col('T'),
    destinos: col('V', 20),
    pendientes: pendientesDSE_().length
  };
}

/* ======================= REGISTRAR PAGO ======================= */

function guardarPago(d) {
  const candado = LockService.getDocumentLock();
  if (!candado.tryLock(30000)) throw new Error('Otra persona está escribiendo en la caja.');
  try {
    const rel = hoja_(H_REL);
    const libres = filasLibres_(rel);
    if (!libres.length) throw new Error('La relación ya no tiene filas libres. Ciérrela para abrir la siguiente.');
    const fila = libres[0];

    const valor = entero_(d.valor);
    if (!(valor > 0)) throw new Error('Escriba el valor del pago.');

    let urlSoporte = '';
    if (d.archivo && d.archivo.base64) {
      urlSoporte = guardarSoporte_(d.archivo, aFecha_(d.fecha) || new Date(),
        '01 SOPORTES DE EGRESOS',
        CARPETA_POR_SOPORTE[d.tipoSoporte] || 'Sin soporte - no deducible',
        nombreArchivo_(d.fecha, d.proveedor, d.soporte));
    }

  escribirRelacion_(rel, fila, [
    aFecha_(d.fecha) || '', txt_(d.soporte, 40),
    txt_(d.proveedor, 120).toUpperCase(), txt_(d.nit, 20),
    txt_(d.descripcion, 200), txt_(d.categoria, 60), txt_(d.centro, 60),
    txt_(d.tipoSoporte, 60), txt_(d.medio, 60),
    '', valor, '',
    txt_(d.beneficiario, 60), txt_(d.estadoSoporte, 80),
    txt_(d.cuenta, 60), txt_(d.retencion, 60), '',
    txt_(d.nota, 300), '', '', '', '', '', ''
  ]);

    sellar_(rel, fila, d.quien);
    if (urlSoporte) enlazar_(rel, fila, 3, txt_(d.soporte, 40) || 'Ver soporte', urlSoporte);
    if (d.nit || d.proveedor) guardarTercero_(d);
    if (/no se pudo|no quiso/i.test(String(d.estadoSoporte || ''))) abrirCaso_(fila, d, valor);

    SpreadsheetApp.flush();
    return {
      fila: fila, n: fila - FILA_INI + 1,
      revision: rel.getRange(fila, 13).getDisplayValue(),
      plazo: rel.getRange(fila, 18).getDisplayValue(),
      deducible: rel.getRange(fila, 20).getDisplayValue(),
      panel: panelDatos()
    };
  } finally { candado.releaseLock(); }
}

/* ====================== REGISTRAR INGRESO ====================== */

function guardarIngreso(d) {
  const candado = LockService.getDocumentLock();
  if (!candado.tryLock(30000)) throw new Error('Otra persona está escribiendo en la caja.');
  try {
    const rel = hoja_(H_REL);
    const libres = filasLibres_(rel);
    if (!libres.length) throw new Error('La relación ya no tiene filas libres.');
    const fila = libres[0];

    const valor = entero_(d.valor);
    if (!(valor > 0)) throw new Error('Escriba el valor recibido.');

    const esCliente = /cliente/i.test(String(d.origen || ''));
    if (esCliente) {
      if (!txt_(d.cliente, 120))     throw new Error('Falta el nombre del cliente.');
      if (!txt_(d.reciboCaja, 40))   throw new Error('Falta el N.° de recibo de caja.');
      if (!txt_(d.facturaCruza, 40)) throw new Error('Falta la factura que cruza.');
    }

    let urlSoporte = '';
    if (d.archivo && d.archivo.base64) {
      urlSoporte = guardarSoporte_(d.archivo, aFecha_(d.fecha) || new Date(),
        '02 SOPORTES DE INGRESOS',
        esCliente ? 'Recaudos de clientes' : 'Reposiciones del banco',
        nombreArchivo_(d.fecha, d.cliente || d.origen, d.reciboCaja || d.soporte));
    }

  escribirRelacion_(rel, fila, [
    aFecha_(d.fecha) || '', txt_(d.soporte, 40),
    txt_(d.cliente, 120).toUpperCase(), txt_(d.nit, 20),
    txt_(d.descripcion, 200), txt_(d.categoria, 60), txt_(d.centro, 60),
    txt_(d.tipoSoporte, 60), txt_(d.medio, 60),
    valor, '', '', '', '', '', '', '', '', '',
    txt_(d.origen, 60), txt_(d.cliente, 120), txt_(d.reciboCaja, 40),
    txt_(d.facturaCruza, 40), txt_(d.cruceAplicado, 20) || 'Pendiente'
  ]);

    sellar_(rel, fila, d.quien);
    if (urlSoporte) enlazar_(rel, fila, 3, txt_(d.soporte, 40) || 'Ver soporte', urlSoporte);

    if (/banco/i.test(String(d.origen || ''))) {
      escribirAlFinal_(hoja_(H_BAN), [[
        aFecha_(d.fecha) || new Date(), 'Retiro del banco para reponer caja',
        txt_(d.soporte, 40), valor, responsableHoy_(),
        rel.getRange(REL.numero).getValue(), urlSoporte ? 'Sí' : 'No',
        'Pendiente', txt_(d.descripcion, 200)
      ]], 5);
    }

    SpreadsheetApp.flush();
    return { fila: fila, n: fila - FILA_INI + 1,
             revision: rel.getRange(fila, 13).getDisplayValue(), panel: panelDatos() };
  } finally { candado.releaseLock(); }
}

/* ===================== ENTREGAR EFECTIVO ===================== */

function guardarEntrega(d) {
  const candado = LockService.getDocumentLock();
  if (!candado.tryLock(30000)) throw new Error('Otra persona está escribiendo en la caja.');
  try {
    const valor = entero_(d.valor);
    if (!(valor > 0)) throw new Error('Escriba el valor entregado.');
    if (!txt_(d.destino, 120)) throw new Error('Elija a dónde va el efectivo.');

    const rel = hoja_(H_REL);
    const saldo = Number(rel.getRange(REL.saldoFinal).getValue()) || 0;
    if (valor > saldo) throw new Error('En caja hay ' + pesos_(saldo) + ' y está entregando ' + pesos_(valor) + '.');

    const ent = hoja_(H_ENT);
    const consecutivo = 'EE-' + ('0000' + (contarFilas_(ent, 5) + 1)).slice(-4);
    const ahora = new Date();
    const esBanco = /banco|consignaci/i.test(d.destino);

    let urlSoporte = '';
    if (d.archivo && d.archivo.base64) {
      urlSoporte = guardarSoporte_(d.archivo, ahora,
        '03 SOPORTES DE ENTREGAS DE EFECTIVO', null,
        nombreArchivo_(isoFecha_(ahora), consecutivo, limpiar_(d.destino)));
    }

    escribirAlFinal_(ent, [[
      consecutivo, ahora, txt_(d.quien, 80) || responsableHoy_(), txt_(d.destino, 120), valor,
      txt_(d.concepto, 200), txt_(d.centro, 60),
      urlSoporte ? 'Foto adjunta' : 'Pendiente',
      esBanco ? 'Sí' : 'Por confirmar',
      esBanco ? ahora : '', rel.getRange(REL.numero).getValue(), ''
    ]], 5);

    const libres = filasLibres_(rel);
    if (libres.length) {
      const fila = libres[0];
    escribirRelacion_(rel, fila, [
      soloFecha_(ahora), consecutivo, txt_(d.destino, 120).toUpperCase(), '',
      txt_(d.concepto, 200) || 'Entrega de efectivo',
      'Entrega de efectivo', txt_(d.centro, 60) || 'Administración',
      'Formato interno (entrega de efectivo)', 'Efectivo (billetes y monedas)',
      '', valor, '', txt_(d.destino, 60), 'Ya tiene soporte válido',
      '110510 · Caja menor', 'No aplica (cuantía menor)', '',
      'Entrega de efectivo ' + consecutivo, '', '', '', '', '', ''
    ]);
      sellar_(rel, fila, d.quien);
      if (urlSoporte) enlazar_(rel, fila, 3, consecutivo, urlSoporte);
    }

    if (esBanco) {
      escribirAlFinal_(hoja_(H_BAN), [[
        ahora, 'Consignación del excedente de caja', consecutivo, valor,
        responsableHoy_(), rel.getRange(REL.numero).getValue(),
        urlSoporte ? 'Sí' : 'No', 'Pendiente', txt_(d.concepto, 200)
      ]], 5);
    }

    SpreadsheetApp.flush();
    return { consecutivo: consecutivo, url: urlSoporte, panel: panelDatos() };
  } finally { candado.releaseLock(); }
}

/* ========================== ARQUEO ========================== */

function guardarArqueo(conteo, observaciones) {
  const arq = hoja_(H_ARQ);
  const DEN = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];
  DEN.forEach(function (d, i) {
    arq.getRange(10 + i, 2).setValue(Number(conteo[String(d)]) || '');
  });
  arq.getRange('B5').setValue(soloFecha_(new Date()));
  if (observaciones) arq.getRange('E16').setValue(txt_(observaciones, 400));
  SpreadsheetApp.flush();

  const total = Number(arq.getRange('C21').getValue()) || 0;
  const sistema = Number(arq.getRange('C23').getValue()) || 0;
  return {
    total: total, totalTxt: pesos_(total),
    sistema: sistema, sistemaTxt: pesos_(sistema),
    diferencia: total - sistema, diferenciaTxt: pesos_(Math.abs(total - sistema)),
    estado: arq.getRange('C26').getDisplayValue(),
    checklist: arq.getRange('E5:F13').getDisplayValues()
                  .filter(function (f) { return f[0]; })
                  .map(function (f) { return { texto: f[0], estado: f[1] }; }),
    panel: panelDatos()
  };
}

/* ====================== REVISAR Y CERRAR ====================== */

function revisar_() {
  const rel = hoja_(H_REL);
  SpreadsheetApp.flush();
  const datos    = rel.getRange(FILA_INI, 2, FILA_FIN - FILA_INI + 1, N_COLS - 1).getValues();
  const revision = rel.getRange(FILA_INI, 13, FILA_FIN - FILA_INI + 1, 1).getDisplayValues();
  const plazos   = rel.getRange(FILA_INI, 18, FILA_FIN - FILA_INI + 1, 1).getDisplayValues();

  const lineas = [], errores = [], avisos = [];
  datos.forEach(function (f, i) {
    if (f.every(function (v) { return v === '' || v === null; })) return;
    const nota = String(revision[i][0] || '');
    if (nota && nota.indexOf('OK') !== 0) errores.push('Fila ' + (i + 1) + ': ' + nota);
    if (String(plazos[i][0]) === 'VENCIDO') errores.push('Fila ' + (i + 1) + ': el DSE está vencido');
    if (nota.indexOf('no deducible') > -1) avisos.push('Fila ' + (i + 1) + ': gasto no deducible');
    lineas.push({ n: i + 1, fila: FILA_INI + i, valores: f, revision: nota });
  });

  if (!lineas.length) errores.push('La relación no tiene movimientos.');
  if (responsableHoy_() === 'Sin definir')
    errores.push('No hay responsable de la caja: revise la hoja Responsables.');

  const sinConfirmar = Number(hoja_(H_ENT).getRange('E47').getValue()) || 0;
  if (sinConfirmar > 0) errores.push('Hay ' + pesos_(sinConfirmar) + ' en entregas sin confirmar.');

  const casos = contarTexto_(hoja_(H_CAS), 'N5:N44', 'PENDIENTE');
  if (casos > 0) avisos.push(casos + ' caso(s) esperan decisión de la contadora.');

  const contado = rel.getRange(REL.contado).getValue();
  const saldoFinal = Number(rel.getRange(REL.saldoFinal).getValue()) || 0;
  if (contado === '' || contado === null) avisos.push('No se ha hecho el arqueo.');
  else if (Math.abs(Number(contado) - saldoFinal) >= 1)
    avisos.push('El arqueo no cuadra: ' + rel.getRange(REL.estadoArqueo).getDisplayValue() + '.');

  return { numero: rel.getRange(REL.numero).getValue(), lineas: lineas,
           errores: errores, avisos: avisos,
           saldoFinal: saldoFinal, saldoTxt: pesos_(saldoFinal) };
}

function revisarRelacion() {
  const r = revisar_(), ui = SpreadsheetApp.getUi();
  if (!r.errores.length && !r.avisos.length) {
    ui.alert('Relación N.° ' + r.numero,
      'Todo en orden: ' + r.lineas.length + ' movimientos, saldo final ' + r.saldoTxt + '.',
      ui.ButtonSet.OK);
    return;
  }
  let t = '';
  if (r.errores.length) t += 'Corregir antes de cerrar:\n' + r.errores.join('\n') + '\n\n';
  if (r.avisos.length)  t += 'Tener en cuenta:\n' + r.avisos.join('\n');
  ui.alert('Relación N.° ' + r.numero, t.trim(), ui.ButtonSet.OK);
}

function datosCierre() {
  const r = revisar_(), rel = hoja_(H_REL), li = hoja_(H_LIS);
  return {
    numero: r.numero,
    desde: rel.getRange(REL.desde).getDisplayValue(),
    hasta: rel.getRange(REL.hasta).getDisplayValue(),
    responsable: responsableHoy_(),
    saldoAnterior: pesos_(rel.getRange(REL.saldoAnterior).getValue()),
    ingresos: pesos_(rel.getRange(REL.ingresos).getValue()),
    egresos: pesos_(rel.getRange(REL.egresos).getValue()),
    saldoFinal: r.saldoTxt,
    contado: rel.getRange(REL.contado).getDisplayValue(),
    estadoArqueo: rel.getRange(REL.estadoArqueo).getDisplayValue(),
    movimientos: r.lineas.length,
    errores: r.errores, avisos: r.avisos,
    correoGer: li.getRange(PAR.correoGer).getDisplayValue(),
    correoCtd: li.getRange(PAR.correoCtd).getDisplayValue()
  };
}

function cerrarRelacion(desde, hasta, modo, paraQuien) {
  const candado = LockService.getDocumentLock();
  if (!candado.tryLock(60000)) throw new Error('Otra persona está cerrando la caja.');
  try {
    const ss = libro_();
    const rel = hoja_(H_REL), mov = hoja_(H_MOV), his = hoja_(H_HIS);
    const r = revisar_();
    if (r.errores.length) throw new Error('Falta corregir:\n\n' + r.errores.join('\n'));

    const d1 = aFecha_(desde), d2 = aFecha_(hasta);
    if (!d1 || !d2) throw new Error('Indique la fecha inicial y la fecha final.');
    if (d2 < d1) throw new Error('La fecha final es anterior a la inicial.');
    rel.getRange(REL.desde).setValue(d1);
    rel.getRange(REL.hasta).setValue(d2);
    SpreadsheetApp.flush();

    const cab = {
      numero: r.numero, responsable: responsableHoy_(),
      saldoAnterior: Number(rel.getRange(REL.saldoAnterior).getValue()) || 0,
      ingresos: Number(rel.getRange(REL.ingresos).getValue()) || 0,
      egresos: Number(rel.getRange(REL.egresos).getValue()) || 0,
      saldoFinal: r.saldoFinal,
      contado: rel.getRange(REL.contado).getValue(),
      diferencia: rel.getRange(REL.diferencia).getValue()
    };

    const pdf = crearPdf_(ss, rel, cab, d1, d2);
    const urlPdf = pdf.getUrl();
    const ahora = new Date();

    const filas = r.lineas.map(function (l) {
      const v = l.valores, f = v[0];
      return [cab.numero, l.n].concat(v.slice(0, 19))
        .concat([f instanceof Date ? f.getFullYear() : '',
                 f instanceof Date ? f.getMonth() + 1 : '',
                 l.revision, ahora, ''])
        .concat(v.slice(19, 24)).concat([cab.responsable]);
    });
    escribirAlFinal_(mov, filas, 2);

    escribirAlFinal_(his, [[
      cab.numero, ahora, d1, d2, cab.responsable, cab.saldoAnterior,
      cab.ingresos, cab.egresos, cab.saldoFinal, cab.contado, cab.diferencia,
      r.lineas.length, '', modo === 'digital' ? 'Digital' : 'Física',
      '', '', urlPdf, carpetaDelMes_(d2).getUrl(), ''
    ]], 2);

    let enviado = '';
    if (modo === 'digital') {
      const para = String(paraQuien || hoja_(H_LIS).getRange(PAR.correoGer).getDisplayValue()).trim();
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) {
        MailApp.sendEmail({
          to: para,
          cc: hoja_(H_LIS).getRange(PAR.correoCtd).getDisplayValue(),
          subject: 'Caja menor — relación N.° ' + cab.numero + ' para aprobación',
          htmlBody:
            '<p>Se cerró la relación de caja menor N.° <b>' + cab.numero + '</b>.</p>' +
            tabla_([
              ['Responsable', cab.responsable],
              ['Periodo', fmt_(d1) + ' a ' + fmt_(d2)],
              ['Saldo anterior', pesos_(cab.saldoAnterior)],
              ['Ingresos', pesos_(cab.ingresos)],
              ['Egresos', pesos_(cab.egresos)],
              ['Saldo final', pesos_(cab.saldoFinal)],
              ['Efectivo contado', cab.contado === '' ? 'Sin arqueo' : pesos_(cab.contado)],
              ['Movimientos', r.lineas.length]
            ]) +
            '<p>El PDF va adjunto. <a href="' + urlPdf + '">Verlo en Drive</a></p>',
          attachments: [pdf.getBlob()]
        });
        enviado = para;
      }
    }

    rel.getRange(FILA_INI, 2, FILA_FIN - FILA_INI + 1, N_COLS - 1).clearContent();
    rel.getRange(REL.numero).setValue(Number(cab.numero) + 1);
    rel.getRange(REL.fecha).setValue(soloFecha_(ahora));
    rel.getRange(REL.desde).setValue(sumarDias_(d2, 1));
    rel.getRange(REL.hasta).clearContent();
    rel.getRange(REL.saldoAnterior).setValue(cab.saldoFinal);
    hoja_(H_ARQ).getRange('B10:B19').clearContent();
    SpreadsheetApp.flush();

    return { numero: cab.numero, siguiente: Number(cab.numero) + 1,
             url: urlPdf, enviado: enviado,
             movimientos: r.lineas.length, saldo: pesos_(cab.saldoFinal) };
  } finally { candado.releaseLock(); }
}

/* =================== ALERTAS DE SALDO =================== */

function revisarSaldoYAvisar() {
  const rel = hoja_(H_REL), li = hoja_(H_LIS);
  SpreadsheetApp.flush();
  const saldo = Number(rel.getRange(REL.saldoFinal).getValue()) || 0;
  const objetivo = Number(li.getRange(PAR.objetivo).getValue()) || 0;
  const minimo = Number(li.getRange(PAR.minimo).getValue()) || 0;
  const aux = li.getRange(PAR.correoAux).getDisplayValue();
  const ctd = li.getRange(PAR.correoCtd).getDisplayValue();
  const ger = li.getRange(PAR.correoGer).getDisplayValue();

  let tipo = '';
  if (saldo > objetivo) tipo = 'alto';
  else if (saldo < minimo) tipo = 'bajo';
  if (!tipo) return 'Saldo dentro del rango: ' + pesos_(saldo);

  const hoy = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd');
  const props = PropertiesService.getDocumentProperties();
  if (props.getProperty('aviso_' + tipo) === hoy) return 'Ya se avisó hoy.';

  let para, asunto, cuerpo;
  if (tipo === 'alto') {
    const exc = saldo - objetivo;
    para = [aux, ger].filter(String).join(',');
    asunto = 'Caja menor — excedente de ' + pesos_(exc) + ' por consignar';
    cuerpo = '<p>Buen día.</p><p>El saldo de la caja menor de Social Solar S.A.S. está en <b>' +
      pesos_(saldo) + '</b>, por encima del objetivo de ' + pesos_(objetivo) + '.</p>' +
      '<p><b>Excedente por consignar: ' + pesos_(exc) + '</b></p>' +
      '<p>Por favor consignar el excedente en la cuenta de Bancolombia y registrar el comprobante el mismo día.</p>';
  } else {
    const reem = objetivo - saldo;
    para = ger;
    asunto = 'Caja menor — saldo por debajo del mínimo, se requiere reembolso';
    cuerpo = '<p>Buen día.</p><p>El saldo de la caja menor está en <b>' + pesos_(saldo) +
      '</b>, por debajo del mínimo de ' + pesos_(minimo) + '.</p>' +
      '<p><b>Reembolso solicitado: ' + pesos_(reem) + '</b></p>' +
      '<p>Sin ese reembolso no se pueden atender los gastos menores.</p>';
  }

  if (!para) return 'No hay correos configurados en la hoja Listas.';
  MailApp.sendEmail({
    to: para, cc: tipo === 'bajo' ? aux : ctd, subject: asunto,
    htmlBody: cuerpo + '<p style="font-size:12px;color:#666">— Enviado automáticamente por la caja menor · responsable: ' +
      responsableHoy_() + '</p>'
  });
  props.setProperty('aviso_' + tipo, hoy);
  return 'Aviso enviado a ' + para;
}

/* =================== PENDIENTES Y WHATSAPP =================== */

function pendientesDSE_() {
  const rel = hoja_(H_REL);
  const datos = rel.getRange(FILA_INI, 2, FILA_FIN - FILA_INI + 1, N_COLS - 1).getValues();
  const plazos = rel.getRange(FILA_INI, 18, FILA_FIN - FILA_INI + 1, 1).getDisplayValues();
  const out = [];
  datos.forEach(function (f, i) {
    const estado = String(f[13] || '');
    if (!/falta el dse|no quiso|no se pudo/i.test(estado)) return;
    out.push({
      fila: FILA_INI + i,
      fecha: f[0] instanceof Date ? fmt_(f[0]) : '',
      proveedor: String(f[2] || ''), nit: String(f[3] || ''),
      valor: Number(f[10]) || 0, valorTxt: pesos_(Number(f[10]) || 0),
      estado: estado, plazo: String(plazos[i][0] || '')
    });
  });
  return out;
}

function listaPendientes() { return pendientesDSE_(); }

function linkWhatsApp(celular, nombre, valor, fecha, link) {
  const cel = String(celular || '').replace(/\D/g, '');
  if (cel.length !== 10) throw new Error('El celular debe tener 10 dígitos.');
  const msg =
    'Buen día, ' + (nombre || '') + '.\n\n' +
    'Le escribo de SOCIAL SOLAR S.A.S. (NIT 901.128.826-6). ' +
    'El ' + (fecha || '') + ' le pagamos ' + (valor || '') + ' en efectivo y necesitamos legalizar ese pago.\n\n' +
    'Por favor diligencie este formulario con sus datos (nombre completo, cédula, dirección, correo y celular):\n' +
    (link || '') + '\n\n' +
    'Es rápido y nos permite expedirle el documento soporte. Cualquier duda me escribe por aquí.\n\n' +
    'Gracias,\n' + responsableHoy_() + ' — Caja menor Social Solar';
  return 'https://wa.me/57' + cel + '?text=' + encodeURIComponent(msg);
}

/* ================= CONSULTA DE BANCARIZACIÓN ================= */

function consultaTercero(nombre) {
  const bza = hoja_(H_BZA);
  const n = String(nombre || '').trim();
  if (!n) return null;
  bza.getRange('B25').setValue(n);
  SpreadsheetApp.flush();
  return {
    tercero: n,
    efectivo: bza.getRange('B26').getDisplayValue(),
    banco: bza.getRange('B27').getDisplayValue(),
    porcentaje: bza.getRange('B28').getDisplayValue(),
    sobreTope: bza.getRange('B29').getDisplayValue(),
    veredicto: bza.getRange('B30').getDisplayValue()
  };
}

function listaTercerosBanca() {
  return hoja_(H_BZA).getRange('D6:D65').getDisplayValues()
    .map(function (f) { return f[0]; }).filter(String);
}

/* ======================= RESPALDO MENSUAL ======================= */

function respaldoDelMes() {
  const ui = SpreadsheetApp.getUi();
  const hoy = new Date();
  const nombre = Utilities.formatDate(hoy, ZONA, 'yyyy-MM') + ' ' + MESES[hoy.getMonth()];
  const carpeta = carpetaDelMes_(hoy);

  const blobs = [];
  blobs.push(libro_().getBlob().setName('CAJA_MENOR_' + nombre + '.xlsx'));
  recorrer_(carpeta, blobs, 0);

  if (!blobs.length) { ui.alert('No hay nada que respaldar en ' + nombre + '.'); return; }
  const archivo = DriveApp.getFolderById(CARPETA_RESP)
    .createFile(Utilities.zip(blobs, nombre + '.zip'));
  ui.alert('Respaldo listo', nombre + '.zip con ' + blobs.length + ' archivo(s).\n\n' +
    archivo.getUrl(), ui.ButtonSet.OK);
  return archivo.getUrl();
}

function recorrer_(carpeta, blobs, nivel) {
  if (nivel > 3 || blobs.length > 300) return;
  const archivos = carpeta.getFiles();
  while (archivos.hasNext()) {
    const a = archivos.next();
    if (a.getSize() > 25 * 1024 * 1024) continue;
    try { blobs.push(a.getBlob().setName(carpeta.getName() + ' - ' + a.getName())); }
    catch (e) { console.error('No se pudo agregar ' + a.getName()); }
  }
  const subs = carpeta.getFolders();
  while (subs.hasNext()) recorrer_(subs.next(), blobs, nivel + 1);
}

/* ========================= CARPETAS ========================= */

function carpetaDelMes_(fecha) {
  const f = fecha instanceof Date ? fecha : new Date();
  const anio = String(f.getFullYear());
  const mes = Utilities.formatDate(f, ZONA, 'yyyy-MM') + ' ' + MESES[f.getMonth()];
  const cAnio = subcarpeta_(DriveApp.getFolderById(CARPETA_RAIZ), anio);
  return subcarpeta_(cAnio, mes);
}

function guardarSoporte_(archivo, fecha, bloque, sub, nombre) {
  const bytes = bytesDe_(archivo);
  let carpeta = subcarpeta_(carpetaDelMes_(fecha), bloque);
  if (sub) carpeta = subcarpeta_(carpeta, sub);
  const ext = { 'image/jpeg':'.jpg', 'image/png':'.png', 'image/gif':'.gif',
                'application/pdf':'.pdf' }[String(archivo.tipo).toLowerCase()] || '.jpg';
  return carpeta.createFile(
    Utilities.newBlob(bytes, String(archivo.tipo).toLowerCase(), nombre + ext)).getUrl();
}

function subcarpeta_(padre, nombre) {
  const it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

function nombreArchivo_(fecha, tercero, numero) {
  const f = aFecha_(fecha);
  const d = f ? Utilities.formatDate(f, ZONA, 'yyyyMMdd') : 'sinfecha';
  const t = limpiar_(String(tercero || 'SIN TERCERO')).toUpperCase().slice(0, 40);
  const n = limpiar_(String(numero || 'SN')).toUpperCase().slice(0, 25);
  return d + '_' + t + '_' + n;
}

/* ====================== TERCEROS Y CASOS ====================== */

function guardarTercero_(d) {
  const h = hoja_(H_TER);
  const base = String(d.nit || '').replace(/\D/g, '');
  const nombre = txt_(d.proveedor, 120).toUpperCase();
  if (!base && !nombre) return;
  const n = Math.max(h.getLastRow(), 1);
  const filas = n >= 2 ? h.getRange(2, 1, n - 1, 2).getValues() : [];
  for (let i = 0; i < filas.length; i++) {
    const igual = base ? String(filas[i][0]).replace(/\D/g, '') === base
                       : String(filas[i][1]).toUpperCase() === nombre;
    if (igual) { h.getRange(i + 2, 17).setValue(new Date()); return; }
  }
  const libre = primeraFilaLibre_(h, 2);
  h.getRange(libre, 1, 1, 7).setValues([[
    txt_(d.nit, 20), nombre, '', '', txt_(d.categoria, 60),
    txt_(d.centro, 60), txt_(d.tipoSoporte, 60)
  ]]);
  h.getRange(libre, 17).setValue(new Date());
}

function abrirCaso_(fila, d, valor) {
  const c = hoja_(H_CAS);
  const libre = primeraFilaLibre_(c, 5);
  c.getRange(libre, 1, 1, 10).setValues([[
    libre - 4, aFecha_(d.fecha) || new Date(),
    hoja_(H_REL).getRange(REL.numero).getValue(), fila - FILA_INI + 1,
    txt_(d.beneficiario, 60),
    txt_(d.proveedor, 120).toUpperCase() || 'NO IDENTIFICADO',
    txt_(d.nit, 20) || '—', valor, txt_(d.estadoSoporte, 80), txt_(d.nota, 400)
  ]]);
}

function listaCasos() {
  const datos = hoja_(H_CAS).getRange(5, 1, 40, 14).getValues();
  const out = [];
  datos.forEach(function (f) {
    if (!f[0]) return;
    out.push({
      n: f[0], fecha: f[1] instanceof Date ? fmt_(f[1]) : '',
      beneficiario: f[4], vendedor: f[5], id: f[6],
      valor: pesos_(f[7]), estado: f[8], nota: f[9],
      decision: f[10], resuelto: String(f[13] || '')
    });
  });
  return out;
}

function guardarDecision(n, decision, instruccion) {
  const c = hoja_(H_CAS);
  const datos = c.getRange(5, 1, 40, 1).getValues();
  for (let i = 0; i < datos.length; i++) {
    if (Number(datos[i][0]) === Number(n)) {
      c.getRange(5 + i, 11).setValue(txt_(decision, 200));
      c.getRange(5 + i, 12).setValue(txt_(instruccion, 300));
      c.getRange(5 + i, 13).setValue(new Date());
      SpreadsheetApp.flush();
      return true;
    }
  }
  throw new Error('No se encontró el caso ' + n + '.');
}

/* ========================= UTILIDADES ========================= */

function hoja_(nombre) {
  const h = libro_().getSheetByName(nombre);
  if (!h) throw new Error('Falta la hoja "' + nombre + '". No renombre las hojas del libro.');
  return h;
}

function filasLibres_(rel) {
  return rel.getRange(FILA_INI, 2, FILA_FIN - FILA_INI + 1, N_COLS - 1).getValues()
    .map(function (f, i) {
      return f.every(function (v) { return v === '' || v === null; }) ? FILA_INI + i : 0;
    }).filter(Boolean);
}

function primeraFilaLibre_(hoja, desde) {
  const col = hoja.getRange(desde, 1, Math.max(hoja.getMaxRows() - desde, 1), 1).getValues();
  for (let i = 0; i < col.length; i++) if (col[i][0] === '' || col[i][0] === null) return desde + i;
  return desde + col.length;
}

function contarFilas_(hoja, desde) {
  const col = hoja.getRange(desde, 1, Math.max(hoja.getMaxRows() - desde, 1), 1).getValues();
  let n = 0;
  for (let i = 0; i < col.length; i++) if (col[i][0] !== '' && col[i][0] !== null) n++;
  return n;
}

function escribirAlFinal_(hoja, filas, desde) {
  if (!filas.length) return;
  const f = primeraFilaLibre_(hoja, desde || 2);
  hoja.getRange(f, 1, filas.length, filas[0].length).setValues(filas);
}

function contarTexto_(hoja, a1, texto) {
  return hoja.getRange(a1).getDisplayValues()
    .filter(function (f) { return String(f[0]) === texto; }).length;
}

function enlazar_(hoja, fila, col, texto, url) {
  hoja.getRange(fila, col).setNumberFormat('@').setRichTextValue(
    SpreadsheetApp.newRichTextValue().setText(texto).setLinkUrl(url).build());
}

function bytesDe_(archivo) {
  if (!archivo || !archivo.base64) throw new Error('No llegó el archivo.');
  const tipo = String(archivo.tipo || '').toLowerCase();
  if (['image/jpeg','image/png','image/gif','application/pdf'].indexOf(tipo) === -1)
    throw new Error('"' + archivo.nombre + '": use una foto JPG o PNG, o un PDF.');
  const bytes = Utilities.base64Decode(archivo.base64);
  if (bytes.length > 20 * 1024 * 1024) throw new Error('"' + archivo.nombre + '" pesa más de 20 MB.');
  return bytes;
}

function crearPdf_(ss, rel, cab, d1, d2) {
  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=pdf' +
    '&gid=' + rel.getSheetId() + '&r1=0&c1=0&r2=72&c2=13' +
    '&size=letter&portrait=false&fitw=true&gridlines=false&printtitle=false' +
    '&sheetnames=false&pagenum=UNDEFINED&fzr=false' +
    '&top_margin=0.4&bottom_margin=0.4&left_margin=0.4&right_margin=0.4';
  const resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200)
    throw new Error('Google respondió ' + resp.getResponseCode() + ' al generar el PDF. La relación no se movió.');
  const nombre = Utilities.formatDate(d1, ZONA, 'yyyyMMdd') + '-' +
                 Utilities.formatDate(d2, ZONA, 'yyyyMMdd') + '_REL-' + cab.numero + '.pdf';
  return subcarpeta_(carpetaDelMes_(d2), '05 RELACIONES CERRADAS')
    .createFile(resp.getBlob().setName(nombre));
}

function tabla_(pares) {
  return '<table style="border-collapse:collapse;font-family:Arial;font-size:13px">' +
    pares.map(function (p) {
      return '<tr><td style="padding:5px 12px;background:#FFE7B0;border:1px solid #ddd"><b>' +
        esc_(p[0]) + '</b></td><td style="padding:5px 12px;border:1px solid #ddd">' +
        esc_(p[1]) + '</td></tr>';
    }).join('') + '</table>';
}

function aFecha_(v) {
  if (v instanceof Date) return v;
  const s = String(v || '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}
function isoFecha_(d) { return Utilities.formatDate(d, ZONA, 'yyyy-MM-dd'); }
function soloFecha_(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function sumarDias_(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function fmt_(d) { return d instanceof Date ? Utilities.formatDate(d, ZONA, 'dd/MM/yyyy') : String(d || ''); }
function entero_(v) { return Math.round(Number(String(v == null ? '' : v).replace(/[^0-9]/g, ''))) || 0; }
function txt_(v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 200); }
function limpiar_(s) { return String(s).replace(/[\\\/:*?"<>|#]/g, '-').replace(/\s+/g, ' ').trim(); }
function pesos_(n) { return '$ ' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function esc_(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


/* ============================================================
 *  PÁGINA WEB  —  lo que sirve la aplicación en pantalla completa
 *  Publicar con: Implementar > Nueva implementación > Aplicación web
 *    Ejecutar como    : El usuario que accede
 *    Quién tiene acceso: Cualquier usuario con cuenta de Google
 * ============================================================ */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Caja Menor — Social Solar S.A.S.')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function datosWeb() {
  const d = panelDatos();
  const li = hoja_(H_LIS);
  d.correo = (Session.getActiveUser().getEmail() || '').toLowerCase();
  d.correoAux = li.getRange(PAR.correoAux).getDisplayValue();
  d.correoCtd = li.getRange(PAR.correoCtd).getDisplayValue();
  d.correoGer = li.getRange(PAR.correoGer).getDisplayValue();
  d.casos = contarTexto_(hoja_(H_CAS), 'N5:N44', 'PENDIENTE');
  d.porConfirmar = contarTexto_(hoja_(H_ENT), 'I5:I44', 'Por confirmar');
  d.porAprobar = hoja_(H_HIS).getRange('A2:O60').getDisplayValues()
    .filter(function (f) { return f[0] && !f[14]; }).length;
  titularSello_();
  d.quienes = hoja_(H_RESP).getRange('B6:B30').getDisplayValues()
    .map(function (f) { return String(f[0] || '').trim(); }).filter(String);
  return d;
}

function datosRelacion() {
  const rel = hoja_(H_REL);
  SpreadsheetApp.flush();
  const datos = rel.getRange(FILA_INI, 2, FILA_FIN - FILA_INI + 1, N_COLS - 1).getDisplayValues();
  const filas = [];
  datos.forEach(function (f, i) {
    if (f.every(function (v) { return v === ''; })) return;
    filas.push({
      n: i + 1, fecha: f[0], soporte: f[1], tercero: f[2], nit: f[3],
      descripcion: f[4], categoria: f[5], centro: f[6], tipoSoporte: f[7],
      medio: f[8], ingreso: f[9], egreso: f[10], revision: f[11],
      recibio: f[12], estadoSoporte: f[13], cuenta: f[14], retencion: f[15],
      plazo: f[16], nota: f[17], deducible: f[18], origen: f[19],
      cliente: f[20], recibo: f[21], factura: f[22], cruce: f[23]
    });
  });
  return {
    numero: rel.getRange(REL.numero).getDisplayValue(),
    desde: rel.getRange(REL.desde).getDisplayValue(),
    hasta: rel.getRange(REL.hasta).getDisplayValue(),
    responsable: rel.getRange(REL.responsable).getDisplayValue(),
    saldoAnterior: rel.getRange(REL.saldoAnterior).getDisplayValue(),
    ingresos: rel.getRange(REL.ingresos).getDisplayValue(),
    egresos: rel.getRange(REL.egresos).getDisplayValue(),
    saldoFinal: rel.getRange(REL.saldoFinal).getDisplayValue(),
    alertas: rel.getRange(REL.alertas).getDisplayValue(),
    filas: filas
  };
}

function datosTablero() {
  const t = hoja_(H_TAB);
  SpreadsheetApp.flush();
  const pares = function (rango) {
    return t.getRange(rango).getDisplayValues()
      .filter(function (f) { return f[0]; })
      .map(function (f) { return { etiqueta: f[0], valor: f[1] }; });
  };
  const lineas = function (rango) {
    return t.getRange(rango).getDisplayValues()
      .map(function (f) { return f[0]; }).filter(String);
  };
  return { situacion: pares('A5:B21'), alerta: pares('D5:E13'),
           semaforo: lineas('G5:G14'), pasos: lineas('G17:G23') };
}

function datosGestion() {
  const g = hoja_(H_GES);
  SpreadsheetApp.flush();
  const ind = g.getRange('A8:D30').getDisplayValues()
    .filter(function (f) { return f[0]; })
    .map(function (f) { return { indicador: f[0], resultado: f[1], meta: f[2], estado: f[3] }; });
  const notas = g.getRange('F5:G19').getDisplayValues()
    .filter(function (f) { return f[0] && f[1]; })
    .map(function (f) { return { titulo: f[0], texto: f[1] }; });
  return { anio: g.getRange('B4').getDisplayValue(),
           responsable: g.getRange('B5').getDisplayValue(),
           indicadores: ind, notas: notas };
}

function datosPoliticas() {
  const p = hoja_(H_POL);
  const tabla = p.getRange('B5:D22').getDisplayValues()
    .filter(function (f) { return f[0]; })
    .map(function (f) { return { caso: f[0], dse: f[1], soporte: f[2] }; });
  const topes = p.getRange('B26:D31').getDisplayValues()
    .filter(function (f) { return f[0]; })
    .map(function (f) { return { concepto: f[0], valor: f[1], nota: f[2] }; });
  const lista = function (r) {
    return p.getRange(r).getDisplayValues().map(function (f) { return f[0]; }).filter(String);
  };
  return { tabla: tabla, topes: topes, antes: lista('F5:F11'), errores: lista('F14:F21') };
}

function datosBanco() {
  const b = hoja_(H_BAN);
  SpreadsheetApp.flush();
  const filas = b.getRange('A5:I54').getDisplayValues()
    .filter(function (f) { return f[0] || f[1]; })
    .map(function (f) {
      return { fecha: f[0], tipo: f[1], comprobante: f[2], valor: f[3],
               quien: f[4], relacion: f[5], soporte: f[6], verificado: f[7], nota: f[8] };
    });
  const rel = hoja_(H_REL), li = hoja_(H_LIS);
  const saldo = Number(rel.getRange(REL.saldoFinal).getValue()) || 0;
  const objetivo = Number(li.getRange(PAR.objetivo).getValue()) || 0;
  const minimo = Number(li.getRange(PAR.minimo).getValue()) || 0;
  return { filas: filas, saldo: saldo, saldoTxt: pesos_(saldo),
           objetivo: objetivo, objetivoTxt: pesos_(objetivo),
           minimo: minimo, minimoTxt: pesos_(minimo),
           excedente: saldo > objetivo ? saldo - objetivo : 0,
           reembolso: saldo < minimo ? objetivo - saldo : 0,
           estado: rel.getRange(REL.alertaSaldo).getDisplayValue() };
}

function datosInformes() {
  const h = hoja_(H_HIS);
  SpreadsheetApp.flush();
  return h.getRange('A2:S60').getDisplayValues()
    .filter(function (f) { return f[0]; })
    .map(function (f) {
      return { numero: f[0], fecha: f[1], desde: f[2], hasta: f[3], responsable: f[4],
               saldoAnterior: f[5], ingresos: f[6], egresos: f[7], saldoFinal: f[8],
               contado: f[9], diferencia: f[10], movimientos: f[11],
               aprobacion: f[13], pdf: f[16], carpeta: f[17] };
    });
}

function datosEntregas() {
  const e = hoja_(H_ENT);
  SpreadsheetApp.flush();
  return e.getRange('A5:L44').getDisplayValues()
    .filter(function (f) { return f[0]; })
    .map(function (f) {
      return { consecutivo: f[0], fecha: f[1], entrega: f[2], recibe: f[3], valor: f[4],
               concepto: f[5], centro: f[6], soporte: f[7], confirmado: f[8],
               fechaConf: f[9], relacion: f[10], nota: f[11] };
    });
}

function confirmarEntrega(consecutivo) {
  const e = hoja_(H_ENT);
  const col = e.getRange('A5:A44').getValues();
  for (let i = 0; i < col.length; i++) {
    if (String(col[i][0]) === String(consecutivo)) {
      e.getRange(5 + i, 9).setValue('Sí');
      e.getRange(5 + i, 10).setValue(new Date());
      SpreadsheetApp.flush();
      return 'Entrega ' + consecutivo + ' confirmada.';
    }
  }
  throw new Error('No se encontró la entrega ' + consecutivo + '.');
}

function datosAuditoria() {
  const r = revisar_();
  const t = hoja_(H_TAB);
  SpreadsheetApp.flush();
  return {
    errores: r.errores, avisos: r.avisos,
    movimientos: r.lineas.length, saldo: r.saldoTxt,
    semaforo: t.getRange('G5:G14').getDisplayValues()
      .map(function (f) { return f[0]; }).filter(String),
    conAlerta: r.lineas.filter(function (l) {
      return l.revision && l.revision.indexOf('OK') !== 0;
    }).map(function (l) {
      return { n: l.n,
               fecha: l.valores[0] instanceof Date ? fmt_(l.valores[0]) : String(l.valores[0] || ''),
               tercero: String(l.valores[2] || ''),
               valor: pesos_(Number(l.valores[10]) || 0),
               revision: l.revision };
    })
  };
}

function datosParams() {
  const rp = hoja_(H_RESP), li = hoja_(H_LIS);
  SpreadsheetApp.flush();
  const resp = rp.getRange('B6:H30').getDisplayValues()
    .filter(function (f) { return f[0]; })
    .map(function (f) {
      return { nombre: f[0], cedula: f[1], correo: f[2], celular: f[3],
               desde: f[4], hasta: f[5], estado: f[6] };
    });
  const par = [
    ['Saldo objetivo de la caja',      li.getRange(PAR.objetivo).getDisplayValue()],
    ['Saldo mínimo',                   li.getRange(PAR.minimo).getDisplayValue()],
    ['Tope por gasto',                 li.getRange(PAR.topeGasto).getDisplayValue()],
    ['Pago en efectivo (100 UVT)',     li.getRange(PAR.topeEfectivo).getDisplayValue()],
    ['Tiquete POS en papel (5 UVT)',   li.getRange(PAR.topePOS).getDisplayValue()],
    ['Plazo del DSE (días)',           li.getRange(PAR.plazoDSE).getDisplayValue()],
    ['UVT del año',                    li.getRange(PAR.uvt).getDisplayValue()],
    ['Correo de quien maneja la caja', li.getRange(PAR.correoAux).getDisplayValue()],
    ['Correo de la contadora',         li.getRange(PAR.correoCtd).getDisplayValue()],
    ['Correo de gerencia',             li.getRange(PAR.correoGer).getDisplayValue()]
  ].map(function (p) { return { etiqueta: p[0], valor: p[1] }; });
  const ctd = li.getRange(PAR.correoCtd).getDisplayValue();
  return {
    responsables: resp, parametros: par, actual: responsableHoy_(),
    roles: {
      aux: li.getRange(PAR.correoAux).getDisplayValue(),
      ctd: ctd,
      ger: li.getRange(PAR.correoGer).getDisplayValue()
    },
    puedeEditar: (rolActual_() === 'contadora') || !ctd,
    yo: (Session.getActiveUser().getEmail() || '').toLowerCase()
  };
}

function agregarResponsable(d) {
  const rp = hoja_(H_RESP);
  const libre = primeraFilaLibre_(rp, 6);
  if (libre > 30) throw new Error('No hay filas libres en Responsables.');
  if (!txt_(d.nombre, 120)) throw new Error('Escriba el nombre.');
  rp.getRange(libre, 1).setValue(libre - 5);
  rp.getRange(libre, 2, 1, 5).setValues([[
    txt_(d.nombre, 120).toUpperCase(), txt_(d.cedula, 20),
    txt_(d.correo, 80), txt_(d.celular, 20), aFecha_(d.desde) || ''
  ]]);
  if (d.hasta) rp.getRange(libre, 7).setValue(aFecha_(d.hasta));
  SpreadsheetApp.flush();
  return datosParams();
}

function datosUbicacion(rol) {
  const libro = libro_();
  const mes = carpetaDelMes_(new Date());
  const l = function (titulo, nota, nombre, url, ver) {
    return { titulo: titulo, nota: nota, nombre: nombre, url: url, ver: ver || 'contadora' };
  };

  let urlApp = '';
  try { urlApp = ScriptApp.getService().getUrl() || ''; } catch (e) { }

  /* cada enlace dice quién lo puede ver. El auxiliar no ve el libro:
     por ahí se llega a todo y se edita, que es justo lo que no queremos. */
  const TODOS = 'contadora gerencia auxiliar';
  const CTD   = 'contadora';
  const CTD_GER = 'contadora gerencia';

  const fijos = [
    l('LA PLATAFORMA', 'Esta misma página. Guárdela en favoritos.', 'Abrir la caja menor', urlApp, TODOS),
    l('El libro', 'Relación, arqueo, tablero e histórico.', libro.getName(), libro.getUrl(), CTD_GER),
    l('Carpeta raíz', 'De aquí cuelga todo lo demás.',
      'CAJA MENOR', DriveApp.getFolderById(CARPETA_RAIZ).getUrl(), CTD),
    l('Plantillas y políticas', 'El libro, las circulares y el manual.',
      '00 PLANTILLAS Y POLÍTICAS', DriveApp.getFolderById(CARPETA_PLANTILLAS).getUrl(), CTD),
    l('Carpetas por año', 'Todos los meses, con sus soportes.',
      '2026', DriveApp.getFolderById(CARPETA_ANIOS).getUrl(), TODOS),
    l('El mes en curso', 'Aquí caen los soportes de este mes.', mes.getName(), mes.getUrl(), TODOS),
    l('Respaldos', 'El .zip de cada mes cuando se genera.',
      '99 RESPALDOS', DriveApp.getFolderById(CARPETA_RESP).getUrl(), CTD)
  ].filter(function (x) {
    return x.ver.indexOf(String(rol || 'auxiliar').toLowerCase()) > -1;
  });

  /* lo que haya hoy en la carpeta de plantillas: manual, circulares, lo que sea */
  const docs = [];
  try {
    const it = DriveApp.getFolderById(CARPETA_PLANTILLAS).getFiles();
    while (it.hasNext() && docs.length < 25) {
      const f = it.next();
      docs.push({ nombre: f.getName(), url: f.getUrl(), tipo: f.getMimeType() });
    }
    docs.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
  } catch (e) { }

  /* las cinco carpetas del mes */
  const delMes = [];
  try {
    const sub = mes.getFolders();
    while (sub.hasNext()) { const c = sub.next(); delMes.push({ nombre: c.getName(), url: c.getUrl() }); }
    delMes.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
  } catch (e) { }

  return { fijos: fijos, documentos: docs, carpetasDelMes: delMes, mes: mes.getName() };
}


/* ---------- asignar los roles desde la plataforma ---------- */

function guardarRoles(d) {
  const li = hoja_(H_LIS);
  const actual = String(li.getRange(PAR.correoCtd).getDisplayValue() || '').toLowerCase().trim();
  const yo = (Session.getActiveUser().getEmail() || '').toLowerCase().trim();
  if (actual && yo !== actual)
    throw new Error('Solo la contadora puede cambiar los roles. Hoy esa cuenta es ' + actual + '.');

  const correo = function (v, etiqueta) {
    const s = String(v == null ? '' : v).trim().toLowerCase();
    if (s && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s))
      throw new Error('El correo de ' + etiqueta + ' no parece válido: ' + s);
    return s;
  };

  const ctd = correo(d.contadora, 'la contadora');
  if (!ctd) throw new Error('El correo de la contadora no puede quedar vacío: sin él nadie podría volver a cambiar los roles.');

  li.getRange(PAR.correoCtd).setValue(ctd);
  li.getRange(PAR.correoAux).setValue(correo(d.auxiliar, 'la auxiliar'));
  li.getRange(PAR.correoGer).setValue(correo(d.gerencia, 'gerencia'));
  SpreadsheetApp.flush();
  return datosParams();
}

/* ============================================================
 *  LAS CUATRO PANTALLAS QUE FALTABAN
 *  Lote de soportes · Entrega del cargo · Revisar · Aprobar
 * ============================================================ */

function subirLote(archivos) {
  if (!archivos || !archivos.length) throw new Error('No llegó ningún archivo.');
  if (archivos.length > 20) throw new Error('Máximo 20 archivos por tanda.');
  const carpeta = subcarpeta_(carpetaDelMes_(new Date()), '00 POR CLASIFICAR');
  const out = [];
  archivos.forEach(function (a) {
    try {
      const bytes = bytesDe_(a);
      const ext = { 'image/jpeg':'.jpg', 'image/png':'.png', 'image/gif':'.gif',
                    'application/pdf':'.pdf' }[String(a.tipo).toLowerCase()] || '.jpg';
      const nombre = Utilities.formatDate(new Date(), ZONA, 'yyyyMMdd_HHmmss') + '_' +
                     limpiar_(String(a.nombre || 'soporte')).slice(0, 40);
      const f = carpeta.createFile(
        Utilities.newBlob(bytes, String(a.tipo).toLowerCase(), nombre + ext));
      out.push({ ok: true, nombre: a.nombre, id: f.getId(), url: f.getUrl() });
    } catch (e) {
      out.push({ ok: false, nombre: a.nombre, error: e.message });
    }
  });
  return { archivos: out, carpeta: carpeta.getUrl(), panel: panelDatos() };
}

function registrarLote(fichas) {
  if (!fichas || !fichas.length) throw new Error('No hay fichas para registrar.');
  const res = [];
  for (let i = 0; i < fichas.length; i++) {
    const f = fichas[i];
    try {
      if (f.idArchivo) {
        const arch = DriveApp.getFileById(f.idArchivo);
        const destino = subcarpeta_(
          subcarpeta_(carpetaDelMes_(aFecha_(f.fecha) || new Date()), '01 SOPORTES DE EGRESOS'),
          CARPETA_POR_SOPORTE[f.tipoSoporte] || 'Sin soporte - no deducible');
        arch.setName(nombreArchivo_(f.fecha, f.proveedor, f.soporte) +
                     '.' + (arch.getName().split('.').pop() || 'jpg'));
        arch.moveTo(destino);
        f.urlYaSubido = arch.getUrl();
      }
      const r = guardarPagoDesdeLote_(f);
      res.push({ ok: true, nombre: f.nombreArchivo, n: r.n, revision: r.revision });
    } catch (e) {
      res.push({ ok: false, nombre: f.nombreArchivo, error: e.message });
    }
  }
  return { resultados: res, panel: panelDatos() };
}

function guardarPagoDesdeLote_(d) {
  const candado = LockService.getDocumentLock();
  if (!candado.tryLock(30000)) throw new Error('Otra persona está escribiendo en la caja.');
  try {
    const rel = hoja_(H_REL);
    const libres = filasLibres_(rel);
    if (!libres.length) throw new Error('La relación ya no tiene filas libres.');
    const fila = libres[0];
    const valor = entero_(d.valor);
    if (!(valor > 0)) throw new Error('Falta el valor.');

  escribirRelacion_(rel, fila, [
    aFecha_(d.fecha) || '', txt_(d.soporte, 40),
    txt_(d.proveedor, 120).toUpperCase(), txt_(d.nit, 20),
    txt_(d.descripcion, 200), txt_(d.categoria, 60), txt_(d.centro, 60),
    txt_(d.tipoSoporte, 60), txt_(d.medio, 60),
    '', valor, '',
    txt_(d.beneficiario, 60), txt_(d.estadoSoporte, 80),
    txt_(d.cuenta, 60), txt_(d.retencion, 60), '',
    txt_(d.nota, 300), '', '', '', '', '', ''
  ]);
    sellar_(rel, fila, d.quien);
    if (d.urlYaSubido) enlazar_(rel, fila, 3, txt_(d.soporte, 40) || 'Ver soporte', d.urlYaSubido);
    if (d.nit || d.proveedor) guardarTercero_(d);
    if (/no se pudo|no quiso/i.test(String(d.estadoSoporte || ''))) abrirCaso_(fila, d, valor);
    SpreadsheetApp.flush();
    return { n: fila - FILA_INI + 1, revision: rel.getRange(fila, 13).getDisplayValue() };
  } finally { candado.releaseLock(); }
}

function datosEmpalme() {
  const rel = hoja_(H_REL), rp = hoja_(H_RESP);
  SpreadsheetApp.flush();
  const r = revisar_();
  const saldo = Number(rel.getRange(REL.saldoFinal).getValue()) || 0;
  const contado = rel.getRange(REL.contado).getValue();
  return {
    numero: rel.getRange(REL.numero).getDisplayValue(),
    entrega: responsableHoy_(),
    saldo: saldo, saldoTxt: pesos_(saldo),
    contado: contado === '' ? null : Number(contado),
    contadoTxt: contado === '' ? 'Sin arqueo' : pesos_(Number(contado)),
    estadoArqueo: rel.getRange(REL.estadoArqueo).getDisplayValue(),
    movimientos: r.lineas.length,
    pendientes: {
      alertas: r.errores, avisos: r.avisos,
      dse: pendientesDSE_().length,
      casos: contarTexto_(hoja_(H_CAS), 'N5:N44', 'PENDIENTE'),
      entregas: contarTexto_(hoja_(H_ENT), 'I5:I44', 'Por confirmar')
    },
    responsables: rp.getRange('B6:H30').getDisplayValues()
      .filter(function (f) { return f[0]; })
      .map(function (f) { return { nombre: f[0], desde: f[4], hasta: f[5], estado: f[6] }; })
  };
}

function generarEmpalme(d) {
  const rel = hoja_(H_REL), rp = hoja_(H_RESP);
  const quienEntrega = txt_(d.entrega, 120) || responsableHoy_();
  const quienRecibe  = txt_(d.recibe, 120);
  if (!quienRecibe) throw new Error('Escriba el nombre de quien recibe la caja.');
  const fecha = aFecha_(d.fecha) || new Date();
  const contado = entero_(d.contado);
  if (!(contado > 0)) throw new Error('Escriba el efectivo contado al momento de la entrega.');

  SpreadsheetApp.flush();
  const saldo = Number(rel.getRange(REL.saldoFinal).getValue()) || 0;
  const numero = rel.getRange(REL.numero).getDisplayValue();
  const dif = contado - saldo;

  const e = datosEmpalme();
  const pendientes = []
    .concat(e.pendientes.alertas)
    .concat(e.pendientes.avisos)
    .concat(e.pendientes.dse      ? [e.pendientes.dse + ' documento(s) soporte por conseguir'] : [])
    .concat(e.pendientes.casos    ? [e.pendientes.casos + ' caso(s) esperando decisión de la contadora'] : [])
    .concat(e.pendientes.entregas ? [e.pendientes.entregas + ' entrega(s) de efectivo sin confirmar'] : []);

  const fila = function (a, b) {
    return '<tr><td style="padding:6px 10px;background:#FFE7B0;border:1px solid #ddd;width:38%">' +
      '<b>' + esc_(a) + '</b></td>' +
      '<td style="padding:6px 10px;border:1px solid #ddd">' + esc_(b) + '</td></tr>';
  };
  const html =
    '<html><head><meta charset="utf-8"></head>' +
    '<body style="font-family:Arial,sans-serif;font-size:12px;color:#1A1A1A;padding:28px">' +
    '<h2 style="margin:0">ACTA DE ENTREGA DE CAJA MENOR</h2>' +
    '<p style="color:#6B6761;margin:4px 0 18px">SOCIAL SOLAR S.A.S. · NIT 901.128.826-6 · Paipa, Boyacá</p>' +
    '<table style="border-collapse:collapse;width:100%">' +
    fila('Fecha de la entrega', fmt_(fecha)) +
    fila('Relación en curso', 'N.° ' + numero) +
    fila('Entrega la caja', quienEntrega) +
    fila('Recibe la caja', quienRecibe) +
    fila('Saldo según el sistema', pesos_(saldo)) +
    fila('Efectivo contado y entregado', pesos_(contado)) +
    fila('Diferencia', (dif === 0 ? 'Ninguna — la caja cuadra' :
         (dif > 0 ? 'Sobrante de ' : 'Faltante de ') + pesos_(Math.abs(dif)))) +
    fila('Movimientos de la relación', String(e.movimientos)) +
    '</table>' +
    '<h3 style="margin:22px 0 6px">Asuntos pendientes que se entregan</h3>' +
    (pendientes.length
      ? '<ul style="margin:0;padding-left:18px">' +
        pendientes.map(function (x) { return '<li style="margin-bottom:3px">' + esc_(x) + '</li>'; }).join('') +
        '</ul>'
      : '<p style="margin:0">Ninguno. La caja se entrega al día.</p>') +
    (txt_(d.observaciones, 800)
      ? '<h3 style="margin:22px 0 6px">Observaciones</h3><p style="margin:0">' +
        esc_(txt_(d.observaciones, 800)) + '</p>'
      : '') +
    '<p style="margin:26px 0 0;font-size:11.5px;color:#6B6761">' +
    'Quien recibe declara haber contado el efectivo relacionado y haber recibido los soportes ' +
    'físicos y digitales de la relación en curso.</p>' +
    '<table style="width:100%;margin-top:46px"><tr>' +
    '<td style="width:46%;border-top:1px solid #1A1A1A;padding-top:6px;font-size:11.5px">' +
    'Entrega<br><b>' + esc_(quienEntrega) + '</b><br>C.C.</td>' +
    '<td style="width:8%"></td>' +
    '<td style="width:46%;border-top:1px solid #1A1A1A;padding-top:6px;font-size:11.5px">' +
    'Recibe<br><b>' + esc_(quienRecibe) + '</b><br>C.C.</td>' +
    '</tr></table></body></html>';

  const nombre = 'ACTA_ENTREGA_CAJA_' + Utilities.formatDate(fecha, ZONA, 'yyyyMMdd') + '.pdf';
  const pdf = subcarpeta_(carpetaDelMes_(fecha), '05 RELACIONES CERRADAS')
    .createFile(Utilities.newBlob(html, 'text/html', 'acta.html')
      .getAs('application/pdf').setName(nombre));

  const nombres = rp.getRange('B6:B30').getDisplayValues();
  for (let i = 0; i < nombres.length; i++) {
    if (nombres[i][0] && nombres[i][0].toUpperCase() === quienEntrega.toUpperCase()) {
      if (!rp.getRange(6 + i, 7).getValue()) rp.getRange(6 + i, 7).setValue(soloFecha_(fecha));
      rp.getRange(6 + i, 10).setValue(numero);
      enlazar_(rp, 6 + i, 11, 'Acta ' + fmt_(fecha), pdf.getUrl());
      break;
    }
  }
  let yaEsta = -1;
  for (let i = 0; i < nombres.length; i++)
    if (nombres[i][0] && nombres[i][0].toUpperCase() === quienRecibe.toUpperCase()) yaEsta = i;

  if (yaEsta === -1) {
    const libre = primeraFilaLibre_(rp, 6);
    if (libre <= 30) {
      rp.getRange(libre, 1).setValue(libre - 5);
      rp.getRange(libre, 2).setValue(quienRecibe.toUpperCase());
      rp.getRange(libre, 3).setValue(txt_(d.cedulaRecibe, 20));
      rp.getRange(libre, 4).setValue(txt_(d.correoRecibe, 80));
      rp.getRange(libre, 6).setValue(soloFecha_(sumarDias_(fecha, 1)));
      rp.getRange(libre, 9).setValue(numero);
      enlazar_(rp, libre, 11, 'Acta ' + fmt_(fecha), pdf.getUrl());
    }
  } else {
    rp.getRange(6 + yaEsta, 6).setValue(soloFecha_(sumarDias_(fecha, 1)));
    rp.getRange(6 + yaEsta, 9).setValue(numero);
  }

  SpreadsheetApp.flush();
  return { url: pdf.getUrl(), nombre: nombre, diferencia: dif,
           entrega: quienEntrega, recibe: quienRecibe, panel: panelDatos() };
}

function datosRevision(filtro) {
  const r = datosRelacion();
  const f = String(filtro || 'todos');
  let filas = r.filas;
  if (f === 'alerta')      filas = filas.filter(function (x) { return x.revision && x.revision.indexOf('OK') !== 0; });
  if (f === 'nodeducible') filas = filas.filter(function (x) { return x.deducible === 'NO'; });
  if (f === 'pordefinir')  filas = filas.filter(function (x) { return /definir/i.test(x.deducible); });
  if (f === 'sinsoporte')  filas = filas.filter(function (x) { return /falta el dse|no quiso|no se pudo/i.test(x.estadoSoporte); });
  if (f === 'efectivo')    filas = filas.filter(function (x) { return /efectivo/i.test(x.medio); });
  const rel = hoja_(H_REL);
  return {
    cabecera: r,
    filas: filas,
    conteos: {
      todos: r.filas.length,
      alerta: r.filas.filter(function (x) { return x.revision && x.revision.indexOf('OK') !== 0; }).length,
      nodeducible: r.filas.filter(function (x) { return x.deducible === 'NO'; }).length,
      pordefinir: r.filas.filter(function (x) { return /definir/i.test(x.deducible); }).length,
      sinsoporte: r.filas.filter(function (x) { return /falta el dse|no quiso|no se pudo/i.test(x.estadoSoporte); }).length,
      efectivo: r.filas.filter(function (x) { return /efectivo/i.test(x.medio); }).length
    },
    totalEgresos: rel.getRange(REL.egresos).getDisplayValue()
  };
}

function anotarFila(n, nota) {
  const rel = hoja_(H_REL);
  const f = FILA_INI + Number(n) - 1;
  if (f < FILA_INI || f > FILA_FIN) throw new Error('Fila fuera de la relación.');
  const previo = String(rel.getRange(f, 19).getDisplayValue() || '');
  const marca = '[' + fmt_(new Date()) + ' contadora] ' + txt_(nota, 250);
  rel.getRange(f, 19).setValue(previo ? previo + ' · ' + marca : marca);
  SpreadsheetApp.flush();
  return 'Nota guardada en la fila ' + n + '.';
}

function relacionesParaAprobar() {
  const h = hoja_(H_HIS);
  SpreadsheetApp.flush();
  return h.getRange('A2:S60').getDisplayValues()
    .filter(function (f) { return f[0]; })
    .map(function (f) {
      return {
        numero: f[0], fecha: f[1], desde: f[2], hasta: f[3], responsable: f[4],
        saldoAnterior: f[5], ingresos: f[6], egresos: f[7], saldoFinal: f[8],
        contado: f[9], diferencia: f[10], movimientos: f[11], sinSoporte: f[12],
        entrega: f[13], aprobadaPor: f[14], fechaAprobacion: f[15],
        pdf: f[16], carpeta: f[17], observaciones: f[18],
        pendiente: !f[14]
      };
    });
}

function aprobarRelacion(numero, decision, observacion) {
  const h = hoja_(H_HIS);
  const yo = (Session.getActiveUser().getEmail() || '').toLowerCase();
  const li = hoja_(H_LIS);
  const ger = String(li.getRange(PAR.correoGer).getDisplayValue() || '').toLowerCase().trim();
  const ctd = String(li.getRange(PAR.correoCtd).getDisplayValue() || '').toLowerCase().trim();
  if (ger && ctd && yo !== ger && yo !== ctd)
    throw new Error('Solo gerencia o la contadora pueden aprobar una relación.');

  const col = h.getRange('A2:A60').getDisplayValues();
  for (let i = 0; i < col.length; i++) {
    if (String(col[i][0]) === String(numero)) {
      const d = String(decision || 'Aprobada');
      h.getRange(2 + i, 15).setValue(d + ' — ' + (yo || 'sin identificar'));
      h.getRange(2 + i, 16).setValue(new Date());
      if (observacion) {
        const previo = String(h.getRange(2 + i, 19).getDisplayValue() || '');
        const marca = '[' + fmt_(new Date()) + '] ' + txt_(observacion, 400);
        h.getRange(2 + i, 19).setValue(previo ? previo + ' · ' + marca : marca);
      }
      SpreadsheetApp.flush();
      if (ctd) {
        try {
          MailApp.sendEmail({
            to: ctd,
            subject: 'Caja menor — relación N.° ' + numero + ': ' + d,
            htmlBody: '<p>La relación N.° <b>' + numero + '</b> quedó marcada como <b>' +
              esc_(d) + '</b> por ' + esc_(yo) + '.</p>' +
              (observacion ? '<p><b>Observación:</b> ' + esc_(observacion) + '</p>' : '')
          });
        } catch (e) { }
      }
      return 'Relación N.° ' + numero + ' marcada como ' + d + '.';
    }
  }
  throw new Error('No se encontró la relación N.° ' + numero + ' en el historial.');
}

/* ---------- quién registró cada fila ---------- */

const COL_QUIEN = 26, COL_CUANDO = 27;   // Z y AA, fuera del área de impresión

function sellar_(rel, fila, quien) {
  const nombre = txt_(quien, 80) ||
                 (Session.getActiveUser().getEmail() || '') || 'sin identificar';
  rel.getRange(fila, COL_QUIEN).setValue(nombre);
  rel.getRange(fila, COL_CUANDO).setValue(new Date());
}

/** Se corre una vez: pone los títulos de las dos columnas nuevas. */
function titularSello_() {
  const rel = hoja_(H_REL);
  if (!rel.getRange(8, COL_QUIEN).getValue()) {
    rel.getRange(8, COL_QUIEN).setValue('Registrado por');
    rel.getRange(8, COL_CUANDO).setValue('Fecha y hora del registro');
    rel.getRange(8, COL_QUIEN, 1, 2)
       .setFontWeight('bold').setBackground('#1A1A1A').setFontColor('#FFFFFF')
       .setFontSize(9).setWrap(true);
    rel.setColumnWidth(COL_QUIEN, 150);
    rel.setColumnWidth(COL_CUANDO, 150);
    rel.getRange(9, COL_CUANDO, FILA_FIN - FILA_INI + 1, 1)
       .setNumberFormat('DD/MM/YYYY HH:mm');
  }
}

/** La lista de quienes pueden registrar: los de Responsables más quien haya entrado. */
function listaQuienRegistra() {
  const rp = hoja_(H_RESP);
  const nombres = rp.getRange('B6:B30').getDisplayValues()
    .map(function (f) { return String(f[0] || '').trim(); }).filter(String);
  return { nombres: nombres, actual: responsableHoy_(),
           correo: (Session.getActiveUser().getEmail() || '').toLowerCase() };
}

/** Agrega un valor a una de las listas desplegables y lo deja guardado. */
function agregarALista(cual, valor) {
  const columnas = { centro: 3, beneficiario: 12, categoria: 1, destino: 22 };
  const col = columnas[String(cual)];
  if (!col) throw new Error('Lista desconocida: ' + cual);
  const v = txt_(valor, 80);
  if (!v) throw new Error('Escriba el nombre.');
  const li = hoja_(H_LIS);
  const actuales = li.getRange(2, col, 60, 1).getDisplayValues()
    .map(function (f) { return String(f[0] || '').trim(); });
  for (let i = 0; i < actuales.length; i++)
    if (actuales[i].toUpperCase() === v.toUpperCase())
      return { ya: true, valor: actuales[i], lista: actuales.filter(String) };
  let libre = -1;
  for (let i = 0; i < actuales.length; i++) if (!actuales[i]) { libre = i; break; }
  if (libre === -1) throw new Error('La lista está llena.');
  li.getRange(2 + libre, col).setValue(v);
  SpreadsheetApp.flush();
  const nueva = li.getRange(2, col, 60, 1).getDisplayValues()
    .map(function (f) { return String(f[0] || '').trim(); }).filter(String);
  return { ya: false, valor: v, lista: nueva };
}

/* ============================================================
 *  ACCESOS — la contadora da y quita el acceso de verdad
 * ============================================================ */

function soyContadora_() {
  const li = hoja_(H_LIS);
  const ctd = String(li.getRange(PAR.correoCtd).getDisplayValue() || '').toLowerCase().trim();
  const yo = (Session.getActiveUser().getEmail() || '').toLowerCase().trim();
  return !ctd || yo === ctd;
}

function exigirContadora_() {
  if (!soyContadora_())
    throw new Error('Solo la contadora puede dar o quitar accesos.');
}

function datosAccesos() {
  const rp = hoja_(H_RESP), li = hoja_(H_LIS);
  SpreadsheetApp.flush();

  const libro = SpreadsheetApp.openById(LIBRO_ID);
  const dueno = (libro.getOwner() ? libro.getOwner().getEmail() : '').toLowerCase();
  const editores = libro.getEditors().map(function (u) { return u.getEmail().toLowerCase(); });

  const roles = {
    aux: String(li.getRange(PAR.correoAux).getDisplayValue() || '').toLowerCase().trim(),
    ctd: String(li.getRange(PAR.correoCtd).getDisplayValue() || '').toLowerCase().trim(),
    ger: String(li.getRange(PAR.correoGer).getDisplayValue() || '').toLowerCase().trim()
  };
  const rolDe = function (c) {
    if (!c) return '—';
    if (c === roles.ctd) return 'Contadora';
    if (c === roles.aux) return 'Auxiliar';
    if (c === roles.ger) return 'Gerencia';
    return 'Sin rol asignado';
  };

  const gente = rp.getRange('B6:H30').getDisplayValues()
    .map(function (f, i) {
      if (!f[0]) return null;
      const correo = String(f[2] || '').toLowerCase().trim();
      return {
        fila: 6 + i, nombre: f[0], cedula: f[1], correo: correo, celular: f[3],
        desde: f[4], hasta: f[5], estado: f[6],
        rol: rolDe(correo),
        tieneAcceso: !!correo && (editores.indexOf(correo) > -1 || correo === dueno),
        esDueno: correo === dueno
      };
    }).filter(Boolean);

  /* quien tiene acceso al libro pero no está en Responsables */
  const conocidos = gente.map(function (g) { return g.correo; });
  const sueltos = editores.filter(function (c) { return conocidos.indexOf(c) === -1; })
    .map(function (c) { return { correo: c, rol: rolDe(c) }; });

  return {
    gente: gente, sueltos: sueltos, dueno: dueno, roles: roles,
    yo: (Session.getActiveUser().getEmail() || '').toLowerCase(),
    puedeEditar: soyContadora_(),
    enlacePublico: (function(){
      try {
        const ac = DriveApp.getFileById(LIBRO_ID).getSharingAccess();
        return ac === DriveApp.Access.ANYONE_WITH_LINK || ac === DriveApp.Access.ANYONE;
      } catch (e) { return false; }
    })()
  };
}

/** Da acceso: comparte el libro y la carpeta, y crea la fila en Responsables. */
function darAcceso(d) {
  exigirContadora_();
  const correo = String(d.correo || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo))
    throw new Error('El correo no parece válido: ' + correo);
  const nombre = txt_(d.nombre, 120);
  if (!nombre) throw new Error('Escriba el nombre de la persona.');

  SpreadsheetApp.openById(LIBRO_ID).addEditor(correo);
  try { DriveApp.getFolderById(CARPETA_RAIZ).addEditor(correo); } catch (e) { }

  const rp = hoja_(H_RESP);
  const correos = rp.getRange('D6:D30').getDisplayValues()
    .map(function (f) { return String(f[0] || '').toLowerCase().trim(); });
  let fila = -1;
  for (let i = 0; i < correos.length; i++) if (correos[i] === correo) fila = 6 + i;

  if (fila === -1) {
    fila = primeraFilaLibre_(rp, 6);
    if (fila > 30) throw new Error('No hay filas libres en Responsables.');
    rp.getRange(fila, 1).setValue(fila - 5);
    rp.getRange(fila, 2).setValue(nombre.toUpperCase());
    rp.getRange(fila, 3).setValue(txt_(d.cedula, 20));
    rp.getRange(fila, 4).setValue(correo);
    rp.getRange(fila, 5).setValue(txt_(d.celular, 20));
  }
  rp.getRange(fila, 6).setValue(aFecha_(d.desde) || soloFecha_(new Date()));
  rp.getRange(fila, 7).clearContent();

  if (d.rol) asignarRol_(d.rol, correo);
  SpreadsheetApp.flush();
  return datosAccesos();
}

/** Quita el acceso: deja de compartir y le pone fecha de retiro. */
function quitarAcceso(correo) {
  exigirContadora_();
  const c = String(correo || '').trim().toLowerCase();
  const libro = SpreadsheetApp.openById(LIBRO_ID);
  const dueno = (libro.getOwner() ? libro.getOwner().getEmail() : '').toLowerCase();
  if (c === dueno)
    throw new Error('No se le puede quitar el acceso al dueño del libro. Primero hay que transferir la propiedad.');
  const yo = (Session.getActiveUser().getEmail() || '').toLowerCase();
  if (c === yo)
    throw new Error('No se puede quitar el acceso a sí misma: quedaría por fuera del sistema.');

  try { libro.removeEditor(c); } catch (e) { }
  try { DriveApp.getFolderById(CARPETA_RAIZ).removeEditor(c); } catch (e) { }

  const rp = hoja_(H_RESP);
  const correos = rp.getRange('D6:D30').getDisplayValues()
    .map(function (f) { return String(f[0] || '').toLowerCase().trim(); });
  for (let i = 0; i < correos.length; i++)
    if (correos[i] === c && !rp.getRange(6 + i, 7).getValue())
      rp.getRange(6 + i, 7).setValue(soloFecha_(new Date()));

  /* si tenía un rol, se libera */
  const li = hoja_(H_LIS);
  [PAR.correoAux, PAR.correoGer].forEach(function (celda) {
    if (String(li.getRange(celda).getDisplayValue() || '').toLowerCase().trim() === c)
      li.getRange(celda).clearContent();
  });

  SpreadsheetApp.flush();
  return datosAccesos();
}

function asignarRol_(rol, correo) {
  const li = hoja_(H_LIS);
  const celda = { Auxiliar: PAR.correoAux, Contadora: PAR.correoCtd, Gerencia: PAR.correoGer }[rol];
  if (!celda) return;
  li.getRange(celda).setValue(String(correo || '').trim().toLowerCase());
}

function asignarRol(rol, correo) {
  exigirContadora_();
  if (rol === 'Contadora' && !String(correo || '').trim())
    throw new Error('El rol de contadora no puede quedar vacío.');
  asignarRol_(rol, correo);
  SpreadsheetApp.flush();
  return datosAccesos();
}


/* Se corre una sola vez desde el editor: deja los tres correos de rol puestos. */
function configurarRolesIniciales() {
  const li = hoja_(H_LIS);
  li.getRange(PAR.correoAux).setValue('auxiliar.contablesocial@gmail.com');
  li.getRange(PAR.correoCtd).setValue('contabilidad.angie.cespedes@gmail.com');
  li.getRange(PAR.correoGer).setValue('gerencia@socialsolar.com.co');
  SpreadsheetApp.flush();
  const r = {
    auxiliar:  li.getRange(PAR.correoAux).getDisplayValue(),
    contadora: li.getRange(PAR.correoCtd).getDisplayValue(),
    gerencia:  li.getRange(PAR.correoGer).getDisplayValue()
  };
  Logger.log(JSON.stringify(r));
  return r;
}


/* ============================================================
 *  USUARIOS, CLAVES Y SESIONES
 *  La plataforma corre con la cuenta de la contadora, así que
 *  Google ya no distingue quién entra. La puerta la ponemos aquí.
 *  Las claves nunca se guardan en texto: se guarda SHA-256 sobre
 *  (sal + clave), con una sal distinta por usuario.
 * ============================================================ */

const H_USR = 'Usuarios';
const SESION_HORAS = 6;   // el caché de Apps Script no guarda más

function hojaUsuarios_() {
  const ss = libro_();
  let h = ss.getSheetByName(H_USR);
  if (h) return h;
  h = ss.insertSheet(H_USR);
  h.getRange('A1').setValue('USUARIOS DE LA PLATAFORMA')
    .setFontWeight('bold').setFontSize(13);
  h.getRange('A2').setValue(
    'Las claves están cifradas y no se pueden leer, ni siquiera desde aquí. ' +
    'Se administran desde la plataforma, en la pantalla Usuarios.')
    .setFontColor('#6B6761').setFontSize(10);
  const cab = ['Nombre completo', 'Usuario', 'Clave (cifrada)', 'Sal', 'Rol',
               'Activo', 'Creado', 'Último ingreso', 'Debe cambiar la clave'];
  h.getRange(4, 1, 1, cab.length).setValues([cab])
    .setFontWeight('bold').setBackground('#1A1A1A').setFontColor('#FFFFFF')
    .setFontSize(9).setWrap(true);
  h.setFrozenRows(4);
  [180, 130, 300, 150, 110, 70, 130, 140, 110]
    .forEach(function (w, i) { h.setColumnWidth(i + 1, w); });
  h.hideColumns(3, 2);
  SpreadsheetApp.flush();
  return h;
}

function sal_() {
  return Utilities.getUuid().replace(/-/g, '') +
         Utilities.getUuid().replace(/-/g, '').slice(0, 16);
}

function cifrar_(clave, sal) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(sal) + '·' + String(clave), Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    return ((b < 0 ? b + 256 : b)).toString(16).padStart(2, '0');
  }).join('');
}

function igualSeguro_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

function filasUsuarios_() {
  const h = hojaUsuarios_();
  const n = Math.max(h.getLastRow() - 4, 0);
  if (!n) return [];
  return h.getRange(5, 1, n, 9).getValues()
    .map(function (f, i) {
      return {
        fila: 5 + i, nombre: String(f[0] || ''), usuario: String(f[1] || '').toLowerCase().trim(),
        hash: String(f[2] || ''), sal: String(f[3] || ''), rol: String(f[4] || ''),
        activo: String(f[5] || '').toUpperCase() !== 'NO',
        creado: f[6], ultimo: f[7],
        debeCambiar: String(f[8] || '').toUpperCase() === 'SÍ'
      };
    })
    .filter(function (u) { return u.usuario; });
}

function buscarUsuario_(usuario) {
  const u = String(usuario || '').toLowerCase().trim();
  const todos = filasUsuarios_();
  for (let i = 0; i < todos.length; i++) if (todos[i].usuario === u) return todos[i];
  return null;
}

function nuevaSesion_(u) {
  const token = Utilities.getUuid() + '.' + Utilities.getUuid();
  const datos = JSON.stringify({
    usuario: u.usuario, nombre: u.nombre, rol: u.rol,
    vence: Date.now() + SESION_HORAS * 3600 * 1000
  });
  CacheService.getScriptCache().put('ses_' + token, datos, SESION_HORAS * 3600);
  return token;
}

function sesion_(token) {
  const t = String(token || '');
  if (!t) throw new Error('SIN_SESION');
  const crudo = CacheService.getScriptCache().get('ses_' + t);
  if (!crudo) throw new Error('SIN_SESION');
  const s = JSON.parse(crudo);
  if (!s.vence || s.vence < Date.now()) throw new Error('SIN_SESION');
  const u = buscarUsuario_(s.usuario);
  if (!u || !u.activo) throw new Error('SIN_SESION');
  s.rol = u.rol;
  s.nombre = u.nombre;
  return s;
}

function hayUsuarios() { return filasUsuarios_().length > 0; }

function crearAdministradora(d) {
  if (filasUsuarios_().length)
    throw new Error('Ya hay usuarios creados. Entre con el suyo.');
  altaUsuario_({ nombre: d.nombre, usuario: d.usuario, clave: d.clave, rol: 'Contadora' });
  return iniciarSesion(d.usuario, d.clave);
}

function iniciarSesion(usuario, clave) {
  const u = buscarUsuario_(usuario);
  const falla = 'Usuario o contraseña incorrectos.';
  if (!u) { Utilities.sleep(400); throw new Error(falla); }
  if (!u.activo) throw new Error('Ese usuario está desactivado. Hable con la contadora.');
  if (!igualSeguro_(cifrar_(clave, u.sal), u.hash)) { Utilities.sleep(400); throw new Error(falla); }
  hojaUsuarios_().getRange(u.fila, 8).setValue(new Date());
  SpreadsheetApp.flush();
  return { token: nuevaSesion_(u), nombre: u.nombre, usuario: u.usuario,
           rol: u.rol, debeCambiar: u.debeCambiar };
}

function cerrarSesion(token) {
  try { CacheService.getScriptCache().remove('ses_' + String(token || '')); } catch (e) { }
  return true;
}

function altaUsuario_(d) {
  const nombre = txt_(d.nombre, 120);
  const usuario = String(d.usuario || '').toLowerCase().trim();
  const clave = String(d.clave || '');
  const rol = String(d.rol || 'Auxiliar');
  if (!nombre) throw new Error('Escriba el nombre completo.');
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario))
    throw new Error('El usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo. Sin espacios ni tildes.');
  if (clave.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
  if (['Auxiliar', 'Contadora', 'Gerencia'].indexOf(rol) === -1)
    throw new Error('Rol no válido: ' + rol);
  if (buscarUsuario_(usuario)) throw new Error('Ya existe un usuario con ese nombre: ' + usuario);
  const h = hojaUsuarios_();
  const sal = sal_();
  const fila = Math.max(h.getLastRow() + 1, 5);
  h.getRange(fila, 1, 1, 9).setValues([[
    nombre.toUpperCase(), usuario, cifrar_(clave, sal), sal, rol,
    'Sí', new Date(), '', (d.debeCambiar === false ? 'No' : 'Sí')
  ]]);
  h.getRange(fila, 7).setNumberFormat('DD/MM/YYYY HH:mm');
  h.getRange(fila, 8).setNumberFormat('DD/MM/YYYY HH:mm');
  SpreadsheetApp.flush();
  return { nombre: nombre, usuario: usuario, rol: rol };
}

function crearUsuario(d) { altaUsuario_(d); return listarUsuarios(); }

function listarUsuarios() {
  return filasUsuarios_().map(function (u) {
    return {
      nombre: u.nombre, usuario: u.usuario, rol: u.rol, activo: u.activo,
      creado: u.creado instanceof Date ? fmt_(u.creado) : '',
      ultimo: u.ultimo instanceof Date
        ? Utilities.formatDate(u.ultimo, ZONA, 'dd/MM/yyyy HH:mm') : 'Nunca',
      debeCambiar: u.debeCambiar
    };
  });
}

function cambiarRolUsuario(usuario, rol) {
  const u = buscarUsuario_(usuario);
  if (!u) throw new Error('No existe ese usuario.');
  if (['Auxiliar', 'Contadora', 'Gerencia'].indexOf(rol) === -1)
    throw new Error('Rol no válido.');
  if (u.rol === 'Contadora' && rol !== 'Contadora') {
    const otras = filasUsuarios_().filter(function (x) {
      return x.rol === 'Contadora' && x.activo && x.usuario !== u.usuario; });
    if (!otras.length)
      throw new Error('No puede quitar la última contadora: nadie podría volver a administrar usuarios.');
  }
  hojaUsuarios_().getRange(u.fila, 5).setValue(rol);
  SpreadsheetApp.flush();
  return listarUsuarios();
}

function activarUsuario(usuario, activo) {
  const u = buscarUsuario_(usuario);
  if (!u) throw new Error('No existe ese usuario.');
  if (!activo && u.rol === 'Contadora') {
    const otras = filasUsuarios_().filter(function (x) {
      return x.rol === 'Contadora' && x.activo && x.usuario !== u.usuario; });
    if (!otras.length) throw new Error('No puede desactivar la última contadora activa.');
  }
  hojaUsuarios_().getRange(u.fila, 6).setValue(activo ? 'Sí' : 'No');
  SpreadsheetApp.flush();
  return listarUsuarios();
}

function restablecerClave(usuario, claveNueva, debeCambiar) {
  const u = buscarUsuario_(usuario);
  if (!u) throw new Error('No existe ese usuario.');
  const clave = String(claveNueva || '');
  if (clave.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
  const h = hojaUsuarios_();
  const sal = sal_();
  h.getRange(u.fila, 3).setValue(cifrar_(clave, sal));
  h.getRange(u.fila, 4).setValue(sal);
  h.getRange(u.fila, 9).setValue(debeCambiar === false ? 'No' : 'Sí');
  SpreadsheetApp.flush();
  return listarUsuarios();
}

function cambiarMiClave(usuarioActual, claveVieja, claveNueva) {
  const u = buscarUsuario_(usuarioActual);
  if (!u) throw new Error('No existe ese usuario.');
  if (!igualSeguro_(cifrar_(claveVieja, u.sal), u.hash))
    throw new Error('La contraseña actual no coincide.');
  const clave = String(claveNueva || '');
  if (clave.length < 6) throw new Error('La contraseña nueva debe tener al menos 6 caracteres.');
  if (igualSeguro_(cifrar_(clave, u.sal), u.hash))
    throw new Error('La contraseña nueva no puede ser igual a la actual.');
  const h = hojaUsuarios_();
  const sal = sal_();
  h.getRange(u.fila, 3).setValue(cifrar_(clave, sal));
  h.getRange(u.fila, 4).setValue(sal);
  h.getRange(u.fila, 9).setValue('No');
  SpreadsheetApp.flush();
  return true;
}

/* ---------- LA PUERTA ÚNICA ---------- */

const SOLO_CONTADORA = [
  'listarUsuarios', 'crearUsuario', 'cambiarRolUsuario', 'activarUsuario',
  'restablecerClave', 'datosGestion', 'listaCasos', 'guardarDecision',
  'datosRevision', 'anotarFila', 'datosParams', 'agregarResponsable'
];
const CONTADORA_O_GERENCIA = ['relacionesParaAprobar', 'aprobarRelacion'];

const PERMITIDAS = [
  'panelDatos', 'datosWeb', 'datosRelacion', 'datosTablero', 'datosGestion',
  'datosPoliticas', 'datosBanco', 'datosInformes', 'datosEntregas',
  'confirmarEntrega', 'datosAuditoria', 'datosParams', 'agregarResponsable',
  'datosUbicacion', 'guardarPago', 'guardarIngreso', 'guardarEntrega',
  'guardarArqueo', 'datosCierre', 'cerrarRelacion', 'listaPendientes',
  'linkWhatsApp', 'consultaTercero', 'listaTercerosBanca', 'listaCasos',
  'guardarDecision', 'subirLote', 'registrarLote', 'datosEmpalme',
  'generarEmpalme', 'datosRevision', 'anotarFila', 'relacionesParaAprobar',
  'aprobarRelacion', 'agregarALista', 'listarUsuarios', 'crearUsuario',
  'cambiarRolUsuario', 'activarUsuario', 'restablecerClave', 'cambiarMiClave',
  'datosAccesos'
];

function api(token, nombreFuncion, args) {
  const s = sesion_(token);
  const fn = String(nombreFuncion || '');
  if (PERMITIDAS.indexOf(fn) === -1) throw new Error('Operación no permitida: ' + fn);
  if (SOLO_CONTADORA.indexOf(fn) > -1 && s.rol !== 'Contadora')
    throw new Error('Esa pantalla es solo de la contadora.');
  if (CONTADORA_O_GERENCIA.indexOf(fn) > -1 && s.rol !== 'Contadora' && s.rol !== 'Gerencia')
    throw new Error('Esa operación es de gerencia o de la contadora.');

  const f = globalThis[fn];
  if (typeof f !== 'function') throw new Error('No existe la operación ' + fn + '.');
  const a = Array.isArray(args) ? args.slice() : [];

  if (fn === 'cambiarMiClave') a[0] = s.usuario;
  if (fn === 'datosUbicacion') a[0] = s.rol;   /* el rol lo pone el servidor, no la página */
  if (['guardarPago', 'guardarIngreso', 'guardarEntrega'].indexOf(fn) > -1 &&
      a[0] && typeof a[0] === 'object') a[0].quien = s.nombre;
  if (fn === 'registrarLote' && Array.isArray(a[0]))
    a[0].forEach(function (x) { x.quien = s.nombre; });

  const r = f.apply(null, a);
  const rolWeb = s.rol === 'Contadora' ? 'contadora'
               : s.rol === 'Gerencia'  ? 'gerencia' : 'auxiliar';
  if (r && typeof r === 'object') {
    if (fn === 'datosWeb' || fn === 'panelDatos' || r.rol !== undefined) {
      r.rol = rolWeb; r.quien = s.nombre; r.usuario = s.usuario;
    }
    if (r.panel) { r.panel.rol = rolWeb; r.panel.quien = s.nombre; r.panel.usuario = s.usuario; }
  }
  return r;
}


/**
 * Escribe una fila de la Relación SIN pisar las fórmulas que ya tiene.
 * Las columnas Revisión, Plazo DSE y ¿Deducible? son fórmulas: si se les
 * mete un valor, se borran y la hoja deja de avisar lo que falta.
 * Aquí se leen antes y se vuelven a poner, así nadie tiene que acordarse
 * de cuáles son ni de en qué orden quedaron.
 */
function escribirRelacion_(rel, fila, valores) {
  const rango = rel.getRange(fila, 2, 1, valores.length);
  const formulas = rango.getFormulas()[0];
  const v = valores.slice();
  for (var i = 0; i < v.length; i++) {
    if (formulas[i]) v[i] = formulas[i];   /* tenía fórmula: se respeta */
  }
  rango.setValues([v]);
}


/* ================================================================
 *  LIMPIAR LOS MOVIMIENTOS DE PRUEBA DE LA RELACIÓN EN CURSO
 *  Se corre desde el editor, una sola vez.
 *  No toca Movimientos ni Historial: ahí no llegó nada, porque la
 *  relación nunca se cerró.
 * ================================================================ */

/** Busca una fila que todavía conserve sus fórmulas, para usarla de molde. */
function filaMolde_(rel) {
  for (var f = FILA_FIN; f >= FILA_INI; f--) {
    var fs = rel.getRange(f, 2, 1, N_COLS - 1).getFormulas()[0];
    if (fs.filter(String).length >= 2) return f;
  }
  return 0;
}

/** Dice qué se va a borrar, SIN borrar nada. Córrala primero. */
function revisarAntesDeLimpiar() {
  var rel = hoja_(H_REL);
  var molde = filaMolde_(rel);
  if (!molde) { Logger.log('OJO: ninguna fila conserva fórmulas. No limpie: avíseme.'); return; }

  var formulas = rel.getRange(molde, 2, 1, N_COLS - 1).getFormulas()[0];
  var conDatos = [];
  for (var f = FILA_INI; f <= FILA_FIN; f++) {
    if (f === molde) continue;
    var v = rel.getRange(f, 2, 1, N_COLS - 1).getValues()[0];
    var hay = false;
    for (var i = 0; i < v.length; i++) {
      if (!formulas[i] && String(v[i]).trim() !== '') { hay = true; break; }
    }
    if (hay) conDatos.push({ fila: f, n: f - FILA_INI + 1,
                             tercero: String(v[2] || ''), valor: v[10] || v[9] || '' });
  }

  Logger.log('Fila molde (conserva fórmulas): ' + molde);
  Logger.log('Movimientos que se borrarían: ' + conDatos.length);
  conDatos.forEach(function (c) {
    Logger.log('  Fila ' + c.n + ' (hoja ' + c.fila + ') · ' + c.tercero + ' · ' + c.valor);
  });

  var ter = hoja_(H_TER).getRange(2, 1, 60, 2).getValues().filter(function (r) { return r[0] || r[1]; });
  var cas = hoja_(H_CAS).getRange(5, 1, 40, 1).getValues().filter(function (r) { return r[0]; });
  Logger.log('Terceros guardados por las pruebas: ' + ter.length);
  ter.forEach(function (r) { Logger.log('  ' + r[0] + ' · ' + r[1]); });
  Logger.log('Casos abiertos: ' + cas.length);
  Logger.log('--- Esto fue solo un informe. No se borró nada. ---');
}

/** Borra los movimientos y devuelve las fórmulas. Córrala después de revisar. */
function limpiarPruebasDeLaRelacion() {
  var rel = hoja_(H_REL);
  var molde = filaMolde_(rel);
  if (!molde) throw new Error('Ninguna fila conserva fórmulas. No sigo sin revisar primero.');

  var formulas = rel.getRange(molde, 2, 1, N_COLS - 1).getFormulas()[0];
  var vacia = formulas.map(function (fx) { return fx || ''; });
  var n = 0;

  for (var f = FILA_INI; f <= FILA_FIN; f++) {
    if (f === molde) continue;
    var v = rel.getRange(f, 2, 1, N_COLS - 1).getValues()[0];
    var hay = false;
    for (var i = 0; i < v.length; i++) {
      if (!formulas[i] && String(v[i]).trim() !== '') { hay = true; break; }
    }
    if (!hay) continue;
    rel.getRange(f, 2, 1, N_COLS - 1).setValues([vacia]);   /* limpia y repone fórmulas */
    rel.getRange(f, COL_QUIEN, 1, 2).clearContent();        /* quita el sello */
    n++;
  }
  SpreadsheetApp.flush();
  Logger.log('Listo. Movimientos borrados: ' + n);
  Logger.log('Las fórmulas de Revisión, Plazo DSE y ¿Deducible? quedaron repuestas.');
  Logger.log('Terceros y Casos NO se tocaron: revíselos a mano si quedaron datos de prueba.');
  return n;
}
