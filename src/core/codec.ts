import { bytesToBase33, base33ToBytes, tokenDigits } from "./base33";
import { crc32 } from "./crc32";
import { stableStringify } from "./stableJson";
import type { DecodedPacket, EncodedPacket, EncodePacketInput, NomaiEnvelope } from "./types";

const MAGIC = "NOMAI1";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function encodePacket(input: EncodePacketInput): EncodedPacket {
  const envelope: NomaiEnvelope = {
    version: 1,
    originalText: input.originalText,
    pivotEnglish: input.pivotEnglish ?? null,
    sourceLang: input.sourceLang ?? "auto",
    seed: Math.trunc(input.seed ?? 47),
    handwriting: Number(input.handwriting ?? 0),
    style: input.style ?? "nomai-text-jl",
    createdBy: "nomai-reversible"
  };

  const json = stableStringify(envelope as unknown as Record<string, unknown> as never);
  const bytes = textEncoder.encode(json);
  const checksum = crc32(bytes);
  const body = bytesToBase33(bytes);
  const tokenStream = `${MAGIC}-${bytes.length.toString(36)}-${checksum}-${body}`;

  return {
    tokenStream,
    envelope,
    checksum,
    glyphDigits: tokenDigits(body)
  };
}

export function decodePacket(tokenStream: string): DecodedPacket {
  const [magic, byteLengthText, checksum, body] = tokenStream.trim().split("-");
  if (magic !== MAGIC || !byteLengthText || !checksum || !body) {
    throw new Error("Invalid Nomai token stream header");
  }

  const expectedLength = Number.parseInt(byteLengthText, 36);
  if (!Number.isFinite(expectedLength) || expectedLength < 0) {
    throw new Error("Invalid Nomai token stream byte length");
  }

  const bytes = base33ToBytes(body, expectedLength);
  const actualChecksum = crc32(bytes);
  if (actualChecksum !== checksum) {
    throw new Error(`Nomai checksum mismatch: expected ${checksum}, got ${actualChecksum}`);
  }

  const parsed = JSON.parse(textDecoder.decode(bytes)) as NomaiEnvelope;
  if (parsed.version !== 1 || parsed.createdBy !== "nomai-reversible") {
    throw new Error("Unsupported Nomai packet version");
  }

  return {
    ...parsed,
    checksumOk: true,
    tokenStream,
    glyphDigits: tokenDigits(body)
  };
}

export function tokenBody(tokenStream: string): string {
  const body = tokenStream.trim().split("-")[3];
  if (!body) {
    throw new Error("Invalid Nomai token stream body");
  }
  return body;
}

