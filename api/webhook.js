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

  const prompt = `You are a senior web designer at a boutique agency that charges $3,000–5,000 for small business websites. Your output should look like it justifies that price tag — polished, intentional, distinctive. Not a template. Not generic. Built for THIS business.

BUSINESS BRIEF:
- Name: ${p.businessName || "Local Business"}
- Type: ${typeLabel}
- Industry: ${p.industry || "small business"}
- Tagline: ${p.tagline || ""}
- Description: ${p.description || ""}
- About / Origin Story: ${p.about || ""}
- City / Neighborhood: ${p.city || "our community"}
- Phone: ${p.phone || ""} | Email: ${p.email || ""} | Address: ${p.address || ""}
- Hours: ${p.hours || ""}

BUSINESS-SPECIFIC CONTENT:
${p.typeSpecific || ""}

VIBE DIRECTION: "${p.vibe || "Warm, welcoming, community-first"}"
Read this carefully. Choose a color palette, typography, and layout that genuinely express this vibe. Make it feel custom, not like a WordPress theme.

PHOTOS: ${photoInstructions}

SEO REQUIREMENTS — these are mandatory, not optional:
1. <title> tag MUST follow this format: "${p.businessName || "Local Business"} — ${p.industry || p.businessType} in ${p.city || "our community"}"
2. <meta name="description"> MUST be 150–160 characters, include the business name, what they do, and the city. Example: "Rosa's Caribbean Kitchen serves authentic Caribbean food in Mount Vernon, NY. Family-owned since 1998. Dine in or take out — open 7 days."
3. Include this JSON-LD schema in the <head> for local SEO:
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "${p.businessName || "Local Business"}",
  "description": "${p.description || ""}",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "${p.address || ""}",
    "addressLocality": "${p.city || ""}",
    "addressCountry": "US"
  },
  "telephone": "${p.phone || ""}",
  "openingHours": "${p.hours || ""}",
  "url": "https://www.example.com"
}
</script>
4. The <h1> must include the city naturally: e.g. "Authentic Caribbean Food in Mount Vernon" not just the business name
5. Use the city name naturally 3–4 times throughout the page copy — in the hero, about section, rooted section, and footer
6. Every image must have a descriptive alt tag that includes the business name and city

DESIGN STANDARDS — non-negotiable:
- NO emoji anywhere in the design. Zero. Not in headings, not as icons, not as decorations. Use SVG icons, typographic elements, or well-designed CSS shapes instead.
- Typography must be intentional: strong hierarchy, generous line-height, considered spacing.
- Color palette: 2–3 colors max plus neutrals. Make them feel chosen, not default.
- Spacing: generous padding, whitespace as a design element. Nothing cramped.
- Sections should feel distinct — vary background colors, layouts, and rhythm between sections.
- Hover states on all interactive elements. Smooth transitions (0.2s ease).
- The hero section must be visually striking.

REQUIRED SECTIONS — build ALL of these in order:
1. <nav> — Fixed. Logo/business name left, nav links right, hamburger on mobile. Smooth scroll to sections. Backdrop blur background.
2. <section id="home"> — Hero. Full viewport height. ${photoCount > 0 ? "Use HERO_PHOTO_PLACEHOLDER as background-image with a dark overlay for text legibility." : "Use a rich gradient that matches the vibe."} Business name in large display type. Tagline. One strong CTA button.
3. ${typeContent}
4. <section id="about"> — Story section. Warm, human, community-rooted. Pull from the about/description provided. ${photoCount > 1 ? "Use PHOTO_1_PLACEHOLDER and PHOTO_2_PLACEHOLDER in an asymmetric or editorial layout." : photoCount === 1 ? "Use PHOTO_1_PLACEHOLDER prominently." : "Use a well-designed pull quote or editorial text layout."} Include a "Rooted in ${p.city || "Our Community"}" subsection within this section.
5. <section id="hours-location"> — Hours in a clean, readable format. Full address. Google Maps embed:
   <iframe src="https://maps.google.com/maps?q=${mapsUrl}&output=embed" width="100%" height="320" style="border:0;border-radius:12px;margin-top:1.5rem;" allowfullscreen loading="lazy"></iframe>
6. <section id="contact"> — Contact form (name, email, message, submit). Show phone, email, address alongside. Form has netlify attribute on the <form> tag.
7. <footer> — Business name, tagline, nav links, contact info, city. Warm closing line. Copyright.

TECHNICAL REQUIREMENTS:
- Single self-contained HTML file. No external JS libraries.
- Mobile-first. Perfect on 375px wide. Grid/flex adapts to desktop.
- Fonts from: https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,600;1,400&display=swap
- All JS inline. Mobile nav hamburger must toggle open/close. Clicking a nav link closes the mobile menu.
- NEVER invent prices, hours, or details not provided.
- smooth-scroll on <html> element.
- If running low on output tokens, shorten each section's copy — but NEVER skip a section, NEVER skip the SEO tags, and NEVER close the HTML prematurely.

OUTPUT: Raw HTML only. Start with <!DOCTYPE html>. No markdown. No code fences. No explanation before or after.`;

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

    const htmlB64 = Buffer.from(html, "utf8").toString("base64");
    const bizSlug = (p.businessName || "website").toLowerCase().replace(/\s+/g, "-");

    // ── Save to Upstash — webhook reads this after payment ─────────
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (upstashUrl && upstashToken) {
      try {
        const jobData = Buffer.from(JSON.stringify({
          htmlB64,
          businessName: p.businessName,
          city: p.city,
          email: p.email,
          packageId: p.packageId,
          orderId,
        })).toString("base64");
        await fetch(`${upstashUrl}/set/order:${orderId}?ex=86400`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${upstashToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ value: jobData }),
        });
        console.log(`Saved to Upstash: order:${orderId}`);
      } catch(e) {
        console.error("Upstash save error:", e.message);
      }
    }

    // ── Owner notification only — customer email fires via webhook ──
    const resendKey = process.env.RESEND_API_KEY;
    const ownerEmail = process.env.OWNER_EMAIL;
    const fromEmail = process.env.FROM_EMAIL || "BlockSite <hello@blocksitebuilder.com>";

    if (resendKey && ownerEmail) {
      const promptSummary = `
        <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%">
          <tr><td style="padding:8px;font-weight:bold;width:140px;color:#666">Order ID</td><td style="padding:8px">${orderId}</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#666">Business</td><td style="padding:8px">${p.businessName || "—"}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;color:#666">Type</td><td style="padding:8px">${typeLabel}</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#666">City</td><td style="padding:8px">${p.city || "—"}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;color:#666">Phone</td><td style="padding:8px">${p.phone || "—"}</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#666">Email</td><td style="padding:8px">${p.email || "—"}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;color:#666">Address</td><td style="padding:8px">${p.address || "—"}</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#666">Hours</td><td style="padding:8px">${p.hours || "—"}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;color:#666">Photos</td><td style="padding:8px">${photoCount} uploaded</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#666">Package</td><td style="padding:8px">${p.packageId || "—"}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;color:#666;vertical-align:top">Vibe</td><td style="padding:8px;font-style:italic">"${p.vibe || "—"}"</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#666;vertical-align:top">Description</td><td style="padding:8px">${p.description || "—"}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;color:#666;vertical-align:top">Type-specific</td><td style="padding:8px;white-space:pre-wrap">${p.typeSpecific || "—"}</td></tr>
        </table>`;
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: fromEmail,
            to: ownerEmail,
            subject: `[BlockSite] Preview generated — ${p.businessName || "Unknown"} · ${orderId}`,
            html: `<div style="font-family:sans-serif;padding:24px;max-width:700px">
              <h2 style="color:#1c1a14">New Preview Generated</h2>
              <p style="color:#666;margin-bottom:8px">Customer has not paid yet. HTML attached for reference.</p>
              <p style="color:#c4813a;font-size:13px;margin-bottom:24px">Order stored in Upstash for 24hrs as: order:${orderId}</p>
              ${promptSummary}
            </div>`,
            attachments: [{ filename: `${bizSlug}.html`, content: htmlB64 }],
          }),
        });
        console.log("Owner notification sent.");
      } catch(e) {
        console.error("Owner email error:", e.message);
      }
    }

    // ── Respond to client ──────────────────────────────────────────
    return res.status(200).json({ htmlB64, orderId });

  } catch (err) {
    console.error("Generation failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
