/**
 * PROYECCION DE PAGOS — lo aprobado que todavia no se ha pagado.
 *
 * Es la pantalla del corte del jueves al mediodia. Agrupa por area y por
 * centro de costo, porque a nadie le sirve una lista plana de 40 ordenes:
 * lo que se pregunta es «cuanto necesita El Zipa esta semana».
 */

/** En que estado esta una orden frente a su fecha de pago. */
function opEstado_(pago, revisada) {
  if (!revisada) return { clave: 'SIN_REVISAR', texto: 'FALTA COMPRAS', orden: 4 };
  if (!(pago instanceof Date)) return { clave: 'SIN_FECHA', texto: 'SIN PROGRAMAR', orden: 4 };
  var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  var p = new Date(pago.getTime()); p.setHours(0, 0, 0, 0);
  var dias = Math.round((p.getTime() - hoy.getTime()) / 86400000);
  if (dias < 0)  return { clave: 'VENCIDA', texto: 'VENCIDA', orden: 1 };
  if (dias <= 7) return { clave: 'SEMANA',  texto: 'ESTA SEMANA', orden: 2 };
  return { clave: 'PROGRAMADA', texto: 'PROGRAMADA', orden: 3 };
}

/** Los nombres de los centros de costo, para no mostrar solo el codigo. */
function opCentros_() {
  var mapa = {};
  try {
    var hoja = ocHoja_(OC_H_CEN);
    var ult = hoja.getLastRow();
    if (ult < 2) return mapa;
    var d = hoja.getRange(2, 1, ult - 1, 2).getValues();
    for (var i = 0; i < d.length; i++) {
      var c = String(d[i][0]).trim();
      if (c) mapa[c] = String(d[i][1] || '').trim();
    }
  } catch (e) { /* sin hoja de centros, se muestra el codigo solo */ }
  return mapa;
}

/** Una fila de la hoja 10 convertida en orden de la proyeccion, o null. */
function opFila_(d, centros) {
  var numero = String(d[0]).trim();
  if (!numero) return null;
  var estado = String(d[20]).trim().toUpperCase();
  if (estado !== 'APROBADA' && estado !== 'CAUSADA') return null;
  var saldo = ocNum_(d[26]);
  if (saldo <= 0) return null;

  var pago = ocCol_(d, OC_ORD_FPROY);
  if (!(pago instanceof Date)) pago = '';
  var rev = String(ocCol_(d, OC_ORD_REVCOM)).trim();
  var est = opEstado_(pago, rev);
  var cen = String(d[6]).trim() || 'Sin centro';

  return {
    numero: numero,
    area: String(d[5]).trim() || 'Sin área',
    centro: cen, centroNombre: centros[cen] || '',
    proveedor: String(d[8]).trim(),
    descripcion: String(d[10]).trim(),
    saldo: saldo,
    solicita: String(d[4]).trim(),
    fechaNecesidad: ocFecha_(d[2]),
    diasCredito: ocCol_(d, OC_ORD_DIASCR),
    fechaVence: ocFecha_(ocCol_(d, OC_ORD_FVENCE)),
    fechaPago: ocFecha_(pago),
    anio: (pago instanceof Date) ? pago.getFullYear() : 0,
    mes: (pago instanceof Date) ? pago.getMonth() + 1 : 0,
    revisadaCompras: rev,
    nota: String(ocCol_(d, OC_ORD_NOTASOL)),
    estado: est.texto, clave: est.clave, peso: est.orden
  };
}

/** true si esta fila no pasa los filtros de arriba. */
function opFiltrada_(f, filtro) {
  if (filtro.anio && f.anio && f.anio !== Number(filtro.anio)) return true;
  if (filtro.mes  && f.mes  && f.mes  !== Number(filtro.mes))  return true;
  if (filtro.area && filtro.area !== f.area) return true;
  return false;
}

/**
 * filtro: { anio, mes, area }  — todos opcionales.
 * Solo entran las ordenes aprobadas con saldo por pagar.
 */
function ocProyeccion_(ses, filtro) {
  var u = ocUsuario_(ses);
  if (!u) return { ok: false, mensaje: 'Vuelva a entrar.' };
  if (!ocPuede_(u, 'pagar') && !ocPuede_(u, 'verpagos') && !ocPuede_(u, 'informes')) {
    return { ok: false, mensaje: 'Su rol no ve la proyección de pagos.' };
  }
  filtro = filtro || {};

  var hoja = ocHoja_(OC_H_ORD);
  var ult = hoja.getLastRow();
  if (ult < 2) return { ok: true, grupos: [], totales: opTotales_([]), anios: [] };

  var ancho = Math.min(OC_ORD_ANCHO, hoja.getMaxColumns());
  var d = hoja.getRange(2, 1, ult - 1, ancho).getValues();
  var centros = opCentros_();
  var filas = [], anios = {};

  for (var i = 0; i < d.length; i++) {
    var f = opFila_(d[i], centros);
    if (!f) continue;
    if (f.anio) anios[f.anio] = true;
    if (opFiltrada_(f, filtro)) continue;
    filas.push(f);
  }

  filas.sort(function (a, b) { return a.peso - b.peso; });

  return { ok: true, grupos: opAgrupar_(filas), totales: opTotales_(filas),
           anios: Object.keys(anios).sort(), n: filas.length };
}

/** Area → centro de costo → ordenes, con subtotal en cada nivel. */
function opAgrupar_(filas) {
  var areas = {}, orden = [];
  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    if (!areas[f.area]) { areas[f.area] = { area: f.area, total: 0, centros: {}, orden: [] }; orden.push(f.area); }
    var a = areas[f.area];
    a.total += f.saldo;
    var clave = f.centro;
    if (!a.centros[clave]) {
      a.centros[clave] = { centro: f.centro, nombre: f.centroNombre, total: 0, filas: [] };
      a.orden.push(clave);
    }
    a.centros[clave].total += f.saldo;
    a.centros[clave].filas.push(f);
  }
  return orden.map(function (n) {
    var a = areas[n];
    return { area: a.area, total: a.total,
             centros: a.orden.map(function (c) { return a.centros[c]; }) };
  });
}

/** Los cuatro numeros de arriba. */
function opTotales_(filas) {
  var t = { vencida: 0, semana: 0, programada: 0, pendiente: 0,
            nVencida: 0, nSemana: 0, nProgramada: 0, nPendiente: 0 };
  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    if (f.clave === 'VENCIDA')         { t.vencida += f.saldo;    t.nVencida++; }
    else if (f.clave === 'SEMANA')     { t.semana += f.saldo;     t.nSemana++; }
    else if (f.clave === 'PROGRAMADA') { t.programada += f.saldo; t.nProgramada++; }
    else                               { t.pendiente += f.saldo;  t.nPendiente++; }
  }
  return t;
}

/** La misma proyeccion, en Excel y PDF. */
function ocInformeProyeccion_(ses, filtro) {
  var u = ocUsuario_(ses);
  if (!u || !ocPuede_(u, 'informes')) return { ok: false, mensaje: 'Su rol no descarga informes.' };
  var r = ocProyeccion_(ses, filtro);
  if (!r.ok) return r;

  var filas = [];
  for (var i = 0; i < r.grupos.length; i++) {
    var g = r.grupos[i];
    for (var j = 0; j < g.centros.length; j++) {
      var c = g.centros[j];
      for (var k = 0; k < c.filas.length; k++) {
        var f = c.filas[k];
        filas.push([g.area, f.centro, f.centroNombre, f.numero, f.proveedor, f.descripcion,
                    f.saldo, f.solicita, f.fechaNecesidad, f.diasCredito, f.fechaVence,
                    f.fechaPago, f.estado, f.revisadaCompras, f.nota]);
      }
    }
  }

  var libro = infLibro_('PROYECCION DE PAGOS — ' + u.rol);
  var hoja = infEscribir_(libro, 'PROYECCIÓN DE PAGOS',
    ['AREA', 'CENTRO DE COSTO', 'PROYECTO', 'N° ORDEN', 'PROVEEDOR', 'DESCRIPCION',
     'SALDO POR PAGAR', 'LA PIDIO', 'LA NECESITA', 'DIAS DE CREDITO', 'VENCE',
     'SE PAGA', 'ESTADO', 'REVISADA POR COMPRAS', 'NOTA'], filas);

  var e = infEnlaces_(libro, hoja);
  return { ok: true, n: filas.length, excel: e.excel, pdf: e.pdf };
}
