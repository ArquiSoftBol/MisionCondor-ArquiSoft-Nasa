// INTRO · «Transmisión de emergencia» (según «Guion Visual de Introducción — Proyecto Cóndor»).
// Va entre el logo de ARQUISOFT y el menú principal. La imagen se sincroniza con el TIEMPO REAL del audio
// (audio/intro-radio.mp3: voz de 0:03 a 1:02.5 + cierre musical hasta 1:50), así nunca se desfasa.
//   0:00 VHS y «sintonizando»  ·  0:03 la Tierra se congela  ·  0:12 ciudad en ventisca (O₂ 21 % → 8 %)
//   0:27 búnker que se sella  ·  0:39 mapa: caen Cabo Cañaveral y Houston  ·  0:50 zoom a Bolivia, Base Uyuni
//   1:02 corte de radio  ·  1:03 la Ciudadela de noche con aurora, la cámara sube a las estrellas  ·  1:35 título
// Toca, Esc, Enter o Espacio para saltar. Los subtítulos salen en el idioma elegido.
import Phaser from 'phaser';
import { W, H, FUENTE, FUENTE_PIXEL, CSS } from '../config';
import { icono } from '../ui/iconos';
import { Actor, cargar } from '../core/sprites';
import { Musica } from '../core/musica';
import { Sonido } from '../core/audio';
import { t } from '../core/idioma';
import { fondoSalar, HOJAS_ESCENARIO } from '../ui/escenarios';
import { escarcha, fugaces } from '../ui/ambiente';
import { cargarMarca, insigniaSpaceApps, insigniaArquisoft } from '../ui/marca';
import { colorear, grano, aurora, rayos, calidadAlta } from '../ui/cine';
import { destello } from '../ui/taller';
import { CREDITOS_INTRO } from '../data/intro';

const VOZ = [3.0, 12.4, 27.5, 38.9, 50.2, 62.5];   // límites de los 5 bloques de voz (segundos del audio)
const CORTE = 62.5, TITULO = 95, FIN = 108;
const BARRA = 62;   // barras de cine (formato 2.35:1)

/** Locución (para subtítulos), por bloque. Los tiempos de cada frase se reparten según su largo. */
const LOCUCION: string[][] = [
  ['¡Atención! ¡Esto no es un simulacro!', '¡Es una alerta de emergencia para todo el planeta!'],
  ['El aire de la superficie ya no es respirable...', '¡Repito, no salgan al exterior!', 'El nivel de oxígeno acaba de desplomarse al punto de asfixia', 'y las tormentas de escarcha están congelando los continentes.'],
  ['¡Bajen a los refugios subterráneos ahora mismo!', 'Las compuertas de acero de los búnkeres se están sellando en todo el mundo...', 'Quien se quede arriba no sobrevivirá a esta noche.'],
  ['Estamos perdiendo las comunicaciones globales...', 'En Estados Unidos, las bases de la NASA en Cabo Cañaveral y Houston acaban de apagarse bajo el hielo.', 'Ya no hay rescates... ya no hay a dónde ir.'],
  ['En el mapa satelital solo quedan dos penúltimas estaciones de la NASA con energía en toda la Tierra:', 'los radares de Goldstone... y el complejo de gran altitud en Bolivia,', 'sobre la costra de sal del Salar de Uyuni, donde la cordillera de los Andes detuvo la tormenta.', 'Las reservas de aire aquí abajo no durarán para siempre...', 'Que Dios nos ampare a todos.'],
];

// Mapa holográfico de América (lon, lat simplificados)
const NORTE: [number, number][] = [[-165, 65], [-160, 71], [-140, 70], [-120, 74], [-95, 72], [-80, 73], [-65, 62], [-60, 55], [-55, 50], [-65, 45], [-70, 42], [-75, 38], [-76, 35], [-81, 31], [-80, 25], [-82, 26], [-84, 30], [-90, 30], [-97, 27], [-97, 22], [-92, 19], [-88, 21], [-87, 16], [-83, 10], [-79, 9], [-81, 8], [-85, 11], [-92, 14], [-105, 20], [-110, 24], [-112, 30], [-117, 32], [-121, 35], [-124, 40], [-124, 48], [-130, 55], [-140, 60], [-150, 60], [-160, 58], [-165, 62]];
const SUR: [number, number][] = [[-79, 9], [-75, 11], [-70, 12], [-62, 10], [-55, 6], [-50, 1], [-45, -2], [-38, -5], [-35, -8], [-39, -14], [-40, -22], [-48, -26], [-53, -34], [-58, -38], [-63, -42], [-66, -47], [-68, -52], [-71, -54], [-74, -50], [-73, -42], [-72, -33], [-71, -25], [-70, -18], [-76, -14], [-80, -6], [-81, -3], [-80, 1], [-78, 7]];
const ANDES: [number, number][] = [[-78, -1], [-77, -8], [-74, -13], [-70, -17], [-68, -22], [-69, -28], [-70, -34], [-71, -40], [-72, -46]];
const SITIOS = {
  canaveral: { lon: -80.6, lat: 28.4, nombre: 'CABO CAÑAVERAL' },
  houston: { lon: -95.4, lat: 29.8, nombre: 'HOUSTON' },
  goldstone: { lon: -116.8, lat: 35.4, nombre: 'GOLDSTONE' },
  uyuni: { lon: -66.8, lat: -20.1, nombre: 'BASE UYUNI' },
};
const px = (lon: number) => 480 + (lon + 95) * 3.3;
const py = (lat: number) => 262 - (lat - 10) * 3.3;

type Evento = { t: number; fn: () => void; hecho?: boolean };

export class IntroRadio extends Phaser.Scene {
  private eventos: Evento[] = [];
  private reloj = 0;
  private usarAudio = true;
  private plano?: Phaser.GameObjects.Container;
  private sub!: Phaser.GameObjects.Text;
  private credito!: Phaser.GameObjects.Text;
  private ruido!: Phaser.GameObjects.TileSprite;
  private saliendo = false;
  private subs: { de: number; a: number; txt: string }[] = [];
  private subActual = '';
  private mapa?: { c: Phaser.GameObjects.Container; marcas: Record<string, { punto: Phaser.GameObjects.Arc; txt: Phaser.GameObjects.Text }> };

  constructor() { super('IntroRadio'); }

  preload(): void {
    cargarMarca(this);
    cargar(this, [...HOJAS_ESCENARIO, 'sedan', 'camioneta_acero', 'protagonista_m', 'protagonista_f', 'protagonista_x', 'hangar_ensamblaje',
      'torre_ciudad', 'bloque_ciudad', 'farola_nieve', 'marco_bunker', 'compuerta_bunker', 'consola_radio', 'satelite_enjambre',
      'cientifico_mision', 'ingeniero_sistemas', 'tripulante_vuelo']);
  }

  create(): void {
    this.eventos = []; this.reloj = 0; this.usarAudio = true; this.saliendo = false; this.plano = undefined; this.mapa = undefined; this.subActual = '';
    this.cameras.main.setBackgroundColor('#000').fadeIn(400);
    Musica.poner('intro-radio', false);
    this.texturas();

    // capas fijas: ruido VHS, líneas de monitor, subtítulos, créditos, «saltar»
    this.ruido = this.add.tileSprite(W / 2, H / 2, W, H, 'intro-ruido').setDepth(900).setAlpha(0.5).setBlendMode(Phaser.BlendModes.SCREEN);
    this.add.tileSprite(W / 2, H / 2, W, H, 'intro-lineas').setDepth(901).setAlpha(0.22);
    grano(this, 902, 0.08);
    // barras de cine: entran al empezar y enmarcan todo como una película
    const arriba = this.add.rectangle(W / 2, 0, W, BARRA, 0x000000).setOrigin(0.5, 0).setDepth(920).setScale(1, 0);
    const abajo = this.add.rectangle(W / 2, H, W, BARRA, 0x000000).setOrigin(0.5, 1).setDepth(920).setScale(1, 0);
    this.tweens.add({ targets: [arriba, abajo], scaleY: 1, duration: 1400, ease: 'Cubic.out', delay: 200 });
    this.sub = this.add.text(W / 2, H - BARRA / 2, '', { fontFamily: FUENTE, fontSize: '17px', fontStyle: 'italic 700', color: '#ffffff', align: 'center', wordWrap: { width: 860 }, lineSpacing: 2 }).setOrigin(0.5).setDepth(950);
    this.credito = this.add.text(W / 2, BARRA / 2, '', { fontFamily: FUENTE, fontSize: '12px', fontStyle: 'italic 600', color: '#9fdcff', letterSpacing: 2 }).setOrigin(0.5).setDepth(950).setAlpha(0);
    const saltar = this.add.text(W - 16, BARRA / 2, t('Toca para saltar ▸▸'), { fontFamily: FUENTE_PIXEL, fontSize: '9px', color: '#ffffff' }).setOrigin(1, 0.5).setDepth(960).setAlpha(0);
    this.tweens.add({ targets: saltar, alpha: 0.55, duration: 600, delay: 1500 });
    this.input.on('pointerdown', () => this.salir());
    ['keydown-ESC', 'keydown-ENTER', 'keydown-SPACE'].forEach(k => this.input.keyboard?.on(k, () => this.salir()));

    this.armarSubtitulos();
    this.programar();
    this.planoSintonia();
    // ?desde=40 (pruebas): empieza en ese segundo, con el reloj propio
    const desde = Number(new URLSearchParams(location.search).get('desde'));
    if (desde > 0) { this.reloj = desde; this.usarAudio = false; }
  }

  // ───────── reloj sincronizado con el audio ─────────
  private ahora(): number {
    const a = Musica.sonando === 'intro-radio' ? Musica.tiempo : 0;
    if (this.reloj > 1.2 && a === 0) this.usarAudio = false;   // audio bloqueado: seguimos con el reloj
    return this.usarAudio && a > 0 ? a : this.reloj;
  }

  update(_: number, dtms: number): void {
    this.reloj += dtms / 1000;
    const tt = this.ahora();
    for (const e of this.eventos) if (!e.hecho && tt >= e.t) { e.hecho = true; e.fn(); }
    // subtítulos
    const s = this.subs.find(x => tt >= x.de && tt < x.a);
    const txt = s ? s.txt : '';
    if (txt !== this.subActual) { this.subActual = txt; this.sub.setText(txt ? t(txt) : ''); if (txt) { this.sub.setAlpha(0); this.tweens.add({ targets: this.sub, alpha: 1, duration: 200 }); } }
    // ruido VHS que se mueve
    this.ruido.tilePositionX = Math.random() * 200; this.ruido.tilePositionY = Math.random() * 200;
    if (!this.saliendo && (tt >= FIN + 2 || (this.usarAudio && Musica.terminada))) this.salir();
  }

  private en(seg: number, fn: () => void): void { this.eventos.push({ t: seg, fn }); }

  private armarSubtitulos(): void {
    this.subs = [];
    LOCUCION.forEach((frases, b) => {
      const de = VOZ[b], a = VOZ[b + 1], total = frases.reduce((n, f) => n + f.length, 0);
      let x = de;
      frases.forEach(f => { const d = (a - de) * f.length / total; this.subs.push({ de: x, a: x + d - 0.05, txt: f }); x += d; });
    });
  }

  private programar(): void {
    this.en(VOZ[0], () => { this.estatica(); this.planoTierra(); });
    this.en(VOZ[0] + 2.5, () => this.creditar(CREDITOS_INTRO.produccion));
    this.en(VOZ[1], () => { this.estatica(); this.planoCiudad(); });
    this.en(VOZ[1] + 2.5, () => this.creditar(CREDITOS_INTRO.historia));
    this.en(VOZ[2], () => { this.estatica(); this.planoBunker(); });
    this.en(VOZ[2] + 2.5, () => this.creditar(CREDITOS_INTRO.musica));
    this.en(VOZ[3], () => { this.estatica(); this.planoMapa(); });
    this.en(VOZ[3] + 4.0, () => this.apagarBase('houston'));
    this.en(VOZ[3] + 4.8, () => this.apagarBase('canaveral'));
    this.en(VOZ[4], () => this.zoomBolivia());
    this.en(CORTE, () => { this.corteRadio(); this.planoCiudadela(); });
    this.en(TITULO, () => this.titulo());
  }

  // ───────── recursos generados ─────────
  private texturas(): void {
    if (!this.textures.exists('intro-ruido')) {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d')!, img = x.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = Math.random() < 0.5 ? 60 : 0; }
      x.putImageData(img, 0, 0);
      this.textures.addCanvas('intro-ruido', c);
    }
    if (!this.textures.exists('intro-lineas')) this.make.graphics({}, false).fillStyle(0x000000, 0.6).fillRect(0, 0, 4, 2).generateTexture('intro-lineas', 4, 4).destroy();
    if (!this.textures.exists('amb-punto')) this.make.graphics({}, false).fillStyle(0xffffff).fillRect(0, 0, 2, 2).generateTexture('amb-punto', 2, 2).destroy();
  }

  /** Cambia de plano: el anterior se destruye (deteniendo sus animaciones). */
  private nuevoPlano(): Phaser.GameObjects.Container {
    const viejo = this.plano;
    if (viejo) {
      const matar = (o: Phaser.GameObjects.GameObject) => { this.tweens.killTweensOf(o); if (o instanceof Phaser.GameObjects.Container) o.list.forEach(matar); };
      matar(viejo); viejo.destroy();
    }
    this.plano = this.add.container(0, 0).setDepth(0);
    return this.plano;
  }

  /** Ráfaga de estática entre planos (como un televisor que pierde señal). */
  private estatica(): void {
    this.ruido.setAlpha(0.95);
    this.tweens.add({ targets: this.ruido, alpha: 0.14, duration: 450 });
    Sonido.golpe();
  }

  private creditar(txt: string): void {
    this.credito.setText(t(txt)).setAlpha(0);
    this.tweens.add({ targets: this.credito, alpha: 0.9, duration: 600, hold: 4200, yoyo: true });
  }

  /** Cintillo rojo de alerta arriba. */
  private alerta(c: Phaser.GameObjects.Container, txt: string): void {
    const fondo = this.add.rectangle(W / 2, BARRA + 18, W, 30, 0xb3121e, 0.92);
    const tx = this.add.text(W / 2, BARRA + 18, t(txt), { fontFamily: FUENTE_PIXEL, fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
    const i1 = icono(this, W / 2 - tx.width / 2 - 22, BARRA + 18, 'ico_alerta', 22), i2 = icono(this, W / 2 + tx.width / 2 + 22, BARRA + 18, 'ico_alerta', 22);
    c.add([fondo, tx, i1, i2]);
    this.tweens.add({ targets: [fondo, tx], alpha: 0.55, duration: 380, yoyo: true, repeat: -1 });
  }

  private cielo(c: Phaser.GameObjects.Container, arriba: number, abajo: number): void {
    const g = this.add.graphics();
    g.fillGradientStyle(arriba, arriba, abajo, abajo, 1).fillRect(0, 0, W, H);
    c.add(g);
  }

  private estrellas(c: Phaser.GameObjects.Container, n: number, alto = H, y0 = 0): void {
    const g = this.add.graphics();
    for (let i = 0; i < n; i++) g.fillStyle(0xffffff, 0.3 + (i % 5) * 0.14).fillRect((i * 137) % W, y0 + ((i * 89) % alto), 1 + (i % 11 === 0 ? 1 : 0), 1);
    c.add(g);
  }

  // ───────── ayudantes de cine ─────────
  /** Capa de profundidad: z = 0 (fondo, lejos) … 1 (primer plano). Se desplaza más cuanto más cerca está. */
  private capaZ(c: Phaser.GameObjects.Container, z: number, travelling: number, ms: number, desenfoque = false): Phaser.GameObjects.Container {
    const capa = this.add.container(0, 0);
    c.add(capa);
    this.tweens.add({ targets: capa, x: -travelling * (0.25 + z), duration: ms, ease: 'Sine.inOut' });
    if (desenfoque && calidadAlta() && this.game.renderer.type === Phaser.WEBGL) capa.postFX?.addBlur(0, 1.2, 1.2, 0.8);   // profundidad de campo
    return capa;
  }

  /** Sprite 2.5D tintado (para siluetas lejanas o luz de color). */
  private spr(capa: Phaser.GameObjects.Container, id: string, x: number, y: number, esc: number, dir = 1, tinte?: number): Actor {
    const a = new Actor(this, x, y, id, { escala: esc, dir });
    if (tinte !== undefined) a.base.setTint(tinte);
    capa.add(a);
    return a;
  }

  // ───────── 0:00 · sintonía ─────────
  private planoSintonia(): void {
    const c = this.nuevoPlano();
    colorear(this, 'calido');
    this.cielo(c, 0x0a0806, 0x1a120a);
    // plano detalle: la radio de emergencia sobre la mesa, con una lámpara cálida
    c.add(rayos(this, 250, 120, 0xffc87a, 520, 9, 0.05));
    const mesa = this.add.rectangle(W / 2, 430, W + 40, 120, 0x2a1d12).setStrokeStyle(2, 0x3d2a18);
    c.add(mesa);
    const radio = this.spr(c, 'consola_radio', W / 2 - 40, 420, 3.2, 1);
    radio.setScale(3.6);
    this.tweens.add({ targets: radio, scale: 3.2, duration: 3200, ease: 'Sine.out' });
    const aire = this.add.text(W / 2 + 230, 150, t('AL AIRE'), { fontFamily: FUENTE_PIXEL, fontSize: '16px', color: '#ff3a2a', backgroundColor: '#1a0606', padding: { x: 10, y: 6 } }).setOrigin(0.5);
    const evento = insigniaSpaceApps(this, W / 2 + 230, 214, 52).setAlpha(0);
    const equipo = insigniaArquisoft(this, W / 2 + 230, 282, 34).setAlpha(0);
    const sint = this.add.text(30, H - BARRA - 26, t('SINTONIZANDO FRECUENCIA DE EMERGENCIA...'), { fontFamily: FUENTE_PIXEL, fontSize: '10px', color: '#ff4a3d' });
    c.add([aire, evento, equipo, sint]);
    this.tweens.add({ targets: [evento, equipo], alpha: 1, duration: 600, delay: 400 });
    this.tweens.add({ targets: [sint, aire], alpha: 0.2, duration: 300, yoyo: true, repeat: -1 });
    this.ruido.setAlpha(0.7);
  }

  // ───────── 0:03 · la Tierra se congela ─────────
  private planoTierra(): void {
    const c = this.nuevoPlano();
    this.cielo(c, 0x01020a, 0x050a1c);
    this.estrellas(c, 240);
    const escena = this.add.container(W / 2, H / 2 + 10);
    c.add(escena);
    const ESC = 4.2, R = 35 * ESC;          // el planeta ocupa 35 px de radio en su cuadro de 96
    const tierra = new Actor(this, 0, 0, 'tierra', { escala: ESC, dir: 1 });
    escena.add(tierra);
    // halo atmosférico
    escena.addAt(this.add.circle(0, 0, R + 10, 0x5fa8ff, 0.18).setBlendMode(Phaser.BlendModes.ADD), 0);
    // casquetes de hielo (recortes exactos del círculo) que avanzan desde los polos, y bandas de nubes grises
    const hielo = this.add.graphics();
    escena.add(hielo);
    const casquete = (lim: number, arriba: boolean) => {
      const pts: Phaser.Math.Vector2[] = [];
      for (let a = 0; a <= 360; a += 4) {
        const r = Phaser.Math.DegToRad(a), x = Math.cos(r) * R, y = Math.sin(r) * R;
        if (arriba ? y < lim : y > lim) pts.push(new Phaser.Math.Vector2(x, y));
      }
      if (pts.length > 2) hielo.fillPoints(pts, true);
    };
    const avance = { k: 0 };
    this.tweens.add({
      targets: avance, k: 1, duration: 9000, ease: 'Sine.in',
      onUpdate: () => {
        hielo.clear().fillStyle(0xeef8ff, 0.92);
        casquete(-R + 18 + avance.k * R * 0.75, true);
        casquete(R - 16 - avance.k * R * 0.7, false);
        for (let i = 0; i < 5; i++) {   // nubes: franjas dentro del disco que se desplazan
          const y = -R * 0.55 + i * R * 0.27, ancho = 2 * Math.sqrt(Math.max(0, R * R - y * y)) * 0.42;
          const x = Math.sin(i * 1.7 + avance.k * 5) * (R * 0.35);
          hielo.fillStyle(0x8f9bb0, 0.35 + avance.k * 0.3).fillEllipse(x, y, ancho, 16);
        }
      },
    });
    this.tweens.add({ targets: escena, scale: { from: 0.92, to: 1.12 }, duration: 9500, ease: 'Sine.inOut' });
    colorear(this, 'espacio');
    // el Sol fuera de cuadro: destello y halo (lens flare)
    c.addAt(rayos(this, 70, BARRA + 110, 0xfff2c0, 620, 12, 0.03), 2);
    const sol = this.add.circle(70, BARRA + 110, 34, 0xfff6d8, 0.95).setBlendMode(Phaser.BlendModes.ADD);
    const halo = this.add.circle(70, BARRA + 110, 90, 0xffd27a, 0.18).setBlendMode(Phaser.BlendModes.ADD);
    [[0.35, 14, 0x9fdcff], [0.55, 8, 0xffb36b], [0.8, 22, 0x5fa8ff]].forEach(([k, r, col]) => c.add(this.add.circle(70 + (W / 2 - 70) * k * 1.6, BARRA + 110 + (H / 2 - BARRA - 40) * k * 1.6, r, col, 0.16).setBlendMode(Phaser.BlendModes.ADD)));
    c.add([halo, sol]);
    this.tweens.add({ targets: halo, scale: 1.15, alpha: 0.1, duration: 1800, yoyo: true, repeat: -1 });
    const sat = this.spr(c, 'satelite_enjambre', -60, BARRA + 70, 1.2, 2);
    this.tweens.add({ targets: sat, x: W + 80, y: BARRA + 120, duration: 9500 });
    this.alerta(c, 'ALERTA ROJA GLOBAL');
  }

  // ───────── 0:12 · ciudad bajo ventisca ─────────
  private planoCiudad(): void {
    const c = this.nuevoPlano();
    colorear(this, 'frio');
    this.cielo(c, 0x141b2c, 0x3e4a62);
    const DUR = 15500, TRAV = 220;
    // fondo (desenfocado): skyline lejano en silueta
    const lejos = this.capaZ(c, 0, TRAV, DUR, true);
    for (let i = 0; i < 12; i++) this.spr(lejos, i % 2 ? 'torre_ciudad' : 'bloque_ciudad', -40 + i * 100, 360, i % 2 ? 1.1 : 1.0, (i * 3) % 8, 0x3a4a68);
    // medio: edificios con ventanas que se apagan
    const medio = this.capaZ(c, 0.45, TRAV, DUR);
    const edificios: Actor[] = [];
    for (let i = 0; i < 8; i++) edificios.push(this.spr(medio, i % 3 === 1 ? 'torre_ciudad' : 'bloque_ciudad', 30 + i * 150, 420, i % 3 === 1 ? 1.7 : 1.6, i % 2 ? 1 : 7, 0xb8c4dc));
    medio.add(this.add.rectangle(W / 2 + 200, 470, W + 600, 110, 0xdbe7f3));
    // primer plano: calle nevada, farolas y autos cubiertos
    const cerca = this.capaZ(c, 1, TRAV, DUR);
    [[80, 1], [470, 1], [860, 1], [1250, 1]].forEach(([x]) => this.spr(cerca, 'farola_nieve', x, 456, 2.4, 1));
    [['sedan', 300, 452], ['camioneta_acero', 690, 458], ['sedan', 1080, 455]].forEach(([id, x, y]) => {
      const a = this.spr(cerca, id as string, x as number, y as number, 1.5, 1, 0xa8b8d4); a.pausar();
      cerca.add(this.add.ellipse((x as number) - 6, (y as number) - 34, 80, 16, 0xf4f9ff, 0.9));   // nieve encima
    });
    // las luces de la ciudad se van apagando
    this.time.addEvent({ delay: 900, repeat: 14, callback: () => { const e = Phaser.Utils.Array.GetRandom(edificios); if (e?.active) { e.base.setTint(0x55607a); e.luz?.setAlpha(Math.max(0, (e.luz?.alpha ?? 1) - 0.5)); } } });
    // ventisca: nieve en dos profundidades y rachas de viento
    const nieveLejos = this.add.particles(0, 0, 'amb-punto', { x: { min: 0, max: W + 300 }, y: -10, speedX: { min: -260, max: -160 }, speedY: { min: 60, max: 120 }, lifespan: 5000, quantity: 3, frequency: 30, scale: { min: 0.8, max: 1.4 }, alpha: 0.5 });
    const nieveCerca = this.add.particles(0, 0, 'amb-punto', { x: { min: 0, max: W + 400 }, y: -10, speedX: { min: -620, max: -380 }, speedY: { min: 160, max: 300 }, lifespan: 2200, quantity: calidadAlta() ? 6 : 2, frequency: 25, scale: { min: 2, max: 3.5 }, alpha: { start: 0.95, end: 0.3 } });
    c.add([nieveLejos, nieveCerca]);
    // reflectores de emergencia que barren el cielo y pulso rojo de sirena
    [[180, -12, 18], [760, 12, -16]].forEach(([x, a0, a1], i) => {
      const haz = this.add.graphics({ x, y: 470 }).setBlendMode(Phaser.BlendModes.ADD);
      haz.fillStyle(0xcfe6ff, 0.09).fillTriangle(0, 0, -60, -520, 60, -520).fillStyle(0xffffff, 0.06).fillTriangle(0, 0, -24, -520, 24, -520);
      haz.setAngle(a0);
      c.addAt(haz, 2);
      this.tweens.add({ targets: haz, angle: a1, duration: 3800 + i * 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });
    const sirena = this.add.rectangle(W / 2, H / 2, W, H, 0xff2a2a, 0).setBlendMode(Phaser.BlendModes.ADD);
    c.add(sirena);
    this.tweens.add({ targets: sirena, fillAlpha: 0.08, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // HUD: oxígeno que cae y temperatura
    const caja = this.add.rectangle(W - 184, BARRA + 52, 340, 70, 0x040914, 0.82).setStrokeStyle(2, 0xff4a3d, 0.9);
    const o2 = this.add.text(W - 340, BARRA + 30, '', { fontFamily: FUENTE_PIXEL, fontSize: '13px', color: '#ff8a7a' });
    const temp = this.add.text(W - 340, BARRA + 58, t('TEMP: −65 °C'), { fontFamily: FUENTE_PIXEL, fontSize: '13px', color: '#9fdcff' });
    c.add([caja, o2, temp]);
    const v = { o: 21 };
    this.tweens.add({ targets: v, o: 8, duration: 9000, delay: 1500, ease: 'Cubic.in', onUpdate: () => o2.setText(`${t('OXÍGENO')}: ${Math.round(v.o)} %${v.o < 10 ? `  (${t('LETAL')})` : ''}`) });
    o2.setText(`${t('OXÍGENO')}: 21 %`);
    this.tweens.add({ targets: caja, alpha: 0.5, duration: 420, yoyo: true, repeat: -1 });
  }

  // ───────── 0:27 · el búnker se sella ─────────
  private planoBunker(): void {
    const c = this.nuevoPlano();
    colorear(this, 'fuego');
    this.cielo(c, 0x0a0204, 0x1e050a);
    // túnel en perspectiva: arcos 2.5D repetidos cada vez más chicos hacia el punto de fuga
    const tunel = this.add.container(0, 0);
    c.add(tunel);
    const FUGA = { x: W / 2, y: 250 };
    for (let i = 7; i >= 0; i--) {
      const k = Math.pow(0.72, i), y = FUGA.y + 230 * k;
      const arco = this.spr(tunel, 'marco_bunker', FUGA.x, y, 3.6 * k, 0, i > 3 ? 0x7a3a40 : 0xffffff);
      arco.setAlpha(1 - i * 0.08);
    }
    // piso del túnel con franja guía
    const piso = this.add.graphics();
    piso.fillStyle(0x16080a, 1).fillTriangle(FUGA.x - 18, FUGA.y + 14, FUGA.x + 18, FUGA.y + 14, W + 200, H).fillTriangle(FUGA.x - 18, FUGA.y + 14, -200, H, W + 200, H);
    piso.fillStyle(0xffc21a, 0.7).fillTriangle(FUGA.x - 2, FUGA.y + 14, FUGA.x + 2, FUGA.y + 14, FUGA.x + 30, H).fillTriangle(FUGA.x - 2, FUGA.y + 14, FUGA.x - 30, H, FUGA.x + 30, H);
    tunel.addAt(piso, 0);
    // destellos rojos que barren el túnel
    const barrido = this.add.rectangle(W / 2, H / 2, W, H, 0xff1a1a, 0).setBlendMode(Phaser.BlendModes.ADD);
    c.add(barrido);
    this.tweens.add({ targets: barrido, fillAlpha: 0.14, duration: 500, yoyo: true, repeat: -1 });
    // la gente baja corriendo hacia el refugio
    const ids = ['protagonista_m', 'cientifico_mision', 'protagonista_f', 'ingeniero_sistemas', 'protagonista_x', 'tripulante_vuelo'];
    for (let i = 0; i < 12; i++) {
      const a = this.spr(c, ids[i % ids.length], W / 2 + ((i * 97) % 520) - 260, H + 30 + (i % 3) * 10, 2.2, 4, 0x8a3a40);
      this.tweens.add({ targets: a, x: FUGA.x + ((i * 23) % 50) - 25, y: FUGA.y + 30, scale: 0.3, duration: 6000 + (i % 4) * 600, delay: i * 320, ease: 'Sine.in' });
    }
    this.tweens.add({ targets: tunel, scale: 1.08, x: -W * 0.04, y: -H * 0.04, duration: 11000, ease: 'Sine.inOut' });   // la cámara avanza
    // compuerta blindada que baja frente a la cámara y se sella con chispas
    const puerta = this.spr(c, 'compuerta_bunker', W / 2, -60, 7, 0);
    puerta.pausar();
    c.add(this.add.text(W / 2, BARRA + 110, t('BÚNKER 07 · SELLADO DE EMERGENCIA'), { fontFamily: FUENTE_PIXEL, fontSize: '13px', color: '#ffc21a', backgroundColor: '#1a0606', padding: { x: 8, y: 5 } }).setOrigin(0.5));
    this.tweens.add({
      targets: puerta, y: H - BARRA + 16, duration: 4400, delay: 5400, ease: 'Quad.in',
      onStart: () => Sonido.motor(4.5),
      onComplete: () => { this.cameras.main.shake(600, 0.014); Sonido.golpe(); [-260, -90, 90, 260].forEach(dx => destello(this, W / 2 + dx, H - BARRA - 10, 0xffc21a)); },
    });
  }

  // ───────── 0:39 · mapa satelital ─────────
  private planoMapa(): void {
    const c = this.nuevoPlano();
    colorear(this, 'europa');
    this.cielo(c, 0x020a14, 0x041627);
    const mapa = this.add.container(0, 0);
    c.add(mapa);
    const grid = this.add.graphics().lineStyle(1, 0x1d5a7a, 0.35);
    for (let gx = 0; gx <= W; gx += 40) grid.lineBetween(gx, 0, gx, H);
    for (let gy = 0; gy <= H; gy += 40) grid.lineBetween(0, gy, W, gy);
    mapa.add(grid);
    const tierra = this.add.graphics();
    [NORTE, SUR].forEach(f => {
      const pts = f.map(([lo, la]) => new Phaser.Math.Vector2(px(lo), py(la)));
      tierra.fillStyle(0x0f4a66, 0.55).fillPoints(pts, true).lineStyle(2, 0x3ff3ff, 0.9).strokePoints(pts, true);
    });
    mapa.add(tierra);
    // tormenta: manchas grises que se extienden por Norteamérica
    const tormenta = this.add.graphics();
    mapa.add(tormenta);
    const k = { v: 0 };
    this.tweens.add({ targets: k, v: 1, duration: 11000, onUpdate: () => {
      tormenta.clear();
      for (let i = 0; i < 9; i++) tormenta.fillStyle(0xcfdcec, 0.10 + 0.04 * (i % 3)).fillCircle(px(-130 + i * 8) + Math.sin(i + k.v * 3) * 12, py(62 - i * 3.6), 30 + k.v * 70);
    } });
    const marcas: Record<string, { punto: Phaser.GameObjects.Arc; txt: Phaser.GameObjects.Text }> = {};
    (Object.keys(SITIOS) as (keyof typeof SITIOS)[]).forEach(key => {
      const s = SITIOS[key], x = px(s.lon), y = py(s.lat);
      const punto = this.add.circle(x, y, 5, 0x3ff3ff).setStrokeStyle(2, 0xffffff);
      // posición de cada rótulo para que no se encimen (Houston y Cabo Cañaveral están muy cerca)
      const off = { goldstone: [-10, -12, 1], houston: [-8, 16, 1], canaveral: [10, -12, 0], uyuni: [12, 0, 0] }[key];
      const txt = this.add.text(x + off[0], y + off[1], s.nombre, { fontFamily: FUENTE_PIXEL, fontSize: '8px', color: '#9ffbff' }).setOrigin(off[2], 0.5);
      mapa.add([punto, txt]);
      this.tweens.add({ targets: punto, scale: 1.6, duration: 600, yoyo: true, repeat: -1 });
      marcas[key] = { punto, txt };
    });
    // barrido de radar y rótulo
    const barrido = this.add.rectangle(0, H / 2, 6, H, 0x3ff3ff, 0.25).setBlendMode(Phaser.BlendModes.ADD);
    c.add(barrido);
    this.tweens.add({ targets: barrido, x: W, duration: 2600, repeat: -1 });
    c.add(this.add.text(18, BARRA + 10, t('RED SATELITAL · ESTACIONES NASA'), { fontFamily: FUENTE_PIXEL, fontSize: '10px', color: '#3ff3ff' }));
    this.mapa = { c: mapa, marcas };
  }

  private apagarBase(key: 'houston' | 'canaveral'): void {
    const m = this.mapa?.marcas[key];
    if (!m) return;
    Sonido.mal();
    this.interferencia();
    this.tweens.killTweensOf(m.punto);
    m.punto.setFillStyle(0xff4a3d).setScale(1.4);
    m.txt.setText(`${SITIOS[key].nombre} · ${t('SEÑAL PERDIDA')}`).setColor('#ff8a7a');
    // escarcha digital sobre el punto
    const hielo = this.add.star(m.punto.x, m.punto.y, 6, 4, 16, 0xe8f6ff, 0.8);
    this.mapa!.c.add(hielo);
    hielo.setScale(0); this.tweens.add({ targets: hielo, scale: 1, angle: 60, duration: 700 });
  }

  /** Interferencia: franjas horizontales que saltan y un temblor breve (la señal se corta). */
  private interferencia(): void {
    this.cameras.main.shake(220, 0.006);
    for (let i = 0; i < 6; i++) {
      const y = BARRA + 20 + Math.random() * (H - 2 * BARRA - 40);
      const f = this.add.rectangle(W / 2 + (Math.random() - 0.5) * 80, y, W, 4 + Math.random() * 14, i % 2 ? 0x3ff3ff : 0xff4a3d, 0.35).setDepth(905).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: f, x: f.x + (Math.random() - 0.5) * 120, alpha: 0, duration: 260 + i * 40, onComplete: () => f.destroy() });
    }
  }

  // ───────── 0:50 · zoom a Bolivia ─────────
  private zoomBolivia(): void {
    const m = this.mapa;
    if (!m) return;
    const ux = px(SITIOS.uyuni.lon), uy = py(SITIOS.uyuni.lat);
    // Goldstone resiste (azul que late)
    this.time.delayedCall(4200, () => { const g = m.marcas.goldstone; g.txt.setText(`GOLDSTONE · ${t('ACTIVA')}`); this.tweens.add({ targets: g.punto, scale: 2.4, duration: 300, yoyo: true, repeat: 3 }); });
    // los Andes (muralla) y la tormenta que se detiene contra ellos
    const andes = this.add.graphics();
    const pts = ANDES.map(([lo, la]) => new Phaser.Math.Vector2(px(lo), py(la)));
    andes.lineStyle(6, 0x8a5a3a, 1).strokePoints(pts).lineStyle(2, 0xffffff, 0.9).strokePoints(pts);
    const muro = this.add.graphics();
    m.c.add([muro, andes]);
    const k = { v: 0 };
    this.tweens.add({ targets: k, v: 1, duration: 5000, delay: 3000, onUpdate: () => {
      muro.clear();
      for (let i = 0; i < 7; i++) muro.fillStyle(0xcfdcec, 0.22).fillCircle(px(-60 + i * 2) - k.v * 12, py(-8 - i * 4), 14 + k.v * 10);
    } });
    // cámara: zoom hacia Uyuni
    this.tweens.add({ targets: m.c, scale: 3.4, x: W / 2 - ux * 3.4, y: H / 2 - 20 - uy * 3.4, duration: 5200, delay: 1400, ease: 'Cubic.inOut' });
    // punto dorado: Base Uyuni activa
    this.time.delayedCall(7200, () => {
      const u = m.marcas.uyuni;
      this.tweens.killTweensOf(u.punto);
      u.punto.setFillStyle(0xffd23f).setStrokeStyle(1, 0xffffff);
      u.txt.setText(t('BASE UYUNI [3 656 m] — ACTIVA')).setColor('#ffe14d');
      this.tweens.add({ targets: u.punto, scale: 2, duration: 500, yoyo: true, repeat: -1 });
      Sonido.bien();
    });
    // la cámara baja atravesando las nubes
    this.time.delayedCall(9800, () => {
      const nubes = this.add.container(0, 0).setDepth(5);
      for (let i = 0; i < 7; i++) {
        const n = new Actor(this, W / 2 + ((i * 173) % 700) - 350, H / 2 + ((i * 97) % 300) - 150, 'nube_bloques', { escala: 1.2, dir: 1 }).setAlpha(0);
        nubes.add(n);
        this.tweens.add({ targets: n, scale: 7, alpha: { from: 0.95, to: 0 }, duration: 1800, delay: i * 220, ease: 'Quad.in' });
      }
      this.plano?.add(nubes);
      this.tweens.add({ targets: m.c, alpha: 0.2, duration: 2400 });
    });
  }

  // ───────── 1:02 · corte de radio ─────────
  private corteRadio(): void {
    this.estatica();
    this.ruido.setAlpha(1);
    this.tweens.add({ targets: this.ruido, alpha: 0.08, duration: 1400 });
    Sonido.cuenta();
    this.sub.setText('');
    this.cameras.main.flash(250, 255, 255, 255);
  }

  // ───────── 1:03 · la Ciudadela en el Salar ─────────
  private planoCiudadela(): void {
    const c = this.nuevoPlano();
    colorear(this, 'frio');
    // cielo alto con estrellas para que la cámara suba
    const alto = this.add.container(0, -H);
    this.cielo(alto, 0x000208, 0x040716);
    this.estrellas(alto, 320);
    c.add(alto);
    const salar = fondoSalar(this, { hora: 'noche', suelo: 330 });
    salar.setDepth(0);
    c.add(salar);
    // aurora (detrás de la cordillera) y su reflejo en el salar
    const au = aurora(this, 60).setAlpha(0);
    salar.addAt(au, 1);
    const reflejo = aurora(this, 60, W, 0.45).setPosition(0, 330 * 2).setScale(1, -1).setAlpha(0);
    salar.add(reflejo);
    this.tweens.add({ targets: au, alpha: 1, duration: 4000, delay: 800 });
    this.tweens.add({ targets: reflejo, alpha: 0.5, duration: 4000, delay: 800 });
    // el hangar con la luz encendida (la única luz en el salar)
    const hangar = new Actor(this, 470, 342, 'hangar_ensamblaje', { escala: 1.5, dir: 1 });
    hangar.base.setTint(0x8a94c0);
    salar.add(hangar);
    const luz = this.add.rectangle(470, 322, 30, 22, 0xffd77a, 0.9).setBlendMode(Phaser.BlendModes.ADD);
    const haz = rayos(this, 470, 322, 0xffd77a, 220, 8, 0.05);
    salar.add([haz, luz]);
    this.tweens.add({ targets: luz, alpha: 0.5, duration: 1600, yoyo: true, repeat: -1 });
    escarcha(this, c, 5);
    fugaces(this, salar, 200);
    // la cámara: entra cerca y sube lentamente hacia las estrellas
    c.setScale(1.1);
    this.tweens.add({ targets: c, scale: 1, duration: 9000, ease: 'Sine.out' });
    this.tweens.add({ targets: c, y: H * 0.95, duration: 26000, delay: 12000, ease: 'Sine.inOut' });
    this.credito.setAlpha(0);
  }

  // ───────── 1:35 · título ─────────
  private titulo(): void {
    colorear(this, 'dorado');
    const tit = this.add.text(W / 2, H / 2 - 30, 'MISIÓN CÓNDOR', { fontFamily: FUENTE, fontSize: '64px', fontStyle: '800', color: '#ffffff', stroke: '#1d4a86', strokeThickness: 10 }).setOrigin(0.5).setDepth(940).setAlpha(0).setScale(0.8);
    const placa = this.add.graphics().setDepth(938).setAlpha(0);
    placa.fillStyle(0x02040a, 0.6).fillRoundedRect(W / 2 - 300, H / 2 - 82, 600, 192, 18);
    this.tweens.add({ targets: placa, alpha: 1, duration: 1600 });
    const sub = this.add.container(0, 0).setDepth(940).setAlpha(0);
    sub.add([insigniaSpaceApps(this, W / 2 - 120, H / 2 + 46, 44), insigniaArquisoft(this, W / 2 + 130, H / 2 + 46, 30)]);
    sub.add(this.add.text(W / 2, H / 2 + 92, t('Una misión al océano escondido de Europa'), { fontFamily: FUENTE, fontSize: '14px', fontStyle: 'italic 700', color: CSS.amarillo }).setOrigin(0.5));
    this.tweens.add({ targets: tit, alpha: 1, scale: 1, duration: 2400, ease: 'Cubic.out' });
    this.tweens.add({ targets: sub, alpha: 0.9, duration: 1600, delay: 1400 });
    this.cameras.main.flash(900, 255, 240, 200);
  }

  private salir(): void {
    if (this.saliendo) return;
    this.saliendo = true;
    this.input.enabled = false;
    if (Musica.sonando === 'intro-radio' && !Musica.terminada) { Sonido.golpe(); Musica.parar(700); }   // se corta la transmisión
    this.cameras.main.fadeOut(900, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Titulo'));
  }
}
