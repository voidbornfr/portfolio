"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Particle & Effect Interfaces ───────────────────────────────────────────
interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  type: "spark" | "shard" | "orb";
  color: string;
}

interface Wave {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
}

interface Slash {
  id: number;
  x: number;
  y: number;
  angle: number;
  opacity: number;
}

let idCounter = 0;

function spawnClickEffects(x: number, y: number) {
  // 1. Shockwave energy ring
  const wave: Wave = {
    id: ++idCounter,
    x,
    y,
    size: 15,
    opacity: 1,
  };

  // 2. Sword slash arc streak
  const slash: Slash = {
    id: ++idCounter,
    x,
    y,
    angle: -25 + (Math.random() - 0.5) * 20,
    opacity: 1,
  };

  // 3. High-velocity energy particles
  const particleCount = 18;
  const colors = [
    "#ffffff",
    "#e0f2fe", // cyan-100
    "#38bdf8", // cyan-400
    "#a855f7", // purple-500
    "#cbd5e1", // silver
  ];

  const particles: Particle[] = Array.from({ length: particleCount }, (_, i) => {
    const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.4;
    const speed = 3 + Math.random() * 5.5;
    return {
      id: ++idCounter,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 6 + Math.random() * 9,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 16,
      opacity: 1,
      type: i % 3 === 0 ? "shard" : i % 3 === 1 ? "spark" : "orb",
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  });

  return { wave, slash, particles };
}

// ─── Custom Logo Cursor Component — Using /logo.cur ─────────────────────────
const SwordSVG = ({ size = 56 }: { size?: number }) => (
  <img
    src="/logo.cur"
    alt="Custom Cursor"
    width={size}
    height={size}
    className="drop-shadow-[0_0_12px_rgba(56,189,248,0.85)] filter object-contain pointer-events-none"
    style={{ transform: "scaleY(-1)" }}
  />
);

export default function CustomCursor() {
  const posRef = useRef({ x: -100, y: -100 });
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const trailPos = useRef({ x: -100, y: -100 });

  const [waves, setWaves] = useState<Wave[]>([]);
  const [slashes, setSlashes] = useState<Slash[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isHovering, setIsHovering] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [visible, setVisible] = useState(false);

  // Smooth position update
  const animate = useCallback(() => {
    const cursor = cursorRef.current;
    const trail = trailRef.current;
    if (cursor) {
      // Offset by half cursor size (30px) for exact pointer alignment
      cursor.style.transform = `translate3d(${posRef.current.x - 30}px, ${posRef.current.y - 30}px, 0)`;
    }
    if (trail) {
      // Lagging soft glow trail behind cursor
      trailPos.current.x += (posRef.current.x - trailPos.current.x) * 0.16;
      trailPos.current.y += (posRef.current.y - trailPos.current.y) * 0.16;
      trail.style.transform = `translate3d(${trailPos.current.x - 7}px, ${trailPos.current.y - 7}px, 0)`;
    }
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    // Only show custom cursor on mouse/desktop devices
    const mq = window.matchMedia("(pointer: fine)");
    if (!mq.matches) return;
    setVisible(true);

    const onMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
    };

    const onClick = (e: MouseEvent) => {
      // Trigger instant click animation
      setIsClicked(true);
      setTimeout(() => setIsClicked(false), 180);

      const { wave, slash, particles: newParticles } = spawnClickEffects(e.clientX, e.clientY);
      setWaves((prev) => [...prev.slice(-4), wave]);
      setSlashes((prev) => [...prev.slice(-3), slash]);
      setParticles((prev) => [...prev.slice(-30), ...newParticles]);
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

  // Animate click particles frame loop
  useEffect(() => {
    if (particles.length === 0 && waves.length === 0 && slashes.length === 0) return;

    const frameId = requestAnimationFrame(() => {
      // 1. Waves
      setWaves((prev) =>
        prev
          .map((w) => ({
            ...w,
            size: w.size + 4.5,
            opacity: w.opacity - 0.06,
          }))
          .filter((w) => w.opacity > 0)
      );

      // 2. Slashes
      setSlashes((prev) =>
        prev
          .map((s) => ({
            ...s,
            opacity: s.opacity - 0.08,
          }))
          .filter((s) => s.opacity > 0)
      );

      // 3. Particles
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.2, // subtle gravity
            opacity: p.opacity - 0.03,
            rotation: p.rotation + p.rotationSpeed,
            size: Math.max(1, p.size * 0.96),
          }))
          .filter((p) => p.opacity > 0)
      );
    });

    return () => cancelAnimationFrame(frameId);
  }, [particles, waves, slashes]);

  if (!visible) return null;

  return (
    <>
      {/* Main Sword Cursor */}
      <div
        ref={cursorRef}
        className="pointer-events-none fixed top-0 left-0 z-[9999] will-change-transform"
        style={{ width: 60, height: 60 }}
      >
        <div
          style={{
            transform: `scale(${isClicked ? 0.85 : isHovering ? 1.25 : 1}) rotate(${
              isClicked ? -30 : isHovering ? -20 : -15
            }deg)`,
            transition: isClicked
              ? "transform 0.08s ease-out"
              : "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
            transformOrigin: "center center",
          }}
        >
          <SwordSVG size={56} />
        </div>
      </div>

      {/* Blade Glow Motion Trail */}
      <div
        ref={trailRef}
        className="pointer-events-none fixed top-0 left-0 z-[9998] will-change-transform"
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(56,189,248,0.4) 0%, rgba(255,255,255,0.15) 60%, transparent 100%)",
          boxShadow: "0 0 12px 3px rgba(56,189,248,0.35)",
          backdropFilter: "blur(2px)",
        }}
      />

      {/* ── Click Effects Container ── */}

      {/* Shockwave Rings */}
      {waves.map((w) => (
        <div
          key={w.id}
          className="pointer-events-none fixed top-0 left-0 z-[9996] rounded-full border border-sky-300/80 shadow-[0_0_20px_rgba(56,189,248,0.6)]"
          style={{
            transform: `translate3d(${w.x - w.size / 2}px, ${w.y - w.size / 2}px, 0)`,
            width: w.size,
            height: w.size,
            opacity: w.opacity,
          }}
        />
      ))}

      {/* Sword Slash Energy Streaks */}
      {slashes.map((s) => (
        <div
          key={s.id}
          className="pointer-events-none fixed top-0 left-0 z-[9996] origin-center"
          style={{
            transform: `translate3d(${s.x - 30}px, ${s.y - 4}px, 0) rotate(${s.angle}deg)`,
            width: 60,
            height: 8,
            opacity: s.opacity,
            background: "linear-gradient(90deg, transparent 0%, #ffffff 50%, #38bdf8 80%, transparent 100%)",
            boxShadow: "0 0 15px #38bdf8, 0 0 30px #ffffff",
            borderRadius: "999px",
          }}
        />
      ))}

      {/* Energy Burst Particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="pointer-events-none fixed top-0 left-0 z-[9997] will-change-transform"
          style={{
            transform: `translate3d(${p.x - p.size / 2}px, ${p.y - p.size / 2}px, 0) rotate(${p.rotation}deg)`,
            opacity: p.opacity,
          }}
        >
          {p.type === "shard" ? (
            <svg width={p.size} height={p.size} viewBox="0 0 24 24">
              <path
                d="M12 0 L15 12 L12 24 L9 12 Z"
                fill={p.color}
                style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.8))" }}
              />
            </svg>
          ) : p.type === "spark" ? (
            <svg width={p.size} height={p.size} viewBox="0 0 24 24">
              <path
                d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z"
                fill={p.color}
                style={{ filter: "drop-shadow(0 0 5px #38bdf8)" }}
              />
            </svg>
          ) : (
            <div
              style={{
                width: p.size,
                height: p.size,
                borderRadius: "50%",
                backgroundColor: p.color,
                boxShadow: `0 0 8px ${p.color}`,
              }}
            />
          )}
        </div>
      ))}
    </>
  );
}
