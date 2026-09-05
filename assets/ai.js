/* AI 导读生成模块：调用 OpenAI 兼容 API（Kimi / GLM / 自定义），返回严格结构的导读 JSON */
(function () {
  "use strict";

  /* Prompt 模板：以《导读指引》样例的深度为基准 */
  var SYSTEM_PROMPT = `你是一位精通《经济学人》精读教学的英语导师。用户会给你一篇《经济学人》文章，请像"手术刀式"拆解一样生成导读，并只输出一个 JSON 对象（不要输出任何解释、markdown 代码块标记或其他文字）。

JSON 结构要求（字段名必须完全一致）：
{
  "title": "文章英文标题",
  "subtitle": "文章副标题或说明行（如无则空字符串）",
  "source": "The Economist",
  "date": "文章日期（如 Aug 27th 2026，找不到则空字符串）",
  "guide": {
    "background": "150-250字中文：文章背景（话题缘起、涉及的人物/机构/研究）、文体判断，说明为什么值得一读",
    "strategy": "50-80字中文：针对本文的具体阅读策略建议（如先读每段首尾句抓骨架等）",
    "structure": [ {"stage": "骨架阶段名（如：引子 / 论点1·个人层面 / 转折 / 结论）", "desc": "30-50字中文描述该阶段内容与写法"} ],
    "questions": [ {"q": "中文阅读理解或批判性思考问题（4-6个，覆盖主旨、论据细节、作者态度、笔法）", "hint": "40字内的思考提示，不给答案", "answer": "100-150字中文参考答案，含原文依据"} ],
    "sentences": [ {"text": "原文句子（一字不差）", "parse": "用纯文本+缩进+箭头分层拆解句子结构（主谓宾、从句、修饰），像树状图一样缩进对齐", "note": "阅读技巧或写作仿写点，80字内中文"} ],
    "vocab": {
      "concepts": [ {"term": "核心概念词", "meaning": "中文释义（含学科背景如心理学/经济学概念）", "context": "原文语境短语"} ],
      "verbs": [ {"expr": "高级动词或动词短语", "meaning": "中文含义", "example": "原文例句片段（供写作仿写）"} ],
      "insiders": [ {"word": "熟词僻义的词", "common": "常见义", "here": "本文中的僻义/比喻用法"} ],
      "gems": [ {"word": "精妙小词或表达", "usage": "妙在哪里，30字内中文"} ]
    }
  }
}

内容要求：
1. structure 6-9 项，必须呈现全文论证骨架的推进（引子→论点→转折→结论）；
2. questions 至少 4 个，必须包含：主旨问题、细节论据问题、作者态度/笔法问题；
3. sentences 恰好 3 句：优先选 定义对比句、含多个从句的长难句、体现让步-转折等笔法的句子；
4. concepts 6-8 个、verbs 6-9 个（必须是值得写作复用的正式表达）、insiders 3-5 个、gems 3-5 个；
5. 所有释义和解析用简体中文，例句保留英文原文；
6. 只输出 JSON，第一个字符必须是 {`;

  function extractJson(raw) {
    var s = raw.trim();
    // 剥掉可能的 ```json 包裹
    var m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) s = m[1].trim();
    // 截取第一个 { 到最后一个 }
    var a = s.indexOf("{"), b = s.lastIndexOf("}");
    if (a < 0 || b <= a) throw new Error("AI 未返回 JSON");
    return JSON.parse(s.slice(a, b + 1));
  }

  function normalize(data, fullText) {
    if (!data || !data.guide) throw new Error("AI 返回缺少 guide 字段");
    var g = data.guide;
    g.structure = g.structure || [];
    g.questions = g.questions || [];
    g.sentences = g.sentences || [];
    g.vocab = g.vocab || {};
    ["concepts", "verbs", "insiders", "gems"].forEach(function (k) { g.vocab[k] = g.vocab[k] || []; });
    if (!g.questions.length || !g.sentences.length) throw new Error("AI 返回的题目或长难句为空，请重试");
    return {
      id: window.ER.slugify(data.title || ""),
      title: data.title || "未命名文章",
      subtitle: data.subtitle || "",
      source: data.source || "The Economist",
      date: data.date || "",
      addedAt: new Date().toISOString(),
      text: fullText,
      guide: g
    };
  }

  async function callApi(text, cfg) {
    var body = {
      model: cfg.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "请为下面这篇《经济学人》文章生成导读 JSON：\n\n" + text }
      ],
      temperature: 0.3,
      max_tokens: 8000
    };
    var resp = await fetch(cfg.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + cfg.apiKey },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      var detail = "";
      try { detail = (await resp.json()).error && (await resp.json()).error.message || ""; } catch (e) {}
      throw new Error("API " + resp.status + (detail ? "：" + detail : "（请检查 Key、Base URL 与模型名）"));
    }
    var data = await resp.json();
    var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) throw new Error("API 返回内容为空");
    return content;
  }

  async function generateGuide(text, cfg) {
    var raw, parsed = null, lastErr = null;
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        raw = await callApi(text, cfg);
        parsed = extractJson(raw);
        return normalize(window.ER.deepClean(parsed), text);
      } catch (e) {
        lastErr = e;
        // JSON 截断等解析错误时重试一次
        if (attempt === 0 && (e instanceof SyntaxError || /JSON/.test(e.message))) continue;
        throw e;
      }
    }
    throw lastErr;
  }

  window.ERAI = { generateGuide: generateGuide, extractJson: extractJson, normalize: normalize };
})();
