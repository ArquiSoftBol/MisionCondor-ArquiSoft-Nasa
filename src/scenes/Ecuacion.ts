// CLÍMAX INTERACTIVO · «La ecuación del cohete» (Fase 3 del plan de mejora).
// Se abre encima de la cinemática del clímax (después de «hay que dejar masa atrás») y la cinemática sigue al terminar.
// El jugador intenta aligerar la cápsula: cada cosa que deja en Europa sube el Δv, pero ninguna combinación alcanza…
// salvo dejar al Rover (180 kg). Así la decisión más dura de la historia la toma el jugador.
//   Δv = ve · ln((masa seca + combustible) / masa seca)   con ve = 3,0 km/s y 2 260 kg de combustible fabricado.
//   Con todo: 2,67 km/s · sin los extras: 2,78 · sin el Rover: 2,89 · necesario: 2,80.
import Phaser from 'phaser';
import { W, H, FUENTE, FUENTE_PIXEL, CSS } from '../config';
import { Actor, cargar } from '../core/sprites';
import { perfil } from '../core/estado';
import { Sonido } from '../core/audio';
import { aviso, boton, panel } from '../ui/boton';
import { icono } from '../ui/iconos';
import { numero, t } from '../core/idioma';
import { personalizar } from '../core/texto';
import { colorear } from '../ui/cine';

const VE = 3.0, COMBUSTIBLE = 2260, ESTRUCTURA = 1155, NECESARIO = 2.8;

interface Carga { id: string; sprite: string; nombre: string; kg: number; fija?: string; escala: number }
const CARGAS = (): Carga[] => [
  { id: 'tu', sprite: `eva_${perfil.orientacion}_camina`, nombre: personalizar('{NOMBRE}') + ' + traje', kg: 120, fija: 'Tienes que volver: se lo prometiste a {MASCOTA}.', escala: 1.3 },
  { id: 'cura', sprite: 'contenedor_muestras', nombre: 'Contenedor de la cura', kg: 30, fija: 'La cura no se deja: es la razón de todo el viaje.', escala: 1.3 },
  { id: 'instrumentos', sprite: 'espectrometro_mano', nombre: 'Instrumentos', kg: 30, escala: 1.3 },
  { id: 'agua', sprite: 'tanque_criogenico', nombre: 'Agua de reserva', kg: 25, escala: 1.1 },
  { id: 'asiento', sprite: 'silla', nombre: 'Asiento extra', kg: 15, escala: 1.2 },
  { id: 'herramientas', sprite: 'llave_torque', nombre: 'Herramientas', kg: 12, escala: 1.3 },
  { id: 'dron', sprite: 'dron_mapeo', nombre: 'Dron de mapeo', kg: 8, escala: 1.2 },
  { id: 'rover', sprite: 'rover_explorador', nombre: 'Rover explorador', kg: 180, escala: 1.25 },
];

const dv = (masaSeca: number) => VE * Math.log((masaSeca + COMBUSTIBLE) / masaSeca);

export class Ecuacion extends Phaser.Scene {
  private alTerminar?: () => void;
  private dejadas = new Set<string>();
  private fichas = new Map<string, { c: Phaser.GameObjects.Container; car: Carga; casa: { x: number; y: number } }>();
  private barra!: Phaser.GameObjects.Rectangle;
  private lectura!: Phaser.GameObjects.Text;
  private masaTxt!: Phaser.GameObjects.Text;
  private confirmar?: Phaser.GameObjects.Container;
  private pistaRover = false;
  private hecho = false;
  private escala: (v: number) => number = v => v;

  constructor() { super('Ecuacion'); }

  init(d: { alTerminar?: () => void }): void { this.alTerminar = d.alTerminar; this.dejadas = new Set(); this.fichas = new Map(); this.pistaRover = false; this.hecho = false; this.confirmar = undefined; }

  preload(): void { cargar(this, CARGAS().map(c => c.sprite)); }

  create(): void {
    colorear(this, 'climax');
    this.cameras.main.fadeIn(500);
    this.add.rectangle(W / 2, H / 2, W, H, 0x03060d, 1);
    // pantalla de la computadora de vuelo
    panel(this, W / 2, H / 2 + 8, W - 40, H - 40, { titulo: 'COMPUTADORA DE VUELO · RUTA DE REGRESO', color: 0x3ff3ff, alfa: 0.9 });
    this.add.text(W / 2, 54, t('Aligera la cápsula hasta llegar a 2,80 km/s'), { fontFamily: FUENTE, fontSize: '22px', fontStyle: '800', color: CSS.amarillo }).setOrigin(0.5);
    this.add.text(W / 2, 82, t('Toca una carga para dejarla en Europa (o para volver a subirla).'), { fontFamily: FUENTE, fontSize: '14px', fontStyle: '700', color: '#9fdcff' }).setOrigin(0.5);

    // barra de Δv con la meta
    const x0 = 120, y0 = 124, ancho = W - 240, max = 3.1;
    this.add.rectangle(x0, y0, ancho, 26, 0x0b1222).setOrigin(0, 0.5).setStrokeStyle(2, 0xffffff, 0.6);
    this.barra = this.add.rectangle(x0 + 2, y0, 10, 20, 0xff4a3d).setOrigin(0, 0.5);
    const meta = x0 + ancho * (NECESARIO / max);
    this.add.rectangle(meta, y0, 4, 44, 0x3cff6a);
    this.add.text(meta, y0 + 26, t('necesario 2,80'), { fontFamily: FUENTE, fontSize: '12px', fontStyle: '800', color: CSS.verde }).setOrigin(0.5, 0);
    this.add.text(x0, y0 - 30, t('VELOCIDAD DE ESCAPE (Δv)'), { fontFamily: FUENTE_PIXEL, fontSize: '9px', color: '#9fdcff' });
    this.lectura = this.add.text(x0 + ancho, y0 - 30, '', { fontFamily: FUENTE_PIXEL, fontSize: '11px', color: '#ffffff' }).setOrigin(1, 0);
    this.masaTxt = this.add.text(x0, y0 + 24, '', { fontFamily: FUENTE, fontSize: '13px', fontStyle: '700', color: '#c8d6ec' });
    this.escala = (v: number) => Math.max(10, ancho * Math.min(1, v / max) - 4);

    // zonas: en la cápsula / se queda en Europa
    this.add.text(250, 196, t('EN LA CÁPSULA'), { fontFamily: FUENTE_PIXEL, fontSize: '10px', color: '#3ff3ff' }).setOrigin(0.5);
    this.add.text(W - 210, 196, t('SE QUEDA EN EUROPA'), { fontFamily: FUENTE_PIXEL, fontSize: '10px', color: '#ffb36b' }).setOrigin(0.5);
    this.add.rectangle(W - 210, 336, 330, 272, 0x1a1208, 0.6).setStrokeStyle(2, 0xffb36b, 0.5);
    this.add.rectangle(250, 336, 440, 272, 0x081420, 0.6).setStrokeStyle(2, 0x3ff3ff, 0.5);

    CARGAS().forEach((car, i) => {
      const casa = { x: 105 + (i % 4) * 98, y: 276 + Math.floor(i / 4) * 120 };
      const c = this.add.container(casa.x, casa.y);
      const fondo = this.add.rectangle(0, 0, 90, 116, car.fija ? 0x101826 : 0x0d1f30, 0.95).setStrokeStyle(2, car.id === 'rover' ? 0xffe14d : car.fija ? 0x5a6a88 : 0x3ff3ff, 0.9);
      const a = new Actor(this, 0, 22, car.sprite, { escala: car.escala, dir: 1 });
      const nom = this.add.text(0, 34, t(car.nombre), { fontFamily: FUENTE, fontSize: '11px', fontStyle: '800', color: '#e8f6ff', align: 'center', wordWrap: { width: 84 } }).setOrigin(0.5, 0);
      const kg = this.add.text(0, -50, `${car.kg} kg`, { fontFamily: FUENTE_PIXEL, fontSize: '8px', color: car.fija ? '#8a96ae' : '#ffe14d' }).setOrigin(0.5);
      c.add([fondo, a, nom, kg]);
      if (car.fija) { kg.setX(-8); c.add(icono(this, kg.width / 2 + 4, -50, 'ico_candado', 14)); }
      c.setSize(90, 116).setInteractive({ useHandCursor: true });
      c.on('pointerover', () => this.tweens.add({ targets: c, scale: 1.06, duration: 100 }));
      c.on('pointerout', () => this.tweens.add({ targets: c, scale: 1, duration: 100 }));
      c.on('pointerdown', () => this.tocar(car.id));
      c.setScale(0); this.tweens.add({ targets: c, scale: 1, duration: 350, delay: 300 + i * 80, ease: 'Back.out' });
      this.fichas.set(car.id, { c, car, casa });
    });
    this.actualizar(true);
  }

  private masaSeca(): number {
    let m = ESTRUCTURA;
    this.fichas.forEach(({ car }) => { if (!this.dejadas.has(car.id)) m += car.kg; });
    return m;
  }

  private tocar(id: string): void {
    if (this.hecho) return;
    const f = this.fichas.get(id);
    if (!f) return;
    if (f.car.fija) { Sonido.mal(); aviso(this, personalizar(t(f.car.fija)), CSS.rojo, 176); this.tweens.add({ targets: f.c, x: f.c.x + 6, duration: 50, yoyo: true, repeat: 3 }); return; }
    const deja = !this.dejadas.has(id);
    if (deja) this.dejadas.add(id); else this.dejadas.delete(id);
    // posición en la zona de Europa (en orden de llegada) o de vuelta a su lugar
    const enEuropa = [...this.dejadas];
    enEuropa.forEach((k, i) => {
      const ff = this.fichas.get(k)!;
      this.tweens.add({ targets: ff.c, x: W - 330 + (i % 3) * 98, y: 276 + Math.floor(i / 3) * 120, duration: 380, ease: 'Cubic.out' });
    });
    if (!deja) this.tweens.add({ targets: f.c, x: f.casa.x, y: f.casa.y, duration: 380, ease: 'Cubic.out' });
    Sonido.click();
    if (id === 'rover' && deja) { Sonido.mal(); this.cameras.main.shake(200, 0.003); }
    this.actualizar();
  }

  private actualizar(primera = false): void {
    const m = this.masaSeca(), v = dv(m), escala = this.escala;
    const ok = v >= NECESARIO;
    this.tweens.add({ targets: this.barra, width: escala(v), duration: primera ? 0 : 600, ease: 'Cubic.out' });
    this.barra.setFillStyle(ok ? 0x3cff6a : v > 2.74 ? 0xffb33f : 0xff4a3d);
    this.lectura.setText(`Δv ${numero(v, 2)} km/s`).setColor(ok ? '#7dff9c' : '#ff8a7a');
    this.masaTxt.setText(t('Masa a levantar: {m} kg · combustible: {c} kg', { m: numero(m), c: numero(COMBUSTIBLE) }));
    // pistas: al dejar todos los extras y aún no alcanzar
    const extras = [...this.fichas.values()].filter(f => !f.car.fija && f.car.id !== 'rover');
    const sinExtras = extras.every(f => this.dejadas.has(f.car.id));
    if (sinExtras && !this.dejadas.has('rover') && !this.pistaRover) {
      this.pistaRover = true;
      aviso(this, t('Faltan apenas {f} km/s… No queda nada más que quitar. Salvo el Rover.', { f: numero(NECESARIO - v, 2) }), CSS.amarillo, 176);
      const r = this.fichas.get('rover')!.c;
      this.tweens.add({ targets: r, scale: 1.1, duration: 500, yoyo: true, repeat: 5 });
    }
    // confirmar la ruta solo cuando alcanza
    if (ok && !this.confirmar) {
      this.confirmar = boton(this, W / 2, H - 46, 'Confirmar ruta de regreso', () => this.confirmarRuta(), { ancho: 340, variante: 'exito', icono: '✔', pulso: true });
    } else if (!ok && this.confirmar) { this.confirmar.destroy(); this.confirmar = undefined; }
  }

  private confirmarRuta(): void {
    if (this.hecho) return;
    this.hecho = true;
    const rover = this.dejadas.has('rover');
    Sonido.bien();
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75));
    const txt = rover
      ? t('El Rover se quedará en Europa como faro de telemetría.\nSin sus 180 kg, la cápsula alcanza la velocidad de escape.')
      : t('Ruta confirmada.');
    c.add(this.add.text(W / 2, H / 2 - 20, txt, { fontFamily: FUENTE, fontSize: '22px', fontStyle: 'italic 700', color: '#ffffff', align: 'center', wordWrap: { width: 760 }, lineSpacing: 8 }).setOrigin(0.5));
    c.add(this.add.text(W / 2, H / 2 + 60, t('Cada kilo que dejas atrás es velocidad para volver a casa.'), { fontFamily: FUENTE, fontSize: '15px', fontStyle: '700', color: CSS.amarillo }).setOrigin(0.5));
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 900 });
    this.time.delayedCall(4800, () => {
      this.cameras.main.fadeOut(700, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => { const fn = this.alTerminar; this.scene.stop(); fn?.(); });
    });
  }
}
