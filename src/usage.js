const db = require("./database");
const { calculateTokenCost } = require("./cost");

async function recordUsage(req, res) {
    try {
        const tenantId = req.body.tenantId;
        const usageType = req.body.usageType;
        const quantity = req.body.quantity;

        const inputTokens = req.body.inputTokens || 0;
        const cachedInputTokens = req.body.cachedInputTokens || 0;
        const outputTokens = req.body.outputTokens || 0;
        const reasoningTokens = req.body.reasoningTokens || 0;

        const idempotencyKey = req.get("Idempotency-Key");

        // -----------------------------
        // Basic validation
        // -----------------------------
        if (!tenantId || !usageType || quantity === undefined) {
            return res.status(400).json({
                error: "tenantId, usageType and quantity are required"
            });
        }

        if (Number(quantity) <= 0) {
            return res.status(400).json({
                error: "quantity must be greater than 0"
            });
        }

        if (!idempotencyKey) {
            return res.status(400).json({
                error: "Idempotency-Key header is required"
            });
        }

        // -----------------------------
        // Idempotency check
        // -----------------------------
        const existingUsage = await db.query(
            `SELECT *
             FROM usage_events
             WHERE tenant_id = $1
             AND idempotency_key = $2`,
            [tenantId, idempotencyKey]
        );

        if (existingUsage.rows.length > 0) {
            return res.status(200).json({
                message: "Usage already recorded",
                data: existingUsage.rows[0]
            });
        }

        // -----------------------------
        // Calculate AI token cost
        // -----------------------------
        let cost = 0;

        if (usageType === "ai_tokens") {
            cost = calculateTokenCost({
                inputTokens,
                cachedInputTokens,
                outputTokens,
                reasoningTokens
            });
        }

        // -----------------------------
        // Check API call quota
        // -----------------------------
        if (usageType === "api_call") {

            const quotaResult = await db.query(
                `SELECT p.api_call_limit
                 FROM subscriptions s
                 JOIN plans p ON s.plan_id = p.id
                 WHERE s.tenant_id = $1
                 AND s.status = 'active'`,
                [tenantId]
            );

            if (quotaResult.rows.length === 0) {
                return res.status(404).json({
                    error: "Active subscription not found"
                });
            }

            const apiLimit = Number(
                quotaResult.rows[0].api_call_limit
            );

            const usageResult = await db.query(
                `SELECT COALESCE(SUM(quantity), 0) AS total
                 FROM usage_events
                 WHERE tenant_id = $1
                 AND usage_type = 'api_call'
                 AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)`,
                [tenantId]
            );

            const currentUsage = Number(
                usageResult.rows[0].total
            );

            if (currentUsage + Number(quantity) > apiLimit) {
                return res.status(429).json({
                    error: "API call quota exceeded",
                    limit: apiLimit,
                    used: currentUsage
                });
            }
        }

        // -----------------------------
        // Check AI token quota
        // -----------------------------
        if (usageType === "ai_tokens") {

            const quotaResult = await db.query(
                `SELECT p.ai_token_limit
                 FROM subscriptions s
                 JOIN plans p ON s.plan_id = p.id
                 WHERE s.tenant_id = $1
                 AND s.status = 'active'`,
                [tenantId]
            );

            if (quotaResult.rows.length === 0) {
                return res.status(404).json({
                    error: "Active subscription not found"
                });
            }

            const tokenLimit = Number(
                quotaResult.rows[0].ai_token_limit
            );

            const usageResult = await db.query(
                `SELECT COALESCE(SUM(quantity), 0) AS total
                 FROM usage_events
                 WHERE tenant_id = $1
                 AND usage_type = 'ai_tokens'
                 AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)`,
                [tenantId]
            );

            const currentTokenUsage = Number(
                usageResult.rows[0].total
            );

            if (currentTokenUsage + Number(quantity) > tokenLimit) {
                return res.status(429).json({
                    error: "AI token quota exceeded",
                    limit: tokenLimit,
                    used: currentTokenUsage
                });
            }
        }

        // -----------------------------
        // Insert usage event
        // -----------------------------
        const result = await db.query(
            `INSERT INTO usage_events
            (
                id,
                tenant_id,
                usage_type,
                quantity,
                idempotency_key,
                input_tokens,
                cached_input_tokens,
                output_tokens,
                reasoning_tokens,
                cost
            )
            VALUES
            (
                gen_random_uuid(),
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9
            )
            RETURNING *`,
            [
                tenantId,
                usageType,
                quantity,
                idempotencyKey,
                inputTokens,
                cachedInputTokens,
                outputTokens,
                reasoningTokens,
                cost
            ]
        );

        return res.status(201).json({
            message: "Usage recorded successfully",
            data: result.rows[0]
        });

    } catch (error) {

        console.error("USAGE ERROR:", error);

        // Handle duplicate idempotency key
        if (error.code === "23505") {

            const existingUsage = await db.query(
                `SELECT *
                 FROM usage_events
                 WHERE tenant_id = $1
                 AND idempotency_key = $2`,
                [
                    req.body.tenantId,
                    req.get("Idempotency-Key")
                ]
            );

            if (existingUsage.rows.length > 0) {
                return res.status(200).json({
                    message: "Usage already recorded",
                    data: existingUsage.rows[0]
                });
            }
        }

        return res.status(500).json({
            error: "Failed to record usage"
        });
    }
}


// =====================================
// GET USAGE SUMMARY
// =====================================

async function getUsageSummary(req, res) {
    try {

        const tenantId = req.params.tenantId;

        const result = await db.query(
            `SELECT
                usage_type,
                SUM(quantity) AS total_usage,
                SUM(cost) AS total_cost
             FROM usage_events
             WHERE tenant_id = $1
             AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)
             GROUP BY usage_type
             ORDER BY usage_type`,
            [tenantId]
        );

        return res.json({
            tenantId: tenantId,
            usage: result.rows
        });

    } catch (error) {

        console.error("SUMMARY ERROR:", error);

        return res.status(500).json({
            error: "Failed to get usage summary"
        });
    }
}


module.exports = {
    recordUsage,
    getUsageSummary
};