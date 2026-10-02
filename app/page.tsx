"use client";

import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import ScrollSequence from "@/components/ScrollSequence";
import LogoCarousel from "@/components/LogoCarousel";
import ProjectMap from "@/components/ProjectMap";

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      
      // We can use a bit of lerp if we want, but simple tracking is fine and responsive
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("mouseenter", () => setIsHovering(true));
      container.addEventListener("mouseleave", () => setIsHovering(false));
    }

    return () => {
      if (container) {
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("mouseenter", () => setIsHovering(true));
        container.removeEventListener("mouseleave", () => setIsHovering(false));
      }
    };
  }, []);

  return (
    <main>
    <div 
      ref={containerRef}
      className="relative min-h-screen bg-black text-white font-sans overflow-hidden"
    >
      {/* Background Base Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/BG_IMAGE_1.png"
          alt="Base Background"
          fill
          priority
          className="object-cover object-center opacity-60"
        />
        {/* Gradient overlay to ensure text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-black/20 z-10" />
      </div>

      {/* Reveal Layer */}
      <div 
        className="absolute inset-0 z-10 pointer-events-none transition-opacity duration-500 ease-out"
        style={{
          opacity: isHovering ? 1 : 0,
          maskImage: `radial-gradient(260px circle at ${mousePos.x}px ${mousePos.y}px, black 30%, transparent 100%)`,
          WebkitMaskImage: `radial-gradient(260px circle at ${mousePos.x}px ${mousePos.y}px, black 30%, transparent 100%)`,
        }}
      >
        <Image
          src="/BG_IMAGE_2.png"
          alt="Reveal Background"
          fill
          priority
          className="object-cover object-center"
        />
      </div>

      {/* Content wrapper */}
      <div className="relative z-20 flex flex-col min-h-screen px-8 md:px-16 lg:px-24">
        
        {/* Navbar */}
        <nav className="flex items-center justify-between py-6 md:py-10">
          {/* Logo */}
          <a href="#" className="flex items-center group transition-opacity hover:opacity-90">
            <Image
              src="/logo.png"
              alt="VOID Logo"
              width={40}
              height={40}
              priority
              className="w-9 h-9 md:w-12 md:h-12 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.25)] group-hover:scale-105 transition-transform duration-300"
            />
          </a>
          
          {/* Right Actions */}
          <div className="flex items-center gap-8 text-xs tracking-widest uppercase font-medium">
            <a href="#ecosystem" className="hidden sm:block text-gray-400 hover:text-white transition-colors">Projects</a>
            <a href="#ecosystem" className="hidden sm:block text-gray-400 hover:text-white transition-colors">Ecosystem</a>
            <a href="https://github.com/voidbornfr" target="_blank" rel="noopener noreferrer" className="text-white hover:text-gray-300 transition-colors">GitHub</a>
          </div>
        </nav>

        {/* Main Hero Section - Super Minimal */}
        <section className="flex-1 flex flex-col justify-center max-w-2xl mt-12 lg:mt-0">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-6">
            System // 01
          </p>
          <h1 className="text-4xl md:text-6xl font-light leading-tight tracking-tight mb-8">
            Engineered in the <span className="font-medium text-white">shadows.</span><br />
            Driven by <span className="font-medium text-white">code.</span>
          </h1>
          
          <p className="text-sm md:text-base text-gray-400 max-w-md leading-relaxed mb-12 font-light">
            Crafting minimal, high-performance systems and custom digital platforms.
          </p>

          <div className="flex items-center gap-8">
            <a href="#ecosystem" className="group flex items-center gap-4 text-xs tracking-widest uppercase font-medium">
              <span className="w-8 h-[1px] bg-white group-hover:w-12 transition-all duration-300"></span>
              Explore Ecosystem
            </a>
          </div>
        </section>

        {/* Ecosystem Strip - Minimal */}
        <div className="py-10 mt-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8 border-t border-white/5">
          <p className="text-xs tracking-widest text-gray-500 uppercase">
            Ecosystem
          </p>
          <div className="flex flex-wrap items-center gap-8 md:gap-12 opacity-60">
            {['Voidverse', 'VoidAnime', 'Voidloop', 'Voidcrafts', 'Void-Files', 'VoidDrops'].map((brand, i) => (
              <a key={i} href="#ecosystem" className="text-xs tracking-widest uppercase text-white font-medium hover:text-gray-300 transition-colors cursor-pointer">
                {brand}
              </a>
            ))}
          </div>
        </div>

      </div>
    </div>
    
    <LogoCarousel />
    <ScrollSequence />
    <ProjectMap />
    </main>
  );
}
