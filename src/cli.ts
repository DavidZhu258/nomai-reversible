import { readFile, writeFile } from "node:fs/promises";
import { decodeNomaiSvg } from "./decode/svgDecoder";
import { renderNomaiSvg } from "./render/svgRenderer";
import { encodePacket } from "./core/codec";
import type { NomaiLayoutPreset, NomaiTextBlock, NomaiWritingAge } from "./core/types";

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runCli(args: string[]): Promise<CliResult> {
  const [command, ...rest] = args;
  try {
    if (command === "encode") {
      return await encodeCommand(rest);
    }
    if (command === "decode") {
      return await decodeCommand(rest);
    }
    return {
      stdout: helpText(),
      stderr: "",
      exitCode: command === "--help" || command === "-h" || command === undefined ? 0 : 1
    };
  } catch (error) {
    return {
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1
    };
  }
}

async function encodeCommand(args: string[]): Promise<CliResult> {
  let json = false;
  let outPath: string | undefined;
  let blocksPath: string | undefined;
  let layoutPreset: NomaiLayoutPreset = "auto-game";
  let writingAge: NomaiWritingAge = "adult";
  let seed = 47;
  let handwriting = 0;
  const textParts: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--json") {
      json = true;
    } else if (arg === "--out") {
      outPath = requireOptionValue(args, ++i, "--out");
    } else if (arg === "--blocks") {
      blocksPath = requireOptionValue(args, ++i, "--blocks");
    } else if (arg === "--layout") {
      layoutPreset = parseLayoutPreset(requireOptionValue(args, ++i, "--layout"));
    } else if (arg === "--writing-age") {
      writingAge = parseWritingAge(requireOptionValue(args, ++i, "--writing-age"));
    } else if (arg === "--seed") {
      seed = Number(requireOptionValue(args, ++i, "--seed"));
    } else if (arg === "--handwriting") {
      handwriting = Number(requireOptionValue(args, ++i, "--handwriting"));
    } else {
      textParts.push(arg);
    }
  }

  const textBlocks = blocksPath ? await loadTextBlocks(blocksPath) : undefined;
  const text = textParts.length > 0
    ? textParts.join(" ")
    : textBlocks?.map((block) => block.text).join("\n\n") ?? "";

  if (!text) {
    throw new Error("Missing text to encode");
  }

  const packet = encodePacket({ originalText: text, sourceLang: "auto", seed, handwriting, style: "nomai-text-jl" });
  const svg = renderNomaiSvg(text, {
    seed,
    handwriting,
    style: "nomai-text-jl",
    textBlocks,
    layoutPreset,
    writingAge
  });

  if (outPath) {
    await writeFile(outPath, svg, "utf8");
  }

  if (json) {
    return {
      stdout: `${JSON.stringify({ tokenStream: packet.tokenStream, envelope: packet.envelope, svg }, null, 2)}\n`,
      stderr: "",
      exitCode: 0
    };
  }

  return {
    stdout: outPath ? `Wrote ${outPath}\n${packet.tokenStream}\n` : `${svg}\n`,
    stderr: "",
    exitCode: 0
  };
}

async function decodeCommand(args: string[]): Promise<CliResult> {
  const input = args.join(" ");
  if (!input) {
    throw new Error("Missing token stream, SVG, or file path to decode");
  }

  const value = input.endsWith(".svg") ? await readFile(input, "utf8") : input;
  const decoded = decodeNomaiSvg(value);

  return {
    stdout: `${decoded.originalText}\n`,
    stderr: "",
    exitCode: 0
  };
}

function helpText(): string {
  return [
    "Usage:",
    "  nomai encode \"Hello Nomai!\" --out hello.svg",
    "  nomai encode \"Hello Nomai!\" --json",
    "  nomai encode --blocks blocks.json --layout wall-dialogue --writing-age teenager --out dialogue.svg",
    "  nomai decode NOMAI1-...",
    "  nomai decode hello.svg"
  ].join("\n");
}

function requireOptionValue(args: string[], index: number, option: string): string {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${option}`);
  }
  return value;
}

async function loadTextBlocks(filePath: string): Promise<NomaiTextBlock[]> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const candidate = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.blocks)
      ? parsed.blocks
      : null;

  if (!candidate) {
    throw new Error("--blocks must point to a JSON array or an object with a blocks array");
  }

  const blocks = candidate.map((block, index) => normalizeTextBlock(block, index));
  if (blocks.length === 0) {
    throw new Error("--blocks JSON must contain at least one text block");
  }
  return blocks;
}

function normalizeTextBlock(value: unknown, index: number): NomaiTextBlock {
  if (!isRecord(value)) {
    throw new Error(`Block ${index} must be an object`);
  }
  const text = typeof value.text === "string" ? value.text.trim() : "";
  if (!text) {
    throw new Error(`Block ${index} is missing text`);
  }
  const id = typeof value.id === "string" && value.id.trim() ? value.id.trim() : `block-${index}`;
  const parentId = typeof value.parentId === "string" && value.parentId.trim() ? value.parentId.trim() : null;
  const speaker = typeof value.speaker === "string" && value.speaker.trim() ? value.speaker.trim() : null;
  return { id, parentId, speaker, text };
}

function parseLayoutPreset(value: string): NomaiLayoutPreset {
  if (value === "auto-game" || value === "bottom-root" || value === "wall-dialogue") {
    return value;
  }
  throw new Error(`Unsupported layout preset: ${value}`);
}

function parseWritingAge(value: string): NomaiWritingAge {
  if (value === "adult" || value === "teenager" || value === "child") {
    return value;
  }
  throw new Error(`Unsupported writing age: ${value}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/src/cli.ts") || process.argv[1]?.replace(/\\/g, "/").endsWith("/dist/cli.js")) {
  const result = await runCli(process.argv.slice(2));
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(`${result.stderr}\n`);
  process.exitCode = result.exitCode;
}
