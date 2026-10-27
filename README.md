# 日々猫になる

猫の AI を作っている途中の記録です。開いたブラウザの中で、学習した小さなニューラルネットが、猫の次の行動をその場で選びます。同じ版でも、引数のない URL(`https://neko.shinkailab.com/`)で開くたびに違う一日になります。頁は開いた一日の種と時刻を URL に書き込むので、その URL で開き直すと同じ一日を見られます。

- 頁: https://neko.shinkailab.com/
- `index.html` `css/` `js/`: 頁と、猫の世界と体(`js/sim.js`)、心の前向き計算(`js/mind.js`)
- `minds/`: 版ごとの学習した心の重み / `worlds/`: 版ごとの世界の設定 / `versions.json`: 版の一覧
- 猫の 3D の姿: `neko-argon/neko-argon.js`
- 3D の描画は three.js r170(`vendor/three/` に同梱、MIT。`vendor/three/LICENSE`)、書体は Google Fonts から読み込み(SIL OFL)
- 乱数は NumPy の PCG64 と分布の一部を JavaScript に写したもの(`js/rng.js`。告知は `THIRD_PARTY_NOTICES`)

## 共有と記録について
- 頁の URL の `?` の後ろには、版・一日の種・時刻・猫の毛色がいつも入ります。これは普通の URL の一部なので、頁を配るサーバー(Cloudflare)の記録に残り得ます
- 名前は「名前も入れる」を選んだ時だけ、片づけやおやつの記録はした時に、`#` の後ろに入ります。`#` の後ろはサーバーには送られませんが、ブラウザの履歴には残ります(古い形の `?n=` のリンクは、名前が `?` の後ろにあるのでサーバーに届きます)
- 同じ時刻にそろうのは、始めから 1440 ティック(2 日分)までです。それより先の共有リンクは、1440 ティックの時刻で開きます
- 生まれさせた猫の見た目と名前は、あなたのブラウザ(localStorage)にだけ保存します。名前に本名を入れた時は、その文字もブラウザに残ります
- 書体を Google Fonts から読み込むため、頁を開くと Google のサーバーに接続します
- アクセス解析やクッキーは使いません

## ライセンス
- コード(`index.html` `css/` `js/` `neko-argon/`): MIT(`LICENSE`)
- 学習した心の重み・世界の設定・版の一覧(`minds/` `worlds/` `versions.json`): CC BY 4.0(`LICENSE-DATA`)

© 2026 Shinkai Lab
