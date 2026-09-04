# AI 指导英语阅读 · 项目整体规划

> 目标：随时粘贴或上传一篇《经济学人》文章，AI 自动生成"手术刀式"导读导学页面，进入目录即可学习；同时把每篇文章的精华词汇沉淀进四类可积累复用的知识库。

---

## 一、整体架构

```
专项工作-AI指导英语阅读/
├── index.html            # 主入口：文章目录 + 导入新文章 + AI 设置
├── reader.html           # 导读学习页（单页应用，?id=xx 加载对应文章）
├── knowledge.html        # 知识库总览（四类词汇，跨文章聚合）
├── PLAN.md               # 本规划文档
├── build.js              # 发布构建：content/*.json → assets/articles.js
├── publish.sh            # 一键发布：build + commit + push
├── content/              # 线上文章源文件（每篇一个 .json，随仓库发布）
│   └── internal-locus-of-control.json
├── assets/
│   ├── style.css         # 全站共享样式（浅色主题）
│   ├── app.js            # 数据层 + 目录/知识库页面逻辑
│   ├── reader.js         # 学习页渲染逻辑
│   ├── ai.js             # AI 生成模块（OpenAI 兼容 API 调用 + Prompt）
│   ├── seed.js           # 兜底样例（build 未运行时仍可体验）
│   └── articles.js       # 【自动生成】线上文章库（勿手改）
└── 导读指引.md.txt        # 原始样例（格式与内容深度的参照基准）
```

**技术选型**：纯前端（HTML + CSS + 原生 JS），零构建依赖。采用**双轨数据模型**：

| 轨 | 存放位置 | 谁可见 | 如何产生 |
|---|---|---|---|
| 线上文章（published） | 仓库 `content/*.json` → `build.js` 聚合为 `assets/articles.js` | **所有访客**（随 GitHub Pages 发布） | 创作者把草稿 json 放入 content 后推送 |
| 本地草稿（draft） | 创作者浏览器 localStorage | 仅创作者本机 | 页面内 AI 生成（BYOK） |

AI 通过 BYOK（Kimi / GLM 等 OpenAI 兼容 Key）在**创作者浏览器**调用；普通访客阅读线上内容**无需 Key**。

---

## 二、功能模块划分

### M1 文章目录（index.html）
- 卡片式目录：标题 / 副标题 / 日期 / 收录时间 / 词汇统计，点击进入学习页；
  卡片标注「线上发布」或「本地草稿」。
- 导入区：粘贴全文 或 上传 .txt 文件 → 一键"AI 生成导读"，结果先落为本地草稿。
- 设置面板：AI 服务商预设（Kimi / GLM / 自定义）、Base URL、API Key、模型名。
- 数据管理：导出/导入 JSON 备份（用于草稿迁移）+ 发布流程提示。

### M2 AI 导读生成（assets/ai.js）
- 内置 Prompt 模板，要求模型返回**严格 JSON**，字段与导读数据结构一一对应：
  文章背景、结构导读（阶段化骨架）、阅读理解问题（含提示与参考答案）、
  三个长难句解析、四类词汇表。
- 生成前校验 JSON Schema；失败自动重试一次；文章正文本地保存，
  不重复发送历史内容（每次只处理当前一篇，省 token）。
- 兜底：未配置 API 时可手动粘贴 JSON 导入；无 API 也能学习线上内容。

### M2.5 发布管线（build.js / publish.sh / content/）
- 创作者导出草稿为 `content/<id>.json` → 运行 `node build.js`（或 `./publish.sh`
  一键 build+commit+push）→ GitHub Pages 自动更新 → 所有访客可见。
- 每篇一文件、自包含，便于版本管理与逐篇增删。

### M3 导读学习页（reader.html）
六个区块，严格对齐《导读指引》样例的深度：
1. **文章背景与结构导读**：写作背景、文体判断 + "文章 X 光片"（骨架流程图）+ 阅读策略提示。
2. **阅读理解与思考检查问题**：每题可折叠"提示"与"参考答案"，先想再看。
3. **三个长难句解析**：原句 → 分层拆解（主干/从句/修饰）→ 阅读技巧或写作仿写点。
4. **四类词汇表**：核心概念词 / 高级动词及动词短语 / 熟词僻义 / 精妙小词，
   每条附原文语境例句；一键跳转知识库查看全局沉淀。
5. **原文对照阅读**：正文按段落展示。
6. **角色化操作**：草稿可「导出本篇 JSON / 删除草稿」并显示发布指引；
   线上文章只读并提示修改需走 content/ + build；导航上一篇 / 下一篇 / 返回目录。

### M4 知识库（knowledge.html）
四类独立模块，**跨文章自动聚合 + 手动补充**：
| 模块 | 字段 | 复用定位 |
|---|---|---|
| 核心概念词 | 术语 / 释义 / 原文语境 | 阅读理解的地基（如 locus of control） |
| 高级动词及动词短语 | 表达 / 含义 / 原文例句 | **写作复用**主战场（如 bestow, exert control over） |
| 熟词僻义 | 词 / 常见义 / 本文僻义 | 破解"每个词都认识却读不懂" |
| 精妙小词 | 词 / 用法妙处 | 提升表达质感（如 guardrails, mantra） |
- 每条词条标注来源文章，可按来源筛选、全局搜索、手动增删（手动条目可删除，
  AI 沉淀条目在学习页管理）。
- 词条在多篇出现时自动合并并累计出现次数 → 天然的高频词优先级。

---

## 三、数据 / 知识库组织方式

**存储介质（双轨）**：
- 线上文章源 = 仓库 `content/*.json`（每篇一文件，发布真源）；
- 本地草稿/知识库手动词条/AI 配置 = localStorage（键 `er_guides_drafts` / `er_kb_extra` / `er_api_cfg`）；
- 构建产物 `assets/articles.js` = `window.STATIC_ARTICLES`，随仓库发布，页面启动时加载。
单篇导读是一个自包含 JSON，正文与解析放一起，便于导出/迁移/单篇分享。
Schema（AI 输出即此格式）：
```jsonc
{
  "id": "internal-locus-of-control",        // slug，唯一
  "title": "The quality you should most wish for your children",
  "subtitle": "The benefits of having an internal locus of control",
  "source": "The Economist",
  "date": "Aug 27th 2026",
  "addedAt": "2026-09-04",
  "text": "……全文……",
  "guide": {
    "background": "……",
    "strategy": "……阅读策略……",
    "structure": [ { "stage": "引子", "desc": "设问 → 给出答案 → 定义概念" }, … ],
    "questions": [ { "q": "…", "hint": "…", "answer": "…" }, … ],
    "sentences": [ { "text": "…", "parse": "分层拆解文本", "note": "技巧/仿写点" }, … ],
    "vocab": {
      "concepts": [ { "term": "locus of control", "meaning": "控制点", "context": "全文主题" } ],
      "verbs":    [ { "expr": "bestow", "meaning": "赋予（正式）", "example": "bestow any quality on your children" } ],
      "insiders": [ { "word": "internal", "common": "内部的", "here": "n. 内控型的人" } ],
      "gems":     [ { "word": "guardrails", "usage": "（比喻）约束机制、底线" } ]
    }
  }
}
```

- AI 输出即此 Schema → 零转换直接入库。
- 知识库 = 遍历所有 `guide.vocab` 聚合 + `er_kb_extra`（手动条目，含 `source: "手动添加"`）。

---

## 四、页面交互流程

```
【创作者 · 本地（生成一篇）】
粘贴/上传《经济学人》原文 → 浏览器调 AI（创作者自己的 Key）生成导读（约1分钟）
     → 存为「本地草稿」→ 学习页审查：可改、可删、可导出
【创作者 · 发布（固化一篇）】
学习页点「⬇ 导出本篇 JSON」→ 存到 content/<id>.json
     → 运行 node build.js（聚合 content/*.json → assets/articles.js）
     → git commit && git push → GitHub Pages 约 1 分钟后更新
【访客 · 线上（阅读）】
打开 https://<用户>.github.io/<仓库>/ → 目录列出全部线上文章（无需 Key、无需生成）
     → 学习页：结构导读 → 带问题读原文 → 自测 → 长难句 → 词汇表
     → 词汇自动聚合进 knowledge.html（可搜索/按来源筛选/手动补充）
     → 写作时打开「高级动词」模块按例句仿写

【失败兜底】
未配 Key → 提示并引导设置；AI 返回 JSON 解析失败 → 自动重试一次；
线上未收录的文章 → 目录不显示（草稿仅本机可见）。
```

---

## 五、发布运维速查
1. 首次：GitHub 建仓库 → `git init`+首次提交 → Settings→Pages 选 main/root 分支部署。
2. 日常新增：导出 json 进 `content/` → 运行 `./publish.sh`（= build + commit + push）。
3. 下线/修改：直接编辑或删除 `content/<id>.json` → 重跑 `./publish.sh`。
4. 迁移草稿：首页「导出全部数据」→ 新电脑「导入备份」。
5. Kimi / GLM 均已实测允许浏览器跨域直连，线上页面可在线生成（仅创作者需要）。

---

## 六、扩展路线（后续可做）
1. 单篇导出为独立 HTML 分享。
2. 学习进度标记（已读/已掌握题数），目录显示进度条。
3. 词库抽查模式：知识库随机出题（看释义默写表达）。
4. 写作练习本：从"高级动词"里抽词造句，AI 批改。
5. 数据量大后迁移到 IndexedDB；多创作者协作则引入服务端/CI 发布。
6. 若需向访客隐藏创作者 Key，可加一层 Cloudflare Worker 代理（页面已支持自定义 API 地址）。
