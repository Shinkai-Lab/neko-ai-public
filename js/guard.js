// 起動の見張り(普通のスクリプト。app.js が読めない・WebGL 2 が無い時に、読み込み中のまま止めない)
(function () {
  var msg = "この端末では 3D の箱庭が表示できません。WebGL 2 に対応した最近の Chrome・Edge・Firefox・Safari で、読み込み直してもだめな時は、別のブラウザでお試しください。";
  function show(why) {
    if (window.__hibineko && window.__hibineko.ready) return;
    var l = document.getElementById("loading"); if (!l) return;
    l.classList.remove("gone"); l.textContent = msg; l.setAttribute("data-why", why || "");
  }
  var gl2 = false; try { gl2 = !!document.createElement("canvas").getContext("webgl2"); } catch (e) { gl2 = false; }
  if (!gl2) { window.__noWebGL2 = true; document.addEventListener("DOMContentLoaded", function () { show("webgl2"); }); }
  window.addEventListener("error", function (e) {
    var t = e && e.target;
    if (t && t.tagName === "SCRIPT") { if (t.type === "module" || /three|jsdelivr/.test(t.src || "")) show("script"); return; }
    if (!window.__hibineko) show("runtime");                // 起動前の例外
  }, true);
  window.addEventListener("unhandledrejection", function () { if (!window.__hibineko) show("rejection"); });
  (function watch() { setTimeout(function () { var h = window.__hibineko; if (h && h.ready) return; if (h && h.booting) { watch(); return; } show("timeout"); }, 25000); })();   // 再現の途中(booting)は待つ
})();
