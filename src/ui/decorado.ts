// Fondos armados con los sprites del motor de moldes (categoría «decorados»):
// suelo de losetas isométricas pintado una sola vez en una RenderTexture, cordillera de nevados con su reflejo,
// nubes de bloques y utilería. Así fondos y personajes comparten el mismo estilo 2.5D.
import Phaser from 'phaser';
import { W } from '../config';
import { Actor, info } from '../core/sprites';

type Destino = Phaser.GameObjects.Container | undefined;
const poner = <T extends Phaser.GameObjects.GameObject>(c: Destino, o: T): T => { if (c) c.add(o); return o; };

/** Hojas que usan los fondos (para cargarlas en preload). */
export const DECORADOS = ['suelo_sal', 'suelo_hielo', 'suelo_marte', 'suelo_hangar', 'nevado', 'nevado_chico', 'nube_bloques', 'penitentes', 'rocas_marte', 'grua_puente', 'estanteria', 'cactus_gigante'];

/**
 * Suelo de losetas (rombo de 90 × 45 px a escala 1) que cubre un rectángulo. Se pinta una vez: cuesta lo mismo que una imagen.
 * `tinte` oscurece o colorea todo el suelo (noche, tormenta…).
 */
export function piso(s: Phaser.Scene, id: string, x: number, y: number, w: number, h: number, c?: Destino, escala = 1, tinte = 0xffffff): Phaser.GameObjects.RenderTexture {
  const i = info(id), tw = 90 * escala, th = 45 * escala;
  const rt = s.add.renderTexture(x, y, w, h).setOrigin(0, 0);
  const img = s.make.image({ key: id, frame: 1, add: false }).setScale(escala).setOrigin(0.5, i.ancla[1] / i.N).setTint(tinte);
  rt.beginDraw();
  for (let fila = -1; fila * th / 2 < h + th; fila++) {
    const off = (fila % 2 ? tw / 2 : 0);
    for (let col = -1; col * tw < w + tw; col++) rt.batchDraw(img, col * tw + off, fila * th / 2);
  }
  rt.endDraw();
  img.destroy();
  return poner(c, rt);
}

export interface OpcCordillera { tinte?: number; escala?: number; reflejo?: number; semilla?: number }

/**
 * Cordillera en dos filas: cerros chicos atrás (más azulados por la distancia) y nevados grandes adelante,
 * apoyados sobre el horizonte. Con `reflejo` > 0 devuelve sus reflejos (espejados respecto del horizonte)
 * para ponerlos encima del suelo de sal.
 */
export function cordillera(s: Phaser.Scene, horizonte: number, c?: Destino, o: OpcCordillera = {}): Actor[] {
  const e = o.escala ?? 1.6, tinte = o.tinte ?? 0xffffff;
  let semilla = o.semilla ?? 7;
  const r = () => ((semilla = (Math.imul(semilla, 1664525) + 1013904223) | 0) >>> 0) / 4294967296;
  const mezcla = (a: number, b: number, t: number) => Phaser.Display.Color.GetColor(
    ((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t, ((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t, (a & 255) * (1 - t) + (b & 255) * t);
  const filas = [
    { id: 'nevado_chico', paso: 80, k: 0.95, dy: -2, tono: mezcla(tinte, 0x9fb4dc, 0.45) },
    { id: 'nevado', paso: 150, k: 1.15, dy: 6, tono: tinte },
  ];
  const reflejos: Actor[] = [];
  for (const f of filas) {
    for (let x = -60 + r() * 60; x < W + 120; x += f.paso + r() * f.paso * 0.6) {
      const k = e * f.k * (0.8 + r() * 0.45), y = horizonte + f.dy;
      const m = poner(c, new Actor(s, x, y, f.id, { escala: k, dir: 1, animado: false }));
      m.base.setTint(f.tono);
      if (o.reflejo) {
        const rf = new Actor(s, x, 2 * horizonte - y, f.id, { escala: k, dir: 1, animado: false });
        rf.setScale(k, -k).setAlpha(o.reflejo);
        rf.base.setTint(mezcla(f.tono, 0x9fc0ff, 0.4));
        rf.luz?.setVisible(false);
        reflejos.push(rf);
      }
    }
  }
  return reflejos;
}

/** Nubes de bloques que cruzan despacio. */
export function nubes(s: Phaser.Scene, c: Destino, n: number, yMin: number, yMax: number, escala = 1.4, alfa = 0.95): Actor[] {
  const out: Actor[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * (W / n) + (i % 2 ? 40 : -30), y = yMin + ((i * 53) % Math.max(1, yMax - yMin));
    const nb = poner(c, new Actor(s, x, y, 'nube_bloques', { escala: escala * (0.7 + (i % 3) * 0.2), dir: 1 }).setAlpha(alfa));
    s.tweens.add({ targets: nb, x: x + 60 + i * 8, duration: 16000 + i * 2500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    out.push(nb);
  }
  return out;
}

/** Utilería repartida (rocas, pináculos, cactus…) a lo largo de una franja. */
export function utileria(s: Phaser.Scene, id: string, c: Destino, puntos: [number, number, number][], dir = 1, tinte = 0xffffff): Actor[] {
  return puntos.map(([x, y, e], k) => {
    const a = poner(c, new Actor(s, x, y, id, { escala: e, dir: (dir + k * 3) % 8 }));
    a.base.setTint(tinte);
    return a;
  });
}
