// api/generate.js - Vercel serverless function
// Max duration: 300 seconds (set in vercel.json)
// v4 — web research pass before HTML generation

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

  const mapsUrl = encodeURIComponent(`${p.address || ""} ${p.city || ""}`.trim());

  const photoLayout = photoCount === 0
    ? "ZERO PHOTOS: Build a bold typographic site. Large color blocks, oversized type, decorative CSS shapes and lines. Should feel designed, not empty."
    : photoCount === 1
    ? "ONE PHOTO: Use HERO_PHOTO_PLACEHOLDER as dramatic full-bleed hero background with dark overlay. Anchor the whole page with it."
    : photoCount === 2
    ? "TWO PHOTOS: HERO_PHOTO_PLACEHOLDER as hero background. PHOTO_1_PLACEHOLDER in an editorial 50/50 split in the about section."
    : `${photoCount} PHOTOS: HERO_PHOTO_PLACEHOLDER as hero background. PHOTO_1_PLACEHOLDER through PHOTO_${Math.min(photoCount, 4)}_PLACEHOLDER in an asymmetric masonry gallery in about. Vary sizes.`;

  const typeLayout = p.businessType === "restaurant"
    ? "RESTAURANT ARCHETYPE: Dark, moody, editorial. Cinematic hero — full height, dramatic type. Menu clean and typographic. About has owner pull quote. Atmosphere over information."
    : p.businessType === "retail"
    ? "RETAIL ARCHETYPE: Warm, inviting, neighborhood boutique energy. Bold product/specials cards. About section roots the business in the community."
    : "SERVICE ARCHETYPE: Professional, trustworthy, confident. Hero establishes credibility. Services in clean cards. Testimonials woven in. Booking CTA repeated.";

  // ── STEP 1: Web Research Pass ──────────────────────────────────
  // Search for real info about this business before generating the site
  let researchFindings = "";
  try {
    console.log(`Researching: ${p.businessName} ${p.city}`);
    const researchPrompt = `You are a researcher helping build a website for a local business. Search for real information about this business and return a structured summary.

Business: "${p.businessName}"
Type: ${typeLabel}
Address: ${p.address || ""}, ${p.city || ""}
Phone: ${p.phone || ""}

Search for:
1. Google Maps / Google Business listing — rating, number of reviews, any highlighted reviews
2. Yelp listing — rating, notable reviews (pull 2-3 real quotes if available)
3. Any press coverage, awards, or media mentions
4. Social media presence (Instagram, Facebook) — follower count, any notable posts
5. For restaurants: DoorDash, UberEats, Grubhub, Seamless listing URLs
6. For restaurants: OpenTable, Resy, or other reservation platform links
7. For salons/services: Vagaro, StyleSeat, Booksy, or other booking platform links
8. For retail: any e-commerce presence
9. Any notable details — how long open, neighborhood history, community involvement
10. Delivery/pickup options if applicable

Return your findings as a clear structured summary. If you cannot find the business online, say so clearly. Only include information you actually found — never invent reviews, ratings, or links.

Format your response like this:
FOUND ONLINE: yes/no/partial
RATING: (e.g. 4.8 stars, 247 reviews on Google)
REAL REVIEWS: (paste 2-3 actual review quotes with attribution if found)
PRESS/AWARDS: (any media mentions)
ORDERING LINKS: (real URLs for delivery platforms if found)
BOOKING LINKS: (real URLs for reservation/booking platforms if found)
SOCIAL: (handle and follower count if found)
OTHER DETAILS: (anything else notable)`;

    const researchRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: researchPrompt }],
      }),
    });

    if (researchRes.ok) {
      const researchData = await researchRes.json();
      const textBlock = researchData.content?.find(b => b.type === "text");
      if (textBlock?.text) {
        researchFindings = textBlock.text;
        console.log(`Research complete: ${researchFindings.slice(0, 200)}`);
      }
    } else {
      const err = await researchRes.text();
      console.log(`Research failed (${researchRes.status}): ${err.slice(0, 100)} — continuing without`);
    }
  } catch(e) {
    console.log(`Research error: ${e.message} — continuing without`);
  }

  // ── Build contact section instructions based on business type ──
  const contactSection = p.businessType === "restaurant"
    ? `CONTACT/ACTION SECTION (id="contact"):
      Do NOT use a generic contact form. Instead build an action-focused section with:
      - Large prominent phone number with "Call to Order" or "Call Us" label — make it a tel: link
      - If research found delivery platform links (DoorDash, UberEats, Grubhub, Seamless), show them as bold buttons. If no real links found, show the platforms by name with a note to search for the restaurant.
      - If research found reservation links (OpenTable, Resy), include a "Reserve a Table" button. Otherwise show the phone as the reservation method.
      - Hours prominently displayed
      - Address with a "Get Directions" link to Google Maps
      - Only include a text contact form if the owner provided a contact email AND there is a clear reason someone would write (catering, events, large groups)`
    : p.businessType === "retail"
    ? `CONTACT/ACTION SECTION (id="contact"):
      Focus on getting people in the door or on the phone:
      - Prominent phone number as a tel: link — "Call Us" or "Give Us a Ring"
      - Address with "Get Directions" Google Maps link
      - Hours displayed clearly
      - If research found any e-commerce or ordering links, include them
      - Simple contact form ONLY if the owner provided an email — keep it minimal (name, message, send)`
    : `CONTACT/ACTION SECTION (id="contact"):
      Focus on booking and getting in touch:
      - If research found booking platform links (Vagaro, StyleSeat, Booksy, etc), make "Book Now" the primary CTA button
      - Phone number as a tel: link — prominent
      - If no booking platform found, use the phone/text as the booking method with clear instructions
      - Contact form with name, email, message — labeled "Send us a message" not just "Contact"
      - Address and directions if walk-ins are welcome`;

  // ── Build testimonials section if real reviews found ──────────
  const testimonialsSection = researchFindings.includes("REAL REVIEWS:")
    ? `TESTIMONIALS: If real customer reviews were found in the research data, include a testimonials section between the about section and the contact section. Use the actual quotes with attribution (first name + platform, e.g. "Maria G. — Google"). Style them as large pull quotes — not small cards. Only use reviews that were actually found — never invent them. If no real reviews were found, skip this section entirely.`
    : `TESTIMONIALS: No verified reviews were found for this business. Do not invent testimonials. Skip the testimonials section.`;

  // ── STEP 2: HTML Generation ────────────────────────────────────
  const prompt = `You are a senior web designer at a boutique agency. Your sites win awards. Built for THIS specific business — not a template.

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
Read this twice. Let it drive every color, font weight, spacing, and layout decision.

LAYOUT ARCHETYPE:
${typeLayout}

PHOTO STRATEGY:
${photoLayout}

REAL-WORLD RESEARCH:
The following information was found by searching the web for this business. Use it to make the site feel real and alive:
---
${researchFindings || "No online presence found yet. This is a new business or one that hasn't been found online — position the site as their debut online presence."}
---
Important rules for using research data:
- Use real review quotes verbatim if found — attribute them (first name + platform)
- Use real delivery/booking platform links if found — never invent URLs
- If a real rating was found (e.g. 4.8 stars), include it prominently in the hero or about section
- If press or awards were found, mention them
- If nothing was found, do not invent anything — treat it as a brand new business

SEO — MANDATORY:
1. <title>: "${p.businessName || "Local Business"} — ${p.industry || p.businessType} in ${p.city || "our community"}"
2. <meta name="description"> 150-160 chars: name + what they do + city + differentiator
3. JSON-LD LocalBusiness schema in <head>
4. <h1> includes city naturally
5. City name 3-4 times throughout
6. All images: descriptive alt with business name and city

ANIMATIONS — include all:
- .fade-up on every major section, IntersectionObserver adds .visible. CSS: .fade-up{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s ease} .fade-up.visible{opacity:1;transform:none}
- Hero text staggered: headline 0s, tagline .15s, CTA .3s
- Nav transparent initially, gains background on scroll
- Smooth hover on all buttons and cards
- Count-up on any stats/numbers

DESIGN — non-negotiable:
- Zero emoji. SVG icons or CSS only.
- Two fonts max. Weight contrast: 900 display, 300-400 body.
- 2 brand colors + 2 neutrals. Chosen deliberately.
- Generous spacing. Sections breathe.
- Every section visually distinct.
- Quality: $3,000-5,000 agency site.

SECTIONS — build all in order:
1. <nav> — Fixed. Transparent on hero, bg on scroll. Hamburger mobile. Closes on link click.
2. <section id="home"> — Hero. Full viewport. Bold display type. Staggered animation. One CTA. Vibe-matched background.
3. <section id="menu"> or <section id="services"> or <section id="specials"> — as appropriate
4. <section id="about"> — Story. Human. City connection explicit. Pull quote if story provided.
5. TESTIMONIALS (if real reviews found — see rules above)
6. ${contactSection}
7. <footer> — Name, tagline, nav links, contact, city. Warm sign-off. Copyright.

${testimonialsSection}

TECHNICAL:
- One self-contained HTML file. All CSS and JS inline. Zero external JS.
- Mobile-first. 375px minimum. Grid/flex adapts up.
- Fonts: https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,600;1,400&display=swap
- html { scroll-behavior: smooth; }
- IntersectionObserver threshold 0.1
- NEVER invent prices, hours, reviews, or URLs not provided or found in research
- Running low on tokens? Shorten copy. NEVER skip sections. NEVER skip SEO. NEVER close HTML early.

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

    // ── Save to Upstash ────────────────────────────────────────
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (upstashUrl && upstashToken) {
      try {
        const jobData = Buffer.from(JSON.stringify({
          htmlB64, businessName: p.businessName,
          city: p.city, email: p.email,
          packageId: p.packageId, orderId,
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

    // ── Owner notification ─────────────────────────────────────
    const resendKey = process.env.RESEND_API_KEY;
    const ownerEmail = process.env.OWNER_EMAIL;
    const fromEmail = process.env.FROM_EMAIL || "BlockSite <hello@blocksitebuilder.com>";

    if (resendKey && ownerEmail) {
      const researchSummary = researchFindings
        ? `<div style="background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:16px;font-family:monospace;font-size:12px;white-space:pre-wrap">${researchFindings.slice(0, 800)}</div>`
        : `<p style="color:#999;font-style:italic">No research data found.</p>`;

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
              <p style="color:#666;margin-bottom:4px">Customer has not paid yet. HTML attached.</p>
              <p style="color:#c4813a;font-size:13px;margin-bottom:20px">Upstash key: order:${orderId} (24hr TTL)</p>
              <h3 style="font-size:14px;margin-bottom:8px">Research Findings</h3>
              ${researchSummary}
              <table style="font-size:14px;border-collapse:collapse;width:100%">
                <tr><td style="padding:8px;font-weight:bold;color:#666;width:130px">Business</td><td style="padding:8px">${p.businessName || "—"}</td></tr>
                <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#666">Type</td><td style="padding:8px">${typeLabel}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;color:#666">City</td><td style="padding:8px">${p.city || "—"}</td></tr>
                <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#666">Email</td><td style="padding:8px">${p.email || "—"}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;color:#666">Phone</td><td style="padding:8px">${p.phone || "—"}</td></tr>
                <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold;color:#666">Package</td><td style="padding:8px">${p.packageId || "—"}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;color:#666;vertical-align:top">Vibe</td><td style="padding:8px;font-style:italic">"${p.vibe || "—"}"</td></tr>
              </table>
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
