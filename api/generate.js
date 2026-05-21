// api/generate.js - Vercel Edge Runtime, streaming
// v8 — app/generator alignment, quality directives, DATA_CONFIDENCE gating
// CHANGES FROM v7:
//  G. User prompt: explicit SUBTYPE DIRECTIVE block — model no longer infers from metadata line
//  H. Brand color: hex + name + description injected (not just hex) — better complementary choices
//  I. Vibe quality: low-word-count vibe gets a fallback expansion hint in the prompt
//  J. System prompt: HERO COPY RULES block — specific headlines required, generic banned
//  K. System prompt: FOOTER CLOSING LINE standard — no generic closers allowed
//  L. User prompt: structured hours hint — visible text vs JSON-LD format guidance
//  M. Research pass 2: DATA_CONFIDENCE field added; generation prompt gates trust badges on confidence
//  +. Instagram @-stripping hardened: replace(/^@+/, "") instead of replace("@", "")
//  +. Photo URL mismatch: logged when hosted photo count < total uploaded count
//  13. Validation: fake booking URL check added + surgical fix applied
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

  // CHANGE v8 +: Log mismatch between what the app uploaded and what arrived as hosted URLs.
  // If blob upload failed for any photo it silently falls to base64 and gets filtered out in the app.
  // This lets us spot the pattern in logs without breaking anything.
  const totalUploadedCount = p.photoCount || 0;
  if (totalUploadedCount > photoUrls.length) {
    console.log(`[${orderId}] Photo mismatch: app reported ${totalUploadedCount} uploaded, only ${photoUrls.length} hosted URLs received. ${totalUploadedCount - photoUrls.length} likely fell back to base64 and were dropped.`);
  }

  // CHANGE v8 H: Color name+description lookup — injected alongside hex so model makes better complementary choices.
  // Mirrors the COLOR_SWATCHES array in the app exactly.
  const COLOR_META = {
    "#c87927": "Warm amber — classic neighborhood energy",
    "#d4501a": "Brick orange — bold, confident, strong",
    "#b83232": "Deep red — rich, powerful, passionate",
    "#8b2e2e": "Burgundy — dignified, warm, refined",
    "#c44569": "Rose — warm, feminine, inviting",
    "#9b59b6": "Purple — creative, luxurious, bold",
    "#2c3e8c": "Deep navy — trustworthy, professional",
    "#1a6b8a": "Ocean blue — clean, calm, coastal",
    "#2980b9": "Bright blue — fresh, modern, open",
    "#16a085": "Teal — fresh, balanced, healing",
    "#27ae60": "Forest green — natural, growth, community",
    "#3a6e4f": "Deep green — trustworthy, grounded",
    "#7d6b4f": "Mocha — warm, cozy, approachable",
    "#5d4037": "Espresso — rich, grounded, artisan",
    "#546e7a": "Slate — modern, calm, professional",
    "#37474f": "Charcoal — bold, industrial, strong",
    "#e91e8c": "Hot pink — vibrant, energetic, fun",
    "#ff7043": "Coral — warm, friendly, lively",
    "#f4c430": "Gold — celebratory, premium",
    "#6d4c9e": "Violet — spiritual, creative, unique",
  };
  // Resolve final brand color: user-selected swatch takes priority over logo extraction
  const resolvedBrandColor = p.brandColor || brandColor || null;
  const resolvedBrandColorLabel = resolvedBrandColor
    ? (COLOR_META[resolvedBrandColor.toLowerCase()] || resolvedBrandColor)
    : null;

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
            // CHANGE v7 #1: haiku handles tool use fine; no reasoning needed here. 5000→1800 tokens (faster, cheaper)
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1800,
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
                // CHANGE v7 #2: structured extraction only — haiku excels at this, no creativity needed
                model: "claude-haiku-4-5-20251001",
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
DATA_CONFIDENCE: high (4+ real fields found, not "none found") / medium (2-3 real fields) / low (0-1 real fields or FOUND: no)

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

      // CHANGE v8 M: Extract DATA_CONFIDENCE level to gate trust badge placement in generation
      const dataConfidence = researchFindings.match(/DATA_CONFIDENCE:\s*(high|medium|low)/i)?.[1]?.toLowerCase() || "low";
      const trustBadgeInstruction = dataConfidence === "high"
        ? "TRUST BADGE: Display rating prominently in hero as a styled pill near the CTA. Also reference in about section."
        : dataConfidence === "medium"
        ? "TRUST BADGE: Display rating in the about section only — not in the hero. Don't feature it prominently."
        : "TRUST BADGE: Omit entirely. Do not display any rating, review count, or trust badge — confidence in the data is too low.";
      console.log(`[${orderId}] DATA_CONFIDENCE: ${dataConfidence}`);

      // ── STEP 2: Build prompts ────────────────────────────────
      send({ type: "status", message: "Building your site..." });
  // CHANGE v8 J, K, M: System prompt additions — HERO COPY RULES, FOOTER CLOSING LINE, trust badge gating
  const systemPrompt = `You are a senior web designer at a boutique agency. Your work is award-winning, distinctive, and makes business owners proud to share it.

OUTPUT CONTRACT:
- First line of output: <!DOCTYPE html>
- Last line of output: </html>
- No content after </html>
- No markdown fences, no backticks, no explanation — raw HTML only, always

ABSOLUTE RULES:
- Never invent data. Phone, price, review, rating, URL, hours — if not provided or found in research, omit it.
- Zero emoji anywhere. SVG icons or CSS only.
- Fully self-contained — all CSS and JS inline, zero external JS libraries.
- If approaching token limit: complete the current section cleanly, close all open tags, and end the document properly. A complete shorter site beats a truncated long one. Never output broken HTML.
- PHOTOS: Every single uploaded photo URL provided must appear in the HTML as either a background-image or <img> tag. If 6 photos are provided, all 6 must be on the site. Never omit a provided photo.
- IMAGES: All <img> tags below the fold must include loading="lazy". Only the hero background-image is eager-loaded.
- ACCESSIBILITY: All images need descriptive alt text — never empty alt="". Minimum 4.5:1 color contrast for body text. All interactive elements need :focus-visible styles.

ICONS — every service card icon must match the service. This governs all sections before layout decisions are made:
Auto body/collision → car with damage or wrench. Towing → tow truck. Window tinting → car window with gradient.
Paint → spray gun. Salon → scissors. Barbershop → straight razor. Nail → polish bottle.
Cleaning → spray bottle. Laundromat → washing machine. Childcare → child figure or blocks.
Tutoring → open book. Wellness → lotus or hands. Restaurant → fork+knife. Bakery → layered cake.
Food truck → truck silhouette. Florist → flower stem. Pharmacy → mortar+pestle. Bodega → storefront awning.
Law → scales of justice. Tax/Notary → document+stamp. Church → arch or cross. Photography → camera.
RULE: Draw clean SVG — 3-8 path elements. Never use a generic shape that doesn't represent the service.

TECHNICAL:
- Mobile-first. Perfect at 375px. Adapts to 768px+ desktop.
- Fonts: https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,600;1,400&display=swap
- Font pairing: Choose ONE display font and ONE body font from the loaded stack. Assign them as CSS variables --font-display and --font-body. Use ONLY those two variables throughout. Never reference a third font.
- 2 brand colors + 2 neutrals. Chosen deliberately. No generic blues or grays unless specified.
- Generous spacing. Every section visually distinct. Quality bar: $3,000–5,000 agency site.
- Smooth scroll, fade-up animations on scroll via IntersectionObserver, hover states on all interactive elements.
- JSON-LD schema: LocalBusiness (or subtype). Only include fields with verified data.
- meta description, og:title, og:description, canonical URL using business name slug.

LOGO & BRANDING:
- SVG logo provided → use as <img> in nav (height:55px) and footer (height:70px). Extract its colors.
- Raster logo (PNG/JPG) provided → nav gets bold CSS text wordmark in brand color. Footer gets <img> at 140px wide.
- No logo → styled text wordmark in nav.
- Build entire palette around the logo/brand color. Site must feel like the same brand.

NAV RULES — these exact CSS rules must appear in every site's stylesheet:
@media (min-width: 769px) { .mobile-menu, .hamburger, .menu-toggle { display: none !important; } }
@media (max-width: 768px) { .desktop-links, .nav-links { display: none !important; } }
Never show both desktop links AND hamburger at the same time. Never render two nav bars.
Nav starts semi-transparent dark (never fully transparent — always readable). Becomes solid on scroll.

HERO COPY RULES:
- The hero headline must be specific to this business — never generic.
- BANNED headlines: "Welcome to [Name]", "Your Trusted Local [Type]", "Quality You Can Trust", "Serving the Community", "[Type] You Can Rely On", "Your [City] [Type] Expert".
- REQUIRED: The headline names a feeling, a neighborhood, a year, or the differentiator. Examples:
  "The Fade That Fits the Block." / "Fresh Bread Since 6am, Every Morning." / "Serving Flatbush Since 2009 — Every Regular Knows Us." / "Same Hands. Same Block. Forty Years."
- If a differentiator is provided in the brief, the headline or subheadline must reference it directly.
- Subheadline: one sentence maximum. Grounded and human — not a tagline.

FOOTER CLOSING LINE:
- Must be place-specific and human. Written as if the owner typed it themselves.
- BANNED closers: "Thank you for visiting", "We look forward to serving you", "Your satisfaction is our priority", "We appreciate your business", "Come see us soon".
- REQUIRED: Something warm and local. Examples:
  "Still on the same block. Still doing honest work." / "Open late. Always here when you need us." / "The neighborhood keeps us going — thank you." / "From our family to yours."
- Copyright line: © [current year] [Business Name]. All rights reserved.

RESEARCH USAGE — when research findings are provided in the brief, follow these rules:
- REVIEWS: Use as large pull quotes in a testimonials section AND weave 1-2 short phrases naturally into hero or about copy.
- SOCIAL: Display follower count as social proof. Link in nav, hero, footer.
- HISTORY: Lead with it in hero, about, and footer.
- PRESS/AWARDS: Display as a trust badge between sections.
- ORDERING/BOOKING LINKS: Wire real URLs into CTA buttons. CRITICAL: Use the specific business page URL, never a platform homepage (e.g. never just vagaro.com or getsquire.com with no path — if only homepage found, use phone number as CTA instead).
- "none found" fields → skip entirely. Never invent. Use everything found aggressively.
- Research-sourced content should make up ~30% of visible page content when available.
- TRUST BADGE PLACEMENT: Follow the instruction in the brief exactly — it is set based on data confidence.

ATTRIBUTION (required on every site, no exceptions):
Add this as the very last element before </body>, after the footer:
<div style="text-align:center;padding:10px;font-family:sans-serif;font-size:11px;color:#999;background:#f9f9f9;border-top:1px solid #eee">
  Built by <a href="https://blocksitebuilder.com" target="_blank" rel="noopener" style="color:#c4813a;text-decoration:none;font-weight:600">BLOCKSite</a>
</div>

SECTIONS (in order):
1. <nav> Fixed. See NAV RULES above.
2. <section id="home"> Hero. 100svh. Vibe-matched. Bold display type. Staggered animation. One strong CTA. See HERO COPY RULES.
3. [CONTENT SECTION — defined in brief]
4. <section id="about"> Story. Human. Community connection explicit. Pull quote if origin story provided.
5. [TESTIMONIALS — only if verified reviews found in research. Omit entirely if not.]
6. [CONTACT SECTION — defined in brief]
7. <footer> Name, tagline, nav links, phone, address. See FOOTER CLOSING LINE rules. Copyright.`;

  // CHANGE v8 I: Build vibe quality fallback — if owner typed fewer than 6 words, add a prompt hint
  const vibeText = p.vibe || "Warm, welcoming, community-first";
  const vibeIsVague = vibeText.trim().split(/\s+/).length < 6;
  const vibePromptText = vibeIsVague
    ? `"${vibeText}" — NOTE: This vibe description is brief. Interpret it generously: consider the business type (${subType}), neighborhood, and owner story to infer a full aesthetic direction. Make bold, specific choices the owner will recognize as right.`
    : `"${vibeText}"`;

  // CHANGE v8 L: Hours format hint — helps model use correct visible text AND JSON-LD format
  const hoursFormatHint = p.hours
    ? `${p.hours}\n  (Use exactly as written in visible text. For JSON-LD openingHours, convert to schema.org format, e.g. "Mo-Fr 09:00-18:00 Sa 10:00-16:00".)`
    : "Not provided — omit from JSON-LD openingHours.";

  // CHANGE v8 +: Instagram handle — strip all leading @ symbols before injecting
  const instagramHandle = p.instagram ? p.instagram.replace(/^@+/, "") : "";

  const userPrompt = `BUSINESS BRIEF:
Name: ${p.businessName || "Local Business"}
Owner: ${p.ownerName || "the owner"}
Type: ${typeLabel}
Industry: ${p.industry || ""}
Founded: ${p.foundedYear ? `Est. ${p.foundedYear}` : ""}
Tagline: ${p.tagline || ""}
City: ${p.city || "our community"}${p.neighborhood ? ` · ${p.neighborhood}` : ""}
Address: ${p.address || ""}
Phone: ${p.phone || ""}${p.email ? ` · Email: ${p.email}` : ""}
Hours: ${hoursFormatHint}${instagramHandle ? `\nInstagram: @${instagramHandle}` : ""}
${logoUrl ? `\nLOGO: ${logoUrl}
${logoUrl.endsWith(".svg")
  ? `SVG logo. Use as <img> in nav and footer. Extract colors and build palette around them.`
  : `Raster logo. Nav: bold text wordmark in brand color. Footer: <img src="${logoUrl}" style="width:140px" alt="${p.businessName || "Business"} logo">.`
}` : ""}

${/* CHANGE v8 H: Brand color with name+description, not just hex */
resolvedBrandColorLabel
  ? `BRAND COLOR: ${resolvedBrandColor} — ${resolvedBrandColorLabel}. Use as the dominant accent throughout — buttons, headings, accents, hover states. Build the entire palette around it and its natural complements.`
  : ""}

DESCRIPTION: ${p.description || ""}
DIFFERENTIATOR: ${p.differentiator || ""}
ORIGIN STORY: ${p.about || ""}
TYPE-SPECIFIC: ${p.typeSpecific || ""}

${/* CHANGE v8 G: Explicit SUBTYPE DIRECTIVE — model now gets an unambiguous design signal, not just metadata */
`SUBTYPE DIRECTIVE: ${subType.toUpperCase()}
This is the primary signal for layout archetype, icon selection, tone, and color mood.
All design decisions should align with the ${subType} business type.`}

WRITING DIRECTION:
${p.ownerName ? `- Use "${p.ownerName}" by name in about section` : ""}
${p.foundedYear ? `- Weave in "serving ${p.city || "the community"} since ${p.foundedYear}"` : ""}
${p.neighborhood ? `- Use "${p.neighborhood}" for hyper-local feel` : ""}
${p.differentiator ? `- HERO: The headline or subheadline must reference this differentiator directly: "${p.differentiator}"` : ""}
${instagramHandle ? `- Link @${instagramHandle} in footer and contact` : ""}

VIBE: ${vibePromptText}
This drives every color, font, and spacing decision. Do not override with generic defaults.
${p.subType === "funeralhome" ? "\nTONE OVERRIDE: Funeral home. Dignified, restrained. No bold animations, no aggressive CTAs." : ""}
${p.subType === "church" ? "\nLAYOUT OVERRIDE: Section 3 is worship times + programs. Contact section invites warmly." : ""}

LAYOUT ARCHETYPE:
${typeLayout}

PHOTOS:
${photoLayout}
${sitePhotos.length > 1 ? `\nPHOTO VERIFICATION: Before closing </body>, confirm all ${sitePhotos.length} photo URLs above appear in the HTML as <img> or background-image. If any are missing, add them to the gallery section before closing.` : ""}

RESEARCH FINDINGS:
${noResearch
  ? "Not found online. This is their internet debut. Do not reference ratings, reviews, or platforms. Omit all trust badges."
  : researchFindings}

${/* CHANGE v8 M: Trust badge placement is now conditional on DATA_CONFIDENCE, not always "hero" */
noResearch ? "" : trustBadgeInstruction}

${!noResearch && researchFindings.includes("REVIEWS:") && !researchFindings.includes("REVIEWS: none")
  ? "\nTESTIMONIALS: Required. Use verified reviews above as large elegant pull quotes. First name + platform attribution. Place between about and contact sections."
  : "\nTESTIMONIALS: Omit entirely — no verified reviews available."}

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
          model: "claude-opus-4-7", // CHANGE v7 #3: latest flagship — best HTML/CSS quality, strongest coding evals
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
            // CHANGE v7 #4: haiku for validation — it's a checklist task, not a reasoning task
            model: "claude-haiku-4-5-20251001",
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

Check for:
1. Wrong phone number
2. Invented prices (not provided by owner or found in research)
3. Invented reviews not present in research data
4. Wrong hours
5. Wrong email
6. Booking/ordering CTA buttons pointing to a platform homepage with no path (e.g. vagaro.com, getsquire.com, toasttab.com with no business-specific path after the domain) — these should use the phone number instead

Reply ONLY with: PASS or ISSUES: [short description of each problem found]` }],
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
            // CHANGE v7 #13: fix fake booking URLs — replace platform homepages with tel: CTA
            if (valResult.toLowerCase().includes("booking") && p.phone) {
              fullHtml = fullHtml.replace(
                /href="https?:\/\/(vagaro|getsquire|booksy|fresha|squire|mindbodyonline|toasttab|yelp|opentable)\.com\/?"/gi,
                `href="tel:${p.phone}"`
              );
              console.log(`[${orderId}] Fake booking URL replaced with tel: CTA`);
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
