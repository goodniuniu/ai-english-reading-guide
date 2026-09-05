# 新增文章处理流程规范（SOP）

> **适用对象**：任何接手本项目的 AI 助手或维护者。
> **目的**：用户会**不定时粘贴**一篇《经济学人》原文（通常自带词汇批注、理解题等素材），
> 处理后按本流程入库并发布到 GitHub Pages，供所有访客学习。
> **原则**：每一步都有验证，不带病上线；导读深度对齐《导读指引.md.txt》样例基准。

---

## 一、流程总览

```
用户粘贴原文素材
   ↓
① 解析素材（全文/批注/题目/词族 → 映射到导读字段）
   ↓
② 撰写 content/<id>.json（schema 见第三节，深度基准见第四节）
   ↓
③ node build.js（编译为 assets/articles.js）+ 数据校验
   ↓
④ jsdom 冒烟测试（24 项，全过才继续）
   ↓
⑤ git commit + SSH push
   ↓
⑥ 线上验证（Pages 构建状态 + 下载线上 articles.js 核对）
   ↓
⑦ 写工作日志（.workbuddy/memory/YYYY-MM-DD.md 追加）
```

一条命令提交推送可直接用 `./publish.sh`（build + commit + push 一体）。

---

## 二、Step 1 · 接收与解析用户素材

用户粘贴的素材通常包含以下部分，**全部要利用，不得丢弃**：

| 素材形态 | 去向（schema 字段） |
|---|---|
| 正文（可能带 ①②③ 段落标记） | `text`（**剥离所有标记、批注、中文翻译**，只留干净英文原文） |
| 词汇批注（音标+释义） | `guide.vocab.concepts / verbs / insiders / gems` 按性质归类 |
| Reading Comprehension 选择题 | `guide.questions`（转为 q/hint/answer 格式：题干含选项，hint 指明定位段落，answer 给答案+完整解释） |
| Key Expressions（短语+例句） | `guide.vocab.verbs`（例句放入 `example` 字段） |
| Word Family Trees（词根词族） | 融入对应 `verbs` 词条的 `meaning`（标注"词族：xxx / xxx"），信息不得丢失 |

**解析红线**：
- 英文原文必须逐字保留，只删批注和中文对照，不擅自改写。
- 正文中的引号统一为 `\"` 转义（JSON 内）。
- id 用英文短横线 slug（如 `chinese-barbecue-battle`），全局唯一。

---

## 三、Step 2 · 撰写导读 JSON（数据 schema）

文件：`content/<id>.json`，UTF-8，无 BOM。顶层与 `guide` 字段结构如下
（可直接参照 `content/chinese-barbecue-battle.json` 或 `content/internal-locus-of-control.json`）：

```jsonc
{
  "id": "english-slug",                    // 唯一 slug
  "title": "英文原标题",
  "subtitle": "英文副标题（无则自拟一句概括）",
  "source": "The Economist",
  "date": "Sep 3rd 2026",                  // 原文发表日期
  "addedAt": "2026-09-05",                 // 入库日期 YYYY-MM-DD
  "text": "完整英文正文，段落间 \\n\\n 分隔",
  "guide": {
    "background": "150-250 字中文背景导读：文体判断、主题、整体结构、文风特点",
    "strategy": "60-90 秒预读策略建议（自上而下阅读法等）",
    "structure": [                         // 7-9 个骨架节点
      { "stage": "阶段名", "desc": "该段在讲什么（含关键数据/修辞）" }
    ],
    "questions": [                         // 5 道题
      { "q": "题目（选择题含 A-D 选项，用全角空格分隔）",
        "hint": "定位提示（指向具体段落/信号词）",
        "answer": "答案+完整论证（为什么对、为什么其余错）" }
    ],
    "sentences": [                         // 3 个长难句
      { "text": "原句（逐字摘自 text）",
        "parse": "结构拆解（缩进树状图示：主干→从句→修饰）",
        "note": "阅读技巧 + 写作仿写点（句式模板）" }
    ],
    "vocab": {
      "concepts": [ { "term": "...", "meaning": "中文释义（含学科背景）", "context": "原文语境短语" } ],   // 6-8 条
      "verbs":    [ { "expr": "...", "meaning": "释义（可含词根词族）", "example": "原文例句 → 仿写例句" } ], // 8-10 条，写作复用主战场
      "insiders": [ { "word": "...", "common": "常见义", "here": "本文僻义+语境" } ],                        // 4-7 条，重点挖双关
      "gems":     [ { "word": "...", "usage": "用法妙处+原文短语" } ]                                       // 6-8 条
    }
  }
}
```

**硬性要求**：
1. 所有字段**禁止包含任何 HTML 标签**（`<span>`、`<b>` 等）——系统有净化层但不要依赖它，
   写入前自查（见 Step 3 校验脚本）。
2. `questions` 固定 5 道（用户给了 3 道 MCQ 就自补 2 道分析题：双关词、作者笔法、结构手法是好的出题点）。
3. `sentences.text` 必须能在 `text` 中原样找到（渲染层有原文对照）。

---

## 四、内容深度基准（对齐《导读指引.md.txt》样例）

- `background`：点明文体（《经济学人》议论文/特写）+ 核心概念 + 论证推进方式 + 文风。
- `structure.desc`：每节点 20-40 字，含**具体证据**（数据、实验、修辞），不写空话。
- `questions.answer`：不只给答案，要给**完整论证链**，选择题逐一排除错误选项。
- `sentences.parse`：树状缩进图示，主干与修饰层级分明（参考已有两篇的排版风格）。
- `sentences.note`：必须落到「写作可复用」——给出可套用的句式模板。
- `insiders`：优先挖全文的双关与文字游戏（如 beef＝牛肉/争执、cut＝切块/份额）。
- `verbs.example`：格式统一为「原文例句 → 仿写例句」，仿写句换全新场景。

---

## 五、Step 3 · 构建与数据校验

```bash
cd "E:\MyOutput\MyOutput\AI_Project\专项工作-AI指导英语阅读"
node build.js
```

预期输出：`✔ 已生成 assets/articles.js，共 N 篇`（N = content/ 下 json 数）。

随后执行数据校验（一段 node -e 即可）：

```js
const a = require('./content/<id>.json');
// 1. 结构完整：structure 7-9 / questions 5 / sentences 3 / vocab 四类达标
// 2. 无 HTML 标签：/<(span|div|b|i|em|strong)\b/i.test(JSON.stringify(a)) === false
// 3. sentences.text 均能被 a.text 包含
// 4. 正文词数 sanity check（300-700 词区间）
```

任何一项不过 → 回 Step 2 修正，**不得跳过**。

---

## 六、Step 4 · 冒烟测试（jsdom）

```bash
cd "C:/Users/user/.workbuddy/binaries/node/workspace"
NODE_PATH="C:/Users/user/.workbuddy/binaries/node/workspace/node_modules" \
  "C:/Users/user/.workbuddy/binaries/node/versions/22.22.2-2/node.exe" smoke.js
```

- 预期 `ALL SMOKE TESTS PASSED`（24 项：目录渲染、reader 五区块、净化、知识库聚合等）。
- ⚠️ 测试断言已改为**动态统计**（篇数=STATIC_ARTICLES.length、聚合行数=各篇 concepts 之和），
  新增文章不应再出现"篇数不符"失败；若出现，先怀疑 articles.js 未重新 build。
- jsdom 未安装时：`npm install jsdom --prefix C:/Users/user/.workbuddy/binaries/node/workspace`。

---

## 七、Step 5 · 提交与推送（SSH，已免凭据）

```bash
cd "E:\MyOutput\MyOutput\AI_Project\专项工作-AI指导英语阅读"
git add -A && git commit -m "feat: add article '<title>'"
git push origin main        # SSH 直推，无凭据交互；或直接 ./publish.sh
```

**环境 quirks（必须知道，否则会重复踩坑）**：

| 坑 | 说明与对策 |
|---|---|
| 本地代理 | 大陆网络直连 github.com 不通；本机可用代理为 **127.0.0.1:7897**（env 里的 50312 已失效）。git 推送走 SSH 已在 `~/.ssh/config` 配好（ssh.github.com:443 + connect.exe 经 7897），无需再设。 |
| gh CLI 配置 | 所有 `gh` 命令必须带 `GH_CONFIG_DIR="E:/c/Users/user/.ghconfig"`（注意：凭据实际落在 **E 盘字面路径** `E:\c\Users\user\.ghconfig\`，是 MSYS 路径转换的历史产物，勿"修复"它）。 |
| 沙箱限制 | 本沙箱禁止写 `C:\Users\user\.config\gh\`；git/gh/curl 涉网命令需声明 `dangerouslyDisableSandbox: true`。 |
| curl 验证 | 验证线上站点必须加 `-x http://127.0.0.1:7897`，否则大陆直连 github.io 超时。 |
| SSH 密钥 | `~/.ssh/id_ed25519` 已注册到 goodniuniu 账号；`ssh -T git@github.com` 应返回 `Hi goodniuniu!`。换机器才需重新配置。 |
| 文件编辑 | **对同一文件的多个 Edit 调用必须逐个顺序执行**——并行调用会基于同一旧版本互相覆盖。 |

---

## 八、Step 6 · 线上验证（三层确认，缺一不可）

```bash
# 1. 远端 commit 已到位
GH_CONFIG_DIR="E:/c/Users/user/.ghconfig" gh api \
  repos/goodniuniu/ai-english-reading-guide/commits/main --jq '.sha[0:7]'

# 2. Pages 构建状态（等 60 秒左右再查）
GH_CONFIG_DIR="E:/c/Users/user/.ghconfig" gh api \
  repos/goodniuniu/ai-english-reading-guide/pages/builds/latest \
  --jq '{status: .status, commit: .commit[0:7]}'
# 预期 {"status":"built","commit":"<刚推的 sha 前 7 位>"}

# 3. 下载线上 articles.js 核对新文章数据完整（经代理）
curl -s -x http://127.0.0.1:7897 \
  https://goodniuniu.github.io/ai-english-reading-guide/assets/articles.js \
  -o /tmp/online.js
node -e "global.window={};require('/tmp/online.js');/* 核对新文章存在且字段完整 */"
```

站点地址：https://goodniuniu.github.io/ai-english-reading-guide/
仓库地址：https://github.com/goodniuniu/ai-english-reading-guide

---

## 九、Step 7 · 工作日志

在 `.workbuddy/memory/YYYY-MM-DD.md` **追加**（该目录 append-only）：
- 文章标题、id、commit sha、导读各模块条数；
- 遇到的坑与解法（若为首次出现）；
- 该目录与 `MEMORY.md` 均在 `.gitignore` 中，不会进公开仓库。

---

## 十、发布前检查清单（逐项打勾）

- [ ] 英文正文逐字保留、无批注残留、id 唯一
- [ ] JSON 无 HTML 标签、无尾逗号、UTF-8
- [ ] questions 恰 5 道（MCQ 已转 q/hint/answer，用户素材信息无丢失）
- [ ] Key Expressions → verbs，Word Families → verbs.meaning 融入
- [ ] build.js 输出篇数正确
- [ ] 冒烟测试全过
- [ ] push 后 Pages status=built 且 commit 一致
- [ ] 线上 articles.js 含新文章
- [ ] 工作日志已追加

## 十一、故障速查

| 现象 | 处置 |
|---|---|
| push 无输出挂起 | 检查是否误用 HTTPS remote（应 git@github.com）；SSH config 是否在 `~/.ssh/config` |
| Pages status 仍 building | 再等 60 秒重查；超 5 分钟查 `pages/builds` 列表找错误 |
| 线上内容未更新但 status=built | 确认 commit sha 一致；提醒用户 Ctrl+F5 强刷 |
| 词汇表出现 `<span...>` 文本 | 数据带标签入库了：修 JSON → 重新 build → push（渲染层净化只是兜底） |
| 冒烟测试"篇数不符"失败 | 忘了跑 build.js 或 content/ 有孤儿 json |

## 十二、用户偏好（撰写导读时遵循）

- 语言：回复与导读用简体中文，保留英文术语原文。
- 风格：结构化、注重表格美观、关键信息突出；内容深度宁深勿浅。
- 数据自洽：用户重视数据一致性核对（如数字前后呼应、来源可溯），导读中的数据引用须与原文一致。
