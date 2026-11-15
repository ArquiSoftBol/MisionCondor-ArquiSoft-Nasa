// Fondos procedurales: estrellas, nebulosa (como las fotos del espacio profundo del guion) y degradados.
import Phaser from 'phaser';
import { W, H } from '../config';

const rnd = (seed: number) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) | 0) >>> 0) / 4294967296;

/** Degradado vertical a pantalla completa. */
export function degradado(scene: Phaser.Scene, arriba: number, abajo: number, prof = -100): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(prof).setScrollFactor(0);
  g.fillGradientStyle(arriba, arriba, abajo, abajo, 1);
  g.fillRect(-200, -200, W + 400, H + 400);
  return g;
}

/** Campo de estrellas que titilan. */
export function estrellas(scene: Phaser.Scene, n = 220, seed = 7, alto = H, prof = -90): Phaser.GameObjects.Graphics {
  const r = rnd(seed), g = scene.add.graphics().setDepth(prof);
  const brillantes: Phaser.GameObjects.Arc[] = [];
  for (let i = 0; i < n; i++) {
    const x = r() * (W + 400) - 200, y = r() * (alto + 200) - 100, a = 0.25 + r() * 0.7, s = r() < 0.08 ? 2 : 1;
    g.fillStyle(r() < 0.15 ? 0xffe9c8 : 0xdbe8ff, a).fillRect(x | 0, y | 0, s, s);
    if (s === 2 && brillantes.length < 14) brillantes.push(scene.add.circle(x, y, 1.5, 0xffffff, 0.9).setDepth(prof + 1));
  }
  brillantes.forEach((b, i) => scene.tweens.add({ targets: b, alpha: 0.15, duration: 700 + i * 130, yoyo: true, repeat: -1 }));
  return g;
}

/** Textura de nebulosa (se genera una vez por paleta). */
export function nebulosa(scene: Phaser.Scene, paleta: 'carina' | 'azul' | 'rosa' = 'carina', seed = 3): Phaser.GameObjects.Image {
  const key = `nebulosa-${paleta}-${seed}`;
  if (!scene.textures.exists(key)) {
    const c = document.createElement('canvas'); c.width = 480; c.height = 270;
    const x = c.getContext('2d')!, r = rnd(seed);
    x.fillStyle = '#04030a'; x.fillRect(0, 0, 480, 270);
    const cols = {
      carina: ['#c8541f', '#e88a3a', '#7a2a1a', '#3a5a9a', '#f2c27a'],
      azul: ['#2a4aa8', '#5a8ae0', '#1a2a5a', '#c85a3a', '#a8c8f0'],
      rosa: ['#b83a8a', '#e87aa8', '#4a2a7a', '#e8a85a', '#f0d0e8'],
    }[paleta];
    x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) {
      const cx = r() * 480, cy = 60 + r() * 170 + Math.sin(i) * 30, rad = 20 + r() * 90;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, cols[i % cols.length] + '55'); g.addColorStop(1, '#00000000');
      x.fillStyle = g; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    x.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.7})`; x.fillRect(r() * 480 | 0, r() * 270 | 0, 1, 1); }
    scene.textures.addCanvas(key, c);
  }
  return scene.add.image(W / 2, H / 2, key).setDisplaySize(W + 80, H + 45).setDepth(-95);
}

/** Banda negra semitransparente para texto. */
export function banda(scene: Phaser.Scene, y: number, alto: number, alpha = 0.72): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(W / 2, y + alto / 2, W, alto, 0x000000, alpha).setScrollFactor(0).setDepth(50);
}
