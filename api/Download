// api/download.js — serves the customer's HTML file from Upstash
// Called as: /api/download?orderId=BS-xxx

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).end();

  const { orderId } = req.query;
  if (!orderId) return res.status(400).json({ error: "Missing orderId" });

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!upstashUrl || !upstashToken) {
    return res.status(500).json({ error: "Storage not configured" });
  }

  try {
    const upstashRes = await fetch(`${upstashUrl}/get/order:${orderId}`, {
      headers: { Authorization: `Bearer ${upstashToken}` },
    });
    const upstashData = await upstashRes.json();

    if (!upstashData.result) {
      return res.status(404).send(`
        <html><body style="font-family:sans-serif;padding:40px;text-align:center">
          <h2>Link expired</h2>
          <p>This download link is only valid for 72 hours after generation.</p>
          <p>Email <a href="mailto:hello@blocksitebuilder.com">hello@blocksitebuilder.com</a> and we'll resend it.</p>
        </body></html>
      `);
    }

    const decoded = JSON.parse(Buffer.from(upstashData.result, "base64").toString("utf8"));
    const htmlB64 = decoded.htmlB64;
    const businessName = decoded.businessName || "website";
    const bizSlug = businessName.toLowerCase().replace(/\s+/g, "-");

    if (!htmlB64) {
      return res.status(404).json({ error: "File not found" });
    }

    const html = Buffer.from(htmlB64, "base64").toString("utf8");

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${bizSlug}.html"`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(html);

  } catch(e) {
    console.error("Download error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
