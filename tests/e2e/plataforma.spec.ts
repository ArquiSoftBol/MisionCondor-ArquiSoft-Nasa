// QA · multiplataforma: app instalable, pantalla vertical, controles táctiles y seguridad del servidor web.
import { test, expect } from '@playwright/test';
import { abrir, esCelular, pasarTarjeta, leer, textos } from './ayuda';

test('PWA: el manifiesto y los íconos se sirven bien (instalable en Android, iOS y PC)', async ({ request }) => {
  const m = await request.get('/app/manifest.webmanifest');
  expect(m.status()).toBe(200);
  expect(m.headers()['content-type']).toContain('application/manifest+json');
  const j = await m.json();
  expect(j.display).toBe('fullscreen');
  expect(j.orientation).toBe('landscape');
  for (const ic of j.icons) expect((await request.get(`/app/${ic.src}`)).status(), ic.src).toBe(200);
  expect((await request.get('/app/apple-touch-icon.png')).status()).toBe(200);
});

test('servidor web: salud ok y no deja leer archivos fuera del juego', async ({ request }) => {
  expect((await request.get('/api/salud')).status()).toBe(200);
  for (const ruta of ['/..%2f..%2fpackage.json', '/%2e%2e/%2e%2e/package.json', '/datos/condor.db']) {
    const r = await request.get(ruta);
    expect([403, 404], ruta).toContain(r.status());
  }
});

test('celular en vertical: pide girar el teléfono', async ({ page }, info) => {
  test.skip(!esCelular(info), 'solo celular/tablet');
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: Math.min(vp.width, vp.height), height: Math.max(vp.width, vp.height) });
  await page.goto('/');
  if (Math.min(vp.width, vp.height) <= 820) await expect(page.locator('#girar')).toBeVisible();
});

test('táctil: palanca en el Rover y botones de acción grandes', async ({ page }, info) => {
  test.skip(!esCelular(info), 'solo pantallas táctiles');
  await abrir(page, 'Mision5Rover');
  await pasarTarjeta(page, info, 'Mision5Rover');
  expect(await leer<boolean>(page, 'Mision5Rover', '!!s.palanca && !!s.palanca.base')).toBe(true);
  const t = await textos(page, 'Mision5Rover');
  expect(t).toContain('USAR');
  expect(t).toContain('ESCANEAR');
});

test('PC: no aparece la palanca táctil', async ({ page }, info) => {
  test.skip(esCelular(info), 'solo PC');
  await abrir(page, 'Mision5Rover');
  await page.waitForTimeout(1500);
  expect(await leer<boolean>(page, 'Mision5Rover', '!!(s.palanca && s.palanca.base)')).toBe(false);
});

test('la página no hace zoom ni deja seleccionar texto al tocar', async ({ page }) => {
  await page.goto('/');
  const css = await page.evaluate(() => { const b = getComputedStyle(document.body); return [b.userSelect || (b as any).webkitUserSelect, b.touchAction, b.overscrollBehavior]; });
  expect(css[0]).toBe('none');
  expect(css[1]).toBe('none');
  expect(css[2]).toBe('none');
  const vp = await page.locator('meta[name=viewport]').getAttribute('content');
  expect(vp).toContain('user-scalable=no');
});
