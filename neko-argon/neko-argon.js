import * as THREE from 'three';

/**
 * 青浜町の猫 プロシージャル3Dモデル (Three.js r170)
 *
 * @param {THREE.Scene} scene
 * @param {Object} options
 * @param {Function} [options.groundHeight] - (x, z) => y の地面高さ取得関数
 * @param {string} [options.coat='cha'] - 毛柄: 'cha' | 'mike' | 'kuro' | 'shiro' | 'saba' | 'hachiware'
 * @param {string} [options.tailType='long'] - 尻尾: 'long' | 'kagi' | 'bob'
 * @param {string|number} [options.eyeColor] - 目の色 (省略時は毛柄に合わせた自然な色)
 * @param {boolean} [options.socks=false] - 足先を白くする(靴下猫)オプション
 */
export function createNekoMesh(scene, options = {}) {
  const {
    groundHeight = () => 0,
    coat = 'cha',
    tailType = 'long',
    eyeColor = null,
    socks = false,
  } = options;

  // ==========================================
  // 1. カラーパレット & 数学ヘルパー
  // ==========================================
  const PALETTES = {
    cha: {
      base: new THREE.Color(0xe8a864), // 指示書1 B2: 今の猫に近い明るい茶トラ(前 0xd98236)
      stripe: new THREE.Color(0xb86b28), // (前 0x8c4312)
      belly: new THREE.Color(0xfcf8f0), // (前 0xf7ebd9)
      nose: new THREE.Color(0xe88a82),
      eye: 0x88b04b, // 琥珀〜黄緑
    },
    saba: {
      base: new THREE.Color(0x8e969d),
      stripe: new THREE.Color(0x2c3238),
      belly: new THREE.Color(0xebeff2),
      nose: new THREE.Color(0xc47a80),
      eye: 0xa2c553, // グリーン
    },
    mike: {
      base: new THREE.Color(0xfcfaf5),
      patchOrange: new THREE.Color(0xd97524),
      patchBlack: new THREE.Color(0x24201e),
      belly: new THREE.Color(0xfcfaf5),
      nose: new THREE.Color(0xf29c9c),
      eye: 0xc8963e, // アンバー
    },
    kuro: {
      base: new THREE.Color(0x1f1e21),
      stripe: new THREE.Color(0x161518),
      belly: new THREE.Color(0x262529),
      nose: new THREE.Color(0x2b292c),
      eye: 0xe6b830, // ゴールド
    },
    shiro: {
      base: new THREE.Color(0xf7f6f2),
      stripe: new THREE.Color(0xefede6),
      belly: new THREE.Color(0xffffff),
      nose: new THREE.Color(0xf5a3a7),
      eye: 0x5ca4d6, // ブルー
    },
    hachiware: {
      base: new THREE.Color(0x232226),
      stripe: new THREE.Color(0x1a191c),
      belly: new THREE.Color(0xfaf8f5),
      nose: new THREE.Color(0xf0959a),
      eye: 0xd4a838, // イエローアンバー
    },
  };

  const pal = PALETTES[coat] || PALETTES.cha;
  const pinkEar = new THREE.Color(0xeb989b);
  const pawWhite = new THREE.Color(0xfaf8f5);
  const noseCol = pal.nose;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const smoothstep = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const lerp = (a, b, t) => a + (b - a) * t;

  // 3Dプロシージャルノイズ（三毛のブチや毛並みの揺らぎ用）
  const noise3 = (x, y, z) =>
    Math.sin(x * 17.3 + Math.cos(y * 13.7)) *
      Math.cos(z * 15.1 + Math.sin(x * 11.3)) *
      0.5 +
    0.5;

  // 空間座標 (wx, wy, wz) と部位ヒントから頂点カラーを計算
  function sampleFurColor(wx, wy, wz, part = 'body') {
    const c = pal.base.clone();
    const n = noise3(wx * 2.5, wy * 2.5, wz * 2.5);

    if (coat === 'cha' || coat === 'saba') {
      // サバトラ・茶トラの縞模様
      let wave = 0;
      if (part === 'tail') {
        // しっぽの輪っか縞
        wave = Math.sin(wz * 55);
      } else if (part === 'leg') {
        // 脚の横縞
        wave = Math.sin(wy * 65 + wz * 15);
      } else if (part === 'head') {
        // 額のM字模様と頬のライン
        wave = Math.sin(wz * 55 + Math.abs(wx) * 35 - wy * 20);
      } else {
        // 背中から脇腹へ流れるタビー縞
        wave = Math.sin(wz * 42 + wy * 16 + Math.abs(wx) * 18 + n * 1.5);
      }
      const stripeFactor = smoothstep(0.15, 0.65, wave);
      c.lerp(pal.stripe, stripeFactor * 0.85);

      // お腹・胸・あご・内股は明るい毛色
      // 指示書1 B2: 胸元・お腹・あご・足先の白を広く、なめらかに
      if (part === 'body') {
        const bellyT = smoothstep(0.19, 0.11, wy) * smoothstep(0.09, 0.03, Math.abs(wx));
        const bibT = smoothstep(0.1, 0.16, wz) * smoothstep(0.235, 0.16, wy) * smoothstep(0.075, 0.02, Math.abs(wx));
        c.lerp(pal.belly, Math.max(bellyT, bibT));
      }
      if (part === 'head' && wz > 0.15) {
        c.lerp(pal.belly, smoothstep(0.24, 0.19, wy) * smoothstep(0.15, 0.19, wz));
      }
      if (part === 'leg' && wy < 0.05) {
        c.lerp(pal.belly, smoothstep(0.05, 0.012, wy) * 0.85);
      }
    } else if (coat === 'mike') {
      // 三毛猫：白ベースに茶と黒の丸みのあるパッチ
      const p1 =
        Math.sin(wx * 9.5 + 1.2) * Math.cos(wy * 8.5 - 0.7) * Math.sin(wz * 8.0 + 0.4) +
        (n - 0.5) * 0.35;
      const p2 =
        Math.cos(wx * 10.5 - 1.9) * Math.sin(wy * 9.0 + 1.1) * Math.cos(wz * 9.5 - 0.8) +
        (n - 0.5) * 0.35;

      // お腹や足先は白を残す
      let mask = wy < 0.12 && part !== 'tail' ? smoothstep(0.06, 0.12, wy) : 1.0;
      // 指示書2 第一部4: 胸元・お腹・前足・首回りは白。ブチは背中・腰の横・お尻だけ(頭としっぽは前のまま)
      if (part === 'body') mask = smoothstep(0.15, 0.2, wy) * smoothstep(0.07, -0.01, wz);
      else if (part === 'leg') mask = wz < 0 ? smoothstep(0.1, 0.16, wy) : 0;
      if (part === 'body' || part === 'leg') {
        // 指示書2 第一部4: 胴と脚は、背中〜腰の横〜お尻に丸っこいブチを置く(前の p1/p2 は背中ではほぼ負で、白一色になった)
        const warp = (n - 0.5) * 0.025;
        const dO = Math.hypot((wx - 0.035) / 1.0, (wy - 0.24) / 0.8, (wz + 0.075) / 1.3) + warp; // 茶: 背中の左〜腰
        const dB = Math.hypot((wx + 0.04) / 1.0, (wy - 0.23) / 0.8, (wz - 0.01) / 1.1) - warp; // 黒: 背中の右前
        const dO2 = Math.hypot((wx + 0.02) / 1.0, (wy - 0.2) / 0.9, (wz + 0.15) / 1.0) + warp; // 茶: お尻
        const tO = smoothstep(0.085, 0.07, Math.min(dO, dO2)) * mask, tB = smoothstep(0.07, 0.058, dB) * mask;
        if (tO > tB) c.lerp(pal.patchOrange, tO);
        else c.lerp(pal.patchBlack, tB);
      } else if (p1 * mask > 0.18) {
        c.lerp(pal.patchOrange, smoothstep(0.18, 0.32, p1 * mask));
      } else if (p2 * mask > 0.2) {
        c.lerp(pal.patchBlack, smoothstep(0.2, 0.34, p2 * mask));
      }
      // 頭に可愛いハチワレ風の茶・黒パッチを添える
      if (part === 'head' && wy > 0.23) {
        if (wx > 0.012) c.lerp(pal.patchOrange, smoothstep(0.01, 0.03, wx));
        if (wx < -0.012) c.lerp(pal.patchBlack, smoothstep(-0.01, -0.03, wx));
      }
    } else if (coat === 'hachiware') {
      // ハチワレ（タキシード＆マスク）
      if (part === 'head') {
        // 鼻筋から口元にかけて逆V字に白く抜く
        const maskSlope = (0.255 - wy) * 0.95;
        if (wz > 0.165 && Math.abs(wx) < maskSlope) {
          const t = smoothstep(maskSlope, maskSlope - 0.018, Math.abs(wx));
          c.lerp(pal.belly, t);
        }
      } else if (part === 'body') {
        // 胸元〜お腹が白い
        if (wy < 0.165 || (wz > 0.08 && wy < 0.21 && Math.abs(wx) < 0.048)) {
          const t = smoothstep(0.175, 0.13, wy);
          c.lerp(pal.belly, t);
        }
      } else if (part === 'leg') {
        // ハチワレはデフォで可愛い白ソックス
        if (wy < 0.075) {
          c.lerp(pal.belly, smoothstep(0.075, 0.05, wy));
        }
      }
    } else if (coat === 'kuro' || coat === 'shiro') {
      // 単色でも立体感が出るようにわずかな陰影グラデーションを入れる
      const shade = smoothstep(0.05, 0.3, wy) * 0.06;
      c.offsetHSL(0, 0, shade - 0.03);
    }

    // 靴下オプション
    if (socks && part === 'leg' && wy < 0.065) {
      c.lerp(pawWhite, smoothstep(0.065, 0.045, wy));
    }

    return c;
  }

  // ジオメトリに頂点カラーを適用するヘルパー
  function applyVertexColor(geom, colorFn) {
    const pos = geom.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const col = colorFn(pos.getX(i), pos.getY(i), pos.getZ(i), i);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    return geom;
  }

  // 複数のBufferGeometryを1つに結合する軽量ヘルパー（外部モジュール不要・メッシュ数削減用）
  function mergeGeoms(geoms) {
    let totalVerts = 0;
    let totalIndices = 0;
    for (const g of geoms) {
      totalVerts += g.attributes.position.count;
      totalIndices += g.index ? g.index.count : g.attributes.position.count;
    }
    const posArr = new Float32Array(totalVerts * 3);
    const normArr = new Float32Array(totalVerts * 3);
    const colArr = new Float32Array(totalVerts * 3);
    const indices = new Uint32Array(totalIndices);

    let vOffset = 0;
    let iOffset = 0;
    for (const g of geoms) {
      if (!g.attributes.normal) g.computeVertexNormals();
      const pos = g.attributes.position;
      const norm = g.attributes.normal;
      const col = g.attributes.color;
      const count = pos.count;

      posArr.set(pos.array, vOffset * 3);
      normArr.set(norm.array, vOffset * 3);
      if (col) {
        colArr.set(col.array, vOffset * 3);
      } else {
        colArr.fill(1, vOffset * 3, (vOffset + count) * 3);
      }

      if (g.index) {
        const idx = g.index.array;
        for (let j = 0; j < idx.length; j++) indices[iOffset + j] = idx[j] + vOffset;
        iOffset += idx.length;
      } else {
        for (let j = 0; j < count; j++) indices[iOffset + j] = vOffset + j;
        iOffset += count;
      }
      vOffset += count;
      g.dispose();
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
    merged.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
    return merged;
  }

  // ==========================================
  // 2. マテリアル定義 (MeshStandardMaterial)
  // ==========================================
  const furMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.02,
  });

  const resolvedEyeHex = eyeColor !== null ? eyeColor : pal.eye;
  const eyeSurfaceMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.15,
    metalness: 0.08,
  });

  // ==========================================
  // 3. ジオメトリ & 階層構造 (Group) の構築
  // ==========================================
  const root = new THREE.Group();
  root.name = 'AohamaNeko';

  // 体全体の基準ピボット（地面からの高さやジャンプ・傾きを制御）
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.set(0, 0.19, 0);
  root.add(pelvisGroup);

  // --- 腰・後半身 (Hips) ---
  const hipPivot = new THREE.Group();
  pelvisGroup.add(hipPivot);

  // 指示書1 A2: 極を前後に、経度の継ぎ目をお腹の下へ(rotateX → rotateZ)。分割 16x14 → 16x12(B3)
  const hipGeom = new THREE.SphereGeometry(1, 16, 12).rotateX(Math.PI / 2).rotateZ(Math.PI / 2);
  const hipPos = hipGeom.attributes.position;
  for (let i = 0; i < hipPos.count; i++) {
    let x = hipPos.getX(i);
    let y = hipPos.getY(i);
    let z = hipPos.getZ(i);
    // 猫の丸みのあるお尻と腰のラインに成形
    const rearRound = z < 0 ? 1.0 - 0.12 * Math.pow(-z, 1.5) : 1.0 - 0.08 * z;
    x *= 0.068 * rearRound;
    y *= 0.067 * (z < 0 ? 1.03 : 0.98); // 指示書1 A2: 胸とつなぎ目の太さをそろえる(前 0.066・1.04/0.96)
    z = z * 0.11 - 0.05; // 重なりを深く(前 z*0.105-0.055)
    if (y < 0) y *= 0.88; // お腹側は少しすっきり
    hipPos.setXYZ(i, x, y, z);
  }
  applyVertexColor(hipGeom, (x, y, z) => sampleFurColor(x, y + 0.19, z, 'body'));
  const hipMesh = new THREE.Mesh(hipGeom, furMat);
  hipMesh.castShadow = true;
  hipMesh.receiveShadow = true;
  hipMesh.name = 'hip';
  hipPivot.add(hipMesh);

  // --- 胸・前半身 (Chest / Spine) ---
  const chestPivot = new THREE.Group();
  chestPivot.position.set(0, 0.005, 0.01);
  pelvisGroup.add(chestPivot);

  const chestGeom = new THREE.SphereGeometry(1, 16, 12).rotateX(Math.PI / 2).rotateZ(Math.PI / 2); // 指示書1 A2・B3(腰と同じ)
  const chestPos = chestGeom.attributes.position;
  for (let i = 0; i < chestPos.count; i++) {
    let x = chestPos.getX(i);
    let y = chestPos.getY(i);
    let z = chestPos.getZ(i);
    // 胸元のふくらみと肩甲骨のしなやかさ
    const frontTaper = z > 0 ? 1.0 - 0.14 * Math.pow(z, 1.4) : 1.0;
    x *= 0.067 * frontTaper; // 指示書1 A2: 腰とそろえる(前 0.064)
    y *= 0.066 * (z > 0.2 ? 1.05 : 1.0); // (前 0.064・1.06)
    z = z * 0.11 + 0.045; // 重なりを深く(前 z*0.105+0.05)
    if (z > 0.06 && y < 0) y *= 1.08; // 胸の鳩胸感
    chestPos.setXYZ(i, x, y, z);
  }
  applyVertexColor(chestGeom, (x, y, z) => sampleFurColor(x, y + 0.195, z + 0.01, 'body'));
  const chestMesh = new THREE.Mesh(chestGeom, furMat);
  chestMesh.castShadow = true;
  chestMesh.receiveShadow = true;
  chestMesh.name = 'chest';
  chestPivot.add(chestMesh);

  // --- 首 (Neck) & 頭 (Head) ---
  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 0.032, 0.125);
  chestPivot.add(neckPivot);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.028, 0.022);
  neckPivot.add(headPivot);

  // 頭蓋＋ぷっくりした頬＋ωマズル＋ピンクの鼻を1メッシュに統合
  const craniumGeom = new THREE.SphereGeometry(1, 18, 14); // 指示書1 B3(前 18x16)
  const cPos = craniumGeom.attributes.position;
  for (let i = 0; i < cPos.count; i++) {
    let x = cPos.getX(i);
    let y = cPos.getY(i);
    let z = cPos.getZ(i);
    // ほっぺた（ウィスカーパッド横）をふっくらさせ、頭頂部をなだらかに
    const cheek = y < 0.1 && y > -0.65 && z > -0.2 ? 1.0 + 0.16 * (1 - Math.abs(y + 0.25)) : 1.0;
    const brow = z > 0.3 && y > 0.1 ? 0.92 : 1.0;
    x *= 0.061 * cheek * brow;
    y *= 0.054;
    z = z * 0.058 + 0.012;
    cPos.setXYZ(i, x, y, z);
  }
  applyVertexColor(craniumGeom, (x, y, z) =>
    sampleFurColor(x, y + 0.255, z + 0.16, 'head')
  );

  // ωマズル（左右のぷっくり袋）
  const muzzleLGeom = new THREE.SphereGeometry(0.021, 10, 8);
  muzzleLGeom.scale(1.05, 0.82, 1.15);
  muzzleLGeom.translate(0.014, -0.014, 0.058);
  applyVertexColor(muzzleLGeom, (x, y, z) => sampleFurColor(x, y + 0.23, z + 0.18, 'head'));

  const muzzleRGeom = new THREE.SphereGeometry(0.021, 10, 8);
  muzzleRGeom.scale(1.05, 0.82, 1.15);
  muzzleRGeom.translate(-0.014, -0.014, 0.058);
  applyVertexColor(muzzleRGeom, (x, y, z) => sampleFurColor(x, y + 0.23, z + 0.18, 'head'));

  // ちょこんとした逆三角形の鼻
  const noseGeom = new THREE.SphereGeometry(0.0085, 8, 6);
  const nPos = noseGeom.attributes.position;
  for (let i = 0; i < nPos.count; i++) {
    let x = nPos.getX(i);
    let y = nPos.getY(i);
    let z = nPos.getZ(i);
    if (y < 0) x *= 0.55; // 下に向かって細くなる逆三角形
    z *= 0.7;
    nPos.setXYZ(i, x, y - 0.004, z + 0.074);
  }
  applyVertexColor(noseGeom, () => noseCol);

  const headMergedGeom = mergeGeoms([craniumGeom, muzzleLGeom, muzzleRGeom, noseGeom]);
  const headMesh = new THREE.Mesh(headMergedGeom, furMat);
  headMesh.name = 'head';
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headPivot.add(headMesh);

  // --- あご・口 (Jaw: meow や eat で開閉する) ---
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, -0.02, 0.032);
  headPivot.add(jawPivot);

  const chinGeom = new THREE.SphereGeometry(0.018, 10, 8);
  chinGeom.scale(1.05, 0.55, 1.25);
  chinGeom.translate(0, -0.001, 0.009); // 指示書1 A4: マズルの下に収める(前 (0,-0.004,0.016))
  applyVertexColor(chinGeom, (x, y, z) => sampleFurColor(x, y + 0.21, z + 0.2, 'head')); // 指示書1 A4: あごの色を顔に合わせる(前 pal.belly 一色)

  const tongueGeom = new THREE.SphereGeometry(0.012, 8, 6);
  tongueGeom.scale(0.95, 0.35, 1.15);
  tongueGeom.translate(0, 0.003, 0.008); // 指示書1 A4: 口を閉じた時に出ない(前 (0,0.002,0.018))
  applyVertexColor(tongueGeom, () => new THREE.Color(0xe8747c));

  const jawMesh = new THREE.Mesh(mergeGeoms([chinGeom, tongueGeom]), furMat);
  jawMesh.name = 'jaw';
  jawPivot.add(jawMesh);

  // --- 目 (Eyes: 虹彩・縦長の瞳孔・ハイライトを頂点カラーで表現、まばたき可能) ---
  const eyesPivot = new THREE.Group();
  eyesPivot.position.set(0, 0.006, 0.056);
  headPivot.add(eyesPivot);

  const irisColor = new THREE.Color(resolvedEyeHex);
  const pupilColor = new THREE.Color(0x0c0c0e);
  const highlightColor = new THREE.Color(0xffffff);

  function createEyeGeom(side) {
    const g = new THREE.SphereGeometry(0.0145, 12, 10); // 指示書1 B3(前 14x12)
    g.scale(1.0, 0.86, 0.65); // 指示書1 A4: 少しアーモンド形(前 0.95, 1.05)
    const p = g.attributes.position;
    const colors = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      let c = irisColor.clone();
      if (z > 0.002) {
        // 瞳の縁を少し暗くして奥行きを出す
        const r = Math.hypot(x / 0.0145, y / 0.0125);
        c.multiplyScalar(lerp(1.1, 0.65, clamp(r, 0, 1)));
        // 猫らしい縦スリット〜アーモンド型の瞳孔
        const pupilDist = Math.hypot(x / 0.0042, y / 0.0105);
        if (pupilDist < 1.0) {
          c.lerp(pupilColor, smoothstep(1.0, 0.65, pupilDist));
        }
        // キラッと光るキャッチライト
        const hlDist = Math.hypot(x - 0.0038 * side, y - 0.0035);
        if (hlDist < 0.0028) {
          c.lerp(highlightColor, smoothstep(0.0028, 0.001, hlDist));
        }
      }
      // 指示書2 第一部3: 指示書1 A4 の上まぶた(頂点色)は外した。虹彩とハイライトを上まで見せる
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      // 顔のカーブに沿って少し外向きに配置
      const rotY = side * 0.32; // 指示書1 A4: 外向きを強く(前 0.26)
      const tilt = side * 0.14; // 目尻を少し上げる
      const tx = x * Math.cos(tilt) - y * Math.sin(tilt), ty = x * Math.sin(tilt) + y * Math.cos(tilt);
      const rx = tx * Math.cos(rotY) + z * Math.sin(rotY);
      const rz = -tx * Math.sin(rotY) + z * Math.cos(rotY);
      p.setXYZ(i, rx + side * 0.028, ty, rz); // 間隔を広く(前 0.025)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }

  const eyesMesh = new THREE.Mesh(
    mergeGeoms([createEyeGeom(1), createEyeGeom(-1)]),
    eyeSurfaceMat
  );
  eyesPivot.add(eyesMesh);

  // --- 耳 (Ears: 先端が丸みのある三角形、内側にピンクの耳介くぼみ) ---
  function createEar(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.033, 0.03, 0.004); // 指示書2 第二部1: 生え際を頭の中へさらに深く(指示書1 では (0.036, 0.036, 0.006)、元は (0.036, 0.042, 0.008))
    pivot.rotation.z = -side * 0.24;
    pivot.rotation.x = 0.14;

    const geom = new THREE.ConeGeometry(0.028, 0.056, 12, 6); // 指示書1 A4: 根元を太く(前 0.025・0.052)
    const pos = geom.attributes.position;
    const cols = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i) + 0.028; // 根元を原点(0,0,0)に
      let z = pos.getZ(i);
      const hNorm = clamp(y / 0.056, 0, 1);
      // 指示書1 A4: 外の縁に丸み(中ほどを少し膨らませ、先を丸く)
      const puff = 1 + 0.22 * Math.sin(hNorm * Math.PI * 0.85);
      x *= puff; z *= puff;

      // 前面(z>0)を少しくぼませて耳介を作り、背面(z<0)を丸くする
      z *= 0.55;
      if (z > 0 && hNorm < 0.85 && Math.abs(x) < 0.016 * (1 - hNorm * 0.7)) {
        z -= 0.004 * (1 - hNorm);
      }
      // 耳先を少しだけ外側に反らせる猫耳カーブ
      x += side * Math.pow(hNorm, 2) * 0.004;
      // 指示書2 第二部1: 根元の外側の縁を頭の丸みに沿って下げる(外へ行くほど頭の面は低い)
      if (hNorm < 0.3) y -= Math.max(0, x * side) * 0.45 * (1 - hNorm / 0.3);
      pos.setXYZ(i, x, y, z);

      // 内側は優しいピンク、外側は毛柄の色（三毛なら左右で色分け）
      const isInner =
        z > -0.001 && hNorm > 0.12 && hNorm < 0.8 && Math.abs(x) < 0.016 * (1 - hNorm * 0.65);
      let col;
      if (isInner) {
        col = sampleFurColor(side * 0.04, 0.3, 0.16, 'head').lerp(pinkEar, 0.78);
      } else {
        col = sampleFurColor(side * 0.045 + x, 0.29 + y, 0.16 + z, 'head');
      }
      cols[i * 3] = col.r;
      cols[i * 3 + 1] = col.g;
      cols[i * 3 + 2] = col.b;
    }
    geom.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geom.computeVertexNormals();

    const mesh = new THREE.Mesh(geom, furMat);
    mesh.castShadow = true;
    pivot.add(mesh);
    headPivot.add(pivot);
    return pivot;
  }

  const earL = createEar(1);
  const earR = createEar(-1);

  // --- ひげ (Whiskers: 4本の繊細なひげを1つの軽量メッシュに統合) ---
  function createWhiskers() {
    const parts = [];
    const wCol = new THREE.Color(0xf5f3ed);
    for (const side of [1, -1]) {
      for (const angle of [-0.12, 0.08]) {
        const g = new THREE.CylinderGeometry(0.0005, 0.0011, 0.052, 4, 1);
        g.rotateZ( side * (Math.PI / 2 + angle) );
        g.rotateY( -side * 0.22 );
        g.translate(side * 0.038, -0.015 + angle * 0.02, 0.056);
        applyVertexColor(g, () => wCol);
        parts.push(g);
      }
    }
    const mesh = new THREE.Mesh(mergeGeoms(parts), furMat);
    headPivot.add(mesh);
  }
  createWhiskers();

  // --- 四肢 (Legs: 上腕/腿 と 前腕/脛＋丸い足先 の2段関節) ---
  function createLeg(isFront, isLeft) {
    const side = isLeft ? 1 : -1;
    const hipX = side * (isFront ? 0.035 : 0.038); // 指示書1 A3: 内側へ(前 0.044 / 0.047)
    const hipY = -0.015; // 指示書1 A3: 少し上げて胴にめり込ませる(前 -0.025 / -0.02)
    const hipZ = isFront ? 0.095 : -0.095;

    const upperPivot = new THREE.Group();
    upperPivot.position.set(hipX, hipY, hipZ);
    (isFront ? chestPivot : hipPivot).add(upperPivot);

    // 上腕・太もも（後ろ脚の太ももは猫らしくしっかり筋肉質に）
    const upperLen = isFront ? 0.085 : 0.092;
    const upperRadTop = isFront ? 0.028 : 0.036; // 指示書1 A3: 付け根を広く(前 0.025 / 0.034)
    const upperRadBot = isFront ? 0.018 : 0.02;
    const upperGeom = new THREE.CylinderGeometry(upperRadTop, upperRadBot, upperLen, 10, 6);
    const uPos = upperGeom.attributes.position;
    for (let i = 0; i < uPos.count; i++) {
      let x = uPos.getX(i);
      let y = uPos.getY(i) - upperLen * 0.5;
      let z = uPos.getZ(i);
      // 上端と下端を丸めて関節の切れ目をなくす
      const t = clamp(-y / upperLen, 0, 1);
      if (t < 0.15) {
        const s = Math.sin((t / 0.15) * (Math.PI / 2));
        x *= 0.85 + 0.15 * s; // 指示書1 A3: 上端を丸く絞らない(前 0.6 + 0.4s)
        z *= 0.85 + 0.15 * s;
      }
      z *= isFront ? 1.12 : 1.3; // 指示書1 A3: 肩・太ももの前後幅を広く(前 前脚 1.0・後脚 1.25)
      uPos.setXYZ(i, x, y, z);
    }
    applyVertexColor(upperGeom, (x, y, z) =>
      sampleFurColor(hipX + x, 0.17 + y, hipZ + z, 'leg')
    );
    const upperMesh = new THREE.Mesh(upperGeom, furMat);
    upperMesh.castShadow = true;
    upperMesh.receiveShadow = true;
    upperMesh.name = 'upper_' + (isFront ? 'F' : 'B') + (isLeft ? 'L' : 'R');
    upperPivot.add(upperMesh);

    // 膝・肘〜足先 (Lower leg + Paw)
    const lowerPivot = new THREE.Group();
    lowerPivot.position.set(0, -upperLen + 0.008, 0);
    upperPivot.add(lowerPivot);

    const lowerLen = isFront ? 0.088 : 0.086;
    const lowerGeom = new THREE.CylinderGeometry(0.017, 0.0135, lowerLen, 10, 5);
    lowerGeom.translate(0, -lowerLen * 0.5, 0);
    applyVertexColor(lowerGeom, (x, y, z) =>
      sampleFurColor(hipX + x, 0.09 + y, hipZ + z, 'leg')
    );

    // ぷっくり丸い猫の手（クリームパン）
    const pawGeom = new THREE.SphereGeometry(0.0175, 10, 6); // 指示書1 B3(前 10x8)
    pawGeom.scale(1.02, 0.65, 1.32);
    pawGeom.translate(0, -lowerLen + 0.004, 0.007);
    applyVertexColor(pawGeom, (x, y, z) =>
      sampleFurColor(hipX + x, 0.015, hipZ + z, 'leg')
    );

    const lowerMesh = new THREE.Mesh(mergeGeoms([lowerGeom, pawGeom]), furMat);
    lowerMesh.castShadow = true;
    lowerMesh.receiveShadow = true;
    lowerMesh.name = 'paw_' + (isFront ? 'F' : 'B') + (isLeft ? 'L' : 'R');
    lowerPivot.add(lowerMesh);

    return { upper: upperPivot, lower: lowerPivot };
  }

  const legFL = createLeg(true, true);
  const legFR = createLeg(true, false);
  const legFRBaseY = legFR.upper.position.y;
  const legBL = createLeg(false, true);
  const legBR = createLeg(false, false);

  // --- しっぽ (Tail: 4節のGroup入れ子構造。long / kagi / bob 対応) ---
  const tailSegments = [];
  const segLengths =
    tailType === 'bob'
      ? [0.032, 0.028, 0.022, 0.018]
      : tailType === 'kagi'
      ? [0.075, 0.072, 0.065, 0.055]
      : [0.08, 0.078, 0.074, 0.07]; // 合計約0.30m

  let parentTailGroup = hipPivot;
  let accumTailZ = 0;

  for (let s = 0; s < 4; s++) {
    const segGroup = new THREE.Group();
    if (s === 0) {
      segGroup.position.set(0, 0.024, -0.135);
    } else {
      segGroup.position.set(0, 0, -segLengths[s - 1] + 0.006);
    }
    parentTailGroup.add(segGroup);

    const len = segLengths[s];
    const rStart = tailType === 'bob' ? 0.022 : 0.0185 * (1 - s * 0.08);
    const rEnd = tailType === 'bob' ? 0.018 : 0.0185 * (1 - (s + 1) * 0.09);

    let segGeom = new THREE.CylinderGeometry(rEnd, rStart, len, 10, 4);
    segGeom.rotateX(Math.PI / 2); // -Z方向に伸ばす
    segGeom.translate(0, 0, -len * 0.5);
    // 指示書2 第二部3: 節のつなぎ目に丸い玉を入れて、曲げても角が立たない(メッシュは増やさず節の形に入れる)
    if (s > 0) segGeom = mergeGeoms([segGeom, new THREE.SphereGeometry(rStart * 1.02, 8, 6)]);

    // 先端の節は丸く閉じる
    if (s === 3) {
      const tipGeom = new THREE.SphereGeometry(rEnd, 10, 8);
      tipGeom.translate(0, 0, -len);
      const combined = mergeGeoms([segGeom, tipGeom]);
      const zBase = accumTailZ;
      applyVertexColor(combined, (x, y, z) =>
        sampleFurColor(x, 0.22 + y, -0.14 + zBase + z, 'tail')
      );
      const mesh = new THREE.Mesh(combined, furMat);
      mesh.name = 'tail3';
      mesh.castShadow = true;
      segGroup.add(mesh);
    } else {
      const zBase = accumTailZ;
      applyVertexColor(segGeom, (x, y, z) =>
        sampleFurColor(x, 0.22 + y, -0.14 + zBase + z, 'tail')
      );
      const mesh = new THREE.Mesh(segGeom, furMat);
      mesh.castShadow = true;
      segGroup.add(mesh);
    }

    accumTailZ -= len;
    tailSegments.push(segGroup);
    parentTailGroup = segGroup;
  }

  if (scene && typeof scene.add === 'function') {
    scene.add(root);
  }

  // ==========================================
  // 4. ポーズ・アニメーション制御システム
  // ==========================================
  let currentPose = 'curl';
  let tailTune = null; // 頁(web/)用の追加: 丸まりのしっぽの曲げを外から差し替える {x:[4], y:[4]}(鍋の中でしっぽを体に沿わせる)
  let currentMood = 'relaxed'; // 'relaxed' | 'alert' | 'angry' | 'happy'
  let animTime = 0;
  let blinkTimer = 2.5;
  let earTwitchTimer = 4.0;
  let activeEarTwitch = 0;

  // 補間用の現在関節ステート
  const rig = {
    pelvisY: 0.19,
    pelvisZ: 0,
    pelvisPitch: 0,
    pelvisRoll: 0,
    bodyScale: 1,
    tailPuff: 1,

    chestPitch: 0,
    chestYaw: 0,
    hipPitch: 0,
    hipYaw: 0,

    neckPitch: 0,
    neckYaw: 0,
    headPitch: 0,
    headYaw: 0,
    headRoll: 0,
    jawOpen: 0,

    earLPitch: 0.14,
    earLRoll: -0.24,
    earRPitch: 0.14,
    earRRoll: 0.24,

    flUpperX: 0,
    flUpperZ: 0,
    flLowerX: 0,
    frUpperX: 0,
    frUpperZ: 0,
    frLowerX: 0,
    blUpperX: 0,
    blUpperZ: 0,
    blLowerX: 0,
    brUpperX: 0,
    brUpperZ: 0,
    brLowerX: 0,

    tailX: [0.3, 0.2, 0.15, 0.1],
    tailY: [0, 0, 0, 0],
  };

  function defaultTargets() {
    return {
      pelvisY: 0.19,
      pelvisZ: 0,
      pelvisPitch: 0,
      pelvisRoll: 0,
      bodyScale: 1.0,
      tailPuff: 1.0,

      chestPitch: 0,
      chestYaw: 0,
      hipPitch: 0,
      hipYaw: 0,

      neckPitch: 0.08,
      neckYaw: 0,
      headPitch: -0.05,
      headYaw: 0,
      headRoll: 0,
      jawOpen: 0,

      earLPitch: 0.14,
      earLRoll: -0.24,
      earRPitch: 0.14,
      earRRoll: 0.24,

      flUpperX: 0.06,
      flUpperZ: 0,
      flLowerX: -0.08,
      frUpperX: 0.06,
      frUpperZ: 0,
      frLowerX: -0.08,
      blUpperX: -0.14,
      blUpperZ: 0,
      blLowerX: 0.22,
      brUpperX: -0.14,
      brUpperZ: 0,
      brLowerX: 0.22,

      tailX: [0.25, 0.2, 0.15, 0.1],
      tailY: [0, 0, 0, 0],
    };
  }

  // 指示書1 B1: 接地を合わせた姿勢の数(撮影台と extras/neko-argon の ground.mjs で、肉球・お腹・お尻が y=0 に来るように測って決めた)
  // groom(お顔洗い)の型: [首 pitch, 頭 pitch, 頭 yaw, 頭 roll, 右上腕 x, 右上腕 z, 右前腕 x]。groom3.mjs search A / B で選んだ
  const GROOM = { cycle: 6.0, A: [0.45, 0.15, 0.0, 0.3, -0.8, -0.1, -1.4], B: [0.8, 0.3, 0.6, 0.4, -1.0, -0.7, -1.7], strokeHz: 2.6 };
  const GROOM_STROKE = { detour: 0.8 };
  // 代理監督の指示3: 円の中心(肉球の中心、頭の局所 m)と面の法線(顔・頭の表面の法線)。groom4.mjs centers で型 A / B から測った
  // lift: 円の面を表面から浮かせる(m)。前足の形と顔の丸みで、円の一部が顔に入らないように。big: ときどきの大きい一周の倍率の足し分
  // opt.toEar: e1 を耳の方へ向ける(その向きを縮める)。opt.wrap: 円を頭蓋の丸みに沿わせる
  const circleOf = (C, nrm, rMin, rMax, lift, big, opt = {}) => {
    const n = new THREE.Vector3(...nrm).normalize(), c = new THREE.Vector3(...C).addScaledVector(n, lift);
    let e1 = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0, 1, 0)).normalize();
    if (opt.toEar) { const d = new THREE.Vector3(...opt.toEar).sub(c); e1 = d.addScaledVector(n, -d.dot(n)).normalize() }
    const e2 = new THREE.Vector3().crossVectors(n, e1);
    return { C: c, n, e1, e2, rMin, rMax, big, toEar: !!opt.toEar, wrap: !!opt.wrap, gap: opt.wrap ? skullGap(c) : 0 }; // gap: 中心での頭蓋の面からの浮き(円の上で保つ)
  };
  // 頭蓋(頭の局所)を楕円体で見る: 半径 x 0.061・y 0.054・z 0.058、中心 z 0.012(頭の後ろでは頬のふくらみは無い)
  const SK = { a: 0.061, b: 0.054, c: 0.058, z0: 0.012 };
  function skullSurface(P) { // P から楕円体の中心へ向かう線と面の交わり・面の外向きの法線
    const ux = P.x, uy = P.y, uz = P.z - SK.z0, s = 1 / Math.sqrt((ux / SK.a) ** 2 + (uy / SK.b) ** 2 + (uz / SK.c) ** 2);
    const S = new THREE.Vector3(ux * s, uy * s, uz * s + SK.z0), N = new THREE.Vector3(S.x / SK.a ** 2, S.y / SK.b ** 2, (S.z - SK.z0) / SK.c ** 2).normalize();
    return [S, N];
  }
  function skullGap(P) { const [S, N] = skullSurface(P); return P.clone().sub(S).dot(N) }
  function wrapOnSkull(P, gap) { const [S, N] = skullSurface(P); P.copy(S).addScaledVector(N, gap) }
  const LIFT_A = 0.0058, LIFT_B = 0.0048;
  const GROOM_CIRCLE = {
    A: circleOf([-0.0469, -0.0046, 0.0812], [-0.7235, 0.4688, 0.5067], 0.003, 0.009, LIFT_A, 0.45), // 顔の段: 右の目の下〜鼻の横
    B: circleOf([-0.0575, 0.0381, -0.0305], [-0.6688, 0.4663, -0.579], 0.010, 0.025, LIFT_B, 0.3, { toEar: [-0.033, 0.03, 0.004], wrap: true }), // 耳の段: 右の耳の後ろ(代理監督の指示4: 10〜25mm、ときどき 1.3 倍。耳の方は縮め、頭の丸みに沿う)
    lapsPerSec: 1.5, breathe: 1.6, shoulder: 0.0015,
  };
  // 右前足の 2 関節 IK: 肩(上腕の付け根)から見た手先 P(胸の局所)→ { q: 上腕の向き(四元数), lx: 前腕 x }。
  //   肘(前腕 x)は余弦定理で。肘から肉球の中心まで (0, -0.084, 0.007)、曲がりは前腕 x が負の枝(前足を顔へ折る向き)。
  //   上腕は、いまの上腕の向き base から、肩→手先の向きを P へ回す一番小さい回し(なめらかにした姿勢からねじれが飛ばない)。
  //   (指示3 の版は上腕を x・z の二つの角だけで解いたので、横へ遠い所(大きい円の耳の側)へ届かなかった。上腕は肩の玉の関節として三つの軸で回す)
  const FR_L1 = -legFR.lower.position.y, PAW_A = 0.084, PAW_B = 0.007;
  const _qv = new THREE.Vector3(), _qa = new THREE.Quaternion();
  //   avoid(肩から見た頭の中心)を渡すと、肩→手先の軸のまわりに肘を回して(手先は動かない)、肘を頭から遠い側へ寄せる(上腕が頭・耳に入らないように。最大 GROOM_SWIVEL rad)
  function ikFR(P, base, avoid = null) {
    const R = Math.hypot(PAW_A, PAW_B), phi = Math.atan2(PAW_B, PAW_A);
    const c = clamp((P.lengthSq() - FR_L1 * FR_L1 - R * R) / (2 * FR_L1), -R, R);
    const lx = phi - Math.acos(c / R);
    _qv.set(0, -FR_L1 - PAW_A * Math.cos(lx) - PAW_B * Math.sin(lx), -PAW_A * Math.sin(lx) + PAW_B * Math.cos(lx)).applyQuaternion(base).normalize();
    const axis = P.clone().normalize();
    let q = _qa.setFromUnitVectors(_qv, axis).clone().multiply(base);
    if (avoid) {
      const E = new THREE.Vector3(0, -FR_L1, 0).applyQuaternion(q); // 肘
      const ep = E.clone().addScaledVector(axis, -E.dot(axis)), hp = avoid.clone().addScaledVector(axis, -avoid.dot(axis));
      if (ep.lengthSq() > 1e-10 && hp.lengthSq() > 1e-10) {
        const want = hp.normalize().negate(); ep.normalize();
        let ang = Math.atan2(new THREE.Vector3().crossVectors(ep, want).dot(axis), ep.dot(want));
        ang = clamp(ang, -GROOM_SWIVEL, GROOM_SWIVEL);
        q = new THREE.Quaternion().setFromAxisAngle(axis, ang).multiply(q);
      }
    }
    return { q, lx };
  }
  const GROOM_SWIVEL = 0.9;
  const groomInfo = { on: false, tau: 0, name: '', touch: null, rub: false, flick: 0 };
  const SIT_POSES = ['sit', 'look', 'groom', 'meow', 'scratch'];
  const SIT = { pelvisY: 0.088, pelvisPitch: -0.62, chestPitch: -0.1, hipPitch: 0.25, front: -0.55, frontLower: 0.05, thigh: -1.4, shin: 1.6 };
  const LOAF = { pelvisY: 0.067, upper: 1.1, upperIn: 0.35, lower: 0.8, thigh: -1.55, shin: 2.85 }; // 指示書2 第一部1: 前足は後ろ・内へ引いて胸の中へ(前 upper -1.0・lower 2.75)
  const CURL = { pelvisY: 0.073, tailX: [-0.45, 0.2, 0.05, 0.0], tailY: [-0.6, -0.65, -0.65, -0.55] };
  const EAT = { pelvisY: 0.18, upper: 0.55, lower: -1.0, thigh: -0.55, shin: 0.75 };
  const STRETCH = { pelvisY: 0.154, pitch: 0.55, front: -1.2, frontLower: 0, hind: 0.1, hindLower: 0.05 };
  const CREEP = { pelvisY: 0.145, upper: 0.9, lower: -1.6, thigh: -1.0, shin: 1.7 };
  const KNEAD = { pelvisY: 0.13, pitch: -0.42, front: -0.3, frontLower: 0, thigh: -1.1, shin: 1.35 };

  // ポーズごとの目標関節角度を計算
  function computePoseTargets(poseName, t, mood, lookOffset) {
    const tgt = defaultTargets();
    groomInfo.on = false;
    const sin = Math.sin;
    const cos = Math.cos;

    // enterポーズ（土鍋・箱・袋に入る）は内部で curl か loaf になる
    const effectivePose =
      poseName === 'enter'
        ? Math.floor(t * 0.05) % 2 === 0
          ? 'loaf'
          : 'curl'
        : poseName;

    switch (effectivePose) {
      case 'walk': {
        const w = t * 7.5;
        // 四足歩行の対角線サイクル (FL-BR と FR-BL)
        const sFL = sin(w);
        const sFR = sin(w + Math.PI);
        const sBL = sin(w + Math.PI * 0.85);
        const sBR = sin(w - Math.PI * 0.15);

        tgt.pelvisY = 0.18 + Math.abs(sin(w)) * 0.008; // 指示書1 B1: 脚の付け根を上げた分、下げて接地(前 0.188)
        tgt.chestYaw = sin(w) * 0.06;
        tgt.hipYaw = -sin(w) * 0.07;
        tgt.headPitch = -0.04 + cos(w * 2) * 0.025;

        tgt.flUpperX = sFL * 0.42;
        tgt.flLowerX = Math.max(0, -cos(w)) * 0.55 - 0.08;
        tgt.frUpperX = sFR * 0.42;
        tgt.frLowerX = Math.max(0, cos(w)) * 0.55 - 0.08;

        tgt.blUpperX = sBL * 0.38 - 0.1;
        tgt.blLowerX = Math.max(0, -cos(w + Math.PI * 0.85)) * 0.5 + 0.18;
        tgt.brUpperX = sBR * 0.38 - 0.1;
        tgt.brLowerX = Math.max(0, -cos(w - Math.PI * 0.15)) * 0.5 + 0.18;

        tgt.tailX = [0.65, 0.25, 0.1, -0.05];
        tgt.tailY = [sin(w) * 0.15, sin(w - 0.6) * 0.2, sin(w - 1.2) * 0.22, 0];
        break;
      }

      case 'trot': {
        // 軽快な小走り
        const w = t * 13.0;
        const s1 = sin(w);
        const s2 = sin(w + Math.PI);

        tgt.pelvisY = 0.18 + Math.abs(sin(w)) * 0.018; // 指示書1 B1: 接地(前 0.192)
        tgt.pelvisPitch = sin(w * 2) * 0.04;
        tgt.neckPitch = 0.15;
        tgt.headPitch = -0.1;

        tgt.flUpperX = s1 * 0.62;
        tgt.flLowerX = Math.max(0, -cos(w)) * 0.78 - 0.1;
        tgt.brUpperX = s1 * 0.56 - 0.1;
        tgt.brLowerX = Math.max(0, -cos(w)) * 0.7 + 0.2;

        tgt.frUpperX = s2 * 0.62;
        tgt.frLowerX = Math.max(0, cos(w)) * 0.78 - 0.1;
        tgt.blUpperX = s2 * 0.56 - 0.1;
        tgt.blLowerX = Math.max(0, cos(w)) * 0.7 + 0.2;

        tgt.tailX = [0.85, 0.2, 0.05, 0];
        tgt.tailY = [sin(w) * 0.12, sin(w - 0.5) * 0.18, 0, 0];
        break;
      }

      case 'creep': {
        // 忍び足：体高を低く落とし、ゆっくり慎重に脚を運ぶ
        const w = t * 3.8;
        tgt.pelvisY = CREEP.pelvisY + sin(w * 2) * 0.003; // 指示書1 B1: 体は低いまま、脚を深く折って接地(前 0.118)
        tgt.chestPitch = 0.08;
        tgt.hipPitch = -0.06;
        tgt.neckPitch = -0.18;
        tgt.headPitch = 0.22; // 低い姿勢から獲物をじっと見据える

        tgt.flUpperX = CREEP.upper + sin(w) * 0.25;
        tgt.flLowerX = CREEP.lower - Math.max(0, cos(w)) * 0.25;
        tgt.frUpperX = CREEP.upper + sin(w + Math.PI) * 0.25;
        tgt.frLowerX = CREEP.lower - Math.max(0, -cos(w)) * 0.25;

        tgt.blUpperX = CREEP.thigh + sin(w + Math.PI) * 0.22;
        tgt.blLowerX = CREEP.shin;
        tgt.brUpperX = CREEP.thigh + sin(w) * 0.22;
        tgt.brLowerX = CREEP.shin;

        // しっぽは低く水平に伸ばし、先だけチロチロ揺らす
        tgt.tailX = [-0.1, 0.05, 0.08, 0.05];
        tgt.tailY = [0, sin(t * 4) * 0.12, sin(t * 4 - 0.7) * 0.25, sin(t * 4 - 1.4) * 0.35];
        break;
      }

      case 'still': {
        // ピタッと固まる（緊張して微動だにしない）
        tgt.pelvisY = 0.182;
        tgt.hipPitch = 0.1; // 指示書1 B1: 後ろ足のめり込みを直す(腰の付け根を少し上げる)
        tgt.neckPitch = 0.22;
        tgt.headPitch = -0.12;
        tgt.earLPitch = 0.22;
        tgt.earRPitch = 0.22;
        tgt.tailX = [-0.15, -0.1, 0.05, 0.1];
        tgt.tailY = [0, 0, 0, 0];
        break;
      }

      case 'pounce': {
        // お尻をプリプリ振って狙いを定め、ジャーンプ！と飛びかかる周期モーション
        const cycle = (t * 1.4) % 2.4;
        if (cycle < 1.1) {
          // 溜め（お尻フリフリ）
          const wiggle = sin(t * 28) * 0.09;
          tgt.pelvisY = CREEP.pelvisY - 0.01; // 指示書1 B1: 忍び足と同じ折り方で接地(前 0.11・脚 0.65/-1.1/-0.7/1.15)
          tgt.chestPitch = 0.18;
          tgt.hipYaw = wiggle;
          tgt.neckPitch = -0.22;
          tgt.headPitch = 0.28;
          tgt.flUpperX = CREEP.upper + 0.15;
          tgt.flLowerX = CREEP.lower - 0.3;
          tgt.frUpperX = CREEP.upper + 0.15;
          tgt.frLowerX = CREEP.lower - 0.3;
          tgt.blUpperX = CREEP.thigh - 0.1;
          tgt.blLowerX = CREEP.shin + 0.2;
          tgt.brUpperX = CREEP.thigh - 0.1;
          tgt.brLowerX = CREEP.shin + 0.2;
          tgt.tailX = [0.1, 0.15, 0.2, 0.1];
          tgt.tailY = [wiggle * 1.5, -wiggle * 2.0, wiggle * 2.5, 0];
        } else if (cycle < 1.85) {
          // 跳躍！（綺麗な放物線アーチ）
          const u = (cycle - 1.1) / 0.75; // 0 -> 1
          const arc = 4 * u * (1 - u);
          tgt.pelvisY = 0.14 + arc * 0.22;
          tgt.pelvisPitch = (0.5 - u) * 0.75;
          tgt.chestPitch = -0.15;
          tgt.hipPitch = 0.15;
          tgt.flUpperX = 0.75;
          tgt.flLowerX = -0.25;
          tgt.frUpperX = 0.75;
          tgt.frLowerX = -0.25;
          tgt.blUpperX = -0.85;
          tgt.blLowerX = 0.2;
          tgt.brUpperX = -0.85;
          tgt.brLowerX = 0.2;
          tgt.tailX = [-0.25, -0.15, -0.1, 0];
        } else {
          // 着地で前足トンッ
          tgt.pelvisY = 0.19; // 指示書1 B1: 接地(前 0.155)
          tgt.chestPitch = 0.12;
          tgt.flUpperX = 0.2;
          tgt.flLowerX = -0.4;
          tgt.frUpperX = 0.2;
          tgt.frLowerX = -0.4;
        }
        break;
      }

      case 'climb': {
        // 本棚や縁側にグイグイ登るモーション
        const w = t * 9.0;
        tgt.pelvisY = 0.235 + sin(w) * 0.015; // 指示書1 B1: 後ろ足の接地(前 0.22)
        tgt.pelvisPitch = -0.62; // 上を向く
        tgt.neckPitch = 0.25;
        tgt.headPitch = 0.15;
        tgt.flUpperX = 0.55 + sin(w) * 0.45;
        tgt.flLowerX = -0.5 + cos(w) * 0.3;
        tgt.frUpperX = 0.55 + sin(w + Math.PI) * 0.45;
        tgt.frLowerX = -0.5 - cos(w) * 0.3;
        tgt.blUpperX = -0.35 + sin(w + Math.PI) * 0.4;
        tgt.blLowerX = 0.65;
        tgt.brUpperX = -0.35 + sin(w) * 0.4;
        tgt.brLowerX = 0.65;
        tgt.tailX = [0.45, 0.2, 0.1, 0]; // 指示書1 B1: しっぽが地面に 10cm めり込んでいた(前 [-0.3, -0.2, -0.1, 0])
        break;
      }

      case 'jump_down': {
        // 高いところから前足を伸ばしてしなやかに飛び降りる
        const wave = sin(t * 3.5);
        tgt.pelvisY = 0.18 + Math.max(0, wave) * 0.06;
        tgt.pelvisPitch = 0.42; // 下向き
        tgt.neckPitch = -0.25;
        tgt.headPitch = -0.2; // 視線は着地点へ
        tgt.flUpperX = 0.52;
        tgt.flLowerX = -0.12;
        tgt.frUpperX = 0.52;
        tgt.frLowerX = -0.12;
        tgt.blUpperX = -0.6;
        tgt.blLowerX = 0.45;
        tgt.brUpperX = -0.6;
        tgt.brLowerX = 0.45;
        tgt.tailX = [0.55, 0.35, 0.2, 0.1];
        break;
      }

      // ---- 指示書1 B1: ここから下の姿勢は回転の符号を直した(x 回転: + = 脚を後ろへ・頭と胸をうつむける / - = 脚を前へ・見上げる)----
      // 座る系(sit・look・groom・meow・scratch)の土台: お尻と後ろ足のすねを地面(y=0)に、前足の肉球も地面に
      case 'sit':
      case 'look':
      case 'groom':
      case 'meow':
      case 'scratch': {
        tgt.pelvisY = SIT.pelvisY;
        tgt.pelvisPitch = SIT.pelvisPitch;
        tgt.chestPitch = SIT.chestPitch;
        tgt.hipPitch = SIT.hipPitch;
        tgt.neckPitch = -(SIT.pelvisPitch + SIT.chestPitch) * 0.8; // 体の傾きを打ち消して、顔はほぼ前
        tgt.headPitch = 0.08;
        // 前足: 世界でほぼ垂直(少しだけ前へ)
        tgt.flUpperX = SIT.front - (SIT.pelvisPitch + SIT.chestPitch);
        tgt.flLowerX = SIT.frontLower;
        tgt.frUpperX = tgt.flUpperX;
        tgt.frLowerX = tgt.flLowerX;
        // 後ろ足: 太ももを前へ寝かせ(-)、すねを後ろへたたむ(+)
        tgt.blUpperX = SIT.thigh - (SIT.pelvisPitch + SIT.hipPitch);
        tgt.blLowerX = SIT.shin - SIT.thigh;
        tgt.brUpperX = tgt.blUpperX;
        tgt.brLowerX = tgt.blLowerX;
        // しっぽは地面に下ろして、体の右へくるんと添える
        tgt.tailX = [-0.18, 0.28, 0.1, 0.05];
        tgt.tailY = [0.3, 0.5, 0.5 + sin(t * 2) * 0.08, 0.35];

        if (effectivePose === 'look') {
          // キョロキョロと首をかしげながら見回す
          tgt.headYaw = lookOffset.yaw || sin(t * 1.6) * 0.55;
          tgt.headPitch = 0.1 + (lookOffset.pitch || sin(t * 2.3) * 0.18);
          tgt.headRoll = sin(t * 1.6) * 0.18;
        } else if (effectivePose === 'groom') {
          // 家主さん(代理の監督)の指示2: 一続きのお顔洗い(GROOM.cycle 秒でループ)。数は groom3.mjs で測った(肉球と頭・あご・耳の表面の距離、めり込み 0)
          //   0〜0.5 秒   右前足を上げる
          //   0.5〜2.5   (a) 顔を前足の側(右)へ傾けて、目の下〜鼻の横を前足でこする
          //   2.5〜3.1   頭を下げながら、前足を耳の後ろへ回す
          //   3.1〜4.8   (b) 頭を下げて横へ傾け、首から下の方を向いて、右の耳の後ろをこする
          //   4.8〜5.3   前足を下ろす。5.0〜5.45 こすった右の耳だけ「ぴるるっ」(applyRigToGroups で耳に足す。前足が耳から離れてから)
          //   5.3〜6.0   座って一休み
          // ゴシゴシ(肩の上下・肘から先の前後)は、なめらかにする前の目標ではなく applyRigToGroups で毎コマ足す(速い動きが補間で消えないように)
          const tau = ((t % GROOM.cycle) + GROOM.cycle) % GROOM.cycle;
          const wA = smoothstep(0.0, 0.5, tau) * (1 - smoothstep(2.5, 3.1, tau));
          const wB = smoothstep(2.5, 3.1, tau) * (1 - smoothstep(4.8, 5.3, tau));
          const w0 = 1 - wA - wB;
          const sitArm = [tgt.frUpperX, tgt.frUpperZ, tgt.frLowerX], sitHead = [tgt.neckPitch, tgt.headPitch, 0, 0];
          const mix = (i, s0) => w0 * s0 + wA * GROOM.A[i] + wB * GROOM.B[i];
          tgt.frUpperX = mix(4, sitArm[0]);
          tgt.frUpperZ = mix(5, sitArm[1]);
          tgt.frLowerX = mix(6, sitArm[2]);
          tgt.neckPitch = mix(0, sitHead[0]);
          tgt.headPitch = mix(1, sitHead[1]);
          tgt.headYaw = mix(2, 0);
          tgt.headRoll = mix(3, 0);
          tgt.jawOpen = 0;
          groomInfo.tau = tau;
          groomInfo.name = tau < 0.5 ? '上げる' : tau < 2.5 ? '(a) 顔' : tau < 3.1 ? '耳へ' : tau < 4.8 ? '(b) 耳の後ろ' : tau < 5.0 ? '下ろす' : tau < 5.45 ? '耳ぴるる' : '休む';
          groomInfo.touch = tau >= 1.0 && tau < 2.4 ? 'A' : tau >= 3.6 && tau < 4.7 ? 'B' : null; // こすっている間(手が届いてから)
          groomInfo.rub = !!groomInfo.touch;
          groomInfo.on = true;
        } else if (effectivePose === 'meow') {
          // こちらを見上げて「にゃー！」(頭は - で見上げる)
          const m = sin(t * 5.5);
          tgt.headPitch = -0.3;
          tgt.jawOpen = clamp((m + 0.4) * 0.42, 0, 0.52);
          tgt.tailX = [0.65, 0.25, 0.1, 0];
          tgt.tailY = [0, sin(t * 3) * 0.2, sin(t * 3 - 0.6) * 0.25, 0];
        } else if (effectivePose === 'scratch') {
          // シャーッ！と口を開けて、右前足で前へ鋭く引っ掻く(-)
          const s = t * 18.0;
          tgt.jawOpen = 0.48;
          tgt.earLPitch = -0.35;
          tgt.earLRoll = -0.82;
          tgt.earRPitch = -0.35;
          tgt.earRRoll = 0.82;
          tgt.frUpperX = -1.1 + sin(s) * 0.45;
          tgt.frUpperZ = -0.1 + cos(s) * 0.2;
          tgt.frLowerX = 0.35 + cos(s) * 0.35;
          tgt.tailPuff = 1.65; // しっぽボン！
          tgt.tailX = [0.55, 0.3, 0.1, 0];
          tgt.tailY = [sin(s * 0.7) * 0.35, -sin(s * 0.7) * 0.4, 0, 0];
        }
        break;
      }

      case 'loaf': {
        // 香箱座り: お腹と胸をぺたんと地面に。前腕は胸の下へ後ろ向きに折りたたむ(+)
        tgt.pelvisY = LOAF.pelvisY;
        tgt.pelvisPitch = -0.03;
        tgt.chestPitch = 0.0;
        tgt.hipPitch = 0.0;
        tgt.neckPitch = 0.05;
        tgt.headPitch = 0.0;
        tgt.flUpperX = LOAF.upper;
        tgt.flLowerX = LOAF.lower;
        tgt.frUpperX = LOAF.upper;
        tgt.frLowerX = LOAF.lower;
        tgt.flUpperZ = -LOAF.upperIn; // 内へ(左の脚は -z、右は +z)
        tgt.frUpperZ = LOAF.upperIn;
        tgt.blUpperX = LOAF.thigh;
        tgt.blLowerX = LOAF.shin;
        tgt.brUpperX = LOAF.thigh;
        tgt.brLowerX = LOAF.shin;
        // しっぽは地面に下ろして体の右側へ
        tgt.tailX = [-0.5, 0.25, 0.08, 0.02];
        tgt.tailY = [0.45, 0.7, 0.65, 0.45];
        break;
      }

      case 'curl': {
        // アンモニャイト: お腹を地面に、胸と腰を左(+x)へ弧に、頭は左後ろへ回してうつむき、しっぽは同じ側(-tailY)へ鼻先まで
        tgt.pelvisY = CURL.pelvisY;
        tgt.pelvisRoll = -0.05;
        tgt.chestPitch = 0.05;
        tgt.chestYaw = 0.75;
        tgt.hipPitch = 0.0;
        tgt.hipYaw = -0.75;
        tgt.neckPitch = 0.3;
        tgt.neckYaw = 0.7;
        tgt.headPitch = 0.35;
        tgt.headYaw = 0.55;
        tgt.headRoll = -0.25;

        tgt.flUpperX = LOAF.upper;
        tgt.flLowerX = LOAF.lower;
        tgt.frUpperX = LOAF.upper;
        tgt.frLowerX = LOAF.lower;
        tgt.flUpperZ = -LOAF.upperIn; // 内へ(左の脚は -z、右は +z)
        tgt.frUpperZ = LOAF.upperIn;
        tgt.blUpperX = LOAF.thigh;
        tgt.blLowerX = LOAF.shin;
        tgt.brUpperX = LOAF.thigh;
        tgt.brLowerX = LOAF.shin;

        tgt.tailX = (tailTune && tailTune.x ? tailTune.x : CURL.tailX).slice();
        tgt.tailY = (tailTune && tailTune.y ? tailTune.y : CURL.tailY).slice();
        break;
      }

      case 'rub': {
        // 足元にすりすり〜っと体をしならせて甘える
        const w = t * 4.5;
        const curve = sin(w);
        tgt.pelvisY = 0.183;
        tgt.hipPitch = 0.1; // 指示書1 B1: 後ろ足のめり込みを直す
        tgt.chestYaw = curve * 0.24;
        tgt.hipYaw = -curve * 0.24;
        tgt.neckYaw = curve * 0.28;
        tgt.headYaw = curve * 0.25;
        tgt.headRoll = curve * 0.38; // 頬をすり寄せる角度
        tgt.headPitch = -0.15;

        // 足踏みしながら歩く
        tgt.flUpperX = sin(w * 1.5) * 0.28;
        tgt.flLowerX = Math.max(0, -cos(w * 1.5)) * 0.4 - 0.08;
        tgt.frUpperX = sin(w * 1.5 + Math.PI) * 0.28;
        tgt.frLowerX = Math.max(0, cos(w * 1.5)) * 0.4 - 0.08;
        tgt.blUpperX = sin(w * 1.5 + Math.PI) * 0.25 - 0.12;
        tgt.brUpperX = sin(w * 1.5) * 0.25 - 0.12;

        // 大好き！のピーンと立ったしっぽ（先だけプルプル）
        tgt.tailX = [1.15, 0.15, -0.1, -0.15];
        tgt.tailY = [curve * 0.15, sin(t * 14) * 0.12, sin(t * 14) * 0.15, 0];
        break;
      }

      case 'eat': {
        // ごはんをモグモグ: 前を低くして、首と頭を皿へうつむける(+)
        const chew = Math.abs(sin(t * 11));
        tgt.pelvisY = EAT.pelvisY;
        tgt.pelvisPitch = 0.12;
        tgt.chestPitch = 0.12;
        tgt.hipPitch = -0.1;
        tgt.neckPitch = 0.75;
        tgt.headPitch = 0.35 + sin(t * 11) * 0.07;
        tgt.jawOpen = chew * 0.35;
        // 前足: 肘を後ろへ(+)、前腕を前へ(-)でかがむ
        tgt.flUpperX = EAT.upper;
        tgt.flLowerX = EAT.lower;
        tgt.frUpperX = EAT.upper;
        tgt.frLowerX = EAT.lower;
        tgt.blUpperX = EAT.thigh;
        tgt.blLowerX = EAT.shin;
        tgt.brUpperX = EAT.thigh;
        tgt.brLowerX = EAT.shin;

        tgt.tailX = [0.15, 0.1, 0.1, 0.1];
        tgt.tailY = [0, sin(t * 3) * 0.15, sin(t * 3 - 0.5) * 0.2, 0];
        break;
      }

      case 'stretch': {
        // 伸び(プレイバウ): 胸と頭を地面すれすれに、前足は前(-)へ地面に沿ってまっすぐ、お尻を高く、後ろ足はまっすぐ立つ
        tgt.pelvisY = STRETCH.pelvisY;
        tgt.pelvisPitch = STRETCH.pitch;
        tgt.chestPitch = 0.15;
        tgt.hipPitch = -0.15;
        tgt.neckPitch = -0.45;
        tgt.headPitch = -0.2;

        tgt.flUpperX = STRETCH.front - (STRETCH.pitch + 0.15);
        tgt.flLowerX = STRETCH.frontLower;
        tgt.frUpperX = tgt.flUpperX;
        tgt.frLowerX = tgt.flLowerX;
        tgt.blUpperX = STRETCH.hind - (STRETCH.pitch - 0.15);
        tgt.blLowerX = STRETCH.hindLower;
        tgt.brUpperX = tgt.blUpperX;
        tgt.brLowerX = tgt.blLowerX;

        tgt.tailX = [0.95, 0.35, -0.15, -0.25];
        break;
      }

      case 'knead': {
        // ふみふみ: 少しかがんで座り、前足を交互に前・上へ持ち上げて(-)、下ろす
        const k = t * 5.0;
        const liftL = Math.max(0, sin(k));
        const liftR = Math.max(0, sin(k + Math.PI));

        tgt.pelvisY = KNEAD.pelvisY;
        tgt.pelvisPitch = KNEAD.pitch;
        tgt.chestPitch = 0.0;
        tgt.hipPitch = 0.1;
        tgt.neckPitch = -KNEAD.pitch * 0.8;
        tgt.headPitch = 0.15;

        tgt.flUpperX = KNEAD.front - KNEAD.pitch - liftL * 0.45;
        tgt.flLowerX = KNEAD.frontLower + liftL * 0.8;
        tgt.frUpperX = KNEAD.front - KNEAD.pitch - liftR * 0.45;
        tgt.frLowerX = KNEAD.frontLower + liftR * 0.8;

        tgt.blUpperX = KNEAD.thigh - (KNEAD.pitch + 0.1);
        tgt.blLowerX = KNEAD.shin - KNEAD.thigh;
        tgt.brUpperX = tgt.blUpperX;
        tgt.brLowerX = tgt.blLowerX;

        tgt.tailX = [0.35, 0.2, 0.15, 0.1];
        tgt.tailY = [0, sin(k * 0.5) * 0.15, 0, 0];
        break;
      }
      default:
        break;
    }

    // --- 感情 (Mood) による耳・しっぽ・毛並みのオーバーレイ ---
    if (mood === 'angry') {
      // 耳を伏せ（イカ耳）、背中を丸め、しっぽが太く膨らんでバシバシ揺れる
      tgt.earLPitch = -0.38;
      tgt.earLRoll = -0.85;
      tgt.earRPitch = -0.38;
      tgt.earRRoll = 0.85;
      tgt.tailPuff = 1.75;
      tgt.bodyScale = 1.07;
      if (effectivePose !== 'curl' && effectivePose !== 'loaf') {
        // 指示書2 第一部2: 座り系(sit・look・groom・meow・scratch)は背中を丸めない(前足が 2cm 浮いていた)
        if (!SIT_POSES.includes(effectivePose)) {
          tgt.chestPitch -= 0.18;
          tgt.hipPitch += 0.18;
          tgt.tailX = [0.7, -0.35, -0.35, -0.2];
        } else {
          // 膨らんだ体(bodyScale 1.07)で脚も伸びる分、腰を上げる。しっぽは地面に潜らないよう低く横へ(前の [0.7,-0.35,…] は座ると 10cm 潜った)
          tgt.pelvisY += 0.008;
          tgt.tailX = [0.15, 0.2, 0.05, 0.0];
        }
        tgt.tailY = [sin(t * 10) * 0.35, sin(t * 10 - 0.5) * 0.4, 0, 0];
      }
    } else if (mood === 'alert') {
      // 耳がピンと前に立ち、しっぽも緊張感を持って上がる
      tgt.earLPitch = 0.28;
      tgt.earLRoll = -0.12;
      tgt.earRPitch = 0.28;
      tgt.earRRoll = 0.12;
      tgt.neckPitch += 0.12;
      if (effectivePose !== 'curl' && effectivePose !== 'loaf') {
        tgt.tailX = [0.85, 0.2, 0.05, 0];
      }
    } else if (mood === 'happy') {
      // ご機嫌でしっぽがピーンと立ち、先端が可愛くクエスチョンマーク状に揺れる
      tgt.earLPitch = 0.16;
      tgt.earLRoll = -0.2;
      tgt.earRPitch = 0.16;
      tgt.earRRoll = 0.2;
      if (effectivePose !== 'curl' && effectivePose !== 'loaf') {
        tgt.tailX = [1.18, 0.18, -0.18, -0.25];
        tgt.tailY = [sin(t * 4.5) * 0.14, sin(t * 4.5 - 0.5) * 0.18, 0, 0];
      }
    }

    // カギ尻尾・ボブテイル固有の形状オフセット
    if (tailType === 'kagi') {
      tgt.tailX[2] += 0.65;
      tgt.tailX[3] -= 0.95;
      tgt.tailY[3] += 0.45;
    } else if (tailType === 'bob') {
      tgt.tailX = [0.55, 0.6, -0.5, 0.3];
      tgt.tailY = [0, 0.3, -0.2, 0];
    }

    return tgt;
  }

  // 補間済みのrig値を実際のThree.js Groupへ反映
  function applyRigToGroups(t, isSleeping) {
    // 呼吸による胸の上下・膨らみ
    const breath = Math.sin(t * (isSleeping ? 1.8 : 3.2)) * 0.022;

    pelvisGroup.position.set(0, rig.pelvisY, rig.pelvisZ);
    pelvisGroup.rotation.set(rig.pelvisPitch, 0, rig.pelvisRoll);

    chestPivot.rotation.set(rig.chestPitch, rig.chestYaw, 0);
    chestPivot.scale.set(
      rig.bodyScale + breath * 0.4,
      rig.bodyScale + breath * 0.6,
      rig.bodyScale
    );

    hipPivot.rotation.set(rig.hipPitch, rig.hipYaw, 0);
    hipPivot.scale.set(rig.bodyScale, rig.bodyScale, rig.bodyScale);

    neckPivot.rotation.set(rig.neckPitch, rig.neckYaw, 0);
    headPivot.rotation.set(rig.headPitch, rig.headYaw, rig.headRoll);
    jawPivot.rotation.x = rig.jawOpen;

    earL.rotation.set(rig.earLPitch, 0, rig.earLRoll + activeEarTwitch);
    // groom のゴシゴシと耳ぴるる(なめらかにした rig に毎コマ足す。groom 以外では 0)
    let gL = 0, gY = 0, gFlick = 0, ikW = 0;
    if (groomInfo.on) {
      const tau = groomInfo.tau;
      // 代理監督の指示3: こすっている間は、前足の先(肉球の中心)が円を描く。円は頭の局所で、中心は今のこする所、面は顔・頭の表面に沿う(法線 GROOM_CIRCLE.*.n)
      //   回る向き(代理監督の指示4): 第三者(猫の正面から見る人)から見て時計回り。e1 × e2 = n(外向き)の基底で角度 θ を減らす向き
      //     = 外から(n の先から)見て時計回り。顔の段は猫の正面に立つ人から、耳の段は猫の右横・後ろから見る人から、時計回りに見える
      const envA = smoothstep(0.6, 0.9, tau) * (1 - smoothstep(2.25, 2.5, tau)), envB = smoothstep(3.3, 3.6, tau) * (1 - smoothstep(4.5, 4.75, tau));
      const stage = envA > 0 ? 'A' : envB > 0 ? 'B' : null;
      ikW = envA + envB;
      groomInfo.circle = null;
      if (stage) {
        const Cc = GROOM_CIRCLE[stage], s0 = stage === 'A' ? 0.6 : 3.3;
        const theta = -(t * GROOM_CIRCLE.lapsPerSec) * Math.PI * 2; // 負 = 外から見て時計回り
        // 半径: 小さく始まって大きく(小〜大を GROOM_CIRCLE.breathe 秒で行き来)。ときどき大きい一周(一周ごとの乱数、種は周の番号。周の切れ目で 0 になる sin² で混ぜる)
        let r = Cc.rMin + (Cc.rMax - Cc.rMin) * 0.5 * (1 - Math.cos(((tau - s0) / GROOM_CIRCLE.breathe) * Math.PI * 2));
        const lap = Math.floor(theta / (Math.PI * 2)), hh = Math.sin(lap * 57.3 + 1.7) * 43758.5453, lapHash = hh - Math.floor(hh);
        if (lapHash > 0.7) r *= 1 + Cc.big * Math.pow(Math.sin(Math.PI * (theta / (Math.PI * 2) - lap)), 2);
        // 耳の段(指示4 で大きい円)は、耳の方へは縮めた卵形(k: 耳の側 0.45 〜 反対 1.0、θ でなめらかに変わる)にして、頭の丸み(頭蓋の楕円体)に沿わせる
        const k = Cc.toEar ? 0.725 - 0.275 * Math.cos(theta) : 1;
        const P = Cc.C.clone().addScaledVector(Cc.e1, r * k * Math.cos(theta)).addScaledVector(Cc.e2, r * Math.sin(theta));
        if (Cc.wrap) wrapOnSkull(P, Cc.gap);
        const P0 = P.clone(); // 頭の局所の目標(検品用)
        gY = GROOM_CIRCLE.shoulder * Math.sin(theta) * ikW; // 肩(上腕の付け根)が円に合わせて少し上下(IK が手先を円に戻す)
        legFR.upper.position.y = legFRBaseY + gY;
        // 頭の局所 → 胸の局所(首と頭は胸の子、前足の付け根も胸の子)→ 肩から見た位置
        neckPivot.updateMatrix(); headPivot.updateMatrix();
        P.applyMatrix4(headPivot.matrix).applyMatrix4(neckPivot.matrix).sub(legFR.upper.position);
        const avoid = Cc.wrap ? new THREE.Vector3(0, 0, SK.z0).applyMatrix4(headPivot.matrix).applyMatrix4(neckPivot.matrix).sub(legFR.upper.position) : null; // 頭蓋の中心(肩から)
        const ik = ikFR(P, new THREE.Quaternion().setFromEuler(new THREE.Euler(rig.frUpperX, 0, rig.frUpperZ)), avoid);
        groomInfo.circle = { stage, w: ikW, r, P: P0, reach: P.length(), rMax: Cc.rMax * (1 + Cc.big), theta, C: Cc.C, e1: Cc.e1, e2: Cc.e2, n: Cc.n, ik };
      }
      // 相の間の移り(顔 → 耳、耳 → 下ろす)は、前腕を一度前へ逃がして頭をくぐらせない
      if (tau > 2.45 && tau < 3.55) gL += Math.sin(Math.PI * (tau - 2.45) / 1.1) * GROOM_STROKE.detour;
      if (tau > 4.65 && tau < 5.3) gL += Math.sin(Math.PI * (tau - 4.65) / 0.65) * GROOM_STROKE.detour;
      if (tau > 5.0 && tau < 5.45) gFlick = Math.sin(Math.PI * (tau - 5.0) / 0.45) * Math.sin(tau * Math.PI * 2 * 12) * 0.35; // 右の耳だけ ぴるるっ(12Hz)
      groomInfo.flick = gFlick;
    }
    earR.rotation.set(rig.earRPitch, 0, rig.earRRoll + gFlick);

    // まばたき / 睡眠時の閉眼
    const eyeOpenY = isSleeping ? 0.08 : blinkTimer < 0.14 ? 0.08 : 1.0;
    const pupilDilate = currentMood === 'angry' || currentMood === 'alert' ? 1.08 : 1.0;
    eyesPivot.scale.set(pupilDilate, eyeOpenY, 1.0);

    // 四肢
    legFL.upper.rotation.set(rig.flUpperX, 0, rig.flUpperZ);
    legFL.lower.rotation.x = rig.flLowerX;
    {
      const ik = groomInfo.on && groomInfo.circle ? groomInfo.circle.ik : null, w = ik ? clamp(ikW, 0, 1) : 0;
      legFR.upper.rotation.set(rig.frUpperX, 0, rig.frUpperZ);
      if (ik) legFR.upper.quaternion.slerp(ik.q, w); // なめらかにした向きから IK の向きへ、段の重みで
      legFR.upper.position.y = legFRBaseY + gY;
      legFR.lower.rotation.x = lerp(rig.frLowerX + gL, ik ? ik.lx : 0, w);
    }

    legBL.upper.rotation.set(rig.blUpperX, 0, rig.blUpperZ);
    legBL.lower.rotation.x = rig.blLowerX;
    legBR.upper.rotation.set(rig.brUpperX, 0, rig.brUpperZ);
    legBR.lower.rotation.x = rig.brLowerX;

    // しっぽ4節
    // 指示書2 第二部3: 根元から先の 3 つの関節の曲がりを隣と均して(合計は同じ)、一つの関節で直角に折れないように
    const sm = (a) => [a[0], (2 * a[1] + a[2]) / 3, (a[1] + a[2] + a[3]) / 3, (a[2] + 2 * a[3]) / 3];
    // カギしっぽ(kagi)は先の折れ曲がりがその形なので均さない
    const tX = tailType === 'kagi' ? rig.tailX : sm(rig.tailX), tY = tailType === 'kagi' ? rig.tailY : sm(rig.tailY);
    for (let i = 0; i < 4; i++) {
      tailSegments[i].rotation.set(tX[i], tY[i], 0);
      // 指示書1 A1: 膨らみは根元の節だけ(子の節は入れ子で受け継ぐ。前は全節に掛けて先が 1.75^4 倍)
      if (i === 0) tailSegments[i].scale.set(rig.tailPuff, rig.tailPuff, 1.0);
    }
  }

  // 角度の最短経路補間
  function lerpAngle(a, b, alpha) {
    let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * alpha;
  }

  // ==========================================
  // 5. 公開API (update / snap / setMood / pose)
  // ==========================================
  function setMood(mood) {
    if (['relaxed', 'alert', 'angry', 'happy'].includes(mood)) {
      currentMood = mood;
    }
  }

  function snap(state) {
    if (!state) {
      currentPose = 'curl';
    } else {
      if (state.x !== undefined && state.z !== undefined) {
        const gy = typeof groundHeight === 'function' ? groundHeight(state.x, state.z) : 0;
        const y = state.y !== undefined ? state.y : gy;
        root.position.set(state.x, y, state.z);
      }
      if (state.yaw !== undefined) root.rotation.y = state.yaw;
      if (state.pose) currentPose = state.pose;
      if (state.mood) setMood(state.mood);
    }
    const tgt = computePoseTargets(currentPose, animTime, currentMood, { yaw: 0, pitch: 0 });
    for (const k of Object.keys(tgt)) {
      if (Array.isArray(tgt[k])) {
        rig[k] = [...tgt[k]];
      } else {
        rig[k] = tgt[k];
      }
    }
    applyRigToGroups(animTime, currentPose === 'curl');
  }

  function update(dt, state, nowMs, cameraPos, audio, posOf) {
    const safeDt = clamp(dt || 0.016, 0.0001, 0.1);
    animTime = nowMs !== undefined ? nowMs * 0.001 : animTime + safeDt;

    // ふわっと滑らかに補間する係数 (注文書指定: 1 - exp(-dt * 5))
    const alpha = 1 - Math.exp(-safeDt * 5);
    const posAlpha = 1 - Math.exp(-safeDt * 8);

    // ランダムなまばたき＆耳ピクタイマー
    blinkTimer -= safeDt;
    if (blinkTimer < 0) blinkTimer = 2.2 + Math.random() * 4.0;

    earTwitchTimer -= safeDt;
    if (earTwitchTimer < 0) {
      earTwitchTimer = 3.0 + Math.random() * 5.5;
    }
    activeEarTwitch = earTwitchTimer < 0.18 ? -0.25 * Math.sin((earTwitchTimer / 0.18) * Math.PI) : 0;

    // サーバが無い時 (state === null) は座布団で丸くなって眠る
    if (!state) {
      currentPose = 'curl';
      currentMood = 'relaxed';
    } else {
      if (state.pose) currentPose = state.pose;
      if (state.mood) setMood(state.mood);

      let targetX = state.x !== undefined ? state.x : root.position.x;
      let targetZ = state.z !== undefined ? state.z : root.position.z;
      let targetYaw = state.yaw !== undefined ? state.yaw : root.rotation.y;

      // rub(すり寄る): rubWho の足元へくるくる寄り添う
      if (currentPose === 'rub' && state.rubWho && typeof posOf === 'function') {
        const whoPos = posOf(state.rubWho);
        if (whoPos && whoPos.x !== undefined && whoPos.z !== undefined) {
          const orbit = animTime * 1.8;
          targetX = whoPos.x + Math.cos(orbit) * 0.26;
          targetZ = whoPos.z + Math.sin(orbit) * 0.26;
          targetYaw = -orbit + Math.PI * 0.5;
        }
      }

      const gy = typeof groundHeight === 'function' ? groundHeight(targetX, targetZ) : 0;
      const targetY = state.y !== undefined ? state.y : gy;

      root.position.x = lerp(root.position.x, targetX, posAlpha);
      root.position.y = lerp(root.position.y, targetY, posAlpha);
      root.position.z = lerp(root.position.z, targetZ, posAlpha);
      root.rotation.y = lerpAngle(root.rotation.y, targetYaw, posAlpha);
    }

    // lookポーズ等でカメラや対象の方へ首を向ける計算
    const lookOffset = { yaw: 0, pitch: 0 };
    if (currentPose === 'look' && cameraPos) {
      const dx = cameraPos.x - root.position.x;
      const dz = cameraPos.z - root.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.05 && dist < 12.0) {
        const angleToCam = Math.atan2(dx, dz);
        let relYaw = ((angleToCam - root.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (relYaw < -Math.PI) relYaw += Math.PI * 2;
        lookOffset.yaw = clamp(relYaw, -0.75, 0.75);
        if (cameraPos.y !== undefined) {
          const dy = cameraPos.y - (root.position.y + 0.25);
          lookOffset.pitch = clamp(-Math.atan2(dy, dist) * 0.6, -0.35, 0.35);
        }
      }
    }

    // ポーズ目標値の取得と指数減衰補間
    const tgt = computePoseTargets(currentPose, animTime, currentMood, lookOffset);
    for (const k of Object.keys(tgt)) {
      if (Array.isArray(tgt[k])) {
        for (let i = 0; i < tgt[k].length; i++) {
          rig[k][i] = lerp(rig[k][i], tgt[k][i], alpha);
        }
      } else {
        rig[k] = lerp(rig[k], tgt[k], alpha);
      }
    }

    const isSleeping = currentPose === 'curl' || (currentPose === 'enter' && rig.pelvisRoll > 0.2);
    applyRigToGroups(animTime, isSleeping);
  }

  // 初期状態をセット
  snap({ x: 0, z: 0, yaw: 0, pose: 'sit' });

  return {
    root,
    update,
    snap,
    setMood,
    setTailTune(v) { tailTune = v; },
    get pose() {
      return currentPose;
    },
    groomPhase: () => groomInfo, // 検品用(groom3.mjs・groom4.mjs): お顔洗いの今の相と円
    ikFR, // 検品用(groom4.mjs ik)
    get mood() {
      return currentMood;
    },
  };
}

