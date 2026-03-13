export type LotStatus = "PendingQC" | "Quarantine" | "Accepted" | "Rejected" | "Hold" | "Depleted";

export type TestType =
  | "Identity"
  | "Potency"
  | "Microbial"
  | "GrowthPromotion"
  | "Physical"
  | "Chemical";

export type ResultStatus = "Pass" | "Fail" | "Pending";

export type LotDecision = "Approve" | "Reject" | "Hold" | "Extend" | "Discard";

export interface InventoryLot {
  lotId: string;
  materialId: string;
  materialName: string;
  supplierName: string;
  status: LotStatus;
  quantity: number;
  unitOfMeasure: string;
  zone: string;
  bin: string;
  expirationDate: string;
  nextRetestDate?: string;
  lockReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QCTest {
  testId: string;
  lotId: string;
  testType: TestType;
  testMethod: string;
  testDate: string;
  acceptanceCriteria?: string;
  testResult: string;
  resultStatus: ResultStatus;
  performedBy: string;
  verifiedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QCEvidence {
  evidenceId: string;
  lotId: string;
  testId?: string;
  fileName: string;
  fileType: "image" | "video";
  fileUrl: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface QCDecisionLog {
  decisionId: string;
  lotId: string;
  decision: LotDecision;
  reason: string;
  actor: string;
  evidenceIds: string[];
  decidedAt: string;
}

export interface ReturnRequest {
  requestId: string;
  lotId: string;
  reason: string;
  evidenceIds: string[];
  status: "Open" | "Approved" | "Closed";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  auditId: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  ip: string;
  userAgent: string;
  before?: unknown;
  after?: unknown;
  timestamp: string;
}

export interface RetestAlert {
  alertId: string;
  lotId: string;
  reason: string;
  createdAt: string;
}
