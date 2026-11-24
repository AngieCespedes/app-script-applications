# Informe de migración — clientes

Generado por `scripts/migrar-legado.js` desde `/tmp/inv/clientes`.

## Rutas que la página puede llamar (revisar que cada una valide sesión o sea pública a propósito)
- [ ] `procesarCliente` → `procesarCliente_`

## Funciones globales que quedan (con guarda)
- `activarAutomatico` — menú
- `completarFilasExistentes` — menú
- `configurarCarpeta` — menú
- `desactivarAutomatico` — menú
- `diagnosticarFila` — menú
- `doGet`
- `onOpen`
- `procesarTodo` — menú — activador
- `releerFilaSeleccionada` — menú

## Funciones que dejaron de ser públicas
`enviarAlertaInterna`, `enviarConfirmacionCliente`, `guardarArchivoEnDrive`

## IDs movidos a configuración
- `CONFIG_SPREADSHEET_ID` → tipo `libro`
- `CONFIG_CARPETA_RAIZ_ID` → tipo `carpeta`

## Para revisar a mano
—
