// Narración por voz (opcional) con la síntesis de voz del navegador, en el idioma del juego.
// Se activa en Ajustes. Si el navegador no tiene voces, no hace nada (el juego sigue con texto).
import { perfil } from './estado';
import { idioma } from './idioma';

const sintesis = (): SpeechSynthesis | null => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);

export const Voz = {
  disponible: (): boolean => !!sintesis(),
  activa: (): boolean => !!perfil.voz && !!sintesis(),

  /** Lee el texto (corta lo que estuviera leyendo). */
  decir(texto: string): void {
    const s = sintesis();
    if (!s || !perfil.voz) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    const lang = idioma() === 'en' ? 'en' : 'es';
    u.lang = lang === 'en' ? 'en-US' : 'es-ES';
    const voz = s.getVoices().find(v => v.lang.toLowerCase().startsWith(lang));
    if (voz) u.voice = voz;
    u.rate = 1.02; u.pitch = 1; u.volume = Math.min(1, perfil.volumen + 0.15);
    s.speak(u);
  },

  callar(): void { sintesis()?.cancel(); },

  /** ¿Sigue hablando? (la cinemática espera a que termine antes de pasar de cuadro) */
  hablando: (): boolean => !!perfil.voz && !!sintesis()?.speaking,
};
