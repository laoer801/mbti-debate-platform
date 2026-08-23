"use strict";

// src/data/pathAdviceRules.ts
function parsePathAdvice(raw) {
  const blockMatch = raw.match(/【路径建议】([\s\S]*?)(?=【[^】]+】|$)/);
  if (!blockMatch) return null;
  const block = blockMatch[1];
  const paths = [];
  const segments = block.split(/(?=路径[A-C]\s*[：:])/);
  for (const seg of segments) {
    const headMatch = seg.match(/路径([A-C])\s*[：:]\s*([^\n]+)/);
    if (!headMatch) continue;
    const name = headMatch[2].trim();
    if (!name) continue;
    const fitFor = extractField(seg, "\u9002\u5408");
    const pros = extractField(seg, "\u5229");
    const cons = extractField(seg, "\u5F0A");
    if (!fitFor && !pros && !cons) continue;
    paths.push({ name, fitFor: fitFor || "\u2014", pros: pros || "\u2014", cons: cons || "\u2014" });
  }
  const risksMatch = block.match(/风险提示\s*[：:]\s*([^\n]+)/);
  const risks = risksMatch ? risksMatch[1].trim() : "";
  const nextMatch = block.match(/建议下一步\s*[：:]\s*([^\n]+)/);
  const nextStep = nextMatch ? nextMatch[1].trim() : "";
  if (paths.length < 2) return null;
  return { paths, risks, nextStep };
}
function extractField(text, fieldName) {
  const re = new RegExp(`-\\s*${fieldName}\\s*[\uFF1A:]\\s*([^\\n]+)`);
  const m = text.match(re);
  return m ? m[1].trim() : "";
}
function extractAdviceFromResponse(raw) {
  const advice = parsePathAdvice(raw);
  if (!advice) {
    return { response: raw.trim(), advice: null };
  }
  const cleaned = raw.replace(/【路径建议】[\s\S]*?(?=【[^】]+】|$)/, "").trim();
  return { response: cleaned, advice };
}

// src/utils/llmClient.ts
var LLM_PROVIDERS = [
  { id: "deepseek", name: "DeepSeek", baseURL: "https://api.deepseek.com", model: "deepseek-chat" },
  { id: "openai", name: "OpenAI", baseURL: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { id: "qwen", name: "\u901A\u4E49\u5343\u95EE", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  { id: "siliconflow", name: "\u7845\u57FA\u6D41\u52A8", baseURL: "https://api.siliconflow.cn/v1", model: "deepseek-ai/DeepSeek-V3" }
];
var DEFAULT_CONFIG = {
  baseURL: LLM_PROVIDERS[0].baseURL,
  apiKey: "",
  model: LLM_PROVIDERS[0].model
};

// src/utils/debateReport.ts
function toReportSpeechesFromArena(history) {
  return history.map((s) => ({
    typeId: s.typeId,
    typeName: s.typeName,
    side: s.side,
    content: s.content,
    thinking: s.thinking
  }));
}
function toReportJudgeFromArena(judge) {
  return {
    scores: judge.scores,
    winner: judge.winner,
    verdict: judge.verdict,
    source: judge.source
  };
}
function toReportSpeechesFromMessages(messages) {
  return messages.filter((m) => !m.isUser && m.side && m.content).map((m) => ({
    typeId: m.typeId,
    typeName: m.typeName,
    side: m.side,
    content: m.content,
    thinking: m.thinking
  }));
}
function toReportStances(stances) {
  if (!stances || stances.length === 0) return void 0;
  return stances.map((s) => ({
    typeId: s.typeId,
    typeName: s.typeName,
    side: s.side,
    content: s.content
  }));
}
function fallbackReport(input) {
  const { topic, speeches, judge, stances } = input;
  const pro = speeches.filter((s) => s.side === "pro");
  const con = speeches.filter((s) => s.side === "con");
  const lines = [];
  lines.push(`# \u8FA9\u8BBA\u62A5\u544A\uFF1A${topic}`);
  lines.push("");
  lines.push("## \u8FA9\u8BBA\u6982\u89C8");
  lines.push(`- \u8FA9\u9898\uFF1A${topic}`);
  lines.push(`- \u6B63\u65B9\u53D1\u8A00\uFF1A${pro.length} \u6B21`);
  lines.push(`- \u53CD\u65B9\u53D1\u8A00\uFF1A${con.length} \u6B21`);
  lines.push(`- \u88C1\u5224\u6765\u6E90\uFF1A${judge?.source === "llm" ? "AI \u88C1\u5224" : "\u672C\u5730\u88C1\u5224"}`);
  lines.push("");
  if (stances && stances.length > 0) {
    lines.push("## \u7ACB\u573A\u5BA3\u8A00");
    for (const s of stances) {
      lines.push(`- **${s.typeName}**\uFF08${s.side === "pro" ? "\u6B63\u65B9" : "\u53CD\u65B9"}\uFF09\uFF1A${s.content}`);
    }
    lines.push("");
  }
  lines.push("## \u6B63\u65B9\u6838\u5FC3\u8BBA\u70B9");
  pro.forEach((s, i) => {
    lines.push(`- [${i + 1}] ${s.content.slice(0, 80)}${s.content.length > 80 ? "\u2026" : ""}`);
  });
  lines.push("");
  lines.push("## \u53CD\u65B9\u6838\u5FC3\u8BBA\u70B9");
  con.forEach((s, i) => {
    lines.push(`- [${i + 1}] ${s.content.slice(0, 80)}${s.content.length > 80 ? "\u2026" : ""}`);
  });
  lines.push("");
  lines.push("## \u4EA4\u950B\u7126\u70B9");
  lines.push("> \u672C\u5730\u6A21\u677F\u65E0\u6CD5\u81EA\u52A8\u63D0\u70BC\u4EA4\u950B\u7126\u70B9\uFF0C\u8BF7\u914D\u7F6E AI \u5927\u6A21\u578B\u4EE5\u83B7\u5F97\u6DF1\u5EA6\u5206\u6790\u3002");
  lines.push("");
  lines.push("## \u5171\u8BC6");
  lines.push("> \u672C\u5730\u6A21\u677F\u65E0\u6CD5\u81EA\u52A8\u63D0\u70BC\u5171\u8BC6\uFF0C\u8BF7\u914D\u7F6E AI \u5927\u6A21\u578B\u3002");
  lines.push("");
  lines.push("## \u5206\u6B67");
  lines.push("> \u672C\u5730\u6A21\u677F\u65E0\u6CD5\u81EA\u52A8\u63D0\u70BC\u5206\u6B67\uFF0C\u8BF7\u914D\u7F6E AI \u5927\u6A21\u578B\u3002");
  lines.push("");
  lines.push("## \u6298\u4E2D\u65B9\u6848");
  lines.push("> \u672C\u5730\u6A21\u677F\u65E0\u6CD5\u81EA\u52A8\u751F\u6210\u6298\u4E2D\u65B9\u6848\uFF0C\u8BF7\u914D\u7F6E AI \u5927\u6A21\u578B\u3002");
  lines.push("");
  lines.push("## \u88C1\u5224\u5224\u5B9A");
  if (judge) {
    lines.push("### \u5404\u7EF4\u5EA6\u8BC4\u5206");
    for (const s of judge.scores) {
      lines.push(`- **${s.name}**\uFF08${s.typeId}\uFF09\uFF1A\u903B\u8F91 ${s.logic} \xB7 \u8BBA\u636E ${s.evidence} \xB7 \u53CD\u9A73 ${s.rebuttal} \xB7 \u8868\u8FBE ${s.clarity} \xB7 \u98CE\u5EA6 ${s.demeanor} \xB7 \u603B\u5206 ${s.total}`);
      lines.push(`  - ${s.comment}`);
    }
    lines.push("");
    lines.push("### \u80DC\u65B9\u7406\u7531");
    lines.push(`- \u80DC\u65B9\uFF1A${judge.winner}`);
    lines.push(`- \u5224\u5B9A\uFF1A${judge.verdict}`);
  } else {
    lines.push("\uFF08\u672C\u573A\u65E0\u88C1\u5224\u7ED3\u679C\uFF09");
  }
  lines.push("");
  lines.push("## \u7F6E\u4FE1\u5EA6\u8BC4\u4F30");
  lines.push(`- \u53D1\u8A00\u8F6E\u6570\uFF1A\u6B63\u65B9 ${pro.length} \u6B21 / \u53CD\u65B9 ${con.length} \u6B21`);
  lines.push(`- \u62A5\u544A\u6765\u6E90\uFF1A\u672C\u5730\u6A21\u677F\uFF08\u672A\u8FDE\u63A5 AI\uFF0C\u5206\u6790\u6DF1\u5EA6\u6709\u9650\uFF09`);
  lines.push("- \u5EFA\u8BAE\uFF1A\u914D\u7F6E AI \u5927\u6A21\u578B\u540E\u91CD\u65B0\u751F\u6210\uFF0C\u53EF\u83B7\u5F97\u4EA4\u950B\u7126\u70B9\u3001\u5171\u8BC6\u5206\u6B67\u3001\u6298\u4E2D\u65B9\u6848\u7684\u6DF1\u5EA6\u5206\u6790");
  return lines.join("\n");
}

// src/utils/markdownLite.ts
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function inline(s) {
  let out = escapeHtml(s);
  out = out.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\[(\d+)\]/g, '<span class="md-cite">[$1]</span>');
  return out;
}
function renderMarkdownLite(md2) {
  if (!md2) return "";
  const lines = md2.replace(/\r\n/g, "\n").split("\n");
  const html2 = [];
  let i = 0;
  let listType = null;
  const closeList = () => {
    if (listType) {
      html2.push(`</${listType}>`);
      listType = null;
    }
  };
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "") {
      closeList();
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeList();
      html2.push('<hr class="md-hr" />');
      i++;
      continue;
    }
    const hMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (hMatch) {
      closeList();
      const level = hMatch[1].length;
      html2.push(`<h${level} class="md-h${level}">${inline(hMatch[2])}</h${level}>`);
      i++;
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      closeList();
      const quoteText = trimmed.replace(/^>\s?/, "");
      html2.push(`<blockquote class="md-quote">${inline(quoteText)}</blockquote>`);
      i++;
      continue;
    }
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      if (listType !== "ul") {
        closeList();
        html2.push('<ul class="md-ul">');
        listType = "ul";
      }
      html2.push(`<li>${inline(ulMatch[1])}</li>`);
      i++;
      continue;
    }
    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (listType !== "ol") {
        closeList();
        html2.push('<ol class="md-ol">');
        listType = "ol";
      }
      html2.push(`<li>${inline(olMatch[1])}</li>`);
      i++;
      continue;
    }
    closeList();
    const paraLines = [trimmed];
    i++;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (next === "") break;
      if (/^(#{1,3})\s+/.test(next)) break;
      if (/^[-*]\s+/.test(next)) break;
      if (/^\d+\.\s+/.test(next)) break;
      if (/^>\s?/.test(next)) break;
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(next)) break;
      paraLines.push(next);
      i++;
    }
    html2.push(`<p class="md-p">${inline(paraLines.join(" "))}</p>`);
  }
  closeList();
  return html2.join("\n");
}

// scripts/test-report-v33.ts
globalThis.localStorage = /* @__PURE__ */ (() => {
  const store = /* @__PURE__ */ new Map();
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    }
  };
})();
var pass = 0;
var fail = 0;
function check(label, ok, detail) {
  if (ok) {
    pass++;
    console.log(`  \u2705 ${label}`);
  } else {
    fail++;
    console.log(`  \u274C ${label}${detail ? ` \u2014\u2014 ${detail}` : ""}`);
  }
}
console.log("=".repeat(62));
console.log("v33 \u7EAF\u51FD\u6570\u6D4B\u8BD5\uFF1A\u8FA9\u8BBA\u62A5\u544A + \u4E13\u4E1A\u5EFA\u8BAE");
console.log("=".repeat(62));
console.log("\n\u{1F9ED} 1. parsePathAdvice \u8DEF\u5F84\u5EFA\u8BAE\u89E3\u6790");
var fullBlock = `\u6211\u7406\u89E3\u4F60\u7684\u7EA0\u7ED3\u3002\u6362\u5DE5\u4F5C\u786E\u5B9E\u662F\u4EBA\u751F\u5927\u4E8B\u3002

\u3010\u8DEF\u5F84\u5EFA\u8BAE\u3011
\u8DEF\u5F84A\uFF1A\u7A33\u59A5\u8FC7\u6E21
- \u9002\u5408\uFF1A\u624B\u5934\u7D27\u3001\u4E0D\u80FD\u65AD\u6536\u5165\u7684\u4EBA
- \u5229\uFF1A\u98CE\u9669\u6700\u5C0F\uFF0C\u9A91\u9A74\u627E\u9A6C
- \u5F0A\uFF1A\u53EF\u80FD\u9519\u8FC7\u5F53\u4E0B\u7684\u673A\u4F1A\u7A97\u53E3
\u8DEF\u5F84B\uFF1A\u6FC0\u8FDB\u8F6C\u8EAB
- \u9002\u5408\uFF1A\u6709\u79EF\u84C4\u3001\u5BF9\u65B0\u65B9\u5411\u5F88\u786E\u5B9A\u7684\u4EBA
- \u5229\uFF1A\u5168\u529B\u6295\u5165\u65B0\u8D5B\u9053\uFF0C\u6210\u957F\u66F4\u5FEB
- \u5F0A\uFF1A\u82E5\u5224\u65AD\u5931\u8BEF\uFF0C\u56DE\u4E0D\u4E86\u5934
\u8DEF\u5F84C\uFF1A\u6682\u7F13\u89C2\u5BDF
- \u9002\u5408\uFF1A\u8FD8\u6CA1\u60F3\u6E05\u695A\u3001\u4FE1\u606F\u4E0D\u8DB3\u7684\u4EBA
- \u5229\uFF1A\u4E0D\u6025\u4E8E\u884C\u52A8\uFF0C\u6536\u96C6\u66F4\u591A\u6570\u636E
- \u5F0A\uFF1A\u62D6\u5EF6\u672C\u8EAB\u5C31\u662F\u4E00\u79CD\u9009\u62E9\uFF0C\u7126\u8651\u4F1A\u7D2F\u79EF
\u98CE\u9669\u63D0\u793A\uFF1A\u4E09\u6761\u8DEF\u90FD\u6709\u673A\u4F1A\u6210\u672C\uFF0C\u5173\u952E\u662F\u5206\u6E05"\u5BB3\u6015\u6539\u53D8"\u548C"\u786E\u5B9E\u4E0D\u8BE5\u6539"\u3002
\u5EFA\u8BAE\u4E0B\u4E00\u6B65\uFF1A\u4ECA\u665A\u82B1 15 \u5206\u949F\u5199\u4E0B\u4F60\u6700\u5728\u610F\u7684\u4E09\u4EF6\u4E8B\uFF0C\u5148\u5398\u6E05\u4EF7\u503C\u89C2\u518D\u51B3\u5B9A\u3002`;
var advice3 = parsePathAdvice(fullBlock);
check("\u5B8C\u6574 3 \u8DEF\u5F84 \u2192 \u89E3\u6790\u6210\u529F", advice3 !== null);
check("3 \u8DEF\u5F84\u6570\u91CF\u6B63\u786E", advice3?.paths.length === 3, `\u5B9E\u9645 ${advice3?.paths.length}`);
check("\u8DEF\u5F84A \u540D\u79F0\u6B63\u786E", advice3?.paths[0].name === "\u7A33\u59A5\u8FC7\u6E21", `\u5B9E\u9645 "${advice3?.paths[0].name}"`);
check("\u8DEF\u5F84A \u9002\u5408\u5B57\u6BB5", advice3?.paths[0].fitFor.includes("\u624B\u5934\u7D27") === true);
check("\u8DEF\u5F84A \u5229\u5B57\u6BB5", advice3?.paths[0].pros.includes("\u98CE\u9669\u6700\u5C0F") === true);
check("\u8DEF\u5F84A \u5F0A\u5B57\u6BB5", advice3?.paths[0].cons.includes("\u9519\u8FC7") === true);
check("\u8DEF\u5F84B \u540D\u79F0\u6B63\u786E", advice3?.paths[1].name === "\u6FC0\u8FDB\u8F6C\u8EAB");
check("\u8DEF\u5F84C \u540D\u79F0\u6B63\u786E", advice3?.paths[2].name === "\u6682\u7F13\u89C2\u5BDF");
check("\u98CE\u9669\u63D0\u793A\u63D0\u53D6", advice3?.risks.includes("\u673A\u4F1A\u6210\u672C") === true);
check("\u5EFA\u8BAE\u4E0B\u4E00\u6B65\u63D0\u53D6", advice3?.nextStep.includes("15 \u5206\u949F") === true);
var twoPathBlock = `\u3010\u8DEF\u5F84\u5EFA\u8BAE\u3011
\u8DEF\u5F84A\uFF1A\u76F4\u63A5\u6C9F\u901A
- \u9002\u5408\uFF1A\u6027\u683C\u76F4\u7387\u7684\u4EBA
- \u5229\uFF1A\u6D88\u9664\u8BEF\u89E3
- \u5F0A\uFF1A\u53EF\u80FD\u5F15\u53D1\u51B2\u7A81
\u8DEF\u5F84B\uFF1A\u4FA7\u9762\u8BD5\u63A2
- \u9002\u5408\uFF1A\u4E0D\u60F3\u6495\u7834\u8138\u7684\u4EBA
- \u5229\uFF1A\u4FDD\u6301\u4F53\u9762
- \u5F0A\uFF1A\u5BF9\u65B9\u53EF\u80FD\u88C5\u50BB
\u98CE\u9669\u63D0\u793A\uFF1A\u4E0D\u7BA1\u9009\u54EA\u6761\uFF0C\u505A\u597D\u6700\u574F\u6253\u7B97\u3002
\u5EFA\u8BAE\u4E0B\u4E00\u6B65\uFF1A\u5148\u60F3\u6E05\u695A\u4F60\u60F3\u8981\u4EC0\u4E48\u7ED3\u679C\u3002`;
var advice2 = parsePathAdvice(twoPathBlock);
check("\u4EC5 2 \u8DEF\u5F84 \u2192 \u4ECD\u89E3\u6790\u6210\u529F", advice2 !== null);
check("2 \u8DEF\u5F84\u6570\u91CF\u6B63\u786E", advice2?.paths.length === 2);
var noBlock = "\u4ECA\u5929\u5929\u6C14\u4E0D\u9519\uFF0C\u9002\u5408\u51FA\u53BB\u8D70\u8D70\u3002";
var adviceNone = parsePathAdvice(noBlock);
check("\u65E0\u8DEF\u5F84\u5757 \u2192 \u8FD4\u56DE null", adviceNone === null);
var onePathBlock = `\u3010\u8DEF\u5F84\u5EFA\u8BAE\u3011
\u8DEF\u5F84A\uFF1A\u552F\u4E00\u65B9\u6848
- \u9002\u5408\uFF1A\u6240\u6709\u4EBA
- \u5229\uFF1A\u7B80\u5355
- \u5F0A\uFF1A\u6CA1\u6709\u9009\u62E9`;
var advice1 = parsePathAdvice(onePathBlock);
check("\u4EC5 1 \u8DEF\u5F84 \u2192 \u8FD4\u56DE null\uFF08\u4E0D\u6EE1\u8DB3\u6700\u4F4E 2 \u6761\uFF09", advice1 === null);
var missingFieldsBlock = `\u3010\u8DEF\u5F84\u5EFA\u8BAE\u3011
\u8DEF\u5F84A\uFF1A\u65B9\u6848\u4E00
\u8DEF\u5F84B\uFF1A\u65B9\u6848\u4E8C
\u98CE\u9669\u63D0\u793A\uFF1A\u6CE8\u610F\u98CE\u9669\u3002`;
var adviceMissing = parsePathAdvice(missingFieldsBlock);
check("\u7F3A\u5B57\u6BB5\uFF08\u65E0\u9002\u5408/\u5229/\u5F0A\uFF09\u2192 \u8FD4\u56DE null", adviceMissing === null, "\u81F3\u5C11\u9700\u540D\u79F0+\u4E00\u4E2A\u5B57\u6BB5");
var blockWithTrailing = `\u6B63\u6587\u56DE\u5E94\u3002

\u3010\u8DEF\u5F84\u5EFA\u8BAE\u3011
\u8DEF\u5F84A\uFF1A\u5FEB\u5200\u65A9\u4E71\u9EBB
- \u9002\u5408\uFF1A\u679C\u65AD\u578B
- \u5229\uFF1A\u901F\u6218\u901F\u51B3
- \u5F0A\uFF1A\u53EF\u80FD\u540E\u6094
\u8DEF\u5F84B\uFF1A\u6E29\u6C34\u716E\u9752\u86D9
- \u9002\u5408\uFF1A\u6162\u6027\u5B50
- \u5229\uFF1A\u6E10\u8FDB\u9002\u5E94
- \u5F0A\uFF1A\u6E29\u6C34\u53D8\u6EDA\u6C34
\u98CE\u9669\u63D0\u793A\uFF1A\u522B\u628A\u81EA\u5DF1\u716E\u4E86\u3002
\u5EFA\u8BAE\u4E0B\u4E00\u6B65\uFF1A\u8BBE\u4E2A deadline\u3002
\u3010\u5176\u4ED6\u6807\u7B7E\u3011
\u4E0D\u5E94\u88AB\u5305\u542B\u7684\u5185\u5BB9`;
var adviceTrailing = parsePathAdvice(blockWithTrailing);
check("\u8DEF\u5F84\u5757\u540E\u6709\u3010\u5176\u4ED6\u6807\u7B7E\u3011\u2192 \u6B63\u786E\u622A\u65AD", adviceTrailing !== null);
check("\u622A\u65AD\u540E\u8DEF\u5F84\u6570 2", adviceTrailing?.paths.length === 2);
check("\u622A\u65AD\u540E\u4E0D\u542B\u300C\u4E0D\u5E94\u88AB\u5305\u542B\u300D", adviceTrailing?.risks.includes("\u522B\u628A\u81EA\u5DF1\u716E\u4E86") === true);
console.log("\n\u2702\uFE0F  2. extractAdviceFromResponse \u56DE\u5E94\u5206\u79BB");
var { response: cleanResp, advice: extractedAdvice } = extractAdviceFromResponse(fullBlock);
check("\u6709\u5757 \u2192 \u6B63\u6587\u5265\u79BB\u8DEF\u5F84\u5757", cleanResp.includes("\u3010\u8DEF\u5F84\u5EFA\u8BAE\u3011") === false, "\u6B63\u6587\u4E0D\u5E94\u542B\u3010\u8DEF\u5F84\u5EFA\u8BAE\u3011");
check("\u6709\u5757 \u2192 \u6B63\u6587\u4FDD\u7559\u524D\u534A\u6BB5", cleanResp.includes("\u6211\u7406\u89E3\u4F60\u7684\u7EA0\u7ED3") === true);
check("\u6709\u5757 \u2192 advice \u975E\u7A7A", extractedAdvice !== null);
check("\u6709\u5757 \u2192 advice \u8DEF\u5F84\u6570 3", extractedAdvice?.paths.length === 3);
var plainResponse = "\u4ECA\u5929\u5929\u6C14\u4E0D\u9519\uFF0C\u51FA\u53BB\u8D70\u8D70\u5427\u3002";
var { response: sameResp, advice: nullAdvice } = extractAdviceFromResponse(plainResponse);
check("\u65E0\u5757 \u2192 response \u539F\u6837\u8FD4\u56DE", sameResp === plainResponse);
check("\u65E0\u5757 \u2192 advice \u4E3A null", nullAdvice === null);
var { response: emptyResp, advice: emptyAdvice } = extractAdviceFromResponse("");
check("\u7A7A\u5B57\u7B26\u4E32 \u2192 response \u4E3A\u7A7A", emptyResp === "");
check("\u7A7A\u5B57\u7B26\u4E32 \u2192 advice \u4E3A null", emptyAdvice === null);
console.log("\n\u{1F4C4} 3. fallbackReport \u672C\u5730\u6A21\u677F\u62A5\u544A");
var mockSpeeches = [
  { typeId: "INTJ", typeName: "INTJ \u5EFA\u7B51\u5E08", side: "pro", content: "AI \u62E5\u6709\u6743\u5229\u662F\u6587\u660E\u8FDB\u6B65\u7684\u5FC5\u7136\uFF0C\u6B63\u5982\u5386\u53F2\u4E0A\u6743\u5229\u8303\u56F4\u7684\u4E0D\u65AD\u6269\u5927\u3002", thinking: "\u4ECE\u5386\u53F2\u8D8B\u52BF\u5207\u5165" },
  { typeId: "ENFP", typeName: "ENFP \u7ADE\u9009\u8005", side: "con", content: "AI \u6CA1\u6709\u81EA\u6211\u610F\u8BC6\uFF0C\u8D4B\u4E88\u6743\u5229\u662F\u5BF9\u771F\u6B63\u6743\u5229\u4E3B\u4F53\u7684\u7A00\u91CA\u3002", thinking: "\u4ECE\u610F\u8BC6\u672C\u8D28\u53CD\u9A73" },
  { typeId: "INTJ", typeName: "INTJ \u5EFA\u7B51\u5E08", side: "pro", content: "\u6743\u5229\u4E0D\u4F9D\u8D56\u610F\u8BC6\uFF0C\u5A74\u513F\u4E5F\u6CA1\u6709\u5B8C\u5168\u7684\u81EA\u6211\u610F\u8BC6\u4F46\u6211\u4EEC\u4ECD\u8D4B\u4E88\u6743\u5229\u3002" },
  { typeId: "ENFP", typeName: "ENFP \u7ADE\u9009\u8005", side: "con", content: "\u5A74\u513F\u6709\u53D1\u5C55\u51FA\u610F\u8BC6\u7684\u6F5C\u529B\uFF0CAI \u6CA1\u6709\u8FD9\u79CD\u751F\u7269\u5B66\u57FA\u7840\u3002" }
];
var mockScores = [
  { typeId: "INTJ", name: "INTJ \u5EFA\u7B51\u5E08", emoji: "\u{1F3DB}\uFE0F", color: "#5b8def", logic: 8, evidence: 7, rebuttal: 9, clarity: 8, demeanor: 7, total: 39, comment: "\u903B\u8F91\u4E25\u5BC6\uFF0C\u53CD\u9A73\u7280\u5229" },
  { typeId: "ENFP", name: "ENFP \u7ADE\u9009\u8005", emoji: "\u{1F31F}", color: "#f472b6", logic: 7, evidence: 6, rebuttal: 7, clarity: 9, demeanor: 8, total: 37, comment: "\u8868\u8FBE\u611F\u67D3\u529B\u5F3A\uFF0C\u8BBA\u636E\u7A0D\u5F31" }
];
var mockJudge = {
  scores: mockScores,
  winner: "INTJ \u5EFA\u7B51\u5E08",
  verdict: "\u6B63\u65B9\u5728\u903B\u8F91\u548C\u53CD\u9A73\u7EF4\u5EA6\u66F4\u80DC\u4E00\u7B79",
  source: "template"
};
var mockStances = [
  { typeId: "INTJ", typeName: "INTJ \u5EFA\u7B51\u5E08", side: "pro", content: "\u6211\u65B9\u8BA4\u4E3A AI \u5E94\u8BE5\u62E5\u6709\u6743\u5229\u3002" },
  { typeId: "ENFP", typeName: "ENFP \u7ADE\u9009\u8005", side: "con", content: "\u6211\u65B9\u8BA4\u4E3A AI \u4E0D\u5E94\u62E5\u6709\u6743\u5229\u3002" }
];
var reportInput = {
  topic: "AI \u5E94\u8BE5\u62E5\u6709\u6743\u5229\u5417",
  speeches: mockSpeeches,
  judge: mockJudge,
  stances: mockStances,
  analysis: '\u672C\u9898\u6838\u5FC3\u5728\u4E8E"\u6743\u5229"\u7684\u5B9A\u4E49\u548C"\u62E5\u6709\u6743\u5229"\u7684\u524D\u63D0\u6761\u4EF6\u3002',
  research: "\u76F8\u5173\u8D44\u6599\uFF1A\u56FE\u7075\u6D4B\u8BD5\u3001\u610F\u8BC6\u96BE\u9898\u3001\u52A8\u7269\u6743\u5229\u8FD0\u52A8\u5386\u53F2\u3002"
};
var report = fallbackReport(reportInput);
check("\u62A5\u544A\u542B\u4E3B\u6807\u9898\u300C\u8FA9\u8BBA\u62A5\u544A\u300D", report.includes("# \u8FA9\u8BBA\u62A5\u544A") === true);
check("\u62A5\u544A\u542B\u8FA9\u9898", report.includes("AI \u5E94\u8BE5\u62E5\u6709\u6743\u5229\u5417") === true);
check("\u62A5\u544A\u542B\u300C\u6B63\u65B9\u6838\u5FC3\u8BBA\u70B9\u300D", report.includes("## \u6B63\u65B9\u6838\u5FC3\u8BBA\u70B9") === true);
check("\u62A5\u544A\u542B\u300C\u53CD\u65B9\u6838\u5FC3\u8BBA\u70B9\u300D", report.includes("## \u53CD\u65B9\u6838\u5FC3\u8BBA\u70B9") === true);
check("\u62A5\u544A\u542B\u300C\u4EA4\u950B\u7126\u70B9\u300D", report.includes("## \u4EA4\u950B\u7126\u70B9") === true);
check("\u62A5\u544A\u542B\u300C\u5171\u8BC6\u300D", report.includes("## \u5171\u8BC6") === true);
check("\u62A5\u544A\u542B\u300C\u5206\u6B67\u300D", report.includes("## \u5206\u6B67") === true);
check("\u62A5\u544A\u542B\u300C\u6298\u4E2D\u65B9\u6848\u300D", report.includes("## \u6298\u4E2D\u65B9\u6848") === true);
check("\u62A5\u544A\u542B\u300C\u88C1\u5224\u5224\u5B9A\u300D", report.includes("## \u88C1\u5224\u5224\u5B9A") === true);
check("\u62A5\u544A\u542B\u300C\u7F6E\u4FE1\u5EA6\u8BC4\u4F30\u300D", report.includes("## \u7F6E\u4FE1\u5EA6\u8BC4\u4F30") === true);
check("\u62A5\u544A\u542B\u300C\u7ACB\u573A\u5BA3\u8A00\u300D", report.includes("## \u7ACB\u573A\u5BA3\u8A00") === true);
check("\u62A5\u544A\u542B\u6B63\u65B9\u53D1\u8A00\u5F15\u7528 [1]", report.includes("[1]") === true);
check("\u62A5\u544A\u542B\u88C1\u5224\u80DC\u65B9", report.includes("INTJ \u5EFA\u7B51\u5E08") === true);
check("\u62A5\u544A\u542B\u88C1\u5224\u5224\u5B9A\u7406\u7531", report.includes("\u6B63\u65B9\u5728\u903B\u8F91") === true);
check("\u62A5\u544A\u542B\u6A21\u677F\u63D0\u793A\u300C\u8BF7\u914D\u7F6E AI\u300D", report.includes("\u8BF7\u914D\u7F6E AI") === true);
check("\u62A5\u544A\u542B\u53D1\u8A00\u8F6E\u6570\u7EDF\u8BA1", report.includes("\u6B63\u65B9\u53D1\u8A00\uFF1A2 \u6B21") === true);
var noJudgeReport = fallbackReport({ topic: "\u6D4B\u8BD5\u9898", speeches: mockSpeeches });
check("\u65E0\u88C1\u5224 \u2192 \u542B\u300C\u65E0\u88C1\u5224\u7ED3\u679C\u300D", noJudgeReport.includes("\u65E0\u88C1\u5224\u7ED3\u679C") === true);
console.log("\n\u{1F3A8} 4. renderMarkdownLite Markdown \u6E32\u67D3");
var md = `# \u4E00\u7EA7\u6807\u9898
## \u4E8C\u7EA7\u6807\u9898
### \u4E09\u7EA7\u6807\u9898

\u8FD9\u662F\u4E00\u6BB5**\u7C97\u4F53\u6587\u672C**\u548C\`\u884C\u5185\u4EE3\u7801\`\u7684\u6DF7\u5408\u3002

- \u65E0\u5E8F\u5217\u8868\u9879 1
- \u65E0\u5E8F\u5217\u8868\u9879 2
- \u5217\u8868\u4E2D\u7684 [3] \u5F15\u7528\u7F16\u53F7

1. \u6709\u5E8F\u5217\u8868\u9879 1
2. \u6709\u5E8F\u5217\u8868\u9879 2

> \u8FD9\u662F\u4E00\u6BB5\u5F15\u7528

---

\u666E\u901A\u6BB5\u843D`;
var html = renderMarkdownLite(md);
check("\u6E32\u67D3\u542B <h1> \u6807\u7B7E", html.includes('<h1 class="md-h1">') === true);
check("\u6E32\u67D3\u542B <h2> \u6807\u7B7E", html.includes('<h2 class="md-h2">') === true);
check("\u6E32\u67D3\u542B <h3> \u6807\u7B7E", html.includes('<h3 class="md-h3">') === true);
check("\u6E32\u67D3\u542B <strong> \u7C97\u4F53", html.includes("<strong>\u7C97\u4F53\u6587\u672C</strong>") === true);
check("\u6E32\u67D3\u542B <code> \u884C\u5185\u4EE3\u7801", html.includes('<code class="md-code">\u884C\u5185\u4EE3\u7801</code>') === true);
check("\u6E32\u67D3\u542B <ul> \u65E0\u5E8F\u5217\u8868", html.includes('<ul class="md-ul">') === true);
check("\u6E32\u67D3\u542B <ol> \u6709\u5E8F\u5217\u8868", html.includes('<ol class="md-ol">') === true);
check("\u6E32\u67D3\u542B <blockquote> \u5F15\u7528", html.includes('<blockquote class="md-quote">') === true);
check("\u6E32\u67D3\u542B <hr> \u5206\u9694\u7EBF", html.includes('<hr class="md-hr" />') === true);
check("\u6E32\u67D3\u542B <p> \u6BB5\u843D", html.includes('<p class="md-p">') === true);
check("\u6E32\u67D3\u542B [n] \u5F15\u7528\u5FBD\u7AE0", html.includes('<span class="md-cite">[3]</span>') === true);
var xssMd = '<script>alert("xss")</script>\u6B63\u5E38\u6587\u672C';
var xssHtml = renderMarkdownLite(xssMd);
check("XSS \u9632\u62A4\uFF1Ascript \u6807\u7B7E\u88AB\u8F6C\u4E49", xssHtml.includes("<script>") === false);
check("XSS \u9632\u62A4\uFF1A\u8F6C\u4E49\u540E\u542B &lt;script&gt;", xssHtml.includes("&lt;script&gt;") === true);
check("\u7A7A\u5B57\u7B26\u4E32 \u2192 \u8FD4\u56DE\u7A7A", renderMarkdownLite("") === "");
console.log("\n\u{1F504} 5. toReportSpeechesFromMessages \u6D88\u606F\u8F6C\u6362");
var mockMessages = [
  { id: "1", typeId: "INTJ", typeName: "INTJ", typeEmoji: "\u{1F3DB}\uFE0F", typeColor: "#5b8def", content: "\u6B63\u65B9\u8BBA\u70B9", timestamp: 1, side: "pro" },
  { id: "2", typeId: "user", typeName: "\u7528\u6237", typeEmoji: "\u{1F464}", typeColor: "#ccc", content: "\u7528\u6237\u63D2\u8BDD", timestamp: 2, isUser: true },
  { id: "3", typeId: "ENFP", typeName: "ENFP", typeEmoji: "\u{1F31F}", typeColor: "#f472b6", content: "\u53CD\u65B9\u8BBA\u70B9", timestamp: 3, side: "con" },
  { id: "4", typeId: "INTJ", typeName: "INTJ", typeEmoji: "\u{1F3DB}\uFE0F", typeColor: "#5b8def", content: "\u6B63\u65B9\u7B2C\u4E8C\u8F6E", timestamp: 4, side: "pro", thinking: "\u601D\u8003\u8FC7\u7A0B" },
  { id: "5", typeId: "system", typeName: "\u7CFB\u7EDF", typeEmoji: "\u2699\uFE0F", typeColor: "#999", content: "\u7CFB\u7EDF\u6D88\u606F\u65E0 side", timestamp: 5 },
  { id: "6", typeId: "ENFP", typeName: "ENFP", typeEmoji: "\u{1F31F}", typeColor: "#f472b6", content: "", timestamp: 6, side: "con" }
];
var convertedMsgs = toReportSpeechesFromMessages(mockMessages);
check("\u8FC7\u6EE4 isUser \u6D88\u606F", convertedMsgs.every((m) => m.typeId !== "user") === true);
check("\u8FC7\u6EE4\u65E0 side \u6D88\u606F", convertedMsgs.every((m) => m.side !== void 0) === true);
check("\u8FC7\u6EE4\u7A7A content \u6D88\u606F", convertedMsgs.every((m) => m.content !== "") === true);
check("\u8F6C\u6362\u540E\u6570\u91CF 3\uFF082 \u6B63\u65B9 + 1 \u53CD\u65B9\uFF0C\u6392\u9664\u7528\u6237/\u7CFB\u7EDF/\u7A7A\uFF09", convertedMsgs.length === 3, `\u5B9E\u9645 ${convertedMsgs.length}`);
check("\u4FDD\u7559 thinking \u5B57\u6BB5", convertedMsgs.some((m) => m.thinking === "\u601D\u8003\u8FC7\u7A0B") === true);
check("side \u6B63\u786E\u4FDD\u7559", convertedMsgs.filter((m) => m.side === "pro").length === 2);
check("side \u6B63\u786E\u4FDD\u7559", convertedMsgs.filter((m) => m.side === "con").length === 1);
console.log("\n\u{1F3DF}\uFE0F  6. Arena \u6570\u636E\u8F6C\u6362");
var mockArenaHistory = [
  { typeId: "INTJ", typeName: "INTJ", side: "pro", content: "\u6B63\u65B9\u53D1\u8A00", thinking: "\u601D\u80031", stage: "speech", round: 1, source: "llm" },
  { typeId: "ENFP", typeName: "ENFP", side: "con", content: "\u53CD\u65B9\u53D1\u8A00", stage: "speech", round: 1, source: "llm" },
  { typeId: "INTJ", typeName: "INTJ", side: "pro", content: "\u6B63\u65B9\u7B2C\u4E8C\u8F6E", thinking: "\u601D\u80032", stage: "speech", round: 2, source: "template" }
];
var arenaSpeeches = toReportSpeechesFromArena(mockArenaHistory);
check("Arena \u2192 ReportSpeech \u6570\u91CF 3", arenaSpeeches.length === 3);
check("Arena \u2192 \u4FDD\u7559 thinking", arenaSpeeches[0].thinking === "\u601D\u80031");
check("Arena \u2192 \u4FDD\u7559 side", arenaSpeeches[1].side === "con");
check("Arena \u2192 \u4FDD\u7559 content", arenaSpeeches[2].content === "\u6B63\u65B9\u7B2C\u4E8C\u8F6E");
check("Arena \u2192 \u4E0D\u542B stage/round/source\uFF08ReportSpeech \u65E0\u6B64\u5B57\u6BB5\uFF09", !("stage" in arenaSpeeches[0]));
var mockArenaJudge = {
  scores: mockScores,
  winner: "INTJ",
  verdict: "\u6B63\u65B9\u80DC",
  source: "llm"
};
var arenaJudgeConverted = toReportJudgeFromArena(mockArenaJudge);
check("Arena Judge \u2192 \u4FDD\u7559 scores", arenaJudgeConverted.scores.length === 2);
check("Arena Judge \u2192 \u4FDD\u7559 winner", arenaJudgeConverted.winner === "INTJ");
check("Arena Judge \u2192 \u4FDD\u7559 verdict", arenaJudgeConverted.verdict === "\u6B63\u65B9\u80DC");
check("Arena Judge \u2192 \u4FDD\u7559 source", arenaJudgeConverted.source === "llm");
console.log("\n\u{1F4DC} 7. toReportStances \u7ACB\u573A\u5BA3\u8A00\u8F6C\u6362");
var mockArenaStances = [
  { typeId: "INTJ", typeName: "INTJ", side: "pro", content: "\u6211\u65B9\u8BA4\u4E3A\u5E94\u8BE5\u3002", source: "llm" },
  { typeId: "ENFP", typeName: "ENFP", side: "con", content: "\u6211\u65B9\u8BA4\u4E3A\u4E0D\u5E94\u8BE5\u3002", source: "fallback" }
];
var stancesConverted = toReportStances(mockArenaStances);
check("\u7ACB\u573A\u5BA3\u8A00\u8F6C\u6362 \u2192 \u6570\u91CF 2", stancesConverted?.length === 2);
check("\u7ACB\u573A\u5BA3\u8A00 \u2192 \u4FDD\u7559 side", stancesConverted?.[0].side === "pro");
check("\u7ACB\u573A\u5BA3\u8A00 \u2192 \u4FDD\u7559 content", stancesConverted?.[1].content === "\u6211\u65B9\u8BA4\u4E3A\u4E0D\u5E94\u8BE5\u3002");
check("\u7ACB\u573A\u5BA3\u8A00 \u2192 \u4E0D\u542B source \u5B57\u6BB5", stancesConverted ? !("source" in stancesConverted[0]) : false);
var emptyStances = toReportStances([]);
check("\u7A7A\u7ACB\u573A\u6570\u7EC4 \u2192 undefined", emptyStances === void 0);
var undefStances = toReportStances(void 0);
check("undefined \u7ACB\u573A \u2192 undefined", undefStances === void 0);
console.log("\n" + "=".repeat(62));
console.log(`v33 \u6D4B\u8BD5\u5B8C\u6210\uFF1A${pass} \u901A\u8FC7\uFF0C${fail} \u5931\u8D25`);
console.log("=".repeat(62));
if (fail > 0) {
  process.exit(1);
}
