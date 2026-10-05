"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.measureEconomics = measureEconomics;
const tokenizer_1 = require("./tokenizer");
const toon_1 = require("@toon-format/toon");
function measureEconomics(payload, tokenizer = tokenizer_1.defaultTokenizer) {
    const jsonString = JSON.stringify(payload);
    const toonString = (0, toon_1.encode)(payload);
    const jsonTokens = tokenizer.count(jsonString);
    const toonTokens = tokenizer.count(toonString);
    const tokensSaved = jsonTokens - toonTokens;
    const savingsRatio = jsonTokens === 0 ? 0 : tokensSaved / jsonTokens;
    return {
        jsonTokens,
        toonTokens,
        tokensSaved,
        savingsRatio,
        measured: true,
    };
}
