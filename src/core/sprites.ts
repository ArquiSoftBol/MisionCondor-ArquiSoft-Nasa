// Hojas de sprites 2.5D: columnas = 8 direcciones (col × 45°, 0 = de frente), filas = 8 cuadros de animación.
// atlas.json (herramientas/atlas.mjs) dice el tamaño de celda, ancla, fps, y si hay capa de brillo o de cielo.
import Phaser from 'phaser';

export interface InfoHoja {
  cat: string; N: number; fps: number; bucle: boolean; ancla: [number, number];
  img: string; brillo: string | null; cielo: string | null;
  /** huella en el suelo (semiejes x, z en unidades del molde) y escala del molde; null = sin cuerpo definido */
  pie?: [number, number] | null; esc?: number;
}
export interface Atlas { sprites: Record<string, InfoHoja> }

let atlas: Atlas = { sprites: {} };
export const fijarAtlas = (a: Atlas): void => { atlas = a; };
export const info = (id: string): InfoHoja => {
  const i = atlas.sprites[id];
  if (!i) throw new Error(`Sprite desconocido: ${id}`);
  return i;
};
export const existe = (id: string): boolean => id in atlas.sprites;

/** Claves de textura de una hoja: sprite, brillo y cielo. */
const clavesDe = (id: string): string[] => [id, id + '#b', id + '#c'];

/** Texturas que usa algún objeto vivo de las escenas en marcha (recorre contenedores). */
function texturasEnUso(scene: Phaser.Scene): Set<string> {
  const usadas = new Set<string>();
  const recorrer = (lista: Phaser.GameObjects.GameObject[]) => lista.forEach(o => {
    const tx = (o as Phaser.GameObjects.Sprite).texture;
    if (tx) usadas.add(tx.key);
    if (o instanceof Phaser.GameObjects.Container) recorrer(o.list);
  });
  for (const s of scene.game.scene.getScenes(false)) if (s.sys.displayList) recorrer(s.sys.displayList.list);
  return usadas;
}

/**
 * Libera de la memoria gráfica las hojas que ni esta escena necesita ni otra escena viva está mostrando.
 * Sin esto la aventura acumulaba ~470 MB de texturas y en celulares (o dentro de un visor/iframe)
 * el navegador perdía el contexto WebGL a mitad de la historia: el juego se congelaba o quedaba en negro.
 */
/** Hojas que pidió cada escena en su preload (las de una escena en pausa no se tocan: las usará al volver). */
const pedidas = new Map<string, string[]>();

function liberar(scene: Phaser.Scene, necesarias: string[]): void {
  pedidas.set(scene.scene.key, necesarias);
  const guardar = new Set(necesarias.flatMap(clavesDe));
  for (const s of scene.game.scene.getScenes(false)) {
    if (s === scene) continue;
    const viva = s.sys.isActive() || s.sys.isPaused() || s.sys.isSleeping();
    if (viva) (pedidas.get(s.scene.key) ?? []).flatMap(clavesDe).forEach(k => guardar.add(k));
  }
  const enUso = texturasEnUso(scene);
  for (const id of Object.keys(atlas.sprites)) {
    if (atlas.sprites[id].cat === 'iconos') continue;   // los íconos de interfaz quedan siempre cargados (son chicos)
    for (const k of clavesDe(id)) {
      if (guardar.has(k) || enUso.has(k) || !scene.textures.exists(k)) continue;
      for (let d = 0; d < 8; d++) if (scene.anims.exists(`${k}@${d}`)) scene.anims.remove(`${k}@${d}`);
      scene.textures.remove(k);
    }
  }
}

/** Pone en cola las hojas que falten (sprite + brillo + cielo) y suelta las que ya no hacen falta. Llamar desde preload(). */
export function cargar(scene: Phaser.Scene, ids: string[]): void {
  liberar(scene, ids);
  for (const id of ids) {
    const i = info(id), cfg = { frameWidth: i.N, frameHeight: i.N };
    if (!scene.textures.exists(id)) scene.load.spritesheet(id, 'sprites/' + i.img, cfg);
    if (i.brillo && !scene.textures.exists(id + '#b')) scene.load.spritesheet(id + '#b', 'sprites/' + i.brillo, cfg);
    if (i.cielo && !scene.textures.exists(id + '#c')) scene.load.spritesheet(id + '#c', 'sprites/' + i.cielo, cfg);
  }
}

/** Íconos de interfaz (categoría «iconos»): se cargan una vez al arrancar y no se liberan nunca. */
export function cargarIconos(scene: Phaser.Scene): void {
  for (const [id, i] of Object.entries(atlas.sprites)) {
    if (i.cat !== 'iconos') continue;
    const cfg = { frameWidth: i.N, frameHeight: i.N };
    if (!scene.textures.exists(id)) scene.load.spritesheet(id, 'sprites/' + i.img, cfg);
    if (i.brillo && !scene.textures.exists(id + '#b')) scene.load.spritesheet(id + '#b', 'sprites/' + i.brillo, cfg);
  }
}

function anim(scene: Phaser.Scene, key: string, base: string, dir: number, fps: number, bucle: boolean): string {
  const k = `${key}@${dir}`;
  if (!scene.anims.exists(k)) {
    scene.anims.create({
      key: k, frameRate: fps, repeat: bucle ? -1 : 0,
      frames: Array.from({ length: 8 }, (_, f) => ({ key: base, frame: dir + f * 8 })),
    });
  }
  return k;
}

export interface OpcActor { escala?: number; dir?: number; animado?: boolean; brillo?: number; fps?: number }

/** Sprite con su capa de brillo aditiva encima. El origen es el punto del suelo (ancla). */
export class Actor extends Phaser.GameObjects.Container {
  readonly id: string;
  readonly base: Phaser.GameObjects.Sprite;
  readonly luz?: Phaser.GameObjects.Sprite;
  private dirActual = 0;
  private animado: boolean;
  private fps: number;

  constructor(scene: Phaser.Scene, x: number, y: number, id: string, o: OpcActor = {}) {
    super(scene, x, y);
    this.id = id;
    const i = info(id), ox = 0.5, oy = i.ancla[1] / i.N;
    this.animado = o.animado ?? true;
    this.fps = o.fps ?? i.fps;
    this.base = scene.add.sprite(0, 0, id, 0).setOrigin(ox, oy);
    this.add(this.base);
    if (i.brillo && scene.textures.exists(id + '#b')) {
      this.luz = scene.add.sprite(0, 0, id + '#b', 0).setOrigin(ox, oy).setBlendMode(Phaser.BlendModes.ADD).setAlpha(o.brillo ?? 0.9);
      this.add(this.luz);
    }
    this.setScale(o.escala ?? 3);
    this.mirar(o.dir ?? 1);
    scene.add.existing(this);
  }

  /** Cambia la dirección (0..7, ×45°). */
  mirar(dir: number): this {
    this.dirActual = ((dir % 8) + 8) % 8;
    const i = info(this.id);
    if (this.animado) {
      const cuadro = this.base.anims.currentFrame?.index ?? 0;
      this.base.play({ key: anim(this.scene, this.id, this.id, this.dirActual, this.fps, i.bucle), startFrame: cuadro % 8 });
      if (this.luz) this.luz.play({ key: anim(this.scene, this.id + '#b', this.id + '#b', this.dirActual, this.fps, i.bucle), startFrame: cuadro % 8 });
    } else {
      this.base.setFrame(this.dirActual);
      this.luz?.setFrame(this.dirActual);
    }
    return this;
  }

  get dir(): number { return this.dirActual; }

  /** Dirección según el vector de movimiento en pantalla. */
  mirarHacia(dx: number, dy: number): this {
    if (Math.abs(dx) + Math.abs(dy) < 0.01) return this;
    // ángulo de pantalla → columna de la hoja (0 = de frente, hacia abajo; sentido horario visto desde arriba)
    const a = Math.atan2(dx, dy);                       // 0 = abajo
    const d = Math.round(-a / (Math.PI / 4));
    if (((d % 8) + 8) % 8 !== this.dirActual) this.mirar(d);
    return this;
  }

  pausar(): this { this.base.anims.pause(); this.luz?.anims.pause(); return this; }
  seguir(): this { this.base.anims.resume(); this.luz?.anims.resume(); return this; }
}

/** Diorama de un mundo con su cielo animado detrás. */
export function mundo(scene: Phaser.Scene, x: number, y: number, id: string, escala: number, dir = 1): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const i = info(id);
  if (i.cielo && scene.textures.exists(id + '#c')) {
    const s = scene.add.sprite(0, 0, id + '#c', dir).setScale(escala);
    s.play(anim(scene, id + '#c', id + '#c', dir, i.fps, true));
    c.add(s);
  }
  const a = new Actor(scene, 0, (i.ancla[1] - i.N / 2) * escala, id, { escala, dir });
  c.add(a);
  return c;
}

/** Cuerpo sólido: elipse en el suelo. Un actor puede tener varias (los muros largos se cubren con una fila). */
export interface Cuerpo { x: number; y: number; rx: number; ry: number }

/**
 * Cuerpos de un actor según la huella de su molde (`foot` → `pie` en atlas.json) y la dirección en que está dibujado.
 * Huella compacta → una elipse; huella alargada (crestas, grietas) → una fila de elipses a lo largo de su eje.
 */
export function cuerposDe(a: Actor, margen = 0): Cuerpo[] {
  const i = info(a.id), e = Math.abs(a.scaleX) * (i.esc ?? 1);
  const pie = i.pie ?? [i.N * 0.11 / (i.esc ?? 1), i.N * 0.09 / (i.esc ?? 1)];
  const [px, pz] = pie, ang = a.dir * Math.PI / 4;
  const menor = Math.min(px, pz), mayor = Math.max(px, pz);
  if (mayor / menor < 1.8) {
    const r = (px + pz) * 0.6 * e;
    return [{ x: a.x, y: a.y, rx: r + margen, ry: r * 0.5 + margen * 0.5 }];
  }
  // eje mayor en el mundo (x o z) proyectado a pantalla como hace el motor: (x·cos − z·sin, (x·sin + z·cos)·½)
  const ex = px >= pz ? [Math.cos(ang), Math.sin(ang) * 0.5] : [-Math.sin(ang), Math.cos(ang) * 0.5];
  const n = Math.max(2, Math.ceil(mayor / menor)), r = menor * 1.15 * e, out: Cuerpo[] = [];
  for (let k = 0; k < n; k++) {
    const t = (-1 + (2 * k) / (n - 1)) * (mayor - menor) * e;
    out.push({ x: a.x + ex[0] * t, y: a.y + ex[1] * t, rx: r + margen, ry: r * 0.5 + margen * 0.5 });
  }
  return out;
}

/** Si el punto (x, y) con radio `r` pisa el cuerpo, devuelve el punto empujado hacia afuera; si no, null. */
export function empujar(c: Cuerpo, x: number, y: number, r = 0): { x: number; y: number } | null {
  const rx = c.rx + r, ry = c.ry + r * 0.5;
  const dx = (x - c.x) / rx, dy = (y - c.y) / ry, d = Math.hypot(dx, dy);
  if (d >= 1) return null;
  if (d < 0.001) return { x: c.x, y: c.y + ry };
  return { x: c.x + (dx / d) * rx, y: c.y + (dy / d) * ry };
}
