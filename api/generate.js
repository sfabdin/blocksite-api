// api/generate.js - Vercel serverless function
// 60 second max duration - no inactivity timeout issues

const https = require("https");

function buildPrompt(p) {
  const { businessName, businessType, industry, tagline, description, about, vibe, pages, phone, email, address, city, hours, typeSpecific, photos = [] } = p;
  const typeLabel = businessType === "restaurant" ? "Restaurant / Food Business" : businessType === "retail" ? "General Store / Retail" : "Specialty Service Business";
  const photoInstructions = photos.length > 0
    ? `The owner uploaded ${photos.length} real photo(s). Embed them in the gallery as <img> tags with these exact base64 data URLs:\n${photos.slice(0,4).map((url, i) => `Photo ${i+1}: src="${url}"`).join("\n")}`
    : `No photos uploaded. Use styled placeholder divs with emoji.`;
  const typeContent = businessType === "restaurant"
    ? `MENU SECTION: Beautiful menu section grouped by category using the details provided.`
    : businessType === "retail"
    ? `SPECIALS SECTION: Bold Sales and Specials section with featured deal cards.`
    : `SERVICES SECTION: Clean services grid with pricing if provided and clear booking CTA.`;

  return `You are a world-class web designer specializing in community-rooted small business websites. Generate a complete, beautiful, self-contained HTML website.

BUSINESS DETAILS:
- Name: ${businessName || "Local Business"}
- Type: ${typeLabel}
- Industry: ${industry || "small business"}
- Tagline: ${tagline || "Quality, community, care"}
- Description: ${description || "A trusted local business."}
- About: ${about || ""}
- City: ${city || "our community"}
- Phone: ${phone || ""} | Email: ${email || ""} | Address: ${address || ""}
- Hours: ${hours || ""}
- Pages: ${(pages || []).join(", ")}

TYPE-SPECIFIC CONTENT:
${typeSpecific || ""}

VIBE: "${vibe || "Warm, welcoming, community-first"}"

Choose a distinctive color palette, font pairing, and layout that truly matches this vibe.

PHOTOS: ${photoInstructions}

REQUIREMENTS:
1. COMMUNITY FEEL: Warm, neighborhood-rooted, human. Never corporate. Include Rooted in ${city || "Our Community"} section.
2. HERO: Warm welcome mat. Visitor feels this place is for me.
3. NAV: Fixed, smooth scroll, mobile hamburger menu.
4. ${typeContent}
5. CONTACT: Form with netlify attribute on the form tag. Show contact info beside it.
6. FOOTER: Personal and warm.
7. MOBILE FIRST: Perfect on a phone in portrait mode.
8. FONTS: https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,600;1,400&display=swap
9. No external JS. One self-contained file.
10. QUALITY BAR: Looks like a $2,000 boutique agency site.

OUTPUT: Raw HTML only. Start with <!DOCTYPE html>. No markdown, no explanation, no code fences.`;
}

function sendEmail(to, subject, html, attachments, resendKey, fromEmail) {
  if (!resendKey) return Promise.resolve();
  const payload = JSON.stringify({
    from: fromEmail || "BlockSite <hello@blocksitebuilder.com>",
    to, subject, html,
    ...(attachments?.length ? { attachments } : {})
  });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.resend.com", path: "/emails", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), "Authorization": `Bearer ${resendKey}` },
    }, (res) => { res.resume(); res.on("end", resolve); });
    req.on("error", resolve);
    req.write(payload);
    req.end();
  });
}

export default async function handler(req, res) {
  // CORS - allow requests from your Netlify site
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  const formData = req.body;
  const orderId = `BS-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;

  try {
    const prompt = buildPrompt(formData);

    // Call Claude - Vercel gives us 60 seconds, no inactivity timeout
    const html = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      });

      const request = https.request({
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
      }, (response) => {
        let data = "";
        response.on("data", c => { data += c; });
        response.on("end", () => {
          try {
            if (response.statusCode !== 200) {
              reject(new Error(`Anthropic ${response.statusCode}: ${data.slice(0,300)}`));
              return;
            }
            const parsed = JSON.parse(data);
            if (parsed.error) { reject(new Error(parsed.error.message)); return; }
            const text = parsed.content?.find(b => b.type === "text")?.text || "";
            const cleanHtml = text.replace(/^```html?\n?/i, "").replace(/\n?```$/m, "").trim();
            if (!cleanHtml || cleanHtml.length < 200) { reject(new Error("Empty response from AI")); return; }
            resolve(cleanHtml);
          } catch(e) { reject(e); }
        });
      });
      request.on("error", reject);
      request.write(body);
      request.end();
    });

    // Send owner email
    const ownerEmail = process.env.OWNER_EMAIL;
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL;

    if (ownerEmail && resendKey) {
      const bizSlug = (formData.businessName || "website").toLowerCase().replace(/\s+/g, "-");
      sendEmail(
        ownerEmail,
        `[BlockSite] ${formData.businessName || "New site"} · ${orderId}`,
        `<div style="font-family:sans-serif;padding:24px">
          <h2>New BlockSite Preview</h2>
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Business:</strong> ${formData.businessName}</p>
          <p><strong>Customer:</strong> ${formData.email || "—"}</p>
          <p><strong>City:</strong> ${formData.city || "—"}</p>
          <p><strong>Vibe:</strong> "${formData.vibe || "—"}"</p>
          <p>Full HTML attached.</p>
        </div>`,
        [{ filename: `${bizSlug}.html`, content: Buffer.from(html).toString("base64") }],
        resendKey, fromEmail
      );
    }

    // Send customer email
    if (formData.email && resendKey) {
      sendEmail(
        formData.email,
        `Your BlockSite preview is ready — ${formData.businessName || "Your Business"}`,
        `<div style="font-family:sans-serif;padding:24px;max-width:600px">
          <h2>Your site preview is ready!</h2>
          <p>Head back to blocksitebuilder.com to view your preview and choose your package.</p>
          <p><strong>Order ID:</strong> ${orderId}</p>
        </div>`,
        [], resendKey, fromEmail
      );
    }

    return res.status(200).json({ html, orderId });

  } catch (err) {
    console.error("Generation failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
