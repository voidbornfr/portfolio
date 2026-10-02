# Implementation Plan: Performance + Mobile UI Overhaul

## Summary of findings

After reading all component files, the codebase is a Next.js 16 App Router project using React 19, Tailwind v4, @react-three/fiber v9, and three.js v0.186. Every component is a Client Component (`"use client"`). Key issues found:

**Highest-impact performance problems:**
- `page.tsx` fires `setMousePos` on **every** `mousemove` pixel (no RAF throttle) — causes re-render cascade including the reveal layer's CSS mask recalculation
- `BackgroundMusic.tsx` has `<audio preload="auto">` — downloads the weba file on page load before any interaction
- `SplashScreen.tsx` has no `devicePixelRatio` cap — on 3x Retina renders 9x the pixels
- `ProjectMap.tsx` ButterflyOverlay is a fixed fullscreen WebGL Canvas — always GPU-active when the section is in view
- No `next/dynamic` lazy imports for any heavy component — all Three.js, canvas, and audio code is in the initial bundle
- `ScrollSequence.tsx` runs its RAF loop 60fps even when off-screen

**Highest-impact mobile UI gaps:**
- Navbar has zero mobile menu — links are `hidden sm:block` with no hamburger
- All hover-based interactivity in `ProjectMap` is inaccessible on touch
- Marker tap targets are only 24×24px
- `AITerminal` input uses `text-sm` (14px) causing iOS auto-zoom
- BentoGrid glass popup tiers clip on mobile
- Game page has no touch controls

---

## (A) Performance

- [ ] 1. **RAF-throttled mouse tracking in page.tsx** (HIGHEST IMPACT)
      Replace the direct `setMousePos` call in `handleMouseMove` with a RAF-batched update: use `useRef<number>` for the raf id, schedule `requestAnimationFrame(() => setMousePos(...))` and cancel the pending frame before scheduling a new one. Detect touch devices on mount with `window.matchMedia('(pointer: coarse)')` and skip attaching the listener entirely on mobile.
      Files: `app/page.tsx`
      Verify: `npm run build` — exits 0

- [ ] 2. **Defer heavy components with next/dynamic in layout.tsx** (HIGHEST IMPACT)
      Wrap `BackgroundMusic`, `AITerminal`, and `SplashWrapper` in `dynamic(() => import(...), { ssr: false, loading: () => null })` in `layout.tsx`. This removes Three.js, audio, and the splash canvas from the initial JS bundle.
      Files: `app/layout.tsx`
      Verify: `npm run build` — exits 0

- [ ] 3. **Fix audio eager loading in BackgroundMusic.tsx** (HIGH IMPACT)
      Change `<audio preload="auto">` to `preload="none"`. The interaction-triggered autoplay already in the component handles deferred loading — `preload="auto"` is actively harmful here.
      Files: `components/BackgroundMusic.tsx`
      Verify: `npm run build` — exits 0

- [ ] 4. **Cap devicePixelRatio in SplashScreen.tsx**
      Change `const dpr = Math.min(window.devicePixelRatio || 1, 2)` to cap at `1.5`. Also reduce initial ready threshold from 35 frames to 20 so the animation starts faster on slow connections.
      Files: `components/SplashScreen.tsx`
      Verify: `npm run build` — exits 0

- [ ] 5. **Pause ScrollSequence RAF when off-screen** (HIGH IMPACT)
      Add an `IntersectionObserver` (threshold 0.01) to `ScrollSequence`. Store `isVisible` in a ref. In the RAF loop's `render()`, early-return without rescheduling when not visible. When the observer fires and becomes visible again, restart with `requestAnimationFrame(render)`.
      Files: `components/ScrollSequence.tsx`
      Verify: `npm run build` — exits 0

- [ ] 6. **Reduce ProjectMap Canvas cost** (HIGH IMPACT)
      a) Cap dpr: change `dpr={[1, 2]}` to `dpr={[1, 1.5]}` on the `ButterflyOverlay` Canvas.
      b) Disable antialias on touch/mobile: pass `gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}` on mobile (detect via `mapW < 640` or `window.matchMedia('(pointer: coarse)')`; on desktop keep `antialias: true`).
      Files: `components/ProjectMap.tsx`
      Verify: `npm run build` — exits 0

- [ ] 7. **Add image optimization to next.config.ts**
      Export `images: { formats: ['image/avif', 'image/webp'], minimumCacheTTL: 31536000 }`. This enables Vercel's edge to serve avif/webp and cache images for a year.
      Files: `next.config.ts`
      Verify: `npm run build` — exits 0

- [ ] 8. **Disable antialias in game Canvas** (nice-to-have)
      Change `gl={{ antialias: true }}` to `gl={{ antialias: false, powerPreference: 'high-performance' }}` and add `dpr={[1, 1.5]}`.
      Files: `app/game/page.tsx`
      Verify: `npm run build` — exits 0

- [ ] 9. **Add will-change hint to LogoCarousel marquee div**
      Add `style={{ willChange: 'transform' }}` to the inner marquee div in `MarqueeRow`. This is a micro-optimization but helps the browser promote the element to its own compositor layer.
      Files: `components/LogoCarousel.tsx`
      Verify: `npm run build` — exits 0

- [ ] 10. **Hide hero reveal layer on mobile**
      Render the reveal layer `<div>` (with `maskImage`) only when `!isTouchDevice`. On touch devices, render a simple static gradient overlay instead. This removes a composited layer from the mobile render entirely.
      Files: `app/page.tsx`
      Verify: `npm run build` — exits 0

---

## (B) Global Mobile UI

- [ ] 11. **Add hamburger mobile nav menu** (HIGHEST IMPACT — site has NO mobile nav)
      Add `menuOpen` state and a hamburger button (`sm:hidden`) in the Navbar section. When open, render a fixed full-screen overlay with navigation links (Projects, Ecosystem, GitHub). Links close the menu on click. Hamburger button must be at least 44×44px.
      Files: `app/page.tsx`
      Verify: `npm run build` — exits 0

- [ ] 12. **Fix AITerminal input font-size (iOS auto-zoom prevention)**
      Change the `<input>` `className` from `text-sm` to `text-base` (16px). iOS auto-zooms any input below 16px, which is jarring UX.
      Files: `components/AITerminal.tsx`
      Verify: `npm run build` — exits 0

- [ ] 13. **Reduce AITerminal height on mobile**
      Change `h-[70vh]` to `h-[55vh] sm:h-[550px]` so it doesn't cover the music player button.
      Files: `components/AITerminal.tsx`
      Verify: `npm run build` — exits 0

- [ ] 14. **Fix BentoGrid card heights on mobile**
      Change hero card from `min-h-[520px] md:min-h-[620px]` to `min-h-[360px] sm:min-h-[480px] md:min-h-[620px]`. Change other cards similarly. Add a CSS rule to hide `.glass-popup-tier` and `.glass-popup-content` on mobile — they clip outside the card bounds on small screens.
      Files: `components/BentoGrid.tsx`, `app/globals.css`
      Verify: `npm run build` — exits 0

- [ ] 15. **Add touch-action: manipulation globally**
      Add `button, a, [role="button"] { touch-action: manipulation; }` to `globals.css` to eliminate 300ms tap delay on iOS/Android.
      Files: `app/globals.css`
      Verify: `npm run build` — exits 0

- [ ] 16. **Add game touch controls** (nice-to-have but important for mobile UX)
      Detect touch device in `useEffect` and render four on-screen buttons (left, right, jump, roll) as a fixed bottom overlay. Each button is min 56×56px. Wire to the same `setLane`/`setIsJumping`/`setIsRolling` state the keyboard handlers use.
      Files: `app/game/page.tsx`
      Verify: `npm run build` — exits 0

- [ ] 17. **Fix ecosystem strip overflow on mobile hero**
      Change the brand link strip from `flex-wrap` to `overflow-x-auto pb-2` (single scrollable row) on mobile to prevent awkward wrapping.
      Files: `app/page.tsx`
      Verify: `npm run build` — exits 0

- [ ] 18. **Make section header CTAs full-width on mobile (BentoGrid, ProjectMap)**
      Add `w-full sm:w-auto justify-center sm:justify-start` to the GitHub and YouTube `<a>` buttons in both `BentoGrid.tsx` and `ProjectMap.tsx`.
      Files: `components/BentoGrid.tsx`, `components/ProjectMap.tsx`
      Verify: `npm run build` — exits 0

---

## (C) ProjectMap / Chart Your Course Mobile Overhaul

- [ ] 19. **Suppress butterfly Canvas entirely on mobile** (HIGHEST IMPACT)
      Change `{inSection && <ButterflyOverlay ...>}` to `{inSection && !isMobile && <ButterflyOverlay ...>}` where `isMobile` is `mapW < 640`.
      Files: `components/ProjectMap.tsx`
      Verify: `npm run build` — exits 0

- [ ] 20. **Auto-reveal trail on mobile via scroll position**
      In the proximity/reveal RAF loop, when the device is touch-only (no `mouseRef.current.active`), compute scroll-based trail progress: map the map section's scroll position within the viewport (top entering → bottom leaving = 0→1) to `progressRef.current`. This gives mobile users the satisfying trail-drawing effect automatically.
      Files: `components/ProjectMap.tsx`
      Verify: `npm run build` — exits 0

- [ ] 21. **Increase marker tap targets on mobile**
      In the `Marker` component, when `isMobile`, use `className='...w-11 h-11...'` (44px) for the outer div (the tap target), but keep the visual dot elements centered within it. The current 24px dot is below minimum tap target.
      Files: `components/ProjectMap.tsx`
      Verify: `npm run build` — exits 0

- [ ] 22. **Mobile bottom sheet for project preview** (HIGHEST IMPACT for mobile ProjectMap UX)
      Add `touchedId` state to the `ProjectMap` parent. In `Marker`, when `isMobile`, call `onTouch(project.id)` on `onClick` instead of `onOpen`. In `ProjectMap`, render a fixed bottom sheet when `touchedId !== null`: `position:fixed bottom-0 left-0 right-0`, `rounded-t-2xl`, `border-t border-white/20`, `bg-black/95 backdrop-blur-xl`, showing project title, tagline, an "Open ↗" link, and a "Gallery" button. Add a close X button and tap-outside-to-dismiss.
      Files: `components/ProjectMap.tsx`, `app/globals.css`
      Verify: `npm run build` — exits 0

- [ ] 23. **Simplify mobile legend**
      On mobile, hide the 'Sequential Trail', 'Uncharted territory', and 'Origin' legend items (add `hidden sm:flex` or `hidden sm:inline-flex`). Keep only the Treasure and EXPEDITION count.
      Files: `components/ProjectMap.tsx`
      Verify: `npm run build` — exits 0

- [ ] 24. **Replace butterfly instruction with mobile-friendly copy**
      When `isMobile`, replace the bottom instruction paragraph from "Guide the butterfly with your cursor..." to "Scroll to reveal the map • Tap any marker to explore".
      Files: `components/ProjectMap.tsx`
      Verify: `npm run build` — exits 0

- [ ] 25. **Add slide-up sheet animation in globals.css**
      Add `@keyframes slide-up-sheet { from { transform: translateY(100%); } to { transform: translateY(0); } }` and `.mobile-sheet-open { animation: slide-up-sheet 0.3s cubic-bezier(0.32, 0.72, 0, 1) both; }`. Add prefers-reduced-motion override.
      Files: `app/globals.css`
      Verify: `npm run build` — exits 0

---

## Behavior-altering changes (flagged per policy — do NOT remove features)

The following changes alter user-visible behavior and must be implemented carefully:
- Items 1, 10: Mouse reveal effect is hidden on mobile — **NOT removed on desktop**
- Item 3: Audio changes from eager to deferred loading — **No user-visible difference** since interaction is still required to unmute
- Item 19: 3D butterfly removed on mobile — **Feature preserved on desktop**
- Items 21–24: ProjectMap hover cards replaced with tap-to-open bottom sheet on mobile — **Desktop hover experience fully preserved**

---

## Verification

After all changes, run:
```
npm run build
```
from `c:\Users\lordr\Downloads\portfolio-3d` — must complete with exit code 0 and zero errors.
