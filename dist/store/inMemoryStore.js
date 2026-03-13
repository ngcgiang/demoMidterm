"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = exports.InMemoryStore = void 0;
const uuid_1 = require("uuid");
const now = () => new Date().toISOString();
class InMemoryStore {
    constructor() {
        this.lots = [
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
        this.tests = [];
        this.evidences = [];
        this.decisions = [];
        this.returnRequests = [];
        this.auditLogs = [];
        this.retestAlerts = [];
    }
    createAudit(log) {
        this.auditLogs.unshift({
            auditId: (0, uuid_1.v4)(),
            timestamp: now(),
            ...log,
        });
    }
}
exports.InMemoryStore = InMemoryStore;
exports.store = new InMemoryStore();
