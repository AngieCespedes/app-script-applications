/** Menú de la copia: instalación y usuarios. */
function onOpen() {
  Instalacion_.menu();
  SpreadsheetApp.getUi().createMenu('Usuarios toma física')
    .addItem('Ver usuarios y asignar PIN (dueña)', 'menuVerUsuarios')
    .addItem('Cifrar PIN nuevos (dueña)', 'menuCifrarPins')
    .addToUi();
}
