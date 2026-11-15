// Lámina 2: «ARQUISOFT presenta» con el hexágono dibujándose.
import Phaser from 'phaser';
import { W, H, FUENTE, FUENTE_PIXEL } from '../config';
import { Sonido } from '../core/audio';
import { Musica } from '../core/musica';

export class Logo extends Phaser.Scene {
  constructor() { super('Logo'); }

  create(): void {
    this.cameras.main.setBackgroundColor('#000').fadeIn(600);
    Musica.parar(500);   // silencio breve: después del logo empieza la transmisión de emergencia (IntroRadio)
    const cx = W / 2, cy = H / 2 - 30, R = 150;
    const pts = Array.from({ length: 7 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      return new Phaser.Math.Vector2(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    });
    const g = this.add.graphics();
    const avance = { t: 0 };
    this.tweens.add({
      targets: avance, t: 1, duration: 1600, ease: 'Sine.inOut',
      onUpdate: () => {
        g.clear().lineStyle(3, 0xffffff, 1);
        const total = avance.t * 6;
        for (let i = 0; i < Math.ceil(total); i++) {
          const a = pts[i], b = pts[i + 1], f = Math.min(1, total - i);
          // dejamos un hueco en el lado izquierdo, como el logo
          if (i === 4) continue;
          g.lineBetween(a.x, a.y, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
        }
      },
    });
    const nombre = this.add.text(cx + 10, cy, 'ARQUISOFT', { fontFamily: FUENTE, fontSize: '58px', fontStyle: '600', color: '#ffffff', backgroundColor: '#000' })
      .setOrigin(0.5).setAlpha(0);
    const presenta = this.add.text(cx, H - 90, 'PRESENTA', { fontFamily: FUENTE_PIXEL, fontSize: '20px', color: '#ffffff' }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: nombre, alpha: 1, duration: 700, delay: 900, onStart: () => Sonido.bien() });
    this.tweens.add({ targets: presenta, alpha: 1, duration: 700, delay: 1700 });

    let hecho = false;
    const ir = () => {
      if (hecho) return; hecho = true;
      this.cameras.main.fadeOut(600);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('IntroRadio'));
    };
    this.time.delayedCall(4200, ir);
    this.input.once('pointerdown', ir);
    this.input.keyboard?.once('keydown', ir);
  }
}
