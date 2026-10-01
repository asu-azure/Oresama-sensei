import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";
import { rubySegments } from "./ruby";

describe("renderMarkdown is safe on model output", () => {
  it("escapes raw HTML", () => {
    const out = renderMarkdown('<script>alert(1)</script><img src=x onerror="alert(2)">');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;script&gt;");
  });

  it("cannot smuggle an attribute through a link", () => {
    const out = renderMarkdown('[x](https://a.example/" onmouseover="alert(1))');
    expect(out).not.toMatch(/<a [^>]*onmouseover/);
  });

  it("only links http(s)", () => {
    expect(renderMarkdown("[x](javascript:alert(1))")).not.toContain("<a ");
    expect(renderMarkdown("[x](https://example.com)")).toContain('<a href="https://example.com"');
  });

  it("passes ruby through, rebuilt from escaped parts", () => {
    expect(renderMarkdown("<ruby>漢字<rt>かんじ</rt></ruby>")).toContain("<ruby>漢字<rt>かんじ</rt></ruby>");
    const evil = renderMarkdown('<ruby><b onclick="x">漢</b><rt>かん</rt></ruby>');
    expect(evil).not.toContain("<b");
  });

  it("turns 漢字（かんじ） into furigana", () => {
    expect(renderMarkdown("勉強（べんきょう）する")).toContain("<ruby>勉強<rt>べんきょう</rt></ruby>");
  });

  it("decodes the entities Gemini emits around ruby", () => {
    expect(renderMarkdown("&lt;ruby&gt;字&lt;rt&gt;じ&lt;/rt&gt;&lt;/ruby&gt;")).toContain("<ruby>字<rt>じ</rt></ruby>");
  });

  it("renders the supported blocks", () => {
    const out = renderMarkdown("# Title\n\n- one\n- two\n\n1. a\n\n> quote\n\n**bold** and *it* and `code`");
    expect(out).toContain("<h3>Title</h3>");
    expect(out).toContain("<ul><li>one</li><li>two</li></ul>");
    expect(out).toContain("<ol><li>a</li></ol>");
    expect(out).toContain("<blockquote>quote</blockquote>");
    expect(out).toContain("<strong>bold</strong>");
    expect(out).toContain("<em>it</em>");
    expect(out).toContain("<code>code</code>");
  });

  it("escapes inside code", () => {
    expect(renderMarkdown("`<b>`")).toContain("<code>&lt;b&gt;</code>");
    expect(renderMarkdown("```\n<i>x</i>\n```")).toContain("<pre><code>&lt;i&gt;x&lt;/i&gt;</code></pre>");
  });
});

describe("rubySegments", () => {
  it("splits plain text and ruby", () => {
    expect(rubySegments("今日は<ruby>天気<rt>てんき</rt></ruby>がいい")).toEqual([
      { text: "今日は" },
      { base: "天気", rt: "てんき", tail: "" },
      { text: "がいい" },
    ]);
  });

  it("keeps okurigana inside the tag beside the ruby", () => {
    expect(rubySegments("<ruby>凡庸<rt>ぼんよう</rt>な</ruby>人")).toEqual([
      { base: "凡庸", rt: "ぼんよう", tail: "な" },
      { text: "人" },
    ]);
  });

  it("reads 漢字(かな) notation", () => {
    expect(rubySegments("食(た)べる")).toEqual([{ base: "食", rt: "た", tail: "" }, { text: "べる" }]);
  });

  it("never returns markup in plain text", () => {
    for (const s of rubySegments("<ruby>a<rt>b</ruby><rt>c</rt> x")) {
      if ("text" in s) expect(s.text).not.toMatch(/<\/?(ruby|rt)>/);
    }
  });

  it("copes with empty input", () => {
    expect(rubySegments(null)).toEqual([]);
    expect(rubySegments("")).toEqual([]);
  });
});
