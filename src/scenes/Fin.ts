// FINAL del juego: cinemática de cierre + créditos (con Sacrificio.mp3, que viene sonando desde el epílogo).
//   1 · Uyuni respira: el Salar de día, la Ciudadela celebra; la cámara sube al cielo, cae la noche y, junto a
//       Júpiter, una luz pequeña parpadea (el Rover).
//   2 · Título: MISIÓN CÓNDOR · FIN · «La promesa se cumplió».
//   3 · Tu misión: nombre, mascota y estrellas de cada misión.
//   4 · Créditos que suben, con las naves, el Rover y la gente desfilando a los lados.
//   5 · Escena extra: en Europa, el Rover recibe una señal desde Uyuni.
//   6 · Cierre: insignias y «Gracias por jugar».
// Tocar / Espacio / Enter adelanta una parte; Esc va directo al cierre.
import Phaser from 'phaser';
import { W, H, FUENTE, FUENTE_PIXEL } from '../config';
import { perfil, lograr, spriteProtagonista } from '../core/estado';
import { Actor, cargar } from '../core/sprites';
import { nebulosa, estrellas, degradado } from '../ui/fondo';
import { boton, botonSaltar } from '../ui/boton';
import { esTactil } from '../ui/palanca';
import { Musica } from '../core/musica';
import { Sonido } from '../core/audio';
import { t } from '../core/idioma';
import { personalizar } from '../core/texto';
import { fondoSalar, fondoEuropa, HOJAS_ESCENARIO } from '../ui/escenarios';
import { cargarMarca, insigniaSpaceApps, insigniaArquisoft } from '../ui/marca';
import { MISIONES } from '../core/misiones';
import { FLUJO } from '../core/flujo';
import { ARQUISOFT } from '../data/archivo';
import { confeti } from '../ui/tarjeta';
import { grano } from '../ui/cine';

const GENTE = ['cientifico_mision', 'ingeniero_sistemas', 'tripulante_vuelo'];
const DESFILE: [string, string, number][] = [   // sprite, nombre, escala
  ['rover_explorador', 'Rover explorador', 2.2], ['capsula_colibri', 'Cápsula Colibrí', 1.6], ['cohete_completo', 'Cohete', 1.3],
  ['orion_completa', 'Nave Orión', 1.4], ['mascota_corre', '{MASCOTA}', 2.4], ['cientifico_mision', 'Ciudadela de Uyuni', 2.4],
  ['antena_espacio_profundo', 'Antena de espacio profundo', 1.1], ['invernadero', 'Invernadero', 1.2],
];

export class Fin extends Phaser.Scene {
  private etapa = 0;
  private capa: Phaser.GameObjects.Container | null = null;
  private eventos: Phaser.Time.TimerEvent[] = [];
  private bloqueo = 0;

  constructor() { super('Fin'); }

  preload(): void {
    cargarMarca(this);
    cargar(this, [...HOJAS_ESCENARIO, spriteProtagonista(), `${spriteProtagonista()}_mira`, 'mascota_sentada', 'mascota_salta', 'mascota_corre',
      ...GENTE, 'rover_explorador', 'capsula_colibri', 'cohete_completo', 'jupiter', 'estado_rover_escarcha', 'antena_portatil']);
  }

  create(): void {
    perfil.paso = FLUJO.length - 1;
    lograr('fin');   // también guarda el perfil
    Musica.poner('sacrificio');
    this.etapa = 0; this.capa = null; this.eventos = []; this.bloqueo = 0;
    this.cameras.main.setBackgroundColor('#000000').fadeIn(1200);
    grano(this, 9500, 0.05);
    const pista = this.add.text(W - 14, H - 10, t(esTactil() ? 'Toca para adelantar' : 'Toca para adelantar · Esc: saltar'), { fontFamily: FUENTE, fontSize: '11px', color: '#7f8aa0' }).setOrigin(1, 1).setDepth(9600);
    this.tweens.add({ targets: pista, alpha: 0.35, duration: 1200, yoyo: true, repeat: -1 });
    this.input.on('pointerdown', () => this.adelantar());
    this.input.keyboard?.on('keydown-SPACE', () => this.adelantar());
    this.input.keyboard?.on('keydown-ENTER', () => this.adelantar());
    this.input.keyboard?.on('keydown-ESC', () => { if (this.etapa < 6) this.ir(6); });
    const saltar = botonSaltar(this, () => { if (this.etapa < 6) { this.ir(6); saltar.destroy(); } }, W - 70, 28);
    this.ir(1);
  }

  // ───────── control de partes ─────────
  private adelantar(): void {
    if (this.etapa >= 6 || this.time.now < this.bloqueo) return;
    this.ir(this.etapa + 1);
  }

  private luego(ms: number, fn: () => void): void { this.eventos.push(this.time.delayedCall(ms, fn)); }

  private ir(n: number): void {
    this.etapa = n;
    this.bloqueo = this.time.now + 700;   // evita saltarse dos partes con un doble toque
    this.eventos.forEach(e => e.remove()); this.eventos = [];
    const vieja = this.capa;
    if (vieja) this.tweens.add({ targets: vieja, alpha: 0, duration: 700, onComplete: () => vieja.destroy(true) });
    const c = this.add.container(0, 0).setDepth(n * 10).setAlpha(0);
    this.capa = c;
    this.tweens.add({ targets: c, alpha: 1, duration: 900 });
    [, () => this.uyuni(c), () => this.titulo(c), () => this.resumen(c), () => this.creditos(c), () => this.europa(c), () => this.cierre(c)][n]?.();
  }

  /** Subtítulo de cine abajo, que entra, se queda y se va. */
  private subtitulo(c: Phaser.GameObjects.Container, texto: string, desde: number, dura = 3600): void {
    this.luego(desde, () => {
      const s = this.add.text(W / 2, H - 52, personalizar(t(texto)), { fontFamily: FUENTE, fontSize: '20px', fontStyle: 'italic 700', color: '#ffffff', stroke: '#000000', strokeThickness: 5, align: 'center', wordWrap: { width: W - 140 } }).setOrigin(0.5).setAlpha(0);
      c.add(s);
      this.tweens.add({ targets: s, alpha: 1, duration: 600 });
      this.tweens.add({ targets: s, alpha: 0, duration: 600, delay: dura });
    });
  }

  // ───────── 1 · Uyuni respira ─────────
  private uyuni(c: Phaser.GameObjects.Container): void {
    const mundo = this.add.container(0, 0);
    c.add(mundo);
    mundo.add(fondoSalar(this, { hora: 'dia', suelo: 330 }));
    // la Ciudadela celebra alrededor de {NOMBRE} y su mascota
    const p = new Actor(this, 470, 392, `${spriteProtagonista()}_mira`, { escala: 2.4, dir: 4 });
    const m = new Actor(this, 526, 398, 'mascota_sentada', { escala: 2, dir: 4 });
    mundo.add([this.add.ellipse(470, 394, 46, 11, 0x000000, 0.25), p, m]);
    [[310, 400, 6], [370, 414, 6], [610, 414, 2], [680, 400, 2], [750, 412, 2]].forEach(([x, y, d], k) => {
      const g = new Actor(this, x, y, GENTE[k % 3], { escala: 2, dir: d });
      mundo.add(g);
      this.tweens.add({ targets: g, y: y - 8, duration: 260, yoyo: true, repeat: -1, delay: k * 120, ease: 'Sine.out' });   // celebran
    });
    // el cielo: atardecer → noche, con estrellas; luego la luz del Rover junto a Júpiter
    const tarde = this.add.rectangle(W / 2, H / 2, W, H, 0xff7a3a, 0).setBlendMode(Phaser.BlendModes.MULTIPLY);
    const noche = this.add.rectangle(W / 2, H / 2, W, H, 0x050818, 0);
    const cielo = estrellas(this, 200, 77).setAlpha(0);
    const jup = new Actor(this, 760, 120, 'jupiter', { escala: 0.9, dir: 1 }).setAlpha(0);
    const luz = this.add.circle(706, 150, 3, 0x7fe9ff).setAlpha(0);
    const halo = this.add.circle(706, 150, 12, 0x7fe9ff, 0.25).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    // franja de cine abajo para los subtítulos
    const franja = this.add.graphics();
    franja.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.85, 0.85).fillRect(0, H - 130, W, 40).fillStyle(0x000000, 0.85).fillRect(0, H - 90, W, 90);
    c.add([tarde, noche, cielo, jup, halo, luz, franja]);
    this.tweens.add({ targets: mundo, y: 70, duration: 16000, ease: 'Sine.inOut' });   // la cámara sube al cielo (crane shot)
    this.tweens.add({ targets: tarde, fillAlpha: 0.3, duration: 5000, delay: 4500 });
    this.tweens.add({ targets: noche, fillAlpha: 0.88, duration: 5000, delay: 8500 });
    this.tweens.add({ targets: [cielo, jup], alpha: 1, duration: 3000, delay: 10000 });
    this.luego(12500, () => {
      this.tweens.add({ targets: [luz, halo], alpha: 1, duration: 300, yoyo: true, repeat: -1, repeatDelay: 700 });
      this.tweens.add({ targets: halo, scale: 2.2, duration: 1000, repeat: -1 });
    });
    this.subtitulo(c, 'La Tierra respira otra vez.', 600, 3000);
    this.subtitulo(c, 'En la Ciudadela de Uyuni, todos celebran bajo un cielo azul.', 4400, 3400);
    this.subtitulo(c, 'Esa noche, {NOMBRE} y {MASCOTA} miran juntos las estrellas.', 8600, 3400);
    this.subtitulo(c, 'Y allá arriba, junto a Júpiter, una luz pequeña sigue parpadeando.', 12800, 4200);
    this.luego(18200, () => this.ir(2));
  }

  // ───────── 2 · Título ─────────
  private titulo(c: Phaser.GameObjects.Container): void {
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1));
    c.add(nebulosa(this, 'rosa', 21).setAlpha(0.8));
    c.add(estrellas(this, 160, 5));
    const nombre = this.add.text(W / 2, 150, 'MISIÓN CÓNDOR', { fontFamily: FUENTE, fontSize: '54px', fontStyle: '800', color: '#f2f9ff', stroke: '#1d4a86', strokeThickness: 7 }).setOrigin(0.5).setAlpha(0);
    const fin = this.add.text(W / 2, 270, t('FIN'), { fontFamily: FUENTE, fontSize: '150px', fontStyle: 'italic 800', color: '#ffffff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setAlpha(0).setScale(0.85);
    const lema = this.add.text(W / 2, 390, t('La promesa se cumplió.'), { fontFamily: FUENTE, fontSize: '24px', fontStyle: 'italic 700', color: '#ffe14d', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setAlpha(0);
    c.add([nombre, fin, lema]);
    this.tweens.add({ targets: nombre, alpha: 1, y: 140, duration: 1400, delay: 300 });
    this.tweens.add({ targets: fin, alpha: 1, scale: 1, duration: 2200, delay: 1000, ease: 'Sine.out' });
    this.tweens.add({ targets: lema, alpha: 1, duration: 1400, delay: 2800 });
    this.luego(2600, () => confeti(this, 25));
    this.luego(7500, () => this.ir(3));
  }

  // ───────── 3 · Tu misión ─────────
  private resumen(c: Phaser.GameObjects.Container): void {
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x02040c, 1));
    c.add(estrellas(this, 140, 9));
    const est = perfil.estrellas ?? {}, total = MISIONES.reduce((a, m) => a + (est[m.clave] ?? 0), 0);
    c.add(this.add.text(W / 2, 64, t('TU MISIÓN'), { fontFamily: FUENTE_PIXEL, fontSize: '12px', color: '#3ff3ff' }).setOrigin(0.5));
    c.add(this.add.text(W / 2, 104, personalizar('{NOMBRE}  ·  {MASCOTA}'), { fontFamily: FUENTE, fontSize: '30px', fontStyle: '800', color: '#ffffff', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5));
    const filas: Phaser.GameObjects.Container[] = [];
    MISIONES.forEach((m, i) => {
      const paso = FLUJO.find(p => p.escena === m.escena), nom = paso ? t(paso.titulo) : m.escena, n = est[m.clave] ?? 0;
      const y = 160 + i * 38, f = this.add.container(W / 2, y);
      f.add(this.add.graphics().fillStyle(0x0b1630, 0.85).fillRoundedRect(-260, -16, 520, 32, 10).lineStyle(1, 0x3a5a8a, 1).strokeRoundedRect(-260, -16, 520, 32, 10));
      f.add(this.add.text(-244, 0, nom, { fontFamily: FUENTE, fontSize: '15px', fontStyle: '700', color: '#e8f6ff' }).setOrigin(0, 0.5));
      f.add(this.add.text(244, 0, '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n), { fontFamily: FUENTE, fontSize: '20px', color: n ? '#ffe14d' : '#4a5a7a' }).setOrigin(1, 0.5));
      c.add(f); filas.push(f);
      f.setAlpha(0).setX(W / 2 - 30);
      this.tweens.add({ targets: f, alpha: 1, x: W / 2, duration: 400, delay: 500 + i * 220, onStart: () => Sonido.tecla() });
    });
    const tot = this.add.text(W / 2, 160 + MISIONES.length * 38 + 14, t('{e} de {te} estrellas · Logros: {l}', { e: total, te: MISIONES.length * 3, l: perfil.logros.length }), { fontFamily: FUENTE, fontSize: '17px', fontStyle: '800', color: '#ffe14d' }).setOrigin(0.5).setAlpha(0);
    c.add(tot);
    this.tweens.add({ targets: tot, alpha: 1, duration: 600, delay: 500 + MISIONES.length * 220 });
    // los dos, contentos
    const p = new Actor(this, 110, 470, spriteProtagonista(), { escala: 2.8, dir: 7 }).pausar();
    const ms = new Actor(this, 180, 476, 'mascota_salta', { escala: 2.6, dir: 1 });
    c.add([p, ms]);
    this.luego(9000, () => this.ir(4));
  }

  // ───────── 4 · Créditos ─────────
  private creditos(c: Phaser.GameObjects.Container): void {
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1));
    c.add(degradado(this, 0x02030a, 0x0a1026, 0));
    c.add(estrellas(this, 220, 33));
    const integrantes = ARQUISOFT.integrantes.filter(i => !i.nombre.startsWith('['));
    const lineas: [string, string][] = [   // [tipo, texto]  · t = título de sección, n = nombre grande, x = texto, e = espacio
      ['n', 'MISIÓN CÓNDOR'], ['x', 'Una misión al océano escondido de Europa'], ['e', ''],
      ['t', 'UN JUEGO DE'], ['n', 'ARQUISOFT'], ['x', 'Equipo boliviano de desarrollo de software'], ['e', ''],
      ['t', 'EQUIPO'],
      ...(integrantes.length ? integrantes.flatMap(i => (i.rol && !i.rol.startsWith('[') ? [['n', i.nombre], ['x', i.rol]] : [['n', i.nombre]]) as [string, string][]) : [['n', 'Equipo ARQUISOFT'] as [string, string]]),
      ['e', ''],
      ['t', 'PROTAGONISTAS'], ['n', '{NOMBRE}'], ['x', 'Ingenier@ aeroespacial de la Ciudadela'], ['n', '{MASCOTA}'], ['x', 'Quien esperó en la puerta'], ['n', 'Rover explorador'], ['x', 'Se quedó en Europa para que la cura volviera'], ['e', ''],
      ['t', 'MINIJUEGOS'], ...MISIONES.map(m => ['x', FLUJO.find(p => p.escena === m.escena)?.titulo ?? m.escena] as [string, string]), ['e', ''],
      ['t', 'BANDA SONORA'], ['x', 'Menu · Enero 1V · Rover · Rover 2.0'], ['x', 'Despliegue del Cohete 123 · Tic Tac Rover · Tic Tac Rover 2'], ['x', 'Sacrificio · Transmisión de emergencia'], ['x', 'Suspenso de Europa generado en vivo con Web Audio'], ['e', ''],
      ['t', 'SPRITES Y ANIMACIÓN'], ['x', 'Editor de moldes 2.5D de Misión Cóndor'], ['x', 'Personajes, naves, planetas e íconos hechos bloque a bloque'], ['e', ''],
      ['t', 'TECNOLOGÍA'], ['x', 'Phaser 3 · TypeScript · Vite'], ['x', 'Node.js · WebSocket · SQLite (multijugador)'], ['e', ''],
      ['t', 'CIENCIA'], ['x', 'Datos públicos de Venus, Marte, Júpiter y Europa'], ['x', 'Ecuación del cohete · ISRU · Max-Q · presupuesto de masa'], ['e', ''],
      ['t', 'RETO'], ['x', 'NASA Space Apps Challenge 2026'], ['x', 'Space Mission Design Game'], ['e', ''],
      ['t', 'GRACIAS'], ['x', 'A cada persona que jugó y aprendió con nosotros'], ['x', 'Al Salar de Uyuni, por prestarnos su cielo'], ['e', ''], ['e', ''],
      ['n', 'Gracias por jugar, {NOMBRE}.'],
    ];
    const rollo = this.add.container(0, H + 20);
    let y = 0;
    for (const [tipo, s] of lineas) {
      if (tipo === 'e') { y += 26; continue; }
      const estilo: Phaser.Types.GameObjects.Text.TextStyle = tipo === 't'
        ? { fontFamily: FUENTE_PIXEL, fontSize: '11px', color: '#3ff3ff' }
        : tipo === 'n' ? { fontFamily: FUENTE, fontSize: '26px', fontStyle: '800', color: '#ffffff', stroke: '#000', strokeThickness: 4 }
          : { fontFamily: FUENTE, fontSize: '16px', fontStyle: '700', color: '#c8d6ec', align: 'center', wordWrap: { width: 520 } };
      const tx = this.add.text(W / 2, y, personalizar(t(s)), estilo).setOrigin(0.5, 0);
      rollo.add(tx);
      y += tx.height + (tipo === 't' ? 14 : 8);
    }
    c.add(rollo);
    const dura = (y + H) * 34;   // ~30 px por segundo
    this.tweens.add({ targets: rollo, y: -y + H / 2 - 40, duration: dura, ease: 'Linear' });
    // desfile a los costados: naves, el Rover, la mascota y la gente de la Ciudadela
    DESFILE.forEach(([id, nombre, e], k) => this.luego(1500 + k * (dura / (DESFILE.length + 1)), () => {
      const izq = k % 2 === 0, x = izq ? 130 : W - 130;
      const a = new Actor(this, x, H + 90, id, { escala: e, dir: izq ? 6 : 2 });
      const n = this.add.text(x, H + 110, personalizar(t(nombre)), { fontFamily: FUENTE, fontSize: '12px', fontStyle: '800', color: '#9fdcff', align: 'center', wordWrap: { width: 200 } }).setOrigin(0.5, 0);
      c.add([a, n]);
      this.tweens.add({ targets: [a, n], y: '-=' + (H + 260), duration: 9000, ease: 'Linear', onComplete: () => { a.destroy(); n.destroy(); } });
    }));
    this.luego(dura - 1500, () => this.ir(5));
  }

  // ───────── 5 · Escena extra: Europa ─────────
  private europa(c: Phaser.GameObjects.Container): void {
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1));
    c.add(fondoEuropa(this, 330));
    c.add(new Actor(this, 600, 420, 'antena_portatil', { escala: 2.4, dir: 1 }).setAngle(-8));
    const r = new Actor(this, 470, 440, 'estado_rover_escarcha', { escala: 3, dir: 7 }).pausar();
    const ojo = this.add.circle(470, 392, 5, 0x7fe9ff, 0);
    c.add([r, ojo]);
    // un haz verde baja desde el cielo: la señal de la Tierra
    const haz = this.add.rectangle(600, 160, 4, 0, 0x5cff9c, 0.8).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD);
    const rotulo = this.add.text(W / 2, 92, t('SEÑAL RECIBIDA · ORIGEN: UYUNI, TIERRA'), { fontFamily: FUENTE_PIXEL, fontSize: '11px', color: '#5cff9c' }).setOrigin(0.5).setAlpha(0);
    const msg = this.add.text(W / 2, 130, personalizar(t('«Gracias, compañero. Volvimos a respirar.» — {NOMBRE}')), { fontFamily: FUENTE, fontSize: '20px', fontStyle: 'italic 700', color: '#ffffff', stroke: '#000', strokeThickness: 5, align: 'center', wordWrap: { width: 760 } }).setOrigin(0.5).setAlpha(0);
    c.add([haz, rotulo, msg]);
    this.luego(1200, () => { this.tweens.add({ targets: haz, height: 200, duration: 1400, ease: 'Cubic.out' }); Sonido.tecla(); });
    this.luego(2600, () => this.tweens.add({ targets: rotulo, alpha: 1, duration: 500 }));
    this.luego(3600, () => this.tweens.add({ targets: msg, alpha: 1, duration: 900 }));
    // el Rover responde: su luz cian parpadea tres veces
    [5200, 5900, 6600].forEach(ms => this.luego(ms, () => { Sonido.tecla(); this.tweens.add({ targets: ojo, fillAlpha: 1, duration: 140, yoyo: true, hold: 200 }); }));
    this.luego(8800, () => this.ir(6));
  }

  // ───────── 6 · Cierre ─────────
  private cierre(c: Phaser.GameObjects.Container): void {
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1));
    c.add(nebulosa(this, 'azul', 12).setAlpha(0.6));
    c.add(estrellas(this, 160, 61));
    c.add(this.add.text(W / 2, 120, t('Gracias por jugar'), { fontFamily: FUENTE, fontSize: '44px', fontStyle: '800', color: '#ffffff', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5));
    c.add(this.add.text(W / 2, 172, personalizar(t('{MASCOTA} también te lo agradece.')), { fontFamily: FUENTE, fontSize: '18px', fontStyle: 'italic 700', color: '#ffe14d' }).setOrigin(0.5));
    c.add(insigniaArquisoft(this, W / 2 - 130, 262, 52));
    c.add(insigniaSpaceApps(this, W / 2 + 130, 262, 52));
    const p = new Actor(this, W / 2 - 40, 420, spriteProtagonista(), { escala: 2.6, dir: 0 }).pausar();
    const m = new Actor(this, W / 2 + 30, 426, 'mascota_salta', { escala: 2.4, dir: 0 });
    c.add([p, m]);
    const volver = boton(this, W / 2 - 150, H - 50, 'Volver al inicio', () => {
      perfil.paso = 1;
      this.cameras.main.fadeOut(600);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Titulo'));
    }, { ancho: 260, variante: 'exito', icono: '⌂', retardo: 900 });
    const otra = boton(this, W / 2 + 150, H - 50, 'Ver el final otra vez', () => this.scene.restart(), { ancho: 260, variante: 'fantasma', icono: '↺', retardo: 1100 });
    [volver, otra].forEach(b => b.setDepth(9000));
  }
}
