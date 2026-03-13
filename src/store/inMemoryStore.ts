import { v4 as uuid } from "uuid";
import {
  AuditLog,
  InventoryLot,
  QCDecisionLog,
  QCEvidence,
  QCTest,
  RetestAlert,
  ReturnRequest,
} from "../domain/types";

const now = () => new Date().toISOString();

export class InMemoryStore {
  lots: InventoryLot[] = [
    {
      lotId: "LOT-001",
      materialId: "MAT-001",
      materialName: "Vitamin C",
      supplierName: "Pharma Supply Co.",
      status: "PendingQC",
      quantity: 100,
      unitOfMeasure: "kg",
      zone: "Z-A",
      bin: "A-01",
      expirationDate: "2026-12-31",
      nextRetestDate: "2026-04-15",
      createdAt: now(),
      updatedAt: now(),
    },
    {
      lotId: "LOT-002",
      materialId: "MAT-002",
      materialName: "Omeprazole",
      supplierName: "MedChem Vietnam",
      status: "Quarantine",
      quantity: 80,
      unitOfMeasure: "kg",
      zone: "Z-A",
      bin: "A-02",
      expirationDate: "2026-09-30",
      nextRetestDate: "2026-03-20",
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  tests: QCTest[] = [];
  evidences: QCEvidence[] = [];
  decisions: QCDecisionLog[] = [];
  returnRequests: ReturnRequest[] = [];
  auditLogs: AuditLog[] = [];
  retestAlerts: RetestAlert[] = [];

  createAudit(log: Omit<AuditLog, "auditId" | "timestamp">) {
    this.auditLogs.unshift({
      auditId: uuid(),
      timestamp: now(),
      ...log,
    });
  }
}

export const store = new InMemoryStore();
