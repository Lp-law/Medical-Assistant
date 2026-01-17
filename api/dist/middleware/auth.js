"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.requireAuth = void 0;
const authService_1 = require("../services/authService");
const extractToken = (req) => {
    const header = req.get('authorization');
    if (header && header.startsWith('Bearer ')) {
        return header.slice(7).trim();
    }
    return null;
};
const requireAuth = (req, res, next) => {
    try {
        const token = extractToken(req);
        if (!token) {
            res.status(401).json({ error: 'auth_required' });
            return;
        }
        const user = (0, authService_1.verifyAccessToken)(token);
        req.user = user;
        next();
    }
    catch (error) {
        console.error('[auth] invalid token', error);
        res.status(401).json({ error: 'invalid_token' });
    }
};
exports.requireAuth = requireAuth;
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'auth_required' });
            return;
        }
        if (req.user.role !== role) {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
