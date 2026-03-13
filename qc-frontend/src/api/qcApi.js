const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3300/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = data?.message || "Request failed";
    throw new Error(message);
  }

  return data;
}

export const qcApi = {
  getDashboard: () => request("/qc-tests/dashboard"),
  getRetestAlerts: () => request("/qc-tests/retest-alerts"),
  getLots: () => request("/lots"),
  getTestsByLot: (lotId) => request(`/qc-tests/lot/${lotId}`),
  createTest: (payload) => request("/qc-tests", { method: "POST", body: JSON.stringify(payload) }),
  submitDecision: (lotId, payload) => request(`/qc-tests/lot/${lotId}/decision`, { method: "POST", body: JSON.stringify(payload) }),
  submitRetest: (lotId, payload) => request(`/qc-tests/lot/${lotId}/retest`, { method: "POST", body: JSON.stringify(payload) }),
  getEvidences: (lotId) => request(`/qc-tests/lot/${lotId}/evidences`),
  uploadEvidenceMeta: (lotId, payload) => request(`/qc-tests/lot/${lotId}/evidences`, { method: "POST", body: JSON.stringify(payload) }),
  bulkQuarantine: (payload) => request("/qc-tests/quarantine/bulk", { method: "POST", body: JSON.stringify(payload) }),
  getTimeline: (lotId) => request(`/qc-tests/lot/${lotId}/timeline`),
  getSupplierPerformance: (from, to) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    return request(`/qc-tests/supplier-performance${query ? `?${query}` : ""}`);
  },
  getReturnRequests: () => request("/return-requests"),
  updateReturnRequest: (id, payload) => request(`/return-requests/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  getAuditLogs: () => request("/audit-logs"),
};
