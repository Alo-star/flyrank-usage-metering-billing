const stripe = require("./stripe");
const db = require("./database");

async function handleWebhook(req, res) {
    const signature = req.headers["stripe-signature"];

    try {
        const event = stripe.webhooks.constructEvent(
            req.body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );

        console.log("Stripe event received:", event.type);

        switch (event.type) {

            case "checkout.session.completed": {

                const session = event.data.object;

                const tenantId = session.client_reference_id;

                if (!tenantId) {
                    console.log("No tenant ID found in checkout session");
                    break;
                }

                const proPlan = await db.query(
                    `SELECT id
                     FROM plans
                     WHERE name = 'Pro'`
                );

                if (proPlan.rows.length === 0) {
                    console.log("Pro plan not found");
                    break;
                }

                const proPlanId = proPlan.rows[0].id;

                await db.query(
                    `UPDATE subscriptions
                     SET plan_id = $1,
                         status = 'active',
                         stripe_customer_id = $2,
                         stripe_subscription_id = $3,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE tenant_id = $4`,
                    [
                        proPlanId,
                        session.customer || null,
                        session.subscription || null,
                        tenantId
                    ]
                );

                console.log("Tenant upgraded to Pro:", tenantId);

                break;
            }

            case "customer.subscription.created":
                console.log("Subscription created");
                break;

            case "customer.subscription.updated":
                console.log("Subscription updated");
                break;

            default:
                console.log("Unhandled event:", event.type);
        }

        res.json({ received: true });

    } catch (error) {
        console.error(
            "Webhook signature verification failed:",
            error.message
        );

        res.status(400).send("Webhook Error");
    }
}

module.exports = {
    handleWebhook
};