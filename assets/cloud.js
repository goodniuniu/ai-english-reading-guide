/* AI 指导英语阅读 · 云端数据层（多用户）
   第三轨数据模型：Supabase（Auth + Postgres + RLS）
   - 未登录：行为与纯本地版完全一致（localStorage 草稿轨），本模块全部静默跳过。
   - 登录后：我的文章与知识库自动同步到云端；他人 visibility=public 的文章进入我的目录。
   - localStorage 继续作为云端数据的本地缓存，页面先渲染缓存、后台同步后重绘。
   依赖：assets/vendor/supabase.min.js（须先加载）。
*/
(function () {
  "use strict";

  var SUPABASE_URL = "https://pslsoywzwjtyhjkswptp.supabase.co";
  var SUPABASE_KEY = "sb_publishable_JbxcJ2gzmY-JniO6DObacQ_FGo8ISgO";

  var LS_GUIDES = "er_guides_drafts";
  var LS_KB_EXTRA = "er_kb_extra";

  function lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; }
  }
  function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise(function (_, rej) { setTimeout(function () { rej(new Error((label || "网络请求") + "超时")); }, ms); })
    ]);
  }

  var client = null;
  var me = null;          // 当前登录用户对象（含 id/email），未登录为 null
  var synced = false;

  var CLOUD = {
    configured: false,
    user: function () { return me; },
    loggedIn: function () { return !!me; }
  };

  if (!window.supabase || !SUPABASE_URL || !SUPABASE_KEY) {
    CLOUD.init = function () { return Promise.resolve(false); };
    window.ERCLOUD = CLOUD;
    return;
  }

  try {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    CLOUD.configured = true;
  } catch (e) {
    CLOUD.init = function () { return Promise.resolve(false); };
    window.ERCLOUD = CLOUD;
    return;
  }

  /* ── 认证 ─────────────────────────────── */
  CLOUD.signUp = function (email, password) {
    return withTimeout(client.auth.signUp({ email: email, password: password }), 15000, "注册")
      .then(function (r) {
        if (r.error) throw r.error;
        if (r.data && r.data.user && !r.data.session) {
          var err = new Error("注册成功，但项目开启了邮箱确认——请先到邮箱点确认链接，再回来登录");
          err.needConfirm = true; throw err;
        }
        me = r.data.user;
        return me;
      });
  };
  CLOUD.signIn = function (email, password) {
    return withTimeout(client.auth.signInWithPassword({ email: email, password: password }), 15000, "登录")
      .then(function (r) {
        if (r.error) throw r.error;
        me = r.data.user;
        return me;
      });
  };
  CLOUD.signOut = function () {
    return client.auth.signOut().then(function () { me = null; synced = false; });
  };

  /* ── 文章读写 ─────────────────────────── */
  /* 上传/更新我的一篇文章（slug = guide.id，payload 剥离内部标记） */
  CLOUD.saveArticle = function (guide, visibility) {
    if (!me) return Promise.reject(new Error("未登录"));
    var payload = {};
    Object.keys(guide).forEach(function (k) { if (k.charAt(0) !== "_") payload[k] = guide[k]; });
    var row = {
      owner: me.id, slug: guide.id,
      visibility: visibility || guide._visibility || "private",
      payload: payload, updated_at: new Date().toISOString()
    };
    return withTimeout(
      client.from("articles").upsert(row, { onConflict: "owner,slug" }).select("id"),
      20000, "保存到云端"
    ).then(function (r) {
      if (r.error) throw r.error;
      guide._cloud = true;
      guide._mine = true;
      guide._visibility = row.visibility;
      if (r.data && r.data[0]) guide._cid = r.data[0].id;
      return guide;
    });
  };

  CLOUD.setVisibility = function (guide, visibility) {
    if (!me || !guide._cid) return Promise.reject(new Error("文章尚未同步到云端"));
    return withTimeout(
      client.from("articles").update({ visibility: visibility, updated_at: new Date().toISOString() }).eq("id", guide._cid),
      15000, "更新可见性"
    ).then(function (r) {
      if (r.error) throw r.error;
      guide._visibility = visibility;
      return guide;
    });
  };

  CLOUD.removeArticle = function (guide) {
    if (!me || !guide._cid) return Promise.resolve();
    return withTimeout(client.from("articles").delete().eq("id", guide._cid), 15000, "删除云端文章")
      .then(function (r) { if (r.error) throw r.error; });
  };

  /* ── 知识库手动条目读写 ────────────────── */
  CLOUD.pushKb = function (data) {
    if (!me) return Promise.resolve();
    return withTimeout(
      client.from("kb_extra").upsert({ owner: me.id, data: data, updated_at: new Date().toISOString() }),
      15000, "同步知识库"
    ).then(function (r) { if (r.error) throw r.error; });
  };

  /* ── 全量同步：登录后调用一次 ────────────
     1) 本地未上云的草稿 → 自动上传为私密文章
     2) 拉取「我的 + 所有人公开的」文章，重建本地缓存
     3) 知识库：云端有则以云端为准；云端无而本地有 → 上传（首次登录迁移） */
  CLOUD.sync = function () {
    if (!me) return Promise.resolve(false);
    var staticIds = {};
    ((window.STATIC_ARTICLES || [])).forEach(function (g) { staticIds[g.id] = 1; });

    var local = (lsGet(LS_GUIDES) || []).filter(function (g) { return g && g.id && !staticIds[g.id]; });

    /* 1. 本地草稿上云（串行，量小） */
    var pushChain = Promise.resolve();
    local.forEach(function (g) {
      if (g._cloud) return;
      pushChain = pushChain.then(function () {
        return CLOUD.saveArticle(g, "private").catch(function () { /* 网络失败则保留本地，下次再试 */ });
      });
    });

    return pushChain.then(function () {
      /* 2. 拉取云端文章 */
      return withTimeout(Promise.all([
        client.from("articles").select("*").eq("owner", me.id),
        client.from("articles").select("*").eq("visibility", "public")
      ]), 20000, "拉取云端文章");
    }).then(function (rs) {
      var mine = rs[0], pub = rs[1];
      if (mine.error) throw mine.error;
      if (pub.error) throw pub.error;
      var rows = {}, ordered = [];
      (mine.data || []).concat(pub.data || []).forEach(function (row) {
        if (!rows[row.id]) { rows[row.id] = row; ordered.push(row); }
      });
      var used = {};
      Object.keys(staticIds).forEach(function (k) { used[k] = 1; });
      var guides = ordered.map(function (row) {
        var g = row.payload || {};
        g._cloud = true; g._cid = row.id;
        g._visibility = row.visibility;
        g._mine = (row.owner === me.id);
        /* 不同用户可能用了相同 slug：与已用 id 冲突时追加属主短码 */
        var id = row.slug;
        if (used[id]) id = row.slug + "--" + String(row.owner).slice(0, 6);
        used[id] = 1;
        g.id = id;
        return g;
      });
      lsSet(LS_GUIDES, guides);

      /* 3. 知识库同步 */
      return withTimeout(client.from("kb_extra").select("data").eq("owner", me.id).maybeSingle(), 15000, "拉取知识库")
        .then(function (kr) {
          if (kr.error) throw kr.error;
          var localKb = lsGet(LS_KB_EXTRA);
          var localHas = localKb && ["concepts", "verbs", "insiders", "gems"].some(function (c) {
            return Array.isArray(localKb[c]) && localKb[c].length;
          });
          if (kr.data && kr.data.data) {
            lsSet(LS_KB_EXTRA, kr.data.data);
          } else if (localHas) {
            return CLOUD.pushKb(localKb).catch(function () {});
          }
        });
    }).then(function () { synced = true; return true; })
      .catch(function () { return synced; });
  };

  /* ── 初始化：恢复会话 + 首次同步（带总超时，失败不阻塞页面） ── */
  CLOUD.init = function () {
    return withTimeout(client.auth.getSession(), 8000, "恢复登录状态")
      .then(function (r) {
        me = (r.data && r.data.session && r.data.session.user) || null;
        if (!me) return false;
        return CLOUD.sync();
      })
      .catch(function () { return false; });
  };

  window.ERCLOUD = CLOUD;
})();
