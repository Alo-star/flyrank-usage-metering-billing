const { createCheckoutSession } = require("./stripeCheckout");
const { handleWebhook } = require("./stripeWebhook");
const usage = require("./usage");
require("dotenv").config();

const express = require("express");
const db = require("./database");

const app = express();
app.post(
    "/stripe/webhook",
    express.raw({ type: "application/json" }),
    handleWebhook
);

app.use(express.json());

app.post("/usage", usage.recordUsage);
app.post("/stripe/checkout", createCheckoutSession);
app.get("/usage/:tenantId", usage.getUsageSummary);

app.get("/db-test", async (req, res) => {
    try {
        const result = await db.query("SELECT NOW()");

        res.json({
            message: "Database connected successfully",
            time: result.rows[0].now
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Database connection failed"
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});