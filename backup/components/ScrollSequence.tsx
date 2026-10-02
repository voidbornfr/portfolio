"use client";

import { useEffect, useRef, useState } from "react";

const FRAME_COUNT = 50;

// Ease function: cubic ease in-out
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function ScrollSequence() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Preload frames
  useEffect(() => {
    let loadedCount = 0;
    const images: HTMLImageElement[] = [];
    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new Image();
      img.src = `/frames_50/ezgif-frame-${i.toString().padStart(3, "0")}.png`;
      img.onload = () => {
        loadedCount++;
        if (loadedCount === FRAME_COUNT) setLoaded(true);
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === FRAME_COUNT) setLoaded(true);
      };
      images.push(img);
    }
    imagesRef.current = images;
  }, []);

  // Animation loop
  useEffect(() => {
    if (!loaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let rafId: number;
    let currentFrame = 0; // smoothed frame (float)

    // -- Size the canvas buffer to match physical pixels exactly --
    const fitCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      // CSS size = full viewport
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      // Buffer size = physical pixels (crisp on retina)
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
    };

    fitCanvas();
    window.addEventListener("resize", fitCanvas);

    const draw = () => {
      const container = containerRef.current;
      const textEl = textRef.current;
      if (!container) { rafId = requestAnimationFrame(draw); return; }

      // --- Scroll progress (0 → 1) ---
      const rect = container.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const rawProgress = Math.max(0, Math.min(1, -rect.top / scrollable));

      // --- Lerp frame (smooth, never sticks) ---
      const targetFrame = rawProgress * (FRAME_COUNT - 1);
      currentFrame += (targetFrame - currentFrame) * 0.10;
      const frameIdx = Math.round(currentFrame);
      const img = imagesRef.current[frameIdx];

      // --- Canvas dims ---
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width;   // physical pixels
      const H = canvas.height;
      const vW = window.innerWidth;
      const vH = window.innerHeight;

      // --- Clear to black ---
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      if (img?.complete && img.naturalWidth > 0) {
        // ------ CLIP BOX ------
        // Start: centered 16:9 box at ~70% viewport width
        // End: full viewport
        const expandPhase = Math.max(0, Math.min(1, (rawProgress - 0.15) / 0.85));
        const eased = easeInOutCubic(expandPhase);

        const startW = vW * 0.70;
        const startH = startW * (9 / 16);

        // current clip dimensions (CSS pixels → physical pixels)
        const clipW = (startW + (vW - startW) * eased) * dpr;
        const clipH = (startH + (vH - startH) * eased) * dpr;
        const clipX = (W - clipW) / 2;
        const clipY = (H - clipH) / 2;

        // --- Apply clip path ---
        ctx.save();
        ctx.beginPath();
        // Subtle rounded corners (disappear as it goes fullscreen)
        const radius = 8 * (1 - eased) * dpr;
        if (radius > 0.5) {
          ctx.moveTo(clipX + radius, clipY);
          ctx.lineTo(clipX + clipW - radius, clipY);
          ctx.quadraticCurveTo(clipX + clipW, clipY, clipX + clipW, clipY + radius);
          ctx.lineTo(clipX + clipW, clipY + clipH - radius);
          ctx.quadraticCurveTo(clipX + clipW, clipY + clipH, clipX + clipW - radius, clipY + clipH);
          ctx.lineTo(clipX + radius, clipY + clipH);
          ctx.quadraticCurveTo(clipX, clipY + clipH, clipX, clipY + clipH - radius);
          ctx.lineTo(clipX, clipY + radius);
          ctx.quadraticCurveTo(clipX, clipY, clipX + radius, clipY);
        } else {
          ctx.rect(clipX, clipY, clipW, clipH);
        }
        ctx.closePath();
        ctx.clip();

        // --- Draw image (cover-fit to the CLIP BOX, not whole canvas) ---
        // This ensures NO pixel upscaling — source image always fills at correct ratio
        const iW = img.naturalWidth;
        const iH = img.naturalHeight;
        const imgRatio = iW / iH;
        const boxRatio = clipW / clipH;

        let srcX = 0, srcY = 0, srcW = iW, srcH = iH;
        if (imgRatio > boxRatio) {
          srcW = iH * boxRatio;
          srcX = (iW - srcW) / 2;
        } else {
          srcH = iW / boxRatio;
          srcY = (iH - srcH) / 2;
        }

        ctx.drawImage(img, srcX, srcY, srcW, srcH, clipX, clipY, clipW, clipH);
        ctx.restore();

        // --- Subtle vignette / border glow at initial state ---
        if (eased < 0.8) {
          const alpha = (1 - eased / 0.8) * 0.35;
          ctx.save();
          ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.4})`;
          ctx.lineWidth = 1 * dpr;
          ctx.strokeRect(clipX + 0.5, clipY + 0.5, clipW - 1, clipH - 1);
          ctx.restore();
        }
      }

      // --- Text fade/parallax (CSS-driven via style mutation) ---
      if (textEl) {
        const textOpacity = Math.max(0, 1 - rawProgress * 3);
        const textY = rawProgress * 120;
        textEl.style.opacity = textOpacity.toString();
        textEl.style.transform = `translateY(${-textY}px)`;
      }

      // --- Seamless exit fade into Bento Grid (smooth continuous flow) ---
      const exitEl = document.getElementById("sequence-exit-overlay");
      if (exitEl) {
        // From progress 0.85 to 1.0, gently blend to pure dark tone
        const exitProgress = Math.max(0, Math.min(1, (rawProgress - 0.85) / 0.15));
        exitEl.style.opacity = (exitProgress * 0.9).toString();
      }

      rafId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", fitCanvas);
    };
  }, [loaded]);

  return (
    <section ref={containerRef} className="relative h-[450vh] bg-black">
      {/* Sticky viewport */}
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-black">

        {/* Canvas — always full-screen, always native DPR resolution */}
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0"
          style={{ imageRendering: "auto" }}
        />

        {/* Seamless exit vignette connecting to Bento Grid */}
        <div
          id="sequence-exit-overlay"
          className="absolute inset-0 pointer-events-none z-25 bg-gradient-to-b from-transparent via-black/40 to-black opacity-0 will-change-opacity transition-opacity duration-150"
        />

        {/* Editorial text overlay */}
        <div
          ref={textRef}
          className="absolute inset-0 z-20 pointer-events-none will-change-transform"
        >
          <div className="relative w-full h-full p-6 md:p-14">

            {/* Top-left: vertical mono label */}
            <div className="absolute top-[14%] left-[5%] md:left-[7%] -rotate-90 origin-top-left">
              <p className="text-[9px] md:text-[11px] tracking-[0.55em] text-gray-500 uppercase font-mono whitespace-nowrap">
                Void // Systems
              </p>
            </div>

            {/* Top-right: large headline */}
            <div className="absolute top-[18%] right-[6%] md:right-[10%] text-right">
              <h2 className="text-3xl md:text-5xl lg:text-6xl font-extralight tracking-tighter text-white uppercase leading-none">
                VoidBornFr
              </h2>
              <div className="flex items-center justify-end gap-3 mt-3">
                <div className="w-8 h-px bg-gray-600"></div>
                <p className="text-[9px] text-gray-500 tracking-[0.35em] uppercase font-mono">
                  01 / Nihility
                </p>
              </div>
            </div>

            {/* Middle-left: square accent + label */}
            <div className="absolute top-[44%] left-[5%] md:left-[9%]">
              <div className="w-2 h-2 bg-white mb-3"></div>
              <p className="text-[10px] tracking-[0.3em] text-gray-400 uppercase font-mono leading-relaxed">
                Immersive<br />Discovery
              </p>
            </div>

            {/* Bottom-left: headline text */}
            <div className="absolute bottom-[22%] left-[6%] md:left-[12%]">
              <p className="text-xl md:text-3xl font-light text-gray-200 tracking-tight max-w-xs leading-snug">
                Engineered in the shadows.
              </p>
              <div className="flex items-center gap-4 mt-5">
                <div className="w-10 h-px bg-gray-600"></div>
                <p className="text-[9px] uppercase tracking-[0.4em] text-gray-600 font-mono">
                  Seq. 01
                </p>
              </div>
            </div>

            {/* Bottom-right: vertical hint */}
            <div className="absolute bottom-[8%] right-[5%] md:right-[7%] rotate-90 origin-bottom-right">
              <p className="text-[8px] tracking-[0.45em] text-gray-700 uppercase font-mono whitespace-nowrap">
                Scroll to initiate
              </p>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
