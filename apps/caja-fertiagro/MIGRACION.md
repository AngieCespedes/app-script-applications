# Informe de migración — caja-fertiagro

Generado por `scripts/migrar-legado.js` desde `/tmp/inv/caja-fertiagro`.

## Rutas que la página puede llamar (revisar que cada una valide sesión o sea pública a propósito)
- [ ] `analitica` → `analitica_`
- [ ] `anularMovimiento` → `anularMovimiento_`
- [ ] `anularPagoBanco` → `anularPagoBanco_`
- [ ] `datosPago` → `datosPago_`
- [ ] `exportar` → `exportar_`
- [ ] `exportarArqueo` → `exportarArqueo_`
- [ ] `exportarBanco` → `exportarBanco_`
- [ ] `getDatos` → `getDatos_`
- [ ] `guardarUsuario` → `guardarUsuario_`
- [ ] `listarUsuarios` → `listarUsuarios_`
- [ ] `login` → `login_`
- [ ] `movimientos` → `movimientos_`
- [ ] `pagosBanco` → `pagosBanco_`
- [ ] `registrarCierre` → `registrarCierre_`
- [ ] `registrarMovimiento` → `registrarMovimiento_`
- [ ] `registrarPagoBanco` → `registrarPagoBanco_`
- [ ] `registrosPersona` → `registrosPersona_`
- [ ] `salir` → `salir_`

## Funciones globales que quedan (con guarda)
- `doGet`

## Funciones que dejaron de ser públicas
`actualizarTarifas2026`, `arreglarFechaBanco`, `instalar`, `instalarPagos`, `simularPago`

## IDs movidos a configuración
- `SS_ID` → tipo `libro`

## Para revisar a mano
—
