import * as THREE from 'three';
import { CONFIG } from './config.ts';
import { defaultParams, type Params } from './params.ts';
import { spawnX } from './physics.ts';
import { Paint } from './paint.ts';
import { SceneEnv } from './scene.ts';
import { Drop, displayRadius } from './drop.ts';
import { Splash } from './splash.ts';
import { Ui } from './ui.ts';

const params = defaultParams();

const container = document.getElementById('app')!;
const paint = new Paint();
const env = new SceneEnv(container, paint.texture);
const drop = new Drop();
const splash = new Splash(paint);
env.scene.add(drop.mesh);
env.scene.add(splash.mesh);

type State = 'idle' | 'falling';
let state: State = 'idle';

const ui = new Ui(params, { onPlay: play, onClear: clearSplats });
ui.setPlayEnabled(true);

function play(): void {
  if (state === 'falling') return;
  const startX = spawnX(params.heightM, params.windMs);
  drop.spawn(params, startX);
  splash.setWind(params.windMs);
  state = 'falling';
  ui.setPlayEnabled(false);
  env.fitTo(params.heightM);
}

function clearSplats(): void {
  paint.clear();
}

function mainSplatRadius(impactSpeed: number, p: Params): number {
  const S = CONFIG.splat;
  const speedTerm = Math.sqrt(Math.max(impactSpeed, 0) / S.refSpeed);
  const viscTerm = 1 - S.viscShrink * p.viscosity;
  const r = displayRadius(p.sizeMm) * S.sizeFactor * speedTerm * viscTerm;
  return THREE.MathUtils.clamp(r, S.minRadius, S.maxRadius);
}

function onImpact(): void {
  const impactSpeed = drop.body.vel.length();
  const x = drop.body.pos.x;
  const z = drop.body.pos.z;
  const radius = mainSplatRadius(impactSpeed, params);
  const opacity = THREE.MathUtils.clamp(
    0.72 + CONFIG.splat.opacityViscGain * params.viscosity,
    0,
    1,
  );
  paint.splat(x, z, radius, params.color, opacity);

  splash.setWind(params.windMs);
  const impactPos = new THREE.Vector3(x, 0, z);
  splash.burst(impactPos, impactSpeed, drop.body.vel, params, radius);

  drop.hide();
  state = 'idle';
  ui.setPlayEnabled(true);
}

const clock = new THREE.Clock();
let acc = 0;

function frame(): void {
  requestAnimationFrame(frame);

  const wall = Math.min(clock.getDelta(), 0.1);
  acc += wall * CONFIG.timeScale;

  splash.setWind(params.windMs);
  let steps = 0;
  while (acc >= CONFIG.fixedDt && steps < CONFIG.maxStepsPerFrame) {
    const dt = CONFIG.fixedDt;
    if (state === 'falling') {
      drop.step(params.windMs, dt); // wind read live each step
      if (drop.hasLanded()) {
        drop.body.pos.y = 0;
        onImpact();
      } else {
        drop.updateMesh();
      }
    }
    splash.update(dt);
    acc -= dt;
    steps++;
  }

  paint.flush();
  env.update();
  env.render();
}

frame();
