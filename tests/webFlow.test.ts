import { describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { extractNomaiTokenFromScan } from "../src/web/scanToken";
import { buildNomaiTokenQrSvg, buildNomaiTokenScanUrl } from "../src/web/tokenQrSvg";
import { decodeNomaiImage, encodeToNomaiImage } from "../src/web/translationFlow";

function readViewBox(svg: string): [number, number, number, number] {
  const viewBox = svg.match(/\bviewBox="([^"]+)"/)?.[1];
  if (!viewBox) throw new Error("Missing viewBox");
  return viewBox.split(/\s+/).map(Number) as [number, number, number, number];
}

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

  test("optionally embeds a visible token QR layer while keeping SVG metadata decodable", () => {
    const baseInput = {
      originalText: "Camera decode trial: 你好 Nomai",
      seed: 47,
      handwriting: 0
    };

    const plain = encodeToNomaiImage(baseInput);
    const withQr = encodeToNomaiImage({ ...baseInput, includeQrToken: true });
    const decoded = decodeNomaiImage(withQr.svg);
    const [, , plainWidth, plainHeight] = readViewBox(plain.svg);
    const [, , qrWidth, qrHeight] = readViewBox(withQr.svg);
    const [, transformX, transformY] = withQr.svg.match(/id="nomai-token-qr"[\s\S]*?transform="translate\(([\d.]+) ([\d.]+)\)"/) ?? [];
    const [, panelWidth] = withQr.svg.match(/<rect x="-18" y="-18" width="([\d.]+)"/) ?? [];
    const qrSize = Number(panelWidth) - 36;

    expect(plain.svg).not.toContain('data-nomai-qr-token="true"');
    expect(withQr.svg).toContain('data-nomai-qr-token="true"');
    expect(withQr.svg).toContain('data-nomai-qr-placement="bottom-right"');
    expect(withQr.svg).toContain('aria-label="NOMAI1 token QR"');
    expect(withQr.svg).toContain('data-nomai-qr-payload="NOMAI1-');
    expect(withQr.svg).toContain('data-nomai-qr-scan-url="https://nomai.uk/#nomai=NOMAI1-');
    expect(qrWidth).toBe(plainWidth);
    expect(qrHeight).toBe(plainHeight);
    expect(Number(transformX)).toBeGreaterThan(plainWidth * 0.72);
    expect(Number(transformY)).toBeGreaterThan(plainHeight * 0.72);
    expect(qrSize).toBeLessThanOrEqual(420);
    expect(qrSize / plainWidth).toBeLessThanOrEqual(0.2);
    expect(decoded.originalText).toBe(baseInput.originalText);
    expect(decoded.checksumOk).toBe(true);
  });

  test("creates a standalone camera-friendly QR that opens the web decoder", () => {
    const encoded = encodeToNomaiImage({
      originalText: "Standalone QR: 你好 Nomai",
      seed: 47,
      handwriting: 0
    });

    const scanUrl = buildNomaiTokenScanUrl(encoded.tokenStream);
    const qrSvg = buildNomaiTokenQrSvg(encoded.tokenStream);

    expect(scanUrl).toBe(`https://nomai.uk/#nomai=${encoded.tokenStream}`);
    expect(qrSvg).toContain('viewBox="0 0 360 360"');
    expect(qrSvg).toContain('width="360" height="360"');
    expect(qrSvg).toContain('data-nomai-qr-kind="scan-url"');
    expect(qrSvg).toContain('data-nomai-qr-error-correction="M"');
    expect(qrSvg).toContain('fill="#000000"');
    expect(qrSvg).toContain(`data-nomai-qr-scan-url="${scanUrl}"`);
    expect(extractNomaiTokenFromScan(scanUrl)).toBe(encoded.tokenStream);
  });

  test("extracts a scanned NOMAI1 token for automatic decoder import", () => {
    const encoded = encodeToNomaiImage({
      originalText: "Scan me",
      seed: 12,
      handwriting: 0
    });

    expect(extractNomaiTokenFromScan(encoded.tokenStream)).toBe(encoded.tokenStream);
    expect(extractNomaiTokenFromScan(`open ${encoded.tokenStream}\nnow`)).toBe(encoded.tokenStream);
    expect(extractNomaiTokenFromScan("not a token")).toBeNull();
  });

  test("web UI starts with a single multilingual source text field", async () => {
    const main = await readFile("src/web/main.tsx", "utf8");

    expect(main).toContain("useState(0)");
    expect(main).toContain("language");
    expect(main).toContain("English");
    expect(main).toContain("中文");
    expect(main).toContain("Text");
    expect(main).toContain("文本");
    expect(main).toContain("Enter text in any language");
    expect(main).toContain("Camera QR");
    expect(main).toContain("Token QR");
    expect(main).toContain("保存 SVG");
    expect(main).toContain("readQrImageFile");
    expect(main).toContain('accept="image/*"');
    expect(main).toContain("decodeFromImageUrl");
    expect(main).toContain("Scan Camera");
    expect(main).toContain("window.location.href");
    expect(main).toContain("startCameraScan");
    expect(main).toContain("decodeFromConstraints");
    expect(main).toContain("facingMode");
    expect(main).toContain("environment");
    expect(main).not.toContain("{scanActive ? <video");
    expect(main).not.toContain("English reading metadata");
  });
});
