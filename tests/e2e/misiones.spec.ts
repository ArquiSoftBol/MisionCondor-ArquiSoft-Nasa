// QA · jugabilidad del modo historia: cada misión se juega con clic (PC) y con el dedo (celular/tablet).
import { test, expect } from '@playwright/test';
import { abrir, vigilarErrores, pasarTarjeta, tocar, tocarTexto, posTexto, textos, leer, arrastrar, esCelular } from './ayuda';

test('Misión 1 · Sistemas: instalar los 4 sistemas correctos y rechazar la taza', async ({ page }, info) => {
  const errores = vigilarErrores(page);
  const k = 'Mision1Sistemas';
  await abrir(page, k);
  await pasarTarjeta(page, info, k);
  const libre = () => expect.poll(() => leer<boolean>(page, k, 's.op.ocupado || s.probando'), { timeout: 30_000 }).toBe(false);
  // trampa: la taza no es un sistema → error
  const errAntes = await leer<number>(page, k, 's.errores');
  let p = (await posTexto(page, k, 'Taza de café'))!;
  await tocar(page, info, p[0], p[1] + 50);
  await libre();
  expect(await leer<number>(page, k, 's.errores')).toBeGreaterThan(errAntes);
  // los cuatro correctos (antena chica para no pasar de 900 kg con el RTG)
  for (const [pieza, sistema] of [['Generador RTG', 'energia'], ['Panel de control', 'control'], ['Antena chica', 'comunicacion'], ['Tanque de combustible', 'propulsion']]) {
    p = (await posTexto(page, k, pieza))!;
    expect(p, pieza).not.toBeNull();
    await tocar(page, info, p[0], p[1] + 50);
    await expect.poll(() => leer<boolean>(page, k, `s.llenos.has('${sistema}')`), { timeout: 30_000, message: pieza }).toBe(true);
    await libre();
  }
  expect(await leer<number>(page, k, 's.llenos.size')).toBe(4);
  expect(errores).toEqual([]);
});

test('Misión 2 · Cohete: elegir la etapa central y soltarla con un toque', async ({ page }, info) => {
  const errores = vigilarErrores(page);
  const k = 'Mision2Cohete';
  await abrir(page, k);
  await pasarTarjeta(page, info, k);
  // la pieza tocable más cercana (debajo) de la etiqueta «Etapa central»
  const p = (await posTexto(page, k, 'Etapa central'))!;
  const pieza: [number, number] = await page.evaluate(([kk, px, py]) => {
    const s: any = (window as any).juego.scene.getScene(kk as string); let mejor: [number, number] = [px as number, (py as number) + 40], d0 = 1e9;
    const rec = (o: any) => { if (o.input?.enabled && o.getBounds) { const b = o.getBounds(); const d = Math.hypot(b.centerX - (px as number), b.centerY - (py as number) - 40); if (b.centerY > (py as number) && d < d0) { d0 = d; mejor = [b.centerX, b.centerY]; } } (o.list || []).forEach(rec); };
    s.children.list.forEach(rec); return mejor;
  }, [k, p[0], p[1]] as const);
  await tocar(page, info, pieza[0], pieza[1]);
  await expect.poll(async () => (await textos(page, k)).some(t => /Suelta/.test(t)), { timeout: 20_000 }).toBe(true);
  await tocar(page, info, 480, 300);   // soltar
  await expect.poll(() => leer<number>(page, k, 's.paso'), { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
  expect(errores).toEqual([]);
});

test('Misión 3 · Orión: tocar una pieza tiene respuesta (se lleva o se explica por qué no)', async ({ page }, info) => {
  const errores = vigilarErrores(page);
  const k = 'Mision3Orion';
  await abrir(page, k);
  await pasarTarjeta(page, info, k);
  // las piezas son objetos tocables del escenario (debajo del HUD y lejos de los botones de esquina)
  const piezas: [number, number][] = await page.evaluate(kk => {
    const s: any = (window as any).juego.scene.getScene(kk); const out: [number, number][] = [];
    const rec = (o: any) => { if (o.input?.enabled && o.getBounds) { const b = o.getBounds(); if (b.centerY > 220 && b.centerX < 880 && b.width > 20) out.push([b.centerX, b.centerY]); } (o.list || []).forEach(rec); };
    s.children.list.forEach(rec); return out;
  }, k);
  expect(piezas.length).toBeGreaterThan(0);
  const antes = (await textos(page, k)).join('|');
  await tocar(page, info, piezas[0][0], piezas[0][1]);
  await expect.poll(async () => (await textos(page, k)).join('|'), { timeout: 20_000 }).not.toBe(antes);
  expect(errores).toEqual([]);
});

test('Misión 4 · Despegue: cuenta, Max-Q, dos separaciones y órbita', async ({ page }, info) => {
  const errores = vigilarErrores(page);
  const k = 'Mision4Despegue';
  await abrir(page, k);
  await pasarTarjeta(page, info, k);
  // ▲ ▼ del acelerador responden
  await tocar(page, info, 960 - 52, 540 - 88);
  expect(await leer<number>(page, k, 's.acel')).toBeLessThan(1);
  await tocar(page, info, 960 - 52, 540 - 150);
  await tocarTexto(page, info, k, 'INICIAR CUENTA');
  const fin = Date.now() + 90_000;
  while (Date.now() < fin) {
    const st = await leer<{ fase: string; sep: boolean; maxq: boolean; acel: number }>(page, k, '({ fase: s.fase, sep: !!(s.botonSep && s.botonSep.active), maxq: s.enMaxQ, acel: s.acel })');
    if (st.fase === 'orbita') break;
    if (st.sep) {
      const b = await leer<[number, number]>(page, k, '[s.botonSep.getBounds().centerX, s.botonSep.getBounds().centerY]');
      await tocar(page, info, b[0], b[1]);
    } else if (st.maxq && st.acel > 0.7) await tocar(page, info, 960 - 52, 540 - 88);
    else if (!st.maxq && st.acel < 1 && st.fase === 'propulsores') await tocar(page, info, 960 - 52, 540 - 150);
    await page.waitForTimeout(400);
  }
  expect(await leer<string>(page, k, 's.fase')).toBe('orbita');
  await expect.poll(async () => (await textos(page, k)).includes('Continuar'), { timeout: 20_000 }).toBe(true);
  expect(errores).toEqual([]);
});

test('Misión 5 · Marte: al estallar la tormenta el personaje se mueve (teclado o palanca)', async ({ page }, info) => {
  const errores = vigilarErrores(page);
  const k = 'MisionMarte';
  await abrir(page, k);
  await pasarTarjeta(page, info, k);
  await expect.poll(() => leer<string>(page, k, 's.fase'), { timeout: 40_000 }).toBe('tormenta');
  const x0 = await leer<number>(page, k, 's.yo.y');
  if (esCelular(info)) await arrastrar(page, info, 130, 380, 130, 310, 1500);   // palanca hacia arriba
  else { await page.keyboard.down('ArrowUp'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowUp'); }
  expect(await leer<number>(page, k, 's.yo.y')).toBeLessThan(x0 - 40);
  expect(errores).toEqual([]);
});

test('Misión 6 · Rover: manejar y escanear con BIT-7', async ({ page }, info) => {
  const errores = vigilarErrores(page);
  const k = 'Mision5Rover';
  await abrir(page, k);
  await pasarTarjeta(page, info, k);
  const x0 = await leer<number>(page, k, 's.rover.x');
  if (esCelular(info)) await arrastrar(page, info, 130, 390, 200, 390, 1500);
  else { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowRight'); }
  expect(await leer<number>(page, k, 's.rover.x')).toBeGreaterThan(x0 + 80);
  await tocarTexto(page, info, k, 'ESCANEAR');
  await expect.poll(async () => (await textos(page, k)).some(t => /BIT-7 encontró|hielo/i.test(t)), { timeout: 15_000 }).toBe(true);
  expect(errores).toEqual([]);
});

test('Ecuación del cohete: dejar cargas sube el Δv hasta 2,80 y se puede confirmar', async ({ page }, info) => {
  const errores = vigilarErrores(page);
  const k = 'Ecuacion';
  await abrir(page, k);
  await page.waitForTimeout(2500);
  const lectura = () => leer<string>(page, k, 's.lectura.text');
  expect(await lectura()).toContain('2,67');
  const cargas: [number, number][] = await page.evaluate(kk => {
    const s: any = (window as any).juego.scene.getScene(kk); const out: [number, number][] = [];
    s.children.list.forEach((o: any) => { if (o.input?.enabled && o.type === 'Container') { const b = o.getBounds(); out.push([b.centerX, b.centerY]); } });
    return out;
  }, k);
  for (const [x, y] of cargas) await tocar(page, info, x, y);
  await expect.poll(async () => parseFloat((await lectura()).replace(/[^\d,]/g, '').replace(',', '.'))).toBeGreaterThanOrEqual(2.8);
  await expect.poll(() => posTexto(page, k, 'Confirmar ruta de regreso')).not.toBeNull();
  expect(errores).toEqual([]);
});

test('guía «?» dentro de una misión: se abre y muestra controles del aparato', async ({ page }, info) => {
  const k = 'Mision5Rover';
  await abrir(page, k);
  await pasarTarjeta(page, info, k);
  await tocar(page, info, 960 - 84, 30);   // botón ?
  await expect.poll(() => page.evaluate(() => (window as any).juego.scene.isActive('Pausa'))).toBe(true);
  const t = await textos(page, 'Pausa');
  if (esCelular(info)) expect(t.some(x => x.includes('Palanca o dedo'))).toBe(true);
  else expect(t.some(x => x.includes('WASD'))).toBe(true);
});
