/* 關卡地圖與四種互動：選擇、排順序、折紙迴圈、燈號。進度只存在這台瀏覽器。 */
(function () {
  "use strict";
  var LEVELS = window.CT_LEVELS || [];
  var KEY = "ct-solved-v1";
  var app = document.getElementById("app");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function solvedSet() {
    try { return new Set(JSON.parse(localStorage.getItem(KEY)) || []); }
    catch (e) { return new Set(); }
  }
  function save(set) {
    localStorage.setItem(KEY, JSON.stringify(Array.from(set)));
    paintProgress();
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
      "<p>十二個原創校園情境。每一關先動手，再看詳解，最後答一題概念確認。完成一關才解開下一關。</p>" +
      '<div class="warn">這些題目參考封存課程的詳解寫法，<b>不是</b>國際運算思維挑戰賽的歷屆原題。作答只留在這台瀏覽器。</div></section>' +
      '<div class="maphead"><h2>關卡</h2><button type="button" class="ghost" id="wipe">重設本機關卡進度</button></div>' +
      '<div class="grid">' + cells + "</div>" +
      (all ? '<aside class="final"><h2>十二關都完成了</h2><p><a href="../exam/">前往線上測驗（20 題）</a>。測驗不鎖關，也可以直接開考。</p></aside>' : "");
    document.getElementById("wipe").addEventListener("click", function () {
      if (!confirm("清除這台瀏覽器上的關卡完成紀錄？")) return;
      localStorage.removeItem(KEY);
      renderMap();
      paintProgress();
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
      html += '<button type="button" data-i="' + i + '">' + esc(t) + "</button>";
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
      body.innerHTML = p.options.map(function (t, i) {
        return '<button type="button" data-i="' + i + '">' + esc(t) + "</button>";
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
  route();
})();
