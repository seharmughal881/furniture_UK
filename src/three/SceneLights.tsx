"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { daylightAt, type Daylight } from "./daylight";

/**
 * Sun + ambient driven by an hour getter, with a procedural studio environment
 * (Lightformers, so no HDR downloads). `onDaylight` lets the page tint its
 * background to match the sky.
 */
export function SceneLights({
  hour,
  onDaylight,
  shadowSize = 4,
  shadowMap = 2048,
}: {
  hour: () => number;
  onDaylight?: (d: Daylight) => void;
  shadowSize?: number;
  /** Shadow texture resolution; small card views use less GPU memory. */
  shadowMap?: number;
}) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.HemisphereLight>(null);
  const last = useRef(-1);

  useFrame(() => {
    const h = hour();
    if (Math.abs(h - last.current) < 0.002) return;
    last.current = h;
    const d = daylightAt(h);
    if (sun.current) {
      sun.current.position.copy(d.sunDir).multiplyScalar(8);
      sun.current.color.set(d.sunColor);
      sun.current.intensity = d.sunIntensity;
    }
    if (amb.current) {
      amb.current.intensity = d.ambient;
      amb.current.color.set(d.skyTop);
    }
    onDaylight?.(d);
  });

  return (
    <>
      <hemisphereLight ref={amb} args={["#ffffff", "#8a7a68", 0.6]} />
      <directionalLight
        ref={sun}
        castShadow
        position={[4, 6, 4]}
        intensity={3}
        shadow-mapSize={[shadowMap, shadowMap]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={6}
        shadow-camera-left={-shadowSize}
        shadow-camera-right={shadowSize}
        shadow-camera-top={shadowSize}
        shadow-camera-bottom={-shadowSize}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
      />
      <Environment resolution={256} environmentIntensity={0.55}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 2]} scale={[6, 3, 1]} rotation-x={Math.PI / 2.4} />
        <Lightformer form="rect" intensity={1.4} position={[-4, 1.5, 1]} scale={[3, 2, 1]} rotation-y={Math.PI / 2} color="#ffe2c4" />
        <Lightformer form="rect" intensity={0.9} position={[4, 1.2, -1]} scale={[3, 2, 1]} rotation-y={-Math.PI / 2} color="#dfe8ff" />
        <Lightformer form="ring" intensity={0.8} position={[0, 2, -5]} scale={3} />
      </Environment>
    </>
  );
}

/** Floor that only shows shadows, so the furniture sits on the page background. */
export function ShadowFloor({ size = 30, opacity = 0.32 }: { size?: number; opacity?: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow position-y={0.0005}>
      <planeGeometry args={[size, size]} />
      <shadowMaterial transparent opacity={opacity} color="#2b1d12" />
    </mesh>
  );
}
