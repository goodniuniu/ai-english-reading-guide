/* 导读学习页（reader.html）渲染逻辑 */
(function () {
  "use strict";
  var ER = window.ER, esc = ER.esc;

  var id = new URLSearchParams(location.search).get("id");
  var g = id ? ER.DB.get(id) : ER.DB.load()[0];
  var root = document.getElementById("app");

  if (!g) {
    root.innerHTML = '<div class="card empty">未找到文章，<a href="index.html">返回目录</a></div>';
    return;
  }
  document.title = g.title + " · AI 指导英语阅读";
  var gd = g.guide || {};

  function flowHtml() {
    return '<div class="flow">' + (gd.structure || []).map(function (s) {
      return '<div class="flow-item"><div class="flow-rail"><div class="flow-dot"></div><div class="flow-line"></div></div>' +
        '<div class="flow-body"><b>' + esc(s.stage) + '</b><div class="d">' + esc(s.desc) + '</div></div></div>';
    }).join("") + "</div>";
  }
  function qHtml() {
    return (gd.questions || []).map(function (q, i) {
      return '<div class="q-item"><div class="q"><span class="qn">Q' + (i + 1) + '</span>' + esc(q.q) + '</div>' +
        (q.hint ? '<details><summary>💡 看提示</summary><div class="ans hint">' + esc(q.hint) + '</div></details>' : "") +
        (q.answer ? '<details><summary>✅ 看参考答案</summary><div class="ans ref">' + esc(q.answer) + '</div></details>' : "") +
        '</div>';
    }).join("");
  }
  function sentHtml() {
    return (gd.sentences || []).map(function (s, i) {
      return '<div class="sent"><div class="orig"><span class="lbl">句子 ' + (i + 1) + ' · 原句</span>' + esc(s.text) + '</div>' +
        '<div class="parse-wrap"><span class="lbl">结构拆解</span><div class="parse">' + esc(s.parse) + '</div></div>' +
        (s.note ? '<div class="note"><span class="lbl">技巧 / 仿写点</span>' + esc(s.note) + '</div>' : "") + '</div>';
    }).join("");
  }
  function table(headers, rows) {
    if (!rows || !rows.length) return "";
    return '<table class="vocab-table"><thead><tr>' +
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
        v.concepts.map(function (x) { return ['<span class="term">' + esc(x.term) + "</span>", x.meaning, '<span class="ctx">' + esc(x.context) + "</span>"]; }));
    if (v.verbs && v.verbs.length)
      part += "<h3>高级动词 / 动词短语（写作可复用）</h3>" + table(["表达", "含义", "原文例句"],
        v.verbs.map(function (x) { return ['<span class="term">' + esc(x.expr) + "</span>", x.meaning, '<span class="ctx">' + esc(x.example) + "</span>"]; }));
    if (v.insiders && v.insiders.length)
      part += "<h3>熟词僻义</h3>" + table(["词", "常见义", "本文义 / 用法"],
        v.insiders.map(function (x) { return ['<span class="term">' + esc(x.word) + "</span>", x.common, x.here]; }));
    if (v.gems && v.gems.length)
      part += "<h3>精妙小词</h3>" + table(["词", "用法妙处"],
        v.gems.map(function (x) { return ['<span class="term">' + esc(x.word) + "</span>", x.usage]; }));
    return part;
  }
  function origHtml() {
    return (g.text || "").split(/\n\s*\n/).map(function (p) { return "<p>" + esc(p.trim()) + "</p>"; }).join("");
  }

  var idx = ER.DB.load().findIndex(function (x) { return x.id === g.id; });
  var all = ER.DB.load();
  var prev = idx > 0 ? all[idx - 1] : null;
  var next = idx < all.length - 1 ? all[idx + 1] : null;

  var isDraft = ER.DB.isDraft(g.id);
  var headTag = isDraft
    ? '<span class="chip" style="background:#eef3ff;color:#1d4ed8">本地草稿 · 未发布</span>'
    : '<span class="chip">线上发布内容</span>';

  root.innerHTML =
    '<div class="card reader-head">' +
      '<div class="kicker">' + esc(g.source || "The Economist") + (g.date ? " · " + esc(g.date) : "") + '</div>' +
      '<h1>' + esc(g.title) + '</h1>' +
      (g.subtitle ? '<div class="sub">' + esc(g.subtitle) + '</div>' : "") +
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
      '<div class="prose"><p>' + esc(gd.background || "") + '</p></div>' + flowHtml() +
      (gd.strategy ? '<div class="strategy">💡 <b>阅读策略</b>：' + esc(gd.strategy) + '</div>' : "") +
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
      (isDraft ? '<button class="btn danger" id="delBtn">删除草稿</button>' : "") +
      (next ? '<a class="btn" href="reader.html?id=' + encodeURIComponent(next.id) + '">下一篇 →</a>' : "<span></span>") +
    '</div>' +
    (isDraft
      ? '<div class="card" style="background:#f6f8ff;border-color:#c9d8f4"><b>发布指引</b>：本篇为<b>本地草稿</b>，仅你可见。<br>' +
        '① 点击「导出本篇 JSON」，把下载的 .json 放进项目的 <code>content/</code> 目录；' +
        '② 在项目目录运行 <code>node build.js</code>（重新生成线上文章库）；' +
        '③ 然后 <code>git add . && git commit && git push</code> —— GitHub Pages 自动更新，所有访客即可在目录中看到本文。</div>'
      : '<div class="card" style="background:#fbfaf6;border-color:#e4e7e2"><b>本文为线上发布内容</b>：所有访客都能在目录中看到。如需下线/修改，请在仓库中编辑 <code>content/&lt;id&gt;.json</code> 后重新运行 <code>node build.js</code> 并推送。<br>' +
        '（想在本机生成你自己的新导读？回目录粘贴新文章即可——那会作为草稿单独保存。）</div>');

  document.getElementById("exportBtn").addEventListener("click", function () {
    ER.downloadFile("content/" + g.id + ".json", JSON.stringify(g, null, 2), "application/json");
    ER.toast("已导出 " + g.id + ".json（请保存到项目 content/ 目录）");
  });

  var delBtn = document.getElementById("delBtn");
  if (delBtn) delBtn.addEventListener("click", function () {
    if (!confirm("确定删除本地草稿《" + g.title + "》吗？此操作不可恢复。")) return;
    ER.DB.removeDraft(g.id);
    location.href = "index.html";
  });
})();
