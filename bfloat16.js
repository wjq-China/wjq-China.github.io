'use strict';

// Minimal bfloat16 polyfill: global.bfloat16 = { BFloat16Array, roundToBFloat16Bits, convertToNumber }
(function (global) {
  const buf = new ArrayBuffer(4);
  const f32 = new Float32Array(buf);
  const u32 = new Uint32Array(buf);

  function toBits(num) { f32[0] = num; return u32[0] >>> 0; }
  function fromBits(bits) { u32[0] = bits >>> 0; return f32[0]; }

  // JS number -> bfloat16 16-bit word (round to nearest, ties-to-even)
  function roundToBFloat16Bits(num) {
    let x = toBits(num);  // 浮点转为整数
    const exp = (x >>> 23) & 0xFF;
    let top = x >>> 16;
    if (exp !== 0xFF) { // exclude Inf/NaN
      const lower = x & 0xFFFF;
      const lsb = top & 1;
      if (lower > 0x8000 || (lower === 0x8000 && lsb === 1)) top = (top + 1) & 0xFFFF;
    }
    return top;
  }

  // bfloat16 16-bit word -> JS number (via float32 reconstruction)
  function convertToNumber(bits16) {
    return fromBits((bits16 & 0xFFFF) << 16);
  }

  class BFloat16Array {
    constructor(arg) {
      if (typeof arg === 'number') {
        this._u16 = new Uint16Array(arg);
      } else if (arg instanceof ArrayBuffer) {
        this._u16 = new Uint16Array(arg);
      } else if (Array.isArray(arg)) { // [3.12] 走这个
        this._u16 = new Uint16Array(arg.length);
        for (let i = 0; i < arg.length; i++) this._u16[i] = roundToBFloat16Bits(arg[i]);
      } else if (ArrayBuffer.isView(arg) && !(arg instanceof DataView)) {
        const arr = Array.from(arg);
        this._u16 = new Uint16Array(arr.length);
        for (let i = 0; i < arr.length; i++) this._u16[i] = roundToBFloat16Bits(arr[i]);
      } else {
        this._u16 = new Uint16Array(0);
      }

      Object.defineProperty(this, 'buffer', { get: () => this._u16.buffer });
      Object.defineProperty(this, 'length', { get: () => this._u16.length }); // lenght=1

      for (let i = 0; i < this._u16.length; i++) {
        Object.defineProperty(this, i, {
          enumerable: true,
          configurable: true,
          get: () => convertToNumber(this._u16[i]),
          set: (v) => { this._u16[i] = roundToBFloat16Bits(v); },
        });
      }
    }
  }

  global.bfloat16 = { BFloat16Array, roundToBFloat16Bits, convertToNumber };
})(typeof globalThis !== 'undefined' ? globalThis : window);