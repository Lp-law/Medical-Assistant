"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureUserRecord = exports.prisma = void 0;
const client_1 = require("@prisma/client");
// Keep this aligned with the compiled dist version and the rest of the codebase
// which assumes a ready Prisma client.
exports.prisma = new client_1.PrismaClient();
const ensureUserRecord = async (id, username, role) => {
    await exports.prisma.user.upsert({
        where: { id },
        update: { username, role },
        create: { id, username, role },
    });
};
exports.ensureUserRecord = ensureUserRecord;
