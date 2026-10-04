"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const RATE = 24000;

function decode(b64: string) {
  const bin = atob(b64);
  const n = bin.length >> 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v / 0x8000;
  }
  return out;
}

export function useListenIn() {
  const [listening, setListening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const r = useRef<{ es?: EventSource; ctx?: AudioContext; cursor: Record<string, number> }>({ cursor: {} });

  const stop = useCallback(() => {
    r.current.es?.close();
    r.current.ctx?.close().catch(() => {});
    r.current = { cursor: {} };
    setListening(null);
  }, []);

  const start = useCallback(
    (callId: string) => {
      stop();
      setError(null);
      const ctx = new AudioContext({ sampleRate: RATE });
      const es = new EventSource(`/api/live/listen?callId=${encodeURIComponent(callId)}`);
      r.current = { es, ctx, cursor: { in: 0, out: 0 } };
      es.onmessage = (m) => {
        let msg: { d: "in" | "out"; a: string };
        try {
          msg = JSON.parse(m.data);
        } catch {
          return;
        }
        const pcm = decode(msg.a);
        if (!pcm.length) return;
        const buf = ctx.createBuffer(1, pcm.length, RATE);
        buf.copyToChannel(pcm, 0);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        const at = Math.max(r.current.cursor[msg.d] ?? 0, ctx.currentTime + 0.08);
        src.start(at);
        r.current.cursor[msg.d] = at + buf.duration;
      };
      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          setError("Listen-in stream closed");
          stop();
        }
      };
      setListening(callId);
    },
    [stop],
  );

  useEffect(() => () => stop(), [stop]);

  return { start, stop, listening, error };
}
