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

  const photoLayout = photoCount === 0
    ? "ZERO PHOTOS: Build a bold typographic site. Use color blocks, large type, and decorative CSS elements (geometric shapes, lines, patterns) as visual interest. The design must feel intentional, not empty."
    : photoCount === 1
    ? "ONE PHOTO: Use it as a dramatic full-bleed hero background with overlay text. Don't use it anywhere else — let it anchor the whole site."
    : photoCount === 2
    ? "TWO PHOTOS: Hero background (HERO_PHOTO_PLACEHOLDER) + one editorial split-layout in the about section (PHOTO_1_PLACEHOLDER beside text, 50/50 on desktop)."
    : `${photoCount} PHOTOS: Hero background (HERO_PHOTO_PLACEHOLDER) + editorial gallery in about section using PHOTO_1_PLACEHOLDER through PHOTO_${Math.min(photoCount, 4)}_PLACEHOLDER. Use an asymmetric masonry-style layout — not a boring grid.`;

  const typeLayout = p.businessType === "restaurant"
    ? `RESTAURANT LAYOUT ARCHETYPE: Think award-winning restaurant site. Dark, moody, editorial. Large hero with restaurant name in display type. Menu section uses a two-column layout with category headers in serif, dish names prominent, descriptions in smaller body text. Include a "reservation / order" CTA. The about section should feel like a story — pull quote from the owner, warm photo if available.`
    : p.businessType === "retail"
    ? `RETAIL LAYOUT ARCHETYPE: Think boutique shop. Warm, inviting, slightly playful. Hero with a bold tagline and immediate CTA ("See what's in store"). Specials/products section uses large cards with bold typography — price or deal prominent. The about section anchors the neighborhood connection — this is someone's family business, not a chain.`
    : `SERVICE LAYOUT ARCHETYPE: Think premium local service provider. Clean, trustworthy, confident. Hero establishes credibility immediately — years in business, specialty, community roots. Services displayed as clean cards with clear pricing if available. Testimonials or trust signals woven in. Strong booking CTA repeated throughout.`;

  const prompt = `You are a senior web designer at a boutique agency. Your sites win awards. They look custom, feel alive, and make the business owner proud. This is not a template — this is a bespoke site for a specific business.

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
This is the most important instruction. Read it carefully. Choose a color palette, typography scale, and layout rhythm that genuinely expresses this vibe. Surprise me — don't default to generic.

LAYOUT ARCHETYPE:
${typeLayout}

PHOTO STRATEGY:
${photoLayout}

SEO — MANDATORY:
1. <title>: "${p.businessName || "Local Business"} — ${p.industry || p.businessType} in ${p.city || "our community"}"
2. <meta name="description"> 150–160 chars: business name + what they do + city + one differentiator
3. JSON-LD LocalBusiness schema in <head> with name, address, telephone, openingHours
4. <h1> includes the city naturally
5. City name used 3–4 times throughout copy
6. All images have descriptive alt tags with business name and city

ANIMATIONS — ADD ALL OF THESE:
- Fade-up on scroll: add a class "fade-up" to every major section. Use IntersectionObserver in JS to add class "visible" when in viewport. CSS: .fade-up { opacity:0; transform:translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; } .fade-up.visible { opacity:1; transform:none; }
- Hero text: stagger the headline, tagline, and CTA button with animation-delay (0s, 0.15s, 0.3s)
- Nav: add backdrop-filter blur and subtle border-bottom on scroll (JS scroll listener adds class "scrolled")
- Hover states: every card, button, and link must have a smooth hover (scale, shadow, or color shift)
- Count-up numbers: if you include any stats or numbers, animate them counting up on scroll

DESIGN STANDARDS — NON-NEGOTIABLE:
- NO emoji anywhere. Zero. Use SVG icons or typographic elements only.
- Typography: pick TWO fonts from the provided stack and use them with clear hierarchy. Mix weights dramatically — 900 for display, 300 for body.
- Color: 2 hero colors + 2 neutrals. Make them feel chosen. No default blues or grays.
- Spacing: generous. Sections breathe. Nothing cramped.
- Each section must feel visually distinct — vary background color, layout direction, and density.
- Quality bar: this site costs $3,000–5,000 from an agency. It should look it.

REQUIRED SECTIONS:
1. <nav> — Fixed. Transparent over hero, gains background on scroll. Logo left, links right, hamburger mobile. Smooth scroll.
2. <section id="home"> — Hero. Full viewport height. Vibe-appropriate background. Large display type. Staggered animation. Strong CTA.
3. ${typeContent}
4. <section id="about"> — Story. Human. Rooted. "${p.city || "Our Community"}" connection explicit. Quote or pull-out if owner story provided.
5. <section id="hours-location"> — Hours + address + Google Maps:
   <iframe src="https://maps.google.com/maps?q=${mapsUrl}&output=embed" width="100%" height="320" style="border:0;border-radius:12px;margin-top:1.5rem;" allowfullscreen loading="lazy"></iframe>
6. <section id="contact"> — Form (name, email, message, submit) with netlify attribute. Contact info beside it.
7. <footer> — Business name, tagline, nav links, contact, city. Warm closing line. Copyright.

TECHNICAL:
- Single self-contained HTML file. All CSS and JS inline. No external JS libraries.
- Mobile-first. Perfect at 375px. CSS grid/flex adapts to desktop.
- Fonts: https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,600;1,400&display=swap
- Mobile hamburger nav: JS toggle, closes on link click.
- NEVER invent prices or hours not provided.
- html { scroll-behavior: smooth; }
- IntersectionObserver for fade-up animations must work on first load too (threshold: 0.1)
- If running low on tokens: shorten copy, never skip sections, never skip SEO, never close HTML prematurely.

OUTPUT: Raw HTML only. Start with <!DOCTYPE html>. No markdown. No code fences. No explanation.

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
