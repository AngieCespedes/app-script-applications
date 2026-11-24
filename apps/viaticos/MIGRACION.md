# Informe de migración — viaticos

Generado por `scripts/migrar-legado.js` desde `/tmp/inv/viaticos`.

## Rutas que la página puede llamar (revisar que cada una valide sesión o sea pública a propósito)
- [ ] `agregarProyectos` → `agregarProyectos_` (solo hoja)
- [ ] `appAgregarPresupuesto` → `appAgregarPresupuesto_`
- [ ] `appAmpliarSolicitud` → `appAmpliarSolicitud_`
- [ ] `appAnularEntrega` → `appAnularEntrega_`
- [ ] `appCrearProyecto` → `appCrearProyecto_`
- [ ] `appCrearSolicitud` → `appCrearSolicitud_`
- [ ] `appDatos` → `appDatos_`
- [ ] `appDecidir` → `appDecidir_`
- [ ] `appDetalle` → `appDetalle_`
- [ ] `appEntrar` → `appEntrar_`
- [ ] `appEnviarRevision` → `appEnviarRevision_`
- [ ] `appEstado` → `appEstado_`
- [ ] `appGuardarGasto` → `appGuardarGasto_`
- [ ] `appGuardarPresupuesto` → `appGuardarPresupuesto_`
- [ ] `appGuardarTecnicos` → `appGuardarTecnicos_`
- [ ] `appPedirCodigo` → `appPedirCodigo_`
- [ ] `appQuitarPresupuesto` → `appQuitarPresupuesto_`
- [ ] `appRegistrarEntrega` → `appRegistrarEntrega_`
- [ ] `appSalir` → `appSalir_`
- [ ] `appVerificarCodigo` → `appVerificarCodigo_`

## Funciones globales que quedan (con guarda)
- `actualizarControles` — activador
- `actualizarFormatosProyecto` — menú
- `alEditar` — activador
- `asignarClave` — menú
- `dialogoProyectos` — menú
- `doGet`
- `elegirCarpeta` — menú
- `eliminarSolicitud` — menú
- `guardarEnlaceApp` — menú
- `instalar` — menú
- `mostrarEnlaces` — menú
- `onOpen`
- `sincronizar` — menú

## Funciones que dejaron de ser públicas
`alEnviarGasto`, `alEnviarSolicitud`

## IDs movidos a configuración
- `CARPETA_DESTINO_ID` → tipo `carpeta`

## Para revisar a mano
—
