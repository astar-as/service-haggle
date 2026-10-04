"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { appendEvent, closeEvent, DATA_CHANNEL_LABEL, ServerEvent } from "./protocol";

export type LiveCallStatus = "idle" | "connecting" | "live" | "ending" | "ended" | "error";

export interface StartOptions {
  callId?: string;
}

interface Refs {
  pc?: RTCPeerConnection;
  dc?: RTCDataChannel;
  mic?: MediaStream;
  audio?: HTMLAudioElement;
  callId?: string;
  greeting?: string;
  greeted?: boolean;
  timers: ReturnType<typeof setTimeout>[];
}

async function waitForIce(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", check);
      clearTimeout(t);
      resolve();
    };
    const check = () => pc.iceGatheringState === "complete" && done();
    const t = setTimeout(done, 3000);
    pc.addEventListener("icegatheringstatechange", check);
  });
}

export function useLiveCall() {
  const [status, setStatus] = useState<LiveCallStatus>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const r = useRef<Refs>({ timers: [] });

  const teardown = useCallback(() => {
    const s = r.current;
    s.timers.forEach(clearTimeout);
    s.mic?.getTracks().forEach((t) => t.stop());
    try {
      s.dc?.close();
    } catch {}
    try {
      s.pc?.close();
    } catch {}
    if (s.audio) {
      s.audio.pause();
      s.audio.srcObject = null;
    }
    r.current = { timers: [], callId: s.callId };
  }, []);

  const greet = useCallback(() => {
    const s = r.current;
    if (s.greeted || !s.greeting || s.dc?.readyState !== "open") return;
    s.greeted = true;
    s.dc.send(JSON.stringify(appendEvent("instructions", s.greeting, null, "greeting")));
  }, []);

  const start = useCallback(
    async (policyId: string, opts: StartOptions = {}) => {
      teardown();
      setError(null);
      setCallId(null);
      setStatus("connecting");
      const s = r.current;
      try {
        const pc = new RTCPeerConnection();
        s.pc = pc;
        const audio = new Audio();
        audio.autoplay = true;
        s.audio = audio;
        pc.addEventListener("track", (e) => {
          audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
          audio.play().catch(() => {});
        });
        const mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        s.mic = mic;
        for (const track of mic.getAudioTracks()) pc.addTrack(track, mic);
        const dc = pc.createDataChannel(DATA_CHANNEL_LABEL);
        s.dc = dc;
        dc.addEventListener("message", ({ data }) => {
          let event: { type?: string; error?: unknown; reason?: string };
          try {
            event = JSON.parse(data);
          } catch {
            return;
          }
          if (event.type === ServerEvent.sessionStarted) {
            setStatus("live");
            greet();
          } else if (event.type === ServerEvent.sessionClosed) {
            teardown();
            setStatus("ended");
          } else if (event.type === ServerEvent.error) console.warn("[live]", event.error);
        });
        dc.addEventListener("open", () => {
          s.timers.push(
            setTimeout(() => {
              if (r.current !== s) return;
              setStatus((st) => (st === "connecting" ? "live" : st));
              greet();
            }, 3000),
          );
        });
        dc.addEventListener("close", () => {
          if (r.current !== s) return;
          teardown();
          setStatus((st) => (st === "error" ? st : "ended"));
        });
        pc.addEventListener("connectionstatechange", () => {
          if (r.current !== s) return;
          if (pc.connectionState === "failed") {
            setError("Connection failed");
            setStatus("error");
            teardown();
          }
        });
        await pc.setLocalDescription(await pc.createOffer());
        await waitForIce(pc);
        const sdp = pc.localDescription?.sdp;
        if (!sdp) throw new Error("Missing local SDP offer");
        const res = await fetch("/api/live/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ policyId, callId: opts.callId, sdp }),
        });
        const json = (await res.json().catch(() => ({}))) as { callId?: string; sdp?: string; greeting?: string; error?: string };
        if (!res.ok || !json.sdp || !json.callId) throw new Error(json.error || `Session request failed (${res.status})`);
        s.callId = json.callId;
        s.greeting = json.greeting;
        setCallId(json.callId);
        await pc.setRemoteDescription({ type: "answer", sdp: json.sdp });
        return json.callId;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const id = s.callId;
        teardown();
        if (id) fetch("/api/live/hangup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callId: id }) }).catch(() => {});
        setError(message);
        setStatus("error");
        return null;
      }
    },
    [teardown, greet],
  );

  const hangup = useCallback(async () => {
    const s = r.current;
    const id = s.callId;
    setStatus("ending");
    s.timers.push(
      setTimeout(() => {
        if (r.current !== s) return;
        teardown();
        setStatus("ended");
      }, 10_000),
    );
    try {
      if (id) {
        const res = await fetch("/api/live/hangup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callId: id }),
        });
        if (res.ok) return;
      }
    } catch {}
    if (s.dc?.readyState === "open") s.dc.send(JSON.stringify(closeEvent("browser_close")));
    else {
      teardown();
      setStatus("ended");
    }
  }, [teardown]);

  useEffect(() => () => teardown(), [teardown]);

  return { start, hangup, status, callId, error };
}
