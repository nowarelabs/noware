"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var theme_1 = require("vitepress/theme");
require("./custom.css");
exports.default = __assign(__assign({}, theme_1.default), { enhanceApp: function (_a) {
        var app = _a.app;
        // Custom font loading is handled in config.ts head
    } });
