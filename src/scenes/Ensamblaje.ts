// Mecánica común de las Misiones 2 (cohete) y 3 (Orión), inmersiva: las piezas reposan en pedestales del escenario
// y el dron BIT-7 las levanta con su rayo tractor hasta su lugar en la pila. Hay que elegirlas en el orden correcto:
// si no es la que sigue, el dron la escanea, la rechaza y una pista explica por qué.
// Fase 4 (más habilidad):
//   · GRÚA CON VIENTO: sobre su lugar, la pieza se balancea; el jugador la SUELTA (toque / botón / Espacio) cuando está
//     alineada. Bien centrada = «¡PERFECTO!»; muy desviada = no encaja y vuelve a intentarlo.
//   · PREGUNTA de una pieza (M3: hacia dónde va el escudo térmico).
//   · PRUEBA FINAL: M2 conecta las líneas de combustible (tubos 3×3) · M3 sella las fugas en la prueba de vacío.
//   · ESTRELLAS según los errores.
import Phaser from 'phaser';
import { W, H, FUENTE, FUENTE_PIXEL, CSS } from '../config';
import { Actor, cargar, info } from '../core/sprites';
import { siguiente } from '../core/flujo';
import { lograr, ganarEstrellas } from '../core/estado';
import { Sonido } from '../core/audio';
import { aviso, boton, cintillo, panel, type Cintillo } from '../ui/boton';
import { icono } from '../ui/iconos';
import { instalarPausa } from './Pausa';
import { tarjetaMision, tarjetaResultado } from '../ui/tarjeta';
import { PiezaHolo, Dron, ListaHolo, destello, escanear, flotante, HOJAS_TALLER } from '../ui/taller';
import { t } from '../core/idioma';
import { segun } from '../core/dificultad';

export interface PiezaMontaje {
  id: string; nombre: string; dato: string;
  /** posición en la pila, en unidades del molde (x a la derecha, y hacia arriba) */
  ux: number; uy: number;
  /** escala del molde de la pieza (scale en mision.js) */
  moldeEscala: number;
  /** pista si la eligen antes de tiempo */
  antes: string;
  /** pregunta antes de montarla (opciones; la correcta es la 0 y se mezclan al mostrar) */
  pregunta?: { texto: string; opciones: [string, string]; explica: string };
}

export interface ConfigMontaje {
  clave: string; numero: number; titulo: string; listo: string; intro: string; logro: string;
  piezas: PiezaMontaje[];          // en el orden correcto
  base: { x: number; y: number };  // punto del suelo de la pila en pantalla
  unidad: number;                  // píxeles de pantalla por unidad del molde
  /** pedestales donde esperan las piezas (uno por pieza) */
  lugares: [number, number][];
  fondo: (s: Phaser.Scene) => void;
  extras?: string[];
  resultado: string[];
  /** amplitud del balanceo de la grúa (px) */
  viento: number;
  /** prueba final antes de terminar */
  prueba?: 'tubos' | 'vacio';
}

const PERFECTO = 7;
const TOLERA = () => segun(18, 13);   // px de desvío que todavía encajan

export abstract class Ensamblaje extends Phaser.Scene {
  protected abstract cfg: ConfigMontaje;
  private paso = 0;
  private ocupado = false;
  private fantasma?: Phaser.GameObjects.Graphics;
  private dron!: Dron;
  private lista!: ListaHolo;
  private texto!: Cintillo;
  private reposo = { x: 0, y: 0 };
  private errores = 0;
  private perfectas = 0;
  tuberia?: unknown;   // celdas de la grilla de tubos (para pruebas automáticas)

  preload(): void { cargar(this, [...this.cfg.piezas.map(p => p.id), ...(this.cfg.extras ?? []), ...HOJAS_TALLER]); }

  create(): void {
    this.paso = 0; this.ocupado = false; this.errores = 0; this.perfectas = 0;
    this.cameras.main.fadeIn(400);
    this.cfg.fondo(this);
    this.texto = cintillo(this, 'Toca la pieza que va primero: BIT-7 la llevará a su lugar', 'ico_engranaje');
    instalarPausa(this);
    this.lista = new ListaHolo(this, 14, 70, 'MONTAJE', this.cfg.piezas.map((_, i) => `${i + 1}. ¿ ? ?`), 210);
    this.reposo = { x: this.cfg.base.x + 120, y: 150 };
    this.dron = new Dron(this, this.reposo.x, this.reposo.y);
    tarjetaMision(this, this.cfg.numero, this.cfg.titulo, this.cfg.intro, this.cfg.piezas.slice(0, 4).map(p => p.id), () => this.repartir());
  }

  private repartir(): void {
    const piezas = Phaser.Utils.Array.Shuffle([...this.cfg.piezas]);
    piezas.forEach((p, i) => {
      const [x, y] = this.cfg.lugares[i];
      const nombre = this.cfg.piezas.filter(q => q.id === p.id).length > 1 ? p.nombre.split(' ')[0] : p.nombre;   // piezas iguales: nombre genérico
      const ph = new PiezaHolo(this, x, y, p.id, nombre, { escala: 92 / info(p.id).N, retardo: i * 120, dir: 0 });
      ph.alTocar(() => this.elegir(p, ph));
    });
    this.lista.actual(0);
    this.marcarFantasma();
  }

  private destino(p: PiezaMontaje): { x: number; y: number; escala: number } {
    const u = this.cfg.unidad;
    return { x: this.cfg.base.x + p.ux * u, y: this.cfg.base.y - p.uy * u, escala: u / p.moldeEscala };
  }

  /** Marca holográfica donde va la próxima pieza. */
  private marcarFantasma(): void {
    this.fantasma?.destroy();
    const p = this.cfg.piezas[this.paso];
    if (!p) return;
    const d = this.destino(p);
    const g = this.add.graphics().setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(2, 0x3ff3ff, 0.9).strokeEllipse(d.x, d.y, 70, 20).lineStyle(1, 0x3ff3ff, 0.5);
    for (let k = 0; k < 3; k++) g.strokeEllipse(d.x, d.y - 8 - k * 10, 60 - k * 12, 16 - k * 3);
    g.lineStyle(2, 0x3cff6a, 0.9).lineBetween(d.x, d.y - 60, d.x, d.y + 14);   // línea de plomada: aquí hay que soltar
    this.fantasma = g;
    this.tweens.add({ targets: g, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
  }

  private async elegir(p: PiezaMontaje, ph: PiezaHolo): Promise<void> {
    if (this.ocupado) return;
    this.ocupado = true;
    const esperada = this.cfg.piezas[this.paso];
    const encima = this.dron.sobre(ph.actor, ph.x, ph.y - 6, ph.escala);
    await this.dron.volarA(encima.x, encima.y);
    const sirve = p.id === esperada.id;   // dos piezas iguales (los propulsores) sirven para cualquiera de sus lugares
    await escanear(this, ph.x, ph.y, 90, sirve ? 0x3cff6a : 0xff4a3d);
    if (!sirve) {
      this.errores++;
      Sonido.mal(); this.dron.error();
      flotante(this, ph.x, ph.y - 110, '✖', '#ff4a3d');
      aviso(this, p.antes, CSS.rojo, 110);
      await this.dron.volarA(this.reposo.x, this.reposo.y);
      this.ocupado = false;
      return;
    }
    if (esperada.pregunta) await this.preguntar(esperada.pregunta);
    // ✔ la levanta con el rayo tractor y la lleva sobre su lugar en la pila
    ph.levantar();
    this.dron.enganchar(ph.actor);
    const d = this.destino(esperada);
    this.tweens.add({ targets: ph.actor, scale: d.escala, duration: 900, ease: 'Sine.inOut' });
    const arriba = this.dron.sobre(ph.actor, d.x, d.y - 30, d.escala);
    await this.dron.volarA(arriba.x, arriba.y, 900);
    // grúa con viento: el jugador elige cuándo soltar
    let desvio = await this.soltarConViento(arriba.x);
    while (Math.abs(desvio) > TOLERA()) {
      this.errores++;
      Sonido.mal(); this.cameras.main.shake(150, 0.004);
      aviso(this, 'Muy desviada: no encaja. Espera a que pase sobre la línea verde y suelta.', CSS.rojo, 110);
      await this.dron.volarA(arriba.x, arriba.y, 400);
      desvio = await this.soltarConViento(arriba.x);
    }
    const perfecta = Math.abs(desvio) <= PERFECTO;
    if (perfecta) this.perfectas++;
    const obj = this.dron.soltar() as Actor;
    await new Promise<void>(res => this.tweens.add({ targets: obj, x: d.x, y: d.y, duration: 380, ease: 'Bounce.out', onComplete: () => res() }));
    obj.setDepth(10 + this.paso);
    ph.usada();
    Sonido.bien();
    destello(this, d.x, d.y - 20, 0x3ff3ff);
    this.cameras.main.shake(120, 0.003);
    flotante(this, d.x + 70, d.y - 60, perfecta ? '¡PERFECTO!' : '¡ENCAJA!', perfecta ? '#ffe14d' : '#3cff6a');
    aviso(this, `${esperada.nombre}: ${esperada.dato}`, CSS.verde, 110);
    this.lista.renombrar(this.paso, `${this.paso + 1}. ${esperada.nombre}`);
    this.lista.marcar(this.paso);
    this.paso++;
    this.lista.actual(this.paso);
    this.marcarFantasma();
    const faltan = this.cfg.piezas.length - this.paso;
    this.texto.texto?.setText(faltan ? `¡Encaja! ¿Cuál va ahora? Faltan ${faltan}` : '¡Montaje completo!');
    await this.dron.volarA(this.reposo.x, this.reposo.y);
    this.ocupado = false;
    if (!faltan) {
      if (this.cfg.prueba === 'tubos') this.tubos();
      else if (this.cfg.prueba === 'vacio') this.vacio();
      else this.final();
    }
  }

  /** El dron se balancea con el viento sobre el lugar; devuelve el desvío (px) en el momento de soltar. */
  private soltarConViento(centro: number): Promise<number> {
    return new Promise(res => {
      const a = this.dron.actor, amp = this.cfg.viento * segun(1, 1.5);
      this.texto.texto?.setText('¡Viento! Suelta cuando la pieza pase sobre la línea verde');
      const balanceo = this.tweens.add({ targets: a, x: { from: centro - amp, to: centro + amp }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      let listo = false;
      const fin = () => {
        if (listo) return; listo = true;
        balanceo.stop();
        b.destroy();
        this.input.off('pointerdown', fin);
        this.input.keyboard?.off('keydown-SPACE', finTecla);
        res(a.x - centro);
      };
      const finTecla = (e: KeyboardEvent) => { if (!e.repeat) fin(); };
      const b = boton(this, W / 2, H - 46, 'SOLTAR', fin, { ancho: 220, alto: 52, variante: 'aviso', icono: 'ico_soltar', retardo: 0 });
      b.setDepth(9000);
      this.time.delayedCall(250, () => { if (!listo) { this.input.on('pointerdown', fin); this.input.keyboard?.on('keydown-SPACE', finTecla); } });
    });
  }

  /** Pregunta de dos opciones antes de montar una pieza. La correcta es la primera de la configuración. */
  private preguntar(q: { texto: string; opciones: [string, string]; explica: string }): Promise<void> {
    return new Promise(res => {
      const c = this.add.container(0, 0).setDepth(9500);
      c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x02040a, 0.6).setInteractive());
      c.add(panel(this, W / 2, H / 2, 600, 230, { titulo: 'PREGUNTA DE INGENIERÍA', color: 0xffe14d }));
      c.add(this.add.text(W / 2, H / 2 - 50, t(q.texto), { fontFamily: FUENTE, fontSize: '20px', fontStyle: '800', color: '#ffffff', align: 'center', wordWrap: { width: 540 } }).setOrigin(0.5));
      const orden = Phaser.Utils.Array.Shuffle([0, 1]);
      orden.forEach((k, i) => {
        c.add(boton(this, W / 2 + (i ? 140 : -140), H / 2 + 50, q.opciones[k], () => {
          if (k !== 0) { this.errores++; Sonido.mal(); aviso(this, q.explica, CSS.rojo, 110); }
          else { Sonido.bien(); aviso(this, q.explica, CSS.verde, 110); }
          c.destroy(); res();
        }, { ancho: 240, alto: 50, variante: i ? 'primario' : 'aviso', retardo: 150 }));
      });
    });
  }

  // ───────── M2 · líneas de combustible (tubos 3×3) ─────────
  private tubos(): void {
    this.texto.texto?.setText('Conecta el combustible: gira los tubos hasta unir el tanque con los motores');
    const c = this.add.container(0, 0).setDepth(9000);
    const cx = 660, cy = 300, L = 76;
    c.add(panel(this, cx, cy, 3 * L + 150, 3 * L + 80, { titulo: 'LÍNEAS DE COMBUSTIBLE', color: 0xffb33f, alfa: 0.92 }));
    c.add(this.add.text(cx - 1.5 * L - 42, cy, 'H₂\nO₂', { fontFamily: FUENTE_PIXEL, fontSize: '11px', color: '#9fdcff', align: 'center' }).setOrigin(0.5));
    c.add(icono(this, cx + 1.5 * L + 44, cy, 'ico_fuego', 30));
    // camino solución (entra por la izquierda de (1,0) y sale por la derecha de (1,2)). Lados: 0 arriba, 1 der, 2 abajo, 3 izq
    const sol: Record<string, number[]> = { '1,0': [3, 0], '0,0': [2, 1], '0,1': [3, 2], '1,1': [0, 2], '2,1': [0, 1], '2,2': [3, 0], '1,2': [2, 1] };
    const tipoDe = (lados: number[]) => (Math.abs(lados[0] - lados[1]) === 2 ? 'recto' : 'codo');
    const base = { recto: [1, 3], codo: [0, 1] };
    let listo = false;
    const celdas: { r: number; c: number; tipo: 'recto' | 'codo'; giro: number; g: Phaser.GameObjects.Graphics; correcto: number[] }[] = [];
    const lados = (k: { tipo: 'recto' | 'codo'; giro: number }) => base[k.tipo].map(s => (s + k.giro) % 4).sort();
    const igual = (a: number[], b: number[]) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
    for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) {
      const s = sol[`${r},${q}`], tipo: 'recto' | 'codo' = s ? tipoDe(s) : (r + q) % 2 ? 'recto' : 'codo';
      const celda = { r, c: q, tipo, giro: Phaser.Math.Between(0, 3), g: this.add.graphics(), correcto: s ?? [] };
      if (s && igual(lados(celda), s)) celda.giro = (celda.giro + 1) % 4;   // que no empiece resuelta
      c.add(celda.g);
      celdas.push(celda);
    }
    const pos = (r: number, q: number) => ({ x: cx + (q - 1) * L, y: cy + (r - 1) * L });
    const dibujar = (k: typeof celdas[number], flujo = false) => {
      const { x, y } = pos(k.r, k.c), g = k.g.clear();
      g.fillStyle(0x0b1222, 1).fillRoundedRect(x - L / 2 + 3, y - L / 2 + 3, L - 6, L - 6, 8).lineStyle(2, 0x3a4d74, 1).strokeRoundedRect(x - L / 2 + 3, y - L / 2 + 3, L - 6, L - 6, 8);
      const col = flujo ? 0xffb33f : 0x9aa3ae;
      lados(k).forEach(s => {
        const dx = [0, 1, 0, -1][s], dy = [-1, 0, 1, 0][s];
        g.lineStyle(14, 0x2b2f38, 1).lineBetween(x, y, x + dx * L / 2, y + dy * L / 2);
        g.lineStyle(8, col, 1).lineBetween(x, y, x + dx * L / 2, y + dy * L / 2);
      });
      g.fillStyle(col, 1).fillCircle(x, y, 6);
    };
    // ¿fluye? se sigue el tubo desde la entrada
    const recorrer = (): typeof celdas | null => {
      let r = 1, q = 0, entra = 3;
      const camino: typeof celdas = [];
      for (let n = 0; n < 12; n++) {
        const k = celdas.find(z => z.r === r && z.c === q);
        if (!k) return null;
        const ls = lados(k);
        if (!ls.includes(entra)) return null;
        camino.push(k);
        const sale = ls.find(s => s !== entra)!;
        if (r === 1 && q === 2 && sale === 1) return camino;
        r += [-1, 0, 1, 0][sale]; q += [0, 1, 0, -1][sale]; entra = (sale + 2) % 4;
      }
      return null;
    };
    this.tuberia = { celdas, sol };   // (para pruebas automáticas)
    celdas.forEach(k => {
      dibujar(k);
      const { x, y } = pos(k.r, k.c);
      const z = this.add.zone(x, y, L, L).setInteractive({ useHandCursor: true });
      c.add(z);
      z.on('pointerdown', () => {
        if (listo) return;
        k.giro = (k.giro + 1) % 4; Sonido.tecla(); dibujar(k);
        const camino = recorrer();
        if (camino) {
          listo = true;
          camino.forEach((p, i) => this.time.delayedCall(i * 140, () => { dibujar(p, true); Sonido.tecla(); }));
          this.time.delayedCall(camino.length * 140 + 300, () => {
            Sonido.bien(); aviso(this, '¡Combustible conectado! Hidrógeno y oxígeno llegan a los motores.', CSS.verde, 110);
            this.tweens.add({ targets: c, alpha: 0, duration: 400, delay: 900, onComplete: () => { c.destroy(); this.final(); } });
          });
        }
      });
    });
    c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 300 });
  }

  // ───────── M3 · prueba de vacío (sellar fugas) ─────────
  private vacio(): void {
    this.texto.texto?.setText('Prueba de vacío: toca las fugas antes de que caiga la presión');
    const { x: bx, y: by } = this.cfg.base;
    const c = this.add.container(0, 0).setDepth(9000);
    // manómetro
    c.add(panel(this, W - 150, 150, 220, 90, { titulo: 'PRESIÓN DE CABINA', color: 0x3ff3ff, alfa: 0.9 }));
    const barra = this.add.rectangle(W - 245, 160, 190, 16, 0x3cff6a).setOrigin(0, 0.5);
    const lectura = this.add.text(W - 150, 132, '', { fontFamily: FUENTE_PIXEL, fontSize: '10px', color: '#ffffff' }).setOrigin(0.5);
    c.add([this.add.rectangle(W - 245, 160, 190, 16, 0x0b1222).setOrigin(0, 0.5), barra, lectura]);
    let presion = 100, abiertas = 0, terminado = false, avisada = false, selladas = 0;
    if (!this.textures.exists('amb-punto')) this.make.graphics({}, false).fillStyle(0xffffff).fillRect(0, 0, 2, 2).generateTexture('amb-punto', 2, 2).destroy();
    const puntos: [number, number][] = [[bx - 34, by - 40], [bx + 30, by - 92], [bx - 18, by - 150]];
    const fugas = puntos.map(([x, y], i) => {
      const anillo = this.add.circle(x, y, 14).setStrokeStyle(3, 0xff4a3d, 1).setInteractive({ useHandCursor: true }).setAlpha(0);
      const vapor = this.add.particles(x, y, 'amb-punto', { speed: { min: 40, max: 120 }, angle: { min: 200, max: 340 }, lifespan: 500, quantity: 2, frequency: 40, scale: { start: 3, end: 0.5 }, tint: 0xe8f6ff, emitting: false });
      c.add([vapor, anillo]);
      this.time.delayedCall(600 + i * 1400, () => {
        if (terminado) return;
        abiertas++; anillo.setAlpha(1); vapor.start(); Sonido.alarma();
        this.tweens.add({ targets: anillo, scale: 1.5, duration: 400, yoyo: true, repeat: -1 });
      });
      anillo.on('pointerdown', () => {
        if (anillo.alpha < 1 || terminado) return;
        this.tweens.killTweensOf(anillo); anillo.disableInteractive().setStrokeStyle(3, 0x3cff6a, 1);
        vapor.stop(); abiertas--; Sonido.bien(); destello(this, x, y, 0x3cff6a);
        flotante(this, x + 40, y - 30, t('SELLADA'), '#3cff6a');
        selladas++;
        if (selladas === puntos.length) {
          terminado = true;
          aviso(this, 'Cabina hermética: la tripulación puede respirar en el vacío del espacio.', CSS.verde, 110);
          this.tweens.add({ targets: c, alpha: 0, duration: 400, delay: 1400, onComplete: () => { c.destroy(); this.final(); } });
        }
      });
      return anillo;
    });
    void fugas;
    const reloj = this.time.addEvent({ delay: 100, loop: true, callback: () => {
      if (terminado) { reloj.remove(); return; }
      presion = Math.max(0, presion - abiertas * segun(0.5, 0.8) + (abiertas === 0 ? 0.5 : 0));
      presion = Math.min(100, presion);
      barra.width = 190 * presion / 100;
      barra.setFillStyle(presion > 60 ? 0x3cff6a : presion > 35 ? 0xffb33f : 0xff4a3d);
      lectura.setText(`${Math.round(presion)} %`);
      if (presion < 35 && !avisada) { avisada = true; this.errores++; Sonido.mal(); aviso(this, '¡La presión cae! Sella las fugas rápido.', CSS.rojo, 110); }
    } });
  }

  /** Remate: la pila completa se ilumina de abajo arriba y aparece la tarjeta con estrellas. */
  private final(): void {
    const { x, y } = this.cfg.base;
    const luz = this.add.rectangle(x, y, 140, 6, 0x3ff3ff, 0.5).setDepth(50).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: luz, y: y - 330, alpha: 0, duration: 1100, ease: 'Sine.in' });
    this.dron.volarA(x + 60, 120, 900);
    Sonido.motor(1.2);
    this.time.delayedCall(1300, () => {
      lograr(this.cfg.logro);
      const estrellas = this.errores === 0 ? 3 : this.errores <= 2 ? 2 : 1;
      const mejor = ganarEstrellas(this.cfg.logro, estrellas);
      tarjetaResultado(this, this.cfg.listo, this.cfg.resultado, () => siguiente(this),
        { estrellas, mejor, nota: t('Errores: {n} · encajes perfectos: {p}. Sin errores ganas las 3 estrellas.', { n: this.errores, p: this.perfectas }) });
    });
  }
}
