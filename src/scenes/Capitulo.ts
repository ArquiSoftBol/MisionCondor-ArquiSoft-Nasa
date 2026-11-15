// Pantalla de paso entre partes de la aventura: muestra la RUTA completa (cinemáticas y misiones), dónde estás,
// qué viene y —si es una misión— su tema. Así nadie se pierde entre cinemáticas y minijuegos.
// Dura ~2,8 s; tocar / Espacio / Enter salta. Luego arranca la escena del paso.
import Phaser from 'phaser';
import { W, H, FUENTE, FUENTE_PIXEL } from '../config';
import { FLUJO } from '../core/flujo';
import { TOTAL_MISIONES, esMision } from '../core/misiones';
import { t } from '../core/idioma';
import { degradado, estrellas } from '../ui/fondo';
import { vineta } from '../ui/ambiente';
import { grano } from '../ui/cine';
import { guiaDe } from '../data/guias';
import { chipTema } from '../ui/guia';
import { Sonido } from '../core/audio';
import { Musica } from '../core/musica';

const AMARILLO = 0xffe14d, CIAN = 0x3ff3ff, APAGADO = 0x33405a;

export class Capitulo extends Phaser.Scene {
  private i = 0;
  private yendo = false;
  constructor() { super('Capitulo'); }

  init(d: { i?: number }): void { this.i = d.i ?? Number(new URLSearchParams(location.search).get('paso') ?? 5); this.yendo = false; }   // ?paso=N (pruebas)

  create(): void {
    const paso = FLUJO[this.i];
    const esJuego = esMision(paso.escena);
    const color = esJuego ? 0x3cff6a : AMARILLO;
    const hex = '#' + color.toString(16).padStart(6, '0');
    this.cameras.main.fadeIn(350, 0, 0, 0);
    degradado(this, 0x02040c, esJuego ? 0x06221a : 0x1a1406);
    estrellas(this, 160, 11 + this.i);
    if (esJuego) Musica.paraEscena(paso.escena);   // la música de la misión entra ya, sin corte

    // ── qué viene ──
    const n = esJuego ? Number(paso.titulo.match(/\d+/)?.[0] ?? 0) : 0;
    const tipo = esJuego ? t('MINIJUEGO · MISIÓN {n} DE {t}', { n, t: TOTAL_MISIONES }) : paso.escena === 'Fin' ? t('FINAL') : t('CINEMÁTICA');
    const nombre = esJuego ? paso.titulo.split(' · ').slice(1).join(' · ') : paso.titulo;
    const kicker = this.add.text(W / 2, 128, tipo, { fontFamily: FUENTE_PIXEL, fontSize: '11px', color: hex }).setOrigin(0.5);
    const tit = this.add.text(W / 2, 176, t(nombre), { fontFamily: FUENTE, fontSize: '46px', fontStyle: '800', color: '#ffffff', stroke: '#000000', strokeThickness: 8, align: 'center' }).setOrigin(0.5);
    if (tit.width > W - 80) tit.setFontSize(36);
    const linea = this.add.rectangle(W / 2, 214, Math.min(420, tit.width + 40), 3, color).setScale(0, 1);
    this.tweens.add({ targets: linea, scaleX: 1, duration: 600, delay: 250, ease: 'Cubic.out' });
    const guia = guiaDe(paso.escena);
    const piezas: (Phaser.GameObjects.Text | Phaser.GameObjects.Container)[] = [kicker, tit];
    if (guia) piezas.push(chipTema(this, W / 2, 246, guia.tema, 0x3cff6a));
    piezas.forEach((o, k) => { o.setAlpha(0); const y = o.y; o.y = y + 16; this.tweens.add({ targets: o, alpha: 1, y, duration: 420, delay: 120 + k * 140, ease: 'Cubic.out' }); });

    // ── la ruta: un punto por parte de la historia (sin el registro) ──
    const ruta = FLUJO.map((p, k) => ({ p, k })).filter(({ p }) => p.escena !== 'Registro');
    const x0 = 90, x1 = W - 90, y = 360, sep = (x1 - x0) / (ruta.length - 1);
    const g = this.add.graphics();
    g.lineStyle(3, APAGADO, 1).lineBetween(x0, y, x1, y);
    const hecho = ruta.findIndex(r => r.k === this.i);
    const avance = this.add.graphics();
    const pintarAvance = (f: number) => avance.clear().lineStyle(3, CIAN, 1).lineBetween(x0, y, x0 + sep * Math.max(0, hecho - 1 + f), y);
    pintarAvance(0);
    this.tweens.addCounter({ from: 0, to: 1, duration: 700, delay: 400, ease: 'Cubic.inOut', onUpdate: tw => pintarAvance(tw.getValue() ?? 1) });
    const alto: number[] = [];   // etiquetas de cinemáticas seguidas: una arriba, otra más arriba (no se pisan)
    ruta.forEach(({ p, k }, j) => {
      const x = x0 + j * sep, mision = esMision(p.escena), actual = k === this.i, pasado = k < this.i;
      const col = actual ? color : pasado ? CIAN : APAGADO;
      const r = mision ? 13 : 7;
      const nodo = mision
        ? this.add.rectangle(x, y, r * 1.5, r * 1.5, pasado || actual ? col : 0x0b1222).setAngle(45).setStrokeStyle(2, col)
        : this.add.circle(x, y, r, pasado || actual ? col : 0x0b1222).setStrokeStyle(2, col);
      if (mision) this.add.text(x, y + 1, String(Number(p.titulo.match(/\d+/)?.[0])), { fontFamily: FUENTE_PIXEL, fontSize: '8px', color: pasado || actual ? '#04121a' : '#7f93b5' }).setOrigin(0.5);
      // etiqueta corta: abajo las misiones, arriba las cinemáticas (no se pisan)
      const corto = mision ? t('Misión') + ' ' + p.titulo.match(/\d+/)?.[0] : t(p.titulo);
      this.add.text(x, mision ? y + 30 : y - 26 - (j > 0 && !esMision(ruta[j - 1].p.escena) && !alto[j - 1] ? (alto[j] = 1) * 14 : 0), corto, { fontFamily: FUENTE, fontSize: actual ? '12px' : '10px', fontStyle: '800', color: actual ? hex : pasado ? '#9fdcff' : '#5d6b86', align: 'center' }).setOrigin(0.5);
      if (actual) {
        const halo = this.add.circle(x, y, r + 10, color, 0.25);
        this.tweens.add({ targets: halo, scale: 1.6, alpha: 0, duration: 1000, repeat: -1 });
        this.tweens.add({ targets: nodo, scale: 1.25, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        const aqui = this.add.text(x, y + (mision ? 52 : 26), t('▲ ESTÁS AQUÍ'), { fontFamily: FUENTE_PIXEL, fontSize: '7px', color: hex }).setOrigin(0.5);
        this.tweens.add({ targets: aqui, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });
      }
    });
    const hechas = FLUJO.filter((p, k) => k < this.i && esMision(p.escena)).length;
    this.add.text(W / 2, 444, t('Misiones superadas: {n} de {t}', { n: hechas, t: TOTAL_MISIONES }), { fontFamily: FUENTE, fontSize: '13px', fontStyle: '700', color: '#9fb3d1' }).setOrigin(0.5);
    const toca = this.add.text(W / 2, H - 30, t('Toca para continuar'), { fontFamily: FUENTE_PIXEL, fontSize: '8px', color: '#7f93b5' }).setOrigin(0.5);
    this.tweens.add({ targets: toca, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
    vineta(this, 0.6, 45);
    grano(this, 46, 0.05);

    Sonido.tecla();
    this.time.delayedCall(3000, () => this.ir());
    this.input.once('pointerdown', () => this.ir());
    this.input.keyboard?.once('keydown-SPACE', () => this.ir());
    this.input.keyboard?.once('keydown-ENTER', () => this.ir());
  }

  private ir(): void {
    if (this.yendo) return;
    this.yendo = true;
    const p = FLUJO[this.i];
    this.cameras.main.fadeOut(380, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(p.escena, p.datos ?? {}));
  }
}
