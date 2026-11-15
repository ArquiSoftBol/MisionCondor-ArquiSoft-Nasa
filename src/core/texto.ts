// Personaliza los textos de la historia con lo que eligió el jugador.
//   {NOMBRE}  → nombre del jugador        {MASCOTA} → nombre de la mascota
//   ingenier@ → ingeniero / ingeniera / ingenierx
//   {o}       → o / a / e  (concordancia: «solitari{o}», «agotad{o}»)
//   {el}      → él / ella / elle
//   Solo inglés: {EL} he/she/they · {SU} his/her/their · {LO} him/her/them (y mayúscula al inicio de frase)
import { perfil } from './estado';

export function personalizar(t: string): string {
  const o = perfil.orientacion;
  const p = (m: string, f: string, x: string) => (o === 'f' ? f : o === 'x' ? x : m);
  let s = t
    .replaceAll('{NOMBRE}', perfil.nombre || 'Cóndor')
    .replaceAll('{MASCOTA}', perfil.mascota || 'Wayra')
    .replaceAll('ingenier@', p('ingeniero', 'ingeniera', 'ingenierx'))
    .replaceAll('Ingenier@', p('Ingeniero', 'Ingeniera', 'Ingenierx'))
    .replaceAll('{o}', p('o', 'a', 'e'))
    .replaceAll('{el}', p('él', 'ella', 'elle'))
    .replaceAll('{EL}', p('he', 'she', 'they'))
    .replaceAll('{SU}', p('his', 'her', 'their'))
    .replaceAll('{LO}', p('him', 'her', 'them'));
  // «they kneels» → «they kneel» (concordancia básica para el neutro)
  if (o === 'x') s = s.replace(/\bthey has\b/g, 'they have').replace(/\bthey (\w+?)s\b/g, (m, v) => (['wa', 'ha', 'doe', 'i'].includes(v) ? m : `they ${v}`));
  // mayúscula al empezar oración
  return s.replace(/(^|[.!?…»”]\s+|^“)(he|she|they|his|her|their)\b/g, (_m, a, w) => a + w[0].toUpperCase() + w.slice(1));
}
