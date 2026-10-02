import type { Metadata } from "next";
import { Black_Ops_One, Geist_Mono } from "next/font/google";
import "./globals.css";
import BackgroundMusic from "@/components/BackgroundMusic";
import SplashWrapper from "@/components/SplashWrapper";
import AITerminal from "@/components/AITerminal";

const blackOpsOne = Black_Ops_One({
  variable: "--font-black-ops-one",
  weight: "400",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VOID // Voidborn Ecosystem",
  description: "Next-generation streaming platforms, liquid-glass desktop applications, Arch Linux utilities, and no-code builders engineered by voidborn.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${blackOpsOne.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SplashWrapper />
        {children}
        <AITerminal />
        <BackgroundMusic />
      </body>
    </html>
  );
}
