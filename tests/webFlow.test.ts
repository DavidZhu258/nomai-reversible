import { describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { decodeNomaiImage, encodeToNomaiImage } from "../src/web/translationFlow";

describe("web translation flow", () => {
  test("encodes a source-language text into a Nomai SVG and decodes it back to that language", () => {
    const encoded = encodeToNomaiImage({
      originalText: "你好，Nomai。今天适合看星星。",
      sourceLang: "zh-Hans",
      pivotEnglish: "Hello, Nomai. Today is good for watching stars.",
      seed: 47,
      handwriting: 0.16
    });

    const decoded = decodeNomaiImage(encoded.svg);

    expect(encoded.svg).toContain("<svg");
    expect(encoded.tokenStream).toMatch(/^NOMAI1-/);
    expect(decoded.originalText).toBe("你好，Nomai。今天适合看星星。");
    expect(decoded.sourceLang).toBe("zh-Hans");
    expect(decoded.pivotEnglish).toBe("Hello, Nomai. Today is good for watching stars.");
    expect(decoded.checksumOk).toBe(true);
  });

  test("decodes a token stream without needing the visual SVG", () => {
    const encoded = encodeToNomaiImage({
      originalText: "こんにちは Nomai",
      sourceLang: "ja",
      seed: 12,
      handwriting: 0
    });

    const decoded = decodeNomaiImage(encoded.tokenStream);

    expect(decoded.originalText).toBe("こんにちは Nomai");
    expect(decoded.sourceLang).toBe("ja");
  });

  test("web UI starts with a single multilingual source text field", async () => {
    const main = await readFile("src/web/main.tsx", "utf8");

    expect(main).toContain("useState(0)");
    expect(main).toContain("Text");
    expect(main).toContain("Enter text in any language");
    expect(main).not.toContain("English reading metadata");
    expect(main).not.toContain("Language");
  });
});
