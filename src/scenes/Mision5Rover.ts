// MISIÓN 5 · Manejar el rover en Europa. Oscuridad total: solo ves lo que alumbra la Lámpara de trabajo.
// Objetivos: perforar la grieta térmica y sellar la cepa en el Contenedor; llevar 3 bloques de hielo al electrolizador (ISRU).
// Control: flechas/WASD o mantener el dedo/ratón hacia donde quieres ir. E / Espacio / botón: usar. Q / botón: escanear.
// Supervivencia: la batería se gasta (manejar, lámpara, escanear, perforar) y solo se recarga junto a la nave;
// lejos de la nave sube la dosis de radiación; los géiseres criovolcánicos avisan y estallan; el hielo está oculto
// hasta que BIT-7 lo escanea; la broca se recalienta y hay que soltar USAR para que se enfríe.
// Estrellas según los problemas (géiseres, batería agotada, escudo saturado).
import Phaser from 'phaser';
import { W, H, FUENTE_PIXEL, CSS } from '../config';
import { Actor, cargar, cuerposDe, empujar, type Cuerpo } from '../core/sprites';
import { siguiente } from '../core/flujo';
import { lograr, ganarEstrellas } from '../core/estado';
import { t as tr } from '../core/idioma';
import { segun } from '../core/dificultad';
import { Sonido } from '../core/audio';
import { aviso, boton } from '../ui/boton';
import { tarjetaMision, tarjetaResultado } from '../ui/tarjeta';
import { instalarPausa } from './Pausa';
import { ListaHolo, Dron, flotante, destello, HOJAS_TALLER } from '../ui/taller';
import { cintillo, type Cintillo } from '../ui/boton';
import { escarcha } from '../ui/ambiente';
import { DECORADOS, piso, utileria } from '../ui/decorado';
import { Palanca } from '../ui/palanca';

const MW = 2200, MH = 1400;                 // tamaño del mundo
const BASE = { x: 520, y: 760 };            // la nave Orión / Colibrí
const GRIETA = { x: 1720, y: 420 };
const HIELOS = [{ x: 1180, y: 1120 }, { x: 1900, y: 1000 }, { x: 860, y: 330 }];
const VEL = 190;
const GEISERES = [{ x: 1380, y: 640 }, { x: 1060, y: 1010 }, { x: 1640, y: 900 }, { x: 760, y: 470 }];
const CICLO = () => segun(7, 5.5), AVISO = 2.2, ERUPCION = 1.6;          // segundos del ciclo de cada géiser
const PERFORAR = 3;                                     // segundos de perforación necesarios

export class Mision5Rover extends Phaser.Scene {
  private rover!: Actor;
  private escudo!: Actor;
  private teclas!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursor!: Phaser.Types.Input.Keyboard.CursorKeys;
  private palanca!: Palanca;
  private oscuridad!: Phaser.GameObjects.RenderTexture;
  private hielos: Actor[] = [];
  private carga = 0;            // bloques en el carrito
  private entregados = 0;
  private cepa: 'grieta' | 'rover' | 'sellada' = 'grieta';
  private perforando = 0;
  private bateria = 100;
  private activo = false;
  private hud!: Phaser.GameObjects.Graphics;
  private objetivo!: Cintillo;
  private lista!: ListaHolo;
  private bit7!: Dron;
  private solidos: Cuerpo[] = [];      // cuerpos con los que choca el rover
  private flecha!: Phaser.GameObjects.Triangle;
  private radiacion = 0; private saturado = false;
  private avance = 0; private calor = 0; private enfriando = false;
  private problemas = 0; private sinBateria = false;
  private visibles = new Set<Actor>();           // hielo ya escaneado por BIT-7
  private marcas = new Map<Actor, Phaser.GameObjects.GameObject>();
  private escaneoListo = 0;                       // segundos hasta poder volver a escanear
  private reloj = 0;
  private geiser: { x: number; y: number; anillo: Phaser.GameObjects.Ellipse; vapor: Phaser.GameObjects.Particles.ParticleEmitter; estado: 'calma' | 'aviso' | 'erupcion'; golpeo: boolean }[] = [];
  private taladroUI!: Phaser.GameObjects.Graphics;

  constructor() { super('Mision5Rover'); }

  preload(): void {
    cargar(this, ['rover_explorador', 'escudo', 'criovolcan', 'bloque_hielo', 'electrolizador_isru', 'contenedor_muestras', 'capsula_colibri', 'carrito_muestras', 'taladro_muestras', 'cepa_vial', 'lampara_trabajo', 'roca_hielo', 'cresta_hielo', 'grieta_hielo', 'baliza_luz', ...DECORADOS, ...HOJAS_TALLER]);
  }

  create(): void {
    this.hielos = []; this.solidos = []; this.carga = 0; this.entregados = 0; this.cepa = 'grieta'; this.perforando = 0; this.bateria = 100; this.activo = false;
    this.radiacion = 0; this.saturado = false; this.avance = 0; this.calor = 0; this.enfriando = false; this.problemas = 0; this.sinBateria = false;
    this.visibles = new Set(); this.marcas = new Map(); this.escaneoListo = 0; this.reloj = 0; this.geiser = [];
    this.cameras.main.fadeIn(500).setBounds(0, 0, MW, MH).setBackgroundColor('#05070d');
    this.suelo();
    // la nave es grande; el rover, pequeño a su lado. Todo lo sólido tiene cuerpo (huella del molde)
    this.solido(BASE.x, BASE.y, 'capsula_colibri', 3.8);
    this.solido(BASE.x + 170, BASE.y + 40, 'electrolizador_isru', 2.2);
    this.solido(BASE.x - 150, BASE.y + 50, 'contenedor_muestras', 1.6);
    this.solido(GRIETA.x, GRIETA.y, 'criovolcan', 3);
    HIELOS.forEach(p => this.hielos.push(new Actor(this, p.x, p.y, 'bloque_hielo', { escala: 1.2 }).setDepth(p.y).setAlpha(0)));   // ocultos hasta el escaneo
    this.crearGeiseres();
    this.obstaculos();

    this.rover = new Actor(this, BASE.x + 60, BASE.y + 150, 'rover_explorador', { escala: 1.7, dir: 2 });
    this.escudo = new Actor(this, this.rover.x, this.rover.y + 8, 'escudo', { escala: 1.45 }).setAlpha(0.45);
    this.cameras.main.startFollow(this.rover, true, 0.1, 0.1);

    this.luzOscuridad();
    escarcha(this, undefined, 7000, true);

    // BIT-7 acompaña al rover con su propia luz
    this.bit7 = new Dron(this, this.rover.x - 60, this.rover.y - 90, 1.4);
    // interfaz: objetivos holográficos, batería y escudo, y el cintillo con la tarea actual
    this.lista = new ListaHolo(this, 14, 70, 'OBJETIVOS', ['Perforar la grieta', 'Sellar la cepa', 'Hielo recogido 0/3', 'Hielo al ISRU 0/3'], 230);
    this.lista.cont.setDepth(9000);
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(9000);
    this.add.text(30, H - 66, 'BATERÍA', { fontFamily: FUENTE_PIXEL, fontSize: '9px', color: '#9fdcff' }).setScrollFactor(0).setDepth(9001);
    this.add.text(30, H - 36, 'RADIACIÓN', { fontFamily: FUENTE_PIXEL, fontSize: '8px', color: '#3ff3ff' }).setScrollFactor(0).setDepth(9001);
    this.taladroUI = this.add.graphics().setDepth(8100);
    this.objetivo = cintillo(this, 'Lleva la cepa al Contenedor de muestras (USAR)', '◎');
    this.objetivo.setDepth(9000);
    this.flecha = this.add.triangle(0, 0, 0, -12, 24, 0, 0, 12, 0xffe14d).setScrollFactor(0).setDepth(9000);
    const usar = boton(this, W - 90, H - 70, 'USAR', () => this.usar(), { ancho: 130, alto: 64, color: 0x3ff3ff });
    usar.setScrollFactor(0, 0, true).setDepth(9001);
    const esc = boton(this, W - 90, H - 146, 'ESCANEAR', () => this.escanear(), { ancho: 130, alto: 48, variante: 'fantasma', tam: 15 });
    esc.setScrollFactor(0, 0, true).setDepth(9001);

    const kb = this.input.keyboard!;
    this.cursor = kb.createCursorKeys();
    this.palanca = new Palanca(this);
    this.teclas = kb.addKeys('W,A,S,D,E,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    // ignorar la autorrepetición del teclado: mantener la tecla apretada no debe reiniciar la acción
    kb.on('keydown-E', (e: KeyboardEvent) => { if (!e.repeat) this.usar(); });
    kb.on('keydown-SPACE', (e: KeyboardEvent) => { if (!e.repeat) this.usar(); });
    kb.on('keydown-Q', (e: KeyboardEvent) => { if (!e.repeat) this.escanear(); });

    instalarPausa(this);
    tarjetaMision(this, 6, 'Rover en Europa',
      'Maneja el rover en la noche de Europa: perfora la grieta (si la broca se calienta, suelta USAR), sella la cepa y escanea con BIT-7 (Q) para hallar 3 bloques de hielo. Cuida la batería, la radiación y los géiseres.',
      ['rover_explorador', 'taladro_muestras', 'bloque_hielo', 'electrolizador_isru'], () => { this.activo = true; this.actualizarObjetivo(); });
  }

  private suelo(): void {
    piso(this, 'suelo_hielo', 0, 0, MW, MH, undefined, 1).setDepth(-20);   // hielo de Europa hecho con el motor
    const g = this.add.graphics().setDepth(-10);
    let s = 99;
    const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) | 0) >>> 0) / 4294967296;
    g.lineStyle(3, 0x6b3a2a, 0.55);          // grietas rojizas (sales) como en Europa
    for (let i = 0; i < 40; i++) {
      let x = r() * MW, y = r() * MH; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 260; y += (r() - 0.5) * 120; g.lineTo(x, y); }
      g.strokePath();
    }
    // pináculos de hielo repartidos (decorado; el rover pasa por delante o por detrás según su altura)
    for (let i = 0; i < 26; i++) {
      const x = 80 + r() * (MW - 160), y = 120 + r() * (MH - 200);
      if (Math.hypot(x - BASE.x, y - BASE.y) < 300 || Math.hypot(x - GRIETA.x, y - GRIETA.y) < 200) continue;
      if (this.ocupado(x, y, 150)) continue;
      const pen = utileria(this, 'penitentes', undefined, [[x, y, 0.9 + r() * 0.8]], i % 8)[0].setDepth(y);
      this.solidos.push(...cuerposDe(pen));
    }
  }

  private luzOscuridad(): void {
    // pincel de luz (degradado radial)
    if (!this.textures.exists('luz-rover')) {
      const c = document.createElement('canvas'); c.width = c.height = 420;
      const x = c.getContext('2d')!, gr = x.createRadialGradient(210, 210, 20, 210, 210, 210);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 420, 420);
      this.textures.addCanvas('luz-rover', c);
      const c2 = document.createElement('canvas'); c2.width = c2.height = 160;
      const x2 = c2.getContext('2d')!, g2 = x2.createRadialGradient(80, 80, 5, 80, 80, 80);
      g2.addColorStop(0, 'rgba(255,255,255,0.9)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
      x2.fillStyle = g2; x2.fillRect(0, 0, 160, 160);
      this.textures.addCanvas('luz-chica', c2);
    }
    this.oscuridad = this.add.renderTexture(0, 0, W, H).setOrigin(0).setScrollFactor(0).setDepth(8000);
  }

  update(_: number, dtms: number): void {
    const dt = dtms / 1000;
    this.dibujarOscuridad();
    if (!this.activo) return;
    let dx = 0, dy = 0;
    const k = this.teclas, c = this.cursor;
    if (c.left.isDown || k.A.isDown) dx -= 1;
    if (c.right.isDown || k.D.isDown) dx += 1;
    if (c.up.isDown || k.W.isDown) dy -= 1;
    if (c.down.isDown || k.S.isDown) dy += 1;
    if (this.palanca.activa) { dx = this.palanca.vx; dy = this.palanca.vy; }
    const p = this.input.activePointer;
    if (!dx && !dy && p.isDown && !this.palanca.activa && !(p.x > W - 170 && p.y > H - 120)) {
      const wx = p.worldX - this.rover.x, wy = p.worldY - this.rover.y;
      if (Math.hypot(wx, wy) > 24) { dx = wx; dy = wy; }
    }
    if (dx || dy) {
      const n = Math.hypot(dx, dy), v = VEL * (this.carga ? 0.8 : 1) * (this.bateria > 0 ? 1 : 0.35) * (this.saturado ? 0.6 : 1);
      let nx = Phaser.Math.Clamp(this.rover.x + (dx / n) * v * dt, 40, MW - 40);
      let ny = Phaser.Math.Clamp(this.rover.y + (dy / n) * v * dt, 60, MH - 20);
      for (const c of this.solidos) { const e = empujar(c, nx, ny, 20); if (e) { nx = e.x; ny = e.y; } }   // choca y resbala por el borde
      this.rover.setPosition(nx, ny);
      this.rover.mirarHacia(dx, dy).seguir();
      this.huella();
      this.gastar(dt * 2.4);
    } else this.rover.pausar();
    this.gastar(dt * 0.2);   // la lámpara siempre encendida
    this.reloj += dt;
    this.escaneoListo = Math.max(0, this.escaneoListo - dt);
    this.radiar(dt);
    this.ciclosGeiser(dt);
    this.rover.setDepth(this.rover.y);
    this.escudo.setPosition(this.rover.x, this.rover.y + 8).setDepth(this.rover.y + 1);

    // recarga junto a la nave
    if (this.cerca(BASE, 220)) this.bateria = Math.min(100, this.bateria + dt * 12);
    // recoger hielo al pasar (solo el que BIT-7 ya encontró)
    this.hielos = this.hielos.filter(h => {
      if (this.visibles.has(h) && this.carga < 3 && Phaser.Math.Distance.Between(h.x, h.y, this.rover.x, this.rover.y) < 70) {
        const mk = this.marcas.get(h); if (mk) { this.tweens.killTweensOf(mk); mk.destroy(); } this.marcas.delete(h); this.visibles.delete(h);
        this.carga++; Sonido.bien(); aviso(this, `Bloque de hielo al Carrito de muestras (${this.carga})`, CSS.cian, 70);
        flotante(this, h.x, h.y - 60, '+1 HIELO', '#3ff3ff');
        this.lista.renombrar(2, `Hielo recogido ${this.carga + this.entregados}/3`); if (this.carga + this.entregados >= 3) this.lista.marcar(2);
        this.tweens.add({ targets: h, x: this.rover.x, y: this.rover.y - 30, scale: 0.2, alpha: 0, duration: 300, onComplete: () => h.destroy() });
        this.actualizarObjetivo();
        return false;
      }
      return true;
    });
    // perforar: mantener USAR cerca de la grieta; la broca se calienta y hay que soltar para que se enfríe
    const presiona = (this.teclas.E.isDown || this.teclas.SPACE.isDown || (this.input.activePointer.isDown && !this.palanca.activa)) && this.cerca(GRIETA, 140) && this.cepa === 'grieta';
    if (this.perforando > 0 && presiona && !this.enfriando && this.bateria > 0) {
      this.avance += dt; this.calor = Math.min(100, this.calor + dt * segun(48, 62)); this.gastar(dt * 5);
      if (Math.random() < 0.2) Sonido.tecla();
      if (this.calor >= 100) { this.enfriando = true; Sonido.mal(); aviso(this, '¡La broca se recalentó! Suelta USAR un momento para que se enfríe.', CSS.rojo, 70); }
      if (this.avance >= PERFORAR) { this.perforando = 0; this.cepa = 'rover'; Sonido.bien(); this.lista.marcar(0); destello(this, GRIETA.x, GRIETA.y - 30, 0x5cff9c); flotante(this, GRIETA.x, GRIETA.y - 90, 'CEPA', '#5cff9c'); aviso(this, '¡Agua subsuperficial! La cepa está en el taladro. Llévala al Contenedor.', CSS.verde, 70); this.actualizarObjetivo(); }
    } else if (!presiona) {
      this.perforando = 0;
      this.calor = Math.max(0, this.calor - dt * 60);
      if (this.enfriando && this.calor < 35) { this.enfriando = false; if (this.cepa === 'grieta') aviso(this, 'Broca fría: sigue perforando (mantén USAR)', CSS.verde, 70); }
    }
    this.pintarTaladro();
    this.pintarHud();
    this.apuntarFlecha();
  }

  // ───────── supervivencia ─────────
  private gastar(n: number): void {
    this.bateria = Math.max(0, this.bateria - n * segun(1, 1.3));
    if (this.bateria <= 0 && !this.sinBateria) {
      this.sinBateria = true; this.problemas++;
      Sonido.mal(); aviso(this, 'Batería agotada: el rover va lento. Vuelve a la nave para recargar.', CSS.rojo, 70);
    }
    if (this.bateria > 30) this.sinBateria = false;
  }

  /** Lejos de la nave sube la dosis; junto a la nave baja. Si llega al límite, el escudo se satura. */
  private radiar(dt: number): void {
    const cerca = this.cerca(BASE, 330);
    this.radiacion = Phaser.Math.Clamp(this.radiacion + (cerca ? -dt * 9 : dt * segun(2.1, 2.9)), 0, 100);
    if (this.radiacion >= 100 && !this.saturado) {
      this.saturado = true; this.problemas++;
      Sonido.alarma(); this.cameras.main.flash(300, 120, 60, 255);
      aviso(this, 'Escudo saturado de radiación: el rover se protege y va más lento. Vuelve a la nave.', CSS.rojo, 70);
    }
    if (this.saturado && this.radiacion < 50) { this.saturado = false; aviso(this, 'Escudo recuperado', CSS.verde, 70); }
  }

  private crearGeiseres(): void {
    if (!this.textures.exists('amb-punto')) this.make.graphics({}, false).fillStyle(0xffffff).fillRect(0, 0, 2, 2).generateTexture('amb-punto', 2, 2).destroy();
    GEISERES.forEach((p, i) => {
      // grieta del géiser (en el suelo) y anillo de aviso que se ve aun en la oscuridad
      this.add.ellipse(p.x, p.y, 70, 24, 0x8fd8ff, 0.25).setStrokeStyle(2, 0xbfeaff, 0.5).setDepth(-4);
      const anillo = this.add.ellipse(p.x, p.y, 180, 64).setStrokeStyle(3, 0xffe14d, 0).setDepth(8050);
      const vapor = this.add.particles(p.x, p.y, 'amb-punto', {
        speedY: { min: -380, max: -220 }, speedX: { min: -40, max: 40 }, lifespan: 1300, quantity: 6, frequency: 30,
        scale: { start: 6, end: 14 }, alpha: { start: 0.55, end: 0 }, tint: [0xffffff, 0xcfefff], emitting: false,
      }).setDepth(8060);
      this.geiser.push({ x: p.x, y: p.y, anillo, vapor, estado: 'calma', golpeo: false });
      void i;
    });
  }

  private ciclosGeiser(dt: number): void {
    void dt;
    this.geiser.forEach((g, i) => {
      const ciclo = CICLO(), fase = (this.reloj + i * 1.9) % ciclo;
      const nuevo = fase < ciclo - AVISO - ERUPCION ? 'calma' : fase < ciclo - ERUPCION ? 'aviso' : 'erupcion';
      if (nuevo !== g.estado) {
        g.estado = nuevo;
        if (nuevo === 'aviso') { g.anillo.setStrokeStyle(3, 0xffe14d, 0.9); this.tweens.add({ targets: g.anillo, scale: { from: 0.6, to: 1 }, duration: 500, repeat: 3 }); if (this.cerca(g, 400)) Sonido.alarma(); }
        if (nuevo === 'erupcion') { g.anillo.setStrokeStyle(3, 0xff4a3d, 1); g.vapor.start(); g.golpeo = false; if (this.cerca(g, 500)) this.cameras.main.shake(400, 0.006); }
        if (nuevo === 'calma') { g.anillo.setStrokeStyle(3, 0xffe14d, 0); g.vapor.stop(); }
      }
      if (g.estado === 'erupcion' && !g.golpeo && this.cerca(g, 95)) {
        g.golpeo = true; this.problemas++;
        Sonido.mal(); this.cameras.main.shake(300, 0.012);
        this.gastar(20); this.radiacion = Math.min(100, this.radiacion + 15);
        let txt = '¡Géiser! El rover pierde batería. Espera a que pase el aviso amarillo.';
        if (this.carga > 0) {   // se cae un bloque de hielo del carrito
          this.carga--;
          const h = new Actor(this, g.x + 110, g.y + 50, 'bloque_hielo', { escala: 1.2 }).setDepth(g.y + 50);
          this.hielos.push(h); this.revelar(h);
          this.lista.renombrar(2, `Hielo recogido ${this.carga + this.entregados}/3`);
          txt = '¡Géiser! Se cayó un bloque de hielo del carrito: recógelo de nuevo.';
          this.actualizarObjetivo();
        }
        aviso(this, txt, CSS.rojo, 70);
      }
    });
  }

  /** BIT-7 escanea: revela el hielo cercano y, si no hay, el más próximo. Gasta batería y necesita recargar. */
  private escanear(): void {
    if (!this.activo) return;
    if (this.escaneoListo > 0) { aviso(this, tr('BIT-7 se está recargando ({s} s)', { s: Math.ceil(this.escaneoListo) }), CSS.gris, 70); return; }
    if (this.bateria < 5) { aviso(this, 'Sin batería para escanear: vuelve a la nave.', CSS.rojo, 70); return; }
    this.escaneoListo = 5; this.gastar(6);
    Sonido.bien();
    const onda = this.add.circle(this.rover.x, this.rover.y, 20).setStrokeStyle(4, 0x3ff3ff, 0.9).setDepth(8070);
    this.tweens.add({ targets: onda, radius: 700, alpha: 0, duration: 900, ease: 'Cubic.out', onComplete: () => onda.destroy() });
    const ocultos = this.hielos.filter(h => !this.visibles.has(h));
    const d = (h: Actor) => Phaser.Math.Distance.Between(h.x, h.y, this.rover.x, this.rover.y);
    let hallados = ocultos.filter(h => d(h) < 700);
    if (!hallados.length && ocultos.length) hallados = [ocultos.reduce((a, b) => (d(a) < d(b) ? a : b))];
    hallados.forEach(h => this.revelar(h));
    aviso(this, hallados.length ? tr('BIT-7 encontró {n} bloque(s) de hielo', { n: hallados.length }) : 'No queda hielo oculto', CSS.cian, 70);
    this.actualizarObjetivo();
  }

  private revelar(h: Actor): void {
    if (this.visibles.has(h)) return;
    this.visibles.add(h);
    this.tweens.add({ targets: h, alpha: 1, duration: 500 });
    // marca de BIT-7 sobre el bloque (se ve aun en la oscuridad)
    const m = this.add.star(h.x, h.y - 60, 4, 6, 14, 0x3ff3ff).setDepth(8080);
    this.tweens.add({ targets: m, y: m.y - 8, angle: 90, duration: 700, yoyo: true, repeat: -1 });
    this.marcas.set(h, m);
  }

  /** Barras sobre el rover mientras perfora: avance (verde) y calor de la broca (rojo). */
  private pintarTaladro(): void {
    const g = this.taladroUI.clear();
    if (this.cepa !== 'grieta' || (!this.cerca(GRIETA, 160) && this.avance === 0)) return;
    if (!this.cerca(GRIETA, 160)) return;
    const x = this.rover.x - 50, y = this.rover.y - 96;
    g.fillStyle(0x040914, 0.85).fillRoundedRect(x - 6, y - 6, 112, 34, 6);
    g.fillStyle(0x1b2740, 1).fillRect(x, y, 100, 8).fillRect(x, y + 14, 100, 8);
    g.fillStyle(0x5cff9c, 1).fillRect(x, y, 100 * Math.min(1, this.avance / PERFORAR), 8);
    g.fillStyle(this.enfriando ? 0xff4a3d : 0xffa83f, 1).fillRect(x, y + 14, this.calor, 8);
  }

  /** Coloca un actor sólido y registra su cuerpo. */
  private solido(x: number, y: number, id: string, escala: number, dir = 1): Actor {
    const a = new Actor(this, x, y, id, { escala, dir }).setDepth(y);
    this.solidos.push(...cuerposDe(a));
    return a;
  }

  /** ¿Hay algo importante cerca? (para no tapar la base, la grieta ni los bloques de hielo) */
  private ocupado(x: number, y: number, r: number): boolean {
    const d = (p: { x: number; y: number }) => Math.hypot(p.x - x, p.y - y);
    return d(BASE) < 330 + r * 0.3 || d(GRIETA) < 190 + r * 0.3 || HIELOS.some(h => d(h) < 110 + r * 0.3) || GEISERES.some(g => d(g) < 120 + r * 0.3);
  }

  /** Obstáculos de Europa (sprites con cuerpo): crestas de presión, grietas abiertas, bloques erráticos y balizas de ruta. */
  private obstaculos(): void {
    ([[1000, 600, 1], [1380, 560, 7], [1500, 930, 1], [760, 1090, 7], [1950, 700, 1]] as [number, number, number][])
      .forEach(([x, y, d]) => this.solido(x, y, 'cresta_hielo', 1.5, d));
    ([[1230, 800, 1], [1500, 250, 7], [980, 930, 7], [300, 420, 1]] as [number, number, number][])
      .forEach(([x, y, d]) => this.solido(x, y, 'grieta_hielo', 1.5, d));
    let s = 4242;
    const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) | 0) >>> 0) / 4294967296;
    for (let i = 0, puestos = 0; i < 60 && puestos < 14; i++) {
      const x = 100 + r() * (MW - 200), y = 140 + r() * (MH - 240);
      if (this.ocupado(x, y, 120) || this.solidos.some(c => Math.hypot(c.x - x, c.y - y) < c.rx + 90)) continue;
      this.solido(x, y, 'roca_hielo', 1.1 + r() * 0.8, Math.floor(r() * 8)); puestos++;
    }
    // balizas: marcan el camino entre la nave y la grieta térmica
    [[760, 700], [960, 500], [1180, 420], [1420, 400]].forEach(([x, y]) => this.solido(x, y, 'baliza_luz', 1.4));
    if (new URLSearchParams(location.search).has('cuerpos')) {   // ?cuerpos: dibuja las colisiones (depuración)
      const g = this.add.graphics().setDepth(7999).lineStyle(2, 0xff3cf0, 0.9);
      this.time.delayedCall(100, () => this.solidos.forEach(c => g.strokeEllipse(c.x, c.y, c.rx * 2, c.ry * 2)));
    }
  }

  private ultimaHuella = { x: 0, y: 0 };
  /** Huellas de las 6 ruedas que se desvanecen en el hielo. */
  private huella(): void {
    const { x, y } = this.rover;
    if (Phaser.Math.Distance.Between(x, y, this.ultimaHuella.x, this.ultimaHuella.y) < 16) return;
    this.ultimaHuella = { x, y };
    const h = this.add.rectangle(x, y + 3, 20, 3, 0x3e5a6a, 0.55).setDepth(-5);
    this.tweens.add({ targets: h, alpha: 0, duration: 7000, onComplete: () => h.destroy() });
  }

  private dibujarOscuridad(): void {
    const cam = this.cameras.main, o = this.oscuridad;
    o.clear().fill(0x02040a, 0.9);
    const rx = this.rover.x - cam.scrollX, ry = this.rover.y - cam.scrollY;
    o.erase('luz-rover', rx - 210, ry - 230);
    const fijos = [BASE, GRIETA, { x: BASE.x + 170, y: BASE.y + 40 }, { x: 760, y: 730 }, { x: 960, y: 530 }, { x: 1180, y: 450 }, { x: 1420, y: 430 }, ...GEISERES];
    fijos.forEach(f => o.erase('luz-chica', f.x - cam.scrollX - 80, f.y - cam.scrollY - 110));
  }

  private cerca(p: { x: number; y: number }, r: number): boolean {
    return Phaser.Math.Distance.Between(p.x, p.y, this.rover.x, this.rover.y) < r;
  }

  private usar(): void {
    if (!this.activo) return;
    if (this.cepa === 'grieta' && this.cerca(GRIETA, 140)) {
      if (this.perforando > 0) return;   // ya está perforando: no reiniciar
      if (this.bateria <= 0) { aviso(this, 'Sin batería para perforar: vuelve a la nave a recargar.', CSS.rojo, 70); return; }
      if (this.enfriando) { aviso(this, 'La broca todavía está caliente: espera un momento.', CSS.amarillo, 70); return; }
      this.perforando = 0.001; Sonido.motor(2);
      aviso(this, 'Perforando con el Taladro de muestras... mantén USAR', CSS.amarillo, 70);
      return;
    }
    if (this.cepa === 'rover' && this.cerca({ x: BASE.x - 150, y: BASE.y + 50 }, 130)) {
      this.cepa = 'sellada'; Sonido.bien(); this.lista.marcar(1); flotante(this, this.rover.x, this.rover.y - 80, 'SELLADA'); aviso(this, 'Cepa sellada en el Contenedor de muestras. ¡La cura está a salvo!', CSS.verde, 70);
      this.actualizarObjetivo(); this.revisarFin(); return;
    }
    if (this.carga > 0 && this.cerca({ x: BASE.x + 170, y: BASE.y + 40 }, 140)) {
      this.entregados += this.carga; this.carga = 0; Sonido.bien();
      destello(this, BASE.x + 170, BASE.y, 0x3ff3ff); flotante(this, BASE.x + 170, BASE.y - 70, 'O2 + H2', '#3ff3ff');
      this.lista.renombrar(3, `Hielo al ISRU ${this.entregados}/3`); if (this.entregados >= 3) this.lista.marcar(3);
      aviso(this, 'ISRU: la electricidad separa el agua en oxígeno (O₂) e hidrógeno (combustible)', CSS.cian, 70);
      this.actualizarObjetivo(); this.revisarFin(); return;
    }
    Sonido.mal();
    aviso(this, 'Acércate al objetivo que indica la flecha', CSS.gris, 70);
  }

  private objetivoActual(): { x: number; y: number; texto: string } | null {
    if (this.cepa === 'grieta') return { ...GRIETA, texto: 'Ve a la grieta térmica y perfora (mantén USAR)' };
    if (this.cepa === 'rover') return { x: BASE.x - 150, y: BASE.y + 50, texto: 'Lleva la cepa al Contenedor de muestras (USAR)' };
    if (this.carga + this.entregados < 3 && this.hielos.length) {
      const vistos = this.hielos.filter(h => this.visibles.has(h));
      if (!vistos.length) return { x: this.rover.x, y: this.rover.y, texto: 'Escanea con BIT-7 para encontrar hielo (Q / ESCANEAR)' };
      const h = vistos.reduce((a, b) => Phaser.Math.Distance.Between(a.x, a.y, this.rover.x, this.rover.y) < Phaser.Math.Distance.Between(b.x, b.y, this.rover.x, this.rover.y) ? a : b);
      return { x: h.x, y: h.y, texto: `Recoge bloques de hielo (${this.carga + this.entregados}/3)` };
    }
    if (this.carga > 0) return { x: BASE.x + 170, y: BASE.y + 40, texto: 'Lleva el hielo al electrolizador ISRU (USAR)' };
    return null;
  }

  private actualizarObjetivo(): void {
    const o = this.objetivoActual();
    this.objetivo.texto?.setText(o ? o.texto : '¡Listo!');
    this.lista.actual(this.cepa === 'grieta' ? 0 : this.cepa === 'rover' ? 1 : this.carga + this.entregados < 3 ? 2 : 3);
  }

  private apuntarFlecha(): void {
    const o = this.objetivoActual(), cam = this.cameras.main;
    if (!o || (o.x === this.rover.x && o.y === this.rover.y)) { this.flecha.setVisible(false); return; }
    const sx = o.x - cam.scrollX, sy = o.y - cam.scrollY;
    const dentro = sx > 40 && sx < W - 40 && sy > 40 && sy < H - 60;
    const a = Math.atan2(sy - H / 2, sx - W / 2);
    this.flecha.setVisible(true).setRotation(a);
    if (dentro) this.flecha.setPosition(sx, sy - 70).setRotation(Math.PI / 2);
    else this.flecha.setPosition(W / 2 + Math.cos(a) * (W / 2 - 50), H / 2 + Math.sin(a) * (H / 2 - 60));
  }

  private pintarHud(): void {
    // batería: barra segmentada que cambia de color, en un panel abajo a la izquierda
    const g = this.hud.clear(), x = 16, y = H - 82, n = Math.ceil(this.bateria / 10);
    g.fillStyle(0x040914, 0.85).fillRoundedRect(x, y, 230, 70, 12).lineStyle(2, 0x3ff3ff, 0.6).strokeRoundedRect(x, y, 230, 70, 12);
    const col = this.bateria > 50 ? 0x3cff6a : this.bateria > 20 ? 0xffe14d : 0xff4a3d;
    for (let i = 0; i < 10; i++) g.fillStyle(i < n ? col : 0x1b2740, 1).fillRoundedRect(x + 92 + i * 13, y + 12, 10, 16, 2);
    const rc = this.saturado ? 0xff4a3d : this.radiacion > 70 ? 0xffa83f : 0xb07dff;
    g.fillStyle(0x1b2740, 1).fillRoundedRect(x + 92, y + 42, 127, 10, 3).fillStyle(rc, 1).fillRoundedRect(x + 92, y + 42, 127 * this.radiacion / 100, 10, 3);
    // BIT-7 sigue al rover con un poco de retraso
    const d = this.bit7.actor;
    d.x += (this.rover.x - 60 - d.x) * 0.06; d.y += (this.rover.y - 95 - d.y) * 0.06;
  }

  private revisarFin(): void {
    if (this.cepa !== 'sellada' || this.entregados < 3) return;
    this.activo = false;
    lograr('m5');
    const estrellas = this.problemas === 0 ? 3 : this.problemas <= 2 ? 2 : 1;
    const mejor = ganarEstrellas('m5', estrellas);
    this.time.delayedCall(800, () => tarjetaResultado(this, '¡Misión en Europa cumplida!', [
      'Cepa extremófila sellada en el Contenedor de muestras.',
      '3 bloques de hielo → electrólisis → oxígeno y combustible.',
      'Esto se llama ISRU: usar los recursos del lugar.',
    ], () => siguiente(this), { estrellas, mejor, nota: tr('Problemas: {n} (géiseres, batería o radiación). Planea la ruta para las 3 estrellas.', { n: this.problemas }) }));
  }
}
