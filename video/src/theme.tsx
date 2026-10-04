import { loadFont } from "@remotion/google-fonts/HostGrotesk";
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });

export const C = {
  canvas: "#F6F7F8",
  ink: "#13161B",
  ink2: "#2D3138",
  muted: "#575B62",
  subtle: "#6E7278",
  faint: "#9A9EA5",
  line: "#E3E5E7",
  hair: "#EEF0F2",
  accent: "#2258E5",
  accentSoft: "#E9EFFD",
  money: "#298646",
  moneySoft: "#E6F3EA",
  white: "#FFFFFF",
};

export const card: React.CSSProperties = {
  background: C.white,
  borderRadius: 28,
  boxShadow: `0 0 0 1.5px ${C.line}, 0 30px 60px -30px rgba(19,22,27,0.18)`,
};

export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function useEnter(delay = 0, config: { damping?: number; stiffness?: number; mass?: number } = { damping: 18, stiffness: 140 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config });
}

export const Rise: React.FC<{ delay?: number; distance?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  delay = 0,
  distance = 40,
  style,
  children,
}) => {
  const p = useEnter(delay);
  return (
    <div
      style={{
        opacity: interpolate(p, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(p, [0, 1], [distance, 0])}px)`,
        filter: `blur(${interpolate(p, [0, 1], [8, 0])}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Counter: React.FC<{ from: number; to: number; start: number; duration: number; prefix?: string; style?: React.CSSProperties }> = ({
  from,
  to,
  start,
  duration,
  prefix = "$",
  style,
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [start, start + duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const eased = 1 - Math.pow(1 - t, 3);
  const v = from + (to - from) * eased;
  return <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>{prefix + Math.round(v).toLocaleString("en-US")}</span>;
};

export const Scene: React.FC<{ children: React.ReactNode; push?: number; style?: React.CSSProperties }> = ({ children, push = 0.04, style }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = interpolate(frame, [0, durationInFrames], [1, 1 + push]);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.canvas, fontFamily, color: C.ink, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${s})`, ...style }}>{children}</div>
    </div>
  );
};

export const Check: React.FC<{ size?: number; color?: string }> = ({ size = 26, color = C.money }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const PhoneIcon: React.FC<{ size?: number; color?: string }> = ({ size = 28, color = C.subtle }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
  </svg>
);

export const MailIcon: React.FC<{ size?: number; color?: string }> = ({ size = 28, color = C.subtle }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

export const Logo: React.FC<{ size?: number }> = ({ size = 72 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
    <div style={{ width: size * 0.42, height: size * 0.42, borderRadius: size * 0.12, background: C.accent }} />
    <span style={{ fontSize: size, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1 }}>lowball</span>
  </div>
);

export const Powered: React.FC<{ items: string[]; delay?: number; style?: React.CSSProperties }> = ({ items, delay = 0, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", left: 150, bottom: 70, display: "flex", gap: 14, alignItems: "center", ...style }}>
      {items.map((t, i) => {
        const p = spring({ frame: frame - delay - i * 4, fps, config: { damping: 16, stiffness: 170 } });
        return (
          <div
            key={t}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 18px",
              borderRadius: 999,
              background: C.white,
              boxShadow: `0 0 0 1.5px ${C.line}`,
              fontSize: 22,
              fontWeight: 500,
              color: C.muted,
              opacity: p,
              transform: `translateY(${(1 - p) * 16}px)`,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 999, background: C.accent }} />
            {t}
          </div>
        );
      })}
    </div>
  );
};
