"use client";

import { useEffect, useRef, useState } from "react";

export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  // Default to playing true so it is by default active
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const userPausedRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.55;
    audio.loop = true;
    audio.muted = false;

    const onPlay = () => {
      setIsPlaying(true);
    };

    const onPause = () => {
      if (userPausedRef.current) {
        setIsPlaying(false);
      }
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    // Eager playback function - always attempts unmuted audio
    const playAudio = () => {
      if (!audio || userPausedRef.current) return;
      audio.muted = false;
      audio.volume = 0.55;

      const promise = audio.play();
      if (promise !== undefined) {
        promise
          .then(() => {
            setIsPlaying(true);
            removeAutoPlayListeners();
          })
          .catch(() => {
            // Autoplay unmuted awaiting user interaction
          });
      }
    };

    // Attempt playback immediately on entrance
    playAudio();

    // Trigger playback on ANY activity (mouse movement, pointer, scroll, wheel, click, key)
    const interactionEvents: (keyof WindowEventMap)[] = [
      "mousemove",
      "pointermove",
      "pointerdown",
      "click",
      "touchstart",
      "keydown",
      "wheel",
      "scroll",
      "focus",
    ];

    const onInteraction = (e: Event) => {
      if (userPausedRef.current) return;
      if (
        buttonRef.current &&
        e.target instanceof Node &&
        buttonRef.current.contains(e.target)
      ) {
        return;
      }
      playAudio();
    };

    const removeAutoPlayListeners = () => {
      interactionEvents.forEach((ev) => {
        window.removeEventListener(ev, onInteraction, { capture: true } as any);
        document.removeEventListener(ev, onInteraction, { capture: true } as any);
      });
    };

    interactionEvents.forEach((ev) => {
      window.addEventListener(ev, onInteraction, { capture: true, passive: true });
      document.addEventListener(ev, onInteraction, { capture: true, passive: true });
    });

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      removeAutoPlayListeners();
    };
  }, []);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying && !audio.paused) {
      userPausedRef.current = true;
      audio.pause();
      setIsPlaying(false);
    } else {
      userPausedRef.current = false;
      audio.muted = false;
      setIsMuted(false);
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(console.error);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
    if (!audio.muted && audio.paused && !userPausedRef.current) {
      audio.play().catch(() => {});
    }
  };

  return (
    <>
      {/* Hidden audio element with autoPlay */}
      <audio
        ref={audioRef}
        src="/audio/music.weba"
        preload="auto"
        loop
        playsInline
        autoPlay
      />

      {/* Floating Ambient Music Controller */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 select-none">
        <button
          ref={buttonRef}
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause background music" : "Play background music"}
          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-full border backdrop-blur-xl transition-all duration-300 shadow-2xl ${
            isPlaying && !isMuted
              ? "bg-black/85 border-white/25 text-white shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:border-white/50"
              : isPlaying && isMuted
              ? "bg-black/75 border-amber-500/40 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:border-amber-400/60"
              : "bg-black/60 border-white/10 text-zinc-400 hover:text-white hover:border-white/30"
          }`}
        >
          {/* Animated sound equalizer bars */}
          <div className="flex items-center gap-[3px] h-3.5 w-3.5 justify-center">
            <span
              className={`w-[2.5px] rounded-full transition-all duration-300 ${
                isPlaying && !isMuted
                  ? "bg-white animate-[bounce_0.8s_ease-in-out_infinite] h-3.5"
                  : "h-1 bg-zinc-500"
              }`}
            />
            <span
              className={`w-[2.5px] rounded-full transition-all duration-300 ${
                isPlaying && !isMuted
                  ? "bg-white animate-[bounce_1.1s_ease-in-out_infinite_0.2s] h-2.5"
                  : "h-1 bg-zinc-500"
              }`}
            />
            <span
              className={`w-[2.5px] rounded-full transition-all duration-300 ${
                isPlaying && !isMuted
                  ? "bg-white animate-[bounce_0.9s_ease-in-out_infinite_0.4s] h-3"
                  : "h-1 bg-zinc-500"
              }`}
            />
          </div>

          <span className="text-[11px] font-mono tracking-wider uppercase font-medium">
            {isPlaying && !isMuted
              ? "OST // PLAYING"
              : isPlaying && isMuted
              ? "OST // MUTED"
              : "OST // PAUSED"}
          </span>

          {/* Quick mute / unmute button */}
          <span
            onClick={toggleMute}
            className="ml-1 text-zinc-400 hover:text-white p-0.5 rounded transition-colors"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <svg
                className="w-3.5 h-3.5 text-amber-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                />
              </svg>
            ) : (
              <svg
                className="w-3.5 h-3.5 text-zinc-300"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
              </svg>
            )}
          </span>
        </button>
      </div>
    </>
  );
}
