/**
 * decoder - methods for decoding weather data
 *
 * Copyright (c) 2015 Cameron Beccario
 */
(function() {
    "use strict";

    var decoder = {};

    /**
     * Decodes a UTF8 string from an array of bytes.
     *
     * @param {Uint8Array} bytes an array of bytes
     * @returns {String} the decoded String
     */
    decoder.decodeUTF8 = function(bytes) {
        var charCodes = [];
        for (var i = 0; i < bytes.length;) {
            var b = bytes[i++];
            switch (b >> 4) {
                case 0xc:
                case 0xd:
                    b = (b & 0x1f) << 6 | bytes[i++] & 0x3f;
                    break;
                case 0xe:
                    b = (b & 0x0f) << 12 | (bytes[i++] & 0x3f) << 6 | bytes[i++] & 0x3f;
                    break;
                default:
                    // use value as-is
            }
            charCodes.push(b);
        }
        return String.fromCharCode.apply(null, charCodes);
    };

/*
    function blockView(data, cols, rows) {
        var area = cols * rows;
        return {
            x: function(i) {
                return i % cols;
            },
            y: function(i) {
                return Math.floor(i / cols) % rows;
            },
            z: function(i) {
                return Math.floor(i / area);
            },
            valueAt: function(x, y, z) {
                if (0 <= x && x < cols) {
                    if (0 <= y && y < rows) {
                        var i = z * area + y * cols + x;
                        if (0 <= z && i < data.length) {
                            return data[i];
                        }
                    }
                }
                return Number.NaN;
            }
        };
    }
*/

    decoder.varpackDecode = function(bytes, size) {
        var values = new Float32Array(size), i = 0, j = 0;
        while (i < bytes.length) {
            var b = bytes[i++];
            if (b < 128) {
                b = b << 25 >> 25;
            } else {
                switch (b >> 4) {
                    case 0x8:
                    case 0x9:
                    case 0xa:
                    case 0xb:
                        b = (b << 26 >> 18) | bytes[i++];
                        break;
                    case 0xc:
                    case 0xd:
                        b = (b << 27 >> 11) | bytes[i++] << 8 | bytes[i++];
                        break;
                    case 0xe:
                        b = (b << 28 >> 4) | bytes[i++] << 16 | bytes[i++] << 8 | bytes[i++];
                        break;
                    case 0xf:
                        if (b === 255) {
                            for (var run = 1 + bytes[i++]; run > 0; run--) {
                                values[j++] = Number.NaN;
                            }
                            continue;
                        } else {
                            b = bytes[i++] << 24 | bytes[i++] << 16 | bytes[i++] << 8 | bytes[i++];
                        }
                        break;
                }
            }
            values[j++] = b;
        }
        return values;
    };

    /**
     * Decodes a quantized delta-plane varpack array of floats.
     *
     * @param {Uint8Array} bytes the encoded values as an array of bytes
     * @param cols size of the x dimension
     * @param rows size of the y dimension
     * @param grids size of the z dimension
     * @param scaleFactor number of decimal digits after (+) or before (-) the decimal point to retain
     * @returns {Float32Array} the decoded values
     */
    decoder.decodePpak = function(bytes, cols, rows, grids, scaleFactor) {
        var values = decoder.varpackDecode(bytes, cols * rows * grids);
        var x, y, z, i, j, k, p;

        for (z = 0; z < grids; z++) {
            k = z * cols * rows;
            for (x = 1; x < cols; x++) {
                i = k + x;
                p = values[i - 1];
                values[i] += (p === p ? p : 0);
            }
            for (y = 1; y < rows; y++) {
                j = k + y * cols;
                p = values[j - cols];
                values[j] += (p === p ? p : 0);
                for (x = 1; x < cols; x++) {
                    i = j + x;
                    var a = values[i - 1];
                    var b = values[i - cols];
                    var c = values[i - cols - 1];
                    p = a + b - c;
                    values[i] += (p === p ? p : a === a ? a : b === b ? b : c === c ? c : 0);
                }
            }
        }

        var m = Math.pow(10, scaleFactor);
        for (i = 0; i < values.length; i++) {
            values[i] /= m;
        }

        return values;
    };

    /**
     * Decodes a ppak block from a buffer having the format:
     * <pre>
     *       int32   int32   int32      float32     byte[]
     *     [ cols ][ rows ][ grids ][ scaleFactor ][ data ]
     *      ----------------------------------------------
     *                        length
     * </pre>
     * All multi-byte values are BE. The number of resulting values is cols * rows * grids.
     *
     * @param {ArrayBuffer} buffer the buffer
     * @param offset buffer byte offset
     * @param length the byte length of the block
     * @returns {Float32Array} the decoded values
     */
    decoder.decodePpakBlock = function(buffer, offset, length) {
        var view = new DataView(buffer, offset, length);
        return decoder.decodePpak(
            new Uint8Array(buffer, offset + 16, length - 16),
            view.getInt32(0),      // cols
            view.getInt32(4),      // rows
            view.getInt32(8),      // grids
            view.getFloat32(12));  // scaleFactor
    };

    /**
     * Earth-Pack (EPAK) format:
     * <pre>
     *     head  := "head" (BE alpha-4) length (BE int) json (UTF-8 JSON string)
     *     block :=  type  (BE alpha-4) length (BE int) data (byte[])
     *     tail  := "tail"
     *     file  :=  head [block]* tail
     *
     *     head                                  block                           tail
     *     ------------------------------------  ------------------------------  ------
     *    ["head"][0x00000003][0x10, 0x11, 0x12]["ppak"][0x00000002][0xff, 0xff]["tail"]
     *             ----------  ----------------  ------  ----------  ----------
     *               length          json         type     length       data
     * </pre>
     *
     * @param {ArrayBuffer} buffer the buffer to decode
     * @returns {Object} the decoded values
     */
    decoder.decodeEpak = function(buffer) {
        var i = 0;
        var view = new DataView(buffer);

        var head = decoder.decodeUTF8(new Uint8Array(buffer, i, 4));
        i += 4;
        if (head !== "head") {
            throw new Error("expected 'head' but found '" + head + "'");
        }

        var length = view.getInt32(i);
        i += 4;
        var header = JSON.parse(decoder.decodeUTF8(new Uint8Array(buffer, i, length)));
        i += length;

        var block;
        var blocks = [];
        var type;
        while ((type = decoder.decodeUTF8(new Uint8Array(buffer, i, 4))) !== "tail") {
            i += 4;
            length = view.getInt32(i);
            i += 4;
            switch (type) {
                case "ppak":
                    block = decoder.decodePpakBlock(buffer, i, length);
                    break;
                default:
                    throw new Error("unknown block type: " + type);
            }
            blocks.push(block);
            i += length;
        }

        return {header: header, blocks: blocks};
    };

    // ========================================================================

    return typeof module === "object" && module.exports ?
        module.exports = decoder :            // publish as node.js module
        (0, eval)("this").decoder = decoder;  // publish as global var

})();
