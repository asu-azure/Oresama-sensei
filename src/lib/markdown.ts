// A deliberately small Markdown renderer for model output (Ask Sensei replies,
// kanji mnemonics). Everything is HTML-escaped FIRST; only the constructs below
// are turned back into markup, so a reply can never inject an element or an
// attribute. Ruby is the one tag passed through, rebuilt from its escaped text.
//
// Supported: # headings, - / * / 1. lists, > quotes, ``` fences, `code`,
// **bold**, *italic*, [links](https://…), 漢字（かな） furigana. Not tables.

import { decodeRubyEntities, furiganaToRuby } from "./furigana";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(raw: string): string {
  // Pull ruby out before escaping, rebuild it from escaped parts afterwards.
  const ruby: string[] = [];
  let s = raw.replace(/<ruby>(.*?)<rt>(.*?)<\/rt>([\s\S]*?)<\/ruby>/g, (_m, b, r, t) => {
    ruby.push(`<ruby>${esc(b)}<rt>${esc(r)}</rt></ruby>${esc(t)}`);
    return `\u0000${ruby.length - 1}\u0000`;
  });
  s = s.replace(/<\/?(?:ruby|rt|rp)>/g, "");

  const code: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_m, c) => {
    code.push(`<code>${esc(c)}</code>`);
    return `\u0001${code.length - 1}\u0001`;
  });

  s = esc(s);
  s = furiganaToRuby(s);
  s = s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_(?!\s)(.+?)_(?!\w)/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_m, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`,
    );
  return s
    .replace(/\u0001(\d+)\u0001/g, (_m, i) => code[+i])
    .replace(/\u0000(\d+)\u0000/g, (_m, i) => ruby[+i]);
}

export function renderMarkdown(src: string | null | undefined): string {
  const lines = decodeRubyEntities(src ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];

  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map(inline).join("<br>")}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) out.push(`<blockquote>${quote.map(inline).join("<br>")}</blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line.trim())) {
      flushAll();
      const body: string[] = [];
      while (++i < lines.length && !/^```/.test(lines[i].trim())) body.push(lines[i]);
      out.push(`<pre><code>${esc(body.join("\n"))}</code></pre>`);
      continue;
    }
    if (!line.trim()) {
      flushAll();
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushAll();
      const level = Math.min(4, h[1].length + 2); // # → h3: replies sit inside a page
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      flushQuote();
      const tag = ul ? "ul" : "ol";
      if (list && list.tag !== tag) flushList();
      list ??= { tag, items: [] };
      list.items.push((ul ?? ol)![1]);
      continue;
    }
    const q = line.match(/^>\s?(.*)$/);
    if (q) {
      flushPara();
      flushList();
      quote.push(q[1]);
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flushAll();
      out.push("<hr>");
      continue;
    }
    flushList();
    flushQuote();
    para.push(line);
  }
  flushAll();
  return out.join("");
}
