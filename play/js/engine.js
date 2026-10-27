/* 關卡地圖與四種互動：選擇、排順序、折紙迴圈、燈號。
   進度依 Google 帳號分開，並由 js/cloud-sync.js 寫入雲端。 */
(function () {
  "use strict";
  var LEVELS = window.CT_LEVELS || [];
  var SOLVED = "ct-solved-v1";
  var EXAM = "ct-exam-best-v1";
  var app = document.getElementById("app");
  function storageKey(base) {
    return window.StudentAuth && window.StudentAuth.key ? window.StudentAuth.key(base) : base;
  }
  storageKey(SOLVED);
  storageKey(EXAM);

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function solvedSet() {
    try { return new Set(JSON.parse(localStorage.getItem(storageKey(SOLVED))) || []); }
    catch (e) { return new Set(); }
  }
  function save(set) {
    localStorage.setItem(storageKey(SOLVED), JSON.stringify(Array.from(set)));
    paintProgress();
    try { window.dispatchEvent(new Event("progress:saved")); } catch (e) {}
  }
  function indexOf(slug) {
    return LEVELS.findIndex(function (lv) { return lv.slug === slug; });
  }
  function unlocked(i, set) {
    return i <= 0 || set.has(LEVELS[i - 1].slug);
  }
  function paintProgress() {
    var n = solvedSet().size;
    var a = document.getElementById("pnum");
    var b = document.getElementById("ptot");
    var f = document.getElementById("pfill");
    if (a) a.textContent = String(n);
    if (b) b.textContent = String(LEVELS.length);
    if (f) f.style.width = (LEVELS.length ? (n / LEVELS.length) * 100 : 0) + "%";
    if (window.StudentAuth && window.StudentAuth.setStatus) {
      window.StudentAuth.setStatus("關卡 " + n + " / " + LEVELS.length + (n >= LEVELS.length ? " · 可以做線上測驗" : " · 完成後才開放線上測驗"));
    }
  }

  function renderMap() {
    var set = solvedSet();
    var cells = LEVELS.map(function (lv, i) {
      var done = set.has(lv.slug);
      var open = unlocked(i, set);
      var st = done ? "solved" : open ? "open" : "locked";
      var pill = done ? "已完成" : open ? "可開始" : "未解鎖";
      var inner = '<span class="code">' + esc(lv.code) + "</span><span class=\"nm\">" + esc(lv.nm) +
        '</span><span class="en">' + esc(lv.en) + '</span><span class="goal">' + esc(lv.goal) +
        '</span><span class="pill">' + pill + "</span>";
      if (!open) return '<div class="cell locked">' + inner + "</div>";
      return '<a class="cell ' + st + '" href="#/' + lv.slug + '">' + inner + "</a>";
    }).join("");
    var all = set.size >= LEVELS.length;
    app.innerHTML =
      '<section class="hero"><div class="eyebrow">分解 · 規律 · 抽象 · 演算法</div>' +
      "<h1>運算思維互動關卡</h1>" +
      "<p>十二個原創校園情境。每一關先動手，再看詳解，最後答一題概念確認。完成一關才解開下一關。十二關都完成後，才開放線上測驗。</p>" +
      '<div class="warn">請先用 Google 登入。進度記在這個帳號，換一台電腦可以接續。題目是原創校園情境，不是國際運算思維挑戰賽的歷屆原題。</div></section>' +
      '<div class="maphead"><h2>關卡</h2><button type="button" class="ghost" id="wipe">重置我的進度</button></div>' +
      '<div class="grid">' + cells + "</div>" +
      (all
        ? '<aside class="final"><h2>十二關都完成了</h2><p><a href="../exam/">開始線上測驗（20 題）</a>。送出後才計分。</p></aside>'
        : '<p class="hint">線上測驗還關著。目前 ' + set.size + " / " + LEVELS.length + " 關。</p>");
    document.getElementById("wipe").addEventListener("click", function () {
      if (window.StudentAuth && window.StudentAuth.resetProgress) window.StudentAuth.resetProgress();
    });
    paintProgress();
  }

  function mark(slug) {
    var set = solvedSet();
    set.add(slug);
    save(set);
  }

  function mountCheck(host, lv) {
    var q = lv.check;
    var html = '<section class="check"><h2>概念確認</h2><p>' + esc(q.stem) + '</p><div class="opts">';
    q.options.forEach(function (t, i) {
      html += '<button type="button" data-i="' + i + '"><span class="opt-l">' + "ABCD".charAt(i) + "</span><span>" + esc(t) + "</span></button>";
    });
    html += '</div><p class="exp" hidden></p></section>';
    host.insertAdjacentHTML("beforeend", html);
    var box = host.querySelector(".check");
    var exp = box.querySelector(".exp");
    box.addEventListener("click", function (e) {
      var btn = e.target.closest("button");
      if (!btn || box.dataset.done) return;
      box.dataset.done = "1";
      var i = Number(btn.dataset.i);
      var ok = i === q.answer;
      box.querySelectorAll("button").forEach(function (b, j) {
        b.disabled = true;
        if (j === q.answer) b.classList.add("good");
        else if (j === i) b.classList.add("bad");
      });
      exp.hidden = false;
      exp.innerHTML = (ok ? "<b>答對。</b> " : "<b>正確是另一個。</b> ") + esc(q.exp);
      mark(lv.slug);
      host.insertAdjacentHTML("beforeend", '<p class="next"><a href="#/">回關卡地圖</a></p>');
      paintProgress();
    });
  }

  function succeed(panel, lv, host) {
    panel.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
    var note = panel.querySelector(".phase-exp");
    note.hidden = false;
    note.textContent = lv.phase.exp;
    if (!host.querySelector(".check")) mountCheck(host, lv);
  }

  function fail(panel, text) {
    var note = panel.querySelector(".phase-msg");
    note.hidden = false;
    note.textContent = text;
  }

  function mountPhase(host, lv) {
    var p = lv.phase;
    var figure = p.figure || "";
    host.insertAdjacentHTML("beforeend",
      '<section class="phase"><h2>動手</h2><p>' + esc(p.prompt) + "</p>" + figure +
      '<div class="phase-body"></div><p class="phase-msg" hidden></p><p class="phase-exp" hidden></p></section>');
    var panel = host.querySelector(".phase");
    var body = panel.querySelector(".phase-body");

    if (p.type === "choose") {
      body.classList.add("opts");
      body.innerHTML = p.options.map(function (t, i) {
        return '<button type="button" data-i="' + i + '"><span class="opt-l">' + "ABCD".charAt(i) + "</span><span>" + esc(t) + "</span></button>";
      }).join("");
      body.addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn || panel.dataset.done) return;
        panel.querySelector(".phase-msg").hidden = true;
        if (Number(btn.dataset.i) !== p.answer) {
          btn.classList.add("bad");
          fail(panel, p.wrong);
          return;
        }
        panel.dataset.done = "1";
        btn.classList.add("good");
        succeed(panel, lv, host);
      });
      return;
    }

    if (p.type === "order") {
      var pool = p.steps.slice();
      var picked = [];
      function draw() {
        body.innerHTML =
          '<p class="label">待選</p><div class="opts">' + pool.map(function (s) {
            return '<button type="button" data-id="' + esc(s.id) + '">' + esc(s.t) + "</button>";
          }).join("") + "</div>" +
          '<p class="label">你的順序</p><ol class="seq">' + picked.map(function (s) {
            return "<li>" + esc(s.t) + "</li>";
          }).join("") + "</ol>" +
          '<div class="actions"><button type="button" data-act="undo">退回一步</button><button type="button" data-act="go" class="primary">送出順序</button></div>';
      }
      draw();
      body.addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn || panel.dataset.done) return;
        panel.querySelector(".phase-msg").hidden = true;
        if (btn.dataset.id) {
          var idx = pool.findIndex(function (s) { return s.id === btn.dataset.id; });
          if (idx >= 0) picked.push(pool.splice(idx, 1)[0]);
          draw();
          return;
        }
        if (btn.dataset.act === "undo") {
          var last = picked.pop();
          if (last) pool.push(last);
          draw();
          return;
        }
        if (btn.dataset.act === "go") {
          var got = picked.map(function (s) { return s.id; }).join(",");
          if (got !== p.answer.join(",")) {
            fail(panel, p.wrong);
            return;
          }
          panel.dataset.done = "1";
          succeed(panel, lv, host);
        }
      });
      return;
    }

    if (p.type === "fold") {
      var units = Math.round(p.start * 10);
      var target = Math.round(p.target * 10);
      var folds = 0;
      function thick() { return (units / 10).toFixed(1); }
      function drawFold() {
        body.innerHTML = '<p class="readout">已折 <b>' + folds + '</b> 次，厚度 <b>' + thick() + ' mm</b>（目標至少 ' + p.target + " mm）</p>" +
          '<div class="actions"><button type="button" data-act="fold" class="primary">折一次</button><button type="button" data-act="stop">停止</button></div>';
      }
      drawFold();
      body.addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn || panel.dataset.done) return;
        panel.querySelector(".phase-msg").hidden = true;
        if (btn.dataset.act === "fold") {
          if (units >= target) {
            fail(panel, "已經達標。再折就不是第一次達到，請按停止；若已多折，請重新整理這關再來一次。");
            return;
          }
          units *= 2;
          folds += 1;
          drawFold();
          return;
        }
        if (units < target) {
          fail(panel, "還沒有達到 " + p.target + " mm。");
          return;
        }
        var needed = 0, u = Math.round(p.start * 10);
        while (u < target) { u *= 2; needed += 1; }
        if (folds !== needed) {
          fail(panel, "達標了，但不是第一次。請重新整理這關，在厚度剛到目標時停止。");
          return;
        }
        panel.dataset.done = "1";
        succeed(panel, lv, host);
      });
      return;
    }

    if (p.type === "lamps") {
      var on = p.weights.map(function () { return false; });
      function drawLamps() {
        body.innerHTML = '<div class="lamps">' + p.weights.map(function (w, i) {
          return '<button type="button" class="lamp' + (on[i] ? " on" : "") + '" data-i="' + i + '"><b>' + w + "</b><span>" + (on[i] ? "亮" : "暗") + "</span></button>";
        }).join("") + "</div>" +
          '<div class="actions"><button type="button" class="primary" data-act="ok">確認</button></div>';
      }
      drawLamps();
      body.addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn || panel.dataset.done) return;
        panel.querySelector(".phase-msg").hidden = true;
        if (btn.classList.contains("lamp")) {
          var i = Number(btn.dataset.i);
          on[i] = !on[i];
          drawLamps();
          return;
        }
        var sum = on.reduce(function (acc, lit, i) { return acc + (lit ? p.weights[i] : 0); }, 0);
        if (sum !== p.target) {
          fail(panel, "現在是 " + sum + "，還不是 " + p.target + "。");
          return;
        }
        panel.dataset.done = "1";
        succeed(panel, lv, host);
      });
    }
  }

  function renderLevel(slug) {
    var i = indexOf(slug);
    var set = solvedSet();
    if (i < 0 || !unlocked(i, set)) {
      location.hash = "#/";
      return;
    }
    var lv = LEVELS[i];
    app.innerHTML =
      '<p class="back"><a href="#/">← 關卡地圖</a></p>' +
      '<article class="level"><div class="eyebrow">' + esc(lv.code) + " · " + esc(lv.concept) + "</div>" +
      "<h1>" + esc(lv.nm) + "</h1><p class=\"en\">" + esc(lv.en) + "</p>" +
      "<p>" + esc(lv.scenario) + "</p><p class=\"goal\">目標：" + esc(lv.goal) + "</p></article>";
    mountPhase(app, lv);
    if (set.has(lv.slug)) {
      app.insertAdjacentHTML("beforeend", '<p class="doneflag">這一關先前已完成，可以再做一次。再答對概念確認會維持完成狀態。</p>');
    }
    paintProgress();
  }

  function route() {
    var slug = (location.hash || "#/").replace(/^#\/?/, "");
    if (!slug) renderMap();
    else renderLevel(slug);
  }
  window.addEventListener("hashchange", route);
  window.addEventListener("studentauth:change", function (ev) {
    var r = ev.detail && ev.detail.reason;
    if (r === "signin" || r === "switch" || r === "signout" || r === "reset" || r === "cloud") route();
  });
  route();
})();
