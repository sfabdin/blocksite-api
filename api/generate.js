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

  // IMPORTANT: Never accept photos in the request body — they're injected client-side
  // after generation using placeholder strings. Sending base64 images here will
  // exceed Vercel's 4.5MB body limit and kill the request.
  const photoCount = p.photoCount || 0;

  console.log(`Generating for: ${p.businessName}, photoCount: ${photoCount}`);

  const typeLabel = p.businessType === "restaurant" ? "Restaurant / Food Business"
    : p.businessType === "retail" ? "General Store / Retail"
    : "Specialty Service Business";

  const typeContent = p.businessType === "restaurant"
    ? `MENU SECTION (id="menu"): Elegant menu layout grouped by category (e.g. Starters, Mains, Drinks, Desserts). Use a clean grid or two-column layout. 3–4 items per category max. No invented prices — show price only if provided. Each item gets a name and a one-line description.`
    : p.businessType === "retail"
    ? `SPECIALS SECTION (id="specials"): Featured deals and best-sellers displayed as polished cards. Use the specials and best-seller info provided. Bold typography, clean layout — not a flyer, more like a boutique shelf display.`
    : `SERVICES SECTION (id="services"): Services displayed in a clean grid with subtle cards. Each service gets a title and short description. Include a clear "Book an appointment" or "Get in touch" CTA. Use the booking method provided.`;

  const photoInstructions = photoCount > 0
    ? `The owner has uploaded ${photoCount} photo(s). These will be injected after generation. You MUST use these EXACT placeholder strings — they get replaced automatically:
- Hero section background image: style="background-image: url('HERO_PHOTO_PLACEHOLDER')"
- Gallery/about images: <img src="PHOTO_1_PLACEHOLDER" alt="...">, <img src="PHOTO_2_PLACEHOLDER" alt="..."> etc. up to PHOTO_${photoCount}_PLACEHOLDER
Do NOT use any other image src values for the owner's photos. These strings must appear exactly.`
    : `No photos uploaded. Use rich CSS gradients that match the vibe for the hero. For the about/gallery section, use well-styled placeholder divs with subtle patterns or solid color blocks — absolutely NO emoji as image replacements.`;

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

DESIGN STANDARDS — non-negotiable:
- NO emoji anywhere in the design. Zero. Not in headings, not as icons, not as decorations. Use SVG icons, typographic elements, or well-designed CSS shapes instead.
- Typography must be intentional: strong hierarchy, generous line-height, considered spacing. Mix display and body fonts with purpose.
- Color palette: 2–3 colors max plus neutrals. Make them feel chosen, not default.
- Spacing: generous padding, whitespace as a design element. Nothing cramped.
- Sections should feel distinct — vary background colors, layouts, and rhythm between sections.
- Hover states on all interactive elements. Smooth transitions (0.2s ease).
- The hero section must be visually striking — this is the first impression.

REQUIRED SECTIONS — build ALL of these in order:
1. <nav> — Fixed. Logo/business name left, nav links right, hamburger on mobile. Smooth scroll to sections. Backdrop blur background.
2. <section id="home"> — Hero. Full viewport height. ${photoCount > 0 ? "Use HERO_PHOTO_PLACEHOLDER as background-image with a dark overlay for text legibility." : "Use a rich gradient that matches the vibe."} Business name in large display type. Tagline. One strong CTA button.
3. ${typeContent}
4. <section id="about"> — Story section. Warm, human, community-rooted. Pull from the about/description provided. ${photoCount > 1 ? "Use PHOTO_1_PLACEHOLDER and PHOTO_2_PLACEHOLDER in an asymmetric or editorial layout." : photoCount === 1 ? "Use PHOTO_1_PLACEHOLDER prominently." : "Use a well-designed pull quote or editorial text layout."} Include a "Rooted in ${p.city || "Our Community"}" subsection or callout within this section.
5. <section id="hours-location"> — Hours in a clean, readable format. Full address. Google Maps embed below:
   <iframe src="https://maps.google.com/maps?q=${mapsUrl}&output=embed" width="100%" height="320" style="border:0;border-radius:12px;margin-top:1.5rem;" allowfullscreen loading="lazy"></iframe>
6. <section id="contact"> — Contact form (name, email, message, submit). Show phone, email, address alongside. Form has netlify attribute on the <form> tag.
7. <footer> — Business name, tagline, nav links, contact info. Warm closing line. Copyright.

TECHNICAL REQUIREMENTS:
- Single self-contained HTML file. No external JS libraries.
- Mobile-first. Perfect on 375px wide. Grid/flex adapts to desktop.
- Fonts from: https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,600;1,400&display=swap
- All JS inline. Mobile nav hamburger must toggle open/close. Clicking a nav link closes the mobile menu.
- NEVER invent prices, hours, or details not provided.
- smooth-scroll on <html> element.
- If running low on output tokens, shorten each section's copy — but NEVER skip a section or close the HTML prematurely.

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

    // ── Send emails BEFORE responding ──────────────────────────────
    // CRITICAL: Vercel terminates execution immediately after res.json() is called.
    // Any async work after that is killed. Emails must complete before we respond.
    const resendKey = process.env.RESEND_API_KEY;
    const ownerEmail = process.env.OWNER_EMAIL;
    const fromEmail = process.env.FROM_EMAIL || "BlockSite <hello@blocksitebuilder.com>";

    if (resendKey && ownerEmail) {
      const bizSlug = (p.businessName || "website").toLowerCase().replace(/\s+/g, "-");

      // Build a full prompt summary for the owner email
      const promptSummary = `
        <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%">
          <tr><td style="padding:8px;font-weight:bold;width:140px;color:#666">Order ID</td><td style="padding:8px">${orderId}</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#666">Business</td><td style="padding:8px">${p.businessName || "—"}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;color:#666">Type</td><td style="padding:8px">${typeLabel}</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#666">Industry</td><td style="padding:8px">${p.industry || "—"}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;color:#666">Tagline</td><td style="padding:8px">${p.tagline || "—"}</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#666">City</td><td style="padding:8px">${p.city || "—"}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;color:#666">Phone</td><td style="padding:8px">${p.phone || "—"}</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#666">Email</td><td style="padding:8px">${p.email || "—"}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;color:#666">Address</td><td style="padding:8px">${p.address || "—"}</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#666">Hours</td><td style="padding:8px">${p.hours || "—"}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;color:#666">Photos</td><td style="padding:8px">${photoCount} uploaded</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#666">Package</td><td style="padding:8px">${p.packageId || "—"}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;color:#666">Description</td><td style="padding:8px">${p.description || "—"}</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#666">About</td><td style="padding:8px">${p.about || "—"}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;color:#666;vertical-align:top">Vibe</td><td style="padding:8px;font-style:italic">"${p.vibe || "—"}"</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#666;vertical-align:top">Type-specific</td><td style="padding:8px;white-space:pre-wrap">${p.typeSpecific || "—"}</td></tr>
        </table>
      `;

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: fromEmail,
            to: ownerEmail,
            subject: `[BlockSite] New preview — ${p.businessName || "Unknown"} · ${orderId}`,
            html: `<div style="font-family:sans-serif;padding:24px;max-width:700px">
              <h2 style="color:#1c1a14">New BlockSite Preview Generated</h2>
              <p style="color:#666;margin-bottom:24px">Full form data below. HTML file attached.</p>
              ${promptSummary}
            </div>`,
            attachments: [{ filename: `${bizSlug}.html`, content: htmlB64 }],
          }),
        });
        console.log("Owner email sent.");
      } catch(e) {
        console.error("Owner email error:", e.message);
      }
    }

    if (resendKey && p.email) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: fromEmail,
            to: p.email,
            subject: `Your BlockSite preview is ready — ${p.businessName || "Your Business"}`,
            html: `<div style="font-family:sans-serif;padding:24px;max-width:600px;color:#1c1a14">
              <h2>Your site preview is ready!</h2>
              <p style="color:#666;line-height:1.7">Head back to <a href="https://blocksitebuilder.com" style="color:#c4813a">blocksitebuilder.com</a> to view your preview and choose your package.</p>
              <p style="color:#666"><strong>Order ID:</strong> ${orderId}</p>
              <p style="color:#999;font-size:13px">Questions? Reply to this email or reach us at hello@blocksite.co</p>
            </div>`,
          }),
        });
        console.log("Customer email sent.");
      } catch(e) {
        console.error("Customer email error:", e.message);
      }
    }

    // ── Respond to client ──────────────────────────────────────────
    return res.status(200).json({ htmlB64, orderId });

  } catch (err) {
    console.error("Generation failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
