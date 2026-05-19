import { encodePacket } from "../core/codec";
import type { DecodedPacket, RenderOptions } from "../core/types";
import { decodeNomaiSvg } from "../decode/svgDecoder";
import { renderNomaiSvg } from "../render/svgRenderer";

export interface WebEncodeInput extends RenderOptions {
  originalText: string;
}

export interface WebEncodeResult {
  svg: string;
  tokenStream: string;
  sourceLang: string;
  pivotEnglish: string | null;
}

export function encodeToNomaiImage(input: WebEncodeInput): WebEncodeResult {
  const packet = encodePacket({
    originalText: input.originalText,
    pivotEnglish: input.pivotEnglish,
    sourceLang: input.sourceLang || "auto",
    seed: input.seed,
    handwriting: input.handwriting,
    style: "nomai-text-jl"
  });
  return {
    svg: renderNomaiSvg(input.originalText, {
      pivotEnglish: input.pivotEnglish,
      sourceLang: input.sourceLang || "auto",
      seed: input.seed,
      handwriting: input.handwriting,
      style: "nomai-text-jl"
    }),
    tokenStream: packet.tokenStream,
    sourceLang: packet.envelope.sourceLang,
    pivotEnglish: packet.envelope.pivotEnglish
  };
}

export function decodeNomaiImage(svgOrTokenStream: string): DecodedPacket {
  return decodeNomaiSvg(svgOrTokenStream);
}

