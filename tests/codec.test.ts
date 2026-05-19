import { describe, expect, test } from "vitest";
import { decodePacket, encodePacket } from "../src/core/codec";

describe("reversible packet codec", () => {
  test("round-trips multilingual Unicode text without translating away the original", () => {
    const samples = [
      "Hello Nomai! How are you?",
      "你好，Nomai。今天适合看星星。",
      "こんにちは Nomai 🌌",
      "مرحبا نومي",
      "Line one\nLine two — with emoji 🚀"
    ];

    for (const originalText of samples) {
      const packet = encodePacket({
        originalText,
        pivotEnglish: originalText.startsWith("Hello") ? originalText : "Hello Nomai",
        sourceLang: "auto",
        seed: 47,
        handwriting: 0.15,
        style: "nomai-text-jl"
      });

      const decoded = decodePacket(packet.tokenStream);

      expect(decoded.originalText).toBe(originalText);
      expect(decoded.checksumOk).toBe(true);
      expect(decoded.version).toBe(1);
    }
  });

  test("rejects tampered token streams with a checksum error", () => {
    const packet = encodePacket({
      originalText: "Do not let corrupted spirals pass.",
      sourceLang: "en",
      seed: 9,
      handwriting: 0,
      style: "nomai-text-jl"
    });

    const tampered = `${packet.tokenStream.slice(0, -1)}0`;

    expect(() => decodePacket(tampered)).toThrow(/checksum/i);
  });
});
