import type WebSocketType from "ws";
import { apiKey, VoiceError } from "./openai";
import { endpoints, type LiveEvent } from "./protocol";

async function loadWs(): Promise<typeof WebSocketType> {
  process.env.WS_NO_BUFFER_UTIL ??= "1";
  process.env.WS_NO_UTF_8_VALIDATE ??= "1";
  const mod = (await import("ws")) as unknown as { default?: typeof WebSocketType; WebSocket?: typeof WebSocketType };
  return (mod.default ?? mod.WebSocket ?? mod) as typeof WebSocketType;
}

export class Sideband {
  private ws?: WebSocketType;
  private queue: string[] = [];
  open = false;

  constructor(
    private sessionId: string,
    private onEvent: (e: LiveEvent) => void,
    private onClose: (code: number, reason: string) => void,
  ) {}

  async connect(): Promise<void> {
    const WS = await loadWs();
    const key = apiKey();
    await new Promise<void>((resolve, reject) => {
      const ws = new WS(endpoints.attach(this.sessionId), { headers: { Authorization: `Bearer ${key}` } });
      this.ws = ws;
      let settled = false;
      ws.on("open", () => {
        settled = true;
        this.open = true;
        for (const m of this.queue.splice(0)) ws.send(m);
        resolve();
      });
      ws.on("message", (data) => {
        let event: LiveEvent;
        try {
          event = JSON.parse(data.toString());
        } catch {
          return;
        }
        this.onEvent(event);
      });
      ws.on("error", (err) => {
        if (!settled) {
          settled = true;
          reject(new VoiceError(`Sideband attach failed: ${err.message}`, 502, "sideband_failed"));
        } else console.error("[live] sideband error", err.message);
      });
      ws.on("close", (code, reason) => {
        const wasOpen = this.open;
        this.open = false;
        if (!settled) {
          settled = true;
          reject(new VoiceError(`Sideband closed before open (${code})`, 502, "sideband_failed"));
        } else if (wasOpen) this.onClose(code, reason.toString());
      });
    });
  }

  send(event: object) {
    const msg = JSON.stringify(event);
    if (this.open && this.ws) this.ws.send(msg);
    else this.queue.push(msg);
  }

  close() {
    this.open = false;
    try {
      this.ws?.close();
    } catch {}
  }
}
