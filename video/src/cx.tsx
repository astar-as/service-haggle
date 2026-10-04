import { loadFont } from "@remotion/google-fonts/Geist";
import { loadFont as loadMono } from "@remotion/google-fonts/GeistMono";
import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

export const { fontFamily: sans } = loadFont("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
export const { fontFamily: mono } = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

export const K = {
  canvas: "#0A0A0A",
  window: "#161616",
  sidebar: "#111111",
  raised: "#1E1E1E",
  line: "#262626",
  hair: "#1F1F1F",
  text: "#EDEDED",
  soft: "#A3A3A3",
  mute: "#6E6E6E",
  blue: "#5B9BFF",
  green: "#3FCF8E",
  red: "#FF6B6B",
};

export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const glide = Easing.bezier(0.65, 0, 0.35, 1);

export function useIn(at: number, dur = 14) {
  const frame = useCurrentFrame();
  return interpolate(frame, [at, at + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
}

export const In: React.FC<{ at: number; dur?: number; y?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ at, dur = 14, y = 10, style, children }) => {
  const p = useIn(at, dur);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * y}px)`, filter: `blur(${(1 - p) * 4}px)`, ...style }}>{children}</div>;
};

export const Spinner: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = K.soft }) => {
  const frame = useCurrentFrame();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${frame * 14}deg)`, flex: "none" }}>
      <circle cx="12" cy="12" r="9" stroke={K.line} strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
};

export const Tick: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = K.green }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const Status: React.FC<{ doneAt: number; size?: number }> = ({ doneAt, size = 16 }) => {
  const frame = useCurrentFrame();
  return frame >= doneAt ? <Tick size={size} /> : <Spinner size={size} />;
};

export const Mark: React.FC<{ size?: number; color?: string }> = ({ size = 22, color = K.text }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.28, background: color, flex: "none" }} />
);

export function typed(text: string, frame: number, start: number, cps = 2) {
  return text.slice(0, Math.max(0, Math.floor((frame - start) * cps)));
}

export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
