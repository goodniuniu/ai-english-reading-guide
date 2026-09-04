/* 发布构建脚本
   作用：把 content/*.json（每篇一文件的导读数据）汇总为 assets/articles.js
        （即线上文章库，随仓库推送，所有访客在 GitHub Pages 上读到它）。
   用法：node build.js
   维护习惯：新增/修改文章 → 把 json 放进 content/ → 重跑本脚本 → git 提交推送。
*/
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DIR = path.join(ROOT, "content");
const OUT = path.join(ROOT, "assets", "articles.js");

if (!fs.existsSync(DIR)) { console.error("缺少 content/ 目录"); process.exit(1); }

const files = fs.readdirSync(DIR).filter(f => f.endsWith(".json")).sort();
const list = files.map(f => {
  const g = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
  if (!g || !g.id || !g.title || !g.guide) {
    console.error("格式异常，已跳过：" + f); return null;
  }
  return g;
}).filter(Boolean);

const code = "/* 由 build.js 自动生成：content/*.json → 线上文章库。请勿手工编辑。 */\n"
  + "window.STATIC_ARTICLES = " + JSON.stringify(list, null, 1) + ";\n";

fs.writeFileSync(OUT, code, "utf8");
console.log("✔ 已生成 assets/articles.js，共 " + list.length + " 篇：");
list.forEach(g => console.log("  - " + g.id + "  《" + g.title + "》"));
