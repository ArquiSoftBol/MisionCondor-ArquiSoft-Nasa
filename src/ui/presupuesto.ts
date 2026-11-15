// Panel de presupuesto de misión: barras con límite (masa, energía, estrés, radiación…).
// Cada barra muestra «valor / límite unidad» y se pone roja cuando se pasa (o, si `minimo`, cuando no alcanza).
import Phaser from 'phaser';
import { FUENTE, FUENTE_PIXEL } from '../config';
import { panel } from './boton';
import { numero, t } from '../core/idioma';

export interface Medidor {
  id: string; etiqueta: string; limite: number; unidad: string; color: number;
  /** true = el valor tiene que LLEGAR al límite (p. ej. energía generada vs consumo); false = no pasarlo */
  minimo?: boolean;
}

interface Barra { m: Medidor; valor: number; limite: number; g: Phaser.GameObjects.Graphics; txt: Phaser.GameObjects.Text; tw?: Phaser.Tweens.Tween; pinta: { v: number } }

export class Presupuesto {
  readonly cont: Phaser.GameObjects.Container;
  private barras = new Map<string, Barra>();
  private readonly ancho: number;

  constructor(private s: Phaser.Scene, x: number, y: number, titulo: string, medidores: Medidor[], ancho = 200) {
    this.ancho = ancho;
    const alto = 34 + medidores.length * 42;
    this.cont = s.add.container(x, y).setDepth(800).setScrollFactor(0, 0, true);
    this.cont.add(panel(s, ancho / 2, alto / 2, ancho, alto, { titulo, alfa: 0.84 }));
    medidores.forEach((m, i) => {
      const yy = 26 + i * 42;
      const et = s.add.text(12, yy, t(m.etiqueta), { fontFamily: FUENTE_PIXEL, fontSize: '8px', color: '#9fdcff' }).setOrigin(0, 0.5);
      const txt = s.add.text(ancho - 12, yy, '', { fontFamily: FUENTE, fontSize: '12px', fontStyle: '800', color: '#e8f6ff' }).setOrigin(1, 0.5);
      const g = s.add.graphics();
      this.cont.add([et, txt, g]);
      const b: Barra = { m, valor: 0, limite: m.limite, g, txt, pinta: { v: 0 } };
      this.barras.set(m.id, b);
      this.dibujar(b);
    });
    this.cont.setAlpha(0);
    s.tweens.add({ targets: this.cont, alpha: 1, duration: 400, delay: 250 });
  }

  /** Cambia el valor (animado). `limite` permite mover el límite (p. ej. el consumo de energía). */
  poner(id: string, valor: number, limite?: number): void {
    const b = this.barras.get(id);
    if (!b) return;
    if (limite !== undefined) b.limite = limite;
    b.valor = valor;
    b.tw?.stop();
    b.tw = this.s.tweens.add({ targets: b.pinta, v: valor, duration: 450, ease: 'Cubic.out', onUpdate: () => this.dibujar(b) });
    this.dibujar(b);
  }

  /** ¿Está en rojo? */
  mal(id: string): boolean {
    const b = this.barras.get(id);
    if (!b) return false;
    return b.m.minimo ? b.valor < b.limite : b.valor > b.limite;
  }

  /** Sacude la barra para llamar la atención. */
  sacudir(id: string): void {
    const b = this.barras.get(id);
    if (b) this.s.tweens.add({ targets: [b.g, b.txt], x: '+=5', duration: 50, yoyo: true, repeat: 3 });
  }

  private dibujar(b: Barra): void {
    const yy = 26 + [...this.barras.keys()].indexOf(b.m.id) * 42 + 12, w = this.ancho - 24;
    const escala = Math.max(b.limite * 1.25, b.valor, 1);
    const frac = Phaser.Math.Clamp(b.pinta.v / escala, 0, 1), lim = b.limite / escala;
    const mal = b.m.minimo ? b.valor < b.limite : b.valor > b.limite;
    const col = mal ? 0xff4a3d : b.m.color;
    b.g.clear().fillStyle(0x0b1222, 1).fillRoundedRect(12, yy - 5, w, 10, 4);
    if (frac > 0) b.g.fillStyle(col, 1).fillRoundedRect(12, yy - 5, Math.max(6, w * frac), 10, 4);
    b.g.lineStyle(2, 0xffffff, 0.9).lineBetween(12 + w * lim, yy - 9, 12 + w * lim, yy + 9);   // marca del límite
    b.txt.setText(`${numero(Math.round(b.pinta.v))} / ${numero(b.limite)} ${b.m.unidad}`).setColor(mal ? '#ff8a7a' : '#e8f6ff');
  }
}
