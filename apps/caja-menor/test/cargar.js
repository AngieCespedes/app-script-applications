/**
 * Carga todos los archivos del servidor en un contexto aislado, como lo hace Apps Script
 * (un solo ámbito global). Los servicios de Google se reemplazan por objetos vacíos:
 * las pruebas solo tocan lógica pura.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function cargar() {
  const dir = path.join(__dirname, '..', 'src', 'server');
  const contexto = vm.createContext({ console });
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js')).sort()) {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), contexto, { filename: f });
  }
  return contexto;
}

/** Encabezados reales del libro V3 (copiados de la hoja). Si el libro cambia, estas pruebas avisan. */
const ENCABEZADOS = {
  relacion: ['Fecha', 'N.° factura / soporte', 'Tercero del documento (vendedor)', 'NIT / C.C.', 'Descripción',
    'Categoría', 'Centro de costo', 'Tipo de soporte', 'Medio de pago', 'Ingreso', 'Egreso', 'Revisión',
    'Recibió el efectivo', 'Estado del soporte', 'Cuenta contable (World Office)', 'Concepto de retención',
    'Plazo DSE', 'Nota para la contadora', '¿Deducible?', 'Origen del ingreso', 'Cliente o pagador',
    'N.° recibo de caja', 'N.° factura que cruza', '¿Cruce aplicado en WO?', 'Registrado por',
    'Fecha y hora del registro'],
  movimientos: ['N.° relación', 'N.°', 'Fecha', 'N.° factura / soporte', 'Tercero del documento', 'NIT / C.C.',
    'Descripción', 'Categoría', 'Centro de costo', 'Tipo de soporte', 'Medio de pago', 'Ingreso', 'Egreso',
    'Recibió el efectivo', 'Estado del soporte', 'Cuenta contable (WO)', 'Concepto de retención', '¿Deducible?',
    'Nota para la contadora', 'Decisión de la contadora', 'Causado en WO', 'Año', 'Mes', 'Revisión',
    'Fecha de cierre', 'Enlace a la foto', 'Origen del ingreso', 'Cliente o pagador', 'N.° recibo de caja',
    'N.° factura que cruza', '¿Cruce aplicado en WO?', 'Responsable de la caja']
};

module.exports = { cargar, ENCABEZADOS };
