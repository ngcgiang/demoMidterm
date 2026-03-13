import { v4 as uuid } from "uuid";
import { z } from "zod";
import {
  LotDecision,
  QCEvidence,
  QCTest,
  RetestAlert,
  ReturnRequest,
} from "../domain/types";
import { store } from "../store/inMemoryStore";
import { canTransition, mapDecisionToStatus, validateApproveRule } from "./qcRuleEngine";

const now = () => new Date().toISOString();

export const createTestSchema = z.object({
  lotId: z.string().min(1),
  testType: z.enum(["Identity", "Potency", "Microbial", "GrowthPromotion", "Physical", "Chemical"]),
  testMethod: z.string().min(1),
  testDate: z.string().min(1),
  acceptanceCriteria: z.string().optional(),
  testResult: z.string().min(1),
  resultStatus: z.enum(["Pass", "Fail", "Pending"]),
  performedBy: z.string().min(1),
  verifiedBy: z.string().optional(),
});

export const decisionSchema = z.object({
  decision: z.enum(["Approve", "Reject", "Hold", "Extend", "Discard"]),
  reason: z.string().min(1),
  actor: z.string().min(1),
  evidenceIds: z.array(z.string()).default([]),
});

export const retestSchema = z.object({
  action: z.enum(["extend", "discard"]),
  actor: z.string().min(1),
  reason: z.string().min(1),
  newExpiryDate: z.string().optional(),
  newRetestDate: z.string().optional(),
});

export const evidenceSchema = z.object({
  lotId: z.string().min(1),
  testId: z.string().optional(),
  fileType: z.enum(["image", "video"]),
  uploadedBy: z.string().min(1),
});

export const bulkQuarantineSchema = z.object({
  scope: z.object({
    zone: z.string().optional(),
    bin: z.string().optional(),
    lotIds: z.array(z.string()).optional(),
  }),
  reason: z.string().min(1),
  actor: z.string().min(1),
});

function findLotOrThrow(lotId: string) {
  const lot = store.lots.find((l) => l.lotId === lotId);
  if (!lot) throw new Error("Lot not found");
  return lot;
}

export class QCService {
  createTest(input: z.infer<typeof createTestSchema>, meta: { ip: string; userAgent: string }) {
    const payload = createTestSchema.parse(input);
    findLotOrThrow(payload.lotId);

    const test: QCTest = {
      testId: uuid(),
      createdAt: now(),
      updatedAt: now(),
      ...payload,
    };

    store.tests.push(test);
    store.createAudit({
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

  updateTest(testId: string, partial: Partial<QCTest>, meta: { actor: string; ip: string; userAgent: string }) {
    const idx = store.tests.findIndex((t) => t.testId === testId);
    if (idx === -1) throw new Error("Test not found");

    const before = store.tests[idx];
    const updated: QCTest = {
      ...before,
      ...partial,
      testId,
      updatedAt: now(),
    };

    store.tests[idx] = updated;
    store.createAudit({
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

  deleteTest(testId: string, meta: { actor: string; ip: string; userAgent: string }) {
    const idx = store.tests.findIndex((t) => t.testId === testId);
    if (idx === -1) throw new Error("Test not found");

    const before = store.tests[idx];
    store.tests.splice(idx, 1);

    store.createAudit({
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

  listTests(filter: { lotId?: string; resultStatus?: string; testType?: string }) {
    return store.tests.filter((t) => {
      if (filter.lotId && t.lotId !== filter.lotId) return false;
      if (filter.resultStatus && t.resultStatus !== filter.resultStatus) return false;
      if (filter.testType && t.testType !== filter.testType) return false;
      return true;
    });
  }

  addEvidence(fileName: string, input: z.infer<typeof evidenceSchema>, meta: { ip: string; userAgent: string }) {
    const payload = evidenceSchema.parse(input);
    findLotOrThrow(payload.lotId);

    const evidence: QCEvidence = {
      evidenceId: uuid(),
      fileName,
      fileUrl: `/mock-storage/${fileName}`,
      uploadedAt: now(),
      ...payload,
    };

    store.evidences.push(evidence);
    store.createAudit({
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

  submitDecision(lotId: string, input: z.infer<typeof decisionSchema>, meta: { ip: string; userAgent: string }) {
    const payload = decisionSchema.parse(input);
    const lot = findLotOrThrow(lotId);
    const lotTests = store.tests.filter((t) => t.lotId === lotId);

    if (payload.decision === "Approve") {
      const ruleError = validateApproveRule(lotTests);
      if (ruleError) throw new Error(ruleError);
    }

    if (payload.decision === "Reject" && payload.evidenceIds.length < 1) {
      throw new Error("Reject decision requires at least one evidence");
    }

    const nextStatus = mapDecisionToStatus(payload.decision as LotDecision);
    if (nextStatus && !canTransition(lot.status, nextStatus)) {
      throw new Error(`Invalid status transition from ${lot.status} to ${nextStatus}`);
    }

    const before = { ...lot };
    if (nextStatus) {
      lot.status = nextStatus;
      lot.updatedAt = now();
      if (nextStatus === "Rejected" || nextStatus === "Hold" || nextStatus === "PendingQC") {
        lot.lockReason = payload.reason;
      } else {
        lot.lockReason = undefined;
      }
    }

    const decisionLog = {
      decisionId: uuid(),
      lotId,
      decision: payload.decision,
      reason: payload.reason,
      actor: payload.actor,
      evidenceIds: payload.evidenceIds,
      decidedAt: now(),
    };
    store.decisions.unshift(decisionLog);

    if (payload.decision === "Reject") {
      const rr: ReturnRequest = {
        requestId: uuid(),
        lotId,
        reason: payload.reason,
        evidenceIds: payload.evidenceIds,
        status: "Open",
        createdBy: payload.actor,
        createdAt: now(),
        updatedAt: now(),
      };
      store.returnRequests.unshift(rr);
    }

    store.createAudit({
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
      returnRequest: payload.decision === "Reject" ? store.returnRequests[0] : null,
    };
  }

  submitRetest(lotId: string, input: z.infer<typeof retestSchema>, meta: { ip: string; userAgent: string }) {
    const payload = retestSchema.parse(input);
    const lot = findLotOrThrow(lotId);

    if (payload.action === "extend") {
      if (!payload.newExpiryDate) {
        throw new Error("newExpiryDate is required for extend action");
      }
      lot.expirationDate = payload.newExpiryDate;
      if (payload.newRetestDate) lot.nextRetestDate = payload.newRetestDate;
    }

    if (payload.action === "discard") {
      lot.status = "Rejected";
      lot.lockReason = payload.reason;
    }

    lot.updatedAt = now();
    const decision = this.submitDecision(
      lotId,
      {
        decision: payload.action === "extend" ? "Extend" : "Discard",
        reason: payload.reason,
        actor: payload.actor,
        evidenceIds: [],
      },
      meta,
    );

    return decision;
  }

  bulkQuarantine(input: z.infer<typeof bulkQuarantineSchema>, meta: { ip: string; userAgent: string }) {
    const payload = bulkQuarantineSchema.parse(input);
    const matched = store.lots.filter((lot) => {
      if (payload.scope.lotIds && payload.scope.lotIds.length > 0) {
        return payload.scope.lotIds.includes(lot.lotId);
      }
      if (payload.scope.zone && lot.zone !== payload.scope.zone) return false;
      if (payload.scope.bin && lot.bin !== payload.scope.bin) return false;
      return true;
    });

    const updatedIds: string[] = [];
    for (const lot of matched) {
      if (!canTransition(lot.status, "Quarantine") && lot.status !== "Quarantine") {
        continue;
      }
      const before = { ...lot };
      lot.status = "Quarantine";
      lot.lockReason = payload.reason;
      lot.updatedAt = now();
      updatedIds.push(lot.lotId);

      store.createAudit({
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

  listReturnRequests(filter: { lotId?: string; status?: string }) {
    return store.returnRequests.filter((r) => {
      if (filter.lotId && r.lotId !== filter.lotId) return false;
      if (filter.status && r.status !== filter.status) return false;
      return true;
    });
  }

  updateReturnRequest(requestId: string, status: ReturnRequest["status"], actor: string, meta: { ip: string; userAgent: string }) {
    const req = store.returnRequests.find((r) => r.requestId === requestId);
    if (!req) throw new Error("Return request not found");

    const before = { ...req };
    req.status = status;
    req.updatedAt = now();

    store.createAudit({
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
    const totalLots = store.lots.length;
    const pendingQc = store.lots.filter((l) => l.status === "PendingQC" || l.status === "Quarantine").length;
    const accepted = store.lots.filter((l) => l.status === "Accepted").length;
    const rejected = store.lots.filter((l) => l.status === "Rejected").length;
    const hold = store.lots.filter((l) => l.status === "Hold").length;

    return {
      totalLots,
      pendingQc,
      accepted,
      rejected,
      hold,
      openReturnRequests: store.returnRequests.filter((r) => r.status === "Open").length,
    };
  }

  supplierPerformance(from?: string, to?: string) {
    const fromTime = from ? new Date(from).getTime() : 0;
    const toTime = to ? new Date(to).getTime() : Number.MAX_SAFE_INTEGER;

    const decisionWindow = store.decisions.filter((d) => {
      const t = new Date(d.decidedAt).getTime();
      return t >= fromTime && t <= toTime;
    });

    const map = new Map<string, { supplierName: string; total: number; approved: number; rejected: number }>();

    for (const d of decisionWindow) {
      if (d.decision !== "Approve" && d.decision !== "Reject") continue;
      const lot = store.lots.find((l) => l.lotId === d.lotId);
      if (!lot) continue;

      const current = map.get(lot.supplierName) ?? {
        supplierName: lot.supplierName,
        total: 0,
        approved: 0,
        rejected: 0,
      };

      current.total += 1;
      if (d.decision === "Approve") current.approved += 1;
      if (d.decision === "Reject") current.rejected += 1;
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

  timeline(lotId: string) {
    findLotOrThrow(lotId);
    const lotTests = store.tests.filter((t) => t.lotId === lotId);
    const lotDecisions = store.decisions.filter((d) => d.lotId === lotId);
    const lotEvidence = store.evidences.filter((e) => e.lotId === lotId);
    const lotAudit = store.auditLogs.filter((a) => a.targetId === lotId || lotTests.some((t) => t.testId === a.targetId));

    return {
      lot: store.lots.find((l) => l.lotId === lotId),
      tests: lotTests,
      decisions: lotDecisions,
      evidence: lotEvidence,
      audit: lotAudit,
    };
  }

  createRetestAlerts() {
    const today = new Date();
    const alerts: RetestAlert[] = [];

    for (const lot of store.lots) {
      if (!lot.nextRetestDate) continue;
      const rt = new Date(lot.nextRetestDate);
      const sameOrPast = rt.getTime() <= today.getTime();
      if (!sameOrPast) continue;

      const existed = store.retestAlerts.some((a) => a.lotId === lot.lotId && a.reason.includes("re-test due"));
      if (existed) continue;

      const alert: RetestAlert = {
        alertId: uuid(),
        lotId: lot.lotId,
        reason: "re-test due",
        createdAt: now(),
      };
      store.retestAlerts.unshift(alert);
      alerts.push(alert);
    }

    return alerts;
  }

  listRetestAlerts() {
    return store.retestAlerts;
  }
}

export const qcService = new QCService();
