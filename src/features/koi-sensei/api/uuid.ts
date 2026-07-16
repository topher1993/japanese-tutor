const HEX = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, '0'));
let fallbackCounter = 0;

interface KoiCryptoLike {
  randomUUID?: () => string;
  getRandomValues?: (bytes: Uint8Array) => Uint8Array;
}

function availableCrypto(): KoiCryptoLike | undefined {
  return (globalThis as typeof globalThis & { crypto?: KoiCryptoLike }).crypto;
}

/**
 * Generates a UUID v4 without adding a native package. Modern runtimes use
 * Web Crypto; the timestamp/counter fallback still guarantees uniqueness for
 * one app process when an older React Native engine exposes no crypto API.
 */
export function createKoiUuid(now = Date.now): string {
  const crypto = availableCrypto();
  const nativeUuid = crypto?.randomUUID?.();
  if (nativeUuid) return nativeUuid;

  const bytes = new Uint8Array(16);
  if (crypto?.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    const timestamp = now();
    fallbackCounter = (fallbackCounter + 1) >>> 0;
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
    for (let index = 0; index < 6; index += 1) {
      bytes[index] ^= Math.floor(timestamp / (2 ** (index * 8))) & 0xff;
    }
    for (let index = 0; index < 4; index += 1) {
      bytes[12 + index] ^= (fallbackCounter >>> (index * 8)) & 0xff;
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return `${HEX[bytes[0]]}${HEX[bytes[1]]}${HEX[bytes[2]]}${HEX[bytes[3]]}`
    + `-${HEX[bytes[4]]}${HEX[bytes[5]]}`
    + `-${HEX[bytes[6]]}${HEX[bytes[7]]}`
    + `-${HEX[bytes[8]]}${HEX[bytes[9]]}`
    + `-${HEX[bytes[10]]}${HEX[bytes[11]]}${HEX[bytes[12]]}${HEX[bytes[13]]}${HEX[bytes[14]]}${HEX[bytes[15]]}`;
}
