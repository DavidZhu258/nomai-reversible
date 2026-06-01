import { encodePacket } from "../core/codec";
import type { DecodedPacket, RenderOptions } from "../core/types";
import { decodeNomaiSvg } from "../decode/svgDecoder";
import { renderNomaiSvg } from "../render/svgRenderer";
import { buildNomaiTokenQrSvg, buildNomaiTokenScanUrl, embedTokenQrSvg } from "./tokenQrSvg";

export interface WebEncodeInput extends RenderOptions {
  originalText: string;
  includeQrToken?: boolean;
}

export interface WebEncodeResult {
  svg: string;
  tokenStream: string;
  tokenQrSvg: string;
  qrScanUrl: string;
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
  const svg = renderNomaiSvg(input.originalText, {
    pivotEnglish: input.pivotEnglish,
    sourceLang: input.sourceLang || "auto",
    seed: input.seed,
    handwriting: input.handwriting,
    style: "nomai-text-jl"
  });

  return {
    svg: input.includeQrToken ? embedTokenQrSvg(svg, packet.tokenStream) : svg,
    tokenStream: packet.tokenStream,
    tokenQrSvg: buildNomaiTokenQrSvg(packet.tokenStream),
    qrScanUrl: buildNomaiTokenScanUrl(packet.tokenStream),
    sourceLang: packet.envelope.sourceLang,
    pivotEnglish: packet.envelope.pivotEnglish
  };
}

export function decodeNomaiImage(svgOrTokenStream: string): DecodedPacket {
  return decodeNomaiSvg(svgOrTokenStream);
}
