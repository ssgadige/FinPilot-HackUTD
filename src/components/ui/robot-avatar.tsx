"use client";

/**
 * 3D robot avatar for the financial coach. Adapted from the "robot-hero" community
 * component: the marketing navbar, CTA, drei Environment (runtime CDN download) and
 * Tailwind classes were removed; colours follow FinPilot's forest/lime theme.
 * Load this module lazily: it pulls in three.js and needs WebGL.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

export type RobotMood = "idle" | "thinking";

/** Pointer position relative to the avatar, roughly -1..1 on each axis. */
export type PointerRef = RefObject<{ x: number; y: number }>;

class HeartCurve extends THREE.Curve<THREE.Vector3> {
  constructor() {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    t *= Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);
    return target.set(x * 0.002, (y + 6) * 0.002, 0);
  }
}
const heartCurve = new HeartCurve();

const SCREEN = "#c4f03b";
const CHASSIS = "#e6ece2";

const earBaseMat = new THREE.MeshStandardMaterial({ color: "#eef2ea", roughness: 0.5 });
const earRingMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.3 });
const earCenterMat = new THREE.MeshStandardMaterial({ color: "#c8d2c0", roughness: 0.8 });
const antennaBaseMat = new THREE.MeshStandardMaterial({ color: "#7d8a80", roughness: 0.4, metalness: 0.5 });
const antennaStickMat = new THREE.MeshStandardMaterial({ color: "#c9d1c4", roughness: 0.4, metalness: 0.2 });
const antennaTipMat = new THREE.MeshStandardMaterial({ color: SCREEN, emissive: SCREEN, emissiveIntensity: 0.6, roughness: 0.2, toneMapped: false });
const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 2, 2), toneMapped: false, transparent: true });
const heartMat = new THREE.MeshBasicMaterial({ color: "#ff3366", toneMapped: false });

function GlassScreen({ moodRef }: { moodRef: RefObject<RobotMood> }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      color: { value: new THREE.Color(SCREEN) },
      power: { value: 3.8 },
      intensity: { value: 1.2 },
    }),
    [],
  );
  useFrame(({ clock }) => {
    if (!material.current) return;
    const thinking = moodRef.current === "thinking";
    material.current.uniforms.intensity.value = thinking
      ? 1.3 + Math.sin(clock.getElapsedTime() * 6) * 0.6
      : 1.2;
    antennaTipMat.emissiveIntensity = thinking
      ? 1.2 + Math.sin(clock.getElapsedTime() * 6) * 0.8
      : 0.6;
  });
  return (
    <mesh>
      <sphereGeometry args={[0.3, 64, 64, 0, Math.PI * 2, 0, Math.PI]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * mvPosition;
          }`}
        fragmentShader={`
          uniform vec3 color;
          uniform float power;
          uniform float intensity;
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          void main() {
            float fresnel = pow(1.0 - max(dot(normalize(vViewPosition), normalize(vNormal)), 0.0), power);
            gl_FragColor = vec4(color, fresnel * intensity);
          }`}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function RobotEar({ position, isLeft = false }: { position: [number, number, number]; isLeft?: boolean }) {
  const dir = isLeft ? -1 : 1;
  return (
    <group position={position} scale={1.3}>
      <mesh rotation={[0, 0, Math.PI / 2]} material={earBaseMat}>
        <cylinderGeometry args={[0.04, 0.04, 0.025, 32]} />
      </mesh>
      <mesh position={[dir * 0.012, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={earRingMat}>
        <torusGeometry args={[0.032, 0.008, 16, 32]} />
      </mesh>
      <mesh position={[dir * 0.012, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={earCenterMat}>
        <cylinderGeometry args={[0.03, 0.03, 0.005, 32]} />
      </mesh>
      <group position={[dir * 0.015, 0.035, 0]} rotation={[-0.4, 0, 0]}>
        <mesh position={[0, 0.01, 0]} material={antennaBaseMat}>
          <cylinderGeometry args={[0.006, 0.008, 0.02, 16]} />
        </mesh>
        <mesh position={[0, 0.06, 0]} material={antennaStickMat}>
          <cylinderGeometry args={[0.003, 0.003, 0.1, 8]} />
        </mesh>
        <mesh position={[0, 0.11, 0]} material={antennaTipMat}>
          <sphereGeometry args={[0.007, 16, 16]} />
        </mesh>
      </group>
    </group>
  );
}

function eyePaths() {
  const w = 0.025, h = 0.035, r = 0.02, g = 0.005;
  const half = (s: 1 | -1) => {
    const p = new THREE.CurvePath<THREE.Vector3>();
    const v = (x: number, y: number) => new THREE.Vector3(x, s * y, 0);
    p.add(new THREE.LineCurve3(v(-w, g), v(-w, h - r)));
    p.add(new THREE.QuadraticBezierCurve3(v(-w, h - r), v(-w, h), v(-w + r, h)));
    p.add(new THREE.LineCurve3(v(-w + r, h), v(w - r, h)));
    p.add(new THREE.QuadraticBezierCurve3(v(w - r, h), v(w, h), v(w, h - r)));
    p.add(new THREE.LineCurve3(v(w, h - r), v(w, g)));
    return p;
  };
  return { top: half(1), bottom: half(-1) };
}

function RobotEye({
  position,
  rotation,
  lovedRef,
  animate,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  lovedRef: RefObject<boolean>;
  animate: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const normal = useRef<THREE.Group>(null);
  const heart = useRef<THREE.Mesh>(null);
  const paths = useMemo(() => eyePaths(), []);
  const scale = 1.1, blinkCycle = 3.2, blinkDuration = 0.4;
  useFrame(({ clock }) => {
    if (!group.current || !normal.current || !heart.current) return;
    const loved = lovedRef.current;
    normal.current.visible = !loved;
    heart.current.visible = loved;
    let y = 1;
    const cycle = clock.getElapsedTime() % blinkCycle;
    if (animate && !loved && cycle < blinkDuration)
      y = Math.max(0.05, 1 - Math.sin((cycle / blinkDuration) * Math.PI));
    group.current.scale.set(scale, scale * y, scale);
  });
  return (
    <group ref={group} position={position} rotation={rotation} scale={scale}>
      <mesh ref={heart} visible={false} material={heartMat}>
        <tubeGeometry args={[heartCurve, 64, 0.0035, 8, true]} />
      </mesh>
      <group ref={normal}>
        <mesh material={eyeMat}>
          <tubeGeometry args={[paths.top, 20, 0.0035, 8, false]} />
        </mesh>
        <mesh material={eyeMat}>
          <tubeGeometry args={[paths.bottom, 20, 0.0035, 8, false]} />
        </mesh>
      </group>
    </group>
  );
}

function speckleTextures() {
  const size = 512;
  const make = () => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return c;
  };
  const colour = make(), bump = make();
  const cc = colour.getContext("2d"), cb = bump.getContext("2d");
  if (cc && cb) {
    cc.fillStyle = "#e3e8df";
    cc.fillRect(0, 0, size, size);
    cb.fillStyle = "#808080";
    cb.fillRect(0, 0, size, size);
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * size, y = Math.random() * size;
      const r = 0.5 + Math.random() * 1.5;
      const dark = Math.random() > 0.15;
      cc.beginPath();
      cc.arc(x, y, r, 0, Math.PI * 2);
      cc.fillStyle = dark ? "#33463a" : "#f2f5ef";
      cc.fill();
      cb.beginPath();
      cb.arc(x, y, r, 0, Math.PI * 2);
      cb.fillStyle = dark ? "#000" : "#fff";
      cb.fill();
    }
  }
  const map = new THREE.CanvasTexture(colour);
  const bumpMap = new THREE.CanvasTexture(bump);
  for (const t of [map, bumpMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 3);
  }
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, bumpMap };
}

const neck = [
  [0.1, -0.05], [0.215, -0.05], [0.28, 0.02], [0.295, 0.045], [0.27, 0.055], [0.1, 0.055], [0.1, 0.055],
].map(([r, h]) => new THREE.Vector2(r, h));

function Robot({
  pointer,
  moodRef,
  animate,
}: {
  pointer: PointerRef;
  moodRef: RefObject<RobotMood>;
  animate: boolean;
}) {
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const lovedRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [textures] = useState(speckleTextures);
  useEffect(
    () => () => {
      textures.map.dispose();
      textures.bumpMap.dispose();
      if (timer.current) clearTimeout(timer.current);
    },
    [textures],
  );
  const headMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#0c1a12", roughness: 0.9 }),
    [],
  );

  useFrame(({ clock }, delta) => {
    if (!body.current || !head.current) return;
    const dt = Math.min(delta, 0.1);
    const { x, y } = pointer.current ?? { x: 0, y: 0 };
    const thinking = moodRef.current === "thinking";
    const t = clock.getElapsedTime();
    const lerp = THREE.MathUtils.lerp;
    body.current.rotation.y = lerp(body.current.rotation.y, -x * 0.35, 6 * dt);
    body.current.rotation.x = lerp(body.current.rotation.x, -y * 0.12, 6 * dt);
    body.current.rotation.z = lerp(body.current.rotation.z, -x * 0.06, 6 * dt);
    body.current.position.y = -0.3 + (animate ? Math.sin(t * 1.6) * 0.012 : 0);
    const tilt = thinking && animate ? Math.sin(t * 2.4) * 0.18 : 0;
    head.current.rotation.y = lerp(head.current.rotation.y, x * 0.9, 12 * dt);
    head.current.rotation.x = lerp(head.current.rotation.x, -y * 0.3, 12 * dt);
    head.current.rotation.z = lerp(head.current.rotation.z, tilt, 6 * dt);
  });

  const chassis = (
    <meshStandardMaterial
      color={CHASSIS}
      map={textures.map}
      bumpMap={textures.bumpMap}
      bumpScale={0.005}
      roughness={1}
    />
  );

  return (
    <group
      ref={body}
      position={[0, -0.3, 0]}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation();
        lovedRef.current = true;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => (lovedRef.current = false), 2000);
      }}
    >
      <mesh>
        <sphereGeometry args={[0.43, 64, 64, 0, Math.PI * 2, Math.PI * 0.15, Math.PI * 0.85]} />
        {chassis}
      </mesh>
      <mesh position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.235, 0.025, 32, 64]} />
        {chassis}
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <latheGeometry args={[neck, 64]} />
        {chassis}
      </mesh>
      <group ref={head} position={[0, 0.6, 0]}>
        <mesh material={headMat}>
          <sphereGeometry args={[0.28, 64, 64, 0, Math.PI * 2, 0, Math.PI]} />
        </mesh>
        <GlassScreen moodRef={moodRef} />
        <group position={[0, -0.02, 0.29]}>
          <RobotEye position={[-0.07, 0, 0]} rotation={[0, -0.2, 0]} lovedRef={lovedRef} animate={animate} />
          <RobotEye position={[0.07, 0, 0]} rotation={[0, 0.2, 0]} lovedRef={lovedRef} animate={animate} />
        </group>
        <RobotEar position={[-0.29, 0, 0]} isLeft />
        <RobotEar position={[0.29, 0, 0]} />
      </group>
    </group>
  );
}

function MoodSync({ mood, moodRef }: { mood: RobotMood; moodRef: RefObject<RobotMood> }) {
  useEffect(() => {
    moodRef.current = mood;
  }, [mood, moodRef]);
  return null;
}

/** Decorative WebGL scene. The caller supplies the accessible text equivalent. */
export default function RobotAvatar({
  pointer,
  mood,
  animate,
}: {
  pointer: PointerRef;
  mood: RobotMood;
  animate: boolean;
}) {
  const moodRef = useRef<RobotMood>(mood);
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={animate ? "always" : "demand"}
      camera={{ position: [0, 0.06, 2.85], fov: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
    >
      <MoodSync mood={mood} moodRef={moodRef} />
      <hemisphereLight args={["#ffffff", "#17552f", 1.1]} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.6} />
      <directionalLight position={[-3, 1, -2]} intensity={0.6} color={SCREEN} />
      <Robot pointer={pointer} moodRef={moodRef} animate={animate} />
    </Canvas>
  );
}
