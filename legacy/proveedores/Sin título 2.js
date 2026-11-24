/**
 * LIMPIEZA DE CARPETAS DUPLICADAS DE PROVEEDORES
 *
 * Debe ejecutarlo la cuenta PROPIETARIA de la carpeta (auxiliar.contablesocial@gmail.com).
 * 1. Abrir la hoja "BASE DE DATOS PROVEEDORES" > Extensiones > Apps Script.
 * 2. Pegar este archivo completo en un archivo nuevo y guardar.
 * 3. Ejecutar primero  revisarSinCambios  y mirar el registro (Ver > Registros).
 * 4. Si todo se ve bien, ejecutar  limpiarDuplicados.
 *
 * Qué hace:
 *  - MOVER: pasa a la carpeta que se conserva los archivos enlazados en la hoja que
 *    estaban en otra carpeta del mismo proveedor (mover no cambia el link del archivo).
 *  - BORRAR: envía a la papelera las carpetas repetidas (se pueden restaurar 30 días).
 *  - Seguro: antes de borrar una carpeta revisa las columnas H e I de "Hoja 1"; si la
 *    carpeta contiene algún archivo enlazado en la hoja, NO la borra y lo avisa.
 */

const ID_HOJA = '1vzbtgF0vUZsIDL6n3c-mjjHnQQE55C41YQ7_XSm7kd4';
const NOMBRE_PESTANA = '01 REGISTRO Y DOCUMENTOS';

// carpeta que se conserva -> archivos enlazados en la hoja que hay que traer a ella
const MOVER = {
  // 900274738 ENERGIA REDES Y SERVICIOS ERS SAS (3 filas en la hoja)
  '1TyTQzGTbknwLtZCBUXe-UdTSC2vd_Kap': [
    '1nz7xIc0NzrY65bdURAINnNw5xOKUUlvT', '17cYUKJXdnwXv8uMSV1oTSCkpm4Zmzzi2',
    '1wlIEw2fbqJhcNd2ruEBZnlevH2bYxQX0', '1GJzwltuDa2NOVIjCr6E_pjwk1q04THdQ'],
  // 901058148 SUNEO ENERGY SAS (2 filas)
  '1rYOQdeM6tfCyf9gmaKj0Le3vMjlL2nEE': [
    '11YvMCfXJetftuTVowH9ebe9UHo_7QWR-', '1KjJfhzcJDU0HrnaLUUshGBc322ndaYfs'],
  // 891801918 SOELCO S.A.S (2 filas)
  '1WUND4WG6CMm1z_m1Z3gH8RzXFPlQB84D': [
    '1Iku8ATwjh1JsDWtrmUeSCXFYsReP_bHl', '1ZAsKy4dm89vUTJHpGXImhN2Zyu5FnIqX'],
  // 826001733 CREADSALUD BOYACA (2 filas)
  '1kn6uXKs-oeDz5MibG34chMinR6rWdeI_': [
    '1zTZ44It43oIyEPOnJudVEz-XvBRe8FSE', '1lPV-mYOkLLKzIhkvl8vN80f7UHsFisLA'],
  // 901869877 INGENIERIA CRISTIAN CUERVO SAS (2 filas)
  '1y8Ci5t1cJGcj2d3HtL3XsrRvHGsox6zL': [
    '1Lj5T7el8MpjmLY3qaF6edmSpcEiAQnpL', '1hw-moBFU1s8M0MaSMx9J9VlS68RwtQg5'],
  // 901096090 ANALISTA EN SEGURIDAD INDUSTRIAL E INGENIERIA SAS (2 filas)
  '1vOvs0dTmp52uxDDeBSEBIwlgpqEWqA5R': [
    '1KhycTdqhD057Bbt34-jp04o1SWeAbyXu', '13WrJpaXanLWMWhfBGJkltzpsIYmZfY1E'],
  // 900866471 FRANJA SOLUCIONES OCUPACIONALES S.A.S (2 filas)
  '1jHk6G7PYu0MNCPMcz3Bu2VswBV405gNe': [
    '1NTXouDpHvXPowbQgv_n7C6Xlx6iUEjN1', '1ACMg3I4aYjOwvhn3Vk5BzgiRpzcc3RTa'],
  // 15263491 Francisco Javier Hernández Cano (2 filas)
  '1DNMOU05yS3An4rSgXph5MfRpnEzbDlxX': [
    '16Vsk-v4RbDdQGo5ZVeMgIwT84ZLm0pdI', '1QY1wux7uG5PDVZadLXb06wIXAtOaszj9'],
};

// carpetas repetidas que van a la papelera (80)
const BORRAR = [
  '1C88wV8HN7TpncyuNLHf_Qi9rNISQvi1H', // PROMOGRAFS SAS
  '1X_VVwpZGoBLskCbOaa9BG79KwlOdt_7T', // AMERICANA DE TECNOLOGIA Y COMUNICACIONES
  '1AfewLFByv4vWgXdiSYszUq2febILxF45', // HOTEL LA ESPERANZA GUALIVA
  '1o_4a38i1vRa4P-KdgN2byOb1vI2mbSvD', // IMSEL S.A.S.
  '1tLVtE-2oEajpjfYvvLZYkYuUMa2LcMBH', // ERS (queda vacía tras mover)
  '1OzYn5HdzUf_OBeom0VkDl0YTbOkpi9cC', // ERS (queda vacía tras mover)
  '1xK1G9Oi-3wE8fldKdTGQp3Os-QIed9m2', // Promo pop sas
  '1E7qvCAnC3nOw3pBvD3GxrVEAzlbMPY10', // FPTIME SAS ZOMAC
  '1ChLZWalBz74ZSZMqsNr6XZxyUeDTR5-1', // DIGI PUNTO
  '1xRGJgMnEKhk-eSgIjXnFcAVugU3B3elw', // WJ RESCATE LTDA
  '1Mjax-uGgzQLA5Qyumraej1fHVZvmrm8l', // WJ RESCATE LTDA
  // Julia Rodriguez Duran (26 de 27; se conserva 1sQlR2bmmXSmUr8ZWUxZcgDNrmtLELmvu)
  '1F7hiV61eq9JRn4OhypNabsvZoHkaXdjj', '1RpmwLlFApHjQC_gR8UeFOQhzDBj5aA-9',
  '11SnQjhVbm2Zw79tnoKOmR0cL4MDcsI32', '1UUerZ2XDLF6LbrZtW75SzkNYaU_y_eDK',
  '1_WlmbG5j178tbVNQYqIJ6y7CXNOz4j2o', '1lKyl_hvtnnSeEvTkUk9kwYo39ZqyTm1g',
  '1j8ucliI2yUlLaht9NCTc675HMTWX8qEf', '1cyTMEQ0gAHwqxEO1FNqJep5vrkrmD84o',
  '109lv9Tb6VDhXKB82B-Rr-PR0B0mobKK5', '1Z0gziBxJfwg4mIJEUlAWNssvSnN6D6gE',
  '174_gT-jMUdTHMxB6Gxsoe0ikJYDLhNoP', '1IqWTMIQTrh1r508QpoN8qVvA8uF-6DCh',
  '1O_wj9KOEM7gOhM5mzG1-PN9cy2124CnH', '1B5zGrugV_3nadDmCL_RQv4IH4p0jMgFe',
  '1DNPMi0BaIuDd6vHc7uJ8U950HIXvlnmy', '1R_OnFYXNXVtC7fqWheNEUVNUV03eTpSd',
  '17bYzTDXxYdb0A3hcXD-_88q8ZnbkuHMX', '193daS4u_27Xq91yGpGJ3jUMcLcKC59VR',
  '1pFJx73DmzZEVUB4Eczxb8VWPGBNhaD0i', '15ZZA7ZvMRcI8ZVP39pgIdDBPCuK6x96o',
  '1YnSvrUDbsQ2emNlcaSzf14IAecEZItk_', '1HSwIxuRGMhtUkQwvkbFJjlGxEo9PPHJ-',
  '1TwdvazDAZDSnGQMcv5LeeJeSCADyvCkH', '1NmOtm6TFk_d78Z9ccZe9rew1fFZ28iBE',
  '1FEmQ-pHIGk_f7b291_bf3LyNx3E4aHUW', '1AQeNwysg2RVYEjB3CMRyonVwicCxEGUY',
  '15-m6p86I_XF9dV7Q_jM5nhmq9jkQ-MXj', // Francisco Javier (queda vacía tras mover)
  '1JegNDAOT80L9H4DnQPw3j2_N7N7ZHsCq', // Francisco Javier Hernández Cano
  '1BS3d0XGqKRt7dGa3E7rb_O9WAAXOACEs', // carmen paola azocar
  '1JeB74UVpAEYV2OQjEmbVcbWT6t5vElDO', // carmen paola azocar
  '18WYV3LB-4Rq_5hDSiam50bYChJ0SEhbN', // latinos comercializadora sas
  '1LtZhVjJwJCDjz-HETfr0ZTfHwcklaL9Y', // latinos comercializadora sas ("900937-0")
  '1z3FCGVHiBu5bR2Uu1_8NpE2txsECZ4R_', // ANALISTA EN SEGURIDAD (queda vacía tras mover)
  '1k4K2LsCZlNoZ8g66gpm_bt1CiArhub8A', // FRANJA SOLUCIONES (queda vacía tras mover)
  '1pypNI9Eei77xiS7lKYcjwL1k8RP4FWRL', // GREEN POWER TECHNOLOGY S.A.S
  '1ac75B3m7IFSNbC8SQpkZWDLnXG-Zoq3I', // Jennifer Vanessa Buitrago Niño
  '1tbg7yUUn_RsNHhs9xq3JhTbS6NWU-Cbn', // Titan alquileres sas
  '1UYJDlOmI7nPmQYOb1-7aZcFYvuiyUWVk', // Gas Natural SPE
  '1eH3kB8RBxmPsfEkPcMnu9ZGQh4rhU1Bd', // SONEPAR COLOMBIA SAS
  '1JaIVqTFzb3zcHYetoYULj9c2CAsWETrH', // Grupo Solaire Sas
  '187EYohIY3a9PpXMSfFDAMwUgaLAftr_o', // CREADSALUD (queda vacía tras mover)
  '1Mliq_TmQwhxlBJOU59s3gb0zFdsFTJUb', // CREADSALUD BOYACA SAS
  '1QfrxEXj_y5z6tXNz5OiDLTkKgQwS49S_', // CREADSALUD BOYACA SAS
  '169sSN6wPtcAy1T-dZA38gzj0at8zJC1c', // ERGONOMUS SAS
  '12ZQW-AT385T0crgQtQnhhwsOWVLMfS1U', // SUNEO (queda vacía tras mover)
  '1L082axKdWITs2MvyX1qSETI4j5lCIdeb', // SUNEO ENERGY SAS
  '1OOnuHJXOYLPIUk7mZhlAvW4gUAHTz-tb', // SUNEO ENERGY SAS
  '1OunkDZ0A8e0ZeB7WLk-pXu8Ea9DGOqb-', // SUNEO ENERGY SAS
  '1U7dslmmznXtx77q4Trw7V2Er3ncRye5T', // SOELCO (queda vacía tras mover)
  '1HJbWVcNHzeQVRuTlRV3rLc9b9jO1HPKt', // SOELCO S.A.S
  '1WEY8gv9N2j9cm89rzwPo4hqqqlD-7sjr', // LATINOAMÉRICA HOSTING S.A.S.
  '16hAHTIBo2uLAUcTTaOlG3M-o0wJieQAN', // ANDREA YALILE PEREZ SANDOVAL
  '1ctpv71lgqvs2C8c4kJwv_iQ_hTRdVP1h', // MAURICIO JIMENEZ JIMENEZ
  '1zPuEfo0PSD8u5ZpVprjf3-7HxbAkmvtw', // CRISTIAN CUERVO (queda vacía tras mover)
  '1LEvDBMh_EHaYDgtmm1qrgYrezdJQ8jgr', // Yeferson Yesid Mendigaño Mesa
  '1ggPVWVIEHjC9c0r7t0Etvxkzj4uRiDDE', // Yeferson Yesid Mendigaño Mesa
  '14i9Spm62jD9rzmiSl4If1dL91tSfaG_-', // Yeferson Yesid Mendigaño Mesa
  '1TSxk0b8tkN6rOYVJP7ctqQsqqGlo-7IQ', // Yeferson Yesid Mendigaño Mesa
  '1gsYA0CYff9yWtkmvFBAlDN4CAEgRwG_j', // Jhon Jairo Vega Ramírez
  '1Vo1WSNGBP2n1cvB7nLfTrc62_ZpaJxrp', // ACOVIS INGENIERIA DE COLOMBIA SAS
  '1bJ67KKk43kQmBp-fGnyNPniNHZG5je7H', // Consultorio Dr Fabián Paez
  '1jyCieuE_aWNQZHqSXarxTYXHKPfRS8jS', // OSAKA ELECTRONICS SAS
  '1W7Tkoy9dIl3cLDmQAafYUi9xISsbmDj-', // FERRELECTRICOS AGUAZUL SAS
  '1LU7eFMivEj0cd-28ub-Wl45HrIkiMwwT', // DLK S.A.S
  '1l1vY3dnY_uwo5m9fOXqu3MFrH6kIi7oM', // GONZALO CIFUENTES ("6744391-1")
  '1L3_Dzm3PEAHkf37z3ITxX3PlpkIiTbBv', // Diseños UAO
  '1FXZMBHMUAAMhykzBVBlAci_wCwmWGBlN', // Augusto Eliecer Acuña Reyes
  '1geutg4wAUopvluNZs1di8nzjhBoBx3GG', // ALAMCEN Y FERRETERIA R.A
  '1rSUB1YVelG-EQNjTDmp3lRC_r6oY_1Gh', // FACCEL ("900891195-4")
];

function revisarSinCambios() { ejecutar_(false); }
function limpiarDuplicados() { ejecutar_(true); }

function ejecutar_(aplicar) {
  const enlazados = idsEnlazadosEnLaHoja_();
  Logger.log('Archivos enlazados en la hoja: ' + enlazados.size);

  Object.keys(MOVER).forEach(function (destinoId) {
    const destino = DriveApp.getFolderById(destinoId);
    MOVER[destinoId].forEach(function (archivoId) {
      const archivo = DriveApp.getFileById(archivoId);
      Logger.log((aplicar ? 'MOVIDO ' : 'Se movería ') + archivo.getName() + ' -> ' + destino.getName());
      if (aplicar) archivo.moveTo(destino);
    });
  });

  let borradas = 0, omitidas = 0;
  BORRAR.forEach(function (carpetaId) {
    const carpeta = DriveApp.getFolderById(carpetaId);
    const archivos = carpeta.getFiles();
    let tieneEnlazado = false;
    while (archivos.hasNext()) {
      if (enlazados.has(archivos.next().getId())) { tieneEnlazado = true; break; }
    }
    if (tieneEnlazado && (aplicar || !quedaVaciaTrasMover_(carpetaId))) {
      omitidas++;
      Logger.log('OMITIDA (tiene un archivo enlazado en la hoja): ' + carpeta.getName() + ' ' + carpeta.getUrl());
      return;
    }
    borradas++;
    Logger.log((aplicar ? 'A LA PAPELERA ' : 'Se borraría ') + carpeta.getName());
    if (aplicar) carpeta.setTrashed(true);
  });
  Logger.log('Carpetas ' + (aplicar ? 'borradas: ' : 'por borrar: ') + borradas + ' | omitidas: ' + omitidas);
}

// En la revisión sin cambios los archivos aún no se han movido; estas carpetas quedan vacías al mover.
function quedaVaciaTrasMover_(carpetaId) {
  const porMover = [].concat.apply([], Object.keys(MOVER).map(function (k) { return MOVER[k]; }));
  const archivos = DriveApp.getFolderById(carpetaId).getFiles();
  while (archivos.hasNext()) {
    if (porMover.indexOf(archivos.next().getId()) === -1) return false;
  }
  return true;
}

function idsEnlazadosEnLaHoja_() {
  const hoja = SpreadsheetApp.openById(ID_HOJA).getSheetByName(NOMBRE_PESTANA);
  const rango = hoja.getRange(2, 8, hoja.getLastRow() - 1, 2); // columnas H e I
  const ids = new Set();
  const patron = /\/d\/([A-Za-z0-9_-]{20,})/;
  const agregar = function (texto) {
    const m = patron.exec(String(texto || ''));
    if (m) ids.add(m[1]);
  };
  rango.getValues().forEach(function (fila) { fila.forEach(agregar); });
  rango.getFormulas().forEach(function (fila) { fila.forEach(agregar); });
  rango.getRichTextValues().forEach(function (fila) {
    fila.forEach(function (celda) { if (celda) agregar(celda.getLinkUrl()); });
  });
  return ids;
}