// Láminas 4–6: nombre → orientación → mascota. Una decisión por pantalla.
// Cada paso ocurre dentro del mundo del juego: el Salar de noche y el Hangar de Ensamblaje.
import Phaser from 'phaser';
import { W, H, FUENTE, FUENTE_PIXEL } from '../config';
import { Actor, cargar } from '../core/sprites';
import { perfil, guardar, type Orientacion } from '../core/estado';
import { siguiente } from '../core/flujo';
import { Sonido } from '../core/audio';
import { Musica } from '../core/musica';
import { boton, aviso, panel } from '../ui/boton';
import { fondoSalar, fondoHangar, HOJAS_ESCENARIO } from '../ui/escenarios';

type Paso = 'nombre' | 'orientacion' | 'mascota';

const ESTILO_INPUT = `width:440px;font:700 28px "Press Start 2P",monospace;text-align:center;color:#fff;background:rgba(63,243,255,.08);
  border:0;border-bottom:4px solid #3ff3ff;border-radius:10px 10px 0 0;outline:none;padding:14px 0 10px;letter-spacing:2px;
  text-transform:uppercase;caret-color:#ffe14d;text-shadow:0 0 12px rgba(63,243,255,.8);`;

export class Registro extends Phaser.Scene {
  private paso: Paso = 'nombre';
  constructor() { super('Registro'); }

  init(d: { paso?: Paso }): void { this.paso = d.paso ?? 'nombre'; }

  preload(): void { cargar(this, ['protagonista_m', 'protagonista_f', 'protagonista_x', 'mascota_sentada', 'mascota_salta', ...HOJAS_ESCENARIO]); }

  create(): void {
    Musica.poner('enero');
    this.cameras.main.fadeIn(400);
    if (this.paso === 'nombre') this.pantallaNombre();
    if (this.paso === 'orientacion') this.pantallaOrientacion();
    if (this.paso === 'mascota') this.pantallaMascota();
    this.indicador(['nombre', 'orientacion', 'mascota'].indexOf(this.paso));
  }

  private ir(p: Paso | 'fin'): void {
    this.input.enabled = false;
    if (p === 'fin') { siguiente(this); return; }
    this.cameras.main.fadeOut(300);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart({ paso: p }));
  }

  /** Indicador «paso N de 3» con puntos que se encienden. */
  private indicador(i: number): void {
    const nombres = ['TU NOMBRE', 'ORIENTACIÓN', 'MASCOTA'];
    const c = this.add.container(W / 2, H - 22).setDepth(50);
    const fondo = this.add.graphics().fillStyle(0x040914, 0.75).fillRoundedRect(-230, -38, 460, 54, 14);
    c.add(fondo);
    nombres.forEach((n, k) => {
      const x = (k - 1) * 150, activo = k === i, hecho = k < i;
      const g = this.add.graphics();
      if (k < 2) g.lineStyle(2, hecho ? 0x3ff3ff : 0x33405a, 1).lineBetween(x + 12, 0, x + 138, 0);
      g.fillStyle(activo ? 0xffe14d : hecho ? 0x3ff3ff : 0x33405a, 1).fillCircle(x, 0, activo ? 8 : 6);
      const t = this.add.text(x, -20, n, { fontFamily: FUENTE, fontSize: '11px', fontStyle: '800', color: activo ? '#ffe14d' : hecho ? '#9fdcff' : '#5a6a88' }).setOrigin(0.5);
      c.add([g, t]);
      if (activo) {
        const anillo = this.add.circle(x, 0, 8).setStrokeStyle(2, 0xffe14d, 1);
        c.add(anillo);
        this.tweens.add({ targets: anillo, radius: 18, alpha: 0, duration: 1100, repeat: -1 });
      }
    });
  }

  private tituloPixel(t: string, y = 120): Phaser.GameObjects.Text {
    const tx = this.add.text(W / 2, y - 20, t, { fontFamily: FUENTE_PIXEL, fontSize: '22px', color: '#ffffff', align: 'center', lineSpacing: 12, stroke: '#04121a', strokeThickness: 6 }).setOrigin(0.5).setDepth(5).setAlpha(0);
    this.tweens.add({ targets: tx, alpha: 1, y, duration: 450, ease: 'Back.out', delay: 150 });
    return tx;
  }

  /** Campo de texto real (abre el teclado del celular). */
  private campo(y: number, valor: string, max: number, alEnviar: (v: string) => void): HTMLInputElement {
    const dom = this.add.dom(W / 2, y, 'input', ESTILO_INPUT);
    const el = dom.node as HTMLInputElement;
    el.type = 'text'; el.maxLength = max; el.value = valor; el.autocomplete = 'off'; el.spellcheck = false;
    el.setAttribute('enterkeyhint', 'next');
    el.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') alEnviar(el.value); else Sonido.tecla(); });
    dom.setAlpha(0);
    this.tweens.add({ targets: dom, alpha: 1, duration: 300, delay: 350 });
    this.time.delayedCall(400, () => el.focus());
    return el;
  }

  private pantallaNombre(): void {
    fondoSalar(this, { hora: 'noche', suelo: 350 });
    panel(this, W / 2, 232, 600, 250, { titulo: 'REGISTRO DE LA BASE' }).setDepth(2);
    this.tituloPixel('INTRODUCE TU NOMBRE', 160);
    const sub = this.add.text(W / 2, 200, 'Así te llamará la historia', { fontFamily: FUENTE, fontSize: '15px', fontStyle: 'italic 700', color: '#9fdcff' }).setOrigin(0.5).setDepth(5);
    sub.setAlpha(0); this.tweens.add({ targets: sub, alpha: 1, delay: 300, duration: 400 });
    const enviar = (v: string) => {
      const n = v.trim();
      if (n.length < 2) { Sonido.mal(); aviso(this, 'Escribe al menos 2 letras', '#ff4a3d'); return; }
      perfil.nombre = n.charAt(0).toUpperCase() + n.slice(1).toLowerCase(); guardar(); this.ir('orientacion');
    };
    const el = this.campo(268, perfil.nombre, 14, enviar);
    boton(this, W / 2, 400, 'Siguiente', () => enviar(el.value), { ancho: 240, variante: 'primario', icono: '➜', retardo: 400 });
  }

  private pantallaOrientacion(): void {
    fondoHangar(this, 380);
    this.tituloPixel('SELECCIONA\nTU ORIENTACIÓN', 76);
    const opciones: [Orientacion, string, number, string][] = [['m', '♂', 0x2e9be6, 'ÉL'], ['f', '♀', 0xf25cb0, 'ELLA'], ['x', 'OTRO', 0x2f8a5a, 'ELLE']];
    opciones.forEach(([o, simbolo, col, nombre], i) => {
      const x = W / 2 + (i - 1) * 230, y = 278;
      const hex = '#' + col.toString(16).padStart(6, '0');
      const c = this.add.container(x, y).setDepth(5);
      const g = this.add.graphics();
      g.fillStyle(0x040914, 0.9).fillRoundedRect(-95, -145, 190, 280, 18);
      g.fillGradientStyle(col, col, 0x040914, 0x040914, 0.5, 0.5, 0, 0).fillRoundedRect(-95, -145, 190, 140, { tl: 18, tr: 18, bl: 0, br: 0 });
      g.lineStyle(3, col, 1).strokeRoundedRect(-95, -145, 190, 280, 18);
      const sim = this.add.text(0, -98, simbolo, { fontFamily: FUENTE, fontSize: simbolo === 'OTRO' ? '30px' : '62px', fontStyle: '800', color: '#ffffff', stroke: hex, strokeThickness: 8 }).setOrigin(0.5);
      const ped = this.add.ellipse(0, 92, 120, 28, col, 0.25).setStrokeStyle(2, col, 0.9);
      const et = this.add.text(0, 118, nombre, { fontFamily: FUENTE_PIXEL, fontSize: '12px', color: '#ffffff' }).setOrigin(0.5);
      c.add([g, sim, ped, et]).setSize(190, 280).setInteractive({ useHandCursor: true });
      const fig = new Actor(this, x, y + 92, `protagonista_${o}`, { escala: 2.6, dir: 1 }).setDepth(6).pausar();
      // entrada en cascada
      for (const t of [c, fig] as Phaser.GameObjects.Container[]) {
        const y0 = t.y;
        t.setAlpha(0).setY(y0 + 40);
        this.tweens.add({ targets: t, alpha: 1, y: y0, duration: 450, delay: 250 + i * 140, ease: 'Back.out' });
      }
      this.tweens.add({ targets: sim, scale: 1.08, duration: 900 + i * 100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      let giro: Phaser.Time.TimerEvent | undefined, d = 1;
      c.on('pointerover', () => {
        Sonido.tecla();
        this.tweens.add({ targets: c, scale: 1.06, duration: 140 });
        this.tweens.add({ targets: fig, scale: 2.85, duration: 140 });
        fig.seguir();
        giro = this.time.addEvent({ delay: 420, loop: true, callback: () => { d = (d + 1) % 8; fig.mirar(d); } });
      });
      c.on('pointerout', () => {
        this.tweens.add({ targets: c, scale: 1, duration: 140 });
        this.tweens.add({ targets: fig, scale: 2.6, duration: 140 });
        giro?.remove(); fig.mirar(1).pausar();
      });
      c.on('pointerdown', () => {
        Sonido.bien(); perfil.orientacion = o; guardar();
        c.disableInteractive();
        this.tweens.add({ targets: [c, fig], scale: '*=1.12', duration: 160, yoyo: true, onComplete: () => this.ir('mascota') });
      });
    });
    const saludo = this.add.text(W / 2, 444, `Hola, ${perfil.nombre}. ¿Cómo quieres que te nombre la historia?`, { fontFamily: FUENTE, fontSize: '16px', fontStyle: '700', color: '#e8f6ff', backgroundColor: '#040914cc', padding: { x: 12, y: 6 } }).setOrigin(0.5).setDepth(5);
    saludo.setAlpha(0); this.tweens.add({ targets: saludo, alpha: 1, delay: 800, duration: 400 });
  }

  private pantallaMascota(): void {
    fondoSalar(this, { hora: 'noche', suelo: 380 });
    panel(this, W / 2, 205, 600, 250, { titulo: 'TU COMPAÑERO' }).setDepth(2);
    this.tituloPixel('ESCRIBE EL NOMBRE\nDE TU MASCOTA', 132);
    // la mascota espera sentada su nombre junto a su humano; cuando lo recibe, salta de alegría
    let perro = new Actor(this, W / 2 - 60, 452, 'mascota_sentada', { escala: 3.2, dir: 7 }).setDepth(6);
    const festejar = () => { const { x, y } = perro; perro.destroy(); perro = new Actor(this, x, y, 'mascota_salta', { escala: 3.2, dir: 7 }).setDepth(6); };
    new Actor(this, W / 2 + 60, 454, `protagonista_${perfil.orientacion}`, { escala: 3.2, dir: 1 }).setDepth(6).pausar();
    const enviar = (v: string) => {
      const n = v.trim();
      if (n.length < 2) { Sonido.mal(); aviso(this, 'Ponle un nombre de al menos 2 letras', '#ff4a3d'); return; }
      perfil.mascota = n.charAt(0).toUpperCase() + n.slice(1).toLowerCase(); guardar(); Sonido.bien(); festejar();
      aviso(this, `¡${perfil.mascota} está feliz!`, '#3cff6a');
      this.time.delayedCall(1100, () => this.ir('fin'));
    };
    const el = this.campo(222, perfil.mascota, 12, enviar);
    boton(this, W / 2, 296, '¡Comenzar la historia!', () => enviar(el.value), { ancho: 330, variante: 'aviso', icono: '★', retardo: 400, pulso: true });
  }
}
