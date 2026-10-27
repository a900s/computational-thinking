/* 學生 Google 登入（Google Identity Services）— 三套教材共用模組。
   目的：讓學生在頁面上用 Google 登入後，畫面頂端顯示姓名（與 email），
   並在旁邊顯示學習進度／測驗分數，方便「截圖」繳交作為學習佐證。
   需求：在 js/google-auth-config.js 設定 window.GOOGLE_CLIENT_ID。
   說明：純前端；僅在瀏覽器端解碼 ID Token 的顯示欄位（name/email/picture）
         用於畫面呈現，不會把任何資料上傳到伺服器。
   進度分帳號：各模組的 localStorage 鍵一律經 StudentAuth.key(基底鍵) 取得——
     已登入 → 「基底鍵::u:<email 雜湊>」（email 先 trim＋小寫；只存雜湊，不把 email 寫進鍵名）；
     未登入 → 匿名空間，沿用原本的基底鍵（改版前留在本機的舊進度會留在匿名空間，不會被搬給第一個登入的人）。
   登入、換帳號、登出、重置時都會發出 window 事件 "studentauth:change"（detail: {user, reason}），
   各模組收到後重新載入該帳號的紀錄並重畫畫面。 */
(function () {
  "use strict";
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function decodeJwt(t) {
    try {
      var p = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(decodeURIComponent(escape(atob(p))));
    } catch (e) { return null; }
  }

  var statusHtml = "", cloudHtml = "", idToken = ""; // idToken 只放記憶體，供選用的雲端同步（js/cloud-sync.js）登入 Firebase
  var BASES = {}; // 各模組透過 key() 登記過的基底鍵，供「重置我的進度」一次清除

  function normEmail(e) { return String(e == null ? "" : e).trim().toLowerCase(); }
  /* cyrb53：同步、穩定的 53 位元雜湊（非加密用途，只是讓鍵名不直接出現 email） */
  function hash53(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }
  function modTitle() { return window.REVIEW_DATA && window.REVIEW_DATA.title ? "「" + window.REVIEW_DATA.title + "」" : ""; }
  function emit(reason) {
    var ev;
    try { ev = new CustomEvent("studentauth:change", { detail: { user: window.StudentAuth._user, reason: reason } }); }
    catch (e) { ev = document.createEvent("CustomEvent"); ev.initCustomEvent("studentauth:change", false, false, { user: window.StudentAuth._user, reason: reason }); }
    window.dispatchEvent(ev);
  }

  function render() {
    var area = document.getElementById("gsiArea");
    if (!area) return;
    var u = window.StudentAuth._user;
    if (u) {
      area.className = "gsi gsi-in";
      area.innerHTML =
        '<div class="gsi-id"><span class="gsi-ok">✅ 已登入：</span>' +
        '<b class="gsi-name">' + esc(u.name || "（未提供姓名）") + '</b>' +
        (u.email ? ' <span class="gsi-mail">· ' + esc(u.email) + '</span>' : '') +
        '</div>' +
        '<div class="gsi-status" id="gsiStatus">' + statusHtml + '</div>' +
        '<span class="gsi-cloud" id="gsiCloud" style="font-size:.82rem;color:var(--muted)">' + cloudHtml + '</span>' +
        '<button type="button" class="gsi-out" id="gsiOut">登出</button>';
      var out = document.getElementById("gsiOut");
      if (out) out.onclick = function () { window.StudentAuth.signOut(); };
    } else {
      area.className = "gsi gsi-signedout";
      area.innerHTML =
        '<div class="gsi-txt"><b>🔐 用 Google 登入</b>' +
        '<span>登入後會顯示你的姓名，並讀取這個帳號的進度。</span></div>' +
        '<div id="gsiBtn" class="gsi-btn-host"></div>' +
        '<div class="gsi-status" id="gsiStatus">' + statusHtml + '</div>' +
        '<div class="gsi-hint" id="gsiHint"></div>';
      mountButton();
    }
  }

  function mountButton(hostEl) {
    var host = hostEl || document.getElementById("gsiBtn");
    if (!host) return;
    var cid = window.GOOGLE_CLIENT_ID || "";
    if (!cid || /REPLACE_ME/.test(cid)) {
      host.innerHTML = '<div class="gsi-warn">⚠ 尚未設定 Google Client ID（js/google-auth-config.js），登入按鈕暫時停用。</div>';
      return;
    }
    if (!(window.google && window.google.accounts && window.google.accounts.id)) {
      setTimeout(function () { mountButton(hostEl); }, 400); // 等 GIS 腳本載入
      return;
    }
    window.google.accounts.id.initialize({ client_id: cid, callback: onCredential });
    window.google.accounts.id.renderButton(host, {
      theme: "filled_blue", size: "large", text: "signin_with", shape: "pill", locale: "zh-TW"
    });
  }

  function onCredential(resp) {
    var p = decodeJwt(resp.credential);
    if (!p || !normEmail(p.email)) return; // 進度以 email 分帳號，沒有 email 就不登入
    var prev = window.StudentAuth.accountId();
    idToken = resp.credential;
    window.StudentAuth._user = { name: p.name, email: normEmail(p.email), picture: p.picture };
    try { sessionStorage.setItem("gsi_user", JSON.stringify(window.StudentAuth._user)); } catch (e) {}
    render();
    emit(prev ? (prev === window.StudentAuth.accountId() ? "signin" : "switch") : "signin");
  }

  window.StudentAuth = {
    _user: null,
    getUser: function () { return this._user; },
    /* 目前帳號 id：已登入為 email（trim＋小寫）的雜湊，未登入為 ""（匿名） */
    accountId: function () { var e = this._user && normEmail(this._user.email); return e ? "u" + hash53(e) : ""; },
    /* 依目前帳號取得 localStorage 鍵；未登入時就是基底鍵本身（匿名空間） */
    key: function (base) { BASES[base] = 1; var a = this.accountId(); return a ? base + "::" + a.replace(/^u/, "u:") : base; },
    /* 重置「目前帳號」在本機的所有進度（各模組登記過的鍵），會先確認 */
    resetProgress: function (skipConfirm) {
      var who = this._user ? (this._user.email || this._user.name) : "未登入（匿名）";
      var cloud = window.CloudSync && window.CloudSync.configured && window.CloudSync.configured() && this._user;
      if (!skipConfirm && !window.confirm("確定要重置「" + who + "」的本教材" + modTitle() + "學習進度嗎？\n（關卡、隨堂複習作答紀錄都會清除" + (cloud ? "，雲端備份也會一併清除" : "") + "，無法復原；其他帳號與其他教材的進度不受影響）")) return false;
      var self = this;
      Object.keys(BASES).forEach(function (b) { try { localStorage.removeItem(self.key(b)); } catch (e) {} });
      emit("reset");
      return true;
    },
    getIdToken: function () { return idToken; },
    /* 在任意容器放 Google 登入鈕（教師頁用）；登入後同樣會發出 studentauth:change */
    mountButton: function (host) { mountButton(host); },
    /* 讓其他模組（如雲端同步）在改寫本機紀錄後通知各模組重畫；reason 例如 "cloud" */
    notify: function (reason) { emit(reason || "cloud"); },
    setCloud: function (html) {
      cloudHtml = html || "";
      var c = document.getElementById("gsiCloud");
      if (c) c.innerHTML = cloudHtml;
    },
    setStatus: function (html) {
      statusHtml = html || "";
      var s = document.getElementById("gsiStatus");
      if (s) s.innerHTML = statusHtml;
    },
    signOut: function () {
      this._user = null; idToken = ""; cloudHtml = "";
      try { sessionStorage.removeItem("gsi_user"); } catch (e) {}
      if (window.google && window.google.accounts && window.google.accounts.id)
        window.google.accounts.id.disableAutoSelect();
      render();
      emit("signout");
    },
    init: function () { render(); }
  };
  // 在任何模組腳本讀取進度之前就先還原本分頁的登入者，讓第一次載入就用對的帳號空間
  try {
    var s0 = sessionStorage.getItem("gsi_user"), u0 = s0 && JSON.parse(s0);
    if (u0 && normEmail(u0.email)) { u0.email = normEmail(u0.email); window.StudentAuth._user = u0; }
  } catch (e) {}

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", function () { window.StudentAuth.init(); });
  else window.StudentAuth.init();
})();
