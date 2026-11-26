/**
 * COMO SE VE UNA ORDEN: el monton donde cae, el semaforo y la linea de tiempo.
 *
 * Todo lo de este archivo es de solo lectura: arma la vista a partir de lo que
 * ya esta en la hoja. Nada de aqui escribe.
 */

/**
 * En que monton va una orden dentro de «Mercancia y factura».
 * El orden de los montones es el orden en que hay que atenderlos: primero lo
 * que ya salio plata y no tiene papel, que es lo que duele en una revision.
 */
function ocGrupoFactura_(o) {
  var pagado = o.pagado > 0;
  var tieneDoc = String(o.factura).trim() !== '' || String(o.tipoDoc).trim() !== '';
  var recibida = String(o.mercancia).trim().toUpperCase() === 'SI';
  var causada  = String(o.causada).trim().toUpperCase() === 'SI';
  var ver = String(o.veredicto).trim().toUpperCase();

  /* Lo devuelto va de primero: alguien tiene que mover ficha para que avance. */
  if (ver === 'DEBE CORREGIRSE') return { n: 0, titulo: 'DEVUELTAS PARA CORREGIR', color: 'rojo' };
  if (ver === 'CON NOVEDAD')     return { n: 1, titulo: 'CON NOVEDAD — EN SEGUIMIENTO', color: 'ambar' };

  if (pagado && !tieneDoc) return { n: 2, titulo: 'YA SE PAGÓ Y NO HA LLEGADO LA FACTURA', color: 'rojo' };
  if (pagado && !recibida) return { n: 3, titulo: 'YA SE PAGÓ, FALTA CONFIRMAR LA MERCANCÍA', color: 'ambar' };
  if (tieneDoc && recibida && !causada) return { n: 4, titulo: 'LISTAS PARA CAUSAR', color: 'azul' };
  if (o.estado.toUpperCase() === 'APROBADA' && o.saldo > 0) {
    return { n: 5, titulo: 'APROBADAS, ESPERANDO PAGO — ESTÉ PENDIENTE DE LA FACTURA', color: 'azul' };
  }
  if (o.estado.toUpperCase() === 'SOLICITADA') {
    return { n: 6, titulo: 'TODAVÍA ESPERANDO A GERENCIA', color: 'gris' };
  }
  return { n: 7, titulo: 'AL DÍA', color: 'verde' };
}

/* Semaforo de la orden: verde solo cuando esta todo.
   Lo ve igual compras, gerencia y quien pidio la orden. */
function ocTraza_(o) {
  if (String(o.estado).toUpperCase() === 'RECHAZADA') return { estado: 'RECHAZADA', color: 'gris', detalle: '' };

  var ver = String(o.veredicto).trim().toUpperCase();
  if (ver === 'DEBE CORREGIRSE') {
    return { estado: 'DEBE CORREGIRSE', color: 'rojo', detalle: o.notaSolicitante || 'Revise la orden' };
  }
  var mal = o.comoLlego && String(o.comoLlego).toUpperCase().indexOf('BIEN') < 0;
  if (mal) return { estado: 'CON NOVEDAD', color: 'rojo', detalle: o.obsAlmacen || 'La mercancia no llego bien' };
  if (ver === 'CON NOVEDAD') {
    return { estado: 'CON NOVEDAD', color: 'ambar', detalle: o.notaSolicitante || '' };
  }

  var falta = [];
  if (o.saldo > 0) falta.push('pagar');
  if (!o.factura) falta.push('factura');
  if (o.factura && !o.numeroWO) falta.push('cruce contable');
  if (!o.comoLlego) falta.push('almacen');

  if (!falta.length) return { estado: 'OK', color: 'verde', detalle: 'Factura cruzada y mercancia completa' };
  return { estado: 'FALTA ' + falta.join(' y ').toUpperCase(), color: 'ambar', detalle: '' };
}

/** El paso de la factura dentro de la linea de tiempo. */
function ocHitoFactura_(o) {
  if (!o.factura) return { hito: 'Falta la factura', fecha: '', ok: false, soporte: o.linkFactura || '' };
  var txt = 'Llego la factura ' + o.factura +
            (o.numeroWO ? ' — en World Office como ' + o.numeroWO : ' — falta cruzarla con contabilidad');
  return { hito: txt, fecha: o.fechaFactura || '', ok: !!o.numeroWO,
           alerta: !o.numeroWO, soporte: o.linkFactura || '' };
}

/** El ultimo paso: como dejo la orden quien la causa. */
function ocHitoRevision_(o) {
  var ver = String(o.veredicto).trim().toUpperCase();
  if (!ver) return null;
  var quien = o.registradaPor ? ' (' + o.registradaPor + ')' : '';
  if (ver === 'RECTIFICADO') {
    return { hito: 'Contabilidad la reviso y quedo bien' + quien, fecha: o.fechaRevision || '', ok: true };
  }
  return { hito: ver + quien + (o.notaSolicitante ? ': ' + o.notaSolicitante : ''),
           fecha: o.fechaRevision || '', ok: false, alerta: true };
}

/** La linea de tiempo que ve cada area de SU orden. */
function ocLineaTiempo_(o) {
  var p = [];
  p.push({ hito: 'La pidio ' + o.solicita + ' (' + o.area + ')', fecha: o.fecha, ok: true });
  p.push({ hito: String(o.estado).toUpperCase() === 'RECHAZADA'
             ? 'Gerencia la rechazo: ' + (o.comentario || 'sin comentario')
             : 'Gerencia la aprobo',
           fecha: o.fechaDecision || '', ok: String(o.estado).toUpperCase() !== 'SOLICITADA',
           alerta: String(o.estado).toUpperCase() === 'RECHAZADA' });
  p.push({ hito: o.pagado > 0 ? 'Tesoreria pago' + (o.saldo > 0 ? ' un abono, queda saldo' : '') : 'Falta el pago',
           fecha: o.fechaPago || '', ok: o.pagado > 0 && o.saldo <= 0, alerta: o.pagado > 0 && o.saldo > 0,
           soporte: o.soporte || '' });
  p.push(ocHitoFactura_(o));
  p.push({ hito: o.comoLlego
             ? 'Almacen: ' + o.comoLlego + (o.obsAlmacen ? ' — ' + o.obsAlmacen : '')
             : 'Falta confirmar la llegada a almacen',
           fecha: o.fechaRecibido || '', ok: !!(o.comoLlego && String(o.comoLlego).toUpperCase().indexOf('BIEN') >= 0),
           alerta: !!(o.comoLlego && String(o.comoLlego).toUpperCase().indexOf('BIEN') < 0),
           soporte: o.fotoLlegada || '' });
  var rev = ocHitoRevision_(o);
  if (rev) p.push(rev);
  return p;
}

function ocResumen_(filas) {
  var r = { total: filas.length, esperando: 0, porPagar: 0, pagadas: 0,
            sinFactura: 0, sinDocSoporte: 0, porCausar: 0, listas: 0, devueltas: 0,
            valorTotal: 0, valorPagado: 0, platapendiente: 0 };
  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    var e = String(f.estado).toUpperCase();
    r.valorTotal  += f.total;
    r.valorPagado += f.pagado;
    if (e === 'SOLICITADA') r.esperando++;
    if (e === 'APROBADA' && f.saldo > 0) r.porPagar++;
    if (f.pagado > 0) r.pagadas++;
    if (f.falta === 'FALTA FACTURA ELECTRONICA') { r.sinFactura++; r.platapendiente += f.pagado; }
    if (f.falta === 'FALTA ELABORAR DOCUMENTO SOPORTE') { r.sinDocSoporte++; r.platapendiente += f.pagado; }
    if (f.falta === 'FALTA CAUSAR EN WORLD OFFICE') r.porCausar++;
    if (f.falta === 'LISTA') r.listas++;
    if (String(f.veredicto).trim().toUpperCase() === 'DEBE CORREGIRSE') r.devueltas++;
  }
  return r;
}
