"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultTokenizer = void 0;
const js_tiktoken_1 = require("js-tiktoken");
const encoding = (0, js_tiktoken_1.getEncoding)("cl100k_base");
exports.defaultTokenizer = {
    name: "cl100k_base",
    count: (text) => encoding.encode(text).length,
};
