/* 運算思維雲端進度。登入後寫入 Firestore progress/{email 小寫}.ct。
   ct = { solved: 關卡 slug 陣列, examBest: 0–20 或省略 }
   與資安課程同一份文件，只用 mergeFields 更新 ct，不覆蓋其他教材。 */
(function () {
  "use strict";
  var C = window.FIREBASE_CONFIG || {};
  var V = window.FIREBASE_SDK_VERSION || "13.0.0";
  var BASE = "https://www.gstatic.com/firebasejs/" + V + "/";
  var SOLVED = "ct-solved-v1";
  var EXAM = "ct-exam-best-v1";
  var SLUGS = {
    decompose: 1, pattern: 1, abstract: 1, algorithm: 1, branch: 1, loop: 1,
    binary: 1, search: 1, path: 1, sort: 1, debug: 1, rules: 1
  };
  function configured() {
    return !!(C.apiKey && C.projectId && C.appId);
  }
  var API = { configured: configured };
  window.CloudSync = API;
  if (!configured()) return;

  var DEBOUNCE = 1500, T_STEP = 5000, TIMEOUT = 10000;
  function SA() { return window.StudentAuth; }
  function lower(e) { return String(e == null ? "" : e).trim().toLowerCase(); }
  function timeout(p, ms) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error("timeout")); }, ms); })]);
  }
  var fbP = null;
  function sdk() {
    if (!fbP) fbP = timeout(Promise.all([
      import(BASE + "firebase-app.js"),
      import(BASE + "firebase-auth.js"),
      import(BASE + "firebase-firestore.js")
    ]).then(function (m) {
      var app = (m[0].getApps && m[0].getApps().length) ? m[0].getApps()[0] : m[0].initializeApp(C);
      return { A: m[1], F: m[2], auth: m[1].getAuth(app), db: m[2].getFirestore(app) };
    }), T_STEP);
    fbP.catch(function () { fbP = null; });
    return fbP;
  }
  function ensureAuth(fb, email) {
    return timeout((fb.auth.authStateReady ? fb.auth.authStateReady() : Promise.resolve()).then(function () {
      var cu = fb.auth.currentUser;
      if (cu && lower(cu.email) === email) return cu;
      var t = SA() && SA().getIdToken();
      if (!t) { var e = new Error("need-signin"); e.code = "need-signin"; throw e; }
      return fb.A.signInWithCredential(fb.auth, fb.A.GoogleAuthProvider.credential(t)).then(function (r) {
        if (lower(r.user.email) !== email) throw new Error("email-mismatch");
        return r.user;
      });
    }), T_STEP);
  }
  function slugs(list) {
    var out = [], seen = {};
    (Array.isArray(list) ? list : []).forEach(function (s) {
      if (typeof s === "string" && SLUGS[s] && !seen[s]) { seen[s] = 1; out.push(s); }
    });
    return out;
  }
  function readLocal() {
    var solved = [];
    try { solved = slugs(JSON.parse(localStorage.getItem(SA().key(SOLVED))) || []); } catch (e) {}
    var raw = localStorage.getItem(SA().key(EXAM));
    var n = raw == null || raw === "" ? null : Number(raw);
    var o = { solved: solved };
    if (Number.isFinite(n) && n >= 0 && n <= 20) o.examBest = Math.round(n);
    return o;
  }
  function writeLocal(o) {
    try { localStorage.setItem(SA().key(SOLVED), JSON.stringify(slugs(o.solved))); } catch (e) {}
    try {
      if (Number.isFinite(o.examBest)) localStorage.setItem(SA().key(EXAM), String(Math.round(o.examBest)));
      else localStorage.removeItem(SA().key(EXAM));
    } catch (e) {}
  }
  function merge(local, cloud) {
    var best = null;
    [local.examBest, cloud.examBest].forEach(function (n) {
      if (Number.isFinite(n)) best = best == null ? n : Math.max(best, n);
    });
    var o = { solved: slugs((local.solved || []).concat(cloud.solved || [])) };
    if (best != null) o.examBest = best;
    return o;
  }
  function lwKey(email) { return "cloud_localwins::ct::" + email; }
  function curEmail() { var u = SA() && SA().getUser(); return u ? lower(u.email) : ""; }
  function active() { return !!(document.getElementById("gsiArea") && curEmail()); }

  var lastState = "";
  function status(st, msg) {
    lastState = st;
    var h = st === "ok" ? "☁️ 已同步" : st === "busy" ? "☁️ 同步中…" : "⚠️ 未同步" + (msg ? "（" + msg + "）" : "");
    if (SA() && SA().setCloud) SA().setCloud('<span title="雲端進度">' + h + "</span>");
  }
  function errMsg(e) {
    var c = (e && (e.code || e.message)) || "";
    if (/need-signin/.test(c)) return "請登出再登入一次以同步";
    if (/permission/.test(c)) return "雲端拒絕存取";
    return "離線或連線失敗，進度先存在本機";
  }

  var gen = 0, dirty = false, tmr = null, retry = null, mergedFor = "";
  function docRef(fb, email) { return fb.F.doc(fb.db, "progress", email); }

  function flush() {
    clearTimeout(tmr); tmr = null;
    var email = curEmail();
    if (!email || !dirty || !document.getElementById("gsiArea")) return Promise.resolve();
    if (mergedFor !== email) return syncIn();
    var my = gen;
    dirty = false;
    status("busy");
    var u = SA().getUser();
    return sdk().then(function (fb) {
      return ensureAuth(fb, email).then(function () {
        var data = { name: String(u.name || ""), email: email, updatedAt: fb.F.serverTimestamp(), ct: readLocal() };
        return timeout(fb.F.setDoc(docRef(fb, email), data, { mergeFields: ["ct", "name", "email", "updatedAt"] }), TIMEOUT);
      });
    }).then(function () {
      try { localStorage.removeItem(lwKey(email)); } catch (e) {}
      if (my === gen && curEmail() === email && !dirty) status("ok");
    }).catch(function (e) {
      if (curEmail() === email) { dirty = true; status("err", errMsg(e)); scheduleRetry(); }
    });
  }
  function syncIn() {
    var email = curEmail();
    if (!email || !document.getElementById("gsiArea")) return Promise.resolve();
    var my = ++gen;
    status("busy");
    return sdk().then(function (fb) {
      return ensureAuth(fb, email).then(function () { return timeout(fb.F.getDoc(docRef(fb, email)), T_STEP); });
    }).then(function (snap) {
      if (my !== gen || curEmail() !== email) return;
      var cloud = (snap.exists() && snap.data() && snap.data().ct) || {};
      var local = readLocal();
      var merged = localStorage.getItem(lwKey(email)) ? local : merge(local, cloud);
      var changed = JSON.stringify(merged) !== JSON.stringify(local);
      if (changed) { writeLocal(merged); SA().notify("cloud"); }
      mergedFor = email;
      dirty = true;
      return flush();
    }).catch(function (e) { if (my === gen) { dirty = true; status("err", errMsg(e)); scheduleRetry(); } });
  }
  function schedule() {
    if (!active()) return;
    dirty = true;
    if (lastState !== "err") status("busy");
    clearTimeout(tmr);
    tmr = setTimeout(flush, DEBOUNCE);
  }
  function scheduleRetry() { clearTimeout(retry); retry = setTimeout(function () { if (dirty) flush(); }, 30000); }

  window.addEventListener("progress:saved", schedule);
  window.addEventListener("online", function () { if (active()) (mergedFor === curEmail() ? flush() : syncIn()); });
  window.addEventListener("studentauth:change", function (ev) {
    var r = ev.detail && ev.detail.reason;
    if (r === "cloud") return;
    if (r === "signin" || r === "switch") { dirty = false; mergedFor = ""; clearTimeout(tmr); syncIn(); return; }
    if (r === "reset") {
      var email = curEmail();
      if (email) { try { localStorage.setItem(lwKey(email), "1"); } catch (e) {} dirty = true; flush(); }
      return;
    }
    if (r === "signout") {
      gen++; dirty = false; mergedFor = ""; clearTimeout(tmr); clearTimeout(retry); lastState = "";
      if (fbP) fbP.then(function (fb) { return fb.A.signOut(fb.auth); }).catch(function () {});
    }
  });
  function start() { if (active()) syncIn(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
