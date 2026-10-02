"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const TOTAL_FRAMES = 300;
const FPS = 50;
const FRAME_DURATION = 1000 / FPS;

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  // 'idle' | 'fading' | 'revealing' | 'done'
  const [phase, setPhase] = useState<"idle" | "fading" | "revealing" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [hudFrame, setHudFrame] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<(HTMLImageElement | null)[]>(new Array(TOTAL_FRAMES).fill(null));
  const currentFrameRef = useRef(1);
  const lastTimeRef = useRef(0);
  const animFrameIdRef = useRef<number | null>(null);
  const readyRef = useRef(false);

  // Lock body scroll while splash is active
  useEffect(() => {
    const isActive = visible && phase === "idle";
    document.body.style.overflow = isActive ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [visible, phase]);

  const finish = useCallback(() => {
    if (phase !== "idle") return;
    // Step 1: Flash the canvas white (brief exposure burst)
    setPhase("fading");
    // Step 2: After white flash, trigger reveal wipe
    setTimeout(() => {
      setPhase("revealing");
      // Apply body class so page content animates in
      document.body.classList.add("splash-revealing");
      document.body.style.overflow = "";
      // Step 3: After wipe completes, unmount completely
      setTimeout(() => {
        setPhase("done");
        setVisible(false);
        document.body.classList.remove("splash-revealing");
      }, 1300);
    }, 350);
  }, [phase]);

  // Safety fallback
  useEffect(() => {
    const t = setTimeout(() => finish(), 9000);
    return () => clearTimeout(t);
  }, [finish]);

  // Progressive preloader
  useEffect(() => {
    let active = true;
    let loadedCount = 0;

    const loadFrame = (index: number): Promise<void> =>
      new Promise((resolve) => {
        const frameNum = (index + 1).toString().padStart(3, "0");
        const img = new Image();
        img.src = `/splash_frames_300/ezgif-frame-${frameNum}.png`;
        img.onload = () => {
          if (!active) return;
          imagesRef.current[index] = img;
          loadedCount++;
          setProgress(Math.round((loadedCount / TOTAL_FRAMES) * 100));
          if (loadedCount >= 20 && !readyRef.current) {
            readyRef.current = true;
            setReady(true);
          }
          resolve();
        };
        img.onerror = () => {
          if (!active) return;
          loadedCount++;
          if (loadedCount >= 20 && !readyRef.current) {
            readyRef.current = true;
            setReady(true);
          }
          resolve();
        };
      });

    const initialBatch = Array.from({ length: 20 }, (_, i) => loadFrame(i));
    Promise.all(initialBatch).then(() => {
      if (!active) return;
      if (!readyRef.current) { readyRef.current = true; setReady(true); }
      const loadRemaining = async () => {
        for (let i = 20; i < TOTAL_FRAMES; i += 12) {
          if (!active) break;
          await Promise.all(
            Array.from({ length: Math.min(12, TOTAL_FRAMES - i) }, (_, j) => loadFrame(i + j))
          );
        }
      };
      loadRemaining();
    });

    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Canvas animation loop
  useEffect(() => {
    if (!ready || !visible || phase !== "idle") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      // Cap dpr at 1.5 — on 3x Retina displays this saves ~56% of pixels
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    let hudTick = 0;

    const render = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const elapsed = time - lastTimeRef.current;

      if (elapsed >= FRAME_DURATION) {
        lastTimeRef.current = time - (elapsed % FRAME_DURATION);

        const frameIdx = currentFrameRef.current - 1;
        let img = imagesRef.current[frameIdx];
        if (!img) {
          for (let k = frameIdx; k >= 0; k--) {
            if (imagesRef.current[k]) { img = imagesRef.current[k]; break; }
          }
        }

        if (img && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const hRatio = canvas.width / img.width;
          const vRatio = canvas.height / img.height;
          const ratio = Math.max(hRatio, vRatio);
          const sx = (canvas.width - img.width * ratio) / 2;
          const sy = (canvas.height - img.height * ratio) / 2;
          ctx.drawImage(img, 0, 0, img.width, img.height, sx, sy, img.width * ratio, img.height * ratio);
        }

        currentFrameRef.current++;
        hudTick++;
        if (hudTick % 3 === 0) setHudFrame(Math.min(TOTAL_FRAMES, currentFrameRef.current));

        if (currentFrameRef.current > TOTAL_FRAMES) { finish(); return; }
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [ready, visible, phase, finish]);

  if (!visible) return null;

  // Timecode: HH:MM:SS:FF
  const secs = Math.floor(hudFrame / FPS);
  const frames = hudFrame % FPS;
  const tc = `00:00:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
  const pct = Math.min(100, ((currentFrameRef.current - 1) / TOTAL_FRAMES) * 100);

  return (
    <>
      {/* ── Main splash overlay ── */}
      <div
        role="dialog"
        aria-label="Loading"
        className="fixed inset-0 z-[99998] bg-black select-none overflow-hidden pointer-events-auto"
        style={{
          // Instant white-flash on fading, then invisible during reveal
          backgroundColor: phase === "fading" ? "#ffffff" : "#000000",
          opacity: (phase === "revealing" || phase === "done") ? 0 : 1,
          transition: phase === "fading" 
            ? "background-color 0.3s ease-out" 
            : (phase === "revealing" || phase === "done")
              ? "opacity 0.15s ease-out" 
              : "none",
        }}
      >
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{
            opacity: phase === "fading" ? 0 : 1,
            transition: phase === "fading" ? "opacity 0.25s ease-in" : "none",
          }}
        />

        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.7)_100%)] z-10" />

        {/* Buffering state */}
        {!ready && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border border-white/10 animate-ping" />
              <div className="absolute inset-[3px] rounded-full border border-t-white/80 border-white/10 animate-spin" />
            </div>
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/40">
              {progress}%
            </p>
          </div>
        )}

        {/* ── MINIMAL CAMERA HUD ── */}
        {ready && (
          <div className="absolute inset-0 z-20 pointer-events-none font-mono">

            {/* 4 corner viewfinder brackets — pure white, crisp */}
            <div className="absolute top-5 left-5 w-8 h-8 border-t border-l border-white/50 sm:top-8 sm:left-8 sm:w-12 sm:h-12" />
            <div className="absolute top-5 right-5 w-8 h-8 border-t border-r border-white/50 sm:top-8 sm:right-8 sm:w-12 sm:h-12" />
            <div className="absolute bottom-5 left-5 w-8 h-8 border-b border-l border-white/50 sm:bottom-8 sm:left-8 sm:w-12 sm:h-12" />
            <div className="absolute bottom-5 right-5 w-8 h-8 border-b border-r border-white/50 sm:bottom-8 sm:right-8 sm:w-12 sm:h-12" />

            {/* Center crosshair — tiny, unobtrusive */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-12 h-12 sm:w-16 sm:h-16">
                <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20 -translate-y-px" />
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20 -translate-x-px" />
                <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 border border-white/60" />
              </div>
            </div>

            {/* TOP ROW */}
            <div className="absolute top-5 left-0 right-0 flex items-start justify-between px-5 sm:top-8 sm:px-8">
              
              {/* REC pill — monochrome, blinking */}
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-block w-2 h-2 rounded-full bg-white"
                  style={{ animation: "splash-blink 1.1s step-end infinite" }}
                />
                <span className="text-[10px] sm:text-xs tracking-[0.35em] text-white/90 uppercase">
                  REC
                </span>
              </div>

              {/* Timecode — right side */}
              <span className="text-[10px] sm:text-[11px] tracking-[0.25em] text-white/60 tabular-nums">
                {tc}
              </span>
            </div>

            {/* BOTTOM ROW */}
            <div className="absolute bottom-5 left-0 right-0 flex items-end justify-between px-5 sm:bottom-8 sm:px-8">

              {/* Bottom-left: format label */}
              <span className="text-[9px] sm:text-[10px] tracking-[0.3em] text-white/35 uppercase">
                4K · 50fps
              </span>

              {/* Bottom-right: frame counter */}
              <span className="text-[9px] sm:text-[10px] tracking-[0.3em] text-white/35 tabular-nums">
                {hudFrame.toString().padStart(3, "0")} / {TOTAL_FRAMES}
              </span>
            </div>

          </div>
        )}

        {/* Thin progress line at bottom — white, not red */}
        <div className="absolute bottom-0 inset-x-0 h-px bg-white/10 z-30 pointer-events-none">
          <div
            className="h-full bg-white/60 transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ── Reveal wipe curtain (black panel slides up from bottom) ── */}
      <div
        className="fixed inset-0 z-[99997] pointer-events-none"
        style={{
          backgroundColor: "#000000",
          // Clip-path wipe: bottom panel slides up to reveal
          clipPath: (phase === "revealing" || phase === "done") ? "inset(100% 0 0 0)" : "inset(0% 0 0 0)",
          transition: (phase === "revealing" || phase === "done") ? "clip-path 1.15s cubic-bezier(0.76,0,0.24,1)" : "none",
        }}
      />

      {/* ── Page entrance: subtle brightness + scale-up bloom ── */}
      <style>{`
        @keyframes splash-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes splash-page-in {
          from { opacity: 0; transform: scale(1.018); filter: brightness(1.3); }
          to   { opacity: 1; transform: scale(1);     filter: brightness(1);   }
        }
        body.splash-revealing > *:not([aria-label="Loading"]) {
          animation: splash-page-in 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          animation-delay: 0.15s;
        }
      `}</style>
    </>
  );
}
