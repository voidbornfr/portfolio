"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Sparkles, Sky, Environment, Float } from "@react-three/drei";

// A beautiful stylized low-poly pine tree
function LowPolyTree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {/* Trunk */}
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.4, 2, 6]} />
        <meshStandardMaterial color="#4e342e" roughness={0.9} flatShading />
      </mesh>
      
      {/* Leaves (3 tiers of cones) */}
      <mesh position={[0, 2.5, 0]} castShadow>
        <coneGeometry args={[1.8, 3, 7]} />
        <meshStandardMaterial color="#2e7d32" roughness={0.8} flatShading />
      </mesh>
      <mesh position={[0, 4, 0]} castShadow>
        <coneGeometry args={[1.4, 2.5, 7]} />
        <meshStandardMaterial color="#388e3c" roughness={0.8} flatShading />
      </mesh>
      <mesh position={[0, 5.2, 0]} castShadow>
        <coneGeometry args={[1.0, 2, 7]} />
        <meshStandardMaterial color="#4caf50" roughness={0.8} flatShading />
      </mesh>
    </group>
  );
}

// Glowing crystal floating
function FloatingCrystal({ position }: { position: [number, number, number] }) {
  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1} floatingRange={[0, 1]}>
      <mesh position={position}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial 
          color="#00ffff" 
          emissive="#00ffff" 
          emissiveIntensity={1.5} 
          roughness={0.1} 
          metalness={0.8} 
          transparent 
          opacity={0.9} 
          flatShading
        />
      </mesh>
    </Float>
  );
}

export function BeautifulWorld({ speedRef }: { speedRef: React.MutableRefObject<number> }) {
  const sceneryRef = useRef<THREE.Group>(null);
  
  // Create stylized trees and crystals
  const sceneryData = useMemo(() => {
    const items = [];
    for (let i = 0; i < 60; i++) {
      const isLeft = i % 2 === 0;
      const x = (isLeft ? -1 : 1) * (8 + Math.random() * 15);
      const z = -i * 15 - Math.random() * 10;
      const type = Math.random() > 0.8 ? "crystal" : "tree";
      items.push({ id: i, type, x, z, scale: 0.8 + Math.random() * 0.7 });
    }
    return items;
  }, []);

  useFrame((state, delta) => {
    if (!sceneryRef.current) return;
    const dt = Math.min(delta, 0.1);
    const moveZ = speedRef.current * dt;
    
    // Move scenery towards camera
    sceneryRef.current.children.forEach((item) => {
      item.position.z += moveZ;
      if (item.position.z > 20) {
        item.position.z -= 900;
      }
    });
  });

  return (
    <>
      {/* Ambient and sky lighting */}
      <ambientLight intensity={0.5} color="#ffb6c1" />
      <directionalLight position={[20, 30, -20]} intensity={1.5} color="#ffdfba" castShadow shadow-mapSize={[2048, 2048]} />
      
      {/* Beautiful Sky (Sunset/Magical look) */}
      <Sky distance={450000} sunPosition={[0, 1, -10]} inclination={0.6} azimuth={0.25} rayleigh={2} turbidity={10} mieCoefficient={0.005} />
      
      {/* Floating magical fireflies */}
      <Sparkles count={300} scale={80} size={6} speed={0.4} opacity={0.8} color="#ffffaa" />
      <Sparkles count={200} scale={80} size={4} speed={0.5} opacity={0.6} color="#ffb6c1" />

      {/* Moving Scenery */}
      <group ref={sceneryRef}>
        {sceneryData.map((s) => (
          s.type === "tree" ? (
            <LowPolyTree key={s.id} position={[s.x, 0, s.z]} scale={s.scale} />
          ) : (
            <FloatingCrystal key={s.id} position={[s.x, 4, s.z]} />
          )
        ))}
      </group>
      
      {/* Infinite Grass Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, -100]} receiveShadow>
        <planeGeometry args={[200, 800]} />
        <meshStandardMaterial color="#689f38" roughness={1} flatShading /> 
      </mesh>

      {/* Dirt Path in the middle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -100]} receiveShadow>
        <planeGeometry args={[10, 800]} />
        <meshStandardMaterial color="#8d6e63" roughness={1} />
      </mesh>

      {/* Magical River / Waterfall */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-25, -0.3, -100]} receiveShadow>
        <planeGeometry args={[20, 800]} />
        <meshStandardMaterial color="#00e5ff" roughness={0.1} metalness={0.8} transparent opacity={0.8} />
      </mesh>
      
      {/* Glowing River Banks */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-15, -0.2, -100]} receiveShadow>
        <planeGeometry args={[2, 800]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.5} />
      </mesh>
      
      {/* Fog for depth and masking spawn pop-in */}
      <fog attach="fog" args={["#ffb6c1", 50, 200]} />
    </>
  );
}
