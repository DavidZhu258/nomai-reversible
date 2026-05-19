import { describe, expect, test } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runCli } from "../src/cli";

describe("CLI", () => {
  test("encodes JSON and decodes token streams", async () => {
    const encoded = await runCli(["encode", "Hello Nomai!", "--json"]);
    const payload = JSON.parse(encoded.stdout);
    const decoded = await runCli(["decode", payload.tokenStream]);

    expect(payload.tokenStream).toMatch(/^NOMAI1-/);
    expect(decoded.stdout).toContain("Hello Nomai!");
  });

  test("encodes explicit text blocks through the upstream-style single spiral renderer", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "nomai-blocks-"));
    const blocksPath = path.join(tempDir, "blocks.json");
    const blocks = [
      { id: "root", speaker: "LAMI", text: "LAMI: The wall text begins from the root." },
      { id: "reply", parentId: "root", speaker: "PYE", text: "PYE: This response grows as a child branch." }
    ];
    const expectedText = blocks.map((block) => block.text).join("\n\n");

    try {
      await writeFile(blocksPath, JSON.stringify(blocks), "utf8");

      const encoded = await runCli([
        "encode",
        "--blocks",
        blocksPath,
        "--layout",
        "wall-dialogue",
        "--writing-age",
        "teenager",
        "--json"
      ]);
      const payload = JSON.parse(encoded.stdout);
      const decoded = await runCli(["decode", payload.tokenStream]);

      expect(encoded.stderr).toBe("");
      expect(payload.envelope.originalText).toBe(expectedText);
      expect(payload.svg).toContain('data-nomai-renderer="nomai-text-jl-upstream-port-v1"');
      expect(payload.svg).toContain('data-upstream-project="evanfields/NomaiText.jl"');
      expect(payload.svg).toContain('data-upstream-behavior="draw_spiral"');
      expect(payload.svg).toContain('data-paragraph-ring-mode="disabled"');
      expect(payload.svg).toContain('data-layout-tuning="nomai-text-jl-pathgrid-strict-v1"');
      expect(payload.svg).toContain('data-oracle-base="200000"');
      expect(payload.svg).toContain('class="nomai-text-jl-glyph"');
      expect(payload.svg).toContain('class="nomai-text-jl-connector"');
      expect(payload.svg).not.toContain('data-visible-grammar="branch-leaf-param-v1"');
      expect(payload.svg).not.toContain('class="nomai-paragraph-ring"');
      expect(payload.svg).not.toContain('data-arc-template-library');
      expect(decoded.stdout).toContain(expectedText);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("uses clean zero-handwriting output by default", async () => {
    const encoded = await runCli(["encode", "Hello Nomai!", "--json"]);
    const payload = JSON.parse(encoded.stdout);

    expect(payload.envelope.handwriting).toBe(0);
    expect(payload.svg).toContain('data-layout-tuning="nomai-text-jl-pathgrid-strict-v1"');
  });
});
