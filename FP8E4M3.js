'use strict';

// FP8 E4M3 polyfill: global.fp8e4m3 = { FP8E4M3Array, roundToFP8E4M3Bits, convertToNumber }
(function (global) {
  const buf = new ArrayBuffer(4);
  const f32 = new Float32Array(buf);
  const u32 = new Uint32Array(buf);

  function toBits(num) { f32[0] = num; return u32[0] >>> 0; }
  function fromBits(bits) { u32[0] = bits >>> 0; return f32[0]; }

  // JS number -> FP8 E4M3 8-bit word
  // FP8 E4M3: 1 sign bit, 4 exponent bits, 3 mantissa bits
function roundToFP8E4M3Bits(num) {  // float32 -> fp8e4m3 bits
  if (num === 0) return 0;
  if (isNaN(num)) return 0x7F; // NaN (exp=15, mantissa=111)
  if (!isFinite(num)) return num < 0 ? 0xF8 : 0x78; // Infinity (exp=15, mantissa=000)
  
  const sign = num < 0 ? 1 : 0;
  num = Math.abs(num);
  
  // Convert to binary representation
  const f32Bits = toBits(num);
  const f32Exp = ((f32Bits >>> 23) & 0xFF) - 127; // Remove F32 bias
  const f32Mantissa = f32Bits & 0x7FFFFF;
  
  // FP8 E4M3 bias is 7 (2^(4-1) - 1)
  const fp8Bias = 7;
  let fp8Exp = f32Exp + fp8Bias;
  
  // Handle denormal numbers
  if (fp8Exp <= 0) {
    // Denormal case
    const shift = 1 - fp8Exp;
    if (shift > 3) return sign << 7; // Underflow to zero
    
    // Extract mantissa with implicit 1 for denormal calculation
    const fullMantissa = 0x800000 | f32Mantissa;
    let mantissa = fullMantissa >>> (23 - 3 + shift);
    
    // Improved round to nearest, ties to even
    const roundBitPos = 23 - 3 + shift - 1;
    const roundBit = (fullMantissa >>> roundBitPos) & 1;
    const stickyBit = (fullMantissa & ((1 << roundBitPos) - 1)) !== 0;
    
    if (roundBit && (stickyBit || (mantissa & 1))) {
      mantissa++;
      // Check for overflow in denormal case
      if (mantissa > 0x7) {
        // Mantissa overflow: becomes normalized number with exp=1
        return (sign << 7) | (1 << 3) | 0x0;
      }
    }
    
    return (sign << 7) | (mantissa & 0x7);
  }
  
  // Handle overflow
  if (fp8Exp >= 15) {
    return (sign << 7) | 0x78; // Infinity (exp=15, mantissa=000)
  }
  
  // Normal case
  let mantissa = f32Mantissa >>> (23 - 3); // Take top 3 bits
  
  // Round to nearest, ties to even
  const roundBit = (f32Mantissa >>> (23 - 3 - 1)) & 1;
  const stickyBit = (f32Mantissa & ((1 << (23 - 3 - 1)) - 1)) !== 0;
  
  if (roundBit && (stickyBit || (mantissa & 1))) {
    mantissa++;
    if (mantissa > 0x7) {
      mantissa = 0;
      fp8Exp++;
      if (fp8Exp >= 15) {
        return (sign << 7) | 0x78; // Overflow to infinity (exp=15, mantissa=000)
      }
    }
  }
  
  return (sign << 7) | (fp8Exp << 3) | mantissa;
}

  // FP8 E4M3 8-bit word -> JS number
  function convertToNumber(bits8) {
    bits8 = bits8 & 0xFF;
    
    const sign = (bits8 >>> 7) & 1;
    const exp = (bits8 >>> 3) & 0xF;
    const mantissa = bits8 & 0x7;
    
    if (exp === 0) {
      if (mantissa === 0) {
        return sign ? -0 : 0;
      }
      // Denormal number
      const value = mantissa * Math.pow(2, -9); // 2^(1-7-3) = 2^-9
      return sign ? -value : value;
    }
    
    if (exp === 15) {
      if (mantissa === 0) {
        return sign ? -Infinity : Infinity;
      }
      return NaN;
    }
    
    // Normal number
    const value = (1 + mantissa / 8) * Math.pow(2, exp - 7);
    return sign ? -value : value;
  }

  class FP8E4M3Array {
    constructor(arg) {
      if (typeof arg === 'number') {
        this._u8 = new Uint8Array(arg);
      } else if (arg instanceof ArrayBuffer) {
        this._u8 = new Uint8Array(arg);
      } else if (Array.isArray(arg)) {
        this._u8 = new Uint8Array(arg.length);
        for (let i = 0; i < arg.length; i++) {
          this._u8[i] = roundToFP8E4M3Bits(arg[i]);
        }
      } else if (ArrayBuffer.isView(arg) && !(arg instanceof DataView)) {
        const arr = Array.from(arg);
        this._u8 = new Uint8Array(arr.length);
        for (let i = 0; i < arr.length; i++) {
          this._u8[i] = roundToFP8E4M3Bits(arr[i]);
        }
      } else {
        this._u8 = new Uint8Array(0);
      }

      Object.defineProperty(this, 'buffer', { get: () => this._u8.buffer });
      Object.defineProperty(this, 'length', { get: () => this._u8.length });

      for (let i = 0; i < this._u8.length; i++) { // _u8是一个array
        Object.defineProperty(this, i, {
          enumerable: true,
          configurable: true,
          get: () => convertToNumber(this._u8[i]),  // 通过array[i]访问时，返回转换后的number
          set: (v) => { this._u8[i] = roundToFP8E4M3Bits(v); },  // 通过array[i] = value时，存储转换后的FP8 E4M3 bits
        });
      }
    }
  }

  global.fp8e4m3 = { FP8E4M3Array, roundToFP8E4M3Bits, convertToNumber };
})(typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);
