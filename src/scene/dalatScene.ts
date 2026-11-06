import * as THREE from "three";

export interface DalatSceneController {
  setCloudDensity: (score: number | null) => void;
  setPaused: (paused: boolean) => void;
  isPaused: () => boolean;
  dispose: () => void;
}

interface CloudPuff {
  group: THREE.Group;
  speed: number;
  baseY: number;
  phase: number;
}

export function initDalatScene(container: HTMLElement): DalatSceneController {
  const scene = new THREE.Scene();
  const isDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const applyTheme = (dark: boolean) => {
    const bgHex = dark ? 0x16221c : 0xe4efe9;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.055);
  };
  applyTheme(isDarkQuery.matches);

  const width = Math.max(container.clientWidth, 300);
  const height = Math.max(container.clientHeight, 150);

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.set(0, 3.2, 9.5);
  camera.lookAt(0, 0.8, 0);

  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
  } catch {
    container.innerHTML =
      '<div class="hint" style="padding:16px;text-align:center">Trình duyệt đang tắt WebGL — chế độ tiết kiệm 2D</div>';
    return {
      setCloudDensity: () => {},
      setPaused: () => {},
      isPaused: () => true,
      dispose: () => {},
    };
  }

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.78);
  scene.add(ambient);

  const sunLight = new THREE.DirectionalLight(0xffe9c4, 1.35);
  sunLight.position.set(6, 9, 5);
  scene.add(sunLight);

  const world = new THREE.Group();
  scene.add(world);

  // Sunrise / Sunset warm disc in background
  const sunGeo = new THREE.CircleGeometry(1.45, 32);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xf4a261 });
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  sunMesh.position.set(2.8, 2.7, -4.5);
  world.add(sunMesh);

  // Rolling Da Lat hills
  const hillGeo = new THREE.ConeGeometry(4.5, 2.6, 7);
  const hillMat1 = new THREE.MeshStandardMaterial({
    color: 0x2f7d5b,
    flatShading: true,
    roughness: 0.9,
  });
  const hillMat2 = new THREE.MeshStandardMaterial({
    color: 0x3f5a3a,
    flatShading: true,
    roughness: 0.9,
  });

  const hill1 = new THREE.Mesh(hillGeo, hillMat1);
  hill1.position.set(-2.2, -0.6, -1.2);
  hill1.scale.set(1.25, 0.8, 1.1);
  world.add(hill1);

  const hill2 = new THREE.Mesh(hillGeo, hillMat2);
  hill2.position.set(2.1, -0.5, -2.0);
  hill2.scale.set(1.4, 0.95, 1.2);
  world.add(hill2);

  const hill3 = new THREE.Mesh(hillGeo, hillMat1);
  hill3.position.set(0.2, -0.85, 0.6);
  hill3.scale.set(1.15, 0.7, 1.0);
  world.add(hill3);

  // Low-poly Da Lat pine trees
  const trunkGeo = new THREE.CylinderGeometry(0.06, 0.09, 0.45, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 });
  const foliageGeo = new THREE.ConeGeometry(0.38, 0.85, 6);
  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0x1f5c3f,
    flatShading: true,
    roughness: 0.85,
  });

  const treeCoords: [number, number, number, number][] = [
    [-2.8, 0.35, -0.5, 1.0],
    [-1.9, 0.55, -1.0, 1.15],
    [-1.2, 0.28, 0.2, 0.9],
    [-0.4, 0.18, 0.9, 0.85],
    [0.6, 0.22, 0.7, 0.95],
    [1.5, 0.5, -1.1, 1.1],
    [2.4, 0.62, -1.5, 1.2],
    [3.1, 0.3, -0.6, 0.9],
    [-0.7, 0.48, -1.6, 1.05],
  ];

  for (const [x, y, z, s] of treeCoords) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.2;
    tree.add(trunk);

    const cone1 = new THREE.Mesh(foliageGeo, foliageMat);
    cone1.position.y = 0.65;
    tree.add(cone1);

    const cone2 = new THREE.Mesh(foliageGeo, foliageMat);
    cone2.position.y = 1.05;
    cone2.scale.setScalar(0.75);
    tree.add(cone2);

    tree.position.set(x, y, z);
    tree.scale.setScalar(s);
    world.add(tree);
  }

  // Rolling Cloud Sea (Săn mây)
  const cloudGroup = new THREE.Group();
  world.add(cloudGroup);

  const puffGeo = new THREE.DodecahedronGeometry(0.45, 1);
  const puffMat = new THREE.MeshStandardMaterial({
    color: 0xf7faf8,
    roughness: 0.95,
    transparent: true,
    opacity: 0.86,
    flatShading: true,
  });

  const clouds: CloudPuff[] = [];
  for (let i = 0; i < 10; i++) {
    const g = new THREE.Group();
    const count = 3 + (i % 2);
    for (let j = 0; j < count; j++) {
      const m = new THREE.Mesh(puffGeo, puffMat);
      m.position.set((j - 1) * 0.42, (j % 2) * 0.12, (j - 1) * 0.15);
      const sc = j === 1 ? 1.15 : 0.85;
      m.scale.set(sc * 1.3, sc * 0.65, sc);
      g.add(m);
    }
    const baseY = 0.05 + (i % 3) * 0.22;
    g.position.set(-4.5 + i * 1.0, baseY, -1.8 + (i % 4) * 0.85);
    cloudGroup.add(g);
    clouds.push({
      group: g,
      speed: 0.22 + (i % 3) * 0.08,
      baseY,
      phase: i * 0.9,
    });
  }

  // Interactive pointer tilt
  let targetRotY = 0;
  const onPointerMove = (e: PointerEvent) => {
    const rect = container.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    targetRotY = nx * 0.28;
  };
  container.addEventListener("pointermove", onPointerMove);

  const onThemeChange = (e: MediaQueryListEvent) => applyTheme(e.matches);
  isDarkQuery.addEventListener("change", onThemeChange);

  const onResize = () => {
    if (!renderer) return;
    const w = Math.max(container.clientWidth, 280);
    const h = Math.max(container.clientHeight, 140);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", onResize);

  let paused = false;
  let animId = 0;
  const clock = new THREE.Clock();

  const animate = () => {
    animId = requestAnimationFrame(animate);
    if (paused || !renderer) return;

    const elapsed = clock.getElapsedTime();
    world.rotation.y += (targetRotY + Math.sin(elapsed * 0.35) * 0.08 - world.rotation.y) * 0.05;

    for (const c of clouds) {
      c.group.position.x += c.speed * 0.012;
      if (c.group.position.x > 5.2) c.group.position.x = -5.2;
      c.group.position.y = c.baseY + Math.sin(elapsed * 1.2 + c.phase) * 0.06;
    }

    renderer.render(scene, camera);
  };
  animate();

  return {
    setCloudDensity: (score: number | null) => {
      const norm = score == null ? 0.75 : Math.max(0.35, Math.min(1, score / 85));
      puffMat.opacity = 0.5 + norm * 0.42;
      cloudGroup.scale.y = 0.7 + norm * 0.45;
    },
    setPaused: (p: boolean) => {
      paused = p;
    },
    isPaused: () => paused,
    dispose: () => {
      cancelAnimationFrame(animId);
      container.removeEventListener("pointermove", onPointerMove);
      isDarkQuery.removeEventListener("change", onThemeChange);
      window.removeEventListener("resize", onResize);
      renderer?.dispose();
    },
  };
}
