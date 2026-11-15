// QA de punta a punta: el juego compilado (dist/) servido por el servidor real, jugado con clics (PC) y toques (celular).
//   npm run test:e2e            → todos los proyectos
//   npx playwright test --project=celular
// En una PC sin el Chromium de Playwright se usa Edge (o QA_NAVEGADOR=chrome). En CI se instala Chromium.
import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const PUERTO = Number(process.env.QA_PUERTO) || 8099;
const canal = process.env.QA_NAVEGADOR || (fs.existsSync(chromium.executablePath()) ? undefined : 'msedge');
const datos = path.join(os.tmpdir(), 'condor-qa-e2e');

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,                       // un solo servidor y juego pesado: de a uno es más estable
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'qa-reporte' }]],
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    channel: canal,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'pc', use: { viewport: { width: 1280, height: 720 } } },
    { name: 'celular', use: { ...devices['Pixel 7 landscape'], channel: canal } },
    { name: 'tablet', use: { ...devices['iPad (gen 7) landscape'], browserName: 'chromium', channel: canal } },
  ],
  webServer: {
    // compila el juego y levanta el mismo servidor que se publica (dist/servir.mjs)
    command: process.env.QA_SIN_COMPILAR ? 'node dist/servir.mjs' : 'npm run build:servidor && node dist/servir.mjs',
    url: `http://127.0.0.1:${PUERTO}/api/salud`,
    env: { PORT: String(PUERTO), CONDOR_DATOS: datos },
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
