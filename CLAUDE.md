# Reglas del repositorio — apps de Google Apps Script

Este repo guarda las apps de Apps Script de Angie Céspedes (Social Solar, Fertiagro y otras).
Cualquier persona o agente que cree o cambie una app sigue estas reglas. `npm run check` hace cumplir las que se pueden verificar solas.

## Estructura

```
apps/<app>/
  .clasp.json            scriptId del proyecto y rootDir "src"
  src/appsscript.json    manifiesto: zona America/Bogota, V8, scopes explícitos, webapp
  src/server/*.js        un módulo por archivo (por dominio: relacion, registro, cierre…)
  src/client/index.html  plantilla que arma la página con <?!= Vista.incluir('client/…') ?>
  src/client/vistas/*    una pantalla por archivo
  test/*.test.js         pruebas con node:test (lógica pura)
legacy/                  código viejo solo de referencia: no se publica desde aquí
scripts/                 publicar.sh y verificaciones
```

## Código

1. **Un módulo = un objeto global** creado con una función que se ejecuta de inmediato: `var Relacion = (function () { … return { api pública }; })();`. Lo privado queda adentro.
2. **Nada se ejecuta al cargar un archivo.** Un módulo solo usa otros módulos dentro de sus funciones; Apps Script no garantiza el orden de carga.
3. **Funciones globales: solo las que Google, el menú o un activador llaman por nombre** (`doGet`, `api`, `onOpen`, `menu…`, `tarea…`). Están en la lista blanca de `scripts/verificar-globales.js`. Cualquier otra función global se puede llamar desde el navegador con `google.script.run` saltándose el login. Las auxiliares globales terminan en `_`.
4. **La app web tiene una sola puerta: `api(token, accion, args)`.** Cada acción declara su rol en la tabla de rutas. La identidad (quién registra, su rol) sale de la sesión, nunca de lo que mande la página.
5. **Las funciones del menú y de los activadores empiezan con una guarda** (`Seguridad.exigirPersonaEnLaHoja`, `exigirDuena`, `exigirActivador`).
6. **Límites (los aplica ESLint):** 300 líneas por archivo, 60 por función, complejidad 12, 6 parámetros. Si algo no cabe, se parte.
7. **Sin IDs ni correos escritos en el código.** Van en `PropertiesService` (los pone el menú «Instalar») o en la hoja de parámetros.
8. **Correos con `Correo.enviar`.** En modo PRUEBA solo le llegan a la dueña.

## Datos (el libro de Google Sheets es la base de datos)

1. **Nunca se escribe por posición fija** (`getRange('L9')`, columna 12). Las celdas sueltas se leen por **rango con nombre** y las tablas **por encabezado** (`Libro.tabla`, `Libro.agregar`, `Filas.construir`).
2. **Las columnas con fórmula no se escriben.** `Filas.construir` las respeta y lanza error si se intenta escribir en una.
3. **El libro declara su versión de esquema** en `_meta` (rango `META_VERSION`) y el código la que espera en `Config.VERSION_ESQUEMA`. Si no coinciden, la app no lee ni escribe.
4. **Todo cambio de estructura** (columnas, hojas, rangos con nombre, fórmulas) va en `migraciones.js` como un paso idempotente y sube `VERSION_ESQUEMA`. Nunca se cambia la estructura a mano.
5. **Protecciones estrictas** (no solo aviso) en encabezados, fórmulas y `_meta`; las casillas de captura quedan libres. Agregar filas de datos siempre está permitido.
6. Registros nuevos al final de la tabla. Para anular, marcar; no borrar filas.

## Apps migradas (`.legado`)

- Las apps viejas se traen con `node scripts/migrar-legado.js <origen> apps/<app> <config.json>`. La herramienta: pasa todas las
  funciones a privadas (`_`), hace que la página llame `google.script.run.api('accion', …)` con la tabla `Rutas_`, deja globales solo
  `doGet`/`api`/menús/activadores (con guarda) y los declara en `apps/<app>/globales.json`, saca los IDs a `Config_.id`, manda los
  correos por `Correo_` y abre archivos por `Aislamiento_` (en PRUEBA solo dentro de la carpeta de la copia). El núcleo común está en
  `packages/nucleo-legado/`.
- Una app con archivo `.legado` tiene los límites de tamaño/complejidad como advertencia, no error. Al refactorizarla a módulos
  (reglas de «Código»), se borra `.legado`.
- **No volver a correr la herramienta sobre una app ya migrada:** sobrescribe los cambios hechos a mano (ver su `MIGRACION.md`).
- `tests/apps-legado.test.js` verifica que cada acción que pide la página exista en `Rutas_` y que ninguna página llame funciones
  del servidor por fuera de `api`.
- Al agregar una app, agregar su fila a la tabla del README.

## Publicar

- **Nunca se edita en el editor web de Apps Script.** El siguiente `push` lo borra.
- `scripts/publicar.sh <app> push` sube el código (HEAD). El menú, las barras laterales y los activadores de la hoja usan HEAD de inmediato.
- `scripts/publicar.sh <app> release "<nota>"` crea versión, actualiza el despliegue web (la URL no cambia) y etiqueta el commit.
- Antes de un release que cambie el esquema: versión con nombre del libro en Drive («antes de vX»), luego correr «Instalar o actualizar» desde el menú.
- No se usa el despliegue `@HEAD` como enlace para usuarios.
- Pruebas primero en una copia del libro con su propio script (modo PRUEBA).
