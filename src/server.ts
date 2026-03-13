import cors from "cors";
import express from "express";
import { qcRouter } from "./routes/qcRoutes";
import { qcService } from "./services/qcService";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", qcRouter);

app.get("/", (_req, res) => {
  res.send("QCTest demo API is running");
});

const PORT = Number(process.env.PORT || 3300);
app.listen(PORT, () => {
  console.log(`QCTest demo listening on http://localhost:${PORT}`);
});

// Demo cron-like scheduler for re-test alerts.
setInterval(() => {
  const created = qcService.createRetestAlerts();
  if (created.length > 0) {
    console.log(`Created ${created.length} retest alert(s)`);
  }
}, 60_000);
