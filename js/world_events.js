// 006c 外の世界の出来事(world_events.py の写し、猫 1 匹)。
// 見つけ物・こわいもの・洗濯かご・水たまり・焼けた石畳・歩きの重さ。心の項ではなく、猫の体に起きることだけ。行動は一つも書かない。
(function (root) {
  "use strict";
  const WET_GROUND = ["庭", "庭木の陰", "石畳", "駐車場"], PAVEMENT = ["石畳", "駐車場"];

  class WorldEvents {
    constructor(env, C, rng) {
      this.env = env; this.rng = rng;
      this.on = !!C.on;
      this.types = env.place_types;
      const K = this.types.length;
      this.K = K;
      this.p_food = new Float64Array(K); this.food_mag = new Float64Array(K); this.p_scary = new Float64Array(K);
      for (const [k, v] of Object.entries(C.food.places)) { const j = this.types.indexOf(k); this.p_food[j] = v.p_day; this.food_mag[j] = v.hunger; }
      for (const [k, v] of Object.entries(C.scary.places)) this.p_scary[this.types.indexOf(k)] = v.p_day;
      this.startle = +C.scary.startle_U; this.raise_ = +C.scary.U_target_raise;
      this.p_basket = +C.basket.p_day;
      this.basket_cells = C.basket.cells.map((c) => [c[0], c[1]]);
      this.p_puddle = +C.puddle.p_day;
      this.pud_dirt = +C.puddle.dirt_per_tick; this.pud_cool = +C.puddle.cool_C;
      this.pave_smin = +C.pavement.season_min; this.pave_gain = +C.pavement.c_paw * +C.pavement.surf_excess_C;
      this.walk_extra = +C.walk.extra_per_step; this.walk_cap = +C.walk.cap_steps;
      const { W, H } = env.consts;
      this.wet = new Uint8Array(H * W); this.pave = new Uint8Array(H * W);
      for (let i = 0; i < H * W; i++) { this.wet[i] = WET_GROUND.includes(env.names[i]) ? 1 : 0; this.pave[i] = PAVEMENT.includes(env.names[i]) ? 1 : 0; }
      this.food = new Uint8Array(K); this.scary = new Uint8Array(K); this.scared = new Uint8Array(K);
      this.basket = false; this.basket_i = 0; this.puddle = false; this.trip = 0;
    }
    // 一日の始まり。startType: 始まりの場所の種類(そこには見つけ物を置かない)
    reset(startType) {
      const r = this.rng, K = this.K;
      for (let k = 0; k < K; k++) this.food[k] = (r.random() < this.p_food[k]) && this.on ? 1 : 0;
      for (let k = 0; k < K; k++) this.scary[k] = (r.random() < this.p_scary[k]) && this.on ? 1 : 0;
      this.scared.fill(0);
      this.basket = (r.random() < this.p_basket) && this.on;
      this.basket_i = r.integers(0, this.basket_cells.length);
      this.puddle = (r.random() < this.p_puddle) && this.on;
      this.trip = 0;
      this.food[startType] = 0; this.scary[startType] = 0;
    }
    basketHereAt(x, y) { return this.basket && this.basket_cells[this.basket_i][0] === x && this.basket_cells[this.basket_i][1] === y; }
    // 床の層の感じる温度の足し ℃(水たまりの濡れた足 −、夏の焼けた石畳 +)
    tempAddAt(y, x, sun, season) {
      const { W } = this.env.consts; const i = y * W + x;
      const wet = -this.pud_cool * (this.puddle ? 1 : 0) * this.wet[i];
      const hot = this.pave_gain * 1 * (sun * (season >= this.pave_smin ? 1 : 0)) * this.pave[i];
      return wet + hot;
    }
    paveAddAt(y, x, sun, season) {
      const { W } = this.env.consts;
      return this.pave_gain * 1 * (sun * (season >= this.pave_smin ? 1 : 0)) * this.pave[y * W + x];
    }
    dirtAdd(layer, x, y) {
      const { W } = this.env.consts;
      return this.pud_dirt * (this.puddle ? 1 : 0) * (layer === 0 ? 1 : 0) * this.wet[y * W + x];
    }
    uTargetAdd(tk) { return this.raise_ * this.scared[Math.max(tk, 0)] * (tk >= 0 ? 1 : 0); }
    // 手の後・新しい場所で。st は体の状態(書きかえる)
    onStep(st, moved, still, firstArrival, tk) {
      this.trip = still ? 0 : this.trip + (moved ? 1 : 0);
      st[1] += (this.on ? 1 : 0) * this.walk_extra * Math.min(this.trip, this.walk_cap) / this.walk_cap * (moved ? 1 : 0);
      const tkc = Math.max(tk, 0);
      const fa = firstArrival && tk >= 0;
      const ate = fa && this.food[tkc] === 1;
      st[0] -= this.food_mag[tkc] * (ate ? 1 : 0);
      if (ate) this.food[tkc] = 0;
      const met = fa && this.scary[tkc] === 1;
      if (met) st[5] = Math.max(st[5], this.startle);
      if (met) { this.scared[tkc] = 1; this.scary[tkc] = 0; }
      return { ev_food: ate, ev_scary: met };
    }
  }

  const api = { WorldEvents };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.Neko = root.Neko || {}; root.Neko.world_events = api; }
})(typeof self !== "undefined" ? self : this);
