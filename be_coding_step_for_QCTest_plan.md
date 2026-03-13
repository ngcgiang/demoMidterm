# BE Coding Step Plan - QCTest (Midterm Demo)

## 1) Muc tieu
Lap ke hoach coding backend cho QCTest dua tren:
- 02_Domain Model.md
- 04_Product Backlog.md (phan Quality Control Technician + cac US lien quan Manager/Operator)

Muc tieu chinh:
- Hoan thien luong QC cho lot: Pending/Quarantine -> Approve/Reject/Hold.
- Dam bao traceability, audit trail, va hard-lock lot reject.
- San sang cho bao cao COA, supplier performance, va re-test.

---

## 2) Pham vi nghiep vu cho QCTest

### 2.1 User Stories duoc cover (uu tien)
- QC-US01: Danh gia lo cho nhap kho.
- QC-US02: Xu ly lo reject + ly do + evidence + return request.
- QC-US03: Re-test dinh ky, extend/discard.
- QC-US04: Quarantine hang loat theo zone/bin.
- QC-US05: Traceability timeline + COA PDF.
- QC-US06: Bao cao hieu suat nha cung cap.

### 2.2 User Stories lien quan can ho tro ky thuat
- Manager-US08: Canh bao het han/ton lau (du lieu QC can feed vao dashboard).
- Manager-US07: Lich su giao dich/audit.
- Operator-US02: Chi cho put-away/picking khi lot da duoc phe duyet.

---

## 3) Domain design can chot truoc khi code

### 3.1 Entities/Aggregates can dung
- InventoryLot
  - lot_id, status, storage_location/bin, expiration_date, supplier_name, material_id
- QCTest
  - test_id, lot_id, test_type, test_method, test_result, acceptance_criteria, result_status, performed_by, verified_by
- QCEvidence (new)
  - evidence_id, lot_id or test_id, file_url, file_type(image/video), uploaded_by, uploaded_at
- QCDecisionLog (new)
  - decision_id, lot_id, decision(Approve/Reject/Hold/Extend/Discard), reason, actor, decided_at
- ReturnRequest (new)
  - request_id, lot_id, reason, evidence_refs, status(Open/Approved/Closed), created_by
- SupplierQualitySnapshot (read-model)
  - supplier_name, total_batches, approved, rejected, quality_rate

### 3.2 Trang thai lot (enforce)
- Quarantine/PendingQC -> Accepted
- Quarantine/PendingQC -> Rejected
- Quarantine/PendingQC -> Hold
- Hold -> Accepted/Rejected
- Rejected la terminal cho luong thuong mai (hard-lock transfer/picking)

### 3.3 Rules bat buoc
- Reject bat buoc co reject_reason.
- Reject bat buoc co toi thieu 1 evidence.
- Neu co 1 required test fail => khong duoc approve.
- Lot chua duoc approve thi chan put-away/picking.
- Moi decision va test update phai ghi audit log.

---

## 4) Architecture BE de xuat

### 4.1 Modules
- qc-test (core)
- qc-evidence (new, co the nam chung qc-test module)
- qc-decision (new, co the nam chung qc-test module)
- return-request (new)
- audit-log (new/shared)
- report-coa (new, hoac trong reporting module)

### 4.2 Integration points
- inventory-lot module: update status + lock policy
- material module: thong tin spec/checklist
- user/auth module: actor + role guard
- storage service (S3/MinIO/local) cho evidence
- job scheduler (cron) cho re-test queue

---

## 5) Coding step chi tiet (theo thu tu)

## Step 0 - Chuan bi ky thuat
- Chot enum:
  - TestType: Identity, Potency, Microbial, GrowthPromotion, Physical, Chemical
  - ResultStatus: Pass, Fail, Pending
  - LotDecision: Approve, Reject, Hold, Extend, Discard
- Chot convention API response + error code.
- Chot role guard: QC, Manager, Operator.

Deliverable:
- ADR nho (1 file) cho enum, state transition, error model.

## Step 1 - Schema migration/index
- Tao/cap nhat schema:
  - qc_tests
  - qc_evidences
  - qc_decision_logs
  - return_requests
- Them index:
  - qc_tests: (lot_id, test_date), (result_status), (test_type)
  - qc_decision_logs: (lot_id, decided_at)
  - qc_evidences: (lot_id), (test_id)
  - return_requests: (lot_id), (status)

Deliverable:
- Migration scripts + rollback scripts.

## Step 2 - Core APIs cho QCTest
- POST /qc-tests
- GET /qc-tests?lot_id=&result_status=&test_type=&from=&to=
- GET /qc-tests/lot/:lot_id
- PATCH /qc-tests/:test_id
- DELETE /qc-tests/:test_id (chi cho admin/manager theo policy)

Validation:
- test_result khong rong
- test_date hop le
- lot_id ton tai

Deliverable:
- Controller + Service + Repository + unit tests.

## Step 3 - Decision workflow APIs
- POST /qc-tests/lot/:lot_id/decision
  - payload: decision, reason, performed_by, evidence_ids[]
- Rule engine:
  - Approve: tat ca required tests pass
  - Reject: reason + evidence bat buoc
  - Hold: reason bat buoc
- Cap nhat InventoryLot status theo transition matrix.

Deliverable:
- Decision service + state transition guard + integration test.

## Step 4 - Evidence upload APIs
- POST /qc-tests/lot/:lot_id/evidences (multipart)
- GET /qc-tests/lot/:lot_id/evidences
- DELETE /qc-tests/evidences/:evidence_id

Validation:
- type: image/video
- size limit theo policy (vd 5MB hoac 10MB)

Deliverable:
- File storage adapter + virus/mime validation + signed URL.

## Step 5 - Return Request tu dong khi Reject
- Neu decision = Reject:
  - auto create ReturnRequest
  - status Open
  - lien ket evidence + reason
- API:
  - GET /return-requests?status=&lot_id=
  - PATCH /return-requests/:id (Manager)

Deliverable:
- Auto trigger + event bus message + test scenario reject->request.

## Step 6 - Hard-lock rules voi inventory operations
- Tang gate trong inventory module:
  - khong cho transfer/picking/put-away voi lot status Rejected/Hold/PendingQC (tuy policy)
- Trung tam policy trong 1 service dung chung.

Deliverable:
- Guard/policy middleware + e2e test voi operator flow.

## Step 7 - Re-test va cron jobs
- API:
  - POST /qc-tests/lot/:lot_id/retest (action: extend/discard)
- Cron:
  - daily 00:00 tao danh sach lot can re-test theo next_retest_date/expiry.
- Persist alert queue:
  - qc_retest_alerts

Deliverable:
- Scheduler + alert query endpoints + test voi fake timer.

## Step 8 - Bulk Quarantine theo zone/bin
- API:
  - POST /qc-tests/quarantine/bulk
  - payload: scope(zone/bin), reason, lot_ids(optional)
- Batch update status + ghi incident log.

Deliverable:
- Bulk transaction + rollback strategy neu partial fail.

## Step 9 - Traceability timeline + COA
- API timeline:
  - GET /qc-tests/lot/:lot_id/timeline
  - hop nhat: lot status, tests, decisions, evidences, transactions
- API COA:
  - GET /qc-tests/lot/:lot_id/coa.pdf

Deliverable:
- COA template + pdf generator + signed metadata (hash/checksum).

## Step 10 - Supplier performance report
- API:
  - GET /qc-tests/supplier-performance?from=&to=&groupBy=month|quarter|year
- Metrics:
  - quality_rate = rejected/total
  - approval_rate = approved/total

Deliverable:
- Aggregation pipeline + index tuning + benchmark query.

## Step 11 - Audit log va security
- Log bat buoc:
  - actor, action, target, before/after, ip, user-agent, timestamp
- Audit log read-only:
  - chi GET, khong update/delete
- Role guard chi tiet cho tung endpoint.

Deliverable:
- audit middleware/interceptor + immutable storage policy.

## Step 12 - Test, benchmark, hardening
- Unit test:
  - validation + transition rules
- Integration test:
  - create test -> decision -> lot status
- E2E test:
  - reject flow tao return request, hard-lock picking
- Performance:
  - timeline < 3s, search lot < 2-3s (dataset demo)

Deliverable:
- Test report + performance report + bug list.

---

## 6) API backlog de implement nhanh (MVP -> Full)

### MVP (de demo)
- POST /qc-tests
- GET /qc-tests/lot/:lot_id
- POST /qc-tests/lot/:lot_id/decision
- POST /qc-tests/lot/:lot_id/retest
- GET /qc-tests/dashboard
- GET /qc-tests/supplier-performance

### Full scope
- Evidence upload/delete
- Bulk quarantine
- Return request workflow
- Timeline + COA PDF
- Audit read-only portal

---

## 7) Definition of Done (cho QCTest)
- 100% endpoint co DTO validation.
- Transition status lot khong vi pham business rules.
- Reject flow co reason + evidence + auto return request.
- Hard-lock reject lot duoc enforce o inventory operations.
- Audit log co truoc/sau thay doi cho decision quan trong.
- Unit + integration + e2e pass.
- API docs (OpenAPI) day du request/response examples.

---

## 8) Ke hoach sprint de nghi

### Sprint 1 (P0)
- Step 0 -> Step 4
- Muc tieu: QC-US01, QC-US02 nen tang

### Sprint 2 (P0/P1)
- Step 5 -> Step 8
- Muc tieu: QC-US02, QC-US03, QC-US04

### Sprint 3 (P1/P2)
- Step 9 -> Step 12
- Muc tieu: QC-US05, QC-US06 + on dinh he thong

---

## 9) Risk va giai phap
- Risk: Rule QC thay doi theo material/supplier
  - Giai phap: rule engine config-driven (khong hard-code)
- Risk: File evidence lon, upload cham
  - Giai phap: async upload + size limit + object storage
- Risk: Query timeline cham khi du lieu lon
  - Giai phap: index + read-model denormalized
- Risk: Xung dot status khi nhieu user thao tac
  - Giai phap: optimistic lock/version field

---

## 10) Bang mapping nhanh: User Story -> Step
- QC-US01 -> Step 1,2,3
- QC-US02 -> Step 3,4,5,6
- QC-US03 -> Step 7
- QC-US04 -> Step 8
- QC-US05 -> Step 9
- QC-US06 -> Step 10
- Manager-US08 -> Step 7,10
- Manager-US07/US15 -> Step 11

---

## 11) Ghi chu trien khai trong codebase hien tai
- Uu tien mo rong module san co: backend/src/qc-test
- Tich hop status policy vao: backend/src/inventory-lot
- Tranh duplicate logic: transition rules dat o 1 domain service duy nhat
- Tat ca event quan trong nen phat event bus de sau nay de tach reporting
