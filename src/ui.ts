import GUI from 'lil-gui';
import { type Params, PARAM_RANGES } from './params.ts';

export interface UiHandlers {
  onPlay(): void;
  onClear(): void;
}

export class Ui {
  private readonly gui: GUI;
  private readonly playCtrl: ReturnType<GUI['add']>;

  constructor(params: Params, handlers: UiHandlers) {
    this.gui = new GUI({ title: 'drop-it' });

    const h = PARAM_RANGES.heightM;
    const w = PARAM_RANGES.windMs;
    const sz = PARAM_RANGES.sizeMm;
    const v = PARAM_RANGES.viscosity;

    this.gui.add(params, 'heightM', h.min, h.max, h.step).name('Fallhöhe (m)');
    this.gui.add(params, 'windMs', w.min, w.max, w.step).name('Wind (m/s)');
    this.gui.add(params, 'sizeMm', sz.min, sz.max, sz.step).name('Größe ⌀ (mm)');
    this.gui.addColor(params, 'color').name('Farbe');
    this.gui.add(params, 'viscosity', v.min, v.max, v.step).name('Viskosität');

    const actions = {
      play: () => handlers.onPlay(),
      clear: () => handlers.onClear(),
    };
    this.playCtrl = this.gui.add(actions, 'play').name('▶ Play');
    this.gui.add(actions, 'clear').name('Clear Splats');
  }

  setPlayEnabled(enabled: boolean): void {
    if (enabled) this.playCtrl.enable();
    else this.playCtrl.disable();
  }
}
