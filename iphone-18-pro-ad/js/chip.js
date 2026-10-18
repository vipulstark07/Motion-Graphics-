import * as THREE from 'three';
import { roundedRect, slab } from './geometry.js';
import { traceTexture, chipLidTexture } from './textures.js';

// A20 Pro: package on a logic board, with light pulsing out through the traces.

const BOARD = 34; // board size in scene units (trace texture spans all of it)

function boardMaterial(traces) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTrace: { value: traces },
      uTime: { value: 0 },
      uGlow: { value: 0 },
      uColor: { value: new THREE.Color(1.0, 0.62, 0.32) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTrace;
      uniform float uTime;
      uniform float uGlow;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        vec4 m = texture2D(uTrace, vUv);
        float trace = m.r;
        float via = m.r * m.g;
        float passive = m.g * (1.0 - m.r);
        vec2 q = vUv - 0.5;
        float dist = max(abs(q.x), abs(q.y)) * 2.0;
        float radial = length(q) * 2.0;
        // Pulses leave the die and race outward along the traces.
        float f1 = fract(dist * 2.2 - uTime * 0.55);
        float f2 = fract(dist * 1.3 - uTime * 0.38 + 0.37);
        float band = smoothstep(0.72, 0.985, f1) * (1.0 - smoothstep(0.985, 1.0, f1));
        band += 0.6 * smoothstep(0.8, 0.99, f2) * (1.0 - smoothstep(0.99, 1.0, f2));
        float fade = 1.0 - smoothstep(0.25, 0.95, radial);
        vec3 col = vec3(0.004, 0.004, 0.005);
        col += vec3(0.05, 0.034, 0.022) * trace * fade;
        col += vec3(0.022) * passive * fade;
        col += uColor * (band * trace * 4.0 + via * 0.6) * fade * uGlow;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

function toY(g) {
  // slab() builds along +z; stand it up so +z becomes +y.
  g.rotateX(-Math.PI / 2);
  return g;
}

export function createChip() {
  const root = new THREE.Group();
  root.name = 'A20 Pro';

  const traces = traceTexture();
  const boardMat = boardMaterial(traces);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(BOARD, BOARD), boardMat);
  board.rotation.x = -Math.PI / 2;
  root.add(board);

  const pkg = BOARD * 0.105 * 2 * 0.98; // matches the footprint left clear in the traces
  const substrateMat = new THREE.MeshPhysicalMaterial({ color: '#0e100f', roughness: 0.55, metalness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.4 });
  const sub = slab(roundedRect(pkg, pkg, 0.3, 0.3, { exponent: 2.2 }), { height: 0.24, radius: 0.05, steps: 4 });
  root.add(new THREE.Mesh(toY(sub.side), substrateMat));
  root.add(new THREE.Mesh(toY(sub.cap), substrateMat));

  const lidSize = pkg * 0.8;
  const lidSide = new THREE.MeshPhysicalMaterial({ color: '#c9cbd0', metalness: 1, roughness: 0.18 });
  const lidTop = new THREE.MeshPhysicalMaterial({
    color: '#d4d6db', metalness: 1, roughness: 0.24, map: chipLidTexture(),
    anisotropy: 0.75, anisotropyRotation: Math.PI / 2,
  });
  const lid = slab(roundedRect(lidSize, lidSize, 0.42, 0.42, { exponent: 2.4 }), { z0: 0.24, height: 0.16, radius: 0.08, steps: 6 });
  root.add(new THREE.Mesh(toY(lid.side), lidSide));
  root.add(new THREE.Mesh(toY(lid.cap), lidTop));

  // Decoupling capacitors around the lid.
  const capMat = new THREE.MeshPhysicalMaterial({ color: '#b08a52', metalness: 1, roughness: 0.3 });
  const capBody = new THREE.MeshStandardMaterial({ color: '#1c1a17', roughness: 0.5 });
  const capGeo = new THREE.BoxGeometry(0.22, 0.09, 0.12);
  const endGeo = new THREE.BoxGeometry(0.05, 0.1, 0.13);
  const ring = (lidSize + pkg) / 4;
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < 11; i++) {
      const k = (i / 10 - 0.5) * lidSize * 0.9;
      const g = new THREE.Group();
      g.add(new THREE.Mesh(capGeo, capBody));
      const e1 = new THREE.Mesh(endGeo, capMat);
      e1.position.x = 0.11;
      const e2 = e1.clone();
      e2.position.x = -0.11;
      g.add(e1, e2);
      const a = (side * Math.PI) / 2;
      g.position.set(Math.cos(a) * ring - Math.sin(a) * k, 0.285, Math.sin(a) * ring + Math.cos(a) * k);
      g.rotation.y = -a + Math.PI / 2;
      root.add(g);
    }
  }

  return {
    root,
    lidHeight: 0.4,
    update(time, glow) {
      boardMat.uniforms.uTime.value = time;
      boardMat.uniforms.uGlow.value = glow;
    },
  };
}
