// MISIÓN 4 · Despegue: cuenta regresiva, ascenso y separación de etapas en el momento justo.
// Separar antes de tiempo desperdicia combustible; separar tarde carga peso muerto.
// Piloto de ascenso: el jugador maneja el ACELERADOR (↑/↓ o botones). En Max-Q (máxima presión del aire, ~1 min
// después del despegue) hay que bajarlo o sube el estrés estructural; fuera de Max-Q, acelerar a fondo.
// Estrellas: sin sobrecarga + separaciones perfectas (≤0,8 s) + ninguna separación tardía.
import Phaser from 'phaser';
import { W, H, FUENTE, FUENTE_PIXEL, CSS } from '../config';
import { Actor, cargar } from '../core/sprites';
import { siguiente } from '../core/flujo';
import { lograr, ganarEstrellas } from '../core/estado';
import { Presupuesto } from '../ui/presupuesto';
import { segun } from '../core/dificultad';
import { t as tr, numero } from '../core/idioma';
import { Sonido } from '../core/audio';
import { boton, aviso } from '../ui/boton';
import { tarjetaMision, tarjetaResultado } from '../ui/tarjeta';
import { instalarPausa } from './Pausa';
import { ListaHolo, flotante } from '../ui/taller';
import { DECORADOS, piso, cordillera } from '../ui/decorado';
import { esTactil } from '../ui/palanca';

type Fase = 'espera' | 'cuenta' | 'propulsores' | 'central' | 'superior' | 'orbita';

// Hitos reales aproximados de un cohete tipo SLS
const HITO = {
  propulsores: { seg: 126, km: 48, kmh: 5000 },     // fin de propulsores sólidos
  central: { seg: 480, km: 160, kmh: 28000 },       // apagado de la etapa central
};
const DUR_PROP = 9, DUR_CENT = 10, VENTANA = 3;     // segundos de juego
const MAXQ = [0.28, 0.66];                          // tramo de la fase de propulsores con presión máxima
const ACEL_SEGURO = () => segun(0.65, 0.58);        // por encima de esto, en Max-Q sube el estrés
const PERFECTO = () => segun(0.8, 0.5);             // segundos de margen para una separación perfecta

export class Mision4Despegue extends Phaser.Scene {
  private fase: Fase = 'espera';
  private t = 0;            // segundos en la fase actual
  private tarde = 0;        // cuánto tarde separó (penalización)
  private cohete!: Actor;
  private cielo!: Phaser.GameObjects.Rectangle;
  private lista!: ListaHolo;
  private suelo!: Phaser.GameObjects.Container;
  private hud!: Phaser.GameObjects.Text;
  private barra!: Phaser.GameObjects.Rectangle;
  private barraTxt!: Phaser.GameObjects.Text;
  private botonSep?: Phaser.GameObjects.Container;
  private estrellas!: Phaser.GameObjects.Graphics;
  private km = 0; private kmh = 0; private reloj = 0;
  private acel = 1; private estres = 0; private sobrecarga = false; private enMaxQ = false;
  private perfectas = 0; private tardes = 0; private perdida = 0;
  private panelVuelo!: Presupuesto;
  private teclas!: Phaser.Types.Input.Keyboard.CursorKeys;
  private ws!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() { super('Mision4Despegue'); }

  preload(): void {
    cargar(this, ['torre_lanzamiento', 'cohete_completo', 'cohete_despegue', 'cohete_vuelo2', 'cohete_vuelo3', 'cohete_propulsor', 'cohete_nucleo', 'humo_despegue', 'separacion', ...DECORADOS]);
  }

  create(): void {
    this.fase = 'espera'; this.t = 0; this.tarde = 0; this.km = 0; this.kmh = 0; this.reloj = 0;
    this.acel = 1; this.estres = 0; this.sobrecarga = false; this.enMaxQ = false; this.perfectas = 0; this.tardes = 0; this.perdida = 0; this.botonSep = undefined;
    this.cameras.main.fadeIn(400);
    this.cielo = this.add.rectangle(W / 2, H / 2, W, H, 0x3d86d8).setDepth(-100);
    this.estrellas = this.add.graphics().setDepth(-90).setAlpha(0);
    for (let i = 0; i < 200; i++) this.estrellas.fillStyle(0xffffff, 0.4 + (i % 5) * 0.12).fillRect((i * 137) % W, (i * 89) % H, 1 + (i % 9 === 0 ? 1 : 0), 1);
    this.suelo = this.add.container(0, 0);
    // plataforma en el Salar: cordillera, costra de sal y nubes de bloques que el cohete atraviesa al subir
    const refl = cordillera(this, 440, this.suelo, { escala: 1.1, reflejo: 0.2, semilla: 31 });
    piso(this, 'suelo_sal', -20, 440, W + 40, 140, this.suelo, 1);
    refl.forEach(r => this.suelo.add(r));
    this.suelo.add([this.add.rectangle(480, 492, 200, 22, 0x5d6670).setStrokeStyle(2, 0x2b2f38), new Actor(this, 380, 486, 'torre_lanzamiento', { escala: 3.4, dir: 1 })]);
    for (let i = 0; i < 9; i++) {
      const n = new Actor(this, 80 + ((i * 337) % 820), -220 - i * 300, 'nube_bloques', { escala: 2.2 + (i % 3) * 0.6, dir: 1 }).setAlpha(Math.max(0.15, 0.95 - i * 0.1));
      this.suelo.add(n);
    }
    this.cohete = new Actor(this, 480, 486, 'cohete_completo', { escala: 2.6, dir: 0 }).setDepth(5);

    this.hud = this.add.text(20, 18, '', { fontFamily: FUENTE_PIXEL, fontSize: '13px', color: '#ffffff', lineSpacing: 10, backgroundColor: '#000000aa', padding: { x: 10, y: 10 } }).setDepth(50);
    this.add.rectangle(W - 240, 32, 320, 26, 0x000000, 0.7).setStrokeStyle(2, 0xffffff).setDepth(50);
    this.barra = this.add.rectangle(W - 398, 32, 316, 20, 0xffd23f).setOrigin(0, 0.5).setDepth(51);
    this.barraTxt = this.add.text(W - 240, 58, 'COMBUSTIBLE', { fontFamily: FUENTE, fontSize: '13px', fontStyle: '800', color: '#fff' }).setOrigin(0.5, 0).setDepth(51);
    this.pintarHud();
    this.panelVuelo = new Presupuesto(this, W - 214, 84, 'MOTORES', [
      { id: 'acel', etiqueta: 'ACELERADOR', limite: 100, unidad: '%', color: 0x3cff6a },
      { id: 'estres', etiqueta: 'ESTRÉS ESTRUCTURAL', limite: 100, unidad: '%', color: 0x3ff3ff },
    ], 200);
    this.panelVuelo.poner('acel', 100);
    // acelerador táctil
    boton(this, W - 52, H - 150, '▲', () => this.cambiarAcel(0.15), { ancho: 64, alto: 52, variante: 'fantasma', tam: 22 }).setDepth(55);
    boton(this, W - 52, H - 88, '▼', () => this.cambiarAcel(-0.15), { ancho: 64, alto: 52, variante: 'fantasma', tam: 22 }).setDepth(55);
    this.teclas = this.input.keyboard!.createCursorKeys();
    this.ws = this.input.keyboard!.addKeys('W,S') as Record<string, Phaser.Input.Keyboard.Key>;

    instalarPausa(this);
    this.lista = new ListaHolo(this, 14, 132, 'SECUENCIA', ['Ignición', 'Separar propulsores', 'Separar etapa central', 'Llegar a la órbita'], 220);
    this.lista.actual(0);
    tarjetaMision(this, 4, 'Despegue',
      'Pilota el ascenso: en Max-Q (máxima presión del aire) baja el acelerador con ▼ para no dañar el cohete y después súbelo con ▲. Cuando el combustible de cada etapa se acabe, sepárala en el momento justo.',
      ['cohete_completo', 'cohete_propulsor', 'cohete_nucleo'], () => {
        boton(this, W / 2, 380, 'INICIAR CUENTA', () => this.cuenta(), { ancho: 280, color: 0xff6b2c, texto: '#000' }).setName('iniciar');
      });
    this.input.keyboard?.on('keydown-SPACE', (e: KeyboardEvent) => { if (!e.repeat) this.separar(); });
  }

  private cuenta(): void {
    this.children.getByName('iniciar')?.destroy();
    this.fase = 'cuenta';
    const n = this.add.text(W / 2, 200, '10', { fontFamily: FUENTE_PIXEL, fontSize: '64px', color: CSS.amarillo, stroke: '#000', strokeThickness: 8 }).setOrigin(0.5).setDepth(60);
    for (let k = 10; k >= 0; k--) {
      this.time.delayedCall((10 - k) * 450, () => {
        n.setText(k === 0 ? '¡DESPEGUE!' : String(k)).setScale(1.4);
        this.tweens.add({ targets: n, scale: 1, duration: 200 });
        Sonido.cuenta();
        if (k === 0) { this.tweens.add({ targets: n, alpha: 0, delay: 900, duration: 400 }); this.encender(); }
      });
    }
  }

  private encender(): void {
    this.cambiarCohete('cohete_despegue', 2.6 * 1.25 / 1.1);
    const humo = new Actor(this, 480, 500, 'humo_despegue', { escala: 4 }).setDepth(4);
    this.suelo.add(humo);
    Sonido.motor(4);
    this.cameras.main.shake(DUR_PROP * 1000, 0.004);
    this.fase = 'propulsores'; this.t = 0;
    this.lista.marcar(0); this.lista.actual(1);
    this.barraTxt.setText('PROPULSORES SÓLIDOS');
  }

  private cambiarAcel(d: number): void {
    this.acel = Phaser.Math.Clamp(this.acel + d, 0.4, 1);
    this.panelVuelo.poner('acel', Math.round(this.acel * 100));
  }

  /** Acelerador y Max-Q durante el ascenso. */
  private pilotar(dt: number, f: number): void {
    const sube = this.teclas.up.isDown || this.ws.W.isDown, baja = this.teclas.down.isDown || this.ws.S.isDown;
    if (sube || baja) { this.acel = Phaser.Math.Clamp(this.acel + (sube ? 0.8 : -0.8) * dt, 0.4, 1); this.panelVuelo.poner('acel', Math.round(this.acel * 100)); }
    const maxq = this.fase === 'propulsores' && f >= MAXQ[0] && f <= MAXQ[1];
    if (maxq !== this.enMaxQ) {
      this.enMaxQ = maxq;
      if (maxq) { Sonido.alarma(); aviso(this, 'MAX-Q: máxima presión del aire. ¡Baja el acelerador! (▼)', CSS.amarillo, 120); }
      else if (this.fase === 'propulsores') aviso(this, 'Max-Q superado: acelerador a fondo (▲)', CSS.verde, 120);
    }
    if (maxq) this.estres = Math.min(100, this.estres + dt * 100 * Math.max(0, this.acel - ACEL_SEGURO()) / (1 - ACEL_SEGURO()) * segun(1.4, 1.96));
    else {
      this.estres = Math.max(0, this.estres - dt * 45);
      this.perdida += dt * (1 - this.acel) * 700;   // acelerar poco fuera de Max-Q cuesta velocidad
    }
    if (this.estres >= 100 && !this.sobrecarga) {
      this.sobrecarga = true;
      Sonido.mal();
      this.cameras.main.shake(500, 0.012);
      aviso(this, '¡Sobrecarga estructural! En Max-Q el aire empuja fuerte: hay que bajar el acelerador.', CSS.rojo, 120);
      this.panelVuelo.sacudir('estres');
      this.acel = 0.6; this.panelVuelo.poner('acel', 60); this.estres = 70;
    }
    this.panelVuelo.poner('estres', Math.round(this.estres));
  }

  private cambiarCohete(id: string, escala: number): void {
    const { x, y } = this.cohete;
    this.cohete.destroy();
    this.cohete = new Actor(this, x, y, id, { escala, dir: 0 }).setDepth(5);
  }

  update(_: number, dtms: number): void {
    const dt = dtms / 1000;
    if (this.fase === 'espera' || this.fase === 'cuenta') return;
    this.t += dt;
    // ascenso visual: el cohete sube hasta el centro y luego el suelo baja
    if (this.cohete.y > 330) this.cohete.y -= dt * 60;
    else this.suelo.y += dt * 140;
    const alto = Phaser.Math.Clamp(this.km / 120, 0, 1);
    this.cielo.setFillStyle(Phaser.Display.Color.GetColor(61 * (1 - alto), 134 * (1 - alto) + 4 * alto, 216 * (1 - alto) + 14 * alto));
    this.estrellas.setAlpha(alto);

    if (this.fase === 'propulsores' || this.fase === 'central') this.pilotar(dt, Math.min(1, this.t / (this.fase === 'propulsores' ? DUR_PROP : DUR_CENT)));
    if (this.fase === 'propulsores') {
      const f = Math.min(1, this.t / DUR_PROP);
      this.reloj = f * HITO.propulsores.seg; this.km = f * f * HITO.propulsores.km; this.kmh = f * HITO.propulsores.kmh - this.perdida;
      this.barra.width = 316 * (1 - f);
      if (f >= 1) this.ventana('SEPARAR PROPULSORES', this.t - DUR_PROP);
    } else if (this.fase === 'central') {
      const f = Math.min(1, this.t / DUR_CENT);
      this.reloj = HITO.propulsores.seg + f * (HITO.central.seg - HITO.propulsores.seg);
      this.km = HITO.propulsores.km + f * (HITO.central.km - HITO.propulsores.km);
      this.kmh = HITO.propulsores.kmh + f * (HITO.central.kmh - HITO.propulsores.kmh) - this.tarde * 900 - this.perdida;
      this.barra.width = 316 * (1 - f);
      if (f >= 1) this.ventana('SEPARAR ETAPA CENTRAL', this.t - DUR_CENT);
    } else if (this.fase === 'superior') {
      this.km += dt * 6; this.kmh += dt * 300; this.reloj += dt * 20;
      if (this.t > 4) this.exito();
    }
    this.pintarHud();
  }

  /** Abre la ventana de separación; si se pasa, separa sola con penalización. */
  private ventana(texto: string, pasado: number): void {
    if (!this.botonSep) {
      this.barra.setFillStyle(0xff4a3d);
      this.botonSep = boton(this, W / 2, 470, texto + (esTactil() ? '' : '  [ESPACIO]'), () => this.separar(), { ancho: 420, color: 0x3cff6a });
      this.tweens.add({ targets: this.botonSep, alpha: 0.5, duration: 250, yoyo: true, repeat: -1 });
      Sonido.alarma();
    }
    if (pasado > VENTANA) {
      this.tarde += pasado; this.tardes++;
      aviso(this, 'Tarde: el cohete cargó peso muerto y perdió velocidad', CSS.rojo, 120);
      this.separar(true);
    }
  }

  private separar(forzado = false): void {
    if (this.fase !== 'propulsores' && this.fase !== 'central') return;
    const lleno = this.fase === 'propulsores' ? this.t < DUR_PROP : this.t < DUR_CENT;
    if (lleno && !forzado) { Sonido.mal(); aviso(this, '¡Todavía queda combustible! Espera a que la barra se vacíe.', CSS.amarillo, 120); return; }
    const retraso = this.t - (this.fase === 'propulsores' ? DUR_PROP : DUR_CENT);
    if (!forzado && retraso <= PERFECTO()) this.perfectas++;
    if (!forzado) { Sonido.bien(); aviso(this, this.fase === 'propulsores' ? '¡Separación perfecta! Los propulsores caen al océano.' : '¡Etapa central fuera! La etapa superior toma el mando.', CSS.verde, 120); }
    this.botonSep?.destroy(); this.botonSep = undefined;
    this.barra.setFillStyle(0xffd23f).width = 316;
    const fx = new Actor(this, this.cohete.x, this.cohete.y - 40, 'separacion', { escala: 2.4 }).setDepth(6);
    this.time.delayedCall(1500, () => fx.destroy());
    if (this.fase === 'propulsores') {
      [-1, 1].forEach(s => {
        const p = new Actor(this, this.cohete.x + s * 34, this.cohete.y, 'cohete_propulsor', { escala: 2.6 * 1.25 / 1.65, dir: 0 }).setDepth(4);
        this.tweens.add({ targets: p, x: p.x + s * 160, y: H + 260, angle: s * 70, duration: 2600, ease: 'Quad.in', onComplete: () => p.destroy() });
      });
      this.cambiarCohete('cohete_vuelo2', 2.6 * 1.25 / 1.1);
      this.fase = 'central'; this.t = 0; this.barraTxt.setText('ETAPA CENTRAL');
      this.lista.marcar(1); this.lista.actual(2); flotante(this, this.cohete.x + 70, this.cohete.y - 120, forzado ? 'TARDE' : retraso <= PERFECTO() ? '¡PERFECTO!' : '¡JUSTO!', forzado ? '#ff4a3d' : '#3cff6a');
    } else {
      const c = new Actor(this, this.cohete.x, this.cohete.y, 'cohete_nucleo', { escala: 2.6 * 1.25 / 1.45, dir: 0 }).setDepth(4);
      this.tweens.add({ targets: c, y: H + 300, angle: 25, duration: 3000, ease: 'Quad.in', onComplete: () => c.destroy() });
      this.cohete.y -= 47 * 2.6 * 1.25;
      this.cambiarCohete('cohete_vuelo3', 2.6 * 1.25 / 2 * 1.6);
      this.tweens.add({ targets: this.cohete, y: 300, duration: 1500 });
      this.fase = 'superior'; this.t = 0; this.barraTxt.setText('ETAPA SUPERIOR');
      this.lista.marcar(2); this.lista.actual(3); flotante(this, this.cohete.x + 70, this.cohete.y - 80, forzado ? 'TARDE' : retraso <= PERFECTO() ? '¡PERFECTO!' : '¡JUSTO!', forzado ? '#ff4a3d' : '#3cff6a');
    }
  }

  private exito(): void {
    this.fase = 'orbita';
    this.lista.marcar(3);
    const perfecto = this.tarde === 0;
    if (perfecto) lograr('m4');
    const estrellas = Math.max(1, (this.sobrecarga ? 0 : 1) + (this.perfectas === 2 ? 1 : 0) + (this.tardes === 0 ? 1 : 0));
    const mejor = ganarEstrellas('m4', estrellas);
    const nota = this.sobrecarga ? tr('Hubo sobrecarga en Max-Q: baja el acelerador a tiempo.') : this.perfectas < 2 ? tr('Separa cada etapa apenas se vacíe la barra (menos de 0,8 s).') : '';
    tarjetaResultado(this, perfecto ? '¡En órbita!' : 'En órbita, por poco', [
      `Altitud: ${Math.round(this.km)} km · Velocidad: ${numero(Math.round(this.kmh))} km/h`,
      'Propulsores sólidos: ~2 minutos · Etapa central: ~8 minutos.',
      perfecto ? 'Separaste cada etapa en el momento justo.' : 'Separar a tiempo ahorra peso y combustible: ¡inténtalo perfecto la próxima!',
    ], () => siguiente(this), { estrellas, mejor, nota });
  }

  private pintarHud(): void {
    const m = Math.floor(this.reloj / 60), s = Math.floor(this.reloj % 60);
    this.hud.setText(`T+ ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}\nALT  ${Math.round(this.km)} km\nVEL  ${numero(Math.round(Math.max(0, this.kmh)))} km/h`);
  }
}
