export type NomaiStyle = "nomai-text-jl";
export type NomaiLayoutPreset = "auto-game" | "bottom-root" | "wall-dialogue";
export type NomaiWritingAge = "adult" | "teenager" | "child";

export interface NomaiTextBlock {
  id: string;
  parentId?: string | null;
  speaker?: string | null;
  text: string;
}

export interface EncodePacketInput {
  originalText: string;
  pivotEnglish?: string;
  sourceLang?: string;
  seed?: number;
  handwriting?: number;
  style?: NomaiStyle;
}

export interface NomaiEnvelope {
  version: 1;
  originalText: string;
  pivotEnglish: string | null;
  sourceLang: string;
  seed: number;
  handwriting: number;
  style: NomaiStyle;
  createdBy: "nomai-reversible";
}

export interface EncodedPacket {
  tokenStream: string;
  envelope: NomaiEnvelope;
  checksum: string;
  glyphDigits: number[];
}

export interface DecodedPacket extends NomaiEnvelope {
  checksumOk: boolean;
  tokenStream: string;
  glyphDigits: number[];
}

export interface RenderOptions {
  pivotEnglish?: string;
  sourceLang?: string;
  seed?: number;
  handwriting?: number;
  style?: NomaiStyle;
  textBlocks?: NomaiTextBlock[];
  layoutPreset?: NomaiLayoutPreset;
  writingAge?: NomaiWritingAge;
}
