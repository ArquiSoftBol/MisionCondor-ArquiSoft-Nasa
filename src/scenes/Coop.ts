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
import { aviso, boton, cintillo, panel, fijarEnPantalla, type Cintillo } from '../ui/boton';
import { destello, flotante } from '../ui/taller';
import { colorear } from '../ui/cine';
import { ROLES, type VistaSala } from './MultiLobby';
import { vineta } from '../ui/ambiente';
import { grano } from '../ui/cine';
import { costraDeSal, senderos, cartel, sombra, polvoPasos, faro, Oscuridad, NOMBRE_EDIFICIO } from '../ui/coopEstilo';
import { guiaCoop } from '../ui/guiaCoop';
import { Palanca, esTactil } from '../ui/palanca';
import { Personaje, hojasDe, POSES, type Pose } from '../ui/personaje';
import { veredicto, sugerenciaPedido, piezaParaMontar, calibracionValida, moverAguja, paseo, posicionEn, type Msg, type Companero, type ItemDef, type Receta, type EstadoCoop, SISTEMA_NOMBRE } from '../core/coopLogica';

type Rol = 'ingeniero' | 'recolector';
interface Escenario {
  nombre: string; descripcion: string; tiempo: number; cierre?: string;
  mapa: { ancho: number; alto: number; suelo: string; hora: string };
  inicio: Record<Rol, [number, number]>;
  mesa: { x: number; y: number; r: number; sprite: string };
  entrega: { x: number; y: number; r: number };
  decorados: { id: string; x: number; y: number; escala: number; solido: boolean }[];
  items: ItemDef[];
  receta: Receta;
  companeros?: Companero[];
}
type Estado = EstadoCoop;

const VEL = 240;
/** Mensaje de las reglas → texto traducido (los valores que son palabras también se traducen). */
const tm = (m: Msg | null): string => m ? t(m.k, Object.fromEntries(Object.entries(m.p ?? {}).map(([k, v]) => [k, typeof v === 'string' ? t(v) : v]))) : '';
// los alienígenas se mueven aunque estén parados (flotan, saltan); la gente y la llama se quedan de pie
['alien_gelatina', 'alien_amigo', 'alien_medusa'].forEach(id => { POSES[id] = { quieto: id, camina: id }; });

/** Un compañero del mapa (no lo controla nadie): pasea, mira a quien se acerca y conversa. */
interface Npc { def: Companero; p: Personaje; ruta: [number, number][]; burbuja?: Phaser.GameObjects.Container; frase: number; cerca: boolean; nombre: Phaser.GameObjects.Text }

export class Coop extends Phaser.Scene {
  private esc!: Escenario;
  private rol!: Rol;
  private yo = 0;
  private sala!: VistaSala;
  private estado?: Estado;
  private yoA!: Personaje;
  private otroA?: Personaje;
  private otroPose: Pose = 'quieto';
  private npcs: Npc[] = [];
  private otroObj = { x: 0, y: 0 };
  private etiquetas = new Map<Phaser.GameObjects.Container, Phaser.GameObjects.Text>();
  private items = new Map<string, { a: Actor; anillo: Phaser.GameObjects.Ellipse; tx: Phaser.GameObjects.Text; faro: Phaser.GameObjects.Image }>();
  private sombras = new Map<Phaser.GameObjects.Container, Phaser.GameObjects.Ellipse>();
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
  private desfase = 0;   // hora del servidor − hora de este aparato (los celulares suelen tener el reloj corrido)
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
  private dialogo?: Phaser.GameObjects.Container;   // confirmación de salida / compañero que se fue

  constructor() { super('Coop'); }

  init(d: { esc: Escenario; rol: Rol; yo: number; sala: VistaSala }): void {
    this.esc = d.esc; this.rol = d.rol; this.yo = d.yo; this.sala = d.sala;
    this.estado = undefined; this.otroA = undefined; this.items = new Map(); this.etiquetas = new Map(); this.solidos = [];
    this.mesaPanel = undefined; this.seleccion = null; this.calib = undefined; this.terminado = false; this.dialogo = undefined;
    this.sombras = new Map(); this.npcs = []; this.otroPose = 'quieto'; this.cargaIconos = undefined; this.cargaClave = ''; this.tecla = undefined; this.noche = undefined;
  }

  preload(): void {
    const ids = new Set<string>([...DECORADOS, ...hojasDe(ROLES.ingeniero.sprite), ...hojasDe(ROLES.recolector.sprite), this.esc.mesa.sprite]);
    (this.esc.companeros ?? []).forEach(c => hojasDe(c.sprite).forEach(id => ids.add(id)));
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
    this.yoA = new Personaje(this, x0, y0, ROLES[this.rol].sprite, { escala: 2.3, dir: 1 });
    const nombreYo = this.sala.jugadores.find(j => j.id === this.yo)?.nombre ?? '';
    this.etiquetar(this.yoA, `${nombreYo} · ${t(ROLES[this.rol].nombre)}`, ROLES[this.rol].color);
    const otroRol: Rol = this.rol === 'ingeniero' ? 'recolector' : 'ingeniero';
    const [x1, y1] = this.esc.inicio[otroRol];
    this.otroA = new Personaje(this, x1, y1, ROLES[otroRol].sprite, { escala: 2.3, dir: 1 });
    this.otroObj = { x: x1, y: y1 };
    const otro = this.sala.jugadores.find(j => j.id !== this.yo);
    this.etiquetar(this.otroA, `${otro?.nombre ?? '?'} · ${t(ROLES[otroRol].nombre)}`, ROLES[otroRol].color);
    this.cameras.main.startFollow(this.yoA, true, 0.12, 0.12);
    [this.yoA, this.otroA].forEach(a => this.sombras.set(a, sombra(this)));
    this.polvo = polvoPasos(this);
    this.crearCompaneros();
    if (noche) this.noche = new Oscuridad(this);
    vineta(this, noche ? 0.55 : 0.35, 41000);
    grano(this, 41001, 0.05);
    // guía específica de este escenario y este rol (se vuelve a abrir con «?» o la tecla H)
    this.time.delayedCall(450, () => this.verGuia());

    this.interfaz();
    const kb = this.input.keyboard!;
    this.cursor = kb.createCursorKeys();
    this.palanca = new Palanca(this);
    this.teclas = kb.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown', (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      if (ev.key === 'e' || ev.key === 'E' || ev.key === ' ') this.usar();
      if ((ev.key === 'h' || ev.key === 'H') && !this.terminado) { this.verGuia(); return; }
      if (ev.key === 'Escape') { if (this.dialogo) this.cerrarDialogo(); else if (this.mesaPanel) this.cerrarMesa(); else if (!this.terminado) this.confirmarSalida(); }
    });

    this.quitar.push(
      Red.on('estado', m => this.aplicar(m as unknown as Estado)),
      Red.on('pos', m => {
        if (m.id === this.yo) return;
        this.otroObj = { x: m.x as number, y: m.y as number };
        this.otroPose = m.trab ? 'trabaja' : m.mov ? 'camina' : 'quieto';
        if (this.otroA) this.otroA.mirar(m.dir as number).ponerPose(this.otroPose);
      }),
      Red.on('evento', m => this.evento(m)),
      Red.on('aviso', m => aviso(this, String(m.msg), CSS.amarillo, 110)),
      Red.on('fin', m => this.fin(m)),
      Red.on('sala', m => {
        this.sala = m.sala as VistaSala;
        if (this.sala.fase !== 'espera') return;
        if (this.terminado && !this.dialogo) this.scene.start('MultiLobby', { sala: this.sala });   // revancha
        else if (!this.terminado) this.companeroSeFue();
      }),
      Red.on('conexion', m => { if (!m.ok) aviso(this, 'Se cortó la conexión: reconectando…', CSS.rojo, 110); }),
    );
    this.events.once('shutdown', () => { this.quitar.forEach(f => f()); this.quitar = []; });
    if (Red.ultimo.estado) this.aplicar(Red.ultimo.estado as unknown as Estado);   // el primer estado llega antes de que la escena escuche
  }

  private etiquetar(a: Phaser.GameObjects.Container, txt: string, color: number): void {
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
    const salir = boton(this, W - 72, 30, 'Salir', () => this.confirmarSalida(), { ancho: 118, alto: 38, tam: 13, variante: 'peligro', icono: '✕', retardo: 0 });
    salir.setScrollFactor(0, 0, true).setDepth(90001);
    const ayuda = boton(this, W - 162, 30, '?', () => this.verGuia(), { ancho: 46, alto: 38, tam: 18, variante: 'fantasma', retardo: 0 });
    ayuda.setScrollFactor(0, 0, true).setDepth(90001);
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
    if (typeof e.ahora === 'number') this.desfase = e.ahora - Date.now();
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
    if (!this.estado || this.terminado || this.dialogo) return;   // con una ventana abierta (guía, salir) no se usa nada detrás
    if (this.mesaPanel) { if (this.calib) this.montar(); return; }
    const { x, y } = this.yoA;
    this.enviarPos(false);
    if (this.rol === 'recolector') {
      const e = this.esc.entrega;
      if (this.estado.carga.length && Math.hypot(x - e.x, y - e.y) < e.r + 30) { Red.enviar({ t: 'entregar' }); return; }
      const libre = this.estado.items.filter(i => i.estado === 'libre').map(i => ({ i, d: Math.hypot(i.x - x, i.y - y) })).sort((a, b) => a.d - b.d)[0];
      if (libre && libre.d < 100) { Red.enviar({ t: 'tomar', item: libre.i.id }); Sonido.click(); return; }
      if (this.conversar()) return;
      aviso(this, 'Acércate a una pieza o a la entrega del hangar', CSS.gris, 110);
    } else {
      const m = this.esc.mesa;
      if (Math.hypot(x - m.x, y - m.y) < m.r + 40) { this.abrirMesa(); this.enviarPos(false); return; }
      if (this.conversar()) return;
      aviso(this, 'Tu mesa está en el hangar', CSS.gris, 110);
    }
  }

  // ───────── mesa del ingeniero ─────────
  private abrirMesa(): void {
    const e = this.estado!;
    if (this.seleccion && !e.bandeja.includes(this.seleccion)) this.seleccion = null;
    if (!this.seleccion) this.seleccion = piezaParaMontar(this.esc.items, this.esc.receta, e);
    this.mesaPanel?.destroy();
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(95000);
    this.mesaPanel = c;
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x02040a, 0.6).setInteractive());
    c.add(panel(this, W / 2, H / 2 + 6, 900, 470, { titulo: 'MESA DE ENSAMBLAJE', color: 0x3ff3ff, abrir: false }));
    // bandeja
    c.add(this.add.text(70, 70, t('PIEZAS RECIBIDAS'), { fontFamily: FUENTE_PIXEL, fontSize: '9px', color: '#ffb33f' }));
    if (!e.bandeja.length) c.add(this.add.text(70, 100, t('Todavía no llegó nada.\nPídele piezas al Recolector →'), { fontFamily: FUENTE, fontSize: '13px', fontStyle: '700', color: '#8a9cbc', lineSpacing: 4 }));
    const chica = e.bandeja.length > 6, paso = chica ? 82 : 128, k = chica ? 0.78 : 1;   // con muchas piezas, tarjetas más bajas (nunca tapan la calibración)
    e.bandeja.forEach((id, i) => {
      const d = this.def(id), x = 112 + (i % 3) * 96, y = (chica ? 118 : 136) + Math.floor(i / 3) * paso, sel = this.seleccion === id;
      const v = this.veredicto(id), borde = sel ? 0xffe14d : v.tipo === 'ahora' ? 0x3cff6a : v.tipo === 'despues' ? 0x3ff3ff : 0xff4a3d;
      const hh = 104 * k, g = this.add.graphics().fillStyle(sel ? 0x0e2a3e : 0x0b1222, 1).fillRoundedRect(x - 44, y - 50 * k, 88, hh, 10).lineStyle(sel ? 3 : 2, borde, 1).strokeRoundedRect(x - 44, y - 50 * k, 88, hh, 10);
      const etq = this.add.text(x, y + (chica ? 48 : 66), t(v.tipo === 'ahora' ? '✔ VA AHORA' : v.tipo === 'despues' ? '… DESPUÉS' : '✖ NO VA'), { fontFamily: FUENTE_PIXEL, fontSize: '7px', color: v.tipo === 'ahora' ? '#7dff9c' : v.tipo === 'despues' ? '#9fe8ff' : '#ff8a7a' }).setOrigin(0.5);
      c.add(etq);
      const a = new Actor(this, x, y + 12 * k, d.sprite, { escala: (d.kg >= 500 ? 0.8 : 1.1) * k, dir: 1 }).pausar();
      const n = this.add.text(x, y + 22 * k, t(d.nombre), { fontFamily: FUENTE, fontSize: '10px', fontStyle: '800', color: '#ffffff', align: 'center', wordWrap: { width: 82 } }).setOrigin(0.5, 0);
      const kg = this.add.text(x, y - 44 * k, `${d.kg} kg`, { fontFamily: FUENTE_PIXEL, fontSize: '7px', color: '#ffe14d' }).setOrigin(0.5, 0);
      const z = this.add.zone(x, y, 88, hh).setInteractive({ useHandCursor: true }).on('pointerdown', () => { Sonido.click(); this.seleccion = id; this.calib = undefined; this.abrirMesa(); });
      c.add([g, a, n, kg, z]);
    });
    // ranuras / orden
    const r = this.esc.receta, x0 = 400;
    c.add(this.add.text(x0, 70, t(r.tipo === 'sistemas' ? 'SISTEMAS DE LA NAVE' : 'ORDEN DE MONTAJE'), { fontFamily: FUENTE_PIXEL, fontSize: '9px', color: '#3ff3ff' }));
    const filas = r.tipo === 'sistemas' ? r.ranuras!.map(k => [t(SISTEMA_NOMBRE[k]), e.montado.find(m => m.sistema === k)?.id] as const) : r.orden!.map((n, i) => [`${i + 1}. ${t(n)}`, e.montado[i]?.id] as const);
    filas.forEach(([nombre, id], i) => {
      const y = 100 + i * 34;
      const ahora = !id && (r.tipo === 'orden' ? i === e.montado.length : true);
      c.add(this.add.text(x0, y, `${id ? '✔' : '□'}  ${nombre}`, { fontFamily: FUENTE, fontSize: '14px', fontStyle: '800', color: id ? '#7dff9c' : ahora && r.tipo === 'orden' ? '#ffe14d' : '#ffffff' }));
      if (ahora && r.tipo === 'orden') c.add(this.add.text(x0 + 250, y + 2, t('◀ AHORA'), { fontFamily: FUENTE_PIXEL, fontSize: '8px', color: '#ffe14d' }).setOrigin(1, 0));
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
      const sugerida = disponible && !pedido && this.sugerenciaPedido() === d.id;
      const tx = this.add.text(x1, y, `${pedido ? '★ ' : ''}${t(d.nombre)}${sugerida ? '  ◀ ' + t('pídela') : ''}`, { fontFamily: FUENTE, fontSize: '12px', fontStyle: '800', color: !disponible ? '#4a5a7a' : pedido ? '#ffe14d' : sugerida ? '#7dff9c' : '#ffffff' });
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
      const v = this.veredicto(this.seleccion);
      c.add(this.add.text(400, 352, v.tipo === 'ahora' ? t('Va ahora. Detén la aguja en la zona verde y pulsa MONTAR.') : `${t(v.tipo === 'despues' ? 'Todavía no:' : 'No conviene:')} ${tm(v.msg)}`, { fontFamily: FUENTE, fontSize: '11px', fontStyle: '700', color: v.tipo === 'ahora' ? '#7dff9c' : v.tipo === 'despues' ? '#9fe8ff' : '#ff8a7a', wordWrap: { width: 420 } }));
      if (!this.calib) { const z0 = 0.18 + Math.random() * 0.52; this.calib = { aguja: 0, dir: 1, zona: [z0, z0 + 0.22], g: this.add.graphics() }; }
      else this.calib.g = this.add.graphics();
      c.add(this.calib.g);
      c.add(boton(this, 470, 438, 'MONTAR', () => this.montar(), { ancho: 160, alto: 44, variante: 'exito', icono: 'ico_engranaje', retardo: 0 }));
      c.add(boton(this, 640, 438, 'Devolver', () => { Red.enviar({ t: 'descartar', item: this.seleccion }); this.seleccion = null; this.calib = undefined; }, { ancho: 150, alto: 44, variante: 'peligro', retardo: 0 }));
    } else {
      this.calib = undefined;
      const consejo = e.bandeja.length ? 'Toca una pieza de la izquierda para montarla.' : 'Pide la pieza marcada ◀ y espera a que el Recolector la traiga.';
      c.add(this.add.text(400, 340, t(consejo), { fontFamily: FUENTE, fontSize: '13px', fontStyle: '700', color: '#c8d6ec', wordWrap: { width: 300 } }));
    }
    c.add(boton(this, W / 2 + 330, 494, 'Cerrar', () => this.cerrarMesa(), { ancho: 140, alto: 40, tam: 14, variante: 'neutro', retardo: 0 }));
    fijarEnPantalla(c);
    // el Ingeniero mira su mesa y se pone a teclear (el Recolector lo ve trabajando)
    const m = this.esc.mesa;
    this.yoA.mirarHacia(m.x - this.yoA.x, m.y - this.yoA.y).ponerPose('trabaja');
  }

  /** Manda mi posición y pose ya (sin esperar al siguiente envío periódico). */
  private enviarPos(mov: boolean): void {
    Red.enviar({ t: 'pos', x: Math.round(this.yoA.x), y: Math.round(this.yoA.y), dir: this.yoA.dir, mov, trab: !!this.mesaPanel });
    this.ultimoEnvio = this.time.now;
  }

  // ───────── salir a mitad de partida ─────────
  private ventana(titulo: string, color: number, mensaje: string, botones: [string, 'peligro' | 'neutro' | 'exito', () => void][]): void {
    this.cerrarDialogo();
    this.cerrarMesa();
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(99000);
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x02040a, 0.72).setInteractive());   // bloquea el juego de atrás
    c.add(panel(this, W / 2, H / 2, 560, 236, { titulo, color }));
    c.add(this.add.text(W / 2, H / 2 - 40, t(mensaje), { fontFamily: FUENTE, fontSize: '15px', fontStyle: '700', color: '#e8f6ff', align: 'center', lineSpacing: 4, wordWrap: { width: 470 } }).setOrigin(0.5));
    botones.forEach(([txt, variante, fn], i) => {
      const x = botones.length === 1 ? W / 2 : W / 2 + (i === 0 ? -125 : 125);
      c.add(boton(this, x, H / 2 + 56, txt, fn, { ancho: 220, alto: 46, variante, icono: variante === 'peligro' ? '✕' : variante === 'exito' ? '↺' : '‹', retardo: 0 }));
    });
    fijarEnPantalla(c);
    this.dialogo = c;
  }

  private cerrarDialogo(): void { this.dialogo?.destroy(); this.dialogo = undefined; }

  /** «Cómo se juega» de mi rol en este escenario. Mientras está abierta no me muevo (el reloj del equipo sigue). */
  private verGuia(): void {
    if (this.terminado) return;
    if (this.dialogo) { this.cerrarDialogo(); return; }
    this.cerrarMesa();
    Sonido.click();
    const g = guiaCoop(this, this.sala.escenario, this.rol, { nombreEscenario: this.esc.nombre, alCerrar: () => { if (this.dialogo === g) this.dialogo = undefined; } });
    this.dialogo = g;
  }

  /** Botón Salir / Esc: pregunta antes, porque el compañero queda solo. */
  private confirmarSalida(): void {
    if (this.terminado) return;
    if (this.dialogo) { this.cerrarDialogo(); return; }
    Sonido.click();
    this.ventana('¿SALIR DE LA MISIÓN?', 0xff4a3d, 'Si sales ahora, la partida termina para los dos y tu compañero vuelve a la sala de espera.', [
      ['Seguir jugando', 'neutro', () => this.cerrarDialogo()],
      ['Salir', 'peligro', () => { this.terminado = true; Red.salirDeSala(); this.scene.start('MultiLobby'); }],
    ]);
  }

  /** El otro jugador salió (o se le acabó el tiempo para reconectarse): la sala volvió a la espera. */
  private companeroSeFue(): void {
    this.terminado = true;
    Sonido.mal();
    this.ventana('PARTIDA TERMINADA', 0xffb33f, 'Tu compañero salió de la misión. Puedes esperar en la sala a que vuelva o entre otra persona con el mismo código.', [
      ['Salir al menú', 'neutro', () => { Red.salirDeSala(); this.scene.start('MultiLobby'); }],
      ['Ir a la sala', 'exito', () => { const s = this.sala; this.cerrarDialogo(); this.scene.start('MultiLobby', { sala: s }); }],
    ]);
  }

  /** ¿Esta pieza se puede montar ya? (misma regla que el servidor, para ayudar antes de equivocarse) */
  private veredicto(id: string) { return veredicto(this.esc.items, this.esc.receta, this.estado!, id); }

  /** La pieza que conviene pedir: la que falta y nadie trae todavía. */
  private sugerenciaPedido(): string | null { return sugerenciaPedido(this.esc.items, this.esc.receta, this.estado!); }

  private cerrarMesa(): void {
    const abierta = !!this.mesaPanel;
    this.mesaPanel?.destroy(); this.mesaPanel = undefined; this.calib = undefined;
    if (abierta && this.yoA?.active) { this.yoA.ponerPose('quieto'); this.enviarPos(false); }
  }

  private montar(): void {
    if (!this.calib || !this.seleccion) return;
    const { aguja, zona } = this.calib;
    const calibrado = calibracionValida(aguja, zona);   // un poco de margen por la demora del toque
    Red.enviar({ t: 'montar', item: this.seleccion, calibrado });
    this.seleccion = null; this.calib = undefined;
  }

  private pintarCalibracion(dt: number): void {
    const c = this.calib;
    if (!c || !c.g.active) return;
    Object.assign(c, moverAguja(c.aguja, c.dir, dt));   // lenta: se puede acertar también con el dedo
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
    if (!this.mesaPanel && !this.terminado && !this.dialogo) {
      const k = this.teclas, c = this.cursor;
      if (c.left.isDown || k.A.isDown) dx -= 1;
      if (c.right.isDown || k.D.isDown) dx += 1;
      if (c.up.isDown || k.W.isDown) dy -= 1;
      if (c.down.isDown || k.S.isDown) dy += 1;
      if (this.palanca.activa) { dx = this.palanca.vx; dy = this.palanca.vy; }
      const p = this.input.activePointer;
      const sobreBoton = (p.x > W - 170 && p.y > H - 110) || p.y < 56 || (p.x > W - 205 && p.y < 190);   // USAR, barra de arriba (Salir, ?) y minimapa
      if (!dx && !dy && p.isDown && !this.palanca.activa && !sobreBoton) { const wx = p.worldX - this.yoA.x, wy = p.worldY - this.yoA.y; if (Math.hypot(wx, wy) > 24) { dx = wx; dy = wy; } }
    }
    const mov = !!(dx || dy);
    if (mov) {
      const n = Math.hypot(dx, dy), carga = this.rol === 'recolector' && this.estado?.carga.length ? 0.8 : 1;
      let nx = Phaser.Math.Clamp(this.yoA.x + (dx / n) * VEL * carga * dt, 30, this.esc.mapa.ancho - 30);
      let ny = Phaser.Math.Clamp(this.yoA.y + (dy / n) * VEL * carga * dt, 60, this.esc.mapa.alto - 20);
      for (const cu of this.solidos) { const r = empujar(cu, nx, ny, 18); if (r) { nx = r.x; ny = r.y; } }
      this.yoA.setPosition(nx, ny).mirarHacia(dx, dy).ponerPose('camina');
    } else this.yoA.ponerPose(this.mesaPanel ? 'trabaja' : 'quieto');
    this.yoA.setDepth(this.yoA.y);
    if (time - this.ultimoEnvio > (mov ? 90 : 1000)) this.enviarPos(mov);
    // el compañero se desliza hacia su última posición conocida
    if (this.otroA) {
      this.otroA.x += (this.otroObj.x - this.otroA.x) * 0.2; this.otroA.y += (this.otroObj.y - this.otroA.y) * 0.2;
      this.otroA.setDepth(this.otroA.y);
      // si se desliza un trecho largo (llegó tarde la posición), que camine en vez de patinar
      const lejos = Math.hypot(this.otroObj.x - this.otroA.x, this.otroObj.y - this.otroA.y) > 6;
      if (this.otroPose !== 'trabaja') this.otroA.ponerPose(lejos || this.otroPose === 'camina' ? 'camina' : 'quieto');
    }
    this.moverCompaneros(dt);
    this.etiquetas.forEach((e, a) => e.setPosition(a.x, a.y - 92));
    this.sombras.forEach((sh, a) => sh.setPosition(a.x, a.y + 2).setDepth(a.y - 3));
    if (mov && time - this.pasoT > 110) { this.pasoT = time; this.polvo?.emitParticleAt(this.yoA.x, this.yoA.y + 2, 2); }
    this.pintarCarga();
    this.pintarTecla();
    if (this.noche) {
      const luces: [number, number, number][] = [[this.yoA.x, this.yoA.y - 30, 230], [this.esc.mesa.x, this.esc.mesa.y, 200], [this.esc.entrega.x, this.esc.entrega.y, 190]];
      if (this.otroA) luces.push([this.otroA.x, this.otroA.y - 30, 190]);
      this.npcs.forEach(n => luces.push([n.p.x, n.p.y - 24, 85]));
      this.estado?.items.forEach(i => { if (i.estado === 'libre') luces.push([i.x, i.y - 20, this.estado!.pedido === i.id ? 150 : 110]); });
      this.esc.decorados.forEach(d => { if (NOMBRE_EDIFICIO[d.id]) luces.push([d.x, d.y + 30, 120]); });
      this.noche.pintar(luces);
    }
    this.guia();
    this.minimapa();
    if (this.estado) {
      const s = Math.max(0, Math.floor(((this.estado.fin ? this.estado.inicio + this.estado.fin.segundos * 1000 : Date.now() + this.desfase) - this.estado.inicio) / 1000));
      this.reloj.setText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} / ${Math.floor(this.esc.tiempo / 60)}:${String(this.esc.tiempo % 60).padStart(2, '0')}`).setColor(s > this.esc.tiempo ? '#ff8a7a' : '#ffffff');
    }
  }

  // ───────── compañeros del mapa ─────────
  private crearCompaneros(): void {
    const m = this.esc.mesa, e = this.esc.entrega;
    // para sus paseos, la mesa y la plataforma de entrega también cuentan como obstáculos
    const obst = [...this.solidos, { x: m.x, y: m.y, rx: m.r, ry: m.r * 0.5 }, { x: e.x, y: e.y, rx: e.r, ry: e.r * 0.5 }];
    (this.esc.companeros ?? []).forEach((def, i) => {
      if (!hojasDe(def.sprite).length) return;
      const ruta = paseo(def, obst, this.esc.mapa.ancho, this.esc.mapa.alto);
      const p = new Personaje(this, def.x, def.y, def.sprite, { escala: def.escala ?? 2.2, dir: 1 });
      if (this.esc.mapa.hora === 'noche') p.list.forEach(o => ((o as Actor).base)?.setTint(0xd6dcf4));
      this.sombras.set(p, sombra(this));
      const nombre = this.add.text(def.x, def.y - 80, t(def.nombre), { fontFamily: FUENTE, fontSize: '11px', fontStyle: '800', color: '#ffe9b0', backgroundColor: '#1a1030cc', padding: { x: 5, y: 2 } }).setOrigin(0.5).setDepth(5900);
      this.npcs.push({ def, p, ruta, frase: i % Math.max(1, def.frases.length), cerca: false, nombre });
    });
  }

  /** Pasean según la hora del servidor (los dos jugadores los ven en el mismo lugar); si alguien se acerca, se detienen y lo miran. */
  private moverCompaneros(dt: number): void {
    const ahora = Date.now() + this.desfase;
    this.npcs.forEach((n, i) => {
      const yo = this.yoA, d = Math.hypot(yo.x - n.p.x, yo.y - n.p.y), cerca = d < 120 && !this.terminado;
      if (cerca) n.p.mirarHacia(yo.x - n.p.x, yo.y - n.p.y).ponerPose('quieto');
      else {
        const obj = posicionEn(n.ruta, ahora, i * 7919);
        const dx = obj.x - n.p.x, dy = obj.y - n.p.y, dist = Math.hypot(dx, dy), max = 90 * dt;
        if (dist > 1) { const f = Math.min(1, max / dist); n.p.setPosition(n.p.x + dx * f, n.p.y + dy * f).mirarHacia(dx, dy).ponerPose('camina'); }
        else n.p.ponerPose(obj.camina ? 'camina' : 'quieto');
      }
      n.p.setDepth(n.p.y);
      n.nombre.setPosition(n.p.x, n.p.y - 78).setVisible(d < 420 && !n.burbuja);
      if (cerca && !n.cerca) this.hablar(n);   // saluda al acercarse
      if (!cerca && n.cerca) { n.burbuja?.destroy(); n.burbuja = undefined; }
      n.cerca = cerca;
      n.burbuja?.setPosition(n.p.x, n.p.y - 96);
    });
  }

  /** USAR cerca de un compañero: dice lo siguiente. */
  private conversar(): boolean {
    const n = this.npcs.find(x => x.cerca);
    if (!n) return false;
    this.hablar(n);
    return true;
  }

  /** Burbuja de diálogo: si el Ingeniero pidió algo, el compañero ayuda a encontrarlo; si no, una de sus frases. */
  private hablar(n: Npc): void {
    const e = this.estado;
    let txt = '';
    const pedido = e?.pedido ? e.items.find(i => i.id === e.pedido) : undefined;
    if (this.rol === 'recolector' && pedido?.estado === 'libre' && n.frase % 2 === 0) {
      const d = this.def(pedido.id);
      txt = t('Lo que pide tu Ingeniero ({p}) está en: {z}.', { p: t(d.nombre), z: t(d.zona) });
    } else if (n.def.frases.length) txt = t(n.def.frases[n.frase % n.def.frases.length]);
    n.frase++;
    if (!txt) return;
    n.burbuja?.destroy();
    const tx = this.add.text(0, 0, txt, { fontFamily: FUENTE, fontSize: '12px', fontStyle: '700', color: '#1a1030', align: 'center', wordWrap: { width: 230 }, lineSpacing: 2 }).setOrigin(0.5, 1);
    const w = tx.width + 18, h = tx.height + 12;
    const g = this.add.graphics().fillStyle(0xfff8e8, 0.97).fillRoundedRect(-w / 2, -h - 4, w, h, 10).lineStyle(2, 0xc8a2ff, 1).strokeRoundedRect(-w / 2, -h - 4, w, h, 10)
      .fillStyle(0xfff8e8, 0.97).fillTriangle(-8, -5, 8, -5, 0, 6);
    tx.setPosition(0, -10);
    n.burbuja = this.add.container(n.p.x, n.p.y - 96, [g, tx]).setDepth(6800).setScale(0.6);
    this.tweens.add({ targets: n.burbuja, scale: 1, duration: 180, ease: 'Back.Out' });
    Sonido.click();
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
      if (!donde) { const n = this.npcs.find(c => c.cerca); if (n) donde = n.p; }   // conversar con un compañero
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
    this.npcs.forEach(n => g.fillStyle(0xc8a2ff, 0.9).fillCircle(x0 + n.p.x * k, y0 + n.p.y * k, 1.8));
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
    fijarEnPantalla(c);
  }
}
