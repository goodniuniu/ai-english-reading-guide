/* 导读学习页（reader.html）渲染逻辑
   云端适配：先用 localStorage 缓存渲染；若文章未找到，等云端同步完成后再试一次
   （可能是我换设备后的私密文章，或他人新公开的云端文章）。 */
(function () {
  "use strict";
  var ER = window.ER, esc = ER.esc;
  /* C(): 剥离 AI 输出中混入的 HTML 标签/实体，仅保留纯文本 */
  var C = ER.cleanStr;
  var root = document.getElementById("app");
  var id = new URLSearchParams(location.search).get("id");

  /* 把 guide 上的云端标记（_cloud/_cid/_visibility/_mine）写回 localStorage 缓存 */
  function persistCloudMark(g) {
    try {
      var arr = JSON.parse(localStorage.getItem("er_guides_drafts") || "[]");
      arr.forEach(function (x) {
        if (x.id === g.id) {
          x._cloud = g._cloud; x._cid = g._cid;
          x._visibility = g._visibility; x._mine = g._mine;
        }
      });
      localStorage.setItem("er_guides_drafts", JSON.stringify(arr));
    } catch (e) { /* 缓存写入失败不影响本次浏览 */ }
  }

  function start() {
    var g = id ? ER.DB.get(id) : ER.DB.load()[0];
    if (!g) {
      /* 缓存里没有 → 等云端同步落定再查一次 */
      ER.ready.then(function () {
        var g2 = id ? ER.DB.get(id) : ER.DB.load()[0];
        if (g2) boot(g2);
        else root.innerHTML = '<div class="card empty">未找到文章，<a href="index.html">返回目录</a></div>';
      });
      return;
    }
    boot(g);
  }

  function boot(g) {
    document.title = g.title + " · AI 指导英语阅读";
    var gd = g.guide || {};

    function flowHtml() {
      return '<div class="flow">' + (gd.structure || []).map(function (s) {
        return '<div class="flow-item"><div class="flow-rail"><div class="flow-dot"></div><div class="flow-line"></div></div>' +
          '<div class="flow-body"><b>' + esc(C(s.stage)) + '</b><div class="d">' + esc(C(s.desc)) + '</div></div></div>';
      }).join("") + "</div>";
    }
    function qHtml() {
      return (gd.questions || []).map(function (q, i) {
        return '<div class="q-item"><div class="q"><span class="qn">Q' + (i + 1) + '</span>' + esc(C(q.q)) + '</div>' +
          (q.hint ? '<details><summary>💡 看提示</summary><div class="ans hint">' + esc(C(q.hint)) + '</div></details>' : "") +
          (q.answer ? '<details><summary>✅ 看参考答案</summary><div class="ans ref">' + esc(C(q.answer)) + '</div></details>' : "") +
          '</div>';
      }).join("");
    }
    function sentHtml() {
      return (gd.sentences || []).map(function (s, i) {
        return '<div class="sent"><div class="orig"><span class="lbl">句子 ' + (i + 1) + ' · 原句</span>' + esc(C(s.text)) + '</div>' +
          '<div class="parse-wrap"><span class="lbl">结构拆解</span><div class="parse">' + esc(C(s.parse)) + '</div></div>' +
          (s.note ? '<div class="note"><span class="lbl">技巧 / 仿写点</span>' + esc(C(s.note)) + '</div>' : "") + '</div>';
      }).join("");
    }
    function table(headers, rows) {
      if (!rows || !rows.length) return "";
      return '<table class="vocab-table rich"><thead><tr>' +
        headers.map(function (h) { return "<th>" + h + "</th>"; }).join("") +
        "</tr></thead><tbody>" + rows.map(function (r) {
          return "<tr>" + r.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>";
        }).join("") + "</tbody></table>";
    }
    function vocabHtml() {
      var v = gd.vocab || {};
      var part = "";
      if (v.concepts && v.concepts.length)
        part += "<h3>核心概念词</h3>" + table(["术语", "释义", "原文语境"],
          v.concepts.map(function (x) { return [C(x.term), C(x.meaning), C(x.context)]; }));
      if (v.verbs && v.verbs.length)
        part += "<h3>高级动词 / 动词短语（写作可复用）</h3>" + table(["表达", "含义", "原文例句"],
          v.verbs.map(function (x) { return [C(x.expr), C(x.meaning), C(x.example)]; }));
      if (v.insiders && v.insiders.length)
        part += "<h3>熟词僻义</h3>" + table(["词", "常见义", "本文义 / 用法"],
          v.insiders.map(function (x) { return [C(x.word), C(x.common), C(x.here)]; }));
      if (v.gems && v.gems.length)
        part += "<h3>精妙小词</h3>" + table(["词", "用法妙处"],
          v.gems.map(function (x) { return [C(x.word), C(x.usage)]; }));
      return part;
    }
    function origHtml() {
      return (g.text || "").split(/\n\s*\n/).map(function (p) { return "<p>" + esc(p.trim()) + "</p>"; }).join("");
    }

    var all = ER.DB.load();
    var idx = all.findIndex(function (x) { return x.id === g.id; });
    var prev = idx > 0 ? all[idx - 1] : null;
    var next = idx < all.length - 1 ? all[idx + 1] : null;

    var track = ER.DB.trackOf(g);
    var loggedIn = window.ERCLOUD && ERCLOUD.loggedIn();
    var headTag =
      track === "static" ? '<span class="chip">线上发布内容</span>' :
      track === "cloud-public" ? '<span class="chip" style="background:#e7f6ec;color:#15803d">云端 · 公开（所有访客可见）</span>' :
      track === "cloud-private" ? '<span class="chip" style="background:#fdf3e3;color:#92400e">云端 · 私密（仅你可见）</span>' :
      '<span class="chip" style="background:#eef3ff;color:#1d4ed8">本地草稿 · 未发布</span>';

    /* 云端操作按钮：仅当文章属于我且已登录时出现 */
    var cloudBtn = "";
    if (loggedIn && track !== "static" && (g._mine || track === "local")) {
      if (track === "local") cloudBtn = '<button class="btn" id="cloudUpBtn">☁ 同步到云端（私密）</button>';
      else if (track === "cloud-private") cloudBtn = '<button class="btn" id="cloudPubBtn">🌐 设为公开（分享给所有访客）</button>';
      else if (track === "cloud-public") cloudBtn = '<button class="btn" id="cloudPrivBtn">🔒 设为私密</button>';
    }

    var guideCard;
    if (track === "static") {
      guideCard = '<div class="card" style="background:#fbfaf6;border-color:#e4e7e2"><b>本文为线上发布内容</b>：所有访客都能在目录中看到。如需下线/修改，请在仓库中编辑 <code>content/&lt;id&gt;.json</code> 后重新运行 <code>node build.js</code> 并推送。<br>' +
        '（想在本机生成你自己的新导读？回目录粘贴新文章即可——那会作为草稿单独保存。）</div>';
    } else if (track === "local" && !loggedIn) {
      guideCard = '<div class="card" style="background:#f6f8ff;border-color:#c9d8f4"><b>发布指引</b>：本篇为<b>本地草稿</b>，仅你可见。两种发布方式：<br>' +
        '① <b>云端发布（推荐）</b>：回目录页登录账号，回到本页即可一键「同步到云端」并设为公开；<br>' +
        '② <b>仓库发布</b>：点「导出本篇 JSON」存进项目 <code>content/</code> → <code>node build.js</code> → <code>git push</code>，随 GitHub Pages 发布。</div>';
    } else {
      guideCard = '<div class="card" style="background:#f6f8ff;border-color:#c9d8f4"><b>云端文章</b>：' +
        (track === "cloud-public"
          ? '本文已<b>公开</b>，所有访客都能在目录中看到。如需下线，点上方「设为私密」即可。'
          : '本文仅你可见，已跨设备同步。点上方「设为公开」即可分享给所有访客。') + '</div>';
    }

    root.innerHTML =
      '<div class="card reader-head">' +
        '<div class="kicker">' + esc(C(g.source || "The Economist")) + (g.date ? " · " + esc(g.date) : "") + '</div>' +
        '<h1>' + esc(C(g.title)) + '</h1>' +
        (g.subtitle ? '<div class="sub">' + esc(C(g.subtitle)) + '</div>' : "") +
        '<div class="meta">' + headTag + ' &nbsp;收录于 ' + esc((g.addedAt || "").slice(0, 10)) + ' · 词汇沉淀 ' + ER.vocabCount(g) + ' 条</div>' +
        '<div class="toc-pills">' +
          '<a href="#sec-structure">① 背景与结构导读</a>' +
          '<a href="#sec-questions">② 阅读理解与思考</a>' +
          '<a href="#sec-sentences">③ 长难句精拆</a>' +
          '<a href="#sec-vocab">④ 词汇知识库</a>' +
          '<a href="#sec-original">⑤ 原文对照</a>' +
          '<a href="knowledge.html" style="background:#fdf3e3;color:#92400e">⑥ 全局知识库 →</a>' +
        '</div>' +
      '</div>' +

      '<div class="card sec" id="sec-structure"><h2><span class="num">①</span>文章背景与结构导读</h2>' +
        '<div class="prose"><p>' + esc(C(gd.background || "")) + '</p></div>' + flowHtml() +
        (gd.strategy ? '<div class="strategy">💡 <b>阅读策略</b>：' + esc(C(gd.strategy)) + '</div>' : "") +
      '</div>' +

      '<div class="card sec" id="sec-questions"><h2><span class="num">②</span>阅读理解与思考检查</h2>' +
        '<div class="prose" style="margin-bottom:12px">先独立作答，再展开提示与参考答案。</div>' + qHtml() + '</div>' +

      '<div class="card sec" id="sec-sentences"><h2><span class="num">③</span>三个值得精读拆解的长难句</h2>' + sentHtml() + '</div>' +

      '<div class="card sec" id="sec-vocab"><h2><span class="num">④</span>词汇知识库（本文沉淀）</h2>' + vocabHtml() + '</div>' +

      '<div class="card sec" id="sec-original"><h2><span class="num">⑤</span>原文对照阅读</h2>' +
        '<div class="original-text">' + origHtml() + '</div></div>' +

      '<div class="reader-nav">' +
        (prev ? '<a class="btn" href="reader.html?id=' + encodeURIComponent(prev.id) + '">← 上一篇</a>' : "<span></span>") +
        '<a class="btn" href="index.html">返回目录</a>' +
        '<button class="btn" id="exportBtn">⬇ 导出本篇 JSON</button>' +
        cloudBtn +
        (track !== "static" && (g._mine || track === "local") ? '<button class="btn danger" id="delBtn">删除' + (track === "local" ? "草稿" : "云端文章") + '</button>' : "") +
        (next ? '<a class="btn" href="reader.html?id=' + encodeURIComponent(next.id) + '">下一篇 →</a>' : "<span></span>") +
      '</div>' +
      guideCard;

    document.getElementById("exportBtn").addEventListener("click", function () {
      var clean = {};
      Object.keys(g).forEach(function (k) { if (k.charAt(0) !== "_") clean[k] = g[k]; });
      ER.downloadFile("content/" + g.id + ".json", JSON.stringify(clean, null, 2), "application/json");
      ER.toast("已导出 " + g.id + ".json（请保存到项目 content/ 目录）");
    });

    var delBtn = document.getElementById("delBtn");
    if (delBtn) delBtn.addEventListener("click", function () {
      if (!confirm("确定删除《" + g.title + "》吗？" + (g._cloud ? "云端记录会一并删除，" : "") + "此操作不可恢复。")) return;
      ER.DB.removeDraft(g.id);
      location.href = "index.html";
    });

    /* 云端操作 */
    function cloudOp(promise, okMsg) {
      ER.overlay(true, "正在同步云端……");
      promise.then(function () {
        persistCloudMark(g);
        ER.overlay(false); ER.toast(okMsg);
        setTimeout(function () { location.reload(); }, 500);
      }).catch(function (e) {
        ER.overlay(false); ER.toast("操作失败：" + e.message, true);
      });
    }
    var upBtn = document.getElementById("cloudUpBtn");
    if (upBtn) upBtn.addEventListener("click", function () {
      cloudOp(ERCLOUD.saveArticle(g, "private"), "已同步到云端（私密），可跨设备访问 ✓");
    });
    var pubBtn = document.getElementById("cloudPubBtn");
    if (pubBtn) pubBtn.addEventListener("click", function () {
      if (!confirm("设为公开后，所有访客都能在目录中看到本文。继续？")) return;
      cloudOp(ERCLOUD.setVisibility(g, "public"), "已公开，所有访客可见 ✓");
    });
    var privBtn = document.getElementById("cloudPrivBtn");
    if (privBtn) privBtn.addEventListener("click", function () {
      cloudOp(ERCLOUD.setVisibility(g, "private"), "已设为私密，仅你可见");
    });
  }

  start();
})();
