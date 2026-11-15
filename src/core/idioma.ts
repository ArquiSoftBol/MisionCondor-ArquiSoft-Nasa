// Idioma del juego (español / inglés). Todo texto visible pasa por t('frase en español').
// En español devuelve la misma frase; en inglés la busca en data/en.ts (si falta, queda en español: nunca se rompe).
// Variables: t('Faltan {n} sistemas', { n: 3 }).
// Además, instalarTraduccion() engancha Phaser.Text.setText: cualquier texto del juego que coincida con una
// frase del diccionario (también las armadas con números o nombres, p. ej. «¡Bien! Faltan 3 sistemas») sale traducido.
import Phaser from 'phaser';
import { perfil, guardar } from './estado';
import { EN } from '../data/en';

export type Idioma = 'es' | 'en';

export const idioma = (): Idioma => (perfil.idioma === 'en' ? 'en' : 'es');
export const enIngles = (): boolean => idioma() === 'en';

// Frases con huecos {x}: se convierten en patrones para reconocer el texto ya armado.
const PATRONES = Object.keys(EN).filter(k => /\{\w+\}/.test(k)).map(k => {
  const nombres: string[] = [];
  const fuente = k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\w+)\\?\}/g, (_m, n) => { nombres.push(n); return '(.+?)'; });
  return { re: new RegExp(`^${fuente}$`, 's'), nombres, valor: EN[k] };
});
const cache = new Map<string, string>();

// Las mismas frases escritas EN MAYÚSCULAS (títulos con toUpperCase()).
const MAYUS = new Map(Object.entries(EN).map(([k, v]) => [k.toLocaleUpperCase('es'), v.toLocaleUpperCase('en')]));

function traducir(es: string): string {
  if (es in EN) return EN[es];
  const mayus = MAYUS.get(es);
  if (mayus !== undefined && es === es.toLocaleUpperCase('es')) return mayus;
  const c = cache.get(es);
  if (c !== undefined) return c;
  let r = es;
  if (es.length > 2 && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(es)) {
    for (const p of PATRONES) {
      const m = p.re.exec(es);
      if (!m) continue;
      r = p.valor;
      p.nombres.forEach((n, i) => { r = r.split(`{${n}}`).join(traducir(m[i + 1])); });
      break;
    }
  }
  if (cache.size > 2000) cache.clear();
  cache.set(es, r);
  return r;
}

export function t(es: string, v?: Record<string, string | number>): string {
  let s = enIngles() ? traducir(es) : es;
  if (v) for (const [k, val] of Object.entries(v)) s = s.split(`{${k}}`).join(String(val));
  return s;
}

/** Número con separador de miles y decimales del idioma actual. */
export const numero = (n: number, dec = 0): string =>
  n.toLocaleString(enIngles() ? 'en-US' : 'es-BO', { minimumFractionDigits: dec, maximumFractionDigits: dec });

/** Cambia el idioma, lo guarda y avisa a quien escuche (las escenas se redibujan). */
export function cambiarIdioma(i: Idioma): void {
  if (idioma() === i) return;
  perfil.idioma = i;
  guardar();
  document.documentElement.lang = i;
  traducirPagina();
}

/** Textos fijos del HTML (aviso de girar el celular). */
function traducirPagina(): void {
  document.querySelectorAll<HTMLElement>('[data-es]').forEach(el => {
    el.textContent = enIngles() ? (el.dataset.en ?? el.dataset.es ?? '') : (el.dataset.es ?? '');
  });
}

/** Re-escribe en el idioma actual todos los textos ya creados de una escena (p. ej. la misión detrás de la pausa). */
export function retraducir(scene: Phaser.Scene): void {
  const recorrer = (lista: Phaser.GameObjects.GameObject[]) => lista.forEach(o => {
    if (o instanceof Phaser.GameObjects.Text) {
      const es = (o as unknown as { __es?: string | string[] }).__es;
      if (es !== undefined) o.setText(es);
    } else if (o instanceof Phaser.GameObjects.Container) recorrer(o.list);
  });
  recorrer(scene.children.list);
}

/** Engancha la traducción a todos los textos de Phaser. Llamar una vez, antes de crear el juego. */
export function instalarTraduccion(): void {
  document.documentElement.lang = idioma();
  traducirPagina();
  const proto = Phaser.GameObjects.Text.prototype as unknown as { setText: (v: string | string[]) => unknown };
  const original = proto.setText;
  proto.setText = function (this: { __es?: string | string[]; style?: { fontFamily?: string } }, v: string | string[]) {
    this.__es = v;   // se guarda el original para poder re-traducir en vivo
    if (enIngles()) {
      if (typeof v === 'string') v = traducir(v);
      else if (Array.isArray(v)) v = v.map(x => (typeof x === 'string' ? traducir(x) : x));
    }
    // la fuente pixelada no trae mayúsculas con tilde (salía «MISIóN»): en ella se escriben sin tilde
    if (this.style?.fontFamily?.includes('Press Start')) {
      const sin = (x: string) => x.replace(/[ÁÉÍÓÚÑ]/g, c => ({ Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', Ñ: 'N' } as Record<string, string>)[c]);
      v = typeof v === 'string' ? sin(v) : Array.isArray(v) ? v.map(x => (typeof x === 'string' ? sin(x) : x)) : v;
    }
    return original.call(this, v);
  };
}
