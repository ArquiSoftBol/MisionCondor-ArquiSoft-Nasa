// Conexión al servidor multijugador (WebSocket en /ws del mismo sitio; en desarrollo Vite lo reenvía al puerto 8787).
// Se reconecta sola: al volver, se vuelve a identificar y recupera su sala (el servidor le guarda el lugar 2 minutos).
type Oyente = (m: Record<string, unknown>) => void;

const CLAVE = 'mision-condor:coop';
export interface Identidad { email: string; nombre: string }
export const leerIdentidad = (): Identidad | null => { try { const v = localStorage.getItem(CLAVE); return v ? JSON.parse(v) : null; } catch { return null; } };
export const guardarIdentidad = (i: Identidad): void => { try { localStorage.setItem(CLAVE, JSON.stringify(i)); } catch { /* sin guardado */ } };

class Conexion {
  private ws: WebSocket | null = null;
  private oyentes = new Map<string, Set<Oyente>>();
  private cola: string[] = [];
  private intentos = 0;
  private cerrandoAdrede = false;
  identidad: Identidad | null = null;
  codigoSala: string | null = null;
  conectada = false;
  /** Último mensaje recibido de cada tipo (una escena que arranca tarde recupera el estado sin esperar). */
  ultimo: Record<string, Record<string, unknown>> = {};

  private url(): string {
    // Si el juego está en un hosting estático (GitHub Pages) y el servidor en otro sitio, se compila con
    // VITE_SERVIDOR_MP=wss://mi-servidor.onrender.com/ws ; si no, se usa el mismo sitio que sirve el juego.
    const fijo = import.meta.env.VITE_SERVIDOR_MP as string | undefined;
    if (fijo) return fijo;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}/ws`;
  }

  /** Conecta (si no lo está) y se identifica con el correo. */
  conectar(id: Identidad): void {
    this.identidad = id;
    this.cerrandoAdrede = false;
    if (this.ws && this.ws.readyState <= 1) { this.enviar({ t: 'hola', ...id }); return; }
    const ws = new WebSocket(this.url());
    this.ws = ws;
    ws.onopen = () => {
      this.conectada = true; this.intentos = 0;
      ws.send(JSON.stringify({ t: 'hola', ...this.identidad }));
      if (this.codigoSala) ws.send(JSON.stringify({ t: 'unirse', codigo: this.codigoSala }));   // volver a la sala tras un corte
      this.cola.splice(0).forEach(m => ws.send(m));
      this.emitir({ t: 'conexion', ok: true });
    };
    ws.onmessage = e => {
      let m: Record<string, unknown>;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'sala') this.codigoSala = (m.sala as { codigo: string }).codigo;
      if (m.t === 'fuera') this.codigoSala = null;
      if (m.t === 'inicio') delete this.ultimo.estado;
      this.ultimo[String(m.t)] = m;
      this.emitir(m);
    };
    ws.onclose = () => {
      this.conectada = false;
      this.emitir({ t: 'conexion', ok: false });
      if (this.cerrandoAdrede || !this.identidad) return;
      const ms = Math.min(8000, 500 * 2 ** this.intentos++);
      setTimeout(() => { if (!this.cerrandoAdrede && this.identidad) { this.ws = null; this.conectar(this.identidad); } }, ms);
    };
  }

  enviar(m: Record<string, unknown>): void {
    const txt = JSON.stringify(m);
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(txt);
    else if (m.t !== 'pos') this.cola.push(txt);   // las posiciones viejas no sirven: no se encolan
  }

  /** Escucha un tipo de mensaje ('*' = todos). Devuelve la función para dejar de escuchar. */
  on(tipo: string, fn: Oyente): () => void {
    if (!this.oyentes.has(tipo)) this.oyentes.set(tipo, new Set());
    this.oyentes.get(tipo)!.add(fn);
    return () => this.oyentes.get(tipo)?.delete(fn);
  }

  private emitir(m: Record<string, unknown>): void {
    this.oyentes.get(String(m.t))?.forEach(f => f(m));
    this.oyentes.get('*')?.forEach(f => f(m));
  }

  salirDeSala(): void { this.enviar({ t: 'salir' }); this.codigoSala = null; }

  desconectar(): void { this.cerrandoAdrede = true; this.codigoSala = null; this.ws?.close(); this.ws = null; }
}

export const Red = new Conexion();
