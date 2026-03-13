# FE Coding Plan - QCTest (Midterm Demo)

## 1. Muc tieu
Tai lieu nay chuyen doi tu BE plan sang FE implementation plan cho QCTest.
Muc tieu:
- Xay dung giao dien QC theo dung workflow PendingQC/Quarantine -> Approve/Reject/Hold.
- Dong bo chat voi API backend demo da co.
- Dam bao UX ro rang, co validation, co trang thai loading/error, va de demo.

## 2. Pham vi tinh nang FE

### 2.1 Core scope
- Dashboard QC KPI.
- Danh sach lot can QC + filter.
- Danh sach test theo lot + tao/sua/xoa test.
- Decision panel: Approve/Reject/Hold.
- Re-test panel: Extend/Discard.
- Evidence upload/list/delete.
- Bulk Quarantine theo zone/bin/lotIds.
- Timeline lot.
- Supplier performance report.
- Return request list/update status.
- Audit log read-only.

### 2.2 Scope bo sung cho demo
- Toast notification.
- Confirm dialog cho action nguy hiem (Reject/Discard/Delete).
- Form validation frontend truoc khi goi API.

## 3. Thiet ke FE architecture

### 3.1 Cau truc de xuat
- src/pages/qc/
  - DashboardQC.tsx
  - QCLotList.tsx
  - QCTestWorkbench.tsx
  - QCTimeline.tsx
  - SupplierPerformance.tsx
  - ReturnRequest.tsx
- src/components/qc/
  - LotTable.tsx
  - QCTestTable.tsx
  - CreateTestModal.tsx
  - DecisionModal.tsx
  - RetestModal.tsx
  - EvidenceUploader.tsx
  - BulkQuarantinePanel.tsx
  - KpiCards.tsx
- src/services/
  - qcApi.ts
- src/types/
  - qc.ts
- src/hooks/
  - useQCLots.ts
  - useQCTests.ts
  - useQCDecision.ts
  - useRetestAlerts.ts

### 3.2 State management
- Local state + custom hooks la du cho midterm demo.
- Neu can scale nhanh: su dung TanStack Query de cache data va invalidate sau mutation.

### 3.3 Router de xuat
- /qc/dashboard
- /qc/lots
- /qc/workbench/:lotId
- /qc/timeline/:lotId
- /qc/suppliers
- /qc/return-requests
- /qc/audit

## 4. Data contracts FE can dung

### 4.1 Types can khai bao
- InventoryLot
- QCTest
- QCEvidence
- QCDecisionLog
- ReturnRequest
- DashboardKpi
- SupplierPerformanceItem
- RetestAlert

### 4.2 API mapping
- GET /api/qc-tests/dashboard
- GET /api/lots
- GET /api/qc-tests?lotId=&resultStatus=&testType=
- GET /api/qc-tests/lot/:lotId
- POST /api/qc-tests
- PATCH /api/qc-tests/:testId
- DELETE /api/qc-tests/:testId
- POST /api/qc-tests/lot/:lotId/decision
- POST /api/qc-tests/lot/:lotId/retest
- POST /api/qc-tests/lot/:lotId/evidences
- GET /api/qc-tests/lot/:lotId/evidences
- DELETE /api/qc-tests/evidences/:evidenceId
- POST /api/qc-tests/quarantine/bulk
- GET /api/qc-tests/lot/:lotId/timeline
- GET /api/qc-tests/supplier-performance
- GET /api/return-requests
- PATCH /api/return-requests/:id
- GET /api/qc-tests/retest-alerts
- GET /api/audit-logs

## 5. Coding step chi tiet FE

## Step 0 - Setup co ban
- Tao types trong src/types/qc.ts.
- Tao qcApi.ts gom ham call endpoint.
- Tao util chung: formatDate, formatStatus, parseApiError.
- Tao loading skeleton va empty state component.

Deliverable:
- FE compile pass, co the goi API health.

## Step 1 - Dashboard QC
- Tao KPI cards:
  - totalLots
  - pendingQc
  - accepted
  - rejected
  - hold
  - openReturnRequests
- Hien thi retest alerts.
- Add quick action button den workbench.

Deliverable:
- Page /qc/dashboard dung GET /api/qc-tests/dashboard va /api/qc-tests/retest-alerts.

## Step 2 - Lot list + filter
- Tao QCLotList:
  - table lots
  - filter theo status, zone, supplier
  - search theo lotId/materialName
- Action tren moi row:
  - View tests
  - Open timeline
  - Open decision modal

Deliverable:
- Page /qc/lots hoat dong voi GET /api/lots.

## Step 3 - QCTest workbench
- Tao QCTestTable + CreateTestModal.
- CRUD test:
  - create
  - edit basic fields
  - delete co confirm
- Filter test theo type/resultStatus.

Deliverable:
- Page /qc/workbench/:lotId dung endpoint /api/qc-tests/lot/:lotId va /api/qc-tests.

## Step 4 - Decision workflow UI
- Tao DecisionModal:
  - decision dropdown: Approve/Reject/Hold
  - reason bat buoc
  - evidenceIds bat buoc khi Reject
- Khoa nut Approve neu co test Pending/Fail (kiem tra tren client de UX tot, backend van la source of truth).

Deliverable:
- Call POST /api/qc-tests/lot/:lotId/decision.
- Update ngay state lot tren UI sau success.

## Step 5 - Evidence upload
- Tao EvidenceUploader:
  - chon file
  - chon fileType image/video
  - uploadedBy bat buoc
- List evidence + delete.

Deliverable:
- POST/GET/DELETE evidence endpoint hoat dong.

## Step 6 - Re-test panel
- Tao RetestModal:
  - action extend/discard
  - reason bat buoc
  - newExpiryDate bat buoc neu extend
- Sau submit, refresh lot status va timeline.

Deliverable:
- POST /api/qc-tests/lot/:lotId/retest.

## Step 7 - Bulk Quarantine
- Tao BulkQuarantinePanel:
  - nhap zone/bin hoac lotIds
  - reason + actor
  - preview lots match
- Confirm dialog truoc khi submit.

Deliverable:
- POST /api/qc-tests/quarantine/bulk + refresh list.

## Step 8 - Timeline va traceability
- Tao page timeline:
  - lot info
  - tests
  - decisions
  - evidence
  - audit events
- Sap xep theo thoi gian giam dan.

Deliverable:
- GET /api/qc-tests/lot/:lotId/timeline.

## Step 9 - Supplier performance
- Tao bieu do cot va bang.
- Filter from/to.
- Hien qualityRate, approved, rejected, totalBatches.

Deliverable:
- GET /api/qc-tests/supplier-performance.

## Step 10 - Return request + audit
- ReturnRequest page:
  - list
  - filter status
  - update status Open/Approved/Closed
- Audit page:
  - read-only table
  - filter actor/action/target

Deliverable:
- GET/PATCH return request + GET audit log.

## Step 11 - Hardening va polish
- Error boundary cho cac page QC.
- Retry button khi fail.
- Debounce search.
- Permission guard tren route QC.

Deliverable:
- Demo UX on dinh, tuong tac nhanh, co thong bao loi ro rang.

## 6. Validation rules FE can enforce
- Create test:
  - lotId, testType, testMethod, testDate, testResult, resultStatus, performedBy bat buoc.
- Decision:
  - reason bat buoc.
  - Reject bat buoc evidenceIds khong rong.
- Retest:
  - action bat buoc.
  - Extend bat buoc newExpiryDate.
- Evidence:
  - fileType va uploadedBy bat buoc.

## 7. Test plan FE

### 7.1 Unit test
- Parse validation form.
- Table sort/filter functions.
- Mapper API response -> UI model.

### 7.2 Integration test
- Workbench tao test -> list cap nhat.
- Decision reject -> tao return request + lot status doi.
- Upload evidence -> hien thi ngay.

### 7.3 UAT checklist demo
- Co the approve lot khi tat ca test pass.
- Reject khong evidence thi chan.
- Bulk quarantine cap nhat dung lot.
- Timeline hien day du event.
- Supplier report co du so lieu.

## 8. Mapping nhanh FE step -> User Story
- QC-US01 -> Step 2,3,4
- QC-US02 -> Step 4,5,10
- QC-US03 -> Step 1,6
- QC-US04 -> Step 7
- QC-US05 -> Step 8
- QC-US06 -> Step 9

## 9. DoD FE (Definition of Done)
- Tat ca page QC route duoc va khong crash.
- Tat ca API trong MVP goi duoc va handle loading/error.
- Validation front-end dung theo rule quan trong.
- UI update state dung sau mutation.
- Co tai lieu huong dan test nhanh cho demo.

## 10. Ke hoach sprint FE de nghi

### Sprint 1
- Step 0 -> Step 4
- Muc tieu: Luong QC core co the tao test va submit decision.

### Sprint 2
- Step 5 -> Step 8
- Muc tieu: Evidence, retest, bulk quarantine, timeline.

### Sprint 3
- Step 9 -> Step 11
- Muc tieu: Report, return request, audit, polish.
