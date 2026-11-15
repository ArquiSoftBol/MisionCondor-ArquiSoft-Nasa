// MISIÓN 2 · Armar el cohete (tipo SLS): propulsores laterales, etapa central y etapa superior.
import Phaser from 'phaser';
import { Ensamblaje, type ConfigMontaje } from './Ensamblaje';
import { Actor } from '../core/sprites';
import { degradado } from '../ui/fondo';
import { DECORADOS, piso, cordillera, nubes } from '../ui/decorado';
import { W, H } from '../config';

const U = 5.5;   // px por unidad

export class Mision2Cohete extends Ensamblaje {
  protected cfg: ConfigMontaje = {
    clave: 'cohete', numero: 2, titulo: 'El cohete', listo: '¡El cohete está listo!', logro: 'm2',
    intro: 'Acá el jugador debe armar el cohete. La etapa central va en la plataforma, los propulsores sólidos se fijan a sus costados y arriba va la etapa superior que llevará la nave.',
    base: { x: 300, y: 500 }, unidad: U, viento: 28, prueba: 'tubos',
    lugares: [[545, 486], [665, 512], [785, 486], [895, 512]],
    piezas: [
      { id: 'cohete_nucleo', nombre: 'Etapa central', ux: 0, uy: 0, moldeEscala: 1.45, dato: 'tanques de hidrógeno y oxígeno líquidos; 4 motores que empujan ~8 minutos.', antes: 'Primero va la columna vertebral: la etapa central se coloca sobre la plataforma.' },
      { id: 'cohete_propulsor', nombre: 'Propulsor izquierdo', ux: -6.6, uy: 1, moldeEscala: 1.65, dato: 'combustible sólido: da más del 75 % del empuje en los 2 primeros minutos.', antes: 'Los propulsores se sujetan a la etapa central: colócala primero.' },
      { id: 'cohete_propulsor', nombre: 'Propulsor derecho', ux: 6.6, uy: 1, moldeEscala: 1.65, dato: 'dos propulsores iguales mantienen el cohete equilibrado.', antes: 'Los propulsores se sujetan a la etapa central: colócala primero.' },
      { id: 'cohete_etapa_superior', nombre: 'Etapa superior', ux: 0, uy: 47, moldeEscala: 2.4, dato: 'enciende ya en el espacio y empuja a la nave fuera de la órbita terrestre.', antes: 'La etapa superior va arriba de todo: antes hay que tener la base y los propulsores.' },
    ],
    fondo: (s: Phaser.Scene) => {
      degradado(s, 0x3d7fd0, 0xbfdcf5);
      nubes(s, undefined, 4, 60, 160, 1.5);
      const reflejos = cordillera(s, 420, undefined, { escala: 1.1, reflejo: 0.2, semilla: 21 });
      piso(s, 'suelo_sal', -20, 420, W + 40, H - 400, undefined, 1);
      reflejos.forEach(r => s.add.existing(r));
      s.add.rectangle(300, 498, 190, 24, 0x5d6670).setStrokeStyle(2, 0x2b2f38);
      new Actor(s, 150, 520, 'torre_lanzamiento', { escala: 3.2, dir: 1 }).setDepth(1);
      s.add.rectangle(300, 504, 140, 14, 0x3a3f48).setDepth(2);
    },
    extras: ['torre_lanzamiento', ...DECORADOS],
    resultado: [
      'Etapa central + 2 propulsores sólidos + etapa superior.',
      'Al despegar, el cohete pesa ~2 600 toneladas:',
      'casi todo es combustible. Por eso cada kilo de la nave cuenta.',
    ],
  };
  constructor() { super('Mision2Cohete'); }
}
