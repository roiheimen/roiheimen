import { define, html } from "/web_modules/heresy.js";

/**
 * QR Code component that generates QR codes using a pure client-side approach.
 * Uses a lightweight canvas-based QR code generator.
 *
 * Usage:
 *   <roi-qr-code data="https://example.com/invite/ABC123" size="200"></roi-qr-code>
 *
 * Attributes:
 *   - data: The data to encode in the QR code (required)
 *   - size: The size of the QR code in pixels (default: 200)
 *   - label: Optional label to display below the QR code
 */
define("RoiQrCode", {
  mappedAttributes: ["data", "size", "label"],
  oninit() {
    this.canvas = null;
    this.state = {
      error: null,
      loaded: false,
    };
    // Default size
    this._size = 200;
  },
  onconnected() {
    this.generateQRCode();
  },
  onattributechanged(event) {
    if (event.attributeName === "data" || event.attributeName === "size") {
      this.generateQRCode();
    }
  },
  style(self) {
    return `
    ${self} {
      display: inline-block;
      text-align: center;
    }
    ${self} .qr-container {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      padding: 16px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    ${self} canvas {
      display: block;
      image-rendering: pixelated;
    }
    ${self} .qr-label {
      margin-top: 12px;
      font-size: 14px;
      color: #666;
      word-break: break-all;
      max-width: 100%;
    }
    ${self} .qr-error {
      color: #dc2626;
      padding: 16px;
      font-size: 14px;
    }
    ${self} .qr-actions {
      margin-top: 12px;
      display: flex;
      gap: 8px;
    }
    ${self} .download-btn {
      padding: 8px 16px;
      background: var(--roi-primary);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    ${self} .download-btn:hover {
      opacity: 0.9;
    }
    `;
  },
  getSize() {
    const size = parseInt(this.size) || this._size;
    return Math.min(Math.max(size, 100), 500); // Clamp between 100 and 500
  },
  generateQRCode() {
    if (!this.data) {
      this.state.error = "Ingen data å koda";
      this.state.loaded = false;
      this.render();
      return;
    }

    this.state.error = null;

    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      try {
        const canvas = this.querySelector("canvas");
        if (!canvas) return;

        this.canvas = canvas;
        const size = this.getSize();
        const ctx = canvas.getContext("2d");

        // Generate QR code matrix
        const qr = this.createQRMatrix(this.data);
        const moduleCount = qr.length;
        const moduleSize = Math.floor(size / (moduleCount + 8)); // Add quiet zone
        const actualSize = moduleSize * (moduleCount + 8);

        canvas.width = actualSize;
        canvas.height = actualSize;

        // Fill white background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, actualSize, actualSize);

        // Draw QR modules
        ctx.fillStyle = "#000000";
        const offset = moduleSize * 4; // Quiet zone

        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount; col++) {
            if (qr[row][col]) {
              ctx.fillRect(
                offset + col * moduleSize,
                offset + row * moduleSize,
                moduleSize,
                moduleSize
              );
            }
          }
        }

        this.state.loaded = true;
        this.render();
      } catch (err) {
        console.error("QR code generation error:", err);
        this.state.error = "Kunne ikkje laga QR-kode";
        this.render();
      }
    });
  },

  /**
   * Creates a QR code matrix using a simplified algorithm.
   * Supports alphanumeric mode for URLs.
   */
  createQRMatrix(data) {
    // Use a minimal QR code implementation
    // This is a simplified version that works for short URLs
    const qr = new QRCode(data);
    return qr.modules;
  },

  onclick(event) {
    const { action } = event.target.dataset;
    if (action === "download") {
      this.downloadQRCode();
    }
  },

  downloadQRCode() {
    if (!this.canvas) return;

    const link = document.createElement("a");
    link.download = "qr-code.png";
    link.href = this.canvas.toDataURL("image/png");
    link.click();
  },

  render() {
    const { error, loaded } = this.state;
    const size = this.getSize();

    if (error) {
      return this.html`<div class="qr-container"><div class="qr-error">${error}</div></div>`;
    }

    return this.html`
      <div class="qr-container">
        <canvas width=${size} height=${size}></canvas>
        ${this.label ? html`<div class="qr-label">${this.label}</div>` : ""}
        ${loaded
          ? html`
              <div class="qr-actions">
                <button class="download-btn" data-action="download" onclick=${this}>
                  Last ned
                </button>
              </div>
            `
          : ""}
      </div>
    `;
  },
});

/**
 * Minimal QR Code generator class
 * Based on QR Code specification ISO/IEC 18004
 * Supports version 1-4 with error correction level L
 */
class QRCode {
  constructor(data) {
    this.data = data;
    this.modules = [];
    this.moduleCount = 0;

    // Determine version based on data length
    this.version = this.getVersion(data);
    this.moduleCount = this.version * 4 + 17;

    // Initialize modules
    this.modules = Array(this.moduleCount)
      .fill(null)
      .map(() => Array(this.moduleCount).fill(null));

    // Generate QR code
    this.generate();
  }

  getVersion(data) {
    const len = data.length;
    // Version capacity for byte mode with error correction L
    if (len <= 17) return 1;
    if (len <= 32) return 2;
    if (len <= 53) return 3;
    if (len <= 78) return 4;
    if (len <= 106) return 5;
    if (len <= 134) return 6;
    if (len <= 154) return 7;
    return 8; // Max supported in this implementation
  }

  generate() {
    // Setup patterns
    this.setupPositionPatterns();
    this.setupTimingPatterns();
    this.setupAlignmentPattern();
    this.setupFormatInfo();

    // Encode data
    const bits = this.encodeData();
    this.placeData(bits);

    // Apply mask (pattern 0 for simplicity)
    this.applyMask(0);
  }

  setupPositionPatterns() {
    // Three position detection patterns at corners
    const positions = [
      [0, 0],
      [this.moduleCount - 7, 0],
      [0, this.moduleCount - 7],
    ];

    for (const [row, col] of positions) {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (
            r === 0 ||
            r === 6 ||
            c === 0 ||
            c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            this.modules[row + r][col + c] = true;
          } else {
            this.modules[row + r][col + c] = false;
          }
        }
      }
    }

    // Separators (white border around position patterns)
    for (let i = 0; i < 8; i++) {
      // Top-left
      if (i < this.moduleCount) {
        this.modules[7][i] = false;
        this.modules[i][7] = false;
      }
      // Top-right
      if (this.moduleCount - 8 + i < this.moduleCount) {
        this.modules[7][this.moduleCount - 8 + i] = false;
        if (i < 8) this.modules[i][this.moduleCount - 8] = false;
      }
      // Bottom-left
      if (this.moduleCount - 8 + i < this.moduleCount) {
        this.modules[this.moduleCount - 8][i] = false;
        if (i < 8) this.modules[this.moduleCount - 8 + i][7] = false;
      }
    }
  }

  setupTimingPatterns() {
    // Horizontal and vertical timing patterns
    for (let i = 8; i < this.moduleCount - 8; i++) {
      const dark = i % 2 === 0;
      if (this.modules[6][i] === null) this.modules[6][i] = dark;
      if (this.modules[i][6] === null) this.modules[i][6] = dark;
    }
  }

  setupAlignmentPattern() {
    // Alignment patterns for version 2+
    if (this.version < 2) return;

    const positions = this.getAlignmentPositions();
    for (const row of positions) {
      for (const col of positions) {
        // Skip if overlaps with position patterns
        if (this.modules[row][col] !== null) continue;

        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            if (
              Math.abs(r) === 2 ||
              Math.abs(c) === 2 ||
              (r === 0 && c === 0)
            ) {
              this.modules[row + r][col + c] = true;
            } else {
              this.modules[row + r][col + c] = false;
            }
          }
        }
      }
    }
  }

  getAlignmentPositions() {
    // Alignment pattern positions by version
    const table = {
      2: [6, 18],
      3: [6, 22],
      4: [6, 26],
      5: [6, 30],
      6: [6, 34],
      7: [6, 22, 38],
      8: [6, 24, 42],
    };
    return table[this.version] || [];
  }

  setupFormatInfo() {
    // Format info (error correction L, mask 0)
    const formatBits = 0b111011111000100; // EC Level L, Mask 0

    // Place format info
    for (let i = 0; i < 15; i++) {
      const bit = ((formatBits >> (14 - i)) & 1) === 1;

      // Around top-left position pattern
      if (i < 6) {
        this.modules[i][8] = bit;
      } else if (i < 8) {
        this.modules[i + 1][8] = bit;
      } else {
        this.modules[this.moduleCount - 15 + i][8] = bit;
      }

      // Around top-right and bottom-left position patterns
      if (i < 8) {
        this.modules[8][this.moduleCount - i - 1] = bit;
      } else {
        this.modules[8][15 - i - 1] = bit;
      }
    }

    // Dark module
    this.modules[this.moduleCount - 8][8] = true;
  }

  encodeData() {
    const bits = [];

    // Mode indicator (0100 = byte mode)
    bits.push(0, 1, 0, 0);

    // Character count indicator (8 bits for version 1-9)
    const len = this.data.length;
    for (let i = 7; i >= 0; i--) {
      bits.push((len >> i) & 1);
    }

    // Data bytes
    for (let i = 0; i < this.data.length; i++) {
      const byte = this.data.charCodeAt(i);
      for (let j = 7; j >= 0; j--) {
        bits.push((byte >> j) & 1);
      }
    }

    // Terminator (up to 4 zeros)
    const capacity = this.getDataCapacity();
    while (bits.length < capacity && bits.length < bits.length + 4) {
      bits.push(0);
    }

    // Pad to byte boundary
    while (bits.length % 8 !== 0) {
      bits.push(0);
    }

    // Pad bytes
    const padBytes = [0b11101100, 0b00010001];
    let padIndex = 0;
    while (bits.length < capacity) {
      const pad = padBytes[padIndex % 2];
      for (let i = 7; i >= 0; i--) {
        if (bits.length < capacity) {
          bits.push((pad >> i) & 1);
        }
      }
      padIndex++;
    }

    // Add error correction
    return this.addErrorCorrection(bits);
  }

  getDataCapacity() {
    // Data capacity in bits for EC level L
    const capacities = {
      1: 152,
      2: 272,
      3: 440,
      4: 640,
      5: 864,
      6: 1088,
      7: 1248,
      8: 1552,
    };
    return capacities[this.version] || 152;
  }

  addErrorCorrection(dataBits) {
    // Convert bits to bytes
    const dataBytes = [];
    for (let i = 0; i < dataBits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8 && i + j < dataBits.length; j++) {
        byte = (byte << 1) | dataBits[i + j];
      }
      dataBytes.push(byte);
    }

    // EC codewords count by version (EC level L)
    const ecCounts = {
      1: 7,
      2: 10,
      3: 15,
      4: 20,
      5: 26,
      6: 18,
      7: 20,
      8: 24,
    };
    const ecCount = ecCounts[this.version] || 7;

    // Generate Reed-Solomon error correction
    const ecBytes = this.generateEC(dataBytes, ecCount);

    // Combine data and EC bytes back to bits
    const allBytes = [...dataBytes, ...ecBytes];
    const allBits = [];
    for (const byte of allBytes) {
      for (let i = 7; i >= 0; i--) {
        allBits.push((byte >> i) & 1);
      }
    }

    return allBits;
  }

  generateEC(data, ecCount) {
    // Reed-Solomon generator polynomial coefficients
    const gp = this.getGeneratorPolynomial(ecCount);

    // Initialize message polynomial
    const mp = [...data, ...Array(ecCount).fill(0)];

    // Polynomial division
    for (let i = 0; i < data.length; i++) {
      const coef = mp[i];
      if (coef !== 0) {
        for (let j = 0; j < gp.length; j++) {
          mp[i + j] ^= this.gfMul(gp[j], coef);
        }
      }
    }

    // Return remainder (EC codewords)
    return mp.slice(data.length);
  }

  getGeneratorPolynomial(degree) {
    // Generator polynomial for Reed-Solomon
    let gp = [1];
    for (let i = 0; i < degree; i++) {
      const next = Array(gp.length + 1).fill(0);
      const alpha = this.gfPow(2, i);
      for (let j = 0; j < gp.length; j++) {
        next[j] ^= gp[j];
        next[j + 1] ^= this.gfMul(gp[j], alpha);
      }
      gp = next;
    }
    return gp;
  }

  gfPow(base, exp) {
    // Galois field power
    let result = 1;
    for (let i = 0; i < exp; i++) {
      result = this.gfMul(result, base);
    }
    return result;
  }

  gfMul(a, b) {
    // Galois field multiplication in GF(2^8)
    if (a === 0 || b === 0) return 0;
    let result = 0;
    for (let i = 0; i < 8; i++) {
      if (b & 1) result ^= a;
      const hi = a & 0x80;
      a = (a << 1) & 0xff;
      if (hi) a ^= 0x1d; // Primitive polynomial: x^8 + x^4 + x^3 + x^2 + 1
      b >>= 1;
    }
    return result;
  }

  placeData(bits) {
    let bitIndex = 0;
    let up = true;

    // Place data bits in zigzag pattern
    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col = 5; // Skip timing pattern column

      for (let i = 0; i < this.moduleCount; i++) {
        const row = up ? this.moduleCount - 1 - i : i;

        for (let c = 0; c < 2; c++) {
          const currentCol = col - c;
          if (this.modules[row][currentCol] === null) {
            this.modules[row][currentCol] =
              bitIndex < bits.length ? bits[bitIndex] === 1 : false;
            bitIndex++;
          }
        }
      }
      up = !up;
    }
  }

  applyMask(pattern) {
    // Apply mask pattern 0: (row + col) % 2 === 0
    for (let row = 0; row < this.moduleCount; row++) {
      for (let col = 0; col < this.moduleCount; col++) {
        if (this.isDataModule(row, col)) {
          let mask = false;
          switch (pattern) {
            case 0:
              mask = (row + col) % 2 === 0;
              break;
            case 1:
              mask = row % 2 === 0;
              break;
            case 2:
              mask = col % 3 === 0;
              break;
            case 3:
              mask = (row + col) % 3 === 0;
              break;
            case 4:
              mask = (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
              break;
            case 5:
              mask = ((row * col) % 2) + ((row * col) % 3) === 0;
              break;
            case 6:
              mask = (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
              break;
            case 7:
              mask = (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
              break;
          }
          if (mask) {
            this.modules[row][col] = !this.modules[row][col];
          }
        }
      }
    }
  }

  isDataModule(row, col) {
    // Check if this module is a data module (not a function pattern)
    // Position patterns
    if (row < 9 && col < 9) return false; // Top-left
    if (row < 9 && col >= this.moduleCount - 8) return false; // Top-right
    if (row >= this.moduleCount - 8 && col < 9) return false; // Bottom-left

    // Timing patterns
    if (row === 6 || col === 6) return false;

    // Alignment patterns (simplified check)
    if (this.version >= 2) {
      const positions = this.getAlignmentPositions();
      for (const r of positions) {
        for (const c of positions) {
          if (Math.abs(row - r) <= 2 && Math.abs(col - c) <= 2) {
            // Skip if overlaps with position patterns
            if (r < 9 && c < 9) continue;
            if (r < 9 && c >= this.moduleCount - 9) continue;
            if (r >= this.moduleCount - 9 && c < 9) continue;
            return false;
          }
        }
      }
    }

    return true;
  }
}
