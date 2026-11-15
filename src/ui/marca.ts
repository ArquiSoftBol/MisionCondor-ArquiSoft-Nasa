// Insignias de marca: NASA Space Apps Challenge y ARQUISOFT.
// El logo OFICIAL de Space Apps no se dibuja ni se imita: se carga desde public/marca/space-apps.png (PNG con fondo
// transparente, del kit de marca para participantes). Si el archivo no está, se muestra una insignia de texto.
import Phaser from 'phaser';
import { FUENTE, FUENTE_PIXEL } from '../config';

const CLAVE = 'marca-spaceapps';
let intentado = false;

/** Llamar en preload(): intenta cargar el logo oficial una sola vez por sesión. */
export function cargarMarca(scene: Phaser.Scene): void {
  if (intentado || scene.textures.exists(CLAVE)) return;
  intentado = true;
  scene.load.image(CLAVE, 'marca/space-apps.png');
}

export const hayLogoOficial = (scene: Phaser.Scene): boolean => scene.textures.exists(CLAVE);

/** Insignia «NASA Space Apps Challenge 2026» de `alto` px (logo oficial si está; si no, texto). */
export function insigniaSpaceApps(scene: Phaser.Scene, x: number, y: number, alto = 40, claro = true): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  if (hayLogoOficial(scene)) {
    const img = scene.add.image(0, 0, CLAVE).setOrigin(0.5);
    img.setScale(alto / img.height);
    c.add(img);
    c.setSize(img.displayWidth, alto);
    return c;
  }
  const col = claro ? '#ffffff' : '#0b1222';
  const t1 = scene.add.text(0, -alto * 0.18, 'NASA SPACE APPS', { fontFamily: FUENTE, fontSize: `${Math.round(alto * 0.36)}px`, fontStyle: '800', color: col }).setOrigin(0.5);
  const t2 = scene.add.text(0, alto * 0.24, 'CHALLENGE 2026', { fontFamily: FUENTE_PIXEL, fontSize: `${Math.max(7, Math.round(alto * 0.2))}px`, color: claro ? '#9fdcff' : '#1d4a86' }).setOrigin(0.5);
  const w = Math.max(t1.width, t2.width) + 22;
  const g = scene.add.graphics().lineStyle(2, claro ? 0x9fdcff : 0x1d4a86, 0.8).strokeRoundedRect(-w / 2, -alto / 2, w, alto, 8);
  c.add([g, t1, t2]);
  c.setSize(w, alto);
  return c;
}

/** Insignia de ARQUISOFT: hexágono abierto (como el logo de la presentación) + nombre. */
export function insigniaArquisoft(scene: Phaser.Scene, x: number, y: number, alto = 40, claro = true): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y), r = alto * 0.42, col = claro ? 0xffffff : 0x0b1222;
  const g = scene.add.graphics().lineStyle(2.5, col, 1);
  const pts = Array.from({ length: 7 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 3; return new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r); });
  for (let i = 0; i < 6; i++) if (i !== 4) g.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
  const t = scene.add.text(r + 8, 0, 'ARQUISOFT', { fontFamily: FUENTE, fontSize: `${Math.round(alto * 0.4)}px`, fontStyle: '700', color: claro ? '#ffffff' : '#0b1222' }).setOrigin(0, 0.5);
  g.setX(0);
  c.add([g, t]);
  const w = r * 2 + 8 + t.width;
  c.iterate((o: Phaser.GameObjects.Components.Transform) => { o.x -= w / 2 - r; });
  c.setSize(w, alto);
  return c;
}
