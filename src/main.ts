// Punto de entrada: crea el juego Phaser y registra todas las escenas.
import Phaser from 'phaser';
import '@fontsource/press-start-2p/400.css';
import '@fontsource/open-sans/600.css';
import '@fontsource/open-sans/700.css';
import '@fontsource/open-sans/800.css';
import '@fontsource/open-sans/700-italic.css';
import '@fontsource/open-sans/800-italic.css';
import '@fontsource/open-sans/600-italic.css';
import { W, H } from './config';
import { Arranque } from './scenes/Arranque';
import { Recomendaciones } from './scenes/Recomendaciones';
import { Logo } from './scenes/Logo';
import { Titulo } from './scenes/Titulo';
import { Registro } from './scenes/Registro';
import { Cinematica } from './scenes/Cinematica';
import { Mision1Sistemas } from './scenes/Mision1Sistemas';
import { Mision2Cohete } from './scenes/Mision2Cohete';
import { Mision3Orion } from './scenes/Mision3Orion';
import { Mision4Despegue } from './scenes/Mision4Despegue';
import { Mision5Rover } from './scenes/Mision5Rover';
import { Fin } from './scenes/Fin';
import { Archivo } from './scenes/Archivo';
import { Pausa } from './scenes/Pausa';
import { IntroRadio } from './scenes/IntroRadio';
import { Ecuacion } from './scenes/Ecuacion';
import { MultiLobby } from './scenes/MultiLobby';
import { Coop } from './scenes/Coop';
import { Capitulo } from './scenes/Capitulo';
import { MisionMarte } from './scenes/MisionMarte';
import { instalarTraduccion, cambiarIdioma } from './core/idioma';
import { Musica } from './core/musica';
import { esTactil } from './ui/palanca';

// Idioma: ?idioma=en / ?idioma=es fuerza uno (útil para probar); si no, el guardado en el perfil.
const pedido = new URLSearchParams(location.search).get('idioma');
if (pedido === 'en' || pedido === 'es') cambiarIdioma(pedido);
instalarTraduccion();

const juego = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'juego',
  width: W,
  height: H,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  dom: { createContainer: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, fullscreenTarget: 'juego' },
  input: { activePointers: 2 },
  // ?prueba: bucle con setTimeout (sirve para probar con la pestaña en segundo plano)
  fps: { target: 60, forceSetTimeOut: new URLSearchParams(location.search).has('prueba') },
  scene: [Arranque, Recomendaciones, Logo, IntroRadio, Titulo, Registro, Cinematica, Mision1Sistemas, Mision2Cohete, Mision3Orion, Mision4Despegue, MisionMarte, Mision5Rover, Fin, Archivo, Pausa, Ecuacion, MultiLobby, Coop, Capitulo],
});

// Música coherente: al entrar a cada escena suena la que le toca (core/musica.ts → MOMENTOS.escenas)
juego.events.once(Phaser.Core.Events.READY, () => {
  juego.scene.scenes.forEach(s => s.events.on(Phaser.Scenes.Events.CREATE, () => Musica.paraEscena(s.scene.key)));
});

// Pantalla completa con la tecla F (y con el botón de la portada)
window.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'f' && !(e.target instanceof HTMLInputElement)) juego.scale.toggleFullscreen();
});

// Celulares y tabletas: al primer toque, pantalla completa y horizontal fijo (Android y la mayoría de navegadores).
// iPhone no deja usar pantalla completa en una web: ahí se instala con «Compartir → Agregar a inicio» (manifest).
if (esTactil()) {
  const instalada = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  const alTocar = (e: PointerEvent) => {
    if (e.target instanceof HTMLInputElement) return;   // no interrumpir mientras se escribe un nombre o código
    window.removeEventListener('pointerup', alTocar);
    if (instalada || !juego.scale.fullscreen.available || juego.scale.isFullscreen) return;
    try {
      juego.scale.startFullscreen();
      (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => undefined);
    } catch { /* el navegador no lo permite: se sigue jugando igual */ }
  };
  window.addEventListener('pointerup', alTocar);
}

// Red de seguridad: si el navegador pierde el contexto gráfico (poca memoria en celulares o dentro de un visor),
// en vez de quedar congelado se recarga y retoma desde el progreso guardado.
juego.canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  setTimeout(() => location.reload(), 800);
});

// Para depurar desde la consola del navegador
(window as unknown as { juego: Phaser.Game; musica: typeof Musica }).juego = juego;
(window as unknown as { musica: typeof Musica }).musica = Musica;
