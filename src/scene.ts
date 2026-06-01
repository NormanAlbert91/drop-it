import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CONFIG } from './config.ts';

// Renderer, camera, lights, ground plane, OrbitControls + auto-fit-on-play.
export class SceneEnv {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  private readonly groundMat: THREE.MeshStandardMaterial;
  private readonly targetPos = new THREE.Vector3();
  private readonly targetLook = new THREE.Vector3();
  private fitting = false;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x15171c);

    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    this.camera.position.set(18, 10, 22);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 4, 0);
    this.controls.maxPolarAngle = Math.PI * 0.495; // don't go under the floor
    this.controls.update();

    // Lights.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x404040, 0.5);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 1.15);
    sun.position.set(20, 60, 18);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = CONFIG.plane.size / 2 + 3;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 160;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
    this.scene.add(sun.target);

    // Ground plane (white), receives the baked splat texture + shadows.
    const geo = new THREE.PlaneGeometry(CONFIG.plane.size, CONFIG.plane.size);
    geo.rotateX(-Math.PI / 2); // lie flat in XZ, normal +Y
    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(geo, this.groundMat);
    ground.receiveShadow = true;
    this.scene.add(ground);

    window.addEventListener('resize', () => this.resize(container));
  }

  // Wire the paint render-target texture onto the ground once Paint exists.
  setGroundMap(map: THREE.Texture): void {
    this.groundMat.map = map;
    this.groundMat.needsUpdate = true;
  }

  // Outline the printable drop area on the ground (world meters, centered).
  // paint space qx=x, qy=-z, so width spans X and height spans Z.
  showPrintArea(w: number, h: number): void {
    const x = w / 2;
    const z = h / 2;
    const y = 0.02;
    const pts = [
      new THREE.Vector3(-x, y, -z),
      new THREE.Vector3(x, y, -z),
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(-x, y, z),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x888888 });
    const frame = new THREE.LineLoop(geo, mat);
    this.scene.add(frame);
  }

  // Aim the camera to frame a fall of the given height. Smoothly lerped in update().
  fitTo(heightM: number): void {
    const look = this.targetLook;
    look.set(0, heightM * 0.42, 0);

    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const aspect = this.camera.aspect;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);

    const framedHeight = heightM * CONFIG.camera.fitMargin + 4;
    const distHeight = framedHeight / 2 / Math.tan(vFov / 2);
    const distWidth = CONFIG.plane.size / 2 / Math.tan(hFov / 2);
    const distance = Math.max(distHeight, distWidth, CONFIG.camera.minDistance);

    const el = THREE.MathUtils.degToRad(CONFIG.camera.elevationDeg);
    const az = THREE.MathUtils.degToRad(CONFIG.camera.azimuthDeg);
    const dir = new THREE.Vector3(
      Math.cos(el) * Math.sin(az),
      Math.sin(el),
      Math.cos(el) * Math.cos(az),
    );
    this.targetPos.copy(look).addScaledVector(dir, distance);
    this.fitting = true;
  }

  update(): void {
    if (this.fitting) {
      const k = CONFIG.camera.lerp;
      this.camera.position.lerp(this.targetPos, k);
      this.controls.target.lerp(this.targetLook, k);
      if (
        this.camera.position.distanceTo(this.targetPos) < 0.05 &&
        this.controls.target.distanceTo(this.targetLook) < 0.05
      ) {
        this.fitting = false;
      }
    }
    this.controls.update();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private resize(container: HTMLElement): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
