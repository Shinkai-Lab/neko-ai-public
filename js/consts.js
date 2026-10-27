// 世界の定数と静的な表(sim.py の頭〜build_places の写し)。
// 元の家(layout "house")と、環の並べ(layout "ring": x06c の世界)を写す。数の出どころは sim.py と config.json。行動は一つも書かない。
(function (root) {
  "use strict";
  const W = 10, H = 6;
  const FLOOR = 0, TOP = 1, INSIDE = 2;
  const ACTS = ["sit", "north", "east", "south", "west", "climb", "descend", "sleep", "groom", "eat", "enter", "leave", "drink", "eliminate", "dig",
    "jump_north", "jump_east", "jump_south", "jump_west", "paw", "meow"];
  const ACTS_JA = ["座る", "北", "東", "南", "西", "登る", "降りる", "寝る", "毛づくろい", "食べる", "入る", "出る", "飲む", "出す", "掘って埋める",
    "北へ飛び降りる", "東へ飛び降りる", "南へ飛び降りる", "西へ飛び降りる", "手を出す", "鳴く"];
  const SIT = 0, N_ = 1, E_ = 2, S_ = 3, W_ = 4, CLIMB = 5, DESCEND = 6, SLEEP = 7, GROOM = 8, EAT = 9, ENTER = 10, LEAVE = 11, DRINK = 12, ELIM = 13, DIG = 14,
    JUMP_N = 15, JUMP_E = 16, JUMP_S = 17, JUMP_W = 18, PAW = 19, MEOW = 20;
  const N_ACTS_OBS = 15, N_ACTS = 21, N_ACTS0 = 12;
  const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // N, E, S, W
  const DRIVES = ["hunger", "fatigue", "dirt", "temp", "sleepy", "unsafe", "energy", "thirst", "bladder", "bowel", "nose", "soil", "gut", "pain"];
  const OBS_DIM = 86, OCC0 = 57, MASK0 = OBS_DIM - N_ACTS0;
  const POT = [0, 2];
  const POT_PRESENT = 0, POT_ABSENT = 1, POT_OCCUPIED = 2;
  const V3_DIM = 29, V31_0 = 19;
  const AP_DIM = 3, SKY_DIM = 1, WOB_DIM = 1;

  // 性質: [名前, soft, encl, h, view, open, off, sunf, indoor, dirt]
  const BASE = {
    "板の間": ["板の間", 0.15, 0.10, 0.0, 0.30, 0.50, 0.0, 0.0, 1, 0.0],
    "畳": ["畳", 0.40, 0.10, 0.0, 0.30, 0.45, 0.0, 0.0, 1, 0.0],
    "障子際": ["障子際の畳", 0.40, 0.05, 0.0, 0.35, 0.55, 0.0, 0.3, 1, 0.0],
    "台所": ["台所", 0.05, 0.15, 0.0, 0.25, 0.50, -0.5, 0.0, 1, 0.0],
    "縁側": ["縁側", 0.15, 0.00, 0.5, 0.60, 0.85, 0.0, 1.0, 0, 0.0],
    "庭": ["庭", 0.30, 0.00, 0.0, 0.50, 0.90, 0.0, 1.0, 0, 0.0015],
    "石畳": ["石畳", 0.00, 0.00, 0.0, 0.60, 1.00, -2.0, 0.5, 0, 0.0015],
  };
  const BOX = ["段ボール", 0.50, 0.80, 0.0, 0.10, 0.10, 0.0, 0.0, 1, 0.0];
  const UNDER_CAR = ["車の下", 0.00, 0.40, 0.0, 0.20, 0.50, -1.0, 0.0, 0, 0.0015];
  const BASKET = ["洗濯かご", 0.80, 0.70, 0.0, 0.10, 0.20, 0.0, 0.0, 1, 0.0];
  const BASKET_FACES = 5;
  const FACES = {
    "板の間": 1, "畳": 1, "障子際の畳": 1, "台所": 1, "ごはん皿": 1, "ストーブの前": 1, "庭": 1, "石畳": 1, "駐車場": 1,
    "縁側": 2, "帳場の座布団": 2, "庭木の陰": 2, "本棚の上": 1, "ボンネット": 1, "車の下": 2, "縁側の下": 3,
    "南窓の畳": 1, "鍋": 5, "紙袋": 5, "段ボール": 5, "洗濯かご": BASKET_FACES, "塀の上": 1, "高い窓辺": 1,
  };
  const CONTAINERS0 = ["段ボール", "紙袋", "鍋", "洗濯かご"];
  const BOX_CANDIDATES = [[2, 1], [3, 2], [4, 0], [3, 5], [1, 5], [6, 1]];
  const PARK = [6, 4];
  const BOWL = [0, 4];         // 元の家(layout house)のごはん皿
  const HEATER = [2, 3];
  const WATER = [0, 3];
  const SOIL_FLOOR = ["庭", "庭木の陰"], SOIL_INSIDE = ["縁側の下"];
  const BASKET_CELLS = [[4, 4], [3, 4], [2, 2]];
  const SILL = [4, 5], TOY_XY = [2, 4], NEWBOX_XY = [3, 3];
  const WALL_CELLS = [[7, 4], [7, 5]], WINDOW_CELLS = [[4, 5]];

  // 床・下敷きの物: [熱伝導率 k, 温度拡散率 α, 厚さ d(null = 厚い)、下に重なる物]
  const MATERIALS = {
    wood: [0.14, 1.3e-7, null, null], tatami: [0.07, 1.4e-7, null, null], stone: [1.7, 8.0e-7, null, null], soil: [1.0, 5.0e-7, null, null],
    cushion: [0.045, null, 0.03, "tatami"], cardboard: [0.065, null, 0.005, "wood"], towel: [0.05, null, 0.015, "tatami"],
    paper: [0.05, null, 0.0003, "tatami"], clay: [1.0, null, 0.01, "wood"], straw: [0.06, null, 0.025, "wood"],
    metal: [50.0, null, 0.001, null], fabric: [0.05, null, 0.01, null],
  };
  const MATERIAL_OF = {
    "塀の上": "stone", "高い窓辺": "wood", "板の間": "wood", "台所": "wood", "ごはん皿": "wood", "本棚の上": "wood", "縁側": "wood", "帳場の机": "wood",
    "畳": "tatami", "障子際の畳": "tatami", "ストーブの前": "tatami", "南窓の畳": "tatami", "石畳": "stone", "駐車場": "stone", "車の下": "stone",
    "庭": "soil", "庭木の陰": "soil", "縁側の下": "soil", "帳場の座布団": "cushion", "段ボール": "cardboard", "洗濯かご": "towel", "紙袋": "paper", "鍋": "clay",
    "ちぐら": "straw", "地面のちぐら": "straw", "ボンネット": "metal",
  };
  const OUTDOOR_GROUND = ["wood", "stone", "soil"];
  // x05 直交の並べ(環 = layout ring だけ)。(名前, x, y, 高さ 0/1/2, 囲い 0 開け/1 半/2 閉じ, 温かさ 0 冷たい/1 ふつう/2 温かい, 汚れ 0 きれい/1 埃, しっかり度 0 しっかり/1 ぐらつく)
  const DESIGN = [
    ["床のハンモック", 0, 4, 0, 0, 0, 0, 1], ["棚の下のかご", 0, 3, 0, 1, 1, 1, 0], ["ゆれる籐ボール", 4, 2, 0, 2, 1, 1, 1], ["地面のちぐら", 3, 0, 0, 2, 2, 0, 0],
    ["帳場の机", 4, 0, 1, 0, 1, 0, 0], ["ヒーターの丸椅子", 0, 2, 1, 0, 2, 1, 1], ["棚の鉢", 2, 4, 1, 1, 1, 0, 0], ["ヒーターのハンモック", 4, 4, 1, 1, 2, 1, 1],
    ["物置棚の箱・西", 0, 1, 1, 2, 0, 1, 0], ["物置棚の箱・東", 4, 1, 1, 2, 0, 1, 0], ["吊りかご・南", 1, 4, 1, 2, 1, 0, 1], ["吊りかご・北", 1, 0, 1, 2, 1, 0, 1],
    ["本棚の上", 4, 3, 2, 0, 1, 1, 0], ["吊り棚の鉢", 2, 0, 2, 1, 0, 0, 1], ["積み箱の上の箱", 0, 0, 2, 2, 1, 1, 1], ["ちぐら", 3, 4, 2, 2, 2, 0, 0],
  ];
  const ENC_FACES = [1, 3, 5];
  const SUNSTRIP = ["南窓の畳", 0.40, 0.05, 0.0, 0.35, 0.55, 0.0, 0.0, 1, 0.0];
  const PLACE_TYPES_BASE = ["板の間", "畳", "障子際の畳", "台所", "ごはん皿", "帳場の座布団", "ストーブの前", "本棚の上", "鍋", "紙袋", "段ボール",
    "縁側", "縁側の下", "庭", "庭木の陰", "駐車場", "ボンネット", "車の下", "石畳", "洗濯かご"];

  function floorKind(x, y) {
    if (x <= 4) {
      if (x === 0 && y >= 2) return "台所";
      if (y <= 1) return "板の間";
      return x === 4 ? "障子際" : "畳";
    }
    if (x === 5) return "縁側";
    if (x <= 7) return "庭";
    return "石畳";
  }

  const idx3 = (l, y, x) => (l * H + y) * W + x;
  const KEYS = ["soft", "encl", "h", "view", "open", "off", "sunf", "indoor", "dirt"];

  // 並べの場所(sim.py の design_specs の写し)
  function designSpecs(cfg) {
    const X5 = cfg.x05, out = [];
    for (const [nm, x, y, hh, ee, ww, dd, ff] of DESIGN) {
      const layer = hh === 0 ? INSIDE : TOP;
      const faces = ENC_FACES[ee];
      const vo = X5.view_open_by_h[hh];
      const view = ee === 0 ? vo : (ee === 1 ? X5.view_half_factor * vo : X5.view_closed);
      const off = X5.strat_per_h * hh + (ww === 0 ? X5.cold_C : 0.0) + ((ww === 2 && ee !== 2) ? X5.heater_C : 0.0);
      const heat = ee === 2 ? X5.closed_heat[["cold", "neutral", "warm"][ww]] : null;
      const spec = [nm, X5.soft, (faces - 1) / 5.0, +hh, view, X5.open_obs[ee], off, 0.0, 1, X5.dusty_dirt * dd];
      out.push({ layer, x, y, spec, faces, wob: ff ? 1 : 0, heat, ee, nm });
    }
    return out;
  }

  // 層 × y × x の性質の表(sim.py の build_places の写し。layout house・x10_places・x11 box の世界、または layout ring(x05b〜x07 の環)の世界)
  function makeStatics(cfg) {
    const layout = (cfg.layout && cfg.layout.name) || "ring";     // x07b より前の config に layout は無い = 環
    if (layout !== "house" && layout !== "ring") throw new Error("layout " + layout);
    const ring = layout === "ring";
    const x10 = !ring && !!(cfg.x10_places && cfg.x10_places.on);
    const X11W = (cfg.x11 && cfg.x11.world) || {};
    const flags = { bird: !!(X11W.bird && X11W.bird.on), toy: !!(X11W.toy && X11W.toy.on), box: !!(X11W.box && X11W.box.on) };
    const SPECIAL_FLOOR = new Map();
    const put0 = (x, y, spec) => SPECIAL_FLOOR.set(x + "," + y, spec);
    put0(1, 3, ["帳場の座布団", 0.90, 0.20, 0.0, 0.30, 0.35, 0.0, 0.0, 1, 0.0]);
    put0(2, 3, ["ストーブの前", 0.40, 0.10, 0.0, 0.25, 0.45, 0.0, 0.0, 1, 0.0]);
    put0(ring ? 2 : 0, ring ? 2 : 4, ["ごはん皿", 0.05, 0.15, 0.0, 0.25, 0.50, -0.5, 0.0, 1, 0.0]);
    const SUN_XS = ring ? [1, 2, 3, 4] : [], SUN_Y = 5;
    for (const sx of SUN_XS) put0(sx, SUN_Y, SUNSTRIP);
    put0(7, 2, ["庭木の陰", 0.30, 0.30, 0.0, 0.40, 0.60, -1.0, 0.0, 0, 0.0015]);
    put0(6, 4, ["駐車場", 0.00, 0.00, 0.0, 0.60, 1.00, -2.0, 0.5, 0, 0.0015]);
    const TOPS = new Map();
    TOPS.set("6,4", ["ボンネット", 0.00, 0.00, 1.0, 0.80, 1.00, -1.0, 1.0, 0, 0.0]);
    if (!ring) {
      TOPS.set("0,0", ["本棚の上", 0.10, 0.30, 2.0, 1.00, 0.15, 1.5, 0.0, 1, 0.0]);
      TOPS.set("1,0", ["本棚の上", 0.10, 0.30, 2.0, 1.00, 0.15, 1.5, 0.0, 1, 0.0]);
    }
    const INSIDES = new Map();
    INSIDES.set("0,2", ["鍋", 0.10, 0.75, 0.0, 0.10, 0.10, -1.0, 0.0, 1, 0.0]);
    INSIDES.set("4,3", ["紙袋", 0.30, 0.70, 0.0, 0.10, 0.10, 0.0, 0.0, 1, 0.0]);
    for (let y = 0; y < H; y++) INSIDES.set("5," + y, ["縁側の下", 0.20, 0.85, 0.0, 0.20, 0.10, -2.0, 0.0, 0, 0.004]);
    if (x10) {
      for (const c of WALL_CELLS) TOPS.set(c.join(","), ["塀の上", 0.00, 0.00, 2.0, 1.00, 1.00, 0.0, 1.0, 0, 0.0]);
      for (const c of WINDOW_CELLS) TOPS.set(c.join(","), ["高い窓辺", 0.10, 0.00, 1.67, 1.00, 0.60, 1.25, 1.0, 1, 0.0]);
    }
    const design = ring ? designSpecs(cfg) : [];
    const PLACE_TYPES = PLACE_TYPES_BASE.concat(ring ? ["南窓の畳"].concat(design.filter((d) => d.nm !== "本棚の上").map((d) => d.nm)) : []).concat(x10 ? ["塀の上", "高い窓辺"] : []);
    const K_TYPES = PLACE_TYPES.length;
    const CONTAINERS = CONTAINERS0.concat(design.filter((d) => d.ee === 2).map((d) => d.nm)).concat(flags.box ? ["段ボール"] : []);
    const FACES2 = Object.assign({}, FACES); for (const d of design) FACES2[d.nm] = ENC_FACES[d.ee];
    const heatOf = {}; for (const d of design) if (d.heat) heatOf[d.nm] = d.heat;
    const contXY = design.filter((d) => d.heat).map((d) => [d.layer, d.x, d.y]);
    const BOWL_ = ring ? [2, 2] : [0, 4], LITTER_ = ring ? [0, 5] : null, BASKET_ = ring ? [[4, 4], [3, 4], [3, 3]] : BASKET_CELLS;

    const n3 = 3 * H * W;
    const P = {}; for (const k of KEYS.concat(["faces", "wobbly", "encl_line4"])) P[k] = new Float64Array(n3);
    const exists = new Uint8Array(n3);
    const names = new Array(n3).fill("");
    const put = (l, x, y, spec) => { const i = idx3(l, y, x); names[i] = spec[0]; KEYS.forEach((k, j) => { P[k][i] = spec[1 + j]; }); };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      put(FLOOR, x, y, SPECIAL_FLOOR.get(x + "," + y) || BASE[floorKind(x, y)]);
      exists[idx3(FLOOR, y, x)] = 1;
    }
    for (const [k, s] of TOPS) { const [x, y] = k.split(",").map(Number); put(TOP, x, y, s); exists[idx3(TOP, y, x)] = (x === PARK[0] && y === PARK[1]) ? 0 : 1; }
    for (const d of design) { put(d.layer, d.x, d.y, d.spec); exists[idx3(d.layer, d.y, d.x)] = 1; P.wobbly[idx3(d.layer, d.y, d.x)] = d.wob; }
    for (const [k, s] of INSIDES) { const [x, y] = k.split(",").map(Number); put(INSIDE, x, y, s); exists[idx3(INSIDE, y, x)] = 1; }
    for (const [x, y] of BOX_CANDIDATES) {
      put(INSIDE, x, y, BOX);
      P.indoor[idx3(INSIDE, y, x)] = P.indoor[idx3(FLOOR, y, x)];   // 庭に置かれた段ボールは外の気温
    }
    if (flags.box) {
      const [bx, by] = NEWBOX_XY;
      if (names[idx3(INSIDE, by, bx)] !== "" || names[idx3(FLOOR, by, bx)] !== "畳") throw new Error("新しい箱のマスが違う");
      put(INSIDE, bx, by, BOX);
      P.indoor[idx3(INSIDE, by, bx)] = P.indoor[idx3(FLOOR, by, bx)];
    }
    put(INSIDE, PARK[0], PARK[1], UNDER_CAR);
    for (const [x, y] of BASKET_) {
      if (names[idx3(INSIDE, y, x)] !== "" || !["畳", "障子際の畳"].includes(names[idx3(FLOOR, y, x)])) throw new Error("洗濯かごのマスが違う");
      put(INSIDE, x, y, BASKET);
    }
    for (let i = 0; i < n3; i++) P.encl_line4[i] = P.encl[i];
    for (let i = 0; i < n3; i++) if (names[i]) { if (FACES2[names[i]] === undefined) throw new Error("閉じた面の数が無い: " + names[i]); P.faces[i] = FACES2[names[i]]; }
    for (let i = 0; i < n3; i++) P.encl[i] = names[i] !== "" ? (P.faces[i] - 1) / 5.0 : 0.0;
    const type_idx = new Int32Array(n3).fill(-1);
    for (let i = 0; i < n3; i++) if (names[i]) type_idx[i] = PLACE_TYPES.indexOf(names[i]);
    return { P, exists, names, type_idx, PLACE_TYPES, K_TYPES, CONTAINERS, flags, x10, ring, layout, BOWL: BOWL_, LITTER: LITTER_, BASKET_CELLS: BASKET_, SUN_XS, SUN_Y, heatOf, contXY, design };
  }

  const api = {
    W, H, FLOOR, TOP, INSIDE, ACTS, ACTS_JA, SIT, N_, E_, S_, W_, CLIMB, DESCEND, SLEEP, GROOM, EAT, ENTER, LEAVE, DRINK, ELIM, DIG, JUMP_N, JUMP_E, JUMP_S, JUMP_W, PAW, MEOW,
    N_ACTS_OBS, N_ACTS, N_ACTS0, DIRS4, DRIVES, OBS_DIM, OCC0, MASK0, POT, POT_PRESENT, POT_ABSENT, POT_OCCUPIED, V3_DIM, V31_0, AP_DIM, SKY_DIM, WOB_DIM,
    BOX_CANDIDATES, PARK, BOWL, HEATER, WATER, SOIL_FLOOR, SOIL_INSIDE, BASKET_CELLS, SILL, TOY_XY, NEWBOX_XY, MATERIALS, MATERIAL_OF, OUTDOOR_GROUND,
    BASKET_FACES, idx3, makeStatics, designSpecs,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.Neko = root.Neko || {}; root.Neko.consts = api; }
})(typeof self !== "undefined" ? self : this);
