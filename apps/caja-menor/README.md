# Caja menor — Social Solar S.A.S. (v4)

Reescritura limpia de la caja menor v3 sobre una **copia** del libro, sin tocar lo que está en producción.

- Libro: «CAJA MENOR SOCIAL SOLAR V4», en Drive › 00 PLANTILLAS Y POLÍTICAS › Aplicacion
- Script vinculado: `1GbUi_1vUeg_GsE0F053sRj2y3RPV1ivhSlO1-FvF84bxJs8wgvvmhqlj`
- Modo inicial: **PRUEBA** (los correos solo le llegan a la dueña).

## Puesta en marcha (una vez, la dueña)

1. Abrir el libro V4 → menú **Caja menor › Instalar o actualizar (dueña)** → autorizar. Crea las carpetas «Soportes caja menor» y «99 RESPALDOS» junto al libro, guarda la configuración y migra el libro al esquema 1.
2. El despliegue web ya está creado (versión 1, 24/11/2026):
   https://script.google.com/macros/s/AKfycbwu0wPVIdzA7INS9mjC8G6O17ybURo_PW_QLz1V7T1DJKnXm5P_8Mzps7oaH98M6SEc/exec
   Los siguientes cambios se publican con `scripts/publicar.sh caja-menor release "<nota>"` (la URL no cambia).
3. Probar con los usuarios de siempre (vienen copiados de la v3; la app pedirá cambiar la clave).
4. Cuando esté validado: **Caja menor › Pasar a producción**.

## Qué corrige frente a la v3

| # | Problema en v3 | Cómo queda en v4 |
|---|---|---|
| 1 | Cualquier función global se podía llamar desde el navegador sin login (p. ej. `restablecerClave`, `limpiarPruebasDeLaRelacion`) | Solo `doGet` y `api` son públicas; todo lo demás vive en módulos. Verificado por `scripts/verificar-globales.js` |
| 2 | Al registrar un ingreso, la versión 7 escribía corrido dos columnas y borraba la fórmula de «¿Deducible?» | Escritura por encabezado; las columnas con fórmula no se pueden escribir |
| 3 | Al cerrar, los datos caían corridos en Movimientos (Revisión en «Recibió el efectivo», etc.) | Movimientos se llena por encabezado; hay prueba automática |
| 4 | Al cerrar se borraban las fórmulas de Revisión, Plazo DSE y Deducible | `Relacion.vaciar()` conserva las fórmulas |
| 5 | El arqueo comparaba el saldo de hoy con un conteo viejo («Sobra $482.500») | Solo vale un arqueo posterior al último movimiento; cada arqueo queda en la hoja «Arqueos» |
| 6 | El plazo del DSE corría para cualquier soporte, incluso facturas electrónicas | Solo cuando el soporte es DSE o el estado lo pide |
| 7 | «Ver soporte» contaba como número de soporte repetido | Se usa «S/N» y no cuenta como repetido |
| 8 | Terceros y Bancarización solo veían relaciones cerradas | El control de 100 UVT suma también la relación en curso |
| 9 | NIT con y sin dígito de verificación no cruzaban | NIT normalizado sin DV |
| 10 | Pantallas Accesos y Roles fallaban (no estaban en la lista permitida) | Rutas declaradas con su rol |
| 11 | Aprobar una relación siempre fallaba en la app web (dependía del correo de Google) | Usa el usuario de la sesión |
| 12 | «Debe cambiar la clave» no se exigía | La API solo deja cambiar la clave hasta que se cambie |
| 13 | `registrarLote` podía mover y renombrar cualquier archivo del Drive de la dueña | Solo acepta archivos de «00 POR CLASIFICAR» |
| 14 | Protecciones solo de aviso; 40 rangos fijos en el código | Protecciones estrictas; rangos con nombre y versión de esquema |
| 15 | Todos los usuarios quedaban como editores del libro | Contadora edita; Gerencia y Auxiliar solo leen |
| 16 | Login sin límite de intentos, claves de 6 caracteres | 5 intentos por 15 minutos, mínimo 8 caracteres |

Se retiraron la barra lateral (`Panel.html`) y el diálogo de cierre (`Cierre.html`) de la hoja: duplicaban la app web, corrían con el código HEAD y no se estaban usando. El menú de la hoja queda solo para abrir la app y tareas de la dueña.

## No corregido a propósito (decisión contable)

En la relación 202 hay movimientos con la cuenta que conviene revisar (p. ej. entregas a ingenieros con 110510 · Caja menor, papelería con 515520 · Pasajes terrestres). El código no cambia datos contables: eso lo decide la contadora.
