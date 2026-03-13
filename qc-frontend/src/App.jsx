import { useEffect, useMemo, useState } from "react";
import { qcApi } from "./api/qcApi";

const tabs = [
  "Dashboard",
  "Lots",
  "Workbench",
  "Timeline",
  "Suppliers",
  "Returns",
  "Audit",
];

const defaultTestForm = {
  lotId: "",
  testType: "Chemical",
  testMethod: "HPLC",
  testDate: "",
  acceptanceCriteria: "",
  testResult: "",
  resultStatus: "Pass",
  performedBy: "qc_user",
  verifiedBy: "",
};

export default function App() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [dashboard, setDashboard] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [lots, setLots] = useState([]);
  const [selectedLotId, setSelectedLotId] = useState("");

  const [tests, setTests] = useState([]);
  const [testForm, setTestForm] = useState(defaultTestForm);

  const [decisionForm, setDecisionForm] = useState({
    decision: "Approve",
    reason: "",
    actor: "qc_manager",
    evidenceIdsText: "",
  });

  const [retestForm, setRetestForm] = useState({
    action: "extend",
    actor: "qc_user",
    reason: "",
    newExpiryDate: "",
    newRetestDate: "",
  });

  const [evidences, setEvidences] = useState([]);
  const [evidenceForm, setEvidenceForm] = useState({
    fileName: "evidence.txt",
    fileType: "image",
    uploadedBy: "qc_user",
    testId: "",
  });

  const [bulkForm, setBulkForm] = useState({
    zone: "",
    bin: "",
    lotIds: "",
    reason: "",
    actor: "qc_manager",
  });

  const [timeline, setTimeline] = useState(null);
  const [supplierReport, setSupplierReport] = useState([]);
  const [supplierFilter, setSupplierFilter] = useState({ from: "", to: "" });
  const [returnRequests, setReturnRequests] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const selectedLot = useMemo(
    () => lots.find((l) => l.lotId === selectedLotId),
    [lots, selectedLotId],
  );

  async function safeRun(task) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (e) {
      setError(e.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  async functio loadBaseData() {
    await safeRun(async () => {
      const [db, al, ls] = await Promise.all([
        qcApi.getDashboard(),
        qcApi.getRetestAlerts(),
        qcApi.getLots(),
      ]);
      setDashboard(db);
      setAlerts(al);
      setLots(ls);
      if (!selectedLotId && ls.length > 0) {
        setSelectedLotId(ls[0].lotId);
        setTestForm((s) => ({ ...s, lotId: ls[0].lotId }));
      }
    });
  }

  useEffect(() => {
    loadBaseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedLotId) return;
    setTestForm((s) => ({ ...s, lotId: selectedLotId }));
    safeRun(async () => {
      const [lotTests, lotEvidences] = await Promise.all([
        qcApi.getTestsByLot(selectedLotId),
        qcApi.getEvidences(selectedLotId),
      ]);
      setTests(lotTests);
      setEvidences(lotEvidences);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLotId]);

  async function createTest(e) {
    e.preventDefault();
    await safeRun(async () => {
      await qcApi.createTest(testForm);
      setMessage("Created QC test successfully.");
      const lotTests = await qcApi.getTestsByLot(selectedLotId);
      setTests(lotTests);
      setTestForm((s) => ({ ...s, testResult: "", acceptanceCriteria: "" }));
    });
  }

  async function submitDecision(e) {
    e.preventDefault();
    await safeRun(async () => {
      const evidenceIds = decisionForm.evidenceIdsText
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      await qcApi.submitDecision(selectedLotId, {
        decision: decisionForm.decision,
        reason: decisionForm.reason,
        actor: decisionForm.actor,
        evidenceIds,
      });
      setMessage("Submitted decision successfully.");
      await loadBaseData();
    });
  }

  async function submitRetest(e) {
    e.preventDefault();
    await safeRun(async () => {
      await qcApi.submitRetest(selectedLotId, {
        action: retestForm.action,
        actor: retestForm.actor,
        reason: retestForm.reason,
        newExpiryDate: retestForm.newExpiryDate || undefined,
        newRetestDate: retestForm.newRetestDate || undefined,
      });
      setMessage("Submitted re-test action successfully.");
      await loadBaseData();
    });
  }

  async function uploadEvidenceMeta(e) {
    e.preventDefault();
    await safeRun(async () => {
      await qcApi.uploadEvidenceMeta(selectedLotId, {
        lotId: selectedLotId,
        testId: evidenceForm.testId || undefined,
        fileType: evidenceForm.fileType,
        uploadedBy: evidenceForm.uploadedBy,
        fileName: evidenceForm.fileName,
      });
      setMessage("Uploaded evidence metadata successfully.");
      const lotEvidences = await qcApi.getEvidences(selectedLotId);
      setEvidences(lotEvidences);
    });
  }

  async function runBulkQuarantine(e) {
    e.preventDefault();
    await safeRun(async () => {
      await qcApi.bulkQuarantine({
        scope: {
          zone: bulkForm.zone || undefined,
          bin: bulkForm.bin || undefined,
          lotIds: bulkForm.lotIds
            ? bulkForm.lotIds.split(",").map((x) => x.trim()).filter(Boolean)
            : undefined,
        },
        reason: bulkForm.reason,
        actor: bulkForm.actor,
      });
      setMessage("Bulk quarantine executed.");
      await loadBaseData();
    });
  }

  async function loadTimeline() {
    if (!selectedLotId) return;
    await safeRun(async () => {
      const data = await qcApi.getTimeline(selectedLotId);
      setTimeline(data);
    });
  }

  async function loadSupplierReport() {
    await safeRun(async () => {
      const data = await qcApi.getSupplierPerformance(
        supplierFilter.from || undefined,
        supplierFilter.to || undefined,
      );
      setSupplierReport(data);
    });
  }

  async function loadReturns() {
    await safeRun(async () => {
      const data = await qcApi.getReturnRequests();
      setReturnRequests(data);
    });
  }

  async function updateReturnStatus(id, status) {
    await safeRun(async () => {
      await qcApi.updateReturnRequest(id, { status, actor: "qc_manager" });
      await loadReturns();
      setMessage("Updated return request.");
    });
  }

  async function loadAudit() {
    await safeRun(async () => {
      const data = await qcApi.getAuditLogs();
      setAuditLogs(data.slice(0, 50));
    });
  }

  const canApprove = tests.length > 0 && tests.every((t) => t.resultStatus === "Pass");

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>QC Test Demo</h1>
          <p>ReactJS frontend for QCTest workflow</p>
        </div>
        <button onClick={loadBaseData} disabled={loading}>Refresh</button>
      </header>

      <nav className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? "tab active" : "tab"}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {loading && <div className="banner info">Loading...</div>}
      {error && <div className="banner error">{error}</div>}
      {message && <div className="banner success">{message}</div>}

      <main className="content-grid">
        <section className="panel side">
          <h3>Lots</h3>
          <div className="lot-list">
            {lots.map((lot) => (
              <button
                key={lot.lotId}
                className={selectedLotId === lot.lotId ? "lot active" : "lot"}
                onClick={() => setSelectedLotId(lot.lotId)}
              >
                <div>{lot.lotId}</div>
                <small>{lot.materialName} | {lot.status}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="panel main">
          {activeTab === "Dashboard" && (
            <div>
              <h3>Dashboard KPI</h3>
              <div className="kpi-grid">
                {dashboard && Object.entries(dashboard).map(([k, v]) => (
                  <div key={k} className="kpi-card">
                    <strong>{k}</strong>
                    <div>{String(v)}</div>
                  </div>
                ))}
              </div>
              <h4>Retest Alerts</h4>
              <ul>
                {alerts.map((a) => (
                  <li key={a.alertId}>{a.lotId} - {a.reason}</li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === "Lots" && (
            <div>
              <h3>Lot Details</h3>
              {selectedLot ? (
                <table className="table">
                  <tbody>
                    {Object.entries(selectedLot).map(([k, v]) => (
                      <tr key={k}>
                        <td>{k}</td>
                        <td>{String(v ?? "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p>No lot selected.</p>}

              <h4>Bulk Quarantine</h4>
              <form className="form-grid" onSubmit={runBulkQuarantine}>
                <input placeholder="zone" value={bulkForm.zone} onChange={(e) => setBulkForm({ ...bulkForm, zone: e.target.value })} />
                <input placeholder="bin" value={bulkForm.bin} onChange={(e) => setBulkForm({ ...bulkForm, bin: e.target.value })} />
                <input placeholder="lotIds comma separated" value={bulkForm.lotIds} onChange={(e) => setBulkForm({ ...bulkForm, lotIds: e.target.value })} />
                <input placeholder="reason" required value={bulkForm.reason} onChange={(e) => setBulkForm({ ...bulkForm, reason: e.target.value })} />
                <input placeholder="actor" required value={bulkForm.actor} onChange={(e) => setBulkForm({ ...bulkForm, actor: e.target.value })} />
                <button type="submit">Apply bulk quarantine</button>
              </form>
            </div>
          )}

          {activeTab === "Workbench" && (
            <div>
              <h3>QCTest Workbench</h3>
              <p>Selected lot: <strong>{selectedLotId || "N/A"}</strong></p>

              <div className="split">
                <div>
                  <h4>Create Test</h4>
                  <form className="form-grid" onSubmit={createTest}>
                    <input value={testForm.lotId} onChange={(e) => setTestForm({ ...testForm, lotId: e.target.value })} placeholder="lotId" required />
                    <select value={testForm.testType} onChange={(e) => setTestForm({ ...testForm, testType: e.target.value })}>
                      <option>Identity</option><option>Potency</option><option>Microbial</option><option>GrowthPromotion</option><option>Physical</option><option>Chemical</option>
                    </select>
                    <input value={testForm.testMethod} onChange={(e) => setTestForm({ ...testForm, testMethod: e.target.value })} placeholder="testMethod" required />
                    <input type="date" value={testForm.testDate} onChange={(e) => setTestForm({ ...testForm, testDate: e.target.value })} required />
                    <input value={testForm.acceptanceCriteria} onChange={(e) => setTestForm({ ...testForm, acceptanceCriteria: e.target.value })} placeholder="acceptanceCriteria" />
                    <input value={testForm.testResult} onChange={(e) => setTestForm({ ...testForm, testResult: e.target.value })} placeholder="testResult" required />
                    <select value={testForm.resultStatus} onChange={(e) => setTestForm({ ...testForm, resultStatus: e.target.value })}>
                      <option>Pass</option><option>Fail</option><option>Pending</option>
                    </select>
                    <input value={testForm.performedBy} onChange={(e) => setTestForm({ ...testForm, performedBy: e.target.value })} placeholder="performedBy" required />
                    <input value={testForm.verifiedBy} onChange={(e) => setTestForm({ ...testForm, verifiedBy: e.target.value })} placeholder="verifiedBy" />
                    <button type="submit">Create Test</button>
                  </form>

                  <h4>Decision</h4>
                  <form className="form-grid" onSubmit={submitDecision}>
                    <select value={decisionForm.decision} onChange={(e) => setDecisionForm({ ...decisionForm, decision: e.target.value })}>
                      <option>Approve</option><option>Reject</option><option>Hold</option>
                    </select>
                    <input placeholder="reason" value={decisionForm.reason} onChange={(e) => setDecisionForm({ ...decisionForm, reason: e.target.value })} required />
                    <input placeholder="actor" value={decisionForm.actor} onChange={(e) => setDecisionForm({ ...decisionForm, actor: e.target.value })} required />
                    <input placeholder="evidenceIds comma separated" value={decisionForm.evidenceIdsText} onChange={(e) => setDecisionForm({ ...decisionForm, evidenceIdsText: e.target.value })} />
                    <button type="submit" disabled={decisionForm.decision === "Approve" && !canApprove}>Submit Decision</button>
                  </form>
                  {!canApprove && <small className="warn">Approve is disabled when tests are missing, pending, or failed.</small>}

                  <h4>Re-test</h4>
                  <form className="form-grid" onSubmit={submitRetest}>
                    <select value={retestForm.action} onChange={(e) => setRetestForm({ ...retestForm, action: e.target.value })}>
                      <option value="extend">extend</option>
                      <option value="discard">discard</option>
                    </select>
                    <input placeholder="reason" value={retestForm.reason} onChange={(e) => setRetestForm({ ...retestForm, reason: e.target.value })} required />
                    <input placeholder="actor" value={retestForm.actor} onChange={(e) => setRetestForm({ ...retestForm, actor: e.target.value })} required />
                    <input type="date" placeholder="newExpiryDate" value={retestForm.newExpiryDate} onChange={(e) => setRetestForm({ ...retestForm, newExpiryDate: e.target.value })} />
                    <input type="date" placeholder="newRetestDate" value={retestForm.newRetestDate} onChange={(e) => setRetestForm({ ...retestForm, newRetestDate: e.target.value })} />
                    <button type="submit">Submit Re-test</button>
                  </form>
                </div>

                <div>
                  <h4>Evidence</h4>
                  <form className="form-grid" onSubmit={uploadEvidenceMeta}>
                    <input placeholder="fileName" value={evidenceForm.fileName} onChange={(e) => setEvidenceForm({ ...evidenceForm, fileName: e.target.value })} required />
                    <select value={evidenceForm.fileType} onChange={(e) => setEvidenceForm({ ...evidenceForm, fileType: e.target.value })}>
                      <option value="image">image</option>
                      <option value="video">video</option>
                    </select>
                    <input placeholder="uploadedBy" value={evidenceForm.uploadedBy} onChange={(e) => setEvidenceForm({ ...evidenceForm, uploadedBy: e.target.value })} required />
                    <input placeholder="testId optional" value={evidenceForm.testId} onChange={(e) => setEvidenceForm({ ...evidenceForm, testId: e.target.value })} />
                    <button type="submit">Add Evidence Metadata</button>
                  </form>

                  <table className="table">
                    <thead><tr><th>evidenceId</th><th>fileName</th><th>fileType</th><th>uploadedBy</th></tr></thead>
                    <tbody>
                      {evidences.map((x) => (
                        <tr key={x.evidenceId}><td>{x.evidenceId}</td><td>{x.fileName}</td><td>{x.fileType}</td><td>{x.uploadedBy}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <h4>Tests of selected lot</h4>
              <table className="table">
                <thead><tr><th>testId</th><th>type</th><th>status</th><th>result</th><th>performedBy</th></tr></thead>
                <tbody>
                  {tests.map((t) => (
                    <tr key={t.testId}><td>{t.testId}</td><td>{t.testType}</td><td>{t.resultStatus}</td><td>{t.testResult}</td><td>{t.performedBy}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "Timeline" && (
            <div>
              <h3>Timeline</h3>
              <button onClick={loadTimeline}>Load timeline of selected lot</button>
              {timeline && (
                <div className="timeline-grid">
                  <article>
                    <h4>Lot</h4>
                    <pre>{JSON.stringify(timeline.lot, null, 2)}</pre>
                  </article>
                  <article>
                    <h4>Decisions</h4>
                    <pre>{JSON.stringify(timeline.decisions, null, 2)}</pre>
                  </article>
                  <article>
                    <h4>Tests</h4>
                    <pre>{JSON.stringify(timeline.tests, null, 2)}</pre>
                  </article>
                  <article>
                    <h4>Audit</h4>
                    <pre>{JSON.stringify(timeline.audit, null, 2)}</pre>
                  </article>
                </div>
              )}
            </div>
          )}

          {activeTab === "Suppliers" && (
            <div>
              <h3>Supplier Performance</h3>
              <div className="inline-form">
                <input type="date" value={supplierFilter.from} onChange={(e) => setSupplierFilter({ ...supplierFilter, from: e.target.value })} />
                <input type="date" value={supplierFilter.to} onChange={(e) => setSupplierFilter({ ...supplierFilter, to: e.target.value })} />
                <button onClick={loadSupplierReport}>Load report</button>
              </div>
              <table className="table">
                <thead><tr><th>Supplier</th><th>Total</th><th>Approved</th><th>Rejected</th><th>QualityRate</th></tr></thead>
                <tbody>
                  {supplierReport.map((r) => (
                    <tr key={r.supplierName}><td>{r.supplierName}</td><td>{r.totalBatches}</td><td>{r.approved}</td><td>{r.rejected}</td><td>{r.qualityRate}%</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "Returns" && (
            <div>
              <h3>Return Requests</h3>
              <button onClick={loadReturns}>Load return requests</button>
              <table className="table">
                <thead><tr><th>requestId</th><th>lotId</th><th>reason</th><th>status</th><th>action</th></tr></thead>
                <tbody>
                  {returnRequests.map((r) => (
                    <tr key={r.requestId}>
                      <td>{r.requestId}</td>
                      <td>{r.lotId}</td>
                      <td>{r.reason}</td>
                      <td>{r.status}</td>
                      <td>
                        <select onChange={(e) => updateReturnStatus(r.requestId, e.target.value)} value={r.status}>
                          <option>Open</option>
                          <option>Approved</option>
                          <option>Closed</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "Audit" && (
            <div>
              <h3>Audit Logs (Read-only)</h3>
              <button onClick={loadAudit}>Load audit logs</button>
              <table className="table">
                <thead><tr><th>time</th><th>actor</th><th>action</th><th>target</th></tr></thead>
                <tbody>
                  {auditLogs.map((a) => (
                    <tr key={a.auditId}><td>{a.timestamp}</td><td>{a.actor}</td><td>{a.action}</td><td>{a.targetType}:{a.targetId}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
