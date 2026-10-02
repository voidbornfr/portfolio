"use client";

import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export function Player({
  lane,
  isJumping,
  isRolling,
  speed
}: {
  lane: number;
  isJumping: boolean;
  isRolling: boolean;
  speed: number;
}) {
  const gltf = useGLTF("/game/male player/male-player.glb"); // We use male as it has simpler Mixamo standard bone names for procedural anim
  const groupRef = useRef<THREE.Group>(null);
  const currentX = useRef(0);
  const currentY = useRef(0);
  const currentZRotation = useRef(0);
  
  // Find bones for procedural animation
  const bones = useMemo(() => {
    const b: Record<string, THREE.Bone> = {};
    gltf.scene.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        (node as THREE.Mesh).castShadow = true;
      }
      
      const n = node as THREE.Bone;
      if (n.isBone) {
        const name = n.name.toLowerCase();
        if (name.includes("leftupleg") || name.includes("leg_l")) b.leftLeg = n;
        else if (name.includes("rightupleg") || name.includes("leg_r")) b.rightLeg = n;
        else if (name.includes("leftleg") || name.includes("knee_l")) b.leftKnee = n;
        else if (name.includes("rightleg") || name.includes("knee_r")) b.rightKnee = n;
        else if (name.includes("leftarm") || name.includes("shoulder_l")) b.leftArm = n;
        else if (name.includes("rightarm") || name.includes("shoulder_r")) b.rightArm = n;
        else if (name.includes("leftforearm") || name.includes("elbow_l")) b.leftElbow = n;
        else if (name.includes("rightforearm") || name.includes("elbow_r")) b.rightElbow = n;
        else if (name.includes("spine") && !b.spine) b.spine = n;
        else if (name.includes("neck")) b.neck = n;
      }
    });
    return b;
  }, [gltf.scene]);

  const timeRef = useRef(0);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.1);
    
    // Lane movement (smooth transition with leaning)
    const targetX = lane * 3; // Lane width = 3
    const diffX = targetX - currentX.current;
    currentX.current += diffX * dt * 10;
    
    // Lean character into the turn
    const targetLean = diffX * -0.15; // Lean left/right based on movement
    groupRef.current.rotation.z += (targetLean - groupRef.current.rotation.z) * dt * 8;
    
    // Jump / Roll movement
    const targetY = isJumping ? 2.5 : 0;
    currentY.current += (targetY - currentY.current) * dt * 12;
    
    // Roll rotation
    const targetZRotation = isRolling ? Math.PI / 2.2 : 0;
    currentZRotation.current += (targetZRotation - currentZRotation.current) * dt * 12;

    groupRef.current.position.x = currentX.current;
    groupRef.current.position.y = currentY.current;
    groupRef.current.rotation.x = currentZRotation.current; // Lean back/forward when rolling

    // Procedural Run Animation
    timeRef.current += dt * speed * 0.15; // Slower, more realistic run speed
    const t = timeRef.current;
    
    // Slow down the multiplier dramatically
    const runCycle = Math.sin(t);
    const runCycleCos = Math.cos(t);
    
    // Bouncy root
    if (!isJumping && !isRolling) {
      groupRef.current.position.y = currentY.current + Math.abs(runCycleCos) * 0.2;
    } else {
      groupRef.current.position.y = currentY.current;
    }

    if (bones.leftLeg) bones.leftLeg.rotation.x = runCycle * 0.7;
    if (bones.rightLeg) bones.rightLeg.rotation.x = -runCycle * 0.7;
    
    // Knees bend backward when the leg goes back
    if (bones.leftKnee) bones.leftKnee.rotation.x = runCycle < 0 ? runCycle * 1.5 : 0;
    if (bones.rightKnee) bones.rightKnee.rotation.x = runCycle > 0 ? -runCycle * 1.5 : 0;

    // Arms: Keep them mostly down with very subtle movement
    if (bones.leftArm) {
      bones.leftArm.rotation.x = -runCycle * 0.25;
      bones.leftArm.rotation.z = 0.1; 
    }
    if (bones.rightArm) {
      bones.rightArm.rotation.x = runCycle * 0.25;
      bones.rightArm.rotation.z = -0.1;
    }
    if (bones.leftElbow) bones.leftElbow.rotation.x = Math.max(0, -runCycleCos * 0.15);
    if (bones.rightElbow) bones.rightElbow.rotation.x = Math.max(0, runCycleCos * 0.15);

    if (bones.spine) {
      bones.spine.rotation.y = runCycle * 0.05; // Less torso twist
      bones.spine.rotation.z = runCycle * 0.02; // Less side sway
      bones.spine.rotation.x = isRolling ? -0.2 : 0.05; 
    }
  });

  return (
    <group ref={groupRef} dispose={null} scale={0.8} position={[0, 0, 0]}>
      {/* Rotate character to face forward (away from camera) */}
      <group rotation={[0, Math.PI, 0]}>
        <primitive object={gltf.scene} />
      </group>
    </group>
  );
}

useGLTF.preload("/game/male player/male-player.glb");
