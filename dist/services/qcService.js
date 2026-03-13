"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qcService = exports.QCService = exports.bulkQuarantineSchema = exports.evidenceSchema = exports.retestSchema = exports.decisionSchema = exports.createTestSchema = void 0;
const uuid_1 = require("uuid");
const zod_1 = require("zod");
const inMemoryStore_1 = require("../store/inMemoryStore");
const qcRuleEngine_1 = require("./qcRuleEngine");
const now = () => new Date().toISOString();
exports.createTestSchema = zod_1.z.object({
    lotId: zod_1.z.string().min(1),
    testType: zod_1.z.enum(["Identity", "Potency", "Microbial", "GrowthPromotion", "Physical", "Chemical"]),
    testMethod: zod_1.z.string().min(1),
    testDate: zod_1.z.string().min(1),
    acceptanceCriteria: zod_1.z.string().optional(),
    testResult: zod_1.z.string().min(1),
    resultStatus: zod_1.z.enum(["Pass", "Fail", "Pending"]),
    performedBy: zod_1.z.string().min(1),
    verifiedBy: zod_1.z.string().optional(),
});
exports.decisionSchema = zod_1.z.object({
    decision: zod_1.z.enum(["Approve", "Reject", "Hold", "Extend", "Discard"]),
    reason: zod_1.z.string().min(1),
    actor: zod_1.z.string().min(1),
    evidenceIds: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.retestSchema = zod_1.z.object({
    action: zod_1.z.enum(["extend", "discard"]),
    actor: zod_1.z.string().min(1),
    reason: zod_1.z.string().min(1),
    newExpiryDate: zod_1.z.string().optional(),
    newRetestDate: zod_1.z.string().optional(),
});
exports.evidenceSchema = zod_1.z.object({
    lotId: zod_1.z.string().min(1),
    testId: zod_1.z.string().optional(),
    fileType: zod_1.z.enum(["image", "video"]),
    uploadedBy: zod_1.z.string().min(1),
});
exports.bulkQuarantineSchema = zod_1.z.object({
    scope: zod_1.z.object({
        zone: zod_1.z.string().optional(),
        bin: zod_1.z.string().optional(),
        lotIds: zod_1.z.array(zod_1.z.string()).optional(),
    }),
    reason: zod_1.z.string().min(1),
    actor: zod_1.z.string().min(1),
});
function findLotOrThrow(lotId) {
    const lot = inMemoryStore_1.store.lots.find((l) => l.lotId === lotId);
    if (!lot)
        throw new Error("Lot not found");
    return lot;
}
class QCService {
    createTest(input, meta) {
        const payload = exports.createTestSchema.parse(input);
        findLotOrThrow(payload.lotId);
        const test = {
            testId: (0, uuid_1.v4)(),
            createdAt: now(),
            updatedAt: now(),
            ...payload,
        };
        inMemoryStore_1.store.tests.push(test);
        inMemoryStore_1.store.createAudit({
            actor: payload.performedBy,
            action: "QCTestCreated",
            targetType: "QCTest",
            targetId: test.testId,
            ip: meta.ip,
            userAgent: meta.userAgent,
            after: test,
        });
        return test;
    }
    updateTest(testId, partial, meta) {
        const idx = inMemoryStore_1.store.tests.findIndex((t) => t.testId === testId);
        if (idx === -1)
            throw new Error("Test not found");
        const before = inMemoryStore_1.store.tests[idx];
        const updated = {
            ...before,
            ...partial,
            testId,
            updatedAt: now(),
        };
        inMemoryStore_1.store.tests[idx] = updated;
        inMemoryStore_1.store.createAudit({
            actor: meta.actor,
            action: "QCTestUpdated",
            targetType: "QCTest",
            targetId: testId,
            ip: meta.ip,
            userAgent: meta.userAgent,
            before,
            after: updated,
        });
        return updated;
    }
    deleteTest(testId, meta) {
        const idx = inMemoryStore_1.store.tests.findIndex((t) => t.testId === testId);
        if (idx === -1)
            throw new Error("Test not found");
        const before = inMemoryStore_1.store.tests[idx];
        inMemoryStore_1.store.tests.splice(idx, 1);
        inMemoryStore_1.store.createAudit({
            actor: meta.actor,
            action: "QCTestDeleted",
            targetType: "QCTest",
            targetId: testId,
            ip: meta.ip,
            userAgent: meta.userAgent,
            before,
        });
        return { success: true };
    }
    listTests(filter) {
        return inMemoryStore_1.store.tests.filter((t) => {
            if (filter.lotId && t.lotId !== filter.lotId)
                return false;
            if (filter.resultStatus && t.resultStatus !== filter.resultStatus)
                return false;
            if (filter.testType && t.testType !== filter.testType)
                return false;
            return true;
        });
    }
    addEvidence(fileName, input, meta) {
        const payload = exports.evidenceSchema.parse(input);
        findLotOrThrow(payload.lotId);
        const evidence = {
            evidenceId: (0, uuid_1.v4)(),
            fileName,
            fileUrl: `/mock-storage/${fileName}`,
            uploadedAt: now(),
            ...payload,
        };
        inMemoryStore_1.store.evidences.push(evidence);
        inMemoryStore_1.store.createAudit({
            actor: payload.uploadedBy,
            action: "QCEvidenceUploaded",
            targetType: "QCEvidence",
            targetId: evidence.evidenceId,
            ip: meta.ip,
            userAgent: meta.userAgent,
            after: evidence,
        });
        return evidence;
    }
    submitDecision(lotId, input, meta) {
        const payload = exports.decisionSchema.parse(input);
        const lot = findLotOrThrow(lotId);
        const lotTests = inMemoryStore_1.store.tests.filter((t) => t.lotId === lotId);
        if (payload.decision === "Approve") {
            const ruleError = (0, qcRuleEngine_1.validateApproveRule)(lotTests);
            if (ruleError)
                throw new Error(ruleError);
        }
        if (payload.decision === "Reject" && payload.evidenceIds.length < 1) {
            throw new Error("Reject decision requires at least one evidence");
        }
        const nextStatus = (0, qcRuleEngine_1.mapDecisionToStatus)(payload.decision);
        if (nextStatus && !(0, qcRuleEngine_1.canTransition)(lot.status, nextStatus)) {
            throw new Error(`Invalid status transition from ${lot.status} to ${nextStatus}`);
        }
        const before = { ...lot };
        if (nextStatus) {
            lot.status = nextStatus;
            lot.updatedAt = now();
            if (nextStatus === "Rejected" || nextStatus === "Hold" || nextStatus === "PendingQC") {
                lot.lockReason = payload.reason;
            }
            else {
                lot.lockReason = undefined;
            }
        }
        const decisionLog = {
            decisionId: (0, uuid_1.v4)(),
            lotId,
            decision: payload.decision,
            reason: payload.reason,
            actor: payload.actor,
            evidenceIds: payload.evidenceIds,
            decidedAt: now(),
        };
        inMemoryStore_1.store.decisions.unshift(decisionLog);
        if (payload.decision === "Reject") {
            const rr = {
                requestId: (0, uuid_1.v4)(),
                lotId,
                reason: payload.reason,
                evidenceIds: payload.evidenceIds,
                status: "Open",
                createdBy: payload.actor,
                createdAt: now(),
                updatedAt: now(),
            };
            inMemoryStore_1.store.returnRequests.unshift(rr);
        }
        inMemoryStore_1.store.createAudit({
            actor: payload.actor,
            action: "QCDecisionSubmitted",
            targetType: "InventoryLot",
            targetId: lotId,
            ip: meta.ip,
            userAgent: meta.userAgent,
            before,
            after: lot,
        });
        return {
            lot,
            decision: decisionLog,
            returnRequest: payload.decision === "Reject" ? inMemoryStore_1.store.returnRequests[0] : null,
        };
    }
    submitRetest(lotId, input, meta) {
        const payload = exports.retestSchema.parse(input);
        const lot = findLotOrThrow(lotId);
        if (payload.action === "extend") {
            if (!payload.newExpiryDate) {
                throw new Error("newExpiryDate is required for extend action");
            }
            lot.expirationDate = payload.newExpiryDate;
            if (payload.newRetestDate)
                lot.nextRetestDate = payload.newRetestDate;
        }
        if (payload.action === "discard") {
            lot.status = "Rejected";
            lot.lockReason = payload.reason;
        }
        lot.updatedAt = now();
        const decision = this.submitDecision(lotId, {
            decision: payload.action === "extend" ? "Extend" : "Discard",
            reason: payload.reason,
            actor: payload.actor,
            evidenceIds: [],
        }, meta);
        return decision;
    }
    bulkQuarantine(input, meta) {
        const payload = exports.bulkQuarantineSchema.parse(input);
        const matched = inMemoryStore_1.store.lots.filter((lot) => {
            if (payload.scope.lotIds && payload.scope.lotIds.length > 0) {
                return payload.scope.lotIds.includes(lot.lotId);
            }
            if (payload.scope.zone && lot.zone !== payload.scope.zone)
                return false;
            if (payload.scope.bin && lot.bin !== payload.scope.bin)
                return false;
            return true;
        });
        const updatedIds = [];
        for (const lot of matched) {
            if (!(0, qcRuleEngine_1.canTransition)(lot.status, "Quarantine") && lot.status !== "Quarantine") {
                continue;
            }
            const before = { ...lot };
            lot.status = "Quarantine";
            lot.lockReason = payload.reason;
            lot.updatedAt = now();
            updatedIds.push(lot.lotId);
            inMemoryStore_1.store.createAudit({
                actor: payload.actor,
                action: "BulkQuarantineApplied",
                targetType: "InventoryLot",
                targetId: lot.lotId,
                ip: meta.ip,
                userAgent: meta.userAgent,
                before,
                after: lot,
            });
        }
        return { totalMatched: matched.length, updatedIds };
    }
    listReturnRequests(filter) {
        return inMemoryStore_1.store.returnRequests.filter((r) => {
            if (filter.lotId && r.lotId !== filter.lotId)
                return false;
            if (filter.status && r.status !== filter.status)
                return false;
            return true;
        });
    }
    updateReturnRequest(requestId, status, actor, meta) {
        const req = inMemoryStore_1.store.returnRequests.find((r) => r.requestId === requestId);
        if (!req)
            throw new Error("Return request not found");
        const before = { ...req };
        req.status = status;
        req.updatedAt = now();
        inMemoryStore_1.store.createAudit({
            actor,
            action: "ReturnRequestUpdated",
            targetType: "ReturnRequest",
            targetId: requestId,
            ip: meta.ip,
            userAgent: meta.userAgent,
            before,
            after: req,
        });
        return req;
    }
    dashboard() {
        const totalLots = inMemoryStore_1.store.lots.length;
        const pendingQc = inMemoryStore_1.store.lots.filter((l) => l.status === "PendingQC" || l.status === "Quarantine").length;
        const accepted = inMemoryStore_1.store.lots.filter((l) => l.status === "Accepted").length;
        const rejected = inMemoryStore_1.store.lots.filter((l) => l.status === "Rejected").length;
        const hold = inMemoryStore_1.store.lots.filter((l) => l.status === "Hold").length;
        return {
            totalLots,
            pendingQc,
            accepted,
            rejected,
            hold,
            openReturnRequests: inMemoryStore_1.store.returnRequests.filter((r) => r.status === "Open").length,
        };
    }
    supplierPerformance(from, to) {
        const fromTime = from ? new Date(from).getTime() : 0;
        const toTime = to ? new Date(to).getTime() : Number.MAX_SAFE_INTEGER;
        const decisionWindow = inMemoryStore_1.store.decisions.filter((d) => {
            const t = new Date(d.decidedAt).getTime();
            return t >= fromTime && t <= toTime;
        });
        const map = new Map();
        for (const d of decisionWindow) {
            if (d.decision !== "Approve" && d.decision !== "Reject")
                continue;
            const lot = inMemoryStore_1.store.lots.find((l) => l.lotId === d.lotId);
            if (!lot)
                continue;
            const current = map.get(lot.supplierName) ?? {
                supplierName: lot.supplierName,
                total: 0,
                approved: 0,
                rejected: 0,
            };
            current.total += 1;
            if (d.decision === "Approve")
                current.approved += 1;
            if (d.decision === "Reject")
                current.rejected += 1;
            map.set(lot.supplierName, current);
        }
        return Array.from(map.values()).map((x) => ({
            supplierName: x.supplierName,
            totalBatches: x.total,
            approved: x.approved,
            rejected: x.rejected,
            qualityRate: x.total === 0 ? 0 : Number(((x.approved / x.total) * 100).toFixed(2)),
        }));
    }
    timeline(lotId) {
        findLotOrThrow(lotId);
        const lotTests = inMemoryStore_1.store.tests.filter((t) => t.lotId === lotId);
        const lotDecisions = inMemoryStore_1.store.decisions.filter((d) => d.lotId === lotId);
        const lotEvidence = inMemoryStore_1.store.evidences.filter((e) => e.lotId === lotId);
        const lotAudit = inMemoryStore_1.store.auditLogs.filter((a) => a.targetId === lotId || lotTests.some((t) => t.testId === a.targetId));
        return {
            lot: inMemoryStore_1.store.lots.find((l) => l.lotId === lotId),
            tests: lotTests,
            decisions: lotDecisions,
            evidence: lotEvidence,
            audit: lotAudit,
        };
    }
    createRetestAlerts() {
        const today = new Date();
        const alerts = [];
        for (const lot of inMemoryStore_1.store.lots) {
            if (!lot.nextRetestDate)
                continue;
            const rt = new Date(lot.nextRetestDate);
            const sameOrPast = rt.getTime() <= today.getTime();
            if (!sameOrPast)
                continue;
            const existed = inMemoryStore_1.store.retestAlerts.some((a) => a.lotId === lot.lotId && a.reason.includes("re-test due"));
            if (existed)
                continue;
            const alert = {
                alertId: (0, uuid_1.v4)(),
                lotId: lot.lotId,
                reason: "re-test due",
                createdAt: now(),
            };
            inMemoryStore_1.store.retestAlerts.unshift(alert);
            alerts.push(alert);
        }
        return alerts;
    }
    listRetestAlerts() {
        return inMemoryStore_1.store.retestAlerts;
    }
}
exports.QCService = QCService;
exports.qcService = new QCService();
