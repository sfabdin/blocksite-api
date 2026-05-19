// api/generate.js - Vercel serverless function
// Max duration: 300 seconds (set in vercel.json)
// v6 — alpha-channel color fix, tighter color prompting, research cleanup,
//       better validation patching, truncation guard, JSON photo manifest

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  const p = req.body;
  const orderId = `BS-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  console.log(`[${orderId}] Generating for: ${p.businessName}, photos: ${p.photoCount || 0}`);

  // ── Derived constants ──────────────────────────────────────────
  const typeLabel =
    p.businessType === "restaurant" ? "Restaurant / Food Business"
    : p.businessType === "retail"   ? "General Store / Retail"
    :                                  "Specialty Service Business";

  const mapsUrl = encodeURIComponent(
    `${p.businessName || ""} ${p.address || ""} ${p.city || ""}`.trim()
  );

  const photoUrls   = p.photoUrls || [];
  const photoCount  = p.photoCount || photoUrls.length || 0;

  // Detect logo (first photo is SVG, or URL contains logo/brand/icon)
  const firstUrl   = photoUrls[0] || "";
  const isLogoFirst = firstUrl.endsWith(".svg") || /logo|brand|icon/i.test(firstUrl);
  const logoUrl    = isLogoFirst ? firstUrl : null;
  const sitePhotos = isLogoFirst ? photoUrls.slice(1) : photoUrls;
  const sitePhotoCount = isLogoFirst ? photoCount - 1 : photoCount;

  // ── FIX 1: Extract brand color with proper alpha handling ──────
  let brandColor = null;
  if (logoUrl && !logoUrl.endsWith(".svg")) {
    try {
      const imgRes = await fetch(logoUrl);
      const buf    = Buffer.from(await imgRes.arrayBuffer());

      // Detect PNG by magic bytes (PNG = 0x89 0x50 0x4E 0x47)
      const isPNG    = buf.length > 4 && buf[0] === 0x89 && buf[1] === 0x50;
      // Detect JPEG by magic bytes (JPEG = 0xFF 0xD8)
      const isJPEG   = buf.length > 2 && buf[0] === 0xFF && buf[1] === 0xD8;
      const chanStride = isPNG ? 4 : 3; // RGBA vs RGB

      // For JPEG we can sample directly; for PNG we need to skip encoded chunks
      // Simple fallback: treat unknown formats as RGB (3-byte stride)
      const byteStride = chanStride;

      // Sample ~800 pixels evenly across the buffer
      const sampleEvery = Math.max(byteStride, Math.floor(buf.length / (800 * byteStride)) * byteStride);

      // Accumulate candidates into hue buckets for simple clustering
      const hueBuckets = new Array(36).fill(null).map(() => ({ r: 0, g: 0, b: 0, count: 0, score: 0 }));

      for (let i = 0; i < buf.length - (byteStride - 1); i += sampleEvery) {
        const r = buf[i];
        const g = buf[i + 1];
        const b = buf[i + 2];

        // FIX: Skip transparent/semi-transparent pixels (alpha channel)
        if (isPNG) {
          const alpha = buf[i + 3];
          if (alpha < 128) continue; // transparent — skip, this was your hot pink source
        }

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const lightness = (max + min) / 2;

        // Skip near-black (shadows) and near-white (backgrounds)
        if (lightness < 55 || lightness > 215) continue;

        const saturation = max === 0 ? 0 : (max - min) / max;
        if (saturation < 0.25) continue; // skip greys and near-grey

        // Compute hue (0-360)
        let hue = 0;
        const delta = max - min;
        if (delta > 0) {
          if (max === r)      hue = 60 * (((g - b) / delta) % 6);
          else if (max === g) hue = 60 * (((b - r) / delta) + 2);
          else                hue = 60 * (((r - g) / delta) + 4);
          if (hue < 0) hue += 360;
        }

        // Bucket by hue (10° buckets)
        const bucketIdx = Math.floor(hue / 10) % 36;
        const lightnessBonus = 1 - Math.abs(lightness - 140) / 140;
        const score = saturation * (0.7 + 0.3 * lightnessBonus);

        hueBuckets[bucketIdx].r     += r * score;
        hueBuckets[bucketIdx].g     += g * score;
        hueBuckets[bucketIdx].b     += b * score;
        hueBuckets[bucketIdx].score += score;
        hueBuckets[bucketIdx].count += 1;
      }

      // Merge adjacent hue buckets (±1 bucket = ±10°) to handle hue spread
      const merged = hueBuckets.map((bucket, idx) => {
        const prev = hueBuckets[(idx + 35) % 36];
        const next = hueBuckets[(idx + 1)  % 36];
        return {
          r:     bucket.r     + prev.r     * 0.5 + next.r     * 0.5,
          g:     bucket.g     + prev.g     * 0.5 + next.g     * 0.5,
          b:     bucket.b     + prev.b     * 0.5 + next.b     * 0.5,
          score: bucket.score + prev.score * 0.5 + next.score * 0.5,
        };
      });

      // Pick the winning cluster
      const winner = merged.reduce((best, cur) => cur.score > best.score ? cur : best, merged[0]);

      if (winner.score > 0.5) {
        const wr = Math.round(winner.r / winner.score);
        const wg = Math.round(winner.g / winner.score);
        const wb = Math.round(winner.b / winner.score);
        brandColor = `#${wr.toString(16).padStart(2, "0")}${wg.toString(16).padStart(2, "0")}${wb.toString(16).padStart(2, "0")}`;
        console.log(`[${orderId}] Extracted brand color: ${brandColor} (score: ${winner.score.toFixed(2)}, isPNG: ${isPNG})`);
      }
    } catch (e) {
      console.log(`[${orderId}] Color extraction failed: ${e.message}`);
    }
  }

  // ── FIX 2: Structured JSON photo manifest ─────────────────────
  const photoManifest = JSON.stringify({
    hero:    sitePhotos[0]          || null,
    gallery: sitePhotos.slice(1, 4),
    total:   sitePhotoCount,
  });

  const photoLayout =
    sitePhotoCount === 0
      ? "ZERO PHOTOS: Bold typographic design. Large color blocks, oversized type, decorative CSS shapes and lines. Must feel intentionally designed, not empty."
      : sitePhotos.length > 0
        ? `PHOTO MANIFEST (JSON — use these exact URLs, in this exact order, no substitutions):\n${photoManifest}\n\nLayout rules:\n- hero: full-height background-image with dark overlay in the hero section\n- gallery[0]: 50/50 editorial split in about section (photo left, text right on desktop)\n- gallery[1..]: asymmetric masonry gallery, vary sizes, never an equal grid\n- Never reuse the hero URL in the gallery`
        : (() => {
            if (sitePhotoCount === 1)  return `ONE PHOTO: HERO_PHOTO_PLACEHOLDER as hero background-image with dark overlay.`;
            if (sitePhotoCount === 2)  return `TWO PHOTOS: HERO_PHOTO_PLACEHOLDER as hero background. PHOTO_1_PLACEHOLDER in 50/50 about section split.`;
            return `${sitePhotoCount} PHOTOS: HERO_PHOTO_PLACEHOLDER as hero background. PHOTO_1_PLACEHOLDER through PHOTO_${Math.min(sitePhotoCount, 4)}_PLACEHOLDER in asymmetric gallery.`;
          })();

  const subType = p.subType || "other";

  // ── Subtype-aware layout archetype ─────────────────────────────
  const typeLayout =
    p.businessType === "restaurant"
      ? subType === "bakery"
        ? "BAKERY/CAFÉ ARCHETYPE: Warm, artisanal, inviting. Soft lighting feel, handcrafted aesthetic. Daily specials prominent. Should feel like a neighborhood favorite you want to visit every morning."
        : subType === "foodTruck"
        ? "FOOD TRUCK ARCHETYPE: Bold, mobile, energetic. Big personality. Schedule and locations section. Social media prominent. Should feel fun and easy to find."
        : "RESTAURANT ARCHETYPE: Dark, moody, editorial. Cinematic hero — full height, dramatic type, minimal words. Menu clean and typographic. About has owner pull quote. Atmosphere over information."
      : p.businessType === "retail"
      ? subType === "pharmacy"
        ? "PHARMACY ARCHETYPE: Clean, trustworthy, professional. Health-focused. Community anchor feel. Services and hours very prominent. Should feel like a place you trust with your family's health."
        : subType === "cornerStore"
        ? "BODEGA ARCHETYPE: Bold, neighborhood, always open. Specials prominent. Community-rooted. Should feel like the heartbeat of the block."
        : "RETAIL ARCHETYPE: Warm, inviting, neighborhood boutique. Hero has immediate energy and CTA. Bold product/specials cards. About section roots the business in the community."
      : (() => {
          const archetypes = {
            autobody:    "AUTO BODY ARCHETYPE: Industrial confidence. Dark greys, bold accent color. Services and trust signals prominent. 'Get a Free Estimate' repeated. Should feel like a shop that does honest work.",
            salon:       "HAIR SALON ARCHETYPE: Warm luxury. Rich colors, editorial feel. Gallery prominent. Booking CTA repeated. Should feel like a place where people leave looking and feeling their best.",
            barbershop:  "BARBERSHOP ARCHETYPE: Classic cool. Bold type, strong contrast, community energy. Services clear. 'Walk in or book' dual CTA. Should feel like the spot everyone knows.",
            nailsalon:   "NAIL SALON ARCHETYPE: Clean, feminine, inviting. Soft palette with a pop of color. Gallery prominent. Should feel like a little luxury accessible to everyone.",
            cleaning:    "CLEANING ARCHETYPE: Fresh, trustworthy, organized. Sky blues or greens. 'Get a free quote' prominent. Should feel like they show up on time and leave things spotless.",
            childcare:   "CHILDCARE ARCHETYPE: Warm, bright, reassuring. Parents need to feel safe leaving their child here. Programs clear. Tour CTA prominent. Should feel like a second home.",
            tutoring:    "TUTORING ARCHETYPE: Focused, encouraging, professional. Bright and clean. Results emphasized. Assessment CTA prominent. Should feel like the place where grades actually improve.",
            wellness:    "WELLNESS ARCHETYPE: Calm and healing. Soft neutrals, warm tones. Booking CTA prominent. Should feel like relief before you even walk in.",
            laundromat:  "LAUNDROMAT ARCHETYPE: Clean, simple, honest. Services and hours crystal clear. Community-rooted. Should feel like the most reliable stop on the block.",
            funeralhome: "FUNERAL HOME ARCHETYPE: Dignified, restrained, warm. Navy or deep burgundy. NO bold animations. NO energetic CTAs. Phone number always visible. Should feel like a place of comfort in hard times.",
            catering:    "CATERING ARCHETYPE: Celebratory and professional. Rich colors. Sample menus prominent. Quote request CTA clear. Should feel like the caterer who makes every event memorable.",
            photography: "PHOTOGRAPHY ARCHETYPE: Portfolio-first. Dramatic, editorial. Gallery fills the screen. Booking CTA prominent. Should feel like every photo tells a story.",
            tailoring:   "TAILORING ARCHETYPE: Crafted, precise, old-world quality. Warm earth tones. Services and turnaround clear. Should feel like trusted hands that get it right.",
            taxnotary:   "TAX/NOTARY ARCHETYPE: Trustworthy, clear, community-rooted. Professional but not cold. Services and languages spoken prominent. Should feel like help you can actually afford and trust.",
            florist:     "FLORIST ARCHETYPE: Fresh, botanical, alive. Deep greens and natural textures. Gallery prominent. Same-day delivery and ordering prominent. Should feel like walking into a garden.",
            church:      "CHURCH ARCHETYPE: Welcoming, warm, community-rooted. Service times front and center. Ministries highlighted. Should feel like an open door — everyone is invited.",
            legal:       "LEGAL ARCHETYPE: Professional, trustworthy, community-rooted. Deep navy or dark tones. 'Free Consultation' repeated. Should feel like someone who actually fights for you.",
          };
          return archetypes[subType] || "SERVICE ARCHETYPE: Professional, trustworthy, community-rooted. Credibility established immediately. Services in clean cards. Booking or contact CTA repeated throughout.";
        })();

  // ── Subtype-aware content section ──────────────────────────────
  const typeContent = (() => {
    if (p.businessType === "restaurant") {
      return `MENU SECTION (id="menu"): Elegant menu layout grouped by category. Category headers in display serif. 3-4 items per category. Name prominent, one-line description, price only if provided. ${subType === "catering" ? "Include a 'Request a Quote' CTA for event inquiries." : "Include ordering or reservation CTA at the bottom."}`;
    }
    if (p.businessType === "retail") {
      return `SPECIALS SECTION (id="specials"): Large bold cards for deals and best-sellers. Price or savings prominent. At least one featured hero deal in a full-width card before the grid.`;
    }
    const serviceSection = {
      autobody:    `SERVICES SECTION (id="services"): Service cards in a grid — Collision Repair, Paint & Body, Oil Changes, Tires, Detailing. Brief description per service. Insurance section if credentials mention preferred status. "Get a Free Estimate" CTA.`,
      salon:       `SERVICES SECTION (id="services"): Service cards with pricing if provided — Braids, Locs, Color, Kids, Special Occasions. "Book Your Appointment" CTA. Link to booking platform if found in research.`,
      barbershop:  `SERVICES SECTION (id="services"): Services — Fades, Lineups, Beard, Kids, Designs. Pricing if provided. "Walk In or Book" dual CTA.`,
      nailsalon:   `SERVICES SECTION (id="services"): Service cards — Manicure, Pedicure, Acrylics, Gel, Nail Art. Pricing if provided. "Walk-ins Welcome" CTA.`,
      cleaning:    `SERVICES SECTION (id="services"): Service cards — Residential, Deep Clean, Move-Out, Commercial, Airbnb. Pricing if provided. "Get a Free Quote" CTA.`,
      childcare:   `PROGRAMS SECTION (id="services"): Program cards — Full-Day Care, After-School, Summer, Drop-In. Age ranges and hours prominent. "Schedule a Tour" CTA.`,
      tutoring:    `SERVICES SECTION (id="services"): Subject/service cards with grade levels — Math, Reading, SAT Prep, Regents, etc. "Book a Free Assessment" CTA.`,
      wellness:    `SERVICES SECTION (id="services"): Treatment cards with duration and pricing if provided. "Book Your Session" CTA. Link to booking platform if found in research.`,
      laundromat:  `SERVICES SECTION (id="services"): Services — Self-Service, Wash & Fold, Dry Cleaning, Large Items. Pricing if provided. Hours prominent.`,
      funeralhome: `SERVICES SECTION (id="services"): Services listed with dignity — Traditional Funeral, Cremation, Graveside, Memorial, Pre-Need Planning. Tone warm and restrained. Phone prominent. No aggressive CTAs.`,
      catering:    `MENU SECTION (id="menu"): Sample menus or cuisine types. Event types served. "Request a Quote" form: event type, date, guest count, contact info.`,
      photography: `PORTFOLIO SECTION (id="portfolio"): Gallery of work categories — Portraits, Weddings, Events, Commercial. Photos if uploaded. "Book a Session" CTA.`,
      tailoring:   `SERVICES SECTION (id="services"): Services — Hems, Alterations, Repairs, Custom Tailoring, Wedding Dress. Turnaround time and pricing if provided.`,
      taxnotary:   `SERVICES SECTION (id="services"): Services — Tax Prep, ITIN, Notary, Immigration Forms, Bookkeeping. Languages spoken if provided. "Walk-ins Welcome" or appointment CTA.`,
      florist:     `ARRANGEMENTS SECTION (id="services"): Categories — Everyday, Weddings, Funerals, Events, Custom. Photos if uploaded. Phone or order CTA.`,
      church:      `WORSHIP SECTION (id="services"): Service times and location prominent. What to expect as a first-time visitor. Ministries and programs listed. "Join Us This Sunday" CTA.`,
      legal:       `SERVICES SECTION (id="services"): Practice areas — Immigration, Family Law, Personal Injury, Criminal Defense, etc. "Free Consultation" CTA throughout.`,
    };
    return serviceSection[subType] || `SERVICES SECTION (id="services"): Clean service cards with descriptions. Pricing if provided. Clear booking or contact CTA.`;
  })();

  // ── Contact section ────────────────────────────────────────────
  const contactSection =
    p.businessType === "restaurant"
      ? `CONTACT/ORDER SECTION (id="contact"):
      IMPORTANT: Do NOT include an HTML form with input fields. This is a restaurant.
      Build an action-focused section with:
      - Large phone number as a <a href="tel:${p.phone || ""}"> link — "Call to Order" label, big and prominent
      - If research found real delivery platform URLs (DoorDash, UberEats, Grubhub, Seamless), display them as styled buttons with their real links. Never invent a delivery URL.
      - If research found a real reservation link (OpenTable, Resy), add a "Reserve a Table" button with that real link. If not found, use the phone number for reservations.
      - Hours displayed clearly
      - Full address with a "Get Directions" link: <a href="https://maps.google.com/?q=${mapsUrl}" target="_blank">
      - Catering inquiry form (name, email, message) ONLY if owner provided an email AND description mentions catering or events`
      : p.businessType === "retail"
      ? `CONTACT SECTION (id="contact"):
      Focus on getting people in the door:
      - Phone as <a href="tel:${p.phone || ""}"> — prominent, labeled "Give us a call"
      - Address with "Get Directions" link: <a href="https://maps.google.com/?q=${mapsUrl}" target="_blank">
      - Hours displayed clearly
      - If research found e-commerce or ordering links, include them
      - Simple contact form (name, message, send) ONLY if owner provided an email address`
      : (() => {
          const isAutoBody  = subType === "autobody";
          const isLegal     = subType === "legal";
          const isChildcare = subType === "childcare";
          const isFuneral   = subType === "funeralhome";
          const isCatering  = subType === "catering";
          const isChurch    = subType === "church";
          const isTutoring  = subType === "tutoring";

          const primaryCTA = isFuneral
            ? `- Prominent phone number available 24/7: <a href="tel:${p.phone || ""}">. Label: "We're here when you need us — available 24 hours"`
            : isChurch
            ? `- Service times displayed prominently. Address with "Get Directions" link. Phone number for pastoral inquiries.`
            : isCatering
            ? `- "Request a Quote" as the primary CTA — a simple form: event type, date, number of guests, contact info`
            : isAutoBody
            ? `- Large "Get a Free Estimate" button that links to tel:${p.phone || ""} — prominent and clear`
            : isLegal
            ? `- Large "Free Consultation" button that links to tel:${p.phone || ""}`
            : isChildcare || isTutoring
            ? `- Large "Schedule a Visit" or "Book a Free Assessment" button that links to tel:${p.phone || ""}`
            : `- If research found real booking platform URLs (Vagaro, StyleSeat, Booksy, Calendly, etc), make "Book Now" the hero CTA button with that real URL. Otherwise use the phone as the primary CTA.`;

          return `CONTACT/BOOKING SECTION (id="contact"):
      ${primaryCTA}
      - Phone as <a href="tel:${p.phone || ""}"> — prominent and clearly labeled
      - Address with "Get Directions" link: <a href="https://maps.google.com/?q=${mapsUrl}" target="_blank"> — only if walk-ins are relevant
      - Hours displayed clearly
      - Contact form (name, email, message, send) with netlify attribute — labeled appropriately for the business type
      - ${isAutoBody ? "Include insurance info section if credentials mention preferred shop status" : ""}`;
        })();

  // ── Research ───────────────────────────────────────────────────
  const researchQuery = `"${p.businessName}" ${p.city} ${
    p.businessType === "restaurant" ? `${subType} restaurant menu reviews`
    : p.businessType === "retail"   ? `${subType} store hours reviews`
    :                                  `${subType} ${p.industry || "business"} reviews`
  }`;

  console.log(`[${orderId}] Starting research (query: ${researchQuery})`);

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
          max_tokens: 4000,
          // FIX 3: Stricter system prompt to eliminate preamble
          system: "You are a business research tool. Output ONLY the structured data block below. Do not write any sentences before FOUND:. Do not summarize. Do not say 'Based on my research' or 'I searched for'. The very first characters of your response must be 'FOUND:'",
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{
            role: "user",
            content: `Search for "${p.businessName}" at ${p.address || ""} ${p.city || "New York"}. Your response must start with FOUND: — no preamble whatsoever.

FOUND: yes/no/partial
RATING: [e.g. "4.8 stars · 43 Google reviews" or "none found"]
REVIEWS: [2-3 real quotes as: "Quote text" — FirstName, Platform. Or "none found"]
ORDERING_LINKS: [real URLs only, or "n/a"]
BOOKING_LINKS: [real URLs only, or "n/a"]
PRESS: [coverage/awards or "none found"]
SOCIAL: [e.g. "@handle · 517 followers" or "none found"]
HISTORY: [founding year or notable history or "none found"]
HAS_WEBSITE: yes/no

Only verified facts. Never invent anything.`,
          }],
        }),
      });

      if (!researchRes.ok) {
        console.log(`[${orderId}] Research HTTP error: ${researchRes.status}`);
        return "";
      }

      const data = await researchRes.json();
      const rawText = data.content?.find(b => b.type === "text")?.text || "";

      // FIX 3: Slice to FOUND: marker to strip any model preamble
      const foundIdx = rawText.indexOf("FOUND:");
      const text = foundIdx >= 0 ? rawText.slice(foundIdx) : rawText;

      console.log(`[${orderId}] Research complete: ${text.slice(0, 150)}`);
      return text;
    } catch (e) {
      console.log(`[${orderId}] Research failed: ${e.message} — continuing without`);
      return "";
    }
  })();

  const researchFindings = await researchPromise;
  const noResearch = !researchFindings || researchFindings.includes("BUSINESS NOT FOUND ONLINE");

  const testimonialsInstruction =
    noResearch || !researchFindings.includes("REVIEWS:")
      ? "TESTIMONIALS: No verified reviews were found for this business. Do NOT invent testimonials. Do NOT include a testimonials section."
      : `TESTIMONIALS: Real customer reviews were found in the research data. Include a testimonials section between the about section and the contact section. Use ONLY the actual quotes found — verbatim, with attribution (first name + platform, e.g. "Maria G. — Google"). Style as large elegant pull quotes, not small cards. If fewer than 2 real quotes were found, skip this section.`;

  // ── System prompt ──────────────────────────────────────────────
  const systemPrompt = `You are a senior web designer at a boutique agency that builds bespoke websites for local small businesses. Your work is award-winning, distinctive, and makes business owners proud to share it.

ABSOLUTE RULES — these override everything else:
- Output raw HTML only. Start with <!DOCTYPE html>. No markdown, no code fences, no explanation.
- Never invent data. If a phone number, price, review, rating, URL, or hour was not provided or found in research, do not include it.
- Zero emoji anywhere. Use SVG icons or CSS elements only.
- Every site must be fully self-contained — all CSS and JS inline, zero external JS libraries.
- Never close the HTML prematurely. If running low on tokens, shorten copy — never skip sections or SEO tags. The very last characters must be </html>.

TECHNICAL STANDARDS (every generation):
- Mobile-first. Perfect at 375px portrait. Grid/flex adapts to 768px+ desktop.
- Fonts from: https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,600;1,400&display=swap
- html { scroll-behavior: smooth; }
- Two fonts max. 900 weight for display, 300-400 for body.
- 2 brand colors + 2 neutrals. Chosen deliberately. No generic blues or grays.
- Generous spacing. Every section visually distinct. Quality bar: $3,000–5,000 agency site.

SEO (every generation, no exceptions):
- <title>: "[Business Name] — [Industry] in [City]"
- <meta name="description">: 150–160 chars, business name + what they do + city + differentiator
- JSON-LD schema in <head>: specific @type (Restaurant, HairSalon, AutoRepair, etc), name, address, telephone, openingHours
- <h1> includes the city naturally
- City name appears 3–4 times throughout
- Every <img> has a descriptive alt tag with business name and city

ANIMATIONS (every generation):
- class="fade-up" on every major section (minimum 6). IntersectionObserver adds "visible". CSS: .fade-up{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s ease} .fade-up.visible{opacity:1;transform:none}
- Hero text: headline 0s delay, tagline 0.15s, CTA 0.3s
- Nav: transparent on hero, gains background + box-shadow at scrollY > 50
- All buttons/cards: hover with scale or shadow, 0.2s ease
- Stats/numbers: count-up animation on scroll

LOGO & BRANDING:
- If a LOGO URL is provided and ends in .svg: use it as an <img> tag in nav (height: 50-60px) and footer (height: 70px).
- If a LOGO URL is provided but is NOT an SVG (jpg/png/webp): display it in the nav and footer but also note that raster logos may appear blurry at small sizes. Use it anyway.
- Build the entire site color palette around the logo colors. The site must feel like it belongs to the same brand.
- If no logo is provided, use the business name as a styled text wordmark in the nav.

ICONS — CRITICAL. Every service card icon must be semantically correct. Use these SVG path descriptions as guidance:

AUTO BODY/COLLISION → car silhouette with crumple damage or wrench overlay
TOWING → tow truck with hook and chain
WINDOW TINTING → car window shape with diagonal gradient lines across it
PAINT/BODY WORK → spray paint gun or paint drip on car panel, NOT a pen nib
DRIVE-IN CLAIM → clipboard with checkmark or car entering a building

HAIR SALON → scissors (open, diagonal), or comb with curved handle
BARBERSHOP → straight razor or clippers, or the classic barber pole
NAIL SALON → nail polish bottle, or hand with painted nails
BRAIDING/LOCS → interlocking curved lines suggesting a braid pattern

CLEANING SERVICE → spray bottle, or mop and bucket
LAUNDROMAT → washing machine front-view with circular drum window
TAILORING → needle and thread, or thimble, or dress form silhouette

CHILDCARE/DAYCARE → two small figures (child) or abc blocks or a simple house with heart
TUTORING → open book, or pencil with graduation cap, or chalkboard

WELLNESS/MASSAGE → hands in massage position, or lotus flower outline
FITNESS/GYM → dumbbell
ACUPUNCTURE → simple needle lines radiating from a point

RESTAURANT/FOOD → fork and knife crossed, or plate with dome cover
BAKERY → layered cake or croissant outline
FOOD TRUCK → food truck side-view silhouette
CATERING → covered serving dish / cloche

FLORIST → single stem flower with leaves
FUNERAL HOME → simple lily or dove in flight — dignified, never a skull or coffin
CHURCH/WORSHIP → simple arch doorway or cross (tasteful, not heavy)

PHOTOGRAPHY → camera body with lens circle
VIDEOGRAPHY → film slate / clapperboard

PHARMACY/DRUG STORE → mortar and pestle, or Rx symbol
CORNER STORE/BODEGA → storefront awning with door
GROCERY → shopping basket or fresh produce (apple + leaf)
BEAUTY SUPPLY → lipstick tube or hand mirror

LAW OFFICE → scales of justice, or gavel
TAX/NOTARY → document with seal stamp, or calculator
IMMIGRATION → passport with globe

GENERAL RULE: If a service has a universal recognized symbol (scissors, gavel, camera), use it. Draw it cleanly in SVG — 3-8 path elements max. Never use a generic icon (circles, triangles, generic shapes) that doesn't communicate the service. A wrong icon erodes trust instantly.
1. <nav> — Fixed. Transparent on hero, solid on scroll. Logo/name left, links right, hamburger mobile. Closes on link click.
2. <section id="home"> — Hero. Full 100svh. Vibe-matched background. Bold display type. Staggered animation. One strong CTA.
3. [CONTENT SECTION — see brief]
4. <section id="about"> — Story. Human. Community connection explicit. Pull quote if origin story provided.
5. [TESTIMONIALS — only if verified reviews found]
6. [CONTACT SECTION — see brief]
7. <footer> — Name, tagline, nav links, phone, address, city. Warm closing line. Copyright.`;

  // ── FIX 2: Tighter color instruction in user prompt ────────────
  const colorInstruction = brandColor
    ? `PRIMARY BRAND COLOR (extracted from logo pixel data — use this exactly): ${brandColor}
COLOR RULES — non-negotiable:
- Use ${brandColor} as the primary accent color: all buttons, active states, highlights, borders, underlines
- Do NOT introduce any hue that is not derivable from ${brandColor} and warm/neutral tones
- Background: deep warm neutral or near-black that makes ${brandColor} pop
- Text: white or off-white on dark backgrounds; dark neutral on light sections
- A complementary secondary accent may be used sparingly — derive it by lightening ${brandColor} by 20% or darkening it by 30%, not by inventing a new hue
- If ${brandColor} is orange (hex r high, g medium, b low), do not render it as yellow or pink`
    : `COLOR RULES: Build a deliberate palette from scratch that matches the vibe. Two brand colors + two neutrals. No generic blues.`;

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
Hours: ${p.hours || ""}${p.instagram ? `\nInstagram: @${p.instagram.replace("@", "")}` : ""}
${logoUrl ? `\nLOGO: ${logoUrl}
${logoUrl.endsWith(".svg")
  ? `This is an SVG logo. Use it as <img src="${logoUrl}"> in the nav (height: 55px) and footer (height: 70px). Extract its colors and build the entire palette around them.`
  : `This is a raster logo (PNG/JPG).
NAV: Do NOT use the raster image in the nav — it will look blurry at small sizes. Instead, recreate the business name as a bold styled text wordmark in the nav using the brand color. Keep it clean and confident.
FOOTER: Display the logo image <img src="${logoUrl}"> at a larger size (120-160px wide) where it will look acceptable.`
}` : ""}

${colorInstruction}

ABOUT THIS BUSINESS:
${p.description || ""}
${p.differentiator ? `\nWhat makes them different: ${p.differentiator}` : ""}
${p.about ? `\nOrigin story: ${p.about}` : ""}

CONTENT FROM OWNER:
${p.typeSpecific || "(no additional content provided)"}

WRITING DIRECTION:
${p.ownerName    ? `- Use "${p.ownerName}" by name in the about section — personal, not corporate` : ""}
${p.foundedYear  ? `- Weave in the founding year naturally: "serving ${p.city || "the community"} since ${p.foundedYear}"` : ""}
${p.neighborhood ? `- Use the neighborhood (${p.neighborhood}) in the community section for hyper-local feel` : ""}
${p.differentiator ? `- Lead with the differentiator ("${p.differentiator}") in the hero or first visible section` : ""}
${p.instagram    ? `- Link @${p.instagram.replace("@", "")} in footer and contact section` : ""}

VIBE: "${p.vibe || "Warm, welcoming, community-first"}"
This is the most important design instruction. Let it drive every font and spacing decision.
Color is already locked above — do not deviate from those rules.
${p.subType === "funeralhome" ? "\nTONE OVERRIDE: Funeral home. Dignified, restrained, warm throughout. No bold animations, no aggressive CTAs. Families are grieving." : ""}
${p.subType === "church"     ? "\nLAYOUT OVERRIDE: House of worship. Section 3 is worship times + programs, not a services grid. Contact invites new visitors warmly." : ""}

LAYOUT ARCHETYPE:
${typeLayout}

PHOTOS:
${photoLayout}

RESEARCH FINDINGS:
${noResearch
  ? "Not found online. This is their internet debut. Do not reference any ratings, reviews, or platforms."
  : `${researchFindings}

Usage rules: quotes verbatim with attribution · URLs exactly as found, never invented · ratings prominently placed · press/awards mentioned · if existing site found, note this is an upgrade`}

${testimonialsInstruction}

CONTENT SECTION (section 3):
${typeContent}

CONTACT SECTION (section 6):
${contactSection}`;

  // ── HTML Generation ────────────────────────────────────────────
  try {
    console.log(`[${orderId}] Starting HTML generation`);

    const genRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 16000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!genRes.ok) {
      const errText = await genRes.text();
      console.error(`[${orderId}] Anthropic error:`, errText.slice(0, 300));
      return res.status(500).json({ error: `Anthropic error ${genRes.status}` });
    }

    const data = await genRes.json();
    let html = (data.content?.find(b => b.type === "text")?.text || "")
      .replace(/^```html?\n?/i, "")
      .replace(/\n?```$/m, "")
      .trim();

    // FIX 5: Truncation guard
    if (data.stop_reason === "max_tokens") {
      console.warn(`[${orderId}] Output truncated at max_tokens — attempting repair`);
      // Trim to last complete closing tag so the page isn't broken mid-element
      const lastFooter  = html.lastIndexOf("</footer>");
      const lastSection = html.lastIndexOf("</section>");
      const cutAt = lastFooter > lastSection ? lastFooter + 9 : lastSection + 10;
      if (cutAt > 1000) {
        html = html.slice(0, cutAt) + "\n</body>\n</html>";
        console.log(`[${orderId}] Repaired truncated HTML at char ${cutAt}`);
      }
    }

    console.log(`[${orderId}] Generation done. Tokens: ${data.usage?.output_tokens}, HTML: ${html.length} chars, stop: ${data.stop_reason}`);

    if (!html || html.length < 500) {
      return res.status(500).json({ error: "AI returned empty response" });
    }

    // ── FIX 4: Expanded validation + surgical patching ─────────
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
          max_tokens: 800,
          messages: [{
            role: "user",
            content: `You are a quality checker for a website generator. Review this HTML and check for invented data.

WHAT THE OWNER PROVIDED:
- Business name: ${p.businessName || ""}
- Phone: ${p.phone || "NONE PROVIDED"}
- Email: ${p.email || "NONE PROVIDED"}
- Address: ${p.address || "NONE PROVIDED"}
- Hours: ${p.hours || "NONE PROVIDED"}
- Prices: ${p.typeSpecific?.includes("price") ? "some prices provided" : "NO PRICES PROVIDED"}

VERIFIED RESEARCH DATA:
${researchFindings || "none"}

HTML TO CHECK (first 4000 chars):
${html.slice(0, 4000)}

Check for these specific issues:
1. PHONE: Does any phone number in the HTML differ from "${p.phone || "NONE"}"?
2. PRICES: Are dollar amounts shown that were not in owner content or research?
3. REVIEWS: Are review quotes shown that don't appear in the research data?
4. LINKS: Are delivery/booking URLs shown that look invented (not in research)?
5. HOURS: Do displayed hours differ from "${p.hours || "NONE PROVIDED"}"?
6. EMAIL: Does any email differ from "${p.email || "NONE"}"?
7. COLOR: If brand color is "${brandColor || "none"}", does the site look like it matches that color (not a completely different hue like pink when brand is orange)?

Respond with ONLY one of:
PASS
ISSUES: phone | prices | reviews | links | hours | email | color (list only the categories that have problems, pipe-separated)`,
          }],
        }),
      });

      if (validationRes.ok) {
        const valData  = await validationRes.json();
        const valResult = valData.content?.find(b => b.type === "text")?.text?.trim() || "PASS";
        console.log(`[${orderId}] Validation: ${valResult}`);

        if (valResult.startsWith("ISSUES:")) {
          const issues = valResult.replace("ISSUES:", "").split("|").map(s => s.trim().toLowerCase());
          console.warn(`[${orderId}] Patching issues: ${issues.join(", ")}`);

          // Patch JSON-LD schema fields
          if (issues.includes("prices")) {
            html = html.replace(/"priceRange"\s*:\s*"[^"]*"/g, '"priceRange": "Contact for pricing"');
          }
          if (issues.includes("hours") && !p.hours) {
            html = html.replace(/"openingHours"\s*:\s*(\[[^\]]*\]|"[^"]*")\s*,?/g, "");
          } else if (issues.includes("hours") && p.hours) {
            html = html.replace(/"openingHours"\s*:\s*(\[[^\]]*\]|"[^"]*")/g, `"openingHours": "${p.hours}"`);
          }
          if (issues.includes("phone") && p.phone) {
            html = html.replace(/"telephone"\s*:\s*"[^"]*"/g, `"telephone": "${p.phone}"`);
            // Also fix tel: links in the body
            html = html.replace(/href="tel:[^"]*"/g, `href="tel:${p.phone}"`);
          }
          if (issues.includes("email") && !p.email) {
            // Remove mailto: links if no email was provided
            html = html.replace(/<a\s+href="mailto:[^"]*"[^>]*>[^<]*<\/a>/gi, "");
          }
          if (issues.includes("links")) {
            // Remove DoorDash/UberEats/etc links that weren't in research
            const deliveryDomains = ["doordash.com", "ubereats.com", "grubhub.com", "seamless.com"];
            for (const domain of deliveryDomains) {
              if (!researchFindings.includes(domain)) {
                html = html.replace(new RegExp(`<a[^>]*href="https?://[^"]*${domain}[^"]*"[^>]*>.*?<\\/a>`, "gis"), "");
              }
            }
          }

          // FIX 4: Color patch — if color was flagged, inject a CSS override
          if (issues.includes("color") && brandColor) {
            console.log(`[${orderId}] Injecting color correction for ${brandColor}`);
            const colorOverride = `\n<style>
  /* Color correction override — brand color: ${brandColor} */
  :root { --brand: ${brandColor}; --brand-dark: color-mix(in srgb, ${brandColor} 70%, #000); }
  a, .btn-primary, button[type="submit"],
  [class*="btn"]:not([class*="secondary"]):not([class*="outline"]) {
    background-color: ${brandColor} !important;
    border-color: ${brandColor} !important;
  }
  h1 em, h2 em, .accent, .highlight, .brand-color { color: ${brandColor} !important; }
  .nav-link.active, nav a:hover { color: ${brandColor} !important; }
</style>`;
            // Inject before </head>
            html = html.replace("</head>", colorOverride + "\n</head>");
          }

          console.log(`[${orderId}] Patches applied`);
        }
      }
    } catch (e) {
      console.log(`[${orderId}] Validation pass failed: ${e.message} — continuing`);
    }

    const htmlB64  = Buffer.from(html, "utf8").toString("base64");
    const bizSlug  = (p.businessName || "website").toLowerCase().replace(/\s+/g, "-");

    // ── Save to Upstash (72hr TTL) ─────────────────────────────
    const upstashUrl   = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (upstashUrl && upstashToken) {
      try {
        const jobData = Buffer.from(JSON.stringify({
          htmlB64,
          businessName: p.businessName,
          city:         p.city,
          email:        p.email,
          packageId:    p.packageId,
          orderId,
        })).toString("base64");

        const upstashRes = await fetch(`${upstashUrl}/set/order:${orderId}?ex=259200`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${upstashToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ value: jobData }),
        });
        console.log(`[${orderId}] Upstash save: ${upstashRes.status}`);
      } catch (e) {
        console.error(`[${orderId}] Upstash save error:`, e.message);
      }
    }

    // ── Owner notification ─────────────────────────────────────
    const resendKey  = process.env.RESEND_API_KEY;
    const ownerEmail = process.env.OWNER_EMAIL;
    const fromEmail  = process.env.FROM_EMAIL || "BlockSite <hello@blocksitebuilder.com>";

    if (resendKey && ownerEmail) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to:   ownerEmail,
            subject: `[BlockSite] Preview — ${p.businessName || "Unknown"} · ${orderId}`,
            html: `<div style="font-family:sans-serif;padding:24px;max-width:700px">
              <h2 style="color:#1c1a14;margin:0 0 4px">New Preview Generated</h2>
              <p style="color:#666;margin:0 0 4px;font-size:14px">Customer has not paid yet. HTML attached.</p>
              <p style="color:#c4813a;font-size:13px;margin:0 0 20px">Upstash: order:${orderId} · 72hr TTL</p>
              <p style="color:#888;font-size:12px;margin:0 0 12px">Brand color extracted: <strong style="color:${brandColor || "#999"}">${brandColor || "none"}</strong></p>
              ${researchFindings
                ? `<div style="background:#f9f9f9;border-radius:8px;padding:14px;margin-bottom:20px;font-family:monospace;font-size:12px;white-space:pre-wrap;border:1px solid #e2ddd0">${researchFindings.slice(0, 600)}</div>`
                : `<p style="color:#999;font-style:italic;margin-bottom:20px">No research data found — new business.</p>`}
              <table style="font-size:14px;border-collapse:collapse;width:100%">
                ${[
                  ["Business", p.businessName],
                  ["Type",    typeLabel],
                  ["City",    p.city],
                  ["Phone",   p.phone],
                  ["Email",   p.email],
                  ["Address", p.address],
                  ["Hours",   p.hours],
                  ["Photos",  `${photoCount} uploaded`],
                  ["Package", p.packageId],
                  ["Vibe",    `"${p.vibe}"`],
                ].map(([k, v], i) =>
                  `<tr${i % 2 === 1 ? ' style="background:#f9f9f9"' : ""}><td style="padding:7px 8px;font-weight:bold;color:#666;width:110px">${k}</td><td style="padding:7px 8px">${v || "—"}</td></tr>`
                ).join("")}
              </table>
            </div>`,
            attachments: [{ filename: `${bizSlug}.html`, content: htmlB64 }],
          }),
        });
        console.log(`[${orderId}] Owner notification sent`);
      } catch (e) {
        console.error(`[${orderId}] Owner email error:`, e.message);
      }
    }

    return res.status(200).json({ htmlB64, orderId });

  } catch (err) {
    console.error(`[${orderId}] Generation failed:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}
