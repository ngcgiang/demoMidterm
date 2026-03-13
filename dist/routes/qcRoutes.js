"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.qcRouter = void 0;
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const zod_1 = require("zod");
const qcService_1 = require("../services/qcService");
const inMemoryStore_1 = require("../store/inMemoryStore");
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
exports.qcRouter = express_1.default.Router();
function reqMeta(req) {
    return {
        ip: req.ip || "unknown",
        userAgent: req.get("user-agent") || "unknown",
    };
}
function respondError(res, e) {
    if (e instanceof zod_1.z.ZodError) {
        return res.status(400).json({ message: "Validation error", details: e.issues });
    }
    const message = e instanceof Error ? e.message : "Unexpected error";
    return res.status(400).json({ message });
}
exports.qcRouter.get("/health", (_req, res) => {
    res.json({ ok: true, service: "qctest-demo" });
});
exports.qcRouter.post("/qc-tests", (req, res) => {
    try {
        const test = qcService_1.qcService.createTest(req.body, reqMeta(req));
        res.status(201).json(test);
    }
    catch (e) {
        respondError(res, e);
    }
});
exports.qcRouter.get("/qc-tests", (req, res) => {
    try {
        const tests = qcService_1.qcService.listTests({
            lotId: req.query.lotId,
            resultStatus: req.query.resultStatus,
            testType: req.query.testType,
        });
        res.json(tests);
    }
    catch (e) {
        respondError(res, e);
    }
});
exports.qcRouter.get("/qc-tests/lot/:lotId", (req, res) => {
    try {
        const tests = qcService_1.qcService.listTests({ lotId: req.params.lotId });
        res.json(tests);
    }
    catch (e) {
        respondError(res, e);
    }
});
exports.qcRouter.patch("/qc-tests/:testId", (req, res) => {
    try {
        const actor = req.body.actor || "system";
        const updated = qcService_1.qcService.updateTest(req.params.testId, req.body, {
            actor,
            ...reqMeta(req),
        });
        res.json(updated);
    }
    catch (e) {
        respondError(res, e);
    }
});
exports.qcRouter.delete("/qc-tests/:testId", (req, res) => {
    try {
        const actor = req.query.actor || "system";
        const result = qcService_1.qcService.deleteTest(req.params.testId, {
            actor,
            ...reqMeta(req),
        });
        res.json(result);
    }
    catch (e) {
        respondError(res, e);
    }
});
exports.qcRouter.post("/qc-tests/lot/:lotId/decision", (req, res) => {
    try {
        const result = qcService_1.qcService.submitDecision(req.params.lotId, req.body, reqMeta(req));
        res.json(result);
    }
    catch (e) {
        respondError(res, e);
    }
});
exports.qcRouter.post("/qc-tests/lot/:lotId/retest", (req, res) => {
    try {
        const result = qcService_1.qcService.submitRetest(req.params.lotId, req.body, reqMeta(req));
        res.json(result);
    }
    catch (e) {
        respondError(res, e);
    }
});
exports.qcRouter.post("/qc-tests/lot/:lotId/evidences", upload.single("file"), (req, res) => {
    try {
        const payload = {
            lotId: req.params.lotId,
            testId: req.body.testId,
            fileType: req.body.fileType,
            uploadedBy: req.body.uploadedBy,
        };
        const fileName = req.file?.originalname || req.body.fileName || `evidence-${Date.now()}.txt`;
        const evidence = qcService_1.qcService.addEvidence(fileName, payload, reqMeta(req));
        res.status(201).json(evidence);
    }
    catch (e) {
        respondError(res, e);
    }
});
exports.qcRouter.get("/qc-tests/lot/:lotId/evidences", (req, res) => {
    const data = inMemoryStore_1.store.evidences.filter((x) => x.lotId === req.params.lotId);
    res.json(data);
});
exports.qcRouter.delete("/qc-tests/evidences/:evidenceId", (req, res) => {
    const idx = inMemoryStore_1.store.evidences.findIndex((e) => e.evidenceId === req.params.evidenceId);
    if (idx === -1) {
        return res.status(404).json({ message: "Evidence not found" });
    }
    const removed = inMemoryStore_1.store.evidences[idx];
    inMemoryStore_1.store.evidences.splice(idx, 1);
    return res.json({ success: true, removed });
});
exports.qcRouter.post("/qc-tests/quarantine/bulk", (req, res) => {
    try {
        const result = qcService_1.qcService.bulkQuarantine(req.body, reqMeta(req));
        res.json(result);
    }
    catch (e) {
        respondError(res, e);
    }
});
exports.qcRouter.get("/qc-tests/lot/:lotId/timeline", (req, res) => {
    try {
        const timeline = qcService_1.qcService.timeline(req.params.lotId);
        res.json(timeline);
    }
    catch (e) {
        respondError(res, e);
    }
});
exports.qcRouter.get("/qc-tests/dashboard", (_req, res) => {
    res.json(qcService_1.qcService.dashboard());
});
exports.qcRouter.get("/qc-tests/supplier-performance", (req, res) => {
    const from = req.query.from;
    const to = req.query.to;
    res.json(qcService_1.qcService.supplierPerformance(from, to));
});
exports.qcRouter.get("/qc-tests/retest-alerts", (_req, res) => {
    res.json(qcService_1.qcService.listRetestAlerts());
});
exports.qcRouter.get("/return-requests", (req, res) => {
    const lotId = req.query.lotId;
    const status = req.query.status;
    res.json(qcService_1.qcService.listReturnRequests({ lotId, status }));
});
exports.qcRouter.patch("/return-requests/:id", (req, res) => {
    try {
        const status = req.body.status;
        const actor = req.body.actor;
        const updated = qcService_1.qcService.updateReturnRequest(req.params.id, status, actor, reqMeta(req));
        res.json(updated);
    }
    catch (e) {
        respondError(res, e);
    }
});
exports.qcRouter.get("/lots", (_req, res) => {
    res.json(inMemoryStore_1.store.lots);
});
exports.qcRouter.get("/audit-logs", (_req, res) => {
    res.json(inMemoryStore_1.store.auditLogs);
});
