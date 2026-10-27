// 近づいてくるもの(approach.py の写し、猫 1 匹)。
// 鶏・犬・子ども・大人・よその猫・カラスが入口から猫のいるあたりへ来る。気づかれると驚く(届く高さの外なら驚かない)・同じマスで気づかれると捕まる。
// 猫が何をすべきかは一つも書かない(体に起きることだけ)。
(function (root) {
  "use strict";
  const ENTRANCES = [[3, 0], [0, 5], [7, 0], [9, 1], [9, 4]];   // 店の戸口・台所の勝手口・庭の木戸・道(北)・道(南)

  class Approachers {
    constructor(env, C, rng, noticeHeight) {
      this.env = env; this.rng = rng;
      this.on = !!C.on;
      this.hours = [+C.hours[0], +C.hours[1]];
      const active_ticks = (this.hours[1] - this.hours[0]) / 24.0 * env.T_day;
      this.p_tick = +C.per_day / active_ticks;
      this.min_d = Math.trunc(C.min_spawn_dist); this.linger = Math.trunc(C.linger_ticks); this.nd = Math.trunc(C.notice_dist);
      this.p_near = +C.p_near; this.c_h = +C.c_h; this.c_f = +C.c_f;
      this.c_smell = +(C.c_smell || 0);
      this.startle = +C.startle_U;
      this.notice_height = !!noticeHeight;
      this.active = false; this.ax = 0; this.ay = 0; this.gx = 0; this.gy = 0; this.left = 0;
      this.near_once = false; this.seen_once = false; this.t_seen = -1;
      this.kind = 0;
      const R = C.reach || {};
      this.reach_on = !!R.on;
      this.kind_names = [];
      if (this.reach_on) {
        const mix = R.mix[R.world];
        const kinds = R.kinds.filter((k) => k.name in mix);
        this.kind_names = kinds.map((k) => k.name);
        this.kind_reach = kinds.map((k) => +k.reach_h);
        const rate = this.kind_names.map((k) => +(mix[k] || 0));
        const sum = rate.reduce((a, b) => a + b, 0);
        this.p_tick = sum / active_ticks;
        this.kind_p = rate.map((x) => x / sum);
        this.kind_rng = null;     // Env が六つ目の spawn を入れる
      }
      const CA = C.catch || {};
      this.catch_on = this.reach_on && !!CA.on;
      if (this.catch_on) {
        this.catch_pain = this.kind_names.map((k) => +CA.kinds[k].pain);
        this.catch_inj = this.kind_names.map((k) => +CA.kinds[k].injury);
        this.catch_days = this.kind_names.map((k) => +CA.kinds[k].days);
      }
      const IN = C.indoor || {};
      this.indoor_on = this.reach_on && !!IN.on;
      if (this.indoor_on) {
        const ne = new Set(IN.no_entry);
        this.kind_noentry = this.kind_names.map((k) => ne.has(k));
        const { W } = env.consts;
        this.indoor_map = (y, x) => env.P.indoor[y * W + x] > 0.5;
        this.ent_in = ENTRANCES.map(([x, y]) => this.indoor_map(y, x));
      }
    }
    reset() { this.active = false; this.near_once = false; this.seen_once = false; this.t_seen = -1; }
    // 猫の見える半径の中にいる時だけ [seen, dx, dy]
    visible() {
      const env = this.env;
      const rad = 1 + env.cfg.view.view_cells * env.here(env.P.view);
      const dx = this.ax - env.x, dy = this.ay - env.y;
      const s = this.active && Math.max(Math.abs(dx), Math.abs(dy)) <= rad;
      return [s, s ? dx : 0, s ? dy : 0];
    }
    kindObs(seen, out, off) {     // 見えている種類(一つだけ 1)
      for (let k = 0; k < this.kind_names.length; k++) out[off + k] = 0;
      if (seen) out[off + this.kind] = 1.0;
    }
    noticeP() {
      const env = this.env;
      const h = env.here(env.P.h);
      const faces = Math.max(env.here(env.P.faces), 1);
      const fh = this.notice_height ? (1 - this.c_h * Math.min(h, 2) / 2) : 1.0;
      const ff = 1 - this.c_f * (faces - 1) / 5;
      if (env.scent_on) return Math.min(1.0, this.p_near * fh * ff * (1 + this.c_smell * env.scentNear()));
      return this.p_near * fh * ff;
    }
    // 猫の手の後・新しい場所で。st は体の状態(書きかえる)。doneNext: このティックで暮らしが終わる。ndExtra: 外で鳴いた後の気づく距離の延び
    step(st, hour, doneNext, ndExtra) {
      const env = this.env, r = this.rng;
      const { W, H } = env.consts;
      const act0 = this.active;
      const dx = this.gx - this.ax, dy = this.gy - this.ay;
      const at_goal = dx === 0 && dy === 0;
      const horiz = Math.abs(dx) >= Math.abs(dy);
      const mvx = act0 && !at_goal && horiz, mvy = act0 && !at_goal && !horiz;
      let nax = this.ax + (mvx ? Math.sign(dx) : 0), nay = this.ay + (mvy ? Math.sign(dy) : 0);
      if (this.indoor_on) {      // 入れない種類は家の中への一歩を打たず、そこを行き先にしてとどまる
        const blk = (mvx || mvy) && this.kind_noentry[this.kind] && this.indoor_map(nay, nax);
        if (blk) { this.gx = this.ax; this.gy = this.ay; nax = this.ax; nay = this.ay; }
      }
      this.ax = nax; this.ay = nay;
      if (act0 && at_goal) this.left -= 1;
      const gone = act0 && at_goal && this.left < 0;
      let sv = this.visible()[0];
      sv = sv && act0 && !gone;
      const newly = sv && !this.seen_once;
      this.t_seen = newly ? 0 : (this.seen_once ? this.t_seen + 1 : -1);
      this.seen_once = this.seen_once || sv;
      const d = Math.max(Math.abs(this.ax - env.x), Math.abs(this.ay - env.y));
      const near = act0 && !gone && d <= (ndExtra == null ? this.nd : this.nd + ndExtra);
      const first_near = near && !this.near_once;
      this.near_once = this.near_once || near;
      const p = this.noticeP();
      const u = r.random();                                   // 毎ティック引く(numpy の & は短絡しない)
      let noticed = near && (u < p) && !doneNext;
      let unreach = false;
      if (this.reach_on) {
        unreach = noticed && (env.here(env.P.h) > this.kind_reach[this.kind] + 1e-9);
        noticed = noticed && !unreach;
      }
      if (noticed) st[5] = Math.max(st[5], this.startle);
      const caught = this.catch_on ? (noticed && d === 0) : false;
      const end_noticed = noticed, end_unnoticed = gone && !noticed;
      const rec = { ap_noticed: end_noticed, ap_left_unnoticed: end_unnoticed, ap_near: near, ap_first_near: first_near, ap_noticed_unreach: unreach,
        ap_kind: this.kind, ap_caught: caught, ap_dist: d };
      if (end_noticed || gone) this.active = false;
      // 現れる(来ていない時。活動の時刻だけ)
      const hr_ok = hour >= this.hours[0] && hour < this.hours[1];
      const u2 = r.random();
      const spawn = this.on && !this.active && hr_ok && (u2 < this.p_tick) && !doneNext;
      if (spawn) {
        if (this.reach_on) this.kind = this.kind_rng.choice(this.kind_p);
        const E = ENTRANCES.length;
        const de = ENTRANCES.map(([ex, ey]) => Math.max(Math.abs(ex - env.x), Math.abs(ey - env.y)));
        let ok = de.map((v) => v >= this.min_d);
        let far_de = de;
        if (this.indoor_on) {
          const allow = this.ent_in.map((inn) => !(this.kind_noentry[this.kind] && inn));
          ok = ok.map((v, j) => v && allow[j]);
          far_de = de.map((v, j) => (allow[j] ? v : -1));
        }
        const rr = []; for (let j = 0; j < E; j++) rr.push(r.random());
        const sc = ok.map((v, j) => (v ? rr[j] : -1.0));
        const argmax = (a) => { let b = 0; for (let j = 1; j < a.length; j++) if (a[j] > a[b]) b = j; return b; };
        const far = argmax(far_de);
        const j = ok.some((v) => v) ? argmax(sc) : far;
        this.ax = ENTRANCES[j][0]; this.ay = ENTRANCES[j][1];
        this.gx = Math.min(Math.max(env.x + r.integers(-1, 2), 0), W - 1);
        this.gy = Math.min(Math.max(env.y + r.integers(-1, 2), 0), H - 1);
        this.left = this.linger;
        this.active = true;
        this.near_once = false; this.seen_once = false; this.t_seen = -1;
      }
      rec.ap_spawn = spawn; rec.ap_active = this.active;
      return rec;
    }
  }

  const api = { Approachers, ENTRANCES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.Neko = root.Neko || {}; root.Neko.approach = api; }
})(typeof self !== "undefined" ? self : this);
