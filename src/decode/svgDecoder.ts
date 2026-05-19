import { decodePacket } from "../core/codec";
import type { DecodedPacket } from "../core/types";

export function decodeNomaiSvg(svgOrTokenStream: string): DecodedPacket {
  const trimmed = svgOrTokenStream.trim();
  if (trimmed.startsWith("NOMAI1-")) {
    return decodePacket(trimmed);
  }

  const metadataMatch = trimmed.match(/<metadata[^>]*type=["']application\/nomai\+json["'][^>]*>([\s\S]*?)<\/metadata>/i);
  if (metadataMatch) {
    const metadata = JSON.parse(unescapeXml(metadataMatch[1].trim())) as { tokenStream?: string };
    if (metadata.tokenStream) {
      return decodePacket(metadata.tokenStream);
    }
  }

  const dataMatch = trimmed.match(/data-nomai-token-stream=["']([^"']+)["']/i);
  if (dataMatch) {
    return decodePacket(unescapeXml(dataMatch[1]));
  }

  throw new Error("No reversible Nomai metadata or token stream found");
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unescapeXml(value: string): string {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

