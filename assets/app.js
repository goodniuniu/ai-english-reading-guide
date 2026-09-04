/* AI 指导英语阅读 · 数据层 + 目录页/知识库页逻辑
   双轨数据模型：
   - 线上内容（published）：来自 assets/articles.js（由 build.js 从 content/*.json 生成），
     随仓库推送、所有访客可见，只读。
   - 本地草稿（draft）：创作者在本机浏览器生成、尚未发布的导读，存 localStorage。
*/
(function () {
  "use strict";

  var LS_GUIDES = "er_guides_drafts";
  var LS_KB_EXTRA = "er_kb_extra";
  var LS_CFG = "er_api_cfg";

  /* ── 存储读写 ───────────────────────────── */
  function lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; }
  }
  function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  /* ── 线上静态文章库（随仓库发布） ───────── */
  function staticList() {
    var src = (window.STATIC_ARTICLES && window.STATIC_ARTICLES.length)
      ? window.STATIC_ARTICLES
      : (window.SEED_ARTICLE ? [window.SEED_ARTICLE] : []);
    return JSON.parse(JSON.stringify(src));
  }
  function staticIds() {
    var ids = {};
    staticList().forEach(function (g) { ids[g.id] = 1; });
    return ids;
  }
  /* 草稿：localStorage 中不属于静态库的文章 */
  function drafts() {
    var arr = lsGet(LS_GUIDES);
    if (!Array.isArray(arr)) return [];
    var sids = staticIds();
    return arr.filter(function (g) { return g && g.id && !sids[g.id]; });
  }
  function saveDrafts(list) { lsSet(LS_GUIDES, list); }

  /* ── 数据层 API ─────────────────────────── */
  var DB = {
    /* 全部可见文章 = 线上库 + 本地草稿 */
    load: function () { return staticList().concat(drafts()); },
    all: function () { return this.load(); },
    get: function (id) {
      return this.load().filter(function (g) { return g.id === id; })[0] || null;
    },
    isDraft: function (id) {
      return !staticIds()[id] && drafts().some(function (g) { return g.id === id; });
    },
    isPublished: function (id) { return !!staticIds()[id]; },
    /* 生成新草稿入库（id 与线上冲突时自动改名） */
    addDraft: function (guide) {
      var list = drafts();
      list.unshift(guide);
      saveDrafts(list);
    },
    /* 删除草稿（线上内容不可本地删除，需删 content/*.json 后重新 build） */
    removeDraft: function (id) {
      var list = drafts().filter(function (g) { return g.id !== id; });
      saveDrafts(list);
    },
    uniqueId: function (base) {
      var used = {};
      this.load().forEach(function (g) { used[g.id] = 1; });
      if (!used[base]) return base;
      for (var i = 2; i < 99; i++) { if (!used[base + "-" + i]) return base + "-" + i; }
      return base + "-" + Date.now();
    },
    /* 备份 = 全部可见文章 + 手动词条（发布源仍以 content/*.json 为准） */
    exportAll: function () {
      return JSON.stringify({
        guides: this.load(), kbExtra: KB.loadExtra(),
        exportedAt: new Date().toISOString(),
        note: "线上文章以仓库 content/*.json 为准；此备份用于本地数据迁移。"
      }, null, 2);
    },
    importAll: function (json) {
      var blob = JSON.parse(json);
      if (Array.isArray(blob.guides)) {
        var sids = staticIds();
        var keep = {};
        blob.guides.forEach(function (g) { if (g && g.id && !sids[g.id]) keep[g.id] = g; });
        saveDrafts(Object.keys(keep).map(function (k) { return keep[k]; }));
      }
      if (blob.kbExtra) localStorage.setItem(LS_KB_EXTRA, JSON.stringify(blob.kbExtra));
    },
    clearDrafts: function () { localStorage.removeItem(LS_GUIDES); }
  };

  /* ── 知识库手动条目 ─────────────────────── */
  var KB = {
    CATS: ["concepts", "verbs", "insiders", "gems"],
    loadExtra: function () {
      var v = lsGet(LS_KB_EXTRA);
      if (v && typeof v === "object") {
        return {
          concepts: v.concepts || [], verbs: v.verbs || [],
          insiders: v.insiders || [], gems: v.gems || []
        };
      }
      return { concepts: [], verbs: [], insiders: [], gems: [] };
    },
    saveExtra: function (extra) { localStorage.setItem(LS_KB_EXTRA, JSON.stringify(extra)); },
    aggregate: function (cat) {
      var list = [], seen = {};
      var push = function (item, src, manual) {
        var key = (item.term || item.expr || item.word || "").toLowerCase().trim();
        if (!key) return;
        if (seen[key]) { seen[key].count++; if (seen[key].sources.indexOf(src) < 0) seen[key].sources.push(src); return; }
        var row = Object.assign({}, item);
        row.count = 1; row.sources = [src]; row.manual = !!manual;
        seen[key] = row; list.push(row);
      };
      if (cat === "concepts") {
        DB.load().forEach(function (g) { (g.guide.vocab.concepts || []).forEach(function (it) { push(it, g.title, false); }); });
        KB.loadExtra().concepts.forEach(function (it) { push(it, "手动添加", true); });
      } else if (cat === "verbs") {
        DB.load().forEach(function (g) { (g.guide.vocab.verbs || []).forEach(function (it) { push(it, g.title, false); }); });
        KB.loadExtra().verbs.forEach(function (it) { push(it, "手动添加", true); });
      } else if (cat === "insiders") {
        DB.load().forEach(function (g) { (g.guide.vocab.insiders || []).forEach(function (it) { push(it, g.title, false); }); });
        KB.loadExtra().insiders.forEach(function (it) { push(it, "手动添加", true); });
      } else {
        DB.load().forEach(function (g) { (g.guide.vocab.gems || []).forEach(function (it) { push(it, g.title, false); }); });
        KB.loadExtra().gems.forEach(function (it) { push(it, "手动添加", true); });
      }
      return list.sort(function (a, b) { return b.count - a.count; });
    },
    addExtra: function (cat, item) {
      var extra = this.loadExtra();
      extra[cat].push(item);
      this.saveExtra(extra);
    },
    removeExtra: function (cat, index) {
      var extra = this.loadExtra();
      extra[cat].splice(index, 1);
      this.saveExtra(extra);
    }
  };

  /* ── AI 配置 ────────────────────────────── */
  var CFG = {
    presets: {
      kimi:  { baseUrl: "https://api.moonshot.cn/v1/chat/completions", model: "kimi-k2-0905-preview", label: "Kimi (Moonshot)" },
      glm:   { baseUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions", model: "glm-4.6", label: "智谱 GLM" },
      custom:{ baseUrl: "", model: "", label: "自定义 (OpenAI 兼容)" }
    },
    load: function () {
      return lsGet(LS_CFG) || { preset: "kimi", baseUrl: this.presets.kimi.baseUrl, apiKey: "", model: this.presets.kimi.model };
    },
    save: function (cfg) { localStorage.setItem(LS_CFG, JSON.stringify(cfg)); }
  };

  /* ── 工具 ───────────────────────────────── */
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function toast(msg, isErr) {
    var t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.className = "toast show" + (isErr ? " err" : "");
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.className = "toast" + (isErr ? " err" : ""); }, 3200);
  }
  function overlay(show, msg) {
    var o = document.getElementById("overlay");
    if (!o) return;
    if (msg) o.querySelector(".msg").textContent = msg;
    o.className = "overlay" + (show ? " show" : "");
  }
  function slugify(text) {
    var s = (text || "").toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 48);
    return s || ("article-" + Date.now());
  }
  function vocabCount(g) {
    var v = (g.guide && g.guide.vocab) || {};
    return (v.concepts || []).length + (v.verbs || []).length + (v.insiders || []).length + (v.gems || []).length;
  }
  function downloadFile(name, text, mime) {
    var blob = new Blob([text], { type: mime || "application/octet-stream" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  window.ER = { DB: DB, KB: KB, CFG: CFG, esc: esc, toast: toast, overlay: overlay, slugify: slugify, vocabCount: vocabCount, downloadFile: downloadFile };

  /* ══════════════════════════════════════════
     index.html（目录页）逻辑
  ══════════════════════════════════════════ */
  if (document.body.dataset.page === "index") {

    function renderCatalog() {
      var list = DB.load();
      var box = document.getElementById("catalog");
      if (!list.length) {
        box.innerHTML = '<div class="empty">还没有文章。粘贴一篇《经济学人》文章，点击「AI 生成导读」开始学习 ✦</div>';
        return;
      }
      box.innerHTML = list.map(function (g) {
        var v = vocabCount(g);
        var tag = DB.isDraft(g.id)
          ? '<span class="chip" style="background:#eef3ff;color:#1d4ed8">本地草稿</span>'
          : '<span class="chip">线上发布</span>';
        return '<div class="art-card" data-id="' + esc(g.id) + '">' +
          '<div class="kicker">' + esc(g.source || "The Economist") + ' · ' + esc(g.date || "") + '</div>' +
          '<h3>' + esc(g.title) + '</h3>' +
          '<div class="sub">' + esc(g.subtitle || "") + '</div>' +
          '<div class="chips">' + tag +
          '<span class="chip">词汇 ' + v + ' 条</span>' +
          ((g.guide.questions || []).length ? '<span class="chip">思考题 ' + g.guide.questions.length + '</span>' : '') +
          ((g.guide.sentences || []).length ? '<span class="chip">长难句 ' + g.guide.sentences.length + '</span>' : '') +
          '</div>' +
          '<div class="meta"><span>' + (DB.isDraft(g.id) ? "未发布草稿" : "发布于 " + (g.addedAt || "").slice(0, 10)) + '</span><span>进入学习 →</span></div>' +
          '</div>';
      }).join("");
      box.querySelectorAll(".art-card").forEach(function (el) {
        el.addEventListener("click", function () { location.href = "reader.html?id=" + encodeURIComponent(el.dataset.id); });
      });
    }
    renderCatalog();

    document.getElementById("fileInput").addEventListener("change", function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () { document.getElementById("pasteBox").value = reader.result; toast("已读取文件：" + f.name); };
      reader.readAsText(f);
    });

    /* AI 设置 */
    var cfg = CFG.load();
    var els = {
      baseUrl: document.getElementById("cfgBase"), key: document.getElementById("cfgKey"),
      model: document.getElementById("cfgModel")
    };
    function fillCfg() {
      els.baseUrl.value = cfg.baseUrl; els.key.value = cfg.apiKey || ""; els.model.value = cfg.model;
      document.querySelectorAll(".preset-btn").forEach(function (b) {
        b.className = "btn preset-btn" + (b.dataset.preset === cfg.preset ? " active" : "");
      });
    }
    document.querySelectorAll(".preset-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = CFG.presets[b.dataset.preset];
        cfg.preset = b.dataset.preset; cfg.baseUrl = p.baseUrl; cfg.model = p.model;
        fillCfg();
      });
    });
    fillCfg();
    document.getElementById("saveCfg").addEventListener("click", function () {
      cfg.baseUrl = els.baseUrl.value.trim(); cfg.apiKey = els.key.value.trim(); cfg.model = els.model.value.trim();
      CFG.save(cfg); toast("设置已保存（仅存于本机浏览器）");
    });

    /* 生成导读 → 本地草稿 */
    document.getElementById("genBtn").addEventListener("click", async function () {
      var text = document.getElementById("pasteBox").value.trim();
      if (!text) { toast("请先粘贴或上传文章全文", true); return; }
      cfg.baseUrl = els.baseUrl.value.trim(); cfg.apiKey = els.key.value.trim(); cfg.model = els.model.value.trim();
      CFG.save(cfg);
      if (!cfg.apiKey) { toast("请先在下方填写 API Key", true); return; }
      overlay(true, "AI 正在精读文章并生成导读，约需 1 分钟……");
      try {
        var guide = await window.ERAI.generateGuide(text, cfg);
        guide.id = DB.uniqueId(guide.id);   // 与线上文章同名时自动加后缀
        DB.addDraft(guide);
        overlay(false);
        toast("已生成本地草稿 ✓ 进入学习页后可「导出本篇」用于发布");
        setTimeout(function () { location.href = "reader.html?id=" + encodeURIComponent(guide.id); }, 600);
      } catch (err) {
        overlay(false);
        toast("生成失败：" + err.message, true);
      }
    });

    /* 数据管理 */
    document.getElementById("exportBtn").addEventListener("click", function () {
      downloadFile("english-reading-backup-" + new Date().toISOString().slice(0, 10) + ".json", DB.exportAll(), "application/json");
      toast("已导出备份文件");
    });
    document.getElementById("importFile").addEventListener("change", function (e) {
      var f = e.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try { DB.importAll(r.result); renderCatalog(); toast("导入成功（草稿已合并，线上文章以仓库为准）"); }
        catch (err) { toast("导入失败：文件格式不正确", true); }
      };
      r.readAsText(f);
    });
  }

  /* ══════════════════════════════════════════
     knowledge.html（知识库）逻辑
  ══════════════════════════════════════════ */
  if (document.body.dataset.page === "knowledge") {
    var CAT_META = {
      concepts: { name: "核心概念词", cols: ["术语", "释义", "原文语境"] },
      verbs:    { name: "高级动词 / 动词短语", cols: ["表达", "含义", "原文例句（写作可仿写）"] },
      insiders: { name: "熟词僻义", cols: ["词", "常见义", "本文僻义"] },
      gems:     { name: "精妙小词", cols: ["词 / 表达", "用法妙处"] }
    };
    var curCat = "concepts", kw = "", srcFilter = "";

    function cell(row, cat, col) {
      if (cat === "concepts") return [row.term, row.meaning, row.context];
      if (cat === "verbs") return [row.expr, row.meaning, row.example];
      if (cat === "insiders") return [row.word, row.common, row.here];
      return [row.word, row.usage];
    }

    function render() {
      var meta = CAT_META[curCat];
      var rows = KB.aggregate(curCat);
      var sources = {};
      rows.forEach(function (r) { r.sources.forEach(function (s) { sources[s] = 1; }); });
      var srcSel = document.getElementById("kbSource");
      var cur = srcSel.value;
      srcSel.innerHTML = '<option value="">全部来源（' + Object.keys(sources).length + '）</option>' +
        Object.keys(sources).map(function (s) { return '<option' + (s === cur ? " selected" : "") + '>' + esc(s) + '</option>'; }).join("");

      rows = rows.filter(function (r) {
        if (srcFilter && r.sources.indexOf(srcFilter) < 0) return false;
        if (!kw) return true;
        return JSON.stringify(r).toLowerCase().indexOf(kw) >= 0;
      });

      document.querySelectorAll(".kb-tab").forEach(function (t) {
        t.querySelector(".cnt").textContent = KB.aggregate(t.dataset.cat).length;
      });

      document.getElementById("kbTitle").textContent = meta.name;
      var thead = '<tr>' + meta.cols.map(function (c, i) {
        return '<th' + (i === 0 ? ' style="width:22%"' : '') + '>' + c + '</th>';
      }).join("") + '<th style="width:15%">来源</th><th style="width:4%"></th></tr>';

      document.getElementById("kbTable").querySelector("thead").innerHTML = thead;
      document.getElementById("kbTable").querySelector("tbody").innerHTML =
        (rows.length ? rows.map(function (r, idx) {
          var cells = cell(r, curCat).map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("");
          var srcHtml = r.sources.map(function (s) { return "<div>" + esc(s) + (r.count > 1 ? " ×" + r.count : "") + "</div>"; }).join("");
          var del = r.manual ? '<button class="btn danger" data-del="' + idx + '" style="padding:2px 8px;font-size:12px">删</button>' : "";
          return "<tr>" + cells + '<td class="num-cell">' + srcHtml + '</td><td>' + del + "</td></tr>";
        }).join("") : '<tr><td colspan="6" style="text-align:center;color:#9aa1ab;padding:36px 0">暂无词条，去学习文章或手动添加</td></tr>');

      document.getElementById("kbTable").querySelectorAll("[data-del]").forEach(function (b) {
        b.addEventListener("click", function () {
          var extra = KB.loadExtra()[curCat];
          var label = cell(rows[+b.dataset.del], curCat)[0];
          var i = extra.findIndex(function (x) { return (x.term || x.expr || x.word) === label; });
          if (i >= 0) { KB.removeExtra(curCat, i); render(); toast("已删除手动词条"); }
        });
      });
      document.getElementById("kbCount").textContent = "共 " + rows.length + " 条";
    }

    document.querySelectorAll(".kb-tab").forEach(function (t) {
      t.addEventListener("click", function () {
        document.querySelectorAll(".kb-tab").forEach(function (x) { x.classList.remove("active"); });
        t.classList.add("active"); curCat = t.dataset.cat; render();
      });
    });
    document.getElementById("kbSearch").addEventListener("input", function () { kw = this.value.toLowerCase().trim(); render(); });
    document.getElementById("kbSource").addEventListener("change", function () { srcFilter = this.value; render(); });

    document.getElementById("kbAddBtn").addEventListener("click", function () {
      var meta = CAT_META[curCat];
      var a = prompt(meta.cols[0] + "（必填）："); if (!a) return;
      var b = prompt(meta.cols[1] + "：") || "";
      var c = meta.cols[2] ? (prompt(meta.cols[2] + "：") || "") : "";
      var item;
      if (curCat === "concepts") item = { term: a, meaning: b, context: c };
      else if (curCat === "verbs") item = { expr: a, meaning: b, example: c };
      else if (curCat === "insiders") item = { word: a, common: b, here: c };
      else item = { word: a, usage: b };
      KB.addExtra(curCat, item); render(); toast("已加入知识库");
    });

    render();
  }
})();
