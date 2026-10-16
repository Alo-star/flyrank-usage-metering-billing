const stripe = require("./stripe");

async function createCheckoutSession(req, res) {
    try {
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",

            client_reference_id:
                "11111111-1111-1111-1111-111111111111",

            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: "FlyRank Pro Plan"
                        },
                        recurring: {
                            interval: "month"
                        },
                        unit_amount: 1000
                    },
                    quantity: 1
                }
            ],

            success_url: "http://localhost:3000/success",
            cancel_url: "http://localhost:3000/cancel"
        });

        res.json({
            checkoutUrl: session.url
        });

    } catch (error) {
        console.error("STRIPE CHECKOUT ERROR:", error.message);

        res.status(500).json({
            error: "Failed to create Stripe Checkout session"
        });
    }
}

module.exports = {
    createCheckoutSession
};