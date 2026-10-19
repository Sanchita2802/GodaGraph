import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface Nashik3DCanvasProps {
  scrollProgress: number; // 0.0 (top) to 1.0 (bottom)
  isDark?: boolean;
}

export const Nashik3DCanvas: React.FC<Nashik3DCanvasProps> = ({
  scrollProgress,
  isDark = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animIdRef = useRef<number | null>(null);

  // References to animated elements
  const waterMeshRef = useRef<THREE.Mesh | null>(null);
  const petalsParticlesRef = useRef<THREE.Points | null>(null);
  const diyasGroupRef = useRef<THREE.Group | null>(null);
  const vehiclesGroupRef = useRef<THREE.Group | null>(null);
  const graphNodesGroupRef = useRef<THREE.Group | null>(null);
  const graphEdgesGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const fogColor = isDark ? 0x14121c : 0xfff8f1;
    scene.fog = new THREE.FogExp2(fogColor, 0.012);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 12, 38);
    camera.lookAt(0, 2, 0);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(isDark ? 0x5a4a75 : 0xffeedd, isDark ? 1.0 : 1.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffecd0, isDark ? 0.8 : 1.6);
    sunLight.position.set(20, 40, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    const warmDiyaLight = new THREE.PointLight(0xff7733, 2.0, 30);
    warmDiyaLight.position.set(0, 2, 5);
    scene.add(warmDiyaLight);

    // 5. Procedural Godavari River with Shimmering Surface
    const waterGeo = new THREE.PlaneGeometry(80, 140, 32, 32);
    const waterMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x1e3a5f : 0x76c7c0,
      roughness: 0.15,
      metalness: 0.3,
      transparent: true,
      opacity: 0.85,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(0, 0, -20);
    waterMesh.receiveShadow = true;
    scene.add(waterMesh);
    waterMeshRef.current = waterMesh;

    // 6. Ramkund Stone Steps (Ghats)
    const stepsMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x2b273b : 0xe8dfd5,
      roughness: 0.8,
    });
    for (let i = 0; i < 7; i++) {
      const stepGeo = new THREE.BoxGeometry(60, 0.7, 3);
      const step = new THREE.Mesh(stepGeo, stepsMat);
      step.position.set(0, i * 0.7 + 0.35, 10 + i * 3);
      step.receiveShadow = true;
      step.castShadow = true;
      scene.add(step);
    }

    // 7. Clay Kalaram Temple Silhouette & Shikhara (Black Basalt Style)
    const templeGroup = new THREE.Group();
    const templeMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x1a1924 : 0x4a4352,
      roughness: 0.7,
    });
    // Base Mandapa
    const mandapaGeo = new THREE.BoxGeometry(8, 6, 12);
    const mandapa = new THREE.Mesh(mandapaGeo, templeMat);
    mandapa.position.set(-18, 4, -10);
    templeGroup.add(mandapa);
    // Shikhara Pyramidal Spire
    const spireGeo = new THREE.ConeGeometry(4.5, 12, 4);
    const spire = new THREE.Mesh(spireGeo, templeMat);
    spire.position.set(-18, 12, -10);
    spire.rotation.y = Math.PI / 4;
    templeGroup.add(spire);
    // Kalash on top
    const kalashGeo = new THREE.SphereGeometry(0.8, 12, 12);
    const kalashMat = new THREE.MeshStandardMaterial({ color: 0xffb703, metalness: 0.8, roughness: 0.2 });
    const kalash = new THREE.Mesh(kalashGeo, kalashMat);
    kalash.position.set(-18, 18.5, -10);
    templeGroup.add(kalash);
    scene.add(templeGroup);

    // 8. Pandavleni Caves on Hill & Vineyard Terraces
    const hillGeo = new THREE.ConeGeometry(24, 18, 8);
    const hillMat = new THREE.MeshStandardMaterial({ color: isDark ? 0x221d2d : 0xc7bbad, roughness: 0.9 });
    const hill = new THREE.Mesh(hillGeo, hillMat);
    hill.position.set(28, 9, -25);
    scene.add(hill);

    // Vineyard Rows (Sula style)
    const vineyardMat = new THREE.MeshStandardMaterial({ color: 0x386641 });
    for (let r = 0; r < 5; r++) {
      const vineRowGeo = new THREE.CylinderGeometry(0.5, 0.5, 16, 6);
      const vineRow = new THREE.Mesh(vineRowGeo, vineyardMat);
      vineRow.rotation.z = Math.PI / 2;
      vineRow.position.set(22 + r * 2.5, 1, -10);
      scene.add(vineRow);
    }

    // 9. Floating Diyas (Oil lamps on Godavari)
    const diyasGroup = new THREE.Group();
    diyasGroupRef.current = diyasGroup;
    const diyaMat = new THREE.MeshStandardMaterial({ color: 0xb5651d });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });

    for (let d = 0; d < 18; d++) {
      const diyaMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.4, 0.3, 8), diyaMat);
      const flameMesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), flameMat);
      flameMesh.position.y = 0.3;
      diyaMesh.add(flameMesh);

      diyaMesh.position.set(
        (Math.random() - 0.5) * 35,
        0.15,
        (Math.random() - 0.5) * 50 - 15
      );
      diyasGroup.add(diyaMesh);
    }
    scene.add(diyasGroup);

    // 10. Floating Marigold Petals (Particle System)
    const petalCount = 200;
    const petalGeo = new THREE.BufferGeometry();
    const petalPositions = new Float32Array(petalCount * 3);
    for (let p = 0; p < petalCount * 3; p += 3) {
      petalPositions[p] = (Math.random() - 0.5) * 50;
      petalPositions[p + 1] = Math.random() * 12 + 0.2;
      petalPositions[p + 2] = (Math.random() - 0.5) * 60;
    }
    petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPositions, 3));
    const petalMat = new THREE.PointsMaterial({
      color: 0xff9900,
      size: 0.6,
      transparent: true,
      opacity: 0.8,
    });
    const petals = new THREE.Points(petalGeo, petalMat);
    scene.add(petals);
    petalsParticlesRef.current = petals;

    // 11. Animated Clay Vehicles (Tiny Citilinc Bus & Auto)
    const vehiclesGroup = new THREE.Group();
    vehiclesGroupRef.current = vehiclesGroup;
    // Bus (Coral Red)
    const busGeo = new THREE.BoxGeometry(2.4, 1.2, 5.0);
    const busMat = new THREE.MeshStandardMaterial({ color: 0xe0554b, roughness: 0.4 });
    const busMesh = new THREE.Mesh(busGeo, busMat);
    busMesh.position.set(-6, 1.5, 5);
    busMesh.castShadow = true;
    vehiclesGroup.add(busMesh);
    // Auto (Amber Yellow / Green)
    const autoGeo = new THREE.BoxGeometry(1.4, 1.1, 2.2);
    const autoMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
    const autoMesh = new THREE.Mesh(autoGeo, autoMat);
    autoMesh.position.set(4, 1.2, 8);
    autoMesh.castShadow = true;
    vehiclesGroup.add(autoMesh);
    scene.add(vehiclesGroup);

    // 12. The Graph Awakens: 3D Nodes & Glowing Edges (Scene 4)
    const graphNodesGroup = new THREE.Group();
    graphNodesGroupRef.current = graphNodesGroup;
    const nodeSphereGeo = new THREE.SphereGeometry(0.65, 12, 12);
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0x5ed6c0 });

    const sampleNodeCoords: [number, number, number][] = [
      [0, 2, 5],
      [-8, 3, -2],
      [-16, 4, -10],
      [8, 2.5, 0],
      [14, 3, -12],
      [4, 4, -20],
      [-6, 5, -28],
    ];

    sampleNodeCoords.forEach(([x, y, z]) => {
      const nMesh = new THREE.Mesh(nodeSphereGeo, nodeMat);
      nMesh.position.set(x, y + 2, z);
      graphNodesGroup.add(nMesh);
    });

    // Connecting Glowing Edges
    const graphEdgesGroup = new THREE.Group();
    graphEdgesGroupRef.current = graphEdgesGroup;
    const lineMat = new THREE.LineBasicMaterial({ color: 0xe0554b, linewidth: 2 });
    for (let l = 0; l < sampleNodeCoords.length - 1; l++) {
      const pA = new THREE.Vector3(...sampleNodeCoords[l]);
      const pB = new THREE.Vector3(...sampleNodeCoords[l + 1]);
      pA.y += 2;
      pB.y += 2;
      const lineGeo = new THREE.BufferGeometry().setFromPoints([pA, pB]);
      const line = new THREE.Line(lineGeo, lineMat);
      graphEdgesGroup.add(line);
    }
    graphNodesGroup.visible = false;
    graphEdgesGroup.visible = false;
    scene.add(graphNodesGroup);
    scene.add(graphEdgesGroup);

    // Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      const elapsed = clock.getElapsedTime();

      // Shimmer water waves
      if (waterMeshRef.current) {
        const posAttr = waterMeshRef.current.geometry.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          const u = posAttr.getX(i);
          const v = posAttr.getY(i);
          posAttr.setZ(i, Math.sin(u * 0.2 + elapsed * 1.5) * 0.25 + Math.cos(v * 0.2 + elapsed * 1.2) * 0.25);
        }
        posAttr.needsUpdate = true;
      }

      // Drift diyas gently with river current
      if (diyasGroupRef.current) {
        diyasGroupRef.current.children.forEach((diya, idx) => {
          diya.position.z += 0.03;
          diya.position.x += Math.sin(elapsed + idx) * 0.015;
          if (diya.position.z > 25) {
            diya.position.z = -35;
          }
        });
      }

      // Drifting marigold petals
      if (petalsParticlesRef.current) {
        const positions = petalsParticlesRef.current.geometry.attributes.position.array as Float32Array;
        for (let p = 0; p < positions.length; p += 3) {
          positions[p + 1] -= 0.02; // fall
          positions[p] += Math.sin(elapsed * 0.5 + p) * 0.01;
          if (positions[p + 1] < 0.2) {
            positions[p + 1] = 12; // loop back to air
          }
        }
        petalsParticlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Move vehicles
      if (vehiclesGroupRef.current) {
        const bus = vehiclesGroupRef.current.children[0];
        const auto = vehiclesGroupRef.current.children[1];
        if (bus) {
          bus.position.z -= 0.08;
          if (bus.position.z < -30) bus.position.z = 20;
        }
        if (auto) {
          auto.position.z -= 0.06;
          if (auto.position.z < -30) auto.position.z = 20;
        }
      }

      renderer.render(scene, camera);
      animIdRef.current = requestAnimationFrame(animate);
    };

    animIdRef.current = requestAnimationFrame(animate);

    // Resize handler
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
      if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, [isDark]);

  // Interpolate 3D camera trajectory based on scrollProgress (0 to 1)
  useEffect(() => {
    if (!cameraRef.current) return;
    const camera = cameraRef.current;
    const p = Math.max(0, Math.min(1, scrollProgress));

    // Camera keyframes across scenes:
    // Scene 1 (Dawn at Ramkund, p: 0.0 - 0.25): High angle hero view over ghats
    // Scene 2 (Temple Skyline, p: 0.25 - 0.50): Gliding past Kalaram shikhara
    // Scene 3 (Streets & Markets, p: 0.50 - 0.75): Low flyover of animated vehicles
    // Scene 4 (Graph Awakens, p: 0.75 - 1.00): Overhead celestial view with glowing nodes

    if (p < 0.25) {
      const t = p / 0.25;
      camera.position.x = THREE.MathUtils.lerp(0, -6, t);
      camera.position.y = THREE.MathUtils.lerp(12, 10, t);
      camera.position.z = THREE.MathUtils.lerp(38, 25, t);
      camera.lookAt(0, 2, 0);
    } else if (p < 0.5) {
      const t = (p - 0.25) / 0.25;
      camera.position.x = THREE.MathUtils.lerp(-6, -14, t);
      camera.position.y = THREE.MathUtils.lerp(10, 14, t);
      camera.position.z = THREE.MathUtils.lerp(25, 8, t);
      camera.lookAt(-10, 6, -10);
    } else if (p < 0.75) {
      const t = (p - 0.5) / 0.25;
      camera.position.x = THREE.MathUtils.lerp(-14, 0, t);
      camera.position.y = THREE.MathUtils.lerp(14, 6, t);
      camera.position.z = THREE.MathUtils.lerp(8, 12, t);
      camera.lookAt(0, 1.5, 0);
    } else {
      const t = (p - 0.75) / 0.25;
      camera.position.x = THREE.MathUtils.lerp(0, 0, t);
      camera.position.y = THREE.MathUtils.lerp(6, 28, t);
      camera.position.z = THREE.MathUtils.lerp(12, 2, t);
      camera.lookAt(0, 0, -10);
    }

    // Toggle Graph Awakening visualization on scene 4
    if (graphNodesGroupRef.current && graphEdgesGroupRef.current) {
      const isScene4 = p > 0.65;
      graphNodesGroupRef.current.visible = isScene4;
      graphEdgesGroupRef.current.visible = isScene4;
    }
  }, [scrollProgress]);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ touchAction: 'none' }}
    />
  );
};
