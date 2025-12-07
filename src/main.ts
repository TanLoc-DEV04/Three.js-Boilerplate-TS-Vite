import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import GUI from "lil-gui";

// ========================
// SCENE – CAMERA – RENDERER
// ========================
const scene = new THREE.Scene();
// scene.background = new THREE.Color(0x202026);
scene.background = new THREE.CubeTextureLoader()
  .setPath("https://sbcode.net/img/")
  .load(["px.png", "nx.png", "py.png", "ny.png", "pz.png", "nz.png"]);
scene.backgroundBlurriness = 0.5;

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(5, 5, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

new OrbitControls(camera, renderer.domElement);

// ========================
// LIGHT
// ========================
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(3, 4, 3);
dir.castShadow = true;
scene.add(dir);

// Additional lighting for better visibility
const dir2 = new THREE.DirectionalLight(0xffffff, 0.4);
dir2.position.set(-3, 2, -3);
scene.add(dir2);

// =====================================================
// 1) PHYSICS PARAMETERS – GUI CONTROLS
// =====================================================
const params = {
  // Particle types with realistic masses (kg)
  particleType: "Proton",
  mass: 1.67e-27, // Proton mass
  charge: 1.6e-19, // Elementary charge
  voltage: 2000, // Accelerating voltage (V)
  magneticField: 1.0, // Magnetic field strength (T)
  maxRadius: 2.0, // Maximum radius before extraction
  oscillationFreq: 1.0, // Oscillator frequency multiplier
  showFieldLines: true,
  animateFieldLines: true,
  fieldAnimationSpeed: 2.0,
  animationSpeed: 1.0,

  // Simulation Control
  isRunning: true,
  toggleRun: () => {},
  resetParticle: () => {},

  // Calculated values
  cyclotronFreq: 0,
  currentRadius: 0,
  currentVelocity: 0,
  revolutions: 0,
  extractParticle: false,
};

// Particle type definitions
const particleTypes = {
  Proton: { mass: 1.67e-27, charge: 1.6e-19 },
  Deuteron: { mass: 3.34e-27, charge: 1.6e-19 },
  Alpha: { mass: 6.64e-27, charge: 3.2e-19 },
  "Heavy Ion": { mass: 1.0e-26, charge: 4.8e-19 },
};

// =====================================================
// 2) CREATE DEES (Enhanced hollow half cylinders)
// =====================================================
function createDee(color: number, sign: "+" | "-", rotation: number) {
  const group = new THREE.Group();

  // Main Dee structure - hollow half cylinder
  const outerRadius = 2.5;
  const innerRadius = 0.15;
  const height = 0.3;

  // Create main shape using cylinder geometry and clipping
  const deeGeo = new THREE.CylinderGeometry(
    outerRadius,
    outerRadius,
    height,
    32,
    1,
    false,
    0,
    Math.PI
  );
  const deeMat = new THREE.MeshPhongMaterial({
    color,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  const dee = new THREE.Mesh(deeGeo, deeMat);
  dee.rotation.z = Math.PI / 2;

  // group.add(dee, innerCylinder, frontCap, backCap);
  group.add(dee);

  // Electric field indicator
  // const indicatorGeo = new THREE.BoxGeometry(0.3, 0.08, 0.3);
  // const indicatorMat = new THREE.MeshPhongMaterial({
  //   color: sign === "+" ? 0xff3333 : 0x3333ff,
  //   emissive: sign === "+" ? 0x441111 : 0x111144,
  // });
  // const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
  // indicator.position.set(0, 1.5, 0.2);

  // // Add +/- symbol using simple geometry
  // group.add(indicator);

  // group.rotation.z = rotation;
  return group;
}

const deeGroup = new THREE.Group();
const spacingBetweenDees = -0.5;
const dee1 = createDee(0xff8800, "+", 0);
dee1.rotation.z = Math.PI / 2;
dee1.position.x = spacingBetweenDees / 2;
const dee2 = createDee(0x0088ff, "-", Math.PI);
dee2.rotation.z = -Math.PI / 2;
dee2.position.x = -spacingBetweenDees / 2;
dee1.userData = { sign: "+", potential: 1 };
dee2.userData = { sign: "-", potential: -1 };
deeGroup.add(dee1, dee2);
scene.add(deeGroup);

// =====================================================
// 3) ELECTROMAGNETS (Top and Bottom)
// =====================================================
function createElectromagnet(position: THREE.Vector3, poleType: "N" | "S") {
  const group = new THREE.Group();

  // Main magnet body
  const magnetRadius = 3.0;
  const magnetHeight = 0.4;
  const magnetGeo = new THREE.CylinderGeometry(
    magnetRadius,
    magnetRadius,
    magnetHeight,
    32
  );
  const magnetMat = new THREE.MeshPhongMaterial({
    color: 0x666666,
    shininess: 30,
  });
  const magnet = new THREE.Mesh(magnetGeo, magnetMat);

  // Determine which magnet this is based on position
  const isTopMagnet = position.y > 0;

  // Create BOTH poles for each magnet
  const poleGeo = new THREE.CylinderGeometry(
    magnetRadius * 0.8,
    magnetRadius * 0.8,
    0.1,
    32
  );

  // TOP POLE (N for both magnets, but different faces)
  const topPoleMat = new THREE.MeshPhongMaterial({
    color: 0xff4444, // Red for N pole
    emissive: 0x220000,
  });
  const topPole = new THREE.Mesh(poleGeo, topPoleMat);
  topPole.position.y = magnetHeight / 2 + 0.05;

  // BOTTOM POLE (S for both magnets, but different faces)
  const bottomPoleMat = new THREE.MeshPhongMaterial({
    color: 0x4444ff, // Blue for S pole
    emissive: 0x000022,
  });
  const bottomPole = new THREE.Mesh(poleGeo, bottomPoleMat);
  bottomPole.position.y = -magnetHeight / 2 - 0.05;

  // Coil windings representation
  for (let i = 0; i < 8; i++) {
    const coilGeo = new THREE.TorusGeometry(
      magnetRadius * 0.9 - i * 0.05,
      0.02,
      8,
      16
    );
    const coilMat = new THREE.MeshPhongMaterial({ color: 0xcc6600 });
    const coil = new THREE.Mesh(coilGeo, coilMat);
    coil.position.y = -magnetHeight / 2 + 0.1 + i * 0.05;
    coil.rotation.x = Math.PI / 2;
    group.add(coil);
  }

  // CREATE LABELS FOR BOTH POLES
  function createPoleLabel(
    poleType: "N" | "S",
    yPosition: number,
    rotation: number
  ) {
    const labelGeo = new THREE.PlaneGeometry(0.6, 0.6);
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;

    // Create label texture
    ctx.fillStyle = poleType === "N" ? "#ffdddd" : "#ddddff";
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.strokeRect(5, 5, 118, 118);
    ctx.fillStyle = poleType === "N" ? "#ff0000" : "#0000ff";
    ctx.font = "bold 72px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(poleType, 64, 64);

    const labelTexture = new THREE.CanvasTexture(canvas);
    const labelMat = new THREE.MeshBasicMaterial({
      map: labelTexture,
      transparent: true,
      alphaTest: 0.1,
    });
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.position.y = yPosition;
    label.rotation.x = rotation;
    return label;
  }

  // Add labels for both poles
  const topLabel = createPoleLabel("N", magnetHeight / 2 + 0.15, -Math.PI / 2);
  const bottomLabel = createPoleLabel(
    "S",
    -magnetHeight / 2 - 0.15,
    Math.PI / 2
  );

  // Add all components to group
  group.add(magnet, topPole, bottomPole, topLabel, bottomLabel);
  group.position.copy(position);
  return group;
}

// Create magnets - the poleType parameter is now less relevant since each has both poles
const MAGNET_SPACING = 2.2;
const topMagnet = createElectromagnet(
  new THREE.Vector3(0, MAGNET_SPACING, 0),
  "S" // This parameter is now mainly for identification
);
const bottomMagnet = createElectromagnet(
  new THREE.Vector3(0, -MAGNET_SPACING, 0),
  "N" // This parameter is now mainly for identification
);
scene.add(topMagnet, bottomMagnet);

// =====================================================
// 3.1) VACUUM CHAMBER
// =====================================================
function createVacuumChamber() {
  const height = 3.8; // Fits between poles at +/- 1.9
  const radius = 2.9;

  const geometry = new THREE.CylinderGeometry(
    radius,
    radius,
    height,
    64,
    1,
    true
  );

  const material = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false, // Good for transparent objects
  });

  const chamber = new THREE.Mesh(geometry, material);
  return chamber;
}

const vacuumChamber = createVacuumChamber();
scene.add(vacuumChamber);

// =====================================================
// 4) OSCILLATOR BOX AND CONNECTIONS
// =====================================================
function createOscillator() {
  const group = new THREE.Group();

  // Main oscillator box
  const oscGeo = new THREE.BoxGeometry(1.0, 0.6, 0.8);
  const oscMat = new THREE.MeshPhongMaterial({
    color: 0x888888,
    shininess: 50,
  });
  const oscillator = new THREE.Mesh(oscGeo, oscMat);

  // Control panel
  const panelGeo = new THREE.BoxGeometry(0.8, 0.4, 0.02);
  const panelMat = new THREE.MeshPhongMaterial({ color: 0x222222 });
  const panel = new THREE.Mesh(panelGeo, panelMat);
  panel.position.z = 0.41;

  // LED indicators
  for (let i = 0; i < 3; i++) {
    const ledGeo = new THREE.SphereGeometry(0.03, 8, 8);
    const ledMat = new THREE.MeshPhongMaterial({
      color: i === 0 ? 0x00ff00 : i === 1 ? 0xff0000 : 0x0000ff,
      emissive: i === 0 ? 0x002200 : i === 1 ? 0x220000 : 0x000022,
    });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(-0.2 + i * 0.2, 0.1, 0.42);
    group.add(led);
  }

  group.add(oscillator, panel);

  // Connection points (terminals) on the oscillator box
  // Positioned symmetrically
  // Dee 1 (Orange) is at X = -0.25 (Left)
  // Dee 2 (Blue) is at X = +0.25 (Right)
  // So Left Terminal should be Orange, Right Terminal should be Blue

  const termLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.2),
    new THREE.MeshPhongMaterial({ color: 0x000000 })
  );
  termLeft.position.set(-0.3, 0, -0.4); // Left side

  const termRight = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.2),
    new THREE.MeshPhongMaterial({ color: 0x000000 })
  );
  termRight.position.set(0.3, 0, -0.4); // Right side

  group.add(termLeft, termRight, oscillator, panel);

  // Vector math for precise connection
  // Oscillator is at Z=4.5, facing Dees (Logic: Z- is front/terminals)
  // Terminals local Z = -0.4 => World Z = 4.1
  // Dee edge approx Z = 2.5 (Outer Radius)
  // Rod needs to span from Z=4.1 to Z=2.5. Length = 1.6
  // Rod Center = (4.1 + 2.5) / 2 = 3.3

  const rodLength = 1.7; // Slightly overlapping
  const rodGeometry = new THREE.CylinderGeometry(0.04, 0.04, rodLength, 8);
  rodGeometry.rotateX(Math.PI / 2); // Verify alignment

  const rodLeft = new THREE.Mesh(
    rodGeometry,
    new THREE.MeshPhongMaterial({ color: 0x000000 })
  );
  rodLeft.position.set(-0.3, 0, -1.25);

  const rodRight = new THREE.Mesh(
    rodGeometry,
    new THREE.MeshPhongMaterial({ color: 0x000000 })
  );
  rodRight.position.set(0.3, 0, -1.25);

  group.add(rodLeft, rodRight);

  // Position the whole group on Z axis
  group.position.set(0, 0, 4.5);
  group.rotation.y = 0; // Terminals (Z-) face the Dees (at Z=0)

  return group;
}

const oscillator = createOscillator();
scene.add(oscillator);

// =====================================================
// 5) MAGNETIC FIELD LINES VISUALIZATION
// =====================================================
const fieldLines: THREE.ArrowHelper[] = [];

function createFieldLines() {
  // Clear existing field lines
  fieldLines.forEach((arrow) => scene.remove(arrow));
  fieldLines.length = 0;

  // Clear curved field lines

  if (!params.showFieldLines) return;

  const topMagnetY = MAGNET_SPACING; // 2.2
  const bottomMagnetY = -MAGNET_SPACING; // -2.2
  const fieldLength = topMagnetY - bottomMagnetY; // 4.4

  const spacing = 0.9;

  for (let x = -2; x <= 2; x += spacing) {
    for (let z = -2; z <= 2; z += spacing) {
      // Skip if inside the Dees
      const distance = Math.sqrt(x * x + z * z);
      if (distance < 0.5) continue;

      const origin = new THREE.Vector3(x, bottomMagnetY + 0.2, z);
      const arrowLength = fieldLength * 0.9; // Extends from bottom to top

      // Direction is UP (North to South)
      const direction = new THREE.Vector3(0, 1, 0);

      const arrow = new THREE.ArrowHelper(
        direction.normalize(),
        origin,
        arrowLength,
        0x00ffff, // Cyan/Blue
        0.3,
        0.15
      );

      // Cast to appropriate types to access properties
      const lineMaterial = arrow.line.material as THREE.LineBasicMaterial;
      const coneMaterial = arrow.cone.material as THREE.MeshBasicMaterial;

      lineMaterial.transparent = true;
      lineMaterial.opacity = 0.5;
      lineMaterial.linewidth = 1;
      coneMaterial.transparent = true;
      coneMaterial.opacity = 0.5;

      fieldLines.push(arrow);
      scene.add(arrow);
    }
  }
}

// =====================================================
// 6) PARTICLE MODEL AND TRAJECTORY
// =====================================================
const particleGeo = new THREE.SphereGeometry(0.12, 32, 32); // Slightly larger
const particleMat = new THREE.MeshBasicMaterial({
  color: 0xffffaa, // Very bright white-yellow
});
const particle = new THREE.Mesh(particleGeo, particleMat);

// Add intense light to particle
const particleLight = new THREE.PointLight(0xffaa00, 2, 5);
particle.add(particleLight);

scene.add(particle);

// Trajectory trail
// const trajectoryPoints: THREE.Vector3[] = [];
// const trajectoryGeo = new THREE.BufferGeometry();
// const trajectoryMat = new THREE.LineBasicMaterial({
//   color: 0xffffff, // White color for visibility
//   transparent: true,
//   opacity: 0.8,
// });
// const trajectoryLine = new THREE.Line(trajectoryGeo, trajectoryMat);
// scene.add(trajectoryLine);

// =====================================================
// 7.1) TARGET (Extraction Point)
// =====================================================
function createTarget() {
  const group = new THREE.Group();

  // Target Plate
  const plateGeo = new THREE.BoxGeometry(0.1, 0.5, 0.5);
  const plateMat = new THREE.MeshPhongMaterial({
    color: 0xcccccc,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const plate = new THREE.Mesh(plateGeo, plateMat);

  // Target Center (Bullseye)
  const ringGeo = new THREE.RingGeometry(0.05, 0.15, 16);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.y = Math.PI / 2;
  ring.position.x = -0.06;

  group.add(plate, ring);

  const radius = 2.9; // Slightly outside maxRadius

  group.position.set(radius, 0, 0); // Place on X axis
  return group;
}

const target = createTarget();
scene.add(target);

// =====================================================
// 8) GUI CONTROLS
// =====================================================
// =====================================================
// 8) GUI CONTROLS (Vietnamese & Enhanced)
// =====================================================
const gui = new GUI({ title: "Bảng Điều Khiển" });

// Inject CSS for larger font and wider panel
const style = document.createElement("style");
style.innerHTML = `
  .lil-gui { 
    --width: 400px; /* Nới rộng bảng điều khiển */
    --name-width: 50%;
    font-size: 15px !important;
  }
  .lil-gui .title { font-size: 17px !important; font-weight: bold; padding: 8px; }
  .lil-gui button { font-size: 15px !important; height: 32px; }
  .lil-gui .controller { padding-top: 4px; padding-bottom: 4px; }
`;
document.head.appendChild(style);

params.isRunning = true;
params.toggleRun = function () {
  params.isRunning = !params.isRunning;
};

// Controls for Simulation State
const simFolder = gui.addFolder("Điều Khiển Chung");
// Assign implementation to params
params.resetParticle = resetParticle;

simFolder.add(params, "toggleRun").name("⏯ Dừng / Chạy");
simFolder.add(params, "resetParticle").name("🔄 Đặt Lại Hạt");

// Particle Properties
const particleFolder = gui.addFolder("Thuộc tính Hạt");
particleFolder
  .add(params, "particleType", ["Proton", "Deuteron", "Alpha", "Heavy Ion"])
  .name("Loại Hạt")
  .onChange((value: string) => {
    const particleData = particleTypes[value as keyof typeof particleTypes];
    params.mass = particleData.mass;
    params.charge = particleData.charge;
    resetParticle();
  });
particleFolder
  .add(params, "mass", 1e-27, 1e-25)
  .name("Khối lượng (kg)")
  .listen();
particleFolder
  .add(params, "charge", 1e-19, 5e-19)
  .name("Điện tích (C)")
  .listen();

// EM Fields
const emFolder = gui.addFolder("Điện - Từ Trường");
emFolder
  .add(params, "voltage", 500, 10000)
  .name("Hiệu điện thế (V)")
  .onChange(() => updateElectricField());
emFolder
  .add(params, "magneticField", 0.1, 3.0)
  .name("Từ trường B (Tesla)")
  .onChange(() => {
    createFieldLines();
    updateMagnetIndicators();
  });

// Cyclotron Settings
const cyclotronFolder = gui.addFolder("Cài đặt Cyclotron");
cyclotronFolder.add(params, "maxRadius", 1.0, 4.0).name("Bán kính tối đa (m)");
cyclotronFolder
  .add(params, "oscillationFreq", 0.5, 3.0)
  .name("Tần số dao động");
cyclotronFolder.add(params, "animationSpeed", 0.1, 3.0).name("Tốc độ mô phỏng");

// Visualization
const vizFolder = gui.addFolder("Hiển thị");
vizFolder
  .add(params, "showFieldLines")
  .name("Hiện đường sức từ")
  .onChange(() => createFieldLines());
vizFolder
  .add(params, "extractParticle")
  .name("Bắn hạt ra ngoài")
  .onChange(() => {
    if (params.extractParticle) {
      extractParticle();
    }
  });

// Info Display
const infoFolder = gui.addFolder("Thông số Thực");
infoFolder.add(params, "cyclotronFreq").name("Tần số Cyclotron (Hz)").listen();
infoFolder.add(params, "currentRadius").name("Bán kính quỹ đạo (m)").listen();
infoFolder.add(params, "currentVelocity").name("Vận tốc (m/s)").listen();
infoFolder.add(params, "revolutions").name("Số vòng quay").listen();

// =====================================================
// 9) PHYSICS ENGINE AND SIMULATION
// =====================================================
let simulationState = {
  angle: 0,
  radius: 0.15,
  velocity: 0,
  isInDee: false,
  currentDee: 1,
  revolutionCount: 0,
  isAccelerating: false,
  time: 0,
  isExtracted: false,
};

// Scale factor to map physical meters to visual units
// 1 meter physical = 50 units visual
// With 2000V kick -> r ~ 6mm -> 0.3 visual units
const VISUAL_SCALE = 50;

// =====================================================
// HELPER: Generate Flame Texture
// =====================================================
function getFlameTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, "rgba(255, 200, 0, 1)"); // Core: Yellow
  gradient.addColorStop(0.4, "rgba(255, 100, 0, 0.8)"); // Mid: Orange
  gradient.addColorStop(1, "rgba(255, 0, 0, 0)"); // Edge: Transparent Red

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// =====================================================
// FLAME PARTICLE SYSTEM
// =====================================================
const flameTexture = getFlameTexture();
const flameMaterial = new THREE.SpriteMaterial({
  map: flameTexture,
  color: 0xffaa00,
  transparent: true,
  opacity: 0.8,
  blending: THREE.AdditiveBlending,
});

class FlameParticle {
  sprite: THREE.Sprite;
  life: number;
  maxLife: number;
  velocity: THREE.Vector3;

  constructor(position: THREE.Vector3) {
    this.sprite = new THREE.Sprite(flameMaterial);
    this.sprite.position.copy(position);

    // Randomize scale
    const scale = 0.15 + Math.random() * 0.1;
    this.sprite.scale.set(scale, scale, 1);

    this.life = 0;
    this.maxLife = 0.5 + Math.random() * 0.5; // Short life

    // Random drift velocity (simulating heat rising/turbulence)
    this.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.05,
      (Math.random() - 0.5) * 0.05,
      (Math.random() - 0.5) * 0.05
    );

    scene.add(this.sprite);
  }

  update(dt: number) {
    this.life += dt;
    this.sprite.position.add(this.velocity);

    // Fade out and shrink
    const progress = this.life / this.maxLife;
    this.sprite.material.opacity = 0.8 * (1 - progress);
    const scale = this.sprite.scale.x * 0.95; // Shrink
    this.sprite.scale.set(scale, scale, 1);

    return this.life < this.maxLife;
  }

  dispose() {
    scene.remove(this.sprite);
  }
}

const activeFlames: FlameParticle[] = [];

function updateFlameEffect(
  dt: number,
  sourcePosition: THREE.Vector3,
  isMoving: boolean
) {
  // Spawn new flame particles if moving
  if (isMoving) {
    // Spawn rate
    const spawnCount = 2;
    for (let i = 0; i < spawnCount; i++) {
      // Add slight randomness to source position so it's not a thin line
      const jitter = new THREE.Vector3(
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05
      );
      activeFlames.push(new FlameParticle(sourcePosition.clone().add(jitter)));
    }
  }

  // Update existing
  for (let i = activeFlames.length - 1; i >= 0; i--) {
    const alive = activeFlames[i].update(dt);
    if (!alive) {
      activeFlames[i].dispose();
      activeFlames.splice(i, 1);
    }
  }
}

function resetParticle() {
  simulationState = {
    angle: 0,
    radius: 0.15,
    velocity: 0,
    isInDee: false,
    currentDee: 1,
    revolutionCount: 0,
    isAccelerating: false,
    time: 0,
    isExtracted: false,
  };

  simulationState = {
    angle: 0,
    radius: 0.1, // Start with a tiny visual radius logic will update it
    velocity: 0,
    isInDee: false,
    currentDee: 1,
    revolutionCount: 0,
    isAccelerating: false,
    time: 0,
    isExtracted: false,
  };

  particle.position.set(0, 0, 0); // Start at center
  // trajectoryPoints.length = 0;
  // updateTrajectory();

  params.revolutions = 0;
  params.currentRadius = 0;
  params.currentVelocity = 0;
}

function updateElectricField() {
  // Update Dee colors based on current polarity
  const time = Date.now() * 0.001 * params.oscillationFreq;
  const polarity = Math.sin(time) > 0 ? 1 : -1;

  // Update Dee materials
  const dee1Material = (dee1.children[0] as THREE.Mesh)
    .material as THREE.MeshPhongMaterial;
  const dee2Material = (dee2.children[0] as THREE.Mesh)
    .material as THREE.MeshPhongMaterial;

  if (polarity > 0) {
    dee1Material.color.setHex(0xff8800); // Orange for positive
    dee2Material.color.setHex(0x0088ff); // Blue for negative
    dee1.userData.potential = 1;
    dee2.userData.potential = -1;
  } else {
    dee1Material.color.setHex(0x0088ff); // Blue for negative
    dee2Material.color.setHex(0xff8800); // Orange for positive
    dee1.userData.potential = -1;
    dee2.userData.potential = 1;
  }
}

function updateMagnetIndicators() {
  // Update magnetic field visualization intensity
  fieldLines.forEach((arrow) => {
    const intensity = params.magneticField / 2.0;
    const lineMaterial = arrow.line.material as THREE.LineBasicMaterial;
    const coneMaterial = arrow.cone.material as THREE.MeshBasicMaterial;
    lineMaterial.opacity = intensity;
    coneMaterial.opacity = intensity;
  });
}

function calculateCyclotronFrequency() {
  // f = qB / (2πm)
  params.cyclotronFreq =
    (params.charge * params.magneticField) / (2 * Math.PI * params.mass);
  return params.cyclotronFreq;
}

function updateParticlePhysics(dt: number) {
  if (simulationState.isExtracted) return;

  simulationState.time += dt;

  // Calculate current cyclotron frequency
  calculateCyclotronFrequency();

  // Check if particle is in gap (between Dees)
  const gapSize = 0.1;
  const inGap =
    simulationState.radius < gapSize ||
    Math.abs(simulationState.angle % Math.PI) < 0.1;

  if (inGap && !simulationState.isAccelerating) {
    // Particle is being accelerated by electric field
    simulationState.isAccelerating = true;

    // Calculate velocity after acceleration: v = √(2qV/m)
    // We add energy: KE_new = KE_old + qV
    const deltaV = params.voltage;
    const currentKE =
      0.5 * params.mass * simulationState.velocity * simulationState.velocity;
    const deltaKE = params.charge * deltaV;
    const newKE = currentKE + deltaKE;

    simulationState.velocity = Math.sqrt((2 * newKE) / params.mass);

    // Update physical radius: r = mv/(qB)
    const physicalRadius =
      (params.mass * simulationState.velocity) /
      (params.charge * params.magneticField);

    // Convert to visual radius
    // Update visual radius
    simulationState.radius = physicalRadius * VISUAL_SCALE;
  } else if (!inGap) {
    simulationState.isAccelerating = false;
  }

  // ALWAYS update GUI parameters for real-time display
  // We use the last calculated physical radius
  const currentPhysicalRadius =
    (params.mass * simulationState.velocity) /
    (params.charge * params.magneticField);
  params.currentVelocity = simulationState.velocity;
  params.currentRadius = currentPhysicalRadius || 0;
  params.cyclotronFreq = calculateCyclotronFrequency(); // Ensure freq is updated

  // Circular motion
  if (simulationState.velocity > 0) {
    const angularVelocity =
      (params.charge * params.magneticField) / params.mass;

    // Angle decreases because (qB/m) > 0 and we subtract.
    simulationState.angle -=
      angularVelocity * dt * params.animationSpeed * 0.05;

    // Count revolutions (based on total angle traveled)
    // Use Math.abs because angle goes negative
    if (
      Math.abs(simulationState.angle) >
      (simulationState.revolutionCount + 1) * 2 * Math.PI
    ) {
      simulationState.revolutionCount++;
      params.revolutions = simulationState.revolutionCount;
    }
  }

  // Check for extraction
  if (simulationState.radius >= params.maxRadius) {
    if (!simulationState.isExtracted) {
      extractParticle();
    }
  }

  // Update particle position
  if (!simulationState.isExtracted) {
    const x = simulationState.radius * Math.cos(simulationState.angle);
    const z = simulationState.radius * Math.sin(simulationState.angle);
    particle.position.set(x, 0, z);

    // Add to trajectory
    // trajectoryPoints.push(new THREE.Vector3(x, 0, z));
    // if (trajectoryPoints.length > 2000) { // Increased limit for longer trail
    //   trajectoryPoints.shift(); // Remove old points
    // }
    // updateTrajectory();
  }
}

function extractParticle() {
  simulationState.isExtracted = true;
  params.extractParticle = false;

  // Create extraction animation
  const extractionDirection = new THREE.Vector3(1, 0, 0);
  extractionDirection.normalize();

  // Animate particle moving out
  const startPos = particle.position.clone();
  const endPos = startPos.clone().add(extractionDirection.multiplyScalar(5));

  let t = 0;
  const extractAnimation = () => {
    t += 0.02;
    if (t <= 1) {
      particle.position.lerpVectors(startPos, endPos, t);
      requestAnimationFrame(extractAnimation);
    } else {
      // Reset particle after extraction
      setTimeout(() => {
        resetParticle();
      }, 2000);
    }
  };
  extractAnimation();
}

// function updateTrajectory() {
//   if (trajectoryPoints.length > 1) {
//     trajectoryGeo.setFromPoints(trajectoryPoints);
//   }
// }

// =====================================================
// 10) ANIMATION LOOP
// =====================================================
function animate() {
  requestAnimationFrame(animate);

  // Update electric field oscillation
  updateElectricField();

  // Update particle physics if running
  if (params.isRunning) {
    updateParticlePhysics(0.016 * params.animationSpeed); // ~60fps
    // Update Flame Effect
    updateFlameEffect(0.016, particle.position, simulationState.velocity > 0);
  }

  // Animate magnetic field lines
  // STATIC FIELD: No animation needed for B-field in Cyclotron (constant DC)
  // if (params.animateFieldLines) {
  //   const time = Date.now() * 0.001 * params.fieldAnimationSpeed;

  //   fieldLines.forEach((arrow, index) => {
  //     // Keep direction fixed UPWARD
  //     arrow.setDirection(new THREE.Vector3(0, 1, 0));
  //   });
  // }

  renderer.render(scene, camera);
}

// Initialize
createFieldLines();
resetParticle();
animate();
