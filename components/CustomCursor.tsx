"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Petal burst particle ────────────────────────────────────────────────────
interface Petal {
  id: number;
  x: number;
  y: number;
  angle: number;   // radians
  speed: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  hue: number;     // slight colour variation
}

let petalIdCounter = 0;

function spawnPetals(x: number, y: number): Petal[] {
  const count = 10;
  return Array.from({ length: count }, (_, i) => ({
    id: ++petalIdCounter,
    x,
    y,
    angle: (i / count) * Math.PI * 2 + Math.random() * 0.3,
    speed: 2.5 + Math.random() * 3,
    size: 8 + Math.random() * 10,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 12,
    opacity: 1,
    hue: Math.random() * 30 - 15, // ±15° around base colour
  }));
}

// ─── SVG cursor shape — sword (matches the site logo silhouette) ─────────────
// Blade tip at top-center (hotspot = tip), cross-guard at ~60%, grip below.
// The cursor hotspot is the blade tip so clicking feels precise.
const CursorSVG = ({ size = 40 }: { size?: number }) => (
  <svg
    width={size}
    height={size * 1.6}
    viewBox="0 0 40 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ filter: "drop-shadow(0 0 5px rgba(255,255,255,0.55))" }}
  >
    {/* ── Blade ── tapered diamond cross-section */}
    {/* Left edge */}
    <path
      d="M20 2 L14 42 L20 46 L26 42 Z"
      fill="url(#bladeGrad)"
      stroke="rgba(255,255,255,0.35)"
      strokeWidth={0.6}
    />
    {/* Blade centre fuller (ridge line glow) */}
    <line x1="20" y1="2" x2="20" y2="44" stroke="rgba(255,255,255,0.7)" strokeWidth={0.8} />

    {/* ── Cross-guard ── */}
    {/* Horizontal bar */}
    <rect x="9" y="41" width="22" height="4" rx="2"
      fill="rgba(255,255,255,0.9)"
      stroke="rgba(255,255,255,0.4)"
      strokeWidth={0.5}
    />
    {/* Small quillon tips */}
    <ellipse cx="9"  cy="43" rx="3" ry="2" fill="rgba(255,255,255,0.7)" />
    <ellipse cx="31" cy="43" rx="3" ry="2" fill="rgba(255,255,255,0.7)" />

    {/* ── Grip ── wrapped handle */}
    <rect x="18" y="45" width="4" height="13" rx="1.5"
      fill="rgba(180,180,180,0.6)"
      stroke="rgba(255,255,255,0.2)"
      strokeWidth={0.5}
    />
    {/* Grip wraps */}
    {[47, 50, 53].map(y => (
      <line key={y} x1="17.5" y1={y} x2="22.5" y2={y}
        stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
    ))}

    {/* ── Pommel ── */}
    <ellipse cx="20" cy="59" rx="4" ry="3"
      fill="rgba(255,255,255,0.85)"
      stroke="rgba(255,255,255,0.4)"
      strokeWidth={0.5}
    />

    {/* Blade gradient definition */}
    <defs>
      <linearGradient id="bladeGrad" x1="14" y1="2" x2="26" y2="46" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stopColor="rgba(255,255,255,0.95)" />
        <stop offset="45%"  stopColor="rgba(220,220,230,0.80)" />
        <stop offset="100%" stopColor="rgba(160,160,180,0.65)" />
      </linearGradient>
    </defs>
  </svg>
);

// Single petal shape for burst particles
const PetalShape = ({
  size,
  hue,
  opacity,
  rotation,
}: {
  size: number;
  hue: number;
  opacity: number;
  rotation: number;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    style={{
      transform: `rotate(${rotation}deg)`,
      opacity,
      filter: `drop-shadow(0 0 3px rgba(255,255,255,0.5))`,
    }}
  >
    <ellipse
      cx={12}
      cy={12}
      rx={6}
      ry={11}
      fill={`hsl(${30 + hue}, 90%, 88%)`}
      stroke="rgba(255,255,255,0.4)"
      strokeWidth={0.5}
    />
  </svg>
);

// ─── Main component ──────────────────────────────────────────────────────────
export default function CustomCursor() {
  const posRef = useRef({ x: -100, y: -100 });
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const trailPos = useRef({ x: -100, y: -100 });

  const [petals, setPetals] = useState<Petal[]>([]);
  const [isHovering, setIsHovering] = useState(false);
  // Hide on touch-only devices
  const [visible, setVisible] = useState(false);

  // Smooth cursor position update via rAF
  const animate = useCallback(() => {
    const cursor = cursorRef.current;
    const trail = trailRef.current;
    if (cursor) {
      // Offset so the blade tip (top-center) is the hotspot: shift left by half width
      cursor.style.transform = `translate(${posRef.current.x - 20}px, ${posRef.current.y}px)`;
    }
    if (trail) {
      // Lag the trail behind the real cursor
      trailPos.current.x += (posRef.current.x - trailPos.current.x) * 0.12;
      trailPos.current.y += (posRef.current.y - trailPos.current.y) * 0.12;
      trail.style.transform = `translate(${trailPos.current.x - 6}px, ${trailPos.current.y - 6}px)`;
    }
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    // Only show on pointer (non-touch) capable devices
    const mq = window.matchMedia("(pointer: fine)");
    if (!mq.matches) return;
    setVisible(true);

    const onMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
    };

    const onClick = (e: MouseEvent) => {
      const newPetals = spawnPetals(e.clientX, e.clientY);
      setPetals(prev => [...prev, ...newPetals]);
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "BUTTON" ||
        target.tagName === "A" ||
        target.closest("button") ||
        target.closest("a") ||
        target.getAttribute("role") === "button"
      ) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("click", onClick, { passive: true });
    window.addEventListener("mouseover", onMouseOver, { passive: true });

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("click", onClick);
      window.removeEventListener("mouseover", onMouseOver);
      cancelAnimationFrame(rafRef.current);
    };
  }, [animate]);

  // Animate petal burst particles each frame
  useEffect(() => {
    if (petals.length === 0) return;

    const frameId = requestAnimationFrame(() => {
      setPetals(prev =>
        prev
          .map(p => ({
            ...p,
            x: p.x + Math.cos(p.angle) * p.speed,
            y: p.y + Math.sin(p.angle) * p.speed + 0.6, // gravity
            opacity: p.opacity - 0.035,
            rotation: p.rotation + p.rotationSpeed,
            speed: p.speed * 0.94,
          }))
          .filter(p => p.opacity > 0)
      );
    });

    return () => cancelAnimationFrame(frameId);
  }, [petals]);

  if (!visible) return null;

  return (
    <>
      {/* Main cursor — sword tip is the hotspot (top-center of SVG) */}
      <div
        ref={cursorRef}
        className="pointer-events-none fixed top-0 left-0 z-[9999] will-change-transform"
        style={{ width: 40, height: 64 }}
      >
        <div
          style={{
            transform: `scale(${isHovering ? 1.2 : 1})`,
            transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
            transformOrigin: "top center",
          }}
        >
          <CursorSVG size={40} />
        </div>
      </div>

      {/* Soft trailing glow dot */}
      <div
        ref={trailRef}
        className="pointer-events-none fixed top-0 left-0 z-[9998] will-change-transform"
        style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.18)",
          boxShadow: "0 0 8px 2px rgba(255,255,255,0.25)",
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Click burst petals — rendered at fixed position over everything */}
      {petals.map(p => (
        <div
          key={p.id}
          className="pointer-events-none fixed top-0 left-0 z-[9997] will-change-transform"
          style={{
            transform: `translate(${p.x - p.size / 2}px, ${p.y - p.size / 2}px)`,
          }}
        >
          <PetalShape
            size={p.size}
            hue={p.hue}
            opacity={p.opacity}
            rotation={p.rotation}
          />
        </div>
      ))}
    </>
  );
}
