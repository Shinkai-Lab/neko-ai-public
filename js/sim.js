// 猫の世界(sim.py の Env の写し、猫 1 匹)。
// 格子の家・気候の体(風・床・蒸発・活動の熱・ふるえ・丸まり)・二層の空腹・水・排せつ・匂い・毛・汚れた食べ物・脂肪・怪我・上の層の移動・
// 窓の外の鳥・紐のおもちゃ・新しい箱・声と人と同居の猫・皿の中身。Python と同じ式・同じ乱数の引き方。
// **行動は一つも書かない**(Python と同じ)。猫の「手」を選ぶのは mind.js の学習済みの心。
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const C = isNode ? require("./consts.js") : root.Neko.consts;
  const RNG = isNode ? require("./rng.js") : root.NekoRng;
  const WorldEvents = (isNode ? require("./world_events.js") : root.Neko.world_events).WorldEvents;
  const Approachers = (isNode ? require("./approach.js") : root.Neko.approach).Approachers;
  const { W, H, FLOOR, TOP, INSIDE, SIT, N_, E_, S_, W_, CLIMB, DESCEND, SLEEP, GROOM, EAT, ENTER, LEAVE, DRINK, ELIM, DIG, JUMP_N, JUMP_E, JUMP_S, JUMP_W, PAW, MEOW,
    N_ACTS, N_ACTS_OBS, N_ACTS0, DIRS4, DRIVES, OBS_DIM, OCC0, MASK0, V3_DIM, V31_0, POT, POT_PRESENT, POT_OCCUPIED, BOX_CANDIDATES, PARK, BOWL, HEATER, WATER,
    SOIL_FLOOR, SOIL_INSIDE, SILL, TOY_XY, NEWBOX_XY, MATERIALS, MATERIAL_OF, OUTDOOR_GROUND, idx3 } = C;
  const NC = 3 * H * W;
  const clip = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const mod = (a, m) => ((a % m) + m) % m;
  const sq = (v) => v * v;
  const pw = (v, k) => (k === 2 ? v * v : Math.pow(v, k));

  class Env {
    // opts: {arm: "XV"|"XV0", events: true, approach: true, world: "山"}
    constructor(cfg0, seed, opts) {
      opts = opts || {};
      const cfg = JSON.parse(JSON.stringify(cfg0));
      if (opts.world && cfg.approach.reach) cfg.approach.reach.world = opts.world;
      this.nActs = opts.nActs || N_ACTS;     // その実験の手の数(x11 20・x12 21・x06c〜x10b 15)。観測の最後の「増えた手のできる手」の列の数が変わる
      this.cfg = cfg; this.consts = C;
      this.arm = opts.arm || "XV";
      this.rng = new RNG.Generator(seed);
      const rng = this.rng;
      this.arm_cfg = cfg.arms[this.arm];
      const VU = this.arm_cfg.vulnerable || {};
      if (VU.on) throw new Error("腕 V(vulnerable)は写していない");
      const IN = this.arm_cfg.inner || {};
      if (IN.on) throw new Error("腕 I(inner)は写していない");
      const IF = this.arm_cfg.innate_food_aversion || {};
      this.ifa_on = !!IF.on;
      this.ifa_mode = this.ifa_on ? String(IF.mode || "") : "";
      this.ifa_k = this.ifa_mode === "reward" ? +IF.k : 0.0;
      this.ifa_bias = this.ifa_mode === "logit" ? +IF.bias : 0.0;
      this.ifa_r = Math.trunc(IF.radius_steps != null ? IF.radius_steps : 2);
      const S = C.makeStatics(cfg);
      this.BOWL = S.BOWL; this.LITTER = S.LITTER; this.SUN_XS = S.SUN_XS; this.SUN_Y = S.SUN_Y;
      this.S = S; this.P = S.P; this.exists_static = S.exists; this.names = S.names; this.type_idx = S.type_idx;
      this.place_types = S.PLACE_TYPES; this.K_TYPES = S.K_TYPES; this.CONTAINERS = S.CONTAINERS;
      this.X11_BIRD = S.flags.bird; this.X11_TOY = S.flags.toy; this.X11_BOX = S.flags.box;
      this.X11_ANY = this.X11_BIRD || this.X11_TOY || this.X11_BOX;
      this.MEM_DIM = this.K_TYPES + 6;
      this.v3_dim = cfg.body_v33 ? V3_DIM : (cfg.body_v31 ? 27 : 19);     // 観測の後ろの体 v3 の列(x06 19・x06c/x06d 27・x07 以降 29)
      this.obs_dim = OBS_DIM + this.MEM_DIM + C.AP_DIM + C.SKY_DIM + C.WOB_DIM + this.v3_dim;
      const M = cfg.mind;
      this.nov_tau = +M.satiety.tau_ticks; this.nov_beta = +M.satiety.beta; this.nov_dref = +M.satiety.D_ref;
      this.since = new Float64Array(this.K_TYPES); this.visited = new Uint8Array(this.K_TYPES); this.cur_type = 0;
      const WE = Object.assign({}, cfg.world_events); WE.on = opts.events !== false;
      this.T_day = cfg.time.ticks_per_day;
      this.here = (arr) => arr[idx3(this.layer, this.y, this.x)];
      this.layer = FLOOR; this.x = 0; this.y = 0;
      const ev_seed = rng.spawn1();                               // 一つ目の spawn
      this.world = new WorldEvents(this, WE, new RNG.Generator(ev_seed));
      const D = cfg.drives, sw = D.safety;
      const w_h = +this.arm_cfg.w_height;
      this.safe = new Float64Array(NC); this.u_target = new Float64Array(NC);
      for (let i = 0; i < NC; i++) {
        this.safe[i] = sw.w_faces * (Math.max(this.P.faces[i], 1) - 1) / 5 + w_h * Math.min(this.P.h[i], 2) / 2;
        this.u_target[i] = D.unsafe_max * (1 - this.safe[i]);
      }
      this._climateInit(cfg);
      this.box_cell = null;
      // 囲いの中の体の熱
      const EH = cfg.enclosure_heat;
      const cspec = this.CONTAINERS.map((c) => EH.containers[S.heatOf[c] || c]);
      this.cont_G = cspec.map((c) => c.U * c.A_closed + EH.h_open * c.A_open);
      this.cont_dT = this.cont_G.map((g) => EH.cat_heat_W / g);
      this.cont_tau_s = cspec.map((c, k) => c.C / this.cont_G[k]);
      this.cont_alpha = this.cont_tau_s.map((t) => 1 - Math.exp(-cfg.time.minutes_per_tick * 60.0 / t));
      this.cont_xy = [null, [INSIDE, 4, 3], [INSIDE, 0, 2], null].concat(S.contXY).concat(this.X11_BOX ? [[INSIDE, NEWBOX_XY[0], NEWBOX_XY[1]]] : []);
      for (let k = 4; k < this.CONTAINERS.length; k++) { const [l_, x_, y_] = this.cont_xy[k]; if (this.names[idx3(l_, y_, x_)] !== this.CONTAINERS[k]) throw new Error("囲いの位置 " + this.CONTAINERS[k]); }
      if (this.names[idx3(INSIDE, 3, 4)] !== "紙袋" || this.names[idx3(INSIDE, 2, 0)] !== "鍋") throw new Error("囲いの位置");
      this.settle_k = new Float64Array(NC);
      for (let i = 0; i < NC; i++) this.settle_k[i] = this.P.wobbly[i] > 0.5 ? 1.0 - Math.exp(-1.0 / +cfg.x05.firmness.tau_wobble_ticks) : 1.0;
      this.z = 1.0; this.over = 0.0;
      const BV = cfg.body_v2;
      this.v2_ref = +BV.excess_ref; this.v2_cold = +BV.cold_C; this.v2_cut = +BV.recovery_cut; this.v2_safety = +BV.hunger_safety_cap;
      const AP = Object.assign({}, cfg.approach); AP.on = (opts.approach !== false) && (AP.on !== false);
      const ap_seed = rng.spawn1();                               // 二つ目
      this.approach = new Approachers(this, AP, new RNG.Generator(ap_seed), this.arm_cfg.notice_height);
      this.p_cloudy = +cfg.sky.p_cloudy;
      this.sky_rng = new RNG.Generator(rng.spawn1());             // 三つ目
      this.clear = true;
      const B3 = cfg.body_v3;
      this.v3 = { two_layer: !!B3.two_layer, water: !!B3.water, elim: !!B3.elim, carry: !!B3.carry };
      this.b3 = B3;
      const Sg = (cfg.climate && cfg.climate.stomach) || {};
      this.st_on = !!Sg.on;
      if (this.st_on) {
        const r = +Sg.capacity_g / +Sg.old_capacity_g;
        const b = Object.assign({}, B3);
        b.kappa = +Sg.capacity_g * +Sg.kcal_per_g / +cfg.climate.activity.kcal_per_hunger_unit;
        b.tau_stomach_ticks = +Sg.t_half_min / Math.log(2.0) / (1440.0 / cfg.time.ticks_per_day);
        b.bite_fill = +B3.bite_fill / r;
        b.food_water_per_digest = +B3.food_water_per_digest * r;
        b.bowel_per_digest = +B3.bowel_per_digest * r;
        for (let k = 0; k < this.world.K; k++) this.world.food_mag[k] = this.world.food_mag[k] / r;
        this.b3 = b;
      }
      this.v3_rng = new RNG.Generator(rng.spawn1());              // 四つ目
      const Ft = (cfg.climate && cfg.climate.fat) || {};
      this.fat_on = !!Ft.on && this.v3.two_layer;
      this.fat = 0.0;
      this.lep_on = false;
      if (this.fat_on) {
        this.fat_rng = new RNG.Generator(rng.spawn1());           // 五つ目
        const bw = +Ft.body_kg;
        this.fat_lo = +Ft.frac_min * bw; this.fat_hi = +Ft.frac_max * bw;
        this.fat_start = [+Ft.start_frac[0] * bw, +Ft.start_frac[1] * bw];
        this.fat_bw = bw;
        this.fat_units_per_kg = +Ft.kcal_per_kg / +cfg.climate.activity.kcal_per_hunger_unit;
        const Lp = Ft.leptin || {};
        this.lep_on = !!Lp.on;
        if (this.lep_on) {
          const b3 = this.b3;
          const A = +b3.kappa * this.T_day / +b3.tau_stomach_ticks * +cfg.climate.activity.kcal_per_hunger_unit;
          this.lep_lo = +Lp.frac_lo; this.lep_ref = +Lp.frac_ref;
          this.lep_c_ref = 1.0 - +Lp.maintenance_kcal / A - 0.5 * +b3.bite_fill;
          this.lep_A = A;
        }
      }
      if (this.approach.reach_on) this.approach.kind_rng = new RNG.Generator(rng.spawn1());   // 六つ目
      const CA = cfg.approach.catch || {};
      this.catch_on = this.approach.catch_on;
      this.inj = 0.0; this.inj_left = 0.0;
      if (this.catch_on) {
        this.catch_rng = new RNG.Generator(rng.spawn1());         // 七つ目
        this.pain_decay = Math.pow(0.5, 1.0 / +CA.pain_half_life_ticks);
        this.flee_fatigue = +CA.flee_fatigue; this.climb_power = +CA.climb_power;
      }
      const UP = cfg.upper || {};
      this.upper_on = !!UP.on && this.catch_on;
      this.up_land_n = 0.0;
      if (this.upper_on) {
        this.up_rng = new RNG.Generator(rng.spawn1());            // 八つ目
        this.up_walk_p = +UP.walk_p; this.up_fat_h = +UP.land_fatigue_per_height; this.up_m_per_h = +UP.m_per_h;
        this.up_p_ref = +UP.land_p_ref; this.up_h_ref = +UP.land_h_ref_m; this.up_pain = +UP.land_pain; this.up_inj = +UP.land_injury; this.up_days = +UP.land_days;
        const hh = this.P.h;
        this.top_nbr = new Uint8Array(4 * H * W); this.jump_ok = new Uint8Array(4 * H * W); this.jump_drop = new Float64Array(4 * H * W);
        for (let d = 0; d < 4; d++) {
          const [dx, dy] = DIRS4[d];
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const nx = x + dx, ny = y + dy;
            if (!(nx >= 0 && nx < W && ny >= 0 && ny < H)) continue;
            if (this.exists_static[idx3(TOP, y, x)]) {
              const k = (d * H + y) * W + x;
              this.jump_ok[k] = 1;
              this.jump_drop[k] = Math.max(hh[idx3(TOP, y, x)] - hh[idx3(FLOOR, ny, nx)], 0.0);
              this.top_nbr[k] = (this.exists_static[idx3(TOP, ny, nx)] && Math.abs(hh[idx3(TOP, ny, nx)] - hh[idx3(TOP, y, x)]) <= +UP.walk_max_dh + 1e-9) ? 1 : 0;
            }
          }
        }
        this.stand_drop = new Float64Array(H * W);
        for (let i = 0; i < H * W; i++) this.stand_drop[i] = Math.max(hh[NC / 3 + i] - hh[i], 0.0);
      }
      // x11: 世界の三つ
      const X11C = (cfg.x11 && cfg.x11.world) || {};
      this.bird = false; this.bird_scale = 1.0; this.toy_left = 0; this.newbox = false;
      if (this.X11_ANY) this.x11_rng = new RNG.Generator(rng.spawn1());   // 九つ目
      if (this.X11_BIRD) {
        const Bc = X11C.bird; this.bd = Bc;
        this.bd_leave = 1.0 / +Bc.stay_ticks; this.bd_lam = +Bc.visits_per_day;
        this.bd_w = [+Bc.w_dawn, +Bc.w_dusk, +Bc.w_day];
        this.bd_tph = 60.0 / +cfg.time.minutes_per_tick;
      }
      if (this.X11_TOY) { this.toy_swing = Math.trunc(X11C.toy.swing_ticks); this.toy_fat = +X11C.toy.paw_fatigue_x_move; }
      if (this.X11_BOX) this.nb_day = Math.trunc(X11C.box.day);
      this.x11_view = this.X11_ANY ? Math.trunc(X11C.view_cells != null ? X11C.view_cells : 3) : 0;
      this.ep_days = this.v3.carry ? Math.trunc(cfg.time.episode_days) : 1;
      this.mess = new Float64Array(NC);
      this.mess_f = new Float64Array(NC);       // 見た目用の台帳(物理・心には使わない): mess のうち便(固い物)の分。層ごとに持つ。尿と便の合算の mess では、床の便だけを塊に描けないため
      this.mess_decay = Math.pow(0.5, 1.0 / (+B3.mess_half_life_days * cfg.time.ticks_per_day));
      this.soil = new Uint8Array(NC);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        this.soil[idx3(FLOOR, y, x)] = SOIL_FLOOR.includes(this.names[idx3(FLOOR, y, x)]) ? 1 : 0;
        this.soil[idx3(INSIDE, y, x)] = SOIL_INSIDE.includes(this.names[idx3(INSIDE, y, x)]) ? 1 : 0;
      }
      if (this.LITTER) { if (this.names[idx3(FLOOR, this.LITTER[1], this.LITTER[0])] !== "台所") throw new Error("砂のマス"); this.soil[idx3(FLOOR, this.LITTER[1], this.LITTER[0])] = 1; }
      // 匂い(尿と便)
      const B31 = cfg.body_v31;
      this.scent_on = !!B31.scent && this.v3.elim;
      this.scent = new Float64Array(NC);
      this.scent_decay = Math.pow(0.5, 1.0 / (+B31.scent_half_life_days * cfg.time.ticks_per_day));
      const B34 = cfg.body_v34 || {};
      this.split_on = this.scent_on && !!B34.scent_split;
      if (this.split_on) {
        const tpd = cfg.time.ticks_per_day;
        this.scent_u = new Float64Array(NC); this.scent_f = new Float64Array(NC);
        this.decay_u = Math.pow(0.5, 1.0 / (+B34.urine_half_life_days * tpd));
        this.decay_f = Math.pow(0.5, 1.0 / (+B34.feces_half_life_days * tpd));
      }
      const B35 = cfg.body_v35 || {};
      this.gut_on = this.v3.elim && !!B35.food_soil;
      this.gut_cols = this.gut_on ? 1 : 0;
      this.obs_dim += this.gut_cols;
      this.ap_kind_cols = this.approach.reach_on ? this.approach.kind_names.length : 0;
      this.obs_dim += this.ap_kind_cols;
      this.catch_cols = (this.approach.reach_on && !!(cfg.approach.catch || {}).on) ? 2 : 0;
      this.obs_dim += this.catch_cols;
      // x12: 声・人・同居の猫・皿の中身
      const VC = this.arm_cfg.voice || {};
      this.voice_on = !!VC.on;
      this.x12_cols = 0;
      this.bowl_bites = 0.0; this.hu_wait = -1; this.hu_here = false; this.hu_xy = [0, 0];
      this.meow_age = 10000; this.hm_xy = [[0, 0], [0, 0]]; this.hm_fav = [[0, 0], [0, 0]]; this.hm_mode = [0, 0];
      this.hm_gather = 0; this.hu_d = 0; this.bowl_age = 0.0; this.served = 0.0; this.pt_on = false;
      this.fs_on = false; this.hu_loc = 0;
      if (this.voice_on) {
        const X12 = cfg.x12; this.x12 = X12;
        this.x12_rng = new RNG.Generator(rng.spawn1());           // 十個目
        this.hu_respond = VC.respond !== false;
        const Hh = X12.human;
        this.hu_h0 = +Hh.home_from; this.hu_h1 = +Hh.home_to; this.hu_p = +Hh.p_notice; this.hu_dly = [Math.trunc(Hh.delay_min), Math.trunc(Hh.delay_max)];
        this.out_range = Math.trunc(X12.voice.out_range_cells);
        this.ration = +X12.food.ration_bites;
        this.meal_ticks = X12.food.meal_hours.map((hh) => Math.round(+hh * cfg.time.ticks_per_day / 24.0));
        this.feed_bites = +X12.food.respond_bites; this.bowl0 = +X12.food.start_bites;
        const PT = X12.food.portion || {};
        this.pt_on = !!PT.on;
        if (this.pt_on) { this.pt_remove = Math.trunc(PT.remove_ticks); this.pt_limit = +PT.day_limit_x * this.ration; }
        this.meow_ticks = Math.trunc(X12.voice.notice_ticks); this.meow_nd = Math.trunc(X12.voice.notice_extra_cells);
        const HM = X12.housemates; this.hm_cfg = HM;
        this.hm_cells = HM.rest_cells; this.hm_view = Math.trunc(HM.view_cells);
        this.x12_cols = 8;
        const FS = X12.footsteps || {};                 // x12c: 人の物音の列(起きて家にいる時間帯だけ、距離で弱まる)
        this.fs_on = !!FS.on;
        if (this.fs_on) {
          this.fs_zero = !!FS.zero; this.fs_lv = +FS.level_db; this.fs_bg = +FS.bg_db; this.fs_cell = +FS.cell_m; this.fs_wall = +FS.wall_db;
          this.fs_locs = FS.locations; this.fs_pmove = +FS.p_move;
          this.fs_rng = new RNG.Generator(rng.spawn1());   // 十一個目
          this.x12_cols += 1;
        }
        // 家の中(床の indoor のマス)までのチェビシェフ距離
        const inCells = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (this.P.indoor[idx3(FLOOR, y, x)] > 0.5) inCells.push([y, x]);
        this._hd_map = new Int32Array(H * W);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          let m = 1e9; for (const [cy, cx] of inCells) m = Math.min(m, Math.max(Math.abs(y - cy), Math.abs(x - cx)));
          this._hd_map[y * W + x] = m;
        }
      }
      this.x11_world_cols = this.X11_ANY ? 8 : 0;
      this.x11_mask_cols = this.nActs - N_ACTS_OBS;
      this.x11_cols = this.x11_world_cols + this.x11_mask_cols;
      this.obs_dim += this.x11_cols + this.x12_cols;
      this.tail_cols = this.gut_cols + this.ap_kind_cols + this.catch_cols + this.x11_cols + this.x12_cols;
      if (this.gut_on) {
        const tpd = cfg.time.ticks_per_day;
        this.germ = new Float64Array(NC);
        this.germ_decay = Math.pow(0.5, 1.0 / (+B35.germ_half_life_days * tpd));
        this.g_one = +B35.g_one; this.g_food = +(B35.g_food != null ? B35.g_food : B35.g_one);
        this.dose_per_bite = +B35.dose_per_bite;
        this.inc_rate = 1.0 / +B35.incubation_ticks;
        this.rec_decay = Math.pow(0.5, 1.0 / +B35.recovery_half_life_ticks);
        this.gut_pool = 0.0;
      }
      this.gut_cap = +(B35.gut_cap != null ? B35.gut_cap : 1.0);
      const B32 = cfg.body_v32 || {};
      this.spread_on = this.scent_on && !!B32.scent_spread;
      this.fur_on = this.scent_on && !!B32.fur_scent;
      if (this.spread_on) {
        const cm = +B32.cell_m, lam = +B32.lambda_m, beta = +B32.beta;
        this.kernel = new Float64Array(H * W * H * W);       // (猫のマス, 匂いのマス)。Python は [猫のマス][匂いのマス] の向きで同じ(対称)
        for (let a = 0; a < H * W; a++) for (let b = 0; b < H * W; b++) {
          const ay = Math.floor(a / W), ax = a % W, by = Math.floor(b / W), bx = b % W;
          const dm = Math.sqrt(sq(ay - by) + sq(ax - bx)) * cm;
          this.kernel[a * H * W + b] = Math.exp(-Math.pow(dm / lam, beta));
        }
      }
      this.fur = 0.0;
      if (this.fur_on) {
        this.fur_groom = Math.pow(0.5, 1.0 / +B32.fur_groom_half_life_ticks);
        this.fur_decay = Math.pow(0.5, 1.0 / (+B32.fur_half_life_days * cfg.time.ticks_per_day));
      }
      const B33 = cfg.body_v33 || {};
      this.nose_on = this.scent_on && !!B33.nose;
      this.furdirt_on = this.fur_on && !!B33.fur_elim_dirt;
      this.nose_ref = +(B33.nose_ref != null ? B33.nose_ref : 1.0); this.fur_ref = +(B33.fur_ref != null ? B33.fur_ref : 1.0);
      this.eat_mask = !!cfg.drives.eat_mask_bite;
      this.w = DRIVES.map((nm) => ((nm === "energy" && !this.v3.two_layer) || (nm === "thirst" && !this.v3.water) || ((nm === "bladder" || nm === "bowel") && !this.v3.elim)
        || (nm === "nose" && !this.nose_on) || (nm === "soil" && !this.furdirt_on) || (nm === "gut" && !this.gut_on) || (nm === "pain" && !this.catch_on)) ? 0.0 : +cfg.drives.weights[nm]);
      this.t = 0; this.t0 = 0; this.season = 0.0;
      this.car = false; this.since_park = 0; this.box = false; this.box_i = 0; this.box_age = 0;
      this.E = new Float64Array(this.CONTAINERS.length);
      this.st = new Float64Array(DRIVES.length);
      this.pot = 0; this.prev = SIT;
      this.pot_p = cfg.pot_days.p.map(Number);
      this.cl_Qdry = +cfg.enclosure_heat.cat_heat_W;
      this.cl_Dc = 0.0;
      this.pant_ml = 0.0; this.saliva_ml = 0.0;
      this.reset();
    }

    // ------------------------------------------------------------ x09 気候の体
    _climateInit(cfg) {
      const Cc = cfg.climate || {};
      const on = (k) => !!(Cc[k] && Cc[k].on);
      this.cl_tnz = on("tnz"); this.cl_wind = on("wind"); this.cl_floor = on("floor"); this.cl_evap = on("evap");
      this.cl_any = this.cl_wind || this.cl_floor || this.cl_evap || ["activity", "conductance", "shiver", "closing", "enclosure_body"].some(on);
      this.temp_band = this.cl_tnz ? Cc.tnz.band.slice() : cfg.drives.temp_band.slice();
      this.temp_cap = this.cl_tnz ? +(Cc.tnz.dev_cap != null ? Cc.tnz.dev_cap : 1.0) : 1.0;
      this.cl_wx = on("weather"); this.wx = Cc.weather || {};
      this.cl_shiv = !!(Cc.shiver && Cc.shiver.on);
      this.cl_close = !!(Cc.closing && Cc.closing.on);
      this.cl_encl = !!(Cc.enclosure_body && Cc.enclosure_body.on);
      this.cl_Qdry = +cfg.enclosure_heat.cat_heat_W;
      if (Object.keys(Cc).length === 0) return;          // x08 より前の config(気候の体なし)
      const B = Cc.body, Mkg = +B.mass_kg;
      this.cl_Tb = +B.T_core_C;
      this.cl_A = +B.meeh_k * Math.pow(Mkg * 1000.0, 2.0 / 3.0) / 1e4;
      this.cl_BMR = +B.bmr_kJ_per_kg23_day * Math.pow(Mkg, 2.0 / 3.0) * 1000.0 / 86400.0;
      this.cl_Gref = this.cl_BMR / (this.cl_Tb - +Cc.tnz.band[0]);
      this.cl_Rstill = this.cl_A / this.cl_Gref;
      const Wd = Cc.wind;
      this.cl_hr = +Wd.h_rad; this.cl_hnat = +Wd.h_conv_still; this.cl_ha = +Wd.h_forced_a; this.cl_hb = +Wd.h_forced_b;
      this.cl_Rfur = this.cl_Rstill - 1.0 / (this.cl_hnat + this.cl_hr);
      const P = this.P;
      const z0 = +Wd.z0_m, zc = +Wd.cat_height_m, u10 = +Wd.u10_m_s;
      this.cl_v_open = u10 * Math.log(zc / z0) / Math.log(10.0 / z0);
      this.cl_v = new Float64Array(NC); this.cl_rw = new Float64Array(NC);
      for (let i = 0; i < NC; i++) {
        const expo = clip(1.0 - (Math.max(P.faces[i], 1) - 1) / 5.0, 0.0, 1.0);
        this.cl_v[i] = P.indoor[i] > 0.5 ? +Wd.v_indoor_m_s : this.cl_v_open * expo;
        const hc = Math.max(this.cl_hnat, this.cl_ha * Math.pow(this.cl_v[i], this.cl_hb));
        this.cl_rw[i] = this.cl_wind ? this.cl_Rstill / (this.cl_Rfur + 1.0 / (hc + this.cl_hr)) : 1.0;
      }
      const F = Cc.floor;
      const tau = 1.0 / +cfg.drives.temp_rate * (60.0 * +cfg.time.minutes_per_tick);
      this.cl_tau = tau;
      const r_mat = (m) => {
        const [k, a, d, under] = MATERIALS[m];
        if (d === null) return Math.sqrt(Math.PI * a * tau) / k;
        return d / k + (under ? r_mat(under) : 0.0);
      };
      this.cl_Rmat_of = {}; for (const m of Object.keys(MATERIALS)) this.cl_Rmat_of[m] = r_mat(m);
      this.cl_mat = new Array(NC).fill("");
      for (let i = 0; i < NC; i++) if (this.names[i]) this.cl_mat[i] = MATERIAL_OF[this.names[i]] || "fabric";
      this.cl_Rmat = new Float64Array(NC);
      for (let i = 0; i < NC; i++) this.cl_Rmat[i] = this.cl_Rmat_of[this.cl_mat[i]] || 0.0;
      this.cl_Rc = +F.R_contact;
      this.cl_f = { lie: +F.f_lie, sit: +F.f_sit, move: +F.f_move };
      this.cl_outg = new Uint8Array(NC);
      for (let i = 0; i < NC; i++) this.cl_outg[i] = (OUTDOOR_GROUND.includes(this.cl_mat[i]) && P.indoor[i] < 0.5) ? 1 : 0;
      const om = 2 * Math.PI / 86400.0;
      this.cl_amp = new Float64Array(NC); this.cl_dTsun = new Float64Array(NC);
      const dts = F.sun_surface_excess_C;
      for (let i = 0; i < NC; i++) {
        const hs = Math.max(this.cl_hnat, this.cl_ha * Math.pow(this.cl_v[i], this.cl_hb)) + this.cl_hr;
        const m = this.cl_mat[i];
        const e_eff = OUTDOOR_GROUND.includes(m) ? MATERIALS[m][0] / Math.sqrt(MATERIALS[m][1]) : 0.0;
        const se = e_eff * Math.sqrt(om / 2.0);
        this.cl_amp[i] = this.cl_outg[i] ? hs / Math.sqrt(sq(hs + se) + sq(se)) : 1.0;
        this.cl_dTsun[i] = (m in dts ? +dts[m] : 0.0) * this.cl_outg[i];
      }
      this.cl_S = F.solar_noon_W_m2;
      this.cl_season = cfg.weather.season;
      const Ev = Cc.evap;
      this.cl_L = +Ev.latent_J_per_g;
      this.cl_saliva_g = +Ev.saliva_g_per_day / (+Ev.groom_h_per_day * 3600.0 / (60.0 * +cfg.time.minutes_per_tick));
      this.cl_dt = 60.0 * +cfg.time.minutes_per_tick;
      this.cl_pant0 = +Ev.pant_start_C; this.cl_pant1 = +Ev.pant_full_C;
      this.cl_pantmax = +Ev.pant_max_x_bmr * this.cl_BMR;
      this.cl_ml_per_thirst = +Ev.ml_per_thirst;
      const Ac = Cc.activity || {}, Cd = Cc.conductance || {};
      this.cl_act = !!Ac.on; this.cl_vaso = !!Cd.on;
      const mult = new Array(N_ACTS).fill(1.0);
      if (this.cl_act) for (const [k, v] of Object.entries(Ac.mult)) mult[C.ACTS.indexOf(k)] = +v;
      if (Ac.mult && "descend" in Ac.mult) for (const a of [JUMP_N, JUMP_E, JUMP_S, JUMP_W]) mult[a] = +Ac.mult.descend;
      this.cl_mult = mult;
      this.cl_burn = !!Ac.burn_from_heat;
      this.cl_J_per_unit = +(Ac.kcal_per_hunger_unit != null ? Ac.kcal_per_hunger_unit : 100.0) * 4184.0;
      const gmin = new Array(N_ACTS).fill(1.0);
      if (this.cl_vaso) for (let a = 0; a < N_ACTS; a++) {
        if (a === SLEEP) continue;
        gmin[a] = [N_, E_, S_, W_, CLIMB, DESCEND, ENTER, LEAVE, JUMP_N, JUMP_E, JUMP_S, JUMP_W].includes(a) ? +Cd.posture_max : +Cd.posture_floor_still;
      }
      this.cl_gmin = gmin;
      if (this.cl_close) {
        const Cl = Cc.closing;
        this.cl_curl = +Cl.curl_min; this.cl_pilo = +Cl.pilo_min; this.cl_close_full = +Cl.full_C;
        this.cl_loaf = !!(Cl.sit_loaf && Cl.sit_loaf.on);
        this.cl_curl_sit = this.cl_loaf ? +Cl.sit_loaf.curl_min : 1.0;
      }
      if (this.cl_shiv) {
        const Sh = Cc.shiver;
        this.cl_sh_max = (+Sh.max_x_bmr - 1.0) * this.cl_BMR;
        this.cl_sh0 = +Sh.start_C; this.cl_sh1 = +Sh.full_C;
        this.cl_Cbody = +B.mass_kg * +Sh.c_tissue_J_per_kgK;
        this.cl_Dc_cap = +Sh.Dc_cap_C;
      }
      this.cl_gmax = this.cl_vaso ? +Cd.posture_max * +Cd.vaso_max : 1.0;
      if (this.cl_vaso) this.temp_band = [this.temp_band[0], this.cl_Tb - this.cl_BMR / (this.cl_gmax * this.cl_Gref)];
    }

    shiverW() {
      if (!this.cl_shiv) return 0.0;
      return this.cl_sh_max * clip((this.cl_Dc - this.cl_sh0) / (this.cl_sh1 - this.cl_sh0), 0.0, 1.0);
    }
    // このティックの θ の近づく先 θ*(℃)と寄りの速さ、息の荒さ・唾の水(ml)
    climateTarget(act, th, T_here) {
      const D = this.cfg.drives;
      const L = this.layer, Y = this.y, X = this.x, i3 = idx3(L, Y, X), i2 = Y * W + X;
      const rw = this.cl_rw[i3];
      let Ta = T_here, Tg = Ta, Gg = 0.0, f = 0.0;
      if (this.cl_floor) {
        Ta = Ta - +this.cfg.weather.soft_insulation * this.P.soft[i3];
        Ta = Ta - this.world.paveAddAt(Y, X, this._sun(), this.season) * (L === FLOOR ? 1 : 0);
        Tg = this.cl_outg[i3] ? this.groundT() : Ta;
        f = act === SLEEP ? this.cl_f.lie : ((act === SIT || act === GROOM || act === EAT) ? this.cl_f.sit : this.cl_f.move);
        f = f * (this.cl_mat[i3] !== "" ? 1 : 0);
        Gg = f * this.cl_A / (this.cl_Rc + this.cl_Rmat[i3]);
      }
      let pant = 0.0, sal = 0.0, E = 0.0;
      if (this.cl_evap) {
        pant = this.cl_pantmax * clip((th - this.cl_pant0) / (this.cl_pant1 - this.cl_pant0), 0.0, 1.0);
        sal = this.cl_saliva_g * (act === GROOM ? 1 : 0);
        E = pant + sal * this.cl_L / this.cl_dt;
      }
      let target, rate, g = 1.0, Mx, Sx;
      if (!(this.cl_act || this.cl_vaso || this.cl_shiv || this.cl_close)) {
        let Q = (1.0 - f) * this.cl_Gref * rw * (this.cl_Tb - Ta) + Gg * (this.cl_Tb - Tg);
        if (this.cl_evap) Q = Q + pant + sal * this.cl_L / this.cl_dt;
        target = this.cl_Tb - Q / this.cl_Gref;
        rate = D.temp_rate * ((1.0 - f) * rw + Gg / this.cl_Gref);
        Mx = this.cl_BMR; Sx = this.cl_BMR - Q;
      } else {
        Mx = this.cl_BMR * this.cl_mult[act] + this.shiverW();
        const air = (1.0 - f) * this.cl_Gref * rw * (this.cl_Tb - Ta);
        const rest = Gg * (this.cl_Tb - Tg) + E;
        g = 1.0;
        if (this.cl_vaso || this.cl_close) {
          const ok = air > 1e-9;
          let gmin = this.cl_gmin[act];
          if (this.cl_close) {
            const fc = clip(this.cl_Dc / this.cl_close_full, 0.0, 1.0);
            gmin = gmin * (1.0 - (1.0 - this.cl_pilo) * fc) * (act === SLEEP ? 1.0 - (1.0 - this.cl_curl) * fc : 1.0);
            if (this.cl_loaf) gmin = gmin * (act === SIT ? 1.0 - (1.0 - this.cl_curl_sit) * fc : 1.0);
          }
          let gtop = Math.max(this.cl_gmax, gmin);
          if (this.cl_shiv || this.cl_close) gtop = this.cl_Dc > 0.0 ? gmin : gtop;
          g = ok ? clip((Mx - rest) / (ok ? air : 1.0), gmin, gtop) : gmin;
        }
        const Q = g * air + rest;
        Sx = Mx - Q;
        target = this.cl_Tb - (this.cl_BMR - Sx) / (g * this.cl_Gref);
        if (this.cl_shiv) target = target - this.shiverW() / this.cl_Gref;
        rate = D.temp_rate * ((1.0 - f) * rw * g + Gg / this.cl_Gref);
      }
      return { target, rate: Math.min(rate, 1.0), pant_ml: pant * this.cl_dt / this.cl_L, sal, M: Mx, S: Sx, E, g, f, Ta, Tg };
    }
    _burn(act, moving) {
      const D = this.cfg.drives;
      let b;
      if (this.cl_act && this.cl_burn) b = this.cl_BMR * this.cl_mult[act] * this.cl_dt / this.cl_J_per_unit;
      else b = D.hunger_per_tick + D.hunger_move * (moving ? 1 : 0);
      if (this.cl_shiv) b = b + this.shiverW() * this.cl_dt / this.cl_J_per_unit;
      return b;
    }
    outMeanAmp(s) {
      const Wc = this.cfg.weather;
      if (!this.cl_wx) return [Wc.out_mean + s, Wc.out_amp + 0.0 * s];
      const [s0, s1] = Wc.season;
      const u = (s - s0) / (s1 - s0);
      const tmax = this.wx.max_C[0] + u * (this.wx.max_C[1] - this.wx.max_C[0]);
      const tmin = this.wx.min_C[0] + u * (this.wx.min_C[1] - this.wx.min_C[0]);
      return [0.5 * (tmax + tmin), 0.5 * (tmax - tmin)];
    }
    _sun(h) {
      h = h == null ? this.hour() : h;
      return Math.max(0.0, Math.sin(Math.PI * (h - 6) / 12)) * ((h >= 6 && h <= 18) ? 1 : 0) * (this.clear ? 1 : 0);
    }
    groundT() {
      const Wc = this.cfg.weather;
      const i3 = idx3(this.layer, this.y, this.x);
      const h = this.hour(), s = this.season;
      const [Tm, amp] = this.outMeanAmp(s);
      const To = Tm + amp * Math.sin(2 * Math.PI * (h - 9) / 24);
      const [s0, s1] = this.cl_season;
      const Ss = this.cl_S[0] + (clip(s, s0, s1) - s0) / (s1 - s0) * (this.cl_S[1] - this.cl_S[0]);
      const sun = this._sun();
      return Tm + this.cl_amp[i3] * (To - Tm) + this.cl_dTsun[i3] * (Ss / this.cl_S[1]) * sun * this.P.sunf[i3];
    }

    // ------------------------------------------------------------ 時刻と温度
    hour() { return mod(this.t0 + this.t, this.T_day) * 24.0 / this.T_day; }
    boxCellNow() { return BOX_CANDIDATES[this.box_i]; }
    // 今ある層(3×H×W の 0/1)
    exists() {
      const e = new Uint8Array(this.exists_static);
      e[idx3(TOP, PARK[1], PARK[0])] = this.car ? 1 : 0;
      e[idx3(INSIDE, PARK[1], PARK[0])] = this.car ? 1 : 0;
      if (this.box) { const [bx, by] = this.boxCellNow(); e[idx3(INSIDE, by, bx)] = 1; }
      e[idx3(INSIDE, POT[1], POT[0])] = this.pot === POT_PRESENT ? 1 : 0;
      if (this.world.basket) { const [bx, by] = this.world.basket_cells[this.world.basket_i]; e[idx3(INSIDE, by, bx)] = 1; }
      if (this.X11_BOX) e[idx3(INSIDE, NEWBOX_XY[1], NEWBOX_XY[0])] = this.newbox ? 1 : 0;
      return e;
    }
    occupiedAt(y, x) { return (y === POT[1] && x === POT[0]) ? this.pot === POT_OCCUPIED : false; }
    // 場所ごとの感じる温度 ℃(3×H×W)
    temps(occupiedEq) {
      const Wc = this.cfg.weather, P = this.P;
      const h = this.hour(), s = this.season;
      const wave = Math.sin(2 * Math.PI * (h - 9) / 24);
      let T_in, T_out;
      if (this.cl_wx) {
        const [Tm, amp] = this.outMeanAmp(s);
        T_out = Tm + amp * wave;
        T_in = Tm + +this.wx.in_gain_C + +this.wx.in_amp_ratio * amp * wave;
      } else {
        T_in = Wc.in_mean + Wc.in_season * s + Wc.in_amp * wave;
        T_out = Wc.out_mean + s + Wc.out_amp * wave;
      }
      const sun = Math.max(0.0, Math.sin(Math.PI * (h - 6) / 12)) * ((h >= 6 && h <= 18) ? 1 : 0) * (this.clear ? 1 : 0);
      const T = new Float64Array(NC);
      for (let i = 0; i < NC; i++) {
        T[i] = (P.indoor[i] > 0.5 ? T_in : T_out) + P.off[i] + Wc.sun_gain * sun * P.sunf[i] + Wc.soft_insulation * P.soft[i];
      }
      let heat_on = false;
      for (const [a, b] of Wc.heater_hours) heat_on = heat_on || (h >= a && h < b);
      heat_on = heat_on && T_in < Wc.heater_if_T_in_below;
      T[idx3(FLOOR, HEATER[1], HEATER[0])] += Wc.heater_gain * (heat_on ? 1 : 0);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) T[idx3(FLOOR, y, x)] += this.world.tempAddAt(y, x, sun, s);
      if (this.SUN_XS.length) {                // x04: 畳の日だまり(その時のマスの床だけ。窓辺と同じ 9·sun)
        const px = (h >= 6 && h < 18) ? this.SUN_XS[clip(Math.floor((h - 6.0) / 3.0), 0, 3)] : -1;
        T[idx3(FLOOR, this.SUN_Y, Math.max(px, 0))] += Wc.sun_gain * sun * (px >= 0 ? 1 : 0);
      }
      const eng = Math.exp(-this.since_park / Wc.bonnet_tau_ticks) * (this.car ? 1 : 0);
      T[idx3(TOP, PARK[1], PARK[0])] += Wc.bonnet_gain * eng;
      T[idx3(INSIDE, PARK[1], PARK[0])] += this.cfg.car.under_gain * eng;
      const E = occupiedEq ? this.cont_dT : this.E;
      if (this.box) { const [bx, by] = this.boxCellNow(); T[idx3(INSIDE, by, bx)] += E[0]; }
      if (this.world.basket) { const [bx, by] = this.world.basket_cells[this.world.basket_i]; T[idx3(INSIDE, by, bx)] += E[3]; }
      for (let k = 0; k < this.CONTAINERS.length; k++) {
        if (k === 0 || k === 3) continue;
        const [cl, cx, cy] = this.cont_xy[k];
        T[idx3(cl, cy, cx)] += E[k];
      }
      return T;
    }
    brightness(h) { return this._sun(h); }
    // ------------------------------------------------------------ 始まり(暮らしの始め)
    reset() {
      const r = this.rng, S = this.cfg.start, Ev = this.cfg.events;
      this.x = r.integers(0, W); this.y = r.integers(0, H); this.layer = FLOOR;
      this.t = 0; this.t0 = r.integers(0, this.T_day);
      this.season = r.uniform(this.cfg.weather.season[0], this.cfg.weather.season[1]);
      this.car = r.random() < Ev.p_car_at_start; this.since_park = 10000;
      this.box = r.random() < Ev.p_box_at_start; this.box_i = r.integers(0, BOX_CANDIDATES.length); this.box_age = 10000;
      this.E.fill(0.0);
      this.bird = false; this.toy_left = 0; this.newbox = false;
      if (this.voice_on) {
        this.bowl_bites = this.bowl0; this.hu_wait = -1; this.hu_here = false; this.meow_age = 10000;
        if (this.pt_on) {
          const tod0 = mod(this.t0, this.T_day);
          const age = Math.min(...this.meal_ticks.map((mt) => mod(tod0 - mt, this.T_day)));
          const fresh = age < this.pt_remove;
          this.bowl_bites = fresh ? this.ration / this.meal_ticks.length : 0.0; this.bowl_age = fresh ? age : 0;
          this.served = this.ration / this.meal_ticks.length * (fresh ? 1 : 0);
        }
        const fav = [0, 1].map(() => this.hm_cells[this.x12_rng.integers(0, this.hm_cells.length)].slice());
        this.hm_fav = fav.map((f) => f.slice()); this.hm_xy = fav.map((f) => f.slice()); this.hm_mode = [0, 0]; this.hm_gather = 0;
        if (this.fs_on) this.hu_loc = this.fs_rng.integers(0, this.fs_locs.length);
      }
      if (this.X11_BIRD) this.bird_scale = this.x11_rng.uniform(this.bd.day_scale[0], this.bd.day_scale[1]);
      this.pot = r.choice(this.pot_p);
      this.st[0] = r.uniform(S.hunger[0], S.hunger[1]); this.st[1] = r.uniform(S.fatigue[0], S.fatigue[1]);
      this.st[2] = r.uniform(S.dirt[0], S.dirt[1]); this.st[4] = r.uniform(S.sleepy[0], S.sleepy[1]);
      this.clear = this.sky_rng.random() >= this.p_cloudy;
      this.approach.reset();
      this.world.reset(this.type_idx[idx3(FLOOR, this.y, this.x)]);
      const T = this.temps();
      this.st[3] = T[idx3(FLOOR, this.y, this.x)];
      this.st[5] = this.u_target[idx3(FLOOR, this.y, this.x)];
      this.st[13] = 0.0;
      this.inj = 0.0; this.inj_left = 0.0;
      this.prev = SIT;
      this.over = 0.0;
      this.cl_Dc = 0.0;
      const r3 = this.v3_rng, B3 = this.b3;
      if (this.v3.two_layer) { this.st[6] = this.st[0]; this.st[0] = r3.uniform(B3.start_stomach_empty[0], B3.start_stomach_empty[1]); }
      if (this.v3.water) this.st[7] = r3.uniform(B3.start_thirst[0], B3.start_thirst[1]);
      if (this.fat_on) this.fat = this.fat_rng.uniform(this.fat_start[0], this.fat_start[1]);
      if (this.v3.elim) { this.st[8] = r3.uniform(B3.start_bladder[0], B3.start_bladder[1]); this.st[9] = r3.uniform(B3.start_bowel[0], B3.start_bowel[1]); }
      this.mess.fill(0.0); this.mess_f.fill(0.0); this.scent.fill(0.0);
      if (this.split_on) { this.scent_u.fill(0.0); this.scent_f.fill(0.0); }
      this.fur = 0.0;
      this.st[10] = 0.0; this.st[11] = 0.0; this.st[12] = 0.0;
      if (this.gut_on) { this.germ.fill(0.0); this.gut_pool = 0.0; }
      this.z = 1.0;
      this.since.fill(this.nov_tau); this.visited.fill(0);
      this.cur_type = this.type_idx[idx3(FLOOR, this.y, this.x)];
      this.since[this.cur_type] = 0.0; this.visited[this.cur_type] = 1;
    }
    // エピソードの中の日の替わり: 日の物と場所の記憶だけ引き直す
    newDay() {
      this.pot = this.rng.choice(this.pot_p);
      if (this.X11_BIRD) this.bird_scale = this.x11_rng.uniform(this.bd.day_scale[0], this.bd.day_scale[1]);
      this.clear = this.sky_rng.random() >= this.p_cloudy;
      this.approach.reset();
      this.world.reset(Math.max(this.type_idx[idx3(this.layer, this.y, this.x)], 0));
      this.since.fill(this.nov_tau); this.visited.fill(0);
      const tk = this.type_idx[idx3(this.layer, this.y, this.x)];
      this.cur_type = tk;
      if (tk >= 0) { this.since[tk] = 0.0; this.visited[tk] = 1; }
    }
    // ------------------------------------------------------------ ずれ
    deviations() {
      const st = this.st, D = this.cfg.drives;
      const [lo, hi] = this.temp_band;
      const th = st[3];
      const td = Math.max(Math.max(lo - th, 0) + Math.max(th - hi, 0), 0) / D.temp_scale;
      const dev = new Float64Array(14);
      const src = [st[0], st[1], st[2], td, st[4], st[5], st[6], st[7], st[8], st[9], st[10], st[11], st[12], st[13]];
      for (let j = 0; j < 14; j++) dev[j] = clip(src[j], 0, 1);
      dev[11] = clip(st[11], 0, this.v2_safety);
      dev[0] = clip(st[0], 0, this.v2_safety);
      dev[6] = clip(st[6], 0, this.v2_safety);
      dev[7] = clip(st[7], 0, this.v2_safety);
      dev[3] = Math.min(td, this.temp_cap);
      dev[12] = clip(st[12], 0, this.gut_cap);
      return dev;
    }
    // 満ち足り g = (1 − min(1, Dh/D_ref))·(1 − min(1, U/unsafe_max))
    satisfiedGate(dev) {
      dev = dev || this.deviations();
      const k = this.cfg.drives.k;
      let Dh = 0.0;
      for (let j = 0; j < 5; j++) Dh += this.w[j] * pw(dev[j], k);
      const U = dev[5];
      return [(1 - Math.min(1.0, Dh / this.nov_dref)) * (1 - Math.min(1.0, U / this.cfg.drives.unsafe_max)), Dh, U];
    }
    bowlSteps() {
      const moved = this.layer !== FLOOR || this.x !== this.BOWL[0] || this.y !== this.BOWL[1];
      return moved ? ((this.layer !== FLOOR ? 1 : 0) + Math.abs(this.x - this.BOWL[0]) + Math.abs(this.y - this.BOWL[1])) : 0;
    }
    // 腕 M: いま 食べ物のあるマスから 2 手以内にいる(心が「出す」の logit を下げる)
    innateLogitZone() { return this.ifa_mode === "logit" ? this.bowlSteps() <= this.ifa_r : false; }
    eatClosed() {
      if (!this.lep_on) return 0.0;
      const p = this.fat / this.fat_bw;
      return clip(this.lep_c_ref * (p - this.lep_lo) / (this.lep_ref - this.lep_lo), 0.0, 1.0);
    }
    // ------------------------------------------------------------ できる手
    valid(ex) {
      ex = ex || this.exists();
      const v = new Uint8Array(N_ACTS);
      const fl = this.layer === FLOOR, x = this.x, y = this.y;
      v[SIT] = v[SLEEP] = v[GROOM] = 1;
      v[N_] = fl && y > 0 ? 1 : 0; v[S_] = fl && y < H - 1 ? 1 : 0; v[W_] = fl && x > 0 ? 1 : 0; v[E_] = fl && x < W - 1 ? 1 : 0;
      v[CLIMB] = fl && ex[idx3(TOP, y, x)] ? 1 : 0;
      v[DESCEND] = this.layer === TOP ? 1 : 0;
      if (this.upper_on) {
        const top = this.layer === TOP;
        for (let d = 0; d < 4; d++) {
          const [dx, dy] = DIRS4[d];
          const nxc = clip(x + dx, 0, W - 1), nyc = clip(y + dy, 0, H - 1);
          const k = (d * H + y) * W + x;
          const a = [N_, E_, S_, W_][d];
          if (top && this.top_nbr[k] && ex[idx3(TOP, nyc, nxc)]) v[a] = 1;
          v[JUMP_N + d] = top && this.jump_ok[k] ? 1 : 0;
        }
      }
      v[EAT] = fl && x === this.BOWL[0] && y === this.BOWL[1] ? 1 : 0;
      if (this.eat_mask) {
        const bite = this.v3.two_layer ? +this.b3.bite_fill : Math.abs(this.cfg.drives.eat_per_tick);
        if (this.lep_on) { if (!(this.st[0] >= bite + this.eatClosed() - 1e-9)) v[EAT] = 0; }
        else if (!(this.st[0] >= bite - 1e-9)) v[EAT] = 0;
      }
      if (this.voice_on) {
        v[MEOW] = 1;
        if (!(this.bowl_bites >= 1.0 - 1e-9)) v[EAT] = 0;
      }
      if (this.X11_TOY) v[PAW] = fl && x === TOY_XY[0] && y === TOY_XY[1] ? 1 : 0;
      v[ENTER] = fl && ex[idx3(INSIDE, y, x)] ? 1 : 0;
      v[LEAVE] = this.layer === INSIDE ? 1 : 0;
      if (this.v3.water) v[DRINK] = fl && x === WATER[0] && y === WATER[1] && this.st[7] >= +this.b3.drink_min - 1e-9 ? 1 : 0;
      if (this.v3.elim) { const emin = +this.b3.elim_min; v[ELIM] = (this.st[8] >= emin || this.st[9] >= emin) ? 1 : 0; }
      if (this.scent_on) v[DIG] = this.soil[idx3(this.layer, y, x)];
      return v;
    }
    // ------------------------------------------------------------ x12 声・人・同居の猫
    houseDist() { return this._hd_map[this.y * W + this.x]; }
    hmNear() {
      let best = 0, dm = 1e9;
      for (let j = 0; j < 2; j++) {
        const d = Math.max(Math.abs(this.hm_xy[j][0] - this.x), Math.abs(this.hm_xy[j][1] - this.y));
        if (d < dm) { dm = d; best = j; }
      }
      const vis = this.here(this.P.indoor) > 0.5 && dm <= this.hm_view;
      return [vis, vis ? this.hm_xy[best][0] - this.x : 0, vis ? this.hm_xy[best][1] - this.y : 0, dm];
    }
    _x12Tick(act, hr, info) {
      const r = this.x12_rng, X = this.x12;
      if (this.fs_on) {                                  // 人の暮らしの場所は ときどき移る(毎ティック 2 つ引く)
        const mvu = this.fs_rng.random();
        const nl = this.fs_rng.integers(0, this.fs_locs.length);
        this.hu_loc = mvu < this.fs_pmove ? nl : this.hu_loc;
      }
      const tod = mod(this.t0 + this.t, this.T_day);
      const meal = this.meal_ticks.includes(tod);
      let removed = 0.0;
      if (this.pt_on) {
        const portion = this.ration / this.meal_ticks.length;
        this.served = tod === 0 ? 0.0 : this.served;
        this.bowl_age = this.bowl_age + 1;
        const rm = this.bowl_bites > 0 && this.bowl_age >= this.pt_remove;
        removed = rm ? this.bowl_bites : 0.0;
        this.bowl_bites = rm ? 0.0 : this.bowl_bites;
        this.bowl_bites = meal ? portion : this.bowl_bites; this.bowl_age = meal ? 0.0 : this.bowl_age; this.served = this.served + (meal ? portion : 0.0);
      } else {
        this.bowl_bites = Math.min(this.bowl_bites + (meal ? this.ration / this.meal_ticks.length : 0.0), this.ration);
      }
      this.hu_here = meal; this.hu_xy = [this.BOWL[0], this.BOWL[1]];
      this.hm_gather = meal ? Math.trunc(this.hm_cfg.gather_ticks) : Math.max(this.hm_gather - 1, 0);
      const HM = this.hm_cfg;
      const night = hr >= +HM.night_from || hr < +HM.night_to;
      const u = []; for (let m = 0; m < 2; m++) u.push([r.random(), r.random(), r.random()]);
      const gat = this.hm_gather > 0;
      for (let m = 0; m < 2; m++) {
        let mode = this.hm_mode[m];
        const to_w = mode === 0 && u[m][0] < +HM.p_rest_to_wander && !night;
        const to_r = mode === 1 && (u[m][0] < +HM.p_wander_to_rest || night);
        mode = to_w ? 1 : (to_r ? 0 : mode);
        mode = gat ? 2 : ((mode === 2 && !gat) ? 0 : mode);
        let pos = this.hm_xy[m].slice();
        if (mode === 0) pos = this.hm_fav[m].slice();
        const dxy = DIRS4[Math.min(Math.trunc(u[m][1] * 4), 3)];
        const stp = mode === 1 && u[m][2] < +HM.p_step;
        const cand = [pos[0] + dxy[0] * (stp ? 1 : 0), pos[1] + dxy[1] * (stp ? 1 : 0)];
        let okc = cand[0] >= 0 && cand[0] < W && cand[1] >= 0 && cand[1] < H;
        okc = okc && this.P.indoor[idx3(FLOOR, clip(cand[1], 0, H - 1), clip(cand[0], 0, W - 1))] > 0.5;
        if (okc) pos = cand;
        const gdx = this.BOWL[0] - pos[0], gdy = this.BOWL[1] - pos[1];
        const hz = Math.abs(gdx) >= Math.abs(gdy);
        if (mode === 2) pos = [pos[0] + Math.sign(gdx) * (hz ? 1 : 0), pos[1] + Math.sign(gdy) * (hz ? 0 : 1)];
        this.hm_xy[m] = pos; this.hm_mode[m] = mode;
      }
      const meow = act === MEOW;
      this.meow_age = meow ? 0 : Math.min(this.meow_age + 1, 10000);
      const home = hr >= this.hu_h0 && hr < this.hu_h1;
      const ind_now = this.here(this.P.indoor) > 0.5;
      const heard_zone = ind_now || this.houseDist() <= this.out_range;
      const audible = meow && home && heard_zone;
      const pend = this.hu_wait > 0;
      this.hu_wait = pend ? this.hu_wait - 1 : this.hu_wait;
      const arrive = pend && this.hu_wait === 0;
      this.hu_wait = arrive ? -1 : this.hu_wait;
      const ok = arrive && home && heard_zone && this.hu_respond;
      let fed = ok && this.bowl_bites < 1.0;
      let capped = false;
      if (this.pt_on) {
        capped = fed && (this.served + this.feed_bites > this.pt_limit + 1e-9);
        fed = fed && !capped;
        this.served = this.served + (fed ? this.feed_bites : 0.0); this.bowl_age = fed ? 0.0 : this.bowl_age;
      }
      const petted = ok && !fed;
      this.bowl_bites = Math.min(this.bowl_bites + (fed ? this.feed_bites : 0.0), this.ration);
      this.hu_here = this.hu_here || ok;
      if (ok) this.hu_xy = [this.x, this.y];
      const u_n = r.random();                                   // 毎ティック引く
      const dly = r.integers(this.hu_dly[0], this.hu_dly[1] + 1);
      const notice = audible && this.hu_wait < 0 && !arrive && this.hu_respond && (u_n < this.hu_p);
      if (notice) this.hu_wait = dly;
      this.hu_d = notice ? dly : this.hu_d;
      Object.assign(info, { v_audible: audible, v_notice: notice, v_arrive: ok, v_fed: fed, v_petted: petted, v_meal: meal, v_delay: ok ? this.hu_d : 0, v_capped: capped, v_removed: removed });
    }
    // 人の物音(0〜1)。人が家にいて起きている時間帯(7〜22 時)だけ。音の強さ L = level_db − 20·log10(距離 m) − 外の猫なら壁 wall_db
    footsteps() {
      const hr = this.hour();
      const home = hr >= this.hu_h0 && hr < this.hu_h1;
      const loc = this.fs_locs[this.hu_loc];
      const hx = this.hu_here ? this.hu_xy[0] : loc[0], hy = this.hu_here ? this.hu_xy[1] : loc[1];
      const dm = Math.max(1.0, this.fs_cell * Math.max(Math.abs(hx - this.x), Math.abs(hy - this.y)));
      const ind = this.here(this.P.indoor) > 0.5;
      const L = this.fs_lv - 20.0 * Math.log10(dm) - (ind ? 0.0 : this.fs_wall);
      return clip((L - this.fs_bg) / (this.fs_lv - this.fs_bg), 0.0, 1.0) * (home ? 1 : 0);
    }
    // ------------------------------------------------------------ 匂い
    scentNear() {
      if (!this.scent_on) return 0.0;
      if (this.spread_on) {
        const a = (this.y * W + this.x) * H * W;
        let s = 0.0;
        for (let b = 0; b < H * W; b++) {
          // 三つの層の匂いの和(Python の scent.sum(1))× 核
          const tot = this.scent[b] + this.scent[H * W + b] + this.scent[2 * H * W + b];
          s += tot * this.kernel[a + b];
        }
        return s + this.fur;
      }
      let s = 0.0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = this.x + dx, ny = this.y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        for (let l = 0; l < 3; l++) s += this.scent[idx3(l, ny, nx)];
      }
      return Math.min(1.0, s + this.fur);
    }
    visibleBoxCar() {
      const rad = 1 + this.cfg.view.view_cells * this.here(this.P.view);
      const [bx, by] = this.boxCellNow();
      const dxb = bx - this.x, dyb = by - this.y;
      const sb = this.box && Math.max(Math.abs(dxb), Math.abs(dyb)) <= rad;
      const dxc = PARK[0] - this.x, dyc = PARK[1] - this.y;
      const sc = this.car && Math.max(Math.abs(dxc), Math.abs(dyc)) <= rad;
      return [sb, sb ? dxb : 0, sb ? dyb : 0, sc, sc ? dxc : 0, sc ? dyc : 0];
    }
    memory() {
      const m = new Float64Array(this.K_TYPES);
      for (let k = 0; k < this.K_TYPES; k++) m[k] = this.visited[k] ? 1.0 - Math.min(1.0, this.since[k] / this.T_day) : 0.0;
      return m;
    }
    // ------------------------------------------------------------ 観測
    obs() {
      const ex = this.exists(), T = this.temps(), P = this.P;
      const tn = (v) => (v - 28.0) / 10.0;
      const x = new Float32Array(this.obs_dim);
      const L = this.layer, X = this.x, Y = this.y;
      x[L] = 1.0;
      x[3] = tn(T[idx3(L, Y, X)]);
      ["soft", "encl", "h", "view", "open"].forEach((k, j) => { x[4 + j] = this.here(P[k]) / (k === "h" ? 2.0 : 1.0); });
      x[9] = ex[idx3(TOP, Y, X)]; x[10] = tn(T[idx3(TOP, Y, X)]) * x[9];
      const hi = ex[idx3(INSIDE, Y, X)];
      x[11] = hi; x[12] = tn(T[idx3(INSIDE, Y, X)]) * hi;
      x[13] = P.soft[idx3(INSIDE, Y, X)] * hi;
      x[14] = P.encl[idx3(INSIDE, Y, X)] * hi;
      x[15] = (X === this.BOWL[0] && Y === this.BOWL[1]) ? 1 : 0;
      let c = 16;
      for (const [dx, dy] of DIRS4) {
        const nx = X + dx, ny = Y + dy;
        const ok = nx >= 0 && nx < W && ny >= 0 && ny < H;
        const nxc = clip(nx, 0, W - 1), nyc = clip(ny, 0, H - 1);
        x[c] = ok ? 1 : 0;
        x[c + 1] = tn(T[idx3(FLOOR, nyc, nxc)]) * (ok ? 1 : 0);
        x[c + 2] = P.soft[idx3(FLOOR, nyc, nxc)] * (ok ? 1 : 0);
        x[c + 3] = P.encl[idx3(FLOOR, nyc, nxc)] * (ok ? 1 : 0);
        x[c + 4] = (ex[idx3(TOP, nyc, nxc)] && ok) ? 1 : 0;
        x[c + 5] = (ex[idx3(INSIDE, nyc, nxc)] && ok) ? 1 : 0;
        c += 6;
      }
      const dv = this.deviations();
      const D = this.cfg.drives; const [lo, hi_] = this.temp_band;
      const th = this.st[3];
      x[40] = dv[0]; x[41] = dv[1]; x[42] = dv[2];
      x[43] = clip((Math.max(th - hi_, 0) - Math.max(lo - th, 0)) / D.temp_scale, -this.temp_cap, this.temp_cap);
      x[44] = dv[4]; x[45] = dv[5];
      const h = this.hour();
      x[46] = Math.sin(2 * Math.PI * h / 24); x[47] = Math.cos(2 * Math.PI * h / 24);
      x[48] = X / (W - 1) * 2 - 1; x[49] = Y / (H - 1) * 2 - 1;
      const [sb, dxb, dyb, sc, dxc, dyc] = this.visibleBoxCar();
      x[50] = sb ? 1 : 0; x[51] = dxb / W; x[52] = dyb / H; x[53] = sc ? 1 : 0; x[54] = dxc / W; x[55] = dyc / H;
      x[56] = 1.0 - this.here(P.indoor);
      x[OCC0] = this.occupiedAt(Y, X) ? 1 : 0;
      DIRS4.forEach(([dx, dy], j) => {
        const nx = X + dx, ny = Y + dy;
        const ok = nx >= 0 && nx < W && ny >= 0 && ny < H;
        x[OCC0 + 1 + j] = (ok && this.occupiedAt(clip(ny, 0, H - 1), clip(nx, 0, W - 1))) ? 1 : 0;
      });
      if (this.prev < N_ACTS0) x[OCC0 + 5 + this.prev] = 1.0;
      const vv = this.valid(ex);
      for (let j = 0; j < N_ACTS0; j++) x[MASK0 + j] = vv[j];
      // 場所の記憶
      const mk = this.memory();
      c = OBS_DIM;
      for (let k = 0; k < this.K_TYPES; k++) x[c + k] = mk[k];
      c += this.K_TYPES;
      for (const [dx, dy] of DIRS4) {
        const nx = X + dx, ny = Y + dy;
        const ok = nx >= 0 && nx < W && ny >= 0 && ny < H;
        const tk = this.type_idx[idx3(FLOOR, clip(ny, 0, H - 1), clip(nx, 0, W - 1))];
        x[c] = (tk >= 0 ? mk[tk] : mk[this.K_TYPES - 1]) * (ok ? 1 : 0); c += 1;     // Python の mk[i, tk]。tk = −1 なら末尾(床は全部名前があるので起きない)
      }
      for (const l of [TOP, INSIDE]) {
        const tk = this.type_idx[idx3(l, Y, X)];
        x[c] = (tk >= 0 && ex[idx3(l, Y, X)]) ? mk[Math.max(tk, 0)] : 0.0; c += 1;
      }
      const [sa, dxa, dya] = this.approach.visible();
      const b = this.obs_dim - this.v3_dim - this.tail_cols;
      x[b - 5] = sa ? 1 : 0; x[b - 4] = dxa / W; x[b - 3] = dya / H;
      x[b - 2] = this.brightness();
      x[b - 1] = this.here(P.wobbly) * (1.0 - this.z);
      x[b] = this.prev === DRINK ? 1 : 0; x[b + 1] = this.prev === ELIM ? 1 : 0;
      x[b + 2] = vv[DRINK]; x[b + 3] = vv[ELIM];
      x[b + 4] = dv[6]; x[b + 5] = dv[7]; x[b + 6] = dv[8]; x[b + 7] = dv[9];
      x[b + 8] = (this.v3.water && L === FLOOR && X === WATER[0] && Y === WATER[1]) ? 1 : 0;
      if (this.v3.elim) {
        x[b + 9] = this.soil[idx3(L, Y, X)];
        x[b + 10] = Math.min(1.0, this.mess[idx3(L, Y, X)]);
        c = b + 11;
        DIRS4.forEach(([dx, dy]) => {
          const nx = X + dx, ny = Y + dy;
          const ok = nx >= 0 && nx < W && ny >= 0 && ny < H;
          const nxc = clip(nx, 0, W - 1), nyc = clip(ny, 0, H - 1);
          x[c] = (this.soil[idx3(FLOOR, nyc, nxc)] && ok) ? 1 : 0;
          x[c + 4] = Math.min(1.0, this.mess[idx3(FLOOR, nyc, nxc)]) * (ok ? 1 : 0);
          c += 1;
        });
      }
      if (this.scent_on) {
        c = b + V31_0;
        x[c] = this.prev === DIG ? 1 : 0; x[c + 1] = vv[DIG];
        x[c + 2] = Math.min(1.0, this.scent[idx3(L, Y, X)]);
        DIRS4.forEach(([dx, dy], j) => {
          const nx = X + dx, ny = Y + dy;
          const ok = nx >= 0 && nx < W && ny >= 0 && ny < H;
          x[c + 3 + j] = Math.min(1.0, this.scent[idx3(FLOOR, clip(ny, 0, H - 1), clip(nx, 0, W - 1))]) * (ok ? 1 : 0);
        });
        const sn = this.scentNear();
        x[c + 7] = this.spread_on ? sn / (1.0 + sn) : sn;
        if (this.v3_dim >= 29) { x[c + 8] = dv[10]; x[c + 9] = dv[11]; }
      }
      const od = this.obs_dim - this.x11_cols - this.x12_cols;
      if (this.gut_on) x[od - 1 - this.ap_kind_cols - this.catch_cols] = dv[12];
      if (this.ap_kind_cols) { const e = od - this.catch_cols; this.approach.kindObs(sa, x, e - this.ap_kind_cols); }
      if (this.catch_cols) { x[od - 2] = dv[13]; x[od - 1] = this.inj; }
      if (this.X11_ANY) {
        const ind = this.here(P.indoor) > 0.5;
        if (this.X11_BIRD) x[od] = (this.bird && L === TOP && X === SILL[0] && Y === SILL[1]) ? 1 : 0;
        if (this.X11_TOY) {
          const dxt = TOY_XY[0] - X, dyt = TOY_XY[1] - Y;
          const tv = ind && Math.max(Math.abs(dxt), Math.abs(dyt)) <= this.x11_view;
          x[od + 1] = tv ? 1 : 0; x[od + 2] = dxt * (tv ? 1 : 0) / W; x[od + 3] = dyt * (tv ? 1 : 0) / H; x[od + 4] = (tv && this.toy_left > 0) ? 1 : 0;
        }
        if (this.X11_BOX) {
          const dxb2 = NEWBOX_XY[0] - X, dyb2 = NEWBOX_XY[1] - Y;
          const bv = this.newbox && ind && Math.max(Math.abs(dxb2), Math.abs(dyb2)) <= this.x11_view;
          x[od + 5] = bv ? 1 : 0; x[od + 6] = dxb2 * (bv ? 1 : 0) / W; x[od + 7] = dyb2 * (bv ? 1 : 0) / H;
        }
      }
      if (this.voice_on) {
        const o12 = od + this.x11_world_cols;
        const ind12 = this.here(P.indoor) > 0.5;
        const bd = Math.max(Math.abs(this.BOWL[0] - X), Math.abs(this.BOWL[1] - Y));
        const bvv = ind12 && bd <= this.x11_view;
        x[o12] = bvv ? 1 : 0; x[o12 + 1] = (bvv && this.bowl_bites >= 1.0) ? 1 : 0;
        const hdx = this.hu_xy[0] - X, hdy = this.hu_xy[1] - Y;
        const hv = this.hu_here && ((ind12 && Math.max(Math.abs(hdx), Math.abs(hdy)) <= this.x11_view) || (hdx === 0 && hdy === 0));
        x[o12 + 2] = hv ? 1 : 0; x[o12 + 3] = hdx * (hv ? 1 : 0) / W; x[o12 + 4] = hdy * (hv ? 1 : 0) / H;
        const [mv, mdx, mdy] = this.hmNear();
        x[o12 + 5] = mv ? 1 : 0; x[o12 + 6] = mdx * (mv ? 1 : 0) / W; x[o12 + 7] = mdy * (mv ? 1 : 0) / H;
        if (this.fs_on) x[o12 + 8] = this.fs_zero ? 0.0 : this.footsteps();
      }
      for (let j = 0; j < this.x11_mask_cols; j++) x[this.obs_dim - this.x11_mask_cols + j] = vv[N_ACTS_OBS + j];
      return x;
    }
    // ------------------------------------------------------------ 1 ティック
    // act: 0..20。返り値: {done, info}
    step(act0) {
      const cfg = this.cfg, D = cfg.drives, E = cfg.events, r = this.rng, st = this.st;
      const ex = this.exists();
      const v = this.valid(ex);
      let act = v[act0] ? act0 : SIT;
      const info = { act, x: this.x, y: this.y, layer: this.layer, hour: this.hour() };
      const ind0 = this.here(this.P.indoor) > 0.5;
      const dev0 = this.deviations();
      const h_here_floor = this.P.h[idx3(FLOOR, this.y, this.x)];
      const mv = act >= N_ && act <= W_;
      const cl = act === CLIMB;
      let ok_mv = true, ok_cl = true;
      if (this.catch_on) {
        const u0 = this.catch_rng.random(), u1 = this.catch_rng.random();
        ok_mv = !(mv && u0 < this.inj);
        ok_cl = !(cl && u1 < 1.0 - Math.pow(1.0 - this.inj, this.climb_power));
        info.inj_fail_move = !ok_mv; info.inj_fail_climb = !ok_cl;
      }
      let h_top_here = 0.0, jmp = false, u_land = 1.0, jdrop = 0.0, jdx = 0, jdy = 0;
      if (this.upper_on) {
        h_top_here = this.stand_drop[this.y * W + this.x];
        const on_top = this.layer === TOP;
        const uw = this.up_rng.random();
        ok_mv = ok_mv && !(mv && on_top && (uw >= this.up_walk_p));
        jmp = act >= JUMP_N && act <= JUMP_W;
        u_land = this.up_rng.random();
        const jd = clip(act - JUMP_N, 0, 3);
        jdrop = jmp ? this.jump_drop[(jd * H + this.y) * W + this.x] : 0.0;
        jdx = jmp ? DIRS4[jd][0] : 0; jdy = jmp ? DIRS4[jd][1] : 0;
      }
      this.y += ((act === S_ ? 1 : 0) - (act === N_ ? 1 : 0)) * (ok_mv ? 1 : 0);
      this.x += ((act === E_ ? 1 : 0) - (act === W_ ? 1 : 0)) * (ok_mv ? 1 : 0);
      if (this.upper_on) { this.x = this.x + jdx; this.y = this.y + jdy; }
      if (cl) st[1] += D.fatigue_climb_per_height * Math.max(this.P.h[idx3(TOP, this.y, this.x)] - h_here_floor, 0);
      if (cl && ok_cl) this.layer = TOP;
      const de = act === DESCEND;
      let land_h = 0.0, landed = false;
      if (this.upper_on) {
        if (de) st[1] += this.up_fat_h * h_top_here;
        if (jmp) { st[1] += this.up_fat_h * jdrop; this.layer = FLOOR; }
        land_h = de ? h_top_here : (jmp ? jdrop : 0.0);
        landed = de || jmp;
      } else if (de) st[1] += D.fatigue_descend;
      if (de) this.layer = FLOOR;
      if (act === ENTER) this.layer = INSIDE;
      if (act === LEAVE) this.layer = FLOOR;
      const moving = mv || cl || de || act === ENTER || act === LEAVE || jmp;
      const mv_f = mv || jmp;
      const still = !moving;
      const B3 = this.b3;
      let dig = 0.0;
      if (this.v3.two_layer) {
        st[6] += this._burn(act, moving);
        if (act === EAT) st[0] -= +B3.bite_fill;
        if (this.voice_on) this.bowl_bites -= (act === EAT ? 1 : 0);
        st[0] = clip(st[0], 0, 1);
        dig = (1.0 - st[0]) / +B3.tau_stomach_ticks;
        st[0] += dig;
        st[6] -= +B3.kappa * dig;
      } else {
        st[0] += this._burn(act, moving);
        if (act === EAT) st[0] += D.eat_per_tick;
      }
      let drunk = 0.0, fwat = 0.0;
      if (this.v3.water) {
        st[7] += +B3.thirst_per_tick;
        drunk = act === DRINK ? Math.min(+B3.drink_per_tick, st[7]) : 0.0;
        st[7] -= drunk;
        fwat = +B3.food_water_per_digest * dig;
        st[7] -= fwat;
      }
      if (this.v3.elim) {
        const urine = +B3.bladder_per_tick + +B3.bladder_per_drink * (drunk + fwat);
        st[8] += urine;
        if (this.v3.water) st[7] += +B3.thirst_per_urine * urine;
        st[9] += this.v3.two_layer ? +B3.bowel_per_digest * dig : +B3.bowel_per_tick;
      }
      const fv2 = Math.min(this.over / this.v2_ref, 1.0);
      const restAct = act === SIT || act === GROOM || act === EAT;
      if (this.over > 0) {
        const rec = 1.0 - this.v2_cut * fv2;
        st[1] += act === SLEEP ? D.fatigue_sleep * rec : (restAct ? D.fatigue_rest * rec : D.fatigue_awake + D.fatigue_move * (mv_f ? 1 : 0));
      } else {
        st[1] += act === SLEEP ? D.fatigue_sleep : (restAct ? D.fatigue_rest : D.fatigue_awake + D.fatigue_move * (mv_f ? 1 : 0));
      }
      st[2] += D.dirt_per_tick + D.groom_per_tick * (act === GROOM ? 1 : 0);
      if (this.X11_TOY) {
        const paw = act === PAW;
        st[1] += this.toy_fat * D.fatigue_move * (paw ? 1 : 0);
        this.toy_left = paw ? this.toy_swing : Math.max(this.toy_left - 1, 0);
      }
      // --- 世界の 1 ティック(車・段ボール)
      this.t += 1;
      const hr = this.hour();
      if (this.voice_on) this._x12Tick(act, hr, info);
      if (this.X11_BIRD) {
        const bd = this.bd;
        const f_ = clip((this.season - +bd.season_lo) / (+bd.season_hi - +bd.season_lo), 0.0, 1.0);
        const sr = +bd.sunrise_winter + (+bd.sunrise_summer - +bd.sunrise_winter) * f_;
        const ss = +bd.sunset_winter + (+bd.sunset_summer - +bd.sunset_winter) * f_;
        const gd = (mu, sg) => Math.exp(-0.5 * sq((hr - mu) / sg)) / (sg * Math.sqrt(2 * Math.PI));
        const hd = (hr >= +bd.day_from && hr < +bd.day_to) ? 1 : 0;
        const dens = this.bd_w[0] * gd(sr + +bd.dawn_after_h, +bd.dawn_sd_h) + this.bd_w[1] * gd(ss - +bd.dusk_before_h, +bd.dusk_sd_h)
          + this.bd_w[2] * hd / Math.max(+bd.day_to - +bd.day_from, 1e-9);
        const p_in = Math.min(1.0, this.bd_lam * this.bird_scale * (this.clear ? 1.0 : +bd.cloudy_x) * dens / this.bd_tph);
        const ub0 = this.x11_rng.random(), ub1 = this.x11_rng.random();
        this.bird = this.bird ? (ub0 >= this.bd_leave) : (ub1 < p_in);
      }
      if (this.X11_BOX) this.newbox = this.newbox || (this.t >= this.nb_day * this.T_day);
      const [pa, pb] = E.park_hours;
      const u_park = r.random();
      const park = !this.car && hr >= pa && hr < pb && (u_park < E.p_park);
      const u_leave = r.random();
      const leave = this.car && (u_leave < E.p_leave);
      this.car = (this.car || park) && !leave;
      this.since_park = park ? 0 : this.since_park + 1;
      const at_car = (this.layer === TOP || this.layer === INSIDE) && this.x === PARK[0] && this.y === PARK[1];
      if (at_car && leave) this.layer = FLOOR;
      const u_app = r.random();
      const appear = !this.box && (u_app < E.p_box_appear);
      const u_van = r.random();
      const vanish = this.box && (u_van < E.p_box_vanish);
      const bxi = r.integers(0, BOX_CANDIDATES.length);
      const [bx0, by0] = BOX_CANDIDATES[this.box_i];
      const in_box = this.box && this.layer === INSIDE && this.x === bx0 && this.y === by0;
      if (in_box && vanish) this.layer = FLOOR;
      this.box_i = appear ? bxi : this.box_i;
      this.box = (this.box || appear) && !vanish;
      this.box_age = appear ? 0 : this.box_age + 1;
      // --- 囲いの中の体の熱
      if (appear || vanish) this.E[0] = 0.0;
      const ins = this.layer === INSIDE;
      const [bx1, by1] = BOX_CANDIDATES[this.box_i];
      const occ = [ins && this.box && this.x === bx1 && this.y === by1,
        ins && this.x === this.cont_xy[1][1] && this.y === this.cont_xy[1][2],
        ins && this.x === this.cont_xy[2][1] && this.y === this.cont_xy[2][2],
        ins && this.world.basketHereAt(this.x, this.y)];
      for (let k = 4; k < this.CONTAINERS.length; k++) { const [cl_, cx, cy] = this.cont_xy[k]; occ.push(this.layer === cl_ && this.x === cx && this.y === cy); }
      for (let k = 0; k < this.CONTAINERS.length; k++) {
        if (this.cl_encl) this.E[k] += this.cont_alpha[k] * ((occ[k] ? 1 : 0) * this.cl_Qdry / this.cont_G[k] - this.E[k]);
        else this.E[k] += this.cont_alpha[k] * ((occ[k] ? 1 : 0) * this.cont_dT[k] - this.E[k]);
      }
      // --- 体の状態(新しい場所で)
      const T = this.temps();
      const here3 = idx3(this.layer, this.y, this.x);
      const Th = T[here3];
      st[2] += this.P.dirt[here3] + this.world.dirtAdd(this.layer, this.x, this.y);
      let ev3 = { elim_vol: false, elim_acc: false, elim_amount: 0.0, elim_buried: false, drunk };
      if (this.v3.elim) {
        for (let i = 0; i < NC; i++) { this.mess[i] *= this.mess_decay; this.mess_f[i] *= this.mess_decay; }
        const acc_b = st[8] >= 1.0, acc_g = st[9] >= 1.0;
        const vb = act === ELIM || acc_b, vg = act === ELIM || acc_g;
        const amt_u = st[8] * (vb ? 1 : 0), amt_f = st[9] * (vg ? 1 : 0);
        const amt = amt_u + amt_f;
        if (vb) st[8] = 0.0;
        if (vg) st[9] = 0.0;
        const out = vb || vg;
        const soil = this.soil[here3] === 1;
        const dep = out && !soil;
        if (dep) { this.mess[here3] += amt; this.mess_f[here3] += amt_f; }
        if (!this.furdirt_on) st[2] += +B3.mess_dirt * Math.min(1.0, this.mess[here3]);
        if (this.fur_on) {
          this.fur *= this.fur_decay;
          this.fur *= act === GROOM ? this.fur_groom : 1.0;
          this.fur += +B3.mess_dirt * Math.min(1.0, this.mess[here3]);
          if (this.furdirt_on) st[11] = this.fur / this.fur_ref;
        }
        ev3 = { elim_vol: act === ELIM, elim_acc: out && act !== ELIM, elim_amount: amt * (out ? 1 : 0), elim_buried: out && soil, drunk, elim_u: amt_u, elim_f: amt_f };
        if (this.scent_on) {
          const dug = act === DIG && soil;
          if (this.split_on) {
            for (let i = 0; i < NC; i++) { this.scent_u[i] *= this.decay_u; this.scent_f[i] *= this.decay_f; }
            if (out) { this.scent_u[here3] += amt_u; this.scent_f[here3] += amt_f; }
            if (dug) { this.scent_u[here3] = 0.0; this.scent_f[here3] = 0.0; }
            for (let i = 0; i < NC; i++) this.scent[i] = this.scent_u[i] + this.scent_f[i];
          } else {
            for (let i = 0; i < NC; i++) this.scent[i] *= this.scent_decay;
            if (out) this.scent[here3] += amt;
            if (dug) this.scent[here3] = 0.0;
          }
          ev3.dug = dug;
        }
        if (this.gut_on) {
          for (let i = 0; i < NC; i++) this.germ[i] *= this.germ_decay;
          if (out) this.germ[here3] += amt_f;
          if (act === DIG && soil) this.germ[here3] = 0.0;
        }
      }
      if (this.nose_on) st[10] = (this.scent[here3] + this.fur) / this.nose_ref;
      if (this.cl_any) {
        const cT = this.climateTarget(act, st[3], Th);
        this.pant_ml = cT.pant_ml; this.saliva_ml = cT.sal;
        this.cl_Qdry = cT.M - cT.S - cT.E;
        if (this.cl_shiv) this.cl_Dc = clip(this.cl_Dc - cT.S * this.cl_dt / this.cl_Cbody, 0.0, this.cl_Dc_cap);
        if (this.cl_evap && this.v3.water) st[7] += (this.pant_ml + this.saliva_ml) / this.cl_ml_per_thirst;
        if (this.over > 0) st[3] += cT.rate * (cT.target - this.v2_cold * fv2 - st[3]);
        else st[3] += cT.rate * (cT.target - st[3]);
        info.g = cT.g;
      } else if (this.over > 0) st[3] += D.temp_rate * (Th - this.v2_cold * fv2 - st[3]);
      else st[3] += D.temp_rate * (Th - st[3]);
      const U = st[5];
      const soft = this.P.soft[here3];
      const [qa, qb] = D.sleep_q_safety, [sa_, sb_] = D.sleep_q_soft;
      let q = (qa + qb * (1 - clip(U / D.unsafe_max, 0, 1))) * (sa_ + sb_ * soft);
      this.z = moving ? 0.0 : this.z + this.settle_k[here3] * (1.0 - this.z);
      q = q * (still ? this.z : 1.0);
      st[4] += act === SLEEP ? D.sleepy_sleep * q : D.sleepy_awake;
      const tk = this.type_idx[here3];
      let ut = this.u_target[here3] + this.world.uTargetAdd(tk);
      ut = still ? ut + (1.0 - this.z) * (D.unsafe_max - ut) : ut;
      st[5] = U + D.unsafe_rate * (still ? ut - U : Math.max(ut - U, 0));
      const first = tk >= 0 && !this.visited[Math.max(tk, 0)];
      const ev = this.world.onStep(st, mv_f, still, first, tk);
      if (this.gut_on) {
        const c_here = Math.min(1.0, this.germ[here3] / this.g_food);
        const bites = (act === EAT ? 1.0 : 0.0) + this.world.food_mag[Math.max(tk, 0)] * (ev.ev_food ? 1 : 0) / +B3.bite_fill;
        const tr = this.gut_pool * this.inc_rate;
        this.gut_pool -= tr;
        st[12] = st[12] * this.rec_decay + tr;
        const dose = this.dose_per_bite * c_here * bites;
        this.gut_pool += dose;
        info.gut_dose = dose;
      }
      if (this.catch_on) {
        const lft = this.inj_left > 0;
        this.inj = lft ? this.inj - this.inj / Math.max(this.inj_left, 1.0) : 0.0;
        this.inj_left = Math.max(this.inj_left - 1.0, 0.0);
        st[13] = this.inj + Math.max(st[13] - this.inj, 0.0) * this.pain_decay;
      }
      if (this.upper_on) {
        const p_inj = Math.min(1.0, this.up_p_ref * sq(land_h * this.up_m_per_h / this.up_h_ref));
        const hurt = landed && (u_land < p_inj);
        if (hurt) {
          st[13] = Math.max(st[13], this.up_pain);
          this.inj = Math.min(1.0, this.inj + this.up_inj);
          this.inj_left = Math.max(this.inj_left, this.up_days * this.T_day);
          st[13] = Math.max(st[13], this.inj);
        }
        ev.land_hurt = hurt; ev.land_drop = land_h * (landed ? 1 : 0);
      }
      const nd_extra = this.voice_on ? (((this.meow_age < this.meow_ticks) && !(this.here(this.P.indoor) > 0.5)) ? this.meow_nd : 0) : null;
      const apr = this.approach.step(st, this.hour(), this.t >= this.T_day * this.ep_days, nd_extra);
      Object.assign(ev, apr);
      if (this.catch_on) {
        if (apr.ap_caught) {
          const kc = apr.ap_kind, ap = this.approach;
          st[13] = Math.max(st[13], ap.catch_pain[kc]);
          this.inj = Math.min(1.0, this.inj + ap.catch_inj[kc]);
          this.inj_left = Math.max(this.inj_left, ap.catch_days[kc] * this.T_day);
          if (this.inj <= 0) this.inj_left = 0.0;
          st[13] = Math.max(st[13], this.inj);
          st[1] += this.flee_fatigue;
        }
        ev.injury = this.inj; ev.pain = st[13];
      }
      Object.assign(ev, ev3);
      const hb = this.v3.two_layer ? 6 : 0;
      if (this.fat_on) {
        const K = this.fat_units_per_kg;
        const sur = Math.max(-st[hb], 0.0);
        const put = Math.min(sur, (this.fat_hi - this.fat) * K);
        this.fat += put / K; st[hb] += put;
        const need = Math.max(st[hb], 0.0);
        const take = Math.min(need, Math.max(this.fat - this.fat_lo, 0.0) * K);
        this.fat -= take / K; st[hb] -= take;
      }
      st[hb] = clip(st[hb], 0, this.v2_safety);
      if (this.v3.two_layer) st[0] = clip(st[0], 0, 1);
      st[7] = clip(st[7], 0, this.v2_safety);
      for (const j of [1, 2, 4, 5, 8, 9, 13]) st[j] = clip(st[j], 0, 1);
      this.over = Math.max(st[hb] - 1.0, 0.0);
      const dev1 = this.deviations();
      const k = D.k;
      let r_ext = 0.0;
      for (let j = 0; j < DRIVES.length; j++) r_ext += this.w[j] * (pw(dev0[j], k) - pw(dev1[j], k));
      info.r_ext = r_ext;
      info.gate_after = this.satisfiedGate(dev1)[0];
      // 場所の記憶
      for (let j = 0; j < this.K_TYPES; j++) this.since[j] += 1.0;
      const tkw = tk >= 0 ? tk : this.K_TYPES - 1;      // numpy の負の添字と同じ(起きない)
      this.since[tkw] = 0.0; this.visited[tkw] = 1;
      this.cur_type = tk;
      this.prev = act;
      Object.assign(info, ev);
      const done = this.t >= this.T_day * this.ep_days;
      let mid = false;
      if (done) this.reset();
      else if (this.t % this.T_day === 0 && this.t > 0) { mid = true; this.newDay(); }
      info.midnight = mid;
      return { done, info };
    }
    // ------------------------------------------------------------ 画面の手(Python には無い、web の釦。README に書く)
    // 片づける: 猫のいるマスのうんち(mess)・匂い・汚れた食べ物のもと(germ)を消す(三つの層とも)
    tidyHere() { this.tidyAt(this.x, this.y); }
    tidyAt(x, y) {
      for (let l = 0; l < 3; l++) {
        const i = idx3(l, y, x);
        this.mess[i] = 0.0; this.mess_f[i] = 0.0; this.scent[i] = 0.0;
        if (this.split_on) { this.scent_u[i] = 0.0; this.scent_f[i] = 0.0; }
        if (this.gut_on) this.germ[i] = 0.0;
      }
    }
    // おやつ: 皿に一口足す(上限は一日分)
    snackBowl() { if (this.voice_on) this.bowl_bites = Math.min(this.bowl_bites + 1.0, this.ration); }
  }

  const api = { Env };
  if (isNode) module.exports = api; else { root.Neko = root.Neko || {}; root.Neko.sim = api; }
})(typeof self !== "undefined" ? self : this);
