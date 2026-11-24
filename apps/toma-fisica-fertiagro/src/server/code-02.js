function registrarBitacora_(quien, idProd, producto, accion, antes, despues, motivo) {
  var b = hoja_('BITACORA');
  var vals = b.getRange(FILA_INI, 1, 2000, 1).getValues();
  var fila = -1;
  for (var i = 0; i < vals.length; i++) {
    if (vals[i][0] === '' || vals[i][0] === null) { fila = i + FILA_INI; break; }
  }
  if (fila === -1) return;
  b.getRange(fila, 1, 1, 8).setValues([[new Date(), quien, idProd, producto,
    accion, antes, despues, motivo]]);
}

function guardarFoto_(base64, nombre) {
  try {
    var padres = DriveApp.getFileById(SHEET_ID).getParents();
    var raiz = padres.hasNext() ? padres.next() : DriveApp.getRootFolder();
    var it = raiz.getFoldersByName(CARPETA_FOTOS);
    var carpeta = it.hasNext() ? it.next() : raiz.createFolder(CARPETA_FOTOS);
    var partes = base64.split(',');
    var blob = Utilities.newBlob(
      Utilities.base64Decode(partes[1]), 'image/jpeg',
      nombre + '_' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd_HHmmss') + '.jpg');
    return carpeta.createFile(blob).getUrl();
  } catch (e) {
    return 'ERROR AL GUARDAR FOTO: ' + e.message;
  }
}

/* Deja la respuesta en texto y numeros simples: cualquier fecha o valor raro
   de la hoja hacia caer el panel al pasarlo al navegador. */
function limpio_(o) {
  if (o === null || o === undefined) return '';
  if (o instanceof Date) return isNaN(o.getTime()) ? '' : Utilities.formatDate(o, TZ, 'dd/MM/yyyy');
  if (Object.prototype.toString.call(o) === '[object Array]') {
    var a = []; for (var i = 0; i < o.length; i++) a.push(limpio_(o[i])); return a;
  }
  if (typeof o === 'object') {
    var x = {}; for (var k in o) x[k] = limpio_(o[k]); return x;
  }
  if (typeof o === 'number') return isFinite(o) ? o : 0;
  if (typeof o === 'boolean') return o;
  return String(o);
}

function getPanel_(usuario, clave) {
  var u = autenticar_(usuario, clave);
  if (!u || !VE_PANEL[u.rol]) return { ok: false, msg: 'Su usuario no tiene acceso al panel.' };

  var m = hoja_('MAESTRO');
  var nm = m.getLastRow() - FILA_INI + 1;
  var cats = m.getRange(FILA_INI, 2, nm, 9).getValues();
  var totalCat = {}, nActivos = 0;
  cats.forEach(function (f) {
    if (String(f[8]).trim().toUpperCase() === 'DESCONTINUADO') return;
    nActivos++;
    var k = String(f[0]).trim();
    totalCat[k] = (totalCat[k] || 0) + 1;
  });

  var c = hoja_('CONTEO');
  var filas = c.getRange(FILA_INI, 1, MAX_CONTEO - FILA_INI + 1, 23).getValues()
    .filter(function (f) { return f[1] !== '' && f[1] !== null; });

  var hechosCat = {}, porPersona = {}, vencidos = [], sinFactura = [], vistos = {};
  filas.forEach(function (f) {
    var cat = String(f[17]).trim(), q = String(f[16]).trim();
    if (!vistos[f[1]]) { vistos[f[1]] = true; hechosCat[cat] = (hechosCat[cat] || 0) + 1; }
    if (!porPersona[q]) porPersona[q] = { contados: 0, segundos: 0, recuentos: 0, cats: {} };
    porPersona[q].contados++;
    porPersona[q].cats[cat] = true;
    porPersona[q].segundos += Math.max(0, (new Date(f[19]) - new Date(f[18])) / 1000);
    if (Number(f[21]) > 1) porPersona[q].recuentos++;
    if (Number(f[6]) > 0) vencidos.push({
      producto: f[3] || f[2], total: f[4], vencidos: f[6],
      fecha: f[8], nota: f[9], quien: q
    });
    if (String(f[12]).toUpperCase() === 'SI') sinFactura.push({
      producto: f[3] || f[2], cantidad: f[4], motivo: f[13], quien: q, origen: 'En lista'
    });
  });

  var nl = hoja_('NO_LISTADOS').getRange(FILA_INI, 1, 500, 13).getValues()
    .filter(function (f) { return f[0] !== '' && f[0] !== null; });
  nl.forEach(function (f) {
    if (String(f[8]).toUpperCase() === 'SI') sinFactura.push({
      producto: f[1], cantidad: f[4], motivo: f[9], quien: f[11], origen: 'Creado en campo'
    });
  });

  var bit = hoja_('BITACORA').getRange(FILA_INI, 1, 2000, 8).getValues()
    .filter(function (f) { return f[0] !== '' && f[0] !== null; })
    .slice(-40).reverse()
    .map(function (f) {
      return {
        hora: Utilities.formatDate(new Date(f[0]), TZ, 'dd/MM HH:mm'),
        quien: f[1], producto: f[3], accion: f[4],
        cambio: (f[5] || '-') + ' -> ' + (f[6] || '-'), motivo: f[7]
      };
    });

  var personas = Object.keys(porPersona).map(function (q) {
    var p = porPersona[q];
    return {
      nombre: q, contados: p.contados,
      minutos: Math.round(p.segundos / 60),
      ritmo: p.contados ? (p.segundos / 60 / p.contados).toFixed(1) : '-',
      recuentos: p.recuentos,
      categorias: Object.keys(p.cats).length
    };
  });

  var res = {
    ok: true, rol: u.rol, total: nActivos,
    contados: Object.keys(vistos).length,
    vencidosUnidades: vencidos.reduce(function (s, v) { return s + Number(v.vencidos || 0); }, 0),
    creados: nl.length,
    categorias: Object.keys(totalCat).sort().map(function (k) {
      return { categoria: k, total: totalCat[k], hechos: hechosCat[k] || 0 };
    }),
    personas: personas,
    vencidos: vencidos.slice(0, 60),
    sinFactura: sinFactura.slice(0, 60),
    bitacora: bit
  };
  return limpio_(res);
}

