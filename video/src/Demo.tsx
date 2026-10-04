import { Audio } from "@remotion/media";
import { springTiming, TransitionSeries, type TransitionPresentation } from "@remotion/transitions";
import React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile } from "remotion";
import { whip, zoomThrough } from "./fx";
import { Coverage } from "./scenes/Coverage";
import { Dashboard } from "./scenes/Dashboard";
import { End } from "./scenes/End";
import { Intro } from "./scenes/Intro";
import { Negotiation } from "./scenes/Negotiation";
import { Problem } from "./scenes/Problem";
import { Result } from "./scenes/Result";
import { Watching } from "./scenes/Watching";
import { C } from "./theme";

const T = 10;
const CUTS = [0, 186, 270, 369, 525, 585, 705, 828, 930];
export const DURATION = CUTS[CUTS.length - 1];
const len = (i: number) => CUTS[i + 1] - CUTS[i] + (i < CUTS.length - 2 ? T : 0);
const timing = springTiming({ config: { damping: 200 }, durationInFrames: T });

const SCENES = [Problem, Intro, Coverage, Watching, Dashboard, Negotiation, Result, End];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TRANSITIONS: TransitionPresentation<any>[] = [zoomThrough(), whip(1), zoomThrough(), whip(-1), zoomThrough(), zoomThrough(), whip(1)];

const SFX: { at: number; src: string; volume: number }[] = [
  ...[2, 7, 12, 17, 22].map((at) => ({ at, src: "impact.mp3", volume: 0.18 })),
  { at: 96, src: "impact.mp3", volume: 0.55 },
  { at: 140, src: "impact.mp3", volume: 0.55 },
  ...CUTS.slice(1, -1).map((c) => ({ at: c - 4, src: "whoosh.mp3", volume: 0.35 })),
  { at: 188, src: "impact.mp3", volume: 0.45 },
  { at: 290, src: "ticks.mp3", volume: 0.25 },
  { at: 371, src: "ticks.mp3", volume: 0.3 },
  { at: 387, src: "ticks.mp3", volume: 0.3 },
  { at: 494, src: "impact.mp3", volume: 0.4 },
  { at: 530, src: "impact.mp3", volume: 0.45 },
  { at: 586, src: "ring.mp3", volume: 0.32 },
  { at: 657, src: "chime.mp3", volume: 0.4 },
  { at: 715, src: "impact.mp3", volume: 0.5 },
  { at: 717, src: "chime.mp3", volume: 0.5 },
];

export const Demo: React.FC = () => (
  <AbsoluteFill style={{ background: C.canvas }}>
    <TransitionSeries>
      {SCENES.map((S, i) => (
        <React.Fragment key={i}>
          <TransitionSeries.Sequence durationInFrames={len(i)}>
            <S />
          </TransitionSeries.Sequence>
          {i < TRANSITIONS.length && <TransitionSeries.Transition presentation={TRANSITIONS[i]} timing={timing} />}
        </React.Fragment>
      ))}
    </TransitionSeries>
    <Audio
      src={staticFile("music.mp3")}
      volume={(f) => interpolate(f, [0, 10, 820, 860, 900], [0, 0.34, 0.34, 0.65, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
    />
    <Sequence from={4}>
      <Audio src={staticFile("vo.mp3")} volume={1} />
    </Sequence>
    {SFX.map((s, i) => (
      <Sequence key={i} from={s.at} durationInFrames={60}>
        <Audio src={staticFile(s.src)} volume={s.volume} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
