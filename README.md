# QCTest Demo Source Code

This folder contains a runnable backend demo for QCTest workflows.

## Run

1. Install dependencies
   - npm install
2. Start in dev mode
   - npm run dev
3. Open API
   - http://localhost:3300/api/health

## Implemented demo APIs

- POST /api/qc-tests
- GET /api/qc-tests
- GET /api/qc-tests/lot/:lotId
- PATCH /api/qc-tests/:testId
- DELETE /api/qc-tests/:testId
- POST /api/qc-tests/lot/:lotId/decision
- POST /api/qc-tests/lot/:lotId/retest
- POST /api/qc-tests/lot/:lotId/evidences
- GET /api/qc-tests/lot/:lotId/evidences
- DELETE /api/qc-tests/evidences/:evidenceId
- POST /api/qc-tests/quarantine/bulk
- GET /api/qc-tests/lot/:lotId/timeline
- GET /api/qc-tests/dashboard
- GET /api/qc-tests/supplier-performance
- GET /api/qc-tests/retest-alerts
- GET /api/return-requests
- PATCH /api/return-requests/:id
- GET /api/lots
- GET /api/audit-logs

## Sample quick test

Create test:

curl -X POST http://localhost:3300/api/qc-tests \
  -H "Content-Type: application/json" \
  -d '{
    "lotId":"LOT-001",
    "testType":"Chemical",
    "testMethod":"HPLC",
    "testDate":"2026-03-13",
    "testResult":"Assay 99.3%",
    "resultStatus":"Pass",
    "performedBy":"qc_user"
  }'

Submit decision:

curl -X POST http://localhost:3300/api/qc-tests/lot/LOT-001/decision \
  -H "Content-Type: application/json" \
  -d '{
    "decision":"Approve",
    "reason":"All required tests passed",
    "actor":"qc_manager",
    "evidenceIds":[]
  }'
