/**
 * Stripe 官方 sample 改寫版 — 支援多個 Price ID
 * 用法：npm install express stripe dotenv && node stripe-sample/server.js
 *
 * 此檔案供參考；正式 App 使用 Next.js API：
 *   POST /api/stripe/create-checkout-session
 */
require("dotenv").config();
const express = require("express");
const Stripe = require("stripe");

const app = express();
const PORT = process.env.PORT || 4242;

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("請在 .env 設定 STRIPE_SECRET_KEY");
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const ALLOWED_PRICES = new Set(
  [
    process.env.STRIPE_PRICE_SOLO || "price_solo_placeholder",
    process.env.STRIPE_PRICE_COACH_PRO || "price_pro_placeholder",
  ].filter(Boolean)
);

const SITE_URL = (process.env.SITE_URL || "http://localhost:4242").replace(
  /\/$/,
  ""
);

app.use(express.static("stripe-sample"));
app.use(express.json());

app.post("/create-checkout-session", async (req, res) => {
  try {
    const priceId = String(req.body?.priceId || "").trim();

    if (!priceId || !ALLOWED_PRICES.has(priceId)) {
      return res.status(400).json({
        error: "Invalid priceId. Use price_solo_placeholder or price_pro_placeholder.",
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${SITE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/checkout.html`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        price_id: priceId,
      },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Checkout failed",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Stripe sample running on http://localhost:${PORT}`);
  console.log("Open http://localhost:4242/checkout.html");
});
