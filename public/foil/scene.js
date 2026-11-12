// Gay Retro TCG — foil landing page scene.
// mount(root) finds the canvas and the sections inside root and directs the
// scene from the scroll position. ?s=<0..1> sets scroll, ?t=<seconds> freezes time.
import * as THREE from './three.min.js';
import * as SH from './shaders.js';

const CW = 0.63, CH = 0.88, TH = 0.011;
const LW = 0.76, LH = 1.04, LD = 0.05; // top loader
const MW = 1.62, MH = 1.16, MD = 0.1; // mailer
const PX = CW * 1.1, PY = CH * 1.075; // binder pocket pitch
const PAGE_W = PX * 3 + 0.3, PAGE_H = PY * 3 + 0.07;
const FOV = 30, CAMZ = 10, WZ = -3.2;
const N = SH.NCARD;
// card roles
const SPEC = [0, 1, 2, 3], COLL = [4, 5, 6, 7, 8, 9, 10, 11, 12], LANG = [13, 14, 15];
const V3 = THREE.Vector3, Q4 = THREE.Quaternion;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const eio = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

function roundedShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
function slab(w, h, d, r, seg = 10) {
  const g = new THREE.ExtrudeGeometry(roundedShape(w, h, r), { depth: d, bevelEnabled: false, curveSegments: seg });
  g.translate(0, 0, -d / 2); return g;
}

// ---------- textures drawn in code ----------
const DISPLAY = '"Barlow Condensed", "Arial Narrow", Impact, sans-serif';
const BODY = 'Manrope, "Helvetica Neue", Arial, sans-serif';
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, mip = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = mip;
  t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; t.anisotropy = 8;
  return t;
}
const HUES = ['#cdbfe6', '#efc3ae', '#b9d6c6', '#e6d79a', '#b3c6e6', '#e3b3c6', '#c9d8a8', '#d9c2e6', '#a9d2d6'];
function drawFace(c, o) {
  const g = c.getContext('2d'), W = c.width, H = c.height, CREAM = '#f4ead0', INK = '#17111d';
  g.fillStyle = '#ece3cc'; g.fillRect(0, 0, W, H);
  const m = W * 0.045;
  g.fillStyle = INK; rr(g, m, m, W - 2 * m, H - 2 * m, W * 0.028); g.fill();
  const gr = g.createLinearGradient(0, m, W, H); gr.addColorStop(0, 'rgba(120,80,150,.34)'); gr.addColorStop(0.6, 'rgba(60,30,80,.1)'); gr.addColorStop(1, 'rgba(0,0,0,.25)');
  g.fillStyle = gr; rr(g, m, m, W - 2 * m, H - 2 * m, W * 0.028); g.fill();
  g.strokeStyle = 'rgba(244,234,208,.5)'; g.lineWidth = W * 0.003; rr(g, m * 1.55, m * 1.55, W - 3.1 * m, H - 3.1 * m, W * 0.02); g.stroke();
  // name line
  g.fillStyle = CREAM; g.font = `800 ${W * 0.084}px ${DISPLAY}`; g.textBaseline = 'middle';
  g.fillText(o.title, W * 0.095, H * 0.087);
  g.fillStyle = o.tint; g.beginPath(); g.arc(W * 0.875, H * 0.085, W * 0.026, 0, 7); g.fill();
  g.font = `700 ${W * 0.034}px ${BODY}`; g.textAlign = 'right'; g.fillStyle = 'rgba(244,234,208,.75)'; g.fillText(o.right || '', W * 0.83, H * 0.088); g.textAlign = 'left';
  // art window (blank): uv centre (.5,.63), half (.405,.205)
  const ax = W * 0.095, ay = H * (1 - 0.835), aw = W * 0.81, ah = H * 0.41;
  const ag = g.createLinearGradient(ax, ay, ax + aw, ay + ah); ag.addColorStop(0, '#221829'); ag.addColorStop(1, '#0b070f');
  g.fillStyle = ag; rr(g, ax, ay, aw, ah, W * 0.012); g.fill();
  g.strokeStyle = CREAM; g.lineWidth = W * 0.006; rr(g, ax, ay, aw, ah, W * 0.012); g.stroke();
  if (o.glyph) { g.fillStyle = 'rgba(250,234,196,.2)'; g.font = `800 ${H * 0.34}px ${DISPLAY}`; g.textAlign = 'center'; g.fillText(o.glyph, W / 2, ay + ah * 0.54); g.textAlign = 'left'; }
  // body lines
  const ly = H * 0.645;
  g.fillStyle = o.tint; g.fillRect(W * 0.095, ly, W * 0.42, H * 0.011);
  g.fillStyle = 'rgba(244,234,208,.32)';
  [0.72, 0.58, 0.66].forEach((w, i) => g.fillRect(W * 0.095, ly + H * (0.048 + i * 0.032), W * w, H * 0.006));
  g.fillStyle = 'rgba(244,234,208,.7)'; g.fillRect(W * 0.095, H * 0.812, W * 0.3, H * 0.009);
  g.fillStyle = 'rgba(244,234,208,.32)'; g.fillRect(W * 0.095, H * 0.845, W * 0.6, H * 0.006);
  // foot
  g.fillStyle = CREAM; g.font = `700 ${W * 0.034}px ${BODY}`; g.fillText(o.no, W * 0.095, H * 0.922);
  g.textAlign = 'right'; g.fillStyle = 'rgba(244,234,208,.6)'; g.fillText('Gay Retro TCG', W * 0.905, H * 0.922); g.textAlign = 'left';
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function drawBack(c) {
  const g = c.getContext('2d'), W = c.width, H = c.height;
  g.fillStyle = '#ece3cc'; g.fillRect(0, 0, W, H);
  const m = W * 0.05; g.fillStyle = '#1c1424'; rr(g, m, m, W - 2 * m, H - 2 * m, W * 0.03); g.fill();
  g.save(); rr(g, m, m, W - 2 * m, H - 2 * m, W * 0.03); g.clip();
  g.strokeStyle = 'rgba(250,234,196,.05)'; g.lineWidth = W * 0.006;
  for (let i = -H; i < W + H; i += W * 0.035) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + H, H); g.stroke(); }
  g.restore();
  g.strokeStyle = '#f4ead0'; g.lineWidth = W * 0.006; rr(g, m * 1.9, m * 1.9, W - 3.8 * m, H - 3.8 * m, W * 0.018); g.stroke();
  g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.3, W * 0.3, 0, 0, 7); g.stroke();
  g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.275, W * 0.275, 0, 0, 7); g.lineWidth = W * 0.002; g.stroke();
  g.fillStyle = '#f4ead0'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.translate(W / 2, H / 2 + W * 0.012); g.transform(1, 0, -0.14, 1, 0, 0); g.font = `800 ${W * 0.36}px ${DISPLAY}`; g.fillText('GR', 0, 0); g.restore();
  g.font = `700 ${W * 0.034}px ${BODY}`; g.fillText('G A Y   R E T R O   T C G', W / 2, H * 0.875);
  g.fillText('P O K É M O N   S I N G L E S', W / 2, H * 0.125);
}
function drawLabel(c) {
  const g = c.getContext('2d'), W = c.width, H = c.height;
  g.fillStyle = '#f1ece0'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#17121c'; g.fillRect(W * 0.06, H * 0.1, H * 0.26, H * 0.26);
  g.fillStyle = '#f1ece0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 ${H * 0.2}px ${DISPLAY}`; g.fillText('GR', W * 0.06 + H * 0.13, H * 0.24);
  g.fillStyle = '#17121c'; g.textAlign = 'left'; g.font = `800 ${H * 0.15}px ${DISPLAY}`; g.fillText('Gay Retro TCG', W * 0.06 + H * 0.33, H * 0.185);
  g.font = `600 ${H * 0.058}px ${BODY}`; g.fillText('Pokémon singles', W * 0.06 + H * 0.335, H * 0.315);
  g.fillRect(W * 0.06, H * 0.45, W * 0.88, H * 0.008);
  g.font = `700 ${H * 0.055}px ${BODY}`; g.fillText('To', W * 0.06, H * 0.55);
  g.fillStyle = 'rgba(23,18,28,.35)';
  [0.66, 0.77, 0.88].forEach((y, i) => g.fillRect(W * 0.06, H * y, W * (i === 2 ? 0.4 : 0.88), H * 0.005));
}
function drawWord(text) {
  const size = 720, c0 = canvas(8, 8), g0 = c0.getContext('2d');
  g0.font = `800 ${size}px ${DISPLAY}`;
  const m = g0.measureText(text), pad = 24;
  const w = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + pad * 2, h = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + pad * 2;
  const c = canvas(Math.min(w, 4096), h), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff'; g.font = g0.font; g.fillText(text, pad + m.actualBoundingBoxLeft, pad + m.actualBoundingBoxAscent);
  const t = tex(c); t.userData = { aspect: c.width / c.height }; return t;
}

// ---------- poses ----------
function mkObj() { return { p: new V3(), q: new Q4(), s: 1, a: 0 }; }
function mkPose() {
  return {
    cards: Array.from({ length: N }, mkObj), loader: mkObj(), binder: mkObj(), mailer: mkObj(),
    cam: new V3(0, 0, CAMZ), look: new V3(), L: [new V3(), new V3(), new V3()], Li: [3, 1, 1.2],
    word: { id: 0, x: 0, y: 0, h: 1, w: 0 }, gloss: 0, foil: 0, clip: 0, fy: -2,
  };
}
const E = new THREE.Euler(), TQ = new Q4(), TV = new V3();
function setObj(o, x, y, z, rx, ry, rz, s, a = 1) { o.p.set(x, y, z); o.q.setFromEuler(E.set(rx, ry, rz, 'YXZ')); o.s = s; o.a = a; }
function blendObj(a, b, w, o) { o.p.lerpVectors(a.p, b.p, w); o.q.slerpQuaternions(a.q, b.q, w); o.s = lerp(a.s, b.s, w); o.a = lerp(a.a, b.a, w); }
function blendPose(a, b, w, o) {
  for (let k = 0; k < N; k++) blendObj(a.cards[k], b.cards[k], w, o.cards[k]);
  blendObj(a.loader, b.loader, w, o.loader); blendObj(a.binder, b.binder, w, o.binder); blendObj(a.mailer, b.mailer, w, o.mailer);
  o.cam.lerpVectors(a.cam, b.cam, w); o.look.lerpVectors(a.look, b.look, w);
  for (let i = 0; i < 3; i++) { o.L[i].lerpVectors(a.L[i], b.L[i], w); o.Li[i] = lerp(a.Li[i], b.Li[i], w); }
  o.gloss = lerp(a.gloss, b.gloss, w); o.foil = lerp(a.foil, b.foil, w); o.clip = w < 0.5 ? a.clip : b.clip; o.fy = lerp(a.fy, b.fy, w);
}

export function mount(root) {
  const stage = root.querySelector('[data-foil-stage]');
  const cv = stage && stage.querySelector('canvas');
  if (!cv) return { dispose() {} };
  const qs = new URLSearchParams(location.search);
  const frozen = qs.has('t') ? parseFloat(qs.get('t')) || 0 : null;
  const forced = qs.has('s') ? clamp(parseFloat(qs.get('s')) || 0) : null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { root.setAttribute('data-foil-state', 'static'); return { dispose() {} }; }
  if (!renderer.capabilities.isWebGL2) { root.setAttribute('data-foil-state', 'static'); renderer.dispose(); return { dispose() {} }; }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.autoClear = false;
  const disposers = [];
  const on = (t, e, f, o) => { t.addEventListener(e, f, o); disposers.push(() => t.removeEventListener(e, f, o)); };

  // data
  let data = { cards: [], spec: [] };
  try { data = JSON.parse(root.querySelector('[data-foil-cards]').textContent); } catch (e) { /* placeholders */ }

  // shared light uniforms
  const uL = { uLp: { value: [new V3(), new V3(), new V3()] }, uLc: { value: [new V3(), new V3(), new V3()] }, uLs: { value: [new V3(3.2, 2.2, 0), new V3(1.8, 3, 0), new V3(4, 0.9, 0)] }, uTime: { value: 0 } };
  const LCOL = [new V3(1, 0.95, 0.88), new V3(0.8, 0.88, 1), new V3(1, 0.97, 0.95)];

  // textures
  const faceC = [], faceT = [];
  const specNames = ['Cosmos', 'Linear', 'Reverse', 'Textured'];
  const meta = [];
  for (let k = 0; k < N; k++) {
    const c = canvas(630, 880); faceC.push(c); faceT.push(tex(c));
    let m;
    if (k < 4) { const d = (data.spec || [])[k]; m = { tint: HUES[[0, 4, 1, 2][k]], title: specNames[k], right: 'Foil', no: `GR / 00${k}`, pattern: k, photo: d && d.img }; }
    else if (k < 13) { const d = data.cards[k - 4]; m = { tint: HUES[(k - 4) % 9], title: 'Pokémon single', right: '', no: `GR / ${String(k - 3).padStart(3, '0')}`, pattern: 4, photo: d && d.img, finish: d && d.finish }; }
    else { const d = k === 15 && data.fallback ? { img: data.fallback, finish: 'holo' } : null; m = { tint: HUES[[3, 5, 8][k - 13]], title: ['English', 'Japanese', 'Korean'][k - 13], right: '', glyph: ['EN', 'JA', 'KO'][k - 13], no: `GR / ${['EN', 'JA', 'KO'][k - 13]}`, pattern: [1, 0, 2][k - 13], photo: d && d.img, finish: d && d.finish }; }
    if (m.photo) {
      const f = (m.finish || '').toLowerCase();
      m.pattern = /reverse/.test(f) ? 2 : /holo|foil/.test(f) ? 1 : 4;
    }
    meta.push(m);
  }
  const backC = canvas(630, 880), backT = tex(backC);
  const labelC = canvas(800, 460), labelT = tex(labelC);
  let words = [drawWord('GR'), drawWord('Foil')];
  function paint() {
    for (let k = 0; k < N; k++) if (!meta[k].loaded) { drawFace(faceC[k], meta[k]); faceT[k].needsUpdate = true; }
    drawBack(backC); backT.needsUpdate = true; drawLabel(labelC); labelT.needsUpdate = true;
    words.forEach((w) => w.dispose()); words = [drawWord('GR'), drawWord('Foil')];
    cardMats.forEach((m) => { m.uniforms.uWord.value = words[0]; }); dirty++;
  }
  function loadPhoto(k) {
    const src = meta[k].photo; if (!src || /placeholder\.png$/.test(src)) return;
    const im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async';
    im.onload = () => {
      try {
        const g = faceC[k].getContext('2d'), W = 630, H = 880, r = Math.max(W / im.width, H / im.height);
        g.fillStyle = '#111'; g.fillRect(0, 0, W, H);
        g.drawImage(im, (W - im.width * r) / 2, (H - im.height * r) / 2, im.width * r, im.height * r);
        g.getImageData(0, 0, 1, 1); // throws if the canvas is tainted
        meta[k].loaded = true; cardMats[k].uniforms.uPhoto.value = 1; faceT[k].needsUpdate = true; dirty++;
      } catch (e) { meta[k].loaded = false; drawFace(faceC[k], meta[k]); faceT[k].needsUpdate = true; }
    };
    im.src = src;
  }

  // scene 1: ground + opaque things
  const scene = new THREE.Scene(), scene2 = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(FOV, 1, 0.5, 60);
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const arr3 = (n) => Array.from({ length: n }, () => new V3());
  const bgMat = new THREE.ShaderMaterial({
    vertexShader: SH.BG_VERT, fragmentShader: SH.BG_FRAG, depthTest: false, depthWrite: false,
    uniforms: { ...uL, uInvVP: { value: new THREE.Matrix4() }, uCc: { value: arr3(SH.NOCC) }, uCx: { value: arr3(SH.NOCC) }, uCy: { value: arr3(SH.NOCC) }, uCi: { value: Array.from({ length: SH.NOCC }, () => new THREE.Vector4()) }, uWordA: { value: words[0] }, uWordB: { value: words[1] }, uRectA: { value: new THREE.Vector4(0, 0, 1, 1) }, uRectB: { value: new THREE.Vector4(0, 0, 1, 1) }, uWordW: { value: new THREE.Vector2() }, uWZ: { value: WZ }, uFY: { value: -2 }, uRes: { value: new THREE.Vector2(1, 1) } },
  });
  const bg = new THREE.Mesh(tri, bgMat); bg.frustumCulled = false; bg.renderOrder = -10; scene.add(bg);

  const cardGeo = slab(CW, CH, TH, 0.03, 8);
  const cardMats = [], cards = [];
  for (let k = 0; k < N; k++) {
    const m = new THREE.ShaderMaterial({
      vertexShader: SH.CARD_VERT, fragmentShader: SH.CARD_FRAG,
      uniforms: { ...uL, uFace: { value: faceT[k] }, uBack: { value: backT }, uWord: { value: words[0] }, uPattern: { value: meta[k].pattern }, uPhoto: { value: 0 }, uSeed: { value: k * 7.31 + 1.7 }, uWordGloss: { value: 0 }, uGain: { value: 2.1 }, uFoil: { value: 0 } },
    });
    cardMats.push(m); const mesh = new THREE.Mesh(cardGeo, m); mesh.frustumCulled = false; cards.push(mesh); scene.add(mesh);
  }
  const mailMat = new THREE.ShaderMaterial({ vertexShader: SH.MAIL_VERT, fragmentShader: SH.MAIL_FRAG, uniforms: { ...uL, uLabel: { value: labelT }, uSize: { value: new THREE.Vector2(MW, MH) } } });
  const mailer = new THREE.Mesh(slab(MW, MH, MD, 0.05, 8), mailMat); mailer.frustumCulled = false; scene.add(mailer);

  // scene 2: resolved copy + clear plastic
  const rt = new THREE.WebGLRenderTarget(4, 4, { samples: 4, depthBuffer: true, type: THREE.UnsignedByteType });
  rt.texture.minFilter = THREE.LinearFilter; rt.texture.magFilter = THREE.LinearFilter; rt.texture.generateMipmaps = false;
  const uScene = { value: rt.texture }, uRes = { value: new THREE.Vector2(1, 1) };
  const copy = new THREE.Mesh(tri, new THREE.ShaderMaterial({ vertexShader: SH.COPY_VERT, fragmentShader: SH.COPY_FRAG, uniforms: { uScene }, depthTest: false, depthWrite: false }));
  copy.frustumCulled = false; copy.renderOrder = 0; scene2.add(copy);
  const filmMat = new THREE.ShaderMaterial({ vertexShader: SH.PLASTIC_VERT, fragmentShader: SH.FILM_FRAG, uniforms: { ...uL, uScene, uRes, uAlpha: { value: 0 } }, depthTest: false, depthWrite: false });
  const film = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W, PAGE_H), filmMat); film.renderOrder = 1; film.frustumCulled = false; scene2.add(film);
  const loadMat = new THREE.ShaderMaterial({ vertexShader: SH.PLASTIC_VERT, fragmentShader: SH.LOADER_FRAG, uniforms: { ...uL, uScene, uRes, uAlpha: { value: 0 }, uSize: { value: new THREE.Vector2(LW, LH) }, uMc: { value: new V3() }, uMx: { value: new V3(1, 0, 0) }, uMy: { value: new V3(0, 1, 0) }, uMh: { value: new THREE.Vector2(1, 1) }, uClip: { value: 0 } }, depthTest: false, depthWrite: false });
  const loader = new THREE.Mesh(slab(LW, LH, LD, 0.02, 6), loadMat); loader.renderOrder = 2; loader.frustumCulled = false; scene2.add(loader);

  // ---------- layout ----------
  const L = { hw: 1, hh: Math.tan((FOV / 2) * Math.PI / 180) * CAMZ, mobile: false, vw: 1, vh: 1 };
  let secs = [], docH = 1, pr = 1, resScale = qs.has('res') ? clamp(parseFloat(qs.get('res')) || 1, 0.25, 1) : 1, dirty = 0;
  const names = ['hero', 'shop', 'post', 'end'];
  function measure() {
    L.vw = stage.clientWidth || innerWidth; L.vh = stage.clientHeight || innerHeight;
    L.mobile = L.vw < 760 || L.vw / L.vh < 0.8;
    L.hw = L.hh * L.vw / L.vh;
    // objects keep to the same centred column as the shop (1480px), so wide windows don't strand them at the edge
    L.lw = L.hw * Math.min(1, 1480 / L.vw);
    secs = names.map((n) => { const el = root.querySelector(`[data-foil="${n}"]`); if (!el) return null; const r = el.getBoundingClientRect(); return { n, top: r.top + scrollY, h: r.height }; }).filter(Boolean);
    root.querySelectorAll('[data-foil-stick]').forEach((el) => { el.style.top = L.mobile ? '' : Math.min(62, innerHeight - el.offsetHeight - 28) + 'px'; });
    docH = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    pr = Math.min(devicePixelRatio || 1, 2) * resScale;
    renderer.setPixelRatio(pr); renderer.setSize(L.vw, L.vh, false);
    const w = Math.max(2, Math.round(L.vw * pr)), h = Math.max(2, Math.round(L.vh * pr));
    rt.setSize(w, h); uRes.value.set(w, h); bgMat.uniforms.uRes.value.set(w, h);
    cam.aspect = L.vw / L.vh; cam.updateProjectionMatrix(); dirty++;
  }

  // ---------- interaction state ----------
  const tilt = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, last: -10 };
  const lift = new Float32Array(N); let hover = -1;
  let star = 0; // which card is the hero: the newest foil listing, else the cosmos specimen
  const setPointer = (cx, cy, now) => { tilt.tx = clamp((cx / L.vw) * 2 - 1, -1, 1); tilt.ty = clamp((cy / L.vh) * 2 - 1, -1, 1); tilt.last = now; };
  on(window, 'pointermove', (e) => setPointer(e.clientX, e.clientY, performance.now() / 1000), { passive: true });
  on(window, 'touchmove', (e) => { const t = e.touches[0]; if (t) setPointer(t.clientX, t.clientY, performance.now() / 1000); }, { passive: true });
  on(window, 'keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { tilt.tx = clamp(tilt.tx + (e.key === 'ArrowLeft' ? -0.5 : 0.5), -1, 1); tilt.last = performance.now() / 1000; } });
  if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    let g0 = null, b0 = null;
    on(window, 'deviceorientation', (e) => { if (e.gamma == null) return; if (g0 === null) { g0 = e.gamma; b0 = e.beta; } tilt.tx = clamp((e.gamma - g0) / 25, -1, 1); tilt.ty = clamp((e.beta - b0) / 25, -1, 1); tilt.last = performance.now() / 1000; });
  }
  // each drawable listing has a tile in the latest-cards grid
  const slots = Array.from(root.querySelectorAll('[data-foil-slot]')).map((el) => ({ el, k: 4 + (+el.getAttribute('data-foil-slot')) })).filter((x) => x.k < 12);
  slots.forEach(({ el, k }) => { const li = el.closest('li') || el; on(li, 'pointerenter', () => { hover = k; }); on(li, 'pointerleave', () => { if (hover === k) hover = -1; }); on(el, 'focus', () => { hover = k; }); on(el, 'blur', () => { if (hover === k) hover = -1; }); });
  function placeSlots(o, which) {
    for (const { el, k } of slots) {
      if ((which === 'star') !== (k === star) && which !== 'all') continue;
      const r = el.getBoundingClientRect();
      if (which !== 'star' && (r.bottom < -160 || r.top > L.vh + 160)) continue;
      let w = r.width * 0.68, h = w * CH / CW; if (h > r.height * 0.84) { h = r.height * 0.84; w = h * CW / CH; }
      const g = lift[k], cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const px = clamp((cx / L.vw) * 2 - 1, -1, 1), py = clamp((cy / L.vh) * 2 - 1, -1, 1);
      setObj(o.cards[k], ((cx / L.vw) * 2 - 1) * L.hw, (1 - (cy / L.vh) * 2) * L.hh, g * 0.35, 0.05 + (tilt.y - py) * (0.1 + g * 0.22), (tilt.x - px) * (0.2 + g * 0.3), 0, ((w / L.vw) * 2 * L.hw / CW) * (1 + g * 0.05), meta[k].loaded ? 1 : 0);
    }
  }
  root.querySelectorAll('[data-foil-row]').forEach((el) => { const i = +el.getAttribute('data-foil-row'); on(el, 'pointerenter', () => { hover = i; }); on(el, 'pointerleave', () => { if (hover === i) hover = -1; }); on(el, 'focus', () => { hover = i; }); on(el, 'blur', () => { if (hover === i) hover = -1; }); });

  // ---------- pose functions ----------
  function park(o) {
    for (let k = 0; k < N; k++) setObj(o.cards[k], (k % 5 - 2) * 0.5, -L.hh - 1.6, -0.6, -0.5, 0, 0, 1, 0);
    setObj(o.loader, 0, -L.hh - 2, 0, 0, 0, 0, 1, 0); setObj(o.binder, L.hw + 3, 0, 0, 0, -0.6, 0, 1, 0); setObj(o.mailer, 0, -L.hh - 2.4, 0, -0.4, 0, 0, 1, 0);
    o.cam.set(0, 0, CAMZ); o.look.set(0, 0, 0);
    o.L[0].set(-2.6, 4.6, 6.6); o.L[1].set(5.2, 0.6, 6); o.L[2].set(0.4, 6.4, 1.2); o.Li = [3.1, 0.85, 1.3];
    o.word.w = 0; o.gloss = 0; o.foil = 0; o.clip = 0; o.fy = -40; // one seamless backdrop, no floor line
  }
  const P = {
    hero(p, t, o) {
      park(o); const m = L.mobile, e = ease(p);
      const s = m ? (0.5 * 2 * L.hw) / CW : 3.0;
      const x = m ? 0 : L.lw * 0.62, y = m ? L.hh * 0.46 : -0.1;
      setObj(o.cards[star], x, y + e * 0.1, 0.2, 0.2 + tilt.y * 0.32 - e * 0.1, -0.5 + e * 0.75 + tilt.x * 0.5, 0.07 - e * 0.05, s);
      o.word = { id: 0, x: m ? 0 : x * 1.32, y: m ? y * 1.32 : -0.1, h: m ? (L.hw * 1.32 * 1.75) / words[0].userData.aspect : 4.6, w: 1 };
      o.gloss = 1; o.foil = 1; // only the header card wears foil; it fades as the card joins the listing
      o.L[0].set(-2.6 + e * 2 + tilt.x * 0.8, 4.6, 6.6);
    },
    // below the hero the page is a shop: the card leaves with the scroll and the velvet stays
    shop(p, t, o) {
      park(o); placeSlots(o, 'star');
      o.L[0].set(-1.2 + tilt.x * 2.2, 3.4, 7.4); o.L[1].set(4.6, -0.6, 7); o.Li = [3.9, 1.7, 1.5];
    },
    // the hero card goes into a top loader, then a mailer, beside the delivery terms
    post(p, t, o) {
      park(o); const m = L.mobile;
      const e1 = ease(p / 0.4), e2 = ease((p - 0.5) / 0.42);
      const x = m ? 0 : L.lw * 0.46, y0 = m ? L.hh * 0.4 : 0.1;
      const ms = m ? (0.7 * 2 * L.hw) / MW : 1.8, my = m ? L.hh * 0.42 : -0.55;
      setObj(o.mailer, x + 0.1, lerp(-L.hh - 2.2, my, e2), 0.2, -0.22 + tilt.y * 0.08, -0.26 + tilt.x * 0.12, 0.05, ms, e2 > 0.001 ? 1 : 0);
      const ls = lerp(m ? (0.52 * 2 * L.hw) / LW : 2.25, ms * 0.95, e2);
      TV.set(0.3 * ms, (MH * 0.5 - LH * 0.95 * 0.1) * ms, -0.09 * ms).applyQuaternion(o.mailer.q).add(o.mailer.p);
      setObj(o.loader, x, y0, 0.3, 0.1 + tilt.y * 0.22, -0.32 + tilt.x * 0.36 + e1 * 0.14, 0.04, ls, 1);
      o.loader.p.lerp(TV, e2); TQ.copy(o.loader.q); o.loader.q.slerpQuaternions(TQ, o.mailer.q, e2);
      if (e2 > 0 && e2 < 1) o.loader.p.y += Math.sin(e2 * Math.PI) * 0.5;
      const c = o.cards[star];
      TV.set(0, (-(LH - CH) * 0.5 + 0.035 + (1 - e1) * 1.5) * ls, 0).applyQuaternion(o.loader.q).add(o.loader.p);
      c.p.copy(TV); c.q.copy(o.loader.q); c.s = ls; c.a = 1;
      o.clip = e2 > 0.5 ? 1 : 0;
      o.L[0].set(-2.2 + p * 1.5, 4.8, 6.4); o.Li = [3.1, 0.95, 1.4];
    },
    end(p, t, o) { park(o); o.Li = [2.2, 0.6, 0.9]; },
  };

  const A = mkPose(), B = mkPose(), C = mkPose();
  const X = new V3(), Y = new V3();
  function apply(o, t) {
    cam.position.copy(o.cam); cam.lookAt(o.look); cam.updateMatrixWorld();
    bgMat.uniforms.uInvVP.value.multiplyMatrices(cam.matrixWorld, cam.projectionMatrixInverse);
    for (let i = 0; i < 3; i++) { uL.uLp.value[i].copy(o.L[i]); uL.uLc.value[i].copy(LCOL[i]).multiplyScalar(o.Li[i]); }
    uL.uTime.value = t;
    const u = bgMat.uniforms; u.uFY.value = o.fy;
    const occ = (j, ob, hw, hh, op, foil) => {
      X.set(1, 0, 0).applyQuaternion(ob.q); Y.set(0, 1, 0).applyQuaternion(ob.q);
      u.uCc.value[j].copy(ob.p); u.uCx.value[j].copy(X); u.uCy.value[j].copy(Y); u.uCi.value[j].set(hw * ob.s, hh * ob.s, op, foil);
    };
    for (let k = 0; k < N; k++) {
      const ob = o.cards[k], mesh = cards[k];
      mesh.visible = ob.a > 0.01;
      mesh.position.copy(ob.p); mesh.quaternion.copy(ob.q); mesh.scale.setScalar(ob.s);
      cardMats[k].uniforms.uWordGloss.value = k === star ? o.gloss : 0;
      cardMats[k].uniforms.uFoil.value = k === star ? o.foil : 0;
      occ(k, ob, CW / 2, CH / 2, ob.a > 0.01 ? clamp(ob.a) : 0, meta[k].pattern < 3.5 ? 1 : 0.35);
    }
    mailer.visible = o.mailer.a > 0.01; mailer.position.copy(o.mailer.p); mailer.quaternion.copy(o.mailer.q); mailer.scale.setScalar(o.mailer.s);
    occ(16, o.loader, LW / 2, LH / 2, o.loader.a > 0.01 ? 0.22 * clamp(o.loader.a) : 0, 0);
    occ(17, o.mailer, MW / 2, MH / 2, o.mailer.a > 0.01 ? 1 : 0, 0);
    loader.position.copy(o.loader.p); loader.quaternion.copy(o.loader.q); loader.scale.setScalar(o.loader.s); loadMat.uniforms.uAlpha.value = clamp(o.loader.a);
    X.set(1, 0, 0).applyQuaternion(o.mailer.q); Y.set(0, 1, 0).applyQuaternion(o.mailer.q);
    loadMat.uniforms.uMc.value.copy(o.mailer.p); loadMat.uniforms.uMx.value.copy(X); loadMat.uniforms.uMy.value.copy(Y); loadMat.uniforms.uMh.value.set(MW / 2 * o.mailer.s, MH / 2 * o.mailer.s); loadMat.uniforms.uClip.value = o.clip;
    film.visible = o.binder.a > 0.004; loader.visible = o.loader.a > 0.004;
    film.position.copy(o.binder.p); film.quaternion.copy(o.binder.q); film.scale.setScalar(o.binder.s); filmMat.uniforms.uAlpha.value = clamp(o.binder.a);
  }
  function setWords(a, wa, b, wb) {
    const u = bgMat.uniforms;
    const put = (w, tx, rect) => { const t = words[w.id]; tx.value = t; rect.value.set(w.x, w.y, w.h * t.userData.aspect, w.h); };
    put(a.word, u.uWordA, u.uRectA); put(b.word, u.uWordB, u.uRectB);
    u.uWordW.value.set(a.word.w * wa, b.word.w * wb);
  }

  // ---------- smooth wheel ----------
  let sTarget = scrollY, sCur = scrollY, sActive = false;
  if (!reduce && forced === null) {
    on(window, 'wheel', (e) => {
      if (e.ctrlKey || e.defaultPrevented || document.body.style.overflow === 'hidden') return;
      e.preventDefault();
      if (!sActive) { sTarget = sCur = scrollY; }
      sTarget = clamp(sTarget + e.deltaY * (e.deltaMode === 1 ? 34 : e.deltaMode === 2 ? innerHeight : 1), 0, docH); sActive = true;
    }, { passive: false });
  }

  // ---------- sound (off until asked) ----------
  const sndBtn = root.querySelector('[data-foil-sound]');
  let ac = null, sndOn = false, shimmer = null, pad = null;
  if (sndBtn) on(sndBtn, 'click', () => {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
      pad = ac.createGain(); pad.gain.value = 0; pad.connect(master);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(pad);
      [110, 164.81, 220.6].forEach((f, i) => { const o = ac.createOscillator(); o.type = i ? 'sine' : 'triangle'; o.frequency.value = f; const g = ac.createGain(); g.gain.value = i === 2 ? 0.3 : 0.6; o.connect(g); g.connect(lp); o.start(); });
      const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const n = ac.createBufferSource(); n.buffer = buf; n.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 1.4;
      shimmer = ac.createGain(); shimmer.gain.value = 0; n.connect(bp); bp.connect(shimmer); shimmer.connect(master); n.start();
      shimmer.bp = bp;
    }
    sndOn = !sndOn; if (sndOn) ac.resume();
    pad.gain.setTargetAtTime(sndOn ? 0.05 : 0, ac.currentTime, 0.4);
    if (!sndOn) shimmer.gain.setTargetAtTime(0, ac.currentTime, 0.1);
    sndBtn.setAttribute('aria-pressed', String(sndOn)); sndBtn.textContent = sndOn ? 'Sound on' : 'Enable sound';
  });

  // ---------- copy that fades before it reaches the object (small screens) ----------
  const fades = Array.from(root.querySelectorAll('[data-fade]'));
  function fadeCopy() {
    if (!L.mobile) { if (fadeCopy.on) { fades.forEach((el) => { el.style.opacity = ''; }); fadeCopy.on = false; } return; }
    fadeCopy.on = true; const z = L.vh * 0.5;
    for (const el of fades) { const r = el.getBoundingClientRect(); if (r.bottom < -200 || r.top > L.vh + 200) continue; el.style.opacity = clamp((r.top - (z - 46)) / 56).toFixed(3); }
  }

  // ---------- frame ----------
  let raf = 0, last = performance.now(), t0 = last, acc = 0, frames = 0, slow = 0, lastSheen = -9, prevY = scrollY;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = frozen !== null ? frozen : (now - t0) / 1000;
    if (sActive) { sCur += (sTarget - sCur) * (1 - Math.exp(-dt * 8.5)); if (Math.abs(sTarget - sCur) < 0.4) { sCur = sTarget; sActive = false; } scrollTo({ top: sCur, behavior: 'instant' }); }
    const y = scrollY;
    // with ?t the picture is still: draw only when something changed
    if (frozen !== null) { const key = `${y}|${dirty}|${tilt.tx}|${tilt.ty}|${hover}`; if (key === frame.key) return; frame.key = key; }
    // pointer spring: lag and weight
    const idle = clamp((t - tilt.last - 1.5) / 2);
    const still = reduce && frozen === null;
    let gx = tilt.tx * (1 - idle * 0.6) + (still ? 0 : Math.sin(t * 0.55) * 0.42 * (0.35 + 0.65 * idle));
    let gy = tilt.ty * (1 - idle * 0.6) + (still ? 0 : Math.sin(t * 0.37 + 1.3) * 0.3 * (0.35 + 0.65 * idle));
    if (frozen !== null) { tilt.x = gx; tilt.y = gy; }
    else { const k = 34, c = 7.5; tilt.vx += ((gx - tilt.x) * k - tilt.vx * c) * dt; tilt.vy += ((gy - tilt.y) * k - tilt.vy * c) * dt; tilt.x += tilt.vx * dt; tilt.y += tilt.vy * dt; }
    for (let k = 0; k < N; k++) { const g = hover === k ? 1 : 0; lift[k] += (g - lift[k]) * (frozen !== null ? 1 : 1 - Math.exp(-dt * 9)); }
    // which section, how far
    let i = 0; for (let k = 0; k < secs.length; k++) if (y >= secs[k].top - L.vh) i = k;
    const cur = secs[i]; if (!cur) return;
    const span = Math.max(1, cur.h - L.vh);
    if (i > 0 && y < cur.top) {
      // the closing section is short, so the stage clears within the first part of its arrival
      const prev = secs[i - 1], w = ease(clamp((y - (cur.top - L.vh)) / (L.vh * (cur.n === 'end' ? 0.3 : 1))));
      frame.rest = '';
      P[prev.n](1, t, A); P[cur.n](0, t, B); blendPose(A, B, w, C); setWords(A, 1 - w, B, w);
    } else {
      P[cur.n](clamp((y - cur.top) / span), t, C); setWords(C, 1, C, 0);
    }
    // cards for sale stay in their tiles whatever the stage is doing
    placeSlots(C, 'rest');
    apply(C, t);
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam);
    renderer.setRenderTarget(null); renderer.clear(); renderer.render(scene2, cam);
    fadeCopy();
    const sh = tilt.x * 0.5 + y / L.vh * 0.35;
    if (Math.abs(sh - lastSheen) > 0.002) { root.style.setProperty('--sheen', (sh * 100).toFixed(2) + '%'); lastSheen = sh; }
    if (sndOn && shimmer) { const v = Math.min(1, Math.hypot(tilt.vx, tilt.vy) * 0.5 + Math.abs(y - prevY) * 0.01); shimmer.gain.setTargetAtTime(v * 0.05, ac.currentTime, 0.08); shimmer.bp.frequency.setTargetAtTime(3800 + tilt.x * 2200, ac.currentTime, 0.1); }
    prevY = y;
    // keep the frame rate: drop internal resolution when frames run long
    if (frozen === null) { acc += dt; frames++; if (frames >= 45) { const avg = acc / frames; acc = 0; frames = 0; if (avg > 0.021 && resScale > 0.5) { if (++slow >= 2) { resScale = Math.max(0.5, resScale - 0.14); slow = 0; measure(); } } else slow = 0; mountState.fps = 1 / avg; } }
  }
  const mountState = { fps: 0 };
  window.__foil = mountState;

  function start() {
    paint();
    // the hero card: newest listing with a foil finish, else the cosmos specimen
    star = 15; // the showcase artwork stands in only when no listing can be drawn
    const has = (k) => !!meta[k].photo;
    for (let k = 11; k >= 4; k--) if (has(k)) star = k;
    for (let k = 11; k >= 4; k--) if (has(k) && meta[k].pattern < 3.5) star = k;
    if (meta[star].pattern > 3.5) { meta[star].pattern = 1; cardMats[star].uniforms.uPattern.value = 1; }
    for (let k = 0; k < N; k++) loadPhoto(k);
    measure();
    if (forced !== null) scrollTo({ top: forced * docH, behavior: 'instant' });
    root.setAttribute('data-foil-state', 'live');
    last = performance.now(); raf = requestAnimationFrame(frame);
  }
  let ro = null;
  if (window.ResizeObserver) { ro = new ResizeObserver(() => measure()); ro.observe(stage); ro.observe(root); }
  on(window, 'resize', measure);
  on(window, 'scroll', () => { if (!sActive) sTarget = sCur = scrollY; }, { passive: true });
  const fontsReady = document.fonts && document.fonts.load ? Promise.all([document.fonts.load(`800 100px "Barlow Condensed"`), document.fonts.load(`700 20px Manrope`)]).catch(() => {}) : Promise.resolve();
  let disposed = false;
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1800))]).then(() => { if (!disposed) start(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!disposed && raf) paint(); });

  return {
    dispose() {
      disposed = true; cancelAnimationFrame(raf); disposers.forEach((f) => f()); if (ro) ro.disconnect();
      if (ac) ac.close();
      [...cardMats, bgMat, mailMat, filmMat, loadMat, copy.material].forEach((m) => m.dispose());
      [...faceT, backT, labelT, ...words].forEach((x) => x.dispose());
      cardGeo.dispose(); mailer.geometry.dispose(); loader.geometry.dispose(); film.geometry.dispose(); tri.dispose(); rt.dispose(); renderer.dispose();
      root.removeAttribute('data-foil-state'); root.style.removeProperty('--sheen');
    },
  };
}
