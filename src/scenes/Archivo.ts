// ARCHIVO · la bitácora holográfica: la historia documentada por capítulos, quiénes somos (ARQUISOFT) y el reto de la NASA.
// Los capítulos se desbloquean al avanzar; «Ver todo» los muestra todos (útil para presentar ante el jurado).
import Phaser from 'phaser';
import { W, H, FUENTE, FUENTE_PIXEL, CSS } from '../config';
import { Actor, cargar } from '../core/sprites';
import { perfil } from '../core/estado';
import { personalizar } from '../core/texto';
import { t as tr } from '../core/idioma';
import { Sonido } from '../core/audio';
import { Musica } from '../core/musica';
import { boton, panel } from '../ui/boton';
import { icono } from '../ui/iconos';
import { fondoHangar, HOJAS_ESCENARIO } from '../ui/escenarios';
import { CAPITULOS, ARQUISOFT, RETO } from '../data/archivo';

type Pestana = 'historia' | 'arquisoft' | 'reto';
const COLOR_ETAPA: Record<string, string> = { 'PRÓLOGO': CSS.amarillo, NUDO: CSS.naranja, 'CLÍMAX': CSS.rosa, 'EPÍLOGO': CSS.verde };
const PX = 300, PY = 70, PW = 630, PH = 440;   // panel de contenido
const evaId = (id: string) => (id.startsWith('EVA:') ? `eva_${perfil.orientacion}_${id.slice(4)}` : id);

export class Archivo extends Phaser.Scene {
  private pestana: Pestana = 'historia';
  private pagina = 0;
  private verTodo = false;
  private contenido!: Phaser.GameObjects.Container;
  private botones: Partial<Record<Pestana, Phaser.GameObjects.Text>> = {};

  constructor() { super('Archivo'); }

  preload(): void {
    cargar(this, [...HOJAS_ESCENARIO, 'bitacora_holo', ...new Set(CAPITULOS.flatMap(c => c.sprites.map(evaId)))]);
  }

  create(): void {
    Musica.poner('menu');
    this.cameras.main.fadeIn(400);
    fondoHangar(this, 430);
    this.add.rectangle(W / 2, H / 2, W, H, 0x02040a, 0.35);   // atenúa el hangar para leer cómodo
    const libro = new Actor(this, 150, 236, 'bitacora_holo', { escala: 2.4, dir: 1 });
    this.add.ellipse(150, 236, 150, 40, 0x3ff3ff, 0.15).setStrokeStyle(2, 0x3ff3ff, 0.6).setDepth(-1);
    libro.setScale(0); this.tweens.add({ targets: libro, scale: 2.4, duration: 500, ease: 'Back.out' });
    this.add.text(150, 36, 'ARCHIVO', { fontFamily: FUENTE_PIXEL, fontSize: '22px', color: CSS.cian }).setOrigin(0.5);
    this.add.text(150, 62, 'Bitácora de la base', { fontFamily: FUENTE, fontSize: '13px', fontStyle: 'italic 700', color: '#9fdcff' }).setOrigin(0.5);

    const pest: [Pestana, string][] = [['historia', 'La historia'], ['arquisoft', 'ARQUISOFT'], ['reto', 'El reto NASA']];
    pest.forEach(([k, t], i) => {
      this.botones[k] = this.add.text(150, 290 + i * 56, t, {
        fontFamily: FUENTE, fontSize: '17px', fontStyle: '800', color: '#e8f6ff', backgroundColor: '#0b1a2e', padding: { x: 14, y: 11 }, fixedWidth: 210, align: 'center',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => { Sonido.click(); this.pestana = k; this.pagina = 0; this.pintar(); });
    });
    boton(this, 150, H - 34, 'Volver', () => this.volver(), { ancho: 180, alto: 44, tam: 16, variante: 'fantasma', icono: '←', retardo: 500 });

    panel(this, PX + PW / 2, PY + PH / 2, PW, PH, { titulo: 'BITÁCORA' });
    this.contenido = this.add.container(0, 0);
    this.input.keyboard?.on('keydown-ESC', () => this.volver());
    this.input.keyboard?.on('keydown-RIGHT', () => this.pasar(1));
    this.input.keyboard?.on('keydown-LEFT', () => this.pasar(-1));
    this.pintar();
  }

  private volver(): void {
    this.cameras.main.fadeOut(300);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Titulo'));
  }

  private pasar(d: number): void {
    if (this.pestana !== 'historia') return;
    const n = Phaser.Math.Clamp(this.pagina + d, 0, CAPITULOS.length - 1);
    if (n !== this.pagina) { this.pagina = n; Sonido.tecla(); this.pintar(); }
  }

  private t(x: number, y: number, s: string, o: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.GameObjects.Text {
    const txt = this.add.text(x, y, s, { fontFamily: FUENTE, fontSize: '16px', fontStyle: '700', color: '#fff', wordWrap: { width: PW - 60 }, lineSpacing: 6, ...o });
    this.contenido.add(txt);
    return txt;
  }

  private pintar(): void {
    this.contenido.removeAll(true);
    (Object.keys(this.botones) as Pestana[]).forEach(k => this.botones[k]!.setBackgroundColor(k === this.pestana ? '#3ff3ff' : '#0b1a2e').setColor(k === this.pestana ? '#04121a' : '#e8f6ff'));
    if (this.pestana === 'historia') this.historia();
    if (this.pestana === 'arquisoft') this.arquisoft();
    if (this.pestana === 'reto') this.reto();
    this.contenido.setAlpha(0);
    this.tweens.add({ targets: this.contenido, alpha: 1, duration: 200 });
  }

  private historia(): void {
    const c = CAPITULOS[this.pagina];
    const abierto = this.verTodo || perfil.paso >= c.desde;
    const x0 = PX + 30;
    this.t(x0, PY + 20, c.etapa, { fontSize: '14px', fontStyle: '800', color: COLOR_ETAPA[c.etapa] });
    this.t(PX + PW - 30, PY + 20, `${this.pagina + 1} / ${CAPITULOS.length}`, { fontSize: '14px', color: '#8b96ab' }).setOrigin(1, 0);
    this.t(x0, PY + 46, abierto ? c.titulo : '???', { fontSize: '28px', fontStyle: '800', color: CSS.amarillo });
    if (abierto) {
      c.sprites.map(evaId).forEach((id, i) => this.contenido.add(new Actor(this, PX + PW / 2 + (i - (c.sprites.length - 1) / 2) * 170, PY + 215, id, { escala: id.includes('perro') ? 2.2 : 1.35, dir: 1 })));
      this.t(x0, PY + 250, personalizar(tr(c.texto)), { fontSize: '17px', fontStyle: 'italic 700' });
    } else {
      this.contenido.add(icono(this, PX + PW / 2, PY + 200, 'ico_candado', 72));
      this.t(PX + PW / 2, PY + 290, 'Avanza en la aventura para desbloquear este capítulo.', { fontSize: '17px', align: 'center', color: '#9aa3b5' }).setOrigin(0.5, 0);
    }
    // navegación
    const nav = (x: number, s: string, d: number, activo: boolean) => {
      const b = this.t(x, PY + PH - 34, s, { fontSize: '26px', fontStyle: '800', color: activo ? CSS.cian : '#33405a' }).setOrigin(0.5);
      if (activo) b.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.pasar(d));
    };
    nav(PX + 40, '◀', -1, this.pagina > 0);
    nav(PX + PW - 40, '▶', 1, this.pagina < CAPITULOS.length - 1);
    const todo = this.t(PX + PW / 2, PY + PH - 34, this.verTodo ? 'Ocultar lo no jugado' : 'Ver toda la historia', { fontSize: '14px', color: '#9fdcff' }).setOrigin(0.5);
    todo.setInteractive({ useHandCursor: true }).on('pointerdown', () => { Sonido.click(); this.verTodo = !this.verTodo; this.pintar(); });
  }

  /** Apila bloques de texto uno debajo del otro. */
  private pila(y0: number) {
    let y = y0;
    return {
      sub: (txt: string) => { const t = this.t(PX + 30, y, txt, { fontSize: '13px', fontStyle: '800', color: CSS.cian }); y += t.height + 4; },
      par: (txt: string, o: Phaser.Types.GameObjects.Text.TextStyle = {}, extra = 12) => { const t = this.t(PX + 30, y, txt, { fontSize: '15px', ...o }); y += t.height + extra; },
      get y() { return y; },
    };
  }

  private arquisoft(): void {
    const g = this.add.graphics().lineStyle(3, 0xffffff);
    const cx = PX + 80, cy = PY + 66, R = 38;
    for (let i = 0; i < 6; i++) {
      if (i === 4) continue;   // hexágono abierto, como el logo
      const a = -Math.PI / 2 + (i * Math.PI) / 3, b = a + Math.PI / 3;
      g.lineBetween(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx + Math.cos(b) * R, cy + Math.sin(b) * R);
    }
    this.contenido.add(g);
    this.t(PX + 140, PY + 40, 'ARQUISOFT', { fontSize: '34px', fontStyle: '600' });
    this.t(PX + 142, PY + 84, ARQUISOFT.lema, { fontSize: '14px', fontStyle: 'italic 700', color: '#9fdcff' });
    this.t(PX + PW - 20, PY + 12, ARQUISOFT.sede, { fontSize: '12px', color: '#8b96ab' }).setOrigin(1, 0);
    const p = this.pila(PY + 122);
    p.sub('QUIÉNES SOMOS'); p.par(ARQUISOFT.quienes);
    p.sub('NUESTRA MISIÓN'); p.par(ARQUISOFT.mision);
    p.sub('EQUIPO');
    ARQUISOFT.integrantes.forEach((m, i) => {
      const x = PX + 30 + (i % 2) * 290, y = p.y + Math.floor(i / 2) * 38;
      this.t(x, y, `● ${m.nombre}`, { fontSize: '15px', fontStyle: '800', color: CSS.amarillo });
      this.t(x + 14, y + 18, m.rol, { fontSize: '12px', color: '#c8d0e0' });
    });
  }

  private reto(): void {
    this.t(PX + 30, PY + 18, RETO.evento.toUpperCase(), { fontFamily: FUENTE_PIXEL, fontSize: '12px', color: CSS.cian });
    const p = this.pila(PY + 40);
    p.par(RETO.nombre, { fontSize: '30px', fontStyle: '800', color: CSS.amarillo }, 2);
    p.par(tr(RETO.fechas) + '\n' + tr(RETO.categoria), { fontSize: '13px', color: '#9fdcff', lineSpacing: 3 });
    p.sub('QUÉ PIDE EL RETO'); p.par(RETO.pide);
    p.sub('CÓMO LO RESPONDE MISIÓN CÓNDOR'); p.par(RETO.respuesta.map(r => '• ' + tr(r)).join('\n'), { fontSize: '14px', lineSpacing: 4 });
    p.par(RETO.datos, { fontSize: '13px', fontStyle: 'italic 700', color: '#c8d0e0' });
  }
}
