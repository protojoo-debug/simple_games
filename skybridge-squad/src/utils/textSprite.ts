import * as THREE from "three";

export interface TextSprite {
  sprite: THREE.Sprite;
  setText: (text: string, accent?: string) => void;
  dispose: () => void;
}

export function createTextSprite(
  text: string,
  accent = "#ffffff",
  width = 3.4,
  height = 1.25,
): TextSprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is not available.");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width, height, 1);
  sprite.renderOrder = 20;

  const setText = (value: string, color = accent): void => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(5, 15, 25, 0.86)";
    context.beginPath();
    context.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 42);
    context.fill();
    context.lineWidth = 8;
    context.strokeStyle = color;
    context.stroke();
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "900 84px system-ui, sans-serif";
    context.fillText(value, canvas.width / 2, canvas.height / 2 + 3);
    texture.needsUpdate = true;
  };
  setText(text, accent);

  return {
    sprite,
    setText,
    dispose: () => {
      texture.dispose();
      material.dispose();
    },
  };
}
