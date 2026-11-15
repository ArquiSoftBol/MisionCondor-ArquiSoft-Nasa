// Interruptor ES | EN (arriba en la portada, recomendaciones y pausa). Una píldora con un deslizador.
import Phaser from 'phaser';
import { FUENTE_PIXEL } from '../config';
import { Sonido } from '../core/audio';
import { idioma, cambiarIdioma, type Idioma } from '../core/idioma';

/** Dibuja el interruptor; al tocarlo cambia el idioma y llama a `alCambiar` (normalmente reiniciar la escena). */
export function selectorIdioma(scene: Phaser.Scene, x: number, y: number, alCambiar: () => void): Phaser.GameObjects.Container {
  const w = 112, h = 32, mitad = w / 2;
  const c = scene.add.container(x, y).setDepth(9000).setScrollFactor(0, 0, true);
  const fondo = scene.add.graphics();
  fondo.fillStyle(0x040914, 0.85).fillRoundedRect(-mitad, -h / 2, w, h, h / 2)
    .lineStyle(2, 0x3ff3ff, 0.8).strokeRoundedRect(-mitad, -h / 2, w, h, h / 2);
  const desliz = scene.add.graphics();
  desliz.fillStyle(0x3ff3ff, 1).fillRoundedRect(-mitad / 2 - 24, -h / 2 + 4, 48, h - 8, (h - 8) / 2);
  const posX = (i: Idioma) => (i === 'es' ? 0 : mitad);
  desliz.x = posX(idioma());
  const es = scene.add.text(-mitad / 2, 0, 'ES', { fontFamily: FUENTE_PIXEL, fontSize: '11px', color: '#ffffff' }).setOrigin(0.5);
  const en = scene.add.text(mitad / 2, 0, 'EN', { fontFamily: FUENTE_PIXEL, fontSize: '11px', color: '#ffffff' }).setOrigin(0.5);
  const pintar = () => {
    es.setColor(idioma() === 'es' ? '#04121a' : '#9fdcff');
    en.setColor(idioma() === 'en' ? '#04121a' : '#9fdcff');
  };
  pintar();
  c.add([fondo, desliz, es, en]);
  c.setSize(w + 8, h + 8).setInteractive({ useHandCursor: true });
  c.on('pointerover', () => scene.tweens.add({ targets: c, scale: 1.06, duration: 100 }));
  c.on('pointerout', () => scene.tweens.add({ targets: c, scale: 1, duration: 100 }));
  c.on('pointerdown', (p: Phaser.Input.Pointer, lx: number, _ly: number, ev: Phaser.Types.Input.EventData) => {
    ev?.stopPropagation?.();
    Sonido.despertar(); Sonido.click();
    // tocar un lado elige ese idioma; tocar el que ya está activo lo alterna
    const lado: Idioma = lx - (w + 8) / 2 < 0 ? 'es' : 'en';
    const nuevo: Idioma = lado !== idioma() ? lado : idioma() === 'es' ? 'en' : 'es';
    c.disableInteractive();
    scene.tweens.add({
      targets: desliz, x: posX(nuevo), duration: 180, ease: 'Cubic.out',
      onComplete: () => { cambiarIdioma(nuevo); pintar(); alCambiar(); },
    });
    void p;
  });
  // entrada suave
  c.setAlpha(0).setY(y - 20);
  scene.tweens.add({ targets: c, alpha: 1, y, duration: 400, delay: 300, ease: 'Back.out' });
  return c;
}
