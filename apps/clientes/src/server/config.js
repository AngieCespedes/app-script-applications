/**
 * CLIENTES DESDE EL RUT
 * ------------------------------------------------------------
 * Para clientes que solo mandan el RUT en PDF.
 * El script lee el PDF con la API de Drive y crea solo:
 *   - la fila en "Base de datos clientes" (NIT, nombre, celular, ciudad,
 *     dirección, contacto y correo, link del RUT, FECHA y VERIF)
 *   - la carpeta "NIT - NOMBRE" con el PDF adentro
 *
 * Dos formas de que entren los RUT:
 *   A) Los arrastras a la carpeta "RUTs por procesar" en Drive.
 *   B) (Opcional) Los toma de tu Gmail: correos con un PDF adjunto
 *      que sea un RUT. Al procesarlos les pone la etiqueta "RUT procesado".
 *
 * Si el NIT ya existe en la hoja, NO duplica la fila: actualiza el
 * link del RUT, FECHA, VERIF y la carpeta, y solo llena celdas vacías
 * (no pisa contactos que tú ya hayas corregido).
 *
 * INSTALACIÓN (una sola vez)
 *   1. Abre la hoja → Extensiones → Apps Script → pega este archivo.
 *   2. Servicios (+) → agrega "Drive API".
 *   3. Si quieres que lea el correo, pon LEER_GMAIL: true.
 *   4. Guarda y recarga la hoja. La carpeta ya viene configurada
 *      (CARPETA_RAIZ_ID). Para cambiarla: RUTs → "Configurar carpeta".
 *   5. RUTs → "Activar revisión automática (cada 15 min)".
 *   6. Para las filas que ya tienes: RUTs → "Completar filas existentes".
 */

const CONFIG = {
  SPREADSHEET_ID: Config_.id('CONFIG_SPREADSHEET_ID'),
  HOJA: 'Base de datos clientes',
  // Carpeta raíz de RUTs. Se puede cambiar desde el menú RUTs → "Configurar carpeta".
  CARPETA_RAIZ_ID: Config_.id('CONFIG_CARPETA_RAIZ_ID'),
  NOMBRE_BANDEJA: 'RUTs por procesar',      // se crea sola dentro de la raíz
  NOMBRE_NO_RECONOCIDOS: '_No reconocidos', // PDFs que no son RUT
  ANIO_RUT: 2026,                           // VERIF = TRUE si el RUT es de este año o posterior

  LEER_GMAIL: false,
  GMAIL_BUSQUEDA: 'has:attachment filename:pdf newer_than:30d -label:"RUT procesado"',
  GMAIL_ETIQUETA: 'RUT procesado',

  COL: {                                    // 1 = A
    FECHA: 1, NIT: 2, NOMBRE: 3, CELULAR: 4, CIUDAD: 5, DIRECCION: 6,
    CONTACTO_FACT: 7, CORREO_FACT: 8, CONTACTO_TES: 9, CORREO_TES: 10,
    RUT: 11, FECHA_RUT: 12, VERIF: 13, CORREO: 14, CARPETA: 15
  }
};

/** Palabras que son etiquetas del formulario de la DIAN, nunca datos del cliente. */
const ETIQUETAS_RUT_ = new RegExp('(' + [
  '^establecimientos?$', 'n[úu]mero\\s+establecimientos', 'caracter[íi]sticas y formas',
  'actividad (principal|secundaria|econ[óo]mica)', '^otras actividades', '^ocupaci[óo]n$',
  '^c[óo]digo$', 'n[úu]mero de (formulario|identificaci|folios)', 'fecha (inicio|generaci|de expedici)',
  'responsabilidades', 'calidades y atributos',
  'usuarios aduaneros', '^exportadores$', '^anexos', 'firma (autorizada|del solicitante)',
  '^cargo$', '^identificaci[óo]n$', '^ubicaci[óo]n$', '^clasificaci[óo]n$', '^\\d*\\.?\\s*departamento$',
  'ciudad/municipio', 'raz[óo]n social', 'nombre comercial', '^\\d*\\.?\\s*sigla$', 'primer apellido',
  'segundo apellido', 'primer nombre', 'otros nombres', 'tipo de contribuyente', 'tipo de documento',
  'lugar de expedici', 'direcci[óo]n seccional', 'buz[óo]n electr', '^concepto$', 'tel[ée]fono [12]',
  'correo electr', 'direcci[óo]n principal', 'c[óo]digo postal', 'actuaci[óo]n de oficio',
  '^importante', 'sin perjuicio', 'espacio reservado', 'uso exclusivo', '^persona natural',
  '^persona jur[íi]dica', 'impuestos y aduanas', 'sucesi[óo]n il[íi]quida',
  '^naturaleza$', 'formas asociativas', '^p[áa]gina'
].join('|') + ')', 'i');

