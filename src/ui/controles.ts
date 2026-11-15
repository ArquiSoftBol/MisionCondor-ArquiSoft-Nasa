// Controles de ajustes con el estilo del juego: interruptor (sí/no), selector segmentado y nivel (− ▮▮▮ +).
import Phaser from 'phaser';
import { FUENTE, FUENTE_PIXEL } from '../config';
import { Sonido } from '../core/audio';
import { t } from '../core/idioma';

const CIAN = 0x3ff3ff, FONDO = 0x0b1222, BORDE = 0x3a4d74;

/** Interruptor encendido/apagado. */
export function interruptor(s: Phaser.Scene, x: number, y: number, valor: boolean, alCambiar: (v: boolean) => void): Phaser.GameObjects.Container {
  const c = s.add.container(x, y), w = 64, h = 30;
  const g = s.add.graphics(), bola = s.add.circle(0, 0, 11, 0xffffff);
  const txt = s.add.text(0, 0, '', { fontFamily: FUENTE_PIXEL, fontSize: '8px', color: '#04121a' }).setOrigin(0.5);
  let v = valor;
  const pintar = (anim: boolean) => {
    g.clear().fillStyle(v ? CIAN : FONDO, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2).lineStyle(2, v ? 0xbffbff : BORDE, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    const bx = v ? w / 2 - 15 : -w / 2 + 15;
    if (anim) s.tweens.add({ targets: bola, x: bx, duration: 140, ease: 'Cubic.out' }); else bola.x = bx;
    txt.setText(v ? t('SÍ') : t('NO')).setX(v ? -10 : 10).setColor(v ? '#04121a' : '#9fb3d1');
  };
  c.add([g, txt, bola]);
  pintar(false);
  c.setSize(w + 10, h + 10).setInteractive({ useHandCursor: true }).on('pointerdown', () => { v = !v; Sonido.click(); pintar(true); alCambiar(v); });
  return c;
}

/** Selector segmentado: una opción activa entre varias. */
export function segmentado(s: Phaser.Scene, x: number, y: number, opciones: string[], indice: number, alCambiar: (i: number) => void, ancho = 220): Phaser.GameObjects.Container {
  const c = s.add.container(x, y), h = 32, w = ancho / opciones.length;
  const fondo = s.add.graphics().fillStyle(FONDO, 1).fillRoundedRect(-ancho / 2, -h / 2, ancho, h, 10).lineStyle(2, BORDE, 1).strokeRoundedRect(-ancho / 2, -h / 2, ancho, h, 10);
  const marca = s.add.graphics().fillStyle(CIAN, 1).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 8);
  c.add([fondo, marca]);
  let actual = indice;
  const textos = opciones.map((o, i) => {
    const tx = s.add.text(-ancho / 2 + w * i + w / 2, 0, t(o), { fontFamily: FUENTE, fontSize: '13px', fontStyle: '800', color: '#e8f6ff' }).setOrigin(0.5);
    const zona = s.add.zone(tx.x, 0, w, h).setInteractive({ useHandCursor: true });
    zona.on('pointerdown', () => { if (i === actual) return; actual = i; Sonido.click(); pintar(true); alCambiar(i); });
    c.add([tx, zona]);
    return tx;
  });
  const pintar = (anim: boolean) => {
    const mx = -ancho / 2 + w * actual + w / 2;
    if (anim) s.tweens.add({ targets: marca, x: mx, duration: 160, ease: 'Cubic.out' }); else marca.x = mx;
    textos.forEach((tx, i) => tx.setColor(i === actual ? '#04121a' : '#c8d6ec'));
  };
  pintar(false);
  return c;
}

/** Nivel en pasos (volumen): − ▮▮▮▮▯▯ + y porcentaje. */
export function nivel(s: Phaser.Scene, x: number, y: number, valor: number, alCambiar: (v: number) => void): Phaser.GameObjects.Container {
  const c = s.add.container(x, y);
  let v = Math.round(valor * 10);
  const g = s.add.graphics(), txt = s.add.text(98, 0, '', { fontFamily: FUENTE_PIXEL, fontSize: '9px', color: '#e8f6ff' }).setOrigin(0, 0.5);
  const pintar = () => {
    g.clear();
    for (let i = 0; i < 10; i++) g.fillStyle(i < v ? CIAN : 0x1b2740, 1).fillRoundedRect(-70 + i * 14, -9, 10, 18, 2);
    txt.setText(`${v * 10} %`);
  };
  const tecla = (dx: number, signo: string, d: number) => {
    const b = s.add.text(dx, 0, signo, { fontFamily: FUENTE, fontSize: '22px', fontStyle: '800', color: '#3ff3ff' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    b.on('pointerdown', () => { v = Phaser.Math.Clamp(v + d, 0, 10); Sonido.tecla(); pintar(); alCambiar(v / 10); });
    return b;
  };
  c.add([g, txt, tecla(-90, '−', -1), tecla(82, '+', 1)]);
  pintar();
  return c;
}
