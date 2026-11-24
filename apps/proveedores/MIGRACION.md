# Informe de migración — proveedores

Generado por `scripts/migrar-legado.js` desde `/tmp/inv/proveedores`.

## Rutas que la página puede llamar (revisar que cada una valide sesión o sea pública a propósito)
- [ ] `consultarNit` → `consultarNit_`
- [ ] `ocBuscarProveedor` → `ocBuscarProveedor_`
- [ ] `ocCambiarMiContrasena` → `ocCambiarMiContrasena_`
- [ ] `ocCausar` → `ocCausar_`
- [ ] `ocCrearCentro` → `ocCrearCentro_`
- [ ] `ocCrearOrden` → `ocCrearOrden_`
- [ ] `ocDecidir` → `ocDecidir_`
- [ ] `ocEntrar` → `ocEntrar_`
- [ ] `ocGuardarUsuario` → `ocGuardarUsuario_`
- [ ] `ocListas` → `ocListas_`
- [ ] `ocMensajeProveedor` → `ocMensajeProveedor_`
- [ ] `ocOrdenes` → `ocOrdenes_`
- [ ] `ocRegistrarFactura` → `ocRegistrarFactura_`
- [ ] `ocRegistrarPago` → `ocRegistrarPago_`
- [ ] `ocRetenciones` → `ocRetenciones_`
- [ ] `ocUsuarios` → `ocUsuarios_`
- [ ] `registrarProveedorCompleto` → `registrarProveedorCompleto_`

## Funciones globales que quedan (con guarda)
- `activarAutomatico` — menú
- `alEnviarFormulario` — activador
- `desactivarAutomatico` — menú
- `doGet`
- `menuAutorizar` — menú
- `menuClavesCertificados` — menú
- `menuDiagnostico` — menú
- `menuLimpiarDuplicados` — menú
- `menuPruebaAlerta` — menú
- `menuRevalidarTodo` — menú
- `menuRevisarSinCambios` — menú
- `menuSincronizarRegimenes` — menú
- `menuValidarPendientes` — menú
- `menuValidarSeleccion` — menú
- `menuVerClavesPendientes` — menú
- `ocMostrarLink` — menú
- `onOpen`
- `validarPendientesAutomatico` — activador
- `verificarCuentasEnProveedores` — menú

## Funciones que dejaron de ser públicas
`autorizar`, `ejecutarPruebaDeAlerta`, `enviarAlertaCorreo`, `guardarArchivoEnDrive`, `limpiarDuplicados`, `ocContexto`, `ocDoGet`, `ocReemplazarCotizacion`, `procesarProveedor`, `revisarSinCambios`

## IDs movidos a configuración
- `SSV_RAIZ` → tipo `carpeta`
- `OC_SS` → tipo `libro`
- `OC_RAIZ` → tipo `[object Object]`

## Para revisar a mano
—
