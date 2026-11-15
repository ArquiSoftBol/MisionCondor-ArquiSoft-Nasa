// Kit de interfaz animado de Misión Cóndor: botones, paneles holográficos, cintillos y avisos.
// Todo se dibuja con Graphics (sin imágenes) y se anima con tweens: liviano en celulares.
import Phaser from 'phaser';
import { W, FUENTE, FUENTE_PIXEL } from '../config';
import { Sonido } from '../core/audio';
import { icono as iconoPropio, esIcono } from './iconos';

export type Variante = 'primario' | 'exito' | 'aviso' | 'peligro' | 'neutro' | 'fantasma';
/** a = tono de arriba (luz), b = tono de abajo (sombra), borde = filo luminoso, texto = color del rótulo. */
const PALETA: Record<Variante, { a: number; b: number; borde: number; texto: string }> = {
  primario: { a: 0x6ff7ff, b: 0x18a6c8, borde: 0xd2feff, texto: '#03151c' },
  exito: { a: 0x8dffa9, b: 0x1fb85a, borde: 0xdcffe6, texto: '#03200d' },
  aviso: { a: 0xffe98a, b: 0xeea21c, borde: 0xfff6cc, texto: '#2a1800' },
  peligro: { a: 0xff9c7c, b: 0xd9431f, borde: 0xffd8cc, texto: '#2a0800' },
  neutro: { a: 0xeef3fb, b: 0xb3c0d4, borde: 0xffffff, texto: '#0b1020' },
  fantasma: { a: 0x1e2c4a, b: 0x0c1426, borde: 0x3ff3ff, texto: '#e8f6ff' },
};
/** Compatibilidad: los colores viejos se traducen a una variante. */
const deColor = (c?: number): Variante | undefined =>
  c === undefined ? undefined : c === 0x3cff6a ? 'exito' : c === 0xffe14d ? 'aviso' : c === 0xff6b2c ? 'peligro' : c === 0x3ff3ff ? 'primario' : c === 0xffffff ? 'neutro' : undefined;

const oscurecer = (c: number, f: number) => Phaser.Display.Color.GetColor(((c >> 16) & 255) * f, ((c >> 8) & 255) * f, (c & 255) * f);

export interface OpcBoton {
  ancho?: number; alto?: number; color?: number; texto?: string; pixel?: boolean; tam?: number;
  variante?: Variante; icono?: string; retardo?: number; pulso?: boolean;
}

/** Contorno con las esquinas cortadas en bisel (estilo consola pixel), centrado en 0,0. */
function bisel(w: number, h: number, k: number, dy = 0): Phaser.Math.Vector2[] {
  const x0 = -w / 2, x1 = w / 2, y0 = -h / 2 + dy, y1 = h / 2 + dy, V = Phaser.Math.Vector2;
  return [new V(x0 + k, y0), new V(x1 - k, y0), new V(x1, y0 + k), new V(x1, y1 - k), new V(x1 - k, y1), new V(x0 + k, y1), new V(x0, y1 - k), new V(x0, y0 + k)];
}

/**
 * Botón de Misión Cóndor: placa con esquinas en bisel, sombreado en dos tonos (como el pixel art del juego),
 * canto inferior en relieve, filo luminoso y ficha para el ícono. Al pasar el cursor se levanta y brilla;
 * al pulsarlo se hunde sobre su canto. Devuelve un contenedor interactivo (la API no cambió).
 */
export function boton(scene: Phaser.Scene, x: number, y: number, etiqueta: string, accion: () => void, o: OpcBoton = {}): Phaser.GameObjects.Container {
  const w = o.ancho ?? 240, h = o.alto ?? 56, k = Math.max(6, Math.min(12, Math.round(h / 4.5))), lip = Math.max(3, Math.round(h / 14));
  const variante = o.variante ?? deColor(o.color) ?? 'neutro', v = PALETA[variante], fantasma = variante === 'fantasma';
  const c = scene.add.container(x, y).setDepth(60);

  // halo (aparece al pasar el cursor) y sombra en el suelo
  const halo = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
  halo.fillStyle(v.borde, 0.16).fillPoints(bisel(w + 18, h + 18, k + 6), true).fillStyle(v.borde, 0.12).fillPoints(bisel(w + 8, h + 8, k + 3), true);
  const sombra = scene.add.graphics().fillStyle(0x000000, 0.42).fillPoints(bisel(w, h, k, lip + 4), true);
  // canto (la parte de abajo que da relieve)
  const canto = scene.add.graphics().fillStyle(oscurecer(v.b, fantasma ? 0.8 : 0.5), 1).fillPoints(bisel(w, h, k, lip), true);

  // cara del botón: se mueve sola al levantarse / hundirse
  const cara = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.fillStyle(v.b, fantasma ? 0.92 : 1).fillPoints(bisel(w, h, k), true);
  // banda de luz arriba (dos tonos, sin degradado: lectura pixel art)
  g.fillStyle(v.a, fantasma ? 0.55 : 1).fillPoints([
    new Phaser.Math.Vector2(-w / 2 + k, -h / 2), new Phaser.Math.Vector2(w / 2 - k, -h / 2), new Phaser.Math.Vector2(w / 2, -h / 2 + k),
    new Phaser.Math.Vector2(w / 2, -h * 0.02), new Phaser.Math.Vector2(-w / 2, -h * 0.02), new Phaser.Math.Vector2(-w / 2, -h / 2 + k),
  ], true);
  g.fillStyle(0xffffff, fantasma ? 0.12 : 0.38).fillRect(-w / 2 + k + 2, -h / 2 + 3, w - 2 * k - 4, 2);   // filo de luz superior
  g.lineStyle(2, v.borde, fantasma ? 0.85 : 0.95).strokePoints(bisel(w, h, k), true);
  if (!fantasma) g.lineStyle(1, oscurecer(v.b, 0.55), 0.6).strokePoints(bisel(w - 6, h - 6, k - 2), true);
  cara.add(g);

  // destello que cruza la placa de vez en cuando (recortado al ancho útil)
  const brillo = scene.add.rectangle(-w / 2 + k + 6, 0, 8, h - 10, 0xffffff, fantasma ? 0.12 : 0.3).setAngle(16).setVisible(w > 90);
  cara.add(brillo);

  // ficha del ícono y rótulo
  let dx = 0;
  if (o.icono) {
    const fw = h - 14, fx = -w / 2 + 8 + fw / 2;
    const ficha = scene.add.graphics();
    ficha.fillStyle(oscurecer(v.b, fantasma ? 1.4 : 0.72), fantasma ? 0.9 : 0.55).fillPoints(bisel(fw, fw, Math.max(4, k - 4)), true)
      .lineStyle(1, v.borde, 0.5).strokePoints(bisel(fw, fw, Math.max(4, k - 4)), true);
    ficha.setPosition(fx, 0);
    const ic = esIcono(o.icono) ? iconoPropio(scene, fx, 0, o.icono, Math.round(h * 0.56))
      : scene.add.text(fx, 0, o.icono, { fontFamily: FUENTE, fontSize: `${Math.round(h * 0.42)}px`, fontStyle: '800', color: fantasma ? v.texto : '#ffffff' }).setOrigin(0.5)
        .setShadow(0, 1, '#00000088', 0, false, true);
    cara.add([ficha, ic]);
    dx = fw / 2 + 4;
  }
  const t = scene.add.text(dx, -1, etiqueta, {
    fontFamily: o.pixel ? FUENTE_PIXEL : FUENTE, fontSize: `${o.tam ?? (o.pixel ? 14 : Math.min(21, Math.round(h * 0.38)))}px`, fontStyle: o.pixel ? '' : '800',
    color: o.texto ?? v.texto, align: 'center',
  }).setOrigin(0.5);
  if (!fantasma) t.setShadow(0, 1, '#ffffff66', 0, false, true);
  cara.add(t);
  c.add([halo, sombra, canto, cara]);

  scene.tweens.add({ targets: brillo, x: w / 2 - k - 6, duration: 700, delay: 1400 + (o.retardo ?? 0), repeat: -1, repeatDelay: 3200, ease: 'Sine.inOut', onRepeat: () => brillo.setX(-w / 2 + k + 6) });
  if (o.pulso) {
    scene.tweens.add({ targets: c, scale: { from: 1, to: 1.04 }, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: 600 });
    scene.tweens.add({ targets: halo, alpha: { from: 0.25, to: 0.8 }, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: 600 });
  }

  // entrada: aparece con rebote
  c.setScale(0.6).setAlpha(0);
  scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 360, delay: o.retardo ?? 0, ease: 'Back.out' });

  c.setSize(w + 10, h + lip + 10).setInteractive({ useHandCursor: true });
  const levantar = (sube: boolean) => {
    scene.tweens.add({ targets: cara, y: sube ? -2 : 0, duration: 110 });
    if (!o.pulso) scene.tweens.add({ targets: halo, alpha: sube ? 1 : 0, duration: 140 });
  };
  c.on('pointerover', () => { levantar(true); Sonido.tecla(); });
  c.on('pointerout', () => levantar(false));
  c.on('pointerdown', () => {
    Sonido.despertar(); Sonido.click();
    c.disableInteractive();
    const flash = scene.add.graphics().fillStyle(0xffffff, 0.7).fillPoints(bisel(w, h, k), true);
    cara.add(flash);
    scene.tweens.add({ targets: flash, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
    // se hunde sobre su canto y vuelve
    scene.tweens.add({ targets: cara, y: lip, duration: 70, yoyo: true, onComplete: () => { if (c.active) c.setInteractive({ useHandCursor: true }); accion(); } });
  });
  return c;
}

/** Panel holográfico: vidrio oscuro, borde con esquinas, línea de escaneo que baja. Se abre como una pantalla CRT. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, o: { color?: number; titulo?: string; alfa?: number; abrir?: boolean } = {}): Phaser.GameObjects.Container {
  const col = o.color ?? 0x3ff3ff, c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x040914, o.alfa ?? 0.9).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
  g.fillGradientStyle(col, col, 0x000000, 0x000000, 0.10, 0.10, 0, 0).fillRoundedRect(-w / 2, -h / 2, w, h * 0.45, { tl: 14, tr: 14, bl: 0, br: 0 });
  g.lineStyle(2, col, 0.55).strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
  g.lineStyle(1, col, 0.18);
  for (let yy = -h / 2 + 6; yy < h / 2; yy += 4) g.lineBetween(-w / 2 + 6, yy, w / 2 - 6, yy);     // líneas de pantalla
  const esq = scene.add.graphics().lineStyle(3, col, 1);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    const ex = sx * (w / 2 + 4), ey = sy * (h / 2 + 4);
    esq.lineBetween(ex, ey, ex - sx * 26, ey).lineBetween(ex, ey, ex, ey - sy * 20);
  });
  const barrido = scene.add.rectangle(0, -h / 2 + 4, w - 12, 3, col, 0.35).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: barrido, y: h / 2 - 4, duration: 2600, repeat: -1, ease: 'Linear' });
  scene.tweens.add({ targets: esq, alpha: { from: 0.6, to: 1 }, duration: 900, yoyo: true, repeat: -1 });
  c.add([g, barrido, esq]);
  if (o.titulo) {
    const tt = scene.add.text(-w / 2 + 34, -h / 2, o.titulo, { fontFamily: FUENTE_PIXEL, fontSize: '11px', color: '#04121a' }).setOrigin(0, 0.5);
    const tg = scene.add.graphics().fillStyle(col, 0.95).fillRoundedRect(-w / 2 + 18, -h / 2 - 13, Math.min(w - 36, tt.width + 32), 26, 8);
    c.add([tg, tt]);
  }
  if (o.abrir !== false) {
    c.setScale(1, 0.02).setAlpha(0);
    scene.tweens.add({ targets: c, scaleY: 1, alpha: 1, duration: 320, ease: 'Cubic.out' });
  }
  return c;
}

/** Cintillo de instrucción arriba de la pantalla (la tarea actual, siempre visible y centrada). */
export type Cintillo = Phaser.GameObjects.Container & { texto?: Phaser.GameObjects.Text };
export function cintillo(scene: Phaser.Scene, texto: string, icono = '◆', y = 32): Cintillo {
  const c = scene.add.container(W / 2, y).setDepth(40).setScrollFactor(0, 0, true);
  const t = scene.add.text(14, 0, texto, { fontFamily: FUENTE, fontSize: '18px', fontStyle: '800', color: '#ffe14d' }).setOrigin(0.5);
  let ancho = t.width + 70;
  const g = scene.add.graphics();
  const fondo = () => g.clear().fillStyle(0x040914, 0.82).fillRoundedRect(-ancho / 2, -19, ancho, 38, 19).lineStyle(2, 0xffe14d, 0.7).strokeRoundedRect(-ancho / 2, -19, ancho, 38, 19);
  fondo();
  const ic = esIcono(icono) ? iconoPropio(scene, -ancho / 2 + 22, 0, icono, 24) : scene.add.text(-ancho / 2 + 22, 0, icono, { fontFamily: FUENTE, fontSize: '16px', color: '#ffe14d' }).setOrigin(0.5);
  if (!esIcono(icono)) scene.tweens.add({ targets: ic, angle: 360, duration: 4000, repeat: -1 });
  c.add([g, ic, t]);
  // si cambia el texto, la píldora se ajusta a su largo (antes quedaba del tamaño del primer texto)
  const poner = t.setText.bind(t);
  t.setText = ((v: string | string[]) => { poner(v); ancho = t.width + 70; fondo(); (ic as unknown as Phaser.GameObjects.Components.Transform).x = -ancho / 2 + 22; return t; }) as typeof t.setText;
  c.setY(y - 60);
  scene.tweens.add({ targets: c, y, duration: 450, ease: 'Back.out', delay: 200 });
  (c as Phaser.GameObjects.Container & { texto?: Phaser.GameObjects.Text }).texto = t;
  return c;
}

/** Título amarillo estilo «HISTORIA DEL JUEGO» / verde «JUEGOS - MISIONES». */
export function titulo(scene: Phaser.Scene, x: number, y: number, texto: string, color = '#ffe14d', tam = 34): Phaser.GameObjects.Text {
  return scene.add.text(x, y, texto, { fontFamily: FUENTE, fontSize: `${tam}px`, fontStyle: '800', color, stroke: '#000', strokeThickness: 6 })
    .setOrigin(0.5).setDepth(55);
}

/** Aviso flotante en forma de píldora que baja, espera y se va (pistas, aciertos, errores). Uno a la vez. */
const ultimo = new WeakMap<Phaser.Scene, Phaser.GameObjects.Container>();
export function aviso(scene: Phaser.Scene, texto: string, color = '#ffe14d', y = 70): void {
  ultimo.get(scene)?.destroy();
  const col = Phaser.Display.Color.HexStringToColor(color).color;
  const icono = color === '#3cff6a' ? '✔' : color === '#ff4a3d' ? '✖' : color === '#3ff3ff' ? 'i' : '★';
  const t = scene.add.text(16, 0, texto, { fontFamily: FUENTE, fontSize: '18px', fontStyle: '800', color: '#ffffff', align: 'center', wordWrap: { width: 720 } }).setOrigin(0.5);
  const w = t.width + 76, h = t.height + 22;
  const g = scene.add.graphics();
  g.fillStyle(0x040914, 0.92).fillRoundedRect(-w / 2, -h / 2, w, h, 16).lineStyle(2, col, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
  g.fillStyle(col, 1).fillCircle(-w / 2 + 26, 0, 13);
  const ic = scene.add.text(-w / 2 + 26, 0, icono, { fontFamily: FUENTE, fontSize: '15px', fontStyle: '800', color: '#04121a' }).setOrigin(0.5);
  const c = scene.add.container(W / 2, y - 30, [g, ic, t]).setDepth(9500).setScrollFactor(0, 0, true).setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, y, duration: 220, ease: 'Back.out' });
  scene.tweens.add({ targets: c, alpha: 0, y: y - 16, duration: 260, delay: 2600, onComplete: () => c.destroy() });
  ultimo.set(scene, c);
}

/** Hace aparecer en cascada (abajo → arriba, con fundido) una lista de objetos. */
export function cascada(scene: Phaser.Scene, objs: (Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.AlphaSingle)[], desde = 0, paso = 90): void {
  objs.forEach((o, i) => {
    const y = o.y;
    o.setAlpha(0); o.y = y + 14;
    scene.tweens.add({ targets: o, alpha: 1, y, duration: 320, delay: desde + i * paso, ease: 'Cubic.out' });
  });
}
