export const TOKEN_ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTVWXYZ";
export const TOKEN_BASE = BigInt(TOKEN_ALPHABET.length);

const tokenIndex = new Map([...TOKEN_ALPHABET].map((char, index) => [char, index]));

export function bytesToBase33(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return TOKEN_ALPHABET[0];
  }

  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) + BigInt(byte);
  }

  let out = "";
  while (value > 0n) {
    const digit = Number(value % TOKEN_BASE);
    out = TOKEN_ALPHABET[digit] + out;
    value /= TOKEN_BASE;
  }

  return out || TOKEN_ALPHABET[0];
}

export function base33ToBytes(input: string, expectedLength: number): Uint8Array {
  let value = 0n;
  for (const char of input) {
    const digit = tokenIndex.get(char);
    if (digit === undefined) {
      throw new Error(`Invalid Nomai token character: ${char}`);
    }
    value = value * TOKEN_BASE + BigInt(digit);
  }

  const bytes = new Uint8Array(expectedLength);
  for (let i = expectedLength - 1; i >= 0; i -= 1) {
    bytes[i] = Number(value & 0xffn);
    value >>= 8n;
  }

  if (value !== 0n) {
    throw new Error("Nomai token stream exceeds expected byte length");
  }

  return bytes;
}

export function tokenDigits(tokenBody: string): number[] {
  return [...tokenBody].map((char) => {
    const digit = tokenIndex.get(char);
    if (digit === undefined) {
      throw new Error(`Invalid Nomai token character: ${char}`);
    }
    return digit;
  });
}

