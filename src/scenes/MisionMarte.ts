// MISIÓN 5 · Tormenta en Base Tari (Marte) — «Guía Maestra», fase 3, sincronizada con TIC TAC ROVER.mp3 (1:14):
//   0:00–0:11  calma: la cámara recorre Base Tari (tanques reabastecidos con hielo marciano) hasta el Rover.
//   0:11–0:54  tormenta de óxido: llegar al Rover, limpiar sus paneles con la llave de torque (mantener USAR),
//              esquivar los remolinos de polvo y volver a la nave con el Rover antes de quedar sepultados.
//   0:54–1:05  ignición de escape bajo la tormenta.
//   1:05–1:14  Marte queda atrás: zoom-out hacia el espacio, rumbo a Júpiter.
// Nunca se pierde: si se acaba el tiempo, entra la reserva de oxígeno (y cuesta estrellas).
import Phaser from 'phaser';
import { W, H, FUENTE_PIXEL, CSS } from '../config';
import { Actor, cargar, cuerposDe, empujar, type Cuerpo } from '../core/sprites';
import { siguiente } from '../core/flujo';
import { lograr, ganarEstrellas, perfil } from '../core/estado';
import { Sonido } from '../core/audio';
import { Musica } from '../core/musica';
import { segun } from '../core/dificultad';
import { t as tr } from '../core/idioma';
import { tarjetaMision, tarjetaResultado } from '../ui/tarjeta';
import { instalarPausa } from './Pausa';
import { aviso, boton, cintillo, type Cintillo } from '../ui/boton';
import { ListaHolo, flotante, destello } from '../ui/taller';
import { DECORADOS, piso } from '../ui/decorado';
import { Oscuridad, sombra, polvoPasos } from '../ui/coopEstilo';
import { vineta } from '../ui/ambiente';

const MW = 2000, MH = 1300;
const NAVE = { x: 380, y: 740 };
const ROVER = { x: 1660, y: 430 };
const INICIO = { x: 520, y: 880 };
const CALMA = 11, TORMENTA = 43;          // segundos (0:11 y 0:54 de la pista)
const VEL = 175;
const REMOLINOS: [number, number, number, number, number][] = [   // x0, y0 → x1, y1, ms de ida
  [880, 520, 1180, 930, 4200], [1330, 300, 1420, 820, 3600], [700, 980, 1120, 640, 4800], [1500, 980, 1880, 700, 4000],
];

type Fase = 'espera' | 'calma' | 'tormenta' | 'escape';

export class MisionMarte extends Phaser.Scene {
  private fase: Fase = 'espera';
  private yo!: Actor;
  private rover!: Actor;
  private nave!: Actor;
  private reparado = false;
  private progreso = 0;
  private golpes = 0;
  private enfriar = 0;            // segundos sin poder volver a ser golpeado
  private reloj = 0;              // segundos desde «¡A jugar!»
  private tormenta = 0;           // segundos de tormenta transcurridos
  private reserva = false;
  private usando = false;         // botón USAR mantenido (táctil)
  private remolinos: { cont: Phaser.GameObjects.Container; x: number; y: number }[] = [];
  private solidos: Cuerpo[] = [];
  private noche!: Oscuridad;
  private viento!: Phaser.GameObjects.Particles.ParticleEmitter;
  private polvo!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bruma!: Phaser.GameObjects.Rectangle;
  private sombras = new Map<Actor, Phaser.GameObjects.Ellipse>();
  private cinta!: Cintillo;
  private lista!: ListaHolo;
  private hud!: Phaser.GameObjects.Graphics;
  private hudTxt!: Phaser.GameObjects.Text;
  private aro!: Phaser.GameObjects.Graphics;
  private flecha!: Phaser.GameObjects.Triangle;
  private teclas!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursor!: Phaser.Types.Input.Keyboard.CursorKeys;
  private ultimoPaso = 0;
  private usarBtn!: Phaser.GameObjects.Container;

  constructor() { super('MisionMarte'); }

  private eva(accion: string): string { return `eva_${perfil.orientacion}_${accion}`; }

  preload(): void {
    cargar(this, [this.eva('camina'), this.eva('repara'), 'estado_rover_polvo', 'rover_explorador', 'capsula_colibri', 'electrolizador_isru', 'tanque_criogenico', 'llave_torque', ...DECORADOS]);
  }

  create(): void {
    this.fase = 'espera'; this.reparado = false; this.progreso = 0; this.golpes = 0; this.enfriar = 0; this.reloj = 0; this.tormenta = 0;
    this.reserva = false; this.usando = false; this.remolinos = []; this.solidos = []; this.sombras = new Map();
    this.cameras.main.fadeIn(500).setBounds(0, 0, MW, MH).setBackgroundColor('#1a0905');
    this.suelo();

    // Base Tari: la nave, el ISRU y los tanques recién llenados con hielo marciano
    this.nave = this.solido(NAVE.x, NAVE.y, 'capsula_colibri', 3.4);
    this.solido(NAVE.x + 190, NAVE.y + 50, 'electrolizador_isru', 2);
    this.solido(NAVE.x + 150, NAVE.y - 110, 'tanque_criogenico', 1.6);
    this.solido(NAVE.x + 235, NAVE.y - 80, 'tanque_criogenico', 1.6);
    this.rover = new Actor(this, ROVER.x, ROVER.y, 'estado_rover_polvo', { escala: 1.7, dir: 1 }).pausar();
    this.sombras.set(this.rover, sombra(this, 70));
    this.yo = new Actor(this, INICIO.x, INICIO.y, this.eva('camina'), { escala: 1.6, dir: 6 }).pausar();
    this.sombras.set(this.yo, sombra(this, 44));
    this.crearRemolinos();

    // tormenta: oscuridad rojiza que se cierra, polvo que cruza la pantalla y pasos que levantan polvo
    this.noche = new Oscuridad(this, 0x2a0b03, 0).profundidad(8000);   // debajo de la interfaz (9000+) y de las tarjetas (10000)
    this.polvo = polvoPasos(this);
    if (!this.textures.exists('marte-raya')) this.make.graphics({}, false).fillStyle(0xffffff).fillRect(0, 0, 14, 2).generateTexture('marte-raya', 24, 3).destroy();
    this.viento = this.add.particles(0, 0, 'marte-raya', {
      x: { min: -40, max: 0 }, y: { min: 0, max: H }, speedX: { min: 520, max: 900 }, speedY: { min: -30, max: 60 },
      lifespan: 1700, quantity: 3, frequency: 22, alpha: { start: 0.75, end: 0 }, tint: [0xd9884a, 0xb0582a, 0xf0b070], emitting: false,
    }).setScrollFactor(0).setDepth(8200);
    this.bruma = this.add.rectangle(W / 2, H / 2, W, H, 0xc0602a, 0).setScrollFactor(0).setDepth(8150);   // el aire se vuelve rojo
    vineta(this, 0.55, 8300);

    // interfaz
    this.lista = new ListaHolo(this, 14, 70, 'RESCATE', ['Llegar al Rover', 'Limpiar sus paneles', 'Volver a la nave'], 220);
    this.lista.cont.setDepth(9000);
    this.cinta = cintillo(this, 'Base Tari, Marte. Tanques reabastecidos con hielo marciano.', 'ico_combustible');
    this.cinta.setDepth(9000);
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(9000);
    this.hudTxt = this.add.text(30, H - 64, '', { fontFamily: FUENTE_PIXEL, fontSize: '9px', color: '#ffd2a8' }).setScrollFactor(0).setDepth(9001);
    this.aro = this.add.graphics().setDepth(8100);
    this.flecha = this.add.triangle(0, 0, 0, -12, 24, 0, 0, 12, 0xffe14d).setScrollFactor(0).setDepth(9000).setVisible(false);
    const usar = this.usarBtn = boton(this, W - 90, H - 70, 'USAR', () => undefined, { ancho: 130, alto: 64, color: 0x3ff3ff });
    usar.setScrollFactor(0, 0, true).setDepth(9001);
    usar.on('pointerdown', () => { this.usando = true; });
    this.input.on('pointerup', () => { this.usando = false; });

    const kb = this.input.keyboard!;
    this.cursor = kb.createCursorKeys();
    this.teclas = kb.addKeys('W,A,S,D,E,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.cameras.main.startFollow(this.yo, true, 0.1, 0.1);

    instalarPausa(this);
    tarjetaMision(this, 5, 'Tormenta en Base Tari',
      'Base Tari, Marte. Los tanques están llenos, pero se acerca una tormenta de óxido. Cuando estalle, corre hasta el Rover, limpia sus paneles con la llave de torque y vuelve con él a la nave antes de quedar sepultados.',
      ['capsula_colibri', 'estado_rover_polvo', 'llave_torque', 'tanque_criogenico'], () => this.empezar());
  }

  // ───────── mundo ─────────
  private suelo(): void {
    piso(this, 'suelo_marte', 0, 0, MW, MH, undefined, 1, 0xe0b090).setDepth(-20);
    let s = 31;
    const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) | 0) >>> 0) / 4294967296;
    // dunas: franjas más claras que siguen el viento
    const g = this.add.graphics().setDepth(-12);
    for (let i = 0; i < 30; i++) { const x = r() * MW, y = r() * MH; g.fillStyle(0xf0b47a, 0.08).fillEllipse(x, y, 220 + r() * 200, 26 + r() * 20); }
    // rocas con cuerpo (no tapan el camino directo entre la nave y el Rover)
    for (let i = 0, puestas = 0; i < 80 && puestas < 22; i++) {
      const x = 80 + r() * (MW - 160), y = 120 + r() * (MH - 200);
      const lejos = (p: { x: number; y: number }, d: number) => Math.hypot(x - p.x, y - p.y) > d;
      if (!lejos(NAVE, 330) || !lejos(ROVER, 200) || !lejos(INICIO, 140)) continue;
      // distancia al segmento nave → rover: se deja un pasillo libre
      const ax = ROVER.x - NAVE.x, ay = ROVER.y - NAVE.y, k = Phaser.Math.Clamp(((x - NAVE.x) * ax + (y - NAVE.y) * ay) / (ax * ax + ay * ay), 0, 1);
      if (Math.hypot(x - (NAVE.x + ax * k), y - (NAVE.y + ay * k)) < 110) continue;
      this.solido(x, y, 'rocas_marte', 0.9 + r() * 0.7, Math.floor(r() * 8), 0xe0b090); puestas++;
    }
  }

  private solido(x: number, y: number, id: string, escala: number, dir = 1, tinte = 0xffffff): Actor {
    const a = new Actor(this, x, y, id, { escala, dir }).setDepth(y);
    a.base.setTint(tinte);
    this.solidos.push(...cuerposDe(a));
    return a;
  }

  private crearRemolinos(): void {
    if (!this.textures.exists('marte-grano')) this.make.graphics({}, false).fillStyle(0xffffff).fillCircle(3, 3, 3).generateTexture('marte-grano', 6, 6).destroy();
    for (const [x0, y0, x1, y1, ms] of REMOLINOS) {
      const cont = this.add.container(x0, y0).setDepth(y0 + 40).setAlpha(0);
      const base = this.add.ellipse(0, 0, 110, 36, 0x8a3a18, 0.35);
      const p = this.add.particles(0, 0, 'marte-grano', {
        emitZone: { type: 'random', source: new Phaser.Geom.Ellipse(0, 0, 90, 30) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        speedY: { min: -140, max: -60 }, speedX: { min: -40, max: 40 }, lifespan: 900, frequency: 25, quantity: 2,
        scale: { start: 1.6, end: 0.3 }, alpha: { start: 0.8, end: 0 }, tint: [0xc0602a, 0xe09050, 0x8a3a18],
      });
      cont.add([base, p]);
      const r = { cont, x: x0, y: y0 };
      this.tweens.add({ targets: r, x: x1, y: y1, duration: segun(ms * 1.25, ms), yoyo: true, repeat: -1, ease: 'Sine.inOut', onUpdate: () => cont.setPosition(r.x, r.y).setDepth(r.y + 40) });
      this.tweens.add({ targets: base, scaleX: 1.2, duration: 300, yoyo: true, repeat: -1 });
      this.remolinos.push(r);
    }
  }

  // ───────── fases ─────────
  private empezar(): void {
    Musica.desde(0);   // 0:00 de TIC TAC ROVER: la calma dura 11 s
    this.fase = 'calma'; this.reloj = 0;
    // la cámara recorre la base hasta el Rover y vuelve (así se sabe a dónde ir)
    this.cameras.main.stopFollow();
    this.cameras.main.pan(ROVER.x, ROVER.y, 4200, 'Sine.easeInOut');
    this.time.delayedCall(2200, () => { this.cinta.texto?.setText(tr('El Rover explora el valle. Listos para el salto hacia Júpiter…')); });
    this.time.delayedCall(5600, () => this.cameras.main.pan(this.yo.x, this.yo.y, 3800, 'Sine.easeInOut'));
    this.time.delayedCall(9600, () => this.cameras.main.startFollow(this.yo, true, 0.1, 0.1));
  }

  private estallaTormenta(): void {
    this.fase = 'tormenta'; this.tormenta = 0;
    Sonido.alarma();
    this.cameras.main.shake(900, 0.006);
    this.viento.start();
    this.remolinos.forEach(r => this.tweens.add({ targets: r.cont, alpha: 1, duration: 1200 }));
    this.tweens.add({ targets: this.noche, alfa: 0.82, duration: 6000 });
    this.tweens.add({ targets: this.bruma, fillAlpha: 0.22, duration: 6000 });
    aviso(this, '¡Alerta de tormenta de óxido! ¡El oxígeno en Uyuni cae al 18 %!', CSS.rojo, 110);
    this.time.delayedCall(3000, () => aviso(this, '¡Recupera al Rover y vuelve a la nave antes de quedar sepultados!', CSS.amarillo, 110));
    this.lista.actual(0);
    this.cinta.texto?.setText(tr('Corre hasta el Rover: sigue la flecha'));
  }

  private escapar(): void {
    this.fase = 'escape';
    this.lista.marcar(2);
    Sonido.bien();
    this.flecha.setVisible(false);
    this.tweens.add({ targets: [this.usarBtn, this.hud, this.hudTxt, this.lista.cont], alpha: 0, duration: 500 });
    this.cinta.texto?.setText(tr('¡Ignición de escape! ¡Abandonando la superficie bajo tormenta crítica!'));
    this.cameras.main.stopFollow();
    this.cameras.main.pan(NAVE.x, NAVE.y - 120, 900, 'Sine.easeInOut');
    // la tripulación sube a bordo
    this.tweens.add({ targets: [this.yo, this.rover], x: NAVE.x, y: NAVE.y + 10, alpha: 0, duration: 900 });
    this.sombras.forEach(s => this.tweens.add({ targets: s, alpha: 0, duration: 600 }));
    this.time.delayedCall(1300, () => {
      Sonido.motor(4);
      this.cameras.main.shake(3200, 0.012);
      const fuego = this.add.particles(NAVE.x, NAVE.y + 20, 'marte-grano', {
        speedY: { min: 120, max: 320 }, speedX: { min: -90, max: 90 }, lifespan: 700, quantity: 6, frequency: 16,
        scale: { start: 2.6, end: 0.4 }, alpha: { start: 1, end: 0 }, tint: [0xfff2c0, 0xffb04d, 0xff6b2c], blendMode: Phaser.BlendModes.ADD,
      }).setDepth(NAVE.y + 5);
      this.tweens.add({ targets: this.nave, y: NAVE.y - 900, duration: 4200, ease: 'Cubic.in', onUpdate: () => fuego.setPosition(this.nave.x, this.nave.y + 20) });
      this.cameras.main.pan(NAVE.x, NAVE.y - 520, 4200, 'Cubic.easeIn');
    });
    // 1:05–1:14: tonos oscuros, Marte queda atrás
    this.time.delayedCall(5600, () => {
      this.cinta.texto?.setText(tr('Marte queda atrás. Próximo destino: el cinturón de radiación de Júpiter.'));
      // la cámara sube hacia el cielo y todo se oscurece (sin zoom: las capas de pantalla no deben encogerse)
      this.cameras.main.pan(NAVE.x, 80, 3200, 'Sine.easeInOut');
      this.tweens.add({ targets: this.bruma, fillAlpha: 0.05, duration: 3000 });
      this.tweens.add({ targets: this.noche, alfa: 0.94, duration: 3000 });
      this.viento.stop();
    });
    this.time.delayedCall(9200, () => this.resultado());
  }

  private resultado(): void {
    lograr('marte');
    const usado = Math.round(this.tormenta);
    const estrellas = !this.reserva && usado <= TORMENTA * 0.8 && this.golpes <= 1 ? 3 : !this.reserva ? 2 : 1;
    const mejor = ganarEstrellas('marte', estrellas);
    tarjetaResultado(this, '¡Rescate en Base Tari!', [
      tr('Tormenta superada en {s} s · Remolinos: {g}', { s: usado, g: this.golpes }),
      'El polvo marciano tapa los paneles: sin luz no hay energía.',
      'Por eso en Europa el Rover usará otra fuente de energía.',
    ], () => siguiente(this), { estrellas, mejor, nota: tr('Llega en menos de {s} s y esquiva los remolinos para las 3 estrellas.', { s: Math.round(TORMENTA * 0.8) }) });
  }

  // ───────── bucle ─────────
  update(_: number, dtms: number): void {
    const dt = Math.min(0.05, dtms / 1000);
    this.pintarLuz();
    for (const [a, s] of this.sombras) s.setPosition(a.x, a.y);
    this.yo.setDepth(this.yo.y); this.rover.setDepth(this.rover.y);
    if (this.fase === 'espera' || this.fase === 'escape') return;
    this.reloj += dt;
    if (this.fase === 'calma') { if (this.reloj >= CALMA) this.estallaTormenta(); return; }

    // ── tormenta ──
    this.tormenta += dt;
    this.enfriar = Math.max(0, this.enfriar - dt);
    if (!this.reserva && this.tormenta >= TORMENTA) {
      this.reserva = true;
      Sonido.alarma();
      aviso(this, '¡Reserva de oxígeno! Vuelve a la nave ya.', CSS.rojo, 110);
    }
    this.mover(dt);
    this.chocarRemolinos();
    this.reparar(dt);
    this.seguirRover(dt);
    if (this.reparado && Math.hypot(this.yo.x - NAVE.x, this.yo.y - NAVE.y) < 210) {
      if (Math.hypot(this.rover.x - NAVE.x, this.rover.y - NAVE.y) < 320) { this.escapar(); return; }
      else if (this.enfriar <= 0) { aviso(this, 'Espera al Rover: no se puede despegar sin él.', CSS.amarillo, 110); this.enfriar = 2; }
    }
    this.apuntarFlecha();
    this.pintarHud();
  }

  private mover(dt: number): void {
    let dx = 0, dy = 0;
    const k = this.teclas, c = this.cursor;
    if (c.left.isDown || k.A.isDown) dx -= 1;
    if (c.right.isDown || k.D.isDown) dx += 1;
    if (c.up.isDown || k.W.isDown) dy -= 1;
    if (c.down.isDown || k.S.isDown) dy += 1;
    const p = this.input.activePointer;
    if (!dx && !dy && p.isDown && !this.usando && !(p.x > W - 170 && p.y > H - 120)) {
      const wx = p.worldX - this.yo.x, wy = p.worldY - this.yo.y;
      if (Math.hypot(wx, wy) > 24) { dx = wx; dy = wy; }
    }
    const reparando = this.usandoAhora() && !this.reparado && this.cercaRover();
    let nx = this.yo.x, ny = this.yo.y;
    if ((dx || dy) && !reparando) {
      const n = Math.hypot(dx, dy);
      nx += (dx / n) * VEL * dt; ny += (dy / n) * VEL * dt;
      this.yo.mirarHacia(dx, dy).seguir();
      if (this.time.now - this.ultimoPaso > 140) { this.ultimoPaso = this.time.now; this.polvo.emitParticleAt(this.yo.x, this.yo.y, 2); }
    } else this.yo.pausar();
    // ráfagas de viento: empujan hacia el este (ayudan a ir, frenan al volver)
    const rafaga = (0.75 + Math.sin(this.reloj * 0.8) * 0.45) * segun(38, 55);
    nx += rafaga * dt;
    for (const s of this.solidos) { const e = empujar(s, nx, ny, 14); if (e) { nx = e.x; ny = e.y; } }
    this.yo.setPosition(Phaser.Math.Clamp(nx, 40, MW - 40), Phaser.Math.Clamp(ny, 60, MH - 30));
  }

  private usandoAhora(): boolean { return this.usando || this.teclas.E.isDown || this.teclas.SPACE.isDown; }
  private cercaRover(): boolean { return Math.hypot(this.yo.x - this.rover.x, this.yo.y - this.rover.y) < 110; }

  private reparar(dt: number): void {
    this.aro.clear();
    if (this.reparado) return;
    const cerca = this.cercaRover();
    if (cerca && this.lista) this.lista.marcar(0);
    if (cerca) {
      this.lista.actual(1);
      this.cinta.texto?.setText(tr('Mantén USAR para limpiar los paneles con la llave de torque'));
    }
    if (cerca && this.usandoAhora()) {
      if (this.yo.id !== this.eva('repara')) this.cambiarYo(this.eva('repara'));
      this.progreso = Math.min(1, this.progreso + dt / segun(3, 4.2));
      if (Math.random() < dt * 6) destello(this, this.rover.x + (Math.random() - 0.5) * 60, this.rover.y - 30 - Math.random() * 30, 0xffd27a);
      if (this.progreso >= 1) {
        this.reparado = true;
        Sonido.bien();
        this.lista.marcar(1); this.lista.actual(2);
        const r = new Actor(this, this.rover.x, this.rover.y, 'rover_explorador', { escala: 1.7, dir: this.rover.dir });
        this.sombras.set(r, this.sombras.get(this.rover)!); this.sombras.delete(this.rover);
        this.rover.destroy(); this.rover = r;
        flotante(this, r.x, r.y - 70, tr('ENERGÍA 100 %'), CSS.verde);
        aviso(this, '¡Paneles limpios! El Rover te sigue: vuelvan a la nave.', CSS.verde, 110);
        this.cinta.texto?.setText(tr('Vuelve a la nave con el Rover'));
        this.cambiarYo(this.eva('camina'));
      }
    } else if (this.yo.id === this.eva('repara')) this.cambiarYo(this.eva('camina'));
    if (cerca || this.progreso > 0) {
      const x = this.rover.x, y = this.rover.y - 96;
      this.aro.lineStyle(6, 0x1b2740, 1).strokeCircle(x, y, 20);
      this.aro.lineStyle(6, 0xffd27a, 1).beginPath().arc(x, y, 20, -Math.PI / 2, -Math.PI / 2 + this.progreso * Math.PI * 2).strokePath();
    }
  }

  private cambiarYo(id: string): void {
    const n = new Actor(this, this.yo.x, this.yo.y, id, { escala: 1.6, dir: this.yo.dir });
    this.sombras.set(n, this.sombras.get(this.yo)!); this.sombras.delete(this.yo);
    this.cameras.main.startFollow(n, true, 0.1, 0.1);
    this.yo.destroy(); this.yo = n;
  }

  private seguirRover(dt: number): void {
    if (!this.reparado) return;
    const tx = this.yo.x + 70, ty = this.yo.y + 30, dx = tx - this.rover.x, dy = ty - this.rover.y, d = Math.hypot(dx, dy);
    if (d > 30) {
      const v = Math.min(d * 2.2, VEL * 1.05) * dt;
      let nx = this.rover.x + (dx / d) * v, ny = this.rover.y + (dy / d) * v;
      for (const s of this.solidos) { const e = empujar(s, nx, ny, 20); if (e) { nx = e.x; ny = e.y; } }
      this.rover.setPosition(nx, ny).mirarHacia(dx, dy).seguir();
    } else this.rover.pausar();
  }

  private chocarRemolinos(): void {
    if (this.enfriar > 0) return;
    for (const r of this.remolinos) {
      const dx = this.yo.x - r.x, dy = (this.yo.y - r.y) * 1.6, d = Math.hypot(dx, dy);
      if (d > 70) continue;
      this.golpes++; this.enfriar = 1.6;
      Sonido.mal();
      this.cameras.main.shake(300, 0.008);
      const n = d || 1, ex = this.yo.x + (dx / n) * 150, ey = this.yo.y + (dy / n) * 90;
      this.tweens.add({ targets: this.yo, x: Phaser.Math.Clamp(ex, 40, MW - 40), y: Phaser.Math.Clamp(ey, 60, MH - 30), duration: 380, ease: 'Cubic.out' });
      if (!this.reparado) this.progreso = Math.max(0, this.progreso - 0.35);
      aviso(this, '¡Remolino de polvo! Te empujó lejos.', CSS.rojo, 110);
      return;
    }
  }

  // ───────── luz, flecha y hud ─────────
  private pintarLuz(): void {
    if (this.noche.alfa <= 0.01) { this.noche.pintar([]); return; }
    const k = Phaser.Math.Clamp(this.tormenta / TORMENTA, 0, 1), r = this.reserva ? 110 : 210 - k * 70;
    const f: [number, number, number][] = [[this.yo.x, this.yo.y - 30, r], [NAVE.x, NAVE.y - 40, 170]];
    if (this.reparado) f.push([this.rover.x, this.rover.y - 20, 110]);
    else f.push([this.rover.x, this.rover.y - 20, 60 + Math.sin(this.time.now / 250) * 12]);   // la luz de emergencia del Rover parpadea
    this.noche.pintar(f);
  }

  private objetivo(): { x: number; y: number } { return this.reparado ? NAVE : this.rover; }

  private apuntarFlecha(): void {
    const o = this.objetivo(), cam = this.cameras.main;
    const sx = o.x - cam.scrollX, sy = o.y - cam.scrollY;
    const dentro = sx > 40 && sx < W - 40 && sy > 40 && sy < H - 60;
    const a = Math.atan2(sy - H / 2, sx - W / 2);
    this.flecha.setVisible(true);
    if (dentro) this.flecha.setPosition(sx, sy - 150).setRotation(Math.PI / 2);
    else this.flecha.setPosition(W / 2 + Math.cos(a) * (W / 2 - 50), H / 2 + Math.sin(a) * (H / 2 - 60)).setRotation(a);
  }

  private pintarHud(): void {
    const g = this.hud.clear(), x = 16, y = H - 82, w = 250;
    const resta = Math.max(0, TORMENTA - this.tormenta), k = resta / TORMENTA;
    g.fillStyle(0x140804, 0.85).fillRoundedRect(x, y, w, 64, 12).lineStyle(2, this.reserva ? 0xff4a3d : 0xff8a3d, 0.75).strokeRoundedRect(x, y, w, 64, 12);
    const col = this.reserva ? 0xff4a3d : k > 0.5 ? 0xffd27a : k > 0.2 ? 0xff8a3d : 0xff4a3d;
    g.fillStyle(0x2a1208, 1).fillRoundedRect(x + 14, y + 36, w - 28, 12, 4).fillStyle(col, 1).fillRoundedRect(x + 14, y + 36, (w - 28) * (this.reserva ? 1 : k), 12, 4);
    this.hudTxt.setPosition(x + 14, y + 12).setText(this.reserva ? tr('RESERVA DE OXÍGENO') : tr('TORMENTA · {s} S PARA VOLVER', { s: Math.ceil(resta) }));
  }
}

