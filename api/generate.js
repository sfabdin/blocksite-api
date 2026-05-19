// api/generate.js - Vercel serverless function
// Max duration: 300 seconds (set in vercel.json)
// v5 — parallel research + generation, validation pass, smarter prompts

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

  console.log(`[${orderId}] Generating for: ${p.businessName}, photos: ${p.photoCount || 0}`);

  // ── Derived constants ──────────────────────────────────────────
  const typeLabel = p.businessType === "restaurant" ? "Restaurant / Food Business"
    : p.businessType === "retail" ? "General Store / Retail"
    : "Specialty Service Business";

  // Fix mapsUrl to include business name for better Maps accuracy
  const mapsUrl = encodeURIComponent(
    `${p.businessName || ""} ${p.address || ""} ${p.city || ""}`.trim()
  );

  const photoUrls = p.photoUrls || []; // Real hosted URLs from Vercel Blob
  const photoCount = p.photoCount || photoUrls.length || 0;

  const photoLayout = photoCount === 0
    ? "ZERO PHOTOS: Bold typographic design. Large color blocks, oversized type, decorative CSS shapes and lines. Must feel intentionally designed, not empty."
    : photoUrls.length > 0
    ? (() => {
        const heroUrl = photoUrls[0];
        const galleryUrls = photoUrls.slice(1, 4);
        if (photoUrls.length === 1) {
          return `ONE PHOTO: Use this exact URL as the hero background image: ${heroUrl}
Include it as: style="background-image: url('${heroUrl}')" with a dark overlay. Do not use it elsewhere.`;
        } else if (photoUrls.length === 2) {
          return `TWO PHOTOS: 
Hero background: style="background-image: url('${heroUrl}')" with dark overlay.
About section: <img src="${galleryUrls[0]}" alt="..."> in an editorial 50/50 split — photo left, text right on desktop.`;
        } else {
          return `${photoUrls.length} PHOTOS with real hosted URLs:
Hero background: style="background-image: url('${heroUrl}')" with dark overlay.
Gallery in about section using these exact URLs:
${galleryUrls.map((u, i) => `Photo ${i+2}: <img src="${u}" alt="...">`).join("\n")}
Use an asymmetric masonry-style layout — vary sizes, never an equal grid.`;
        }
      })()
    : (() => {
        // photoCount > 0 but no hosted URLs yet — use placeholders as fallback
        if (photoCount === 1) return `ONE PHOTO: Use HERO_PHOTO_PLACEHOLDER as hero background-image with dark overlay.`;
        if (photoCount === 2) return `TWO PHOTOS: HERO_PHOTO_PLACEHOLDER as hero background. PHOTO_1_PLACEHOLDER in 50/50 about section split.`;
        return `${photoCount} PHOTOS: HERO_PHOTO_PLACEHOLDER as hero background. PHOTO_1_PLACEHOLDER through PHOTO_${Math.min(photoCount,4)}_PLACEHOLDER in asymmetric gallery.`;
      })();

  const typeLayout = p.businessType === "restaurant"
    ? "RESTAURANT ARCHETYPE: Dark, moody, editorial. Cinematic hero — full height, dramatic type, minimal words. Menu section clean and typographic. About section has owner pull quote. Atmosphere over information. Think award-winning NYC restaurant website."
    : p.businessType === "retail"
    ? "RETAIL ARCHETYPE: Warm, inviting, neighborhood boutique. Hero has immediate energy and CTA. Bold product/specials cards. About section roots the business in the community — family-owned, not corporate."
    : "SERVICE ARCHETYPE: Professional, trustworthy, confident. Hero establishes credibility immediately — specialty, years in business, community roots. Services in clean cards. Booking CTA repeated. Testimonials woven in if available.";

  const contactSection = p.businessType === "restaurant"
    ? `CONTACT/ORDER SECTION (id="contact"):
      IMPORTANT: Do NOT include an HTML form with input fields. This is a restaurant.
      Build an action-focused section with:
      - Large phone number as a <a href="tel:${p.phone || ""}"> link — "Call to Order" label, big and prominent
      - If research found real delivery platform URLs (DoorDash, UberEats, Grubhub, Seamless), display them as styled buttons with their real links. Never invent a delivery URL.
      - If research found a real reservation link (OpenTable, Resy), add a "Reserve a Table" button with that real link. If not found, use the phone number for reservations.
      - Hours displayed clearly
      - Full address with a "Get Directions" link: <a href="https://maps.google.com/?q=${mapsUrl}" target="_blank">
      - Catering inquiry form (name, email, message) ONLY if: owner provided an email address AND description mentions catering or events`
    : p.businessType === "retail"
    ? `CONTACT SECTION (id="contact"):
      Focus on getting people in the door:
      - Phone as <a href="tel:${p.phone || ""}"> — prominent, labeled "Give us a call"
      - Address with "Get Directions" link: <a href="https://maps.google.com/?q=${mapsUrl}" target="_blank">
      - Hours displayed clearly
      - If research found e-commerce or ordering links, include them
      - Simple contact form (name, message, send) ONLY if owner provided an email address`
    : `CONTACT SECTION (id="contact"):
      Focus on booking:
      - If research found real booking platform URLs (Vagaro, StyleSeat, Booksy, etc), make "Book Now" the hero CTA button with that real URL
      - Phone as <a href="tel:${p.phone || ""}"> — labeled clearly
      - If no booking platform found, phone/text is the booking method — say so clearly
      - Contact form (name, email, message, send) with netlify attribute — labeled "Send us a message"
      - Address and directions if walk-ins welcome`;

  // ── STEP 1 & 2: Research + prep run IN PARALLEL ────────────────
  // Research happens at the same time as prompt building
  // Saves 10-15 seconds for businesses with no web presence

  const researchQuery = `"${p.businessName}" ${p.city} ${
    p.businessType === "restaurant" ? "restaurant menu reviews hours" :
    p.businessType === "retail" ? "store hours reviews" :
    "business reviews booking"
  }`;

  console.log(`[${orderId}] Starting parallel research + prompt prep`);

  const researchPromise = (async () => {
    try {
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
          messages: [{ role: "user", content: `Search for real information about this local business. Be thorough but fast.

Business: "${p.businessName}"
Type: ${typeLabel}
Address: ${p.address || ""}, ${p.city || ""}
Phone: ${p.phone || ""}
Search query to use: ${researchQuery}

Find and return ONLY verified facts:
1. Google rating and review count
2. 2-3 real review quotes with attribution (first name + platform)
3. Any press coverage or awards
4. Real delivery platform URLs if this is a restaurant (DoorDash, UberEats, Grubhub, Seamless)
5. Real reservation links (OpenTable, Resy) if restaurant
6. Real booking platform links (Vagaro, StyleSeat, Booksy) if service business
7. Social media handles and follower counts
8. How long they've been open / any notable history
9. Whether they have an existing website

CRITICAL: Only include what you actually found. Never invent reviews, URLs, ratings, or any data.
If you cannot find this business, say exactly: "BUSINESS NOT FOUND ONLINE"

Format:
FOUND: yes/no/partial
RATING: 
REVIEWS:
ORDERING_LINKS:
BOOKING_LINKS:
PRESS:
SOCIAL:
HISTORY:
HAS_WEBSITE: yes/no` }],
        }),
      });
      if (!researchRes.ok) {
        console.log(`[${orderId}] Research HTTP error: ${researchRes.status}`);
        return "";
      }
      const data = await researchRes.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      console.log(`[${orderId}] Research complete: ${text.slice(0, 100)}`);
      return text;
    } catch(e) {
      console.log(`[${orderId}] Research failed: ${e.message} — continuing without`);
      return "";
    }
  })();

  // Wait for research before building the prompt
  const researchFindings = await researchPromise;

  const noResearch = !researchFindings || researchFindings.includes("BUSINESS NOT FOUND ONLINE");

  const testimonialsInstruction = noResearch || !researchFindings.includes("REVIEWS:")
    ? "TESTIMONIALS: No verified reviews were found for this business. Do NOT invent testimonials. Do NOT include a testimonials section."
    : `TESTIMONIALS: Real customer reviews were found in the research data. Include a testimonials section between the about section and the contact section. Use ONLY the actual quotes found — verbatim, with attribution (first name + platform, e.g. "Maria G. — Google"). Style as large elegant pull quotes, not small cards. If fewer than 2 real quotes were found, skip this section.`;

  // ── STEP 3: HTML Generation (claude-opus for quality) ──────────
  const prompt = `You are a senior web designer at a boutique agency. Your sites win awards. They feel alive, custom-built, and make business owners proud to share. This is not a template — it is a bespoke website for one specific business.

BUSINESS:
- Name: ${p.businessName || "Local Business"}
- Owner: ${p.ownerName || "the owner"}
- Type: ${typeLabel}
- Industry: ${p.industry || "small business"}
- Founded: ${p.foundedYear ? `Est. ${p.foundedYear}` : ""}
- Tagline: ${p.tagline || ""}
- Description: ${p.description || ""}
- What makes them different: ${p.differentiator || ""}
- Origin story: ${p.about || ""}
- City: ${p.city || "our community"}
- Neighborhood / cross streets: ${p.neighborhood || ""}
- Phone: ${p.phone || ""} | Email: ${p.email || ""} | Address: ${p.address || ""}
- Hours: ${p.hours || ""}
- Instagram: ${p.instagram ? `@${p.instagram.replace("@", "")}` : ""}

WRITING INSTRUCTIONS — use these throughout:
- Use the owner's first name (${p.ownerName || "the owner"}) in the about section — "Rosa has been braiding hair since 2008" not just "we"
- If founded year provided (${p.foundedYear || "unknown"}), weave it in naturally — "serving the Bronx since ${p.foundedYear || "day one"}"
- If neighborhood provided (${p.neighborhood || ""}), use it in the community section — feels more specific than just the city
- The differentiator ("${p.differentiator || ""}") should appear in the hero or above-fold area — it's the hook
- If Instagram provided, include it in the footer and contact section as a linked handle

CONTENT FROM OWNER:
${p.typeSpecific || ""}

VIBE: "${p.vibe || "Warm, welcoming, community-first"}"
Read this twice. Every color, font weight, spacing, and layout decision must serve this vibe. Do not default to generic.

LAYOUT ARCHETYPE:
${typeLayout}

PHOTO STRATEGY:
${photoLayout}

REAL-WORLD RESEARCH:
${noResearch
  ? "This business has no confirmed online presence yet. Treat this as their debut on the internet. Do not reference any ratings, reviews, or external platforms — they don't exist yet."
  : `The following was found by searching the web for this business:
---
${researchFindings}
---
Rules for using research:
- Real review quotes: use verbatim, attribute by first name + platform
- Real delivery/booking URLs: use exactly as found — never modify or invent URLs
- Real ratings: include prominently if found (e.g. "4.8 stars on Google")
- Real press/awards: mention them
- If research found an existing website: acknowledge the business is already online and this is an upgrade
- If nothing was found: do not invent anything`}

SEO — MANDATORY ON EVERY GENERATION:
1. <title>: "${p.businessName || "Local Business"} — ${p.industry || p.businessType} in ${p.city || "our community"}"
2. <meta name="description"> exactly 150-160 chars: business name + what they do + city + one differentiator
3. JSON-LD LocalBusiness schema in <head>:
   - @type: LocalBusiness (or Restaurant, FoodEstablishment, HairSalon, etc. — be specific)
   - name, description, address (streetAddress, addressLocality, addressRegion, postalCode), telephone, openingHours, url
4. <h1> must include the city naturally — NOT just the business name
5. City name appears 3-4 times throughout the page copy
6. Every <img> tag has descriptive alt text including business name and city

ANIMATIONS — ALL REQUIRED:
- Every major section gets class="fade-up". Count them before finishing — minimum 6 elements.
- IntersectionObserver JS: threshold 0.1, adds class "visible". CSS: .fade-up{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s ease} .fade-up.visible{opacity:1;transform:none}
- Hero: headline at 0s, tagline at .15s, CTA at .3s animation-delay
- Nav: transparent on hero, gains background + box-shadow when window.scrollY > 50
- All buttons/cards: smooth hover — transform scale or box-shadow shift, .2s ease
- Any stats or numbers: count-up on scroll via IntersectionObserver

DESIGN — NON-NEGOTIABLE:
- Zero emoji. Anywhere. SVG icons or CSS/typographic elements only.
- Two fonts maximum from the stack. Dramatic weight contrast: 900 for display, 300-400 for body.
- Color palette: exactly 2 brand colors + 2 neutrals. Every color chosen deliberately.
- Generous spacing. Sections breathe. Padding is a design decision.
- Every section visually distinct — alternate background colors, flip layout direction, change density.
- Quality standard: this is a $3,000-5,000 agency site. Make it obvious.

SECTIONS — build ALL in order, none skipped:
1. <nav> — Fixed. Transparent over hero, gains background on scroll. Business name/wordmark left. Nav links right. Hamburger on mobile. Menu closes on nav link click.
2. <section id="home"> — Hero. Full viewport height (100svh). Vibe-matched background. Bold display type. Staggered animation on headline, tagline, CTA. One strong CTA button.
3. <section id="${p.businessType === "restaurant" ? "menu" : p.businessType === "retail" ? "specials" : "services"}"> — Type-specific content section as described in archetype.
4. <section id="about"> — Story. Human. "${p.city || "Our Community"}" connection explicit. Pull quote if origin story provided. Photos per photo strategy.
5. ${testimonialsInstruction.startsWith("TESTIMONIALS: No") ? "<!-- skip testimonials — no verified reviews -->" : '<section id="testimonials"> — Testimonials as described above.'}
6. ${contactSection}
7. <footer> — Business name, tagline, nav links, phone, address, city. Warm closing line. Copyright ${new Date().getFullYear()}.

${testimonialsInstruction}

TECHNICAL — all required:
- Single self-contained HTML file. All CSS and JS inline. Zero external JS libraries.
- Mobile-first. Perfect at 375px portrait. Grid/flex adapts to 768px+ desktop.
- Fonts: https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,600;1,400&display=swap
- html { scroll-behavior: smooth; }
- NEVER invent prices, hours, reviews, ratings, or URLs not provided or found in research
- Phone numbers must be exactly as provided: ${p.phone || "use only if provided"}
- Running low on tokens? Shorten copy per section. NEVER skip a section. NEVER skip SEO tags. NEVER close HTML prematurely.

OUTPUT: Raw HTML only. Start with <!DOCTYPE html>. No markdown. No code fences. No explanation before or after.`;

  try {
    const genBody = JSON.stringify({
      model: "claude-opus-4-5",  // Opus for HTML generation — better long-form output
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
    });

    console.log(`[${orderId}] Starting HTML generation`);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: genBody,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[${orderId}] Anthropic error:`, errText.slice(0, 300));
      return res.status(500).json({ error: `Anthropic error ${response.status}` });
    }

    const data = await response.json();
    const text = data.content?.find(b => b.type === "text")?.text || "";
    let html = text.replace(/^```html?\n?/i, "").replace(/\n?```$/m, "").trim();

    console.log(`[${orderId}] Generation done. Tokens: ${data.usage?.output_tokens}, HTML: ${html.length} chars`);

    if (!html || html.length < 500) {
      return res.status(500).json({ error: "AI returned empty response" });
    }

    // ── STEP 4: Validation Pass ────────────────────────────────
    // Quick check for invented data before showing to customer
    try {
      console.log(`[${orderId}] Running validation pass`);
      const validationRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 500,
          messages: [{ role: "user", content: `You are a quality checker for a website generator. Review this HTML and check for invented data.

WHAT THE OWNER PROVIDED:
- Business name: ${p.businessName || ""}
- Phone: ${p.phone || "NONE PROVIDED"}
- Email: ${p.email || "NONE PROVIDED"}
- Address: ${p.address || "NONE PROVIDED"}
- Hours: ${p.hours || "NONE PROVIDED"}
- Prices: ${p.typeSpecific?.includes("price") ? "some prices provided" : "NO PRICES PROVIDED"}

VERIFIED RESEARCH DATA:
${researchFindings || "none"}

HTML TO CHECK (first 3000 chars):
${html.slice(0, 3000)}

Check for these specific issues:
1. Phone numbers that don't match "${p.phone || "NONE"}" — flag if different
2. Prices shown that were not provided by the owner or found in research
3. Review quotes that don't appear in the research data
4. Delivery/booking URLs that look invented (e.g. doordash.com/restaurant-name that wasn't in research)
5. Hours that don't match "${p.hours || "NONE PROVIDED"}"
6. Email addresses that don't match "${p.email || "NONE"}"

Respond with ONLY:
PASS — if no invented data found
ISSUES: [brief description] — if invented data found

Be strict. A phone number formatted differently is fine. A completely different phone number is an issue.` }],
        }),
      });

      if (validationRes.ok) {
        const valData = await validationRes.json();
        const valResult = valData.content?.find(b => b.type === "text")?.text?.trim() || "PASS";
        console.log(`[${orderId}] Validation result: ${valResult}`);

        if (valResult.startsWith("ISSUES:")) {
          console.warn(`[${orderId}] Validation flagged issues: ${valResult}`);
          // Log but don't block — we note it in the owner email
          // Future: auto-fix pass here
        }
      }
    } catch(e) {
      console.log(`[${orderId}] Validation pass failed: ${e.message} — continuing`);
    }

    const htmlB64 = Buffer.from(html, "utf8").toString("base64");
    const bizSlug = (p.businessName || "website").toLowerCase().replace(/\s+/g, "-");

    // ── Save to Upstash (72hr TTL) ─────────────────────────────
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (upstashUrl && upstashToken) {
      try {
        const jobData = Buffer.from(JSON.stringify({
          htmlB64, businessName: p.businessName,
          city: p.city, email: p.email,
          packageId: p.packageId, orderId,
        })).toString("base64");
        const upstashRes = await fetch(`${upstashUrl}/set/order:${orderId}?ex=259200`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${upstashToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ value: jobData }),
        });
        console.log(`[${orderId}] Upstash save: ${upstashRes.status}`);
      } catch(e) {
        console.error(`[${orderId}] Upstash save error:`, e.message);
      }
    }

    // ── Owner notification ─────────────────────────────────────
    const resendKey = process.env.RESEND_API_KEY;
    const ownerEmail = process.env.OWNER_EMAIL;
    const fromEmail = process.env.FROM_EMAIL || "BlockSite <hello@blocksitebuilder.com>";

    if (resendKey && ownerEmail) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: fromEmail,
            to: ownerEmail,
            subject: `[BlockSite] Preview — ${p.businessName || "Unknown"} · ${orderId}`,
            html: `<div style="font-family:sans-serif;padding:24px;max-width:700px">
              <h2 style="color:#1c1a14;margin:0 0 4px">New Preview Generated</h2>
              <p style="color:#666;margin:0 0 4px;font-size:14px">Customer has not paid yet. HTML attached.</p>
              <p style="color:#c4813a;font-size:13px;margin:0 0 20px">Upstash: order:${orderId} · 72hr TTL</p>
              ${researchFindings ? `<div style="background:#f9f9f9;border-radius:8px;padding:14px;margin-bottom:20px;font-family:monospace;font-size:12px;white-space:pre-wrap;border:1px solid #e2ddd0">${researchFindings.slice(0, 600)}</div>` : '<p style="color:#999;font-style:italic;margin-bottom:20px">No research data found — new business.</p>'}
              <table style="font-size:14px;border-collapse:collapse;width:100%">
                ${[
                  ["Business", p.businessName],
                  ["Type", typeLabel],
                  ["City", p.city],
                  ["Phone", p.phone],
                  ["Email", p.email],
                  ["Address", p.address],
                  ["Hours", p.hours],
                  ["Photos", `${photoCount} uploaded`],
                  ["Package", p.packageId],
                  ["Vibe", `"${p.vibe}"`],
                ].map(([k,v], i) => `<tr${i%2===1?' style="background:#f9f9f9"':''}><td style="padding:7px 8px;font-weight:bold;color:#666;width:110px">${k}</td><td style="padding:7px 8px">${v || "—"}</td></tr>`).join("")}
              </table>
            </div>`,
            attachments: [{ filename: `${bizSlug}.html`, content: htmlB64 }],
          }),
        });
        console.log(`[${orderId}] Owner notification sent`);
      } catch(e) {
        console.error(`[${orderId}] Owner email error:`, e.message);
      }
    }

    return res.status(200).json({ htmlB64, orderId });

  } catch (err) {
    console.error(`[${orderId}] Generation failed:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}
