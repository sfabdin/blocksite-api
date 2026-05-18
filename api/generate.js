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
      const bizSlug = (p.businessName || "website").toLowerCase().replace(/\s+/g, "-");
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: fromEmail,
          to: p.email,
          subject: `Your BlockSite website is ready — ${p.businessName || "Your Business"}`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1c1a14">
  <div style="background:#1c1a14;padding:28px 32px;border-radius:12px 12px 0 0">
    <div style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.02em">BLOCK<span style="color:#c4813a">SITE</span></div>
  </div>
  <div style="background:#faf8f3;padding:32px;border:1px solid #e2ddd0;border-top:none;border-radius:0 0 12px 12px">
    <h2 style="font-size:24px;font-weight:700;margin:0 0 8px">Your website is ready!</h2>
    <p style="color:#6b6355;margin:0 0 24px">Order ID: <strong>${orderId}</strong></p>
    <p style="font-size:16px;line-height:1.7;margin:0 0 24px">Your BlockSite website for <strong>${p.businessName || "your business"}</strong> is attached to this email. Here's how to get it live — no tech experience needed.</p>

    <div style="background:#fff;border:1px solid #e2ddd0;border-radius:10px;padding:24px;margin-bottom:16px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c4813a;text-transform:uppercase;letter-spacing:0.08em">Step 1 — Save your website file</p>
      <p style="margin:0;font-size:15px;line-height:1.7">Your website is attached to this email. Save it to your Desktop. Double-click it anytime to preview it in your browser.</p>
    </div>

    <div style="background:#fff;border:1px solid #e2ddd0;border-radius:10px;padding:24px;margin-bottom:16px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c4813a;text-transform:uppercase;letter-spacing:0.08em">Step 2 — Create a free Netlify account</p>
      <p style="margin:0;font-size:15px;line-height:1.7">Go to <a href="https://netlify.com" style="color:#c4813a">netlify.com</a> and sign up. Just email and password — no credit card needed.</p>
    </div>

    <div style="background:#fff;border:1px solid #e2ddd0;border-radius:10px;padding:24px;margin-bottom:16px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c4813a;text-transform:uppercase;letter-spacing:0.08em">Step 3 — Drag your file to go live</p>
      <p style="margin:0;font-size:15px;line-height:1.7">In Netlify, find the <strong>"Deploy manually"</strong> section and drag your website file into the box. In under 60 seconds you'll have a real web address anyone can visit. Your site is live.</p>
    </div>

    <div style="background:#fff;border:1px solid #e2ddd0;border-radius:10px;padding:24px;margin-bottom:16px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c4813a;text-transform:uppercase;letter-spacing:0.08em">Step 4 — Get a real domain name (recommended)</p>
      <p style="margin:0;font-size:15px;line-height:1.7">Go to <a href="https://namecheap.com" style="color:#c4813a">namecheap.com</a>, search your business name, and buy a .com for about $10–12/year. Netlify walks you through connecting it — takes about 10 minutes.</p>
    </div>

    <div style="background:#fff;border:1px solid #3a6e4f40;border-radius:10px;padding:24px;margin-bottom:16px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#3a6e4f;text-transform:uppercase;letter-spacing:0.08em">Step 5 — Get on Google (most important)</p>
      <p style="margin:0 0 10px;font-size:15px;line-height:1.7">This is free and the #1 thing that gets you found when people search nearby.</p>
      <ol style="margin:0;padding-left:20px;font-size:14px;line-height:2;color:#1c1a14">
        <li>Go to <a href="https://business.google.com" style="color:#c4813a">business.google.com</a> and sign in</li>
        <li>Click "Add your business" and search your name</li>
        <li>Fill in your address, phone, hours, and category</li>
        <li>Add your new website address</li>
        <li>Verify — Google mails a postcard with a code (5–14 days)</li>
        <li>Add photos once verified</li>
        <li>Ask regulars to leave a Google review — even 5 reviews makes a big difference</li>
      </ol>
    </div>

    <div style="background:#1c1a14;border-radius:10px;padding:24px;margin-bottom:24px;text-align:center">
      <p style="margin:0 0 8px;font-size:15px;color:#faf8f3;line-height:1.7">Questions? Running into something? Just reply to this email.</p>
      <a href="mailto:hello@blocksitebuilder.com" style="color:#c4813a;font-size:15px;font-weight:600">hello@blocksitebuilder.com</a>
    </div>
    <p style="font-size:13px;color:#a89880;text-align:center;margin:0">© ${new Date().getFullYear()} BlockSite · blocksitebuilder.com</p>
  </div>
</div>`,
          attachments: [{ filename: `${bizSlug}.html`, content: htmlB64 }],
        }),
      }).catch(e => console.log("Customer email error:", e.message));
    }

  } catch (err) {
    console.error("Generation failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
