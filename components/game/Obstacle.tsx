"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export function Obstacle({
  type,
  obstacleRef
}: {
  type: "cylinder" | "up" | "down" | "spotted";
  obstacleRef: React.RefObject<THREE.Group | null>;
}) {
  const modelPath = useMemo(() => {
    switch (type) {
      case "cylinder": return "/game/obstacle/cylinder_obstacle.glb";
      case "up": return "/game/obstacle/up_obstacle.glb";
      case "down": return "/game/obstacle/down_obstacle.glb";
      case "spotted": return "/game/obstacle/spoetted_cylinder_obstacle.glb";
      default: return "/game/obstacle/cylinder_obstacle.glb";
    }
  }, [type]);

  const gltf = useGLTF(modelPath);
  
  // Clone scene so multiple instances can have different properties if needed
  const scene = useMemo(() => {
    const clone = gltf.scene.clone();
    clone.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        // Apply a solid wood material to the obstacles (CORS-safe)
        (node as THREE.Mesh).material = new THREE.MeshStandardMaterial({
          color: type === "up" ? "#4e342e" : "#5d4037", // Dark brown wood
          roughness: 0.9,
          metalness: 0.0,
          flatShading: true
        });
        (node as THREE.Mesh).castShadow = true;
        (node as THREE.Mesh).receiveShadow = true;
      }
    });
    return clone;
  }, [gltf.scene]);

  return (
    <group ref={obstacleRef} scale={0.5} position={[0, -999, 0]}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload("/game/obstacle/cylinder_obstacle.glb");
useGLTF.preload("/game/obstacle/up_obstacle.glb");
useGLTF.preload("/game/obstacle/down_obstacle.glb");
useGLTF.preload("/game/obstacle/spoetted_cylinder_obstacle.glb");
