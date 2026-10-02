"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const FRAME_COUNT = 300;

export default function ScrollSequence() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<(HTMLImageElement | null)[]>(new Array(FRAME_COUNT).fill(null));
  const currentFrameRef = useRef(0);
  const [initialReady, setInitialReady] = useState(false);

  // Progressive preloader: frame 1 first, then initial burst, then remaining chunks
  useEffect(() => {
    let active = true;

    const loadSingleFrame = (index: number): Promise<void> => {
      return new Promise((resolve) => {
        if (imagesRef.current[index]) {
          resolve();
          return;
        }
        const frameNum = (index + 1).toString().padStart(3, "0");
        const img = new Image();
        img.src = `/frames_300/ezgif-frame-${frameNum}.png`;
        img.onload = () => {
          if (!active) return;
          imagesRef.current[index] = img;
          if (index === 0 && !initialReady) {
            setInitialReady(true);
          }
          resolve();
        };
        img.onerror = () => {
          resolve();
        };
      });
    };

    // Load frame 1 immediately
    loadSingleFrame(0).then(() => {
      if (!active) return;
      setInitialReady(true);

      // Next load first 30 frames for immediate responsiveness
      const firstBatch = Array.from({ length: 30 }, (_, i) => loadSingleFrame(i));
      Promise.all(firstBatch).then(() => {
        if (!active) return;
        // Stream the rest in background chunks
        const loadAll = async () => {
          for (let i = 30; i < FRAME_COUNT; i += 15) {
            if (!active) break;
            const chunk = Array.from({ length: Math.min(15, FRAME_COUNT - i) }, (_, j) =>
              loadSingleFrame(i + j)
            );
            await Promise.all(chunk);
          }
        };
        loadAll();
      });
    });

    return () => {
      active = false;
    };
  }, [initialReady]);

  // Main canvas animation and scroll tracking
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let rafId: number;
    // Track whether the section is in the viewport
    const isVisibleRef = { current: false };

    const fitCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };

    fitCanvas();
    window.addEventListener("resize", fitCanvas);

    // IntersectionObserver: pause RAF when section scrolled out of view
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          // Restart the loop when scrolling back in
          rafId = requestAnimationFrame(render);
        } else {
          // Pause the loop when section is off screen
          cancelAnimationFrame(rafId);
        }
      },
      { threshold: 0 }
    );
    if (containerRef.current) observer.observe(containerRef.current);

    const render = () => {
      const container = containerRef.current;
      const textEl = textRef.current;

      if (container) {
        // --- Calculate scroll progress (0 → 1) ---
        const rect = container.getBoundingClientRect();
        const scrollable = rect.height - window.innerHeight;
        const rawProgress = scrollable > 0 ? Math.max(0, Math.min(1, -rect.top / scrollable)) : 0;

        // --- Lerp frame for silky smooth motion ---
        const targetFrame = rawProgress * (FRAME_COUNT - 1);
        currentFrameRef.current += (targetFrame - currentFrameRef.current) * 0.18;
        const frameIdx = Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(currentFrameRef.current)));

        // Find closest loaded frame if target frame is still buffering
        let img = imagesRef.current[frameIdx];
        if (!img) {
          for (let k = frameIdx; k >= 0; k--) {
            if (imagesRef.current[k]) {
              img = imagesRef.current[k];
              break;
            }
          }
          if (!img) {
            for (let k = frameIdx; k < FRAME_COUNT; k++) {
              if (imagesRef.current[k]) {
                img = imagesRef.current[k];
                break;
              }
            }
          }
        }

        // Draw image full-bleed cover (no empty black borders on sides)
        if (img && img.naturalWidth > 0) {
          const hRatio = canvas.width / img.naturalWidth;
          const vRatio = canvas.height / img.naturalHeight;
          const ratio = Math.max(hRatio, vRatio);
          const centerShiftX = (canvas.width - img.naturalWidth * ratio) / 2;
          const centerShiftY = (canvas.height - img.naturalHeight * ratio) / 2;

          ctx.drawImage(
            img,
            0,
            0,
            img.naturalWidth,
            img.naturalHeight,
            centerShiftX,
            centerShiftY,
            img.naturalWidth * ratio,
            img.naturalHeight * ratio
          );
        } else {
          // If no image at all yet, keep black background
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // --- Text fade/parallax based on scroll progress ---
        if (textEl) {
          const textOpacity = Math.max(0, 1 - rawProgress * 2.8);
          const textY = rawProgress * 120;
          textEl.style.opacity = textOpacity.toString();
          textEl.style.transform = `translateY(${-textY}px)`;
        }

        // --- Exit overlay blend into Ecosystem section ---
        const exitEl = document.getElementById("sequence-exit-overlay");
        if (exitEl) {
          const exitProgress = Math.max(0, Math.min(1, (rawProgress - 0.88) / 0.12));
          exitEl.style.opacity = (exitProgress * 0.95).toString();
        }
      }

      // Only re-schedule if still visible
      if (isVisibleRef.current) {
        rafId = requestAnimationFrame(render);
      }
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", fitCanvas);
      observer.disconnect();
    };
  }, []);

  return (
    <section ref={containerRef} className="relative h-[450vh] bg-black">
      {/* Sticky viewport pinned while scrolling */}
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-black">
        {/* Canvas — full bleed edge-to-edge covering viewport */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Ambient cinematic vignetting */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.65)_100%)] z-10" />

        {/* Seamless exit vignette connecting to Ecosystem / Project Map */}
        <div
          id="sequence-exit-overlay"
          className="absolute inset-0 pointer-events-none z-25 bg-gradient-to-b from-transparent via-black/50 to-black opacity-0 will-change-opacity transition-opacity duration-150"
        />

        {/* Editorial text overlay */}
        <div
          ref={textRef}
          className="absolute inset-0 z-20 pointer-events-none will-change-transform"
        >
          <div className="relative w-full h-full p-6 md:p-14 select-none">
            {/* Top-left: vertical mono label */}
            <div className="absolute top-[14%] left-[5%] md:left-[7%] -rotate-90 origin-top-left">
              <p className="text-[9px] md:text-[11px] tracking-[0.55em] text-gray-400 uppercase font-mono whitespace-nowrap">
                Void // Systems
              </p>
            </div>

            {/* Top-right: large headline */}
            <div className="absolute top-[18%] right-[6%] md:right-[10%] text-right">
              <h2 className="text-3xl md:text-5xl lg:text-6xl font-extralight tracking-tighter text-white uppercase leading-none drop-shadow-md">
                VoidBornFr
              </h2>
              <div className="flex items-center justify-end gap-3 mt-3">
                <div className="w-8 h-px bg-gray-500"></div>
                <p className="text-[9px] text-gray-400 tracking-[0.35em] uppercase font-mono">
                  01 / Nihility
                </p>
              </div>
            </div>

            {/* Middle-left: square accent + label */}
            <div className="absolute top-[44%] left-[5%] md:left-[9%]">
              <div className="w-2 h-2 bg-white mb-3 shadow-[0_0_8px_white]"></div>
              <p className="text-[10px] tracking-[0.3em] text-gray-300 uppercase font-mono leading-relaxed">
                Immersive<br />Discovery
              </p>
            </div>

            {/* Bottom-left: headline text */}
            <div className="absolute bottom-[22%] left-[6%] md:left-[12%]">
              <p className="text-xl md:text-3xl font-light text-gray-100 tracking-tight max-w-xs leading-snug drop-shadow-md">
                Engineered in the shadows.
              </p>
              <div className="flex items-center gap-4 mt-5">
                <div className="w-10 h-px bg-gray-500"></div>
                <p className="text-[9px] uppercase tracking-[0.4em] text-gray-400 font-mono">
                  Seq. 01 · 300 FRM
                </p>
              </div>
            </div>

            {/* Bottom-right: vertical hint */}
            <div className="absolute bottom-[8%] right-[5%] md:right-[7%] rotate-90 origin-bottom-right">
              <p className="text-[8px] tracking-[0.45em] text-gray-400 uppercase font-mono whitespace-nowrap">
                Scroll to initiate
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
