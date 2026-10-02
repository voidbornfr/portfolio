"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { PROJECTS, ProjectItem } from "@/data/projects";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/* ────────────────────────────────────────────────────────────────────────────
   THE VOID ATLAS — vertical expedition chart.
   · start at the top, end at the finale at the bottom
   · a 3D stained-glass butterfly follows the cursor
   · the trail only glows where the butterfly has actually flown
   · hovering a marker opens a mini preview window
   Palette strictly: black / white / pale & ash grays.
   ──────────────────────────────────────────────────────────────────────────── */

const MAP_W = 1000;
const MAP_H = 2800;

const BUTTERFLY_URL = "/models/stained_glass_butterfly.glb";
/** rotation that aligns the model's head with its travel direction */
const HEAD_OFFSET = Math.PI / 2;

const REVEAL_RADIUS = 100; // px — butterfly lights the trail within this radius
const PROXIMITY_RADIUS = 115; // px — cursor "reaches" a treasure

type Side = "left" | "right" | "top" | "bottom";

/** Marker coordinates in map space (viewBox 1000×2800). */
const MARKERS: Record<string, { x: number; y: number; side: Side }> = {
  voidverse: { x: 330, y: 340, side: "left" },
  "voidanime-desktop": { x: 670, y: 580, side: "right" },
  voidloop: { x: 350, y: 830, side: "left" },
  voidcrafts: { x: 650, y: 1060, side: "right" },
  "void-files": { x: 320, y: 1310, side: "left" },
  voiddrops: { x: 660, y: 1540, side: "right" },
  "voidx-web": { x: 360, y: 1790, side: "left" },
  "voidverse-api": { x: 640, y: 2020, side: "right" },
  github: { x: 340, y: 2270, side: "left" },
  youtube: { x: 500, y: 2560, side: "right" },
};

const START = { x: 500, y: 110 };

/** The expedition route: origin at the top → every treasure → finale. */
const ROUTE: { x: number; y: number }[] = [
  START,
  ...PROJECTS.map((p) => ({ x: MARKERS[p.id].x, y: MARKERS[p.id].y })),
];

/** Catmull-Rom → cubic bezier, so the trail meanders like a hand-drawn map. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  const t = 0.82;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + ((p2.x - p0.x) / 6) * t;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * t;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * t;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * t;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x} ${p2.y}`;
  }
  return d;
}

const ROUTE_D = smoothPath(ROUTE);

/** Anchor style for labels / cards around a marker. */
function anchor(side: Side, gap: number): React.CSSProperties {
  switch (side) {
    case "top":
      return { left: "50%", bottom: `calc(100% + ${gap}px)`, transform: "translateX(-50%)" };
    case "bottom":
      return { left: "50%", top: `calc(100% + ${gap}px)`, transform: "translateX(-50%)" };
    case "left":
      return { top: "50%", right: `calc(100% + ${gap}px)`, transform: "translateY(-50%)" };
    case "right":
      return { top: "50%", left: `calc(100% + ${gap}px)`, transform: "translateY(-50%)" };
  }
}

const LABEL_SHADOW = {
  textShadow: "0 0 14px rgba(0,0,0,0.95), 0 1px 3px rgba(0,0,0,0.9)",
};

/* ─── Butterfly (3D, follows the cursor) ───────────────────────────────────── */

type WingPivot = { pivot: THREE.Object3D; sign: number; lag: number };
type PreparedButterfly = { wrapper: THREE.Group; pivots: WingPivot[] };

function makeGlowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.85)");
  g.addColorStop(0.35, "rgba(255,255,255,0.28)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSparkleTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const cx = 32;
  const cy = 32;

  // Soft ambient radial glow — pure crystalline white
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 32);
  g.addColorStop(0, "rgba(255, 255, 255, 1)");
  g.addColorStop(0.2, "rgba(255, 255, 255, 0.75)");
  g.addColorStop(0.55, "rgba(255, 255, 255, 0.22)");
  g.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);

  // 4-point star flare — pure white
  ctx.save();
  ctx.translate(cx, cy);
  for (let rot = 0; rot < 2; rot++) {
    ctx.rotate((rot * Math.PI) / 2);
    const flare = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
    flare.addColorStop(0, "rgba(255, 255, 255, 1)");
    flare.addColorStop(0.25, "rgba(255, 255, 255, 0.8)");
    flare.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = flare;
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Diamond diagonal sub-flare — pure white
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  const subFlare = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
  subFlare.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  subFlare.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = subFlare;
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, 2, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Convert a textured material to monochrome white-glass (keeps alpha/UVs). */
function whitenMaterial(src: THREE.Material): THREE.Material {
  const tagged = src as THREE.Material & { __voidWhite?: THREE.Material };
  if (tagged.__voidWhite) return tagged.__voidWhite;
  const m = src.clone();
  const anyM = m as THREE.MeshStandardMaterial;
  const map = (m as THREE.MeshStandardMaterial).map;
  if (map && map.image) {
    try {
      const img = map.image as CanvasImageSource & { width?: number; height?: number };
      const w = img.width || 512;
      const h = img.height || 512;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.filter = "grayscale(1) contrast(1.08) brightness(1.14)";
      ctx.drawImage(img, 0, 0, w, h);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = map.colorSpace;
      tex.flipY = map.flipY; // glTF UVs need flipY = false
      tex.wrapS = map.wrapS;
      tex.wrapT = map.wrapT;
      tex.needsUpdate = true;
      anyM.map = tex;
      anyM.emissiveMap = tex;
    } catch {
      /* keep original map if canvas conversion fails */
    }
  }
  anyM.color = new THREE.Color(0xffffff);
  anyM.emissive = new THREE.Color(0xffffff);
  anyM.emissiveIntensity = 0.32;
  anyM.roughness = Math.min(1, (anyM.roughness ?? 0.6) * 0.75);
  anyM.metalness = Math.min(1, (anyM.metalness ?? 0) + 0.1);
  m.side = THREE.DoubleSide;
  m.needsUpdate = true;
  tagged.__voidWhite = m;
  return m;
}

function prepareButterfly(scene: THREE.Object3D): PreparedButterfly {
  const cache = scene as THREE.Object3D & { __voidButterfly?: PreparedButterfly };
  if (cache.__voidButterfly) return cache.__voidButterfly;

  const root = scene.clone(true);
  const pivots: WingPivot[] = [];
  const nodes: THREE.Object3D[] = [];
  root.traverse((o) => nodes.push(o));

  for (const o of nodes) {
    const mesh = o as THREE.Mesh;
    if ((mesh as unknown as { isMesh?: boolean }).isMesh && mesh.material) {
      const mat = mesh.material;
      mesh.material = Array.isArray(mat)
        ? (mat.map(whitenMaterial) as unknown as THREE.Material)
        : whitenMaterial(mat);
    }
    // The four wing planes are hinged along the body axis (RootNode Z).
    if (/^Plane\.00[4567]$/.test(o.name) && o.parent) {
      const sign = o.position.x >= 0 ? 1 : -1;
      const lag = o.name === "Plane.005" || o.name === "Plane.007" ? 0.4 : 0;
      const pivot = new THREE.Object3D();
      pivot.position.copy(o.position);
      o.parent.add(pivot);
      pivot.add(o);
      o.position.set(0, 0, 0);
      pivots.push({ pivot, sign, lag });
    }
  }

  // dorsal ¾ view: body runs vertically on screen, wings spread horizontally,
  // tilted slightly toward the camera so the flap reads on a flat screen.
  root.rotation.x = -Math.PI / 2 + 0.5;
  root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const s = 140 / Math.max(size.x, 0.0001); // ~140px wingspan
  root.scale.setScalar(s);
  root.position.set(-center.x * s, -center.y * s, -center.z * s);

  const wrapper = new THREE.Group();
  wrapper.add(root);

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowTexture(),
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  glow.scale.set(320, 320, 1);
  glow.position.z = -50;
  wrapper.add(glow);

  // shared asset — never let r3f dispose it on unmount
  wrapper.traverse((o) => {
    (o as unknown as { dispose?: unknown }).dispose = null;
  });

  const prepared = { wrapper, pivots };
  cache.__voidButterfly = prepared;
  return prepared;
}

function lerpAngle(a: number, b: number, t: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

type MouseState = { x: number; y: number; active: boolean; lastX: number; lastY: number };

const PARTICLE_COUNT = 80;

function Butterfly({
  mouseRef,
  posRef,
}: {
  mouseRef: React.RefObject<MouseState>;
  posRef: React.RefObject<{ x: number; y: number }>;
}) {
  const gltf = useGLTF(BUTTERFLY_URL);
  const data = useMemo(() => prepareButterfly(gltf.scene), [gltf]);
  const groupRef = useRef<THREE.Group>(null);
  const { camera, size } = useThree();
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const cur = useRef(new THREE.Vector2(0, 0));
  const prev = useRef(new THREE.Vector2(0, 0));
  const yaw = useRef(-Math.PI / 2);

  const sparkleMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: makeSparkleTexture() },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3 aColor;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vAlpha = aAlpha;
          vColor = aColor;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (1200.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vec4 tex = texture2D(uTexture, gl_PointCoord);
          gl_FragColor = vec4(vColor * tex.rgb, tex.a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  const { geom, particles, posAttr, colAttr, sizeAttr, alphaAttr } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const col = new Float32Array(PARTICLE_COUNT * 3);
    const sz = new Float32Array(PARTICLE_COUNT);
    const alp = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3] = -9999;
      pos[i * 3 + 1] = -9999;
      pos[i * 3 + 2] = -9999;
      col[i * 3] = 1;
      col[i * 3 + 1] = 1;
      col[i * 3 + 2] = 1;
      sz[i] = 0;
      alp[i] = 0;
    }

    const pAttr = new THREE.BufferAttribute(pos, 3);
    const cAttr = new THREE.BufferAttribute(col, 3);
    const sAttr = new THREE.BufferAttribute(sz, 1);
    const aAttr = new THREE.BufferAttribute(alp, 1);

    g.setAttribute("position", pAttr);
    g.setAttribute("aColor", cAttr);
    g.setAttribute("aSize", sAttr);
    g.setAttribute("aAlpha", aAttr);

    const parts = Array.from({ length: PARTICLE_COUNT }, () => ({
      alive: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 0,
      maxAge: 1,
      baseSize: 24,
      twinkleSpeed: 8,
      twinklePhase: 0,
      r: 1,
      g: 1,
      b: 1,
    }));

    return { geom: g, particles: parts, posAttr: pAttr, colAttr: cAttr, sizeAttr: sAttr, alphaAttr: aAttr };
  }, []);

  // keep 1 world unit = 1 screen px on the z=0 plane
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = 40;
    cam.position.set(0, 0, size.height / (2 * Math.tan(THREE.MathUtils.degToRad(40) / 2)));
    cam.updateProjectionMatrix();
  }, [camera, size.height, size.width]);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const dt = Math.min(delta || 0.016, 0.1);
    const m = mouseRef.current;

    let tx: number;
    let ty: number;
    if (m.active) {
      ndc.set((m.x / size.width) * 2 - 1, -(m.y / size.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (ray.ray.intersectPlane(plane, hit)) {
        tx = hit.x;
        ty = hit.y;
      } else {
        tx = cur.current.x;
        ty = cur.current.y;
      }
      m.lastX = m.x;
      m.lastY = m.y;
    } else {
      // gentle idle hover around the last known cursor position
      const t = state.clock.elapsedTime;
      const baseX = m.lastX - size.width / 2;
      const baseY = size.height / 2 - m.lastY;
      tx = baseX + Math.sin(t * 0.7) * 55;
      ty = baseY + Math.cos(t * 0.95) * 38;
    }

    cur.current.x += (tx - cur.current.x) * Math.min(1, dt * 5);
    cur.current.y += (ty - cur.current.y) * Math.min(1, dt * 5);

    const vx = cur.current.x - prev.current.x;
    const vy = cur.current.y - prev.current.y;
    prev.current.set(cur.current.x, cur.current.y);
    const speed = Math.hypot(vx, vy) / dt; // world px / s

    if (speed > 40) {
      const target = Math.atan2(vy, vx) + HEAD_OFFSET;
      yaw.current = lerpAngle(yaw.current, target, Math.min(1, dt * 4));
    }

    const t = state.clock.elapsedTime;
    const butterflyY = cur.current.y + Math.sin(t * 2.3) * 7;
    g.position.set(cur.current.x, butterflyY, 0);
    g.rotation.z = yaw.current;

    // flap — faster and wider when flying
    const flapHz = 5.5 + Math.min(9, speed * 0.012);
    const amp = 0.5 + Math.min(0.22, speed * 0.00025);
    for (const p of data.pivots) {
      p.pivot.rotation.z = p.sign * Math.sin(t * flapHz - p.lag) * amp;
    }

    // report actual screen position (1:1 with world units on the z=0 plane)
    posRef.current.x = cur.current.x + size.width / 2;
    posRef.current.y = size.height / 2 - cur.current.y;

    // — Beautiful White Stardust / Sparkle Particle Animations —
    const PALETTES = [
      [1.0, 1.0, 1.0],      // pure celestial white
      [1.0, 1.0, 1.0],      // brilliant white
      [0.97, 0.98, 1.0],    // frost diamond white
      [0.98, 0.98, 0.98],   // silver pearl white
      [1.0, 1.0, 1.0],      // radiant white
    ];

    // Reduce spawn rate for fewer particles
    const spawnRate = speed > 35 ? (speed > 120 ? 2 : 1) : (Math.random() > 0.6 ? 1 : 0);
    const currentHeading = yaw.current - HEAD_OFFSET;
    const cosH = Math.cos(currentHeading);
    const sinH = Math.sin(currentHeading);
    const sideX = -sinH;
    const sideY = cosH;

    let pIdx = 0;
    for (let s = 0; s < spawnRate; s++) {
      while (pIdx < PARTICLE_COUNT && particles[pIdx].alive) pIdx++;
      if (pIdx >= PARTICLE_COUNT) break;

      const p = particles[pIdx];
      p.alive = true;
      p.age = 0;
      p.maxAge = 1.2 + Math.random() * 1.1;
      p.baseSize = 22 + Math.random() * 26;
      p.twinkleSpeed = 7 + Math.random() * 8;
      p.twinklePhase = Math.random() * Math.PI * 2;

      // Emission from wingtips (0, 1) and tail wake (2)
      const source = s % 3;
      let ox = 0;
      let oy = 0;
      const oz = (Math.random() - 0.5) * 10;
      if (source === 0) {
        ox = sideX * 36 + (Math.random() - 0.5) * 12;
        oy = sideY * 36 + (Math.random() - 0.5) * 12;
      } else if (source === 1) {
        ox = -sideX * 36 + (Math.random() - 0.5) * 12;
        oy = -sideY * 36 + (Math.random() - 0.5) * 12;
      } else {
        ox = -cosH * 34 + (Math.random() - 0.5) * 10;
        oy = -sinH * 34 + (Math.random() - 0.5) * 10;
      }

      p.x = cur.current.x + ox;
      p.y = butterflyY + oy;
      p.z = oz;

      const spread = 0.9;
      p.vx = -vx * 0.16 + (Math.random() - 0.5) * spread;
      p.vy = -vy * 0.16 + (Math.random() - 0.5) * spread + 0.18;
      p.vz = (Math.random() - 0.5) * 0.5;

      const pal = PALETTES[Math.floor(Math.random() * PALETTES.length)];
      p.r = pal[0];
      p.g = pal[1];
      p.b = pal[2];
      pIdx++;
    }

    const posArr = posAttr.array as Float32Array;
    const colArr = colAttr.array as Float32Array;
    const sizeArr = sizeAttr.array as Float32Array;
    const alphaArr = alphaAttr.array as Float32Array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particles[i];
      if (!p.alive) continue;

      p.age += dt;
      if (p.age >= p.maxAge) {
        p.alive = false;
        posArr[i * 3] = -9999;
        posArr[i * 3 + 1] = -9999;
        alphaArr[i] = 0;
        sizeArr[i] = 0;
        continue;
      }

      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.z += p.vz * dt * 60;
      p.vx *= 0.96;
      p.vy = p.vy * 0.96 - 0.04;

      const normAge = p.age / p.maxAge;
      const fadeIn = Math.min(1.0, normAge * 5.0);
      const fadeOut = Math.max(0.0, 1.0 - Math.pow(normAge, 1.6));
      const shimmer = 0.72 + 0.28 * Math.sin(p.age * p.twinkleSpeed + p.twinklePhase);
      const a = fadeIn * fadeOut * shimmer * 0.95;
      const s = p.baseSize * (0.85 + 0.3 * shimmer) * (1.0 - normAge * 0.25);

      posArr[i * 3] = p.x;
      posArr[i * 3 + 1] = p.y;
      posArr[i * 3 + 2] = p.z;

      colArr[i * 3] = p.r;
      colArr[i * 3 + 1] = p.g;
      colArr[i * 3 + 2] = p.b;

      sizeArr[i] = s;
      alphaArr[i] = a;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
  });

  return (
    <>
      <group ref={groupRef}>
        <primitive object={data.wrapper} dispose={null} />
      </group>
      <points geometry={geom} material={sparkleMat} />
    </>
  );
}

function ButterflyOverlay({
  mouseRef,
  posRef,
}: {
  mouseRef: React.RefObject<MouseState>;
  posRef: React.RefObject<{ x: number; y: number }>;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 40, position: [0, 0, 1200], near: 1, far: 6000 }}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 40,
      }}
    >
      <ambientLight intensity={1.3} />
      <directionalLight position={[300, 500, 700]} intensity={1.9} />
      <directionalLight position={[-400, -250, 500]} intensity={0.55} />
      <React.Suspense fallback={null}>
        <Butterfly mouseRef={mouseRef} posRef={posRef} />
      </React.Suspense>
    </Canvas>
  );
}

/* ─── Gallery lightbox ─────────────────────────────────────────────────────── */
function Lightbox({
  project,
  startIndex,
  onClose,
}: {
  project: ProjectItem;
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const total = project.images.length;

  const prev = () => setIdx((i) => (i - 1 + total) % total);
  const next = () => setIdx((i) => (i + 1) % total);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  });

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={project.title}
    >
      <div
        className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 mb-1">{project.badge}</p>
          <h3 className="text-xl font-light text-white">{project.title}</h3>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={project.link}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 text-xs font-mono text-zinc-300 hover:text-white hover:bg-white/10 transition-all"
          >
            {project.linkText} <span>↗</span>
          </a>
          <button
            onClick={onClose}
            aria-label="Close gallery"
            className="w-10 h-10 rounded-full border border-white/15 bg-white/5 text-zinc-300 hover:text-white hover:bg-white/15 flex items-center justify-center transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center min-h-0 px-6 sm:px-16" onClick={(e) => e.stopPropagation()}>
        {total > 1 && (
          <button
            onClick={prev}
            aria-label="Previous image"
            className="absolute left-4 z-10 w-12 h-12 rounded-full bg-black/70 hover:bg-black border border-white/20 text-white flex items-center justify-center hover:scale-110 transition-all shadow-xl"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}
        <div className="relative w-full h-full max-h-[70vh]">
          <Image src={encodeURI(project.images[idx])} alt={project.title} fill unoptimized className="object-contain drop-shadow-2xl" />
        </div>
        {total > 1 && (
          <button
            onClick={next}
            aria-label="Next image"
            className="absolute right-4 z-10 w-12 h-12 rounded-full bg-black/70 hover:bg-black border border-white/20 text-white flex items-center justify-center hover:scale-110 transition-all shadow-xl"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        )}
      </div>

      <div className="flex-shrink-0 px-6 pb-5 pt-3 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-zinc-400 line-clamp-1 font-light">{project.tagline}</p>
          <span className="text-[10px] font-mono text-zinc-500 ml-4 flex-shrink-0">{idx + 1} / {total}</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {project.images.map((img, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Image ${i + 1}`}
              className={`relative flex-shrink-0 h-12 w-[72px] rounded-lg overflow-hidden border transition-all duration-200 ${i === idx ? "border-white ring-2 ring-white/40 scale-105" : "border-white/10 opacity-40 hover:opacity-80"}`}
            >
              <Image src={encodeURI(img)} alt="" fill unoptimized className="object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ─── Treasure marker ──────────────────────────────────────────────────────── */
type Pt = { x: number; y: number };
const SAMPLE_COUNT = 220;

function Marker({
  project,
  index,
  visible,
  lit,
  near,
  hovered,
  mapW,
  onHover,
  onOpen,
}: {
  project: ProjectItem;
  index: number;
  visible: boolean;
  lit: boolean;
  near: boolean;
  hovered: boolean;
  mapW: number;
  onHover: (id: string | null) => void;
  onOpen: () => void;
}) {
  const m = MARKERS[project.id];
  const [slide, setSlide] = useState(0);
  const total = project.images.length;
  const showExpanded = hovered;
  const showCompact = near && !hovered;

  const sideLen =
    (m ? (m.side === "left" ? m.x / MAP_W : m.side === "right" ? (MAP_W - m.x) / MAP_W : 1) : 1) * mapW;
  const isMobile = mapW < 800; // Increased breakpoint for mobile view
  
  // Mobile: Center horizontally relative to the map container.
  const markerX = (m.x / MAP_W) * mapW;
  const offsetToCenter = (mapW / 2) - markerX;
  
  const expandedW = isMobile ? Math.min(340, mapW - 32) : Math.round(Math.max(200, Math.min(320, sideLen - 44)));
  const compactW = isMobile ? Math.min(300, mapW - 32) : Math.round(Math.max(180, Math.min(240, sideLen - 44)));

  // We explicitly subtract half the width to avoid relying on `transform: translateX(-50%)`,
  // which can be overridden by Tailwind's scaling transition utilities.
  const cardStyle: React.CSSProperties = isMobile 
    ? { position: "absolute", top: "calc(100% + 16px)", left: `calc(50% + ${offsetToCenter}px - ${compactW / 2}px)` }
    : anchor(m.side, 16);
    
  const expandedStyle: React.CSSProperties = isMobile 
    ? { position: "absolute", top: "calc(100% + 16px)", left: `calc(50% + ${offsetToCenter}px - ${expandedW / 2}px)` }
    : anchor(m.side, 18);

  useEffect(() => {
    if (!showExpanded || total <= 1) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % total), 2600);
    return () => clearInterval(id);
  }, [showExpanded, total]);

  if (!m) return null;
  const finale = project.id === "youtube";
  const alignRight = m.side === "left";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      onMouseEnter={() => onHover(project.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(project.id)}
      onBlur={() => onHover(null)}
      aria-label={`Open ${project.title}`}
      className={`group absolute w-6 h-6 rounded-full -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-4 focus-visible:ring-offset-black cursor-pointer ${
        near || hovered ? "z-50" : "z-20"
      }`}
      style={{ left: `${(m.x / MAP_W) * 100}%`, top: `${(m.y / MAP_H) * 100}%` }}
    >
      <span
        className={`relative block w-full h-full ${visible ? "map-pop" : "opacity-0"}`}
        style={{ animationDelay: `${300 + index * 110}ms` }}
      >
        {/* ambient glow */}
        <span className="absolute inset-[-7px] rounded-full bg-white/10 blur-[7px] transition-all duration-300 group-hover:bg-white/25 group-hover:blur-[10px]" />
        {/* pulsing halo */}
        <span className="map-halo absolute inset-0 rounded-full border border-white/55" />
        {finale && (
          <span className="map-halo absolute inset-0 rounded-full border border-white/35" style={{ animationDelay: "1.4s" }} />
        )}
        {/* core — brighter once the trail has reached it */}
        <span
          className={`absolute inset-[5px] rounded-full bg-white transition-all duration-500 group-hover:scale-125 ${
            lit
              ? "shadow-[0_0_26px_7px_rgba(255,255,255,0.7)]"
              : finale
                ? "shadow-[0_0_22px_6px_rgba(255,255,255,0.6)]"
                : "shadow-[0_0_14px_3px_rgba(255,255,255,0.5)]"
          }`}
        />
        {lit && (
          <span className="absolute inset-[-4px] rounded-full border border-white/40" />
        )}

        {/* resting label */}
        <span
          className={`pointer-events-none absolute whitespace-nowrap transition-opacity duration-200 ${
            showExpanded || showCompact ? "opacity-0" : "opacity-100"
          } ${alignRight ? "text-right" : m.side === "right" ? "text-left" : "text-center"}`}
          style={{ ...anchor(m.side, 16), ...LABEL_SHADOW }}
        >
          <span className="block font-mono text-[10px] md:text-xs tracking-[0.22em] text-zinc-500 group-hover:text-zinc-400">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="block text-[13px] md:text-base font-medium tracking-wide text-zinc-200 group-hover:text-white uppercase">
            {project.title}
          </span>
        </span>

        {/* proximity card — cursor reached this point */}
        <span
          className={`absolute z-30 transition-all duration-300 ${
            showCompact ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
          }`}
          style={{ ...cardStyle, width: compactW }}
        >
          <span className="block rounded-2xl border border-white/15 bg-black/85 backdrop-blur-xl p-3 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.95)]">
            <span className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-mono text-[9px] tracking-[0.2em] text-white">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-zinc-500 truncate">
                {project.category}
              </span>
            </span>
            <span className="block text-sm font-medium text-white leading-tight">{project.title}</span>
            <span className="block mt-1 text-[11px] leading-snug text-zinc-400 line-clamp-2">{project.tagline}</span>
            <span className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/10 font-mono text-[8px] uppercase tracking-[0.2em]">
              <span className="text-zinc-500">Hover for preview</span>
              <a
                href={project.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-white hover:text-cyan-300 font-semibold transition-colors flex items-center gap-0.5 cursor-pointer"
              >
                Open ↗
              </a>
            </span>
          </span>
        </span>

        {/* expanded preview window — opens on hover */}
        <span
          className={`absolute z-40 transition-all duration-300 ${
            showExpanded ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
          }`}
          style={{ ...expandedStyle, width: expandedW }}
        >
          <span className="block rounded-2xl border border-white/20 bg-black/90 backdrop-blur-xl overflow-hidden shadow-[0_28px_80px_-18px_rgba(0,0,0,0.95)]">
            {/* slideshow */}
            <span
              className="relative block h-[124px] w-full overflow-hidden bg-[#0a0a0b] cursor-pointer group/img"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              title="Click to view full gallery"
            >
              <Image
                key={slide}
                src={encodeURI(project.images[slide % total])}
                alt={project.title}
                fill
                unoptimized
                className="object-cover object-top animate-fade-up transition-transform duration-500 group-hover/img:scale-105"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />
              <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 border border-white/15 font-mono text-[9px] tracking-widest text-zinc-300">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/70 border border-white/15 font-mono text-[9px] tracking-widest text-zinc-400 tabular-nums">
                {String((slide % total) + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
              </span>
              <span className="absolute bottom-2 left-3 right-3 text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-400 truncate">
                {project.badge}
              </span>
            </span>

            {/* body */}
            <span className="block p-3">
              <span className="flex items-center justify-between gap-2">
                <a
                  href={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="group/title flex items-center gap-1.5 min-w-0"
                >
                  <span className="text-[15px] font-medium text-white leading-tight truncate group-hover/title:underline">{project.title}</span>
                  <span className="font-mono text-[10px] tracking-widest text-zinc-400 group-hover/title:text-white flex-shrink-0">↗</span>
                </a>
                <span className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-zinc-400 flex-shrink-0">
                  {project.category}
                </span>
              </span>
              <span className="block mt-1 text-[11px] leading-snug text-zinc-400 line-clamp-2">{project.tagline}</span>

              {/* thumbnails */}
              {total > 1 && (
                <span className="flex gap-1.5 mt-2.5 overflow-hidden">
                  {project.images.slice(0, 6).map((img, i) => (
                    <span
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSlide(i);
                      }}
                      className={`relative block h-8 w-11 flex-shrink-0 rounded-md overflow-hidden border transition-all cursor-pointer ${
                        i === slide % total ? "border-white/80 ring-1 ring-white/40" : "border-white/10 opacity-50 hover:opacity-90"
                      }`}
                    >
                      <Image src={encodeURI(img)} alt="" fill unoptimized className="object-cover" />
                    </span>
                  ))}
                </span>
              )}

              <span className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/10 font-mono text-[9px] uppercase tracking-[0.18em]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen();
                  }}
                  className="text-zinc-500 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Gallery</span>
                  <span className="text-[8px] opacity-60">({total})</span>
                </button>
                <a
                  href={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-black font-semibold hover:bg-zinc-200 transition-all cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95"
                >
                  <span>Open</span>
                  <span className="text-[10px]">↗</span>
                </a>
              </span>
            </span>
          </span>
        </span>
      </span>
    </div>
  );
}

/* ─── The map ──────────────────────────────────────────────────────────────── */
export default function ProjectMap() {
  const sectionRef = useRef<HTMLElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [inSection, setInSection] = useState(false);
  const [open, setOpen] = useState<ProjectItem | null>(null);

  const mouseRef = useRef<MouseState>({ x: -9999, y: -9999, active: false, lastX: 0, lastY: 0 });
  const posRef = useRef({ x: -9999, y: -9999 });
  const progressRef = useRef(0);
  const visitedRef = useRef<Uint8Array | null>(null);

  const [frontierIndex, setFrontierIndex] = useState(0);
  const [samples, setSamples] = useState<Pt[]>([]);
  const [nearest, setNearest] = useState<Record<string, number>>({});
  const [runs, setRuns] = useState<number[][]>([]);
  const [lit, setLit] = useState<Set<string>>(new Set());
  const [nearId, setNearId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [mapW, setMapW] = useState(1000);

  const markerList = useMemo(() => PROJECTS.map((p) => ({ p, m: MARKERS[p.id] })), []);

  /* section visibility (mount canvas + entrance animations) */
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
        setInSection(e.isIntersecting);
      },
      { threshold: 0.02 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  /* cursor tracking (butterfly target + proximity) */
  useEffect(() => {
    mouseRef.current.lastX = window.innerWidth / 2;
    mouseRef.current.lastY = window.innerHeight * 0.4;
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.lastX = e.clientX;
      mouseRef.current.lastY = e.clientY;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    const el = sectionRef.current;
    const enter = () => (mouseRef.current.active = true);
    const leave = () => (mouseRef.current.active = false);
    el?.addEventListener("mouseenter", enter);
    el?.addEventListener("mouseleave", leave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      el?.removeEventListener("mouseenter", enter);
      el?.removeEventListener("mouseleave", leave);
    };
  }, []);

  /* track chart width so cards always fit between marker and edge */
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const measure = () => setMapW(el.getBoundingClientRect().width || 1000);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* sample the route once (map coordinates) */
  useEffect(() => {
    const build = () => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", ROUTE_D);
      const total = path.getTotalLength();
      const pts: Pt[] = [];
      for (let i = 0; i <= SAMPLE_COUNT; i++) {
        const p = path.getPointAtLength((i / SAMPLE_COUNT) * total);
        pts.push({ x: p.x, y: p.y });
      }
      const near: Record<string, number> = {};
      for (const [id, mk] of Object.entries(MARKERS)) {
        let bi = 0;
        let bd = Infinity;
        pts.forEach((p, i) => {
          const d = (p.x - mk.x) ** 2 + (p.y - mk.y) ** 2;
          if (d < bd) {
            bd = d;
            bi = i;
          }
        });
        near[id] = bi;
      }
      visitedRef.current = new Uint8Array(pts.length);
      visitedRef.current[0] = 1;
      progressRef.current = 0;
      setFrontierIndex(0);
      setSamples(pts);
      setNearest(near);
      setRuns([[0]]);
      setLit(new Set());
    };
    build();
    window.addEventListener("resize", build);
    return () => window.removeEventListener("resize", build);
  }, []);

  /* reveal + proximity loop — strictly sequential from start to end */
  useEffect(() => {
    if (!visible || samples.length === 0) return;
    let raf = 0;
    let dirty = false;
    let lastFlush = 0;
    let prevFlyX = NaN;
    let prevFlyY = NaN;

    const computeRuns = () => {
      const v = visitedRef.current;
      if (!v) return [];
      const out: number[][] = [];
      let cur: number[] | null = null;
      for (let i = 0; i < v.length; i++) {
        if (v[i]) {
          if (!cur) {
            cur = [];
            out.push(cur);
          }
          cur.push(i);
        } else cur = null;
      }
      return out;
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const el = mapRef.current;
      const v = visitedRef.current;
      if (!el || !v) return;
      const rect = el.getBoundingClientRect();
      const scale = rect.width / MAP_W;

      /* — paint the trail where the butterfly flew — SEQUENTIAL ONLY — */
      if (mouseRef.current.active && posRef.current.x > -9000) {
        const fx = posRef.current.x;
        const fy = posRef.current.y;
        const curFrontier = progressRef.current;

        // Lookahead window ahead of current frontier (cannot jump ahead across the map)
        const checkStart = Math.max(0, curFrontier - 2);
        const checkEnd = Math.min(samples.length - 1, curFrontier + 14);

        let advancedTo = curFrontier;

        for (let i = checkStart; i <= checkEnd; i++) {
          const sx = rect.left + samples[i].x * scale;
          const sy = rect.top + samples[i].y * scale;
          const d = Math.hypot(fx - sx, fy - sy);

          let reached = d < REVEAL_RADIUS;
          if (!reached && isFinite(prevFlyX)) {
            const ax = prevFlyX;
            const ay = prevFlyY;
            const bx = fx;
            const by = fy;
            const dx = bx - ax;
            const dy = by - ay;
            const len2 = dx * dx + dy * dy;
            if (len2 > 0) {
              let t = ((sx - ax) * dx + (sy - ay) * dy) / len2;
              t = Math.max(0, Math.min(1, t));
              const px = ax + t * dx;
              const py = ay + t * dy;
              if (Math.hypot(px - sx, py - sy) < REVEAL_RADIUS * 0.85) {
                reached = true;
              }
            }
          }

          if (reached && i > advancedTo) {
            advancedTo = i;
          }
        }

        // Allow initiating expedition easily when near Void Origin at the start
        if (curFrontier === 0) {
          const startSx = rect.left + START.x * scale;
          const startSy = rect.top + START.y * scale;
          if (Math.hypot(fx - startSx, fy - startSy) < REVEAL_RADIUS * 1.5) {
            advancedTo = Math.max(advancedTo, 2);
          }
        }

        if (advancedTo > curFrontier) {
          progressRef.current = advancedTo;
          for (let j = 0; j <= advancedTo; j++) {
            v[j] = 1;
          }
          dirty = true;
        }

        prevFlyX = fx;
        prevFlyY = fy;
      } else {
        prevFlyX = NaN;
        prevFlyY = NaN;
      }

      /* — proximity: cursor reaches a treasure — */
      if (mouseRef.current.active) {
        let bestId: string | null = null;
        let bd = PROXIMITY_RADIUS * PROXIMITY_RADIUS;
        for (const { p, m } of markerList) {
          const sx = rect.left + m.x * scale;
          const sy = rect.top + m.y * scale;
          const d2 = (mouseRef.current.x - sx) ** 2 + (mouseRef.current.y - sy) ** 2;
          if (d2 < bd) {
            bd = d2;
            bestId = p.id;
          }
        }
        setNearId(bestId);
      }

      /* — flush lit state: treasures only unlock sequentially — */
      const now = performance.now();
      const currentProg = progressRef.current;
      const ids = new Set<string>();
      for (const [id, idx] of Object.entries(nearest)) {
        if (currentProg >= idx) ids.add(id);
      }

      if ((dirty || ids.size !== lit.size) && now - lastFlush > 50) {
        lastFlush = now;
        if (dirty) {
          dirty = false;
          setRuns(computeRuns());
          setFrontierIndex(progressRef.current);
        }
        if (ids.size !== lit.size) {
          setLit(ids);
        }
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [visible, samples, nearest, markerList, lit.size]);

  const runPaths = useMemo(
    () =>
      runs
        .filter((r) => r.length > 1)
        .map((r) => r.map((idx, i) => `${i ? "L" : "M"} ${samples[idx].x} ${samples[idx].y}`).join(" ")),
    [runs, samples]
  );

  return (
    <section
      ref={sectionRef}
      id="ecosystem"
      className="relative bg-black text-white pt-24 pb-36 px-4 sm:px-6 md:px-10 lg:px-12 overflow-hidden"
    >
      {/* Atmospheric transition from the section above */}
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-black via-black/90 to-transparent pointer-events-none z-10" />
      {/* Expansive ambient haze spanning the full background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-full max-w-[1800px] h-[900px] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.035)_0%,rgba(39,39,42,0.08)_35%,transparent_70%)] blur-[140px] pointer-events-none" />

      {/* The cursor-following butterfly */}
      {inSection && <ButterflyOverlay mouseRef={mouseRef} posRef={posRef} />}

      <div
        className={`w-full max-w-[1680px] mx-auto transition-all duration-1000 ease-out ${
          visible ? "opacity-100" : "opacity-0 translate-y-10"
        }`}
      >
        {/* ── Section header ───────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 mb-12 pb-10 border-b border-white/[0.08]">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-300 font-mono">
                VOID ATLAS · {PROJECTS.length} TREASURES MARKED
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl lg:text-[56px] font-normal tracking-tight text-white leading-tight">
              Chart Your Course
            </h2>
            <p className="mt-4 text-sm md:text-base text-zinc-400 font-light leading-relaxed max-w-2xl">
              A hand-drawn expedition chart through the dark. Guide the butterfly with your cursor — wherever
              it flies, the trail ignites. Every marked point of light is a live treasure from the ecosystem.
            </p>
          </div>

          <div className="flex-shrink-0 flex items-center gap-3 pt-2">
            <a
              href="https://github.com/voidbornfr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-white/20 text-xs font-mono tracking-wide text-zinc-200 hover:text-black hover:bg-white hover:border-white transition-all duration-300"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
              Explore GitHub
            </a>
            <a
              href="https://youtube.com/@voidbornfr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-white/10 bg-white/[0.03] text-xs font-mono tracking-wide text-zinc-300 hover:text-black hover:bg-white hover:border-white transition-all duration-300"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
              YouTube
            </a>
          </div>
        </div>

        {/* ── Legend ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-x-7 gap-y-3 mb-6 text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_2px_rgba(255,255,255,0.55)]" />
            Treasure · live project
          </span>
          <span className="flex items-center gap-2">
            <span
              className="w-9 h-[2px] opacity-80"
              style={{ backgroundImage: "repeating-linear-gradient(90deg, #fff 0 5px, transparent 5px 12px)" }}
            />
            Sequential Trail · Follow from Origin
          </span>
          <span className="flex items-center gap-2">
            <span className="text-zinc-300 text-xs leading-none">✕</span>
            Uncharted territory
          </span>
          <span className="flex items-center gap-2">
            <span className="text-zinc-300 text-xs leading-none">◇</span> Origin · Start here
          </span>
          <div className="ml-auto flex items-center gap-4">
            <span className="text-zinc-400 font-mono text-[9px] tracking-widest hidden sm:inline">
              EXPEDITION: {lit.size} / {PROJECTS.length} DISCOVERED
            </span>
            {lit.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (!visitedRef.current) return;
                  visitedRef.current.fill(0);
                  visitedRef.current[0] = 1;
                  progressRef.current = 0;
                  setFrontierIndex(0);
                  setRuns([[0]]);
                  setLit(new Set());
                }}
                className="text-[9px] font-mono uppercase tracking-widest text-zinc-500 hover:text-white transition-colors underline cursor-pointer"
              >
                Reset Route ↺
              </button>
            )}
          </div>
        </div>

        {/* ── The map ──────────────────────────────────────────────── */}
        <div className="w-full pb-2">
          <div
            ref={mapRef}
            className="map-noselect relative mx-auto w-full max-w-[1000px] aspect-[1/2] sm:aspect-[5/14] rounded-[20px] md:rounded-[28px] border border-white/[0.08] bg-[#050506] overflow-hidden shadow-[0_0_120px_rgba(255,255,255,0.025)]"
          >
            {/* dark vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(255,255,255,0.03),transparent_65%)] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,transparent_55%,rgba(0,0,0,0.7))] pointer-events-none z-10" />

            {/* SVG chart layer */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              fill="none"
              aria-hidden="true"
            >
              <defs>
                <filter id="glow-soft" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="12" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="glow-tight" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <pattern id="map-dots" width="80" height="80" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.2" fill="white" fillOpacity="0.09" />
                </pattern>
              </defs>

              {/* graticule dots */}
              <rect width={MAP_W} height={MAP_H} fill="url(#map-dots)" />

              {/* cross-grid ticks */}
              <g stroke="white" strokeOpacity="0.06" strokeWidth="1">
                {[400, 800, 1200, 1600, 2000, 2400].map((y) => (
                  <line key={y} x1="40" y1={y} x2={MAP_W - 40} y2={y} strokeDasharray="3 14" />
                ))}
                {[250, 500, 750].map((x) => (
                  <line key={x} x1={x} y1="80" x2={x} y2={MAP_H - 80} strokeDasharray="3 14" />
                ))}
              </g>

              {/* subtle latitude coordinates */}
              <g fill="white" fillOpacity="0.14" fontSize="9" fontFamily="monospace">
                {[
                  { y: 340, t: "01 // VOIDVERSE" },
                  { y: 580, t: "02 // VOIDANIME" },
                  { y: 830, t: "03 // VOIDLOOP" },
                  { y: 1060, t: "04 // VOIDCRAFTS" },
                  { y: 1310, t: "05 // VOID-FILES" },
                  { y: 1540, t: "06 // VOIDDROPS" },
                  { y: 1790, t: "07 // VOIDX" },
                  { y: 2020, t: "08 // VOIDPLAYER" },
                  { y: 2270, t: "09 // GITHUB" },
                  { y: 2560, t: "10 // YOUTUBE" },
                ].map(({ y, t }) => (
                  <text key={y} x="44" y={y + 3}>
                    {t}
                  </text>
                ))}
              </g>

              {/* faint uncharted track (the whole route, barely visible) */}
              <path
                d={ROUTE_D}
                stroke="white"
                strokeOpacity="0.07"
                strokeWidth="2"
                strokeDasharray="4 8"
                fill="none"
              />

              {/* lit sections where the butterfly has flown */}
              {runPaths.map((d, i) => (
                <g key={`run-${i}`}>
                  <path
                    d={d}
                    stroke="white"
                    strokeOpacity="0.32"
                    strokeWidth="4"
                    strokeLinecap="round"
                    fill="none"
                    filter="url(#glow-soft)"
                  />
                  <path
                    d={d}
                    stroke="white"
                    strokeOpacity="0.95"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="5 10"
                    fill="none"
                    className="map-route-march"
                  />
                </g>
              ))}

              {/* origin anchor mark */}
              <g>
                <circle cx={START.x} cy={START.y} r="18" stroke="white" strokeOpacity="0.3" strokeDasharray="3 7" />
                <path
                  d={`M ${START.x} ${START.y - 14} L ${START.x + 9} ${START.y} L ${START.x} ${START.y + 14} L ${START.x - 9} ${START.y} Z`}
                  fill="white"
                  fillOpacity="0.85"
                  filter="url(#glow-tight)"
                />
              </g>


              {/* chart annotation */}
              <text x={MAP_W - 46} y={MAP_H - 38} textAnchor="end" className="font-mono" fontSize="12" letterSpacing="4" fill="white" fillOpacity="0.22">
                CHART 001 // SCALE ∞
              </text>
            </svg>

            {/* origin label */}
            <span
              className="pointer-events-none absolute font-mono text-[10px] tracking-[0.22em] uppercase text-zinc-500"
              style={{
                left: `${(START.x / MAP_W) * 100}%`,
                top: `${(START.y / MAP_H) * 100}%`,
                transform: "translate(-50%, 38px)",
              }}
            >
              ◇ Void Origin
            </span>

            {/* HTML marker layer */}
            {markerList.map(({ p }, i) => (
              <Marker
                key={p.id}
                project={p}
                index={i}
                visible={visible}
                lit={lit.has(p.id)}
                near={nearId === p.id}
                hovered={hoverId === p.id}
                mapW={mapW}
                onHover={setHoverId}
                onOpen={() => setOpen(p)}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">
            Guide the butterfly from Void Origin along the path · Click Open on any card to launch its website
          </p>
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-400 font-semibold">
            {lit.size} of {PROJECTS.length} treasures charted
          </p>
        </div>
      </div>

      {open && <Lightbox project={open} startIndex={0} onClose={() => setOpen(null)} />}
    </section>
  );
}
