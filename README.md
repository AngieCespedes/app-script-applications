# Apps de Google Apps Script — Angie Céspedes

Código versionado de las apps web de Social Solar y Fertiagro. Las reglas de trabajo están en [CLAUDE.md](CLAUDE.md).
Este repo publica **solo las versiones mejoradas** (copias en carpetas `Aplicacion`). Los libros y scripts originales no se tocan.

## Apps mejoradas

| App | Empresa | Carpeta en Drive | Hoja de cálculo | Proyecto Apps Script | App web (v1) | Estado |
|---|---|---|---|---|---|---|
| [caja-menor](apps/caja-menor) | Social Solar | [Aplicacion](https://drive.google.com/drive/folders/1YXf7VWHK66uJ5tvOc085bY1nOeDLDSRa) | [CAJA MENOR SOCIAL SOLAR V4](https://docs.google.com/spreadsheets/d/1fIlkhzHRwZXhXwe3H0IvrEmsJ22nsAGJQ3hL7TFqZN4/edit) | [Editor](https://script.google.com/d/1GbUi_1vUeg_GsE0F053sRj2y3RPV1ivhSlO1-FvF84bxJs8wgvvmhqlj/edit) | [Abrir](https://script.google.com/macros/s/AKfycbwu0wPVIdzA7INS9mjC8G6O17ybURo_PW_QLz1V7T1DJKnXm5P_8Mzps7oaH98M6SEc/exec) | Reescrita (v4), modo PRUEBA |
| [toma-fisica-fertiagro](apps/toma-fisica-fertiagro) | Fertiagro | [Aplicacion](https://drive.google.com/drive/folders/107jbbYWcNb59UW8WUi1OPkIPoIPMZoIQ) | [MT-INV-02 Toma física (app mejorada)](https://docs.google.com/spreadsheets/d/1fIottYExxvS8D_Ak4YGRrlOnfhjz5aDTjJ4BlxnGuEs/edit) | [Editor](https://script.google.com/d/11sseipYrAxQfxj-BX41SOBskqwU3GMoxIOipEPzjPf-zDAmBB4f3kzfd/edit) | [Abrir](https://script.google.com/macros/s/AKfycbwifx3svqCTVvOtyK3-_TF34rf3M-pq6APYrFBuaLwvRs3F2SC0cZpKcmct4iBxdjDq/exec) | Migrada, modo PRUEBA |
| [caja-fertiagro](apps/caja-fertiagro) | Fertiagro | [Aplicacion](https://drive.google.com/drive/folders/1C5NIUg2WNFbFsLeBHNtiS9ZfKGWbs4l6) | [CAJA_FERTIAGRO_2026 (app mejorada)](https://docs.google.com/spreadsheets/d/1ealTi8fsFLdlhKV7XwSbOFk0hxq--luk7otyQOOwVCM/edit) | [Editor](https://script.google.com/d/1A4tQsMyziwJ43FjRVOvGIzRqQE-TgqUKxalA5kWJgko7zuZ__ZpB0uQb/edit) | [Abrir](https://script.google.com/macros/s/AKfycbyfUrxkWi6rTryNWjQ-v9bfSOl51KzHBiLtmbBYNeSPi37kkHJMb288oM6wZh_RdqnVbA/exec) | Migrada, modo PRUEBA |
| [proveedores](apps/proveedores) | Social Solar | [Aplicacion](https://drive.google.com/drive/folders/1XhBk-dR1WSGnjtIZyKI5WEeEfrvLpGH4) | [Proveedores (app mejorada)](https://docs.google.com/spreadsheets/d/1pVqRJ-DT11MAbZ1oulqxjMw82u2NjxxIL5FacgZ3do4/edit) | [Editor](https://script.google.com/d/190XJWHkPK7Ht7OHN5aHqkwocJS2kfwBad-E_hRFyVJyO0Q5TOHH0-UDg/edit) | [Abrir](https://script.google.com/macros/s/AKfycbydYSnZkWBo5C8yvCRsuhdxuoMSB6z8To-MuTGfhN07_87Oss7laA8Nl1rcymstshhyng/exec) | Migrada, modo PRUEBA |
| [clientes](apps/clientes) | Social Solar | [Aplicacion](https://drive.google.com/drive/folders/1KC1qfKDfxsswL5Ds5KGFzFGQPIRThwjq) | [Clientes (app mejorada)](https://docs.google.com/spreadsheets/d/18Tvg_m3NI0TuRKRl0tr2gLExk6AyH0F4ly-sWPExCbE/edit) | [Editor](https://script.google.com/d/1Il6Uzs_gqg7JO82WR-VV-Kmx5BB1dC5fvutHRQKd7cqioJ3nRM9tEwqJ/edit) | [Abrir](https://script.google.com/macros/s/AKfycbzmHKVF6R2JOW__9Hz8pY6raFb5sBED9681B6Au-oD-CmezUPQpzsE9e8Dwg16o9aw8/exec) | Migrada, modo PRUEBA |
| [viaticos](apps/viaticos) | Social Solar | [Aplicacion](https://drive.google.com/drive/folders/1D_XR8SmjikeVmRZKMMvfqP604vAbFcEh) | [Viáticos (app mejorada)](https://docs.google.com/spreadsheets/d/1ddB8oVIsYpbngpajt1IZZVJ_OH9ReMLDNO4DINDIDYU/edit) | [Editor](https://script.google.com/d/1oWwvbdUc4Kl-I_maxYxIPV5qnGGoAvByBoaapJakpHearb6tZyyludKV/edit) | [Abrir](https://script.google.com/macros/s/AKfycbz8X4QyzABj0kuLS9Nzi7Dsr0_EGVBKM-4L9yoc_PFrqY6oL4Lh7fVs7DJMgMlnV2fF8A/exec) | Migrada, modo PRUEBA |

**Reescrita** = cumple todas las reglas de CLAUDE.md. **Migrada** = se trajo con `scripts/migrar-legado.js`: ya cumple las reglas de
seguridad (una sola puerta `api`, guardas en menús y activadores, sin IDs ni claves en el código, correos y archivos aislados en
modo PRUEBA), pero sigue la estructura del código original; los límites de tamaño de función son advertencia hasta refactorizarla.
Cada app migrada tiene un `MIGRACION.md` con lo que cambió.

## Originales (no se publican desde aquí)

| App | Hoja original | Script original | Código en el repo |
|---|---|---|---|
| Caja menor V3 | «CAJA MENOR SOCIAL SOLAR V3» | [Script](https://script.google.com/d/1oSYMU4_MAVucqFUKvYwiu9ERwLGa6wpv_s4W5CDZZoJX4gZAG7b7S_5F/edit) | [legacy/caja-menor-v3](legacy/caja-menor-v3) |
| Toma física Fertiagro | [Hoja](https://docs.google.com/spreadsheets/d/1KgcC4L-vY6j15iq5xT2X9UShfFa8txkg0eRUVxPY26w/edit) | [Script](https://script.google.com/d/1a44Jqtyu7iybcMckBKqzyodG2Igi-KcXTlEgY9O68yxuCgjLAAFArv1b/edit) | [legacy/toma-fisica-fertiagro](legacy/toma-fisica-fertiagro) |
| Caja Fertiagro | [Hoja](https://docs.google.com/spreadsheets/d/1_fOW4YDhAeenvxc2UFP079SzipkkYlaHKP6IMdOe4Tg/edit) | [Script](https://script.google.com/d/1uS8tdDoFKQ5tG30GK3O4fdY4SdwxCbAX44fAPx4pigYM5d-JxF7wscuS/edit) | [legacy/caja-fertiagro](legacy/caja-fertiagro) |
| Proveedores | [Hoja](https://docs.google.com/spreadsheets/d/1vzbtgF0vUZsIDL6n3c-mjjHnQQE55C41YQ7_XSm7kd4/edit) | [Script](https://script.google.com/d/1crRJqD97VnNUyzywStVxhNGM_m4MovNeu05r9Cuj85tjZrNBXTmT8Im6/edit) | [legacy/proveedores](legacy/proveedores) |
| Clientes | [Hoja](https://docs.google.com/spreadsheets/d/1sKxg3d36GtVrN5PxQ9g1Io9WRswjgXT0DbTLoMeQ4NE/edit) | [Script](https://script.google.com/d/1psjP9ZKv9Xt31SzYyLkYzJuo7jzRPHN0S5F4vKRMfV1xdRpMtloAqpri/edit) | [legacy/clientes](legacy/clientes) |
| Viáticos | [Hoja](https://docs.google.com/spreadsheets/d/1S5figsFzxjeMLvOp3bqABwlHY9AqCO6w0_B1AwnUVEk/edit) | [Script](https://script.google.com/d/1bOW4AoJOeQA3JQk__mWx9y1f1xvWnDWLhdDEQiAr21ViPH67y2poZTAO/edit) | [legacy/viaticos](legacy/viaticos) |

## Poner en marcha una app migrada (una vez, la dueña)

(Caja menor v4 usa su propio menú «Caja menor › Instalar o actualizar»; ver su README.)

1. Abrir la hoja de la tabla → menú **Instalación › Instalar o actualizar (dueña)** → autorizar.
2. Volver a crear los activadores desde el menú de la app (no se copian con el libro).
3. Probar en modo PRUEBA: los correos solo le llegan a la dueña y la app solo abre archivos dentro de su carpeta `Aplicacion`.
4. Cuando esté lista: **Instalación › Pasar a producción (dueña)**.

## Comandos

```bash
npm ci
npm run check                                  # lint + verificación de globales + pruebas
scripts/publicar.sh <app> push                 # sube el código (HEAD)
scripts/publicar.sh <app> release "<nota>"     # versión + despliegue web (misma URL) + etiqueta git
node scripts/migrar-legado.js <origen> apps/<app> <config.json>   # traer otra app vieja al repo
```

Al agregar una app nueva, agregar su fila a la tabla de arriba.
