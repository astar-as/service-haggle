import { Audio } from "@remotion/media";
import { springTiming, TransitionSeries, type TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import React from "react";
import { AbsoluteFill, interpolate, Sequence, staticFile } from "remotion";
import { Coverage } from "./scenes/Coverage";
import { Dashboard } from "./scenes/Dashboard";
import { End } from "./scenes/End";
import { Intro } from "./scenes/Intro";
import { Negotiation } from "./scenes/Negotiation";
import { Problem } from "./scenes/Problem";
import { Result } from "./scenes/Result";
import { Watching } from "./scenes/Watching";
import { C } from "./theme";

const T = 12;
const CUTS = [0, 186, 270, 369, 525, 585, 705, 828, 930];
export const DURATION = CUTS[CUTS.length - 1];
const len = (i: number) => CUTS[i + 1] - CUTS[i] + (i < CUTS.length - 2 ? T : 0);
const timing = springTiming({ config: { damping: 200 }, durationInFrames: T });

const SCENES = [Problem, Intro, Coverage, Watching, Dashboard, Negotiation, Result, End];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TRANSITIONS: TransitionPresentation<any>[] = [
  fade(),
  slide({ direction: "from-bottom" }),
  wipe({ direction: "from-right" }),
  slide({ direction: "from-right" }),
  fade(),
  slide({ direction: "from-bottom" }),
  fade(),
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
      volume={(f) => interpolate(f, [0, 15, 820, 870, 900], [0, 0.32, 0.32, 0.6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
    />
    <Sequence from={4}>
      <Audio src={staticFile("vo.mp3")} volume={1} />
    </Sequence>
  </AbsoluteFill>
);
