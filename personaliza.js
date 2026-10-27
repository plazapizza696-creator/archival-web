// Personaliza tu página: el visitante arma su página (negocio, productos con fotos y tallas,
// colores, estilo y secciones), la ve en vivo en celular o computadora y la manda por WhatsApp.
// Se carga solo al tocar "Personaliza tu página".
import { quitarFondo } from "./recorte.js?v=46d14e0";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const MAX_FOTOS = 5, MAX_PRODUCTOS = 6;
const WA = document.querySelector('meta[name="archival-whatsapp"]')?.content.replace(/\D/g, "") || "";
const GUARDADO = "archival-personaliza-v1";

// Temas: cada uno es una página completa (fondo, tarjeta, texto, acento), no solo un color
const TEMAS = [
  { id: "archival", nombre: "Archival", bg: "#F2F4F8", surface: "#FFFFFF", ink: "#0F1220", muted: "#586074", accent: "#1E40FF", line: "#DEE2EB", ok: "#1E7A4F" },
  { id: "medianoche", nombre: "Medianoche", bg: "#0B0D14", surface: "#151925", ink: "#F2F4F8", muted: "#8E95A8", accent: "#3D63FF", line: "#262B3A", ok: "#3DDC84" },
  { id: "arena", nombre: "Arena", bg: "#F3EFE8", surface: "#FBF9F5", ink: "#1E1A16", muted: "#776F66", accent: "#1E1A16", line: "#E3DCD1", ok: "#2F8A57" },
  { id: "terracota", nombre: "Terracota", bg: "#F6EEE6", surface: "#FFFFFF", ink: "#2A1D16", muted: "#7D6A5E", accent: "#C2532B", line: "#E8DCCF", ok: "#2F8A57" },
  { id: "bosque", nombre: "Bosque", bg: "#EDF1EB", surface: "#FFFFFF", ink: "#16241B", muted: "#5F7064", accent: "#24563F", line: "#D5DED3", ok: "#2F8A57" },
  { id: "oceano", nombre: "Océano", bg: "#EAF2F6", surface: "#FFFFFF", ink: "#0E2430", muted: "#5A7380", accent: "#0A7EA4", line: "#D3E3EA", ok: "#2F8A57" },
  { id: "coral", nombre: "Coral", bg: "#FFF4F0", surface: "#FFFFFF", ink: "#2B171A", muted: "#86676B", accent: "#E8483D", line: "#F1DCD6", ok: "#2F8A57" },
  { id: "rosa", nombre: "Rosa", bg: "#FCF1F5", surface: "#FFFFFF", ink: "#33121F", muted: "#8E6474", accent: "#D63C7E", line: "#F0D6E1", ok: "#2F8A57" },
  { id: "mostaza", nombre: "Mostaza", bg: "#121212", surface: "#1C1C1C", ink: "#F5F1E8", muted: "#A39F96", accent: "#F2B43C", line: "#2E2E2E", ok: "#7BD88F" },
  { id: "uva", nombre: "Uva", bg: "#15111F", surface: "#201A2E", ink: "#F1ECFA", muted: "#9C92B3", accent: "#A26BFA", line: "#2E2640", ok: "#6EE7A8" },
  { id: "grafito", nombre: "Grafito", bg: "#18191B", surface: "#222326", ink: "#EDEDED", muted: "#9A9A9E", accent: "#FF6A2B", line: "#303135", ok: "#6BDB8F" },
  { id: "menta", nombre: "Menta", bg: "#EEF8F3", surface: "#FFFFFF", ink: "#0F2A20", muted: "#5D7A6E", accent: "#0F9A70", line: "#D3EBE1", ok: "#2F8A57" },
];
const ACENTOS = ["#1E40FF", "#0A7EA4", "#0F9A70", "#7CB518", "#F2B43C", "#FF6A2B", "#E8483D", "#D63C7E", "#A26BFA", "#0F1220"];

const GIROS = {
  reventa: { label: "Tenis y ropa", nombre: "Kicks Norte", frase: "Pares 100 % originales, listos para entrega.", cats: ["Tenis", "Ropa", "Gorras"], cta: "Apartar por WhatsApp", tema: "medianoche",
    productos: () => [
      prod("Jordan 1 High OG Royal", "$5,200", "Nuevos en caja, con ticket.", ["fotos/jordan-1-royal.webp"], [["25", 0], ["26", 1], ["26.5", 0], ["27", 1], ["28", 2], ["29", 0]]),
      prod("Dunk Low Panda", "$3,400", "Seminuevos, 9 de 10.", [], [["26", 1], ["27", 0], ["28", 1]]),
    ] },
  tienda: { label: "Tienda", nombre: "Punto Tech", frase: "Lo que buscas, en existencia.", cats: ["Audio", "Cargadores", "Fundas"], cta: "Comprar por WhatsApp", tema: "arena",
    productos: () => [prod("AirPods Pro (2.ª gen.)", "$4,299", "Sellados, con garantía de 1 año.", ["fotos/airpods-pro.webp"], null, 8), prod("Funda de silicón", "$349", "Para iPhone 15 y 16.", [], null, 12)] },
  comida: { label: "Comida", nombre: "Taquería La Güera", frase: "Al pastor desde las 6 de la tarde.", cats: ["Tacos", "Gringas", "Bebidas"], cta: "Pedir por WhatsApp", tema: "terracota",
    productos: () => [prod("Tacos al pastor", "$95", "Orden de 5, tortilla hecha a mano.", ["fotos/tacos-al-pastor.webp"], null, 9), prod("Agua de horchata", "$35", "Medio litro.", [], null, 0)] },
  otro: { label: "Otro", nombre: "Mi negocio", frase: "Lo que tienes hoy, a la vista.", cats: ["Lo nuevo", "Lo más pedido"], cta: "Pedir por WhatsApp", tema: "archival",
    productos: () => [prod("Mi producto", "$100", "Cuéntale a tu cliente por qué lo quiere.", [], null, 5)] },
};
let ids = 0;
function prod(nombre, precio, desc, fotos, tallas, cantidad = 0) {
  return { id: ++ids, nombre, precio, desc, fotos: fotos.map((src) => ({ sin: src, original: null })), fondo: "sin", tallas: tallas ? tallas.map(([t, q]) => ({ t, q })) : null, cantidad, i: 0 };
}
function estadoInicial(giro = "reventa") {
  const g = GIROS[giro];
  return { giro, nombre: g.nombre, frase: g.frase, horario: "Lunes a sábado, 10 a 20 h", whats: "", tema: g.tema, acento: null, estilo: "limpio", letra: "moderna", esquinas: "suaves", boton: "relleno", dev: "cel",
    secciones: { horario: true, ubicacion: true, redes: false, resenas: true, preguntas: false, boton: true }, productos: g.productos(), abiertos: [] };
}

let S = null, dlg = null;
const $ = (sel, root = dlg) => root.querySelector(sel);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const temaActual = () => TEMAS.find((t) => t.id === S.tema) || TEMAS[0];
const contraste = (hex) => { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#0F1220" : "#FFFFFF"; };
const totalDe = (p) => (p.tallas ? p.tallas.reduce((a, x) => a + x.q, 0) : p.cantidad);

function guardar() {
  try { localStorage.setItem(GUARDADO, JSON.stringify({ ...S, productos: S.productos.map((p) => ({ ...p, fotos: p.fotos.filter((f) => !f.original) })) })); } catch {}
}
// Lo guardado se fusiona sobre el estado inicial y se valida: así un cambio de forma o un dato ajeno no rompe el estudio
const OPCIONES = { estilo: ["limpio", "audaz", "elegante"], letra: ["moderna", "clasica", "redonda"], esquinas: ["rectas", "suaves", "redondas"], boton: ["relleno", "contorno"], dev: ["cel", "pc"] };
function cargar() {
  try {
    const s = JSON.parse(localStorage.getItem(GUARDADO));
    if (!s || !Array.isArray(s.productos)) return null;
    const base = estadoInicial(s.giro in GIROS ? s.giro : "reventa");
    const r = { ...base, ...s, giro: base.giro, secciones: { ...base.secciones, ...(s.secciones || {}) }, productos: s.productos.filter((p) => p && Array.isArray(p.fotos)) };
    for (const k in OPCIONES) if (!OPCIONES[k].includes(r[k])) r[k] = base[k];
    if (!TEMAS.some((t) => t.id === r.tema)) r.tema = base.tema;
    r.productos.forEach((p) => { p.i = 0; if (!p.fotos.length) p.fondo = "sin"; });
    ids = Math.max(0, ...r.productos.map((p) => +p.id || 0));
    return r;
  } catch { return null; }
}
// Las fotos subidas son blob: URLs; al quitarlas se liberan de memoria
const soltar = (...fs) => fs.forEach((f) => [f.sin, f.original].forEach((u) => typeof u === "string" && u.startsWith("blob:") && URL.revokeObjectURL(u)));

/* ---------- Armado del estudio ---------- */
let abriendo = false;
export async function abrir({ giro, origen } = {}) {
  if (abriendo || dlg?.open) return; // doble toque
  abriendo = true;
  const ola = origen && !reduce ? estallido(origen) : null; // arranca ya, mientras carga el estudio
  try {
    if (!dlg) await construir();
    S = S || cargar() || estadoInicial(giro === "restaurante" ? "comida" : giro || "reventa");
    pintarTodo();
    if (ola) await ola.listo;
    dlg.classList.toggle("con-origen", !!ola);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    dlg.focus(); // el foco queda en el estudio, no salta al botón Salir
    document.documentElement.style.overflow = "hidden";
    if (ola) entrada(ola);
  } catch (e) {
    ola?.capa.remove(); // que no se quede la capa azul tapando la página
    throw e;
  } finally { abriendo = false; }
}

// Un círculo azul sale del botón y llena la pantalla; en medio aparece la A de Archival
const ENTRA = "cubic-bezier(0.77, 0, 0.175, 1)", SALE = "cubic-bezier(0.23, 1, 0.32, 1)";
function estallido({ x, y }) {
  const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const capa = document.createElement("div");
  capa.setAttribute("aria-hidden", "true");
  capa.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:#1E40FF;display:grid;place-items:center;pointer-events:none";
  capa.innerHTML = `<svg viewBox="0 0 64 64" width="72" height="72"><path fill="#fff" d="M2 62L25 2H39L62 62H48L32 20L16 62Z"/><rect fill="#0F1220" x="27.5" y="43" width="9" height="9"/></svg>`;
  document.body.appendChild(capa);
  const ola = capa.animate([{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${R}px at ${x}px ${y}px)` }], { duration: 480, easing: ENTRA, fill: "forwards" });
  const [a, cuadro] = capa.querySelectorAll("path, rect");
  a.animate([{ transform: "translateY(14px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 340, delay: 200, easing: SALE, fill: "both" });
  cuadro.style.transformOrigin = "32px 47.5px";
  cuadro.animate([{ transform: "translateY(-40px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 360, delay: 320, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)", fill: "both" });
  return { capa, listo: ola.finished.then(() => new Promise((ok) => setTimeout(ok, 220))) };
}
// El estudio se abre desde el centro (donde quedó la A) y sus partes llegan en escalera
function entrada({ capa }) {
  const R = Math.hypot(innerWidth, innerHeight) / 2;
  const abre = dlg.animate([{ clipPath: `circle(0px at 50% 50%)` }, { clipPath: `circle(${R}px at 50% 50%)` }], { duration: 520, easing: ENTRA });
  capa.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, delay: 380, fill: "forwards" }).finished.then(() => capa.remove());
  abre.finished.finally(() => capa.isConnected && setTimeout(() => capa.remove(), 400));
  const partes = [$(".pz-bar"), ...dlg.querySelectorAll(".pz-sec"), $(".pz-send")].filter((el) => el.getBoundingClientRect().top < innerHeight);
  partes.forEach((el, i) => el.animate([{ transform: "translateY(18px)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 460, delay: 200 + i * 50, easing: SALE, fill: "backwards" }));
  $("#pz-device").animate([{ transform: "translateY(40px) scale(0.94)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 700, delay: 300, easing: "cubic-bezier(0.34, 1.3, 0.64, 1)", fill: "backwards" });
  $(".pz-tools").animate([{ opacity: 0, translate: "-50% 12px" }, { opacity: 1, translate: "-50% 0" }], { duration: 400, delay: 620, easing: SALE, fill: "backwards" });
}

async function construir() {
  const css = document.createElement("link");
  css.rel = "stylesheet"; css.href = new URL("./personaliza.css?v=46d14e0", import.meta.url).href;
  const listo = new Promise((ok, bad) => { css.onload = ok; css.onerror = bad; });
  document.head.appendChild(css);
  if (!document.querySelector('link[href*="Fraunces"]')) {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..800&family=Nunito:wght@500..900&display=swap";
    document.head.appendChild(l);
  }
  dlg = document.createElement("dialog");
  dlg.className = "pz";
  dlg.tabIndex = -1;
  dlg.setAttribute("aria-label", "Personaliza tu página");
  dlg.innerHTML = `
  <header class="pz-bar">
    <span class="pz-brand"><svg viewBox="0 0 64 64" aria-hidden="true"><path fill="#EEF0F6" d="M2 62L25 2H39L62 62H48L32 20L16 62Z"/><rect fill="#3552FF" x="27.5" y="43" width="9" height="9"/></svg>Personaliza tu página <small>· se guarda en este dispositivo (las fotos no)</small></span>
    <nav class="pz-steps" aria-label="Pasos">${["negocio", "giro", "productos", "colores", "estilo", "secciones"].map((s) => `<a href="#pz-${s}" data-paso="${s}" aria-label="${s}"></a>`).join("")}</nav>
    <button class="pz-x" type="button" data-cerrar>Salir <span aria-hidden="true">✕</span></button>
  </header>
  <div class="pz-main">
    <div class="pz-ctl" id="pz-ctl">
      <section class="pz-sec" id="pz-negocio"><h3><b>1</b>Tu negocio</h3>
        <div class="pz-field"><label for="pz-nombre">Nombre</label><input class="pz-in" id="pz-nombre" maxlength="40" autocomplete="organization"></div>
        <div class="pz-field"><label for="pz-frase">Frase de bienvenida</label><input class="pz-in" id="pz-frase" maxlength="80"></div>
        <div class="pz-row">
          <div class="pz-field"><label for="pz-horario">Horario</label><input class="pz-in" id="pz-horario" maxlength="40"></div>
          <div class="pz-field"><label for="pz-whats">WhatsApp del negocio</label><input class="pz-in" id="pz-whats" inputmode="tel" placeholder="55 1234 5678" maxlength="16"></div>
        </div>
      </section>
      <section class="pz-sec" id="pz-giro"><h3><b>2</b>Qué vendes</h3><div class="pz-seg" id="pz-giros"></div><p class="pz-hint" style="margin-top:8px">Cambiar de giro carga productos de ejemplo; los tuyos se reemplazan.</p></section>
      <section class="pz-sec" id="pz-productos"><h3><b>3</b>Tus productos<span id="pz-nprod"></span></h3><div class="pz-prods" id="pz-prods"></div>
        <button class="pz-newprod" type="button" id="pz-add">+ Agregar producto</button></section>
      <section class="pz-sec" id="pz-colores"><h3><b>4</b>Colores<span id="pz-tema-n"></span></h3>
        <div class="pz-themes" id="pz-themes" role="group" aria-label="Temas de color"></div>
        <p class="pz-lbl" style="margin:18px 0 0">Tu color principal</p>
        <div class="pz-accents" id="pz-accents" role="group" aria-label="Color principal"></div>
      </section>
      <section class="pz-sec" id="pz-estilo"><h3><b>5</b>Estilo</h3>
        <div class="pz-styles" id="pz-styles"></div>
        <div class="pz-sub"><span class="pz-lbl">Letra</span><div class="pz-seg" data-opt="letra"></div></div>
        <div class="pz-sub"><span class="pz-lbl">Esquinas</span><div class="pz-seg" data-opt="esquinas"></div></div>
        <div class="pz-sub"><span class="pz-lbl">Botones</span><div class="pz-seg" data-opt="boton"></div></div>
      </section>
      <section class="pz-sec" id="pz-secciones"><h3><b>6</b>Secciones</h3><div class="pz-toggles" id="pz-toggles"></div></section>
      <div class="pz-send">
        <button class="pz-cta" type="button" id="pz-enviar"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.4 14.2c-.2.6-1.3 1.2-1.8 1.2s-1 .3-3.4-.7a11.6 11.6 0 0 1-4.5-4c-.3-.5-1-1.6-1-3s.7-2.1 1-2.4a1 1 0 0 1 .8-.4h.6c.2 0 .4 0 .6.5l.9 2c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.2-.3.3-.1.6s.7 1.2 1.5 1.9c1 .9 1.9 1.2 2.2 1.3s.4 0 .6-.1l.8-1c.2-.3.4-.2.6-.1l2 .9c.3.1.5.2.5.3s.1.8-.1 1.4Z"/></svg>Mandar mi página por WhatsApp</button>
        <small>Te mandamos tu página ya armada para que la revises.</small>
      </div>
    </div>
    <div class="pz-stage" id="pz-stage">
      <div class="pz-vp" id="pz-vp"><div class="pz-device" id="pz-device" data-dev="cel"><div class="pz-screen" id="pz-screen"></div></div></div>
      <div class="pz-tools" role="group" aria-label="Vista previa">
        <button type="button" data-dev="cel" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>Celular</button>
        <button type="button" data-dev="pc" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4" width="19" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 20h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>Computadora</button>
      </div>
      <div class="pz-sheet" id="pz-sheet" hidden><div class="pz-card" role="dialog" aria-labelledby="pz-sh-t">
        <h4 id="pz-sh-t">Así va tu página</h4>
        <pre id="pz-resumen"></pre>
        <p class="pz-ok" id="pz-ok" role="status"></p>
        <div class="pz-actions"><button class="pz-ghost" type="button" data-volver>Seguir editando</button><button class="pz-cta" type="button" id="pz-wa">Abrir WhatsApp</button></div>
      </div></div>
    </div>
  </div>`;
  document.body.appendChild(dlg);
  enlazar();
  try { await listo; } catch (e) { dlg.remove(); dlg = null; throw e; } // sin estilos no se abre: se reintenta al siguiente toque
}

/* ---------- Controles ---------- */
function ocultarHoja() { $("#pz-sheet").hidden = true; $("#pz-enviar").focus(); }
function enlazar() {
  const cerrar = () => (dlg.close ? dlg.close() : (dlg.removeAttribute("open"), dlg.dispatchEvent(new Event("close"))));
  dlg.addEventListener("close", () => { guardar(); document.documentElement.style.overflow = ""; });
  $("[data-cerrar]").addEventListener("click", cerrar);
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); if (!$("#pz-sheet").hidden) ocultarHoja(); else cerrar(); });
  const texto = (id, clave) => $(id).addEventListener("input", (e) => { S[clave] = e.target.value; pintarSitio(); guardar(); });
  // (las entradas del sello y del botón flotante solo se animan cuando aparecen, ver pintarSitio)
  texto("#pz-nombre", "nombre"); texto("#pz-frase", "frase"); texto("#pz-horario", "horario"); texto("#pz-whats", "whats");
  $("#pz-add").addEventListener("click", () => {
    if (S.productos.length >= MAX_PRODUCTOS) return;
    const p = prod("Nuevo producto", "$0", "", [], null, 1);
    S.productos.push(p); S.abiertos = [p.id];
    pintarProductos(); pintarSitio(); guardar();
    const el = dlg.querySelector(`[data-prod="${p.id}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    el?.querySelector(".pz-in")?.focus();
  });
  dlg.querySelectorAll(".pz-tools button").forEach((b) => b.addEventListener("click", () => { S.dev = b.dataset.dev; ajustar(); guardar(); }));
  new ResizeObserver(ajustar).observe($("#pz-stage"));
  $("#pz-themes").addEventListener("pointerleave", () => colores());
  $("#pz-enviar").addEventListener("click", resumen);
  $("[data-volver]").addEventListener("click", ocultarHoja);
  $("#pz-wa").addEventListener("click", enviar);
  // Barra de pasos: marca la sección que se está editando
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) dlg.querySelectorAll(".pz-steps a").forEach((a) => a.classList.toggle("on", a.dataset.paso === e.target.id.slice(3))); }), { root: $("#pz-ctl"), threshold: 0.5 });
  dlg.querySelectorAll(".pz-sec").forEach((s) => io.observe(s));
}

function pintarTodo() {
  $("#pz-nombre").value = S.nombre; $("#pz-frase").value = S.frase; $("#pz-horario").value = S.horario; $("#pz-whats").value = S.whats;
  // Giro
  const giros = $("#pz-giros");
  giros.innerHTML = Object.entries(GIROS).map(([k, g]) => `<button type="button" data-giro="${k}" aria-pressed="${k === S.giro}">${g.label}</button>`).join("");
  giros.querySelectorAll("button").forEach((b) => b.addEventListener("click", (e) => {
    if (b.dataset.giro === S.giro) return;
    conTransicion(e, () => {
      const n = estadoInicial(b.dataset.giro);
      S.productos.forEach((p) => soltar(...p.fotos));
      Object.assign(S, { giro: n.giro, productos: n.productos, frase: n.frase, nombre: S.nombre === GIROS[S.giro].nombre ? n.nombre : S.nombre, tema: S.temaElegido ? S.tema : n.tema });
      pintarTodo();
      guardar();
    });
  }));
  pintarTemas(); pintarEstilos(); pintarToggles(); pintarProductos(); pintarSitio(); ajustar();
}

function pintarTemas() {
  const box = $("#pz-themes");
  box.innerHTML = TEMAS.map((t) => `
    <button class="pz-theme" type="button" data-tema="${t.id}" aria-pressed="${t.id === S.tema}" aria-label="Tema ${t.nombre}">
      <span class="pz-mini" style="background:${t.bg};color:${t.ink}"><i class="t1" style="background:${t.ink}"></i><i class="t2" style="background:${t.surface};color:${t.accent};box-shadow:0 0 0 1px ${t.line}"></i><i class="t3" style="background:${t.accent}"></i></span>
      <b>${t.nombre}</b>
    </button>`).join("");
  // Al pasar el cursor se prueba; al tocar se queda
  box.querySelectorAll(".pz-theme").forEach((b) => {
    b.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") colores(b.dataset.tema); });
    b.addEventListener("click", (e) => conTransicion(e, () => { S.tema = b.dataset.tema; S.temaElegido = true; S.acento = null; pintarTemas(); pintarAcentos(); pintarSitio(); guardar(); }));
  });
  $("#pz-tema-n").textContent = temaActual().nombre;
  pintarAcentos();
}
function pintarAcentos() {
  const box = $("#pz-accents"), actual = S.acento || temaActual().accent;
  box.innerHTML = ACENTOS.map((c) => `<button class="pz-acc" type="button" data-acc="${c}" style="background:${c}" aria-label="Color ${c}" aria-pressed="${c.toLowerCase() === actual.toLowerCase()}"></button>`).join("") +
    `<label class="pz-pick" title="Cualquier color"><input type="color" value="${actual}" aria-label="Elegir cualquier color"></label>`;
  box.querySelectorAll(".pz-acc").forEach((b) => b.addEventListener("click", () => { S.acento = b.dataset.acc; pintarAcentos(); colores(); guardar(); }));
  box.querySelector("input").addEventListener("input", (e) => { S.acento = e.target.value; colores(); guardar(); });
  box.querySelector("input").addEventListener("change", pintarAcentos);
}
function pintarEstilos() {
  const st = $("#pz-styles");
  const opciones = [["limpio", "Aa", "Limpio", "Mucho aire, el producto al centro", "font-weight:600"], ["audaz", "AA", "Audaz", "Bloques de color, letra fuerte", "font-weight:900;font-stretch:125%"], ["elegante", "Aa", "Elegante", "Letra de revista, líneas finas", "font-family:Fraunces,serif;font-style:italic"]];
  st.innerHTML = opciones.map(([k, a, n, d, css]) => `<button class="pz-style" type="button" data-estilo="${k}" aria-pressed="${k === S.estilo}"><span style="${css}">${a}</span>${n}<small>${d}</small></button>`).join("");
  st.querySelectorAll("button").forEach((b) => b.addEventListener("click", (e) => conTransicion(e, () => { S.estilo = b.dataset.estilo; pintarEstilos(); pintarSitio(); guardar(); })));
  const segs = { letra: [["moderna", "Moderna"], ["clasica", "Clásica"], ["redonda", "Redonda"]], esquinas: [["rectas", "Rectas"], ["suaves", "Suaves"], ["redondas", "Redondas"]], boton: [["relleno", "Relleno"], ["contorno", "Contorno"]] };
  dlg.querySelectorAll("[data-opt]").forEach((box) => {
    const k = box.dataset.opt;
    box.innerHTML = segs[k].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${S[k] === v}">${n}</button>`).join("");
    box.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { S[k] = b.dataset.v; pintarEstilos(); pintarSitio(); guardar(); }));
  });
}
function pintarToggles() {
  const box = $("#pz-toggles");
  box.innerHTML = Object.entries(SECCIONES).map(([k, n]) => `<label class="pz-toggle"><span>${n}</span><input type="checkbox" data-sec="${k}" ${S.secciones[k] ? "checked" : ""}></label>`).join("");
  box.querySelectorAll("input").forEach((i) => i.addEventListener("change", () => { S.secciones[i.dataset.sec] = i.checked; pintarSitio(); guardar(); }));
}
const SECCIONES = { boton: "Botón flotante de WhatsApp", horario: "Horario", ubicacion: "Ubicación", resenas: "Reseñas", preguntas: "Preguntas frecuentes", redes: "Redes sociales" };

function pintarProductos() {
  const box = $("#pz-prods");
  $("#pz-nprod").textContent = `${S.productos.length} de ${MAX_PRODUCTOS}`;
  $("#pz-add").disabled = S.productos.length >= MAX_PRODUCTOS;
  box.innerHTML = S.productos.map((p) => {
    const f = p.fotos[0];
    return `<details class="pz-prod" data-prod="${p.id}" ${S.abiertos.includes(p.id) ? "open" : ""}>
      <summary>${f ? `<img src="${esc(f.sin || f.original)}" alt="">` : `<span class="pz-ph"></span>`}<b>${esc(p.nombre) || "Sin nombre"}</b><span>${totalDe(p)} ${p.tallas ? "en tallas" : "pzas"}</span></summary>
      <div class="pz-prod-body">
        <div class="pz-row">
          <div class="pz-field"><label>Nombre</label><input class="pz-in" aria-label="Nombre del producto" data-k="nombre" value="${esc(p.nombre)}" maxlength="50"></div>
          <div class="pz-field"><label>Precio</label><input class="pz-in" aria-label="Precio" data-k="precio" value="${esc(p.precio)}" maxlength="12"></div>
        </div>
        <div class="pz-field"><label>Descripción</label><input class="pz-in" aria-label="Descripción" data-k="desc" value="${esc(p.desc)}" maxlength="90"></div>
        <div class="pz-field"><span class="pz-lbl">Fotos · ${p.fotos.length} de ${MAX_FOTOS}</span>
          <div class="pz-photos">${p.fotos.map((x, i) => `<div class="pz-photo ${i === 0 ? "is-main" : ""}"><img src="${esc(x.sin || x.original)}" alt="Foto ${i + 1}"><button type="button" data-quitar="${i}" aria-label="Quitar foto ${i + 1}">✕</button></div>`).join("")}
            ${p.fotos.length < MAX_FOTOS ? `<label class="pz-add" aria-label="Agregar foto">+<input type="file" accept="image/*" multiple></label>` : ""}</div>
          <p class="pz-hint" data-nota></p>
        </div>
        <div class="pz-field"><span class="pz-lbl">Fondo de las fotos</span><div class="pz-seg" data-fondo>${[["sin", "Sin fondo"], ["estudio", "Estudio"], ["original", "Original"]].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${p.fondo === v}">${n}</button>`).join("")}</div></div>
        <label class="pz-toggle" style="padding:2px"><span>Tiene tallas</span><input type="checkbox" data-tallas ${p.tallas ? "checked" : ""}></label>
        ${p.tallas ? `<div class="pz-sizes">${p.tallas.map((x, i) => `<div class="pz-size ${x.q ? "" : "is-zero"}"><b>${esc(x.t)}</b><span>${x.q}</span><span style="display:flex;gap:3px"><button type="button" data-t="${i}" data-d="-1" aria-label="Menos talla ${esc(x.t)}">−</button><button type="button" data-t="${i}" data-d="1" aria-label="Más talla ${esc(x.t)}">+</button></span></div>`).join("")}</div>
          <div class="pz-row"><input class="pz-in" data-nueva-talla aria-label="Nueva talla" placeholder="Nueva talla (ej. 30)" maxlength="6"><button class="pz-ghost" type="button" data-agregar-talla>Agregar talla</button></div>`
        : `<div class="pz-field"><span class="pz-lbl">Cantidad</span><span class="pz-stepper"><button type="button" data-c="-1" aria-label="Menos">−</button><span>${p.cantidad}</span><button type="button" data-c="1" aria-label="Más">+</button></span></div>`}
        <button class="pz-link" type="button" data-borrar>Quitar este producto</button>
      </div>
    </details>`;
  }).join("");
  box.querySelectorAll(".pz-prod").forEach((el) => {
    const p = S.productos.find((x) => x.id === +el.dataset.prod);
    el.addEventListener("toggle", () => { S.abiertos = el.open ? [...new Set([...S.abiertos, p.id])] : S.abiertos.filter((x) => x !== p.id); });
    el.querySelectorAll("[data-k]").forEach((i) => i.addEventListener("input", () => { p[i.dataset.k] = i.value; el.querySelector("summary b").textContent = p.nombre || "Sin nombre"; pintarSitio(); guardar(); }));
    const cambio = () => { pintarProductos(); pintarSitio(); guardar(); };
    el.querySelectorAll("[data-quitar]").forEach((b) => b.addEventListener("click", () => { soltar(...p.fotos.splice(+b.dataset.quitar, 1)); p.i = 0; if (!p.fotos.length) p.fondo = "sin"; cambio(); }));
    el.querySelectorAll("[data-fondo] button").forEach((b) => b.addEventListener("click", () => { p.fondo = b.dataset.v; cambio(); }));
    el.querySelector("[data-tallas]").addEventListener("change", (e) => { p.tallas = e.target.checked ? [{ t: "26", q: 1 }, { t: "27", q: 1 }, { t: "28", q: 1 }] : null; cambio(); });
    el.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => { const x = p.tallas[+b.dataset.t]; x.q = Math.max(0, Math.min(99, x.q + +b.dataset.d)); cambio(); }));
    el.querySelector("[data-agregar-talla]")?.addEventListener("click", () => { const i = el.querySelector("[data-nueva-talla]"); const t = i.value.trim(); if (!t || p.tallas.some((x) => x.t === t)) return; p.tallas.push({ t, q: 1 }); cambio(); });
    el.querySelectorAll("[data-c]").forEach((b) => b.addEventListener("click", () => { p.cantidad = Math.max(0, Math.min(999, p.cantidad + +b.dataset.c)); cambio(); }));
    el.querySelector("[data-borrar]").addEventListener("click", () => { soltar(...p.fotos); S.productos = S.productos.filter((x) => x !== p); cambio(); });
    el.querySelector('input[type="file"]')?.addEventListener("change", async (e) => {
      const archivos = [...e.target.files].slice(0, MAX_FOTOS - p.fotos.length);
      const nota = el.querySelector("[data-nota]");
      if (e.target.files.length > archivos.length) nota.textContent = `Solo caben ${MAX_FOTOS} fotos por producto.`;
      for (const file of archivos) {
        if (file.type && !file.type.startsWith("image/")) continue; // algunos Android mandan type vacío en un JPG válido
        nota.textContent = "Quitando el fondo…";
        try {
          const r = await quitarFondo(file);
          if (p.fotos.length >= MAX_FOTOS) break; // llegaron varias a la vez mientras se recortaban
          p.fotos.push({ sin: r.url, original: r.original });
          if (!r.ok) { p.fondo = "original"; nota.textContent = "Una foto tiene fondo con textura: se muestra original. En tu página real la recortamos nosotros."; }
          else nota.textContent = "";
        } catch { nota.textContent = "No pudimos leer una imagen. Si es HEIC, cámbiala a JPG desde Fotos; también sirve PNG."; }
      }
      S.abiertos = [...new Set([...S.abiertos, p.id])];
      p.i = p.fotos.length - 1;
      pintarProductos(); pintarSitio(); guardar();
    });
  });
}

/* ---------- La página del cliente ---------- */
function colores(temaId) {
  const t = TEMAS.find((x) => x.id === (temaId || S.tema)) || TEMAS[0];
  const acc = temaId && temaId !== S.tema ? t.accent : S.acento || t.accent;
  const st = $("#pz-screen .st");
  if (!st) return;
  Object.entries({ bg: t.bg, surface: t.surface, ink: t.ink, muted: t.muted, accent: acc, "on-accent": contraste(acc), line: t.line, ok: t.ok }).forEach(([k, v]) => st.style.setProperty("--" + k, v));
  $("#pz-stage").style.setProperty("--glow", acc);
  $("#pz-tema-n").textContent = t.nombre;
}

const flecha = (d) => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function tarjeta(p) {
  const todo = totalDe(p), f = p.fotos[p.i] || p.fotos[0];
  const fondo = f && p.fondo === "original" && !f.original ? "sin" : p.fondo;
  const src = f ? (fondo === "original" ? f.original : f.sin || f.original) : null;
  const estado = todo === 0 ? ["out", p.tallas ? "Se vendieron todas las tallas" : "Agotado"] : todo <= 2 ? ["low", `Quedan ${todo}`] : ["", `Hay ${todo}`];
  return `<article class="st-card ${todo === 0 ? "agotado" : ""}" data-p="${p.id}">
    <div class="st-gal ${fondo === "estudio" ? "estudio" : ""}">
      ${src ? `<img src="${esc(src)}" class="${fondo === "original" ? "original" : ""}" alt="">` : `<span class="vacio"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>Aquí va tu foto<br>(hasta 5 por producto)</span>`}
      ${p.fotos.length > 1 ? `<button class="prev" type="button" data-mover="-1" aria-label="Foto anterior">${flecha("M10 3 5 8l5 5")}</button><button class="next" type="button" data-mover="1" aria-label="Foto siguiente">${flecha("m6 3 5 5-5 5")}</button><span class="st-dots">${p.fotos.map((_, i) => `<i class="${i === p.i ? "on" : ""}"></i>`).join("")}</span>` : ""}
    </div>
    ${todo === 0 ? `<span class="st-sello ${visto.agotados.has(p.id) ? "" : "entra"}">SOLD OUT</span>` : ""}
    <div class="st-row"><span class="st-name">${esc(p.nombre)}</span><span class="st-price">${esc(p.precio)}</span></div>
    ${p.desc ? `<p class="st-desc">${esc(p.desc)}</p>` : ""}
    ${p.tallas ? `<div class="st-sizes">${p.tallas.map((x) => `<span class="${x.q ? "" : "no"}" title="${x.q} disponibles">${esc(x.t)}</span>`).join("")}</div>` : ""}
    <span class="st-stock ${estado[0]}">${estado[1]}</span>
    <span class="st-btn">${todo === 0 ? "Avísame cuando haya" : esc(GIROS[S.giro].cta)}</span>
  </article>`;
}
let visto = { agotados: new Set(), wa: false };
function pintarSitio() {
  const g = GIROS[S.giro], scr = $("#pz-screen"), sc = S.secciones;
  const scroll = scr.scrollTop;
  const iniciales = (S.nombre || "Mi negocio").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  scr.innerHTML = `<div class="st" data-estilo="${esc(S.estilo)}" data-letra="${esc(S.letra)}" data-esquinas="${esc(S.esquinas)}" data-boton="${esc(S.boton)}">
    <nav class="st-nav"><span class="st-logo"><i>${esc(iniciales)}</i><b>${esc(S.nombre || "Mi negocio")}</b></span><span class="st-open">Abierto ahora</span></nav>
    <header class="st-hero"><h1>${esc(S.frase || "Lo que tienes hoy, a la vista.")}</h1><span class="st-live">Inventario actualizado hace 1 min</span></header>
    <div class="st-cats">${g.cats.map((c) => `<span>${esc(c)}</span>`).join("")}</div>
    <div class="st-grid">${S.productos.map(tarjeta).join("") || `<article class="st-card"><span class="vacio">Agrega tu primer producto</span></article>`}</div>
    <div class="st-blks">
      ${sc.horario ? `<section class="st-blk"><h2>Horario</h2><p>${esc(S.horario || "Pon tu horario")}</p></section>` : ""}
      ${sc.ubicacion ? `<section class="st-blk"><h2>Ubicación</h2><p>Aquí va tu dirección o tu zona de entrega.</p><div class="st-map"></div></section>` : ""}
      ${sc.resenas ? `<section class="st-blk st-rev"><h2>Lo que dicen</h2><p>“Llegó rapidísimo y tal cual la foto.”<br><small>Cliente de ${esc(S.nombre || "tu negocio")}</small></p></section>` : ""}
      ${sc.preguntas ? `<section class="st-blk st-faq"><h2>Preguntas</h2><details open><summary>¿Hacen envíos?</summary><p>Sí, a toda la ciudad. Pregunta por WhatsApp.</p></details><details><summary>¿Cómo aparto?</summary><p>Toca el botón de WhatsApp del producto.</p></details></section>` : ""}
      ${sc.redes ? `<section class="st-blk"><h2>Síguenos</h2><div class="st-redes"><span>Instagram</span><span>TikTok</span><span>Facebook</span></div></section>` : ""}
    </div>
    ${sc.boton ? `<div class="st-wa ${visto.wa ? "" : "entra"}"><span title="WhatsApp${S.whats ? ` ${esc(S.whats)}` : ""}"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.4 14.2c-.2.6-1.3 1.2-1.8 1.2s-1 .3-3.4-.7a11.6 11.6 0 0 1-4.5-4c-.3-.5-1-1.6-1-3s.7-2.1 1-2.4a1 1 0 0 1 .8-.4h.6c.2 0 .4 0 .6.5l.9 2c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.2-.3.3-.1.6s.7 1.2 1.5 1.9c1 .9 1.9 1.2 2.2 1.3s.4 0 .6-.1l.8-1c.2-.3.4-.2.6-.1l2 .9c.3.1.5.2.5.3s.1.8-.1 1.4Z"/></svg></span></div>` : ""}
    <p class="st-foot">Hecho con Archival</p>
  </div>`;
  scr.scrollTop = scroll;
  visto = { agotados: new Set(S.productos.filter((p) => totalDe(p) === 0).map((p) => p.id)), wa: sc.boton };
  colores();
  // Flechas de cada producto
  scr.querySelectorAll("[data-mover]").forEach((b) => b.addEventListener("click", () => {
    const p = S.productos.find((x) => x.id === +b.closest("[data-p]").dataset.p);
    p.i = (p.i + +b.dataset.mover + p.fotos.length) % p.fotos.length;
    pintarSitio();
    const img = scr.querySelector(`[data-p="${p.id}"] .st-gal img`);
    if (img && !reduce) img.animate([{ opacity: 0, transform: `translateX(${b.dataset.mover * 24}px)` }, { opacity: 1, transform: "none" }], { duration: 300, easing: "cubic-bezier(0.23,1,0.32,1)" });
  }));
}

// Cambios grandes (tema, estilo, giro): lo nuevo entra en un círculo desde donde tocaste
function conTransicion(e, cambio) {
  const scr = $("#pz-screen");
  if (!document.startViewTransition || reduce) return cambio();
  const r = scr.getBoundingClientRect();
  const x = Math.min(Math.max(e.clientX - r.left, 0), r.width), y = Math.min(Math.max(e.clientY - r.top, 0), r.height);
  document.documentElement.style.setProperty("--wx", `${(x / r.width) * 100}%`);
  document.documentElement.style.setProperty("--wy", `${(y / r.height) * 100}%`);
  const t = document.startViewTransition(() => { cambio(); $("#pz-screen .st")?.classList.add("sin-tx"); });
  t.finished.finally(() => $("#pz-screen .st")?.classList.remove("sin-tx"));
}

// El celular o la compu se escalan para caber completos en su lado
function ajustar() {
  if (!S) return;
  const dev = $("#pz-device"), vp = $("#pz-vp");
  dev.dataset.dev = S.dev;
  dlg.querySelectorAll(".pz-tools button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.dev === S.dev)));
  const cs = getComputedStyle(vp), px = (k) => parseFloat(cs[k]) || 0;
  const w = vp.clientWidth - px("paddingLeft") - px("paddingRight"), h = vp.clientHeight - px("paddingTop") - px("paddingBottom");
  const [dw, dh] = S.dev === "cel" ? [390, 800] : [1180, 740];
  dev.style.zoom = Math.max(0.3, Math.min(1, w / dw, h / dh));
}

/* ---------- Enviar ---------- */
function textoResumen() {
  const t = temaActual();
  const lineas = [
    "Hola Archival, armé mi página y la quiero:",
    `Negocio: ${S.nombre || "—"}`,
    `Giro: ${GIROS[S.giro].label}`,
    `Frase: ${S.frase || "—"}`,
    `Colores: ${t.nombre}${S.acento ? ` con color ${S.acento}` : ""}`,
    `Estilo: ${S.estilo}, letra ${S.letra}, esquinas ${S.esquinas}, botones ${S.boton}`,
    `Secciones: ${Object.entries(S.secciones).filter(([, v]) => v).map(([k]) => SECCIONES[k].toLowerCase()).join(", ") || "ninguna"}`,
    "Productos:",
    ...S.productos.map((p) => `• ${p.nombre} · ${p.precio} · ${p.tallas ? p.tallas.map((x) => `${x.t}: ${x.q}`).join(", ") : `${p.cantidad} pzas`} · ${p.fotos.length} foto(s) · fondo ${p.fondo}`),
    S.horario ? `Horario: ${S.horario}` : "",
    S.whats ? `WhatsApp del negocio: ${S.whats}` : "",
  ];
  return lineas.filter(Boolean).join("\n");
}
function resumen() {
  guardar();
  $("#pz-resumen").textContent = textoResumen();
  $("#pz-ok").textContent = WA ? "" : "El WhatsApp de Archival todavía no está conectado. Copia tu resumen y mándalo cuando esté listo.";
  $("#pz-wa").textContent = WA ? "Abrir WhatsApp" : "Copiar resumen";
  $("#pz-sheet").hidden = false;
  $("#pz-wa").focus();
}
async function enviar() {
  const txt = textoResumen() + "\n\nLas fotos te las mando aquí mismo.";
  if (WA) { window.open(`https://wa.me/52${WA}?text=${encodeURIComponent(txt)}`, "_blank", "noopener"); $("#pz-ok").textContent = "Se abrió WhatsApp con tu página. Solo dale enviar."; return; }
  try { await navigator.clipboard.writeText(txt); $("#pz-ok").textContent = "Copiado. Pégalo en WhatsApp cuando quieras."; }
  catch { $("#pz-ok").textContent = "No se pudo copiar automático: selecciona el texto de arriba y cópialo."; }
}

// Los paneles se redibujan con innerHTML: si el foco estaba en un botón que se reemplazó, vuelve al de la misma posición
const enfocables = () => [...dlg.querySelectorAll("button, input, summary")];
const conservaFoco = (fn) => (...args) => {
  const a = document.activeElement, k = dlg && dlg.contains(a) ? enfocables().indexOf(a) : -1;
  fn(...args);
  if (k >= 0 && !dlg.contains(document.activeElement)) enfocables()[k]?.focus({ preventScroll: true });
};
pintarProductos = conservaFoco(pintarProductos);
pintarTemas = conservaFoco(pintarTemas);
pintarAcentos = conservaFoco(pintarAcentos);
pintarEstilos = conservaFoco(pintarEstilos);
pintarSitio = conservaFoco(pintarSitio);
