import { encodePacket } from "../core/codec";
import type { RenderOptions } from "../core/types";
import { renderNomaiGlyphGraphSvg } from "./nomaiGlyphRenderer";

export function renderNomaiSvg(text: string, options: RenderOptions = {}): string {
  const packet = encodePacket({
    originalText: text,
    pivotEnglish: options.pivotEnglish,
    sourceLang: options.sourceLang,
    seed: options.seed,
    handwriting: options.handwriting,
    style: options.style
  });

  const visualText = packet.envelope.originalText || " ";
  return renderNomaiGlyphGraphSvg(packet, visualText, {
    textBlocks: options.textBlocks,
    layoutPreset: options.layoutPreset,
    writingAge: options.writingAge
  });
}
