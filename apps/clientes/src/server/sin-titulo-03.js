function completarPorEtiquetas_(r, texto, todas) {
  const esEtiqueta = l => /^\d{1,3}\.\s/.test(l) ||
    /^(IDENTIFICACI[ÓO]N|UBICACI[ÓO]N|CLASIFICACI[ÓO]N|Lugar de expedici|Actividad|Ocupaci|Responsabilidades|Usuarios aduaneros|Exportadores|Para uso exclusivo|Firma|IMPORTANTE|Sin perjuicio|Espacio reservado|Hoja \d|P[áa]gina)/i.test(l);
  const soloLetras = l => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ&.,'\- ]+$/.test(l) && !esEtiqueta(l) && esValorValido_(l);

  // Valor que sigue a una etiqueta (misma línea o líneas siguientes)
  const valorTras = (reEtiqueta, filtro) => {
    for (let i = 0; i < todas.length; i++) {
      const m = todas[i].match(reEtiqueta);
      if (!m) continue;
      const resto = todas[i].slice(m.index + m[0].length).replace(/\s\d{1,3}\.\s.*$/, '').trim();
      if (resto && (!filtro || filtro(resto))) return resto;
      for (let j = i + 1; j < Math.min(i + 4, todas.length); j++) {
        if (esEtiqueta(todas[j])) continue;
        if (!filtro || filtro(todas[j])) return todas[j];
      }
    }
    return '';
  };

  // NIT y DV: primera secuencia de dígitos en casillas, validada con el DV
  if (!r.nit || dvDian_(r.nit) !== r.dv) {
    for (const l of todas) {
      const m = l.match(/(?:^|\s)((?:\d ){6,}\d)(?=\s|$)/);
      if (!m) continue;
      const d = m[1].replace(/\s/g, '');
      if (dvDian_(d.slice(0, -1)) === d.slice(-1)) { r.nit = d.slice(0, -1); r.dv = d.slice(-1); }
      else { r.nit = d; r.dv = dvDian_(d); }
      break;
    }
  }

  // Correo: el primero que aparezca
  if (!r.correo) {
    const mc = texto.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    if (mc) r.correo = mc[0].toLowerCase();
  }

  // Teléfonos: secuencias de 10 dígitos en casillas (con o sin código postal delante)
  if (!r.telefono) {
    const tels = [];
    todas.forEach(l => {
      (l.match(/(?:\d ){6,}\d(?!\d)/g) || []).forEach(run => {
        let d = run.replace(/\s/g, '');
        if (d === r.nit + r.dv || d === r.nit) return;
        if (d.length % 10 === 6) d = d.slice(6);
        if (d.length % 10 !== 0) return;
        for (let k = 0; k < d.length; k += 10) {
          const t = d.slice(k, k + 10);
          if (/^(3|60)\d+$/.test(t)) tels.push(t);
        }
      });
    });
    r.telefono = tels[0] || '';
    r.telefono2 = tels[1] || '';
    r.celular = tels.find(t => /^3/.test(t)) || r.telefono;
  }

  // Departamento: "1 6 9 Boyacá" (se toma el último: el de UBICACIÓN)
  if (!r.departamento) {
    const deps = [];
    todas.forEach(l => {
      const m = l.match(/1\s6\s9\s+([A-Za-zÁÉÍÓÚÑáéíóúñ][^\d]*?)(?=\s+\d|\s*$)/);
      if (m) deps.push(m[1].trim());
    });
    if (deps.length) { r.departamento = deps[deps.length - 1]; r.pais = r.pais || 'COLOMBIA'; }
  }

  // Ciudad: "1 5 Toca" o "1 5 Toca 8 1 4" (la última es la de UBICACIÓN)
  if (!r.ciudad) {
    const ciudades = [];
    todas.forEach(l => {
      const m = l.match(/(?:^|\s)\d\s\d\s+([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ.,' ]*?)(?:\s+\d\s\d\s\d)?\s*$/);
      if (m && m[1].trim() !== r.departamento && esValorValido_(m[1])) ciudades.push(m[1].trim());
    });
    if (ciudades.length) r.ciudad = ciudades[ciudades.length - 1];
  }

  // Dirección
  if (!r.direccion) {
    r.direccion = valorTras(/41\.\s*Direcci[óo]n\s+principal/i,
      v => !/@/.test(v) && !/^(\d\s)+\d$/.test(v)).replace(/\s+/g, ' ').trim();
  }

  // Nombre
  if (!r.nombre) {
    if (r.tipo === 'NATURAL') {
      // Apellidos y nombres (31 a 34): líneas de solo letras después de "33. Primer nombre"
      const i = todas.findIndex(l => /33\.\s*Primer\s+nombre/i.test(l));
      const partes = [];
      if (i >= 0) {
        for (let j = i + 1; j < Math.min(i + 8, todas.length) && partes.length < 4; j++) {
          if (/34\.\s*Otros\s+nombres/i.test(todas[j])) continue;
          if (soloLetras(todas[j]) && esMayusculas_(todas[j])) partes.push(todas[j]);
          else if (partes.length) break;
        }
      }
      r.nombre = partes.join(' ').replace(/\s+/g, ' ').trim();

      // Último recurso: el primer bloque de líneas en MAYÚSCULAS que no sean
      // país, departamento, ciudad ni etiquetas (en el RUT los nombres van en mayúsculas)
      if (!r.nombre) {
        const excluir = new Set(['COLOMBIA', String(r.departamento).toUpperCase(), String(r.ciudad).toUpperCase()]);
        const bloque = [];
        for (const l of todas) {
          const ok = soloLetras(l) && esMayusculas_(l) && !excluir.has(l.toUpperCase());
          if (ok) { bloque.push(l); if (bloque.length === 4) break; }
          else if (bloque.length && !esEtiqueta(l)) break;
        }
        r.nombre = bloque.join(' ').replace(/\s+/g, ' ').trim();
      }
    } else {
      r.nombre = valorTras(/35\.\s*Raz[óo]n\s+social/i, soloLetrasONumeros_).replace(/\s+/g, ' ').trim();
    }
  }
  if (!r.nombreComercial) {
    const nc = valorTras(/36\.\s*Nombre\s+comercial(\s+37\.\s*Sigla)?/i, v => soloLetras(v));
    if (nc && nc !== r.nombre && !/^(UBICACI|COLOMBIA)/i.test(nc)) r.nombreComercial = nc;
  }
}

function soloLetrasONumeros_(v) {
  return /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(v) && !/^(UBICACI|COLOMBIA|36\.)/i.test(v) && esValorValido_(v);
}

function esMayusculas_(v) {
  return v === v.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(v);
}

/* ===================== CARPETAS Y ARCHIVOS ==================== */

function raiz_() {
  const id = PropertiesService.getScriptProperties().getProperty('CARPETA_RAIZ_ID') || CONFIG.CARPETA_RAIZ_ID;
  if (!id) throw new Error('Primero configura la carpeta en el menú RUTs → "⚙️ Configurar carpeta".');
  return Aislamiento_.carpeta(id);
}

function subcarpeta_(nombre) {
  const it = raiz_().getFoldersByName(nombre);
  return it.hasNext() ? it.next() : raiz_().createFolder(nombre);
}

function bandeja_() { return subcarpeta_(CONFIG.NOMBRE_BANDEJA); }

function obtenerCarpetaCliente_(nit, nombre) {
  const it = raiz_().searchFolders(`title contains '${nit}' and trashed = false`);
  while (it.hasNext()) {
    const c = it.next();
    if (c.getName().indexOf(nit) === 0) return c; // ya existe
  }
  return raiz_().createFolder(`${nit} - ${limpiarNombreCarpeta_(nombre)}`);
}

function ubicarArchivo_(archivo, carpeta, nombre) {
  nombre = nombre.replace(/\s+/g, ' ');
  const p = archivo.getParents();
  while (p.hasNext()) {
    if (p.next().getId() === carpeta.getId()) { archivo.setName(nombre); return archivo; }
  }
  try { archivo.moveTo(carpeta); archivo.setName(nombre); return archivo; }
  catch (e) { return archivo.makeCopy(nombre, carpeta); } // si no eres dueño del archivo
}

/* =========================== UTILIDADES ======================= */

function getHoja_() {
  const hoja = Aislamiento_.abrirLibro(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.HOJA);
  if (!hoja) throw new Error('No existe la hoja "' + CONFIG.HOJA + '"');
  return hoja;
}

function asegurarEncabezados_(hoja) {
  const c = hoja.getRange(1, CONFIG.COL.CARPETA);
  if (!c.getValue()) c.setValue('CARPETA');
}

// Compara el NIT sin DV: sirve para "9008911954", "900891195-4" o "900891195"
function buscarFilaPorNit_(hoja, nit) {
  const ult = hoja.getLastRow();
  if (ult < 2) return -1;
  const vals = hoja.getRange(2, CONFIG.COL.NIT, ult - 1, 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) {
    const s = String(vals[i][0]).trim();
    const d = s.replace(/\D/g, '');
    const base = s.indexOf('-') >= 0 ? s.split('-')[0].replace(/\D/g, '') : d;
    if (base === nit || d === nit || d.slice(0, -1) === nit) return i + 2;
  }
  return -1;
}

function extraerIdDrive_(url) {
  const s = String(url || '');
  const m = s.match(/\/d\/([\w-]{20,})/) || s.match(/[?&]id=([\w-]{20,})/);
  if (!m) throw new Error('Link de Drive inválido');
  return m[1];
}

function limpiarNombreCarpeta_(n) {
  return String(n || '').replace(/[\/\\:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

function avisar_(msg) {
  try { Aislamiento_.abrirLibro(CONFIG.SPREADSHEET_ID).toast(msg, 'RUTs', 8); } catch (e) {}
  console.log(msg);
}

