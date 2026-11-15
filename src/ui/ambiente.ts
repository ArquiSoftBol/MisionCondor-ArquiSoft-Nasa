// Ambiente de los escenarios (Fase A del plan de mejoras visuales): viñeta, partículas de clima,
// estrellas fugaces, luna, brillo del horizonte e interior del hangar. Todo con texturas generadas una vez.
import Phaser from 'phaser';
import { W, H } from '../config';
import { piso, utileria } from './decorado';

type Destino = Phaser.GameObjects.Container | undefined;
const poner = <T extends Phaser.GameObjects.GameObject>(s: Phaser.Scene, o: T, c: Destino): T => { if (c) c.add(o); return o; };

/** Texturas pequeñas que usan las partículas. */
function texturas(s: Phaser.Scene): void {
  // cada textura por separado: otras partes del juego pueden haber creado alguna antes (p. ej. 'amb-punto')
  const crear = (id: string, w: number, h: number) => {
    if (s.textures.exists(id)) return;
    s.make.graphics({}, false).fillStyle(0xffffff).fillRect(0, 0, w, h).generateTexture(id, w, h).destroy();
  };
  crear('amb-punto', 2, 2); crear('amb-copo', 4, 4); crear('amb-raya', 6, 2);
}

/** Viñeta suave a pantalla completa (bordes oscuros, como en cine). */
export function vineta(s: Phaser.Scene, fuerza = 0.6, prof = 45): Phaser.GameObjects.Image {
  if (!s.textures.exists('amb-vineta')) {
    const c = document.createElement('canvas'); c.width = 480; c.height = 270;
    const x = c.getContext('2d')!, g = x.createRadialGradient(240, 135, 70, 240, 135, 290);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.65, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.95)');
    x.fillStyle = g; x.fillRect(0, 0, 480, 270);
    s.textures.addCanvas('amb-vineta', c);
  }
  return s.add.image(W / 2, H / 2, 'amb-vineta').setDisplaySize(W, H).setScrollFactor(0).setDepth(prof).setAlpha(fuerza);
}

/** Estrellas fugaces cada pocos segundos en la franja alta del cielo. */
export function fugaces(s: Phaser.Scene, c?: Destino, alto = 200): void {
  const lanzar = () => {
    const x = Phaser.Math.Between(100, W), y = Phaser.Math.Between(30, alto);
    const l = poner(s, s.add.rectangle(x, y, 46, 2, 0xffffff, 0.9).setAngle(-160).setBlendMode(Phaser.BlendModes.ADD), c);
    s.tweens.add({ targets: l, x: x - 260, y: y + 95, alpha: 0, scaleX: 0.3, duration: 900, ease: 'Quad.in', onComplete: () => l.destroy() });
  };
  s.time.addEvent({ delay: 2600, loop: true, startAt: 1800, callback: lanzar });
}

/** Luna con mares oscuros. */
export function luna(s: Phaser.Scene, x: number, y: number, c?: Destino, r = 22): void {
  const g = poner(s, s.add.graphics(), c);
  g.fillStyle(0xfff6d8, 0.18).fillCircle(x, y, r * 1.8);
  g.fillStyle(0xe9e4cf).fillCircle(x, y, r);
  g.fillStyle(0xc9c2a8).fillCircle(x - r * 0.3, y - r * 0.2, r * 0.32).fillCircle(x + r * 0.35, y + r * 0.25, r * 0.22).fillCircle(x + r * 0.1, y - r * 0.5, r * 0.14);
}

/** Banda de luz sobre el horizonte (resplandor del cielo detrás de los nevados). */
export function horizonte(s: Phaser.Scene, y: number, color: number, c?: Destino, alfa = 0.45): void {
  const g = poner(s, s.add.graphics().setBlendMode(Phaser.BlendModes.ADD), c);
  for (let i = 0; i < 6; i++) g.fillStyle(color, alfa * (1 - i / 6) * 0.35).fillRect(-200, y - 12 - i * 14, W + 400, 26 + i * 4);
}

/** Polvo marciano que cruza en diagonal. */
export function polvo(s: Phaser.Scene, c?: Destino, prof = 30): Phaser.GameObjects.Particles.ParticleEmitter {
  texturas(s);
  return poner(s, s.add.particles(-20, 0, 'amb-raya', {
    x: { min: -40, max: 0 }, y: { min: -40, max: H },
    speedX: { min: 380, max: 620 }, speedY: { min: 40, max: 120 },
    lifespan: 2600, frequency: 20, quantity: 3, alpha: { start: 0.9, end: 0 },
    scale: { min: 1.5, max: 4 }, tint: [0xffe0b8, 0xf0b07a, 0xfff2dc],
  }).setDepth(prof), c);
}

/** Escarcha que cae despacio y se mece (Europa). */
export function escarcha(s: Phaser.Scene, c?: Destino, prof = 30, pantalla = false): Phaser.GameObjects.Particles.ParticleEmitter {
  texturas(s);
  const e = s.add.particles(0, -10, 'amb-copo', {
    x: { min: -50, max: W + 50 }, speedY: { min: 25, max: 70 }, speedX: { min: -20, max: 20 },
    lifespan: 9000, frequency: 55, alpha: { start: 0.95, end: 0.2 }, scale: { min: 0.7, max: 1.6 },
    tint: [0xffffff, 0xcfefff, 0xa9e4f5], rotate: { min: 0, max: 90 },
  }).setDepth(prof);
  if (pantalla) e.setScrollFactor(0);
  e.fastForward(6000);
  return poner(s, e, c);
}

/** Chispas de soldadura que saltan cada tanto desde un punto. */
export function chispas(s: Phaser.Scene, x: number, y: number, c?: Destino): Phaser.GameObjects.Particles.ParticleEmitter {
  texturas(s);
  const e = s.add.particles(x, y, 'amb-punto', {
    speed: { min: 60, max: 180 }, angle: { min: 200, max: 340 }, gravityY: 380, lifespan: 700,
    quantity: 10, frequency: -1, tint: [0xffd27a, 0xffffff, 0xff8a3d], blendMode: 'ADD', scale: { start: 1.4, end: 0.4 },
  });
  s.time.addEvent({ delay: 1300, loop: true, callback: () => e.explode(Phaser.Math.Between(6, 14)) });
  return poner(s, e, c);
}

/** Interior del Hangar de Ensamblaje: vigas, lámparas con conos de luz y piso que refleja. */
export function hangar(s: Phaser.Scene, suelo: number, c?: Destino): void {
  const g = poner(s, s.add.graphics(), c);
  g.fillGradientStyle(0x0a101e, 0x0a101e, 0x1a2640, 0x1a2640, 1).fillRect(-200, -100, W + 400, suelo + 100);
  // pared con paneles
  g.lineStyle(1, 0x24365a, 0.8);
  for (let x = -200; x < W + 200; x += 80) g.lineBetween(x, 40, x, suelo);
  g.lineBetween(-200, suelo - 70, W + 200, suelo - 70);
  // vigas del techo (cerchas)
  g.fillStyle(0x2a3550).fillRect(-200, 26, W + 400, 10);
  g.lineStyle(3, 0x2a3550, 1);
  for (let x = -200; x < W + 200; x += 60) { g.lineBetween(x, 36, x + 30, 70); g.lineBetween(x + 30, 70, x + 60, 36); }
  g.fillStyle(0x2a3550).fillRect(-200, 68, W + 400, 5);
  // utilería del motor de moldes contra la pared y piso de placas de metal
  utileria(s, 'grua_puente', c, [[W / 2, suelo + 4, Math.min(2.7, (suelo - 70) / 81)]], 0);   // la viga queda justo bajo el techo
  utileria(s, 'estanteria', c, [[70, suelo + 4, 1.5], [890, suelo + 4, 1.5]], 0, 0xc8d0e8);
  piso(s, 'suelo_hangar', -200, suelo, W + 400, H - suelo + 120, c, 1);
  // lámparas con cono de luz
  [160, 480, 800].forEach((x, i) => {
    const cono = poner(s, s.add.triangle(x, 74, 0, 0, -150, suelo - 74, 150, suelo - 74, 0xfff0c8, 0.07).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD), c);
    s.tweens.add({ targets: cono, alpha: 0.75, duration: 1400 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const l = poner(s, s.add.graphics(), c);
    l.fillStyle(0x3a4a6a).fillRect(x - 1, 70, 2, 8).fillStyle(0x5d6670).fillRect(x - 14, 76, 28, 6).fillStyle(0xfff2c0).fillRect(x - 10, 82, 20, 3);
    poner(s, s.add.ellipse(x, suelo + 26, 260, 40, 0xfff0c8, 0.06).setBlendMode(Phaser.BlendModes.ADD), c);
  });
}
