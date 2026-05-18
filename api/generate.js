// api/generate.js - Vercel serverless function
// Max duration: 300 seconds (set in vercel.json)

export default async function handler(req, res) {
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
    ? `MENU SECTION (id="menu"): Elegant two-column menu layout. Category headers in display serif. 3-4 items per category max — name prominent, one-line description, price only if provided. Include a reservation or order CTA at the bottom.`
    : p.businessType === "retail"
    ? `SPECIALS SECTION (id="specials"): Large bold cards for deals and best-sellers. Price or savings prominent. At least one featured hero deal in a full-width card before the grid.`
    : `SERVICES SECTION (id="services"): Clean service cards in a grid. Service name, short description, price if provided. Repeat the booking CTA at the bottom of the section.`;

  const mapsUrl = encodeURIComponent(`${p.address || ""} ${p.city || ""}`.trim());

  const photoLayout = photoCount === 0
    ? "ZERO PHOTOS: Build a bold typographic site. Use large color blocks, oversized type, decorative CSS shapes and lines as visual elements. Should feel designed, not empty."
    : photoCount === 1
    ? "ONE PHOTO: Use HERO_PHOTO_PLACEHOLDER as a dramatic full-bleed hero background with a dark overlay. Do not use it anywhere else — let it anchor the entire page."
    : photoCount === 2
    ? "TWO PHOTOS: HERO_PHOTO_PLACEHOLDER as hero background. PHOTO_1_PLACEHOLDER in an editorial 50/50 split layout in the about section — photo left, text right on desktop."
    : `${photoCount} PHOTOS: HERO_PHOTO_PLACEHOLDER as hero background. Use PHOTO_1_PLACEHOLDER through PHOTO_${Math.min(photoCount, 4)}_PLACEHOLDER in an asymmetric masonry-style gallery in the about section. Vary sizes — not a boring equal grid.`;

  const typeLayout = p.businessType === "restaurant"
    ? "RESTAURANT ARCHETYPE: Dark, moody, editorial. Think award-winning restaurant site. Hero is cinematic — full height, dramatic type, minimal text. Menu section is clean and typographic. About section has a pull quote from the owner. Atmosphere over information."
    : p.businessType === "retail"
    ? "RETAIL ARCHETYPE: Warm, inviting, neighborhood boutique. Hero has energy and a clear CTA. Products/specials section uses bold cards. The about section roots the business in the community — family-owned, not corporate."
    : "SERVICE ARCHETYPE: Professional, trustworthy, confident. Hero establishes credibility immediately — specialty, years in business, community anchor. Services in clean cards. Testimonial or trust signal woven in. Booking CTA repeated.";

  const prompt = `You are a senior web designer at a boutique agency. Your sites win awards. They feel alive, look custom, and make business owners proud to share them. This is not a template.

BUSINESS:
- Name: ${p.businessName || "Local Business"}
- Type: ${typeLabel}
- Industry: ${p.industry || "small business"}
- Tagline: ${p.tagline || ""}
- Description: ${p.description || ""}
- About / Origin Story: ${p.about || ""}
- City: ${p.city || "our community"}
- Phone: ${p.phone || ""} | Email: ${p.email || ""} | Address: ${p.address || ""}
- Hours: ${p.hours || ""}

CONTENT:
${p.typeSpecific || ""}

VIBE: "${p.vibe || "Warm, welcoming, community-first"}"
This is the most important instruction. Read it twice. Let it drive every color, font weight, spacing, and layout decision. Do not default to generic.

LAYOUT ARCHETYPE:
${typeLayout}

PHOTO STRATEGY:
${photoLayout}

SEO — MANDATORY, every generation:
1. <title>: "${p.businessName || "Local Business"} — ${p.industry || p.businessType} in ${p.city || "our community"}"
2. <meta name="description"> exactly 150-160 chars: name + what they do + city + differentiator
3. JSON-LD in <head>: LocalBusiness schema with name, streetAddress, addressLocality, telephone, openingHours
4. <h1> includes city name naturally — not just the business name
5. City name appears 3-4 times throughout the page copy
6. Every img tag has a descriptive alt including business name and city

ANIMATIONS — include all of these:
- .fade-up class on every major section. IntersectionObserver adds .visible class. CSS: .fade-up{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s ease} .fade-up.visible{opacity:1;transform:none}
- Hero: stagger headline (0s), tagline (.15s), CTA (.3s) with animation-delay
- Nav: transparent initially, gains background + shadow when user scrolls down (scroll event listener, add class "scrolled")
- All buttons and cards: smooth hover with scale or shadow shift (transform .2s ease)
- Any numerical stats: count-up animation on scroll using IntersectionObserver

DESIGN — non-negotiable:
- Zero emoji. Anywhere. Use SVG icons or pure typographic/CSS elements only.
- Two fonts max from the stack. Use weight contrast dramatically — 900 display, 300-400 body.
- Color palette: 2 brand colors + 2 neutrals. All chosen deliberately. No generic blues or grays.
- Generous spacing. Sections breathe. Padding is a design decision.
- Every section visually distinct — alternate background, flip layout direction, change density.
- Quality standard: $3,000-5,000 agency site. It should be obvious.

SECTIONS — build all, in order:
1. <nav> — Fixed. Transparent on hero, gains bg on scroll. Business name/logo left. Links right. Hamburger on mobile. Closes on link click.
2. <section id="home"> — Hero. Full viewport height. Bold display type. Staggered animation. One CTA. Vibe-matched background.
3. ${typeContent}
4. <section id="about"> — Story. Human. "${p.city || "Our Community"}" connection explicit. Pull quote if origin story provided. Photo(s) if available.
5. <section id="hours-location"> — Hours cleanly formatted. Full address. Google Maps: <iframe src="https://maps.google.com/maps?q=${mapsUrl}&output=embed" width="100%" height="320" style="border:0;border-radius:12px;margin-top:1.5rem;" allowfullscreen loading="lazy"></iframe>
6. <section id="contact"> — Form with netlify attribute (name, email, message, submit). Contact details beside it.
7. <footer> — Name, tagline, nav links, contact info, city. Warm sign-off. Copyright.

TECHNICAL:
- One self-contained HTML file. All CSS and JS inline. Zero external JS libraries.
- Mobile-first. 375px minimum. Grid/flex adapts to desktop breakpoints.
- Fonts: https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,600;1,400&display=swap
- html { scroll-behavior: smooth; }
- IntersectionObserver threshold 0.1, triggers on first load as well as scroll
- NEVER invent prices, hours, or contact info not provided
- Running low on tokens? Shorten copy per section. NEVER skip a section. NEVER skip SEO. NEVER close HTML early.

OUTPUT: Raw HTML only. Start with <!DOCTYPE html>. No markdown. No code fences. No explanation.`;

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

    // ── Owner notification — fires before res.json() ───────────────
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
            subject: `[BlockSite] Preview — ${p.businessName || "Unknown"} · ${orderId}`,
            html: `<div style="font-family:sans-serif;padding:24px;max-width:700px">
              <h2 style="color:#1c1a14">New Preview Generated</h2>
              <p style="color:#666;margin-bottom:8px">Customer has not paid yet. HTML attached.</p>
              <p style="color:#c4813a;font-size:13px;margin-bottom:24px">Stored in Upstash 24hrs: order:${orderId}</p>
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

    return res.status(200).json({ htmlB64, orderId });

  } catch (err) {
    console.error("Generation failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
