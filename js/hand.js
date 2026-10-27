// 撫でる手(見た目だけ)。猫の頭から背中へ、2〜3 回なでる。猫の手(行動)と姿勢には触らない: 心に触覚が無いので、反応は描かない。
// 猫が動いていても、頭(head)・胸(chest)・腰(hip)の部品の位置に毎フレーム付いていく。
import * as THREE from "three";

const SKIN = 0xf0cdb0, INK = 0x4a3524;
const DUR = 2700, STROKE = 850;                       // 全体 2.7 秒、一なでが 0.85 秒(3 回)
const _b = new THREE.Box3(), _u = new THREE.Box3();
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

export class PetHand {
  constructor(scene) {
    this.active = false; this.t0 = 0; this.root = null; this.parts = null;
    const g = new THREE.Group(); g.visible = false; this.g = g; scene.add(g);
    const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.85, metalness: 0 });
    const ink = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
    const add = (geo, x, y, z, rx, ry, rz, sx, sy, sz) => {                    // 肌の面 + 縁取り(裏向きの少し大きい殻)
      const m = new THREE.Mesh(geo, skin); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx || 1, sy || 1, sz || 1); m.castShadow = true;
      const o = new THREE.Mesh(geo, ink); o.scale.setScalar(1.14); m.add(o); g.add(m); return m;
    };
    const finger = (x, z, len) => add(new THREE.CapsuleGeometry(0.0145, len, 4, 8), x, 0, z + len / 2 + 0.01, Math.PI / 2, 0, 0);
    add(new THREE.SphereGeometry(1, 16, 10), 0, 0, 0, 0, 0, 0, 0.064, 0.02, 0.068);            // てのひら
    finger(-0.043, 0.04, 0.034); finger(-0.0145, 0.052, 0.046); finger(0.0145, 0.05, 0.04); finger(0.042, 0.04, 0.03);
    add(new THREE.CapsuleGeometry(0.016, 0.03, 4, 8), 0.07, 0, 0.02, Math.PI / 2, 0, 0).rotation.set(Math.PI / 2, 0, -0.9);   // 親指
    add(new THREE.CapsuleGeometry(0.026, 0.05, 4, 8), 0, 0.004, -0.095, Math.PI / 2, 0, 0);       // 手首
  }
  start(now) { this.active = true; this.t0 = now; this.g.visible = true; }
  stop() { this.active = false; this.g.visible = false; }
  _find(root) {
    const p = { head: [], chest: [], hip: [] };
    root.traverse((o) => { if (o.isMesh && p[o.name]) p[o.name].push(o); });
    this.root = root; this.parts = p;
  }
  _box(list, out) { _u.makeEmpty(); for (const m of list) { _b.setFromObject(m); _u.union(_b); } if (_u.isEmpty()) return false; out.min.copy(_u.min); out.max.copy(_u.max); return true; }
  update(now, actor) {
    if (!this.active) return; const t = now - this.t0;
    if (t >= DUR || !actor || !actor.mesh) { this.stop(); return; }
    const root = actor.mesh.root; if (root !== this.root || !this.parts) this._find(root);
    root.updateMatrixWorld(true);
    const bh = new THREE.Box3(), bc = new THREE.Box3(), bp = new THREE.Box3();
    const okH = this._box(this.parts.head, bh), okC = this._box(this.parts.chest, bc), okP = this._box(this.parts.hip, bp);
    if (!okH || !okP) { _b.setFromObject(root); const c = _b.getCenter(new THREE.Vector3()); const y = _b.max.y; const dx = Math.sin(actor.cur.yaw), dz = Math.cos(actor.cur.yaw);   // 部品が無い時は、体全体の箱と向きから
      bh.min.set(c.x + dx * 0.2, y, c.z + dz * 0.2); bh.max.copy(bh.min); bp.min.set(c.x - dx * 0.2, y, c.z - dz * 0.2); bp.max.copy(bp.min); bc.copy(bh); }
    else if (!okC) bc.copy(bp);
    const H = bh.getCenter(new THREE.Vector3()), C = bc.getCenter(new THREE.Vector3()), P = bp.getCenter(new THREE.Vector3());
    let dx = P.x - H.x, dz = P.z - H.z; const L = Math.hypot(dx, dz); if (L < 0.05) { dx = -Math.sin(actor.cur.yaw); dz = -Math.cos(actor.cur.yaw); } else { dx /= L; dz /= L; }
    // 一なで: 0〜0.8 は頭→腰へ滑る、0.8〜1 は少し持ち上げて頭へ戻る
    const k = Math.floor(t / STROKE), ph = (t - k * STROKE) / STROKE;
    const u = ph < 0.8 ? smooth(ph / 0.8) : 1 - smooth((ph - 0.8) / 0.2);
    const lift = 0.014 + (ph >= 0.8 ? 0.06 * Math.sin(Math.PI * (ph - 0.8) / 0.2) : 0);
    const inE = 1 - smooth(t / 350), outE = smooth((t - (DUR - 450)) / 450);            // 降りてくる・上がって消える
    const topAt = u < 0.5 ? bh.max.y + (bc.max.y - bh.max.y) * (u / 0.5) : bc.max.y + (bp.max.y - bc.max.y) * ((u - 0.5) / 0.5);
    const x = H.x + (P.x - H.x) * u, z = H.z + (P.z - H.z) * u;
    this.g.position.set(x, topAt + 0.02 + lift + 0.13 * inE + 0.13 * outE, z);
    this.g.rotation.set(0.1 + 0.05 * Math.sin(t * 0.012), Math.atan2(dx, dz) + 0.7, 0, "YXZ");
    this.g.scale.setScalar(1.25 * (0.8 + 0.2 * (1 - inE) * (1 - outE)));
  }
}
