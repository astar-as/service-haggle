import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import React from "react";
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "./theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Grain: React.FC<{ opacity?: number; dark?: boolean }> = ({ opacity = 0.06, dark }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: dark ? "screen" : "multiply", opacity }}>
      <svg width="100%" height="100%">
        <filter id={`g${Math.floor(frame / 2) % 6}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={Math.floor(frame / 2) % 6} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#g${Math.floor(frame / 2) % 6})`} />
      </svg>
    </AbsoluteFill>
  );
};

export const Backdrop: React.FC<{ dark?: boolean; speed?: number; grid?: boolean; tint?: string }> = ({ dark, speed = 1, grid = true, tint }) => {
  const frame = useCurrentFrame();
  const t = (frame / 30) * speed;
  const base = tint ?? (dark ? "#05070C" : C.canvas);
  const blobs = dark
    ? [
        { c: "rgba(34,88,229,0.55)", s: 1300, x: 30 + 18 * Math.sin(t * 0.7), y: 35 + 14 * Math.cos(t * 0.5) },
        { c: "rgba(56,189,248,0.28)", s: 1100, x: 72 + 16 * Math.cos(t * 0.6), y: 62 + 16 * Math.sin(t * 0.8) },
        { c: "rgba(99,102,241,0.22)", s: 900, x: 55 + 20 * Math.sin(t * 0.9 + 2), y: 20 + 10 * Math.cos(t * 0.7) },
      ]
    : [
        { c: "rgba(34,88,229,0.16)", s: 1300, x: 18 + 14 * Math.sin(t * 0.6), y: 25 + 12 * Math.cos(t * 0.5) },
        { c: "rgba(56,189,248,0.14)", s: 1200, x: 82 + 12 * Math.cos(t * 0.55), y: 72 + 14 * Math.sin(t * 0.7) },
        { c: "rgba(34,88,229,0.08)", s: 900, x: 60 + 18 * Math.sin(t * 0.8 + 1), y: 12 + 8 * Math.cos(t * 0.6) },
      ];
  const line = dark ? "rgba(120,160,255,0.16)" : "rgba(34,88,229,0.09)";
  return (
    <AbsoluteFill style={{ background: base, overflow: "hidden" }}>
      {blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: b.s,
            height: b.s,
            marginLeft: -b.s / 2,
            marginTop: -b.s / 2,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${b.c} 0%, transparent 62%)`,
            filter: "blur(30px)",
          }}
        />
      ))}
      {grid && (
        <div
          style={{
            position: "absolute",
            left: "-60%",
            right: "-60%",
            bottom: "-40%",
            height: "95%",
            transform: "perspective(900px) rotateX(64deg)",
            transformOrigin: "50% 0%",
            backgroundImage: `linear-gradient(${line} 1.5px, transparent 1.5px), linear-gradient(90deg, ${line} 1.5px, transparent 1.5px)`,
            backgroundSize: "90px 90px",
            backgroundPosition: `0px ${(frame * 3 * speed) % 90}px`,
            WebkitMaskImage: "linear-gradient(to top, black 5%, transparent 75%)",
            maskImage: "linear-gradient(to top, black 5%, transparent 75%)",
          }}
        />
      )}
      {Array.from({ length: 34 }).map((_, i) => {
        const x = random(`px${i}`) * 100;
        const sp = 0.15 + random(`ps${i}`) * 0.5;
        const y = 110 - (((frame * sp * speed + random(`py${i}`) * 120) % 120));
        const size = 3 + random(`pz${i}`) * 6;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x + Math.sin((frame + i * 20) / 30) * 1.5}%`,
              top: `${y}%`,
              width: size,
              height: size,
              borderRadius: 999,
              background: dark ? "rgba(140,180,255,0.7)" : "rgba(34,88,229,0.35)",
              boxShadow: dark ? "0 0 12px rgba(120,160,255,0.8)" : "none",
            }}
          />
        );
      })}
      <AbsoluteFill style={{ background: dark ? "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%)" : "radial-gradient(ellipse at center, transparent 55%, rgba(19,22,27,0.06) 100%)" }} />
      <Grain dark={dark} opacity={dark ? 0.09 : 0.05} />
    </AbsoluteFill>
  );
};

export const Camera: React.FC<{ children: React.ReactNode; push?: number; tilt?: number; shakeAt?: number[] }> = ({ children, push = 0.07, tilt = 1.6, shakeAt = [] }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = frame / durationInFrames;
  let sx = 0;
  let sy = 0;
  for (const s of shakeAt) {
    const d = frame - s;
    if (d >= 0 && d < 10) {
      const amp = (1 - d / 10) * 16;
      sx += (random(`sx${s}${d}`) - 0.5) * amp;
      sy += (random(`sy${s}${d}`) - 0.5) * amp;
    }
  }
  return (
    <AbsoluteFill style={{ perspective: 1800 }}>
      <AbsoluteFill
        style={{
          transform: `translate(${sx}px, ${sy}px) scale(${1 + push * p}) rotateX(${Math.sin(frame / 38) * tilt * 0.6}deg) rotateY(${Math.cos(frame / 47) * tilt}deg)`,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Words: React.FC<{ text: string; delay?: number; stagger?: number; style?: React.CSSProperties; color?: (w: string, i: number) => string | undefined }> = ({
  text,
  delay = 0,
  stagger = 3,
  style,
  color,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", columnGap: "0.24em", ...style }}>
      {text.split(" ").map((w, i) => {
        const p = spring({ frame: frame - delay - i * stagger, fps, config: { damping: 15, stiffness: 190 } });
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: "0.08em" }}>
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${(1 - p) * 110}%) rotate(${(1 - p) * 8}deg)`,
                filter: `blur(${(1 - p) * 6}px)`,
                color: color?.(w, i),
              }}
            >
              {w}
            </span>
          </span>
        );
      })}
    </span>
  );
};

export const Slam: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: { damping: 11, stiffness: 260 } });
  return (
    <div
      style={{
        opacity: interpolate(frame - at, [0, 3], [0, 1], clamp),
        transform: `scale(${interpolate(p, [0, 1], [1.9, 1])})`,
        filter: `blur(${interpolate(p, [0, 0.6], [14, 0], clamp)}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const ZoomPres: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({ children, presentationDirection, presentationProgress: p }) => {
  const entering = presentationDirection === "entering";
  const style: React.CSSProperties = entering
    ? { opacity: interpolate(p, [0, 0.5], [0, 1], clamp), transform: `scale(${interpolate(p, [0, 1], [0.78, 1])})`, filter: `blur(${interpolate(p, [0, 1], [22, 0])}px)` }
    : { opacity: interpolate(p, [0.35, 1], [1, 0], clamp), transform: `scale(${interpolate(p, [0, 1], [1, 1.45])})`, filter: `blur(${interpolate(p, [0, 1], [0, 22])}px)` };
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

export const zoomThrough = (): TransitionPresentation<Record<string, never>> => ({ component: ZoomPres, props: {} });

const WhipPres: React.FC<TransitionPresentationComponentProps<{ dir: number }>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const d = passedProps.dir;
  const entering = presentationDirection === "entering";
  const x = entering ? interpolate(p, [0, 1], [100 * d, 0]) : interpolate(p, [0, 1], [0, -100 * d]);
  const blur = Math.sin(p * Math.PI) * 26;
  return <AbsoluteFill style={{ transform: `translateX(${x}%)`, filter: `blur(${blur}px)` }}>{children}</AbsoluteFill>;
};

export const whip = (dir: 1 | -1 = 1): TransitionPresentation<{ dir: number }> => ({ component: WhipPres, props: { dir } });

export const Burst: React.FC<{ at: number; color?: string; x?: string; y?: string; rays?: number; size?: number }> = ({ at, color = C.money, x = "50%", y = "50%", rays = 18, size = 900 }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - at, [0, 26], [0, 1], clamp);
  if (frame < at) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0 }}>
      {[0, 1].map((r) => (
        <div
          key={r}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: size,
            height: size,
            marginLeft: -size / 2,
            marginTop: -size / 2,
            borderRadius: "50%",
            border: `${6 - r * 3}px solid ${color}`,
            transform: `scale(${interpolate(t, [0, 1], [0.1, 1 + r * 0.3])})`,
            opacity: 1 - t,
          }}
        />
      ))}
      {Array.from({ length: rays }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 6,
            height: 70,
            marginLeft: -3,
            borderRadius: 6,
            background: color,
            transform: `rotate(${(i / rays) * 360}deg) translateY(${-120 - t * (size * 0.45)}px)`,
            opacity: 1 - t,
          }}
        />
      ))}
    </div>
  );
};
