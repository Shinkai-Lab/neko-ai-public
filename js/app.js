// 日々猫になる。ブラウザの中で、学習済みの心(js/mind.js)が世界(js/sim.js)の中で自分で考えて動く。
// 見た目: 箱庭(js/diorama.js)・Argon の猫(neko-argon/、js/catactor.js が動きにつなぐ)・研究日誌の頁(css/diary.css)。
import * as THREE from "three";
import { createDiorama, CELL } from "./diorama.js?v=a9e327c3f5";
import { CatActor } from "./catactor.js?v=a9e327c3f5";
import { Extras } from "./actors.js?v=a9e327c3f5";
import { PetHand } from "./hand.js?v=a9e327c3f5";
import { createNekoMesh } from "../neko-argon/neko-argon.js?v=a9e327c3f5";
import { NAMES, randomName, COATS, TAILS } from "./names.js?v=a9e327c3f5";

const Neko = window.Neko, NekoRng = window.NekoRng;
const C = Neko.consts;
const { W, H, FLOOR, TOP, INSIDE, idx3, SLEEP, EAT, DRINK, ELIM, GROOM, MEOW, PAW, DIG, SIT } = C;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hash32 = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const SEED0 = 1;
// ---- 外から来る値(URL・localStorage・versions.json)を、HTML に入れる前に正規化・エスケープする
const esc = (x) => String(x == null ? "" : x).replace(/[&<>"'`]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" })[ch]);
const BAD_CHARS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/;
function cleanName(x) { if (typeof x !== "string") return ""; const t = x.trim(); if (!t || BAD_CHARS.test(t)) return ""; return Array.from(t).slice(0, 12).join(""); }
function cleanLook(o) {
  o = o && typeof o === "object" ? o : {};
  return { coat: COATS.some((c) => c.id === o.coat) ? o.coat : "cha", tail: TAILS.some((t) => t.id === o.tail) ? o.tail : "long", socks: o.socks === true || o.socks === "1", name: cleanName(o.name) };
}
function uintParam(v, def, max) { if (v == null || !/^\d{1,12}$/.test(String(v))) return def; const n = Number(v); return Number.isSafeInteger(n) && n >= 0 && n <= max ? n : def; }
function el(tag, props, ...kids) { const e = document.createElement(tag); if (props) for (const k in props) { if (k === "text") e.textContent = props[k]; else e.setAttribute(k, props[k]); } for (const c of kids) if (c != null) e.append(c); return e; }
const ACT_JA = ["座る", "北へ歩く", "東へ歩く", "南へ歩く", "西へ歩く", "登る", "降りる", "寝る", "毛づくろい", "食べる", "入る", "出る", "飲む", "出す", "掘って埋める",
  "北へ飛び降りる", "東へ飛び降りる", "南へ飛び降りる", "西へ飛び降りる", "手を出す", "鳴く"];
const DRIVE_JA = { hunger: "胃", fatigue: "疲れ", dirt: "汚れ", temp: "体感の温度", sleepy: "眠気", unsafe: "不安", energy: "体", thirst: "渇き", bladder: "膀胱", bowel: "腸", nose: "鼻", soil: "毛の汚れ", gut: "胃の不快", pain: "痛み" };
const KIND_CAT = { sleep: 1, move: 2, eat: 3, groom: 4, elim: 5, meow: 6, play: 7 };
const BAND_COL = ["#e6dcc2", "#7d93b0", "#9db88e", "#e0a35c", "#e0a0a8", "#7a5a3e", "#c24a3a", "#9a78b8", "#cdbf9c"];
const ONE_SEC = 1000;

// ------------------------------------------------------------ 状態
const S = {
  shareName: false, noteList: [], versions: [], ver: null, env: null, mind: null, actRng: null, seed: SEED0, look: { coat: "cha", tail: "long", socks: false, name: "" },
  mult: 1, paused: false, owed: 0, cfg: {}, minds: {}, cam: "follow", notes: true,
  band: new Uint8Array(720).fill(255), day: { events: [], trace: [] }, clockDay: -1, whyLog: [], prevAct: -1, lastEventTick: {}, lastPlace: "", tallySleep: {}, tallyElim: {}, meowDay: 0, meowTotal: 0, eatBites: 0,
  actor: null, dio: null, tickDur: 120, why: null, lastTickAt: 0, ready: false,
};

// ------------------------------------------------------------ three.js
const stage = $("stage");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));       // 重くしない: 1.5 倍まで
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);
stage.insertBefore(renderer.domElement, stage.firstChild);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 150);
const orbit = { theta: 0.42, phi: 0.78, dist: 3.9, target: new THREE.Vector3(5.6, 0.3, 3.1), wantTarget: new THREE.Vector3(5.6, 0.3, 3.1), wantDist: 3.9, user: 1 };

function placeCamera() {
  orbit.target.lerp(orbit.wantTarget, 0.08);
  orbit.dist += (orbit.wantDist * orbit.user - orbit.dist) * 0.07;
  const { theta, phi, dist, target } = orbit;
  camera.position.set(target.x + dist * Math.sin(phi) * Math.sin(theta), target.y + dist * Math.cos(phi), target.z + dist * Math.sin(phi) * Math.cos(theta));
  camera.lookAt(target);
}
function setCamMode(m) {
  S.cam = m; $("camFollow").classList.toggle("on", m === "follow"); $("camWide").classList.toggle("on", m === "wide"); $("camFollow").setAttribute("aria-pressed", String(m === "follow")); $("camWide").setAttribute("aria-pressed", String(m === "wide"));
  orbit.user = 1; orbit.wantDist = m === "follow" ? 3.9 : 17.5; orbit.phi = m === "follow" ? 0.78 : 0.95; if (m === "wide") orbit.wantTarget.copy(S.dio.center);
}

// ------------------------------------------------------------ 注記(手書き)
let labelEls = [];
function buildLabels() {
  const box = $("labels"); box.innerHTML = ""; labelEls = [];
  for (const a of S.dio.anchors) { const d = document.createElement("div"); d.className = "lb"; d.textContent = a.text; box.appendChild(d); labelEls.push({ el: d, a }); }
  const tag = document.createElement("div"); tag.className = "lb cat-tag"; tag.textContent = S.look.name || "猫"; box.appendChild(tag);
  S.catTag = { el: tag, a: { p: new THREE.Vector3(), dx: 0, dy: -34, text: "" }, cat: true };
  labelEls.push(S.catTag);
}
const _v = new THREE.Vector3();
function updateLabels() {
  const w = stage.clientWidth, h = stage.clientHeight; const show = S.notes;
  const tx = orbit.target.x, tz = orbit.target.z;
  const items = [];
  for (const L of labelEls) {
    if (!show && !L.cat) { L.el.style.opacity = 0; continue; }
    _v.copy(L.a.p).project(camera);
    const d = Math.hypot(L.a.p.x - tx, L.a.p.z - tz);
    const op = _v.z > 1 ? 0 : (L.cat ? 1 : (S.cam === "follow" ? clamp(1.35 - d / 5.2, 0, 0.92) : (L.a.big ? 0.88 : 0)));   // 全景では大きい物だけ
    items.push({ L, x: (_v.x * 0.5 + 0.5) * w + L.a.dx, y: (-_v.y * 0.5 + 0.5) * h + L.a.dy + 26, op, pri: L.cat ? -1 : d });
  }
  items.sort((p, q) => p.pri - q.pri);
  const kept = [];
  for (const it of items) {
    const tw = (it.L.el.textContent.length * 13 + 8) / 2, th = 20;
    let ok = it.op > 0.02;
    if (ok && !it.L.cat) for (const k of kept) if (Math.abs(k.x - it.x) < tw + k.tw && Math.abs(k.y - it.y) < th + 6) { ok = false; break; }
    if (ok) kept.push({ x: it.x, y: it.y, tw });
    it.L.el.style.opacity = ok ? it.op.toFixed(2) : 0;
    it.L.el.style.left = it.x.toFixed(1) + "px"; it.L.el.style.top = it.y.toFixed(1) + "px";
  }
}

// ------------------------------------------------------------ 版の読み込み
const BUILD = (document.querySelector('meta[name="build"]') || {}).content || "dev";
async function getJSON(url) { const r = await fetch(url + "?v=" + encodeURIComponent(BUILD)); if (!r.ok) throw new Error(url + " " + r.status); return r.json(); }
const verOf = (id) => S.versions.find((v) => v.id === id || (v.alias || []).includes(id)) || S.versions[0];

async function startLife(opts) {
  S.ready = false;
  const v = verOf(opts.ver || (S.ver && S.ver.id)); S.ver = v;
  S.seed = opts.seed != null ? opts.seed : S.seed;
  if (opts.look) S.look = cleanLook(Object.assign({}, S.look, opts.look));
  if (!S.cfg[v.world]) S.cfg[v.world] = await getJSON(v.world);
  if (!S.minds[v.mind]) S.minds[v.mind] = await getJSON(v.mind);
  S.env = new Neko.sim.Env(S.cfg[v.world], S.seed, { arm: v.arm, nActs: v.n_acts });
  if (S.env.obs_dim !== v.obs_dim) throw new Error(`観測の長さが合わない: 世界 ${S.env.obs_dim} 心 ${v.obs_dim}`);
  S.mind = new Neko.mind.Mind(S.minds[v.mind], S.env.v3_dim);
  S.actRng = new NekoRng.Generator([S.seed, 0x6d696e64]);
  // 箱庭を作り直す
  if (S.dio) { scene.remove(S.dio.root); S.dio.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  S.dio = createDiorama(S.env); scene.add(S.dio.root);
  const lk = JSON.stringify([S.look.coat, S.look.tail, !!S.look.socks]);
  if (!S.actor) { S.actor = new CatActor(scene, S.dio, S.look); S.lookKey = lk; }
  else { S.actor.dio = S.dio; if (S.lookKey !== lk) { S.actor.setLook(S.look); S.lookKey = lk; } }
  if (S.extras) S.extras.dispose(); S.extras = new Extras(scene, S.dio); if (!S.hand) S.hand = new PetHand(scene);
  buildLabels();
  resetDiary();
  // 共有リンクの時刻まで進める(同じ種・同じ心なら同じ一日)
  S.iv = []; const ivIn = opts.iv || [];
  await fastForward(Math.min(opts.ff || 0, FF_MAX), ivIn); S.iv = ivIn.filter((v) => v[0] <= S.env.t);
  S.actor.snapTo(S.env);
  S.dio.setLight(S.env.hour(), S.env.clear, stoveOn(S.env));
  placeCamera(); orbit.target.copy(orbit.wantTarget);
  renderVersionUI(); refreshStatic();
  S.owed = 0; S.ready = true; $("loading").classList.add("gone"); $("loading").setAttribute("aria-hidden", "true");
  syncUrl();
}
function resetDiary() {
  S.band.fill(255); S.day = { events: [], trace: [] }; S.clockDay = Math.floor((S.env.t0 + S.env.t) / S.env.T_day); S.whyLog = []; S.prevAct = -1; S.lastEventTick = {}; S.lastPlace = "";
  S.tallySleep = {}; S.tallyElim = {}; S.meowDay = 0; S.meowTotal = 0; S.eatBites = 0; S.why = null;
  $("whyLog").innerHTML = ""; $("todayEvents").innerHTML = ""; $("eventsStrip").innerHTML = "";
}
function stoveOn(env) { const h = env.hour(); let on = false; for (const [a, b] of env.cfg.weather.heater_hours) on = on || (h >= a && h < b); return on; }

// ------------------------------------------------------------ 1 ティック
const fmtH = (h) => `${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`;
function placeAt(env, l, x, y) { return env.names[idx3(l, y, x)] || "?"; }
function pushEvent(kind, text, key, minGap) {
  const env = S.env; const gap = minGap == null ? 8 : minGap;
  if (key && S.lastEventTick[key] != null && env.t - S.lastEventTick[key] < gap) return;
  if (key) S.lastEventTick[key] = env.t;
  S.day.events.push({ h: env.hour(), t: env.t, kind, text });
  announce(`${fmtH(env.hour())} ${text}`);
}
// 読み上げ(aria-live=polite)用: 30 秒に 1 回まで、いちばん新しい出来事だけ
function announce(t) { announce.last = t; if (announce.timer) return; const wait = Math.max(0, 30000 - (performance.now() - (announce.at || -1e9))); announce.timer = setTimeout(() => { announce.timer = 0; announce.at = performance.now(); const lv = $("live"); if (lv) lv.textContent = announce.last; }, wait); }
function actCat(a) {
  if (a === SLEEP) return KIND_CAT.sleep; if (a === EAT || a === DRINK) return KIND_CAT.eat; if (a === GROOM) return KIND_CAT.groom; if (a === ELIM) return KIND_CAT.elim; if (a === MEOW) return KIND_CAT.meow; if (a === PAW) return KIND_CAT.play;
  if ((a >= 1 && a <= 6) || a === C.ENTER || a === C.LEAVE || a >= 15 && a <= 18) return KIND_CAT.move; return 0;
}
function topDrive(env) {
  const dev = env.deviations(), k = env.cfg.drives.k; let best = 0, bv = -1;
  for (let j = 0; j < C.DRIVES.length; j++) { const v = env.w[j] * Math.pow(dev[j], k); if (v > bv) { bv = v; best = j; } }
  return { name: DRIVE_JA[C.DRIVES[best]] || C.DRIVES[best], val: bv };
}
function doTick(silent) {
  const env = S.env, mind = S.mind;
  const clockDay0 = Math.floor((env.t0 + env.t) / env.T_day);
  if (clockDay0 !== S.clockDay) { S.clockDay = clockDay0; S.band.fill(255); S.day = { events: [], trace: [] }; S.meowDay = 0; S.lastEventTick = {}; }
  const x = env.obs();
  const zone = env.innateLogitZone();
  const m = mind.step(x, zone);
  const a = Neko.mind.sampleAct(m.logits, S.actRng);
  // なぜ今これを: 上位三つ
  const lg = m.logits; let mx = -1e30; for (const v of lg) if (v > mx) mx = v; let sum = 0; const pr = Array.from(lg, (v) => { const e = Math.exp(v - mx); sum += e; return e; });
  const order = pr.map((p, i) => [i, p / sum]).sort((p, q) => q[1] - p[1]).slice(0, 3);
  const drive = topDrive(env);
  const before = { x: env.x, y: env.y, layer: env.layer, t: env.t, hour: env.hour() };
  const prevBird = env.bird; const wasSleep = S.prevAct === SLEEP;
  const { done, info } = env.step(a);
  const act = info.act;
  // 帯・記録
  const hIdx = clamp(Math.floor(((before.hour) / 24) * 720), 0, 719);
  S.band[hIdx] = actCat(act);
  if (S.day.trace.length < 1500) S.day.trace.push([before.t, +before.hour.toFixed(3), before.layer, before.x, before.y, act, +env.st[0].toFixed(3), +env.st[1].toFixed(3), +env.st[3].toFixed(2), +env.st[4].toFixed(3), +env.st[5].toFixed(3), +env.st[6].toFixed(3), +env.st[8].toFixed(3), +env.st[9].toFixed(3)]);
  const where = done ? placeAt(env, before.layer, before.x, before.y) : placeAt(env, env.layer, env.x, env.y);
  if (act === SLEEP) S.tallySleep[where] = (S.tallySleep[where] || 0) + 1;
  // 出来事
  if (act === SLEEP && S.prevAct !== SLEEP) pushEvent("sleep", `${where}で寝た`, "sleep", 3);
  if (S.prevAct === SLEEP && act !== SLEEP) pushEvent("wake", "起きた", "wake", 12);
  if (act === EAT && S.prevAct !== EAT) pushEvent("eat", "ごはんを食べた", "eat", 6);
  if (act === DRINK && S.prevAct !== DRINK) pushEvent("drink", "水を飲んだ", "drink", 6);
  if (act === GROOM && S.prevAct !== GROOM) pushEvent("groom", "毛づくろい", "groom", 15);
  if (act === MEOW) { S.meowDay++; S.meowTotal++; if (S.prevAct !== MEOW) pushEvent("meow", "鳴いた", "meow", 6); }
  if (act === PAW && S.prevAct !== PAW) pushEvent("play", "おもちゃで遊んだ", "play", 10);
  if (act === EAT) S.eatBites++;
  if (info.elim_vol || info.elim_acc) {
    S.tallyElim[where] = (S.tallyElim[where] || 0) + 1;
    const f = info.elim_f >= 0.25, u = info.elim_u >= 0.25;
    pushEvent("elim", `${f ? "うんち" : ""}${f && u ? "と" : ""}${u ? "おしっこ" : ""}${!f && !u ? "出した" : ""}(${where}${info.elim_buried ? "・埋めた" : ""}${info.elim_vol ? "" : "・こらえきれず"})`);
  }
  if (!done && (before.x !== env.x || before.y !== env.y || before.layer !== env.layer)) {
    const nm = placeAt(env, env.layer, env.x, env.y);
    if (nm !== S.lastPlace && ["ごはん皿", "縁側", "高い窓辺", "塀の上", "本棚の上", "ストーブの前", "帳場の座布団", "ボンネット", "庭木の陰", "トイレの砂"].includes(nm)) pushEvent("go", nm === "ごはん皿" ? "お皿へ" : `${nm}へ`, "go:" + nm, 25);
    S.lastPlace = nm;
  }
  if (info.v_fed) pushEvent("human", `人が来て、ごはんを出した`, "human", 3); else if (info.v_arrive) pushEvent("human", "人が来て、撫でて去った", "human", 3);
  if (info.ap_noticed) pushEvent("scare", `${env.approach.kind_names[info.ap_kind] || "何か"}に気づかれた${info.ap_caught ? "(捕まった)" : ""}`, "scare", 4);
  if (info.land_hurt) pushEvent("hurt", "着地で怪我をした", "hurt", 10);
  if (env.bird && !prevBird && env.layer === TOP && env.x === C.SILL[0] && env.y === C.SILL[1]) pushEvent("bird", "窓の外にスズメが来た", "bird", 20);
  if (done) { pushEvent("life", `${env.ep_days} 日が過ぎて、暮らしが替わった`); mind.resetState(); S.tallySleep = {}; S.tallyElim = {}; S.meowTotal = 0; S.eatBites = 0; }
  S.prevAct = act;
  S.why = { hour: before.hour, top: order, chosen: act, drive, probChosen: pr[act] / sum };
  S.whyDirty = true; S.lastWhyAt = before.t;
  if (!silent) {
    const flags = { watching: (env.bird && env.layer === TOP) || (env.approach.active && env.approach.visible()[0]) || (env.voice_on && env.hu_here), startled: !!info.ap_noticed, gate: info.gate_after, wokeUp: wasSleep && act !== SLEEP, hm: env.voice_on && S.extras ? S.extras.hmState : null };
    S.actor.onTick(env, info, before, S.tickDur, flags);
    logWhy(before.hour, act, pr[act] / sum, order, drive);
  }
  S.lastTickAt = performance.now();
  if (done) S.actor.snapTo(env);
}
function logWhy(hour, act, p, order, drive) {
  const last = S.whyLog[0];
  if (last && last.act === act && S.mult >= 60 && false) return;
  S.whyLog.unshift({ hour, act, p, drive: drive.name }); if (S.whyLog.length > 40) S.whyLog.pop();
  S.whyLogDirty = true;
}

// ------------------------------------------------------------ 画面の文
const BARS = [
  { id: "gate", label: "満ち足り", get: (e) => e.satisfiedGate()[0], cls: "good", wide: false },
  { id: "stomach", label: "胃(満腹)", get: (e) => 1 - e.st[0], cls: "" },
  { id: "energy", label: "体(不足)", get: (e) => e.st[6] / 3, cls: "warn", fmt: (e) => e.st[6].toFixed(2) },
  { id: "thirst", label: "渇き", get: (e) => e.st[7], cls: "cool" },
  { id: "bladder", label: "膀胱", get: (e) => e.st[8], cls: "" },
  { id: "bowel", label: "腸(うんち)", get: (e) => e.st[9], cls: "" },
  { id: "fatigue", label: "疲れ", get: (e) => e.st[1], cls: "" },
  { id: "sleepy", label: "眠気", get: (e) => e.st[4], cls: "" },
  { id: "dirt", label: "汚れ", get: (e) => e.st[2], cls: "" },
  { id: "unsafe", label: "不安", get: (e) => e.st[5], cls: "warn" },
  { id: "nose", label: "鼻(匂い)", get: (e) => Math.min(1, e.st[10]), cls: "" },
  { id: "fat", label: "脂肪", get: (e) => (e.fat_on ? (e.fat / e.fat_bw - 0.1) / 0.25 : 0), cls: "", fmt: (e) => (e.fat_on ? (e.fat / e.fat_bw * 100).toFixed(0) + "%" : "—"), show: (e) => e.fat_on },
  { id: "pain", label: "痛み", get: (e) => e.st[13], cls: "warn", show: (e) => e.catch_on },
  { id: "theta", label: "体感の温度", get: (e) => (e.st[3] - 28) / 14, cls: "", fmt: (e) => e.st[3].toFixed(1) + "℃", wide: true, band: true },
];
const MAIN_BARS = new Set(["gate", "stomach", "energy", "sleepy", "unsafe", "fatigue", "dirt", "theta"]);   // 狭い画面で見せる主な 8 つ(あとは「それぞれの数」を開くと)
function buildBars() {
  $("bars").innerHTML = BARS.map((b) => `<div class="bar ${b.wide ? "wide" : ""} ${MAIN_BARS.has(b.id) ? "m" : ""}" id="bw_${b.id}"><div class="lab"><span>${b.label}</span><em id="bv_${b.id}"></em></div><div class="track">${b.band ? '<div class="band" id="bb_theta"></div>' : ""}<div class="fill ${b.cls}" id="bf_${b.id}"></div></div></div>`).join("");
}
function updateBars() {
  const env = S.env; if (!env) return;
  { const starving = env.st[env.v3.two_layer ? 6 : 0] >= env.v2_safety - 1e-6 && (!env.fat_on || env.fat <= env.fat_lo + 1e-6 * env.fat_bw); const n = $("starveNote"); if (n.hidden === starving) n.hidden = !starving; }   // 体(不足)が上限に着き、脂肪が下限の間だけ
  for (const b of BARS) {
    const w = $("bw_" + b.id); const vis = b.show ? b.show(env) : true; w.style.display = vis ? "" : "none"; if (!vis) continue;
    const v = b.get(env); $("bf_" + b.id).style.width = (clamp(v, 0, 1) * 100).toFixed(0) + "%";
    $("bv_" + b.id).textContent = b.fmt ? b.fmt(env) : v.toFixed(2);
    if (b.band) { const lo = env.temp_band[0], hi = env.temp_band[1]; const el = $("bb_theta"); el.style.left = (clamp((lo - 28) / 14, 0, 1) * 100).toFixed(1) + "%"; el.style.width = (clamp((hi - lo) / 14, 0, 1) * 100).toFixed(1) + "%"; }
  }
}
function updateWhy() {
  if (S.whyDirty && S.why) {
    const w = S.why;
    $("whyNow").innerHTML = `<div class="top">` + w.top.map(([a, p], i) => `<div class="nm ${i === 0 ? "first" : ""}">${i === 0 ? "▶ " : ""}${ACT_JA[a]}</div><div class="pc">${(p * 100).toFixed(0)}%</div><div class="pb"><i style="width:${(p * 100).toFixed(0)}%"></i></div>`).join("") + `</div><div class="due">いま一番大きい不快: <b>${w.drive.name}</b><span style="color:var(--ink3);font-size:11.5px"> (${w.drive.val.toFixed(3)})</span></div>`;
    S.whyDirty = false;
  }
  if (S.whyLogDirty) {
    $("whyLog").innerHTML = S.whyLog.slice(0, 14).map((l) => `<li><i>${fmtH(l.hour)}</i>${ACT_JA[l.act]} ${(l.p * 100).toFixed(0)}% <span style="color:var(--ink3)">(${l.drive})</span></li>`).join(""); S.whyLogDirty = false;
  }
}
let evCount = -1;
function updateEvents() {
  const ev = S.day.events; if (ev.length === evCount) return; evCount = ev.length;
  $("todayEvents").innerHTML = ev.length ? ev.slice(-30).reverse().map((e) => `<li><i>${fmtH(e.h)}</i>${esc(e.text)}</li>`).join("") : `<li class="empty">まだ何も起きていません</li>`;
  $("eventsStrip").innerHTML = ev.slice(-7).map((e) => `<span><i>${fmtH(e.h)}</i>${esc(e.text)}</span>`).join("");
}
const BAND_NAMES = ["座る・そのほか", "寝る", "動く", "食べる・飲む", "毛づくろい", "出す", "鳴く", "遊ぶ"];
function bandSummary() {
  const t = performance.now(); if (bandSummary.t && t - bandSummary.t < 5000) return; bandSummary.t = t;
  const cnt = {}; let any = 0; for (let i = 0; i < 720; i++) { const c = S.band[i]; if (c === 255) continue; cnt[c] = (cnt[c] || 0) + 1; any++; }
  const parts = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${BAND_NAMES[c] || "その他"} ${(n / 30).toFixed(1)} 時間`);
  const el_ = $("bandText"); if (el_) el_.textContent = any ? `今日の行動(いま ${fmtH(S.env.hour())} まで): ${parts.join("、")}` : "今日の行動は、まだ記録がありません";
}
function updateBand() {
  bandSummary();
  const cv = $("band"), g = cv.getContext("2d"); const w = cv.width, h = cv.height; g.clearRect(0, 0, w, h);
  g.fillStyle = "#f8f2e2"; g.fillRect(0, 0, w, h);
  const step = w / 720;
  for (let i = 0; i < 720; i++) { const c = S.band[i]; if (c === 255) continue; g.fillStyle = BAND_COL[c]; g.fillRect(i * step, 8, Math.ceil(step) + 0.5, h - 16); }
  g.strokeStyle = "rgba(44,38,32,.35)"; g.lineWidth = 2; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * w / 4, h - 8); g.lineTo(k * w / 4, h); g.stroke(); }
  const now = S.env.hour() / 24 * w; g.strokeStyle = "#a8432a"; g.lineWidth = 3; g.beginPath(); g.moveTo(now, 0); g.lineTo(now, h); g.stroke();
}
function updateClock() {
  const env = S.env; const [Tm, amp] = env.outMeanAmp(env.season);
  const s0 = env.cfg.weather.season[0], s1 = env.cfg.weather.season[1]; const u = (env.season - s0) / (s1 - s0);
  const sname = u < 0.3 ? "冬" : (u < 0.7 ? "春・秋" : "夏");
  const day = Math.floor(env.t / env.T_day) + 1;
  $("clockChip").innerHTML = `<b>${fmtH(env.hour())}</b>　${env.clear ? "晴れ" : "曇り"}　${sname}　<small><span class="cd">暮らし ${day}/${env.ep_days} 日目</span>${env.cl_wx ? `　${(Tm + amp).toFixed(0)}/${(Tm - amp).toFixed(0)}℃` : ""}</small>`;
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${esc(k)} ${v}`).join("、") || "—";
  $("tally").innerHTML = `<b>寝た場所</b>(ティック) ${top(S.tallySleep, 3)}<br><b>出した場所</b>(回) ${top(S.tallyElim, 4)}` + (env.voice_on ? `<br><b>鳴いた</b> 今日 ${S.meowDay} 回 / この暮らし ${S.meowTotal} 回` : "") + `<br><b>食べた</b> ${S.eatBites} 口`;
  const place = placeAt(env, env.layer, env.x, env.y);
  { const cap = $("caption"); const tail = ` — ${place}(${["床", "上の層", "囲いの中"][env.layer]})で「${ACT_JA[S.prevAct >= 0 ? S.prevAct : 0]}」。${S.ver.title}の家。`; const nm = S.look.name || "猫";
    if (cap._k !== nm + tail) { cap._k = nm + tail; cap.textContent = ""; cap.append("図1. ", el("b", { text: nm }), tail); updateCanvasLabel(nm + tail.replace(/^ — /, " ")); } }
}
function refreshStatic() {
  const v = S.ver;
  $("catName").textContent = S.look.name || "(名前なし)";
  const coat = COATS.find((c) => c.id === S.look.coat); const tail = TAILS.find((t) => t.id === S.look.tail);
  $("catSub").textContent = `${coat ? coat.label : ""}・${tail ? tail.label : ""}${S.look.socks ? "・靴下" : ""}　種 ${S.seed}`;
  { const L = $("verLine"); L.textContent = ""; L.append(el("b", { text: v.id }), `　${v.title}`, el("br"), v.line || v.summary || ""); }
  $("verStat").innerHTML = statHtml(v); $("verAdded").textContent = v.added; $("verQuirk").textContent = v.quirk; $("verNote").textContent = `${v.seed_note}。${v.checked ? "Python の sim.py との同値の確かめ: " + v.checked : ""}`;
  $("verSel").value = v.id;
  $("obsNo").textContent = `観察記録 No.${String(hash32(v.id + ":" + S.seed) % 10000).padStart(4, "0")}`;
  $("todayDate").textContent = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" }) + " 記";
  document.querySelectorAll(".bn").forEach((n) => { n.classList.toggle("cur", n.dataset.id === v.id); if (n.dataset.id === v.id) n.setAttribute("aria-current", "true"); else n.removeAttribute("aria-current"); });
}
function renderVersionUI() { /* 版の一覧は初回に作る */ }
function safeUrl(u) { try { const x = new URL(String(u), location.href); return x.protocol === "https:" || x.protocol === "http:" ? x.href : ""; } catch (e) { return ""; } }
function statHtml(v) {
  if (!v.stat) return "";
  return `<div class="stat"><div class="st-t">${esc(v.stat.title)}</div>` + v.stat.bars.map((b) => `<div class="st-r"><span>${esc(b.label)}</span><i><u style="width:${(Math.max(1.5, Math.min(100, Number(b.v) / Number(b.max) * 100)) || 1.5).toFixed(1)}%"></u></i><em>${esc(b.text)}</em></div>`).join("") + "</div>";
}
// note の入口は web/notes.json 一か所(記事が出たら一行足す)。外へのリンクは note.com の https だけ通す
const noteSafe = (u) => { const h = safeUrl(u); return /^https:\/\/note\.com\//.test(h) ? h : ""; };
const noteHref = (v) => noteSafe(v.note_url) || noteSafe((S.noteList.find((n) => n.n === v.note) || {}).url);
function buildNoteList() {
  const ul = $("noteList"); if (!ul) return; ul.textContent = "";
  for (const n of S.noteList) { const h = noteSafe(n.url); if (!h) continue; const li = el("li"); li.append(el("a", { href: h, rel: "noopener noreferrer", text: `${String(n.n).slice(0, 8)}${n.title ? " " + String(n.title).slice(0, 80) : ""}` })); ul.append(li); }
}
function buildVersionUI() {
  for (const id of ["verSel", "birthVer"]) { const sel = $(id); sel.textContent = ""; for (const v of S.versions) sel.append(el("option", { value: v.id, text: `${v.id}　${v.title}` })); }
  $("backnums").innerHTML = S.versions.map((v) => `<article class="bn" data-id="${esc(v.id)}"><div><span class="id">${esc(v.id)}</span><span class="dt">${esc(v.date || "")}</span></div><h3>${esc(v.title)}</h3><p>${esc(v.line || v.summary)}</p>${statHtml(v)}<div class="go"><button class="btn small go-btn">この猫を部屋に連れてくる</button>${v.note ? `<span class="nt">note ${noteHref(v) ? `<a href="${esc(noteHref(v))}" rel="noopener noreferrer">${esc(v.note)}</a>` : esc(v.note)}</span>` : ""}</div></article>`).join("");
  document.querySelectorAll(".bn .go-btn").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); const id = b.closest(".bn").dataset.id; switchVersion(id); window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" }); }));
}
function updateCanvasLabel(t) { const now = performance.now(); if (updateCanvasLabel.t && now - updateCanvasLabel.t < 8000) return; updateCanvasLabel.t = now; try { renderer.domElement.setAttribute("aria-label", "猫の箱庭(3D)。" + t); } catch (e) {} }
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("show"), 4200); }

// ------------------------------------------------------------ 操作
function newSeed() { return (Math.floor(Math.random() * 2 ** 31) ^ (Date.now() & 0x7fffffff)) >>> 0; }
async function switchVersion(id) { await startLife({ ver: id, seed: newSeed() }); toast(`${S.ver.title}(${S.ver.id})の猫を連れてきました`); }
function setMult(m) {
  S.mult = m; S.tickDur = 120 / m; document.querySelectorAll(".sp").forEach((b) => { b.classList.toggle("on", +b.dataset.mult === m); b.setAttribute("aria-pressed", String(+b.dataset.mult === m)); });
}
function syncUrl() {
  try {
    const o = { v: S.ver.id, seed: String(S.seed), t: String(S.env.t), coat: S.look.coat, tail: S.look.tail, sock: S.look.socks ? "1" : "0" };
    const q = new URLSearchParams(o);
    const f = new URLSearchParams(); if (S.shareName && S.look.name) f.set("n", S.look.name);                 // 名前は、入れると選んだ時だけ、# の後ろに(サーバへは送られない)
    if (S.iv && S.iv.length) f.set("i", ivText(S.iv));                                                       // 片づける・おやつの記録(同じ時刻に再現される)
    history.replaceState(null, "", "?" + q.toString() + (f.toString() ? "#" + f.toString() : ""));
  } catch (e) { /* file:// など */ }
}
function shareLink() { syncUrl(); return location.href; }
setInterval(() => { try { $("shareNote").hidden = !(S.env && S.env.t > FF_MAX); } catch (e) { /* 起動前 */ } }, 1000);
function saveLook(look) { try { localStorage.setItem("hibineko.look", JSON.stringify(cleanLook(look || S.look))); } catch (e) { /* 無くてよい */ } }
function loadLook() { try { const raw = localStorage.getItem("hibineko.look"); if (!raw || raw.length > 400) return null; const o = JSON.parse(raw); return o && typeof o === "object" ? cleanLook(o) : null; } catch (e) { return null; } }
function downloadJSON() {
  const env = S.env; const d = { app: "hibineko", version: S.ver.id, seed: S.seed, cat: S.shareName ? S.look : { coat: S.look.coat, tail: S.look.tail, socks: S.look.socks }, interventions: S.iv, lifeTick: env.t, clockDay: S.clockDay, lifeDay: Math.floor(env.t / env.T_day) + 1, season: env.season,
    columns: ["tick", "hour", "layer", "x", "y", "act", "stomach_empty", "fatigue", "theta", "sleepy", "unsafe", "energy_deficit", "bladder", "bowel"], acts: ACT_JA, trace: S.day.trace, events: S.day.events.map((e) => ({ hour: +e.h.toFixed(3), tick: e.t, kind: e.kind, text: e.text })) };
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: "application/json" })); a.download = `hibineko-${S.ver.id}-${S.seed}-d${S.clockDay}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---- 生まれさせる(猫の見本つき)
const PV = { r: null, scene: null, cam: null, mesh: null, raf: 0, key: "" };
function previewInit() {
  if (PV.r) return;
  const cv = $("birthPreview"); PV.r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); PV.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); PV.r.setSize(150, 150, false);
  PV.r.outputColorSpace = THREE.SRGBColorSpace; PV.r.toneMappingExposure = 1.0; PV.r.shadowMap.enabled = true;
  PV.scene = new THREE.Scene(); PV.cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20); PV.cam.position.set(0.55, 0.42, 0.95); PV.cam.lookAt(0, 0.17, 0);
  PV.scene.add(new THREE.HemisphereLight(0xffffff, 0xd8c8a8, 1.15)); const dl = new THREE.DirectionalLight(0xfff2dc, 1.6); dl.position.set(1.5, 2.5, 1.5); dl.castShadow = true; PV.scene.add(dl);
  const g = new THREE.Mesh(new THREE.CircleGeometry(0.7, 32), new THREE.ShadowMaterial({ opacity: 0.25 })); g.rotation.x = -Math.PI / 2; g.receiveShadow = true; PV.scene.add(g);
}
function previewSet() {
  previewInit(); const look = { coat: birthSel.coat, tail: birthSel.tail, socks: $("socksChk").checked };
  const key = JSON.stringify(look); if (key === PV.key) return; PV.key = key;
  if (PV.mesh) { PV.scene.remove(PV.mesh.root); PV.mesh.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  PV.mesh = createNekoMesh(PV.scene, { coat: look.coat, tailType: look.tail, socks: look.socks, groundHeight: () => 0 }); PV.scene.add(PV.mesh.root);
  PV.mesh.root.traverse((o) => { if (o.isMesh) o.castShadow = true; }); PV.mesh.snap({ x: 0, z: 0, y: 0, yaw: 0, pose: "sit", mood: "happy" });
}
function previewLoop(now) {
  if (!$("birth").open) { PV.raf = 0; return; }
  if (PV.mesh) { PV.mesh.update(0.016, { x: 0, z: 0, y: 0, yaw: REDUCED ? 0.5 : 0.5 + 0.6 * Math.sin(now / 1800), pose: "sit", mood: "happy" }, REDUCED ? 1000 : now, PV.cam.position, null, null); if (!REDUCED || !PV.once) { PV.r.render(PV.scene, PV.cam); PV.once = REDUCED; } }
  PV.raf = requestAnimationFrame(previewLoop);
}
let birthSel = { coat: "cha", tail: "long" };
function buildBirthUI() {
  $("coatList").innerHTML = COATS.map((c) => `<button type="button" class="coat-btn" data-id="${c.id}"><span class="sw" style="background:${c.col}"></span>${c.label}</button>`).join("");
  $("tailList").innerHTML = TAILS.map((t) => `<button type="button" class="tail-btn" data-id="${t.id}">${t.label}</button>`).join("");
  $("coatList").addEventListener("click", (e) => { const b = e.target.closest(".coat-btn"); if (b) { birthSel.coat = b.dataset.id; markBirth(); } });
  $("tailList").addEventListener("click", (e) => { const b = e.target.closest(".tail-btn"); if (b) { birthSel.tail = b.dataset.id; markBirth(); } });
  $("socksChk").addEventListener("change", markBirth);
  $("rollName").addEventListener("click", () => { $("nameInp").value = randomName(); });
  $("birthCancel").addEventListener("click", () => $("birth").close());
  $("birthForm").addEventListener("submit", async (e) => {
    e.preventDefault(); const name = cleanName($("nameInp").value) || randomName();
    const look = cleanLook({ coat: birthSel.coat, tail: birthSel.tail, socks: $("socksChk").checked, name }); saveLook(look); $("birth").close();
    await startLife({ ver: $("birthVer").value, seed: newSeed(), look }); toast(`${look.name}が生まれました`);
  });
}
function markBirth() { try { previewSet(); } catch (e) { console.error(e); } document.querySelectorAll(".coat-btn").forEach((b) => { b.classList.toggle("on", b.dataset.id === birthSel.coat); b.setAttribute("aria-pressed", String(b.dataset.id === birthSel.coat)); }); document.querySelectorAll(".tail-btn").forEach((b) => { b.classList.toggle("on", b.dataset.id === birthSel.tail); b.setAttribute("aria-pressed", String(b.dataset.id === birthSel.tail)); }); }
function openBirth() { birthSel = { coat: S.look.coat, tail: S.look.tail }; $("socksChk").checked = !!S.look.socks; $("nameInp").value = ""; $("birthVer").value = S.ver.id; markBirth(); if (!$("birth").open) $("birth").showModal(); if (!PV.raf) PV.raf = requestAnimationFrame(previewLoop); }

// ------------------------------------------------------------ 入力
function resize() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1 ? 46 : 34; camera.updateProjectionMatrix(); }
window.addEventListener("resize", resize); try { new ResizeObserver(() => resize()).observe(stage); } catch (e) {}
{
  const ptrs = new Map(); let moved = 0, pinch = 0; const cv = renderer.domElement;
  cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
  cv.addEventListener("pointermove", (e) => {
    const p = ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    if (ptrs.size === 1) { orbit.theta -= dx * 0.006; orbit.phi = clamp(orbit.phi - dy * 0.006, 0.25, 1.38); }
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); orbit.user = clamp(orbit.user * (pinch / d), 0.35, 2.2); pinch = d; }
  });
  const up = (e) => {
    ptrs.delete(e.pointerId);
    if (moved < 5 && S.env) {                                    // 床のうんち(塊)そのものを押したら、そのマスを片づける(猫がいなくてもよい)
      const r = cv.getBoundingClientRect(); const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, camera); const cell = pickFeces(rc);
      if (cell) { S.env.tidyAt(cell[0], cell[1]); logIv("c", cell[0], cell[1]); pushEvent("tidy", `片づけた(${placeAt(S.env, FLOOR, cell[0], cell[1])})`); toast("そのマスの匂いと汚れが消えました"); animateDio(performance.now() / 1000); }
    }
  };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  cv.addEventListener("wheel", (e) => { e.preventDefault(); orbit.user = clamp(orbit.user * (1 + Math.sign(e.deltaY) * 0.08), 0.35, 2.2); }, { passive: false });
}
document.querySelectorAll(".sp").forEach((b) => b.addEventListener("click", () => setMult(+b.dataset.mult)));
$("pause").addEventListener("click", () => { S.paused = !S.paused; $("pause").textContent = S.paused ? "つづける" : "ひとやすみ"; $("pause").setAttribute("aria-pressed", String(S.paused)); });
$("skipDay").addEventListener("click", () => {
  if (!S.env) return; const env = S.env; const n = env.T_day - ((env.t0 + env.t) % env.T_day); for (let i = 0; i < n; i++) doTick(true);
  S.actor.snapTo(env); toast("この日を飛ばしました(結果だけ)");
});
$("shareBtn").addEventListener("click", async () => { const u = shareLink(); try { await navigator.clipboard.writeText(u); toast("この猫のこの時刻のリンクをコピーしました。開くと同じ猫が同じ一日を始めます"); } catch (e) { window.prompt("リンク", u); } });
$("jsonBtn").addEventListener("click", downloadJSON);
$("camFollow").addEventListener("click", () => setCamMode("follow")); $("camWide").addEventListener("click", () => setCamMode("wide"));
$("noteToggle").addEventListener("click", () => { S.notes = !S.notes; $("noteToggle").classList.toggle("on", S.notes); $("noteToggle").setAttribute("aria-pressed", String(S.notes)); });
$("forgetBtn").addEventListener("click", () => { try { localStorage.removeItem("hibineko.look"); } catch (e) {} toast("この端末に保存していた猫の見た目と名前を消しました(いま画面にいる猫は、頁を閉じるまで残ります)"); });
$("shareName").addEventListener("change", () => { S.shareName = $("shareName").checked; syncUrl(); });
$("verSel").addEventListener("change", (e) => switchVersion(e.target.value));
// 狭い画面: 体の数は主な 8 つだけ(「それぞれの数」を開くと全部)。「今選びそうな手」は一位だけ(押すと上位 3 つと一番大きい不快)
document.querySelector(".bar-help").addEventListener("toggle", (e) => $("bars").classList.toggle("all", e.target.open));
{ const w = $("whyNow"), box = w.closest(".why"), mq = matchMedia("(max-width: 600px)");
  const sync = () => { if (mq.matches) { w.setAttribute("role", "button"); w.tabIndex = 0; w.setAttribute("aria-expanded", String(box.classList.contains("open"))); w.setAttribute("aria-label", "今選びそうな手(押すと上位 3 つが開く)"); } else { w.removeAttribute("role"); w.removeAttribute("tabindex"); w.removeAttribute("aria-expanded"); w.removeAttribute("aria-label"); } };
  const flip = () => { if (!mq.matches) return; box.classList.toggle("open"); sync(); };
  w.addEventListener("click", flip); w.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
  mq.addEventListener("change", sync); sync(); }
$("rebirth").addEventListener("click", openBirth); $("starveBtn").addEventListener("click", openBirth);
$("petBtn").addEventListener("click", () => { if (S.hand && S.actor) S.hand.start(S.fakeNow != null ? S.fakeNow : performance.now()); toast("撫でました。まだ体に触覚が無いので、猫の気持ちは変わりません"); });   // 手は見た目だけ。猫の手(行動)にも姿勢にも触らず、共有の記録にも入れない
$("tidyBtn").addEventListener("click", () => { const e = S.env; if (!e) return; e.tidyHere(); logIv("c", e.x, e.y); pushEvent("tidy", `うんちを片づけた(${placeAt(e, e.layer, e.x, e.y)})`); toast("その場所の匂いと汚れが消えました。猫はそこを「くさくない場所」として扱い直します。"); });
$("snackBtn").addEventListener("click", () => { const e = S.env; if (!e) return; if (e.voice_on) { e.snackBowl(); logIv("s"); pushEvent("snack", "おやつ(皿に足した)"); toast(`皿に食べ物を足しました(いま皿に ${e.bowl_bites.toFixed(0)} 口)。置き餌ではないので、食べればなくなります。`); } else toast("この版の皿はいつも満ちていて、一口足しても変わりません(皿の中身が物理にあるのは x12b・x12c の版だけです)。"); });
window.addEventListener("keydown", (e) => {
  const tg = e.target; const typing = tg && (tg.tagName === "INPUT" || tg.tagName === "SELECT" || tg.tagName === "TEXTAREA" || tg.isContentEditable);
  if (typing || e.ctrlKey || e.metaKey || e.altKey || ($("birth") && $("birth").open)) return;
  if (e.code === "Space" && (tg === document.body || tg === renderer.domElement)) { e.preventDefault(); $("pause").click(); return; }
  const k = e.key;                                                  // 1〜4: 速さ / b: 生まれさせる / t: 撫でる … 手 (p 撫でる・c 片づける・s おやつ) / f・w: 視点 / 矢印: 視点を回す
  const map = { "1": 1, "2": 60, "3": 144, "4": 288 };
  if (map[k]) { setMult(map[k]); return; }
  if (k === "b") { $("rebirth").click(); return; } if (k === "p") { $("petBtn").click(); return; } if (k === "c") { $("tidyBtn").click(); return; } if (k === "s") { $("snackBtn").click(); return; }
  if (k === "f") { setCamMode("follow"); return; } if (k === "w") { setCamMode("wide"); return; }
  if (tg === renderer.domElement || tg === stage) { if (k === "ArrowLeft") { orbit.theta += 0.12; e.preventDefault(); } else if (k === "ArrowRight") { orbit.theta -= 0.12; e.preventDefault(); } else if (k === "ArrowUp") { orbit.phi = clamp(orbit.phi - 0.08, 0.25, 1.38); e.preventDefault(); } else if (k === "ArrowDown") { orbit.phi = clamp(orbit.phi + 0.08, 0.25, 1.38); e.preventDefault(); } else if (k === "+" || k === "=") { orbit.user = clamp(orbit.user * 0.9, 0.35, 2.2); } else if (k === "-") { orbit.user = clamp(orbit.user * 1.1, 0.35, 2.2); } lastInput = performance.now(); }
});

// ------------------------------------------------------------ ループ
let last = performance.now(), hud = 0, accDt = 0, lastRender = 0, lastInput = 0;
// 眺めながら仕事をする頁なので軽くする: 1 倍で猫が動いていない間は 12fps ほどに落とす(世界の時計はそのまま進む)。タブが裏の時は描画せず、世界だけ進める。
const REDUCED = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } })();
function needSmooth(now) {
  if (REDUCED) return now - lastInput < 600;                      // 動きを減らす設定: 触っている間だけ滑らかに。あとは最小限の描画
  if (S.mult > 1 || now - lastInput < 1500) return true;
  if (S.hand && S.hand.active) return true;
  const p = S.actor && S.actor.plan; if (p && now < p.t0 + p.dur + 400) return true;
  const e = S.env; if (e && (e.approach.active || (e.bird && S.cam === "follow"))) return true;
  return false;
}
for (const ev of ["pointerdown", "pointermove", "wheel", "keydown"]) stage.addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true });
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { hiddenAt = performance.now(); }
  else { last = performance.now(); if (S.env && S.actor) S.actor.snapTo(S.env); }
});
setInterval(() => {                                                  // 裏のタブ: 描画せず、世界だけ実時間どおり進める(ブラウザが rAF を止めるので)
  if (!document.hidden || !S.ready || !S.env || S.paused) return;
  const now = performance.now(); const dt = Math.min(5, (now - (hiddenAt || now)) / 1000); hiddenAt = now;
  S.owed += dt * (S.mult / 120); let n = 0; while (S.owed >= 1 && n < 3000) { doTick(true); S.owed -= 1; n++; }
  if (S.owed > 50000) S.owed = 0;
}, 500);
function frame(now) {
  if (S.fakeNow != null) now = S.fakeNow;                                  // 検品用: 時計を外から進める
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (S.ready && S.env) {
    const env = S.env;
    if (!S.paused) {
      S.owed += dt * (S.mult / 120);
      const t0 = performance.now(); let n = 0;
      while (S.owed >= 1 && n < 2000 && performance.now() - t0 < 10) { doTick(false); S.owed -= 1; n++; }
      if (S.owed > 50000) S.owed = 0;
    }
    accDt += dt;
    if (!needSmooth(now) && now - lastRender < (REDUCED ? 500 : 80)) { requestAnimationFrame(frame); return; }
    const dtR = Math.min(0.12, accDt); accDt = 0; lastRender = now;
    S.actor.update(S.paused ? 0 : dtR, now, env, camera.position);
    { const q = new THREE.Vector3(S.actor.cur.x, S.actor.cur.y + 0.2, S.actor.cur.z).project(camera); S.screenX = (q.x * 0.5 + 0.5) * stage.clientWidth; S.screenY = (-q.y * 0.5 + 0.5) * stage.clientHeight; }
    S.catTag.a.p.set(S.actor.cur.x, S.actor.cur.y + 0.55, S.actor.cur.z); if (S.catTag.el.textContent !== (S.look.name || "猫")) S.catTag.el.textContent = S.look.name || "猫";
    S.dio.setLight(env.hour(), env.clear, stoveOn(env));
    animateDio(now / 1000);
    if (S.hand && S.hand.active) S.hand.update(now, S.actor);
    S.extras.update(S.paused ? 0.016 : dtR, now, env, camera.position, S.actor.cur, S.look.coat);
    if (!S.camLock) orbit.wantTarget.set(S.actor.cur.x, S.actor.cur.y + 0.3, S.actor.cur.z);       // camLock は検品用
    if (S.cam === "wide") orbit.wantTarget.copy(S.dio.center);
    placeCamera(); updateLabels();
    hud += dtR; if (hud > 0.1) { hud = 0; updateBars(); updateWhy(); updateEvents(); updateBand(); updateClock(); }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
// 床にある便の量(見た目用の台帳 mess_f の床の層)。これが 0.03 を超える格子だけ、塊を描いて乗らない箱にする
// 介入(片づける・おやつ)の記録: 共有リンクの # の後ろに入れ、開いた時に同じ時刻に再現する
function logIv(k, x, y) { if (!S.ivReplaying && S.iv.length < 40) S.iv.push(k === "c" ? [S.env.t, "c", x, y] : [S.env.t, "s"]); syncUrl(); }
function applyIv(env, iv) { if (iv[1] === "c") env.tidyAt(iv[2] | 0, iv[3] | 0); else if (iv[1] === "s" && env.voice_on) env.snackBowl(); }
function parseIv(str) {
  const out = []; if (typeof str !== "string" || str.length > 600) return out;
  for (const part of str.split(",")) { const a = part.split("."); const t = uintParam(a[0], -1, 20160); if (t < 0) continue;
    if (a[1] === "c") { const x = uintParam(a[2], -1, 99), y = uintParam(a[3], -1, 99); if (x >= 0 && y >= 0 && x < W && y < H) out.push([t, "c", x, y]); } else if (a[1] === "s") out.push([t, "s"]); if (out.length >= 40) break; }
  return out.sort((p, q) => p[0] - q[0]);
}
const ivText = (list) => list.map((v) => v.join(".")).join(",");
const FF_MAX = 1440;                                   // 共有リンクで再現する長さの上限(2 日分)。スマホで固まらないように
async function fastForward(n, iv) {
  S.booting = true; S.ffCancel = false; S.ivReplaying = true; let i = 0, k = 0; const L = $("loading");
  const show = (txt) => { L.classList.remove("gone"); L.removeAttribute("aria-hidden"); L.textContent = txt + " "; const b = el("button", { type: "button", class: "btn small", text: "中止してここから始める" }); b.addEventListener("click", () => { S.ffCancel = true; }); L.append(b); };
  if (n > 200) show(`猫の暮らしを再現しています… 0/${n}`);
  while (i < n && !S.ffCancel) {
    const end = Math.min(n, i + 120);
    for (; i < end; i++) { while (k < iv.length && iv[k][0] <= S.env.t) { applyIv(S.env, iv[k]); k++; } doTick(true); }
    S.ffProgress = i; if (n > 200) { L.firstChild.nodeValue = `猫の暮らしを再現しています… ${i}/${n} `; }
    await new Promise((r) => setTimeout(r, 0));
  }
  S.ivReplaying = false; S.booting = false;
}
// 光線が当たった「いま見えている便の塊」のマス(塊そのもの、なければ塊のあるマスの床)。無ければ null
function pickFeces(rc) {
  const d = S.dio.dyn, env = S.env; const vis = d.poop.filter((g) => g.visible);
  const h = vis.length ? rc.intersectObjects(vis, true)[0] : null;
  if (h) { let o = h.object; while (o && d.poop.indexOf(o) < 0) o = o.parent; const i = d.poop.indexOf(o); if (i >= 0) return [i % W, Math.floor(i / W)]; }
  const t = rc.intersectObjects(S.dio.tiles, false)[0];
  if (t && floorFeces(env, t.object.userData.x, t.object.userData.y) > 0.03) return [t.object.userData.x, t.object.userData.y];
  return null;
}
function floorFeces(env, x, y) { return env.mess_f[idx3(FLOOR, y, x)]; }
function animateDio(t) {
  const d = S.dio.dyn, env = S.env, dd = S.dio;
  const cp = (l, x, y) => dd.cellPos(l, x, y);
  { const under = env.layer === INSIDE && env.names[idx3(INSIDE, env.y, env.x)] === "縁側の下"; const k = under ? 0.28 : 1; for (const t of dd.tiles) { if (t.userData.x === 5) { t.material.transparent = true; t.material.opacity += (k - t.material.opacity) * 0.2; t.material.depthWrite = t.material.opacity > 0.9; } } }
  d.car.visible = env.car; d.bird.visible = env.bird; if (env.bird) d.bird.rotation.y = Math.sin(t * 3) * 0.5;
  d.box.visible = env.box; if (env.box) { const [bx, by] = env.boxCellNow(); const p = cp(FLOOR, bx, by); d.box.position.set(p.x, p.y, p.z); }
  d.basket.visible = env.world.basket; if (env.world.basket) { const [bx, by] = env.world.basket_cells[env.world.basket_i]; const p = cp(FLOOR, bx, by); d.basket.position.set(p.x, p.y, p.z); }
  d.newbox.visible = env.newbox;
  if (d.pot) { d.pot.visible = env.pot === C.POT_PRESENT || env.pot === C.POT_OCCUPIED; }       // 先客は Extras が本物の猫で出す
  if (d.food) { d.food.visible = env.voice_on ? env.bowl_bites >= 1 : true; d.food.scale.set(1, 0.45 * (env.voice_on ? clamp(env.bowl_bites / 8, 0.35, 1.6) : 1), 1); }
  if (d.toy) d.toy.rotation.z = env.toy_left > 0 ? 0.55 * Math.sin(t * 13) : 0.03 * Math.sin(t);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0; for (let l = 0; l < 3; l++) s += env.scent[idx3(l, y, x)];          // 匂い(尿も便も、どの層でも)は紫の面
    const m = floorFeces(env, x, y);                                                    // 固い塊と箱になるのは、床の便だけ(尿・上の層・囲いの中の排せつは、匂いだけ)
    const i = y * W + x; const so = Math.min(0.5, s / 8); d.scentM[i].material.opacity = so; d.scentM[i].visible = so > 0.01;
    const p = d.poop[i]; p.visible = m > 0.03; if (p.visible) p.scale.setScalar(0.05 + 0.07 * Math.min(1, m));
  }
  if (d.sunPatch) { const h = env.hour(); const px = (h >= 6 && h < 18) ? env.SUN_XS[clamp(Math.floor((h - 6) / 3), 0, 3)] : -1; d.sunPatch.visible = px >= 0 && env.brightness() > 0; if (px >= 0) { const p = cp(FLOOR, px, env.SUN_Y); d.sunPatch.position.set(p.x, 0.07, p.z); } }
}

// ------------------------------------------------------------ 起動
async function main() {
  try {
    const q = new URLSearchParams(location.search);
    S.versions = await getJSON("versions.json");
    try { const nl = await getJSON("notes.json"); S.noteList = Array.isArray(nl) ? nl.filter((n) => n && typeof n.n === "string") : []; } catch (e) { S.noteList = []; }   // 無くても頁は動く
    buildNoteList();
    buildVersionUI(); buildBars(); buildBirthUI(); setMult(1); resize();
    const vq = q.get("v"); const first = verOf(vq && vq.length <= 40 ? vq : "x12b");
    S.ver = first;
    const saved = loadLook();
    const hq = new URLSearchParams(location.hash.slice(1));
    const qn = cleanName(hq.get("n") || q.get("n"));                                 // 名前は # の後ろ(古いリンクの ?n= も受ける)
    const look = cleanLook({ coat: q.get("coat") || (saved && saved.coat), tail: q.get("tail") || (saved && saved.tail), socks: q.has("sock") ? q.get("sock") === "1" : !!(saved && saved.socks), name: qn || (saved && saved.name) || randomName() });
    S.look = look;
    const seed = uintParam(q.get("seed"), q.has("v") ? SEED0 : newSeed(), 0xffffffff);
    window.__hibineko = S; S.booting = true;
    await startLife({ ver: first.id, seed, look, ff: uintParam(q.get("t"), 0, 1e9), iv: parseIv(hq.get("i")) });
    if (hq.get("n") && qn) { S.shareName = true; $("shareName").checked = true; }
    { const tt = Number(q.get("t")); if (Number.isFinite(tt) && tt > FF_MAX) toast("長い時間のリンクは、はじめの 2 日分までで再現します"); }
    setCamMode("follow");
    requestAnimationFrame(frame);
    if (!q.has("v") && !saved) setTimeout(() => { try { openBirth(); } catch (e) { console.error("birth dialog:", e); } }, 600);
    S.orbit = orbit; S.doTick = doTick; S.renderer = renderer; S.scene = scene; S.camera = camera; S.animateDio = animateDio; S.floorFeces = floorFeces; window.__hibineko = S;       // 検品・デバッグ用
  } catch (e) { $("loading").textContent = "読み込みに失敗しました: " + e.message + "(頁は http(s) で開いてください。例: python3 -m http.server)"; console.error(e); }
}
main();
