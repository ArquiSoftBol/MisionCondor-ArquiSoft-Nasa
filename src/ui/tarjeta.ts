// Tarjeta «JUEGOS - MISIONES N» (como en las láminas) antes de jugar, y tarjeta de resultado al terminar.
// Se abren sobre el escenario de la misión (fondo atenuado, no negro) para no cortar la inmersión.
import { t as tr } from '../core/idioma';
import { nombreDificultad, dificultad } from '../core/dificultad';
import Phaser from 'phaser';
import { W, H, FUENTE, FUENTE_PIXEL, CSS } from '../config';
import { boton, panel, cascada } from './boton';
import { Actor } from '../core/sprites';
import { Sonido } from '../core/audio';
import { guiaDe } from '../data/guias';
import { TOTAL_MISIONES } from '../core/misiones';
import { chipTema, contenidoGuia } from './guia';

type Obj = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.AlphaSingle;

const velo = (scene: Phaser.Scene, alfa: number) => {
  const v = scene.add.rectangle(W / 2, H / 2, W, H, 0x02040a, alfa).setInteractive();
  v.setAlpha(0);
  scene.tweens.add({ targets: v, alpha: 1, duration: 300 });
  return v;
};

/** Texto que se escribe letra por letra. */
function maquina(scene: Phaser.Scene, t: Phaser.GameObjects.Text, es: string, desde = 0, vel = 55): void {
  const completo = tr(es);
  t.setText('');
  let n = 0;
  const ev = scene.time.addEvent({ delay: 1000 / vel, startAt: -desde, repeat: completo.length - 1, callback: () => {
    if (!t.active) { ev.remove(); return; }   // la tarjeta se cerró antes de terminar de escribir
    n++; t.setText(completo.slice(0, n)); if (n % 4 === 0) Sonido.tecla();
  } });
}

export function tarjetaMision(scene: Phaser.Scene, n: number, titulo: string, texto: string, sprites: string[], alJugar: () => void): void {
  const guia = guiaDe(scene.scene.key);
  const c = scene.add.container(0, 0).setDepth(10000).setScrollFactor(0, 0, true);
  c.add(velo(scene, 0.6));
  c.add(panel(scene, W / 2, H / 2 + 6, 760, 452, { color: 0x3cff6a, titulo: `MISIÓN ${n} / ${TOTAL_MISIONES}` }));
  const modo = scene.add.text(W / 2 + 356, 70, nombreDificultad(), { fontFamily: FUENTE_PIXEL, fontSize: '9px', color: dificultad() === 'ingenieria' ? '#ff8a7a' : '#7dff9c' }).setOrigin(1, 0.5);
  // indicador de página (1 · historia y tema, 2 · cómo se juega)
  const puntos = guia ? [0, 1].map(k => scene.add.circle(W / 2 + (k - 0.5) * 18, 494, 4, 0x3cff6a, k === 0 ? 1 : 0.25)) : [];
  c.add([modo, ...puntos]);

  // ── página 1: la historia de la misión y el tema que se aprende ──
  const p1 = scene.add.container(0, 0);
  c.add(p1);
  const etiqueta = scene.add.text(W / 2, 80, `JUEGOS - MISIONES ${n}`, { fontFamily: FUENTE, fontSize: '36px', fontStyle: '800', color: CSS.verde, stroke: '#02200c', strokeThickness: 6 }).setOrigin(0.5);
  const sub = scene.add.text(W / 2, 122, titulo.toUpperCase(), { fontFamily: FUENTE_PIXEL, fontSize: '15px', color: '#ffffff' }).setOrigin(0.5);
  p1.add([etiqueta, sub]);
  etiqueta.setScale(0.6).setAlpha(0);
  scene.tweens.add({ targets: etiqueta, scale: 1, alpha: 1, duration: 420, delay: 200, ease: 'Back.out' });
  const cascadaP1: Obj[] = [sub];
  if (guia) { const chip = chipTema(scene, W / 2, 156, guia.tema); p1.add(chip); cascadaP1.push(chip); }
  cascada(scene, cascadaP1, 380, 140);

  // piezas de la misión sobre pedestales luminosos que giran como en una vitrina
  sprites.forEach((id, i) => {
    const x = W / 2 + (i - (sprites.length - 1) / 2) * 150, y = 290;
    const ped = scene.add.ellipse(x, y + 4, 110, 30, 0x3cff6a, 0.16).setStrokeStyle(2, 0x3cff6a, 0.7);
    const luz = scene.add.triangle(x, y + 4, -40, 0, 40, 0, 0, -110, 0x3cff6a, 0.07).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD);
    const a = new Actor(scene, x, y, id, { escala: 1.5, dir: 1 });
    p1.add([luz, ped, a]);
    a.setScale(0).setAlpha(0);
    scene.tweens.add({ targets: a, scale: 1.5, alpha: 1, duration: 420, delay: 500 + i * 140, ease: 'Back.out' });
    scene.tweens.add({ targets: a, y: y - 6, duration: 1300 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: 900 });
    let d = 1;
    scene.time.addEvent({ delay: 700, loop: true, startAt: i * 160, callback: () => { d = (d + 1) % 8; if (a.active) a.mirar(d); } });
  });

  const cuerpo = scene.add.text(W / 2, 380, '', { fontFamily: FUENTE, fontSize: '16px', fontStyle: 'italic 700', color: '#e8f6ff', align: 'center', wordWrap: { width: 660 }, lineSpacing: 4 }).setOrigin(0.5, 0.5);
  p1.add(cuerpo);
  maquina(scene, cuerpo, texto, 700, 70);

  const cerrar = () => scene.tweens.add({ targets: c, alpha: 0, duration: 250, onComplete: () => c.destroy() });
  const jugar = (b: Phaser.GameObjects.Container) => { b.destroy(); cerrar(); alJugar(); };

  if (!guia) {
    const b = boton(scene, W / 2, 456, '¡A jugar!', () => jugar(b), { ancho: 240, variante: 'exito', icono: '▶', retardo: 900, pulso: true });
    b.setDepth(10001).setScrollFactor(0, 0, true);
    return;
  }

  // ── página 2: cómo se juega (objetivo, pasos, controles) ──
  let b1: Phaser.GameObjects.Container;
  const irA2 = () => {
    b1.destroy();
    scene.tweens.add({ targets: p1, alpha: 0, x: -40, duration: 260, onComplete: () => p1.setVisible(false) });
    puntos.forEach((p, k) => p.setFillStyle(0x3cff6a, k === 1 ? 1 : 0.25));
    const p2 = scene.add.container(0, 0);
    c.add(p2);
    const objs = contenidoGuia(scene, guia, 82);
    p2.add(objs);
    cascada(scene, objs, 200, 90);
    const atras = boton(scene, W / 2 - 250, 456, 'Atrás', () => {
      atras.destroy(); bj.destroy(); p2.destroy();
      p1.setVisible(true);
      scene.tweens.add({ targets: p1, alpha: 1, x: 0, duration: 260 });
      puntos.forEach((p, k) => p.setFillStyle(0x3cff6a, k === 0 ? 1 : 0.25));
      ponerB1(0);
    }, { ancho: 140, alto: 42, variante: 'fantasma', icono: '‹', tam: 16, retardo: 400 });
    const bj = boton(scene, W / 2, 456, '¡A jugar!', () => { atras.destroy(); jugar(bj); }, { ancho: 240, variante: 'exito', icono: '▶', retardo: 700, pulso: true });
    [atras, bj].forEach(b => b.setDepth(10001).setScrollFactor(0, 0, true));
  };
  const ponerB1 = (retardo: number) => {
    b1 = boton(scene, W / 2, 456, 'Cómo se juega', irA2, { ancho: 260, variante: 'primario', icono: '›', retardo, pulso: true });
    b1.setDepth(10001).setScrollFactor(0, 0, true);
  };
  ponerB1(900);
}

/** Confeti de colores que cae desde arriba (celebración). */
export function confeti(scene: Phaser.Scene, prof = 10002): void {
  if (!scene.textures.exists('amb-confeti')) scene.make.graphics({}, false).fillStyle(0xffffff).fillRect(0, 0, 6, 4).generateTexture('amb-confeti', 6, 4).destroy();
  const e = scene.add.particles(0, -10, 'amb-confeti', {
    x: { min: 0, max: W }, speedY: { min: 160, max: 320 }, speedX: { min: -80, max: 80 }, rotate: { start: 0, end: 720 },
    lifespan: 3200, quantity: 4, frequency: 40, gravityY: 120, tint: [0x3cff6a, 0xffe14d, 0x3ff3ff, 0xff5fc8, 0xff6b2c],
  }).setDepth(prof).setScrollFactor(0);
  scene.time.delayedCall(1200, () => e.stop());
  scene.time.delayedCall(5000, () => e.destroy());
}

/** Resultado de una misión con estrellas (1–3). `nota` explica qué faltó para la siguiente estrella. */
export interface Calificacion { estrellas: number; mejor: number; nota?: string }

export function tarjetaResultado(scene: Phaser.Scene, titulo: string, lineas: string[], alSeguir: () => void, cal?: Calificacion): void {
  Sonido.bien();
  confeti(scene);
  const c = scene.add.container(0, 0).setDepth(10000).setScrollFactor(0, 0, true);
  c.add(velo(scene, 0.55));
  c.add(panel(scene, W / 2, H / 2, 660, 380, { color: 0x3cff6a, titulo: 'MISIÓN CUMPLIDA' }));
  // estrellas: se encienden una por una (las no ganadas quedan apagadas)
  const n = cal ? cal.estrellas : 1, total = cal ? 3 : 1;
  for (let i = 0; i < total; i++) {
    const gana = i < n, x = W / 2 + (i - (total - 1) / 2) * 62;
    const st = scene.add.text(x, 128, '★', { fontFamily: FUENTE, fontSize: total > 1 ? '50px' : '54px', color: gana ? '#ffe14d' : '#33405a', stroke: gana ? '#5a3a00' : '#0b1222', strokeThickness: 6 }).setOrigin(0.5);
    c.add(st);
    st.setScale(0);
    scene.tweens.add({ targets: st, scale: 1, angle: gana ? 360 : 0, duration: 600, ease: 'Back.out', delay: 150 + i * 260, onStart: () => { if (gana) Sonido.tecla(); } });
    if (gana) scene.tweens.add({ targets: st, scale: 1.1, duration: 800, yoyo: true, repeat: -1, delay: 1100 + i * 120, ease: 'Sine.inOut' });
  }
  const tt = scene.add.text(W / 2, 182, titulo, { fontFamily: FUENTE, fontSize: '34px', fontStyle: '800', color: CSS.verde, stroke: '#02200c', strokeThickness: 6 }).setOrigin(0.5);
  c.add(tt);
  if (cal) {
    const pie = cal.estrellas < 3 && cal.nota ? cal.nota : cal.mejor > cal.estrellas ? tr('Tu mejor marca: {n} ★', { n: cal.mejor }) : '';
    if (pie) c.add(scene.add.text(W / 2, 370, pie, { fontFamily: FUENTE, fontSize: '14px', fontStyle: 'italic 700', color: '#ffe14d', align: 'center', wordWrap: { width: 600 } }).setOrigin(0.5));
  }
  tt.setScale(0.5).setAlpha(0);
  scene.tweens.add({ targets: tt, scale: 1, alpha: 1, duration: 450, delay: 300, ease: 'Back.out' });
  const filas = lineas.filter(Boolean).map((l, i) => {
    const t = scene.add.text(W / 2, 236 + i * 34, l, { fontFamily: FUENTE, fontSize: '17px', fontStyle: '700', color: i === 0 ? '#ffffff' : '#c8e6ff', align: 'center', wordWrap: { width: 600 } }).setOrigin(0.5);
    c.add(t);
    return t;
  });
  cascada(scene, filas, 600, 160);
  const b = boton(scene, W / 2, 416, 'Continuar', () => { b.destroy(); alSeguir(); }, { ancho: 250, variante: 'aviso', icono: '➜', retardo: 900 + filas.length * 160 });
  b.setDepth(10001).setScrollFactor(0, 0, true);
}
