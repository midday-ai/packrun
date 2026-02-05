"use client";

import { OrbitControls, Sphere, Stars, Text } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

// Developer hotspots weighted by approximate developer population
const DEVELOPER_HOTSPOTS = [
  { lat: 37.7749, lng: -122.4194, weight: 0.12 }, // San Francisco
  { lat: 40.7128, lng: -74.006, weight: 0.1 }, // New York
  { lat: 51.5074, lng: -0.1278, weight: 0.1 }, // London
  { lat: 52.52, lng: 13.405, weight: 0.06 }, // Berlin
  { lat: 48.8566, lng: 2.3522, weight: 0.05 }, // Paris
  { lat: 35.6762, lng: 139.6503, weight: 0.08 }, // Tokyo
  { lat: 37.5665, lng: 126.978, weight: 0.05 }, // Seoul
  { lat: 31.2304, lng: 121.4737, weight: 0.06 }, // Shanghai
  { lat: 22.3193, lng: 114.1694, weight: 0.04 }, // Hong Kong
  { lat: 1.3521, lng: 103.8198, weight: 0.04 }, // Singapore
  { lat: 12.9716, lng: 77.5946, weight: 0.06 }, // Bangalore
  { lat: 19.076, lng: 72.8777, weight: 0.04 }, // Mumbai
  { lat: -23.5505, lng: -46.6333, weight: 0.04 }, // São Paulo
  { lat: 55.7558, lng: 37.6173, weight: 0.04 }, // Moscow
  { lat: 50.1109, lng: 8.6821, weight: 0.03 }, // Frankfurt
  { lat: 45.4642, lng: 9.19, weight: 0.03 }, // Milan
  { lat: 59.3293, lng: 18.0686, weight: 0.02 }, // Stockholm
  { lat: 47.3769, lng: 8.5417, weight: 0.02 }, // Zurich
  { lat: -33.8688, lng: 151.2093, weight: 0.02 }, // Sydney
];

export interface PackageUpdate {
  id: string;
  name: string;
  timestamp: number;
  lat: number;
  lng: number;
  opacity: number;
}

// Global package store - this avoids re-renders
const packageStore = {
  packages: [] as PackageUpdate[],
  version: 0,
};

export function addPackageToStore(pkg: PackageUpdate) {
  packageStore.packages = [pkg, ...packageStore.packages].slice(0, 100);
  packageStore.version++;
}

export function getPackagesFromStore() {
  return packageStore.packages;
}

// Convert lat/lng to 3D position on sphere
function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

// Generate a random location weighted by developer hotspots
export function getRandomLocation(): { lat: number; lng: number } {
  const rand = Math.random();
  let cumulative = 0;

  for (const hotspot of DEVELOPER_HOTSPOTS) {
    cumulative += hotspot.weight;
    if (rand <= cumulative) {
      // Add some randomness around the hotspot
      const latOffset = (Math.random() - 0.5) * 10;
      const lngOffset = (Math.random() - 0.5) * 15;
      return {
        lat: hotspot.lat + latOffset,
        lng: hotspot.lng + lngOffset,
      };
    }
  }

  // Fallback: random location anywhere
  return {
    lat: Math.random() * 140 - 70,
    lng: Math.random() * 360 - 180,
  };
}

// Globe mesh with dark styling
function Globe() {
  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.9,
    });
  }, []);

  const wireMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: 0x333333,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
  }, []);

  return (
    <group>
      <Sphere args={[1, 64, 64]}>
        <primitive object={material} attach="material" />
      </Sphere>
      <Sphere args={[1.002, 32, 32]}>
        <primitive object={wireMaterial} attach="material" />
      </Sphere>
    </group>
  );
}

// Atmosphere glow effect
function Atmosphere() {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(0.3, 0.3, 0.4, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
  }, []);

  return (
    <Sphere args={[1.15, 64, 64]}>
      <primitive object={material} attach="material" />
    </Sphere>
  );
}

// Package dots using instanced mesh for performance
function PackageDots({ onPackageClick }: { onPackageClick?: (name: string) => void }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [visiblePackages, setVisiblePackages] = useState<PackageUpdate[]>([]);
  const lastVersionRef = useRef(0);
  const tempObject = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  // Check for updates every frame without causing re-renders
  useFrame(() => {
    if (packageStore.version !== lastVersionRef.current) {
      lastVersionRef.current = packageStore.version;
      setVisiblePackages([...packageStore.packages]);
    }

    // Update instance matrices and colors
    if (meshRef.current) {
      const now = Date.now();
      visiblePackages.forEach((pkg, i) => {
        const position = latLngToVector3(pkg.lat, pkg.lng, 1.02);
        const age = (now - pkg.timestamp) / 1000;
        const pulse = Math.sin(age * 4) * 0.3 + 1;
        const scale = Math.max(0.3, 1 - age * 0.05) * pulse * 0.015;

        tempObject.position.copy(position);
        tempObject.scale.setScalar(scale);
        tempObject.updateMatrix();
        meshRef.current!.setMatrixAt(i, tempObject.matrix);

        // Fade color based on age
        const brightness = Math.max(0.3, 1 - age * 0.1);
        tempColor.setRGB(brightness, brightness, brightness);
        meshRef.current!.setColorAt(i, tempColor);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
      }
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, 100]}
      onClick={(e) => {
        if (e.instanceId !== undefined && visiblePackages[e.instanceId]) {
          onPackageClick?.(visiblePackages[e.instanceId].name);
        }
      }}
    >
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial transparent opacity={0.9} />
    </instancedMesh>
  );
}

// Package labels
function PackageLabels() {
  const [labels, setLabels] = useState<PackageUpdate[]>([]);
  const lastVersionRef = useRef(0);

  useFrame(() => {
    if (packageStore.version !== lastVersionRef.current) {
      lastVersionRef.current = packageStore.version;
      // Only show 3 most recent labels
      setLabels(packageStore.packages.slice(0, 3));
    }
  });

  return (
    <>
      {labels.map((pkg) => {
        const age = (Date.now() - pkg.timestamp) / 1000;
        if (age > 4) return null;
        const opacity = Math.max(0, 1 - age / 4);
        const position = latLngToVector3(pkg.lat, pkg.lng, 1.1);

        return (
          <Text
            key={pkg.id}
            position={position}
            fontSize={0.035}
            color="white"
            anchorX="center"
            anchorY="middle"
            fillOpacity={opacity}
          >
            {pkg.name.length > 18 ? pkg.name.slice(0, 18) + "..." : pkg.name}
          </Text>
        );
      })}
    </>
  );
}

// Arcs between recent packages
function PackageArcs() {
  const [arcs, setArcs] = useState<{ start: PackageUpdate; end: PackageUpdate }[]>([]);
  const lastVersionRef = useRef(0);

  useFrame(() => {
    if (packageStore.version !== lastVersionRef.current) {
      lastVersionRef.current = packageStore.version;
      const recent = packageStore.packages.slice(0, 6);
      const newArcs: { start: PackageUpdate; end: PackageUpdate }[] = [];
      for (let i = 0; i < recent.length - 1; i++) {
        const age = (Date.now() - recent[i].timestamp) / 1000;
        if (age < 5) {
          newArcs.push({ start: recent[i], end: recent[i + 1] });
        }
      }
      setArcs(newArcs);
    }
  });

  return (
    <>
      {arcs.map((arc, i) => (
        <Arc key={`arc-${arc.start.id}-${arc.end.id}`} start={arc.start} end={arc.end} />
      ))}
    </>
  );
}

function Arc({ start, end }: { start: PackageUpdate; end: PackageUpdate }) {
  const lineRef = useRef<THREE.Line>(null);

  const { geometry, age } = useMemo(() => {
    const startVec = latLngToVector3(start.lat, start.lng, 1.01);
    const endVec = latLngToVector3(end.lat, end.lng, 1.01);
    const midPoint = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
    const distance = startVec.distanceTo(endVec);
    midPoint.normalize().multiplyScalar(1.01 + distance * 0.2);
    const curve = new THREE.QuadraticBezierCurve3(startVec, midPoint, endVec);
    const points = curve.getPoints(30);
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return { geometry: geo, age: (Date.now() - start.timestamp) / 1000 };
  }, [start, end]);

  const opacity = Math.max(0, 0.4 - age * 0.08);

  return (
    <line ref={lineRef} geometry={geometry}>
      <lineBasicMaterial color={0xffffff} transparent opacity={opacity} />
    </line>
  );
}

// Main scene
function Scene({ onPackageClick }: { onPackageClick?: (name: string) => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const [isDragging, setIsDragging] = useState(false);

  useFrame((_, delta) => {
    if (groupRef.current && !isDragging) {
      groupRef.current.rotation.y += delta * 0.05;
    }
  });

  return (
    <>
      <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={0.3} />
      <ambientLight intensity={0.6} />

      <group ref={groupRef}>
        <Globe />
        <Atmosphere />
        <PackageDots onPackageClick={onPackageClick} />
        <PackageLabels />
        <PackageArcs />
      </group>

      <OrbitControls
        enableZoom={true}
        enablePan={false}
        minDistance={1.5}
        maxDistance={4}
        onStart={() => setIsDragging(true)}
        onEnd={() => setIsDragging(false)}
      />
    </>
  );
}

// Main component - stable, never re-renders from parent
export function GlobeVisualization({
  onPackageClick,
}: {
  onPackageClick?: (name: string) => void;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 2.5], fov: 45 }}
      style={{ background: "black" }}
      gl={{ antialias: true, alpha: true }}
    >
      <Scene onPackageClick={onPackageClick} />
    </Canvas>
  );
}
