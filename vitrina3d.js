// Vitrina 3D de Archival.
// Toma la foto de un producto, le quita el fondo cuando es liso, la recorta con su silueta
// y la convierte en una pieza con volumen que gira sobre su eje. Se gira con el dedo o el mouse.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { prepare, toDrawable } from "./recorte.js";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const GRID = 180;        // celdas para trazar la silueta
const SIZE = 2;          // la pieza mide 2 unidades en su lado mayor

/* ---------- 2. Recorte -> silueta (polígono) ---------- */

function silhouette({ mask, W, H }) {
  const step = Math.max(W, H) / GRID;
  const gw = Math.ceil(W / step) + 2, gh = Math.ceil(H / step) + 2;
  let m = new Uint8Array(gw * gh);
  for (let gy = 1; gy < gh - 1; gy++) for (let gx = 1; gx < gw - 1; gx++) {
    const px = Math.min(W - 1, ((gx - 0.5) * step) | 0), py = Math.min(H - 1, ((gy - 0.5) * step) | 0);
    m[gy * gw + gx] = mask[(py * W + px) * 4 + 3] > 110 ? 1 : 0;
  }
  // cierre morfológico: tapa huecos de un pixel en la orilla
  const pass = (src, keep) => {
    const out = new Uint8Array(src.length);
    for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) {
      const i = y * gw + x;
      const s = src[i - 1] + src[i + 1] + src[i - gw] + src[i + gw];
      out[i] = keep ? (src[i] || s > 0 ? 1 : 0) : (src[i] && s === 4 ? 1 : 0);
    }
    return out;
  };
  m = pass(pass(m, true), false);

  // la pieza más grande
  const label = new Int32Array(gw * gh), q = new Int32Array(gw * gh);
  let best = 0, bestSize = 0, id = 0;
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || label[i]) continue;
    id++; let h = 0, t = 0, size = 0; q[t++] = i; label[i] = id;
    while (h < t) {
      const p = q[h++]; size++;
      for (const o of [p - 1, p + 1, p - gw, p + gw]) if (m[o] && !label[o]) { label[o] = id; q[t++] = o; }
    }
    if (size > bestSize) { bestSize = size; best = id; }
  }
  if (!best) return null;
  let start = -1;
  for (let i = 0; i < m.length; i++) { m[i] = label[i] === best ? 1 : 0; if (start < 0 && m[i]) start = i; }

  // Moore: recorre el contorno en orden
  const D = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];
  const sx = start % gw, sy = (start / gw) | 0;
  const pts = [[sx, sy]];
  let cx = sx, cy = sy, back = 0;
  for (let guard = 0; guard < gw * gh * 2; guard++) {
    let moved = false;
    for (let k = 1; k <= 8; k++) {
      const dd = (back + k) % 8, nx = cx + D[dd][0], ny = cy + D[dd][1];
      if (m[ny * gw + nx]) {
        const pd = (back + k - 1) % 8, bx = cx + D[pd][0], by = cy + D[pd][1];
        back = D.findIndex((v) => v[0] === bx - nx && v[1] === by - ny);
        cx = nx; cy = ny; moved = true; break;
      }
    }
    if (!moved || (cx === sx && cy === sy)) break;
    pts.push([cx, cy]);
  }
  if (pts.length < 8) return null;
  const px = pts.map(([x, y]) => [(x - 0.5) * step, (y - 0.5) * step]);
  return smooth(simplify(px, step * 0.7), 2);
}

function simplify(pts, eps) {
  const rdp = (a) => {
    if (a.length < 3) return a;
    const [x1, y1] = a[0], [x2, y2] = a[a.length - 1];
    const L = Math.hypot(x2 - x1, y2 - y1) || 1;
    let far = 0, at = 0;
    for (let i = 1; i < a.length - 1; i++) {
      const dd = Math.abs((y2 - y1) * a[i][0] - (x2 - x1) * a[i][1] + x2 * y1 - y2 * x1) / L;
      if (dd > far) { far = dd; at = i; }
    }
    return far > eps ? [...rdp(a.slice(0, at + 1)).slice(0, -1), ...rdp(a.slice(at))] : [a[0], a[a.length - 1]];
  };
  const half = pts.length >> 1;
  return [...rdp(pts.slice(0, half + 1)).slice(0, -1), ...rdp([...pts.slice(half), pts[0]]).slice(0, -1)];
}

function smooth(p, iterations) {
  for (let k = 0; k < iterations; k++) {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = out;
  }
  return p;
}

/* ---------- 3. Silueta -> pieza 3D ---------- */

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function buildPiece(prep, renderer) {
  const { W, H, avg } = prep;
  const k = SIZE / Math.max(W, H), w = W * k, h = H * k;
  const outline = prep.cutout ? silhouette(prep) : null;

  let shape;
  if (outline) {
    const v = outline.map(([x, y]) => new THREE.Vector2((x - W / 2) * k, (H / 2 - y) * k));
    if (THREE.ShapeUtils.isClockWise(v)) v.reverse();
    shape = new THREE.Shape(v);
  } else {
    shape = roundedRect(w, h, Math.min(w, h) * 0.07);
  }

  const depth = 0.1, bevel = 0.035;
  const uv = {
    generateTopUV(g, verts, a, b, c) {
      return [a, b, c].map((i) => new THREE.Vector2(verts[i * 3] / w + 0.5, verts[i * 3 + 1] / h + 0.5));
    },
    // el canto es de color liso: no necesita coordenadas de textura
    generateSideWallUV: () => [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()],
  };
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 4, curveSegments: 6, UVGenerator: uv,
  });
  geo.translate(0, 0, -depth / 2);

  // la cara lleva la foto sobre el color del canto, así los bordes del recorte nunca quedan huecos
  const edge = new THREE.Color(avg[0] / 255, avg[1] / 255, avg[2] / 255).multiplyScalar(0.62);
  const face = document.createElement("canvas");
  face.width = W; face.height = H;
  const fx = face.getContext("2d");
  fx.fillStyle = `#${edge.clone().lerp(new THREE.Color(1, 1, 1), 0.15).getHexString()}`;
  fx.fillRect(0, 0, W, H);
  fx.drawImage(prep.canvas, 0, 0);
  const map = new THREE.CanvasTexture(face);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const capMat = new THREE.MeshPhysicalMaterial({ map, roughness: 0.45, clearcoat: 0.9, clearcoatRoughness: 0.16 });
  const sideMat = new THREE.MeshPhysicalMaterial({ color: edge, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.1 });
  const mesh = new THREE.Mesh(geo, [capMat, sideMat]);
  mesh.userData = { w, h, depth: depth + bevel * 2, parts: [] };
  return mesh;
}

function disposePiece(obj) {
  obj?.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    for (const m of [].concat(o.material)) {
      for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap"]) m[k]?.dispose();
      m.dispose();
    }
  });
}

/* ---------- 3b. Modelo 3D real (GLB de foto a 3D) ---------- */

let gltfLoader = null;
function loader() {
  if (gltfLoader) return gltfLoader;
  const draco = new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/");
  gltfLoader = new GLTFLoader().setDRACOLoader(draco);
  return gltfLoader;
}

// Cada .glb se baja y se decodifica una sola vez; al volver a una pestaña se clona.
// Clonar comparte geometría y texturas: si disposePiece las liberó, three las vuelve a subir a la GPU solo.
const gltfCache = new Map();

// Centra el modelo, lo escala a SIZE en su lado mayor y deja su base en -h/2 como la pieza recortada
async function buildModel(url) {
  let gltf = gltfCache.get(url);
  if (!gltf) {
    gltf = loader().loadAsync(url);
    gltfCache.set(url, gltf);
    gltf.catch(() => gltfCache.delete(url)); // si falló, el siguiente intento vuelve a bajarlo
  }
  const model = (await gltf).scene.clone(true);
  // El frente es la cara más ancha: si el modelo llega de lado, se gira 90° para que mire a la cámara
  let box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
  if (size.z > size.x * 1.15) {
    model.rotation.y = Math.PI / 2;
    model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model); size = box.getSize(new THREE.Vector3());
  }
  const k = SIZE / Math.max(size.x, size.y, size.z);
  model.scale.setScalar(k);
  const c = box.getCenter(new THREE.Vector3()).multiplyScalar(k);
  model.position.set(-c.x, -c.y, -c.z);
  model.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.map) m.map.anisotropy = 8; });
  const wrap = new THREE.Group();
  wrap.add(model);
  wrap.userData = { w: Math.max(size.x, size.z) * k, h: size.y * k, depth: Math.min(size.x, size.z) * k, parts: partsOf(wrap) };
  return wrap;
}

// Piezas sueltas del modelo (separadas con separar-piezas.mjs). La principal es la de mayor volumen, no la de más triángulos.
// Para cada pieza guarda cuánto hay que moverla, en el espacio de su padre, para ponerla en el centro de la principal.
function partsOf(wrap) {
  wrap.updateMatrixWorld(true);
  const meshes = [];
  wrap.traverse((o) => { if (o.isMesh) meshes.push(o); });
  if (meshes.length < 2) return [];
  const info = meshes.map((m) => {
    const b = new THREE.Box3().setFromObject(m), s = b.getSize(new THREE.Vector3());
    return { mesh: m, center: b.getCenter(new THREE.Vector3()), volume: s.x * s.y * s.z };
  }).sort((a, b) => b.volume - a.volume);
  const main = info[0];
  return info.slice(1).map(({ mesh, center }) => {
    const toMain = mesh.parent.worldToLocal(main.center.clone()).sub(mesh.parent.worldToLocal(center.clone()));
    return { mesh, base: mesh.position.clone(), scale: mesh.scale.clone(), toMain };
  });
}

// Degradado radial en canvas: la luz del piso y la sombra de contacto
function radialTexture(stops, size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d"), r = size / 2;
  const g = x.createRadialGradient(r, r, 0, r, r, r);
  for (const [at, color] of stops) g.addColorStop(at, color);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Piso de estudio: un charco de luz suave bajo el producto y su sombra de contacto encima.
// Como foto de producto: luz neutra y amplia, sin aros ni haces.
function buildFloor() {
  const floor = new THREE.Group();
  const flat = (size, map, order) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = order;
    floor.add(m);
    return m;
  };
  const light = flat(1, radialTexture([[0, "rgba(255,255,255,1)"], [0.35, "rgba(255,255,255,0.62)"], [0.7, "rgba(255,255,255,0.16)"], [1, "rgba(255,255,255,0)"]]), 1);
  const shadow = flat(1, radialTexture([[0, "rgba(10,12,20,0.7)"], [0.55, "rgba(10,12,20,0.22)"], [1, "rgba(10,12,20,0)"]], 128), 2);
  shadow.position.y = 0.002;
  return { floor, light, shadow };
}

/* ---------- 4. Escena, giro y arrastre ---------- */

export function createVitrina(host, { spin = 0.32, onError } = {}) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  host.prepend(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  } catch {
    canvas.remove();
    host.classList.add("v3d-flat");
    const img = document.createElement("img");
    img.alt = "";
    host.prepend(img);
    return {
      async setImage(input) {
        const src = await toDrawable(input);
        img.src = src instanceof HTMLCanvasElement ? src.toDataURL() : src.src;
      },
      setModel: async () => false,
      dispose() { img.remove(); },
    };
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(2.5, 3, 4);
  const rim = new THREE.DirectionalLight(0xe4e9ff, 0.8);
  rim.position.set(-3, 1.2, -3.5);
  // Relleno suave desde el piso: levanta un poco la parte baja del producto, como un rebote de luz
  const fill = new THREE.SpotLight(0xfff3e6, 7, 6, 0.7, 1, 2);
  scene.add(key, rim, fill, fill.target);

  const tiltGroup = new THREE.Group(), spinGroup = new THREE.Group();
  tiltGroup.add(spinGroup);
  scene.add(tiltGroup);

  const F = buildFloor();
  scene.add(F.floor);
  // La intensidad del piso viene de la página (--stage-light, --stage-shadow), así respeta claro y oscuro
  function readTheme() {
    const cs = getComputedStyle(host);
    F.light.material.opacity = parseFloat(cs.getPropertyValue("--stage-light")) || 0.9;
    F.shadow.material.opacity = parseFloat(cs.getPropertyValue("--stage-shadow")) || 0.3;
    renderer.render(scene, camera);
  }
  const themeMq = matchMedia("(prefers-color-scheme: dark)");
  themeMq.addEventListener("change", readTheme);
  const themeMo = new MutationObserver(readTheme);
  themeMo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  let piece = null, appear = 1, token = 0, reveal = null;
  let frameR = 1.1; // radio de la esfera que envuelve al producto: lo que ocupa en cualquier ángulo de giro
  let rotY = -0.45, velY = reduceMotion ? 0 : spin, tilt = 0;
  let dragging = false, pointer = null, lastX = 0, lastY = 0, lastT = 0, idleUntil = 0;
  const clock = new THREE.Clock();

  function fit() {
    const { clientWidth: cw, clientHeight: ch } = host;
    if (!cw || !ch) return;
    renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch;
    // La cámara se aleja hasta que la esfera del producto cabe completa a lo alto y a lo ancho, sin márgenes extra (la esfera ya deja aire en los costados)
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2), hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const dist = frameR / Math.sin(Math.min(vHalf, hHalf));
    camera.position.set(0, dist * 0.12, dist);
    camera.lookAt(0, -frameR * 0.05, 0);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera); // cambiar el tamaño borra el lienzo: redibuja aunque el ciclo esté en pausa
  }

  function frame() {
    // Solo dibuja si el visor está en pantalla; se revisa cada cuadro para no depender de avisos que pueden no llegar
    const r = host.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || r.width === 0) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05), now = performance.now();
    if (!dragging) {
      // Exhibidor: frena cuando el producto queda de frente o de espaldas y avanza en los costados
      const showcase = 0.3 + 0.7 * Math.sin(rotY) ** 2;
      const target = !reduceMotion && now > idleUntil ? spin * showcase : 0;
      velY += (target - velY) * (1 - Math.exp(-dt * (now > idleUntil ? 1.6 : 2.4)));
      rotY += velY * dt;
      tilt += (0 - tilt) * (1 - Math.exp(-dt * 5));
    }
    if (appear < 1) appear = Math.min(1, appear + dt / 0.7);
    if (reveal) playReveal(now);
    const e = appear >= 1 ? 1 : 1 + 2.2 * (appear - 1) ** 3 + 1.2 * (appear - 1) ** 2; // aterriza con un rebote corto
    spinGroup.rotation.y = rotY;
    tiltGroup.rotation.x = tilt;
    if (piece) {
      piece.scale.setScalar(0.88 + 0.12 * e);
      const { w, depth } = piece.userData;
      // la sombra sigue la huella real del producto mientras gira
      const span = Math.abs(Math.cos(rotY)) * w + Math.abs(Math.sin(rotY)) * depth;
      F.shadow.scale.set(span * 0.95 + 0.12, depth * 1.4 + 0.28, 1);
    }
    renderer.render(scene, camera);
  }

  // Unboxing: las piezas arrancan escondidas dentro de la principal y salen una por una en arco.
  // Mientras salen, el producto mira de frente; al terminar empieza el giro de exhibidor.
  const HOLD = 450, TRAVEL = 1000, STAGGER = 260;
  function playReveal(now) {
    const t = now - reveal.start;
    let done = true;
    reveal.parts.forEach((p, i) => {
      const x = THREE.MathUtils.clamp((t - HOLD - i * STAGGER) / TRAVEL, 0, 1);
      if (x < 1) done = false;
      const e = 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;  // sale rápido y se asienta con un rebote corto
      p.mesh.position.copy(p.base).addScaledVector(p.toMain, 1 - e);
      p.mesh.position.y += Math.sin(Math.PI * Math.min(x, 1)) * reveal.arc;   // arco hacia arriba al salir
      p.mesh.scale.copy(p.scale).multiplyScalar(0.6 + 0.4 * Math.min(1, x * 1.6));
    });
    if (done) { reveal = null; idleUntil = now + 600; }
  }

  // El producto se para en el piso; el charco de luz se ajusta a su ancho.
  // lift: cuánto suben las piezas en el arco del unboxing; la esfera crece para que no toquen la orilla de arriba.
  function placeStage({ w, h, depth = 0, lift = 0 }) {
    frameR = 0.5 * Math.hypot(w, h + 2 * lift, depth);
    fit();
    const floor = -h / 2 - 0.01;
    F.floor.position.y = floor;
    F.light.scale.set(Math.max(w, 1) * 2.1, Math.max(w, 1) * 1.5, 1);
    fill.position.set(0, floor + 0.05, 2.2);
    fill.target.position.set(0, floor + h * 0.35, 0);
  }
  placeStage({ w: 1.4, h: 1.6 });
  readTheme();

  const onVis = () => { clock.getDelta(); renderer.setAnimationLoop(document.visibilityState === "visible" ? frame : null); };
  onVis();
  document.addEventListener("visibilitychange", onVis);
  const ro = new ResizeObserver(fit);
  ro.observe(host);
  fit();

  // Arrastre: horizontal gira, vertical inclina un poco. pan-y deja hacer scroll en el celular.
  canvas.style.touchAction = "pan-y";
  canvas.addEventListener("pointerdown", (e) => {
    if (dragging) return; // un segundo dedo no toma el control
    dragging = true; pointer = e.pointerId; lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
    try { canvas.setPointerCapture(e.pointerId); } catch {} // el puntero pudo soltarse antes; el arrastre sigue igual
    host.classList.add("is-grabbing", "dragged");
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== pointer) return;
    const now = performance.now(), dt = Math.max(8, now - lastT);
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    rotY += dx * 0.012;
    velY = velY * 0.5 + ((dx * 0.012) / dt) * 1000 * 0.5;
    tilt = THREE.MathUtils.clamp(tilt + dy * 0.004, -0.38, 0.38);
    lastX = e.clientX; lastY = e.clientY; lastT = now;
  });
  const release = (e) => {
    if (!dragging || e.pointerId !== pointer) return;
    dragging = false; pointer = null;
    if (performance.now() - lastT > 90) velY = 0;
    velY = THREE.MathUtils.clamp(velY, -14, 14);
    idleUntil = performance.now() + 1800;
    host.classList.remove("is-grabbing");
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  return {
    // Muestra un modelo 3D real (.glb). Mismo piso, giro y arrastre que la foto recortada.
    // revelar: si el modelo trae piezas sueltas, salen de la principal antes de girar.
    async setModel(url, { revelar = false } = {}) {
      const mine = ++token;
      host.classList.add("is-loading");
      try {
        const next = await buildModel(url);
        if (mine !== token) return disposePiece(next);
        disposePiece(piece);
        if (piece) spinGroup.remove(piece);
        piece = next;
        spinGroup.add(piece);
        const parts = piece.userData.parts;
        if (revelar && parts.length && !reduceMotion) {
          // de frente y quieto mientras las piezas salen
          rotY = 0; velY = 0;
          const arc = 0.6 * Math.max(...parts.map((p) => p.toMain.length()));   // en las mismas unidades que las piezas
          piece.updateMatrixWorld(true);
          placeStage({ ...piece.userData, lift: arc * parts[0].mesh.parent.getWorldScale(new THREE.Vector3()).y });
          reveal = { start: performance.now(), parts, arc };
          playReveal(reveal.start);
          appear = 1;
        } else {
          placeStage(piece.userData);
          reveal = null;
          appear = reduceMotion ? 1 : 0;
          if (!reduceMotion) velY += 4;
        }
        frame();
        return true;
      } catch (err) {
        onError?.(err);
        return false;
      } finally {
        if (mine === token) host.classList.remove("is-loading");
      }
    },
    async setImage(input) {
      const mine = ++token;
      host.classList.add("is-loading");
      try {
        const prep = prepare(await toDrawable(input));
        if (mine !== token) return;
        const next = buildPiece(prep, renderer);
        disposePiece(piece);
        if (piece) spinGroup.remove(piece);
        piece = next;
        reveal = null;
        spinGroup.add(piece);
        placeStage(piece.userData);
        appear = reduceMotion ? 1 : 0;
        if (!reduceMotion) velY += 5; // entra con un giro de presentación
        frame();
        return true;
      } catch (err) {
        onError?.(err);
        return false;
      } finally {
        if (mine === token) host.classList.remove("is-loading");
      }
    },
    dispose() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      disposePiece(piece);
      themeMq.removeEventListener("change", readTheme); themeMo.disconnect();
      F.floor.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.map?.dispose(); o.material.dispose(); } });
      scene.environment.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
