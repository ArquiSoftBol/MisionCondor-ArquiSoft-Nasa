// Lenguaje de cine para las cinemáticas (Fase 2 del plan de mejora):
//   · color por acto (postFX ColorMatrix sobre la cámara)       · grano de película
//   · transiciones con telón: iris, barrido, destello blanco, fundido
//   · aurora procedural (cortinas de luz)                       · calidad Alta/Baja (celulares viejos)
import Phaser from 'phaser';
import { W, H } from '../config';
import { perfil } from '../core/estado';

export const calidadAlta = (): boolean => perfil.calidad !== 'baja';
const webgl = (s: Phaser.Scene) => s.game.renderer.type === Phaser.WEBGL;

// ───────── color por acto ─────────
export type Look = 'neutro' | 'frio' | 'calido' | 'oxido' | 'espacio' | 'europa' | 'climax' | 'dorado' | 'fuego';
const matrices = new WeakMap<Phaser.Cameras.Scene2D.Camera, Phaser.FX.ColorMatrix>();

/** Aplica un «look» de color a toda la cámara (solo WebGL y calidad Alta). */
export function colorear(s: Phaser.Scene, look: Look): void {
  const cam = s.cameras.main;
  if (!webgl(s) || !cam.postFX) return;
  let cm = matrices.get(cam);
  if (!cm) { cm = cam.postFX.addColorMatrix(); matrices.set(cam, cm); }
  cm.reset();
  if (!calidadAlta() || look === 'neutro') return;
  switch (look) {
    case 'frio': cm.saturate(-0.12, true); cm.hue(-8, true); break;                       // prólogo: mundo que se apaga
    case 'calido': cm.hue(9, true); cm.saturate(0.18, true); cm.brightness(1.04, true); break;   // hangar, la promesa
    case 'oxido': cm.hue(14, true); cm.saturate(0.3, true); cm.contrast(0.08, true); break;      // Marte
    case 'espacio': cm.hue(-14, true); cm.saturate(0.12, true); break;                    // viaje
    case 'europa': cm.hue(-18, true); cm.saturate(-0.08, true); cm.contrast(0.06, true); break;  // hielo cian
    case 'climax': cm.saturate(-0.42, true); cm.contrast(0.12, true); break;              // la decisión: casi sin color
    case 'fuego': cm.hue(18, true); cm.saturate(0.25, true); cm.contrast(0.1, true); break;      // reentrada
    case 'dorado': cm.hue(7, true); cm.saturate(0.28, true); cm.brightness(1.06, true); break;   // epílogo: el cielo vuelve
  }
}

/** Grano de película: ruido fino que se mueve (opcional, calidad Alta). */
export function grano(s: Phaser.Scene, prof: number, alfa = 0.07): Phaser.GameObjects.TileSprite | null {
  if (!calidadAlta()) return null;
  if (!s.textures.exists('cine-grano')) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d')!, img = x.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 90; }
    x.putImageData(img, 0, 0);
    s.textures.addCanvas('cine-grano', c);
  }
  const g = s.add.tileSprite(W / 2, H / 2, W, H, 'cine-grano').setDepth(prof).setAlpha(alfa).setBlendMode(Phaser.BlendModes.OVERLAY).setScrollFactor(0);
  s.events.on('update', () => { if (g.active) { g.tilePositionX = Math.random() * 128; g.tilePositionY = Math.random() * 128; } });
  return g;
}

// ───────── transiciones ─────────
export type Transicion = 'fundido' | 'iris' | 'barrido' | 'blanco';

/** Telón de transición: cubre la pantalla (cerrar) y la descubre (abrir) de distintas maneras. */
export class Telon {
  private negro: Phaser.GameObjects.Rectangle;
  private blanco: Phaser.GameObjects.Rectangle;
  private hueco: Phaser.GameObjects.Graphics;
  private mascara: Phaser.Display.Masks.GeometryMask;
  private radio = { v: 0 };
  private centro = { x: W / 2, y: H / 2 };

  constructor(private s: Phaser.Scene, prof = 900) {
    this.negro = s.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1).setDepth(prof).setScrollFactor(0).setVisible(false);
    this.blanco = s.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 1).setDepth(prof).setScrollFactor(0).setVisible(false);
    this.hueco = s.make.graphics({}, false);
    this.mascara = this.hueco.createGeometryMask();
    this.mascara.setInvertAlpha(true);
  }

  private tipo(t: Transicion): Transicion { return t === 'iris' && !webgl(this.s) ? 'fundido' : t; }

  private pintarHueco(): void { this.hueco.clear().fillStyle(0xffffff).fillCircle(this.centro.x, this.centro.y, Math.max(0, this.radio.v)); }

  /** Cubre la pantalla y luego llama a `listo`. */
  cerrar(t: Transicion, listo: () => void, centro?: { x: number; y: number }): void {
    const tipo = this.tipo(t), cam = this.s.cameras.main;
    if (centro) this.centro = { ...centro };
    if (tipo === 'fundido') { cam.fadeOut(350, 0, 0, 0); cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, listo); return; }
    if (tipo === 'blanco') {
      this.blanco.setVisible(true).setAlpha(0);
      this.s.tweens.add({ targets: this.blanco, alpha: 1, duration: 260, ease: 'Quad.in', onComplete: listo });
      return;
    }
    if (tipo === 'barrido') {
      this.negro.clearMask().setVisible(true).setAlpha(1).setX(-W / 2);
      this.s.tweens.add({ targets: this.negro, x: W / 2, duration: 420, ease: 'Cubic.in', onComplete: listo });
      return;
    }
    // iris: un círculo que se cierra sobre el centro de interés
    this.negro.setVisible(true).setAlpha(1).setX(W / 2).setMask(this.mascara);
    this.radio.v = 640; this.pintarHueco();
    this.s.tweens.add({ targets: this.radio, v: 0, duration: 650, ease: 'Cubic.in', onUpdate: () => this.pintarHueco(), onComplete: () => { this.negro.clearMask(); listo(); } });
  }

  /** Descubre la pantalla con la misma transición. */
  abrir(t: Transicion): void {
    const tipo = this.tipo(t), cam = this.s.cameras.main;
    if (tipo === 'fundido') { this.negro.setVisible(false); this.blanco.setVisible(false); cam.fadeIn(500); return; }
    if (tipo === 'blanco') {
      this.blanco.setVisible(true).setAlpha(1);
      this.s.tweens.add({ targets: this.blanco, alpha: 0, duration: 900, ease: 'Quad.out', onComplete: () => this.blanco.setVisible(false) });
      return;
    }
    if (tipo === 'barrido') {
      this.negro.clearMask().setVisible(true).setX(W / 2);
      this.s.tweens.add({ targets: this.negro, x: W * 1.5, duration: 480, ease: 'Cubic.out', onComplete: () => this.negro.setVisible(false) });
      return;
    }
    this.centro = { x: W / 2, y: H / 2 - 40 };
    this.negro.setVisible(true).setX(W / 2).setMask(this.mascara);
    this.radio.v = 0; this.pintarHueco();
    this.s.tweens.add({ targets: this.radio, v: 640, duration: 800, ease: 'Cubic.out', onUpdate: () => this.pintarHueco(), onComplete: () => { this.negro.clearMask().setVisible(false); } });
  }
}

// ───────── aurora procedural ─────────
/** Cortinas de luz que ondulan. `y0` = altura de la primera cortina. Devuelve el gráfico (añadirlo donde haga falta). */
export function aurora(s: Phaser.Scene, y0 = 70, ancho = W, intensidad = 1): Phaser.GameObjects.Graphics {
  const g = s.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const fase = { v: 0 };
  const paso = calidadAlta() ? 6 : 12;
  s.tweens.add({ targets: fase, v: Math.PI * 2, duration: 9000, repeat: -1, onUpdate: () => {
    if (!g.active) return;
    g.clear();
    [[0x3cff9c, y0, 0], [0x3ff3ff, y0 + 35, 1.7], [0xb07dff, y0 + 70, 3.1]].forEach(([col, yb, ph]) => {
      for (let x = 0; x < ancho; x += paso) {
        const y = yb + Math.sin(x * 0.009 + fase.v + ph) * 26 + Math.sin(x * 0.023 - fase.v * 2) * 8;
        const alto = 70 + Math.sin(x * 0.015 + fase.v * 1.5 + ph) * 30;
        g.fillStyle(col, 0.07 * intensidad).fillRect(x, y, paso, alto).fillStyle(col, 0.12 * intensidad).fillRect(x, y, paso, alto * 0.35);
      }
    });
  } });
  return g;
}

/** Rayos de luz que giran lentamente desde un punto (sol, ventana). */
export function rayos(s: Phaser.Scene, x: number, y: number, color = 0xfff2c0, largo = 420, n = 10, alfa = 0.1): Phaser.GameObjects.Graphics {
  const g = s.add.graphics({ x, y }).setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, b = a + 0.12;
    g.fillStyle(color, alfa).fillTriangle(0, 0, Math.cos(a) * largo, Math.sin(a) * largo, Math.cos(b) * largo, Math.sin(b) * largo);
  }
  s.tweens.add({ targets: g, angle: 360, duration: 60000, repeat: -1 });
  return g;
}
