// Joystick táctil flotante (solo en pantallas táctiles): se apoya el pulgar en la mitad izquierda de la pantalla
// y aparece ahí mismo. No reemplaza al teclado ni al «tocar hacia donde ir»: se suma.
import Phaser from 'phaser';
import { W, H } from '../config';

/** true en celulares y tabletas (sin ratón). Una PC con pantalla táctil sigue usando teclado y ratón. */
export const esTactil = (): boolean => {
  try { return matchMedia('(hover: none) and (pointer: coarse)').matches; } catch { return false; }
};

export class Palanca {
  /** Dirección actual (-1..1). Cero si no se está usando o el pulgar está en la zona muerta. */
  vx = 0;
  vy = 0;
  /** Hay un dedo sobre la palanca (las escenas ignoran ese toque para «caminar hacia el dedo»). */
  activa = false;
  private id = -1;
  private base?: Phaser.GameObjects.Graphics;
  private perilla?: Phaser.GameObjects.Graphics;
  private bx = 0;
  private by = 0;

  constructor(scene: Phaser.Scene, private radio = 56, private color = 0x3ff3ff) {
    if (!esTactil()) return;
    const prof = 9500;
    this.base = scene.add.graphics().setScrollFactor(0).setDepth(prof);
    this.perilla = scene.add.graphics().setScrollFactor(0).setDepth(prof + 1);
    this.reposo();
    const inp = scene.input;
    const abajo = (p: Phaser.Input.Pointer, sobre: Phaser.GameObjects.GameObject[]) => {
      if (this.id >= 0 || sobre.length) return;              // no roba toques a botones
      if (p.x > W * 0.45 || p.y < H * 0.3) return;           // solo la parte izquierda-baja
      this.id = p.id; this.activa = true;
      this.bx = p.x; this.by = p.y;
      this.dibujar(0, 0, 1);
    };
    const mueve = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.id) return;
      let dx = p.x - this.bx, dy = p.y - this.by;
      const d = Math.hypot(dx, dy);
      if (d > this.radio) { dx = dx / d * this.radio; dy = dy / d * this.radio; }
      const n = Math.min(1, d / this.radio);
      if (n < 0.18) { this.vx = 0; this.vy = 0; }
      else { this.vx = dx / this.radio; this.vy = dy / this.radio; }
      this.dibujar(dx, dy, 1);
    };
    const arriba = (p: Phaser.Input.Pointer) => {
      if (p.id !== this.id) return;
      this.id = -1; this.activa = false; this.vx = 0; this.vy = 0;
      this.reposo();
    };
    inp.on('pointerdown', abajo);
    inp.on('pointermove', mueve);
    inp.on('pointerup', arriba);
    inp.on('pointerupoutside', arriba);
    scene.events.once('shutdown', () => {
      inp.off('pointerdown', abajo); inp.off('pointermove', mueve); inp.off('pointerup', arriba); inp.off('pointerupoutside', arriba);
    });
  }

  /** Cambia la profundidad (por si la escena tiene capas muy altas). */
  setDepth(d: number): this { this.base?.setDepth(d); this.perilla?.setDepth(d + 1); return this; }

  /** Sin tocar: una palanca tenue en la esquina, para que se sepa que existe. */
  private reposo(): void {
    this.bx = 26 + this.radio + 14; this.by = H - 150;   // más arriba que las barras de estado de abajo
    this.dibujar(0, 0, 0.45);
  }

  private dibujar(dx: number, dy: number, alfa: number): void {
    if (!this.base || !this.perilla) return;
    const r = this.radio;
    this.base.clear()
      .fillStyle(0x040914, 0.45 * alfa).fillCircle(this.bx, this.by, r + 10)
      .lineStyle(3, this.color, 0.55 * alfa).strokeCircle(this.bx, this.by, r + 10);
    for (let i = 0; i < 4; i++) {   // marcas de dirección
      const a = i * Math.PI / 2, x = this.bx + Math.cos(a) * (r - 4), y = this.by + Math.sin(a) * (r - 4);
      this.base.fillStyle(this.color, 0.5 * alfa).fillCircle(x, y, 3);
    }
    this.perilla.clear()
      .fillStyle(this.color, 0.35 * alfa).fillCircle(this.bx + dx, this.by + dy, r * 0.48)
      .lineStyle(3, this.color, 0.95 * alfa).strokeCircle(this.bx + dx, this.by + dy, r * 0.48);
  }
}
