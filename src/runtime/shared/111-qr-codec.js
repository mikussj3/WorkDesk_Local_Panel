// Koder QR (ISO/IEC 18004, poziom M, wersje 1-10) — czysty moduł bez zależności od DOM.
// Wydzielony z 110-utilities-widgets.js w Fazie 4 audytu, aby umożliwić testy jednostkowe
// i mieć jedno źródło tabel CAPS_M (poprawki W12 Faz 2-3).
const QR = function() {
    const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
    !function() {
        let x = 1;
        for (let i = 0; i < 255; i++) EXP[i] = x, LOG[x] = i, x <<= 1, 256 & x && (x ^= 285);
        for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
    }();
    const gfMul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;
    function rsEncode(data, ecLen) {
        const gen = function(degree) {
            let poly = [ 1 ];
            for (let i = 0; i < degree; i++) {
                const next = new Array(poly.length + 1).fill(0);
                for (let j = 0; j < poly.length; j++) next[j] ^= poly[j], next[j + 1] ^= gfMul(poly[j], EXP[i]);
                poly = next;
            }
            return poly;
        }(ecLen), result = new Array(ecLen).fill(0);
        for (const b of data) {
            const factor = b ^ result[0];
            if (result.shift(), result.push(0), factor) for (let i = 0; i < ecLen; i++) result[i] ^= gfMul(gen[i + 1], factor);
        }
        return result;
    }
    const CAPS_M = [ {
        v: 1,
        total: 26,
        data: 16,
        ec: 10,
        blocks: [ [ 16, 10 ] ]
    }, {
        v: 2,
        total: 44,
        data: 28,
        ec: 16,
        blocks: [ [ 28, 16 ] ]
    }, {
        v: 3,
        total: 70,
        data: 44,
        ec: 26,
        blocks: [ [ 44, 26 ] ]
    }, {
        v: 4,
        total: 100,
        data: 64,
        ec: 18,
        blocks: [ [ 32, 18 ], [ 32, 18 ] ]
    }, {
        v: 5,
        total: 134,
        data: 86,
        ec: 24,
        blocks: [ [ 43, 24 ], [ 43, 24 ] ]
    }, {
        v: 6,
        total: 172,
        data: 108,
        ec: 16,
        blocks: [ [ 27, 16 ], [ 27, 16 ], [ 27, 16 ], [ 27, 16 ] ]
    }, {
        v: 7,
        total: 196,
        data: 124,
        ec: 18,
        blocks: [ [ 31, 18 ], [ 31, 18 ], [ 31, 18 ], [ 31, 18 ] ]
    }, {
        v: 8,
        total: 242,
        data: 154,
        ec: 22,
        blocks: [ [ 38, 22 ], [ 38, 22 ], [ 39, 22 ], [ 39, 22 ] ]
    }, {
        v: 9,
        total: 292,
        data: 182,
        ec: 22,
        blocks: [ [ 36, 22 ], [ 36, 22 ], [ 36, 22 ], [ 37, 22 ], [ 37, 22 ] ]
    }, {
        v: 10,
        total: 346,
        data: 216,
        ec: 26,
        blocks: [ [ 43, 26 ], [ 43, 26 ], [ 43, 26 ], [ 43, 26 ], [ 44, 26 ] ]
    } ], ALIGN_POS = [ [], [ 6, 18 ], [ 6, 22 ], [ 6, 26 ], [ 6, 30 ], [ 6, 34 ], [ 6, 22, 38 ], [ 6, 24, 42 ], [ 6, 26, 46 ], [ 6, 28, 50 ] ];
    function newMatrix(size) {
        return Array.from({
            length: size
        }, () => new Int8Array(size).fill(-1));
    }
    function placeFinder(m, x, y) {
        const size = m.length;
        for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) {
            const px = x + dx, py = y + dy;
            if (px < 0 || py < 0 || px >= size || py >= size) continue;
            const onBorder = dx >= 0 && dx <= 6 && (0 === dy || 6 === dy) || dy >= 0 && dy <= 6 && (0 === dx || 6 === dx), inner = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
            m[py][px] = onBorder || inner ? 1 : 0;
        }
    }
    function placeAlignment(m, x, y) {
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
            const onBorder = 2 === Math.abs(dx) || 2 === Math.abs(dy), center = 0 === dx && 0 === dy;
            m[y + dy][x + dx] = onBorder || center ? 1 : 0;
        }
    }
    function placeFormat(m, maskNum) {
        const size = m.length, fmt = function(maskNum) {
            let data = 0 | maskNum, rem = data;
            for (let i = 0; i < 10; i++) rem <<= 1, 1024 & rem && (rem ^= 1335);
            return 21522 ^ (data << 10 | rem);
        }(maskNum);
        for (let i = 0; i < 15; i++) {
            const bit = fmt >> i & 1;
            i < 6 ? m[i][8] = bit : i < 8 ? m[i + 1][8] = bit : i < 9 ? m[8][7] = bit : m[8][14 - i] = bit, 
            i < 8 ? m[8][size - 1 - i] = bit : m[size - 1 - (14 - i)][8] = bit;
        }
        m[size - 8][8] = 1;
    }
    function placeData(m, codewords, maskNum) {
        const size = m.length, mask = [ (y, x) => (y + x) % 2 == 0, (y, x) => y % 2 == 0, (y, x) => x % 3 == 0, (y, x) => (y + x) % 3 == 0, (y, x) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 == 0, (y, x) => y * x % 2 + y * x % 3 == 0, (y, x) => (y * x % 2 + y * x % 3) % 2 == 0, (y, x) => ((y + x) % 2 + y * x % 3) % 2 == 0 ][maskNum];
        let bitIx = 0;
        const totalBits = 8 * codewords.length;
        let up = !0;
        for (let col = size - 1; col > 0; col -= 2) {
            6 === col && col--;
            for (let i = 0; i < size; i++) {
                const y = up ? size - 1 - i : i;
                for (let c = 0; c < 2; c++) {
                    const x = col - c;
                    if (-1 !== m[y][x]) continue;
                    let bit = 0;
                    bitIx < totalBits && (bit = codewords[bitIx >> 3] >> 7 - (7 & bitIx) & 1, bitIx++), 
                    mask(y, x) && (bit ^= 1), m[y][x] = bit;
                }
            }
            up = !up;
        }
    }
    function penalty(m) {
        const size = m.length;
        let p = 0;
        for (let y = 0; y < size; y++) {
            let rc = 1, cc = 1;
            for (let x = 1; x < size; x++) m[y][x] === m[y][x - 1] ? (rc++, 5 === rc ? p += 3 : rc > 5 && p++) : rc = 1, 
            m[x][y] === m[x - 1][y] ? (cc++, 5 === cc ? p += 3 : cc > 5 && p++) : cc = 1;
        }
        for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
            const v = m[y][x];
            v === m[y][x + 1] && v === m[y + 1][x] && v === m[y + 1][x + 1] && (p += 3);
        }
        return p;
    }
    return {
        make: function(text) {
            const {cap: cap, bytes: bytes} = function(text) {
                const data = (str = text, Array.from((new TextEncoder).encode(str)));
                var str;
                const cap = function(dataBytes) {
                    for (const cap of CAPS_M) if (8 * cap.data >= 4 + (cap.v < 10 ? 8 : 16) + 8 * dataBytes) return cap;
                    return null;
                }(data.length);
                if (!cap) throw new Error("Tekst za długi dla QR v1–10 ECC M");
                const ccBits = cap.v < 10 ? 8 : 16, buf = function() {
                    const bits = [];
                    return {
                        push(value, len) {
                            for (let i = len - 1; i >= 0; i--) bits.push(value >>> i & 1);
                        },
                        length: () => bits.length,
                        toBytes() {
                            for (;bits.length % 8 != 0; ) bits.push(0);
                            const out = [];
                            for (let i = 0; i < bits.length; i += 8) {
                                let b = 0;
                                for (let j = 0; j < 8; j++) b = b << 1 | bits[i + j];
                                out.push(b);
                            }
                            return out;
                        }
                    };
                }();
                buf.push(4, 4), buf.push(data.length, ccBits);
                for (const b of data) buf.push(b, 8);
                const maxBits = 8 * cap.data, term = Math.min(4, maxBits - buf.length());
                term > 0 && buf.push(0, term);
                let cw = buf.toBytes();
                const padBytes = [ 236, 17 ];
                for (;cw.length < cap.data; ) cw.push(padBytes[cw.length - cap.data & 1 ? 0 : 1] ?? padBytes[cw.length % 2]);
                cw = cw.slice(0, cap.data);
                const dataBlocks = [], ecBlocks = [];
                let offset = 0;
                for (const [bDataLen, bEcLen] of cap.blocks) {
                    const block = cw.slice(offset, offset + bDataLen);
                    dataBlocks.push(block), ecBlocks.push(rsEncode(block, bEcLen)), offset += bDataLen;
                }
                const maxData = Math.max(...dataBlocks.map(b => b.length)), result = [];
                for (let i = 0; i < maxData; i++) for (const b of dataBlocks) i < b.length && result.push(b[i]);
                const maxEc = Math.max(...ecBlocks.map(b => b.length));
                for (let i = 0; i < maxEc; i++) for (const b of ecBlocks) i < b.length && result.push(b[i]);
                return {
                    cap: cap,
                    bytes: result
                };
            }(text), size = 17 + 4 * cap.v;
            let best = null;
            for (let mask = 0; mask < 8; mask++) {
                const m = newMatrix(size);
                placeFinder(m, 0, 0), placeFinder(m, size - 7, 0), placeFinder(m, 0, size - 7);
                for (let i = 0; i < 8; i++) -1 === m[7][i] && (m[7][i] = 0), -1 === m[i][7] && (m[i][7] = 0), 
                -1 === m[size - 8][i] && (m[size - 8][i] = 0), -1 === m[i][size - 8] && (m[i][size - 8] = 0), 
                -1 === m[7][size - 1 - i] && (m[7][size - 1 - i] = 0), -1 === m[size - 1 - i][7] && (m[size - 1 - i][7] = 0);
                for (let i = 8; i < size - 8; i++) m[6][i] = i % 2 == 0 ? 1 : 0, m[i][6] = i % 2 == 0 ? 1 : 0;
                const positions = ALIGN_POS[cap.v - 1];
                for (const cy of positions) for (const cx of positions) cx <= 7 && cy <= 7 || cx <= 7 && cy >= size - 8 || cx >= size - 8 && cy <= 7 || placeAlignment(m, cx, cy);
                placeFormat(m, mask), placeData(m, bytes, mask), placeFormat(m, mask);
                const sc = penalty(m);
                (!best || sc < best.score) && (best = {
                    matrix: m,
                    score: sc,
                    mask: mask
                });
            }
            return best.matrix;
        },
        toSVG: function(matrix, scale = 8) {
            const size = matrix.length, total = (size + 8) * scale, off = 4 * scale;
            let path = "";
            for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) 1 === matrix[y][x] && (path += `M${off + x * scale},${off + y * scale}h${scale}v${scale}h-${scale}z`);
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">\n      <rect width="100%" height="100%" fill="#fff"/>\n      <path d="${path}" fill="#000"/>\n    </svg>`;
        },
        get capacityBytes() {
            const last = CAPS_M[CAPS_M.length - 1];
            return Math.floor((8 * last.data - 4 - (last.v < 10 ? 8 : 16)) / 8);
        },
        get caps() {
            return CAPS_M;
        }
    };
}();
