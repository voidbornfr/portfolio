"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, createRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Player } from "@/components/game/Player";
import { Obstacle } from "@/components/game/Obstacle";
import { BeautifulWorld } from "@/components/game/FairytaleWorld";
import Link from "next/link";
import * as THREE from "three";

const POOL_SIZE = 10;
const INITIAL_SPEED = 15; // Set base speed

type ObstacleData = {
  active: boolean;
  type: "up" | "down";
  lane: number;
  z: number;
};

function GameScene({
  isPlaying,
  onGameOver,
  onScoreUpdate,
  onControlsReady,
}: {
  isPlaying: boolean;
  onGameOver: () => void;
  onScoreUpdate: (score: number) => void;
  onControlsReady?: (controls: {
    moveLeft: () => void;
    moveRight: () => void;
    jump: () => void;
    roll: () => void;
  }) => void;
}) {
  const [lane, setLane] = useState(0); // -1, 0, 1
  const [isJumping, setIsJumping] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  
  // Fixed pool of obstacles
  const pool = useRef<ObstacleData[]>(
    Array.from({ length: POOL_SIZE }, () => ({ active: false, type: "up", lane: 0, z: -999 }))
  );
  
  const obstacleRefs = useRef<React.RefObject<THREE.Group | null>[]>([]);
  if (obstacleRefs.current.length !== POOL_SIZE) {
    obstacleRefs.current = Array(POOL_SIZE).fill(null).map(() => createRef<THREE.Group>());
  }

  const speedRef = useRef(INITIAL_SPEED);
  const scoreRef = useRef(0);
  const nextSpawnZRef = useRef(-20);
  
  const jumpTimer = useRef<NodeJS.Timeout | null>(null);
  const rollTimer = useRef<NodeJS.Timeout | null>(null);

  // Expose touch control handlers to parent
  useEffect(() => {
    if (!onControlsReady) return;
    const moveLeft  = () => { if (!isPlaying) return; setLane((l) => Math.max(-1, l - 1)); };
    const moveRight = () => { if (!isPlaying) return; setLane((l) => Math.min(1, l + 1)); };
    const jump = () => {
      if (!isPlaying || isJumping || isRolling) return;
      setIsJumping(true);
      if (jumpTimer.current) clearTimeout(jumpTimer.current);
      jumpTimer.current = setTimeout(() => setIsJumping(false), 800);
    };
    const roll = () => {
      if (!isPlaying || isJumping || isRolling) return;
      setIsRolling(true);
      if (rollTimer.current) clearTimeout(rollTimer.current);
      rollTimer.current = setTimeout(() => setIsRolling(false), 800);
    };
    onControlsReady({ moveLeft, moveRight, jump, roll });
  }, [onControlsReady, isPlaying, isJumping, isRolling]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      if (e.key === "ArrowLeft" || e.key === "a") setLane((l) => Math.max(-1, l - 1));
      if (e.key === "ArrowRight" || e.key === "d") setLane((l) => Math.min(1, l + 1));
      if ((e.key === "ArrowUp" || e.key === "w" || e.key === " ") && !isJumping && !isRolling) {
        setIsJumping(true);
        if (jumpTimer.current) clearTimeout(jumpTimer.current);
        jumpTimer.current = setTimeout(() => setIsJumping(false), 800);
      }
      if ((e.key === "ArrowDown" || e.key === "s") && !isJumping && !isRolling) {
        setIsRolling(true);
        if (rollTimer.current) clearTimeout(rollTimer.current);
        rollTimer.current = setTimeout(() => setIsRolling(false), 800);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, isJumping, isRolling]);

  // Game Loop
  useFrame((state, delta) => {
    if (!isPlaying) return;
    const dt = Math.min(delta, 0.1);
    
    // Increase difficulty gradually based on score!
    // Start at INITIAL_SPEED and slowly increase maxing out around 35
    speedRef.current = INITIAL_SPEED + Math.min(scoreRef.current / 100, 20);
    
    scoreRef.current += dt * speedRef.current * 0.1;
    onScoreUpdate(Math.floor(scoreRef.current));
    
    // Move obstacles
    const moveZ = speedRef.current * dt;
    let furthestZ = 10;
    
    for (let i = 0; i < POOL_SIZE; i++) {
      const obs = pool.current[i];
      const ref = obstacleRefs.current[i].current;
      if (!obs.active || !ref) {
        if (ref) {
          ref.position.y = -999;
        }
        continue;
      }
      
      obs.z += moveZ;
      ref.position.set(obs.lane * 3, 0, obs.z);
      
      if (obs.z < furthestZ) {
        furthestZ = obs.z;
      }
      
      // Collision detection (Player is at z=0)
      if (obs.z > -1.5 && obs.z < 1.5) {
        if (obs.lane === lane) {
          let collided = false;
          // 'up' means jump OVER it, 'down' means roll UNDER it.
          if (obs.type === "up" && !isJumping) collided = true;
          else if (obs.type === "down" && !isRolling) collided = true;
          
          if (collided) {
            onGameOver();
            return;
          }
        }
      }
      
      // Remove passed obstacles
      if (obs.z > 10) {
        obs.active = false;
        ref.position.y = -999;
      }
    }
    
    // Spawn new obstacles
    if (furthestZ > nextSpawnZRef.current) {
      // Find inactive obstacle in pool
      const inactiveIdx = pool.current.findIndex(o => !o.active);
      if (inactiveIdx !== -1) {
        const types: ObstacleData["type"][] = ["up", "down"];
        pool.current[inactiveIdx] = {
          active: true,
          type: types[Math.floor(Math.random() * types.length)],
          lane: Math.floor(Math.random() * 3) - 1,
          z: -100, // Spawn far away
        };
        nextSpawnZRef.current = -100 + (Math.random() * 30 + 15); // Next spawn gap
      }
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 5]} intensity={1.5} color="#ffffff" castShadow />
      
      <BeautifulWorld speedRef={speedRef} />

      <Player lane={lane} isJumping={isJumping} isRolling={isRolling} speed={speedRef.current} />

      {pool.current.map((obs, i) => (
        <Obstacle key={i} type={obs.type} obstacleRef={obstacleRefs.current[i]} />
      ))}
    </>
  );
}

export default function GamePage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameKey, setGameKey] = useState(0);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Stable ref to control callbacks exposed by GameScene
  const controlsRef = useRef<{
    moveLeft: () => void;
    moveRight: () => void;
    jump: () => void;
    roll: () => void;
  } | null>(null);

  useEffect(() => {
    // Load high score on mount
    const saved = localStorage.getItem("voidRunnerHighScore");
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  useEffect(() => {
    // Detect touch devices
    if ("ontouchstart" in window) {
      setIsTouchDevice(true);
    }
  }, []);

  const handleControlsReady = useCallback((controls: {
    moveLeft: () => void;
    moveRight: () => void;
    jump: () => void;
    roll: () => void;
  }) => {
    controlsRef.current = controls;
  }, []);

  const startGame = () => {
    setIsPlaying(true);
    setGameOver(false);
    setScore(0);
    setGameKey(k => k + 1);
  };

  const handleGameOver = useCallback(() => {
    setIsPlaying(false);
    setGameOver(true);
    setScore((currentScore) => {
      if (currentScore > highScore) {
        setHighScore(currentScore);
        localStorage.setItem("voidRunnerHighScore", currentScore.toString());
      }
      return currentScore;
    });
  }, [highScore]);

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative font-mono text-white">
      {/* UI Overlay */}
      <div className="absolute top-6 left-6 z-10 flex gap-4">
        <Link href="/" className="px-4 py-2 border border-white/20 rounded-full hover:bg-white/10 transition">
          ← Exit
        </Link>
        <div className="px-4 py-2 border border-white/20 rounded-full bg-black/50 backdrop-blur">
          Score: {score}
        </div>
        <div className="px-4 py-2 border border-[#ffd700]/50 text-[#ffd700] rounded-full bg-black/50 backdrop-blur">
          High Score: {highScore}
        </div>
      </div>

      {(!isPlaying || gameOver) && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm px-6">
          <h1 className="text-3xl sm:text-5xl font-bold mb-4 tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-300 to-gray-500 text-center">
            {gameOver ? "GAME OVER" : "VOID RUNNER"}
          </h1>
          {gameOver && <p className="mb-8 text-xl text-gray-400 text-center">Final Score: {score}</p>}
          {!gameOver && (
            <p className="mb-8 text-sm text-gray-500 max-w-sm text-center px-6">
              {isTouchDevice
                ? "Use the on-screen D-pad to move left/right, jump, and roll."
                : "Use ARROW KEYS or WASD to move left/right. UP to Jump, DOWN to Roll."}
            </p>
          )}
          <button
            onClick={startGame}
            className="px-8 py-3 bg-white text-black font-bold tracking-widest hover:bg-gray-200 transition rounded shadow-[0_0_20px_rgba(255,255,255,0.4)]"
          >
            {gameOver ? "RETRY" : "START"}
          </button>
        </div>
      )}

      <Canvas
        camera={{ position: [0, 6, 12], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        {/* Vibrant Fantasy Sky Background */}
        <color attach="background" args={["#87CEEB"]} />
        <GameScene
          key={gameKey}
          isPlaying={isPlaying}
          onGameOver={handleGameOver}
          onScoreUpdate={setScore}
          onControlsReady={handleControlsReady}
        />
      </Canvas>

      {/* Touch D-pad — visible only on touch devices */}
      {isTouchDevice && (
        <div className="absolute bottom-8 left-0 right-0 z-10 flex items-end justify-between px-6 pointer-events-none">
          {/* Left / Right cluster */}
          <div className="flex items-center gap-3 pointer-events-auto">
            <button
              onTouchStart={(e) => { e.preventDefault(); controlsRef.current?.moveLeft(); }}
              className="w-14 h-14 rounded-full bg-black/60 border border-white/30 backdrop-blur flex items-center justify-center text-white text-xl active:bg-white/20 transition-colors"
              aria-label="Move left"
            >
              ◀
            </button>
            <button
              onTouchStart={(e) => { e.preventDefault(); controlsRef.current?.moveRight(); }}
              className="w-14 h-14 rounded-full bg-black/60 border border-white/30 backdrop-blur flex items-center justify-center text-white text-xl active:bg-white/20 transition-colors"
              aria-label="Move right"
            >
              ▶
            </button>
          </div>

          {/* Jump / Roll cluster */}
          <div className="flex items-center gap-3 pointer-events-auto">
            <button
              onTouchStart={(e) => { e.preventDefault(); controlsRef.current?.roll(); }}
              className="w-14 h-14 rounded-full bg-black/60 border border-white/30 backdrop-blur flex items-center justify-center text-white text-xs font-bold active:bg-white/20 transition-colors"
              aria-label="Roll"
            >
              ROLL
            </button>
            <button
              onTouchStart={(e) => { e.preventDefault(); controlsRef.current?.jump(); }}
              className="w-14 h-14 rounded-full bg-black/60 border border-white/30 backdrop-blur flex items-center justify-center text-white text-xl active:bg-white/20 transition-colors"
              aria-label="Jump"
            >
              ▲
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
