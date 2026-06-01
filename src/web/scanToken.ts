const NOMAI_TOKEN_PATTERN = /NOMAI1-[A-Za-z0-9-]+/;

export function extractNomaiTokenFromScan(scannedText: string): string | null {
  return scannedText.match(NOMAI_TOKEN_PATTERN)?.[0] ?? null;
}
