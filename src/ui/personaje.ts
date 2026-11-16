// Personaje con varias poses (cada pose es una hoja de sprites distinta): quieto, camina y trabaja.
// Así el Ingeniero camina de verdad, respira cuando está parado y teclea en la mesa (y el compañero lo ve).
import Phaser from 'phaser';
import { Actor, existe } from '../core/sprites';

export type Pose = 'quieto' | 'camina' | 'trabaja';

/** Hojas de cada pose. Si una pose no tiene hoja propia, se usa la de caminar (pausada si es «quieto»). */
export const POSES: Record<string, Partial<Record<Pose, string>>> = {
  ingeniero_sistemas: { quieto: 'ingeniero_sistemas', camina: 'ingeniero_camina', trabaja: 'ingeniero_trabaja' },
};

export const hojasDe = (sprite: string): string[] => [...new Set([sprite, ...Object.values(POSES[sprite] ?? {})])].filter(existe);

export class Personaje extends Phaser.GameObjects.Container {
  private actores = new Map<string, Actor>();
  private poses: Partial<Record<Pose, string>>;
  private actual!: Actor;
  pose: Pose = 'quieto';
  private dirActual: number;

  constructor(scene: Phaser.Scene, x: number, y: number, sprite: string, o: { escala?: number; dir?: number } = {}) {
    super(scene, x, y);
    this.poses = POSES[sprite] ?? { camina: sprite };
    this.dirActual = o.dir ?? 1;
    for (const id of new Set(Object.values(this.poses))) {
      if (!id || !existe(id) || !scene.textures.exists(id)) continue;
      const a = new Actor(scene, 0, 0, id, { escala: o.escala ?? 2.3, dir: this.dirActual });
      a.setVisible(false);
      this.add(a);
      this.actores.set(id, a);
    }
    scene.add.existing(this);
    this.ponerPose('quieto', true);
  }

  /** La hoja que corresponde a una pose (o la más parecida que exista). */
  private hoja(p: Pose): string {
    const ids = [this.poses[p], p === 'trabaja' ? this.poses.quieto : undefined, this.poses.camina, this.poses.quieto].filter(Boolean) as string[];
    return ids.find(id => this.actores.has(id)) ?? [...this.actores.keys()][0];
  }

  ponerPose(p: Pose, forzar = false): this {
    if (p === this.pose && !forzar) return this;
    this.pose = p;
    const a = this.actores.get(this.hoja(p))!;
    if (a !== this.actual) { this.actual?.setVisible(false); this.actual = a.setVisible(true); a.mirar(this.dirActual); }
    // una hoja de caminar usada para «quieto» se congela en el primer cuadro (de pie); las demás siempre se animan
    const congelar = p === 'quieto' && this.hoja('quieto') === this.poses.camina && this.poses.quieto !== this.poses.camina;
    if (congelar || (p === 'quieto' && !this.poses.quieto)) a.pausar(); else a.seguir();
    return this;
  }

  mirar(dir: number): this { this.dirActual = ((dir % 8) + 8) % 8; this.actual.mirar(this.dirActual); if (this.pose === 'quieto' && !this.poses.quieto) this.actual.pausar(); return this; }

  mirarHacia(dx: number, dy: number): this {
    if (Math.abs(dx) + Math.abs(dy) < 0.01) return this;
    const d = ((Math.round(-Math.atan2(dx, dy) / (Math.PI / 4)) % 8) + 8) % 8;
    if (d !== this.dirActual) this.mirar(d);
    return this;
  }

  get dir(): number { return this.dirActual; }
  get sprite(): string { return this.actual.id; }
  get base(): Phaser.GameObjects.Sprite { return this.actual.base; }
}
