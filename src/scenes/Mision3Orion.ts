// MISIÓN 3 · Armar la nave Orión: módulo de servicio, módulo de tripulación (con escudo térmico) y torre de escape.
import Phaser from 'phaser';
import { Ensamblaje, type ConfigMontaje } from './Ensamblaje';
import { hangar, vineta } from '../ui/ambiente';
import { DECORADOS } from '../ui/decorado';

const U = 6.5;

export class Mision3Orion extends Ensamblaje {
  protected cfg: ConfigMontaje = {
    clave: 'orion', numero: 3, titulo: 'La nave Orión', listo: '¡La nave Orión está lista!', logro: 'm3',
    intro: 'Acá el usuario debe armar la nave Orión: abajo el módulo de servicio con sus alas solares, encima el módulo de tripulación y, para el despegue, la torre de escape.',
    base: { x: 330, y: 400 }, unidad: U, viento: 16, prueba: 'vacio',
    lugares: [[600, 480], [730, 505], [860, 480]],
    piezas: [
      { id: 'orion_servicio', nombre: 'Módulo de servicio', ux: 0, uy: -2, moldeEscala: 2, dato: 'motor principal, agua, oxígeno y 4 alas solares para la energía.', antes: 'La base de Orión es el módulo de servicio: da energía, aire y empuje.' },
      { id: 'orion_capsula', nombre: 'Módulo de tripulación', ux: 0, uy: 5.6, moldeEscala: 3, dato: 'aquí viaja la tripulación; su escudo térmico aguanta ~2 800 °C al volver.', antes: 'La cápsula se apoya sobre el módulo de servicio: colócalo primero.',
        pregunta: { texto: '¿Hacia dónde debe mirar el escudo térmico de la cápsula?', opciones: ['Hacia abajo', 'Hacia arriba'], explica: 'El escudo térmico va abajo: al volver a la Tierra entra primero en la atmósfera y aguanta ~2 800 °C.' } },
      { id: 'orion_escape', nombre: 'Torre de escape', ux: 0, uy: 6, moldeEscala: 2.6, dato: 'si algo falla al despegar, aleja la cápsula del cohete en milisegundos.', antes: 'La torre de escape cubre la cápsula: primero tiene que estar la cápsula.' },
    ],
    fondo: (s: Phaser.Scene) => {
      hangar(s, 330);
      vineta(s, 0.4, 3);
      s.add.ellipse(330, 402, 200, 46, 0x3ff3ff, 0.12).setStrokeStyle(2, 0x3ff3ff, 0.6);
    },
    extras: DECORADOS,
    resultado: [
      'Módulo de servicio + módulo de tripulación + torre de escape.',
      'Orión puede llevar 4 personas más lejos que ninguna nave tripulada.',
      'Ya está lista para subir a lo alto del cohete.',
    ],
  };
  constructor() { super('Mision3Orion'); }
}
