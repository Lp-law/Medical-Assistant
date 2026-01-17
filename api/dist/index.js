"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const auth_1 = require("./routes/auth");
const ingest_1 = require("./routes/ingest");
const cases_1 = require("./routes/cases");
const knowledge_1 = require("./routes/knowledge");
const literature_1 = require("./routes/literature");
const notifications_1 = require("./routes/notifications");
const caseRetention_1 = require("./jobs/caseRetention");
const env_1 = require("./services/env");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: env_1.config.corsOrigins,
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use((0, morgan_1.default)('dev'));
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/api/auth', auth_1.authRouter);
app.use('/api/ingest', ingest_1.ingestRouter);
app.use('/api/cases', cases_1.casesRouter);
app.use('/api/knowledge', knowledge_1.knowledgeRouter);
app.use('/api/literature', literature_1.literatureRouter);
app.use('/api/notifications', notifications_1.notificationsRouter);
const port = env_1.config.port;
app.listen(port, () => {
    console.log(`LexMedical API listening on port ${port}`);
    (0, caseRetention_1.startCaseRetentionJobs)();
});
