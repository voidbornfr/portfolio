"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const TOTAL_FRAMES = 300;
const DURATION_SECS = 6.0;

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  // 'idle' | 'fading' | 'revealing' | 'done'
  const [phase, setPhase] = useState<"idle" | "fading" | "revealing" | "done">("idle");
  const [ready, setReady] = useState(false);
  const [hudFrame, setHudFrame] = useState(1);
  const [progressPct, setProgressPct] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isFinishedRef = useRef(false);

  // Lock body scroll while splash is active
  useEffect(() => {
    const isActive = visible && phase === "idle";
    document.body.style.overflow = isActive ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [visible, phase]);

  const finish = useCallback(() => {
    if (isFinishedRef.current) return;
    isFinishedRef.current = true;

    // Step 1: Flash screen white (exposure burst)
    setPhase("fading");

    // Step 2: Trigger smooth reveal wipe curtain
    setTimeout(() => {
      setPhase("revealing");
      document.body.classList.add("splash-revealing");
      document.body.style.overflow = "";

      // Step 3: Unmount completely after reveal curtain finishes
      setTimeout(() => {
        setPhase("done");
        setVisible(false);
        document.body.classList.remove("splash-revealing");
      }, 1150);
    }, 300);
  }, []);

  // Safety fallback so user is never stuck
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (!isFinishedRef.current) {
        finish();
      }
    }, 7000);
    return () => clearTimeout(safetyTimer);
  }, [finish]);

  // Handle video ready / playback events
  const handleLoadedData = () => {
    setReady(true);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay policy fallback
      });
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;

    const current = video.currentTime;
    const dur = video.duration || DURATION_SECS;
    const ratio = Math.min(1, Math.max(0, current / dur));

    const currentFrame = Math.min(TOTAL_FRAMES, Math.max(1, Math.floor(ratio * TOTAL_FRAMES) + 1));
    setHudFrame(currentFrame);
    setProgressPct(Math.round(ratio * 100));
  };

  if (!visible) return null;

  // Timecode formatting: HH:MM:SS:FF
  const secs = Math.floor((hudFrame / TOTAL_FRAMES) * DURATION_SECS);
  const frames = hudFrame % 50;
  const tc = `00:00:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;

  return (
    <>
      {/* ── Main splash container ── */}
      <div
        role="dialog"
        aria-label="Loading"
        className="fixed inset-0 z-[99998] bg-black select-none overflow-hidden pointer-events-auto"
        style={{
          backgroundColor: phase === "fading" ? "#ffffff" : "#000000",
          opacity: phase === "revealing" || phase === "done" ? 0 : 1,
          transition:
            phase === "fading"
              ? "background-color 0.25s ease-out"
              : phase === "revealing" || phase === "done"
              ? "opacity 0.15s ease-out"
              : "none",
        }}
      >
        {/* Hardware-Accelerated Video Layer (60fps GPU decoded) */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          preload="auto"
          onLoadedData={handleLoadedData}
          onCanPlay={handleLoadedData}
          onTimeUpdate={handleTimeUpdate}
          onEnded={finish}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: phase === "fading" ? 0 : 1,
            transition: phase === "fading" ? "opacity 0.25s ease-in" : "none",
          }}
        >
          <source src="/splash_video.mp4" type="video/mp4" />
          <source src="/splash_video.webm" type="video/webm" />
        </video>

        {/* Cinematic Vignette */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.75)_100%)] z-10" />

        {/* Buffering Indicator */}
        {!ready && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-black">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border border-white/10 animate-ping" />
              <div className="absolute inset-[3px] rounded-full border border-t-white/80 border-white/10 animate-spin" />
            </div>
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/40">
              INITIALIZING SYSTEM
            </p>
          </div>
        )}

        {/* ── CAMERA HUD OVERLAY ── */}
        {ready && (
          <div className="absolute inset-0 z-20 pointer-events-none font-mono">
            {/* 4 Corner Viewfinder Brackets */}
            <div className="absolute top-5 left-5 w-8 h-8 border-t border-l border-white/50 sm:top-8 sm:left-8 sm:w-12 sm:h-12" />
            <div className="absolute top-5 right-5 w-8 h-8 border-t border-r border-white/50 sm:top-8 sm:right-8 sm:w-12 sm:h-12" />
            <div className="absolute bottom-5 left-5 w-8 h-8 border-b border-l border-white/50 sm:bottom-8 sm:left-8 sm:w-12 sm:h-12" />
            <div className="absolute bottom-5 right-5 w-8 h-8 border-b border-r border-white/50 sm:bottom-8 sm:right-8 sm:w-12 sm:h-12" />

            {/* Center Crosshair */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-12 h-12 sm:w-16 sm:h-16">
                <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20 -translate-y-px" />
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20 -translate-x-px" />
                <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 border border-white/60" />
              </div>
            </div>

            {/* TOP ROW */}
            <div className="absolute top-5 left-0 right-0 flex items-start justify-between px-5 sm:top-8 sm:px-8">
              {/* REC Blinking Pill */}
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-block w-2 h-2 rounded-full bg-white"
                  style={{ animation: "splash-blink 1.1s step-end infinite" }}
                />
                <span className="text-[10px] sm:text-xs tracking-[0.35em] text-white/90 uppercase">
                  REC
                </span>
              </div>

              {/* Timecode */}
              <span className="text-[10px] sm:text-[11px] tracking-[0.25em] text-white/60 tabular-nums">
                {tc}
              </span>
            </div>

            {/* BOTTOM ROW */}
            <div className="absolute bottom-5 left-0 right-0 flex items-end justify-between px-5 sm:bottom-8 sm:px-8">
              {/* Format Label */}
              <span className="text-[9px] sm:text-[10px] tracking-[0.3em] text-white/35 uppercase">
                4K · 50fps
              </span>

              {/* Frame Counter */}
              <span className="text-[9px] sm:text-[10px] tracking-[0.3em] text-white/35 tabular-nums">
                {hudFrame.toString().padStart(3, "0")} / {TOTAL_FRAMES}
              </span>
            </div>
          </div>
        )}

        {/* Thin White Progress Line */}
        <div className="absolute bottom-0 inset-x-0 h-px bg-white/10 z-30 pointer-events-none">
          <div
            className="h-full bg-white/70 transition-all duration-75 ease-linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* ── Reveal Wipe Curtain ── */}
      <div
        className="fixed inset-0 z-[99997] pointer-events-none"
        style={{
          backgroundColor: "#000000",
          clipPath:
            phase === "revealing" || phase === "done"
              ? "inset(100% 0 0 0)"
              : "inset(0% 0 0 0)",
          transition:
            phase === "revealing" || phase === "done"
              ? "clip-path 1.15s cubic-bezier(0.76,0,0.24,1)"
              : "none",
        }}
      />

      {/* Styles */}
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
