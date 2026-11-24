 // presupuestado, entregado, legalizado (validados para daltonismo)
function dashboard_(ss) {
  let d = ss.getSheetByName(HOJA_DASH);
  const nueva = !d;
  if (nueva) {
    d = ss.insertSheet(HOJA_DASH, 0);
    d.setHiddenGridlines(true);
    [260, 130, 130, 130, 150, 110, 110].forEach(function (w, i) { d.setColumnWidth(i + 1, w); });
    d.getRange('A1').setValue('DASHBOARD DE VIÁTICOS').setFontSize(16).setFontWeight('bold');
    d.getRange('A2:G2').merge().setValue('Compara por proyecto lo PRESUPUESTADO (solicitudes no rechazadas), lo ENTREGADO (solicitudes aprobadas) y lo LEGALIZADO ' +
      '(gastos registrados). Se calcula solo desde "' + HOJA_REG + '" y "' + HOJA_GASTOS + '": no escribir en esta hoja.')
      .setFontStyle('italic').setFontSize(9).setFontColor('#666666').setWrap(true);
    d.setRowHeight(2, 32);
    d.getRange(DASH_T0, 1, 1, 7).setValues([['Proyecto', 'Presupuestado', 'Entregado', 'Legalizado', 'Por relacionar (entregado − legalizado)',
      '% entregado de lo presupuestado', '% legalizado de lo entregado']])
      .setBackground(NEGRO).setFontColor('#FFFFFF').setFontWeight('bold').setFontSize(9).setWrap(true).setHorizontalAlignment('center').setVerticalAlignment('middle');
    d.setRowHeight(DASH_T0, 36);
    d.getRange('A7').setValue('La tabla trae las cifras exactas de cada proyecto; las gráficas están a la derecha.').setFontStyle('italic').setFontSize(9).setFontColor('#666666');
  }
  // Lista de proyectos (se rehace; las fórmulas usan el nombre de cada fila)
  const proy = leerProyectos_(ss).map(function (p) { return p.nombre; });
  const f0 = DASH_T0 + 1, n = Math.max(proy.length, 1), f1 = f0 + n - 1, tot = f1 + 1;
  const viejo = d.getMaxRows() - f0 + 1;
  if (viejo > 0) d.getRange(f0, 1, viejo, 7).clear();
  const R = HOJA_REG, G = HOJA_GASTOS, filas = [];
  for (let i = 0; i < n; i++) {
    const r = f0 + i;
    filas.push([proy[i] || '',
      '=IF($A' + r + '="";"";SUMIFS(' + R + '!$J:$J;' + R + '!$E:$E;$A' + r + ';' + R + '!$O:$O;"<>Rechazado"))',
      '=IF($A' + r + '="";"";SUMIFS(' + HOJA_ENT + '!$F:$F;' + HOJA_ENT + '!$D:$D;$A' + r + ';' + HOJA_ENT + '!$H:$H;"Entregado"))',
      '=IF($A' + r + '="";"";SUMIFS(' + G + '!$I:$I;' + G + '!$E:$E;$A' + r + '))',
      '=IF($A' + r + '="";"";C' + r + '-D' + r + ')',
      '=IF(N(B' + r + ')=0;"";C' + r + '/B' + r + ')',
      '=IF(N(C' + r + ')=0;"";D' + r + '/C' + r + ')']);
  }
  filas.push(['TOTAL', '=SUM(B' + f0 + ':B' + f1 + ')', '=SUM(C' + f0 + ':C' + f1 + ')', '=SUM(D' + f0 + ':D' + f1 + ')', '=SUM(E' + f0 + ':E' + f1 + ')',
    '=IF(N(B' + tot + ')=0;"";C' + tot + '/B' + tot + ')', '=IF(N(C' + tot + ')=0;"";D' + tot + '/C' + tot + ')']);
  d.getRange(f0, 1, filas.length, 7).setValues(filas);
  intentar_(function () {
    d.getRange(f0, 2, filas.length, 4).setNumberFormat('$ #,##0;[Red]-$ #,##0');
    d.getRange(f0, 6, filas.length, 2).setNumberFormat('0%');
    d.getRange(f0, 1, n, 1).setFontSize(9);
    d.getRange(DASH_T0, 1, filas.length + 1, 7).setBorder(true, true, true, true, true, true, '#D9D9D9', SpreadsheetApp.BorderStyle.SOLID);
    d.getRange(tot, 1, 1, 7).setBackground('#FFE7B0').setFontWeight('bold');
    d.setFrozenRows(DASH_T0);
  });
  // Cifras grandes
  const tarjetas = [['A', 'PRESUPUESTADO', 'B', DASH_COLORES[0]], ['B', 'ENTREGADO', 'C', DASH_COLORES[1]], ['C', 'LEGALIZADO', 'D', DASH_COLORES[2]],
    ['D', 'POR RELACIONAR', 'E', null], ['E', '% ENTREGADO', 'F', null], ['F', '% LEGALIZADO', 'G', null]];
  tarjetas.forEach(function (t) {
    d.getRange(t[0] + '4').setValue(t[1]).setFontSize(8).setFontWeight('bold').setFontColor('#595959').setHorizontalAlignment('center').setBackground('#F2F2F2');
    d.getRange(t[0] + '5').setFormula('=' + t[2] + tot).setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#F2F2F2')
      .setNumberFormat(t[1].charAt(0) === '%' ? '0%' : '$ #,##0;[Red]-$ #,##0');
    if (t[3]) intentar_(function () { d.getRange(t[0] + '4').setBorder(true, null, null, null, null, null, t[3], SpreadsheetApp.BorderStyle.SOLID_THICK); });
  });
  d.setRowHeight(5, 34);
  // Gráficas: se rehacen para que tomen todas las filas
  intentar_(function () {
    d.getCharts().forEach(function (c) { d.removeChart(c); });
    d.insertChart(d.newChart().setChartType(Charts.ChartType.COLUMN)
      .addRange(d.getRange(DASH_T0, 2, 1, 3)).addRange(d.getRange(tot, 2, 1, 3))
      .setTransposeRowsAndColumns(true).setNumHeaders(1)
      .setOption('title', 'Total: presupuestado vs. entregado vs. legalizado').setOption('legend', { position: 'none' })
      .setOption('colors', DASH_COLORES).setOption('vAxis', { format: '$#,##0' })
      .setPosition(1, 9, 0, 0).setOption('width', 620).setOption('height', 300).build());
    d.insertChart(d.newChart().setChartType(Charts.ChartType.BAR)
      .addRange(d.getRange(DASH_T0, 1, n + 1, 4)).setNumHeaders(1)
      .setOption('title', 'Por proyecto').setOption('legend', { position: 'bottom' })
      .setOption('colors', DASH_COLORES).setOption('hAxis', { format: '$#,##0' })
      .setPosition(18, 9, 0, 0).setOption('width', 620).setOption('height', Math.max(320, 26 * n + 80)).build());
  });
  return d;
}

/* ==================== AGREGAR VARIOS PROYECTOS ==================== */

function dialogoProyectos() { Guardas_.persona();
  const ui = soloAdmin_();
  if (!instalado_()) { ui.alert('Primero usa "1. Instalar sistema".'); return; }
  // Llave de un solo uso: sin ella nadie puede llamar "agregarProyectos" desde fuera de este cuadro
  const llave = Utilities.getUuid();
  CacheService.getScriptCache().put('ADM_' + llave, '1', 1800);
  const html = '<div style="font-family:Arial;font-size:13px">' +
    '<p style="margin:0 0 6px"><b>Un proyecto por línea.</b> Puedes pegar la lista desde Excel.<br>' +
    'Si un proyecto tiene otro jefe, escríbelo así: <i>Proyecto ; Nombre del jefe ; correo</i></p>' +
    '<textarea id="lista" style="width:100%;height:170px;font-size:13px" placeholder="00525.MARIO GONZALES F2&#10;00526.OTRO PROYECTO"></textarea>' +
    '<p style="margin:10px 0 4px">Jefe inmediato para todos (opcional)</p>' +
    '<input id="jefe" style="width:48%" placeholder="Nombre del jefe"> <input id="correo" style="width:48%" placeholder="correo@empresa.com">' +
    '<p><button id="crear" style="padding:8px 16px;background:' + AMARILLO + ';border:0;border-radius:6px;font-weight:bold;cursor:pointer">Crear proyectos</button> ' +
    '<span id="estado"></span></p></div>' +
    '<script>document.getElementById("crear").onclick=function(){var b=this,e=document.getElementById("estado");b.disabled=true;' +
    'e.textContent="Creando carpetas…";google.script.run.withSuccessHandler(function(m){e.textContent=m;b.disabled=false;document.getElementById("lista").value="";})' +
    '.withFailureHandler(function(x){e.textContent=x.message;b.disabled=false;})' +
    '.api("agregarProyectos", "' + llave + '",document.getElementById("lista").value,document.getElementById("jefe").value,document.getElementById("correo").value);};<\/script>';
  ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(380), 'Agregar varios proyectos');
}

// Crea de una vez la fila en "Proyectos" y la carpeta en Drive de cada proyecto de la lista
function agregarProyectos_(llave, textoLista, jefeComun, correoComun) {
  if (!llave || !CacheService.getScriptCache().get('ADM_' + String(llave))) {
    throw new Error('Esta ventana venció. Ciérrala y vuelve a abrir Viáticos > Agregar varios proyectos.');
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const correoPorDefecto = String(correoComun || '').trim().toLowerCase();
  if (correoPorDefecto && !esCorreo_(correoPorDefecto)) throw new Error('El correo del jefe no es válido.');
  const hoja = ss.getSheetByName(HOJA_PROY);
  const existentes = leerProyectos_(ss).map(function (p) { return p.nombre.toUpperCase(); });
  const nuevos = [];
  let repetidos = 0;
  String(textoLista || '').split(/\r?\n/).forEach(function (linea) {
    const partes = linea.split(/\t|;/).map(function (x) { return txt_(x, 120); });
    const nombre = partes[0];
    if (!nombre) return;
    const correoJefe = String(partes[2] || correoPorDefecto).toLowerCase();
    if (correoJefe && !esCorreo_(correoJefe)) throw new Error('Correo no válido en la línea de "' + nombre + '".');
    if (existentes.indexOf(nombre.toUpperCase()) > -1) { repetidos++; return; }
    existentes.push(nombre.toUpperCase());
    nuevos.push([nombre, partes[1] || txt_(jefeComun, 120), correoJefe]);
  });
  if (!nuevos.length) throw new Error(repetidos ? 'Todos esos proyectos ya existen.' : 'Escribe al menos un proyecto.');

  hoja.getRange(Math.max(hoja.getLastRow(), 1) + 1, 1, nuevos.length, 3).setValues(nuevos);
  SpreadsheetApp.flush();
  nuevos.forEach(function (p) {
    const carpeta = carpetaProyecto_(ss, p[0]);
    if (p[2]) {
      try { carpeta.addViewer(p[2]); } catch (err) {} // el jefe solo ve la carpeta de su proyecto
    }
  });

  intentar_(function () { presupuesto_(ss); });
  return nuevos.length + (nuevos.length === 1 ? ' proyecto creado' : ' proyectos creados') + ' con su carpeta.' +
    (repetidos ? ' ' + repetidos + ' ya existían y se omitieron.' : '');
}

/* ================= ELEGIR LA CARPETA DE DRIVE ================= */

// Hace que las carpetas de proyectos (con sus formatos y soportes) vivan dentro de la carpeta indicada
function elegirCarpeta() { Guardas_.persona();
  const ui = soloAdmin_();
  const props = PropertiesService.getScriptProperties();
  if (!instalado_()) { ui.alert('Primero usa "1. Instalar sistema".'); return; }
  const r = ui.prompt('Carpeta de Drive para los viáticos',
    'Pega el enlace de la carpeta donde se deben guardar los proyectos:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const m = /[-\w]{25,}/.exec(r.getResponseText());
  let destino = null;
  try { destino = Aislamiento_.carpeta(m[0]); destino.getName(); } catch (err) { destino = null; }
  if (!destino) {
    ui.alert('No se pudo abrir esa carpeta. Revisa el enlace y que esta cuenta de Google tenga permiso de edición sobre ella.');
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let movidas = 0, creadas = 0;
  leerProyectos_(ss).forEach(function (p) {
    if (!p.carpetaId) return;
    try { Aislamiento_.carpeta(p.carpetaId).moveTo(destino); movidas++; } catch (err) { console.error(p.nombre + ': ' + err); }
  });
  props.setProperty('ROOT_ID', destino.getId());
  leerProyectos_(ss).forEach(function (p) {
    if (!p.carpetaId) { carpetaProyecto_(ss, p.nombre); creadas++; }
  });
  ui.alert('Listo. Los viáticos se guardan ahora en "' + destino.getName() + '".\n\n' +
    'Carpetas de proyecto movidas: ' + movidas + '\nCarpetas de proyecto creadas: ' + creadas);
}

/* ============================== ENLACES ============================== */

function guardarEnlaceApp() { Guardas_.persona();
  const ui = soloAdmin_();
  const r = ui.prompt('Enlace de la app de viáticos',
    'Pega aquí el enlace que te dio "Implementar > Nueva implementación" (termina en /exec):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const url = r.getResponseText().trim();
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) {
    ui.alert('Ese enlace no es válido. Debe empezar por https://script.google.com/ y terminar en /exec.');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('APP_URL', url);
  ui.alert('Enlace guardado. Desde ahora los correos a los trabajadores llevan el enlace directo a su solicitud.');
}

function mostrarEnlaces() { Guardas_.persona();
  const ui = soloAdmin_();
  if (!instalado_()) { ui.alert('Primero usa "1. Instalar sistema".'); return; }
  const app = appUrl_();
  if (!app) {
    ui.alert('La app todavía no está publicada.\n\nEn Apps Script: Implementar > Nueva implementación > Aplicación web. ' +
      'Luego pega el enlace en Viáticos > 3. Guardar enlace de la app.');
    return;
  }
  dialogo_('Enlace para los trabajadores', [
    ['App de viáticos: solicitar, legalizar y aprobar (es el único enlace que se comparte)', app]
  ]);
}

function dialogo_(titulo, enlaces) {
  const html = '<div style="font-family:Arial;font-size:13px">' + enlaces.map(function (p) {
    return '<p><b>' + esc_(p[0]) + '</b><br><a href="' + esc_(p[1]) + '" target="_blank">Abrir</a></p>' +
      '<input style="width:100%" value="' + esc_(p[1]) + '" onclick="this.select()" readonly>';
  }).join('') + '</div>';
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(520).setHeight(110 * enlaces.length + 40), titulo);
}

/* ============ CONSTRUCCIÓN DEL FORMATO (si el archivo está vacío) ============ */

function intentar_(fn) {
  try { fn(); } catch (err) { console.error('Detalle de formato omitido: ' + err); }
}

function construirFormato_(ss) {
  // Solo se construye lo que falta: una hoja que ya existe (con datos reales) nunca se pisa
  const t = ss.getSheetByName(HOJA_TRAB) || construirHoja_(ss, PLANTILLA.trabajadores);
  if (hojaFormato_(ss)) return;
  const f = construirHoja_(ss, PLANTILLA.formato);

  // Listas desplegables y validaciones del formato
  intentar_(function () {
    const regla = function () { return SpreadsheetApp.newDataValidation(); };
    f.getRange('E10').setDataValidation(regla().requireValueInRange(t.getRange('A3:A42'), true).setAllowInvalid(false).build());
    const conceptos = regla().requireValueInRange(t.getRange(2, colConceptos_(t), 41, 1), true).setAllowInvalid(false).build();
    f.getRange('D19:D38').setDataValidation(conceptos);
    f.getRange('I19:I38').setDataValidation(conceptos);
    const valor = regla().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false).build();
    f.getRange('F19:F38').setDataValidation(valor);
    f.getRange('J19:J38').setDataValidation(valor);
    f.getRange('C19:C38').setDataValidation(regla().requireDateOnOrAfter(new Date(2020, 0, 1)).setAllowInvalid(false).build());
  });

  // Logo
  intentar_(function () {
    const blob = Utilities.newBlob(Utilities.base64Decode(PLANTILLA.logo), 'image/png', 'logo.png');
    f.insertImage(blob, 2, 2).setWidth(107).setHeight(66);
  });

  // Quitar la hoja vacía inicial y dejar el formato de primero
  ss.getSheets().forEach(function (h) {
    if (h.getSheetId() !== t.getSheetId() && h.getSheetId() !== f.getSheetId() && h.getLastRow() === 0) {
      intentar_(function () { ss.deleteSheet(h); });
    }
  });
  intentar_(function () { ss.setActiveSheet(f); ss.moveActiveSheet(1); });
  SpreadsheetApp.flush();
}

