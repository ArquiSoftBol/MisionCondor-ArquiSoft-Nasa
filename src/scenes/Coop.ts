// MULTIJUGADOR · el mundo compartido (estilo «Among Us»: los dos se ven caminando por la Ciudadela del Salar).
//   RECOLECTOR: recorre el mapa, toma piezas (el carro aguanta 2 espacios; las pesadas ocupan los 2) y las entrega en el hangar.
//   INGENIERO: en su mesa recibe las piezas, decide qué va en cada lugar, calibra el montaje y pide lo que falta.
// El servidor es la autoridad (quién toma qué, si un montaje vale): aquí solo se dibuja y se envían intenciones.
import Phaser from 'phaser';
import { W, H, FUENTE, FUENTE_PIXEL, CSS } from '../config';
import { Actor, cargar, cuerposDe, empujar, type Cuerpo } from '../core/sprites';
import { Sonido } from '../core/audio';
import { t } from '../core/idioma';
import { Red } from '../core/red';
import { DECORADOS, piso } from '../ui/decorado';
import { aviso, boton, cintillo, panel, type Cintillo } from '../ui/boton';
import { destello, flotante } from '../ui/taller';
import { colorear } from '../ui/cine';
import { ROLES, type VistaSala } from './MultiLobby';
import { vineta } from '../ui/ambiente';
import { grano } from '../ui/cine';
import { costraDeSal, senderos, cartel, sombra, polvoPasos, faro, Oscuridad, presentarRol, NOMBRE_EDIFICIO } from '../ui/coopEstilo';
import { Palanca, esTactil } from '../ui/palanca';

type Rol = 'ingeniero' | 'recolector';
interface ItemDef { id: string; sprite: string; nombre: string; kg: number; sistema?: string | null; x: number; y: number; zona: string; rechazo?: string }
interface Escenario {
  nombre: string; descripcion: string; tiempo: number; cierre?: string;
  mapa: { ancho: number; alto: number; suelo: string; hora: string };
  inicio: Record<Rol, [number, number]>;
  mesa: { x: number; y: number; r: number; sprite: string };
  entrega: { x: number; y: number; r: number };
  decorados: { id: string; x: number; y: number; escala: number; solido: boolean }[];
  items: ItemDef[];
  receta: { tipo: 'sistemas' | 'orden'; ranuras?: string[]; masaMax?: number; orden?: string[] };
}
interface Estado { items: { id: string; estado: string; x: number; y: number }[]; carga: string[]; bandeja: string[]; montado: { id: string; sistema: string | null }[]; masa: number; errores: number; pedido: string | null; inicio: number; fin: { segundos: number; errores: number; estrellas: number } | null }

const VEL = 240;
const SISTEMA_NOMBRE: Record<string, string> = { energia: 'Energía', control: 'Control', comunicacion: 'Comunicación', propulsion: 'Propulsión' };

export class Coop extends Phaser.Scene {
  private esc!: Escenario;
  private rol!: Rol;
  private yo = 0;
  private sala!: VistaSala;
  private estado?: Estado;
  private yoA!: Actor;
  private otroA?: Actor;
  private otroObj = { x: 0, y: 0 };
  private etiquetas = new Map<Actor, Phaser.GameObjects.Text>();
  private items = new Map<string, { a: Actor; anillo: Phaser.GameObjects.Ellipse; tx: Phaser.GameObjects.Text; faro: Phaser.GameObjects.Image }>();
  private sombras = new Map<Actor, Phaser.GameObjects.Ellipse>();
  private polvo?: Phaser.GameObjects.Particles.ParticleEmitter;
  private pasoT = 0;
  private cargaIconos?: Phaser.GameObjects.Container;
  private cargaClave = '';
  private tecla?: Phaser.GameObjects.Container;
  private noche?: Oscuridad;
  private progreso?: Phaser.GameObjects.Graphics;
  private solidos: Cuerpo[] = [];
  private teclas!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursor!: Phaser.Types.Input.Keyboard.CursorKeys;
  private palanca!: Palanca;
  private ultimoEnvio = 0;
  private hud!: Phaser.GameObjects.Text;
  private reloj!: Phaser.GameObjects.Text;
  private objetivo!: Cintillo;
  private flecha!: Phaser.GameObjects.Triangle;
  private mini!: Phaser.GameObjects.Graphics;
  private mesaPanel?: Phaser.GameObjects.Container;
  private seleccion: string | null = null;
  private calib?: { aguja: number; dir: number; zona: [number, number]; g: Phaser.GameObjects.Graphics };
  private quitar: (() => void)[] = [];
  private terminado = false;

  constructor() { super('Coop'); }

  init(d: { esc: Escenario; rol: Rol; yo: number; sala: VistaSala }): void {
    this.esc = d.esc; this.rol = d.rol; this.yo = d.yo; this.sala = d.sala;
    this.estado = undefined; this.otroA = undefined; this.items = new Map(); this.etiquetas = new Map(); this.solidos = [];
    this.mesaPanel = undefined; this.seleccion = null; this.calib = undefined; this.terminado = false;
    this.sombras = new Map(); this.cargaIconos = undefined; this.cargaClave = ''; this.tecla = undefined; this.noche = undefined;
  }

  preload(): void {
    const ids = new Set<string>([...DECORADOS, ROLES.ingeniero.sprite, ROLES.recolector.sprite, this.esc.mesa.sprite]);
    this.esc.decorados.forEach(d => ids.add(d.id));
    this.esc.items.forEach(i => ids.add(i.sprite));
    cargar(this, [...ids]);
  }

  create(): void {
    const { ancho, alto, suelo, hora } = this.esc.mapa;
    this.cameras.main.fadeIn(500).setBounds(0, 0, ancho, alto).setBackgroundColor('#05070d');
    colorear(this, hora === 'noche' ? 'frio' : 'neutro');
    const noche = hora === 'noche';
    piso(this, suelo, 0, 0, ancho, alto, undefined, 1, noche ? 0x8c98c4 : 0xffffff).setDepth(-20);
    costraDeSal(this, ancho, alto, noche);
    const destinos = this.esc.decorados.filter(d => NOMBRE_EDIFICIO[d.id] && d.id !== 'hangar_ensamblaje');
    senderos(this, this.esc.entrega, destinos, noche ? 0x3ff3ff : 0xffb33f);
    // decorados con cuerpo
    this.esc.decorados.forEach(d => {
      const a = new Actor(this, d.x, d.y, d.id, { escala: d.escala, dir: 1 }).setDepth(d.y);
      if (hora === 'noche') a.base.setTint(0xc0c8e8);
      if (d.solido) this.solidos.push(...cuerposDe(a));
      // el cartel va delante del edificio; el del hangar, sobre el techo (abajo están la mesa y la entrega)
      if (NOMBRE_EDIFICIO[d.id]) cartel(this, d.x, d.id === 'hangar_ensamblaje' ? d.y - 190 : d.y + 46, NOMBRE_EDIFICIO[d.id], d.id === 'hangar_ensamblaje' ? 0xffb33f : 0x3ff3ff);
    });
    // mesa del ingeniero y zona de entrega
    const m = this.esc.mesa, e = this.esc.entrega;
    new Actor(this, m.x, m.y, m.sprite, { escala: 2.2, dir: 1 }).setDepth(m.y);
    this.add.ellipse(m.x, m.y + 6, m.r * 1.8, m.r * 0.7, 0x3ff3ff, 0.08).setStrokeStyle(3, 0x3ff3ff, 0.7).setDepth(-5);
    const giro = this.add.ellipse(m.x, m.y + 6, m.r * 1.4, m.r * 0.5).setStrokeStyle(2, 0x3ff3ff, 0.5).setDepth(-5);
    this.tweens.add({ targets: giro, scaleX: 1.25, scaleY: 1.25, alpha: 0, duration: 1600, repeat: -1 });
    this.add.text(m.x, m.y + 44, t('MESA DEL INGENIERO'), { fontFamily: FUENTE_PIXEL, fontSize: '8px', color: '#3ff3ff', backgroundColor: '#040914cc', padding: { x: 5, y: 3 } }).setOrigin(0.5).setDepth(5000);
    const zona = this.add.ellipse(e.x, e.y + 6, e.r * 1.8, e.r * 0.8, 0xffb33f, 0.08).setStrokeStyle(3, 0xffb33f, 0.8).setDepth(-5);
    const flechas = this.add.graphics().setDepth(-4);
    for (let k = 0; k < 4; k++) {   // chevrones que apuntan al centro de la plataforma
      const a = k * Math.PI / 2, cx = e.x + Math.cos(a) * e.r * 0.62, cy = e.y + 6 + Math.sin(a) * e.r * 0.28, d = 9;
      flechas.lineStyle(3, 0xffb33f, 0.9).beginPath().moveTo(cx - Math.cos(a - 0.8) * d, cy - Math.sin(a - 0.8) * d * 0.5).lineTo(cx, cy).lineTo(cx - Math.cos(a + 0.8) * d, cy - Math.sin(a + 0.8) * d * 0.5).strokePath();
    }
    this.tweens.add({ targets: flechas, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: zona, alpha: 0.4, duration: 800, yoyo: true, repeat: -1 });
    this.add.text(e.x, e.y + 50, t('ENTREGA DE PIEZAS'), { fontFamily: FUENTE_PIXEL, fontSize: '8px', color: '#ffb33f', backgroundColor: '#040914cc', padding: { x: 5, y: 3 } }).setOrigin(0.5).setDepth(5000);
    // piezas
    this.esc.items.forEach(i => {
      const haz = faro(this, i.x, i.y);
      const anillo = this.add.ellipse(i.x, i.y + 4, 70, 24).setStrokeStyle(2, 0x3ff3ff, 0.8).setDepth(i.y - 1);
      this.tweens.add({ targets: anillo, scaleX: 1.15, scaleY: 1.15, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
      const a = new Actor(this, i.x, i.y, i.sprite, { escala: i.kg >= 500 ? 1.1 : 1.4, dir: 1 }).setDepth(i.y);
      const tx = this.add.text(i.x, i.y + 20, t(i.nombre), { fontFamily: FUENTE, fontSize: '11px', fontStyle: '800', color: '#e8f6ff', backgroundColor: '#040914cc', padding: { x: 4, y: 2 } }).setOrigin(0.5, 0).setDepth(5000);
      this.items.set(i.id, { a, anillo, tx, faro: haz });
    });
    // los dos jugadores
    const [x0, y0] = this.esc.inicio[this.rol];
    this.yoA = new Actor(this, x0, y0, ROLES[this.rol].sprite, { escala: 2.3, dir: 1 }).pausar();
    const nombreYo = this.sala.jugadores.find(j => j.id === this.yo)?.nombre ?? '';
    this.etiquetar(this.yoA, `${nombreYo} · ${t(ROLES[this.rol].nombre)}`, ROLES[this.rol].color);
    const otroRol: Rol = this.rol === 'ingeniero' ? 'recolector' : 'ingeniero';
    const [x1, y1] = this.esc.inicio[otroRol];
    this.otroA = new Actor(this, x1, y1, ROLES[otroRol].sprite, { escala: 2.3, dir: 1 }).pausar();
    this.otroObj = { x: x1, y: y1 };
    const otro = this.sala.jugadores.find(j => j.id !== this.yo);
    this.etiquetar(this.otroA, `${otro?.nombre ?? '?'} · ${t(ROLES[otroRol].nombre)}`, ROLES[otroRol].color);
    this.cameras.main.startFollow(this.yoA, true, 0.12, 0.12);
    [this.yoA, this.otroA].forEach(a => this.sombras.set(a, sombra(this)));
    this.polvo = polvoPasos(this);
    if (noche) this.noche = new Oscuridad(this);
    vineta(this, noche ? 0.55 : 0.35, 41000);
    grano(this, 41001, 0.05);
    const tareas = this.rol === 'recolector'
      ? ['Sigue los faros: cada uno marca una pieza.', 'Tu carro lleva 2 espacios; las piezas pesadas ocupan los dos.', 'Déjalas en la plataforma naranja del hangar (E).', 'Si una pieza brilla dorada, el Ingeniero la necesita ya.']
      : ['Tu mesa está en el hangar: ábrela con E.', 'Elige una pieza, calibra con la aguja y móntala.', 'Devuelve lo que no sirve y pide lo que falta.', 'Cuidado: cada error cuesta estrellas.'];
    const lema = this.rol === 'recolector' ? 'Tú conoces la Ciudadela. Sigue los faros dorados y trae lo que pidan.' : 'Tú conoces el plano. Pide lo que falta, revisa la masa, calibra.';
    presentarRol(this, ROLES[this.rol].nombre, ROLES[this.rol].color, tareas, () => undefined, lema);

    this.interfaz();
    const kb = this.input.keyboard!;
    this.cursor = kb.createCursorKeys();
    this.palanca = new Palanca(this);
    this.teclas = kb.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown', (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      if (ev.key === 'e' || ev.key === 'E' || ev.key === ' ') this.usar();
      if (ev.key === 'Escape') this.cerrarMesa();
    });

    this.quitar.push(
      Red.on('estado', m => this.aplicar(m as unknown as Estado)),
      Red.on('pos', m => { if (m.id !== this.yo) { this.otroObj = { x: m.x as number, y: m.y as number }; if (this.otroA) { this.otroA.mirar(m.dir as number); if (m.mov) this.otroA.seguir(); else this.otroA.pausar(); } } }),
      Red.on('evento', m => this.evento(m)),
      Red.on('aviso', m => aviso(this, String(m.msg), CSS.amarillo, 110)),
      Red.on('fin', m => this.fin(m)),
      Red.on('sala', m => { this.sala = m.sala as VistaSala; if (this.sala.fase === 'espera' && this.terminado) this.scene.start('MultiLobby', { sala: this.sala }); }),
      Red.on('conexion', m => { if (!m.ok) aviso(this, 'Se cortó la conexión: reconectando…', CSS.rojo, 110); }),
    );
    this.events.once('shutdown', () => { this.quitar.forEach(f => f()); this.quitar = []; });
    if (Red.ultimo.estado) this.aplicar(Red.ultimo.estado as unknown as Estado);   // el primer estado llega antes de que la escena escuche
  }

  private etiquetar(a: Actor, txt: string, color: number): void {
    const e = this.add.text(a.x, a.y - 92, txt, { fontFamily: FUENTE, fontSize: '12px', fontStyle: '800', color: '#ffffff', backgroundColor: '#' + color.toString(16).padStart(6, '0') + 'cc', padding: { x: 6, y: 2 } }).setOrigin(0.5).setDepth(6000);
    this.etiquetas.set(a, e);
  }

  // ───────── interfaz ─────────
  private interfaz(): void {
    const r = ROLES[this.rol];
    const caja = this.add.graphics().setScrollFactor(0).setDepth(90000);
    caja.fillStyle(0x040914, 0.88).fillRoundedRect(12, 60, 270, 166, 12).lineStyle(2, r.color, 0.8).strokeRoundedRect(12, 60, 270, 166, 12);
    caja.fillStyle(r.color, 0.22).fillRoundedRect(12, 60, 270, 28, { tl: 12, tr: 12, bl: 0, br: 0 }).fillStyle(r.color, 1).fillRect(12, 87, 270, 2);
    this.progreso = this.add.graphics().setScrollFactor(0).setDepth(90001);
    this.add.text(26, 69, t(r.nombre).toUpperCase(), { fontFamily: FUENTE_PIXEL, fontSize: '10px', color: '#' + r.color.toString(16).padStart(6, '0') }).setScrollFactor(0).setDepth(90001);
    this.reloj = this.add.text(268, 69, '', { fontFamily: FUENTE_PIXEL, fontSize: '10px', color: '#ffffff' }).setOrigin(1, 0).setScrollFactor(0).setDepth(90001);
    this.hud = this.add.text(26, 98, '', { fontFamily: FUENTE, fontSize: '12px', fontStyle: '700', color: '#e8f6ff', lineSpacing: 3, wordWrap: { width: 245 } }).setScrollFactor(0).setDepth(90001);
    this.objetivo = cintillo(this, this.rol === 'recolector' ? 'Busca las piezas y llévalas a la entrega del hangar' : 'Ve a tu mesa (E) y arma la nave con lo que te traigan', '◎');
    this.objetivo.setDepth(90000);
    this.flecha = this.add.triangle(0, 0, 0, -12, 24, 0, 0, 12, 0xffe14d).setScrollFactor(0).setDepth(90000).setVisible(false);
    this.mini = this.add.graphics().setScrollFactor(0).setDepth(90000);
    const usar = boton(this, W - 86, H - 64, 'USAR', () => this.usar(), { ancho: 130, alto: 60, variante: 'primario', retardo: 0 });
    usar.setScrollFactor(0, 0, true).setDepth(90001);
    this.add.text(W - 16, H - 12, t(esTactil() ? 'Palanca: moverse · USAR: usar' : 'WASD / flechas: moverse · E: usar'), { fontFamily: FUENTE_PIXEL, fontSize: '7px', color: '#7f93b5' }).setOrigin(1, 1).setScrollFactor(0).setDepth(90001);
  }

  private def(id: string): ItemDef { return this.esc.items.find(i => i.id === id)!; }

  private pintarHud(): void {
    const e = this.estado;
    if (!e) return;
    const r = this.esc.receta, lineas: string[] = [];
    if (r.tipo === 'sistemas') r.ranuras!.forEach(k => { const m = e.montado.find(x => x.sistema === k); lineas.push(`${m ? '✔' : '□'} ${t(SISTEMA_NOMBRE[k])}${m ? ` · ${t(this.def(m.id).nombre)}` : ''}`); });
    else r.orden!.forEach((n, i) => lineas.push(`${i < e.montado.length ? '✔' : '□'} ${i + 1}. ${t(n)}`));
    if (r.masaMax) lineas.push(`${t('Masa')}: ${e.masa} / ${r.masaMax} kg`);
    if (this.rol === 'recolector') lineas.push(`${t('Carro')}: ${e.carga.length ? e.carga.map(id => t(this.def(id).nombre)).join(', ') : t('vacío')}`);
    else lineas.push(`${t('En la mesa')}: ${e.bandeja.length} ${t('pieza(s)')}`);
    if (e.pedido) lineas.push(`${t('Pedido')}: ${t(this.def(e.pedido).nombre)}`);
    this.hud.setText(lineas.join('\n'));
    const total = r.tipo === 'sistemas' ? r.ranuras!.length : r.orden!.length, k = e.montado.length / total;
    this.progreso?.clear().fillStyle(0x1b2740, 1).fillRoundedRect(26, 212, 242, 6, 3).fillStyle(k >= 1 ? 0x3cff6a : ROLES[this.rol].color, 1).fillRoundedRect(26, 212, Math.max(6, 242 * k), 6, 3);
  }

  private aplicar(e: Estado): void {
    this.estado = e;
    e.items.forEach(i => {
      const v = this.items.get(i.id);
      if (!v) return;
      const libre = i.estado === 'libre';
      [v.a, v.anillo, v.tx, v.faro].forEach(o => o.setVisible(libre));
      if (libre) { v.a.setPosition(i.x, i.y); v.anillo.setPosition(i.x, i.y + 4); v.tx.setPosition(i.x, i.y + 20); v.faro.setPosition(i.x, i.y + 6); }
      v.faro.setTint(e.pedido === i.id ? 0xffe14d : 0x3ff3ff);
      v.anillo.setStrokeStyle(e.pedido === i.id ? 4 : 2, e.pedido === i.id ? 0xffe14d : 0x3ff3ff, 0.9);
    });
    this.pintarHud();
    if (this.mesaPanel) this.abrirMesa();   // refresca la mesa abierta
  }

  private evento(m: Record<string, unknown>): void {
    const nombre = m.item ? t(this.def(String(m.item)).nombre) : '';
    if (m.tipo === 'entrega') { Sonido.bien(); flotante(this, this.esc.entrega.x, this.esc.entrega.y - 60, '+', '#ffb33f'); }
    if (m.tipo === 'montado') { Sonido.bien(); destello(this, this.esc.mesa.x, this.esc.mesa.y - 30, 0x3cff6a); aviso(this, t('{p} montado', { p: nombre }), CSS.verde, 110); }
    if (m.tipo === 'rechazo') { Sonido.mal(); this.cameras.main.shake(150, 0.004); aviso(this, String(m.msg), CSS.rojo, 110); }
    if (m.tipo === 'calibracion') { Sonido.mal(); aviso(this, t('Calibración fallida: {p} no encajó. Inténtalo otra vez.', { p: nombre }), CSS.rojo, 110); }
  }

  // ───────── acciones ─────────
  private usar(): void {
    if (!this.estado || this.terminado) return;
    if (this.mesaPanel) { if (this.calib) this.montar(); return; }
    const { x, y } = this.yoA;
    if (this.rol === 'recolector') {
      const e = this.esc.entrega;
      if (this.estado.carga.length && Math.hypot(x - e.x, y - e.y) < e.r + 30) { Red.enviar({ t: 'entregar' }); return; }
      const libre = this.estado.items.filter(i => i.estado === 'libre').map(i => ({ i, d: Math.hypot(i.x - x, i.y - y) })).sort((a, b) => a.d - b.d)[0];
      if (libre && libre.d < 100) { Red.enviar({ t: 'tomar', item: libre.i.id }); Sonido.click(); return; }
      aviso(this, 'Acércate a una pieza o a la entrega del hangar', CSS.gris, 110);
    } else {
      const m = this.esc.mesa;
      if (Math.hypot(x - m.x, y - m.y) < m.r + 40) this.abrirMesa();
      else aviso(this, 'Tu mesa está en el hangar', CSS.gris, 110);
    }
  }

  // ───────── mesa del ingeniero ─────────
  private abrirMesa(): void {
    const e = this.estado!;
    this.mesaPanel?.destroy();
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(95000);
    this.mesaPanel = c;
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x02040a, 0.6).setInteractive());
    c.add(panel(this, W / 2, H / 2 + 6, 900, 470, { titulo: 'MESA DE ENSAMBLAJE', color: 0x3ff3ff, abrir: false }));
    // bandeja
    c.add(this.add.text(70, 70, t('PIEZAS RECIBIDAS'), { fontFamily: FUENTE_PIXEL, fontSize: '9px', color: '#ffb33f' }));
    if (!e.bandeja.length) c.add(this.add.text(70, 100, t('Todavía no llegó nada.\nPídele piezas al Recolector →'), { fontFamily: FUENTE, fontSize: '13px', fontStyle: '700', color: '#8a9cbc', lineSpacing: 4 }));
    e.bandeja.forEach((id, i) => {
      const d = this.def(id), x = 112 + (i % 3) * 96, y = 140 + Math.floor(i / 3) * 112, sel = this.seleccion === id;
      const g = this.add.graphics().fillStyle(sel ? 0x0e2a3e : 0x0b1222, 1).fillRoundedRect(x - 44, y - 50, 88, 104, 10).lineStyle(2, sel ? 0xffe14d : 0x3a4d74, 1).strokeRoundedRect(x - 44, y - 50, 88, 104, 10);
      const a = new Actor(this, x, y + 12, d.sprite, { escala: d.kg >= 500 ? 0.8 : 1.1, dir: 1 }).pausar();
      const n = this.add.text(x, y + 22, t(d.nombre), { fontFamily: FUENTE, fontSize: '10px', fontStyle: '800', color: '#ffffff', align: 'center', wordWrap: { width: 82 } }).setOrigin(0.5, 0);
      const kg = this.add.text(x, y - 44, `${d.kg} kg`, { fontFamily: FUENTE_PIXEL, fontSize: '7px', color: '#ffe14d' }).setOrigin(0.5, 0);
      const z = this.add.zone(x, y, 88, 104).setInteractive({ useHandCursor: true }).on('pointerdown', () => { Sonido.click(); this.seleccion = id; this.calib = undefined; this.abrirMesa(); });
      c.add([g, a, n, kg, z]);
    });
    // ranuras / orden
    const r = this.esc.receta, x0 = 400;
    c.add(this.add.text(x0, 70, t(r.tipo === 'sistemas' ? 'SISTEMAS DE LA NAVE' : 'ORDEN DE MONTAJE'), { fontFamily: FUENTE_PIXEL, fontSize: '9px', color: '#3ff3ff' }));
    const filas = r.tipo === 'sistemas' ? r.ranuras!.map(k => [t(SISTEMA_NOMBRE[k]), e.montado.find(m => m.sistema === k)?.id] as const) : r.orden!.map((n, i) => [`${i + 1}. ${t(n)}`, e.montado[i]?.id] as const);
    filas.forEach(([nombre, id], i) => {
      const y = 100 + i * 34;
      c.add(this.add.text(x0, y, `${id ? '✔' : '□'}  ${nombre}`, { fontFamily: FUENTE, fontSize: '14px', fontStyle: '800', color: id ? '#7dff9c' : '#ffffff' }));
      if (id) c.add(this.add.text(x0 + 250, y + 2, t(this.def(id).nombre), { fontFamily: FUENTE, fontSize: '11px', fontStyle: '700', color: '#9fb3d1' }).setOrigin(1, 0));
    });
    if (r.masaMax) {
      const y = 100 + filas.length * 34 + 6, frac = Math.min(1, e.masa / r.masaMax);
      c.add(this.add.rectangle(x0, y + 8, 250, 10, 0x1b2740).setOrigin(0, 0.5));
      c.add(this.add.rectangle(x0, y + 8, 250 * frac, 10, e.masa > r.masaMax ? 0xff4a3d : 0x3ff3ff).setOrigin(0, 0.5));
      c.add(this.add.text(x0, y + 20, `${t('Masa')}: ${e.masa} / ${r.masaMax} kg`, { fontFamily: FUENTE, fontSize: '11px', fontStyle: '700', color: '#c8d6ec' }));
    }
    // catálogo para pedir
    const x1 = 690;
    c.add(this.add.text(x1, 70, t('PEDIR AL RECOLECTOR'), { fontFamily: FUENTE_PIXEL, fontSize: '9px', color: '#ffb33f' }));
    this.esc.items.forEach((d, i) => {
      const est = e.items.find(it => it.id === d.id)?.estado ?? 'libre', y = 96 + i * 30, pedido = e.pedido === d.id;
      const disponible = est === 'libre';
      const tx = this.add.text(x1, y, `${pedido ? '★ ' : ''}${t(d.nombre)}`, { fontFamily: FUENTE, fontSize: '12px', fontStyle: '800', color: !disponible ? '#4a5a7a' : pedido ? '#ffe14d' : '#ffffff' });
      const zona = this.add.text(x1, y + 14, t(d.zona), { fontFamily: FUENTE, fontSize: '9px', fontStyle: '700', color: '#7f93b5' });
      c.add([tx, zona]);
      if (disponible) {
        const z = this.add.zone(x1 + 90, y + 12, 200, 28).setInteractive({ useHandCursor: true }).on('pointerdown', () => { Sonido.click(); Red.enviar({ t: 'pedir', item: pedido ? null : d.id }); });
        c.add(z);
      }
    });
    // acción sobre la pieza elegida: calibrar y montar, o devolver
    if (this.seleccion && e.bandeja.includes(this.seleccion)) {
      const d = this.def(this.seleccion);
      c.add(this.add.text(400, 330, `${t('Montar')}: ${t(d.nombre)}`, { fontFamily: FUENTE, fontSize: '15px', fontStyle: '800', color: '#ffe14d' }));
      c.add(this.add.text(400, 352, t('Detén la aguja en la zona verde para calibrar.'), { fontFamily: FUENTE, fontSize: '11px', fontStyle: '700', color: '#c8d6ec' }));
      if (!this.calib) { const z0 = 0.2 + Math.random() * 0.55; this.calib = { aguja: 0, dir: 1, zona: [z0, z0 + 0.16], g: this.add.graphics() }; }
      else this.calib.g = this.add.graphics();
      c.add(this.calib.g);
      c.add(boton(this, 470, 438, 'MONTAR', () => this.montar(), { ancho: 160, alto: 44, variante: 'exito', icono: 'ico_engranaje', retardo: 0 }));
      c.add(boton(this, 640, 438, 'Devolver', () => { Red.enviar({ t: 'descartar', item: this.seleccion }); this.seleccion = null; this.calib = undefined; }, { ancho: 150, alto: 44, variante: 'peligro', retardo: 0 }));
    } else this.calib = undefined;
    c.add(boton(this, W / 2 + 330, 494, 'Cerrar', () => this.cerrarMesa(), { ancho: 140, alto: 40, tam: 14, variante: 'neutro', retardo: 0 }));
  }

  private cerrarMesa(): void { this.mesaPanel?.destroy(); this.mesaPanel = undefined; this.calib = undefined; }

  private montar(): void {
    if (!this.calib || !this.seleccion) return;
    const { aguja, zona } = this.calib;
    const calibrado = aguja >= zona[0] && aguja <= zona[1];
    Red.enviar({ t: 'montar', item: this.seleccion, calibrado });
    this.seleccion = null; this.calib = undefined;
  }

  private pintarCalibracion(dt: number): void {
    const c = this.calib;
    if (!c || !c.g.active) return;
    c.aguja += c.dir * dt * 0.9;
    if (c.aguja > 1) { c.aguja = 1; c.dir = -1; } else if (c.aguja < 0) { c.aguja = 0; c.dir = 1; }
    const x = 400, y = 384, w = 330;
    c.g.clear().fillStyle(0x0b1222, 1).fillRoundedRect(x, y, w, 18, 6).fillStyle(0x3cff6a, 0.85).fillRect(x + w * c.zona[0], y, w * (c.zona[1] - c.zona[0]), 18);
    c.g.fillStyle(0xffffff, 1).fillRect(x + w * c.aguja - 2, y - 6, 4, 30);
  }

  // ───────── bucle ─────────
  update(time: number, dtms: number): void {
    const dt = dtms / 1000;
    this.pintarCalibracion(dt);
    // movimiento propio
    let dx = 0, dy = 0;
    if (!this.mesaPanel && !this.terminado) {
      const k = this.teclas, c = this.cursor;
      if (c.left.isDown || k.A.isDown) dx -= 1;
      if (c.right.isDown || k.D.isDown) dx += 1;
      if (c.up.isDown || k.W.isDown) dy -= 1;
      if (c.down.isDown || k.S.isDown) dy += 1;
      if (this.palanca.activa) { dx = this.palanca.vx; dy = this.palanca.vy; }
      const p = this.input.activePointer;
      if (!dx && !dy && p.isDown && !this.palanca.activa && !(p.x > W - 170 && p.y > H - 110)) { const wx = p.worldX - this.yoA.x, wy = p.worldY - this.yoA.y; if (Math.hypot(wx, wy) > 24) { dx = wx; dy = wy; } }
    }
    const mov = !!(dx || dy);
    if (mov) {
      const n = Math.hypot(dx, dy), carga = this.rol === 'recolector' && this.estado?.carga.length ? 0.8 : 1;
      let nx = Phaser.Math.Clamp(this.yoA.x + (dx / n) * VEL * carga * dt, 30, this.esc.mapa.ancho - 30);
      let ny = Phaser.Math.Clamp(this.yoA.y + (dy / n) * VEL * carga * dt, 60, this.esc.mapa.alto - 20);
      for (const cu of this.solidos) { const r = empujar(cu, nx, ny, 18); if (r) { nx = r.x; ny = r.y; } }
      this.yoA.setPosition(nx, ny).mirarHacia(dx, dy).seguir();
    } else this.yoA.pausar();
    this.yoA.setDepth(this.yoA.y);
    if (time - this.ultimoEnvio > (mov ? 90 : 1000)) { this.ultimoEnvio = time; Red.enviar({ t: 'pos', x: Math.round(this.yoA.x), y: Math.round(this.yoA.y), dir: this.yoA.dir, mov }); }
    // el compañero se desliza hacia su última posición conocida
    if (this.otroA) {
      this.otroA.x += (this.otroObj.x - this.otroA.x) * 0.2; this.otroA.y += (this.otroObj.y - this.otroA.y) * 0.2;
      this.otroA.setDepth(this.otroA.y);
    }
    this.etiquetas.forEach((e, a) => e.setPosition(a.x, a.y - 92));
    this.sombras.forEach((sh, a) => sh.setPosition(a.x, a.y + 2).setDepth(a.y - 3));
    if (mov && time - this.pasoT > 110) { this.pasoT = time; this.polvo?.emitParticleAt(this.yoA.x, this.yoA.y + 2, 2); }
    this.pintarCarga();
    this.pintarTecla();
    if (this.noche) {
      const luces: [number, number, number][] = [[this.yoA.x, this.yoA.y - 30, 230], [this.esc.mesa.x, this.esc.mesa.y, 200], [this.esc.entrega.x, this.esc.entrega.y, 190]];
      if (this.otroA) luces.push([this.otroA.x, this.otroA.y - 30, 190]);
      this.estado?.items.forEach(i => { if (i.estado === 'libre') luces.push([i.x, i.y - 20, this.estado!.pedido === i.id ? 150 : 110]); });
      this.esc.decorados.forEach(d => { if (NOMBRE_EDIFICIO[d.id]) luces.push([d.x, d.y + 30, 120]); });
      this.noche.pintar(luces);
    }
    this.guia();
    this.minimapa();
    if (this.estado) {
      const s = Math.max(0, Math.floor(((this.estado.fin ? this.estado.inicio + this.estado.fin.segundos * 1000 : Date.now()) - this.estado.inicio) / 1000));
      this.reloj.setText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} / ${Math.floor(this.esc.tiempo / 60)}:${String(this.esc.tiempo % 60).padStart(2, '0')}`).setColor(s > this.esc.tiempo ? '#ff8a7a' : '#ffffff');
    }
  }

  /** Las piezas que lleva el Recolector flotan sobre su cabeza (las ven los dos jugadores). */
  private pintarCarga(): void {
    const carga = this.estado?.carga ?? [], clave = carga.join(',');
    const quien = this.rol === 'recolector' ? this.yoA : this.otroA;
    if (clave !== this.cargaClave) {
      this.cargaClave = clave;
      this.cargaIconos?.destroy(); this.cargaIconos = undefined;
      if (carga.length) {
        const c = this.add.container(0, 0).setDepth(6500);
        carga.forEach((id, i) => {
          const x = (i - (carga.length - 1) / 2) * 40;
          c.add(this.add.ellipse(x, 0, 38, 38, 0x040914, 0.85).setStrokeStyle(2, 0xffb33f, 1));
          c.add(new Actor(this, x, 10, this.def(id).sprite, { escala: 0.55, dir: 1 }).pausar());
        });
        this.cargaIconos = c;
      }
    }
    if (this.cargaIconos && quien) this.cargaIconos.setPosition(quien.x, quien.y - 128 + Math.sin(this.time.now / 250) * 3);
  }

  /** Burbuja «E» cuando hay algo que hacer cerca. */
  private pintarTecla(): void {
    let donde: { x: number; y: number } | null = null;
    if (this.estado && !this.terminado && !this.mesaPanel) {
      const { x, y } = this.yoA;
      if (this.rol === 'recolector') {
        const e = this.esc.entrega;
        if (this.estado.carga.length && Math.hypot(x - e.x, y - e.y) < e.r + 30) donde = e;
        else {
          const cerca = this.estado.items.find(i => i.estado === 'libre' && Math.hypot(i.x - x, i.y - y) < 100);
          if (cerca) donde = cerca;
        }
      } else {
        const m = this.esc.mesa;
        if (Math.hypot(x - m.x, y - m.y) < m.r + 40) donde = m;
      }
    }
    if (!donde) { this.tecla?.setVisible(false); return; }
    if (!this.tecla) {
      const g = this.add.graphics().fillStyle(0xffffff, 1).fillRoundedRect(-14, -14, 28, 28, 6).lineStyle(3, 0x0b1222, 1).strokeRoundedRect(-14, -14, 28, 28, 6);
      const tx = this.add.text(0, 0, 'E', { fontFamily: FUENTE_PIXEL, fontSize: '12px', color: '#0b1222' }).setOrigin(0.5);
      this.tecla = this.add.container(0, 0, [g, tx]).setDepth(7000);
      this.tweens.add({ targets: this.tecla, scale: 1.12, duration: 380, yoyo: true, repeat: -1 });
    }
    this.tecla.setVisible(true).setPosition(this.yoA.x + 46, this.yoA.y - 70);   // junto al jugador, sin tapar su nombre
  }

  /** Flecha y cintillo: a dónde ir ahora. */
  private guia(): void {
    const e = this.estado;
    let destino: { x: number; y: number } | null = null, texto = '';
    if (e && !this.terminado) {
      if (this.rol === 'recolector') {
        if (e.carga.length) { destino = this.esc.entrega; texto = t('Lleva el carro a la entrega del hangar (E)'); }
        else if (e.pedido) { const i = e.items.find(x => x.id === e.pedido); if (i?.estado === 'libre') { destino = i; texto = t('El Ingeniero pide: {p} · {z}', { p: t(this.def(i.id).nombre), z: t(this.def(i.id).zona) }); } }
        if (!texto) texto = t('Busca las piezas y llévalas a la entrega del hangar');
      } else {
        const m = this.esc.mesa, lejos = Math.hypot(this.yoA.x - m.x, this.yoA.y - m.y) > m.r + 40;
        if (lejos) destino = m;
        texto = e.bandeja.length ? t('Hay {n} pieza(s) en tu mesa: ármalas (E)', { n: e.bandeja.length }) : t('Pide piezas desde tu mesa y espera al Recolector');
      }
    }
    if (texto && this.objetivo.texto?.text !== texto) this.objetivo.texto?.setText(texto);
    if (!destino) { this.flecha.setVisible(false); return; }
    const cam = this.cameras.main, sx = destino.x - cam.scrollX, sy = destino.y - cam.scrollY;
    const dentro = sx > 40 && sx < W - 40 && sy > 60 && sy < H - 60;
    const a = Math.atan2(sy - H / 2, sx - W / 2);
    this.flecha.setVisible(true);
    if (dentro) this.flecha.setPosition(sx, sy - 80).setRotation(Math.PI / 2);
    else this.flecha.setPosition(W / 2 + Math.cos(a) * (W / 2 - 50), H / 2 + Math.sin(a) * (H / 2 - 60)).setRotation(a);
  }

  private minimapa(): void {
    const g = this.mini.clear(), mw = 180, mh = 118, x0 = W - mw - 12, y0 = 60, k = mw / this.esc.mapa.ancho;
    g.fillStyle(0x040914, 0.8).fillRoundedRect(x0 - 4, y0 - 4, mw + 8, mh + 8, 8).lineStyle(1, 0x3a4d74, 1).strokeRoundedRect(x0 - 4, y0 - 4, mw + 8, mh + 8, 8);
    this.esc.decorados.forEach(d => g.fillStyle(0x3a4d74, 1).fillRect(x0 + d.x * k - 3, y0 + d.y * k - 3, 6, 6));
    this.estado?.items.forEach(i => { if (i.estado === 'libre') g.fillStyle(this.estado!.pedido === i.id ? 0xffe14d : 0x3ff3ff, 1).fillCircle(x0 + i.x * k, y0 + i.y * k, 2.2); });
    g.fillStyle(0xffb33f, 1).fillCircle(x0 + this.esc.entrega.x * k, y0 + this.esc.entrega.y * k, 3);
    if (this.otroA) g.fillStyle(ROLES[this.rol === 'ingeniero' ? 'recolector' : 'ingeniero'].color, 1).fillCircle(x0 + this.otroA.x * k, y0 + this.otroA.y * k, 3.5);
    g.fillStyle(0xffffff, 1).fillCircle(x0 + this.yoA.x * k, y0 + this.yoA.y * k, 4);
  }

  // ───────── final ─────────
  private fin(m: Record<string, unknown>): void {
    this.terminado = true;
    this.cerrarMesa();
    Sonido.bien();
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(98000);
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x02040a, 0.7).setInteractive());
    c.add(panel(this, W / 2, H / 2, 640, 420, { titulo: 'MISIÓN EN EQUIPO CUMPLIDA', color: 0x3cff6a }));
    const n = m.estrellas as number;
    c.add(this.add.text(W / 2, 130, '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n), { fontFamily: FUENTE, fontSize: '46px', color: '#ffe14d', stroke: '#5a3a00', strokeThickness: 6 }).setOrigin(0.5));
    c.add(this.add.text(W / 2, 186, t(this.esc.nombre), { fontFamily: FUENTE, fontSize: '18px', fontStyle: '800', color: CSS.verde }).setOrigin(0.5));
    c.add(this.add.text(W / 2, 216, t('Tiempo: {s} s · Errores: {e}', { s: m.segundos as number, e: m.errores as number }), { fontFamily: FUENTE, fontSize: '14px', fontStyle: '700', color: '#ffffff' }).setOrigin(0.5));
    c.add(this.add.text(W / 2, 252, t('MEJORES EQUIPOS'), { fontFamily: FUENTE_PIXEL, fontSize: '9px', color: '#3ff3ff' }).setOrigin(0.5));
    ((m.ranking as { estrellas: number; segundos: number; ingeniero: string; recolector: string }[]) ?? []).slice(0, 4).forEach((r, i) => {   // 4 filas: abajo va el cierre del capítulo
      c.add(this.add.text(W / 2, 276 + i * 20, `${i + 1}. ${'★'.repeat(r.estrellas)}  ${r.segundos}s  ·  ${r.ingeniero ?? '?'} + ${r.recolector ?? '?'}`, { fontFamily: FUENTE, fontSize: '12px', fontStyle: '700', color: '#c8d6ec' }).setOrigin(0.5));
    });
    // cierre del capítulo («Turno de noche»): si amaneció antes de terminar, otro texto
    const tarde = (m.segundos as number) > this.esc.tiempo;
    const cierre = tarde ? 'Amaneció antes de terminar… pero la nave quedó lista. La próxima noche, antes del alba.' : this.esc.cierre;
    if (cierre) c.add(this.add.text(W / 2, 372, t(cierre), { fontFamily: FUENTE, fontSize: '13px', fontStyle: 'italic 700', color: tarde ? '#ffc58a' : '#ffe9b0', align: 'center', wordWrap: { width: 580 } }).setOrigin(0.5));
    c.add(boton(this, W / 2 - 130, 420, 'Otra partida', () => Red.enviar({ t: 'otra' }), { ancho: 220, alto: 44, variante: 'exito', icono: '↺', retardo: 0 }));
    c.add(boton(this, W / 2 + 130, 420, 'Salir', () => { Red.salirDeSala(); this.scene.start('Titulo'); }, { ancho: 220, alto: 44, variante: 'neutro', retardo: 0 }));
  }
}
