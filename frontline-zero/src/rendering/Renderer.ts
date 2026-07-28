import * as THREE from 'three';
import type { SettingsManager } from '../core/SettingsManager';

export class Renderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(90, 1, 0.05, 180);
  readonly renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });

  constructor(
    readonly container: HTMLElement,
    private readonly settings: SettingsManager,
  ) {
    this.scene.background = new THREE.Color(0x07151c);
    this.scene.fog = new THREE.FogExp2(0x07151c, 0.009);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.append(this.renderer.domElement);
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('fz-settings', this.applySettings);
    this.applySettings();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private applySettings = (): void => {
    const value = this.settings.value;
    this.camera.fov = value.fov;
    this.camera.updateProjectionMatrix();
    this.renderer.shadowMap.enabled = value.shadows && value.quality !== 'low';
    this.resize();
  };

  private resize = (): void => {
    const scale = this.settings.value.renderScale;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio * scale, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  };
}
