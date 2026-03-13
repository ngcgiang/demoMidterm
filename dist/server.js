"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const qcRoutes_1 = require("./routes/qcRoutes");
const qcService_1 = require("./services/qcService");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use("/api", qcRoutes_1.qcRouter);
app.get("/", (_req, res) => {
    res.send("QCTest demo API is running");
});
const PORT = Number(process.env.PORT || 3300);
app.listen(PORT, () => {
    console.log(`QCTest demo listening on http://localhost:${PORT}`);
});
// Demo cron-like scheduler for re-test alerts.
setInterval(() => {
    const created = qcService_1.qcService.createRetestAlerts();
    if (created.length > 0) {
        console.log(`Created ${created.length} retest alert(s)`);
    }
}, 60000);
