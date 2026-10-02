"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { PROJECTS, ProjectItem } from "@/data/projects";

// ─── Slideshow hook ──────────────────────────────────────────────────────────
function useSlideshow(images: string[], intervalMs = 3000, paused = false) {
  const [index, setIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [fading, setFading] = useState(false);

  const go = useCallback((next: number) => {
    if (fading) return;
    setPrevIndex(index);
    setFading(true);
    setTimeout(() => {
      setIndex(next);
      setPrevIndex(null);
      setFading(false);
    }, 500);
  }, [index, fading]);

  const goNext = useCallback(() => go((index + 1) % images.length), [go, index, images.length]);
  const goPrev = useCallback(() => go((index - 1 + images.length) % images.length), [go, index, images.length]);

  useEffect(() => {
    if (images.length <= 1 || paused) return;
    const id = setInterval(() => goNext(), intervalMs);
    return () => clearInterval(id);
  }, [images.length, paused, intervalMs, goNext]);

  return { index, prevIndex, fading, goNext, goPrev };
}

// ─── 3D Tilt handler ─────────────────────────────────────────────────────────
function useTilt(strength = 8) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width  / 2) / (r.width  / 2);
    const y = (e.clientY - r.top  - r.height / 2) / (r.height / 2);
    el.style.transform = `perspective(900px) rotateX(${(-y * strength).toFixed(1)}deg) rotateY(${(x * strength).toFixed(1)}deg) translateZ(4px)`;
  };

  const onLeave = () => {
    if (ref.current) {
      ref.current.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)";
    }
  };

  return { ref, onMove, onLeave };
}

// ─── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({
  project, startIndex, onClose,
}: { project: ProjectItem; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  const total = project.images.length;

  const prev = () => setIdx((i) => (i - 1 + total) % total);
  const next = () => setIdx((i) => (i + 1) % total);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape")      onClose();
      if (e.key === "ArrowRight")  next();
      if (e.key === "ArrowLeft")   prev();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  });

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col"
      onClick={onClose}
    >
      {/* Top bar */}
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
            href={project.link} target="_blank" rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 text-xs font-mono text-zinc-300 hover:text-white hover:bg-white/10 transition-all"
          >
            {project.linkText} <span>↗</span>
          </a>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full border border-white/15 bg-white/5 text-zinc-300 hover:text-white hover:bg-white/15 flex items-center justify-center transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main image */}
      <div className="flex-1 relative flex items-center justify-center min-h-0 px-16" onClick={(e) => e.stopPropagation()}>
        {total > 1 && (
          <button onClick={prev} className="absolute left-4 z-10 w-12 h-12 rounded-full bg-black/70 hover:bg-black border border-white/20 text-white flex items-center justify-center hover:scale-110 transition-all shadow-xl">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
        )}
        <div className="relative w-full h-full max-h-[70vh]">
          <Image src={encodeURI(project.images[idx])} alt={project.title} fill unoptimized className="object-contain drop-shadow-2xl" />
        </div>
        {total > 1 && (
          <button onClick={next} className="absolute right-4 z-10 w-12 h-12 rounded-full bg-black/70 hover:bg-black border border-white/20 text-white flex items-center justify-center hover:scale-110 transition-all shadow-xl">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
        )}
      </div>

      {/* Thumbnail tray */}
      {total > 1 && (
        <div className="flex-shrink-0 px-6 pb-5 pt-3 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-zinc-400 line-clamp-1 font-light">{project.tagline}</p>
            <span className="text-[10px] font-mono text-zinc-500 ml-4 flex-shrink-0">{idx + 1} / {total}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/20">
            {project.images.map((img, i) => (
              <button key={i} onClick={() => setIdx(i)} className={`relative flex-shrink-0 h-12 w-[72px] rounded-lg overflow-hidden border transition-all duration-200 ${i === idx ? "border-white ring-2 ring-white/40 scale-105" : "border-white/10 opacity-40 hover:opacity-80"}`}>
                <Image src={encodeURI(img)} alt="" fill unoptimized className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────
interface CardProps {
  project: ProjectItem;
  /** grid span classes, e.g. "col-span-12" */
  colSpan: string;
  /** min height class */
  minH?: string;
  /** show bigger title */
  hero?: boolean;
  /** interval between slides in ms */
  interval?: number;
}

function ProjectCard({ project, colSpan, minH = "min-h-[420px]", hero = false, interval = 3500 }: CardProps) {
  const [hovered, setHovered] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const tilt = useTilt(hero ? 5 : 8);
  const slide = useSlideshow(project.images, interval, hovered);

  const openLightbox = (idx: number) => {
    setLightboxIdx(idx);
    setLightboxOpen(true);
  };

  return (
    <>
      <div
        ref={tilt.ref}
        onMouseMove={tilt.onMove}
        onMouseLeave={() => { tilt.onLeave(); setHovered(false); }}
        onMouseEnter={() => setHovered(true)}
        onClick={() => window.open(project.link, "_blank", "noopener,noreferrer")}
        className={`${colSpan} ${minH} relative rounded-[26px] border border-white/[0.09] bg-[#0d0e10] overflow-hidden flex flex-col group cursor-pointer transition-[border-color,box-shadow] duration-500 hover:border-white/25 hover:shadow-[0_0_60px_-10px_rgba(255,255,255,0.08)]`}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* ── Image slideshow ─────────────────────────── */}
        <div
          className="absolute inset-0 overflow-hidden cursor-pointer"
          onClick={() => window.open(project.link, "_blank", "noopener,noreferrer")}
        >
          {/* Current image */}
          <Image
            key={`cur-${slide.index}`}
            src={encodeURI(project.images[slide.index])}
            alt={project.title}
            fill
            unoptimized
            className={`object-cover object-top transition-all duration-700 ease-out ${slide.fading ? "opacity-0" : "opacity-100 group-hover:scale-[1.04]"}`}
          />
          {/* Previous image (cross-fade) */}
          {slide.prevIndex !== null && (
            <Image
              key={`prev-${slide.prevIndex}`}
              src={encodeURI(project.images[slide.prevIndex])}
              alt=""
              fill
              unoptimized
              className={`object-cover object-top transition-opacity duration-500 ease-in-out ${slide.fading ? "opacity-100" : "opacity-0"}`}
            />
          )}

          {/* Dark gradient overlay — heavier at bottom so text is always legible */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10 pointer-events-none" />
          {/* Subtle radial glow from top-right on hover */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_10%,rgba(255,255,255,0.05),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
        </div>

        {/* ── Tier 1: Outer Glass Shelf (Category, Live Status, Direct URL) ── */}
        <div
          className="glass-popup-tier glass-tier-1 pointer-events-auto"
          onClick={() => window.open(project.link, "_blank", "noopener,noreferrer")}
        >
          <div className="flex items-center justify-between gap-3 text-xs pr-4 pt-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.08] border border-white/15 text-[10px] font-mono tracking-widest uppercase text-zinc-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {project.category.toUpperCase()} // ECOSYSTEM
            </span>

            <span className="text-[11px] font-mono text-zinc-300 hover:text-white flex items-center gap-1 transition-colors pr-2">
              {project.linkText || "Visit"} ↗
            </span>
          </div>
        </div>

        {/* ── Tier 2: Mid Glass Shelf (Feature Tags & Slideshow Controls) ── */}
        <div
          className="glass-popup-tier glass-tier-2 pointer-events-auto"
          onClick={() => window.open(project.link, "_blank", "noopener,noreferrer")}
        >
          <div className="flex items-center justify-between gap-2 pr-3 pt-1">
            {/* Feature tags */}
            <div className="flex items-center gap-1.5 flex-wrap max-w-[68%]">
              {project.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] px-2 py-0.5 rounded-full bg-white/[0.08] text-zinc-300 border border-white/10"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Slideshow interactive controls */}
            {project.images.length > 1 && (
              <div
                className="flex items-center gap-1 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={slide.goPrev}
                  className="px-2 py-0.5 rounded bg-white/[0.08] hover:bg-white/[0.2] border border-white/10 text-zinc-300 hover:text-white text-[10px] font-mono transition-all"
                  title="Previous image"
                >
                  ←
                </button>
                <button
                  onClick={slide.goNext}
                  className="px-2 py-0.5 rounded bg-white/[0.08] hover:bg-white/[0.2] border border-white/10 text-zinc-300 hover:text-white text-[10px] font-mono transition-all"
                  title="Next image"
                >
                  →
                </button>
                <button
                  onClick={() => openLightbox(slide.index)}
                  className="px-2 py-0.5 rounded bg-white/[0.08] hover:bg-white/[0.2] border border-white/10 text-zinc-300 hover:text-white text-[10px] font-mono transition-all"
                  title="Open gallery modal"
                >
                  {String(slide.index + 1).padStart(2, "0")}/{String(project.images.length).padStart(2, "0")}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Top badge row ────────────────────────────── */}
        <div className="relative z-10 flex items-start justify-between p-5 pb-2">
          {/* Badge pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {project.badge.split("//").map((part, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 border border-white/[0.12] backdrop-blur-md text-[10px] font-mono tracking-widest uppercase text-zinc-300"
              >
                {i === 0 && <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />}
                {part.trim()}
              </span>
            ))}
          </div>

          {/* Slide counter + expand */}
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            {project.images.length > 1 && (
              <span className="text-[10px] font-mono text-zinc-400 tabular-nums bg-black/50 border border-white/10 rounded-md px-2 py-0.5 backdrop-blur-md">
                {String(slide.index + 1).padStart(2, "0")}&thinsp;/&thinsp;{String(project.images.length).padStart(2, "0")}
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); openLightbox(slide.index); }}
              className="w-8 h-8 rounded-full bg-black/60 border border-white/15 backdrop-blur-md flex items-center justify-center text-zinc-300 hover:text-white hover:border-white/40 hover:scale-110 transition-all duration-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7V17" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Spacer pushes resting info to bottom ─────── */}
        <div className="flex-1" />

        {/* ── Resting Title (visible before hover, fades out when popup opens) ── */}
        <div className="relative z-10 px-5 pb-5 pt-3 transition-opacity duration-300 group-hover:opacity-0 pointer-events-none">
          <div className="flex items-end justify-between gap-3">
            <h3 className={`font-normal text-white tracking-tight leading-tight ${hero ? "text-2xl md:text-3xl" : "text-xl"}`}>
              {project.title}
            </h3>
            <span className="text-xs font-mono text-zinc-500">
              Details ↗
            </span>
          </div>
        </div>

        {/* ── Foreground: Main Liquid-Glass Pop-Up (Title, Tagline, Launch CTA) ── */}
        <div
          className="glass-popup-content"
          onClick={() => window.open(project.link, "_blank", "noopener,noreferrer")}
        >
          {/* Header row in popup */}
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <h3 className={`font-medium text-white tracking-tight leading-tight ${hero ? "text-xl md:text-2xl" : "text-lg"}`}>
              {project.title}
            </h3>
            <span className="text-[11px] font-mono text-zinc-400 group-hover:text-white flex items-center gap-1 transition-colors flex-shrink-0">
              Launch ↗
            </span>
          </div>

          {/* Tagline */}
          <p className="text-xs text-zinc-300/90 font-light leading-relaxed line-clamp-2">
            {project.tagline}
          </p>
        </div>
      </div>

      {lightboxOpen && (
        <Lightbox
          project={project}
          startIndex={lightboxIdx}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export default function BentoGrid() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.06 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  // Map project IDs to PROJECTS array entries for easy lookup
  const proj = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));

  return (
    <section
      ref={sectionRef}
      id="bento-section"
      className="relative bg-black text-white pt-24 pb-36 px-5 sm:px-8 md:px-12 lg:px-16 overflow-hidden"
    >
      {/* Top atmospheric gradient transition from ScrollSequence */}
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-black via-black/90 to-transparent pointer-events-none z-10" />

      {/* Faint ambient haze */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-zinc-800/[0.05] rounded-full blur-[160px] pointer-events-none" />

      <div
        className={`max-w-7xl mx-auto transition-all duration-1000 ease-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        {/* ── Section Header ───────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 mb-14 pb-10 border-b border-white/[0.08]">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-[10px] tracking-[0.25em] uppercase text-zinc-300 font-mono">
                VOID ECOSYSTEM · {PROJECTS.length} MODULES
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-[56px] font-normal tracking-tight text-white leading-tight">
              The Void Ecosystem
            </h2>
            <p className="mt-4 text-sm md:text-base text-zinc-400 font-light leading-relaxed max-w-2xl">
              Engineering minimal, high-performance streaming platforms, liquid glass desktop clients, Arch Linux utilities, and no-code design apparatus.
            </p>
          </div>

          <div className="flex-shrink-0 flex items-center gap-3 pt-2">
            <a
              href="https://github.com/voidbornfr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-white/20 text-xs font-mono tracking-wide text-zinc-200 hover:text-white hover:border-white/50 hover:bg-white/[0.05] transition-all duration-300"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              Explore GitHub
            </a>
            <a
              href="https://youtube.com/@voidbornfr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-red-500/30 bg-red-500/[0.05] text-xs font-mono tracking-wide text-zinc-200 hover:text-white hover:border-red-500/60 hover:bg-red-500/[0.12] transition-all duration-300"
            >
              <svg className="w-3.5 h-3.5 fill-red-500" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              YouTube
            </a>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            BENTO GRID — exact layout from reference image
            Row 1 : Voidverse  (full 12 cols)
            Row 2 : VoidAnime Desktop (7) + Voidloop (5)
            Row 3 : Voidcrafts (4) + Void-Files (4) + VoidDrops (4)
            Row 4 : VoidX Web  (4) + Voidverse API (4) + GitHub (4)
            Row 5 : YouTube (full 12)
        ═══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-12 gap-3 md:gap-5">

          {/* ── Row 1: Voidverse — hero full-width ────────── */}
          <ProjectCard
            project={proj["voidverse"]}
            colSpan="col-span-12"
            minH="min-h-[400px] sm:min-h-[520px] md:min-h-[620px]"
            hero
            interval={4000}
          />

          {/* ── Row 2: VoidAnime (7) + Voidloop (5) ──────── */}
          <ProjectCard
            project={proj["voidanime-desktop"]}
            colSpan="col-span-12 md:col-span-7"
            minH="min-h-[320px] sm:min-h-[420px] md:min-h-[460px]"
            interval={2800}
          />
          <ProjectCard
            project={proj["voidloop"]}
            colSpan="col-span-12 md:col-span-5"
            minH="min-h-[320px] sm:min-h-[420px] md:min-h-[460px]"
            interval={3200}
          />

          {/* ── Row 3: Voidcrafts (5) + Void-Files (4) + VoidDrops (3) — asymmetric */}
          <ProjectCard
            project={proj["voidcrafts"]}
            colSpan="col-span-12 md:col-span-5"
            minH="min-h-[320px] sm:min-h-[420px] md:min-h-[460px]"
            interval={3600}
          />
          <ProjectCard
            project={proj["void-files"]}
            colSpan="col-span-12 md:col-span-4"
            minH="min-h-[320px] sm:min-h-[420px] md:min-h-[460px]"
            interval={3000}
          />
          <ProjectCard
            project={proj["voiddrops"]}
            colSpan="col-span-12 md:col-span-3"
            minH="min-h-[320px] sm:min-h-[420px] md:min-h-[460px]"
            interval={3400}
          />

          {/* ── Row 4: VoidX Web (3) + Voidverse API (5) + GitHub (4) — asymmetric */}
          <ProjectCard
            project={proj["voidx-web"]}
            colSpan="col-span-12 md:col-span-3"
            minH="min-h-[320px] sm:min-h-[400px] md:min-h-[440px]"
            interval={4500}
          />
          <ProjectCard
            project={proj["voidverse-api"]}
            colSpan="col-span-12 md:col-span-5"
            minH="min-h-[320px] sm:min-h-[400px] md:min-h-[440px]"
            interval={4500}
          />
          <ProjectCard
            project={proj["github"]}
            colSpan="col-span-12 md:col-span-4"
            minH="min-h-[320px] sm:min-h-[400px] md:min-h-[440px]"
            interval={9999999}
          />

          {/* ── Row 5: YouTube — full width ───────────────── */}
          <ProjectCard
            project={proj["youtube"]}
            colSpan="col-span-12"
            minH="min-h-[360px] md:min-h-[420px]"
            interval={9999999}
          />

        </div>
      </div>
    </section>
  );
}
