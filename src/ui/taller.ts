// Mecánicas inmersivas compartidas por las misiones: las piezas están EN el escenario (no en una bandeja),
// el protagonista camina, las toma y las entrega; el dron BIT-7 levanta piezas pesadas con su rayo tractor;
// una lista holográfica muestra las tareas y se va marcando.
import Phaser from 'phaser';
import { FUENTE, FUENTE_PIXEL } from '../config';
import { Actor, info } from '../core/sprites';
import { Sonido } from '../core/audio';
import { panel } from './boton';

/** Hojas que usan estas mecánicas (sumar en preload). */
export const HOJAS_TALLER = ['dron_bit7'];

// ─────────────── Pieza en el escenario: pedestal luminoso + etiqueta holográfica + flotación ───────────────
export class PiezaHolo {
  readonly actor: Actor;
  readonly x: number; readonly y: number; readonly escala: number;
  private ped: Phaser.GameObjects.Ellipse;
  private etiqueta: Phaser.GameObjects.Container;
  private flota?: Phaser.Tweens.Tween;
  activa = true;

  constructor(private s: Phaser.Scene, x: number, y: number, id: string, nombre: string, o: { escala?: number; color?: number; retardo?: number; dir?: number } = {}) {
    this.x = x; this.y = y; this.escala = o.escala ?? 1.5;
    const col = o.color ?? 0x3ff3ff;
    this.ped = s.add.ellipse(x, y + 2, 84, 24, col, 0.18).setStrokeStyle(2, col, 0.8).setDepth(y - 1);
    this.actor = new Actor(s, x, y, id, { escala: this.escala, dir: o.dir ?? 1 }).setDepth(y);
    // etiqueta: línea fina + chip con el nombre
    const alto = info(id).N * this.escala * 0.62;
    const t = s.add.text(0, 0, nombre, { fontFamily: FUENTE, fontSize: '12px', fontStyle: '800', color: '#e8f6ff' }).setOrigin(0.5);
    const g = s.add.graphics().fillStyle(0x040914, 0.85).fillRoundedRect(-t.width / 2 - 8, -11, t.width + 16, 22, 8).lineStyle(1.5, col, 0.9).strokeRoundedRect(-t.width / 2 - 8, -11, t.width + 16, 22, 8);
    const linea = s.add.graphics().lineStyle(1, col, 0.6).lineBetween(0, 11, 0, 26);
    this.etiqueta = s.add.container(x, y - alto - 26, [linea, g, t]).setDepth(900);
    // entrada y vida
    const r = o.retardo ?? 0;
    [this.actor, this.etiqueta].forEach(obj => { obj.setAlpha(0); s.tweens.add({ targets: obj, alpha: 1, duration: 400, delay: r }); });
    this.actor.setScale(0); s.tweens.add({ targets: this.actor, scale: this.escala, duration: 450, delay: r, ease: 'Back.out' });
    this.flota = s.tweens.add({ targets: this.actor, y: y - 5, duration: 1200 + (x % 300), yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: r + 500 });
    s.tweens.add({ targets: this.ped, scaleX: 1.12, scaleY: 1.12, alpha: 0.6, duration: 900, yoyo: true, repeat: -1 });
    this.actor.setSize(70, 90).setInteractive({ useHandCursor: true });
    this.actor.on('pointerover', () => { if (this.activa) { Sonido.tecla(); this.etiqueta.setScale(1.12); this.ped.setStrokeStyle(3, 0xffe14d, 1); this.actor.base.setTint(0xffffcc); } });
    this.actor.on('pointerout', () => { this.etiqueta.setScale(1); this.ped.setStrokeStyle(2, col, 0.8); this.actor.base.clearTint(); });
  }

  alTocar(fn: () => void): this { this.actor.on('pointerdown', () => { if (this.activa) fn(); }); return this; }

  /** La pieza deja su pedestal (la llevan). */
  levantar(): void {
    this.activa = false;
    this.flota?.stop();
    this.actor.disableInteractive();
    this.s.tweens.add({ targets: this.etiqueta, alpha: 0, duration: 200 });
    this.ped.setFillStyle(0x33405a, 0.2).setStrokeStyle(2, 0x33405a, 0.6);
  }

  /** Vuelve a su pedestal (pieza rechazada). */
  devolver(): Promise<void> {
    return new Promise(res => this.s.tweens.add({
      targets: this.actor, x: this.x, y: this.y, scale: this.escala, angle: 0, duration: 420, ease: 'Back.out',
      onComplete: () => {
        this.actor.setDepth(this.y).setInteractive({ useHandCursor: true });
        this.etiqueta.setVisible(true).setAlpha(1); this.ped.setVisible(true).setFillStyle(0x3ff3ff, 0.18).setStrokeStyle(2, 0x3ff3ff, 0.8);
        this.activa = true; res();
      },
    }));
  }

  /** Ya usada: el pedestal se apaga. */
  usada(): void { this.etiqueta.setVisible(false); this.ped.setVisible(false); }
}

// ─────────────── Operario: el protagonista que camina, toma y entrega ───────────────
export class Operario {
  readonly actor: Actor;
  private carga?: Actor;
  ocupado = false;
  private vel = 210;

  constructor(private s: Phaser.Scene, x: number, y: number, id: string, private escala = 2.6) {
    this.actor = new Actor(s, x, y, id, { escala, dir: 1 }).setDepth(y).pausar();
    s.events.on('update', this.seguir, this);
    s.events.once('shutdown', () => s.events.off('update', this.seguir, this));
  }

  private seguir(): void {
    this.actor.setDepth(this.actor.y);
    if (this.carga) this.carga.setPosition(this.actor.x, this.actor.y - 62 * (this.escala / 2.6) + Math.sin(this.s.time.now / 120) * 1.5).setDepth(this.actor.y + 1);
  }

  /** Camina hasta (x, y) mirando hacia donde va. */
  caminarA(x: number, y: number): Promise<void> {
    const dx = x - this.actor.x, dy = y - this.actor.y, d = Math.hypot(dx, dy);
    if (d < 4) return Promise.resolve();
    this.actor.mirarHacia(dx, dy).seguir();
    return new Promise(res => this.s.tweens.add({
      targets: this.actor, x, y, duration: (d / this.vel) * 1000, ease: 'Linear',
      onUpdate: () => { if (Math.random() < 0.08) Sonido.tecla(); },
      onComplete: () => { this.actor.pausar(); res(); },
    }));
  }

  /** Toma un objeto: sube por encima de la cabeza y lo lleva. */
  tomar(obj: Actor): Promise<void> {
    Sonido.click();
    return new Promise(res => this.s.tweens.add({
      targets: obj, x: this.actor.x, y: this.actor.y - 62 * (this.escala / 2.6), scale: obj.scale * 0.8, duration: 260, ease: 'Back.out',
      onComplete: () => { this.carga = obj; res(); },
    }));
  }

  /** Suelta lo que lleva y lo devuelve. */
  soltar(): Actor | undefined { const c = this.carga; this.carga = undefined; return c; }

  /** Gesto de «no»: mueve la cabeza (gira a los lados). */
  negar(): Promise<void> {
    const d = this.actor.dir;
    return new Promise(res => {
      [1, -1, 1, 0].forEach((k, i) => this.s.time.delayedCall(i * 140, () => this.actor.mirar(d + k)));
      this.s.time.delayedCall(600, res);
    });
  }

  mirar(dir: number): void { this.actor.mirar(dir).pausar(); }
}

/** Altura visible de un actor por encima de su ancla (los pies), ya escalada. */
const altoSobreAncla = (a: Actor) => a.base.height * a.base.originY * Math.abs(a.scaleY) * 0.8;

// ─────────────── Dron BIT-7 con rayo tractor ───────────────
export class Dron {
  readonly actor: Actor;
  private rayo: Phaser.GameObjects.Graphics;
  private carga?: Actor;
  private dy = 0;

  constructor(private s: Phaser.Scene, x: number, y: number, escala = 2.2) {
    this.actor = new Actor(s, x, y, 'dron_bit7', { escala, dir: 1 }).setDepth(950);
    this.rayo = s.add.graphics().setDepth(949).setBlendMode(Phaser.BlendModes.ADD);
    s.tweens.add({ targets: this, dy: 6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    s.events.on('update', this.paso, this);
    s.events.once('shutdown', () => s.events.off('update', this.paso, this));
  }

  private paso(): void {
    this.actor.base.y = this.dy;
    if (this.actor.luz) this.actor.luz.y = this.dy;
    this.rayo.clear();
    if (this.carga) {
      const alto = altoSobreAncla(this.carga), pie = this.actor.y + this.dy + 22 + alto;
      this.carga.setPosition(this.actor.x, pie + Math.sin(this.s.time.now / 150) * 2);
      const x = this.actor.x, y0 = this.actor.y + this.dy - 6, y1 = this.carga.y - alto;
      this.rayo.fillStyle(0x3ff3ff, 0.16).fillTriangle(x - 6, y0, x + 6, y0, x + 26, y1).fillTriangle(x - 6, y0, x - 26, y1, x + 26, y1);
      this.rayo.lineStyle(2, 0x9ffbff, 0.6).lineBetween(x - 6, y0, x - 26, y1).lineBetween(x + 6, y0, x + 26, y1);
    }
  }

  /** Posición a la que debe volar el dron para dejar `obj` con los pies en (x, y) con escala `escala`. */
  sobre(obj: Actor, x: number, y: number, escala: number): { x: number; y: number } {
    return { x, y: y - 22 - obj.base.height * obj.base.originY * escala * 0.8 };
  }

  volarA(x: number, y: number, ms = 650): Promise<void> {
    this.actor.mirarHacia(x - this.actor.x, y - this.actor.y);
    return new Promise(res => this.s.tweens.add({ targets: this.actor, x, y, duration: ms, ease: 'Sine.inOut', onComplete: () => res() }));
  }

  /** Engancha un objeto con el rayo tractor. */
  enganchar(obj: Actor): void { Sonido.motor(0.4); this.carga = obj; obj.setDepth(948); }
  soltar(): Actor | undefined { const c = this.carga; this.carga = undefined; return c; }

  /** Parpadeo rojo y sacudida (pieza equivocada). */
  error(): void {
    this.actor.base.setTint(0xff6a5a);
    this.s.tweens.add({ targets: this.actor, x: this.actor.x + 6, duration: 50, yoyo: true, repeat: 3, onComplete: () => this.actor.base.clearTint() });
  }
}

// ─────────────── Lista holográfica de tareas ───────────────
export class ListaHolo {
  private filas: { caja: Phaser.GameObjects.Graphics; t: Phaser.GameObjects.Text; hecha: boolean; tilde?: Phaser.GameObjects.Text }[] = [];
  readonly cont: Phaser.GameObjects.Container;

  constructor(private s: Phaser.Scene, x: number, y: number, titulo: string, items: string[], ancho = 230) {
    const alto = 46 + items.length * 30;
    this.cont = s.add.container(x, y).setDepth(800).setScrollFactor(0, 0, true);
    this.cont.add(panel(s, ancho / 2, alto / 2, ancho, alto, { titulo, alfa: 0.82 }));
    items.forEach((it, i) => {
      const caja = s.add.graphics();
      const t = s.add.text(40, 34 + i * 30, it, { fontFamily: FUENTE, fontSize: '14px', fontStyle: '800', color: '#c8d6ec' }).setOrigin(0, 0.5);
      this.cont.add([caja, t]);
      this.filas.push({ caja, t, hecha: false });
      this.pintar(i, false);
    });
    this.cont.setX(x - 40).setAlpha(0);
    s.tweens.add({ targets: this.cont, x, alpha: 1, duration: 450, ease: 'Cubic.out', delay: 200 });
  }

  private pintar(i: number, actual: boolean): void {
    const f = this.filas[i], y = 34 + i * 30;
    f.caja.clear().lineStyle(2, f.hecha ? 0x3cff6a : actual ? 0xffe14d : 0x5a6a88, 1).strokeRoundedRect(14, y - 9, 18, 18, 4);
    if (f.hecha) f.caja.fillStyle(0x3cff6a, 1).fillRoundedRect(17, y - 6, 12, 12, 3);
    f.t.setColor(f.hecha ? '#7dff9c' : actual ? '#ffe14d' : '#c8d6ec');
  }

  marcar(i: number): void {
    const f = this.filas[i];
    if (!f || f.hecha) return;
    f.hecha = true; this.pintar(i, false);
    this.s.tweens.add({ targets: f.t, x: '+=6', duration: 120, yoyo: true });
    const destello = this.s.add.text(f.t.x + f.t.width + 14, f.t.y, '✔', { fontFamily: FUENTE, fontSize: '16px', color: '#3cff6a' }).setOrigin(0.5);
    f.tilde = destello;
    this.cont.add(destello);
    destello.setScale(0); this.s.tweens.add({ targets: destello, scale: 1, duration: 300, ease: 'Back.out' });
  }

  /** Quita la marca de una fila (algo se retiró y hay que volver a hacerlo). */
  desmarcar(i: number): void {
    const f = this.filas[i];
    if (!f || !f.hecha) return;
    f.hecha = false; f.tilde?.destroy(); f.tilde = undefined; this.pintar(i, false);
  }

  /** Cambia el texto de una fila (por ejemplo, revela el nombre de la pieza o actualiza un contador). */
  renombrar(i: number, texto: string): void { this.filas[i]?.t.setText(texto); }

  /** Resalta la fila actual (la que toca hacer). */
  actual(i: number): void { this.filas.forEach((_, k) => this.pintar(k, k === i)); }
}

/** Estallido de chispas y anillo de luz al instalar algo. */
export function destello(s: Phaser.Scene, x: number, y: number, color = 0x3ff3ff): void {
  const anillo = s.add.circle(x, y, 10).setStrokeStyle(3, color, 1).setDepth(1500).setBlendMode(Phaser.BlendModes.ADD);
  s.tweens.add({ targets: anillo, radius: 60, alpha: 0, duration: 500, onComplete: () => anillo.destroy() });
  if (!s.textures.exists('amb-punto')) s.make.graphics({}, false).fillStyle(0xffffff).fillRect(0, 0, 2, 2).generateTexture('amb-punto', 2, 2).destroy();
  const e = s.add.particles(x, y, 'amb-punto', { speed: { min: 80, max: 220 }, lifespan: 500, quantity: 18, frequency: -1, scale: { start: 2, end: 0.5 }, tint: [color, 0xffffff, 0xffe14d], blendMode: 'ADD' }).setDepth(1500);
  e.explode(18);
  s.time.delayedCall(700, () => e.destroy());
}

/** Escáner: una franja de luz que barre un objeto de arriba abajo (diagnóstico). */
export function escanear(s: Phaser.Scene, x: number, y: number, alto: number, color = 0x3ff3ff): Promise<void> {
  const barra = s.add.rectangle(x, y - alto, 110, 4, color, 0.8).setDepth(1500).setBlendMode(Phaser.BlendModes.ADD);
  Sonido.cuenta();
  return new Promise(res => s.tweens.add({ targets: barra, y, duration: 520, yoyo: true, onComplete: () => { barra.destroy(); res(); } }));
}

/** Etiqueta pixel flotante que sube y se desvanece (+1, ✔, ✖). */
export function flotante(s: Phaser.Scene, x: number, y: number, texto: string, color = '#3cff6a'): void {
  const t = s.add.text(x, y, texto, { fontFamily: FUENTE_PIXEL, fontSize: '14px', color, stroke: '#04121a', strokeThickness: 5 }).setOrigin(0.5).setDepth(1600);
  s.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 1100, ease: 'Cubic.out', onComplete: () => t.destroy() });
}
