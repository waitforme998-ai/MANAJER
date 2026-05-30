/**
 * Pure JavaScript MD5 Hashing function.
 * Used for generating Gravatar email profile picture hashes.
 */
export function md5(str: string): string {
  let k: number[] = [];
  let i = 0;
  for (; i < 64; ) {
    k[i] = Math.sin(++i) * 4294967296 | 0;
  }
  
  let h0 = 0x67452301;
  let h1 = 0xEFCDAB89;
  let h2 = 0x98BADCFE;
  let h3 = 0x10325476;
  
  const words: number[] = [];
  const s = str + "\x80";
  const len = s.length;
  const numBlocks = ((len + 8) >> 6) + 1;
  
  for (i = 0; i < numBlocks * 16; i++) {
    words[i] = 0;
  }
  for (i = 0; i < len; i++) {
    words[i >> 2] |= s.charCodeAt(i) << ((i % 4) * 8);
  }
  words[(numBlocks * 16) - 2] = (str.length * 8) & 0xffffffff;
  words[(numBlocks * 16) - 1] = Math.floor(str.length / 0x20000000);
  
  const rotateLeft = (l: number, r: number) => (l << r) | (l >>> (32 - r));
  
  for (i = 0; i < words.length; i += 16) {
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let f = 0;
    let g = 0;
    
    for (let j = 0; j < 64; j++) {
      if (j < 16) {
        f = (b & c) | (~b & d);
        g = j;
      } else if (j < 32) {
        f = (d & b) | (~d & c);
        g = (5 * j + 1) % 16;
      } else if (j < 48) {
        f = b ^ c ^ d;
        g = (3 * j + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * j) % 16;
      }
      
      const temp = d;
      d = c;
      c = b;
      b = (b + rotateLeft(a + f + k[j] + words[i + g], [
        7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,
        5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,
        4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,
        6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21
      ][j])) | 0;
      a = temp;
    }
    
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
  }
  
  const toHex = (n: number) => {
    let out = "";
    for (let j = 0; j < 4; j++) {
      const b = (n >> (j * 8)) & 0xff;
      out += (b < 16 ? "0" : "") + b.toString(16);
    }
    return out;
  };
  
  return toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3);
}
