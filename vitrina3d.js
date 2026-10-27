// Vitrina 3D de Archival: muestra el modelo .glb de un producto girando en un piso de estudio.
// Se gira con el dedo o el mouse; la conversión de foto a 3D la hace Archival fuera de la landing.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SIZE = 2; // el modelo mide 2 unidades en su lado mayor

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
    if (host.classList.contains("is-2d") || r.bottom < 0 || r.top > innerHeight || r.width === 0) { clock.getDelta(); return; } // tapado por una foto o fuera de pantalla: no dibuja
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
