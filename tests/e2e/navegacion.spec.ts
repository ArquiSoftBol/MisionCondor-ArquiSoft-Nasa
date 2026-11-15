// QA · portada, archivo, registro y cinemáticas: todo se usa con clic y con el dedo.
import { test, expect } from '@playwright/test';
import { abrir, vigilarErrores, tocarTexto, textos, esperarEscena, esCelular, posTexto, tocar, pasarTarjeta } from './ayuda';

test('portada: muestra las opciones y la pista correcta para el aparato', async ({ page }, info) => {
  const errores = vigilarErrores(page);
  await abrir(page, 'Titulo');
  for (const op of ['Jugar', 'Multijugador', 'Archivo', 'Logros', 'Ajustes']) {
    await expect.poll(() => posTexto(page, 'Titulo', op), { message: op }).not.toBeNull();
  }
  const t = await textos(page, 'Titulo');
  if (esCelular(info)) expect(t).toContain('Toca una opción para empezar');
  else expect(t.some(x => x.includes('Enter'))).toBe(true);
  expect(errores).toEqual([]);
});

test('portada → Archivo → Volver', async ({ page }, info) => {
  await abrir(page, 'Titulo');
  await page.waitForTimeout(1500);
  await tocarTexto(page, info, 'Titulo', 'Archivo');
  await esperarEscena(page, 'Archivo');
  await page.waitForTimeout(800);
  await tocarTexto(page, info, 'Archivo', 'Volver');
  await esperarEscena(page, 'Titulo');
});

test('portada → Multijugador abre el lobby', async ({ page }, info) => {
  await abrir(page, 'Titulo');
  await page.waitForTimeout(1500);
  await tocarTexto(page, info, 'Titulo', 'Multijugador');
  await esperarEscena(page, 'MultiLobby');
});

test('registro: escribir el nombre y seguir al paso de orientación', async ({ page }, info) => {
  const errores = vigilarErrores(page);
  await abrir(page, 'Registro');
  const campo = page.locator('input').first();
  await expect(campo).toBeVisible();
  await campo.tap?.call(campo).catch(() => undefined);
  await campo.click();
  await campo.fill('Tester QA');
  await tocarTexto(page, info, 'Registro', 'Siguiente');
  await expect.poll(() => page.evaluate(() => (window as any).juego.scene.getScene('Registro').paso)).toBe('orientacion');
  expect(errores).toEqual([]);
});

test('cinemática: tocar adelanta y el botón Saltar pasa al bloque siguiente', async ({ page }, info) => {
  const errores = vigilarErrores(page);
  await abrir(page, 'Cinematica');
  await page.waitForTimeout(2000);
  const antes = (await textos(page, 'Cinematica')).join('|');
  await expect.poll(() => posTexto(page, 'Cinematica', /Saltar/)).not.toBeNull();
  await tocarTexto(page, info, 'Cinematica', /Saltar/);
  await expect.poll(async () => (await textos(page, 'Cinematica')).join('|'), { timeout: 20_000 }).not.toBe(antes);
  expect(errores).toEqual([]);
});

test('cinemática: en celular la pista habla de tocar (no de teclas)', async ({ page }, info) => {
  test.skip(!esCelular(info), 'solo pantallas táctiles');
  await abrir(page, 'Cinematica');
  await page.waitForTimeout(1500);
  const t = await textos(page, 'Cinematica');
  expect(t.some(x => x.includes('toca la pantalla para seguir'))).toBe(true);
  expect(t.some(x => x.includes('Esc:'))).toBe(false);
});

test('final: el botón Saltar lleva a los créditos', async ({ page }, info) => {
  await abrir(page, 'Fin');
  await page.waitForTimeout(1500);
  await tocarTexto(page, info, 'Fin', /Saltar/);
  await expect.poll(() => page.evaluate(() => (window as any).juego.scene.getScene('Fin').etapa), { timeout: 20_000 }).toBeGreaterThanOrEqual(6);
});

test('pausa: el botón de pausa abre el menú y se puede seguir', async ({ page }, info) => {
  await abrir(page, 'Mision4Despegue');
  await pasarTarjeta(page, info, 'Mision4Despegue');
  await tocar(page, info, 960 - 34, 30);
  await esperarEscena(page, 'Pausa');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as any).juego.scene.isActive('Pausa'))).toBe(false);
});
