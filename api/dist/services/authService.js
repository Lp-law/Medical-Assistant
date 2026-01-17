"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAccessToken = exports.signAccessToken = exports.validateUserCredentials = exports.findUserByUsername = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("./env");
const userDirectory = env_1.config.auth.users.map((user) => ({
    id: user.username,
    username: user.username,
    role: user.role,
    passwordHash: user.passwordHash,
}));
const findUserByUsername = (username) => {
    const normalized = username.trim().toLowerCase();
    return userDirectory.find((user) => user.username.toLowerCase() === normalized);
};
exports.findUserByUsername = findUserByUsername;
const validateUserCredentials = async (username, password) => {
    const user = (0, exports.findUserByUsername)(username);
    if (!user) {
        return null;
    }
    const isValid = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!isValid) {
        return null;
    }
    return {
        id: user.id,
        username: user.username,
        role: user.role,
    };
};
exports.validateUserCredentials = validateUserCredentials;
const signAccessToken = (user) => {
    return jsonwebtoken_1.default.sign(user, env_1.config.auth.jwtSecret, {
        expiresIn: `${env_1.config.auth.accessTtlMinutes}m`,
    });
};
exports.signAccessToken = signAccessToken;
const verifyAccessToken = (token) => {
    const decoded = jsonwebtoken_1.default.verify(token, env_1.config.auth.jwtSecret);
    return {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role,
    };
};
exports.verifyAccessToken = verifyAccessToken;
