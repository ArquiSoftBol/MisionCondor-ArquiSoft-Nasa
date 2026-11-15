// Lámina 1: RECOMENDACIONES (12+ · auriculares · teclado) sobre el espacio, con íconos animados. Luego Logo.
import Phaser from 'phaser';
import { selectorIdioma } from '../ui/selectorIdioma';
import { W, H, FUENTE, FUENTE_PIXEL, CSS } from '../config';
import { Sonido } from '../core/audio';
import { cargar } from '../core/sprites';
import { panel } from '../ui/boton';
import { fondoEspacio } from '../ui/escenarios';

export class Recomendaciones extends Phaser.Scene {
  constructor() { super('Recomendaciones'); }

  preload(): void { cargar(this, ['tierra', 'orion_completa']); }

  create(): void {
    this.cameras.main.setBackgroundColor('#000').fadeIn(500);
    fondoEspacio(this);
    const tit = this.add.text(W / 2, 74, 'RECOMENDACIONES', { fontFamily: FUENTE, fontSize: '40px', fontStyle: '800', color: CSS.amarillo, stroke: '#2a1a00', strokeThickness: 6 }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: tit, alpha: 1, y: 84, duration: 500, ease: 'Back.out' });

    const tarjeta = (x: number, i: number, leyenda: string, dibujar: (c: Phaser.GameObjects.Container) => void) => {
      const c = this.add.container(x, 270);
      c.add(panel(this, 0, 0, 230, 250, { abrir: false, color: [0xff4a3d, 0x3ff3ff, 0x3cff6a][i] }));
      dibujar(c);
      c.add(this.add.text(0, 90, leyenda, { fontFamily: FUENTE, fontSize: '13px', fontStyle: '800', color: '#fff', align: 'center', lineSpacing: 2 }).setOrigin(0.5));
      c.setAlpha(0).setY(310);
      this.tweens.add({ targets: c, alpha: 1, y: 270, duration: 500, delay: 250 + i * 180, ease: 'Back.out' });
    };

    // 12+: insignia que late
    tarjeta(W / 2 - 260, 0, 'EDAD RECOMENDADA\n12 AÑOS O MÁS', c => {
      const g = this.add.graphics().fillStyle(0xffffff).fillCircle(0, -20, 60).lineStyle(11, 0xe0141c).strokeCircle(0, -20, 55);
      const t = this.add.text(0, -18, '12+', { fontFamily: FUENTE, fontSize: '46px', fontStyle: '800', color: '#000' }).setOrigin(0.5);
      c.add([g, t]);
      this.tweens.add({ targets: [g, t], scale: 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });
    // auriculares con ondas de sonido
    tarjeta(W / 2, 1, 'USA AURICULARES PARA\nMEJORAR LA EXPERIENCIA', c => {
      const g = this.add.graphics().lineStyle(12, 0xffffff).beginPath().arc(0, -14, 52, Math.PI, 0).strokePath();
      g.fillStyle(0xffffff).fillRoundedRect(-66, -20, 26, 48, 9).fillRoundedRect(40, -20, 26, 48, 9);
      c.add(g);
      for (let k = 0; k < 2; k++) [-1, 1].forEach(s => {
        const o = this.add.arc(s * 70, 4, 14, s > 0 ? -60 : 120, s > 0 ? 60 : 240).setStrokeStyle(3, 0x3ff3ff).setClosePath(false);
        c.add(o);
        this.tweens.add({ targets: o, scale: 2.4, alpha: 0, duration: 1400, delay: k * 700, repeat: -1 });
      });
      this.tweens.add({ targets: g, y: -4, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });
    // teclado con teclas que se encienden
    tarjeta(W / 2 + 260, 2, 'TECLADO, RATÓN O PANTALLA\nTÁCTIL EN HORIZONTAL', c => {
      const teclas: Phaser.GameObjects.Rectangle[] = [];
      for (let r = 0; r < 4; r++) for (let k = 0; k < (r === 3 ? 5 : 8); k++) {
        const w = r === 3 && k === 2 ? 52 : 15, x = -78 + k * 20 + (r % 2) * 5 + (r === 3 && k > 2 ? 36 : 0);
        const t = this.add.rectangle(x + w / 2, -56 + r * 22, w, 16, 0xffffff).setStrokeStyle(1, 0x9aa3ae);
        teclas.push(t); c.add(t);
      }
      this.time.addEvent({ delay: 160, loop: true, callback: () => {
        const t = teclas[Math.floor(Math.random() * teclas.length)];
        t.setFillStyle(0x3cff6a);
        this.time.delayedCall(220, () => t.setFillStyle(0xffffff));
      } });
    });

    const seguir = this.add.text(W / 2, H - 46, 'Toca o pulsa cualquier tecla para empezar', { fontFamily: FUENTE_PIXEL, fontSize: '11px', color: '#9fdcff' }).setOrigin(0.5);
    this.tweens.add({ targets: seguir, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });

    selectorIdioma(this, W / 2, 22, () => this.scene.restart());

    let hecho = false;
    const ir = () => {
      if (hecho) return; hecho = true;
      Sonido.despertar();
      this.cameras.main.fadeOut(400);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Logo'));
    };
    this.input.once('pointerdown', ir);
    this.input.keyboard?.once('keydown', ir);
    this.time.delayedCall(7000, ir);
  }
}
