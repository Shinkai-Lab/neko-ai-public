// 箱庭の中の、猫のほかの住人: 近づいてくる相手(鶏・犬や獣・子ども・大人・よその猫・カラス)、同居の猫 2 匹、ごはんの人。
// 位置は sim.js の状態(env.approach / env.hm_xy / env.hu_xy)から。見た目だけ(物理は sim.js)。
import * as THREE from "three";
import { createNekoMesh } from "../neko-argon/neko-argon.js?v=a9e327c3f5";
import { fitInPot, applyPotTilt, TAIL_POT } from "./catactor.js?v=a9e327c3f5";

const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.9 }, o || {}));
const INK = 0x3b3128;
function ink(m, op) { m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: op || 0.35 }))); return m; }
const B = (w, h, d, c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.castShadow = true; return ink(m); };
const S = (r, c, sx, sy, sz) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat(c)); m.scale.set(sx || 1, sy || 1, sz || 1); m.castShadow = true; return m; };
const Cy = (r0, r1, h, c) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 14), mat(c)); m.castShadow = true; return m; };

// 人型(大人・子ども・ごはんの人)。+z が前
function person(opts) {
  const k = opts.scale || 1; const g = new THREE.Group(); const legs = [];
  const top = Cy(0.17 * k, 0.21 * k, 0.62 * k, opts.top); top.position.y = 1.0 * k; g.add(top);
  for (const sx of [-1, 1]) { const l = Cy(0.065 * k, 0.07 * k, 0.7 * k, opts.bottom); l.position.set(sx * 0.09 * k, 0.37 * k, 0); g.add(l); legs.push(l); }
  const hd = S(0.15 * k, 0xf0c9a0); hd.position.y = 1.5 * k; g.add(hd);
  const hair = S(0.16 * k, opts.hair, 1, 0.8, 1.05); hair.position.set(0, 1.56 * k, -0.02 * k); g.add(hair);
  for (const sx of [-1, 1]) { const a = Cy(0.05 * k, 0.05 * k, 0.6 * k, opts.top); a.position.set(sx * 0.24 * k, 1.02 * k, 0); a.rotation.z = sx * 0.12; g.add(a); }
  if (opts.apron) { const ap = B(0.3 * k, 0.5 * k, 0.04 * k, 0xf4efe0); ap.position.set(0, 0.92 * k, 0.17 * k); g.add(ap); }
  g.userData.legs = legs; return g;
}
function chicken() { const g = new THREE.Group(); const b = S(0.2, 0xf4f0e6, 1, 0.9, 1.3); b.position.y = 0.32; g.add(b); const h = S(0.09, 0xf4f0e6); h.position.set(0, 0.55, 0.22); g.add(h); const c = B(0.02, 0.06, 0.08, 0xd83a2e); c.position.set(0, 0.64, 0.22); g.add(c); const bk = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 6), mat(0xe8a63a)); bk.rotation.x = Math.PI / 2; bk.position.set(0, 0.54, 0.32); g.add(bk); const t = B(0.04, 0.2, 0.1, 0xd9d2c0); t.position.set(0, 0.42, -0.26); t.rotation.x = 0.5; g.add(t); for (const sx of [-1, 1]) { const l = Cy(0.012, 0.012, 0.22, 0xe0a030); l.position.set(sx * 0.07, 0.11, 0); g.add(l); } return g; }
function dog() { const g = new THREE.Group(); const c = 0xb98a56; const b = B(0.3, 0.3, 0.7, c); b.position.y = 0.5; g.add(b); const h = B(0.24, 0.24, 0.3, c); h.position.set(0, 0.68, 0.46); g.add(h); const sn = B(0.12, 0.1, 0.16, 0xe6d3b0); sn.position.set(0, 0.64, 0.64); g.add(sn); const nose = S(0.025, 0x222222); nose.position.set(0, 0.67, 0.72); g.add(nose); for (const sx of [-1, 1]) { const e = B(0.06, 0.16, 0.08, 0x8a6338); e.position.set(sx * 0.13, 0.78, 0.4); g.add(e); const l1 = B(0.08, 0.38, 0.08, c); l1.position.set(sx * 0.1, 0.19, 0.27); g.add(l1); const l2 = B(0.08, 0.38, 0.08, c); l2.position.set(sx * 0.1, 0.19, -0.27); g.add(l2); } const t = B(0.06, 0.06, 0.34, c); t.position.set(0, 0.7, -0.5); t.rotation.x = -0.6; g.add(t); return g; }
function crow() { const g = new THREE.Group(); const b = S(0.14, 0x1c1c22, 1, 0.9, 1.5); b.position.y = 0.3; g.add(b); const h = S(0.08, 0x1c1c22); h.position.set(0, 0.45, 0.18); g.add(h); const bk = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 6), mat(0x2a2a2a)); bk.rotation.x = Math.PI / 2; bk.position.set(0, 0.44, 0.3); g.add(bk); const t = B(0.08, 0.02, 0.2, 0x1c1c22); t.position.set(0, 0.27, -0.28); g.add(t); for (const sx of [-1, 1]) { const l = Cy(0.01, 0.01, 0.2, 0x3a3a3a); l.position.set(sx * 0.05, 0.1, 0); g.add(l); } return g; }

const hash = (n) => { let x = (n * 2654435761) >>> 0; x ^= x >>> 13; x = Math.imul(x, 1274126177) >>> 0; return (x ^ (x >>> 16)) / 4294967296; };

export class Extras {
  constructor(scene, dio) {
    this.scene = scene; this.dio = dio; this.root = new THREE.Group(); scene.add(this.root);
    this.ap = {}; this.cur = null; this.apPos = new THREE.Vector3(); this.apYaw = 0;
    this.hm = null; this.human = null; this.humanPos = new THREE.Vector3();
    this.hmState = [{ x: 0, z: 0, yaw: 0, init: false }, { x: 0, z: 0, yaw: 0, init: false }];
  }
  dispose() { this.scene.remove(this.root); this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  makeAp(kind) {
    if (this.ap[kind]) return this.ap[kind];
    let o = null;
    if (kind === "鶏") o = { g: chicken(), cat: false }; else if (kind === "犬・獣") o = { g: dog(), cat: false }; else if (kind === "カラス") o = { g: crow(), cat: false };
    else if (kind === "子ども") o = { g: person({ scale: 0.78, top: 0xd9a441, bottom: 0x3b4a6b, hair: 0x2a211c }), cat: false };
    else if (kind === "大人") o = { g: person({ scale: 1.0, top: 0x4a6fa5, bottom: 0x3a3a46, hair: 0x2a211c }), cat: false };
    else if (kind === "よその猫") { const m = createNekoMesh(this.scene, { coat: "kuro", tailType: "long" }); this.scene.remove(m.root); o = { g: m.root, cat: true, mesh: m }; m.root.scale.setScalar(1.2); }
    else o = { g: chicken(), cat: false };
    o.g.visible = false; this.root.add(o.g); this.ap[kind] = o; return o;
  }
  makeHm() {
    if (this.hm) return;
    this.hm = [0, 1].map((i) => { const m = createNekoMesh(this.scene, { coat: i ? "shiro" : "saba", tailType: i ? "bob" : "long" }); this.scene.remove(m.root); m.root.scale.setScalar(1.25); this.root.add(m.root); return m; });
    this.human = person({ scale: 1.0, top: 0x6a8a68, bottom: 0x3a3a46, hair: 0x2a211c, apron: true }); this.human.visible = false; this.root.add(this.human);
  }
  update(dt, nowMs, env, camPos, mainCat, mainCoat) {
    const dio = this.dio, C = env.consts; const t = nowMs / 1000;
    // 近づいてくる相手
    const ap = env.approach; for (const k in this.ap) this.ap[k].g.visible = false;
    if (ap.active) {
      const kind = ap.kind_names[ap.kind] || "鶏"; const o = this.makeAp(kind); const p = dio.cellPos(C.FLOOR, ap.ax, ap.ay);
      if (this.cur !== o.g || !this.apInit) { this.apPos.set(p.x, p.y, p.z); this.apInit = true; this.cur = o.g; }
      const dx = p.x - this.apPos.x, dz = p.z - this.apPos.z;
      if (Math.hypot(dx, dz) > 0.02) this.apYaw = Math.atan2(dx, dz);
      const k2 = Math.min(1, dt * 6); this.apPos.x += dx * k2; this.apPos.z += dz * k2; this.apPos.y = p.y;
      const moving = Math.hypot(dx, dz) > 0.08;
      o.g.visible = true; o.g.position.copy(this.apPos); o.g.position.y += moving ? 0.03 * Math.abs(Math.sin(t * 10)) : 0;
      let dyaw = this.apYaw - o.g.rotation.y; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); o.g.rotation.y += dyaw * Math.min(1, dt * 8);
      if (o.g.userData.legs) o.g.userData.legs.forEach((l, i) => { l.rotation.x = moving ? (i ? 1 : -1) * 0.5 * Math.sin(t * 9) : 0; });
      if (o.cat) o.mesh.update(dt, { pose: moving ? "walk" : "sit", mood: "alert" }, nowMs, camPos, null, null);
    } else this.apInit = false;
    // 鍋に入っている先客(世界で同居の猫が鍋を使っている間): 灰色の玉ではなく、猫が鍋の中で丸まって居る
    { const G = dio.dyn.potGeom;
      if (G && env.pot === C.POT_OCCUPIED) {
        // 先客の毛柄は、同居の二匹(サバトラ・白)・主役とかぶらず、鍋の灰緑から浮く明るい色(三毛 → ハチワレ → 茶トラ)
        const want = ["mike", "hachiware", "cha", "kuro"].find((c) => c !== mainCoat) || "mike";
        if (this.potter && this.potter.coat !== want) { this.root.remove(this.potter.m.root); this.potter.m.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); this.potter = null; }
        if (!this.potter) { const m = createNekoMesh(this.scene, { coat: want, tailType: "long" }); this.scene.remove(m.root); this.root.add(m.root); this.potter = { m, coat: want, F: { ox: 0, oz: 0, dy: 0, tilt: 0 } }; }
        const P = this.potter, p = dio.cellPos(C.INSIDE, G.cell[0], G.cell[1]); P.m.root.visible = true; P.m.root.scale.set(1.3 * 0.92, 1.3, 1.3 * 0.92);
        const stt = { x: p.x + P.F.ox, z: p.z + P.F.oz, y: p.y + P.F.dy, yaw: 2.3, pose: "curl", mood: "relaxed" };
        if (!P.on) { P.on = true; P.F.ox = 0; P.F.oz = 0; P.F.dy = 0; P.m.snap(stt); }                // 現れた時は、その場に置く(原点から滑ってこない)
        P.m.update(dt, stt, nowMs + 4321, camPos, null, null);
        P.m.setTailTune(TAIL_POT); applyPotTilt(P.m.root, P.F, true); fitInPot(P.m.root, G, P.F);
      } else if (this.potter) { this.potter.m.root.visible = false; this.potter.on = false; } }
    // 同居の猫とごはんの人(声の世界の版だけ)
    if (env.voice_on) {
      this.makeHm();
      const onFloor = !!(mainCat && env.layer === C.FLOOR);
      // (1) 置き場所と、そこへの滑らかな移動(制約はまだ掛けない)
      const info = this.hm.map((m, i) => {
        const hs = this.hmState[i]; const q = env.hm_xy[i]; const raw = dio.standPos(C.FLOOR, q[0], q[1]);
        const mode = env.hm_mode[i]; const key = q[0] + "," + q[1] + "," + mode + "," + dio.boxSig(raw.x, raw.z, 1.6);        // 位置の署名(動く物の数でなく位置)で、置き場所を決め直す
        // 置き場所は、その格子に来た時(または近くの物が変わった時)に決める: 先に居る猫が近ければ、押し出さずその横へくっつく(猫団子)。あとから主役が来ても、休んでいる同居の猫は動かさない
        if (hs.key !== key) {
          hs.key = key; let px = raw.x, pz = raw.z;
          const others = [];
          if (onFloor) others.push({ x: mainCat.x, z: mainCat.z });
          const oh = this.hmState[1 - i]; if (oh.init && oh.place) others.push({ x: oh.place.x, z: oh.place.z });
          for (const o of others) {
            const ddx = px - o.x, ddz = pz - o.z, dd = Math.hypot(ddx, ddz);
            if (dd < 0.62) {
              const a0 = dd > 0.03 ? Math.atan2(ddz, ddx) : i * 2.4 + 1; let best = null;
              for (const k of [0, 1.1, -1.1, 2.2, -2.2, 3.14]) { const cxx = o.x + 0.42 * Math.cos(a0 + k), czz = o.z + 0.42 * Math.sin(a0 + k); const w = dio.pushOut(cxx, czz); if (Math.hypot(w[0] - cxx, w[1] - czz) < 0.05) { best = { x: cxx, z: czz }; break; } }
              if (best) { px = best.x; pz = best.z; }
            }
          }
          { const w = dio.pushOut(px, pz); px = w[0]; pz = w[1]; }
          hs.place = { x: px, z: pz };
        }
        const p = { x: hs.place.x, z: hs.place.z, y: raw.y - dio.cushionLift(raw.x, raw.z) + dio.cushionLift(hs.place.x, hs.place.z) };
        if (!hs.init) { hs.x = p.x; hs.z = p.z; hs.init = true; }
        const dx = p.x - hs.x, dz = p.z - hs.z; const mv = Math.hypot(dx, dz) > 0.06;
        if (mv) hs.yaw = Math.atan2(dx, dz); const k2 = Math.min(1, dt * 2.2); hs.x += dx * k2; hs.z += dz * k2;
        return { m, hs, p, mv, mode };
      });
      // (2) 制約を数回くり返して収束させる。順序: 住人どうし・主役からの間合い(起きている方がゆっくり譲る)→ 物・うんちの箱(最後。箱には必ず入らない)。最後に全部を満たしているか確かめ、満たさなければもう一度
      const step = 0.9 * dt;
      for (let it = 0; it < 4; it++) {
        for (let i = 0; i < 2; i++) {
          const { hs, mode } = info[i]; if (mode === 0) continue;                                // 休んでいる猫は、箱以外では動かさない
          const push = (ox, oz, gap) => { const ddx = hs.x - ox, ddz = hs.z - oz, dd = Math.hypot(ddx, ddz); if (dd < gap) { const mvv = Math.min(gap - dd, step); const ux = dd > 0.01 ? ddx / dd : Math.cos(i * 2.4 + 1), uz = dd > 0.01 ? ddz / dd : Math.sin(i * 2.4 + 1); hs.x += ux * mvv; hs.z += uz * mvv; } };
          if (onFloor) push(mainCat.x, mainCat.z, 0.45);
          const oh = this.hmState[1 - i]; if (oh.init && (info[1 - i].mode === 0 || i === 1)) push(oh.x, oh.z, 0.5);
        }
        for (let i = 0; i < 2; i++) { const hs = info[i].hs; const w = dio.pushOut(hs.x, hs.z); hs.x = w[0]; hs.z = w[1]; }   // 箱は最後
      }
      for (const { m, hs, p, mv, mode } of info) {
        const i = info.findIndex((q) => q.hs === hs); const pose = mv ? "walk" : (mode === 0 ? (hash((env.t >> 7) + i) < 0.5 ? "curl" : "loaf") : "sit");
        m.root.visible = true;
        m.update(dt, { x: hs.x, z: hs.z, y: p.y, yaw: hs.yaw, pose, mood: "relaxed" }, nowMs + i * 777, camPos, null, null);
      }
      this.human.visible = env.hu_here;
      if (env.hu_here) { const p = dio.cellPos(C.FLOOR, env.hu_xy[0], env.hu_xy[1]); const w = dio.pushOut(p.x + 0.45, p.z + 0.35, 0.22); this.humanPos.lerp(new THREE.Vector3(w[0], p.y, w[1]), Math.min(1, dt * 5)); this.human.position.copy(this.humanPos); this.human.rotation.y = -0.6; }
    } else if (this.hm) { this.hm.forEach((m) => { m.root.visible = false; }); this.human.visible = false; }
  }
}
