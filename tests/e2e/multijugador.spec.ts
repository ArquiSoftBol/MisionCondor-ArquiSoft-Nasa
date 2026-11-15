// QA · multijugador con DOS navegadores reales: lobby por código, guía, mesa del ingeniero y salidas.
// El Recolector se simula enviando sus acciones por la conexión del juego (window.red), sin caminar por el mapa.
import { test, expect, type Page, type TestInfo, type Browser } from '@playwright/test';
import { abrir, vigilarErrores, tocar, tocarTexto, posTexto, esperarEscena, leer, esCelular, hayTexto } from './ayuda';

const W = 960;

async function jugador(browser: Browser, info: TestInfo, nombre: string): Promise<Page> {
  const ctx = await browser.newContext(info.project.use);
  const page = await ctx.newPage();
  await abrir(page, 'MultiLobby');
  const campo = page.locator('input').first();
  await campo.fill(nombre);
  await campo.press('Enter');
  await expect.poll(() => posTexto(page, 'MultiLobby', 'Crear sala')).not.toBeNull();
  return page;
}

async function crearYUnirse(browser: Browser, info: TestInfo, escenario: 'salar' | 'cohete') {
  const A = await jugador(browser, info, 'Ingrid'), B = await jugador(browser, info, 'Rolo');
  if (escenario === 'cohete') await tocarTexto(A, info, 'MultiLobby', 'Torre de lanzamiento');
  await tocarTexto(A, info, 'MultiLobby', 'Crear sala');
  await expect.poll(() => leer<string | undefined>(A, 'MultiLobby', 's.sala && s.sala.codigo')).toBeTruthy();
  const codigo = await leer<string>(A, 'MultiLobby', 's.sala.codigo');
  expect(await leer<string>(A, 'MultiLobby', 's.sala.escenario')).toBe(escenario);
  // B escribe el código en las 6 casillas (minúsculas: se pasan solas a mayúsculas)
  await tocar(B, info, W / 2 + 196, 300);
  await B.keyboard.type(codigo.toLowerCase());
  expect(await B.locator('input').last().inputValue()).toBe(codigo);
  await tocarTexto(B, info, 'MultiLobby', 'Unirse');
  await expect.poll(() => leer<number>(A, 'MultiLobby', 's.sala ? s.sala.jugadores.length : 0')).toBe(2);
  // la guía de la sala de espera se abre y se cierra
  await tocarTexto(B, info, 'MultiLobby', 'Cómo se juega');
  await expect.poll(() => hayTexto(B, 'MultiLobby', 'TU ROL')).toBe(true);
  await tocarTexto(B, info, 'MultiLobby', 'Entendido');
  // listos
  await tocarTexto(A, info, 'MultiLobby', 'Estoy listo');
  await tocarTexto(B, info, 'MultiLobby', 'Estoy listo');
  await esperarEscena(A, 'Coop'); await esperarEscena(B, 'Coop');
  // la guía de cada rol aparece sola y se cierra con «¡A jugar!»
  for (const p of [A, B]) {
    await expect.poll(() => posTexto(p, 'Coop', '¡A jugar!'), { timeout: 20_000 }).not.toBeNull();
    await tocarTexto(p, info, 'Coop', '¡A jugar!');
    await expect.poll(() => leer<boolean>(p, 'Coop', '!s.dialogo')).toBe(true);
  }
  return { A, B, codigo };
}

/** El recolector entrega una pieza (acciones reales del protocolo, como si caminara). */
async function entregar(B: Page, id: string) {
  await B.evaluate(async (pieza) => {
    const red = (window as any).red, s: any = (window as any).juego.scene.getScene('Coop');
    const it = s.esc.items.find((i: any) => i.id === pieza), e = s.esc.entrega;
    red.enviar({ t: 'pos', x: it.x, y: it.y, dir: 0, mov: false }); red.enviar({ t: 'tomar', item: pieza });
    for (let i = 0; i < 50 && !s.estado.carga.includes(pieza); i++) await new Promise(r => setTimeout(r, 50));
    red.enviar({ t: 'pos', x: e.x, y: e.y, dir: 0, mov: false }); red.enviar({ t: 'entregar' });
  }, id);
  await expect.poll(() => leer<boolean>(B, 'Coop', `s.estado.bandeja.includes('${id}')`)).toBe(true);
}

/** El ingeniero abre la mesa (E en PC / botón USAR en táctil) y monta lo elegido con la aguja en verde. */
async function montarDesdeMesa(A: Page, info: TestInfo) {
  if (!(await leer<boolean>(A, 'Coop', '!!s.mesaPanel'))) {
    if (esCelular(info)) await tocarTexto(A, info, 'Coop', 'USAR'); else await A.keyboard.press('e');
    await expect.poll(() => leer<boolean>(A, 'Coop', '!!s.mesaPanel')).toBe(true);
  }
  const sel = await leer<string>(A, 'Coop', 's.seleccion');
  expect(sel, 'la mesa elige sola la pieza que va ahora').toBeTruthy();
  // la aguja se deja quieta en el centro de la zona verde y se pulsa MONTAR con un clic/toque REAL.
  // (Así el test no depende de los cuadros por segundo de la máquina; la puntería a ojo está en el checklist manual.)
  await A.waitForFunction(() => !!(window as any).juego.scene.getScene('Coop').calib, null, { timeout: 15_000 });
  await A.evaluate(() => { const c = (window as any).juego.scene.getScene('Coop').calib; c.dir = 0; c.aguja = (c.zona[0] + c.zona[1]) / 2; });
  await tocar(A, info, 470, 438);   // MONTAR
  await expect.poll(() => leer<boolean>(A, 'Coop', `s.estado.montado.some(m => m.id === '${sel}')`), { message: `montar ${sel}` }).toBe(true);
}

test('multijugador · salar completo: lobby por código, mesa inteligente y fin', async ({ browser }, info) => {
  test.setTimeout(300_000);
  const { A, B } = await crearYUnirse(browser, info, 'salar');
  const errA = vigilarErrores(A), errB = vigilarErrores(B);
  // el recolector trae también una trampa: la mesa la marca «NO VA» y no la elige
  for (const id of ['solar', 'rtg', 'control', 'antena', 'tanque']) await entregar(B, id);
  if (esCelular(info)) await tocarTexto(A, info, 'Coop', 'USAR'); else await A.keyboard.press('e');
  await expect.poll(() => leer<boolean>(A, 'Coop', '!!s.mesaPanel')).toBe(true);
  expect(await hayTexto(A, 'Coop', 'NO VA')).toBe(true);
  for (let i = 0; i < 4; i++) await montarDesdeMesa(A, info);
  await expect.poll(() => hayTexto(A, 'Coop', 'MISIÓN EN EQUIPO CUMPLIDA'), { timeout: 20_000 }).toBe(true);
  expect(await leer<number>(A, 'Coop', 's.estado.errores')).toBe(0);
  // Cerrar desde la pantalla final (con la cámara movida: el fallo que había)
  await tocarTexto(A, info, 'Coop', 'Salir');
  await esperarEscena(A, 'Titulo');
  expect([...errA, ...errB]).toEqual([]);
  await A.context().close(); await B.context().close();
});

test('multijugador · cohete: Cerrar la mesa, «?» de guía y piezas fuera de orden', async ({ browser }, info) => {
  test.setTimeout(240_000);
  const { A, B } = await crearYUnirse(browser, info, 'cohete');
  await entregar(B, 'superior');
  if (esCelular(info)) await tocarTexto(A, info, 'Coop', 'USAR'); else await A.keyboard.press('e');
  await expect.poll(() => leer<boolean>(A, 'Coop', '!!s.mesaPanel')).toBe(true);
  expect(await hayTexto(A, 'Coop', 'DESPUÉS')).toBe(true);
  expect(await hayTexto(A, 'Coop', 'AHORA')).toBe(true);
  await tocarTexto(A, info, 'Coop', 'Cerrar');
  await expect.poll(() => leer<boolean>(A, 'Coop', '!s.mesaPanel')).toBe(true);
  // botón «?»: abre la guía de su rol y se cierra
  await tocar(A, info, W - 162, 30);
  await expect.poll(() => hayTexto(A, 'Coop', 'TU ROL')).toBe(true);
  await tocarTexto(A, info, 'Coop', '¡A jugar!');
  await expect.poll(() => leer<boolean>(A, 'Coop', '!s.dialogo')).toBe(true);
  await A.context().close(); await B.context().close();
});

test('multijugador · salir a mitad: confirmación y el compañero puede volver a la sala', async ({ browser }, info) => {
  test.setTimeout(240_000);
  const { A, B, codigo } = await crearYUnirse(browser, info, 'salar');
  await tocarTexto(A, info, 'Coop', 'Salir');
  await expect.poll(() => hayTexto(A, 'Coop', 'SALIR DE LA MISIÓN')).toBe(true);
  // «Seguir jugando» cierra el diálogo sin salir
  await tocarTexto(A, info, 'Coop', 'Seguir jugando');
  await expect.poll(() => leer<boolean>(A, 'Coop', '!s.dialogo')).toBe(true);
  await tocarTexto(A, info, 'Coop', 'Salir');
  await expect.poll(() => hayTexto(A, 'Coop', 'SALIR DE LA MISIÓN')).toBe(true);
  const botones = await A.evaluate(() => { const s: any = (window as any).juego.scene.getScene('Coop'); const out: [number, number][] = []; const rec = (o: any) => { if (o.type === 'Text' && o.text === 'Salir') { const b = o.getBounds(); out.push([b.centerX, b.centerY]); } (o.list || []).forEach(rec); }; s.children.list.forEach(rec); return out; });
  const enDialogo = botones.sort((a, b) => b[1] - a[1])[0];   // el «Salir» del diálogo (más abajo que el del HUD)
  await tocar(A, info, enDialogo[0], enDialogo[1]);
  await esperarEscena(A, 'MultiLobby');
  await expect.poll(() => hayTexto(B, 'Coop', 'PARTIDA TERMINADA'), { timeout: 15_000 }).toBe(true);
  await tocarTexto(B, info, 'Coop', 'Ir a la sala');
  await esperarEscena(B, 'MultiLobby');
  expect(await leer<string>(B, 'MultiLobby', 's.sala.codigo')).toBe(codigo);
  await A.context().close(); await B.context().close();
});
