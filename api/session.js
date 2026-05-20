// api/session.js — looks up a Stripe Checkout Session by ID
// Used by the frontend after Stripe redirect to get package info

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).end();

  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: "Stripe not configured" });

  try {
    const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { Authorization: `Basic ${Buffer.from(stripeKey + ":").toString("base64")}` },
    });
    const session = await stripeRes.json();
    if (!stripeRes.ok) return res.status(400).json({ error: session.error?.message });

    return res.status(200).json({
      orderId: session.client_reference_id,
      email: session.customer_details?.email,
      packageId: session.metadata?.packageId,
      customerName: session.customer_details?.name,
      amountTotal: session.amount_total,
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
