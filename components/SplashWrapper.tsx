"use client";

import { usePathname } from "next/navigation";
import SplashScreen from "@/components/SplashScreen";

export default function SplashWrapper() {
  const pathname = usePathname();
  if (pathname === "/game") return null;
  return <SplashScreen />;
}
