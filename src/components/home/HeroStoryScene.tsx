"use client";

import { PerspectiveCamera, View } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { HeroSofa } from "@/lib/catalog";
import type { Palette } from "@/lib/types";
import { AiModel } from "@/three/AiModel";
import { daylightAt } from "@/three/daylight";
import { FOOTPRINT, HEIGHT } from "@/three/furniture";
import { Furniture } from "@/three/FurniturePiece";
import { SceneLights, ShadowFloor } from "@/three/SceneLights";
import { A_END, B_END, hourAt, smooth } from "./heroTiming";

/**
 * The hero's WebGL scene -- camera rig, sofa, room extras -- kept apart from HeroStory so
 * that three.js is not in the home page's bundle. HeroStory loads this with next/dynamic
 * once useAmbient3D allows it: desktop, idle, motion not reduced. A phone never asks for it,
 * and the hero there is HeroMobile, which was never 3D.
 */
type Shot = { p: number; pos: [number, number, number]; target: [number, number, number] };
const SHOTS: Shot[] = [
  { p: 0.0, pos: [4.4, 3.1, 5.8], target: [0.4, 0.7, 0] },
  { p: 0.27, pos: [2.9, 1.45, 3.7], target: [-0.1, 0.45, 0] },
  { p: 0.4, pos: [2.5, 1.25, 3.3], target: [-0.85, 0.45, 0] },
  { p: 0.54, pos: [1.5, 1.05, 3.5], target: [-1.05, 0.48, 0.1] },
  { p: 0.7, pos: [1.2, 2.7, 6.6], target: [-0.7, 0.55, 0] },
  { p: 1.0, pos: [-3.4, 2.1, 5.6], target: [-0.9, 0.6, 0] },
];

function shotAt(p: number, outPos: THREE.Vector3, outTarget: THREE.Vector3) {
  let i = 0;
  while (i < SHOTS.length - 2 && p > SHOTS[i + 1].p) i++;
  const a = SHOTS[i];
  const b = SHOTS[i + 1];
  const t = smooth(a.p, b.p, p);
  outPos.set(...a.pos).lerp(new THREE.Vector3(...b.pos), t);
  outTarget.set(...a.target).lerp(new THREE.Vector3(...b.target), t);
}

function CameraRig({ progress }: { progress: React.RefObject<number> }) {
  const { camera, pointer, size } = useThree();
  const pos = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3(0, 0.5, 0));

  useFrame((_, dt) => {
    shotAt(progress.current, pos.current, target.current);
    // phones: pull back so the sofa fits the narrow frame
    const aspect = size.width / size.height;
    if (aspect < 1) {
      pos.current.sub(target.current).multiplyScalar(1 + (1 - aspect) * 1.3).add(target.current);
      target.current.x = target.current.x * 0.2;
    }
    // opening shot: keep the flying parts clear of the headline — the sofa sits to the right on wide
    // screens and below the text on phones; the offset fades out as the sofa finishes building
    const open = 1 - smooth(0.05, A_END, progress.current);
    if (aspect < 1) {
      // phones: the text sits at the bottom, so the sofa builds in the upper half
      pos.current.y -= 0.7 * open;
      target.current.y -= 0.7 * open;
    } else {
      pos.current.x -= 1.1 * open;
      target.current.x -= 1.1 * open;
    }
    pos.current.x += pointer.x * 0.25;
    pos.current.y += pointer.y * 0.12;
    const k = 1 - Math.exp(-dt * 4);
    camera.position.lerp(pos.current, k);
    look.current.lerp(target.current, k);
    camera.lookAt(look.current);
  });
  return null;
}

const EXTRAS = [
  { kind: "armchair", pos: [-2.05, 0, 0.75], rot: 0.75 },
  { kind: "coffeeTable", pos: [-0.1, 0, 1.3], rot: 0 },
  { kind: "floorLamp", pos: [1.45, 0, -0.55], rot: 0 },
  { kind: "sideTable", pos: [-1.4, 0, -0.35], rot: 0 },
  { kind: "bookshelf", pos: [2.6, 0, -1.0], rot: -0.35 },
] as const;

function HeroScene({ progress, palette, sofa }: { progress: React.RefObject<number>; palette: Palette; sofa: HeroSofa | null }) {
  const hour = () => hourAt(progress.current);
  const glow = () => daylightAt(hour()).glow;
  return (
    <>
      <PerspectiveCamera makeDefault fov={34} position={[4.4, 3.1, 5.8]} near={0.1} far={60} />
      <CameraRig progress={progress} />
      <SceneLights hour={hour} shadowSize={5} />
      <ShadowFloor />
      {/*
        The hero builds Muscat Furniture's best-selling sofa set.

        When that product has a real scanned model attached in the admin, the hero shows
        the actual piece; until then it draws the sofa from parts, which is what makes
        the assembly and the fabric swatches possible at all. A scanned mesh is one solid
        object -- it cannot come apart or change fabric -- so the drawn sofa is not a
        placeholder to be removed, it is the only version the story can animate.
        Parts start close together and slightly into the build, so the first screen
        already reads as a sofa.
      */}
      {sofa?.modelUrl ? (
        <AiModel url={sofa.modelUrl} width={FOOTPRINT.sofa[0]} depth={FOOTPRINT.sofa[1]} height={HEIGHT.sofa} />
      ) : (
        <Furniture kind="sofa" palette={palette} spread={0.95} assembly={() => smooth(-0.07, A_END, progress.current)} />
      )}
      {EXTRAS.map((e, i) => (
        <Furniture
          key={e.kind}
          kind={e.kind}
          palette={palette}
          position={e.pos as unknown as [number, number, number]}
          rotation-y={e.rot}
          glow={glow}
          hideWhenUnbuilt
          assembly={() => smooth(B_END + 0.01 + i * 0.025, B_END + 0.13 + i * 0.025, progress.current)}
        />
      ))}
    </>
  );
}

/** Includes the <View> itself, so HeroStory needs no drei import of its own. */
export default function HeroStoryScene(props: {
  progress: React.RefObject<number>;
  palette: Palette;
  sofa: HeroSofa | null;
}) {
  return (
    <View className="stage-view">
      <HeroScene {...props} />
    </View>
  );
}
