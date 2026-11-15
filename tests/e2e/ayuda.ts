// Ayudas para jugar Misión Cóndor desde Playwright. Las coordenadas son las del juego (960×540) y se convierten
// a la pantalla real. Los clics/toques son REALES (mouse o touchscreen), así se prueba la detección de Phaser.
import { expect, type Page, type TestInfo } from '@playwright/test';

export const W = 960, H = 540;

/** Errores de la página (excepciones JS). Se revisan al final de cada test. */
// Archivos opcionales que pueden faltar sin ser error (el juego tiene un reemplazo):
//   marca/space-apps.png → logo oficial de Space Apps (si no está, se muestra una insignia de texto)
const OPCIONALES = /marca\/space-apps\.png/;
export function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on('pageerror', e => errores.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/WebSocket|favicon|net::ERR|Failed to load resource/.test(m.text())) errores.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !OPCIONALES.test(r.url())) errores.push(`${r.status()} ${r.url()}`); });
  return errores;
}

/** Texto sin tildes (la fuente pixelada del juego escribe los títulos sin tilde). */
export const plano = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** ¿Hay un texto visible que contenga `frase` (comparando sin tildes ni mayúsculas)? */
export const hayTexto = async (page: Page, escena: string, frase: string) =>
  (await textos(page, escena)).some(t => plano(t).toLowerCase().includes(plano(frase).toLowerCase()));

export const esCelular = (info: TestInfo) => info.project.name !== 'pc';

/** Abre el juego directo en una escena (?escena=…). `prueba` usa el bucle con temporizador (estable en CI). */
export async function abrir(page: Page, escena: string, extra = '') {
  await page.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.goto(`/?escena=${escena}&prueba${extra}`);
  await esperarEscena(page, escena);
}

export async function esperarEscena(page: Page, escena: string, ms = 60_000) {
  await page.waitForFunction(k => {
    const j = (window as any).juego;
    return !!j && j.scene.getScenes(true).some((s: any) => s.scene.key === k);
  }, escena, { timeout: ms });
}

export const escenasActivas = (page: Page) => page.evaluate(() => (window as any).juego.scene.getScenes(true).map((s: any) => s.scene.key));

/** Lee una propiedad de una escena (p. ej. 'fase', 'acel'). */
export const leer = <T = unknown>(page: Page, escena: string, expr: string): Promise<T> =>
  page.evaluate(([k, e]) => { const s: any = (window as any).juego.scene.getScene(k); return new Function('s', `return (${e})`)(s); }, [escena, expr]);

/** Centro (en coordenadas del juego) de un texto visible de la escena, o null. */
export async function posTexto(page: Page, escena: string, texto: string | RegExp): Promise<[number, number] | null> {
  const src = typeof texto === 'string' ? { s: texto } : { r: texto.source, f: texto.flags };
  return page.evaluate(([k, q]) => {
    const s: any = (window as any).juego.scene.getScene(k);
    const re = (q as any).r ? new RegExp((q as any).r, (q as any).f) : null;
    let hit: any = null;
    const rec = (o: any) => {
      if (o.type === 'Text' && o.visible && o.alpha > 0.05 && o.text && (re ? re.test(o.text) : o.text.trim() === (q as any).s)) hit = o;
      (o.list || []).forEach(rec);
    };
    s.children.list.forEach(rec);
    if (!hit) return null;
    const b = hit.getBounds();
    // los textos fijos a la pantalla ya están en coordenadas de pantalla; los del mundo se corrigen con la cámara
    const cam = s.cameras.main, fijo = hit.scrollFactorX === 0 || (hit.parentContainer && hit.parentContainer.scrollFactorX === 0);
    return [Math.round(b.centerX - (fijo ? 0 : cam.scrollX)), Math.round(b.centerY - (fijo ? 0 : cam.scrollY))] as [number, number];
  }, [escena, src] as const);
}

/** Textos visibles de una escena (para afirmar mensajes). */
export const textos = (page: Page, escena: string): Promise<string[]> => page.evaluate(k => {
  const s: any = (window as any).juego.scene.getScene(k); const out: string[] = [];
  const rec = (o: any) => { if (o.type === 'Text' && o.visible && o.text) out.push(o.text.replace(/\n/g, ' ')); (o.list || []).forEach(rec); };
  s.children.list.forEach(rec); return out;
}, escena);

async function aPantalla(page: Page, x: number, y: number): Promise<[number, number]> {
  const caja = await page.locator('canvas').boundingBox();
  if (!caja) throw new Error('No hay canvas');
  return [caja.x + (x / W) * caja.width, caja.y + (y / H) * caja.height];
}

/** Clic (PC) o toque (celular/tablet) real en coordenadas del juego. */
export async function tocar(page: Page, info: TestInfo, x: number, y: number) {
  const [px, py] = await aPantalla(page, x, y);
  if (esCelular(info)) await page.touchscreen.tap(px, py);
  else await page.mouse.click(px, py);
  await page.waitForTimeout(250);
}

/** Toca el botón/etiqueta con ese texto. Falla si no está visible. */
export async function tocarTexto(page: Page, info: TestInfo, escena: string, texto: string | RegExp) {
  await expect.poll(() => posTexto(page, escena, texto), { message: `no aparece «${texto}» en ${escena}` }).not.toBeNull();
  await page.waitForTimeout(500);   // los botones entran con una animación corta
  const p = (await posTexto(page, escena, texto))!;
  await tocar(page, info, p[0], p[1]);
}

/** Toca un botón hasta que se cumpla `listo` (por si el primer toque llegó durante su animación de entrada). */
export async function tocarHasta(page: Page, info: TestInfo, escena: string, texto: string | RegExp, listo: () => Promise<boolean>, intentos = 5) {
  for (let i = 0; i < intentos; i++) {
    const p = await posTexto(page, escena, texto);
    if (p) await tocar(page, info, p[0], p[1]);
    for (let k = 0; k < 10; k++) { if (await listo()) return; await page.waitForTimeout(300); }
  }
  expect(await listo(), `tocar «${texto}» en ${escena} no tuvo efecto`).toBe(true);
}

/** Arrastre real (dedo o mouse) — sirve para la palanca táctil. */
export async function arrastrar(page: Page, info: TestInfo, x0: number, y0: number, x1: number, y1: number, mantenerMs = 1200) {
  const [a, b] = await aPantalla(page, x0, y0), [c, d] = await aPantalla(page, x1, y1);
  if (esCelular(info)) {
    // Playwright no tiene «touchmove» de alto nivel: se usa CDP (eventos táctiles reales del navegador)
    const cdp = await page.context().newCDPSession(page);
    const punto = (x: number, y: number) => [{ x, y, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punto(a, b) });
    for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: punto(a + (c - a) * i / 10, b + (d - b) * i / 10) });
    await page.waitForTimeout(mantenerMs);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(a, b); await page.mouse.down();
    await page.mouse.move(c, d, { steps: 10 });
    await page.waitForTimeout(mantenerMs);
    await page.mouse.up();
  }
}

/** Tarjeta de inicio de una misión del modo historia: «Cómo se juega» → «¡A jugar!». */
export async function pasarTarjeta(page: Page, info: TestInfo, escena: string) {
  await expect.poll(() => posTexto(page, escena, 'Cómo se juega'), { timeout: 20_000 }).not.toBeNull();
  // la página 2 («cómo se juega») es la que tiene el botón «Atrás»
  await tocarHasta(page, info, escena, 'Cómo se juega', async () => (await posTexto(page, escena, 'Atrás')) !== null);
  await expect.poll(() => posTexto(page, escena, '¡A jugar!'), { timeout: 20_000 }).not.toBeNull();
  await tocarHasta(page, info, escena, '¡A jugar!', async () => (await posTexto(page, escena, '¡A jugar!')) === null);
  // la tarjeta se desvanece y la misión arranca: hasta que no se va, tapa los toques
  await page.waitForFunction(k => {
    const s: any = (window as any).juego.scene.getScene(k);
    return !s.children.list.some((o: any) => o.type === 'Container' && o.depth >= 10000 && o.active && o.alpha > 0.01);
  }, escena, { timeout: 15_000 });
  await page.waitForTimeout(600);
}

/** El lienzo cabe entero en la ventana (sin cortes ni scroll). */
export async function lienzoCabe(page: Page) {
  const caja = await page.locator('canvas').boundingBox();
  const vp = page.viewportSize()!;
  expect(caja).not.toBeNull();
  expect(caja!.x).toBeGreaterThanOrEqual(-1);
  expect(caja!.y).toBeGreaterThanOrEqual(-1);
  expect(caja!.x + caja!.width).toBeLessThanOrEqual(vp.width + 1);
  expect(caja!.y + caja!.height).toBeLessThanOrEqual(vp.height + 1);
  const scroll = await page.evaluate(() => [document.documentElement.scrollWidth > innerWidth, document.documentElement.scrollHeight > innerHeight]);
  expect(scroll).toEqual([false, false]);
}
