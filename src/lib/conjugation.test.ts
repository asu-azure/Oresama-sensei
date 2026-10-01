import { describe, expect, it } from "vitest";
import { conjugate } from "./conjugation";

const form = (term: string, reading: string, pos: string, label: string) =>
  conjugate(term, reading, pos)?.find((f) => f.label.startsWith(label))?.form;

describe("conjugate", () => {
  it("godan", () => {
    expect(form("書く", "かく", "godan verb", "Polite")).toBe("書きます");
    expect(form("書く", "かく", "godan verb", "Te-form")).toBe("書いて");
    expect(form("話す", "はなす", "godan verb", "Negative")).toBe("話さない");
    expect(form("待つ", "まつ", "godan verb", "Past")).toBe("待った");
    expect(form("読む", "よむ", "godan verb", "Te-form")).toBe("読んで");
    expect(form("買う", "かう", "godan verb", "Negative")).toBe("買わない");
  });

  it("行く is the euphonic exception", () => {
    expect(form("行く", "いく", "godan verb", "Te-form")).toBe("行って");
    expect(form("行く", "いく", "godan verb", "Past")).toBe("行った");
  });

  it("ichidan", () => {
    expect(form("食べる", "たべる", "ichidan verb", "Polite")).toBe("食べます");
    expect(form("見る", "みる", "ichidan verb", "Volitional")).toBe("見よう");
  });

  it("suru and kuru", () => {
    expect(form("勉強する", "べんきょうする", "suru verb", "Potential")).toBe("勉強できる");
    expect(form("来る", "くる", "kuru verb", "Negative")).toBe("来ない");
  });

  it("adjectives", () => {
    expect(form("高い", "たかい", "i-adjective", "Past")).toBe("高かった");
    expect(form("いい", "いい", "i-adjective", "Negative")).toBe("よくない");
    expect(form("静か", "しずか", "na-adjective", "Attributive")).toBe("静かな");
    expect(form("静かな", "しずかな", "na-adjective", "Polite")).toBe("静かです");
  });

  it("falls back to the reading when the written ending doesn't fit", () => {
    // Written in kanji only; the reading carries the conjugating kana.
    expect(form("微笑", "ほほえむ", "godan verb", "Polite")).toBe("ほほえみます");
  });

  it("returns nothing for words that don't conjugate", () => {
    expect(conjugate("猫", "ねこ", "noun")).toBeNull();
    expect(conjugate("〜ばかり", "", "")).toBeNull();
    expect(conjugate("食べる", "たべる", null)).toBeNull();
  });
});
