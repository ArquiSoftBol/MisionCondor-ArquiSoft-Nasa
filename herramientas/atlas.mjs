// Reconstruye public/sprites/atlas.json leyendo cada hoja (.json estilo Aseprite) de public/sprites/hojas.
// El juego lo lee al arrancar para saber tamaño de celda, ancla, brillo y cielo de cada sprite.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sprites');

export function construirAtlas() {
  const hojas = path.join(RAIZ, 'hojas'), sprites = {};
  for (const cat of fs.readdirSync(hojas)) {
    const dir = path.join(hojas, cat);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), m = j.meta, c = m.condor || {};
      const id = f.slice(0, -5), N = j.frames[0].frame.w;
      sprites[id] = {
        // cuerpo: huella en el suelo en unidades del molde (semiejes x, z) y la escala del molde → px = pie × esc × escala del actor
        pie: c.pie ?? null, esc: c.escalaMolde ?? 1,
        cat, N, fps: c.fps ?? 6, bucle: c.bucle !== false, ancla: c.pivote ?? [N / 2, Math.round(N * 0.8)],
        img: `hojas/${cat}/${id}.png`,
        brillo: c.brillo ? `hojas/${cat}/${c.brillo}` : null,
        cielo: c.cielo ? `hojas/${cat}/${c.cielo}` : null,
      };
    }
  }
  const out = { generado: new Date().toISOString(), direcciones: 8, cuadros: 8, total: Object.keys(sprites).length, sprites };
  fs.writeFileSync(path.join(RAIZ, 'atlas.json'), JSON.stringify(out));
  return out.total;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`atlas.json: ${construirAtlas()} sprites`);
}
