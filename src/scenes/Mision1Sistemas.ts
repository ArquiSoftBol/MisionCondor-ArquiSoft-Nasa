// MISIÓN 1 · Sistemas vitales — «Diseña el módulo para Europa».
// Todo ocurre en el Hangar de Ensamblaje. Las piezas reposan en pedestales; al tocar una, el protagonista la lleva
// al vehículo y el escáner la revisa. Ahora hay que DECIDIR como en una misión real:
//   · masa máxima 900 kg (el escáner rechaza lo que no deja masa para lo que falta);
//   · la energía tiene que alcanzar EN JÚPITER (allí llega solo el 4 % de la luz del Sol);
//   · hay dos antenas: la de alta ganancia es mejor pero pesa demasiado.
// Tocar la etiqueta de un sistema instalado lo retira (rediseñar). Con los 4 sistemas se hace la prueba de vuelo
// Tierra → Marte → Júpiter; si la energía no alcanza, la pieza vuelve al hangar. Estrellas según los errores.
import Phaser from 'phaser';
import { W, FUENTE, CSS } from '../config';
import { Actor, cargar } from '../core/sprites';
import { siguiente } from '../core/flujo';
import { lograr, spriteProtagonista, ganarEstrellas } from '../core/estado';
import { Sonido } from '../core/audio';
import { hangar, chispas, vineta } from '../ui/ambiente';
import { DECORADOS } from '../ui/decorado';
import { aviso, cintillo, panel } from '../ui/boton';
import { instalarPausa } from './Pausa';
import { tarjetaMision, tarjetaResultado } from '../ui/tarjeta';
import { PiezaHolo, Operario, ListaHolo, destello, escanear, flotante, HOJAS_TALLER } from '../ui/taller';
import { Presupuesto } from '../ui/presupuesto';
import { t } from '../core/idioma';

type Sistema = 'energia' | 'control' | 'comunicacion' | 'propulsion';
interface Pieza {
  id: string; nombre: string; sistema: Sistema | null; explica: string;
  masa: number;                 // kg
  genera?: number;              // W que produce cerca de la Tierra
  generaJupiter?: number;       // W que produce en Júpiter (si no se indica, igual que en la Tierra)
  consume?: number;             // W que gasta
  escala?: number;
}

const MASA_MAX = 900;
const ORDEN: Sistema[] = ['energia', 'control', 'comunicacion', 'propulsion'];
const SISTEMAS: Record<Sistema, { nombre: string; color: number; tag: [number, number]; slot: [number, number] }> = {
  energia: { nombre: 'ENERGÍA', color: 0xffd23f, tag: [322, 148], slot: [408, 268] },
  control: { nombre: 'CONTROL', color: 0x3ff3ff, tag: [638, 148], slot: [548, 262] },
  comunicacion: { nombre: 'COMUNICACIÓN', color: 0x5cff9c, tag: [300, 226], slot: [452, 196] },
  propulsion: { nombre: 'PROPULSIÓN', color: 0xff6b2c, tag: [660, 226], slot: [520, 300] },
};

const PIEZAS: Pieza[] = [
  { id: 'panel_desplegable', nombre: 'Panel solar', sistema: 'energia', masa: 80, genera: 300, generaJupiter: 12,
    explica: 'Panel solar: liviano y potente cerca del Sol, pero en Júpiter recibe solo el 4 % de la luz.' },
  { id: 'rtg_nuclear', nombre: 'Generador RTG', sistema: 'energia', masa: 150, genera: 110,
    explica: 'RTG: el calor del plutonio da electricidad por décadas, incluso lejos del Sol.' },
  { id: 'panel_control', nombre: 'Panel de control', sistema: 'control', masa: 120, consume: 45,
    explica: 'Panel de control: la computadora guía la nave y vigila cada sistema.' },
  { id: 'antena_portatil', nombre: 'Antena chica', sistema: 'comunicacion', masa: 60, consume: 40,
    explica: 'Antena chica (omnidireccional): liviana; envía datos en todas direcciones.' },
  { id: 'antena_espacio_profundo', nombre: 'Antena grande', sistema: 'comunicacion', masa: 140, consume: 60, escala: 0.8,
    explica: 'Antena grande (alta ganancia): envía más datos, pero pesa más del doble.' },
  { id: 'tanque_criogenico', nombre: 'Tanque de combustible', sistema: 'propulsion', masa: 500,
    explica: 'Tanque: hidrógeno y oxígeno líquidos que el motor quema para empujar.' },
  { id: 'taza', nombre: 'Taza de café', sistema: null, masa: 1, explica: 'Una taza no ayuda a volar... ¡aunque el café ayuda a calcular!' },
  { id: 'planta', nombre: 'Planta', sistema: null, masa: 3, explica: 'La planta se queda en el Invernadero: no es un sistema del vehículo.' },
];
// pedestales repartidos por el piso del hangar, en arco frente al vehículo
const LUGARES: [number, number][] = [[80, 418], [192, 466], [306, 504], [424, 526], [540, 526], [656, 504], [770, 466], [882, 418]];
const VEH = { x: 480, y: 300 };
const FRENTE = { x: 480, y: 398 };

interface Instalado { p: Pieza; ph: PiezaHolo; obj: Actor; extras: Phaser.GameObjects.GameObject[]; eventos: Phaser.Time.TimerEvent[] }

export class Mision1Sistemas extends Phaser.Scene {
  private llenos = new Map<Sistema, Instalado>();
  private tags: Partial<Record<Sistema, { cont: Phaser.GameObjects.Container; icono: Actor; linea: Phaser.GameObjects.Graphics }>> = {};
  private anillo!: Phaser.GameObjects.Graphics;
  private vehiculo!: Actor;
  private op!: Operario;
  private lista!: ListaHolo;
  private texto!: ReturnType<typeof cintillo>;
  private presupuesto!: Presupuesto;
  private errores = 0;
  private probando = false;

  constructor() { super('Mision1Sistemas'); }

  preload(): void {
    cargar(this, ['modulo_lunar', spriteProtagonista(), ...PIEZAS.map(p => p.id), ...DECORADOS, ...HOJAS_TALLER,
      'icono_energia', 'icono_control', 'icono_comunicacion', 'icono_propulsion', 'humo_despegue', 'tierra', 'marte', 'jupiter']);
  }

  create(): void {
    this.llenos.clear(); this.tags = {}; this.errores = 0; this.probando = false;
    this.cameras.main.fadeIn(400);
    hangar(this, 330);
    chispas(this, 880, 320);
    vineta(this, 0.45, 1200);

    // plataforma elevadora con anillo holográfico de 4 sectores (uno por sistema)
    this.add.ellipse(VEH.x, VEH.y + 4, 290, 86, 0x0b1222, 0.9).setStrokeStyle(3, 0x3a4d74).setDepth(VEH.y - 3);
    this.anillo = this.add.graphics().setDepth(VEH.y - 2).setBlendMode(Phaser.BlendModes.ADD);
    this.pintarAnillo();
    this.vehiculo = new Actor(this, VEH.x, VEH.y, 'modulo_lunar', { escala: 2.9, dir: 1 }).setDepth(VEH.y);
    this.vehiculo.base.setTint(0x8a94b0);   // apagado hasta que tenga energía

    // etiquetas holográficas de los sistemas; tocarlas retira la pieza instalada
    ORDEN.forEach(k => {
      const s = SISTEMAS[k], [x, y] = s.tag;
      const linea = this.add.graphics().setDepth(5);
      linea.lineStyle(1.5, s.color, 0.35).lineBetween(x + (x < VEH.x ? 88 : -88), y, s.slot[0], s.slot[1]);
      const g = this.add.graphics().fillStyle(0x040914, 0.85).fillRoundedRect(-88, -20, 176, 40, 12).lineStyle(2, s.color, 0.9).strokeRoundedRect(-88, -20, 176, 40, 12);
      const icono = new Actor(this, -64, 16, `icono_${k}`, { escala: 0.62, dir: 0 }).pausar();
      icono.base.setTint(0x6a6a6a);
      const tx = this.add.text(12, 0, s.nombre, { fontFamily: FUENTE, fontSize: '15px', fontStyle: '800', color: '#e8f6ff' }).setOrigin(0.5);
      const cont = this.add.container(x, y, [g, icono, tx]).setDepth(6).setAlpha(0.5);
      cont.setSize(176, 40).setInteractive({ useHandCursor: true });
      cont.on('pointerdown', () => this.pedirRetiro(k));
      this.tags[k] = { cont, icono, linea };
    });

    this.texto = cintillo(this, 'Módulo para Europa: máximo 900 kg y energía en Júpiter', 'ico_tocar');
    instalarPausa(this);
    this.lista = new ListaHolo(this, 14, 70, 'DIAGNÓSTICO', ORDEN.map(k => SISTEMAS[k].nombre.charAt(0) + SISTEMAS[k].nombre.slice(1).toLowerCase()), 196);
    this.lista.actual(-1);
    this.presupuesto = new Presupuesto(this, W - 244, 64, 'PRESUPUESTO', [
      { id: 'masa', etiqueta: 'MASA', limite: MASA_MAX, unidad: 'kg', color: 0x3ff3ff },
      { id: 'energia', etiqueta: 'ENERGÍA EN JÚPITER', limite: 0, unidad: 'W', color: 0xffd23f, minimo: true },
    ], 230);

    this.op = new Operario(this, FRENTE.x, FRENTE.y, spriteProtagonista(), 2.1);
    this.op.mirar(0);

    tarjetaMision(this, 1, 'Sistemas vitales',
      'Diseña el módulo que viajará a Europa: necesita energía, control, comunicación y propulsión, sin pasar de 900 kg. Ojo: en Júpiter el Sol brilla 25 veces menos.',
      ['panel_desplegable', 'rtg_nuclear', 'antena_portatil', 'tanque_criogenico'], () => this.repartir());
  }

  // ───────── cuentas ─────────
  private masa(): number { let m = 0; this.llenos.forEach(i => { m += i.p.masa; }); return m; }
  private consumo(): number { let c = 0; this.llenos.forEach(i => { c += i.p.consume ?? 0; }); return c; }
  private generaJupiter(): number { const e = this.llenos.get('energia')?.p; return e ? (e.generaJupiter ?? e.genera ?? 0) : 0; }
  /** Masa mínima que todavía hace falta para los sistemas vacíos (sin contar `salvo`). */
  private masaMinimaFaltante(salvo: Sistema): number {
    return ORDEN.filter(k => k !== salvo && !this.llenos.has(k))
      .reduce((m, k) => m + Math.min(...PIEZAS.filter(p => p.sistema === k).map(p => p.masa)), 0);
  }
  private actualizarPresupuesto(): void {
    this.presupuesto.poner('masa', this.masa());
    this.presupuesto.poner('energia', this.generaJupiter(), this.consumo());
  }

  /** Dibuja el anillo: sector encendido = sistema instalado. */
  private pintarAnillo(pulso = 0): void {
    const g = this.anillo.clear(), rx = 150, ry = 46;
    ORDEN.forEach((k, i) => {
      const on = this.llenos.has(k), a0 = -Math.PI / 2 + i * Math.PI / 2 + 0.08, a1 = a0 + Math.PI / 2 - 0.16;
      g.lineStyle(on ? 5 : 3, on ? SISTEMAS[k].color : 0x33405a, on ? 0.9 + pulso * 0.1 : 0.7);
      g.beginPath();
      for (let s = 0; s <= 16; s++) { const a = a0 + (a1 - a0) * s / 16, px = VEH.x + Math.cos(a) * rx, py = VEH.y + 4 + Math.sin(a) * ry; s ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.strokePath();
    });
  }

  private repartir(): void {
    const orden = Phaser.Utils.Array.Shuffle([...PIEZAS]);
    orden.forEach((p, i) => {
      const [x, y] = LUGARES[i];
      const ph = new PiezaHolo(this, x, y, p.id, p.nombre, { escala: p.escala ?? 1.45, retardo: i * 110 });
      // ficha técnica: masa bajo el pedestal
      const kg = this.add.text(x, y + 24, `${p.masa} kg`, { fontFamily: FUENTE, fontSize: '12px', fontStyle: '800', color: '#9fdcff', backgroundColor: '#040914cc', padding: { x: 5, y: 1 } }).setOrigin(0.5).setDepth(y + 2).setAlpha(0);
      this.tweens.add({ targets: kg, alpha: 1, duration: 400, delay: i * 110 + 300 });
      ph.alTocar(() => this.llevar(p, ph));
    });
  }

  private fallo(): void { this.errores++; }

  private async llevar(p: Pieza, ph: PiezaHolo): Promise<void> {
    if (this.op.ocupado || this.probando) { aviso(this, 'Un momento: tu personaje está ocupado', CSS.cian); return; }
    this.op.ocupado = true;
    ph.levantar();
    const lado = ph.x < VEH.x ? 46 : -46;
    await this.op.caminarA(ph.x + lado, ph.y + 8);
    this.op.mirar(ph.x < VEH.x ? 2 : 6);
    await this.op.tomar(ph.actor);
    await this.op.caminarA(FRENTE.x, FRENTE.y);
    this.op.mirar(4);   // de espaldas, mirando al vehículo
    await escanear(this, VEH.x, VEH.y, 140, p.sistema ? SISTEMAS[p.sistema].color : 0xff4a3d);

    // ¿por qué se rechaza? (orden: no es un sistema → ya está → no alcanza la masa)
    let motivo = '', color: string = CSS.rojo;
    if (!p.sistema) motivo = p.explica;
    else if (this.llenos.has(p.sistema)) {
      motivo = t('Ya tiene {s}. Toca su etiqueta si quieres cambiarlo.', { s: t(SISTEMAS[p.sistema].nombre).toLowerCase() }); color = CSS.amarillo;
    } else if (this.masa() + p.masa + this.masaMinimaFaltante(p.sistema) > MASA_MAX) {
      motivo = t('Con {n} kg no queda masa para lo que falta (límite 900 kg). Elige algo más liviano o retira otra pieza.', { n: p.masa });
      this.presupuesto.sacudir('masa');
    }
    if (motivo) {
      this.fallo();
      Sonido.mal();
      this.cameras.main.shake(150, 0.004);
      flotante(this, VEH.x, VEH.y - 150, '✖', '#ff4a3d');
      aviso(this, motivo, color, 110);
      await this.op.negar();
      this.op.soltar();
      await this.op.caminarA(ph.x + lado, ph.y + 8);
      await ph.devolver();
      await this.op.caminarA(FRENTE.x, FRENTE.y);
      this.op.mirar(0);
      this.op.ocupado = false;
      return;
    }
    // ✔ se instala
    const k = p.sistema!, s = SISTEMAS[k], obj = this.op.soltar()!;
    Sonido.bien();
    await new Promise<void>(res => this.tweens.add({ targets: obj, x: s.slot[0], y: s.slot[1], scale: (p.escala ?? 1.45) * 0.76, duration: 420, ease: 'Back.in', onComplete: () => res() }));
    obj.setDepth(VEH.y + 1);
    ph.usada();
    destello(this, s.slot[0], s.slot[1] - 20, s.color);
    flotante(this, s.slot[0], s.slot[1] - 60, s.nombre, '#' + s.color.toString(16).padStart(6, '0'));
    aviso(this, p.explica, CSS.verde, 110);
    this.encender(k, { p, ph, obj, extras: [], eventos: [] });
    await this.op.caminarA(FRENTE.x, FRENTE.y);
    this.op.mirar(0);
    this.op.ocupado = false;
    if (this.llenos.size === 4) this.pruebaDeVuelo();
  }

  /** Enciende un sistema: su etiqueta, su sector del anillo, su línea y un efecto en el vehículo. */
  private encender(k: Sistema, ins: Instalado): void {
    this.llenos.set(k, ins);
    const s = SISTEMAS[k], tag = this.tags[k]!;
    tag.icono.base.clearTint(); tag.icono.seguir();
    this.tweens.add({ targets: tag.cont, alpha: 1, scale: 1.08, duration: 200, yoyo: true, onComplete: () => tag.cont.setAlpha(1).setScale(1) });
    tag.linea.clear().lineStyle(2.5, s.color, 0.9).lineBetween(s.tag[0] + (s.tag[0] < VEH.x ? 88 : -88), s.tag[1], s.slot[0], s.slot[1]);
    this.pintarAnillo();
    this.lista.marcar(ORDEN.indexOf(k));
    if (k === 'energia') { this.vehiculo.base.clearTint(); this.tweens.add({ targets: this.vehiculo, alpha: 0.6, duration: 80, yoyo: true, repeat: 3 }); }
    if (k === 'comunicacion') for (let i = 0; i < 3; i++) {
      const o = this.add.circle(s.slot[0], s.slot[1] - 30, 8).setStrokeStyle(2, s.color, 1).setDepth(1000);
      this.tweens.add({ targets: o, radius: 70, alpha: 0, duration: 1400, delay: i * 400, repeat: -1 });
      ins.extras.push(o);
    }
    if (k === 'control') ins.eventos.push(this.time.addEvent({ delay: 300, loop: true, callback: () => this.vehiculo.luz?.setAlpha(Math.random() * 0.6 + 0.4) }));
    this.actualizarPresupuesto();
    this.textoFaltan();
  }

  private textoFaltan(): void {
    const faltan = 4 - this.llenos.size;
    this.texto.texto?.setText(faltan === 0 ? 'Todos los sistemas listos: prueba de vuelo' : faltan === 1 ? '¡Bien! Falta 1 sistema' : `¡Bien! Faltan ${faltan} sistemas`);
  }

  /** Tocar la etiqueta de un sistema instalado: el protagonista lo retira y lo devuelve a su pedestal. */
  private async pedirRetiro(k: Sistema): Promise<void> {
    if (!this.llenos.has(k)) return;
    if (this.op.ocupado || this.probando) { aviso(this, 'Un momento: tu personaje está ocupado', CSS.cian); return; }
    this.op.ocupado = true;
    await this.retirar(k);
    this.op.ocupado = false;
  }

  private async retirar(k: Sistema): Promise<void> {
    const ins = this.llenos.get(k);
    if (!ins) return;
    this.llenos.delete(k);
    ins.extras.forEach(o => { this.tweens.killTweensOf(o); o.destroy(); }); ins.eventos.forEach(e => e.remove());
    const s = SISTEMAS[k], tag = this.tags[k]!;
    tag.icono.base.setTint(0x6a6a6a); tag.icono.pausar(); tag.cont.setAlpha(0.5);
    tag.linea.clear().lineStyle(1.5, s.color, 0.35).lineBetween(s.tag[0] + (s.tag[0] < VEH.x ? 88 : -88), s.tag[1], s.slot[0], s.slot[1]);
    this.pintarAnillo();
    this.lista.desmarcar(ORDEN.indexOf(k));
    if (k === 'energia') this.vehiculo.base.setTint(0x8a94b0);
    if (k === 'control') this.vehiculo.luz?.setAlpha(0.9);
    this.actualizarPresupuesto();
    this.texto.texto?.setText('Pieza retirada: elige otra para ese sistema');
    Sonido.click();
    // el protagonista va, la toma del vehículo y la deja en su pedestal
    const lado = ins.ph.x < VEH.x ? 46 : -46;
    await this.op.caminarA(FRENTE.x, FRENTE.y);
    this.op.mirar(4);
    await this.op.tomar(ins.obj);
    await this.op.caminarA(ins.ph.x + lado, ins.ph.y + 8);
    this.op.soltar();
    await ins.ph.devolver();
    await this.op.caminarA(FRENTE.x, FRENTE.y);
    this.op.mirar(0);
  }

  /** Prueba de vuelo: Tierra → Marte → Júpiter. La energía generada se compara con el consumo en cada etapa. */
  private pruebaDeVuelo(): void {
    this.probando = true;
    const e = this.llenos.get('energia')!.p, consumo = this.consumo();
    const etapas = [
      { id: 'tierra', nombre: 'Tierra', gen: e.genera ?? 0 },
      { id: 'marte', nombre: 'Marte', gen: e.generaJupiter !== undefined ? Math.round((e.genera ?? 0) * 0.43) : e.genera ?? 0 },
      { id: 'jupiter', nombre: 'Júpiter', gen: e.generaJupiter ?? e.genera ?? 0 },
    ];
    const c = this.add.container(W / 2, 250).setDepth(9500).setScrollFactor(0);
    c.add(panel(this, 0, 0, 560, 220, { titulo: 'PRUEBA DE VUELO', alfa: 0.94 }));
    const linea = this.add.graphics();
    c.add(linea);
    const leyenda = this.add.text(0, 84, t('Consumo del módulo: {c} W', { c: consumo }), { fontFamily: FUENTE, fontSize: '14px', fontStyle: '800', color: '#9fdcff' }).setOrigin(0.5);
    c.add(leyenda);
    c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 300 });
    this.texto.texto?.setText('Prueba de vuelo: ¿alcanza la energía en cada planeta?');

    let falla = -1;
    etapas.forEach((et, i) => {
      const x = -180 + i * 180;
      this.time.delayedCall(500 + i * 900, () => {
        const pl = new Actor(this, x, -10, et.id, { escala: 0.45, dir: 1 });
        const ok = et.gen >= consumo;
        const txt = this.add.text(x, 40, `${t(et.nombre)}\n${et.gen} W`, { fontFamily: FUENTE, fontSize: '14px', fontStyle: '800', color: ok ? '#7dff9c' : '#ff8a7a', align: 'center' }).setOrigin(0.5);
        c.add([pl, txt]);
        pl.setScale(0); this.tweens.add({ targets: pl, scale: 0.45, duration: 300, ease: 'Back.out' });
        if (i > 0) linea.lineStyle(2, 0x3ff3ff, 0.6).lineBetween(x - 150, -10, x - 30, -10);
        if (ok) Sonido.tecla(); else { Sonido.mal(); if (falla < 0) falla = i; this.cameras.main.shake(200, 0.004); }
      });
    });
    this.time.delayedCall(500 + etapas.length * 900 + 900, () => {
      this.tweens.add({ targets: c, alpha: 0, duration: 300, onComplete: () => c.destroy() });
      if (falla < 0) { this.probando = false; this.texto.texto?.setText('¡La energía alcanza en todo el viaje!'); this.arranque(); return; }
      this.fallo();
      aviso(this, 'En Júpiter llega solo el 4 % de la luz del Sol: el panel da 12 W y el módulo necesita más. Cambia la fuente de energía.', CSS.rojo, 110);
      this.presupuesto.sacudir('energia');
      this.time.delayedCall(400, async () => {
        this.op.ocupado = true;
        await this.retirar('energia');
        this.op.ocupado = false;
        this.probando = false;
        this.texto.texto?.setText('Elige otra fuente de energía para Europa');
      });
    });
  }

  /** Secuencia de arranque: el anillo gira de colores, el vehículo se eleva y prueba el motor. */
  private arranque(): void {
    this.input.enabled = false;
    Sonido.motor(2.5);
    this.cameras.main.zoomTo(1.18, 1400, 'Sine.easeInOut');
    this.cameras.main.pan(VEH.x, VEH.y - 20, 1400, 'Sine.easeInOut');
    let n = 0;
    const giro = this.time.addEvent({ delay: 60, loop: true, callback: () => { n++; this.pintarAnillo(Math.sin(n / 2)); } });
    const columna = this.add.rectangle(VEH.x, VEH.y - 200, 150, 400, 0x3ff3ff, 0).setDepth(VEH.y - 1).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: columna, fillAlpha: 0.22, duration: 700, yoyo: true, delay: 300 });
    const humo = new Actor(this, VEH.x, VEH.y + 6, 'humo_despegue', { escala: 1.6 }).setDepth(VEH.y - 1).setAlpha(0);
    this.tweens.add({ targets: humo, alpha: 0.9, duration: 400, delay: 500 });
    this.tweens.add({ targets: this.vehiculo, y: VEH.y - 26, duration: 1200, delay: 500, ease: 'Sine.out', yoyo: true, hold: 600 });
    this.cameras.main.shake(1800, 0.004);
    destello(this, VEH.x, VEH.y - 60, 0xffffff);
    this.time.delayedCall(3300, () => {
      giro.remove();
      this.cameras.main.zoomTo(1, 600);
      this.cameras.main.pan(W / 2, 270, 600);
      this.input.enabled = true;
      lograr('m1');
      const estrellas = this.errores === 0 ? 3 : this.errores <= 2 ? 2 : 1;
      const mejor = ganarEstrellas('m1', estrellas);
      this.time.delayedCall(650, () => tarjetaResultado(this, '¡Módulo listo para Europa!', [
        t('Masa: {m} de 900 kg · Energía en Júpiter: {g} W para {c} W', { m: this.masa(), g: this.generaJupiter(), c: this.consumo() }),
        'Energía  ·  Control  ·  Comunicación  ·  Propulsión',
        'Lejos del Sol, la energía nuclear (RTG) es la que no se apaga.',
      ], () => siguiente(this), { estrellas, mejor, nota: t('Errores: {n}. Diseña sin rechazos para ganar las 3 estrellas.', { n: this.errores }) }));
    });
  }
}
