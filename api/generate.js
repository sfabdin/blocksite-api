// api/generate.js - Vercel serverless function
// Max duration: 300 seconds (set in vercel.json)

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  const p = req.body;
  const orderId = `BS-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  const photoCount = p.photoCount || 0;

  console.log(`Generating for: ${p.businessName}, photos: ${photoCount}`);

  const typeLabel = p.businessType === "restaurant" ? "Restaurant / Food Business"
    : p.businessType === "retail" ? "General Store / Retail"
    : "Specialty Service Business";

  const typeContent = p.businessType === "restaurant"
    ? `MENU SECTION (id="menu"): Beautiful menu grouped by category. Keep it concise — 3-4 items per category max. No invented prices.`
    : p.businessType === "retail"
    ? `SPECIALS SECTION (id="specials"): Bold Sales & Specials cards using info provided.`
    : `SERVICES SECTION (id="services"): Clean services grid with clear booking CTA.`;

  const photoInstructions = photoCount > 0
    ? `The owner uploaded ${photoCount} photo(s). Use these EXACT placeholder strings in your HTML:
- Hero background: background-image: url('HERO_PHOTO_PLACEHOLDER')
- Gallery photos: <img src="PHOTO_1_PLACEHOLDER">, <img src="PHOTO_2_PLACEHOLDER"> etc.
These MUST appear exactly as written — they get replaced with real photos after generation.`
    : `No photos provided. Use warm CSS gradients and emoji as visual placeholders.`;

  const mapsUrl = encodeURIComponent(`${p.address || ""} ${p.city || ""}`.trim());

  const prompt = `You are a world-class web designer. Build a complete, beautiful, mobile-first, self-contained single-page HTML website for this small business. Everything must be in ONE HTML file.

BUSINESS:
- Name: ${p.businessName || "Local Business"}
- Type: ${typeLabel}
- Industry: ${p.industry || "small business"}
- Tagline: ${p.tagline || ""}
- Description: ${p.description || ""}
- About: ${p.about || ""}
- City: ${p.city || "our community"}
- Phone: ${p.phone || ""} | Email: ${p.email || ""} | Address: ${p.address || ""}
- Hours: ${p.hours || ""}

CONTENT:
${p.typeSpecific || ""}

VIBE: "${p.vibe || "Warm, welcoming, community-first"}"
Pick colors, fonts, and layout that genuinely match this vibe. Be distinctive — not generic.

PHOTOS: ${photoInstructions}

REQUIRED SECTIONS — build ALL of these, in order, with these EXACT IDs:
1. <section id="home"> — Hero. Use HERO_PHOTO_PLACEHOLDER as background-image if photos available. Warm welcome, tagline, CTA button.
2. ${typeContent}
3. <section id="about"> — Story, warmth, community connection. Show PHOTO_1_PLACEHOLDER and PHOTO_2_PLACEHOLDER if photos available.
4. <section id="hours-location"> — Hours displayed warmly + full address + this Google Maps embed:
   <iframe src="https://maps.google.com/maps?q=${mapsUrl}&output=embed" width="100%" height="300" style="border:0;border-radius:12px;margin-top:1rem;" allowfullscreen loading="lazy"></iframe>
5. <section id="contact"> — Contact form with netlify attribute on <form> tag. Show phone, email, address beside it.

ROOTED SECTION: Include a "Rooted in ${p.city || "Our Community"}" section between about and hours.

NAV: Fixed navbar. Links: Home (#home), Menu/Services (#menu or #services or #specials), About (#about), Hours & Location (#hours-location), Contact (#contact). Mobile hamburger with JS toggle. Clicking nav link closes menu on mobile.

FOOTER: Warm, personal. Business name, tagline, nav links, contact info.

FONTS: https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,600;1,400&display=swap

RULES:
- Mobile first. Single column on mobile, grid on desktop.
- No external JS libraries. All JS inline.
- Hover states, smooth transitions, beautiful spacing.
- NEVER invent prices. Only show prices if given.
- Quality bar: looks like a $2,000 boutique agency site.
- If running low on tokens, keep each section shorter but NEVER skip a section.

OUTPUT: Raw HTML only. Start with <!DOCTYPE html>. No markdown, no code fences, no explanation.`;

  try {
    const body = JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", errText.slice(0, 300));
      return res.status(500).json({ error: `Anthropic error ${response.status}` });
    }

    const data = await response.json();
    const text = data.content?.find(b => b.type === "text")?.text || "";
    const html = text.replace(/^```html?\n?/i, "").replace(/\n?```$/m, "").trim();

    console.log(`Done. Tokens: ${data.usage?.output_tokens}, HTML: ${html.length} chars`);

    if (!html || html.length < 500) {
      return res.status(500).json({ error: "AI returned empty response" });
    }

    // Return as base64 to avoid encoding issues
    const htmlB64 = Buffer.from(html, "utf8").toString("base64");
    res.status(200).json({ htmlB64, orderId });

    // Fire-and-forget emails
    const resendKey = process.env.RESEND_API_KEY;
    const ownerEmail = process.env.OWNER_EMAIL;
    const fromEmail = process.env.FROM_EMAIL || "BlockSite <hello@blocksitebuilder.com>";

    if (resendKey && ownerEmail) {
      const bizSlug = (p.businessName || "website").toLowerCase().replace(/\s+/g, "-");
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: fromEmail,
          to: ownerEmail,
          subject: `[BlockSite] ${p.businessName || "New site"} · ${orderId}`,
          html: `<div style="font-family:sans-serif;padding:24px"><h2>New BlockSite Preview</h2><p><strong>Order:</strong> ${orderId}</p><p><strong>Business:</strong> ${p.businessName}</p><p><strong>Customer:</strong> ${p.email || "—"}</p><p><strong>City:</strong> ${p.city || "—"}</p><p><strong>Vibe:</strong> "${p.vibe || "—"}"</p></div>`,
          attachments: [{ filename: `${bizSlug}.html`, content: htmlB64 }],
        }),
      }).catch(e => console.log("Owner email error:", e.message));
    }

    if (resendKey && p.email) {
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: fromEmail,
          to: p.email,
          subject: `Your BlockSite preview is ready — ${p.businessName || "Your Business"}`,
          html: `<div style="font-family:sans-serif;padding:24px;max-width:600px"><h2>Your site is ready! 🎉</h2><p>Head back to <a href="https://blocksitebuilder.com">blocksitebuilder.com</a> to view your preview.</p><p><strong>Order ID:</strong> ${orderId}</p></div>`,
        }),
      }).catch(e => console.log("Customer email error:", e.message));
    }

  } catch (err) {
    console.error("Generation failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
