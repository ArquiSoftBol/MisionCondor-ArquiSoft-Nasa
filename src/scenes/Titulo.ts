// MENÚ PRINCIPAL · Misión Cóndor.
// Continúa la intro: la Ciudadela de noche en el Salar, con aurora, el cohete en su torre y el protagonista con su
// mascota mirando el cielo. A la izquierda, un menú vertical claro (ratón, toque o teclado ↑ ↓ Enter) con lo que hace
// cada opción; abajo a la derecha, la tarjeta de progreso con las estrellas de cada misión.
// Ajustes y Logros son paneles completos (interruptores y selectores, no botones a ciegas). Borrar la partida pide
// confirmación.
import Phaser from 'phaser';
import { esTactil } from '../ui/palanca';
import { t, cambiarIdioma, idioma } from '../core/idioma';
import { selectorIdioma } from '../ui/selectorIdioma';
import { W, H, FUENTE, FUENTE_PIXEL, CSS } from '../config';
import { Actor, cargar } from '../core/sprites';
import { perfil, guardar, reiniciar, spriteProtagonista } from '../core/estado';
import { continuar, FLUJO } from '../core/flujo';
import { Sonido } from '../core/audio';
import { Musica } from '../core/musica';
import { boton, panel } from '../ui/boton';
import { MISIONES, TOTAL_MISIONES } from '../core/misiones';
import { icono as iconoPropio, esIcono } from '../ui/iconos';
import { fondoSalar, HOJAS_ESCENARIO } from '../ui/escenarios';
import { fugaces } from '../ui/ambiente';
import { aurora, grano } from '../ui/cine';
import { interruptor, segmentado, nivel } from '../ui/controles';
import { cargarMarca, insigniaSpaceApps, insigniaArquisoft } from '../ui/marca';
import { personalizar } from '../core/texto';

interface Opcion { icono: string; nombre: string; sub: string; accion: () => void; principal?: boolean; acento?: number; etiqueta?: string }
interface Item { c: Phaser.GameObjects.Container; fondo: Phaser.GameObjects.Graphics; flecha: Phaser.GameObjects.Text; op: Opcion; y: number }

const MX = 56, MY = 204, PASO = 54, ANCHO = 340;
const LOGROS: [string, string, string][] = [
  ['m1', 'Sistemas vitales', 'Diseña el módulo para Europa'],
  ['m2', 'Constructor de cohetes', 'Arma el cohete y conecta el combustible'],
  ['m3', 'Arquitect@ de Orión', 'Integra la nave y supera la prueba de vacío'],
  ['m4', 'Despegue perfecto', 'Separa cada etapa en el momento justo'],
  ['marte', 'Rescate en Base Tari', 'Salva al Rover de la tormenta de óxido'],
  ['m5', 'Piloto de Europa', 'Sella la cepa y lleva el hielo al ISRU'],
  ['fin', 'Promesa cumplida', 'Vuelve a casa con la cura'],
];

export class Titulo extends Phaser.Scene {
  private items: Item[] = [];
  private foco = 0;
  private capa?: Phaser.GameObjects.Container;   // panel abierto (ajustes, logros, confirmación)
  private abrir?: string;
  private yendo = false;
  private conTeclado = false;

  constructor() { super('Titulo'); }

  init(d: { abrir?: string }): void { this.abrir = d?.abrir; this.items = []; this.foco = 0; this.capa = undefined; this.yendo = false; }

  preload(): void {
    cargarMarca(this);
    cargar(this, [...HOJAS_ESCENARIO, 'cohete_completo', 'hangar_ensamblaje', `${spriteProtagonista()}_mira`, 'mascota_sentada', 'rover_explorador']);
  }

  create(): void {
    this.cameras.main.fadeIn(this.abrir ? 0 : 900);
    Musica.paraEscena('Titulo');
    this.escenario();
    this.tituloAnimado();
    this.menu();
    if (perfil.nombre) this.tarjetaProgreso();
    this.barraSuperior();
    this.pie();
    grano(this, 200, 0.05);
    this.teclado();
    if (this.abrir === 'ajustes') this.ajustes();
  }

  // ───────── escenario vivo ─────────
  private escenario(): void {
    const salar = fondoSalar(this, { hora: 'noche', suelo: 330 });
    salar.addAt(aurora(this, 50).setAlpha(0.9), 1);
    fugaces(this, salar, 180);
    const cohete = new Actor(this, 700, 338, 'cohete_completo', { escala: 1.7, dir: 0 });
    cohete.base.setTint(0xb8c2e0);
    salar.add(cohete);
    const hangar = new Actor(this, 560, 344, 'hangar_ensamblaje', { escala: 1.5, dir: 1 });
    hangar.base.setTint(0x8a94c0);
    salar.add(hangar);
    const luz = this.add.rectangle(560, 324, 30, 22, 0xffd77a, 0.9).setBlendMode(Phaser.BlendModes.ADD);
    salar.add(luz);
    this.tweens.add({ targets: luz, alpha: 0.5, duration: 1600, yoyo: true, repeat: -1 });
    // protagonista y mascota mirando el cielo, junto al hangar
    const p = new Actor(this, 640, 432, `${spriteProtagonista()}_mira`, { escala: 2.6, dir: 4 });
    const m = new Actor(this, 690, 438, 'mascota_sentada', { escala: 2.2, dir: 4 });
    this.add.ellipse(640, 434, 50, 12, 0x000000, 0.3).setDepth(-1);
    [p, m].forEach(a => a.setDepth(2));
    // franja oscura a la izquierda para que el menú se lea siempre
    const sombra = this.add.graphics().setDepth(5);
    sombra.fillGradientStyle(0x02040a, 0x02040a, 0x02040a, 0x02040a, 0.85, 0, 0.85, 0).fillRect(0, 0, 560, H);
    // el Rover explorador patrulla el Patio de Pruebas con su faro cian (Guía Maestra, fase 0)
    const rover = new Actor(this, 830, 372, 'rover_explorador', { escala: 1.1, dir: 2 });
    rover.base.setTint(0xa8b4dc);
    const faro = this.add.triangle(0, 0, 0, 0, 70, -16, 70, 16, 0x7fe9ff, 0.22).setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD);
    salar.add([faro, rover]);
    const patrulla = (haciaIzq: boolean) => {
      rover.mirar(haciaIzq ? 2 : 6).seguir();
      faro.setScale(haciaIzq ? -1 : 1, 1);
      this.tweens.add({ targets: rover, x: haciaIzq ? 770 : 920, duration: 6500, ease: 'Sine.inOut', onUpdate: () => faro.setPosition(rover.x + (haciaIzq ? -8 : 8), rover.y - 10),
        onComplete: () => { rover.pausar(); this.time.delayedCall(1400, () => patrulla(!haciaIzq)); } });
    };
    patrulla(true);
    // cámara: zoom-in muy lento hacia la plataforma iluminada (y un vaivén suave)
    const foco = { x: 640, y: 360 };
    this.tweens.addCounter({ from: 0, to: 1, duration: 45000, ease: 'Sine.out', onUpdate: tw => {
      const k = tw.getValue() ?? 0, z = 1 + 0.08 * k, vaiven = Math.sin(this.time.now / 2200) * 6;
      salar.setScale(z).setPosition(foco.x * (1 - z) + vaiven, foco.y * (1 - z));
    } });
  }

  /** Título que entra letra por letra y luego brilla. */
  private tituloAnimado(): void {
    const texto = 'MISIÓN CÓNDOR';
    const est = { fontFamily: FUENTE, fontSize: '52px', fontStyle: '800', color: '#f2f9ff', stroke: '#1d4a86', strokeThickness: 6, shadow: { offsetX: 2, offsetY: 4, color: '#0d2a55', blur: 0, fill: true } };
    const g = this.add.container(MX, 96).setDepth(20);
    let x = 0;
    [...texto].forEach((ch, i) => {
      const l = this.add.text(x, 30, ch, est).setOrigin(0, 0.5).setAlpha(0);
      x += l.width - 2;
      g.add(l);
      this.tweens.add({ targets: l, y: 0, alpha: 1, duration: 500, delay: (this.abrir ? 0 : 300) + i * 45, ease: 'Back.out' });
    });
    const sub = this.add.text(MX + 2, 140, t('Una misión al océano escondido de Europa'), { fontFamily: FUENTE, fontSize: '15px', fontStyle: 'italic 700', color: CSS.amarillo }).setDepth(20).setAlpha(0);
    const linea = this.add.rectangle(MX + 2, 166, 0, 2, 0x3ff3ff).setOrigin(0, 0.5).setDepth(20);
    this.tweens.add({ targets: sub, alpha: 1, duration: 600, delay: this.abrir ? 0 : 1000 });
    this.tweens.add({ targets: linea, width: 300, duration: 700, delay: this.abrir ? 0 : 1100, ease: 'Cubic.out' });
  }

  // ───────── menú ─────────
  private menu(): void {
    const est = perfil.estrellas ?? {}, total = Object.values(est).reduce((a, b) => a + b, 0);
    const capitulo = perfil.nombre ? FLUJO[Math.max(1, perfil.paso)].titulo : '';
    const opciones: Opcion[] = [
      perfil.nombre
        ? { icono: '▶', nombre: 'Continuar', sub: t('{c} · {n} y {m}', { c: t(capitulo), n: perfil.nombre, m: perfil.mascota }), accion: () => this.jugar(), principal: true }
        : { icono: '▶', nombre: 'Jugar', sub: 'Empieza la aventura', accion: () => this.jugar(), principal: true },
      { icono: 'ico_equipo', nombre: 'Multijugador', sub: 'Dos jugadores en equipo · código de sala', accion: () => this.irA('MultiLobby'), acento: 0xffb33f, etiqueta: 'NUEVO · 2 JUGADORES' },
      { icono: '◈', nombre: 'Archivo', sub: 'La historia, el equipo y el reto NASA', accion: () => this.irA('Archivo') },
      { icono: '★', nombre: 'Logros', sub: t('{e} de {te} estrellas · {l} de {tl} logros', { e: total, te: TOTAL_MISIONES * 3, l: perfil.logros.length, tl: LOGROS.length }), accion: () => this.logros() },
      { icono: 'ico_engranaje', nombre: 'Ajustes', sub: 'Sonido, idioma, voz, calidad y dificultad', accion: () => this.ajustes() },
      { icono: '↺', nombre: 'Ver la intro', sub: 'La transmisión de emergencia', accion: () => this.irA('IntroRadio') },
    ];
    opciones.forEach((op, i) => {
      const y = MY + i * PASO;
      const c = this.add.container(MX, y).setDepth(30);
      const fondo = this.add.graphics();
      const icono = esIcono(op.icono) ? iconoPropio(this, 28, 0, op.icono, op.principal ? 28 : 24) : this.add.text(28, 0, op.icono, { fontFamily: FUENTE, fontSize: op.principal ? '22px' : '19px', fontStyle: '800', color: op.principal ? '#ffe14d' : op.acento ? '#' + op.acento.toString(16).padStart(6, '0') : '#3ff3ff' }).setOrigin(0.5);
      const nombre = this.add.text(56, -9, t(op.nombre), { fontFamily: FUENTE, fontSize: op.principal ? '20px' : '18px', fontStyle: '800', color: '#ffffff' }).setOrigin(0, 0.5);
      const sub = this.add.text(56, 13, t(op.sub), { fontFamily: FUENTE, fontSize: '11px', fontStyle: '700', color: '#9fb3d1' }).setOrigin(0, 0.5);
      const flecha = this.add.text(ANCHO - 22, 0, '›', { fontFamily: FUENTE, fontSize: '26px', fontStyle: '800', color: '#3ff3ff' }).setOrigin(0.5).setAlpha(0);
      c.add([fondo, icono, nombre, sub, flecha]);
      if (op.etiqueta) {   // insignia que late: «NUEVO · 2 JUGADORES»
        const tx = this.add.text(0, 0, t(op.etiqueta), { fontFamily: FUENTE_PIXEL, fontSize: '7px', color: '#1a0e00' }).setOrigin(0.5);
        const w = tx.width + 14, x = 56 + nombre.width + 12 + w / 2;
        const placa = this.add.graphics().fillStyle(op.acento ?? 0xffb33f, 1).fillRoundedRect(-w / 2, -8, w, 16, 8);
        const insignia = this.add.container(x, -9, [placa, tx]);
        c.add(insignia);
        this.tweens.add({ targets: insignia, scale: 1.08, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      c.setSize(ANCHO, 52).setInteractive({ useHandCursor: true });
      // el área interactiva de un contenedor se centra en su origen: la corremos al rectángulo dibujado
      (c.input!.hitArea as Phaser.Geom.Rectangle).setPosition(ANCHO / 2, 0);
      c.on('pointerover', () => { if (!this.conTeclado) this.enfocar(i); });
      c.on('pointerdown', () => this.activar(i));
      // entrada escalonada desde la izquierda
      c.setAlpha(0).setX(MX - 30);
      this.tweens.add({ targets: c, alpha: 1, x: MX, duration: 450, delay: (this.abrir ? 0 : 700) + i * 90, ease: 'Cubic.out' });
      this.items.push({ c, fondo, flecha, op, y });
    });
    this.enfocar(0, true);
  }

  private pintarItem(it: Item, activo: boolean): void {
    const g = it.fondo.clear(), h = 48;
    g.fillStyle(activo ? 0x0e2a3e : 0x040914, activo ? 0.92 : 0.55).fillRoundedRect(0, -h / 2, ANCHO, h, 12);
    const ac = it.op.acento ?? 0x3ff3ff;
    g.lineStyle(2, activo ? ac : it.op.acento ? it.op.acento : 0x2a3a5a, activo ? 1 : it.op.acento ? 0.55 : 0.8).strokeRoundedRect(0, -h / 2, ANCHO, h, 12);
    if (activo) g.fillStyle(it.op.principal ? 0xffe14d : ac, 1).fillRoundedRect(0, -h / 2 + 8, 4, h - 16, 2);
    it.flecha.setAlpha(activo ? 1 : 0);
  }

  private enfocar(i: number, silencio = false): void {
    if (this.capa) return;
    this.foco = (i + this.items.length) % this.items.length;
    this.items.forEach((it, k) => {
      this.pintarItem(it, k === this.foco);
      this.tweens.add({ targets: it.c, x: MX + (k === this.foco ? 10 : 0), duration: 140, ease: 'Cubic.out' });
    });
    if (!silencio) Sonido.tecla();
  }

  private activar(i: number): void {
    if (this.capa || this.yendo) return;
    this.enfocar(i, true);
    Sonido.despertar(); Sonido.click();
    const it = this.items[i];
    this.tweens.add({ targets: it.c, scaleX: 0.97, scaleY: 0.97, duration: 70, yoyo: true, onComplete: () => it.op.accion() });
  }

  /** Teclado: un evento del navegador = una acción (se descartan las copias del mismo evento). */
  private teclado(): void {
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (p.velocity.length() > 0.5 || p.isDown) this.conTeclado = false; });
    const kb = this.input.keyboard;
    if (!kb) return;
    const vistos = new Set<string>();
    kb.on('keydown', (e: KeyboardEvent) => {
      const firma = `${e.key}@${e.timeStamp}`;
      if (vistos.has(firma)) return;
      vistos.add(firma);
      if (vistos.size > 40) vistos.clear();
      this.conTeclado = true;
      if (this.capa) { if (e.key === 'Escape') this.cerrarCapa(); return; }
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') this.enfocar(this.foco - 1);
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') this.enfocar(this.foco + 1);
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) this.activar(this.foco);
    });
  }

  private jugar(): void { if (this.yendo) return; this.yendo = true; this.input.enabled = false; continuar(this); }

  private irA(escena: string): void {
    if (this.yendo) return;
    this.yendo = true;
    this.cameras.main.fadeOut(400);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(escena));
  }

  // ───────── tarjeta de progreso ─────────
  private tarjetaProgreso(): void {
    const x = W - 340, y = 62, w = 320, h = 112;   // arriba a la derecha: no tapa la escena
    const c = this.add.container(x, y).setDepth(30).setAlpha(0);
    const g = this.add.graphics().fillStyle(0x040914, 0.82).fillRoundedRect(0, 0, w, h, 14).lineStyle(2, 0x3ff3ff, 0.5).strokeRoundedRect(0, 0, w, h, 14);
    c.add(g);
    c.add(this.add.text(16, 14, t('TU MISIÓN'), { fontFamily: FUENTE_PIXEL, fontSize: '8px', color: '#3ff3ff' }));
    c.add(this.add.text(16, 30, `${perfil.nombre} · ${perfil.mascota}`, { fontFamily: FUENTE, fontSize: '15px', fontStyle: '800', color: '#ffffff' }));
    c.add(this.add.text(w - 16, 30, t(FLUJO[Math.max(1, perfil.paso)].titulo), { fontFamily: FUENTE, fontSize: '12px', fontStyle: '700', color: CSS.amarillo }).setOrigin(1, 0));
    // barra de avance de la aventura
    const pasos = FLUJO.length - 2, hecho = Math.min(1, (Math.max(1, perfil.paso) - 1) / pasos);
    c.add(this.add.rectangle(16, 58, w - 32, 6, 0x1b2740).setOrigin(0, 0.5));
    c.add(this.add.rectangle(16, 58, (w - 32) * hecho, 6, 0x3ff3ff).setOrigin(0, 0.5));
    // estrellas por misión
    const est = perfil.estrellas ?? {};
    for (let k = 1; k <= TOTAL_MISIONES; k++) {
      const bx = 16 + ((k - 1) % 3) * 100, by = 76 + Math.floor((k - 1) / 3) * 17, n = est[MISIONES[k - 1].clave] ?? 0;   // 3 × 2
      c.add(this.add.text(bx, by, `M${k}`, { fontFamily: FUENTE, fontSize: '11px', fontStyle: '800', color: '#9fb3d1' }).setOrigin(0, 0.5));
      c.add(this.add.text(bx + 22, by, '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n), { fontFamily: FUENTE, fontSize: '11px', color: n ? '#ffe14d' : '#4a5a7a' }).setOrigin(0, 0.5));
    }
    this.tweens.add({ targets: c, alpha: 1, duration: 600, delay: this.abrir ? 0 : 1200 });
  }

  // ───────── barra superior y pie ─────────
  private barraSuperior(): void {
    const b = this.add.graphics().setDepth(40);
    [[0xd52b1e, 0], [0xf9e300, 1], [0x007934, 2]].forEach(([c, i]) => b.fillStyle(c).fillRect(0, i * 5, 22, 5));
    b.setPosition(MX, 20);
    this.add.text(MX + 30, 27, t('SALAR DE UYUNI · BOLIVIA · 3 656 m'), { fontFamily: FUENTE_PIXEL, fontSize: '8px', color: '#c8d6ec' }).setOrigin(0, 0.5).setDepth(40);
    selectorIdioma(this, W - 140, 28, () => this.scene.restart());
    const fs = this.add.container(W - 40, 28).setDepth(40);
    const fg = this.add.graphics().fillStyle(0x040914, 0.8).fillRoundedRect(-18, -16, 36, 32, 8).lineStyle(2, 0x3ff3ff, 0.8).strokeRoundedRect(-18, -16, 36, 32, 8);
    fs.add([fg, iconoPropio(this, 0, 0, 'ico_pantalla', 20)]);
    fs.setSize(40, 36).setInteractive({ useHandCursor: true }).on('pointerdown', () => { Sonido.click(); this.scale.toggleFullscreen(); });
  }

  private pie(): void {
    this.add.text(MX, H - 26, t(esTactil() ? 'Toca una opción para empezar' : '↑ ↓ elegir · Enter aceptar · F pantalla completa'), { fontFamily: FUENTE_PIXEL, fontSize: '8px', color: '#7f93b5' }).setOrigin(0, 0.5).setDepth(40);
    insigniaSpaceApps(this, W - 236, H - 30, 34).setDepth(40);
    insigniaArquisoft(this, W - 80, H - 30, 22).setDepth(40);
  }

  // ───────── paneles ─────────
  private abrirCapa(titulo: string, w: number, h: number): Phaser.GameObjects.Container {
    this.capa?.destroy();
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x02040a, 0.7).setInteractive());
    c.add(panel(this, W / 2, H / 2, w, h, { titulo, color: 0x3ff3ff }));
    this.capa = c;
    return c;
  }

  private cerrarCapa(): void {
    const c = this.capa;
    if (!c) return;
    this.capa = undefined;
    Sonido.click();
    this.tweens.add({ targets: c, alpha: 0, duration: 160, onComplete: () => c.destroy() });
  }

  private ajustes(): void {
    const w = 640, h = 440, c = this.abrirCapa('AJUSTES', w, h);
    const x0 = W / 2 - w / 2 + 40, xc = W / 2 + 150;
    const fila = (i: number, nombre: string, ayuda: string, control: Phaser.GameObjects.Container) => {
      const y = H / 2 - 150 + i * 50;
      c.add(this.add.text(x0, y - 8, t(nombre), { fontFamily: FUENTE, fontSize: '16px', fontStyle: '800', color: '#ffffff' }).setOrigin(0, 0.5));
      c.add(this.add.text(x0, y + 11, t(ayuda), { fontFamily: FUENTE, fontSize: '11px', fontStyle: '700', color: '#8a9cbc' }).setOrigin(0, 0.5));
      control.setPosition(xc, y);
      c.add(control);
      if (i < 5) c.add(this.add.rectangle(W / 2, y + 25, w - 60, 1, 0x2a3a5a));
    };
    fila(0, 'Volumen', 'Música y efectos', nivel(this, 0, 0, perfil.volumen, v => { perfil.volumen = v; guardar(); Musica.volumen(); }));
    fila(1, 'Idioma', 'Textos, subtítulos y voz', segmentado(this, 0, 0, ['Español', 'English'], idioma() === 'en' ? 1 : 0, i => {
      cambiarIdioma(i ? 'en' : 'es'); this.time.delayedCall(180, () => this.scene.restart({ abrir: 'ajustes' }));
    }));
    fila(2, 'Narración por voz', 'Lee en voz alta las cinemáticas', interruptor(this, 0, 0, !!perfil.voz, v => { perfil.voz = v; guardar(); }));
    fila(3, 'Calidad gráfica', 'Baja: para celulares lentos', segmentado(this, 0, 0, ['Alta', 'Baja'], perfil.calidad === 'baja' ? 1 : 0, i => { perfil.calidad = i ? 'baja' : 'alta'; guardar(); }));
    fila(4, 'Dificultad', 'Cadete: para aprender · Ingeniería: más estricta', segmentado(this, 0, 0, ['Cadete', 'Ingeniería'], perfil.dificultad === 'ingenieria' ? 1 : 0, i => { perfil.dificultad = i ? 'ingenieria' : 'cadete'; guardar(); }, 240));
    fila(5, 'Pantalla completa', 'También con la tecla F', interruptor(this, 0, 0, this.scale.isFullscreen, () => this.scale.toggleFullscreen()));
    if (perfil.nombre) c.add(boton(this, W / 2 - 130, H / 2 + 178, 'Borrar partida', () => this.confirmarBorrado(), { ancho: 200, alto: 44, tam: 15, variante: 'peligro', icono: '✖', retardo: 0 }));
    c.add(boton(this, W / 2 + (perfil.nombre ? 130 : 0), H / 2 + 178, 'Listo', () => this.cerrarCapa(), { ancho: 200, alto: 44, tam: 15, variante: 'exito', icono: '✔', retardo: 0 }));
  }

  private confirmarBorrado(): void {
    const c = this.abrirCapa('BORRAR PARTIDA', 480, 230);
    c.add(this.add.text(W / 2, H / 2 - 30, t('¿Borrar la partida guardada?\nSe pierden el progreso, los logros y las estrellas.'), { fontFamily: FUENTE, fontSize: '16px', fontStyle: '700', color: '#ffffff', align: 'center', lineSpacing: 6 }).setOrigin(0.5));
    c.add(boton(this, W / 2 - 110, H / 2 + 60, 'Cancelar', () => this.ajustes(), { ancho: 180, alto: 44, tam: 15, variante: 'neutro', retardo: 0 }));
    c.add(boton(this, W / 2 + 110, H / 2 + 60, 'Borrar', () => { reiniciar(); this.scene.restart(); }, { ancho: 180, alto: 44, tam: 15, variante: 'peligro', icono: '✖', retardo: 0 }));
  }

  private logros(): void {
    const w = 700, h = 450, c = this.abrirCapa('LOGROS', w, h);
    const est = perfil.estrellas ?? {}, total = Object.values(est).reduce((a, b) => a + b, 0);
    c.add(this.add.text(W / 2, H / 2 - 186, t('{l} de {tl} logros · {e} de {te} estrellas', { l: perfil.logros.length, tl: LOGROS.length, e: total, te: TOTAL_MISIONES * 3 }), { fontFamily: FUENTE, fontSize: '16px', fontStyle: '800', color: CSS.amarillo }).setOrigin(0.5));
    LOGROS.forEach(([id, nombre, como], i) => {
      const x = W / 2 - 252 + (i % 4) * 168, y = H / 2 - 100 + Math.floor(i / 4) * 104, ok = perfil.logros.includes(id);
      const g = this.add.graphics().fillStyle(ok ? 0x2a2208 : 0x0b1222, 0.95).fillRoundedRect(x - 78, y - 46, 156, 92, 12).lineStyle(2, ok ? 0xffe14d : 0x2a3a5a, 1).strokeRoundedRect(x - 78, y - 46, 156, 92, 12);
      c.add(g);
      c.add(this.add.text(x, y - 24, ok ? '★' : '☆', { fontFamily: FUENTE, fontSize: '24px', color: ok ? '#ffe14d' : '#4a5a7a' }).setOrigin(0.5));
      c.add(this.add.text(x, y + 2, personalizar(t(nombre)), { fontFamily: FUENTE, fontSize: '12px', fontStyle: '800', color: ok ? '#ffffff' : '#9fb3d1', align: 'center' }).setOrigin(0.5));
      c.add(this.add.text(x, y + 24, t(como), { fontFamily: FUENTE, fontSize: '11px', fontStyle: '700', color: '#8a9cbc', align: 'center', wordWrap: { width: 140 } }).setOrigin(0.5, 0.5));
    });
    // estrellas por misión
    c.add(this.add.text(W / 2, H / 2 + 112, t('ESTRELLAS POR MISIÓN'), { fontFamily: FUENTE_PIXEL, fontSize: '9px', color: '#3ff3ff' }).setOrigin(0.5));
    for (let k = 1; k <= TOTAL_MISIONES; k++) {
      const n = est[MISIONES[k - 1].clave] ?? 0, x = W / 2 - 55 * (TOTAL_MISIONES - 1) + (k - 1) * 110;
      c.add(this.add.text(x, H / 2 + 140, `M${k}  ${'★★★'.slice(0, n)}${'☆☆☆'.slice(0, 3 - n)}`, { fontFamily: FUENTE, fontSize: '15px', fontStyle: '800', color: n ? '#ffe14d' : '#4a5a7a' }).setOrigin(0.5));
    }
    c.add(boton(this, W / 2, H / 2 + 190, 'Cerrar', () => this.cerrarCapa(), { ancho: 200, alto: 42, tam: 15, variante: 'neutro', retardo: 0 }));
  }
}
