// «Cómo se juega»: objetivo, pasos con ícono y controles. Se usa en la tarjeta de inicio de cada misión
// (2.ª página) y en el menú de pausa / botón «?». Pensado para que nadie se pierda: una idea por tarjeta.
import Phaser from 'phaser';
import { W, FUENTE, FUENTE_PIXEL } from '../config';
import { t } from '../core/idioma';
import type { Guia } from '../data/guias';
import { icono, esIcono } from './iconos';

type Obj = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.AlphaSingle;

/** Píldora «TEMA · …» (qué se aprende en la misión). */
export function chipTema(s: Phaser.Scene, x: number, y: number, tema: string, color = 0x3ff3ff): Phaser.GameObjects.Container {
  const hex = '#' + color.toString(16).padStart(6, '0');
  const et = s.add.text(0, 0, t('TEMA'), { fontFamily: FUENTE_PIXEL, fontSize: '8px', color: '#04121a' }).setOrigin(0, 0.5);
  const tx = s.add.text(0, 0, t(tema), { fontFamily: FUENTE, fontSize: '14px', fontStyle: '800', color: hex }).setOrigin(0, 0.5);
  const wEt = et.width + 18, w = wEt + tx.width + 26, h = 28;
  const g = s.add.graphics();
  g.fillStyle(0x040914, 0.9).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2).lineStyle(2, color, 0.8).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  g.fillStyle(color, 1).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, wEt, h - 6, (h - 6) / 2);
  et.setX(-w / 2 + 12); tx.setX(-w / 2 + wEt + 14);
  return s.add.container(x, y, [g, et, tx]);
}

/**
 * Contenido de la guía, centrado en pantalla entre `arriba` y ~arriba+300. Devuelve los objetos (para meterlos
 * en un contenedor y animarlos en cascada).
 */
export function contenidoGuia(s: Phaser.Scene, g: Guia, arriba: number): Obj[] {
  const objs: Obj[] = [];
  const cab = s.add.text(W / 2, arriba, t('CÓMO SE JUEGA'), { fontFamily: FUENTE, fontSize: '30px', fontStyle: '800', color: '#3ff3ff', stroke: '#02161c', strokeThickness: 6 }).setOrigin(0.5);
  objs.push(cab);

  // objetivo: la meta en una línea destacada
  const ot = s.add.text(0, 0, t(g.objetivo), { fontFamily: FUENTE, fontSize: '16px', fontStyle: '800', color: '#ffe14d', align: 'center', wordWrap: { width: 560 } }).setOrigin(0, 0.5);
  const oe = s.add.text(0, 0, t('OBJETIVO'), { fontFamily: FUENTE_PIXEL, fontSize: '8px', color: '#2a1800' }).setOrigin(0, 0.5);
  const wOe = oe.width + 18, wObj = wOe + ot.width + 30, hObj = Math.max(34, ot.height + 14);
  const og = s.add.graphics();
  og.fillStyle(0x1a1300, 0.85).fillRoundedRect(-wObj / 2, -hObj / 2, wObj, hObj, 12).lineStyle(2, 0xffe14d, 0.85).strokeRoundedRect(-wObj / 2, -hObj / 2, wObj, hObj, 12);
  og.fillStyle(0xffe14d, 1).fillRoundedRect(-wObj / 2 + 4, -11, wOe, 22, 8);
  oe.setX(-wObj / 2 + 13); ot.setX(-wObj / 2 + wOe + 16);
  objs.push(s.add.container(W / 2, arriba + 46, [og, oe, ot]));

  // pasos: tarjetas numeradas de izquierda a derecha (se leen como una tira de cómic)
  const n = g.pasos.length, ancho = n > 3 ? 162 : 200, sep = ancho + 14, y0 = arriba + 96, alto = 162;
  g.pasos.forEach(([ico, texto], i) => {
    const x = W / 2 + (i - (n - 1) / 2) * sep;
    const fondo = s.add.graphics();
    fondo.fillStyle(0x0b1630, 0.92).fillRoundedRect(-ancho / 2, 0, ancho, alto, 12).lineStyle(2, 0x3a5a8a, 1).strokeRoundedRect(-ancho / 2, 0, ancho, alto, 12);
    fondo.fillStyle(0x3ff3ff, 0.12).fillRoundedRect(-ancho / 2, 0, ancho, 50, { tl: 12, tr: 12, bl: 0, br: 0 });
    fondo.fillStyle(0x3ff3ff, 1).fillCircle(-ancho / 2 + 16, 16, 11);
    const num = s.add.text(-ancho / 2 + 16, 16, String(i + 1), { fontFamily: FUENTE_PIXEL, fontSize: '9px', color: '#04121a' }).setOrigin(0.5);
    const ic = esIcono(ico) ? icono(s, 0, 26, ico, 44) : s.add.text(0, 26, ico, { fontFamily: FUENTE, fontSize: '28px', fontStyle: '800', color: '#ffffff' }).setOrigin(0.5);
    const tx = s.add.text(0, 60, t(texto), { fontFamily: FUENTE, fontSize: '13px', fontStyle: '700', color: '#e8f6ff', align: 'center', wordWrap: { width: ancho - 20 }, lineSpacing: 2 }).setOrigin(0.5, 0);
    if (tx.height > alto - 66) tx.setFontSize(12);
    const flecha = i < n - 1 ? s.add.text(ancho / 2 + 7, alto / 2, '›', { fontFamily: FUENTE, fontSize: '22px', fontStyle: '800', color: '#3ff3ff' }).setOrigin(0.5) : null;
    const c = s.add.container(x, y0, [fondo, num, ic, tx, ...(flecha ? [flecha] : [])]);
    objs.push(c);
  });

  // controles + idea clave del tema
  objs.push(lineaConIcono(s, W / 2, y0 + alto + 24, 'ico_teclado', t(g.controles), { fontFamily: FUENTE, fontSize: '13px', fontStyle: '700', color: '#9fdcff' }));
  objs.push(lineaConIcono(s, W / 2, y0 + alto + 50, 'ico_idea', t(g.idea), { fontFamily: FUENTE, fontSize: '13px', fontStyle: 'italic 700', color: '#c8d6ec' }));
  return objs;
}

/** Una línea de texto con un ícono propio a la izquierda; el conjunto queda centrado en x. */
export function lineaConIcono(s: Phaser.Scene, x: number, y: number, id: string, texto: string, estilo: Phaser.Types.GameObjects.Text.TextStyle, tam = 20): Phaser.GameObjects.Container {
  const tx = s.add.text(0, 0, texto, estilo).setOrigin(0, 0.5);
  const ic = icono(s, 0, 0, id, tam);
  const ancho = tam + 8 + tx.width;
  ic.setX(-ancho / 2 + tam / 2); tx.setX(-ancho / 2 + tam + 8);
  return s.add.container(x, y, [ic, tx]);
}
