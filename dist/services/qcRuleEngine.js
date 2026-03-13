"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canTransition = canTransition;
exports.mapDecisionToStatus = mapDecisionToStatus;
exports.validateApproveRule = validateApproveRule;
const allowedTransitions = {
    PendingQC: ["Accepted", "Rejected", "Hold", "Quarantine"],
    Quarantine: ["Accepted", "Rejected", "Hold"],
    Hold: ["Accepted", "Rejected"],
    Accepted: ["Hold", "Rejected", "Depleted"],
    Rejected: [],
    Depleted: [],
};
function canTransition(current, next) {
    if (current === next)
        return true;
    return allowedTransitions[current].includes(next);
}
function mapDecisionToStatus(decision) {
    if (decision === "Approve")
        return "Accepted";
    if (decision === "Reject")
        return "Rejected";
    if (decision === "Hold")
        return "Hold";
    if (decision === "Discard")
        return "Rejected";
    if (decision === "Extend")
        return "Accepted";
    return null;
}
function validateApproveRule(tests) {
    if (tests.length === 0) {
        return "Cannot approve lot without QC tests";
    }
    const hasFail = tests.some((t) => t.resultStatus === "Fail");
    if (hasFail) {
        return "Cannot approve lot with failed tests";
    }
    const hasPending = tests.some((t) => t.resultStatus === "Pending");
    if (hasPending) {
        return "Cannot approve lot while tests are still pending";
    }
    return null;
}
