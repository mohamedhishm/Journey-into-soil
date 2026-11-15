import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { TEX } from "./textures";
import type {
  AnalysisResult,
  CameraPreset,
  DiveStage,
  LayerInspectData,
  NasaEvidence,
  Quality,
  SceneTelemetry,
  StrategyId,
  WeatherMode,
} from "./types";

const HT = [1.5, 1.5, 1.7, 1.5];
const GAP = 1.3;
const SW = 60;
const DEP = 60;
const DUR = 9.6;

const sm = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

export class SceneController {
  private canvas: HTMLCanvasElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private cam!: THREE.PerspectiveCamera;
  private grp!: THREE.Group;
  private fieldGroup!: THREE.Group;
  private profileGroup!: THREE.Group;
  private slabs: { g: THREE.Group; h: number; ph: number; mesh: THREE.Mesh }[] = [];
  private ambLight!: THREE.AmbientLight;
  private dirLight!: THREE.DirectionalLight;
  private rimLight!: THREE.PointLight;
  private dust!: THREE.Points;
  private rainParticles!: THREE.Points;
  private rainVelocities!: Float32Array;
  private weatherMode: WeatherMode = "auto";
  private saltCrustMesh!: THREE.Mesh;
  private rootGroup!: THREE.Group;
  private fieldWheatGroup!: THREE.Group;
  private fieldMaizeGroup!: THREE.Group;
  private cutawayWheatGroup!: THREE.Group;
  private cutawayMaizeGroup!: THREE.Group;
  private cropOverride: "wheat" | "maize" | null = null;
  private burst!: THREE.Points;
  private burstV!: Float32Array;
  private bst = -1;
  private swayU = { value: 0 };
  private cowMixers: { mixer: THREE.AnimationMixer; group: THREE.Object3D }[] = [];
  private palms: { crown: THREE.Group; phase: number }[] = [];
  private t0 = 0;
  private last = 0;
  private raf = 0;
  private rotT = 0;
  private drag: { x: number; r: number } | null = null;
  private tv = 0.34;
  private D = 13;
  private finished = false;
  private currentStage: DiveStage = "field";
  private focusedLayer: number | null = null;

  // External result and callbacks
  private result: AnalysisResult | null = null;
  private strategyId: StrategyId = "primary";
  private dayT = 0;
  private theme: "light" | "dark" = "light";
  private quality: Quality | "auto" = "high";

  private onInspectCb?: (data: LayerInspectData | null) => void;
  private onTelemetryCb?: (data: SceneTelemetry) => void;
  private onStageChangeCb?: (stage: DiveStage) => void;
  private onLayerFocusChangeCb?: (idx: number | null) => void;
  private onDiveProgressCb?: (key: string | null, canSkip: boolean) => void;

  private pointerDownHandler: (e: PointerEvent) => void;
  private pointerMoveHandler: (e: PointerEvent) => void;
  private pointerUpHandler: () => void;
  private resizeHandler: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.pointerDownHandler = this.onPointerDown.bind(this);
    this.pointerMoveHandler = this.onPointerMove.bind(this);
    this.pointerUpHandler = this.onPointerUp.bind(this);
    this.resizeHandler = this.fit.bind(this);

    this.initScene();
    this.fit();
    window.addEventListener("resize", this.resizeHandler);

    this.t0 = performance.now();
    this.last = performance.now();
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }

  private initScene(): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

    this.scene = new THREE.Scene();
    this.scene.fog = null; // Zero fog in field mode: crystal-clear sky and crisp landscape silhouettes

    this.cam = new THREE.PerspectiveCamera(38, 1, 0.1, 120);

    // Natural daylight lighting (pure crisp daylight, zero yellow glare)
    this.ambLight = new THREE.AmbientLight(0xf0f7ff, 0.82);
    this.scene.add(this.ambLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.94);
    this.dirLight.position.set(-5, 9, 8);
    this.scene.add(this.dirLight);

    // Cool sky-fill bounce light
    this.rimLight = new THREE.PointLight(0x7dc0f5, 0.45, 35);
    this.rimLight.position.set(6, -2, 6);
    this.scene.add(this.rimLight);

    // Root group
    this.grp = new THREE.Group();
    this.scene.add(this.grp);

    // Decoupled independent scene groups:
    // fieldGroup: Act 1 surface farm environment (continuous terrain, centered cattle herd, date palm windbreaks)
    // profileGroup: Act 2 & 3 subterranean soil cutaway profile (topsoil anchored at y = 0, deeper layers)
    this.fieldGroup = new THREE.Group();
    this.grp.add(this.fieldGroup);

    this.profileGroup = new THREE.Group();
    this.grp.add(this.profileGroup);
    this.profileGroup.visible = false;

    // Textures & Slabs
    const ld = new THREE.TextureLoader();
    const sc = [0x241911, 0x45311f, 0x60291b, 0x5d5647];

    const loadTex = (i: number, rx: number, ry: number) => {
      const t = ld.load(TEX[i]);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      t.wrapS = THREE.MirroredRepeatWrapping;
      t.wrapT = THREE.MirroredRepeatWrapping;
      t.repeat.set(rx, ry);
      return t;
    };

    const makeMat = (t: THREE.Texture, col?: number) =>
      new THREE.MeshStandardMaterial({
        map: t,
        bumpMap: t,
        bumpScale: 1.2,
        roughness: 1,
        color: col || 0xffffff,
      });

    // 1. Build subterranean soil profile slabs in profileGroup (for Act 2 & 3)
    this.slabs = [];
    HT.forEach((h, i) => {
      const side = new THREE.MeshStandardMaterial({ color: sc[i], roughness: 1 });
      const tp = loadTex(i, SW / 7.5, 6);
      const boxMat = [
        side,
        side,
        makeMat(tp, i ? 0xffffff : 0xcfc5ac),
        makeMat(tp),
        makeMat(loadTex(i, SW / 7.5, 1)),
        side,
      ];
      const box = new THREE.Mesh(new THREE.BoxGeometry(SW, h, DEP), boxMat);
      box.position.z = -DEP / 2;

      const g = new THREE.Group();
      g.add(box);
      this.profileGroup.add(g);
      this.slabs.push({ g, h, ph: i * 1.3, mesh: box });
    });

    // Plant subtle surface vegetation along the cutaway top edge for Act 2/3
    this.cutawayWheatGroup = new THREE.Group();
    this.cutawayMaizeGroup = new THREE.Group();
    this.cutawayMaizeGroup.visible = false;
    this.slabs[0].g.add(this.cutawayWheatGroup);
    this.slabs[0].g.add(this.cutawayMaizeGroup);
    this.plantWheatField(this.cutawayWheatGroup, -28, 28, -20, 0, 0.65, 0.55, HT[0] / 2);
    this.plantMaizeField(this.cutawayMaizeGroup, -28, 28, -20, 0, 0.95, 0.85, HT[0] / 2);

    // Surface Salinity Crust Mesh on Slab 0 (topsoil)
    const saltGeo = new THREE.PlaneGeometry(SW * 0.98, DEP * 0.98);
    const saltMat = new THREE.MeshStandardMaterial({
      color: 0xfcfbfa,
      roughness: 0.2,
      metalness: 0.15,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.saltCrustMesh = new THREE.Mesh(saltGeo, saltMat);
    this.saltCrustMesh.rotation.x = -Math.PI / 2;
    this.saltCrustMesh.position.set(0, HT[0] / 2 + 0.02, -DEP / 2);
    this.slabs[0].g.add(this.saltCrustMesh);

    // Procedural Root System growing along the front subterranean cutaway face
    this.rootGroup = this.buildRootSystem();
    this.rootGroup.position.set(0, HT[0] / 2, 0.12);
    this.slabs[0].g.add(this.rootGroup);

    // 2. Build stable, continuous above-ground farm terrain in fieldGroup (for Act 1)
    // Sits firmly at y = 0 and NEVER moves down with the camera
    const sideSoilMat = new THREE.MeshStandardMaterial({ color: 0x241911, roughness: 1 });
    const topGroundMat = makeMat(loadTex(0, SW / 7.5, 6), 0xcfc5ac);
    const fieldGroundMat = [
      sideSoilMat,
      sideSoilMat,
      topGroundMat,
      sideSoilMat,
      sideSoilMat,
      sideSoilMat,
    ];
    const fieldGround = new THREE.Mesh(new THREE.BoxGeometry(SW + 4, 2.5, 76), fieldGroundMat);
    fieldGround.position.set(0, -1.25, -16);
    this.fieldGroup.add(fieldGround);

    // Instanced lush agricultural crops across Egyptian farm with central pasture clearing for cattle
    this.fieldWheatGroup = new THREE.Group();
    this.fieldMaizeGroup = new THREE.Group();
    this.fieldMaizeGroup.visible = false;
    this.fieldGroup.add(this.fieldWheatGroup);
    this.fieldGroup.add(this.fieldMaizeGroup);
    const pastureExclude = {
      x0: -6.5,
      x1: 6.5,
      z0: -15.0,
      z1: -7.0,
    };
    this.plantWheatField(this.fieldWheatGroup, -26, 26, -52, 14, 0.55, 0.45, 0, pastureExclude);
    this.plantMaizeField(this.fieldMaizeGroup, -26, 26, -52, 14, 0.90, 0.80, 0, pastureExclude);

    // Date Palm tree windbreaks (authentic Egyptian Nile Delta farm shelterbelts)
    this.plantDatePalms();

    // Centered grazing cattle herd (official animated low-poly Cow model from three.js ecosystem)
    this.loadAnimatedCows();

    // Dust motes particles
    const N = 180;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 28;
      pos[i * 3 + 1] = -Math.random() * 12;
      pos[i * 3 + 2] = (Math.random() - 0.3) * 16;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(
      pg,
      new THREE.PointsMaterial({
        color: 0xdaf0ff,
        size: 0.05,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      })
    );
    this.scene.add(this.dust);

    // Weather rain particle system (450 dynamic falling raindrops)
    const NR = 450;
    const rp = new Float32Array(NR * 3);
    this.rainVelocities = new Float32Array(NR);
    for (let i = 0; i < NR; i++) {
      rp[i * 3] = (Math.random() - 0.5) * 58;
      rp[i * 3 + 1] = Math.random() * 24;
      rp[i * 3 + 2] = (Math.random() - 0.6) * 52;
      this.rainVelocities[i] = 0.38 + Math.random() * 0.28;
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.BufferAttribute(rp, 3));
    this.rainParticles = new THREE.Points(
      rg,
      new THREE.PointsMaterial({
        color: 0x8ec7f5,
        size: 0.14,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      })
    );
    this.rainParticles.visible = false;
    this.scene.add(this.rainParticles);

    // Ground crack burst particles
    const NB = 200;
    const bp = new Float32Array(NB * 3);
    this.burstV = new Float32Array(NB * 3);
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.BufferAttribute(bp, 3));
    this.burst = new THREE.Points(
      bg,
      new THREE.PointsMaterial({
        color: 0x9c8458,
        size: 0.16,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    this.burst.frustumCulled = false;
    this.scene.add(this.burst);

    // Pointer events for horizontal rotation
    this.canvas.addEventListener("pointerdown", this.pointerDownHandler);
    this.canvas.addEventListener("pointermove", this.pointerMoveHandler);
    this.canvas.addEventListener("pointerup", this.pointerUpHandler);
    this.canvas.addEventListener("pointercancel", this.pointerUpHandler);
  }

  private mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const posList: number[] = [];
    const indexList: number[] = [];
    let vertOffset = 0;

    for (const g of geos) {
      const p = g.getAttribute("position");
      if (!p) continue;
      for (let i = 0; i < p.count; i++) {
        posList.push(p.getX(i), p.getY(i), p.getZ(i));
      }
      if (g.index) {
        for (let i = 0; i < g.index.count; i++) {
          indexList.push(g.index.getX(i) + vertOffset);
        }
      } else {
        for (let i = 0; i < p.count; i++) {
          indexList.push(vertOffset + i);
        }
      }
      vertOffset += p.count;
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute("position", new THREE.Float32BufferAttribute(posList, 3));
    merged.setIndex(indexList);
    merged.computeVertexNormals();
    return merged;
  }

  private createMaizeLeavesGeometry(): THREE.BufferGeometry {
    // 4 alternating broad arching leaves (lanceolate blades) with natural drooping curve
    const leafSpecs = [
      { y: 0.65, yaw: 0.1, len: 1.15, width: 0.24, arch: 0.35, droop: 0.55 },
      { y: 0.95, yaw: Math.PI * 0.92, len: 1.20, width: 0.26, arch: 0.38, droop: 0.58 },
      { y: 1.35, yaw: 0.38, len: 1.05, width: 0.22, arch: 0.32, droop: 0.50 },
      { y: 1.70, yaw: Math.PI * 1.08, len: 0.90, width: 0.20, arch: 0.28, droop: 0.42 },
    ];

    const positions: number[] = [];
    const indices: number[] = [];
    const segs = 7;

    leafSpecs.forEach((spec) => {
      const baseIdx = positions.length / 3;
      const cosY = Math.cos(spec.yaw);
      const sinY = Math.sin(spec.yaw);

      for (let s = 0; s <= segs; s++) {
        const u = s / segs;
        const w = spec.width * Math.sin(Math.PI * Math.max(0.05, u)) ** 0.65;
        const leafY = spec.y + Math.sin(Math.PI * u * 0.55) * spec.arch - u * u * spec.droop;
        const forwardDist = u * spec.len;

        const xOffset = forwardDist * sinY;
        const zOffset = forwardDist * cosY;

        const perpX = cosY * (w * 0.5);
        const perpZ = -sinY * (w * 0.5);

        // 1. Left edge
        positions.push(xOffset - perpX, leafY + 0.02 * (1 - u), zOffset - perpZ);
        // 2. Center spine
        positions.push(xOffset, leafY, zOffset);
        // 3. Right edge
        positions.push(xOffset + perpX, leafY + 0.02 * (1 - u), zOffset + perpZ);
      }

      for (let s = 0; s < segs; s++) {
        const row1 = baseIdx + s * 3;
        const row2 = baseIdx + (s + 1) * 3;

        indices.push(row1, row2, row1 + 1);
        indices.push(row1 + 1, row2, row2 + 1);

        indices.push(row1 + 1, row2 + 1, row1 + 2);
        indices.push(row1 + 2, row2 + 1, row2 + 2);
      }
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  private createMaizeTasselGeometry(): THREE.BufferGeometry {
    const geos: THREE.BufferGeometry[] = [];

    // 1. Apex golden tassel (male inflorescence) at y = 2.38 - 2.85
    const spikeAngles = [
      { rad: 0, pitch: 0.12, len: 0.48 },
      { rad: 1.25, pitch: 0.22, len: 0.42 },
      { rad: 2.50, pitch: 0.20, len: 0.44 },
      { rad: 3.75, pitch: 0.24, len: 0.40 },
      { rad: 5.00, pitch: 0.18, len: 0.45 },
    ];
    spikeAngles.forEach((sp) => {
      const g = new THREE.ConeGeometry(0.022, sp.len, 4);
      g.translate(0, sp.len / 2, 0);
      g.rotateZ(sp.pitch);
      g.rotateY(sp.rad);
      g.translate(0, 2.38, 0);
      geos.push(g);
    });

    // 2. Husked Ear of corn (cob) at mid-stalk (y = 1.05 - 1.35)
    const earGeo = new THREE.CylinderGeometry(0.065, 0.08, 0.38, 6);
    earGeo.translate(0, 0.19, 0);
    earGeo.rotateZ(-0.42);
    earGeo.rotateY(0.7);
    earGeo.translate(0.07, 1.05, 0.05);
    geos.push(earGeo);

    // 3. Golden silk tassel at the tip of the ear
    const silkGeo = new THREE.ConeGeometry(0.025, 0.14, 4);
    silkGeo.translate(0, 0.07, 0);
    silkGeo.rotateZ(-0.42);
    silkGeo.rotateY(0.7);
    silkGeo.translate(0.18, 1.28, 0.12);
    geos.push(silkGeo);

    return this.mergeGeometries(geos);
  }

  private plantWheatField(
    parent: THREE.Object3D,
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    dx: number,
    dz: number,
    y: number,
    excludeZone?: { x0: number; x1: number; z0: number; z1: number }
  ): void {
    const nx = Math.floor((x1 - x0) / dx) + 1;
    const nz = Math.floor((z1 - z0) / dz) + 1;
    const n = nx * nz;

    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    mat.onBeforeCompile = (s) => {
      s.uniforms.uTime = this.swayU;
      s.vertexShader =
        "uniform float uTime;\n" +
        s.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\ntransformed.x += sin(uTime*1.7+instanceMatrix[3][0]*.6+instanceMatrix[3][2]*.35)*.09*position.y;"
        );
    };

    const geo = new THREE.ConeGeometry(0.09, 1.2, 5);
    geo.translate(0, 0.6, 0);

    const d = new THREE.Object3D();
    const c = new THREE.Color();
    d.rotation.order = "YXZ";

    for (let k = 0; k < 3; k++) {
      const m = new THREE.InstancedMesh(geo, mat, n);
      let q = 0;
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
          const jitterX = (Math.random() - 0.5) * dx * 0.7;
          const jitterZ = (Math.random() - 0.5) * dz * 0.7;
          const posX = x0 + i * dx + jitterX;
          const posZ = z0 + j * dz + jitterZ;

          // Check if coordinate falls inside livestock pasture clearing
          if (
            excludeZone &&
            posX >= excludeZone.x0 &&
            posX <= excludeZone.x1 &&
            posZ >= excludeZone.z0 &&
            posZ <= excludeZone.z1
          ) {
            d.scale.set(0, 0, 0);
            d.position.set(posX, y, posZ);
            d.updateMatrix();
            m.setMatrixAt(q++, d.matrix);
            continue;
          }

          d.position.set(posX, y, posZ);

          if (k === 0) {
            // Main vertical wheat/barley stalk with ear
            d.rotation.set((Math.random() - 0.5) * 0.15, Math.random() * Math.PI * 2, 0);
            d.scale.set(1.15, 0.85 + Math.random() * 0.45, 1.15);
            // Rich golden-harvest and deep green tones
            c.setHSL(
              0.22 + Math.random() * 0.08,
              0.48 + Math.random() * 0.2,
              0.2 + Math.random() * 0.14
            );
          } else {
            // Natural spreading side blades and foliage
            const tilt = 0.28 + Math.random() * 0.35;
            d.rotation.set(tilt, k * 2.1 + Math.random() * 1.5, 0);
            d.scale.set(0.85, 0.55 + Math.random() * 0.4, 0.85);
            c.setHSL(
              0.24 + Math.random() * 0.09,
              0.42 + Math.random() * 0.2,
              0.16 + Math.random() * 0.12
            );
          }

          d.updateMatrix();
          m.setMatrixAt(q, d.matrix);
          m.setColorAt(q++, c);
        }
      }
      m.count = q;
      m.frustumCulled = false;
      parent.add(m);
    }
  }

  private plantMaizeField(
    parent: THREE.Object3D,
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    dx: number,
    dz: number,
    y: number,
    excludeZone?: { x0: number; x1: number; z0: number; z1: number }
  ): void {
    const nx = Math.floor((x1 - x0) / dx) + 1;
    const nz = Math.floor((z1 - z0) / dz) + 1;
    const n = nx * nz;

    const stalkMat = new THREE.MeshStandardMaterial({
      roughness: 0.75,
      side: THREE.DoubleSide,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      roughness: 0.68,
      side: THREE.DoubleSide,
    });
    const tasselMat = new THREE.MeshStandardMaterial({
      roughness: 0.65,
      side: THREE.DoubleSide,
    });

    const addSway = (mat: THREE.MeshStandardMaterial, mult: number) => {
      mat.onBeforeCompile = (s) => {
        s.uniforms.uTime = this.swayU;
        s.vertexShader =
          "uniform float uTime;\n" +
          s.vertexShader.replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>\ntransformed.x += sin(uTime * 1.5 + instanceMatrix[3][0] * 0.5 + instanceMatrix[3][2] * 0.3) * ${mult} * (position.y / 2.4);\ntransformed.z += cos(uTime * 1.2 + instanceMatrix[3][0] * 0.4 + instanceMatrix[3][2] * 0.3) * (${mult} * 0.4) * (position.y / 2.4);`
          );
      };
    };

    addSway(stalkMat, 0.07);
    addSway(leafMat, 0.14);
    addSway(tasselMat, 0.10);

    // Stalk Geometry: main culm + node collars
    const mainCulm = new THREE.CylinderGeometry(0.065, 0.09, 2.35, 6);
    mainCulm.translate(0, 1.175, 0);
    const node1 = new THREE.CylinderGeometry(0.082, 0.082, 0.04, 6);
    node1.translate(0, 0.65, 0);
    const node2 = new THREE.CylinderGeometry(0.076, 0.076, 0.04, 6);
    node2.translate(0, 1.05, 0);
    const node3 = new THREE.CylinderGeometry(0.070, 0.070, 0.04, 6);
    node3.translate(0, 1.45, 0);
    const stalkGeo = this.mergeGeometries([mainCulm, node1, node2, node3]);

    const leavesGeo = this.createMaizeLeavesGeometry();
    const tasselGeo = this.createMaizeTasselGeometry();

    const culmMesh = new THREE.InstancedMesh(stalkGeo, stalkMat, n);
    const leavesMesh = new THREE.InstancedMesh(leavesGeo, leafMat, n);
    const tasselMesh = new THREE.InstancedMesh(tasselGeo, tasselMat, n);

    const d = new THREE.Object3D();
    const stalkCol = new THREE.Color();
    const leafCol = new THREE.Color();
    const tasselCol = new THREE.Color();
    d.rotation.order = "YXZ";

    let q = 0;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const jitterX = (Math.random() - 0.5) * dx * 0.65;
        const jitterZ = (Math.random() - 0.5) * dz * 0.65;
        const posX = x0 + i * dx + jitterX;
        const posZ = z0 + j * dz + jitterZ;

        if (
          excludeZone &&
          posX >= excludeZone.x0 &&
          posX <= excludeZone.x1 &&
          posZ >= excludeZone.z0 &&
          posZ <= excludeZone.z1
        ) {
          d.scale.set(0, 0, 0);
          d.position.set(posX, y, posZ);
          d.updateMatrix();
          culmMesh.setMatrixAt(q, d.matrix);
          leavesMesh.setMatrixAt(q, d.matrix);
          tasselMesh.setMatrixAt(q, d.matrix);
          q++;
          continue;
        }

        d.position.set(posX, y, posZ);
        d.rotation.set(
          (Math.random() - 0.5) * 0.07,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.07
        );
        const stalkScale = 0.92 + Math.random() * 0.22;
        d.scale.set(stalkScale, stalkScale * (0.95 + Math.random() * 0.15), stalkScale);
        d.updateMatrix();

        culmMesh.setMatrixAt(q, d.matrix);
        leavesMesh.setMatrixAt(q, d.matrix);
        tasselMesh.setMatrixAt(q, d.matrix);

        // Rich vegetative maize colors
        stalkCol.setHSL(
          0.25 + Math.random() * 0.03,
          0.62 + Math.random() * 0.12,
          0.21 + Math.random() * 0.06
        );
        leafCol.setHSL(
          0.26 + Math.random() * 0.03,
          0.68 + Math.random() * 0.14,
          0.20 + Math.random() * 0.05
        );
        tasselCol.setHSL(
          0.12 + Math.random() * 0.04,
          0.78 + Math.random() * 0.14,
          0.52 + Math.random() * 0.08
        );

        culmMesh.setColorAt(q, stalkCol);
        leavesMesh.setColorAt(q, leafCol);
        tasselMesh.setColorAt(q, tasselCol);
        q++;
      }
    }

    culmMesh.count = q;
    culmMesh.frustumCulled = false;
    leavesMesh.count = q;
    leavesMesh.frustumCulled = false;
    tasselMesh.count = q;
    tasselMesh.frustumCulled = false;

    parent.add(culmMesh);
    parent.add(leavesMesh);
    parent.add(tasselMesh);
  }

  private buildRootSystem(): THREE.Group {
    const rootGrp = new THREE.Group();

    const loader = new THREE.TextureLoader();
    const rootTex = loader.load("/textures/crop_root.png");
    rootTex.colorSpace = THREE.SRGBColorSpace;
    rootTex.anisotropy = 8;

    const rootMat = new THREE.MeshStandardMaterial({
      map: rootTex,
      transparent: true,
      alphaTest: 0.05,
      roughness: 0.65,
      metalness: 0.04,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    // Multi-plant root network distributed across the cutaway edge beneath crops
    const stations = [
      { x: -24.0, scale: 0.95, flip: false, z: 0.08, deep: false },
      { x: -21.0, scale: 0.88, flip: true,  z: 0.11, deep: false },
      { x: -18.0, scale: 1.12, flip: false, z: 0.09, deep: true },
      { x: -15.0, scale: 0.92, flip: true,  z: 0.12, deep: false },
      { x: -12.0, scale: 1.18, flip: false, z: 0.10, deep: true },
      { x:  -9.0, scale: 0.90, flip: true,  z: 0.07, deep: false },
      { x:  -6.0, scale: 1.05, flip: false, z: 0.11, deep: false },
      { x:  -3.0, scale: 0.94, flip: true,  z: 0.08, deep: false },
      { x:   0.0, scale: 1.28, flip: false, z: 0.13, deep: true },  // prominent central anchor
      { x:   3.0, scale: 0.94, flip: true,  z: 0.08, deep: false },
      { x:   6.0, scale: 1.05, flip: false, z: 0.11, deep: false },
      { x:   9.0, scale: 0.90, flip: true,  z: 0.07, deep: false },
      { x:  12.0, scale: 1.18, flip: false, z: 0.10, deep: true },
      { x:  15.0, scale: 0.92, flip: true,  z: 0.12, deep: false },
      { x:  18.0, scale: 1.12, flip: false, z: 0.09, deep: true },
      { x:  21.0, scale: 0.88, flip: true,  z: 0.11, deep: false },
      { x:  24.0, scale: 0.95, flip: false, z: 0.08, deep: false },
    ];

    // Aspect ratio of crop_root.png is 377 / 210 ~= 1.795
    const aspect = 377 / 210;

    stations.forEach((st) => {
      const baseH = st.deep ? 3.45 : 2.35;
      const h = baseH * st.scale;
      const w = h * aspect;

      // Create plane geometry and shift pivot to top-center (where shoot meets ground)
      const geo = new THREE.PlaneGeometry(w, h);
      geo.translate(0, -h / 2, 0);

      const mesh = new THREE.Mesh(geo, rootMat);
      mesh.position.set(st.x, 0, st.z);
      if (st.flip) {
        mesh.scale.x = -1;
      }
      rootGrp.add(mesh);
    });

    return rootGrp;
  }

  private createDatePalmTree(scale = 1): { group: THREE.Group; crown: THREE.Group; phase: number } {
    const group = new THREE.Group();

    // 1. Weathered fibrous trunk with subtle organic curvature
    const trunkH = 7.5 * scale;
    const trunkGeo = new THREE.CylinderGeometry(0.24 * scale, 0.42 * scale, trunkH, 8, 5);
    trunkGeo.translate(0, trunkH / 2, 0);

    const barkMat = new THREE.MeshStandardMaterial({
      color: 0x564332,
      roughness: 0.92,
      flatShading: true,
    });
    const trunk = new THREE.Mesh(trunkGeo, barkMat);
    trunk.rotation.z = (Math.random() - 0.5) * 0.07;
    trunk.rotation.x = (Math.random() - 0.5) * 0.07;
    group.add(trunk);

    // Ring collars representing pruned frond bases (iconic Egyptian date palm rings)
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x473626,
      roughness: 0.95,
    });
    const numRings = 9;
    for (let r = 1; r <= numRings; r++) {
      const ry = (r / (numRings + 1)) * trunkH;
      const rad = (0.42 - (0.42 - 0.24) * (r / (numRings + 1))) * scale + 0.03 * scale;
      const ringGeo = new THREE.CylinderGeometry(rad, rad, 0.12 * scale, 8);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = ry;
      trunk.add(ring);
    }

    // 2. Crown Group (sways organically in breeze)
    const crown = new THREE.Group();
    crown.position.set(0, trunkH, 0);
    trunk.add(crown);

    // Frond materials: rich emerald, vibrant mid canopy, and sunlit spear green
    const matFrondLow = new THREE.MeshStandardMaterial({
      color: 0x2a7a1c,
      emissive: 0x0a2406,
      emissiveIntensity: 0.22,
      roughness: 0.55,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const matFrondMid = new THREE.MeshStandardMaterial({
      color: 0x389a24,
      emissive: 0x0d2e08,
      emissiveIntensity: 0.22,
      roughness: 0.55,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const matFrondHigh = new THREE.MeshStandardMaterial({
      color: 0x52b82e,
      emissive: 0x143c0c,
      emissiveIntensity: 0.22,
      roughness: 0.55,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    const createFrond = (len: number, pitchDown: number, mat: THREE.Material): THREE.Group => {
      const frond = new THREE.Group();

      // Proximal stem segment
      const seg1Len = len * 0.52;
      const stemGeo1 = new THREE.CylinderGeometry(0.024 * scale, 0.016 * scale, seg1Len, 4);
      stemGeo1.translate(0, seg1Len / 2, 0);
      const stem1 = new THREE.Mesh(stemGeo1, mat);
      frond.add(stem1);

      // Proximal blade (flattened tapered feather leaf)
      const bladeGeo1 = new THREE.ConeGeometry(0.42 * scale, seg1Len, 3);
      bladeGeo1.translate(0, seg1Len / 2, 0);
      const blade1 = new THREE.Mesh(bladeGeo1, mat);
      blade1.scale.set(1, 1, 0.12);
      frond.add(blade1);

      // Distal drooping segment (creates iconic arched silhouette)
      const seg2Len = len * 0.48;
      const seg2 = new THREE.Group();
      seg2.position.set(0, seg1Len, 0);
      seg2.rotation.x = 0.38; // droop further downward

      const stemGeo2 = new THREE.CylinderGeometry(0.016 * scale, 0.008 * scale, seg2Len, 4);
      stemGeo2.translate(0, seg2Len / 2, 0);
      const stem2 = new THREE.Mesh(stemGeo2, mat);
      seg2.add(stem2);

      const bladeGeo2 = new THREE.ConeGeometry(0.35 * scale, seg2Len, 3);
      bladeGeo2.translate(0, seg2Len / 2, 0);
      const blade2 = new THREE.Mesh(bladeGeo2, mat);
      blade2.scale.set(1, 1, 0.1);
      seg2.add(blade2);

      frond.add(seg2);

      frond.rotation.x = pitchDown;
      return frond;
    };

    // Tier 1: Lower drooping mature fronds (8 fronds radiating at ~68° pitch)
    const n1 = 8;
    for (let i = 0; i < n1; i++) {
      const az = (i / n1) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const fGroup = new THREE.Group();
      fGroup.rotation.y = az;
      fGroup.add(createFrond(4.4 * scale, 1.18, matFrondLow));
      crown.add(fGroup);
    }

    // Tier 2: Mid-canopy arching fronds (8 fronds radiating at ~46° pitch)
    const n2 = 8;
    for (let i = 0; i < n2; i++) {
      const az = (i / n2) * Math.PI * 2 + Math.PI / n2 + (Math.random() - 0.5) * 0.2;
      const fGroup = new THREE.Group();
      fGroup.rotation.y = az;
      fGroup.add(createFrond(3.9 * scale, 0.8, matFrondMid));
      crown.add(fGroup);
    }

    // Tier 3: Upper young spear fronds (6 fronds radiating at ~24° pitch)
    const n3 = 6;
    for (let i = 0; i < n3; i++) {
      const az = (i / n3) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const fGroup = new THREE.Group();
      fGroup.rotation.y = az;
      fGroup.add(createFrond(3.1 * scale, 0.42, matFrondHigh));
      crown.add(fGroup);
    }

    // 3. Hanging Date Fruit Bunches (عراجين البلح)
    const dateMat = new THREE.MeshStandardMaterial({
      color: 0xd66d18, // ripe golden amber date
      roughness: 0.65,
    });
    const stalkMat = new THREE.MeshStandardMaterial({
      color: 0x9b541a,
      roughness: 0.8,
    });

    const numClusters = 3;
    for (let c = 0; c < numClusters; c++) {
      const clusterGroup = new THREE.Group();
      const az = (c / numClusters) * Math.PI * 2 + 0.5;
      clusterGroup.rotation.y = az;

      // Arched stalk hanging down
      const stalkGeo = new THREE.CylinderGeometry(0.02 * scale, 0.015 * scale, 0.65 * scale, 4);
      stalkGeo.translate(0, -0.32 * scale, 0);
      const stalk = new THREE.Mesh(stalkGeo, stalkMat);
      stalk.rotation.x = 0.55;
      clusterGroup.add(stalk);

      // Heavy cluster of dates hanging from stalk
      const clusterGeo = new THREE.ConeGeometry(0.3 * scale, 0.7 * scale, 6);
      clusterGeo.translate(0, -0.35 * scale, 0);
      const clusterMesh = new THREE.Mesh(clusterGeo, dateMat);
      clusterMesh.position.set(0, -0.6 * scale, 0.35 * scale);
      clusterMesh.rotation.x = Math.PI; // hangs downward
      clusterGroup.add(clusterMesh);

      crown.add(clusterGroup);
    }

    return {
      group,
      crown,
      phase: Math.random() * Math.PI * 2,
    };
  }

  private plantDatePalms(): void {
    // Left boundary canal line along farm field (fieldGroup)
    for (let z = -50; z <= 12; z += 5.8) {
      const s = 0.9 + Math.random() * 0.35;
      const palm = this.createDatePalmTree(s);
      const jx = (Math.random() - 0.5) * 1.2;
      const jz = (Math.random() - 0.5) * 1.0;
      palm.group.position.set(-25.5 + jx, 0, z + jz);
      palm.group.rotation.y = Math.random() * Math.PI * 2;
      this.fieldGroup.add(palm.group);
      this.palms.push(palm);
    }

    // Right boundary canal line along farm field (fieldGroup)
    for (let z = -50; z <= 12; z += 5.8) {
      const s = 0.9 + Math.random() * 0.35;
      const palm = this.createDatePalmTree(s);
      const jx = (Math.random() - 0.5) * 1.2;
      const jz = (Math.random() - 0.5) * 1.0;
      palm.group.position.set(25.5 + jx, 0, z + jz);
      palm.group.rotation.y = Math.random() * Math.PI * 2;
      this.fieldGroup.add(palm.group);
      this.palms.push(palm);
    }

    // Horizon date palm grove along the rear edge of the field (fieldGroup)
    for (let x = -24; x <= 24; x += 4.2) {
      const s = 0.95 + Math.random() * 0.45;
      const palm = this.createDatePalmTree(s);
      const jx = (Math.random() - 0.5) * 1.0;
      const jz = (Math.random() - 0.5) * 1.4;
      palm.group.position.set(x + jx, 0, -53 + jz);
      palm.group.rotation.y = Math.random() * Math.PI * 2;
      this.fieldGroup.add(palm.group);
      this.palms.push(palm);
    }

    // Scenic framing palms flanking the view in foreground
    for (const side of [-1, 1]) {
      const s = 0.95 + Math.random() * 0.25;
      const palm = this.createDatePalmTree(s);
      palm.group.position.set(side * 17.5, 0, 5.0 + Math.random() * 2.0);
      palm.group.rotation.y = Math.random() * Math.PI * 2;
      this.fieldGroup.add(palm.group);
      this.palms.push(palm);
    }
  }

  private loadAnimatedCows(): void {
    const loader = new GLTFLoader();
    loader.load(
      "/models/cow.glb",
      (gltf) => {
        const baseScene = gltf.scene;
        const idleClip =
          gltf.animations.find((a) => a.name === "Idle") || gltf.animations[0];

        baseScene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        const spawnCow = (
          parent: THREE.Object3D,
          x: number,
          y: number,
          z: number,
          rotY: number,
          scale: number
        ) => {
          const cow = SkeletonUtils.clone(baseScene);
          cow.position.set(x, y, z);
          cow.rotation.y = rotY;
          cow.scale.set(scale, scale, scale);
          parent.add(cow);

          if (idleClip) {
            const mixer = new THREE.AnimationMixer(cow);
            const action = mixer.clipAction(idleClip);
            action.play();
            // Desynchronize idle grazing timing across herd
            mixer.setTime(Math.random() * 3.0);
            this.cowMixers.push({ mixer, group: cow });
          }
        };

        // Centered Egyptian cattle herd in the middle pasture meadow (fieldGroup, y = 0)
        // Focal Center: Mother Holstein cow and calf
        spawnCow(this.fieldGroup, -0.7, 0, -9.8, 0.75, 0.33);
        spawnCow(this.fieldGroup, 0.6, 0, -9.2, 1.25, 0.20); // calf
        // Flanking herd companions in central pasture
        spawnCow(this.fieldGroup, 2.4, 0, -10.5, -1.9, 0.32);
        spawnCow(this.fieldGroup, -2.5, 0, -11.2, 2.1, 0.31);
        spawnCow(this.fieldGroup, 1.3, 0, -12.4, -0.7, 0.30);
        spawnCow(this.fieldGroup, -1.6, 0, -12.8, 0.5, 0.30);
        // Additional grazing cattle in mid-distance
        spawnCow(this.fieldGroup, 5.0, 0, -16.5, -1.4, 0.28);
        spawnCow(this.fieldGroup, -5.4, 0, -17.5, 1.5, 0.27);
        spawnCow(this.fieldGroup, 0.2, 0, -22.0, 0.3, 0.24);
      },
      undefined,
      (err) => {
        console.warn("Failed to load cow.glb:", err);
      }
    );
  }

  public fit(): void {
    const W = this.canvas.clientWidth || window.innerWidth;
    const H = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(W, H, false);
    this.cam.aspect = W / H;
    this.tv = Math.tan((this.cam.fov * Math.PI) / 360);
    this.D = Math.max(5.9 / this.tv, (8 * 1.12 / 2) / (this.tv * this.cam.aspect));

    if (W < 760) {
      this.D *= 1.1;
      this.cam.setViewOffset(W, H, 0, H * 0.16, W, H);
    } else {
      this.cam.clearViewOffset();
    }

    this.grp.position.x = W >= 760 ? (-143 / W) * (2 * this.D * this.tv * this.cam.aspect) : 0;
    this.cam.updateProjectionMatrix();
  }

  private onPointerDown(e: PointerEvent): void {
    this.drag = { x: e.clientX, r: this.rotT };
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // pointer capture might fail gracefully
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.drag) {
      this.rotT = Math.max(-0.35, Math.min(0.35, this.drag.r + (e.clientX - this.drag.x) / 400));
    }
  }

  private onPointerUp(): void {
    this.drag = null;
  }

  private frame(now: number): void {
    this.raf = requestAnimationFrame(this.frame);

    const t = (now - this.t0) / 1000;
    const ts = Math.min(t, DUR);
    const tt = now / 1000;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.swayU.value = tt;

    // Camera keyframe interpolation
    const K: [number, [number, number, number], [number, number, number]][] = [
      [0, [0, 2.5, 9.5], [0, 0.8, -10.0]],
      [2.4, [0, 2.2, 8.5], [0, 0.6, -10.0]],
      [4.8, [0, -3.8, this.D], [0, -3.8, 0]],
      [DUR, [0, -5.05, this.D], [0, -5.05, 0]],
    ];

    let kIdx = 0;
    while (kIdx < K.length - 2 && ts > K[kIdx + 1][0]) kIdx++;

    const a = K[kIdx];
    const b = K[kIdx + 1];
    const u = sm((ts - a[0]) / (b[0] - a[0]));
    const lerpArr = (p: number[], q: number[]) => p.map((x, k) => x + (q[k] - x) * u);

    const cp = lerpArr(a[1], b[1]);
    const la = lerpArr(a[2], b[2]);
    this.cam.position.set(cp[0], cp[1], cp[2]);
    this.cam.lookAt(la[0], la[1], la[2]);

    // Independent scene visibility switching
    // Act 1 (ts < 3.2): above-ground farm scene is active
    // Act 2 & 3 (ts >= 3.2): subterranean cutaway profile is active
    if (ts < 3.2) {
      this.fieldGroup.visible = true;
      this.profileGroup.visible = false;
    } else {
      this.fieldGroup.visible = false;
      this.profileGroup.visible = true;
    }

    // Slabs separation and organic bobbing in profileGroup
    // Topsoil (Layer 0, 0-20 cm) is firmly anchored at y = 0 to -1.5m and NEVER moves down.
    const gap = GAP * sm((ts - 5.4) / 3.4);
    const fl = gap / GAP;
    let top = 0;

    this.slabs.forEach((s, idx) => {
      const isFocused = this.focusedLayer === idx;
      const focusOffsetZ = isFocused ? 0.6 : 0;
      if (idx === 0) {
        // Topsoil: permanently anchored with top surface at y = 0
        s.g.position.set(0, -s.h / 2, focusOffsetZ);
        s.g.rotation.z = 0;
        top = -s.h - gap;
      } else {
        // Subterranean layers expand downwards during exploded view
        s.g.position.set(
          0,
          top - s.h / 2 + Math.sin(tt * 0.9 + s.ph) * 0.05 * fl,
          Math.sin(tt * 0.6 + s.ph) * 0.04 * fl + focusOffsetZ
        );
        s.g.rotation.z = Math.sin(tt * 0.55 + s.ph) * 0.005 * fl;
        top -= s.h + gap;
      }
    });

    // Group horizontal rotation with damping
    if (!this.drag) this.rotT *= 0.992;
    this.grp.rotation.y += ((this.rotT + Math.sin(tt * 0.35) * 0.03 * fl) - this.grp.rotation.y) * 0.08;

    // Atmospheric Fog: zero fog in field mode for crystal-clear pure sky; subtle cavern depth underground
    if (ts < 3.2) {
      if (this.scene.fog) this.scene.fog = null;
    } else {
      if (!this.scene.fog) {
        this.scene.fog = new THREE.Fog(0x1a120c, 22, 60);
      }
    }

    // Dust motes upward drift
    const dp = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < dp.count; k++) {
      let yPos = dp.getY(k) + 0.004;
      if (yPos > 2) yPos = -12;
      dp.setY(k, yPos);
    }
    dp.needsUpdate = true;

    // Falling raindrops animation
    if (this.rainParticles && this.rainParticles.visible) {
      const rpAttr = this.rainParticles.geometry.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < rpAttr.count; k++) {
        let yPos = rpAttr.getY(k) - this.rainVelocities[k];
        if (yPos < -1) {
          yPos = 20 + Math.random() * 4;
          rpAttr.setX(k, (Math.random() - 0.5) * 58);
          rpAttr.setZ(k, (Math.random() - 0.6) * 52);
        }
        rpAttr.setY(k, yPos);
      }
      rpAttr.needsUpdate = true;
    }

    // Burst soil crumble particle trigger
    if (this.bst < 0 && ts > 2.5) {
      this.bst = 0;
      const bpAttr = this.burst.geometry.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < bpAttr.count; k++) {
        bpAttr.setXYZ(k, (Math.random() - 0.5) * 26, 0, 0.2 + Math.random() * 1.5);
        this.burstV[k * 3] = (Math.random() - 0.5) * 0.6;
        this.burstV[k * 3 + 1] = Math.random() * 1.6;
        this.burstV[k * 3 + 2] = Math.random() * 1.4;
      }
    }
    if (this.bst >= 0 && this.bst < 4) {
      this.bst += dt;
      const bpAttr = this.burst.geometry.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < bpAttr.count; k++) {
        this.burstV[k * 3 + 1] -= 9.8 * dt * 0.35;
        bpAttr.setXYZ(
          k,
          bpAttr.getX(k) + this.burstV[k * 3] * dt * 2,
          bpAttr.getY(k) + this.burstV[k * 3 + 1] * dt,
          bpAttr.getZ(k) + this.burstV[k * 3 + 2] * dt * 2
        );
      }
      bpAttr.needsUpdate = true;
      (this.burst.material as THREE.PointsMaterial).opacity = Math.max(0, 0.75 * (1 - this.bst / 4));
    }

    // Stage tracking & notifications
    const newStage: DiveStage = ts < 2.4 ? "field" : ts < 5.4 ? "underground" : "layers";
    if (newStage !== this.currentStage) {
      this.currentStage = newStage;
      this.onStageChangeCb?.(newStage);
    }

    if (t < DUR) {
      const captionKeys = [
        "ui.dive_caption_field",
        "ui.dive_caption_underground",
        "ui.dive_caption_layers",
      ];
      const stIdx = ts < 2.4 ? 0 : ts < 5.4 ? 1 : 2;
      this.onDiveProgressCb?.(captionKeys[stIdx], true);
    } else if (!this.finished) {
      this.finished = true;
      this.onDiveProgressCb?.(null, false);
      this.updateInspectData();
    }

    // Update animated cattle models
    for (const c of this.cowMixers) {
      c.mixer.update(dt);
    }

    // Subtle Egyptian breeze swaying palm crowns
    for (const palm of this.palms) {
      palm.crown.rotation.z = Math.sin(tt * 1.3 + palm.phase) * 0.025;
      palm.crown.rotation.x = Math.cos(tt * 0.95 + palm.phase) * 0.02;
    }

    this.renderer.render(this.scene, this.cam);

    // Emit live telemetry
    this.emitTelemetry();
  }

  public project(layerIndex: number): [number, number] {
    if (layerIndex < 0 || layerIndex >= this.slabs.length) return [0, 0];
    const v = new THREE.Vector3(2.4, 0, 0);
    this.slabs[layerIndex].g.localToWorld(v);
    v.project(this.cam);
    const W = this.canvas.clientWidth || window.innerWidth;
    const H = this.canvas.clientHeight || window.innerHeight;
    return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H];
  }

  public loadResult(result: AnalysisResult, forceReload = false): void {
    this.result = result;
    this.updateSoilVisuals();
    if (forceReload) {
      this.replay();
    } else {
      this.updateInspectData();
      this.emitTelemetry();
    }
  }

  public setStrategy(strategyId: StrategyId | null): void {
    if (strategyId) this.strategyId = strategyId;
    this.updateSoilVisuals();
    this.updateInspectData();
    this.emitTelemetry();
  }

  public setSeasonTime(dayT: number): void {
    this.dayT = dayT;
    this.updateSoilVisuals();
    this.emitTelemetry();
  }

  private updateSoilVisuals(): void {
    if (!this.result) return;
    const strat =
      this.result.strategies.find((s) => s.id === this.strategyId) ||
      this.result.strategies[0];
    const totalDays = strat?.sim?.moisture?.[0]?.length || 365;
    const day = Math.min(Math.floor(this.dayT * totalDays), totalDays - 1);

    // 1. Texture Palette Driven by Input Texture & Layer Chemistry
    const texture = this.result.input?.texture || "loam";
    const TEXTURE_PALETTES: Record<string, number[]> = {
      sand: [0x8f724a, 0xa38357, 0xb89566, 0xc7a675],
      sandy_loam: [0x735334, 0x82603e, 0x946f49, 0xa37d54],
      loam: [0x422d1e, 0x543b27, 0x664832, 0x75563d],
      silt_loam: [0x483a30, 0x5a4b40, 0x6b5c50, 0x7c6d61],
      clay_loam: [0x361f15, 0x482c20, 0x593a2c, 0x694738],
      clay: [0x26140d, 0x331c12, 0x422519, 0x523021],
    };
    const palette = TEXTURE_PALETTES[texture] || TEXTURE_PALETTES.loam;

    // 2. Modulate Each Horizon Slabs by Simulated Layer Moisture & Texture
    this.slabs.forEach((slab, i) => {
      const moist = strat?.sim?.moisture?.[i]?.[day] ?? 0.5;
      // Darken with moisture: factor from 0.72 (very wet/dark) to 1.15 (very dry/pale)
      const factor = 1.12 - moist * 0.42;

      const baseHex = palette[i] || 0x422d1e;
      const baseColor = new THREE.Color(baseHex);
      baseColor.multiplyScalar(factor);

      if (slab.mesh && Array.isArray(slab.mesh.material)) {
        // Update side materials
        const sideMat = slab.mesh.material[0];
        if (sideMat instanceof THREE.MeshStandardMaterial) {
          sideMat.color.copy(baseColor);
          sideMat.roughness = moist > 0.65 ? 0.65 : 0.95;
        }
        // Update front face material
        const frontMat = slab.mesh.material[4];
        if (frontMat instanceof THREE.MeshStandardMaterial) {
          frontMat.color.copy(baseColor);
          frontMat.roughness = moist > 0.65 ? 0.7 : 0.92;
        }
      }
    });

    // 3. Modulate Surface Salinity Crust Efflorescence on Topsoil
    if (this.saltCrustMesh && this.saltCrustMesh.material instanceof THREE.MeshStandardMaterial) {
      const ece = strat?.sim?.ece?.[0]?.[day] ?? this.result.input?.water_ec ?? 1.0;
      if (ece > 2.8) {
        // High salinity causes crystalline white salt crust
        this.saltCrustMesh.material.opacity = Math.min(0.82, (ece - 2.5) * 0.24);
      } else {
        this.saltCrustMesh.material.opacity = 0;
      }
    }

    // 4. Modulate 3D Root Depth & Branching Spread
    if (this.rootGroup) {
      const rootCm = strat?.sim?.root_cm?.[day] ?? 20;
      // Map rootCm (0 to 150cm) to vertical scale with a visible baseline
      const rootDepthScale = Math.max(0.65, Math.min(1.45, 0.55 + rootCm / 95));
      const rootSpreadScale = Math.max(0.70, Math.min(1.35, 0.60 + rootCm / 120));
      this.rootGroup.scale.set(rootSpreadScale, rootDepthScale, 1);
    }

    // 5. Modulate Crop Variety & Phenology Scaling (Wheat vs Maize)
    const cropIdx = strat?.sim?.crop_idx?.[day] ?? -1;
    const simulatedCrop = cropIdx >= 0 ? strat?.seasons?.[cropIdx]?.crop : null;
    const activeCrop = this.cropOverride || simulatedCrop;
    const canopy = strat?.sim?.canopy?.[day] ?? 0;

    const isMaize = activeCrop === "maize";
    const isWheat = activeCrop === "wheat" || (activeCrop !== "maize" && activeCrop !== null);

    if (isMaize) {
      if (this.fieldMaizeGroup) this.fieldMaizeGroup.visible = true;
      if (this.fieldWheatGroup) this.fieldWheatGroup.visible = false;
      if (this.cutawayMaizeGroup) this.cutawayMaizeGroup.visible = true;
      if (this.cutawayWheatGroup) this.cutawayWheatGroup.visible = false;

      const scaleY = Math.max(0.18, canopy);
      this.fieldMaizeGroup?.scale.set(1, scaleY, 1);
      this.cutawayMaizeGroup?.scale.set(1, scaleY, 1);
    } else if (isWheat) {
      if (this.fieldWheatGroup) this.fieldWheatGroup.visible = true;
      if (this.fieldMaizeGroup) this.fieldMaizeGroup.visible = false;
      if (this.cutawayWheatGroup) this.cutawayWheatGroup.visible = true;
      if (this.cutawayMaizeGroup) this.cutawayMaizeGroup.visible = false;

      const scaleY = Math.max(0.15, canopy);
      this.fieldWheatGroup?.scale.set(1, scaleY, 1);
      this.cutawayWheatGroup?.scale.set(1, scaleY, 1);
    } else {
      // Fallow / bare ground: show low stubble
      if (this.fieldWheatGroup) this.fieldWheatGroup.visible = true;
      if (this.fieldMaizeGroup) this.fieldMaizeGroup.visible = false;
      if (this.cutawayWheatGroup) this.cutawayWheatGroup.visible = true;
      if (this.cutawayMaizeGroup) this.cutawayMaizeGroup.visible = false;

      this.fieldWheatGroup?.scale.set(1, 0.08, 1);
      this.cutawayWheatGroup?.scale.set(1, 0.08, 1);
    }
  }

  public setTheme(theme: "light" | "dark"): void {
    this.theme = theme;
    if (this.scene.fog && this.scene.fog instanceof THREE.Fog) {
      if (this.theme === "dark") {
        this.scene.fog.color.setRGB(0.06, 0.05, 0.04);
      } else {
        this.scene.fog.color.setRGB(0.10, 0.07, 0.05);
      }
    }
  }

  public setQuality(quality: Quality | "auto"): void {
    this.quality = quality;
    if (this.renderer) {
      const maxDpr = this.quality === "high" || this.quality === "auto" ? 2 : this.quality === "medium" ? 1.5 : 1;
      this.renderer.setPixelRatio(Math.min(maxDpr, window.devicePixelRatio || 1));
    }
  }

  public setWeather(mode: WeatherMode, telemetry?: NasaEvidence["meteomatics"]): void {
    this.weatherMode = mode;
    let effective = mode;
    if (mode === "auto") {
      const params = telemetry?.parameters;
      if (params?.precip_24h_mm && params.precip_24h_mm > 0.1) {
        effective = "rain";
      } else if (params?.t_2m_c && params.t_2m_c > 32) {
        effective = "sunny";
      } else if (params?.soil_moisture_deficit_mm && params.soil_moisture_deficit_mm > 70) {
        effective = "sunny";
      } else {
        effective = "sunny";
      }
    }

    if (effective === "rain") {
      if (this.rainParticles) this.rainParticles.visible = true;
      this.ambLight?.color.setHex(0xd0e3f5);
      if (this.ambLight) this.ambLight.intensity = 0.68;
      this.dirLight?.color.setHex(0xa8c4e0);
      if (this.dirLight) this.dirLight.intensity = 0.62;
      this.rimLight?.color.setHex(0x5d9dd8);
      if (this.slabs[0]?.mesh) {
        const mat = this.slabs[0].mesh.material;
        if (Array.isArray(mat) && mat[2] instanceof THREE.MeshStandardMaterial) {
          mat[2].roughness = 0.35;
        }
      }
    } else if (effective === "dust") {
      if (this.rainParticles) this.rainParticles.visible = false;
      this.ambLight?.color.setHex(0xf5d496);
      if (this.ambLight) this.ambLight.intensity = 0.82;
      this.dirLight?.color.setHex(0xebb867);
      if (this.dirLight) this.dirLight.intensity = 0.88;
      this.rimLight?.color.setHex(0xd49b45);
      if (this.slabs[0]?.mesh) {
        const mat = this.slabs[0].mesh.material;
        if (Array.isArray(mat) && mat[2] instanceof THREE.MeshStandardMaterial) {
          mat[2].roughness = 0.95;
        }
      }
    } else {
      // "sunny" / default
      if (this.rainParticles) this.rainParticles.visible = false;
      this.ambLight?.color.setHex(0xf0f7ff);
      if (this.ambLight) this.ambLight.intensity = 0.82;
      this.dirLight?.color.setHex(0xffffff);
      if (this.dirLight) this.dirLight.intensity = 0.94;
      this.rimLight?.color.setHex(0x7dc0f5);
      if (this.slabs[0]?.mesh) {
        const mat = this.slabs[0].mesh.material;
        if (Array.isArray(mat) && mat[2] instanceof THREE.MeshStandardMaterial) {
          mat[2].roughness = 0.85;
        }
      }
    }
  }

  public getWeather(): WeatherMode {
    return this.weatherMode;
  }

  public setCameraPreset(preset: CameraPreset): void {
    if (preset === "perspective") {
      this.setDiveStage("layers");
    } else if (preset === "cutaway") {
      this.setDiveStage("underground");
    } else if (preset === "canopy") {
      this.setDiveStage("field");
    }
  }

  public setDiveStage(stage: DiveStage): void {
    this.currentStage = stage;
    this.onStageChangeCb?.(stage);
    if (stage === "field") {
      this.t0 = performance.now();
      this.finished = false;
      this.fieldGroup.visible = true;
      this.profileGroup.visible = false;
      this.scene.fog = null;
    } else if (stage === "underground") {
      this.t0 = performance.now() - 3500;
      this.finished = false;
      this.fieldGroup.visible = false;
      this.profileGroup.visible = true;
      this.scene.fog = new THREE.Fog(0x1a120c, 22, 60);
    } else if (stage === "layers") {
      this.t0 = performance.now() - DUR * 1000;
      this.finished = true;
      this.fieldGroup.visible = false;
      this.profileGroup.visible = true;
      this.scene.fog = new THREE.Fog(0x1a120c, 22, 60);
      this.onDiveProgressCb?.(null, false);
      this.updateInspectData();
    }
  }

  public setExploded(exploded: boolean): void {
    this.setDiveStage(exploded ? "layers" : "underground");
  }

  public skipDive(): void {
    this.t0 = performance.now() - DUR * 1000;
    this.finished = true;
    this.fieldGroup.visible = false;
    this.profileGroup.visible = true;
    this.scene.fog = new THREE.Fog(0x1a120c, 22, 60);
    this.onDiveProgressCb?.(null, false);
    this.updateInspectData();
  }

  public replay(): void {
    this.finished = false;
    this.bst = -1;
    (this.burst.material as THREE.PointsMaterial).opacity = 0;
    this.t0 = performance.now();
    this.last = performance.now();
    this.fieldGroup.visible = true;
    this.profileGroup.visible = false;
    this.scene.fog = null;
    this.updateSoilVisuals();
  }

  public focusLayer(idx: number | null): void {
    this.focusedLayer = idx;
    this.onLayerFocusChangeCb?.(idx);
    this.updateInspectData();
  }

  public clearFocus(): void {
    this.focusedLayer = null;
    this.onLayerFocusChangeCb?.(null);
    this.onInspectCb?.(null);
  }

  public getFocusedLayer(): number | null {
    return this.focusedLayer;
  }

  public clearDiveTimeouts(): void {
    // compatibility method
  }

  private updateInspectData(): void {
    if (!this.result || this.focusedLayer === null) {
      return;
    }
    const idx = Math.max(0, Math.min(3, this.focusedLayer));
    const layer = this.result.layers[idx] || {
      top_cm: idx === 0 ? 0 : idx === 1 ? 20 : idx === 2 ? 50 : 90,
      bottom_cm: idx === 0 ? 20 : idx === 1 ? 50 : idx === 2 ? 90 : 150,
      sand: 40,
      silt: 40,
      clay: 20,
      om: 2.5,
      ph: 7.6,
      ec: 1.5,
    };

    const strat =
      this.result.strategies.find((s) => s.id === this.strategyId) ||
      this.result.strategies[0];
    const day = Math.min(
      Math.floor(this.dayT * (strat?.sim?.moisture?.[0]?.length || 365)),
      (strat?.sim?.moisture?.[0]?.length || 365) - 1
    );

    const moistVal = strat?.sim?.moisture?.[idx]?.[day] ?? 0.65;
    const awcPct = Math.round(moistVal * 100);
    const moistStatus: "dry" | "stress" | "optimal" | "saturated" =
      awcPct < 30 ? "dry" : awcPct < 50 ? "stress" : awcPct <= 90 ? "optimal" : "saturated";

    const eceVal = strat?.sim?.ece?.[idx]?.[day] ?? layer.ec ?? 1.5;
    const salStatus: "low" | "moderate" | "high" =
      eceVal < 2 ? "low" : eceVal < 4 ? "moderate" : "high";

    const data: LayerInspectData = {
      layerIndex: idx,
      nameKey: layer.name_key || `ui.layer_${idx}`,
      topCm: layer.top_cm,
      bottomCm: layer.bottom_cm,
      sand: Math.round(layer.sand),
      silt: Math.round(layer.silt),
      clay: Math.round(layer.clay),
      availableWaterPct: awcPct,
      moistureStatus: moistStatus,
      salinityDsm: Number(eceVal.toFixed(1)),
      salinityStatus: salStatus,
      organicMatter: Number(layer.om.toFixed(1)),
    };

    this.onInspectCb?.(data);
  }

  private emitTelemetry(): void {
    if (!this.result) return;
    const strat =
      this.result.strategies.find((s) => s.id === this.strategyId) ||
      this.result.strategies[0];
    if (!strat) return;

    const totalDays = strat.sim?.root_cm?.length || 365;
    const day = Math.min(Math.floor(this.dayT * totalDays), totalDays - 1);

    const cropIdx = strat.sim?.crop_idx?.[day] ?? -1;
    const simulatedCrop = cropIdx >= 0 ? strat.seasons[cropIdx]?.crop : null;
    const activeCrop = this.cropOverride || simulatedCrop;
    const activeSeason = cropIdx >= 0 ? strat.seasons[cropIdx]?.season : null;

    const rootCm = strat.sim?.root_cm?.[day] ?? 0;
    const canopy = strat.sim?.canopy?.[day] ?? 0;
    const rain = this.result.climate?.rain?.[day] ?? 0;
    const et0 = this.result.climate?.et0?.[day] ?? 4.5;
    const tmax = this.result.climate?.tmax?.[day] ?? 28;
    const tmin = this.result.climate?.tmin?.[day] ?? 16;
    const date = this.result.climate?.dates?.[day] ?? "";

    const telemetry: SceneTelemetry = {
      cropId: activeCrop,
      season: activeSeason,
      rootCm: Math.round(rootCm),
      canopyPct: Math.round(canopy * 100),
      et0Mm: Number(et0.toFixed(1)),
      rainMm: Number(rain.toFixed(1)),
      tempC: Math.round((tmax + tmin) / 2),
      date,
      isSynthetic: this.result.climate?.source === "synthetic",
    };

    this.onTelemetryCb?.(telemetry);
  }

  public setOnInspect(cb: (data: LayerInspectData | null) => void): void {
    this.onInspectCb = cb;
  }

  public setOnTelemetry(cb: (data: SceneTelemetry) => void): void {
    this.onTelemetryCb = cb;
  }

  public setOnStageChange(cb: (stage: DiveStage) => void): void {
    this.onStageChangeCb = cb;
  }

  public setOnLayerFocusChange(cb: (idx: number | null) => void): void {
    this.onLayerFocusChangeCb = cb;
  }

  public setOnDiveProgress(cb: (key: string | null, canSkip: boolean) => void): void {
    this.onDiveProgressCb = cb;
  }

  public setCropOverride(crop: "wheat" | "maize" | null): void {
    this.cropOverride = crop;
    this.updateSoilVisuals();
    this.emitTelemetry();
  }

  public getCropOverride(): "wheat" | "maize" | null {
    return this.cropOverride;
  }

  public dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resizeHandler);
    this.canvas.removeEventListener("pointerdown", this.pointerDownHandler);
    this.canvas.removeEventListener("pointermove", this.pointerMoveHandler);
    this.canvas.removeEventListener("pointerup", this.pointerUpHandler);
    this.canvas.removeEventListener("pointercancel", this.pointerUpHandler);

    for (const c of this.cowMixers) {
      c.mixer.stopAllAction();
    }
    this.cowMixers = [];
    this.palms = [];

    this.scene.clear();
    this.renderer.dispose();
  }
}
