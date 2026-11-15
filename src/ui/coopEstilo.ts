// Estilo visual del MULTIJUGADOR: el mundo compartido deja de ser «un piso con edificios» y pasa a ser
// la Ciudadela de noche: costra de sal hexagonal, senderos con balizas, carteles de cada zona, luz que
// acompaña a los jugadores en la oscuridad, sombras, polvo al caminar y faros sobre las piezas.
// Todo con texturas generadas una vez (sin archivos nuevos).
import Phaser from 'phaser';
import { W, H, FUENTE, FUENTE_PIXEL } from '../config';
import { t } from '../core/idioma';
import { calidadAlta } from './cine';

/** Nombre visible de cada edificio de la Ciudadela (para los carteles). */
export const NOMBRE_EDIFICIO: Record<string, string> = {
  hangar_ensamblaje: 'Hangar de ensamblaje', modulo_habitacional: 'Módulo habitacional', invernadero: 'Invernadero',
  laboratorio: 'Laboratorio', antena_espacio_profundo: 'Antena de espacio profundo', centro_control: 'Centro de control',
  oficina_presupuesto: 'Oficina de presupuesto', granja_solar: 'Granja solar', deposito_combustible: 'Depósito de combustible',
  patio_pruebas: 'Patio de pruebas', torre_lanzamiento: 'Torre de lanzamiento',
};

function texturas(s: Phaser.Scene): void {
  if (!s.textures.exists('coop-luz')) {   // mancha de luz radial (para «borrar» la oscuridad y para halos)
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d')!, g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    s.textures.addCanvas('coop-luz', c);
  }
  if (!s.textures.exists('coop-haz')) {   // haz vertical de un faro (degradado hacia arriba)
    const c = document.createElement('canvas'); c.width = 32; c.height = 256;
    const x = c.getContext('2d')!, g = x.createLinearGradient(0, 256, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 256);
    const h = x.createLinearGradient(0, 0, 32, 0);   // bordes suaves
    h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, 32, 256);
    s.textures.addCanvas('coop-haz', c);
  }
  if (!s.textures.exists('coop-mota')) s.make.graphics({}, false).fillStyle(0xffffff).fillCircle(3, 3, 3).generateTexture('coop-mota', 6, 6).destroy();
}

/** Costra de sal: celdas hexagonales irregulares, grietas y brillos, dibujadas una sola vez en una textura. */
export function costraDeSal(s: Phaser.Scene, ancho: number, alto: number, noche: boolean): void {
  texturas(s);
  const g = s.make.graphics({}, false), rnd = new Phaser.Math.RandomDataGenerator(['salar']);
  const r = 46, dx = r * Math.sqrt(3), dy = r * 1.5;
  const borde = noche ? 0xdfe8ff : 0xffffff;
  for (let fila = -1, y = 0; y < alto + r; fila++, y = fila * dy) {
    for (let col = -1, x = 0; x < ancho + dx; col++, x = col * dx + (fila % 2 ? dx / 2 : 0)) {
      const pts: Phaser.Math.Vector2[] = [];
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + k * Math.PI / 3, j = r * rnd.realInRange(0.86, 1.04);
        pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * j, y + Math.sin(a) * j * 0.62));   // aplastado: vista en perspectiva
      }
      g.fillStyle(borde, rnd.realInRange(0.02, 0.07)).fillPoints(pts, true);
      g.lineStyle(2, borde, rnd.realInRange(0.12, 0.22)).strokePoints(pts, true);
    }
  }
  for (let i = 0; i < 260; i++) g.fillStyle(0xffffff, rnd.realInRange(0.25, 0.7)).fillRect(rnd.between(0, ancho), rnd.between(0, alto), 2, 2);   // cristales de sal
  const rt = s.add.renderTexture(0, 0, ancho, alto).setOrigin(0).setDepth(-15);
  rt.draw(g); g.destroy();
}

/** Senderos con balizas que salen del hangar hacia cada edificio (guían sin necesidad de flechas). */
export function senderos(s: Phaser.Scene, desde: { x: number; y: number }, hasta: { x: number; y: number }[], color: number): void {
  texturas(s);
  const g = s.add.graphics().setDepth(-12);
  const balizas: Phaser.GameObjects.Image[] = [];
  hasta.forEach(p => {
    const d = Math.hypot(p.x - desde.x, p.y - desde.y), n = Math.floor(d / 70);
    // camino: franja más clara, como sal pisada
    g.lineStyle(34, 0xffffff, 0.06).lineBetween(desde.x, desde.y, p.x, p.y + 60);
    for (let i = 1; i < n; i++) {
      const k = i / n, x = desde.x + (p.x - desde.x) * k, y = desde.y + (p.y + 60 - desde.y) * k;
      g.fillStyle(color, 0.85).fillCircle(x, y, 3);
      if (calidadAlta() && i % 2 === 0) balizas.push(s.add.image(x, y, 'coop-luz').setScale(0.16).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setDepth(-11));
    }
  });
  // las balizas se encienden en ola, del hangar hacia afuera
  balizas.forEach((b, i) => s.tweens.add({ targets: b, alpha: 0.12, duration: 900, yoyo: true, repeat: -1, delay: (i % 12) * 110 }));
}

/** Cartel con el nombre de la zona, sobre un poste. */
export function cartel(s: Phaser.Scene, x: number, y: number, texto: string, color: number): void {
  const tx = s.add.text(0, 0, t(texto).toUpperCase(), { fontFamily: FUENTE_PIXEL, fontSize: '8px', color: '#ffffff' }).setOrigin(0.5);
  const w = tx.width + 18, hex = color;
  const g = s.add.graphics();
  g.fillStyle(0x3a4560, 1).fillRect(-2, 0, 4, 26);
  g.fillStyle(0x040914, 0.9).fillRoundedRect(-w / 2, -12, w, 22, 5).lineStyle(2, hex, 0.9).strokeRoundedRect(-w / 2, -12, w, 22, 5);
  g.fillStyle(hex, 1).fillRect(-w / 2 + 4, 6, w - 8, 2);
  s.add.container(x, y, [g, tx]).setDepth(y + 30);
}

/** Sombra elíptica bajo un objeto que se mueve. */
export const sombra = (s: Phaser.Scene, ancho = 46): Phaser.GameObjects.Ellipse =>
  s.add.ellipse(0, 0, ancho, ancho * 0.36, 0x000000, 0.38).setDepth(-2);

/** Polvo de sal que levantan los pies. */
export function polvoPasos(s: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter {
  texturas(s);
  return s.add.particles(0, 0, 'coop-mota', {
    lifespan: 520, speedX: { min: -30, max: 30 }, speedY: { min: -26, max: -6 }, scale: { start: 0.9, end: 0 },
    alpha: { start: 0.5, end: 0 }, tint: 0xe8eeff, emitting: false,
  }).setDepth(-1);
}

/** Faro de luz sobre una pieza: se ve desde lejos y se vuelve dorado cuando el Ingeniero la pide. */
export function faro(s: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image {
  texturas(s);
  const f = s.add.image(x, y + 6, 'coop-haz').setOrigin(0.5, 1).setDisplaySize(46, 200).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setTint(0x3ff3ff).setDepth(y - 2);
  s.tweens.add({ targets: f, alpha: 0.18, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return f;
}

/**
 * Noche: una capa oscura a pantalla completa que se «abre» con luz alrededor de los jugadores, las balizas
 * de la mesa y la entrega, y las piezas. Se redibuja cada cuadro.
 */
export class Oscuridad {
  private rt: Phaser.GameObjects.RenderTexture;
  private sello: Phaser.GameObjects.Image;
  constructor(private s: Phaser.Scene, public color = 0x060b1e, public alfa = 0.62) {
    texturas(s);
    this.rt = s.add.renderTexture(0, 0, W, H).setOrigin(0).setScrollFactor(0).setDepth(40000);
    this.sello = s.make.image({ key: 'coop-luz', add: false });
  }
  /** Cambia la capa de la oscuridad (por defecto 40000, sobre todo el mundo). */
  profundidad(d: number): this { this.rt.setDepth(d); return this; }
  /** fuentes en coordenadas de mundo: [x, y, radio] */
  pintar(fuentes: [number, number, number][]): void {
    const cam = this.s.cameras.main;
    this.rt.clear().fill(this.color, this.alfa);
    for (const [x, y, r] of fuentes) {
      const sx = x - cam.scrollX, sy = y - cam.scrollY;
      if (sx < -r || sx > W + r || sy < -r || sy > H + r) continue;
      this.sello.setScale((r * 2) / 256, (r * 1.5) / 256);
      this.rt.erase(this.sello, sx, sy);
    }
  }
}

/** Tarjeta de inicio: «ERES EL INGENIERO», qué hacer, y cuenta 3·2·1. */
export function presentarRol(s: Phaser.Scene, rol: string, color: number, tareas: string[], alTerminar: () => void, lema = ''): void {
  const hex = '#' + color.toString(16).padStart(6, '0');
  const c = s.add.container(W / 2, H / 2).setScrollFactor(0).setDepth(97000);
  const fondo = s.add.rectangle(0, 0, W, H, 0x02040a, 0.55);
  const g = s.add.graphics().fillStyle(0x040914, 0.94).fillRoundedRect(-280, -140, 560, 280, 16).lineStyle(3, color, 1).strokeRoundedRect(-280, -140, 560, 280, 16);
  g.fillStyle(color, 1).fillRect(-280, -140, 560, 6);
  const eres = s.add.text(0, -118, t('TURNO DE NOCHE') + '  ·  ' + t('TU ROL'), { fontFamily: FUENTE_PIXEL, fontSize: '9px', color: '#9fb3d1' }).setOrigin(0.5);
  const nombre = s.add.text(0, -86, t(rol).toUpperCase(), { fontFamily: FUENTE, fontSize: '34px', fontStyle: '800', color: hex, stroke: '#000000', strokeThickness: 5 }).setOrigin(0.5);
  const frase = s.add.text(0, -50, lema ? t(lema) : '', { fontFamily: FUENTE, fontSize: '14px', fontStyle: 'italic 700', color: '#ffe9b0', align: 'center', wordWrap: { width: 500 } }).setOrigin(0.5);
  const lista = s.add.text(-240, -22, tareas.map(x => '›  ' + t(x)).join('\n'), { fontFamily: FUENTE, fontSize: '14px', fontStyle: '700', color: '#e8f6ff', lineSpacing: 8, wordWrap: { width: 480 } });
  const cuenta = s.add.text(0, 114, '3', { fontFamily: FUENTE_PIXEL, fontSize: '18px', color: '#ffe14d' }).setOrigin(0.5);
  c.add([fondo, g, eres, nombre, frase, lista, cuenta]);
  c.setAlpha(0);
  s.tweens.add({ targets: c, alpha: 1, duration: 300 });
  let n = 3;
  const paso = () => {
    n--;
    if (n > 0) { cuenta.setText(String(n)); s.tweens.add({ targets: cuenta, scale: { from: 1.6, to: 1 }, duration: 300 }); s.time.delayedCall(900, paso); return; }
    cuenta.setText(t('¡A TRABAJAR!'));
    s.time.delayedCall(700, () => s.tweens.add({ targets: c, alpha: 0, duration: 400, onComplete: () => { c.destroy(); alTerminar(); } }));
  };
  s.time.delayedCall(1200, paso);
}
