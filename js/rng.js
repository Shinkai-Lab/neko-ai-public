// numpy 互換の乱数(np.random.default_rng = PCG64 + SeedSequence)。Python の sim.py と同じ流れを JS で引くための写し。
// 使うのは SeedSequence(整数 / 配列 + spawn)・random()・integers(lo, hi)・uniform(lo, hi)・choice(n, p)だけ。
// 正本は numpy(numpy/random/bit_generator.pyx と src/pcg64/pcg64.h、distributions.c)。web/test/check_rng.py が numpy と突き合わせる。
(function (root) {
  "use strict";
  const INIT_A = 0x43b0d7e5, MULT_A = 0x931e8875, INIT_B = 0x8b51f9dd, MULT_B = 0x58f38ded;
  const MIX_MULT_L = 0xca01f9dd, MIX_MULT_R = 0x4973f715, XSHIFT = 16;
  const MASK64 = (1n << 64n) - 1n, MASK128 = (1n << 128n) - 1n;
  const PCG_MULT = 47026247687942121848144207491837523525n;

  function coerce(v) {            // 整数または整数の配列 → uint32 の語の配列(下位から)
    if (Array.isArray(v)) { let out = []; for (const x of v) out = out.concat(coerce(x)); return out; }
    let b = BigInt(v);
    if (b === 0n) return [0];
    const out = [];
    while (b > 0n) { out.push(Number(b & 0xffffffffn)); b >>= 32n; }
    return out;
  }

  class SeedSequence {
    constructor(entropy, spawnKey) {
      this.entropy = entropy;
      this.spawnKey = spawnKey || [];
      this.poolSize = 4;
      this.nChildren = 0;
      this.pool = new Array(4).fill(0);
      this._mix();
    }
    _mix() {
      let run = coerce(this.entropy);
      const sp = this.spawnKey.length ? coerce(this.spawnKey) : [];
      if (sp.length > 0 && run.length < this.poolSize) while (run.length < this.poolSize) run.push(0);
      const ent = run.concat(sp);
      let hc = INIT_A;
      const hashmix = (value) => {
        value = (value ^ hc) >>> 0;
        hc = Math.imul(hc, MULT_A) >>> 0;
        value = Math.imul(value, hc) >>> 0;
        value = (value ^ (value >>> XSHIFT)) >>> 0;
        return value;
      };
      const mix = (x, y) => {
        let r = (Math.imul(MIX_MULT_L, x) - Math.imul(MIX_MULT_R, y)) >>> 0;
        r = (r ^ (r >>> XSHIFT)) >>> 0;
        return r;
      };
      const P = this.pool;
      for (let i = 0; i < 4; i++) P[i] = hashmix(i < ent.length ? ent[i] : 0);
      for (let s = 0; s < 4; s++) for (let d = 0; d < 4; d++) if (s !== d) P[d] = mix(P[d], hashmix(P[s]));
      for (let s = 4; s < ent.length; s++) for (let d = 0; d < 4; d++) P[d] = mix(P[d], hashmix(ent[s]));
    }
    spawn1() {
      const child = new SeedSequence(this.entropy, this.spawnKey.concat([this.nChildren]));
      this.nChildren += 1;
      return child;
    }
    generateState32(n) {
      const out = new Array(n);
      let hc = INIT_B;
      for (let i = 0; i < n; i++) {
        let v = this.pool[i % 4];
        v = (v ^ hc) >>> 0;
        hc = Math.imul(hc, MULT_B) >>> 0;
        v = Math.imul(v, hc) >>> 0;
        v = (v ^ (v >>> XSHIFT)) >>> 0;
        out[i] = v;
      }
      return out;
    }
    generateState64(n) {
      const w = this.generateState32(2 * n);
      const out = [];
      for (let i = 0; i < n; i++) out.push((BigInt(w[2 * i + 1]) << 32n) | BigInt(w[2 * i]));
      return out;
    }
  }

  class Generator {
    constructor(seed) {
      this.seedSeq = (seed instanceof SeedSequence) ? seed : new SeedSequence(seed);
      const v = this.seedSeq.generateState64(4);
      const initstate = (v[0] << 64n) | v[1];
      const initseq = (v[2] << 64n) | v[3];
      this.inc = ((initseq << 1n) | 1n) & MASK128;
      this.state = 0n;
      this._step();
      this.state = (this.state + initstate) & MASK128;
      this._step();
      this.hasU32 = false; this.u32 = 0;
    }
    _step() { this.state = (this.state * PCG_MULT + this.inc) & MASK128; }
    next64() {
      this._step();
      const s = this.state;
      const hi = s >> 64n, lo = s & MASK64;
      const x = hi ^ lo;
      const rot = s >> 122n;
      const r = Number(rot);
      return ((x >> BigInt(r)) | (x << BigInt((64 - r) & 63))) & MASK64;
    }
    nextU32() {
      if (this.hasU32) { this.hasU32 = false; return this.u32; }
      const nx = this.next64();
      this.hasU32 = true; this.u32 = Number(nx >> 32n);
      return Number(nx & 0xffffffffn);
    }
    random() {                                  // [0, 1)
      const nx = this.next64();
      return Number(nx >> 11n) * (1.0 / 9007199254740992.0);
    }
    randomArray(n) { const a = new Float64Array(n); for (let i = 0; i < n; i++) a[i] = this.random(); return a; }
    integers(lo, hi) {                          // [lo, hi) 一つ(Lemire、32 bit。範囲が 2^32 未満の時)
      const rng = hi - lo - 1;
      if (rng === 0) return lo;
      if (rng > 0xfffffffe) throw new Error("integers: range too large");
      const excl = rng + 1;
      let m = BigInt(this.nextU32()) * BigInt(excl);
      let left = Number(m & 0xffffffffn);
      if (left < excl) {
        const thr = (0xffffffff - rng) % excl;
        while (left < thr) { m = BigInt(this.nextU32()) * BigInt(excl); left = Number(m & 0xffffffffn); }
      }
      return lo + Number(m >> 32n);
    }
    uniform(lo, hi) { return lo + (hi - lo) * this.random(); }
    choice(p) {                                 // choice(len(p), p=p) 一つ: cdf を作り、乱数一つ → searchsorted(side='right')
      let s = 0; for (const x of p) s += x;
      const q = p.map((x) => x / s);
      const cdf = []; let acc = 0; for (const x of q) { acc += x; cdf.push(acc); }
      const last = cdf[cdf.length - 1];
      for (let i = 0; i < cdf.length; i++) cdf[i] /= last;
      const u = this.random();
      let idx = 0; while (idx < cdf.length && cdf[idx] <= u) idx++;
      return idx;
    }
    spawn1() { return this.seedSeq.spawn1(); }
  }

  const api = { SeedSequence, Generator };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.NekoRng = api;
})(typeof self !== "undefined" ? self : this);
