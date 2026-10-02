"use client";

import dynamic from "next/dynamic";

const BackgroundMusic = dynamic(() => import("@/components/BackgroundMusic"), {
  ssr: false,
  loading: () => null,
});

const AITerminal = dynamic(() => import("@/components/AITerminal"), {
  ssr: false,
  loading: () => null,
});

const SplashWrapper = dynamic(() => import("@/components/SplashWrapper"), {
  ssr: false,
  loading: () => null,
});

/** Client-only shell that lazy-loads all heavy client-side-only components. */
export default function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SplashWrapper />
      {children}
      <AITerminal />
      <BackgroundMusic />
    </>
  );
}
