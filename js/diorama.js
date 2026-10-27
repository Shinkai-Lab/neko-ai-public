// 箱庭(猫の家)。sim.js の格子(1 マス = 1.25 m、高さ h の 1 = 0.9 m)を、メートル単位の立体にする。
// 見た目だけ(物理は sim.js)。研究日誌の中に置く切り取りの模型: 紙の上に浮かぶ板の上に、家と庭と道。インクの線(縁取り)を細くつけて、紙の絵に寄せる。
// 光は猫の世界の時刻に合わせる(朝の白い光 → 昼 → 夕方の橙 → 夜は月明かりの青い光と、ストーブと行灯)。紙(頁)は昼夜そのまま。
import * as THREE from "three";

export const CELL = 1.25;          // 1 マス(m)
export const HUNIT = 0.9;          // 高さ h の 1(m)
const INK = 0x3b3128;

// ------------------------------------------------------------ 絵の具(canvas で作る手触り)
function rng32(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function canvasTex(w, h, draw, repeat) {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const g = cv.getContext("2d"); draw(g, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function speckle(g, w, h, n, cols, size, seed) {
  const r = rng32(seed);
  for (let i = 0; i < n; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; const s = size * (0.5 + r()); g.fillRect(r() * w, r() * h, s, s); }
}
const TEX = {};
function tex(name) {
  if (TEX[name]) return TEX[name];
  const T = {
    tatami: () => canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = "#c2bc78"; g.fillRect(0, 0, w, h);
      const r = rng32(3);
      for (let x = 0; x < w; x += 2) { g.fillStyle = `rgba(${150 + r() * 40},${150 + r() * 30},${70 + r() * 20},.28)`; g.fillRect(x, 0, 1, h); }
      speckle(g, w, h, 500, ["rgba(255,255,230,.12)", "rgba(90,90,40,.10)"], 2, 5);
      g.fillStyle = "#4d5a3a"; g.fillRect(0, 0, w, 5); g.fillRect(0, h - 5, w, 5);               // へり(黒い縁の布)
      g.fillStyle = "rgba(60,50,30,.5)"; g.fillRect(0, 0, 2, h); g.fillRect(w - 2, 0, 2, h);
    }),
    tatamiL: () => canvasTex(256, 256, (g, w, h) => {      // 障子際の畳(日が当たって少し明るい)
      g.fillStyle = "#cfc989"; g.fillRect(0, 0, w, h);
      const r = rng32(4);
      for (let x = 0; x < w; x += 2) { g.fillStyle = `rgba(${170 + r() * 40},${165 + r() * 30},${90 + r() * 20},.25)`; g.fillRect(x, 0, 1, h); }
      g.fillStyle = "#58663f"; g.fillRect(0, 0, w, 5); g.fillRect(0, h - 5, w, 5);
    }),
    wood: () => canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = "#b08a5c"; g.fillRect(0, 0, w, h);
      const r = rng32(7);
      for (let i = 0; i < 6; i++) { const y = i * (h / 6); g.fillStyle = `rgba(${90 + r() * 30},${60 + r() * 20},${30},.25)`; g.fillRect(0, y, w, h / 6); g.fillStyle = "rgba(50,30,15,.55)"; g.fillRect(0, y, w, 2); }
      for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(80,50,25,${0.1 + r() * 0.12})`; g.lineWidth = 1; const y = r() * h; g.beginPath(); g.moveTo(r() * w, y); g.bezierCurveTo(w * 0.3, y + r() * 4 - 2, w * 0.6, y + r() * 4 - 2, w, y + r() * 3); g.stroke(); }
    }),
    kitchen: () => canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = "#d3bc95"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(110,85,55,.6)"; g.lineWidth = 3;
      for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * w / 2, 0); g.lineTo(i * w / 2, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 2); g.lineTo(w, i * h / 2); g.stroke(); }
      speckle(g, w, h, 300, ["rgba(255,255,255,.12)", "rgba(80,60,30,.10)"], 3, 9);
    }),
    deck: () => canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = "#a47a4f"; g.fillRect(0, 0, w, h);
      const r = rng32(11);
      for (let i = 0; i < 4; i++) { const x = i * (w / 4); g.fillStyle = `rgba(${100 + r() * 30},${70 + r() * 20},${40},.3)`; g.fillRect(x, 0, w / 4, h); g.fillStyle = "rgba(40,25,10,.6)"; g.fillRect(x, 0, 3, h); }
      for (let i = 0; i < 70; i++) { g.strokeStyle = "rgba(70,45,25,.18)"; g.beginPath(); const x = r() * w; g.moveTo(x, 0); g.lineTo(x + r() * 6 - 3, h); g.stroke(); }
    }),
    grass: () => canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = "#7fa95e"; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 2400, ["#8fb86a", "#6e9a50", "#97bd72", "#5f8a45"], 3, 21);
      speckle(g, w, h, 40, ["#e8e0a0", "#d98f7a"], 3, 22);
    }),
    shade: () => canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = "#6a9650"; g.fillRect(0, 0, w, h);
      speckle(g, w, h, 2400, ["#76a35a", "#5a8644", "#648f4b", "#4f7a3d"], 3, 23);
      speckle(g, w, h, 160, ["#7a5b3a", "#8a6a45"], 4, 24);
    }),
    stone: () => canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = "#a9a79f"; g.fillRect(0, 0, w, h);
      const r = rng32(31);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const v = 150 + r() * 40; g.fillStyle = `rgb(${v},${v - 2},${v - 8})`; g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
      g.strokeStyle = "rgba(60,58,52,.7)"; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
      speckle(g, w, h, 600, ["rgba(255,255,255,.1)", "rgba(40,40,40,.1)"], 2, 33);
    }),
    concrete: () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#8e8d88"; g.fillRect(0, 0, w, h); speckle(g, w, h, 1500, ["rgba(255,255,255,.1)", "rgba(30,30,30,.12)"], 2, 41); g.strokeStyle = "rgba(60,60,60,.5)"; g.lineWidth = 3; g.strokeRect(0, 0, w, h); }),
    plaster: () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#e6dcc4"; g.fillRect(0, 0, w, h); speckle(g, w, h, 1800, ["rgba(255,255,255,.18)", "rgba(120,100,70,.09)"], 2, 51); }, [3, 2]),
    sand: () => canvasTex(128, 128, (g, w, h) => { g.fillStyle = "#e3d29a"; g.fillRect(0, 0, w, h); speckle(g, w, h, 900, ["#d4c186", "#efe0aa", "#c9b777"], 2, 61); }),
    asphalt: () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#6f6e6b"; g.fillRect(0, 0, w, h); speckle(g, w, h, 2200, ["#7d7c78", "#5f5e5b", "#85847f"], 2, 71); }),
    weave: () => canvasTex(128, 128, (g, w, h) => {          // 籠の編み目(縦横に交わる細い帯)
      g.fillStyle = "#6e5233"; g.fillRect(0, 0, w, h);
      const r = rng32(81); const n = 8, c = w / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const over = (i + j) % 2 === 0; const v = 175 + r() * 30;
        g.fillStyle = `rgb(${v},${v - 38},${v - 90})`;
        if (over) g.fillRect(i * c + 1, j * c + 3, c - 2, c - 6); else g.fillRect(i * c + 3, j * c + 1, c - 6, c - 2);
        g.fillStyle = "rgba(60,38,18,.35)"; if (over) g.fillRect(i * c + 1, j * c + c - 4, c - 2, 1.5); else g.fillRect(i * c + c - 4, j * c + 1, 1.5, c - 2);
      }
    }, [2, 1]),
    check: () => canvasTex(64, 64, (g, w, h) => {                     // 籠に掛けた布(青い格子)
      g.fillStyle = "#e9eef2"; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(70,110,170,.55)";
      for (let i = 0; i < 4; i++) { g.fillRect(i * 16 + 4, 0, 8, h); g.fillRect(0, i * 16 + 4, w, 8); }
    }, [2, 2]),
    fabric: () => canvasTex(128, 128, (g, w, h) => {                   // ベージュの布張り(キャットタワー)
      g.fillStyle = "#d9c7a3"; g.fillRect(0, 0, w, h); const r = rng32(91);
      for (let i = 0; i < w; i += 3) { g.fillStyle = `rgba(${150 + r() * 40},${130 + r() * 30},${95 + r() * 20},.18)`; g.fillRect(i, 0, 1, h); }
      for (let j = 0; j < h; j += 3) { g.fillStyle = `rgba(255,250,235,${0.05 + r() * 0.08})`; g.fillRect(0, j, w, 1); }
    }, [1, 1]),
    rope: () => canvasTex(32, 64, (g, w, h) => {                       // 麻縄(斜めの撚り)
      g.fillStyle = "#c8a56a"; g.fillRect(0, 0, w, h); g.strokeStyle = "rgba(90,60,25,.55)"; g.lineWidth = 2;
      for (let y = -16; y < h + 16; y += 8) { g.beginPath(); g.moveTo(0, y + 8); g.lineTo(w, y); g.stroke(); }
    }, [1, 5]),
    cloth: () => canvasTex(64, 64, (g, w, h) => { g.fillStyle = "#b9473a"; g.fillRect(0, 0, w, h); g.strokeStyle = "rgba(255,255,255,.18)"; for (let i = 0; i < w; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); } }),
  };
  return (TEX[name] = T[name]());
}
const mats = {};
function M(color, o) { const k = color + JSON.stringify(o || {}); return mats[k] || (mats[k] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.92, metalness: 0 }, o || {}))); }
function MT(name, o) { const k = "T:" + name + JSON.stringify(o || {}); return mats[k] || (mats[k] = new THREE.MeshStandardMaterial(Object.assign({ map: tex(name), roughness: 0.95, metalness: 0 }, o || {}))); }

function box(w, h, d, mat, ink) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = true; m.receiveShadow = true;
  if (ink !== 0) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: ink || 0.38 })); e.userData.ink = 1; m.add(e); }
  return m;
}
function cyl(rt, rb, h, mat, seg, ink) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 20), mat); m.castShadow = true; m.receiveShadow = true;
  if (ink !== 0) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 40), new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: ink || 0.3 })); e.userData.ink = 1; m.add(e); }
  return m;
}
function place(o, x, y, z) { o.position.set(x, y, z); return o; }

// ------------------------------------------------------------ 箱庭
export function createDiorama(env) {
  const root = new THREE.Group();
  const C = env.consts, { W, H, FLOOR, TOP, INSIDE, idx3 } = C;
  const P = env.P, names = env.names;
  const cx = (x) => x * CELL, cz = (y) => y * CELL;
  const anchors = [];                  // 手書きの注記の位置 {text, p: Vector3, dx, dy}
  const BIG = new Set(["本棚(上が高い席)", "高い窓辺", "塀の上", "庭木の陰", "縁側", "車(ボンネット)", "ストーブ", "トイレの砂"]);
  const note = (text, x, y, z, dx, dy) => anchors.push({ text, p: new THREE.Vector3(x, y, z), dx: dx || 0, dy: dy || -26, big: BIG.has(text) });
  const FENCE_DX = 0.45;               // 塀は庭の格子の東寄りに立て、格子の中の猫と重ならないようにする
  const obst = [];                     // 猫が乗らない物の占める箱 {x,z,hx,hz,get?}(世界座標、水平)。standPos / route が避ける
  let cushion = null;                  // 座布団の面(縁にかかると半分の高さ)
  const climb = {};                    // 登る・降りる時の足場 {ground:{x,y,z}, foots:[{x,y,z}], exit:{x,y,z}}(飾りの台。物理には無い)
  const bumps = {};                    // 乗れる物の面の高さ(格子の地面からの上乗せ) "layer:x:y" → m
  const dyn = {};                      // 動く物
  const tiles = [];

  // 土台の板(切り取りの模型)
  const X0 = -CELL * 0.5 - 0.35, X1 = cx(W - 1) + CELL * 0.5 + 0.35, Z0 = -CELL * 0.5 - 0.35, Z1 = cz(H - 1) + CELL * 0.5 + 0.35;
  // 高さ: 家の床 0、縁側 -0.04(わずかに低い板の帯)、庭・道 -DROP(縁側から庭へ一段下がる)。物理の h は使わず、見た目の高さをここで決める
  const DROP = 0.2;
  const isInd = (x, y) => !!P.indoor[idx3(FLOOR, y, x)];
  const isVer = (x, y) => names[idx3(FLOOR, y, x)] === "縁側";
  const lvl = (x, y) => (isVer(x, y) ? -0.04 : (isInd(x, y) ? 0 : -DROP));   // その格子の地面の高さ
  const out = new THREE.Group(); out.position.y = -DROP; root.add(out);      // 庭側の物(塀・庭木・車…)は庭の高さに置く
  const base = box(X1 - X0, 0.5, Z1 - Z0, M(0x8a6a45), 0.5); base.position.set((X0 + X1) / 2, -0.57, (Z0 + Z1) / 2); root.add(base);
  { const fm = M(0x8a6a45), fy = -0.16, fh = 0.31, gx0 = -CELL / 2, gx1 = cx(W - 1) + CELL / 2, gz0 = -CELL / 2, gz1 = cz(H - 1) + CELL / 2;
    for (const [x0, x1, z0, z1] of [[X0, X1, Z0, gz0], [X0, X1, gz1, Z1], [X0, gx0, gz0, gz1], [gx1, X1, gz0, gz1]]) { const f = box(x1 - x0, fh, z1 - z0, fm, 0.5); f.position.set((x0 + x1) / 2, fy, (z0 + z1) / 2); root.add(f); } }

  // 床のタイル
  const kindTex = { "板の間": "wood", "畳": "tatami", "障子際の畳": "tatamiL", "南窓の畳": "tatamiL", "台所": "kitchen", "ごはん皿": "kitchen", "帳場の座布団": "tatami", "ストーブの前": "tatami", "縁側": "deck", "庭": "grass", "庭木の陰": "shade", "石畳": "stone", "駐車場": "concrete" };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const nm = names[idx3(FLOOR, y, x)]; const hh = lvl(x, y);
    const t = box(CELL, 0.3 + hh, CELL, MT(kindTex[nm] || "wood"), nm === "縁側" ? 0.3 : 0.12);
    t.position.set(cx(x), (hh - 0.3) / 2, cz(y)); t.userData = { x, y }; t.castShadow = false; root.add(t); tiles.push(t);
  }
  // 道の縁石・庭と道のさかい
  const curb = box(0.14, 0.16, cz(H - 1) + CELL, M(0x9d9a92), 0.35); curb.position.set(cx(8) - CELL / 2, 0.08, (cz(0) + cz(H - 1)) / 2); out.add(curb);
  for (let y = 0; y < H; y++) { const c = box(0.1, 0.01, CELL * 0.5, M(0xe5e2d8), 0); c.position.set(cx(9) + 0.3, 0.005, cz(y)); out.add(c); }

  // ---- 家の壁(北と西。南と東は切り取って中が見える)
  const wallM = MT("plaster");
  const wallH = 2.7, wt = 0.14;
  const northL = box(cx(3) - CELL / 2 - X0, wallH, wt, wallM); northL.position.set((X0 + cx(3) - CELL / 2) / 2, wallH / 2, Z0 + wt / 2 + 0.18); root.add(northL);
  const northR = box(cx(4) + CELL / 2 + 0.1 - (cx(3) + CELL / 2), wallH, wt, wallM); northR.position.set((cx(3) + CELL / 2 + cx(4) + CELL / 2 + 0.1) / 2, wallH / 2, Z0 + wt / 2 + 0.18); root.add(northR);
  const lintel = box(CELL, wallH - 2.0, wt, wallM); lintel.position.set(cx(3), 2.0 + (wallH - 2.0) / 2, Z0 + wt / 2 + 0.18); root.add(lintel);
  const west = box(wt, wallH, Z1 - Z0 - 0.3, wallM); west.position.set(X0 + wt / 2 + 0.18, wallH / 2, (Z0 + Z1) / 2); root.add(west);
  // 梁・柱(北と西だけ。手前(南・東)は猫が見えなくなるので置かない)
  const beamM = M(0x6a5038);
  for (const [bx, bz] of [[X0 + 0.25, Z0 + 0.25], [cx(4) + CELL / 2 + 0.12, Z0 + 0.25]]) { const p = box(0.12, wallH + 0.1, 0.12, beamM); p.position.set(bx, (wallH + 0.1) / 2, bz); root.add(p); }
  const beamN = box(cx(4) + CELL + 0.4 - X0, 0.12, 0.12, beamM); beamN.position.set((X0 + cx(4) + CELL / 2 + 0.12) / 2, wallH + 0.06, Z0 + 0.25); root.add(beamN);
  const beamW = box(0.12, 0.12, Z1 - Z0 - 0.5, beamM); beamW.position.set(X0 + 0.25, wallH + 0.06, (Z0 + Z1) / 2 - 0.1); root.add(beamW);
  // 障子(東のさかい、半分開いた枠)
  const shoji = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const fr = box(CELL * 0.9, 1.9, 0.05, new THREE.MeshStandardMaterial({ color: 0xf2ead2, roughness: 1, transparent: true, opacity: 0.55 }), 0.5);
    fr.position.set(0, 0.95, 0); shoji.add(fr);
    const grid = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(CELL * 0.9, 1.9, 0.06)), new THREE.LineBasicMaterial({ color: 0x6d5a3c, transparent: true, opacity: 0.5 }));
  }
  const shojiX = cx(4) + CELL / 2 + 0.1;
  for (const [zz, ww] of [[cz(0) - 0.1, 1], [cz(1) + 0.1, 1]]) {
    if (!ww) continue;
    const s = box(0.05, 1.9, CELL * 0.92, new THREE.MeshStandardMaterial({ color: 0xf4eed8, roughness: 1, transparent: true, opacity: 0.6 }), 0.55); s.position.set(shojiX, 0.95, zz); root.add(s);
    for (let k = 1; k < 4; k++) { const bar = box(0.06, 0.03, CELL * 0.92, M(0x7a6244), 0); bar.position.set(shojiX, 0.95 - 0.95 + k * 0.475, zz); root.add(bar); }
    for (let k = 1; k < 3; k++) { const bar = box(0.06, 1.9, 0.03, M(0x7a6244), 0); bar.position.set(shojiX, 0.95, zz - CELL * 0.46 + k * CELL * 0.92 / 3); root.add(bar); }
  }
  // ---- 本棚(北の壁ぎわ、cell (0,0)(1,0))。上が猫の席(h 2 = 1.8 m)
  const shelfM = M(0x7b5a3a);
  const bookCols = [0xb04a3a, 0x3f6b8c, 0x8c7a3a, 0x4a7a54, 0xc7a35a, 0x6c4a7a, 0xd8d0b8, 0x2f3b4a];
  for (const [bx] of [[0], [1]]) {
    if (names[idx3(TOP, 0, bx)] !== "本棚の上") continue;
    const g = new THREE.Group(); g.position.set(cx(bx), 0, cz(0) - 0.12);
    const sideL = box(0.05, 1.8, 0.5, shelfM); sideL.position.set(-0.55, 0.9, 0); const sideR = box(0.05, 1.8, 0.5, shelfM); sideR.position.set(0.55, 0.9, 0);
    g.add(sideL, sideR);
    const r = rng32(100 + bx); const books = [];
    for (let k = 0; k < 6; k++) {
      const board = box(1.12, 0.04, 0.5, shelfM); board.position.set(0, k * 0.36 + 0.02, 0); g.add(board);
      if (k < 5) { let px = -0.5; while (px < 0.48) { const w = 0.03 + r() * 0.04, hgt = 0.2 + r() * 0.12; books.push([px + w / 2, k * 0.36 + 0.04 + hgt / 2, w, hgt, bookCols[Math.floor(r() * bookCols.length)]]); px += w + 0.004; if (r() < 0.07) px += 0.08; } }
    }
    {   // 本は一つの InstancedMesh にまとめる(一冊ずつ描かない)
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), books.length); const m4 = new THREE.Matrix4(), col = new THREE.Color();
      books.forEach((b, n) => { m4.compose(new THREE.Vector3(b[0], b[1], 0.02), new THREE.Quaternion(), new THREE.Vector3(b[2], b[3], 0.3)); im.setMatrixAt(n, m4); im.setColorAt(n, col.setHex(b[4])); });
      im.castShadow = false; im.receiveShadow = true; g.add(im);
    }
    root.add(g);
    obst.push({ x: cx(bx), z: cz(0) - 0.12, hx: 0.58, hz: 0.25 });
  }
  note("本棚(上が高い席)", cx(0.5), 1.9, cz(0) - 0.1, 0, -28);
  // ---- キャットタワー(飾り。猫の世界にはまだ無い)。本棚の東に立てて、本棚へ登り降りする時の足掛かりに使う
  if (names[idx3(TOP, 0, 0)] === "本棚の上" || names[idx3(TOP, 0, 1)] === "本棚の上") {
    const tx = cx(2) - 0.25, tz = -0.2; const fab = MT("fabric"), rope = MT("rope");
    const baseP = box(0.64, 0.06, 0.64, fab, 0.4); baseP.position.set(tx, 0.03, tz); root.add(baseP);
    const post = cyl(0.058, 0.058, 1.56, rope, 12, 0.3); post.position.set(tx, 0.06 + 0.78, tz); root.add(post);
    const plate = (px, py, pz) => { const p = box(0.5, 0.06, 0.5, fab, 0.4); p.position.set(px, py - 0.03, pz); root.add(p);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const k = box(0.02, 0.0001, 0.02, fab, 0); k.position.set(px + dx * 0.2, py - 0.06, pz + dz * 0.2); } };
    const f1 = { x: tx, y: 0.4, z: tz + 0.32 }, f2 = { x: tx, y: 0.8, z: tz - 0.16 }, f3 = { x: tx + 0.3, y: 1.2, z: tz }, f4 = { x: tx, y: 1.6, z: tz };
    plate(f1.x, f1.y, f1.z); plate(f2.x, f2.y, f2.z); plate(f3.x, f3.y, f3.z);
    const topD = cyl(0.27, 0.27, 0.06, fab, 24, 0.4); topD.position.set(f4.x, f4.y - 0.03, f4.z); root.add(topD);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.025, 8, 28), fab); rim.rotation.x = Math.PI / 2; rim.position.set(f4.x, f4.y, f4.z); root.add(rim);
    obst.push({ x: tx, z: tz + 0.06, hx: 0.34, hz: 0.5 });
    climb["本棚の上"] = { ground: { x: tx, y: 0, z: tz + 0.92 }, foots: [f1, f2, f3, f4], exit: { x: cx(1) + 0.38, y: 1.84, z: cz(0) - 0.12 } };
    note("キャットタワー(飾り。まだ猫の世界には無い)", tx, 1.9, tz, 24, -8);
  }

  // ---- 高い窓辺 (4,5) の上: 出窓の板とガラス
  if (names[idx3(TOP, 5, 4)] === "高い窓辺") {
    const zS = Z1 - 0.2;
    const sillB = box(1.15, 0.07, 0.62, M(0xa07850), 0.45); sillB.position.set(cx(4), 1.5, zS - 0.3); root.add(sillB);
    const glass = box(1.15, 0.9, 0.03, new THREE.MeshStandardMaterial({ color: 0xbfe0f2, roughness: 0.1, transparent: true, opacity: 0.28 }), 0.5); glass.position.set(cx(4), 2.02, zS + 0.01); root.add(glass); dyn.glass = glass;
    for (const sx of [-0.6, 0.6]) { const p = box(0.04, 1.2, 0.05, beamM); p.position.set(cx(4) + sx, 1.95, zS); root.add(p); }
    const top = box(1.25, 0.05, 0.06, beamM); top.position.set(cx(4), 2.5, zS); root.add(top);
    note("高い窓辺", cx(4), 1.85, zS - 0.3, 0, -30);
    // 飾りの足場: 踏み台 → 木箱 → 出窓(猫の世界には無い)
    { const wood = MT("wood"); const st = box(0.5, 0.4, 0.5, wood, 0.4); st.position.set(cx(3) - 0.2, 0.2, zS - 0.55); root.add(st);
      const ch = box(0.52, 0.9, 0.5, M(0x8d6a43), 0.4); ch.position.set(cx(3) + 0.5, 0.45, zS - 0.3); root.add(ch);
      const lidc = box(0.56, 0.04, 0.54, M(0x6d4f30), 0.4); lidc.position.set(cx(3) + 0.5, 0.92, zS - 0.3); root.add(lidc);
      obst.push({ x: cx(3) - 0.2, z: zS - 0.55, hx: 0.25, hz: 0.25 }); obst.push({ x: cx(3) + 0.5, z: zS - 0.3, hx: 0.27, hz: 0.27 });
      climb["高い窓辺"] = { ground: { x: cx(3) - 0.2, y: 0, z: zS - 1.15 }, foots: [{ x: cx(3) - 0.2, y: 0.4, z: zS - 0.55 }, { x: cx(3) + 0.5, y: 0.94, z: zS - 0.3 }], exit: { x: cx(4) - 0.4, y: 1.54, z: zS - 0.3 } };
      note("踏み台と木箱(飾り)", cx(3) + 0.15, 0.95, zS - 0.45, -14, -16); }
  }
  // ---- 塀(外、cell (7,4)(7,5) の上 1.8 m)
  const fenceCells = []; for (let y = 0; y < H; y++) if (names[idx3(TOP, y, 7)] === "塀の上") fenceCells.push(y);
  if (fenceCells.length) {
    const z0 = cz(Math.min(...fenceCells)) - CELL / 2, z1 = cz(Math.max(...fenceCells)) + CELL / 2 + 0.35;
    const fx = cx(7) + FENCE_DX;
    const wall = box(0.3, 1.8, z1 - z0, MT("concrete"), 0.4); wall.position.set(fx, 0.9, (z0 + z1) / 2); out.add(wall);
    const cap = box(0.38, 0.08, z1 - z0 + 0.04, M(0x8f8d86), 0.4); cap.position.set(fx, 1.84, (z0 + z1) / 2); out.add(cap);
    obst.push({ x: fx, z: (z0 + z1) / 2, hx: 0.19, hz: (z1 - z0) / 2 });
    note("塀の上", fx, 1.9 - DROP, (z0 + z1) / 2, 18, -26);
    // 飾りの足場: 木箱 → ブロックの柱 → 塀(猫の世界には無い)
    { const cr = box(0.55, 0.45, 0.55, MT("wood"), 0.4); cr.position.set(fx - 1.0, 0.225, z0 + 0.2); out.add(cr);
      const pl = box(0.42, 1.0, 0.42, MT("concrete"), 0.4); pl.position.set(fx - 0.42, 0.5, z0 + 0.25); out.add(pl);
      const plc = box(0.5, 0.06, 0.5, M(0x8f8d86), 0.4); plc.position.set(fx - 0.42, 1.03, z0 + 0.25); out.add(plc);
      obst.push({ x: fx - 1.0, z: z0 + 0.2, hx: 0.28, hz: 0.28 }); obst.push({ x: fx - 0.42, z: z0 + 0.25, hx: 0.26, hz: 0.26 });
      climb["塀の上"] = { ground: { x: fx - 1.1, y: -DROP, z: z0 + 0.95 }, foots: [{ x: fx - 1.0, y: 0.45 - DROP, z: z0 + 0.2 }, { x: fx - 0.42, y: 1.06 - DROP, z: z0 + 0.25 }], exit: { x: fx, y: 1.88 - DROP, z: z0 + 0.25 } }; }
  }
  // ---- 庭木(庭木の陰 (7,2))
  {
    const tx = cx(7), tz = cz(2);
    const trunk = cyl(0.14, 0.2, 2.2, M(0x6b4a30), 10, 0.3); trunk.position.set(tx + 0.2, 1.1, tz - 0.4); out.add(trunk);
    obst.push({ x: tx + 0.2, z: tz - 0.4, hx: 0.19, hz: 0.19 });
    const lc = [0x5f8f45, 0x6b9a4b, 0x558440];
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75 + (i % 3) * 0.12, 1), M(lc[i % 3], { flatShading: true })); s.castShadow = true; s.position.set(tx + 0.2 + Math.cos(i * 1.1) * 0.6, 2.4 + (i % 2) * 0.35, tz - 0.4 + Math.sin(i * 1.1) * 0.55); out.add(s); }
    note("庭木の陰", tx, 0.9 - DROP, tz + 0.5, 20, -10);
  }
  // 生け垣と庭の石(飾り)
  for (let i = 0; i < 4; i++) { const hb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), M(0x5a8a42, { flatShading: true })); hb.scale.set(1.3, 0.8, 1); hb.position.set(cx(6) + i * 0.55, 0.38, Z0 + 0.15); hb.castShadow = true; out.add(hb); }
  for (const [sx, sz, sr] of [[cx(6) + 0.35, cz(1) + 0.3, 0.2], [cx(7) - 0.1, cz(3) + 0.1, 0.14], [cx(6) - 0.2, cz(5) - 0.1, 0.17]]) { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(sr, 0), M(0x9b978c, { flatShading: true })); st.position.set(sx, sr * 0.6, sz); st.scale.y = 0.7; st.castShadow = true; out.add(st); }

  // ---- 家具(元の家 / 環の並べで有る物だけ)
  const has = (nm, l) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (names[idx3(l, y, x)] === nm) return [x, y]; return null; };
  // ストーブ: 格子(ストーブの前)の南の縁に据える。猫は北(扉の側)に立つ
  const stv = has("ストーブの前", FLOOR);
  if (stv) {
    const sx = cx(stv[0]), sz = cz(stv[1]) + 0.52;
    const plate = box(0.58, 0.03, 0.58, M(0x4a4a50), 0.3); plate.position.set(sx, 0.015, sz); root.add(plate);
    const body = cyl(0.22, 0.24, 0.55, M(0x2c2c30), 16, 0.4); body.position.set(sx, 0.305, sz); root.add(body);
    const lid = cyl(0.25, 0.25, 0.04, M(0x1e1e22), 16, 0.3); lid.position.set(sx, 0.60, sz); root.add(lid);
    const pipe = cyl(0.035, 0.035, 1.05, M(0x34343a), 10, 0.3); pipe.position.set(sx, 1.145, sz); root.add(pipe);
    const door = box(0.14, 0.14, 0.02, new THREE.MeshStandardMaterial({ color: 0x331a0c, emissive: 0xff6a1a, emissiveIntensity: 0, roughness: 0.6 }), 0.3); door.position.set(sx, 0.31, sz - 0.24); root.add(door); dyn.stoveDoor = door;
    const L = new THREE.PointLight(0xff8a3a, 0, 4.2, 1.8); L.position.set(sx, 0.7, sz - 0.5); root.add(L); dyn.stoveLight = L;
    const mat_ = box(1.0, 0.012, 0.8, M(0x7a5a3c), 0.15); mat_.position.set(cx(stv[0]), 0.006, cz(stv[1]) - 0.05); root.add(mat_);
    obst.push({ x: sx, z: sz, hx: 0.27, hz: 0.27 });
    note("ストーブ", sx, 1.0, sz, 20, -30);
  }
  // 座布団(床に置く。猫は上に乗る)
  const zab = has("帳場の座布団", FLOOR);
  if (zab) {
    const z = box(0.62, 0.1, 0.62, MT("cloth"), 0.35); z.position.set(cx(zab[0]), 0.05, cz(zab[1])); root.add(z);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const tt = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M(0xe2c36a)); tt.scale.y = 0.8; tt.position.set(cx(zab[0]) + a * 0.31, 0.045, cz(zab[1]) + b * 0.31); root.add(tt); }
    cushion = { x: cx(zab[0]), z: cz(zab[1]), h: 0.1, half: 0.31 };
    note("座布団", cx(zab[0]), 0.35, cz(zab[1]), -26, -22);
  }
  // 皿(ごはん皿)と水の皿
  const bw = env.BOWL; {
    const dish = cyl(0.19, 0.15, 0.06, M(0xe6dfd0), 20, 0.3); dish.position.set(cx(bw[0]) + 0.12, 0.03, cz(bw[1])); root.add(dish);
    const food = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), M(0x8a5a33, { flatShading: true })); food.scale.y = 0.45; food.position.set(cx(bw[0]) + 0.12, 0.07, cz(bw[1])); root.add(food); dyn.food = food;
    obst.push({ x: cx(bw[0]) + 0.12, z: cz(bw[1]), hx: 0.2, hz: 0.2 });
    note("お皿", cx(bw[0]) + 0.12, 0.2, cz(bw[1]), -28, -20);
  }
  const wt_ = C.WATER; { const dish = cyl(0.17, 0.13, 0.06, M(0xd9e6ea), 20, 0.3); dish.position.set(cx(wt_[0]) + 0.12, 0.03, cz(wt_[1])); root.add(dish); const wtr = cyl(0.15, 0.15, 0.01, new THREE.MeshStandardMaterial({ color: 0x6aaed8, roughness: 0.1, transparent: true, opacity: 0.8 }), 20, 0); wtr.position.set(cx(wt_[0]) + 0.12, 0.055, cz(wt_[1])); root.add(wtr); obst.push({ x: cx(wt_[0]) + 0.12, z: cz(wt_[1]), hx: 0.18, hz: 0.18 }); }
  // 台所の流し台(西の壁ぎわ)
  { const cab = box(0.5, 0.82, CELL * 2.2, M(0xc9b89a), 0.3); cab.position.set(X0 + 0.5, 0.41, cz(3.2) - CELL * 0.4 - 0.7); root.add(cab); obst.push({ x: X0 + 0.5, z: cz(3.2) - CELL * 0.4 - 0.7, hx: 0.25, hz: CELL * 1.1 }); const top = box(0.54, 0.05, CELL * 2.2 + 0.04, M(0xe0e0dc), 0.3); top.position.set(X0 + 0.5, 0.84, cz(3.2) - CELL * 0.4 - 0.7); root.add(top); }
  // 猫鍋(中の層 (0,2)): 本物の土鍋。胴に丸みがあり、ふちが少し外へ反り、両側に小さな取っ手。中は空(敷物なし)。蓋は鍋の横の床
  const potC = has("鍋", INSIDE);
  if (potC) {
    const g = new THREE.Group(); g.position.set(cx(potC[0]) + 0.1, lvl(potC[0], potC[1]), cz(potC[1]));
    const PS = 1.4; g.scale.setScalar(PS);              // 猫の縮尺(×1.3)より少し大きめ: 外径 約 0.49 m・高さ 約 0.17 m・内径 約 0.43 m
    const glaze = new THREE.MeshStandardMaterial({ color: 0x9fae9a, roughness: 0.38, metalness: 0.02, side: THREE.DoubleSide });      // 灰緑の釉薬(萬古焼の花三島の鍋)
    const earth = new THREE.MeshStandardMaterial({ color: 0xa65f3c, roughness: 0.85, side: THREE.DoubleSide });                       // 底の外側だけ素焼きの赤茶
    const lathe = (pts, m) => { const me = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 28), m); me.castShadow = true; me.receiveShadow = true; return me; };
    // 本物の家庭の土鍋(9〜10 号): 外径 約 0.35 m・高さ 0.12 m・内径 約 0.31 m。外(底 → 腹 → ふち)
    g.add(lathe([[0.1, 0.02], [0.14, 0.04], [0.166, 0.07], [0.162, 0.1], [0.171, 0.117], [0.174, 0.121]], glaze));
    g.add(lathe([[0.001, 0.0], [0.082, 0.0], [0.1, 0.01], [0.105, 0.02]], earth));
    {   // 内側: 壁は底へ向かって暗くなる陰(頂点の色)。底は平らな別の円盤
      const wallPts = [[0.174, 0.121], [0.165, 0.123], [0.152, 0.1], [0.158, 0.06], [0.14, 0.035], [0.1, 0.02]];
      const gi = new THREE.LatheGeometry(wallPts.map(([r, y]) => new THREE.Vector2(r, y)), 28); const pp = gi.attributes.position, cc = [];
      const lite = new THREE.Color(0xe4dcc6), dark = new THREE.Color(0x4b443a), tmp = new THREE.Color();
      for (let q = 0; q < pp.count; q++) { const u = Math.min(1, Math.max(0, (pp.getY(q) - 0.02) / 0.1)); tmp.copy(dark).lerp(lite, u * u); cc.push(tmp.r, tmp.g, tmp.b); }
      gi.setAttribute("color", new THREE.Float32BufferAttribute(cc, 3));
      const iw = new THREE.Mesh(gi, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide })); iw.receiveShadow = true; g.add(iw);
      const fl0 = new THREE.Mesh(new THREE.CircleGeometry(0.102, 28), new THREE.MeshStandardMaterial({ color: 0x4b443a, roughness: 1 })); fl0.rotation.x = -Math.PI / 2; fl0.position.y = 0.021; fl0.receiveShadow = true; g.add(fl0);
    }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.006, 8, 32), new THREE.MeshStandardMaterial({ color: 0xdcd2b8, roughness: 0.4 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.12; g.add(rim);
    for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.008, 8, 14, Math.PI), glaze); h.position.set(sx * 0.168, 0.088, 0); h.rotation.set(0, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2); h.castShadow = true; g.add(h); }   // 小さな取っ手
    // 白い花の印花(一つの InstancedMesh)
    const flowerTex = canvasTex(64, 64, (c, w, h) => { c.fillStyle = "#fbf8ee"; for (let q = 0; q < 5; q++) { const a = q * Math.PI * 2 / 5 - Math.PI / 2; c.beginPath(); c.ellipse(w / 2 + Math.cos(a) * 15, h / 2 + Math.sin(a) * 15, 11, 8, a, 0, Math.PI * 2); c.fill(); } c.fillStyle = "#d6c27a"; c.beginPath(); c.arc(w / 2, h / 2, 6, 0, Math.PI * 2); c.fill(); });
    const spots = [[0.06, 0.1655, 8, 0], [0.095, 0.16, 8, 0.39]]; const fl = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.036, 0.036), new THREE.MeshStandardMaterial({ map: flowerTex, transparent: true, alphaTest: 0.4, roughness: 0.5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 16);
    { let n = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (const [yy, rr, cnt, off] of spots) for (let k2 = 0; k2 < cnt; k2++) { const ph = off + k2 * Math.PI * 2 / cnt; e.set(-0.05, ph, 0, "YXZ"); q.setFromEuler(e); m4.compose(new THREE.Vector3(Math.sin(ph) * (rr + 0.003), yy, Math.cos(ph) * (rr + 0.003)), q, new THREE.Vector3(1, 1, 1)); fl.setMatrixAt(n++, m4); } }
    g.add(fl);
    const occ = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), M(0x8d8d8d)); occ.visible = false; g.add(occ);
    // 蓋: 鍋と同じ口径で、上が丸く盛り上がる(高さ 約 7 cm)。鍋の横の床に、つまみを上にして置く
    const lid = new THREE.Group(); lid.position.set(0.12, 0, 0.42);
    lid.add(lathe([[0.001, 0.07], [0.04, 0.068], [0.09, 0.056], [0.14, 0.034], [0.172, 0.006], [0.174, 0.0]], glaze));
    lid.add(lathe([[0.174, 0.0], [0.17, 0.0], [0.14, 0.03], [0.09, 0.052], [0.04, 0.064], [0.001, 0.066]], new THREE.MeshStandardMaterial({ color: 0xece4cf, roughness: 0.4, side: THREE.DoubleSide })));
    const kn = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), new THREE.MeshStandardMaterial({ color: 0xece4cf, roughness: 0.4 })); kn.position.y = 0.082; kn.scale.y = 0.8; lid.add(kn);
    const lf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.03, 0.03), fl.material, 5); { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)); for (let k2 = 0; k2 < 5; k2++) { const a = k2 * Math.PI * 2 / 5; m4.compose(new THREE.Vector3(Math.cos(a) * 0.075, 0.062, Math.sin(a) * 0.075), q, new THREE.Vector3(1, 1, 1)); lf.setMatrixAt(k2, m4); } } lid.add(lf);
    lid.rotation.y = 0.4; g.add(lid);
    root.add(g); dyn.pot = g; dyn.potOcc = occ; occ.visible = false;
    // 鍋の内壁(底からの高さ yr → 半径)。猫を鍋の中に収める計算(fitInPot)が使う
    const WALL = [[0.02, 0.1], [0.035, 0.14], [0.06, 0.158], [0.1, 0.152], [0.123, 0.165]];
    dyn.potGeom = { cell: potC, x: g.position.x, z: g.position.z, baseY: g.position.y, rimY: 0.12 * PS, inner(yr0) { const yr = yr0 / PS; for (let i = 1; i < WALL.length; i++) if (yr <= WALL[i][0]) { const t = (yr - WALL[i - 1][0]) / (WALL[i][0] - WALL[i - 1][0]); return PS * (WALL[i - 1][1] + t * (WALL[i][1] - WALL[i - 1][1])); } return PS * 0.165; } };
    obst.push({ x: cx(potC[0]) + 0.1, z: cz(potC[1]), hx: 0.27, hz: 0.27, get: () => dyn.pot.visible });
    obst.push({ x: cx(potC[0]) + 0.1 + 0.17, z: cz(potC[1]) + 0.59, hx: 0.27, hz: 0.27, get: () => dyn.pot.visible });
    note("猫鍋(土鍋)", cx(potC[0]) + 0.1, 0.5, cz(potC[1]), -10, -26);
  }
  // 紙袋(中の層 (4,3)): 横に倒した紙袋(口が南向き)
  const bagC = has("紙袋", INSIDE);
  if (bagC) {
    const g = new THREE.Group(); g.position.set(cx(bagC[0]), 0, cz(bagC[1]));
    const back = box(0.55, 0.5, 0.04, M(0xb98f5c), 0.35); back.position.set(0, 0.26, -0.3); g.add(back);
    const l = box(0.04, 0.5, 0.6, M(0xc19a68), 0.35); l.position.set(-0.28, 0.26, 0); g.add(l); const r_ = box(0.04, 0.5, 0.6, M(0xc19a68), 0.35); r_.position.set(0.28, 0.26, 0); g.add(r_);
    const top = box(0.56, 0.04, 0.6, M(0xc9a572), 0.35); top.position.set(0, 0.5, 0); g.add(top);
    const bot = box(0.56, 0.02, 0.6, M(0xa8814f), 0); bot.position.set(0, 0.01, 0); g.add(bot);
    root.add(g); obst.push({ x: cx(bagC[0]), z: cz(bagC[1]), hx: 0.3, hz: 0.3 }); note("紙袋", cx(bagC[0]), 0.65, cz(bagC[1]), 10, -24);
  }
  // 段ボール(候補マスのどれか)・新しい箱・洗濯かご(動く)
  const mkBox = (w, h, d) => { const g = new THREE.Group(); const bt = box(w, 0.02, d, M(0xb88b56), 0); bt.position.y = 0.01; g.add(bt); for (const [a, b, ww, dd] of [[0, -d / 2, w, 0.03], [0, d / 2, w, 0.03], [-w / 2, 0, 0.03, d], [w / 2, 0, 0.03, d]]) { const s = box(ww, h, dd, M(0xc99c63), 0.35); s.position.set(a, h / 2, b); g.add(s); } return g; };
  dyn.box = mkBox(0.8, 0.45, 0.8); dyn.box.visible = false; root.add(dyn.box);
  dyn.newbox = mkBox(0.95, 0.55, 0.95); dyn.newbox.position.set(cx(C.NEWBOX_XY[0]), lvl(C.NEWBOX_XY[0], C.NEWBOX_XY[1]), cz(C.NEWBOX_XY[1])); dyn.newbox.visible = false; root.add(dyn.newbox);
  obst.push({ x: 0, z: 0, hx: 0.5, hz: 0.5, get: () => dyn.box.visible && dyn.box });
  obst.push({ x: cx(C.NEWBOX_XY[0]), z: cz(C.NEWBOX_XY[1]), hx: 0.5, hz: 0.5, get: () => dyn.newbox.visible });
  {   // 洗濯かご: 編み目の見える四角い籠。ふちに布が掛かっている
    const g = new THREE.Group(); const wv = MT("weave", { side: THREE.DoubleSide }); const W_ = 0.74, D_ = 0.54, H_ = 0.4, T_ = 0.03;
    const bt = box(W_, T_, D_, MT("weave"), 0.3); bt.position.y = T_ / 2; g.add(bt);
    for (const [px, pz, sw, sd] of [[0, -D_ / 2, W_, T_], [0, D_ / 2, W_, T_], [-W_ / 2, 0, T_, D_], [W_ / 2, 0, T_, D_]]) { const w = box(sw, H_, sd, wv, 0.35); w.position.set(px, H_ / 2, pz); g.add(w); }
    for (const [px, pz, sw, sd] of [[0, -D_ / 2, W_ + 0.04, 0.05], [0, D_ / 2, W_ + 0.04, 0.05], [-W_ / 2, 0, 0.05, D_ + 0.04], [W_ / 2, 0, 0.05, D_ + 0.04]]) { const rm = box(sw, 0.04, sd, M(0x8a6638), 0.3); rm.position.set(px, H_ + 0.02, pz); g.add(rm); }
    for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 12, Math.PI), M(0x8a6638)); h.position.set(sx * (W_ / 2 + 0.01), H_ - 0.08, 0); h.rotation.y = Math.PI / 2; g.add(h); }
    const ck = MT("check", { side: THREE.DoubleSide });                                                          // 手前のふちに掛けた布
    const c1 = box(0.5, 0.02, 0.26, ck, 0); c1.position.set(-0.08, H_ + 0.045, D_ / 2 - 0.06); c1.rotation.x = 0.06; g.add(c1);
    const c2 = box(0.5, 0.26, 0.02, ck, 0); c2.position.set(-0.08, H_ - 0.09, D_ / 2 + 0.05); c2.rotation.x = -0.05; g.add(c2);
    g.visible = false; root.add(g); dyn.basket = g;
    obst.push({ x: 0, z: 0, hx: W_ / 2 + 0.03, hz: D_ / 2 + 0.03, get: () => dyn.basket.visible && dyn.basket });
  }
  // 車(動く。ボンネットが猫の席 0.9 m)
  {
    const g = new THREE.Group(); const px = cx(C.PARK[0]), pz = cz(C.PARK[1]);
    const body = box(1.45, 0.55, 3.2, M(0x4a78b5), 0.35); body.position.set(0, 0.62, 0); g.add(body);
    const cab = box(1.35, 0.5, 1.5, M(0x6a98d5), 0.35); cab.position.set(0, 1.15, 0.35); g.add(cab);
    const win = box(1.37, 0.34, 1.3, new THREE.MeshStandardMaterial({ color: 0x9ad0e8, roughness: 0.1, transparent: true, opacity: 0.55 }), 0.2); win.position.set(0, 1.18, 0.35); g.add(win);
    for (const [wx, wz] of [[-0.72, -1.0], [0.72, -1.0], [-0.72, 1.0], [0.72, 1.0]]) { const w = cyl(0.28, 0.28, 0.2, M(0x232323), 16, 0.3); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.28, wz); g.add(w); }
    g.position.set(px, 0, pz - 0.2); g.visible = false; out.add(g); dyn.car = g;
    note("車(ボンネット)", px, 1.05 - DROP, pz - 1.0, 28, -20);
  }
  // 紐のおもちゃ(居間の畳 (2,4))
  if (env.X11_TOY) {
    const tx = cx(C.TOY_XY[0]), tz = cz(C.TOY_XY[1]);
    const pole = cyl(0.015, 0.015, 1.1, M(0x8a7050), 8, 0.2); pole.position.set(tx - 0.3, 0.55, tz - 0.25); root.add(pole);
    const sw = new THREE.Group(); sw.position.set(tx - 0.3, 1.1, tz - 0.25);
    const str = cyl(0.004, 0.004, 0.7, M(0xe8e0d0), 4, 0); str.position.y = -0.35; sw.add(str);
    const fe = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), M(0xd8527f)); fe.scale.set(1, 1.8, 0.5); fe.position.y = -0.72; sw.add(fe);
    root.add(sw); dyn.toy = sw;
    note("紐のおもちゃ", tx, 0.4, tz, -28, -10);
  }
  // 窓の外の鳥
  { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M(0x8a6a48)); b.scale.set(1, 0.85, 1.3); g.add(b); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), M(0x7a5a3a)); hd.position.set(0, 0.05, 0.08); g.add(hd); const bk = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.04, 6), M(0xe0b04a)); bk.rotation.x = Math.PI / 2; bk.position.set(0, 0.05, 0.13); g.add(bk); const tail = box(0.04, 0.01, 0.12, M(0x6a4a2a), 0); tail.position.set(0, 0.0, -0.15); g.add(tail); g.position.set(cx(4), 1.62, Z1 + 0.42); g.visible = false; root.add(g); dyn.bird = g; const br = box(0.9, 0.04, 0.04, M(0x6b4a30), 0.2); br.position.set(cx(4), 1.55, Z1 + 0.42); root.add(br); }
  // 行灯(夜の灯り)。西の壁ぎわの小さな床置き
  { const g = new THREE.Group(); g.position.set(X0 + 0.55, 0, cz(0.2) + 0.5); const fr = box(0.28, 0.5, 0.28, M(0x5a4030), 0.3); fr.position.y = 0.3; g.add(fr); const paper = box(0.24, 0.42, 0.24, new THREE.MeshStandardMaterial({ color: 0xf6e7b8, emissive: 0xffc260, emissiveIntensity: 0, roughness: 1 }), 0.3); paper.position.y = 0.31; g.add(paper); root.add(g); dyn.andon = paper; const L = new THREE.PointLight(0xffc27a, 0, 6.5, 1.5); L.position.set(g.position.x, 0.8, g.position.z); root.add(L); dyn.andonLight = L; note("行灯", g.position.x, 0.75, g.position.z, 14, -22); }
  // ストーブの前のうす畳 / 縁側のしるし(注記)
  note("縁側", cx(5), 0.12, cz(1.0), 10, -20);
  { const tat = (() => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (names[idx3(FLOOR, y, x)] === "畳") return [x, y]; return null; })();      // 本当に畳の格子の上に
    if (tat) note("畳", cx(tat[0]), 0.02, cz(tat[1]), -4, -14); }
  { const itn = (() => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (names[idx3(FLOOR, y, x)] === "板の間") return [x, y]; return null; })();
    if (itn) note("板の間", cx(itn[0]) + 0.3, 0.02, cz(itn[1]) + 0.2, 0, -14); }

  // ---- 環の並べ(x06c の世界): 寝床 16 か所・トイレの砂・南窓の日だまり
  const desMeshes = [];
  for (const d of env.S.design) {
    const hgt = d.spec[3] * HUNIT + (d.layer === FLOOR ? lvl(d.x, d.y) : 0); const gx = cx(d.x), gz = cz(d.y);
    const warmCol = d.nm.indexOf("ヒーター") >= 0 ? 0xe0a070 : (d.heat ? 0xc9b79c : 0xbfb7a0);
    const g = new THREE.Group(); g.position.set(gx, hgt, gz);
    const slab = box(0.9, 0.06, 0.9, M(warmCol), 0.4); slab.position.y = 0.03; g.add(slab);
    if (d.ee === 1) { const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 20), M(warmCol)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.1; g.add(rim); }
    if (d.ee === 2) { const wall = box(0.9, 0.4, 0.9, new THREE.MeshStandardMaterial({ color: 0xcbb68a, transparent: true, opacity: 0.45, roughness: 1 }), 0.45); wall.position.y = 0.22; g.add(wall); }
    if (d.layer === TOP && hgt > 0.2) { const leg = box(0.1, hgt, 0.1, M(0x6b5a45), 0.3); leg.position.set(0, -hgt / 2, 0); g.add(leg); }
    root.add(g); desMeshes.push(g);
    bumps[d.layer + ":" + d.x + ":" + d.y] = (bumps[d.layer + ":" + d.x + ":" + d.y] || 0) + 0.06;
    note(d.nm.replace("・", ""), gx, hgt + 0.55, gz, 0, -14);
  }
  if (env.LITTER) {
    const [lx, ly] = env.LITTER;
    const ly0 = lvl(lx, ly);
    const tray = box(0.8, 0.14, 0.6, M(0x5a7a8a), 0.4); tray.position.set(cx(lx), ly0 + 0.07, cz(ly)); root.add(tray);
    const sd = box(0.72, 0.02, 0.52, MT("sand"), 0); sd.position.set(cx(lx), ly0 + 0.14, cz(ly)); root.add(sd);
    bumps[FLOOR + ":" + lx + ":" + ly] = (bumps[FLOOR + ":" + lx + ":" + ly] || 0) + 0.14;
    note("トイレの砂", cx(lx), 0.4, cz(ly), 24, -22);
  }
  if (env.SUN_XS.length) { const p = box(CELL * 0.98, 0.02, CELL * 0.98, new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.45, depthWrite: false }), 0); p.visible = false; root.add(p); dyn.sunPatch = p; }

  // ---- 匂い(薄い紫の面)とうんち(塊)
  const scentM = [], poop = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const hh = lvl(x, y);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 0.96, CELL * 0.96), new THREE.MeshBasicMaterial({ color: 0x8e5fc9, transparent: true, opacity: 0, depthWrite: false }));
    s.rotation.x = -Math.PI / 2; s.position.set(cx(x), hh + 0.012, cz(y)); root.add(s); scentM.push(s);
    const g = new THREE.Group(); g.position.set(cx(x) + 0.18, hh, cz(y) - 0.12);
    for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), M(0x5a3a1e, { roughness: 0.6 })); b.position.set(Math.cos(k * 2.1) * 0.35, 0.3 + k * 0.4, Math.sin(k * 2.1) * 0.35); b.scale.setScalar(1 - k * 0.2); b.castShadow = true; g.add(b); }
    g.visible = false; root.add(g); poop.push(g);
    obst.push({ x: cx(x) + 0.18, z: cz(y) - 0.12, hx: 0.14, hz: 0.14, get: () => g.visible, isPoop: true });          // うんちの塊も、猫が乗らない物の箱(猫は 0.4 m 以上離れる)
  }
  dyn.scentM = scentM; dyn.poop = poop; dyn.tiles = tiles;

  // 近づいてくる相手の目印(足元の輪)・同居の猫・人
  dyn.apRing = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 28), new THREE.MeshBasicMaterial({ color: 0xc23b2b, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })); dyn.apRing.rotation.x = -Math.PI / 2; dyn.apRing.visible = false; root.add(dyn.apRing);
  dyn.human = new THREE.Group(); { const b = cyl(0.2, 0.26, 0.8, M(0x4a6fa5), 14, 0.3); b.position.y = 0.55; dyn.human.add(b); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), M(0xf0c9a0)); hd.position.y = 1.1; dyn.human.add(hd); const hr = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0x2a211c)); hr.position.y = 1.12; dyn.human.add(hr); const lg = box(0.28, 0.3, 0.16, M(0x3a3a46), 0.3); lg.position.y = 0.15; dyn.human.add(lg); dyn.human.visible = false; root.add(dyn.human); }

  // ---- 光
  const hemi = new THREE.HemisphereLight(0xdfe9ff, 0x7a6a50, 0.7); root.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.4); sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536); const sc = sun.shadow.camera; sc.left = -8; sc.right = 8; sc.top = 6; sc.bottom = -6; sc.near = 1; sc.far = 40; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 4;
  root.add(sun); root.add(sun.target); sun.target.position.set(cx(4.5), 0, cz(2.5));
  dyn.sun = sun; dyn.hemi = hemi;

  const center = new THREE.Vector3(cx(4.5), 0.3, cz(2.5));
  // 格子の「物の面」の位置(猫の足の置き場の素)。乗る面の高さと、そのまま置く水平の位置。
  function cellPos(layer, x, y) {
    const hFloor = lvl(x, y);
    let px = cx(x), pz = cz(y), py = hFloor;
    if (layer === TOP) {
      const nm = names[idx3(TOP, y, x)];
      py = (isInd(x, y) ? 0 : -DROP) + P.h[idx3(TOP, y, x)] * HUNIT;
      if (nm === "高い窓辺") { pz = Z1 - 0.2 - 0.3; py = 1.54; }                              // 出窓の板の上面
      else if (nm === "本棚の上") { pz = cz(0) - 0.12; py = 1.84; }                           // いちばん上の板の上面
      else if (nm === "塀の上") { px = cx(7) + FENCE_DX; py = 1.88 - DROP; }                  // 塀の笠木の上面
      else if (nm === "ボンネット") { pz = cz(y) - 1.0; py = 0.9 - DROP; }                    // 車の屋根でなく前の面
    } else if (layer === INSIDE) {
      const nm = names[idx3(INSIDE, y, x)];
      if (nm === "鍋") { px += 0.1; py += 0.03; }
      else if (nm === "縁側の下") { py = -0.18; }
      else if (nm === "車の下") { py = -DROP; }
      else if (nm === "洗濯かご") py += 0.05;
      else py += 0.0;
    }
    return { x: px, y: py, z: pz };
  }
  // ---- 猫の置き場所と経路(見た目だけ。物理の格子はそのまま)
  const CAT_R = 0.27;
  function boxes() {
    const L = [];
    for (const o of obst) {
      let x = o.x, z = o.z;
      if (o.get) { const v = o.get(); if (!v) continue; if (v.position) { x = v.position.x; z = v.position.z; } }
      L.push({ x, z, hx: o.hx, hz: o.hz, poop: !!o.isPoop });
    }
    return L;
  }
  // 点を、物の箱(+猫の半径)の外の、いちばん近い所へ押し出す(箱がいくつか重なる格子でも空いた所を探す)
  const freeAt = (L, px, pz, r) => { for (const b of L) if (Math.abs(px - b.x) < b.hx + r - 1e-3 && Math.abs(pz - b.z) < b.hz + r - 1e-3) return false; return true; };
  function pushOutFree(px, pz, r) { return freeAt(boxes(), px, pz, r == null ? CAT_R : r); }
  function pushOut(px, pz, r) {
    r = r == null ? CAT_R : r; const L = boxes();
    if (freeAt(L, px, pz, r)) return [px, pz];
    let best = null;
    const tryC = (x, z) => { if (!freeAt(L, x, z, r)) return; const d = Math.hypot(x - px, z - pz); if (!best || d < best.d) best = { d, x, z }; };
    for (const b of L) { const ex = b.hx + r, ez = b.hz + r; tryC(b.x + ex, pz); tryC(b.x - ex, pz); tryC(px, b.z + ez); tryC(px, b.z - ez); }
    if (best) return [best.x, best.z];
    for (let rho = 0.05; rho <= 1.6; rho += 0.05) for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12; tryC(px + rho * Math.cos(a), pz + rho * Math.sin(a)); if (best) return [best.x, best.z]; }
    return [px, pz];
  }
  // (wx,wz) から r m 以内の、動く物(うんち・段ボール・籠・鍋…)の「位置の署名」(同じ数でも位置が変われば別の署名)。置き場所を決め直す目印
  function boxSig(wx, wz, r) {
    const a = [];
    for (const o of obst) { if (!o.get) continue; const v = o.get(); if (!v) continue; const x = v.position ? v.position.x : o.x, z = v.position ? v.position.z : o.z; if (Math.hypot(x - wx, z - wz) < r) a.push(Math.round(x * 20) + ":" + Math.round(z * 20)); }
    return a.sort().join("|");
  }
  function cushionLift(wx, wz) { if (!cushion) return 0; const d = Math.max(Math.abs(wx - cushion.x), Math.abs(wz - cushion.z)); return cushion.h * Math.min(1, Math.max(0, (cushion.half + 0.2 - d) / 0.4)); }
  // 猫がその格子で立つ(座る・寝る)位置: 乗れる物の面の上に、乗らない物の箱の外に
  function standPos(layer, x, y) {
    const p = cellPos(layer, x, y);
    if (layer === FLOOR) { const q = pushOut(p.x, p.z); p.x = q[0]; p.z = q[1]; }
    p.y += bumps[layer + ":" + x + ":" + y] || 0;
    if (layer === FLOOR) p.y += cushionLift(p.x, p.z);
    return p;
  }
  // 線分 a→b が箱(+半径)の内側を通るか
  function hits(ax, az, bx, bz, b, r) {
    const x0 = b.x - b.hx - r + 1e-3, x1 = b.x + b.hx + r - 1e-3, z0 = b.z - b.hz - r + 1e-3, z1 = b.z + b.hz + r - 1e-3;
    let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
    for (const [p, q, lo, hi] of [[-dx, ax - x0, 0, 0], [dx, x1 - ax, 0, 0], [-dz, az - z0, 0, 0], [dz, z1 - az, 0, 0]]) {
      if (Math.abs(p) < 1e-9) { if (q < 0) return false; } else { const t = q / p; if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } }
    }
    return t0 < t1;
  }
  // 床の上を a から b へ歩く経路。箱の角(猫の半径ぶん外側)を節にした最短経路。点の列 [{x,z}, ...](a は含めない)
  function route(ax, az, bx, bz) {
    const r = CAT_R, L = boxes(); const clear = (x0, z0, x1, z1) => { for (const b of L) if (hits(x0, z0, x1, z1, b, r)) return false; return true; };
    if (clear(ax, az, bx, bz)) return [{ x: bx, z: bz }];
    if (!freeAt(L, ax, az, r * 0.99)) { const w = pushOut(ax, az, r * 1.02); if (Math.hypot(w[0] - ax, w[1] - az) > 0.005) return [{ x: w[0], z: w[1] }].concat(route(w[0], w[1], bx, bz)); }
    const N = [{ x: ax, z: az }, { x: bx, z: bz }];
    for (const b of L) { const ex = b.hx + r + 0.03, ez = b.hz + r + 0.03; for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = b.x + sx * ex, z = b.z + sz * ez; if (freeAt(L, x, z, r * 0.97)) N.push({ x, z }); } }
    const n = N.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false); dist[0] = 0;
    for (let it = 0; it < n; it++) {
      let u = -1; for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || dist[u] === Infinity) break; done[u] = true; if (u === 1) break;
      for (let v = 0; v < n; v++) { if (done[v]) continue; const d = Math.hypot(N[u].x - N[v].x, N[u].z - N[v].z); if (dist[u] + d < dist[v] && clear(N[u].x, N[u].z, N[v].x, N[v].z)) { dist[v] = dist[u] + d; prev[v] = u; } }
    }
    if (prev[1] < 0) return [{ x: bx, z: bz }];                         // 通れる道が無ければ、まっすぐ(見た目だけなので)
    const out = []; for (let v = 1; v > 0; v = prev[v]) out.push({ x: N[v].x, z: N[v].z });
    return out.reverse();
  }

  // 時刻の光(猫の世界の時刻 h、晴れ clear)
  function setLight(h, clear, stoveOn, season) {
    const tNorm = (h - 6) / 12;                                // 6 時 → 0、18 時 → 1
    const up = Math.max(0, Math.sin(Math.PI * tNorm));
    const azim = Math.PI * (0.15 + 0.7 * Math.min(1, Math.max(0, tNorm)));
    const sunDir = new THREE.Vector3(Math.cos(azim) * -1, 0.35 + 0.9 * up, 0.7).normalize();
    dyn.sun.position.copy(center).addScaledVector(sunDir, 22);
    // 色: 朝夕は橙、昼は白、夜は青い月の光
    const warm = new THREE.Color(0xffb27a), noon = new THREE.Color(0xfff3dc), moon = new THREE.Color(0x8fa8d8);
    let col, inten;
    if (h >= 5.2 && h <= 18.8) { const edge = 1 - Math.min(1, up * 1.6); col = noon.clone().lerp(warm, edge); inten = (clear ? 1.55 : 0.5) * (0.25 + 0.75 * Math.min(1, up * 1.8)); }
    else { col = moon; inten = 0.7; }
    dyn.sun.color.copy(col); dyn.sun.intensity = inten;
    const day = Math.min(1, Math.max(0, (up - 0.05) * 3));
    const skyC = new THREE.Color(0x5b78b4).lerp(new THREE.Color(clear ? 0xdfe9ff : 0xcfd6de), day);
    dyn.hemi.color.copy(skyC); dyn.hemi.intensity = 0.78 - 0.28 * day;
    const dusk = (h >= 16.5 && h <= 19.5) ? 1 - Math.abs(h - 18) / 1.5 : (h >= 5 && h <= 7 ? 1 - Math.abs(h - 6) / 1 : 0);
    if (dusk > 0) dyn.hemi.color.lerp(new THREE.Color(0xffc9a0), Math.max(0, dusk) * 0.5);
    const night = 1 - day;
    if (dyn.andon) { dyn.andon.material.emissiveIntensity = 0.2 + 1.0 * night; dyn.andonLight.intensity = 0.2 + 8 * night; }
    if (dyn.stoveDoor) { dyn.stoveDoor.material.emissiveIntensity = stoveOn ? 2.2 : 0; dyn.stoveLight.intensity = stoveOn ? 1.6 + 5 * night : 0; }
    if (dyn.glass) dyn.glass.material.opacity = 0.2 + 0.25 * night;
    return { day, up };
  }

  // ---- 仕上げ(軽くする): 動かない物の縁取り線を 1 本にまとめ、小物は影を落とさない
  (function finish() {
    root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const keep = new Set(); const mark = (o) => { if (o && o.isObject3D) keep.add(o); };
    for (const k in dyn) { if (Array.isArray(dyn[k])) dyn[k].forEach(mark); else mark(dyn[k]); }
    const inDyn = (o) => { for (let p = o.parent; p; p = p.parent) if (keep.has(p)) return true; return false; };
    const buckets = new Map(), drop = [];
    root.traverse((o) => { if (o.isLineSegments && o.userData.ink && !inDyn(o)) { drop.push(o); const op = o.material.opacity; const arr = buckets.get(op) || []; buckets.set(op, arr);
      const pos = o.geometry.attributes.position; const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld); const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m); arr.push(v.x, v.y, v.z); } } });
    for (const o of drop) { o.parent.remove(o); o.geometry.dispose(); }
    for (const [op, arr] of buckets) { const gm = new THREE.BufferGeometry(); gm.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3)); root.add(new THREE.LineSegments(gm, new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: op }))); }
    root.traverse((o) => { if (o.isMesh && o.castShadow && !(o.geometry.boundingSphere || o.geometry.computeBoundingSphere() || o.geometry.boundingSphere) ) return; });
    const bb = new THREE.Box3(), sz = new THREE.Vector3();
    root.traverse((o) => { if (o.isMesh && o.castShadow && !inDyn(o) && !o.isInstancedMesh) { bb.setFromObject(o); bb.getSize(sz); if (Math.max(sz.x, sz.y, sz.z) < 0.22) o.castShadow = false; } });
  })();

  return { root, dyn, anchors, tiles, cellPos, standPos, pushOut, pushOutFree, climb, cushionLift, boxSig, route, boxes, setLight, center, dims: { X0, X1, Z0, Z1 }, lvl };
}
