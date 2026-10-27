// 学習済みの心(train_x6.py の Mind の前向き計算の写し)。
// 観測 → Linear → tanh → GRUCell(64)→ 手の logit(できない手は −1e9)/ 価値。重みは export_mind.py が mind.pt から書いた JSON。
// 生得の腕 M: 食べ物のあるマスから 2 手以内では「出す」の logit を min(出す, ほかの最大) − bias にする(固定、学習で動かない)。
(function (root) {
  "use strict";
  const isNode = typeof module !== "undefined" && module.exports;
  const C = isNode ? require("./consts.js") : root.Neko.consts;
  const { ELIM, N_ACTS, N_ACTS_OBS, N_ACTS0, MASK0, V3_DIM, V31_0 } = C;
  const sigmoid = (v) => 1 / (1 + Math.exp(-v));
  function b64ToBytes(s) {
    if (typeof Buffer !== "undefined") { const b = Buffer.from(s, "base64"); return new Uint8Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
    const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u;
  }

  class Mind {
    // m: export_mind.py の JSON({inp_w: 平らな 64×obs_dim, ...})
    // v3Dim: 観測の後ろの体 v3 の列の数(環境 Env.v3_dim。x06c 27・x07 以降 29)
    constructor(m, v3Dim) {
      this.v3_dim = v3Dim || V3_DIM;
      this.meta = m.meta || {};
      this.h = m.h; this.obs_dim = m.obs_dim; this.tail = m.tail; this.n_acts = m.n_acts;
      const bytes = b64ToBytes(m.weights_f32_b64);
      const all = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 2);
      const P = {}; let o = 0;
      for (const [k, n] of m.layout) { P[k] = Float64Array.from(all.subarray(o, o + n)); o += n; }
      this.inp_w = P.inp_w; this.inp_b = P.inp_b;
      this.w_ih = P.gru_w_ih; this.w_hh = P.gru_w_hh; this.b_ih = P.gru_b_ih; this.b_hh = P.gru_b_hh;
      this.act_w = P.act_w; this.act_b = P.act_b; this.v_w = P.v_w; this.v_b = P.v_b[0];
      this.prior = P.prior;
      this.ifa_bias = m.ifa_bias == null ? 0 : m.ifa_bias;
      this.hx = new Float64Array(this.h);
    }
    resetState() { this.hx.fill(0); }
    // x: Float32Array(obs_dim)。zone: 食べ物のあるマスから 2 手以内か。返り値 {logits(Float64Array 21), value}
    step(x, zone) {
      const h = this.h, D = this.obs_dim;
      const e = new Float64Array(h);
      for (let j = 0; j < h; j++) { let s = this.inp_b[j]; const o = j * D; for (let k = 0; k < D; k++) s += this.inp_w[o + k] * x[k]; e[j] = Math.tanh(s); }
      const hp = this.hx, hn = new Float64Array(h);
      for (let j = 0; j < h; j++) {
        let ir = this.b_ih[j], iz = this.b_ih[h + j], inn = this.b_ih[2 * h + j];
        let hr = this.b_hh[j], hz = this.b_hh[h + j], hnn = this.b_hh[2 * h + j];
        const o0 = j * h, o1 = (h + j) * h, o2 = (2 * h + j) * h;
        for (let k = 0; k < h; k++) {
          const ek = e[k], hk = hp[k];
          ir += this.w_ih[o0 + k] * ek; iz += this.w_ih[o1 + k] * ek; inn += this.w_ih[o2 + k] * ek;
          hr += this.w_hh[o0 + k] * hk; hz += this.w_hh[o1 + k] * hk; hnn += this.w_hh[o2 + k] * hk;
        }
        const r = sigmoid(ir + hr), z = sigmoid(iz + hz), n = Math.tanh(inn + r * hnn);
        hn[j] = (1 - z) * n + z * hp[j];
      }
      this.hx = hn;
      const b = D - this.v3_dim - this.tail;
      const mk = new Float64Array(this.n_acts);
      let q = 0;
      for (let j = 0; j < N_ACTS0; j++) mk[q++] = x[MASK0 + j];
      mk[q++] = x[b + 2]; mk[q++] = x[b + 3];
      mk[q++] = x[b + V31_0 + 1];
      for (let j = D - (this.n_acts - N_ACTS_OBS); j < D; j++) mk[q++] = x[j];
      const la = new Float64Array(this.n_acts);
      for (let a = 0; a < this.n_acts; a++) {
        let s = this.act_b[a]; const o = a * h; for (let k = 0; k < h; k++) s += this.act_w[o + k] * hn[k];
        s += this.prior[a];
        la[a] = mk[a] < 0.5 ? -1e9 : s;
      }
      if (zone && this.ifa_bias > 0 && mk[ELIM] > 0.5) {
        let mx = -Infinity; for (let a = 0; a < this.n_acts; a++) if (a !== ELIM && la[a] > mx) mx = la[a];
        la[ELIM] = Math.min(la[ELIM], mx) - this.ifa_bias;
      }
      let v = this.v_b; for (let k = 0; k < h; k++) v += this.v_w[k] * hn[k];
      return { logits: la, value: v, mask: mk };
    }
  }
  // logit → 手(softmax から一つ引く)。rng は {random()}
  function sampleAct(logits, rng) {
    let mx = -Infinity; for (const v of logits) if (v > mx) mx = v;
    const p = Array.from(logits, (v) => Math.exp(v - mx)); let s = 0; for (const v of p) s += v;
    let u = rng.random() * s, a = 0;
    for (; a < p.length - 1; a++) { u -= p[a]; if (u < 0) break; }
    return a;
  }
  const api = { Mind, sampleAct };
  if (isNode) module.exports = api; else { root.Neko = root.Neko || {}; root.Neko.mind = api; }
})(typeof self !== "undefined" ? self : this);
