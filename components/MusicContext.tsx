"use client";

import React, { createContext, useContext, useRef, useCallback } from "react";

/**
 * Shared context that lets the AI terminal pause/resume the site's
 * background music without either component knowing about the other.
 *
 * BackgroundMusic registers its audio element via `registerBgAudio`.
 * AITerminal calls `pauseBgMusic` / `resumeBgMusic` around AI playback.
 */
interface MusicContextValue {
  /** Called by BackgroundMusic to hand off its audio ref */
  registerBgAudio: (audio: HTMLAudioElement) => void;
  /** Pause BG music (called when AI starts playing a song) */
  pauseBgMusic: () => void;
  /** Resume BG music (called when AI song finishes / is paused) */
  resumeBgMusic: () => void;
}

const MusicContext = createContext<MusicContextValue>({
  registerBgAudio: () => {},
  pauseBgMusic: () => {},
  resumeBgMusic: () => {},
});

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  // Track whether we paused it so we don't resume something the user stopped
  const wePausedItRef = useRef(false);

  const registerBgAudio = useCallback((audio: HTMLAudioElement) => {
    bgAudioRef.current = audio;
  }, []);

  const pauseBgMusic = useCallback(() => {
    const audio = bgAudioRef.current;
    if (audio && !audio.paused) {
      audio.pause();
      wePausedItRef.current = true;
    }
  }, []);

  const resumeBgMusic = useCallback(() => {
    const audio = bgAudioRef.current;
    if (audio && wePausedItRef.current) {
      audio.play().catch(() => {});
      wePausedItRef.current = false;
    }
  }, []);

  return (
    <MusicContext.Provider value={{ registerBgAudio, pauseBgMusic, resumeBgMusic }}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusicContext() {
  return useContext(MusicContext);
}
