"use strict";
/// <reference path="../types/index.d.ts" />
Object.defineProperty(exports, "__esModule", { value: true });
let date = new Date();
function log(msg) {
    console.log(`${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}: ${msg}`);
}
exports.log = log;
//# sourceMappingURL=index.js.map