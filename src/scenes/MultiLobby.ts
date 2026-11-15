// MULTIJUGADOR · lobby: escribir tu nombre (sin correo) → crear sala (con escenario) o unirse con un código → sala de espera
// con los dos jugadores, elección de rol (Ingeniero / Recolector) y «Estoy listo». Cuando los dos están listos, empieza.
import Phaser from 'phaser';
import { W, H, FUENTE, FUENTE_PIXEL, CSS } from '../config';
import { Sonido } from '../core/audio';
import { t } from '../core/idioma';
import { Red, leerIdentidad, guardarIdentidad, crearIdentidad } from '../core/red';
import { boton, panel, aviso } from '../ui/boton';
import { segmentado } from '../ui/controles';
import { fondoSalar, HOJAS_ESCENARIO } from '../ui/escenarios';
import { Actor, cargar } from '../core/sprites';
import { grano } from '../ui/cine';

const ESTILO = `width:420px;font:700 18px "Open Sans",system-ui,sans-serif;color:#fff;background:rgba(63,243,255,.08);
  border:0;border-bottom:3px solid #3ff3ff;border-radius:10px 10px 0 0;outline:none;padding:10px 12px;caret-color:#ffe14d;`;

export interface Jugador { id: number; nombre: string; rol: 'ingeniero' | 'recolector'; listo: boolean; conectado: boolean }
export interface VistaSala { codigo: string; escenario: string; fase: string; jugadores: Jugador[] }
export const ROLES = {
  ingeniero: { nombre: 'Ingeniero', sprite: 'ingeniero_sistemas', color: 0x3ff3ff, desc: 'Arma y calibra la nave en la mesa del hangar. Decide qué pieza va en cada lugar y pide lo que falta.' },
  recolector: { nombre: 'Recolector', sprite: 'tripulante_vuelo', color: 0xffb33f, desc: 'Recorre la Ciudadela, encuentra las piezas y las lleva al hangar. El carro aguanta poco peso.' },
};

export class MultiLobby extends Phaser.Scene {
  private capa?: Phaser.GameObjects.Container;
  private doms: Phaser.GameObjects.DOMElement[] = [];   // campos de texto (fuera de los contenedores)
  private quitar: (() => void)[] = [];
  private escenarios: Record<string, { nombre: string; descripcion: string }> = {};
  private yo = 0;
  private sala?: VistaSala;
  private elegido = 'salar';

  constructor() { super('MultiLobby'); }

  preload(): void {
    this.load.json('coop', 'coop/escenarios.json');
    cargar(this, [...HOJAS_ESCENARIO, 'ingeniero_sistemas', 'tripulante_vuelo']);
  }

  create(d?: { sala?: VistaSala }): void {
    this.cameras.main.fadeIn(400);
    fondoSalar(this, { hora: 'noche', suelo: 360 });
    this.add.rectangle(W / 2, H / 2, W, H, 0x02040a, 0.45);
    grano(this, 200, 0.05);
    this.escenarios = this.cache.json.get('coop');
    this.add.text(W / 2, 32, t('MULTIJUGADOR'), { fontFamily: FUENTE_PIXEL, fontSize: '18px', color: '#ffffff', stroke: '#04121a', strokeThickness: 6 }).setOrigin(0.5);
    this.add.text(W / 2, 60, t('TURNO DE NOCHE'), { fontFamily: FUENTE_PIXEL, fontSize: '10px', color: CSS.amarillo, stroke: '#04121a', strokeThickness: 4 }).setOrigin(0.5);
    const bajada = this.add.text(W / 2, 84, t('Faltan tres noches para el despegue. Una persona arma, la otra trae.'), { fontFamily: FUENTE, fontSize: '13px', fontStyle: 'italic 700', color: '#c8d6ec' }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: bajada, alpha: 1, duration: 900, delay: 300 });
    const estado = this.add.text(W - 16, H - 14, '', { fontFamily: FUENTE_PIXEL, fontSize: '8px', color: '#7f93b5' }).setOrigin(1, 1);
    const pintarEstado = () => estado.setText(Red.conectada ? t('● Conectado al servidor') : t('○ Sin conexión con el servidor')).setColor(Red.conectada ? '#7dff9c' : '#ff8a7a');
    pintarEstado();
    boton(this, 90, 40, 'Volver', () => this.volver(), { ancho: 130, alto: 38, tam: 14, variante: 'fantasma', icono: '‹', retardo: 0 }).setDepth(50);

    // mensajes del servidor
    this.quitar.push(
      Red.on('conexion', () => pintarEstado()),
      Red.on('error', m => { Sonido.mal(); aviso(this, String(m.msg), CSS.rojo, 110); }),
      Red.on('aviso', m => aviso(this, String(m.msg), CSS.amarillo, 110)),
      Red.on('bienvenida', m => { this.yo = m.id as number; this.pantallaMenu(m.mejores as { escenario: string; estrellas: number; segundos: number }[]); }),
      Red.on('sala', m => { this.sala = m.sala as VistaSala; this.pantallaSala(); }),
      Red.on('inicio', m => this.empezar(m)),
    );
    this.events.once('shutdown', () => { this.quitar.forEach(f => f()); this.quitar = []; this.doms = []; this.capa = undefined; });
    this.input.keyboard?.on('keydown-ESC', () => this.volver());

    if (d?.sala) { this.sala = d.sala; this.pantallaSala(); }
    else if (Red.conectada && Red.identidad) Red.enviar({ t: 'hola', ...Red.identidad });   // recupera la bienvenida
    else this.pantallaIdentidad();
  }

  private nuevaCapa(titulo: string, w = 640, h = 380, y = H / 2 + 30): Phaser.GameObjects.Container {
    this.capa?.destroy(true);
    this.doms.forEach(d => d.destroy()); this.doms = [];
    const c = this.add.container(0, 0).setDepth(10);
    c.add(panel(this, W / 2, y, w, h, { titulo, color: 0x3ff3ff }));
    this.capa = c;
    return c;
  }

  private campo(y: number, tipo: string, valor: string, ph: string, max: number, x = W / 2): HTMLInputElement {
    const dom = this.add.dom(x, y, 'input', ESTILO).setDepth(20);
    const el = dom.node as HTMLInputElement;
    el.type = tipo; el.value = valor; el.placeholder = t(ph); el.maxLength = max; el.autocomplete = 'off'; el.spellcheck = false;
    el.addEventListener('keydown', e => e.stopPropagation());
    this.doms.push(dom);
    return el;
  }

  // ───────── 1 · identidad ─────────
  private pantallaIdentidad(): void {
    const c = this.nuevaCapa('TU NOMBRE', 600, 300);
    const id = leerIdentidad();
    c.add(this.add.text(W / 2, 190, t('Sin correo ni registro: solo tu nombre y el código de la sala.'), { fontFamily: FUENTE, fontSize: '14px', fontStyle: '700', color: '#c8d6ec' }).setOrigin(0.5));
    c.add(this.add.text(W / 2 - 210, 232, t('NOMBRE EN LA PARTIDA'), { fontFamily: FUENTE_PIXEL, fontSize: '9px', color: '#3ff3ff' }));
    const nombre = this.campo(266, 'text', id?.nombre ?? '', 'Cómo te verá tu compañero', 18);
    c.add(this.add.text(W / 2, 310, t('No se publica: solo lo ve el equipo que juega contigo.'), { fontFamily: FUENTE, fontSize: '11px', fontStyle: 'italic 700', color: '#8a9cbc' }).setOrigin(0.5));
    const entrar = () => {
      const n = nombre.value.trim();
      if (n.length < 2) { Sonido.mal(); aviso(this, 'Escribe un nombre de al menos 2 letras.', CSS.rojo, 110); return; }
      const ident = crearIdentidad(n);
      guardarIdentidad(ident);
      Red.conectar(ident);
      this.time.delayedCall(2500, () => { if (!Red.conectada && this.scene.isActive()) aviso(this, 'No hay conexión con el servidor multijugador. ¿Está encendido? (npm run servidor)', CSS.rojo, 110); });
    };
    nombre.addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); });
    c.add(boton(this, W / 2, 372, 'Entrar', entrar, { ancho: 220, variante: 'exito', icono: '➜', retardo: 0 }));
    this.time.delayedCall(200, () => nombre.focus());
  }

  // ───────── 2 · crear o unirse ─────────
  private pantallaMenu(mejores: { escenario: string; estrellas: number; segundos: number }[] = []): void {
    const c = this.nuevaCapa('JUGAR EN EQUIPO', 760, 380);
    const claves = Object.keys(this.escenarios).filter(k => k !== 'nota');
    // crear
    c.add(this.add.text(W / 2 - 190, 166, t('CREAR UNA SALA'), { fontFamily: FUENTE_PIXEL, fontSize: '10px', color: '#3ff3ff' }).setOrigin(0.5));
    const desc = this.add.text(W / 2 - 190, 262, '', { fontFamily: FUENTE, fontSize: '12px', fontStyle: '700', color: '#c8d6ec', align: 'center', wordWrap: { width: 320 } }).setOrigin(0.5, 0);
    const pintarDesc = () => desc.setText(t(this.escenarios[this.elegido].descripcion));
    c.add(segmentado(this, W / 2 - 190, 210, claves.map(k => this.escenarios[k].nombre.split(' · ')[0]), Math.max(0, claves.indexOf(this.elegido)), i => { this.elegido = claves[i]; pintarDesc(); }, 330));
    c.add(desc); pintarDesc();
    c.add(boton(this, W / 2 - 190, 380, 'Crear sala', () => Red.enviar({ t: 'crear', escenario: this.elegido }), { ancho: 240, variante: 'exito', icono: '+', retardo: 0 }));
    // separador
    c.add(this.add.rectangle(W / 2, 280, 2, 250, 0x2a3a5a));
    // unirse
    c.add(this.add.text(W / 2 + 190, 166, t('UNIRSE CON UN CÓDIGO'), { fontFamily: FUENTE_PIXEL, fontSize: '10px', color: '#ffb33f' }).setOrigin(0.5));
    const codigo = this.campo(220, 'text', '', 'ABC123', 6, W / 2 + 190);
    codigo.style.width = '260px'; codigo.style.textAlign = 'center'; codigo.style.textTransform = 'uppercase'; codigo.style.letterSpacing = '6px'; codigo.style.fontSize = '24px';
    const unirse = () => { const v = codigo.value.trim().toUpperCase(); if (v.length !== 6) { Sonido.mal(); aviso(this, 'El código tiene 6 caracteres.', CSS.rojo, 110); return; } Red.enviar({ t: 'unirse', codigo: v }); };
    codigo.addEventListener('keydown', e => { if (e.key === 'Enter') unirse(); });
    c.add(this.add.text(W / 2 + 190, 262, t('Pídele el código a quien creó la sala.'), { fontFamily: FUENTE, fontSize: '12px', fontStyle: '700', color: '#c8d6ec' }).setOrigin(0.5, 0));
    c.add(boton(this, W / 2 + 190, 380, 'Unirse', unirse, { ancho: 240, variante: 'aviso', icono: '➜', retardo: 0 }));
    // récords del jugador
    const rec = mejores.map(m => `${this.escenarios[m.escenario]?.nombre.split(' · ')[0] ?? m.escenario}: ${'★'.repeat(m.estrellas)} · ${m.segundos}s`).join('    ');
    c.add(this.add.text(W / 2, 438, rec ? `${t('Tus mejores:')}  ${rec}` : t('Todavía no tienes partidas en equipo.'), { fontFamily: FUENTE, fontSize: '12px', fontStyle: '700', color: CSS.amarillo }).setOrigin(0.5));
    c.add(this.add.text(W / 2, 128, `${t('Hola')}, ${Red.identidad?.nombre ?? ''}`, { fontFamily: FUENTE, fontSize: '16px', fontStyle: '800', color: '#ffffff' }).setOrigin(0.5));
  }

  // ───────── 3 · sala de espera ─────────
  private pantallaSala(): void {
    const s = this.sala!;
    const c = this.nuevaCapa('SALA', 800, 400, H / 2 + 34);
    const esc = this.escenarios[s.escenario];
    c.add(this.add.text(W / 2 - 220, 140, t('CÓDIGO DE LA SALA'), { fontFamily: FUENTE_PIXEL, fontSize: '9px', color: '#9fb3d1' }).setOrigin(0.5));
    c.add(this.add.text(W / 2 - 220, 176, s.codigo, { fontFamily: FUENTE_PIXEL, fontSize: '30px', color: '#ffe14d', stroke: '#04121a', strokeThickness: 5 }).setOrigin(0.5));
    c.add(boton(this, W / 2 - 220, 222, 'Copiar código', () => { navigator.clipboard?.writeText(s.codigo).then(() => aviso(this, 'Código copiado', CSS.verde, 110)).catch(() => aviso(this, `Código: ${s.codigo}`, CSS.cian, 110)); }, { ancho: 190, alto: 36, tam: 13, variante: 'fantasma', icono: '⧉', retardo: 0 }));
    c.add(this.add.text(W / 2 + 120, 150, t(esc.nombre), { fontFamily: FUENTE, fontSize: '16px', fontStyle: '800', color: '#ffffff', align: 'center', wordWrap: { width: 400 } }).setOrigin(0.5));
    c.add(this.add.text(W / 2 + 120, 196, t(esc.descripcion), { fontFamily: FUENTE, fontSize: '11px', fontStyle: '700', color: '#c8d6ec', align: 'center', wordWrap: { width: 420 } }).setOrigin(0.5));
    // los dos lugares
    (['ingeniero', 'recolector'] as const).forEach((rol, i) => {
      const x = W / 2 - 190 + i * 380, y = 330, r = ROLES[rol], j = s.jugadores.find(p => p.rol === rol);
      const mio = j?.id === this.yo;
      const g = this.add.graphics().fillStyle(0x040914, 0.85).fillRoundedRect(x - 170, y - 66, 340, 150, 14).lineStyle(mio ? 3 : 2, mio ? 0xffe14d : r.color, 0.9).strokeRoundedRect(x - 170, y - 66, 340, 150, 14);
      c.add(g);
      const a = new Actor(this, x - 120, y + 40, r.sprite, { escala: 1.9, dir: 1 });
      c.add(a);
      c.add(this.add.text(x - 60, y - 48, t(r.nombre).toUpperCase(), { fontFamily: FUENTE_PIXEL, fontSize: '11px', color: '#' + r.color.toString(16).padStart(6, '0') }));
      c.add(this.add.text(x - 60, y - 26, j ? `${j.nombre}${mio ? ` (${t('tú')})` : ''}` : t('Esperando jugador…'), { fontFamily: FUENTE, fontSize: '15px', fontStyle: '800', color: j ? '#ffffff' : '#7f93b5' }));
      c.add(this.add.text(x - 60, y - 2, t(r.desc), { fontFamily: FUENTE, fontSize: '11px', fontStyle: '700', color: '#9fb3d1', wordWrap: { width: 220 } }));
      if (j) c.add(this.add.text(x + 150, y - 48, j.listo ? t('LISTO ✔') : t('…'), { fontFamily: FUENTE_PIXEL, fontSize: '9px', color: j.listo ? '#7dff9c' : '#7f93b5' }).setOrigin(1, 0));
      if (!mio) c.add(boton(this, x + 60, y + 60, 'Tomar este rol', () => Red.enviar({ t: 'rol', rol }), { ancho: 200, alto: 34, tam: 12, variante: 'fantasma', retardo: 0 }));
    });
    const yo = s.jugadores.find(p => p.id === this.yo);
    const dos = s.jugadores.length === 2;
    c.add(this.add.text(W / 2, 438, dos ? t('Cuando los dos estén listos, empieza la misión.') : t('Comparte el código con tu compañero para que se una.'), { fontFamily: FUENTE, fontSize: '13px', fontStyle: '700', color: CSS.amarillo }).setOrigin(0.5));
    c.add(boton(this, W / 2 + 130, 490, yo?.listo ? 'No estoy listo' : 'Estoy listo', () => Red.enviar({ t: 'listo', v: !yo?.listo }), { ancho: 230, alto: 46, variante: yo?.listo ? 'neutro' : 'exito', icono: yo?.listo ? '✖' : '✔', retardo: 0 }));
    c.add(boton(this, W / 2 - 130, 490, 'Salir de la sala', () => { Red.salirDeSala(); this.pantallaMenu(); }, { ancho: 230, alto: 46, variante: 'peligro', icono: '‹', retardo: 0 }));
  }

  private empezar(m: Record<string, unknown>): void {
    Sonido.bien();
    const esc = this.escenarios[String(m.escenario)];
    this.cameras.main.fadeOut(500);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Coop', { escenario: m.escenario, esc, rol: m.rol, yo: m.yo, sala: m.sala }));
  }

  private volver(): void {
    if (Red.codigoSala) Red.salirDeSala();
    this.cameras.main.fadeOut(300);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Titulo'));
  }
}
