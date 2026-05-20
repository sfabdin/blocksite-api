// api/generate.js - Vercel Edge Runtime, streaming
// v6 — streaming generation, no timeout risk, live preview as HTML builds
export const config = { runtime: "edge" };

export default async function handler(req) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), { status: 500 });
  }

  const p = await req.json();
  const orderId = `BS-${Date.now()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;

  console.log(`[${orderId}] Generating for: ${p.businessName}, photos: ${p.photoCount || 0}`);

  // ── Derived constants ──────────────────────────────────────────
  const typeLabel = p.businessType === "restaurant" ? "Restaurant / Food Business"
    : p.businessType === "retail" ? "General Store / Retail"
    : "Specialty Service Business";

  const mapsUrl = encodeURIComponent(
    `${p.businessName || ""} ${p.address || ""} ${p.city || ""}`.trim()
  );

  const photoUrls = p.photoUrls || [];
  const photoCount = p.photoCount || photoUrls.length || 0;

  // Logo detection
  const firstUrl = photoUrls[0] || "";
  const isLogoFirst = firstUrl.endsWith(".svg") || /logo|brand|icon/i.test(firstUrl);
  const logoUrl = isLogoFirst ? firstUrl : null;
  const sitePhotos = isLogoFirst ? photoUrls.slice(1) : photoUrls;
  const sitePhotoCount = isLogoFirst ? photoCount - 1 : photoCount;

  // ── Extract dominant brand color from logo ─────────────────────
  let brandColor = null;
  if (logoUrl && !logoUrl.endsWith(".svg")) {
    try {
      const imgRes = await fetch(logoUrl);
      const buf = new Uint8Array(await imgRes.arrayBuffer());
      const hueBuckets = new Array(36).fill(0);
      const hueColors = new Array(36).fill(null).map(() => ({ r: 0, g: 0, b: 0, count: 0 }));
      const stride = Math.max(3, Math.floor(buf.length / 1200) * 3);
      for (let i = 0; i < buf.length - 2; i += stride) {
        const r = buf[i], g = buf[i+1], b = buf[i+2];
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const lightness = (max + min) / 2;
        if (lightness < 60 || lightness > 210) continue;
        const saturation = max === 0 ? 0 : (max - min) / max;
        if (saturation < 0.35) continue;
        let hue = 0;
        if (max === r) hue = ((g - b) / (max - min) + 6) % 6 * 60;
        else if (max === g) hue = ((b - r) / (max - min) + 2) * 60;
        else hue = ((r - g) / (max - min) + 4) * 60;
        const bucket = Math.floor(hue / 10) % 36;
        hueBuckets[bucket]++;
        hueColors[bucket].r += r;
        hueColors[bucket].g += g;
        hueColors[bucket].b += b;
        hueColors[bucket].count++;
      }
      let maxVotes = 0, bestBucket = -1;
      for (let i = 0; i < 36; i++) {
        if (hueBuckets[i] > maxVotes) { maxVotes = hueBuckets[i]; bestBucket = i; }
      }
      if (bestBucket >= 0 && maxVotes >= 3) {
        const c = hueColors[bestBucket];
        const r = Math.round(c.r / c.count);
        const g = Math.round(c.g / c.count);
        const b = Math.round(c.b / c.count);
        brandColor = `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
        console.log(`[${orderId}] Extracted brand color: ${brandColor} (${maxVotes} pixels in hue bucket ${bestBucket * 10}°)`);
      }
    } catch(e) {
      console.log(`[${orderId}] Color extraction failed: ${e.message}`);
    }
  }

  // ── Photo layout instruction ───────────────────────────────────
  const photoLayout = sitePhotoCount === 0
    ? "ZERO PHOTOS: Bold typographic design. Large color blocks, oversized type, decorative CSS shapes. Must feel intentionally designed, not empty."
    : sitePhotos.length > 0
    ? (() => {
        const heroUrl = sitePhotos[0];
        const remainingUrls = sitePhotos.slice(1);
        if (sitePhotos.length === 1) {
          return `ONE PHOTO: Use this exact URL as hero background: style="background-image: url('${heroUrl}')" with dark overlay.`;
        } else if (sitePhotos.length === 2) {
          return `TWO PHOTOS — use BOTH:
Hero background: style="background-image: url('${heroUrl}')" with dark overlay.
About section: <img src="${remainingUrls[0]}" alt=""> in a 50/50 editorial split.`;
        } else {
          return `${sitePhotos.length} PHOTOS — ALL must appear on the site. Every single URL below must be used as an <img> or background-image. No exceptions.
Hero background: style="background-image: url('${heroUrl}')" with dark overlay.
Remaining photos — use ALL of these, distributed across gallery, about, and services sections:
${remainingUrls.map((u, i) => `Photo ${i+2}: <img src="${u}" alt="">`).join("\n")}
Layout: Use a masonry or asymmetric grid in the gallery section. Vary sizes. If there are more than 4 photos, create a proper photo gallery section with all of them. Do not omit any photo.`;
        }
      })()
    : `${sitePhotoCount} PHOTOS: Use HERO_PHOTO_PLACEHOLDER as hero background. ALL remaining photos PHOTO_1_PLACEHOLDER through PHOTO_${Math.min(sitePhotoCount,6)}_PLACEHOLDER must appear in gallery and about sections. Every placeholder must be used.`;

  const subType = p.subType || "other";

  // ── Layout archetypes ──────────────────────────────────────────
  const typeLayout = p.businessType === "restaurant"
    ? subType === "bakery" ? "BAKERY/CAFÉ: Warm, artisanal. Daily specials prominent. Neighborhood favorite feel."
    : subType === "foodTruck" ? "FOOD TRUCK: Bold, mobile, energetic. Schedule and locations section. Social prominent."
    : "RESTAURANT: Dark, moody, editorial. Cinematic hero. Clean typographic menu. Owner pull quote."
    : p.businessType === "retail"
    ? subType === "pharmacy" ? "PHARMACY: Clean, trustworthy. Health-focused. Hours very prominent. Community anchor."
    : subType === "cornerStore" ? "BODEGA: Bold, neighborhood, always open. Specials prominent. Heartbeat of the block."
    : "RETAIL: Warm, inviting. Bold product/specials cards. Community-rooted about section."
    : ({ autobody:"AUTO BODY: Industrial confidence. Dark greys, bold accent. Trust signals prominent. 'Free Estimate' CTA.",
         salon:"HAIR SALON: Warm luxury. Rich colors, editorial. Gallery prominent. Booking CTA repeated.",
         barbershop:"BARBERSHOP: Classic cool. Bold type, strong contrast. 'Walk in or book' dual CTA.",
         nailsalon:"NAIL SALON: Clean, feminine. Soft palette, pop of color. Gallery prominent.",
         cleaning:"CLEANING: Fresh, trustworthy. Sky blues. 'Free quote' prominent.",
         childcare:"CHILDCARE: Warm, bright, reassuring. Programs clear. Tour CTA prominent.",
         tutoring:"TUTORING: Focused, encouraging. Results emphasized. Assessment CTA.",
         wellness:"WELLNESS: Calm, healing. Soft neutrals. Booking CTA prominent.",
         laundromat:"LAUNDROMAT: Clean, simple, honest. Services and hours crystal clear.",
         funeralhome:"FUNERAL HOME: Dignified, restrained, warm. NO bold animations. Phone always visible.",
         catering:"CATERING: Celebratory, professional. Sample menus. Quote request CTA.",
         photography:"PHOTOGRAPHY: Portfolio-first. Dramatic, editorial. Gallery fills screen.",
         tailoring:"TAILORING: Crafted, precise. Warm earth tones. Services and turnaround clear.",
         taxnotary:"TAX/NOTARY: Trustworthy, clear. Languages spoken prominent. Affordable help.",
         florist:"FLORIST: Fresh, botanical, alive. Deep greens. Gallery prominent. Same-day delivery.",
         church:"CHURCH: Welcoming, warm. Service times front and center. Open door feel.",
         legal:"LEGAL: Professional, trustworthy. 'Free Consultation' repeated throughout.",
       }[subType] || "SERVICE: Professional, trustworthy, community-rooted. Booking or contact CTA throughout.");

  // ── Content section ────────────────────────────────────────────
  const typeContent = p.businessType === "restaurant"
    ? `MENU SECTION (id="menu"): Elegant layout by category. Display serif headers. 3-4 items per category. Name prominent, one-line description, price only if provided. ${subType === "catering" ? "'Request a Quote' CTA." : "Ordering or reservation CTA at bottom."}`
    : p.businessType === "retail"
    ? `SPECIALS SECTION (id="specials"): Large bold cards for deals and best-sellers. At least one featured hero deal in full-width card before the grid.`
    : ({ autobody:`SERVICES (id="services"): Grid — Collision Repair, Paint & Body, Towing, Restoration, Window Tinting, Detailing. Insurance section if credentials mention preferred status. "Get a Free Estimate" CTA.`,
         salon:`SERVICES (id="services"): Braids, Locs, Color, Kids, Special Occasions. Pricing if provided. Booking CTA.`,
         barbershop:`SERVICES (id="services"): Fades, Lineups, Beard, Kids, Designs. Pricing if provided. "Walk In or Book" CTA.`,
         nailsalon:`SERVICES (id="services"): Manicure, Pedicure, Acrylics, Gel, Nail Art. Pricing if provided. Walk-ins CTA.`,
         cleaning:`SERVICES (id="services"): Residential, Deep Clean, Move-Out, Commercial, Airbnb. "Get a Free Quote" CTA.`,
         childcare:`PROGRAMS (id="services"): Full-Day Care, After-School, Summer, Drop-In. Age ranges and hours. "Schedule a Tour" CTA.`,
         tutoring:`SERVICES (id="services"): Math, Reading, SAT/ACT Prep, Regents. "Book a Free Assessment" CTA.`,
         wellness:`SERVICES (id="services"): Treatments with duration and pricing if provided. Booking CTA.`,
         laundromat:`SERVICES (id="services"): Self-Service, Wash & Fold, Dry Cleaning, Large Items. Pricing and hours.`,
         funeralhome:`SERVICES (id="services"): Traditional Funeral, Cremation, Graveside, Memorial, Pre-Need. Warm, restrained. Phone prominent.`,
         catering:`MENU (id="menu"): Sample menus or cuisine types. Event types. "Request a Quote" form.`,
         photography:`PORTFOLIO (id="portfolio"): Portraits, Weddings, Events, Commercial. Photos if uploaded. "Book a Session" CTA.`,
         tailoring:`SERVICES (id="services"): Hems, Alterations, Repairs, Custom, Wedding. Turnaround and pricing if provided.`,
         taxnotary:`SERVICES (id="services"): Tax Prep, ITIN, Notary, Immigration, Bookkeeping. Languages spoken. "Walk-ins Welcome" CTA.`,
         florist:`ARRANGEMENTS (id="services"): Everyday, Weddings, Funerals, Events, Custom. Phone or order CTA.`,
         church:`WORSHIP (id="services"): Service times and location. First-time visitor welcome. Ministries listed. "Join Us" CTA.`,
         legal:`SERVICES (id="services"): Practice areas. "Free Consultation" CTA throughout.`,
       }[subType] || `SERVICES (id="services"): Clean service cards with descriptions. Pricing if provided. Booking or contact CTA.`);

  // ── Contact section ────────────────────────────────────────────
  const isAutoBody = subType === "autobody";
  const isFuneral  = subType === "funeralhome";
  const isChurch   = subType === "church";
  const isCatering = subType === "catering";
  const isLegal    = subType === "legal";
  const isChildcareOrTutor = subType === "childcare" || subType === "tutoring";

  const contactSection = p.businessType === "restaurant"
    ? `CONTACT/ORDER (id="contact"): No HTML input forms. Large phone <a href="tel:${p.phone||""}"> "Call to Order". Real delivery URLs as styled buttons if found in research. Real reservation link if found. Hours. Address with "Get Directions" <a href="https://maps.google.com/?q=${mapsUrl}" target="_blank">.`
    : p.businessType === "retail"
    ? `CONTACT (id="contact"): Phone <a href="tel:${p.phone||""}"> "Give us a call". Address + "Get Directions" <a href="https://maps.google.com/?q=${mapsUrl}" target="_blank">. Hours. Simple contact form only if email provided.`
    : `CONTACT/BOOKING (id="contact"):
${isFuneral  ? `Phone available 24/7: <a href="tel:${p.phone||""}">. "We're here when you need us."` : ""}
${isChurch   ? `Service times prominent. Address + "Get Directions". Phone for pastoral inquiries.` : ""}
${isCatering ? `"Request a Quote" form: event type, date, guests, contact.` : ""}
${isAutoBody ? `Large "Get a Free Estimate" button → tel:${p.phone||""}. Insurance info if applicable.` : ""}
${isLegal    ? `Large "Free Consultation" button → tel:${p.phone||""}.` : ""}
${isChildcareOrTutor ? `Large "Schedule a Visit" button → tel:${p.phone||""}.` : ""}
${!isFuneral && !isChurch && !isCatering && !isAutoBody && !isLegal && !isChildcareOrTutor
  ? `If research found a real booking URL for this specific business page (not a platform homepage), make "Book Now" the hero CTA with that exact URL. If only a platform homepage was found, use the phone number as the primary CTA instead.` : ""}
Phone <a href="tel:${p.phone||""}"> prominent. Address + "Get Directions" <a href="https://maps.google.com/?q=${mapsUrl}" target="_blank"> if walk-ins relevant. Hours. Contact form (name, email, message) if email provided.`;

  // ── Return stream immediately — all processing happens inside ──
  // This sends the first byte within milliseconds, keeping the connection alive
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      // Send orderId immediately — this is what keeps the Edge connection alive
      send({ type: "orderId", orderId });
      send({ type: "status", message: "Researching your business..." });

      // ── STEP 1: Research (two-pass) ──────────────────────────
      console.log(`[${orderId}] Starting research + prompt prep`);
      let researchFindings = "";
      try {
        const searchRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "web-search-2025-03-05",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-5",
            max_tokens: 5000,
            system: "You are a business researcher. Search for the business and summarize everything you find — ratings, reviews, social media, history, links.",
            tools: [{ type: "web_search_20250305", name: "web_search" }],
            messages: [{ role: "user", content: `Search for "${p.businessName}" ${p.address || ""} ${p.city || "New York"}. Find: Google rating, customer reviews (verbatim quotes), Instagram handle and followers, how long they've been open, delivery or booking links, any press coverage.` }],
          }),
        });

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const searchSummary = searchData.content?.filter(b => b.type === "text")?.map(b => b.text)?.join("\n") || "";
          if (searchSummary) {
            const formatRes = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
              body: JSON.stringify({
                model: "claude-sonnet-4-5",
                max_tokens: 2000,
                system: "Extract structured business data. Output only the formatted fields, nothing else.",
                messages: [{ role: "user", content: `From the search results below, extract this data. Write "none found" for anything missing. Never invent.

FOUND: yes/no/partial
RATING: [e.g. "4.8 stars · 43 Google reviews" or "none found"]
REVIEWS: [2-3 verbatim quotes: "Quote" — FirstName, Platform. Or "none found"]
ORDERING_LINKS: [real URLs or "n/a"]
BOOKING_LINKS: [real URLs or "n/a"]
PRESS: [coverage/awards or "none found"]
SOCIAL: [e.g. "@handle · 517 followers" or "none found"]
HISTORY: [founding year / history or "none found"]
HAS_WEBSITE: yes/no

Search results:
${searchSummary.slice(0, 4000)}` }],
              }),
            });
            if (formatRes.ok) {
              const formatData = await formatRes.json();
              researchFindings = formatData.content?.find(b => b.type === "text")?.text || "";
              console.log(`[${orderId}] Research complete: ${researchFindings.slice(0, 200)}`);
            }
          }
        }
      } catch(e) {
        console.log(`[${orderId}] Research failed: ${e.message} — continuing without`);
      }

      const noResearch = !researchFindings || researchFindings.includes("FOUND: no");

      // ── STEP 2: Build prompts ────────────────────────────────
      send({ type: "status", message: "Building your site..." });
  const systemPrompt = `You are a senior web designer at a boutique agency. Your work is award-winning, distinctive, and makes business owners proud to share it.

ABSOLUTE RULES:
- Output raw HTML only. Start with <!DOCTYPE html>. No markdown, no code fences, no explanation.
- Never invent data. Phone, price, review, rating, URL, hours — if not provided or found in research, omit it.
- Zero emoji anywhere. SVG icons or CSS only.
- Fully self-contained — all CSS and JS inline, zero external JS libraries.
- Never close HTML prematurely. If running low on tokens, shorten copy — never skip sections.
- PHOTOS: Every single uploaded photo URL provided must appear in the HTML as either a background-image or <img> tag. If 6 photos are provided, all 6 must be on the site. Never omit a provided photo.

TECHNICAL:
- Mobile-first. Perfect at 375px. Adapts to 768px+ desktop.
- Fonts: https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,600;1,400&display=swap
- Two fonts max. 900 weight display, 300-400 body.
- 2 brand colors + 2 neutrals. Chosen deliberately. No generic blues or grays.
- Generous spacing. Every section visually distinct. Quality bar: $3,000–5,000 agency site.
- Smooth scroll, fade-up animations on scroll via IntersectionObserver, hover states on all interactive elements.
- JSON-LD schema: LocalBusiness (or subtype). Only include fields with verified data.
- meta description, og:title, og:description, canonical URL using business name slug.

LOGO & BRANDING:
- SVG logo provided → use as <img> in nav (height:55px) and footer (height:70px). Extract its colors.
- Raster logo (PNG/JPG) provided → nav gets bold CSS text wordmark in brand color. Footer gets <img> at 140px wide.
- No logo → styled text wordmark in nav.
- Build entire palette around the logo/brand color. Site must feel like the same brand.

ICONS — every service card icon must match the service:
Auto body/collision → car with damage or wrench. Towing → tow truck. Window tinting → car window with gradient.
Paint → spray gun. Salon → scissors. Barbershop → straight razor. Nail → polish bottle.
Cleaning → spray bottle. Laundromat → washing machine. Childcare → child figure or blocks.
Tutoring → open book. Wellness → lotus or hands. Restaurant → fork+knife. Bakery → layered cake.
Food truck → truck silhouette. Florist → flower stem. Pharmacy → mortar+pestle. Bodega → storefront awning.
Law → scales of justice. Tax/Notary → document+stamp. Church → arch or cross. Photography → camera.
RULE: Draw clean SVG — 3-8 path elements. Never use a generic shape that doesn't represent the service.

ATTRIBUTION (required on every site, no exceptions):
Add this as the very last element before </body>, after the footer:
<div style="text-align:center;padding:10px;font-family:sans-serif;font-size:11px;color:#999;background:#f9f9f9;border-top:1px solid #eee">
  Built by <a href="https://blocksitebuilder.com" target="_blank" rel="noopener" style="color:#c4813a;text-decoration:none;font-weight:600">BLOCKSite</a>
</div>

SECTIONS (in order):
1. <nav> Fixed. Starts with semi-transparent dark background (never fully transparent — always readable). Becomes solid on scroll. Logo left, links right on desktop, hamburger ONLY on mobile. CRITICAL: The hamburger and mobile menu must be hidden on desktop (display:none above 768px). Never show both desktop links AND hamburger at the same time. Never render two nav bars.
2. <section id="home"> Hero. 100svh. Vibe-matched. Bold display type. Staggered animation. One strong CTA.
3. [CONTENT SECTION]
4. <section id="about"> Story. Human. Community connection explicit. Pull quote if origin story provided.
5. [TESTIMONIALS — only if verified reviews found in research]
6. [CONTACT SECTION]
7. <footer> Name, tagline, nav links, phone, address. Warm closing line. Copyright.`;

  const userPrompt = `BUSINESS BRIEF:
Name: ${p.businessName || "Local Business"}
Owner: ${p.ownerName || "the owner"}
Type: ${typeLabel} (${p.subType || "general"})
Industry: ${p.industry || ""}
Founded: ${p.foundedYear ? `Est. ${p.foundedYear}` : ""}
Tagline: ${p.tagline || ""}
City: ${p.city || "our community"}${p.neighborhood ? ` · ${p.neighborhood}` : ""}
Address: ${p.address || ""}
Phone: ${p.phone || ""}${p.email ? ` · Email: ${p.email}` : ""}
Hours: ${p.hours || ""}${p.instagram ? `\nInstagram: @${p.instagram.replace("@","")}` : ""}
${logoUrl ? `\nLOGO: ${logoUrl}
${logoUrl.endsWith(".svg")
  ? `SVG logo. Use as <img> in nav and footer. Extract colors and build palette around them.`
  : `Raster logo. Brand color: ${brandColor || "extract from image"}. Nav: bold text wordmark in brand color. Footer: <img src="${logoUrl}" style="width:140px">.`
}` : ""}

DESCRIPTION: ${p.description || ""}
DIFFERENTIATOR: ${p.differentiator || ""}
ORIGIN STORY: ${p.about || ""}
TYPE-SPECIFIC: ${p.typeSpecific || ""}

WRITING DIRECTION:
${p.ownerName ? `- Use "${p.ownerName}" by name in about section` : ""}
${p.foundedYear ? `- Weave in "serving ${p.city || "the community"} since ${p.foundedYear}"` : ""}
${p.neighborhood ? `- Use "${p.neighborhood}" for hyper-local feel` : ""}
${p.differentiator ? `- Lead with: "${p.differentiator}" in hero or first visible section` : ""}
${p.instagram ? `- Link @${p.instagram.replace("@","")} in footer and contact` : ""}

VIBE: "${p.vibe || "Warm, welcoming, community-first"}"
This drives every color, font, and spacing decision.
${p.brandColor ? `BRAND COLOR: The customer selected ${p.brandColor} as their primary brand color. Use this as the dominant accent color throughout the site — buttons, headings, accents, hover states. Build the palette around it.` : ""}
${p.subType === "funeralhome" ? "\nTONE: Funeral home. Dignified, restrained. No bold animations, no aggressive CTAs." : ""}
${p.subType === "church" ? "\nLAYOUT: Section 3 is worship times + programs. Contact invites warmly." : ""}

LAYOUT ARCHETYPE:
${typeLayout}

PHOTOS:
${photoLayout}

RESEARCH FINDINGS:
${noResearch
  ? "Not found online. This is their internet debut. Do not reference ratings, reviews, or platforms."
  : `${researchFindings}

RESEARCH USAGE — research-sourced content must make up ~30% of visible page content:
- RATING: Display prominently in hero as a trust badge (e.g. "⭐ 4.8 · 43 Google Reviews" styled as a pill near CTA). Also reference in about section.
- REVIEWS: Use as large pull quotes in testimonials section AND weave 1-2 short phrases into hero or about copy naturally.
- SOCIAL: Display follower count as social proof ("517 neighbors follow us on Instagram"). Link in nav, hero, footer.
- HISTORY: Lead with it — "Serving the Bronx since 2019" in hero, about, and footer.
- HAS_WEBSITE: If yes, frame as upgrade in about section.
- PRESS/AWARDS: Display as trust badge between sections.
- ORDERING/BOOKING LINKS: Wire real URLs into CTA buttons — never placeholder links when real ones found. CRITICAL: Use the specific business page URL (e.g. getsquire.com/discover/barbershop/elegant-barbershop-4th-street-brooklyn), never a platform homepage (e.g. never just getsquire.com or vagaro.com). If only the homepage was found, use the phone number as the CTA instead.
- "none found" fields → skip. Never invent. Use everything found aggressively.`}

${!noResearch && researchFindings.includes("REVIEWS:") && !researchFindings.includes("REVIEWS: none")
  ? "TESTIMONIALS: Required. Verified reviews as large elegant pull quotes. First name + platform attribution. Between about and contact."
  : "TESTIMONIALS: Omit entirely."}

CONTENT SECTION (section 3):
${typeContent}

CONTACT SECTION (section 6):
${contactSection}`;

      // ── STEP 3: Stream generation ──────────────────────────
      console.log(`[${orderId}] Starting streaming generation`);
      send({ type: "stage", stage: 2, message: "Designing your layout..." });

      let htmlLength = 0;

      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-opus-4-5",
          max_tokens: 22000,
          stream: true,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!anthropicRes.ok) {
        const err = await anthropicRes.text();
        send({ type: "error", message: `Anthropic error ${anthropicRes.status}: ${err.slice(0,200)}` });
        controller.close();
        return;
      }

      let fullHtml = "";
      let outputTokens = 0;
      const reader = anthropicRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const event = JSON.parse(data);

              if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
                const chunk = event.delta.text;
                fullHtml += chunk;
                send({ type: "html", chunk });
                // Send stage updates at meaningful content milestones
                const prev = htmlLength;
                htmlLength = fullHtml.length;
                if (prev < 3000 && htmlLength >= 3000) send({ type: "stage", stage: 3, message: "Writing your content..." });
                if (prev < 10000 && htmlLength >= 10000) send({ type: "stage", stage: 4, message: "Adding final details..." });
              }

              if (event.type === "message_delta" && event.usage) {
                outputTokens = event.usage.output_tokens;
              }

              if (event.type === "message_stop") {
                console.log(`[${orderId}] Generation done. Tokens: ${outputTokens}, HTML: ${fullHtml.length} chars`);
              }
            } catch(e) {
              // Skip malformed SSE lines
            }
          }
        }
      } catch(e) {
        console.error(`[${orderId}] Stream read error: ${e.message}`);
      }

      // Clean up HTML
      fullHtml = fullHtml.replace(/^```html?\n?/i, "").replace(/\n?```$/m, "").trim();

      if (fullHtml.length < 500) {
        send({ type: "error", message: "AI returned empty response" });
        controller.close();
        return;
      }

      // ── Validation pass ──────────────────────────────────────
      console.log(`[${orderId}] Running validation pass`);
      try {
        const validationRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-sonnet-4-5",
            max_tokens: 500,
            messages: [{ role: "user", content: `Check this website HTML for invented data vs what the owner actually provided.

OWNER PROVIDED:
- Phone: ${p.phone || "NONE"}
- Email: ${p.email || "NONE"}
- Address: ${p.address || "NONE"}
- Hours: ${p.hours || "NONE"}
- Prices: ${p.typeSpecific?.includes("price") ? "some prices provided" : "NONE"}

RESEARCH DATA:
${researchFindings || "none"}

HTML (first 3000 chars):
${fullHtml.slice(0, 3000)}

Check for: wrong phone, invented prices, invented reviews not in research, fake delivery URLs, wrong hours, wrong email.
Reply ONLY with: PASS or ISSUES: [description]` }],
          }),
        });

        if (validationRes.ok) {
          const valData = await validationRes.json();
          const valResult = valData.content?.find(b => b.type === "text")?.text?.trim() || "PASS";
          console.log(`[${orderId}] Validation: ${valResult}`);

          if (valResult.startsWith("ISSUES:")) {
            console.warn(`[${orderId}] Fixing: ${valResult}`);
            // Fast surgical fixes on JSON-LD schema only
            if (valResult.toLowerCase().includes("price")) {
              fullHtml = fullHtml.replace(/"priceRange"\s*:\s*"[^"]*"/g, '"priceRange": "Contact for pricing"');
            }
            if (valResult.toLowerCase().includes("hours")) {
              if (p.hours) {
                fullHtml = fullHtml.replace(/"openingHours"\s*:\s*(\[[^\]]*\]|"[^"]*")/g, `"openingHours": "${p.hours}"`);
              } else {
                fullHtml = fullHtml.replace(/"openingHours"\s*:\s*(\[[^\]]*\]|"[^"]*")\s*,?/g, "");
              }
            }
            if (valResult.toLowerCase().includes("phone") && p.phone) {
              fullHtml = fullHtml.replace(/"telephone"\s*:\s*"[^"]*"/g, `"telephone": "${p.phone}"`);
            }
            console.log(`[${orderId}] Fast fix applied`);
          }
        }
      } catch(e) {
        console.log(`[${orderId}] Validation failed: ${e.message} — continuing`);
      }

      // ── Save to Upstash ──────────────────────────────────────
      const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
      const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

      // Base64 encode without Buffer (Edge compatible)
      const htmlBytes = new TextEncoder().encode(fullHtml);
      let htmlB64 = "";
      const chunkSize = 8192;
      for (let i = 0; i < htmlBytes.length; i += chunkSize) {
        htmlB64 += String.fromCharCode(...htmlBytes.slice(i, i + chunkSize));
      }
      htmlB64 = btoa(htmlB64);

      if (upstashUrl && upstashToken) {
        try {
          const jobData = btoa(JSON.stringify({
            htmlB64,
            businessName: p.businessName,
            city: p.city,
            email: p.email,
            packageId: p.packageId,
            orderId,
          }));
          const upstashRes = await fetch(`${upstashUrl}/set/order:${orderId}?ex=259200`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${upstashToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ value: jobData }),
          });
          console.log(`[${orderId}] Upstash save: ${upstashRes.status}`);
        } catch(e) {
          console.error(`[${orderId}] Upstash error: ${e.message}`);
        }
      }

      // ── Owner notification ────────────────────────────────────
      const resendKey = process.env.RESEND_API_KEY;
      const ownerEmail = process.env.OWNER_EMAIL;
      const fromEmail = process.env.FROM_EMAIL || "BlockSite <hello@blocksitebuilder.com>";
      const bizSlug = (p.businessName || "website").toLowerCase().replace(/\s+/g, "-");

      if (resendKey && ownerEmail) {
        try {
          const ownerRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
            body: JSON.stringify({
              from: fromEmail,
              to: ownerEmail,
              subject: `[BlockSite] Preview — ${p.businessName || "Unknown"} · ${orderId}`,
              html: `<div style="font-family:sans-serif;padding:24px;max-width:700px">
                <h2 style="color:#1c1a14">New Preview: ${p.businessName}</h2>
                <p style="color:#c4813a;font-size:13px">Order: ${orderId} · Upstash: 72hr TTL</p>
                ${researchFindings ? `<pre style="background:#f9f9f9;padding:14px;border-radius:8px;font-size:12px;overflow:auto;border:1px solid #e2ddd0">${researchFindings.slice(0,600)}</pre>` : "<p style='color:#999;font-style:italic'>No research data found.</p>"}
                <table style="font-size:14px;border-collapse:collapse;width:100%;margin-top:16px">
                  ${[["Business",p.businessName],["Type",typeLabel],["City",p.city],["Phone",p.phone],["Email",p.email],["Hours",p.hours],["Photos",`${photoCount} uploaded`],["Package",p.packageId],["Vibe",`"${p.vibe}"`]]
                    .map(([k,v],i)=>`<tr${i%2?` style="background:#f9f9f9"`:""}><td style="padding:7px 8px;font-weight:bold;color:#666;width:110px">${k}</td><td style="padding:7px 8px">${v||"—"}</td></tr>`).join("")}
                </table>
              </div>`,
              attachments: [{ filename: `${bizSlug}.html`, content: htmlB64, content_type: "text/html" }],
            }),
          });
          const ownerData = await ownerRes.json();
          console.log(`[${orderId}] Owner notification: ${JSON.stringify(ownerData)}`);
        } catch(e) {
          console.error(`[${orderId}] Owner email error: ${e.message}`);
        }
      }

      // Send final complete HTML to client
      send({ type: "complete", htmlB64, orderId });
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "X-Accel-Buffering": "no",
    },
  });
}
