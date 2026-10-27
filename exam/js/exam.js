/* 線上測驗 20 題。十二關都完成才開放。成績依 Google 帳號分開，並寫入雲端。 */
(function () {
  "use strict";
  var SOLVED = "ct-solved-v1";
  var KEY = "ct-exam-best-v1";
  var NEED = 12;
  function storageKey(base) {
    return window.StudentAuth && window.StudentAuth.key ? window.StudentAuth.key(base) : base;
  }
  storageKey(SOLVED);
  storageKey(KEY);
  function solvedCount() {
    try { return new Set(JSON.parse(localStorage.getItem(storageKey(SOLVED))) || []).size; }
    catch (e) { return 0; }
  }
  var ITEMS = [
    { topic: "分解", stem: "哪一種才是有用的分解？", options: ["把「辦班遊」拆成交通、餐飲、保險、集合，做完再合起來", "請一位同學獨自處理全部", "依同學的血型分組", "只決定集合地點，其他不做"], answer: 0, exp: "拆開的每一塊都能完成，合起來仍是辦班遊。一個人全部做完並沒有把問題變小；依血型分組和任務無關；只做集合地點則不完整。" },
    { topic: "找規律", stem: "數列 3、6、12、24，下一個是？", options: ["25", "48", "30", "36"], answer: 1, exp: "每一項都是前一項的 2 倍：24×2=48。25 只加 1，30 和 36 不是同一條規則。" },
    { topic: "抽象化", stem: "飲料機要判斷能不能出飲料，應該留下什麼？", options: ["客人的髮色", "今天是星期幾", "餘額夠不夠，以及選的飲料還有沒有", "機器外殼的顏色"], answer: 2, exp: "會影響出飲料的是餘額和庫存。髮色、星期、外殼顏色不改變這次判斷。" },
    { topic: "演算法", stem: "演算法最重要的特徵是？", options: ["一定要用英文寫", "步驟愈多愈好", "只能給電腦看", "步驟清楚、有限，照順序做完會得到結果"], answer: 3, exp: "演算法是人也能照著做的有限步驟。它不必是英文，也不等於程式碼。" },
    { topic: "條件", stem: "流程圖的菱形通常代表？", options: ["條件判斷", "開始或結束", "輸入或輸出", "文件存檔"], answer: 0, exp: "菱形是分歧：條件成立走一邊，不成立走另一邊。開始和結束多用圓角矩形。" },
    { topic: "迴圈", stem: "厚度 0.2 mm，每次變成兩倍，厚度至少 1.6 mm 就停。會乘幾次？", options: ["2", "3", "4", "8"], answer: 1, exp: "0.2→0.4→0.8→1.6，第 3 次達標。第 2 次只有 0.8，還沒到。" },
    { topic: "二進位", stem: "燈的權重由左到右是 4、2、1。亮、暗、亮（1 0 1）是多少？", options: ["3", "6", "5", "4"], answer: 2, exp: "亮的是 4 和 1，4+1=5。011 才是 3，110 才是 6。" },
    { topic: "二進位", stem: "同一組燈要表示 6。燈號應是？", options: ["1 0 1", "0 1 1", "1 1 1", "1 1 0"], answer: 3, exp: "6=4+2，所以左與中亮、右暗，也就是 110。101 是 5，011 是 3，111 是 7。" },
    { topic: "搜尋", stem: "座號 1 到 40 已由小到大排好。要找 28，中間看到 15。下一步？", options: ["往座號較大的一側找", "往座號較小的一側找", "從 1 號重新一個一個找", "認定 28 號不存在"], answer: 0, exp: "15 比 28 小，較小的一側可以排除，所以往較大的一側。還不能因此說 28 不存在。" },
    { topic: "搜尋", stem: "40 筆已排好序的資料，每次排除一半。最壞大約幾次可以定位？", options: ["40", "6", "2", "20"], answer: 1, exp: "40→20→10→5→3→1，大約 6 次。40 次是逐筆找，2 次不夠把 40 筆縮到一筆。" },
    { topic: "路徑", stem: "三條都走得通的路要 9 分、4 分、7 分。應選哪條？", options: ["9 分那條", "7 分那條", "4 分那條", "把三條的時間加起來"], answer: 2, exp: "最短路徑是走得通的路線裡成本最小的，這裡是 4 分。把三條加起來是另一種問題。" },
    { topic: "排序", stem: "已經知道 A 比 B 重，還沒看過 C。下一步最沒有幫助的是？", options: ["拿 C 和 A 比", "拿 C 和 B 比", "記下 A 比 B 重", "再把 A 和 B 比一次"], answer: 3, exp: "A 與 B 的關係已知。再比一次沒有新資訊；下一步應讓 C 進入比較。" },
    { topic: "除錯", stem: "規則寫「個位數 0、2、4、6 為偶數」，漏了 8。哪個數會被誤判成奇數？", options: ["18", "7", "14", "21"], answer: 0, exp: "18 是偶數，但個位數 8 沒被列進規則。7 和 21 本來是奇數，14 的個位數 4 有被列到。" },
    { topic: "規則", stem: "代碼要剛好 4 碼、至少 1 個數字、不能以 0 開頭、字母只能小寫。哪一組可以？", options: ["0ab1", "k3mp", "Abc1", "ab12c"], answer: 1, exp: "k3mp 四條都符合。0ab1 以 0 開頭，Abc1 有大寫，ab12c 有 5 個字元。" },
    { topic: "抽象化", stem: "抽象化的好處是？", options: ["把所有細節都留下", "讓說明變得比較長", "拿掉跟問題無關的細節，判斷比較清楚", "因此就不必再寫步驟"], answer: 2, exp: "留下會影響答案的條件，拿掉其餘的。步驟仍然要另外寫清楚。" },
    { topic: "演算法", stem: "演算法和程式的差別，哪句最準？", options: ["兩者完全一樣", "演算法一定是 Python", "程式不能表示步驟", "演算法是步驟，程式是用某種語言把步驟寫出來"], answer: 3, exp: "先有可執行的步驟，再用程式語言實作。同一套演算法可以寫成不同程式。" },
    { topic: "條件", stem: "班規：下雨而且沒帶傘，才留在走廊；其餘去操場。現在下雨、有帶傘。", options: ["去操場", "留在走廊", "兩種都可以", "條件不夠，不能決定"], answer: 0, exp: "留在走廊要「下雨」和「沒帶傘」同時成立。有帶傘時走「其餘」，所以去操場。" },
    { topic: "迴圈", stem: "從 0.1 mm 每次乘 2，厚度至少 3.2 mm 就停。第幾次乘才第一次達標？", options: ["4", "5", "6", "32"], answer: 1, exp: "0.2、0.4、0.8、1.6、3.2，第 5 次才到 3.2。第 4 次是 1.6，還沒達標。" },
    { topic: "路徑", stem: "只有單行道甲→乙、乙→丙，沒有甲直接到丙。從甲到丙怎麼走？", options: ["不能到", "直接走甲到丙", "甲 → 乙 → 丙", "丙 → 乙 → 甲"], answer: 2, exp: "沒有直達，但甲到乙、乙到丙都走得通，所以可以接起來。反向的丙→甲這張圖沒有。" },
    { topic: "分解", stem: "哪一種拆法沒有真的分解問題？", options: ["海報、廣播、場地分開做", "先調查、再設計、再發表", "收資料、製圖、上台報告分開", "把同一張海報依幸運色切開，切完仍不知道怎麼做"], answer: 3, exp: "依幸運色切開，和完成海報無關，小問題也不能獨立做出成果。前三項都對應可完成的工作。" }
  ];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function best() {
    var raw = localStorage.getItem(storageKey(KEY));
    if (raw == null || raw === "") return null;
    var n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  function showBest() {
    var el = document.getElementById("best");
    if (!el) return;
    var n = best();
    var who = window.StudentAuth && window.StudentAuth.getUser && window.StudentAuth.getUser();
    var prefix = who ? who.email + " 的最高 " : "尚未登入，這台瀏覽器最高 ";
    el.textContent = n == null ? (who ? who.email + " 還沒有測驗成績" : "登入後成績會記在 Google 帳號") : prefix + n + " / " + ITEMS.length;
  }

  var form = document.getElementById("exam");
  var built = false;
  function showLocked() {
    built = false;
    form.innerHTML = '<div class="warn">線上測驗要十二關都完成才開放。目前 ' + solvedCount() + " / " + NEED + ' 關。</div><p><a href="../play/">回關卡</a></p>';
    var score = document.getElementById("score");
    if (score) score.hidden = true;
    showBest();
  }
  function buildForm() {
    if (solvedCount() < NEED) { showLocked(); return; }
    if (built) { showBest(); return; }
    built = true;
    form.innerHTML = ITEMS.map(function (q, i) {
    var opts = q.options.map(function (t, j) {
      return '<label class="opt"><input type="radio" name="q' + i + '" value="' + j + '"><span>' + esc(t) + "</span></label>";
    }).join("");
    return '<fieldset class="q" data-i="' + i + '"><legend><span class="tag">' + (i + 1) + " · " + esc(q.topic) + "</span>" + esc(q.stem) + "</legend>" + opts + '<p class="exp" hidden></p></fieldset>';
  }).join("") + '<div class="actions"><button type="submit" class="primary">送出並計分</button><button type="button" class="ghost" id="reset">清空重考</button></div>';

  form.onsubmit = function (e) {
    e.preventDefault();
    var score = 0, blank = 0;
    ITEMS.forEach(function (q, i) {
      var box = form.querySelector('[data-i="' + i + '"]');
      var picked = box.querySelector("input:checked");
      var exp = box.querySelector(".exp");
      box.classList.remove("ok", "ng");
      if (!picked) {
        blank += 1;
        exp.hidden = false;
        exp.innerHTML = "<b>未作答。</b> " + esc(q.exp);
        return;
      }
      var ok = Number(picked.value) === q.answer;
      if (ok) score += 1;
      box.classList.add(ok ? "ok" : "ng");
      exp.hidden = false;
      exp.innerHTML = (ok ? "<b>答對。</b> " : "<b>答錯。</b> 正確是「" + esc(q.options[q.answer]) + "」。") + esc(q.exp);
    });
    var note = document.getElementById("score");
    note.hidden = false;
    note.textContent = "得分 " + score + " / " + ITEMS.length + (blank ? "（未作答 " + blank + " 題）" : "");
    if (best() == null || score > best()) localStorage.setItem(storageKey(KEY), String(score));
    try { window.dispatchEvent(new Event("progress:saved")); } catch (err) {}
    showBest();
    note.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

    var reset = document.getElementById("reset");
    if (reset) reset.addEventListener("click", function () {
      form.reset();
      form.querySelectorAll(".q").forEach(function (box) {
        box.classList.remove("ok", "ng");
        var exp = box.querySelector(".exp");
        exp.hidden = true;
        exp.textContent = "";
      });
      document.getElementById("score").hidden = true;
    });
    showBest();
  }
  function refresh() {
    if (solvedCount() < NEED) showLocked();
    else buildForm();
  }
  window.addEventListener("studentauth:change", function (ev) {
    var r = ev.detail && ev.detail.reason;
    if (r === "signin" || r === "switch" || r === "signout" || r === "reset" || r === "cloud") {
      built = false;
      refresh();
    }
  });
  refresh();
})();
