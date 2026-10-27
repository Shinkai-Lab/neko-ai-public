// 猫の名前(仮の 30 種。空なら適当に付ける)
export const NAMES = ["むぎ", "きなこ", "もち", "こむぎ", "ごま", "あずき", "おはぎ", "だいふく", "ちくわ", "はんぺん",
  "こてつ", "ひなた", "そら", "ゆず", "みかん", "かりん", "まめ", "ひじき", "ぬか", "たぬき",
  "ごんぞう", "ハチ", "クロ", "トラ", "ミー", "チャチャ", "ほたる", "らく", "ちび", "なつめ"];
export const randomName = (r) => NAMES[Math.floor((r ? r() : Math.random()) * NAMES.length)];
export const COATS = [
  { id: "cha", label: "茶トラ", col: "#e8a864" }, { id: "saba", label: "サバトラ", col: "#8e969d" }, { id: "mike", label: "三毛", col: "#f4f0e6" },
  { id: "kuro", label: "黒", col: "#2a292c" }, { id: "shiro", label: "白", col: "#f7f6f2" }, { id: "hachiware", label: "ハチワレ", col: "#3a393d" },
];
export const TAILS = [{ id: "long", label: "ながしっぽ" }, { id: "kagi", label: "かぎしっぽ" }, { id: "bob", label: "みじかしっぽ" }];
