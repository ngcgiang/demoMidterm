import express from "express";
import multer from "multer";
import { z } from "zod";
import { qcService } from "../services/qcService";
import { store } from "../store/inMemoryStore";

const upload = multer({ storage: multer.memoryStorage() });
export const qcRouter = express.Router();

function reqMeta(req: express.Request) {
  return {
    ip: req.ip || "unknown",
    userAgent: req.get("user-agent") || "unknown",
  };
}

function respondError(res: express.Response, e: unknown) {
  if (e instanceof z.ZodError) {
    return res.status(400).json({ message: "Validation error", details: e.issues });
  }
  const message = e instanceof Error ? e.message : "Unexpected error";
  return res.status(400).json({ message });
}

qcRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "qctest-demo" });
});

qcRouter.post("/qc-tests", (req, res) => {
  try {
    const test = qcService.createTest(req.body, reqMeta(req));
    res.status(201).json(test);
  } catch (e) {
    respondError(res, e);
  }
});

qcRouter.get("/qc-tests", (req, res) => {
  try {
    const tests = qcService.listTests({
      lotId: req.query.lotId as string | undefined,
      resultStatus: req.query.resultStatus as string | undefined,
      testType: req.query.testType as string | undefined,
    });
    res.json(tests);
  } catch (e) {
    respondError(res, e);
  }
});

qcRouter.get("/qc-tests/lot/:lotId", (req, res) => {
  try {
    const tests = qcService.listTests({ lotId: req.params.lotId });
    res.json(tests);
  } catch (e) {
    respondError(res, e);
  }
});

qcRouter.patch("/qc-tests/:testId", (req, res) => {
  try {
    const actor = (req.body.actor as string) || "system";
    const updated = qcService.updateTest(req.params.testId, req.body, {
      actor,
      ...reqMeta(req),
    });
    res.json(updated);
  } catch (e) {
    respondError(res, e);
  }
});

qcRouter.delete("/qc-tests/:testId", (req, res) => {
  try {
    const actor = (req.query.actor as string) || "system";
    const result = qcService.deleteTest(req.params.testId, {
      actor,
      ...reqMeta(req),
    });
    res.json(result);
  } catch (e) {
    respondError(res, e);
  }
});

qcRouter.post("/qc-tests/lot/:lotId/decision", (req, res) => {
  try {
    const result = qcService.submitDecision(req.params.lotId, req.body, reqMeta(req));
    res.json(result);
  } catch (e) {
    respondError(res, e);
  }
});

qcRouter.post("/qc-tests/lot/:lotId/retest", (req, res) => {
  try {
    const result = qcService.submitRetest(req.params.lotId, req.body, reqMeta(req));
    res.json(result);
  } catch (e) {
    respondError(res, e);
  }
});

qcRouter.post("/qc-tests/lot/:lotId/evidences", upload.single("file"), (req, res) => {
  try {
    const payload = {
      lotId: req.params.lotId,
      testId: req.body.testId,
      fileType: req.body.fileType,
      uploadedBy: req.body.uploadedBy,
    };
    const fileName = req.file?.originalname || req.body.fileName || `evidence-${Date.now()}.txt`;
    const evidence = qcService.addEvidence(fileName, payload, reqMeta(req));
    res.status(201).json(evidence);
  } catch (e) {
    respondError(res, e);
  }
});

qcRouter.get("/qc-tests/lot/:lotId/evidences", (req, res) => {
  const data = store.evidences.filter((x) => x.lotId === req.params.lotId);
  res.json(data);
});

qcRouter.delete("/qc-tests/evidences/:evidenceId", (req, res) => {
  const idx = store.evidences.findIndex((e) => e.evidenceId === req.params.evidenceId);
  if (idx === -1) {
    return res.status(404).json({ message: "Evidence not found" });
  }
  const removed = store.evidences[idx];
  store.evidences.splice(idx, 1);
  return res.json({ success: true, removed });
});

qcRouter.post("/qc-tests/quarantine/bulk", (req, res) => {
  try {
    const result = qcService.bulkQuarantine(req.body, reqMeta(req));
    res.json(result);
  } catch (e) {
    respondError(res, e);
  }
});

qcRouter.get("/qc-tests/lot/:lotId/timeline", (req, res) => {
  try {
    const timeline = qcService.timeline(req.params.lotId);
    res.json(timeline);
  } catch (e) {
    respondError(res, e);
  }
});

qcRouter.get("/qc-tests/dashboard", (_req, res) => {
  res.json(qcService.dashboard());
});

qcRouter.get("/qc-tests/supplier-performance", (req, res) => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  res.json(qcService.supplierPerformance(from, to));
});

qcRouter.get("/qc-tests/retest-alerts", (_req, res) => {
  res.json(qcService.listRetestAlerts());
});

qcRouter.get("/return-requests", (req, res) => {
  const lotId = req.query.lotId as string | undefined;
  const status = req.query.status as string | undefined;
  res.json(qcService.listReturnRequests({ lotId, status }));
});

qcRouter.patch("/return-requests/:id", (req, res) => {
  try {
    const status = req.body.status as "Open" | "Approved" | "Closed";
    const actor = req.body.actor as string;
    const updated = qcService.updateReturnRequest(req.params.id, status, actor, reqMeta(req));
    res.json(updated);
  } catch (e) {
    respondError(res, e);
  }
});

qcRouter.get("/lots", (_req, res) => {
  res.json(store.lots);
});

qcRouter.get("/audit-logs", (_req, res) => {
  res.json(store.auditLogs);
});
