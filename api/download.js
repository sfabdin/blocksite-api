// api/download.js — serves the customer's HTML file from Upstash
// Called as: /api/download?orderId=BS-xxx
import zlib from "zlib";
import { promisify } from "util";
const gunzip = promisify(zlib.gunzip);

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

    // Decode outer base64 envelope — try plain JSON first, then gzip
    let decoded;
    try {
      decoded = JSON.parse(Buffer.from(upstashData.result, "base64").toString("utf8"));
    } catch(e) {
      // Data may be gzip-compressed — decompress first then parse
      try {
        const compressed = Buffer.from(upstashData.result, "base64");
        const decompressed = await gunzip(compressed);
        decoded = JSON.parse(decompressed.toString("utf8"));
      } catch(e2) {
        // Last resort: try parsing the raw result string directly
        try {
          decoded = JSON.parse(upstashData.result);
        } catch(e3) {
          console.error("Download: could not decode Upstash data", e3.message);
          return res.status(500).json({ error: "Could not decode stored data" });
        }
      }
    }

    // Upstash wraps the stored value in { value: "..." } on retrieval — unwrap it
    const inner = decoded.value ? JSON.parse(Buffer.from(decoded.value, "base64").toString("utf8")) : decoded;

    const htmlB64 = inner.htmlB64;
    const businessName = inner.businessName || "website";
    const bizSlug = businessName.toLowerCase().replace(/\s+/g, "-");

    console.log(`[${orderId}] Inner keys: ${Object.keys(inner).join(", ")}`);
    console.log(`[${orderId}] htmlB64 present: ${!!htmlB64}, length: ${htmlB64?.length || 0}, businessName: ${businessName}`);

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
