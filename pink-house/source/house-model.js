// Pink-lit residence: the same geometry as the Spline scene
// (https://app.spline.design/file/dcbce0d9-2ab2-4a2d-8f58-b2e4dfdf57a6), rebuilt so it can be
// exported as a standard .glb. Spline units (1 m = 50 units) are converted to metres, and the
// model is lifted so its base sits on y = 0.
//
// buildHouse(THREE, mergeGeometries) returns a THREE.Group named "PinkResidence".
// Static parts are merged per material (one mesh per material). Every LED strip stays a
// separate mesh named "LED_*" so viewers can add glow around it.

export const UNIT = 0.02;      // Spline units -> metres
export const LIFT = 42;        // base underside sits at y = 0

export function buildHouse(THREE, mergeGeometries) {
  const mat = {
    WhiteRender: new THREE.MeshStandardMaterial({ color: '#ebe6ec', roughness: 0.85, metalness: 0 }),
    Limestone: new THREE.MeshStandardMaterial({ color: '#efe9ef', roughness: 0.9, metalness: 0 }),
    PlinthReveal: new THREE.MeshStandardMaterial({ color: '#d8cfd8', roughness: 0.85, metalness: 0 }),
    Cladding: new THREE.MeshStandardMaterial({ color: '#aeb0ba', roughness: 0.4, metalness: 0.25 }),
    SmokedGlass: new THREE.MeshStandardMaterial({ color: '#241c22', roughness: 0.06, metalness: 0.4, emissive: '#5a2f30', emissiveIntensity: 0.45 }),
    ClearGlass: new THREE.MeshStandardMaterial({ color: '#f3d9ea', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.25 }),
    Graphite: new THREE.MeshStandardMaterial({ color: '#3a3c40', roughness: 0.32, metalness: 0.85 }),
    Timber: new THREE.MeshStandardMaterial({ color: '#7d6658', roughness: 0.7, metalness: 0 }),
    Water: new THREE.MeshStandardMaterial({ color: '#22aebf', roughness: 0.04, metalness: 0.25 }),
    Lawn: new THREE.MeshStandardMaterial({ color: '#6c8a5c', roughness: 1, metalness: 0 }),
    PinkLED: new THREE.MeshStandardMaterial({ color: '#ffc2ea', emissive: '#ff3fc0', emissiveIntensity: 3, roughness: 0.4 }),
  };
  for (const [name, m] of Object.entries(mat)) m.name = name;

  // [material, cx, cy, cz, w, h, d] in Spline units (centre + size)
  const parts = [];
  const add = (m, cx, cy, cz, w, h, d) => parts.push([m, cx, cy, cz, w, h, d]);

  // site
  add('Limestone', 0, -14, 0, 1240, 28, 820);                 // plinth slab
  add('PlinthReveal', 0, -35, 0, 1200, 14, 780);              // shadow reveal underneath
  add('Limestone', 40, 1.25, -330, 780, 2.5, 120);            // rear pavers
  add('Lawn', -540, 1.5, 40, 160, 3, 640);
  add('Timber', -80, 1.5, 262, 600, 3, 200);                  // front deck
  add('Water', 410, 1.25, 90, 340, 2.5, 380);                 // pool
  add('Limestone', 586, 2.5, 90, 12, 5, 380);                 // pool coping
  add('Limestone', 234, 2.5, 90, 12, 5, 380);
  add('Limestone', 410, 2.5, 286, 364, 5, 12);
  add('Limestone', 410, 2.5, -106, 364, 5, 12);

  // structure
  add('WhiteRender', -410, 156, -25, 80, 312, 450);           // board-formed core wall
  add('SmokedGlass', -84.5, 75, -25, 569, 149, 350);          // ground-floor glass pavilion
  add('WhiteRender', 0, 160, -20, 880, 20, 420);              // first-floor slab
  add('WhiteRender', 0, 291, -20, 880, 18, 420);              // first-floor roof slab
  add('WhiteRender', 430, 226, -10, 20, 112, 400);            // first-floor end wall
  add('WhiteRender', 0, 226, -220, 880, 112, 20);             // first-floor back wall
  add('SmokedGlass', 25, 226, 172, 790, 112, 6);              // first-floor glazing
  add('SmokedGlass', 0, 232, -232, 620, 46, 4);               // rear ribbon window
  add('SmokedGlass', 442, 226, 60, 4, 90, 36);                // side slot window
  add('Cladding', -120, 359.5, -55, 420, 117, 290);           // penthouse
  add('WhiteRender', -110, 427, -45, 480, 14, 350);           // penthouse roof
  add('SmokedGlass', -120, 359, 93, 380, 104, 6);
  add('SmokedGlass', 93, 359, -55, 6, 104, 250);
  add('Timber', 265, 302, -20, 340, 4, 400);                  // roof terrace deck
  add('ClearGlass', 265, 330, 182, 330, 52, 3);               // glass balustrade
  add('ClearGlass', 427, 330, -16, 3, 52, 390);
  add('Graphite', 265, 357.5, 182, 330, 3, 5);                // balustrade rails
  add('Graphite', 427, 357.5, -16, 5, 3, 390);

  // frames, fins, tracks
  for (let i = 0; i <= 6; i++) add('Graphite', -367 + i * (565 / 6), 75, 153, 4, 138, 6);
  for (let i = 0; i <= 4; i++) add('Graphite', 203, 75, -198 + i * 86.5, 6, 138, 4);
  add('Graphite', -84.5, 3, 154, 570.6, 5, 8);
  add('Graphite', -84.5, 147, 154, 570.6, 5, 8);
  add('Graphite', 204, 3, -25.3, 8, 5, 352.6);
  add('Graphite', 204, 147, -25.3, 8, 5, 352.6);
  for (let i = 0; i < 4; i++) add('Graphite', -320 + i * 90, 226, 177.5, 4, 112, 5);
  for (let i = 0; i < 12; i++) add('Graphite', 40 + i * 33, 226, 182, 6, 112, 14);
  for (let i = 0; i <= 4; i++) add('Graphite', -308 + i * 94, 359, 98.5, 4, 104, 5);
  // timber batten privacy screen
  add('Graphite', -275, 3, 162, 190, 5, 10);
  add('Graphite', -275, 147, 162, 190, 5, 10);
  for (let i = 0; i < 13; i++) add('Timber', -362 + i * 14.5, 75, 162, 6, 138, 8);

  const group = new THREE.Group();
  group.name = 'PinkResidence';

  // merge static parts per material
  const byMat = {};
  for (const [m, cx, cy, cz, w, h, d] of parts) {
    const g = new THREE.BoxGeometry(w * UNIT, h * UNIT, d * UNIT);
    g.translate(cx * UNIT, (cy + LIFT) * UNIT, cz * UNIT);
    (byMat[m] ||= []).push(g);
  }
  for (const [m, geos] of Object.entries(byMat)) {
    const mesh = new THREE.Mesh(mergeGeometries(geos, false), mat[m]);
    mesh.name = m;
    mesh.castShadow = m !== 'ClearGlass';
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // LED strips: separate meshes. [name, cx, cy, cz, w, h, d]
  const leds = [
    ['LED_FirstFloor_Front', 0, 152, 191.6, 880, 7, 7],
    ['LED_FirstFloor_Right', 441.6, 152, -20, 7, 7, 420],
    ['LED_FirstFloorRoof_Front', 0, 284, 191.6, 880, 7, 7],
    ['LED_FirstFloorRoof_Right', 441.6, 284, -20, 7, 7, 420],
    ['LED_PenthouseRoof_Front', -110, 422, 131.6, 480, 7, 7],
    ['LED_PenthouseRoof_Right', 131.6, 422, -45, 7, 7, 350],
    ['LED_PenthouseRoof_Left', -351.6, 422, -45, 7, 7, 350],
    ['LED_Plinth_Front', 0, -4, 411.6, 1240, 7, 7],
    ['LED_Plinth_Right', 621.6, -4, 0, 7, 7, 820],
    ['LED_Plinth_Left', -621.6, -4, 0, 7, 7, 820],
    ['LED_Pool_Edge', 241, 4.2, 90, 3, 2, 380],
  ];
  for (const [name, cx, cy, cz, w, h, d] of leds) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w * UNIT, h * UNIT, d * UNIT), mat.PinkLED);
    mesh.position.set(cx * UNIT, (cy + LIFT) * UNIT, cz * UNIT);
    mesh.name = name;
    group.add(mesh);
  }
  return group;
}

// Pink wash light positions from the Spline scene (metres, same frame as the model)
export const PINK_WASH_LIGHTS = [
  [40, 128, 250],
  [80, 262, 250],
  [120, -10, 500],
].map(([x, y, z]) => [x * UNIT, (y + LIFT) * UNIT, z * UNIT]);
