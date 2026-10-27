// 猫の俳優。sim.js の一手(格子の位置・層・手)を、Argon の猫(neko-argon.js)の連続した動きと仕草につなぐ。
// 瞬間移動しない: 歩く・登る・飛び降りる・入る・出るは、位置を持った動きにする。止まる手は仕草(食べる・毛づくろい・香箱・猫鍋で丸まる…)。
// 物理にも心にも触らない。見た目だけ。
import * as THREE from "three";
import { createNekoMesh } from "../neko-argon/neko-argon.js?v=81141d1e75";
import { CELL } from "./diorama.js?v=81141d1e75";

const ease = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (n) => { let x = (n * 2654435761) >>> 0; x ^= x >>> 13; x = Math.imul(x, 1274126177) >>> 0; return (x ^ (x >>> 16)) / 4294967296; };
const ANG = (dx, dz) => Math.atan2(dx, dz);

// 鍋の中に収める(猫は縮めない・等身大): 体の中心を鍋の中心へ寄せ、鍋の壁の高さの中(底からふちまで)にある頂点が内壁より外に出る時は、体を少し持ち上げる。
// ふちより上は外へはみ出してよい(体は盛り上がり、しっぽ・前足はふちの上を越えて垂れる)。毎フレーム少しずつ(しっぽの揺れ・呼吸にも追随)
const _v = new THREE.Vector3();
// 鍋の中の丸まりのしっぽ: C の開いた所に沿って、体の前を回って鼻先へ(しっぽ巻き)。Argon の setTailTune で差し替える
export const TAIL_POT = { x: [0.4, -0.7, -0.45, -0.3], y: [0.3, 0.15, 0.1, 0.1] };   // 縦の曲げ: ふちを越える所で大きく、先へ向かって緩く(節ごとの角ばりを出さない)
export function fitInPot(root, geom, st) {
  root.updateMatrixWorld(true);
  const bxs = [], bys = [], bzs = [], xs = [], ys = [], zs = [];
  const part = {};                                                                   // 体の部品ごとの XZ 面積重心(腰・胸・頭)
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return; const p = o.geometry.attributes.position; const nm = o.name || ""; const tail = !nm || /^tail/.test(nm);
    for (let i = 0; i < p.count; i += 2) { _v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); const yr = _v.y - geom.baseY;
      if (yr > 0.02 && yr < geom.rimY - 0.002) { xs.push(_v.x); ys.push(yr); zs.push(_v.z); if (!tail) { bxs.push(_v.x); bys.push(yr); bzs.push(_v.z); } } }
    if (nm === "hip" || nm === "chest" || nm === "head") {
      const ix = o.geometry.index, m = o.matrixWorld.elements; const nT = ix ? ix.count / 3 : p.count / 3; let A = 0, X = 0, Z = 0;
      const fx = (k) => m[0] * p.getX(k) + m[4] * p.getY(k) + m[8] * p.getZ(k) + m[12], fz = (k) => m[2] * p.getX(k) + m[6] * p.getY(k) + m[10] * p.getZ(k) + m[14];
      for (let t = 0; t < nT; t++) { const a = ix ? ix.getX(t * 3) : t * 3, b = ix ? ix.getX(t * 3 + 1) : t * 3 + 1, d = ix ? ix.getX(t * 3 + 2) : t * 3 + 2;
        const ax = fx(a), az = fz(a), bx = fx(b), bz = fz(b), dx = fx(d), dz = fz(d); const ar = Math.abs((bx - ax) * (dz - az) - (dx - ax) * (bz - az)) / 2; A += ar; X += ar * (ax + bx + dx) / 3; Z += ar * (az + bz + dz) / 3; }
      if (A > 1e-9) part[nm] = [X / A, Z / A];
    }
  });
  if (!part.hip || !part.chest || !part.head || bxs.length < 8) return;
  // 背骨の弧(腰・胸・頭の重心を通る円)の中心 = C の字の「穴」の中心。背中はその外側
  const [x1, z1] = part.hip, [x2, z2] = part.chest, [x3, z3] = part.head;
  const dd = 2 * (x1 * (z2 - z3) + x2 * (z3 - z1) + x3 * (z1 - z2)); if (Math.abs(dd) < 1e-7) return;
  const ccx = ((x1 * x1 + z1 * z1) * (z2 - z3) + (x2 * x2 + z2 * z2) * (z3 - z1) + (x3 * x3 + z3 * z3) * (z1 - z2)) / dd;
  const ccz = ((x1 * x1 + z1 * z1) * (x3 - x2) + (x2 * x2 + z2 * z2) * (x1 - x3) + (x3 * x3 + z3 * z3) * (x2 - x1)) / dd;
  let ux = x2 - ccx, uz = z2 - ccz; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;   // 背中の向き(中心 → 背骨の真ん中)
  // 中心を鍋の中心に重ねた時、体が壁まであと何 m 余るか(背中がいちばん外側)。余った分だけ背中側へ寄せて、背中を壁(1.5 cm 手前)に沿わせる
  const ox = geom.x - ccx, oz = geom.z - ccz; let slack = 9;
  for (let i = 0; i < bxs.length; i++) { const rr = Math.hypot(bxs[i] + ox - geom.x, bzs[i] + oz - geom.z); slack = Math.min(slack, geom.inner(bys[i]) - 0.015 - rr); }
  const hug = Math.max(0, Math.min(0.06, slack));
  const tx = geom.x + ux * hug, tz = geom.z + uz * hug;                           // 円の中心を置きたい所
  st.ox += (tx - ccx) * 0.35; st.oz += (tz - ccz) * 0.35;
  // 壁の高さの中の頂点(しっぽ・前足を含む)が内壁・ふちの材に入る時だけ持ち上げる(外へ垂れた分は数えない)
  let f = 9;
  for (let i = 0; i < xs.length; i++) { const rr = Math.hypot(xs[i] + (tx - ccx) * 0.35 - geom.x, zs[i] + (tz - ccz) * 0.35 - geom.z); const a = geom.inner(ys[i]); if (rr > a + 0.03) continue; f = Math.min(f, (a - 0.004) / Math.max(rr, 1e-4)); }
  if (f < 1) st.dy = Math.min(0.2, st.dy + 0.0015 + 0.02 * (1 - f)); else if (f > 1.06 && st.dy > 0) st.dy = Math.max(0, st.dy - 0.003);
  st.cc = [ccx - geom.x, ccz - geom.z, hug]; st.u = [ux, uz];                       // 検品用 / 背中の向き
}

// 鍋の中で、背中側(ふちに寄りかかる側)を少し持ち上げ、顔の側を沈める傾き(Argon は rotation.y しか触らないので、x・z は外から足せる)
export function applyPotTilt(root, st, on) {
  st.tilt = (st.tilt || 0) + ((on && st.u ? 0.09 : 0) - (st.tilt || 0)) * 0.08;
  root.rotation.order = "YXZ"; const th = root.rotation.y, u = st.u || [0, 0];
  const wx = -u[1], wz = u[0];                                                     // 背中の向き × 上 = 傾ける軸(世界)
  const lx = wx * Math.cos(th) - wz * Math.sin(th), lz = wx * Math.sin(th) + wz * Math.cos(th);
  root.rotation.x = st.tilt * lx; root.rotation.z = st.tilt * lz;
}

export class CatActor {
  constructor(scene, diorama, look) {
    this.scene = scene; this.dio = diorama; this.look = look || {};
    this.cur = { x: 0, y: 0, z: 0, yaw: 0 };
    this.plan = null; this.pose = "sit"; this.poseAfter = null; this.mood = "relaxed";
    this.emoteUntil = 0; this.moodUntil = 0; this.lastKind = "";
    this.mesh = null; this.build();
  }
  build() {
    if (this.mesh) { this.scene.remove(this.mesh.root); this.mesh.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    const L = this.look;
    this.mesh = createNekoMesh(this.scene, { coat: L.coat || "cha", tailType: L.tail || "long", socks: !!L.socks, eyeColor: L.eyeColor || null, groundHeight: () => 0 });
    this.mesh.root.scale.setScalar(1.3);
    this.scene.add(this.mesh.root);
    this.mesh.root.position.set(this.cur.x, this.cur.y, this.cur.z);
    this.mesh.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  }
  setLook(look) { this.look = look; this.build(); }
  get root() { return this.mesh.root; }

  // 暮らしの始め・版の切り替え: その場所へ
  snapTo(env) {
    const p = this.dio.standPos(env.layer, env.x, env.y);
    this.cur = { x: p.x, y: p.y, z: p.z, yaw: this.cur.yaw };
    this.plan = null; this.pose = "sit"; this.poseAfter = null;
    this.mesh.snap({ x: p.x, z: p.z, y: p.y, yaw: this.cur.yaw, pose: "sit", mood: "relaxed" });
  }

  // 1 ティックが済んだ時。before: 手の前の {x,y,layer}、info: env.step の info、tickDur: この 1 ティックを画面で見せる秒数
  onTick(env, info, before, tickDur, flags) {
    const act = info.act, C = env.consts;
    const to = this.dio.standPos(env.layer, env.x, env.y);
    const moved = before.x !== env.x || before.y !== env.y || before.layer !== env.layer;
    const from = { x: this.cur.x, y: this.cur.y, z: this.cur.z };
    // 先に寝ている同居の猫が居る所へ来たら、同居の猫は動かさず、その横にくっつく(猫団子。座布団なら縁に体半分)
    this.dango = false;
    if (moved && env.layer === C.FLOOR && env.voice_on && flags.hm) {
      for (let i = 0; i < 2; i++) {
        const hs = flags.hm[i]; if (!hs || !hs.init || env.hm_mode[i] !== 0 || Math.hypot(to.x - hs.x, to.z - hs.z) >= 0.62) continue;
        const a0 = Math.atan2(from.z - hs.z, from.x - hs.x); const lift0 = this.dio.cushionLift(to.x, to.z);
        for (const k of [0, 1.1, -1.1, 2.2, -2.2, 3.14]) {
          const cx_ = hs.x + 0.42 * Math.cos(a0 + k), cz_ = hs.z + 0.42 * Math.sin(a0 + k); const w = this.dio.pushOut(cx_, cz_);
          if (Math.hypot(w[0] - cx_, w[1] - cz_) < 0.05) { to.y += this.dio.cushionLift(cx_, cz_) - lift0; to.x = cx_; to.z = cz_; this.dango = true; break; }
        }
        break;
      }
    }
    let target = { x: to.x, y: to.y, z: to.z };
    // 動かない手(毛づくろい・座る…)で、すぐ近く(皿の横など)に居るなら、その場に居続ける(格子の中心へ滑って戻らない)
    if (!moved && env.layer === C.FLOOR && act !== C.EAT && act !== C.DRINK && Math.hypot(from.x - to.x, from.z - to.z) < 1.1 && Math.abs(from.y - to.y) < 0.3) { const w = this.dio.pushOut(from.x, from.z); target = { x: w[0], y: to.y, z: w[1] }; }      // うんちなどが足元に現れたら、離れた側へ(猫は自分の出した物の上に居続けない)
    let yaw = this.cur.yaw;
    const dx = target.x - from.x, dz = target.z - from.z;
    if (Math.hypot(dx, dz) > 0.05) yaw = ANG(dx, dz);
    const cold = env.st[3] < env.temp_band[0] + 1.2 || env.cl_Dc > 0.3;
    const lookTarget = flags.watching; const slow = tickDur > 3;                         // 見ている相手(鳥・近づく相手・人)
    let pose = "sit", after = null, kind = "still", arc = 0, dur = Math.min(0.9, tickDur * 0.85);
    const inName = env.names[C.idx3(env.layer, env.y, env.x)];

    switch (act) {
      case C.N_: case C.E_: case C.S_: case C.W_: {
        kind = "walk"; const speed = tickDur < 0.7 ? 2.8 : (tickDur < 1.5 ? 1.5 : 1.1);
        pose = tickDur < 0.7 ? "trot" : "walk"; dur = Math.max(0.25, Math.min(tickDur * 0.9, Math.hypot(dx, dz) / speed)); after = slow ? "sit" : "still";
        if (env.layer === C.TOP && before.layer === C.TOP) { pose = "creep"; dur = Math.max(dur, 0.9); }   // 塀の上・棚の上は忍び足
        break;
      }
      case C.CLIMB: kind = "climb"; pose = "climb"; arc = 0.18; dur = Math.max(0.5, Math.min(1.0, tickDur * 0.9)); after = "sit"; yaw = this.faceWall(env, yaw); break;
      case C.DESCEND: case C.JUMP_N: case C.JUMP_E: case C.JUMP_S: case C.JUMP_W: kind = "jump"; pose = "jump_down"; arc = 0.25; dur = Math.max(0.45, Math.min(0.9, tickDur * 0.9)); after = "still"; break;
      case C.ENTER: kind = "enter"; pose = "walk"; dur = Math.max(0.4, Math.min(0.9, tickDur * 0.9)); after = "sit"; break;
      case C.LEAVE: kind = "leave"; pose = "walk"; dur = Math.max(0.4, Math.min(0.9, tickDur * 0.9)); after = "still"; break;
      case C.SLEEP: kind = "sleep"; pose = "curl"; break;
      case C.GROOM: kind = "groom"; pose = "groom"; break;
      case C.EAT: case C.DRINK: {
        kind = act === C.EAT ? "eat" : "drink"; pose = "eat";
        const b = act === C.EAT ? env.BOWL : C.WATER;               // 皿の西に立って、東(皿)へ首を伸ばす
        const bp = this.dio.cellPos(C.FLOOR, b[0], b[1]); const q = this.dio.pushOut(bp.x - 0.2, bp.z);
        target = { x: q[0], y: to.y, z: q[1] };
        yaw = ANG(bp.x + 0.12 - q[0], bp.z - q[1]); break;                  // 皿の方を向いて首を伸ばす
      }
      case C.ELIM: kind = "elim"; pose = "creep"; break;
      case C.DIG: kind = "dig"; pose = "scratch"; break;
      case C.PAW: kind = "paw"; pose = "pounce"; yaw = this.faceToy(env, from, yaw); break;
      case C.MEOW: kind = "meow"; pose = "meow"; break;
      default: {                                               // 座る
        kind = "sit";
        if (lookTarget) pose = "look";
        else if (cold && hash(env.t >> 5) < 0.75) pose = "loaf";   // 寒い時は香箱(30 ティックごとに引き直し)
        else if (env.layer === C.FLOOR && env.st[0] > 0.5 && Math.abs(env.x - env.BOWL[0]) + Math.abs(env.y - env.BOWL[1]) <= 2) {   // 空腹で皿のそば: 皿を見て待つ
          pose = "look"; const b = this.dio.cellPos(C.FLOOR, env.BOWL[0], env.BOWL[1]); yaw = ANG(b.x - from.x, b.z - from.z);
        }
        else pose = hash(env.t >> 6) < 0.22 ? "loaf" : (hash((env.t >> 4) + 7) < 0.12 ? "stretch" : "sit");
        if (flags.wokeUp) pose = "stretch";               // 起きた直後は伸び
      }
    }
    // 近づく相手を見ている・驚いた
    let mood = "relaxed";
    if (flags.startled) { mood = "angry"; this.moodUntil = performance.now() + 1800; }
    else if (performance.now() < this.moodUntil) mood = this.mood;
    else if (env.approach.active && env.approach.visible()[0]) mood = "alert";
    else if (info.v_fed || (flags.gate > 0.65 && env.st[4] < 0.3)) mood = "happy";
    this.mood = mood;
    // 人が足元にいる(ごはん!ごはん!)は、すり寄る
    this.rubWho = null;
    if (env.voice_on && env.hu_here && Math.abs(env.hu_xy[0] - env.x) + Math.abs(env.hu_xy[1] - env.y) <= 1 && (act === C.SIT || act === C.MEOW)) { pose = "rub"; this.rubWho = "human"; kind = "rub"; }
    // 中の層(囲い)に居て座る・歩かない時は、そこに収まる
    if (env.layer === C.INSIDE && (act === C.SIT) && !this.rubWho) pose = cold || inName === "鍋" ? "curl" : "loaf";

    // 歩く・登る・降りるは、物を避けた経路にする(物の中を突き抜けない)
    const path = this.buildPath(kind, from, target, before, env);
    if (kind === "walk" && path.length > 2) yaw = ANG(target.x - path[path.length - 2].x, target.z - path[path.length - 2].z);
    if (kind === "enter" || kind === "leave") arc = 0.22;                    // 鍋・袋・箱のふちをまたぐ
    // 高い所へ登る・降りる: 足場(棚板・台・タワーの段)に足をつく一続きの動き(見た目だけ。物理は格子の一手のまま)
    let stages = null; const sc = Math.min(1, Math.max(0.22, tickDur * 0.92 / 7));
    if (before.layer === C.FLOOR && env.layer === C.TOP && (act === C.CLIMB)) { const R = this.dio.climb[env.names[C.idx3(C.TOP, env.y, env.x)]]; if (R) stages = this.stagesUp(R, from, target, sc); }
    else if (before.layer === C.TOP && env.layer === C.FLOOR) { const R = this.dio.climb[env.names[C.idx3(C.TOP, before.y, before.x)]]; if (R) stages = this.stagesDown(R, from, target, sc); }
    if (stages) { dur = stages.reduce((s, q) => s + q.dur, 0) / 1000; after = "sit"; kind = "climbseq"; }
    const t0 = performance.now();
    this.plan = { from, to: target, path, stages, yaw0: this.cur.yaw, yaw1: yaw, t0, dur: dur * 1000, arc, kind, pose, after, afterT: t0 + dur * 1000 };
    this.pose = pose; this.poseAfter = after; this.kind = kind;
    this.curInfo = { sleeping: act === C.SLEEP, act };
  }
  faceWall(env, yaw) { return yaw; }
  // 段(stage): 点の列(折れ線)・秒・姿勢。登りは 歩く → 見上げる → 低く構えて尻を振る → 足場ごとに跳ぶ → 棚の縁 → 上を忍び足
  mk(pts, sec, pose, o) {
    o = o || {}; const P = pts.map((q) => ({ x: q.x, y: q.y, z: q.z })); let tot = 0; P[0].s = 0;
    for (let i = 1; i < P.length; i++) { tot += Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y, P[i].z - P[i - 1].z); P[i].s = tot; } P.total = tot;
    return { pts: P, dur: Math.max(1, sec * 1000), pose, arc: o.arc || 0, ease: !!o.ease, yaw: o.yaw == null ? null : o.yaw, wiggle: !!o.wiggle, dip: o.dip || 0 };
  }
  stagesUp(R, a, b, sc) {
    const S = [], long = sc >= 0.4; const A = R.ground; const w = this.dio.route(a.x, a.z, A.x, A.z);
    const pts = [a].concat(w.map((q) => ({ x: q.x, y: A.y, z: q.z }))); pts[pts.length - 1] = { x: A.x, y: A.y, z: A.z };
    let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    S.push(this.mk(pts, Math.max(0.3, L / 1.2) * Math.max(sc, 0.5), sc < 0.5 ? "trot" : "walk"));
    const f0 = R.foots[0], y0 = ANG(f0.x - A.x, f0.z - A.z);
    if (long) { S.push(this.mk([A, A], 0.8 * sc, "look", { yaw: y0 })); S.push(this.mk([A, A], 0.9 * sc, "creep", { yaw: y0, wiggle: true })); }
    let prev = { x: A.x, y: A.y, z: A.z };
    for (const f of R.foots) { S.push(this.mk([prev, f], 0.52 * Math.max(sc, 0.3), "climb", { arc: 0.12, ease: true })); if (long) S.push(this.mk([f, f], 0.26 * sc, "sit")); prev = f; }
    const E = R.exit; S.push(this.mk([prev, E], 0.5 * Math.max(sc, 0.3), "climb", { arc: 0.1, ease: true }));
    S.push(this.mk([E, b], Math.max(0.3, Math.hypot(b.x - E.x, b.z - E.z) / 0.6) * Math.max(sc, 0.4), "creep"));
    return S;
  }
  stagesDown(R, a, b, sc) {
    const S = [], long = sc >= 0.4; const E = R.exit;
    S.push(this.mk([a, E], Math.max(0.3, Math.hypot(a.x - E.x, a.z - E.z) / 0.6) * Math.max(sc, 0.4), "creep"));
    const last = R.foots[R.foots.length - 1]; if (long) S.push(this.mk([E, E], 0.7 * sc, "look", { yaw: ANG(last.x - E.x, last.z - E.z) }));
    let prev = { x: E.x, y: E.y, z: E.z };
    for (let i = R.foots.length - 1; i >= 0; i--) { const f = R.foots[i]; S.push(this.mk([prev, f], 0.46 * Math.max(sc, 0.3), "jump_down", { arc: 0.1, ease: true })); if (long) S.push(this.mk([f, f], 0.24 * sc, "sit")); prev = f; }
    const A = R.ground; S.push(this.mk([prev, { x: A.x, y: A.y, z: A.z }], 0.5 * Math.max(sc, 0.3), "jump_down", { arc: 0.12, ease: true, dip: 0.05 }));
    const w = this.dio.route(A.x, A.z, b.x, b.z); const pts = [{ x: A.x, y: A.y, z: A.z }].concat(w.map((q) => ({ x: q.x, y: b.y, z: q.z }))); pts[pts.length - 1] = { x: b.x, y: b.y, z: b.z };
    let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    if (L > 0.1) S.push(this.mk(pts, Math.max(0.3, L / 1.2) * Math.max(sc, 0.5), sc < 0.5 ? "trot" : "walk"));
    return S;
  }
  buildPath(kind, a, b, before, env) {
    const C = env.consts; const P = [{ x: a.x, y: a.y, z: a.z }];
    if (before.layer === C.FLOOR && env.layer === C.FLOOR && kind !== "enter" && kind !== "leave") {
      for (const w of this.dio.route(a.x, a.z, b.x, b.z)) P.push({ x: w.x, y: b.y, z: w.z });
      P[P.length - 1] = { x: b.x, y: b.y, z: b.z };
    } else if (kind === "climb" && b.y > a.y + 0.3) { P.push({ x: a.x, y: b.y, z: a.z }, { x: b.x, y: b.y, z: b.z });     // まっすぐ上がってから、面の上へ
    } else if ((kind === "jump" || kind === "walk") && a.y > b.y + 0.3) { P.push({ x: b.x, y: a.y, z: b.z }, { x: b.x, y: b.y, z: b.z });   // 縁から出てから、まっすぐ降りる
    } else P.push({ x: b.x, y: b.y, z: b.z });
    // 長さ(水平+垂直)
    let tot = 0; P[0].s = 0; for (let i = 1; i < P.length; i++) { tot += Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y, P[i].z - P[i - 1].z); P[i].s = tot; }
    P.total = tot; return P;
  }
  faceToy(env, from, yaw) { const t = this.dio.cellPos(env.consts.FLOOR, env.consts.TOY_XY[0], env.consts.TOY_XY[1]); return ANG(t.x - 0.3 - from.x, t.z - 0.25 - from.z) || yaw; }

  // 毎フレーム
  update(dt, nowMs, env, camPos) {
    const p = this.plan, c = this.cur;
    let pose = this.pose; this.wiggle = false;
    if (p && p.stages) {
      const el = nowMs - p.t0; let acc = 0, st = null, u = 1;
      for (const s of p.stages) { if (el < acc + s.dur) { st = s; u = (el - acc) / s.dur; break; } acc += s.dur; }
      if (!st) { st = p.stages[p.stages.length - 1]; u = 1; }
      const pt = st.pts, e = st.ease ? ease(u) : u; let hdg = null;
      if (pt.length > 1 && pt.total > 1e-4) {
        const s = e * pt.total; let i = 1; while (i < pt.length - 1 && pt[i].s < s) i++;
        const A = pt[i - 1], B = pt[i]; const k = B.s > A.s ? Math.min(1, Math.max(0, (s - A.s) / (B.s - A.s))) : 1;
        c.x = lerp(A.x, B.x, k); c.z = lerp(A.z, B.z, k); c.y = lerp(A.y, B.y, k) + st.arc * Math.sin(Math.PI * e);
        if (Math.hypot(B.x - A.x, B.z - A.z) > 0.05) hdg = Math.atan2(B.x - A.x, B.z - A.z);
      } else { c.x = pt[0].x; c.z = pt[0].z; c.y = pt[0].y; }
      if (st.dip && u > 0.8) c.y -= st.dip * Math.sin(Math.PI * (u - 0.8) / 0.2);          // 着地で少し沈む
      const want = st.yaw != null ? st.yaw : hdg; if (want != null) { let d2 = want - c.yaw; d2 = Math.atan2(Math.sin(d2), Math.cos(d2)); c.yaw += d2 * Math.min(1, dt * 10); }
      pose = el >= p.dur ? p.after || st.pose : st.pose; this.wiggle = st.wiggle;
    } else if (p) {
      const t = Math.min(1, (nowMs - p.t0) / Math.max(1, p.dur));
      const e = ease(t);
      const pt = p.path;
      if (pt && pt.length > 1 && pt.total > 1e-4) {
        const s = e * pt.total; let i = 1; while (i < pt.length - 1 && pt[i].s < s) i++;
        const A = pt[i - 1], B = pt[i]; const u = B.s > A.s ? Math.min(1, Math.max(0, (s - A.s) / (B.s - A.s))) : 1;
        c.x = lerp(A.x, B.x, u); c.z = lerp(A.z, B.z, u); c.y = lerp(A.y, B.y, u) + p.arc * Math.sin(Math.PI * e);
        const hx = B.x - A.x, hz = B.z - A.z; p.seg = Math.hypot(hx, hz) > 0.05 && t < 1 ? Math.atan2(hx, hz) : null;     // 歩いている向き
      } else {
        c.x = lerp(p.from.x, p.to.x, e); c.z = lerp(p.from.z, p.to.z, e);
        c.y = lerp(p.from.y, p.to.y, e) + p.arc * Math.sin(Math.PI * e); p.seg = null;
      }
      const want = p.seg != null && (p.kind === "walk" || p.kind === "sit") ? p.seg : p.yaw1;
      if (p.seg != null && (p.kind === "walk" || p.kind === "sit")) { let d2 = want - c.yaw; d2 = Math.atan2(Math.sin(d2), Math.cos(d2)); c.yaw += d2 * Math.min(1, dt * 9); }
      else { let dy = p.yaw1 - p.yaw0; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.yaw = p.yaw0 + dy * Math.min(1, t * 2.4); }
      if (t >= 1 && p.after) pose = p.after;
    }
    // 鍋の中では、座る・見る・毛づくろい・鳴く・香箱は、丸まる姿勢に(上体を起こすとしっぽが壁の外へ出るため)。伸びだけはそのまま
    // 鍋の中に居る間は、一手ごとに(新しい動きが始まるたびに)収め直さない: 入り終えたら「落ち着いた」を保ち、鍋を出るまで fitInPot が出した位置・持ち上げ・傾きをそのまま使う
    const inPotCell = !!(env && env.layer === env.consts.INSIDE && this.dio.dyn.potGeom && env.names[env.consts.idx3(env.consts.INSIDE, env.y, env.x)] === "鍋");
    if (!inPotCell) this.potSettled = false; else if (!this.potSettled && (!p || nowMs >= p.t0 + Math.min(p.dur, 700))) this.potSettled = true;
    const inPot = inPotCell && !!this.potSettled;
    const potCell = inPot;
    if (potCell && pose !== "curl") pose = "curl";
    // 足元に物(出したばかりのうんち・置かれた皿…)の箱が現れたら、次の一手を待たずに、離れた側へ歩いて退く
    if (env && env.layer === env.consts.FLOOR && c.y < 0.5 && (!p || nowMs >= p.t0 + p.dur) && nowMs - (this._nudgeAt || -1e9) > 2500 && !this.rubWho) {
      const w = this.dio.pushOut(c.x, c.z, 0.27 * 1.04);                // 通常の間合い(0.27)の外まで退く(間合いの縁に止まらない)
      if (Math.hypot(w[0] - c.x, w[1] - c.z) > 0.015 && !this.dio.pushOutFree(c.x, c.z, 0.27 * 0.98)) {
        this._nudgeAt = nowMs; const a = { x: c.x, y: c.y, z: c.z }, b = { x: w[0], y: c.y, z: w[1] };
        const path = this.buildPath("walk", a, b, { layer: env.consts.FLOOR }, env); const L = path.total || 0.3;
        this.plan = { from: a, to: b, path, stages: null, yaw0: c.yaw, yaw1: ANG(b.x - a.x, b.z - a.z), t0: nowMs, dur: Math.max(500, L / 0.7 * 1000), arc: 0, kind: "walk", pose: "walk", after: "sit", afterT: 0 };
        this.pose = "walk"; this.poseAfter = "sit";
      }
    }
    // 仕草の上乗せ
    const R = this.mesh.root; let wob = 0, jx = 0, jz = 0;
    const tt = nowMs / 1000;
    if (this.wiggle) wob = 0.12 * Math.sin(tt * 16);                                       // 跳ぶ前の、低く構えて小さくおしりを振る
    if (env && env.bird && env.layer === 1 && env.x === env.consts.SILL[0] && env.y === env.consts.SILL[1] && pose !== "walk" && pose !== "jump_down") { wob = 0.1 * Math.sin(tt * 15); pose = pose === "sit" || pose === "look" ? "creep" : pose; }   // スズメを見ておしりぷりぷり
    if (env && env.cl_Dc > 0.6 && !(this.curInfo && this.curInfo.sleeping)) { jx = 0.004 * Math.sin(tt * 52); jz = 0.004 * Math.cos(tt * 47); }   // ふるえ
    // 止まっている姿勢どうしの入れ替えは、最低 0.9 秒は保つ(倍速で一手ごとに姿勢が替わるとちらつくので)
    const MOVE = ["walk", "trot", "creep", "climb", "jump_down", "rub"];
    if (this._shown == null) { this._shown = pose; this._since = nowMs; }
    if (pose !== this._shown) {
      if (MOVE.includes(pose) || MOVE.includes(this._shown) || nowMs - this._since > 900) { this._shown = pose; this._since = nowMs; }
      else pose = this._shown;
    }
    // 鍋の中に居る(入り終えた)間は、体を鍋の内壁の内側へ収める(姿勢・しっぽの揺れに依らず、毎フレーム測って寄せる)
    const F = this.fit || (this.fit = { ox: 0, oz: 0, dy: 0 });
    if (!inPot) { F.ox *= 0.8; F.oz *= 0.8; F.dy *= 0.8; }
    jx += F.ox; jz += F.oz;
    F.k = (F.k || 0) + ((inPot ? 1 : 0) - (F.k || 0)) * 0.1; const sq = 1 - 0.08 * F.k;       // 鍋の中では、体の横幅を数 % つぶす(脇が鍋に押される)
    this.mesh.root.scale.set(1.3 * sq, 1.3, 1.3 * sq);
    this.mesh.setTailTune(inPot ? TAIL_POT : null);
    const state = { pose, mood: this.mood, yaw: c.yaw + wob, y: c.y + F.dy };
    if (this.rubWho) state.rubWho = this.rubWho;                 // すり寄りは Argon が相手の足元を回る(位置は任せる)
    else { R.position.set(c.x + jx, c.y + F.dy, c.z + jz); state.x = c.x + jx; state.z = c.z + jz; }
    this.mesh.update(dt, state, nowMs, camPos, null, (who) => (who === "human" && env.hu_here ? { x: this.dio.cellPos(0, env.hu_xy[0], env.hu_xy[1]).x + 0.3, z: this.dio.cellPos(0, env.hu_xy[0], env.hu_xy[1]).z + 0.3 } : null));
    if (this.rubWho) { c.x = R.position.x; c.z = R.position.z; }
    this.shownPose = pose;
    applyPotTilt(this.mesh.root, F, inPot && !this.rubWho);
    if (inPot && !this.rubWho) fitInPot(this.mesh.root, this.dio.dyn.potGeom, F);
  }
}
