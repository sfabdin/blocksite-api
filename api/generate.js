// api/generate.js - Vercel serverless function
// Max duration: 300 seconds (set in vercel.json)
// v7 — two-pass generation (design system → HTML), research surfaced on site,
//       alpha-channel color fix, hue clustering, research preamble stripping,
//       expanded validation patching, truncation guard, JSON photo manifest

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

  // ── Shared fetch wrapper ───────────────────────────────────────
  async function callClaude({ model, system, messages, max_tokens, tools, beta }) {
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    };
    if (beta) headers["anthropic-beta"] = beta;
    const body = { model, max_tokens, messages };
    if (system) body.system = system;
    if (tools)  body.tools  = tools;
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers, body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }

  // ── Derived constants ──────────────────────────────────────────
  const typeLabel =
    p.businessType === "restaurant" ? "Restaurant / Food Business"
    : p.businessType === "retail"   ? "General Store / Retail"
    :                                  "Specialty Service Business";

  const mapsUrl = encodeURIComponent(
    `${p.businessName || ""} ${p.address || ""} ${p.city || ""}`.trim()
  );

  const photoUrls      = p.photoUrls || [];
  const photoCount     = p.photoCount || photoUrls.length || 0;
  const firstUrl       = photoUrls[0] || "";
  const isLogoFirst    = firstUrl.endsWith(".svg") || /logo|brand|icon/i.test(firstUrl);
  const logoUrl        = isLogoFirst ? firstUrl : null;
  const sitePhotos     = isLogoFirst ? photoUrls.slice(1) : photoUrls;
  const sitePhotoCount = isLogoFirst ? photoCount - 1 : photoCount;
  const subType        = p.subType || "other";

  // ── Brand color extraction (alpha-aware, hue-clustered) ────────
  let brandColor = null;
  if (logoUrl && !logoUrl.endsWith(".svg")) {
    try {
      const buf    = Buffer.from(await (await fetch(logoUrl)).arrayBuffer());
      const isPNG  = buf[0] === 0x89 && buf[1] === 0x50;
      const stride = isPNG ? 4 : 3;
      const step   = Math.max(stride, Math.floor(buf.length / (800 * stride)) * stride);
      const buckets = Array.from({ length: 36 }, () => ({ r: 0, g: 0, b: 0, score: 0 }));

      for (let i = 0; i < buf.length - stride + 1; i += step) {
        if (isPNG && buf[i + 3] < 128) continue; // skip transparent pixels
        const r = buf[i], g = buf[i + 1], b = buf[i + 2];
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const L = (max + min) / 2;
        if (L < 55 || L > 215) continue;
        const sat = max === 0 ? 0 : (max - min) / max;
        if (sat < 0.25) continue;
        const delta = max - min;
        let hue = 0;
        if (delta > 0) {
          hue = max === r ? 60 * (((g - b) / delta) % 6)
              : max === g ? 60 * (((b - r) / delta) + 2)
              :              60 * (((r - g) / delta) + 4);
          if (hue < 0) hue += 360;
        }
        const bi    = Math.floor(hue / 10) % 36;
        const score = sat * (0.7 + 0.3 * (1 - Math.abs(L - 140) / 140));
        buckets[bi].r     += r * score;
        buckets[bi].g     += g * score;
        buckets[bi].b     += b * score;
        buckets[bi].score += score;
      }

      // Merge adjacent hue buckets to handle hue spread
      const merged = buckets.map((bk, i) => {
        const pv = buckets[(i + 35) % 36], nx = buckets[(i + 1) % 36];
        return {
          r:     bk.r     + pv.r     * 0.5 + nx.r     * 0.5,
          g:     bk.g     + pv.g     * 0.5 + nx.g     * 0.5,
          b:     bk.b     + pv.b     * 0.5 + nx.b     * 0.5,
          score: bk.score + pv.score * 0.5 + nx.score * 0.5,
        };
      });

      const w = merged.reduce((best, cur) => cur.score > best.score ? cur : best, merged[0]);
      if (w.score > 0.5) {
        const hex = v => Math.round(v / w.score).toString(16).padStart(2, "0");
        brandColor = `#${hex(w.r)}${hex(w.g)}${hex(w.b)}`;
        console.log(`[${orderId}] Brand color: ${brandColor} (score ${w.score.toFixed(2)}, PNG: ${isPNG})`);
      }
    } catch (e) {
      console.log(`[${orderId}] Color extraction failed: ${e.message}`);
    }
  }

  // ── Photo manifest ─────────────────────────────────────────────
  const photoManifest = JSON.stringify({
    hero:    sitePhotos[0] || null,
    gallery: sitePhotos.slice(1, 4),
    total:   sitePhotoCount,
  });

  const photoLayout =
    sitePhotoCount === 0
      ? "ZERO PHOTOS: Bold typographic design. Large color blocks, oversized type, decorative CSS shapes. Must feel intentionally designed, not empty."
      : sitePhotos.length > 0
        ? `PHOTO MANIFEST (JSON — exact URLs, exact order, no substitutions):\n${photoManifest}\n\nRules:\n- hero → full-height background-image + dark overlay\n- gallery[0] → 50/50 editorial split in about section\n- gallery[1+] → asymmetric masonry, vary sizes\n- Never reuse hero URL in gallery`
        : sitePhotoCount === 1 ? "ONE PHOTO: HERO_PHOTO_PLACEHOLDER as hero background with dark overlay."
        : sitePhotoCount === 2 ? "TWO PHOTOS: HERO_PHOTO_PLACEHOLDER hero. PHOTO_1_PLACEHOLDER in 50/50 about split."
        : `${sitePhotoCount} PHOTOS: HERO_PHOTO_PLACEHOLDER hero. PHOTO_1 through PHOTO_${Math.min(sitePhotoCount, 4)} in asymmetric gallery.`;

  // ── Color instruction ──────────────────────────────────────────
  const colorInstruction = brandColor
    ? `PRIMARY BRAND COLOR (pixel-extracted from logo — use exactly): ${brandColor}
COLOR RULES — non-negotiable:
- ${brandColor} is the ONLY accent hue. Use it for all buttons, active nav, highlights, borders.
- Do NOT introduce any unrelated hue (no pinks, no blues, no purples unless ${brandColor} is in that family).
- Background: deep warm neutral or near-black that makes ${brandColor} pop.
- Secondary accent: derive only by lightening ${brandColor} 20% or darkening 30% — never invent a new hue.
- If ${brandColor} is orange (high R, medium G, low B): render it as orange, not yellow and not pink.`
    : `COLOR: Build a deliberate palette matching the vibe. Two brand colors + two neutrals. No generic blues.`;

  // ── Research (fires immediately, parallel with pass 1) ─────────
  console.log(`[${orderId}] Starting research`);
  const researchPromise = (async () => {
    try {
      const data = await callClaude({
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        beta: "web-search-2025-03-05",
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: "You are a business research tool. The very first characters of your response must be 'FOUND:'. No preamble. No intro sentences. Start with FOUND: immediately.",
        messages: [{
          role: "user",
          content: `Search for "${p.businessName}" at ${p.address || ""} ${p.city || "New York"}.
Start your response with FOUND: — nothing before it.

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
      });
      const raw = data.content?.find(b => b.type === "text")?.text || "";
      const idx = raw.indexOf("FOUND:");
      return idx >= 0 ? raw.slice(idx) : raw;
    } catch (e) {
      console.log(`[${orderId}] Research failed: ${e.message}`);
      return "";
    }
  })();

  // ── Parse research into a structured object ────────────────────
  function parseResearch(text) {
    if (!text) return null;
    const get = key => {
      const m = text.match(new RegExp(`${key}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, "si"));
      return m ? m[1].trim() : null;
    };
    const found = get("FOUND");
    if (!found || found.toLowerCase().startsWith("no")) return null;

    const reviewsRaw = get("REVIEWS");
    const reviews    = [];
    if (reviewsRaw && !reviewsRaw.toLowerCase().includes("none")) {
      for (const m of reviewsRaw.matchAll(/"([^"]+)"\s*[—–-]\s*([^\n,]+)/g)) {
        reviews.push({ quote: m[1].trim(), attribution: m[2].trim() });
      }
    }

    const rating        = get("RATING");
    const orderingLinks = get("ORDERING_LINKS");
    const bookingLinks  = get("BOOKING_LINKS");
    const press         = get("PRESS");
    const social        = get("SOCIAL");
    const history       = get("HISTORY");

    return {
      rating:        (rating        && !rating.toLowerCase().includes("none"))        ? rating        : null,
      reviews:       reviews.length >= 2 ? reviews : [],   // only surface if 2+ real quotes
      orderingLinks: (orderingLinks && orderingLinks !== "n/a")                       ? orderingLinks : null,
      bookingLinks:  (bookingLinks  && bookingLinks  !== "n/a")                       ? bookingLinks  : null,
      press:         (press         && !press.toLowerCase().includes("none"))         ? press         : null,
      social:        (social        && !social.toLowerCase().includes("none"))        ? social        : null,
      history:       (history       && !history.toLowerCase().includes("none"))       ? history       : null,
      raw: text,
    };
  }

  // ── Archetype helpers ──────────────────────────────────────────
  const typeLayout =
    p.businessType === "restaurant"
      ? subType === "bakery"     ? "BAKERY/CAFÉ: Warm, artisanal. Daily specials prominent. Neighborhood favorite."
        : subType === "foodTruck" ? "FOOD TRUCK: Bold, energetic. Schedule/locations section. Social prominent."
        :                           "RESTAURANT: Dark, moody, editorial. Cinematic hero. Menu typographic. Owner pull quote."
      : p.businessType === "retail"
      ? subType === "pharmacy"     ? "PHARMACY: Clean, trustworthy. Hours very prominent. Community anchor."
        : subType === "cornerStore" ? "BODEGA: Bold, neighborhood, always open. Specials prominent."
        :                             "RETAIL: Warm boutique. Bold specials cards. Community-rooted about."
      : ({
          autobody:    "AUTO BODY: Industrial confidence. Dark greys, bold accent. 'Get a Free Estimate' repeated.",
          salon:       "HAIR SALON: Warm luxury, editorial. Gallery prominent. Booking CTA repeated.",
          barbershop:  "BARBERSHOP: Classic cool, bold type, community energy. 'Walk in or book' dual CTA.",
          nailsalon:   "NAIL SALON: Clean, feminine, inviting. Soft palette + pop of color. Gallery prominent.",
          cleaning:    "CLEANING: Fresh, trustworthy. Sky blues/greens. 'Get a free quote' prominent.",
          childcare:   "CHILDCARE: Warm, bright, reassuring. Programs clear. 'Schedule a Tour' CTA.",
          tutoring:    "TUTORING: Focused, encouraging. Results emphasized. 'Book a Free Assessment' CTA.",
          wellness:    "WELLNESS: Calm, healing. Soft neutrals. Booking CTA prominent.",
          laundromat:  "LAUNDROMAT: Clean, simple, honest. Hours crystal clear. Community-rooted.",
          funeralhome: "FUNERAL HOME: Dignified, restrained, warm. NO bold animations. Phone always visible.",
          catering:    "CATERING: Celebratory, professional. Sample menus. Quote request CTA.",
          photography: "PHOTOGRAPHY: Portfolio-first, editorial. Gallery fills screen. Booking CTA.",
          tailoring:   "TAILORING: Crafted, old-world quality. Warm earth tones. Turnaround clear.",
          taxnotary:   "TAX/NOTARY: Trustworthy, community-rooted. Languages spoken prominent.",
          florist:     "FLORIST: Fresh, botanical. Deep greens. Same-day delivery/ordering prominent.",
          church:      "CHURCH: Welcoming, warm. Service times front and center. Open-door feel.",
          legal:       "LEGAL: Professional, trustworthy. Deep navy. 'Free Consultation' repeated.",
        }[subType] || "SERVICE: Professional, trustworthy, community-rooted. Services in clean cards.");

  const typeContent = (() => {
    if (p.businessType === "restaurant") return `MENU SECTION (id="menu"): Grouped by category, display serif headers, 3-4 items each. Price only if provided. ${subType === "catering" ? "'Request a Quote' CTA." : "Ordering or reservation CTA at bottom."}`;
    if (p.businessType === "retail")     return `SPECIALS SECTION (id="specials"): Bold deal cards. Price/savings prominent. One full-width hero deal before the grid.`;
    return ({
      autobody:    `SERVICES (id="services"): Collision Repair, Paint & Body, Oil Changes, Tires, Detailing. "Get a Free Estimate" CTA.`,
      salon:       `SERVICES (id="services"): Braids, Locs, Color, Kids, Special Occasions. Pricing if provided. Booking CTA.`,
      barbershop:  `SERVICES (id="services"): Fades, Lineups, Beard, Kids, Designs. Pricing if provided. "Walk In or Book" CTA.`,
      nailsalon:   `SERVICES (id="services"): Manicure, Pedicure, Acrylics, Gel, Nail Art. Pricing if provided. Walk-ins welcome.`,
      cleaning:    `SERVICES (id="services"): Residential, Deep Clean, Move-Out, Commercial, Airbnb. "Get a Free Quote" CTA.`,
      childcare:   `PROGRAMS (id="services"): Full-Day Care, After-School, Summer, Drop-In. Age ranges + hours. "Schedule a Tour" CTA.`,
      tutoring:    `SERVICES (id="services"): Math, Reading, SAT Prep, Regents, etc. "Book a Free Assessment" CTA.`,
      wellness:    `SERVICES (id="services"): Treatment cards with duration + pricing if provided. "Book Your Session" CTA.`,
      laundromat:  `SERVICES (id="services"): Self-Service, Wash & Fold, Dry Cleaning, Large Items. Pricing + hours prominent.`,
      funeralhome: `SERVICES (id="services"): Traditional Funeral, Cremation, Graveside, Memorial, Pre-Need. Warm, restrained tone.`,
      catering:    `MENU (id="menu"): Sample menus/cuisine types. Event types served. Quote request form.`,
      photography: `PORTFOLIO (id="portfolio"): Portraits, Weddings, Events, Commercial. "Book a Session" CTA.`,
      tailoring:   `SERVICES (id="services"): Hems, Alterations, Repairs, Custom, Wedding Dress. Turnaround + pricing if provided.`,
      taxnotary:   `SERVICES (id="services"): Tax Prep, ITIN, Notary, Immigration Forms, Bookkeeping. Languages if provided.`,
      florist:     `ARRANGEMENTS (id="services"): Everyday, Weddings, Funerals, Events, Custom. Phone or order CTA.`,
      church:      `WORSHIP (id="services"): Service times, first-time visitor info, ministries. "Join Us" CTA.`,
      legal:       `SERVICES (id="services"): Practice areas. "Free Consultation" CTA throughout.`,
    }[subType] || `SERVICES (id="services"): Clean cards with descriptions. Pricing if provided. Booking or contact CTA.`);
  })();

  const contactSection = p.businessType === "restaurant"
    ? `CONTACT/ORDER (id="contact"): NO HTML input form. Large tel: link labeled "Call to Order". Real delivery/reservation platform buttons only if found in research. Hours. Address + "Get Directions" → https://maps.google.com/?q=${mapsUrl}. Catering form only if email provided AND catering mentioned.`
    : p.businessType === "retail"
    ? `CONTACT (id="contact"): Phone tel: link "Give us a call". Address + "Get Directions" → https://maps.google.com/?q=${mapsUrl}. Hours. Contact form only if email provided.`
    : (() => {
        const cta =
          subType === "funeralhome" ? `24/7 tel: link labeled "We're here when you need us"`
          : subType === "church"    ? "Service times + address + phone for pastoral inquiries"
          : subType === "catering"  ? "Quote request form: event type, date, guest count, contact"
          : subType === "autobody"  ? `"Get a Free Estimate" button → tel:${p.phone || ""}`
          : subType === "legal"     ? `"Free Consultation" button → tel:${p.phone || ""}`
          : (subType === "childcare" || subType === "tutoring") ? `"Schedule a Visit / Book Assessment" → tel:${p.phone || ""}`
          : "Book Now → real booking URL from research if found, else phone";
        return `CONTACT/BOOKING (id="contact"): ${cta}. Phone tel: link. Address + "Get Directions" → https://maps.google.com/?q=${mapsUrl} if walk-ins relevant. Hours. Contact form (name, email, message). ${subType === "autobody" ? "Insurance info if preferred shop." : ""}`;
      })();

  // ════════════════════════════════════════════════════════════════
  // PASS 1 — Design System (Sonnet, ~3000 tokens)
  // Fires in parallel with research. Produces a <style> block with
  // CSS custom properties, typography, all component classes.
  // Pass 2 will inject this verbatim and only write HTML.
  // ════════════════════════════════════════════════════════════════
  console.log(`[${orderId}] Pass 1: design system (parallel with research)`);

  const pass1Promise = callClaude({
    model: "claude-sonnet-4-5",
    max_tokens: 3500,
    system: `You are a senior brand designer. Output ONLY a <style> block — raw CSS, no markdown, no explanation.
Start with <style> and end with </style>. Nothing else.
Design for local small businesses. Quality bar: boutique agency, $3-5k site.
Mobile-first. All sizing in rem/em/%. Borders and shadows may use px.`,
    messages: [{
      role: "user",
      content: `Design a complete CSS design system for:

Name: ${p.businessName}
Type: ${typeLabel} · ${subType}
Vibe: "${p.vibe || "Warm, welcoming, community-first"}"
${colorInstruction}
${logoUrl ? `Logo: ${logoUrl.endsWith(".svg") ? "SVG" : "raster PNG/JPG"}` : "No logo — text wordmark"}

Output a <style> block with these /* SECTION */ comment dividers:

/* FONTS */
Google Fonts @import for exactly 2 font families (choose from: Playfair Display, DM Sans, Fraunces, Lora).

/* TOKENS */
:root {
  --brand: [primary brand color];
  --brand-dark: [darkened 25%];
  --brand-light: [lightened 25%];
  --bg-primary: [page background];
  --bg-secondary: [alternate section bg];
  --bg-card: [card/panel bg];
  --text-primary: [main text];
  --text-secondary: [muted text];
  --text-on-brand: [text on brand-colored bg, usually white];
  --border: [subtle border];
  --shadow-sm: [small box-shadow];
  --shadow-md: [medium box-shadow];
  --radius: [default border-radius 4-12px];
  --radius-lg: [large border-radius];
  --font-display: [display font name];
  --font-body: [body font name];
  --space-xs:.25rem; --space-sm:.5rem; --space-md:1rem; --space-lg:1.5rem; --space-xl:2.5rem; --space-2xl:4rem;
  --section-pad: 5rem 1.25rem;
  --container: 1200px;
}

/* RESET */
*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
html { scroll-behavior:smooth; }
body { font-family:var(--font-body),sans-serif; color:var(--text-primary); background:var(--bg-primary); line-height:1.6; }
img { max-width:100%; display:block; }
a { color:inherit; text-decoration:none; }

/* TYPOGRAPHY */
h1,h2,h3,h4 { font-family:var(--font-display),serif; line-height:1.15; }
h1 { font-size:clamp(2.5rem,6vw,5rem); font-weight:900; letter-spacing:-.02em; }
h2 { font-size:clamp(1.8rem,4vw,3rem); font-weight:700; }
h3 { font-size:clamp(1.2rem,2.5vw,1.75rem); font-weight:700; }
.eyebrow { font-family:var(--font-body),sans-serif; font-size:.8rem; font-weight:600; letter-spacing:.15em; text-transform:uppercase; color:var(--brand); display:block; margin-bottom:.5rem; }
.display-xl { font-size:clamp(3rem,8vw,6.5rem); font-weight:900; letter-spacing:-.03em; line-height:1; }
.lead { font-size:clamp(1.05rem,2vw,1.25rem); line-height:1.7; color:var(--text-secondary); }

/* NAV */
nav { position:fixed; top:0; left:0; right:0; z-index:100; padding:.875rem 1.25rem; transition:background .3s,box-shadow .3s; }
nav.scrolled { background:var(--bg-primary); box-shadow:0 2px 20px rgba(0,0,0,.08); }
.nav-inner { max-width:var(--container); margin:auto; display:flex; align-items:center; justify-content:space-between; }
.nav-logo { font-family:var(--font-display),serif; font-weight:800; font-size:1.25rem; color:var(--brand); }
.nav-links { display:flex; gap:2rem; align-items:center; }
.nav-link { font-size:.9rem; font-weight:500; color:var(--text-primary); transition:color .2s; }
.nav-link:hover { color:var(--brand); }
.nav-cta { background:var(--brand); color:var(--text-on-brand); padding:.5rem 1.25rem; border-radius:999px; font-size:.875rem; font-weight:600; transition:background .2s,transform .2s; }
.nav-cta:hover { background:var(--brand-dark); transform:scale(1.03); }
.hamburger { display:none; flex-direction:column; gap:5px; cursor:pointer; background:none; border:none; padding:.25rem; }
.hamburger span { display:block; width:24px; height:2px; background:var(--text-primary); border-radius:2px; transition:transform .3s,opacity .3s; }
.mobile-menu { display:none; position:fixed; inset:0; background:var(--bg-primary); z-index:99; flex-direction:column; align-items:center; justify-content:center; gap:2rem; }
.mobile-menu.open { display:flex; }
.mobile-menu a { font-family:var(--font-display),serif; font-size:2rem; font-weight:700; color:var(--text-primary); }
.mobile-menu a:hover { color:var(--brand); }

/* BUTTONS */
.btn-primary { display:inline-flex; align-items:center; gap:.5rem; background:var(--brand); color:var(--text-on-brand); padding:.875rem 2rem; border-radius:var(--radius); font-weight:600; font-size:1rem; border:2px solid var(--brand); cursor:pointer; transition:background .2s,transform .2s,box-shadow .2s; }
.btn-primary:hover { background:var(--brand-dark); border-color:var(--brand-dark); transform:scale(1.02); box-shadow:var(--shadow-md); }
.btn-secondary { display:inline-flex; align-items:center; gap:.5rem; background:transparent; color:var(--brand); padding:.875rem 2rem; border-radius:var(--radius); font-weight:600; font-size:1rem; border:2px solid var(--brand); cursor:pointer; transition:background .2s,color .2s,transform .2s; }
.btn-secondary:hover { background:var(--brand); color:var(--text-on-brand); transform:scale(1.02); }
.btn-ghost { background:none; border:none; color:var(--text-on-brand); font-weight:500; cursor:pointer; text-decoration:underline; opacity:.8; transition:opacity .2s; }
.btn-ghost:hover { opacity:1; }

/* HERO */
.hero { position:relative; min-height:100svh; display:flex; align-items:center; overflow:hidden; }
.hero-bg { position:absolute; inset:0; background-size:cover; background-position:center; }
.hero-overlay { position:absolute; inset:0; background:linear-gradient(135deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,.4) 100%); }
.hero-content { position:relative; z-index:1; max-width:var(--container); margin:auto; padding:6rem 1.25rem 4rem; }
.hero h1,.hero .display-xl { color:#fff; }
.hero .tagline { color:rgba(255,255,255,.85); margin:1rem 0 2rem; }
.hero-ctas { display:flex; gap:1rem; flex-wrap:wrap; }
.rating-badge { display:inline-flex; align-items:center; gap:.4rem; background:var(--brand); color:var(--text-on-brand); padding:.3rem .9rem; border-radius:999px; font-weight:700; font-size:.875rem; margin-top:1rem; }
.rating-badge .star { color:#fff; }

/* PROOF BAR */
.proof-bar { background:var(--bg-secondary); padding:1.25rem var(--space-md); border-bottom:1px solid var(--border); }
.proof-bar-inner { max-width:var(--container); margin:auto; display:flex; gap:2.5rem; align-items:center; flex-wrap:wrap; justify-content:center; }
.proof-item { display:flex; align-items:center; gap:.5rem; font-size:.9rem; color:var(--text-secondary); }
.proof-number { font-size:1.4rem; font-weight:800; color:var(--brand); line-height:1; }

/* LAYOUT HELPERS */
.container { max-width:var(--container); margin:auto; padding:0 1.25rem; }
section { padding:var(--section-pad); }
.section-alt { background:var(--bg-secondary); }
.section-dark { background:#0f0e0c; color:#fff; }
.section-dark .lead,.section-dark .eyebrow { color:rgba(255,255,255,.7); }
.section-header { margin-bottom:3rem; }
.grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:2rem; align-items:center; }
.grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:1.5rem; }
.grid-auto { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:1.5rem; }

/* CARDS */
.card { background:var(--bg-card); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); overflow:hidden; transition:box-shadow .25s,transform .25s; }
.card:hover { box-shadow:var(--shadow-md); transform:translateY(-3px); }
.card-body { padding:1.5rem; }
.service-icon { width:56px; height:56px; border-radius:var(--radius); background:color-mix(in srgb,var(--brand) 12%,transparent); display:flex; align-items:center; justify-content:center; margin-bottom:1rem; }
.service-icon svg { width:28px; height:28px; stroke:var(--brand); fill:none; stroke-width:1.75; stroke-linecap:round; stroke-linejoin:round; }

/* TESTIMONIALS */
.testimonials { padding:var(--section-pad); background:var(--bg-secondary); }
.testimonial-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:2rem; margin-top:2.5rem; }
.testimonial-card { background:var(--bg-card); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:2rem; }
.quote-mark { font-size:4rem; line-height:0; display:block; margin-bottom:.75rem; color:var(--brand); font-family:var(--font-display),serif; }
.testimonial-text { font-style:italic; line-height:1.75; color:var(--text-primary); font-size:1.05rem; }
.testimonial-author { margin-top:1.25rem; font-weight:600; font-size:.875rem; color:var(--text-secondary); }

/* ABOUT */
.pull-quote { font-size:1.3rem; font-style:italic; line-height:1.6; border-left:4px solid var(--brand); padding-left:1.5rem; margin:2rem 0; color:var(--text-primary); }
.press-mention { display:inline-flex; align-items:center; gap:.5rem; font-size:.875rem; font-weight:600; color:var(--text-secondary); margin-top:1rem; }

/* GALLERY */
.gallery-grid { display:grid; grid-template-columns:2fr 1fr 1fr; gap:.75rem; }
.gallery-item { overflow:hidden; border-radius:var(--radius); }
.gallery-item:first-child { grid-row:span 2; }
.gallery-img { width:100%; height:100%; object-fit:cover; transition:transform .4s; }
.gallery-item:hover .gallery-img { transform:scale(1.04); }

/* CONTACT */
.contact-grid { display:grid; grid-template-columns:1fr 1.2fr; gap:3rem; align-items:start; }
.contact-info-item { display:flex; gap:1rem; margin-bottom:1.75rem; align-items:flex-start; }
.contact-icon { width:44px; height:44px; min-width:44px; border-radius:50%; background:color-mix(in srgb,var(--brand) 12%,transparent); display:flex; align-items:center; justify-content:center; }
.contact-icon svg { width:20px; height:20px; stroke:var(--brand); fill:none; stroke-width:1.75; stroke-linecap:round; }
.contact-form { background:var(--bg-card); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:2rem; }
.form-group { margin-bottom:1.25rem; }
.form-group label { display:block; font-size:.875rem; font-weight:600; margin-bottom:.4rem; color:var(--text-secondary); }
input,textarea,select { width:100%; padding:.75rem 1rem; border:1.5px solid var(--border); border-radius:var(--radius); background:var(--bg-primary); color:var(--text-primary); font-family:var(--font-body),sans-serif; font-size:1rem; transition:border-color .2s; }
input:focus,textarea:focus,select:focus { outline:none; border-color:var(--brand); }
textarea { resize:vertical; min-height:120px; }
.form-submit { width:100%; margin-top:.5rem; }
.hours-grid { display:grid; grid-template-columns:auto 1fr; gap:.5rem 1.5rem; font-size:.9rem; }
.hours-grid .day { font-weight:600; }
.map-link { display:inline-flex; align-items:center; gap:.4rem; color:var(--brand); font-weight:500; }
.map-link:hover { text-decoration:underline; }
.platform-btn { display:inline-flex; align-items:center; gap:.5rem; padding:.6rem 1.25rem; border:2px solid var(--border); border-radius:999px; font-weight:600; font-size:.875rem; transition:border-color .2s,background .2s; margin:.25rem; }
.platform-btn:hover { border-color:var(--brand); background:color-mix(in srgb,var(--brand) 8%,transparent); }

/* FOOTER */
footer { background:var(--bg-primary); border-top:1px solid var(--border); padding:4rem 1.25rem 2rem; }
.footer-inner { max-width:var(--container); margin:auto; display:grid; grid-template-columns:2fr 1fr 1fr; gap:3rem; margin-bottom:2.5rem; }
.footer-brand .nav-logo { font-size:1.5rem; margin-bottom:.75rem; }
.footer-tagline { font-style:italic; color:var(--text-secondary); font-size:.9rem; margin-bottom:1rem; }
.footer-links h4 { font-size:.8rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--text-secondary); margin-bottom:1rem; }
.footer-links a { display:block; color:var(--text-secondary); font-size:.9rem; margin-bottom:.5rem; transition:color .2s; }
.footer-links a:hover { color:var(--brand); }
.footer-bottom { max-width:var(--container); margin:auto; border-top:1px solid var(--border); padding-top:1.5rem; display:flex; justify-content:space-between; align-items:center; color:var(--text-secondary); font-size:.8rem; flex-wrap:wrap; gap:.5rem; }

/* ANIMATIONS */
.fade-up { opacity:0; transform:translateY(24px); transition:opacity .6s ease,transform .6s ease; }
.fade-up.visible { opacity:1; transform:none; }
.stagger-1 { transition-delay:.1s; } .stagger-2 { transition-delay:.2s; } .stagger-3 { transition-delay:.3s; } .stagger-4 { transition-delay:.4s; }
@media (prefers-reduced-motion:reduce) { .fade-up { opacity:1; transform:none; } }

/* RESPONSIVE */
@media (max-width:768px) {
  .nav-links { display:none; }
  .hamburger { display:flex; }
  .grid-2,.grid-3,.contact-grid { grid-template-columns:1fr; }
  .gallery-grid { grid-template-columns:1fr 1fr; }
  .gallery-item:first-child { grid-column:span 2; grid-row:span 1; }
  .footer-inner { grid-template-columns:1fr; gap:2rem; }
  .hero-ctas { flex-direction:column; }
  .proof-bar-inner { gap:1.5rem; justify-content:flex-start; }
}`,
    }],
  });

  // ── Await research + pass 1 in parallel ───────────────────────
  const [researchRaw, pass1Data] = await Promise.all([researchPromise, pass1Promise]);

  const researchFindings = researchRaw;
  const research         = parseResearch(researchFindings);
  const noResearch       = !research;

  console.log(`[${orderId}] Research: ${research ? "found" : "not found"} | Reviews: ${research?.reviews?.length || 0} | Rating: ${research?.rating || "none"} | Press: ${research?.press || "none"}`);

  // Extract design system CSS
  let designSystem = (pass1Data.content?.find(b => b.type === "text")?.text || "")
    .replace(/^```(?:css|html)?\n?/im, "").replace(/\n?```$/m, "").trim();
  if (!designSystem.startsWith("<style>")) designSystem = `<style>\n${designSystem}`;
  if (!designSystem.endsWith("</style>")) designSystem = `${designSystem}\n</style>`;

  console.log(`[${orderId}] Pass 1 done. Design system: ${designSystem.length} chars`);

  // ════════════════════════════════════════════════════════════════
  // Build research display block for Pass 2
  // Explicit HTML examples so research DEFINITELY shows on site.
  // ════════════════════════════════════════════════════════════════
  const researchBlock = (() => {
    if (!research) {
      return `RESEARCH: Business not found online — this is their internet debut.
- Do NOT invent ratings, reviews, or platform links.
- Do NOT include a testimonials section.
- Do NOT include a social proof bar.`;
    }

    const lines = [`RESEARCH FOUND — you MUST surface all of the following on the site. This is real verified data:`];

    if (research.rating) {
      lines.push(`
RATING: ${research.rating}
Display this in TWO places:
1. Hero section, directly below the tagline:
   <div class="rating-badge"><span class="star">★</span> ${research.rating}</div>
2. Proof bar (.proof-bar) immediately after the hero section:
   <div class="proof-bar"><div class="proof-bar-inner"><div class="proof-item"><span class="proof-number">★ ${research.rating}</span><span>on Google</span></div></div></div>`);
    }

    if (research.reviews.length >= 2) {
      lines.push(`
TESTIMONIALS SECTION — REQUIRED. Include <section id="testimonials" class="testimonials fade-up"> between the about section and the contact section.
Use ONLY these exact quotes, verbatim, with exact attribution:
${research.reviews.map((r, i) => `  Quote ${i + 1}: "${r.quote}" — ${r.attribution}`).join("\n")}

Required HTML structure:
<section id="testimonials" class="testimonials fade-up">
  <div class="container">
    <p class="eyebrow">What People Say</p>
    <h2>Real Reviews</h2>
    <div class="testimonial-grid">
      ${research.reviews.map(r => `<div class="testimonial-card">
        <span class="quote-mark">"</span>
        <p class="testimonial-text">${r.quote}</p>
        <p class="testimonial-author">— ${r.attribution}</p>
      </div>`).join("\n      ")}
    </div>
  </div>
</section>`);
    } else {
      lines.push(`TESTIMONIALS: Fewer than 2 verified quotes — do NOT include a testimonials section. Do NOT invent quotes.`);
    }

    if (research.press) {
      lines.push(`
PRESS/AWARDS: "${research.press}"
Mention in the about section as a credibility signal:
<p class="press-mention">✦ Featured: ${research.press}</p>`);
    }

    if (research.social) {
      lines.push(`
SOCIAL: ${research.social}
Show in footer + contact:
<a href="https://instagram.com/${p.instagram?.replace("@","") || ""}" class="social-link">${research.social}</a>`);
    }

    if (research.history) {
      lines.push(`HISTORY: "${research.history}" — weave naturally into the about section copy.`);
    }

    if (research.orderingLinks) {
      lines.push(`ORDERING LINKS: ${research.orderingLinks}
Add as .platform-btn buttons in the contact/order section. Use exact URLs from research.`);
    }

    if (research.bookingLinks) {
      lines.push(`BOOKING LINKS: ${research.bookingLinks}
Make the primary CTA button in the contact/booking section link to this URL.`);
    }

    return lines.join("\n");
  })();

  // ════════════════════════════════════════════════════════════════
  // PASS 2 — HTML Generation (Opus, ~12000 tokens)
  // Design decisions are LOCKED by the injected design system.
  // This pass only writes semantic HTML using the CSS classes above.
  // ════════════════════════════════════════════════════════════════
  const pass2System = `You are a senior front-end developer. The design system (CSS) is already written and injected — use its classes exactly as defined.
Your only job: write semantic, accessible HTML that correctly uses those classes.

ABSOLUTE RULES:
- Output raw HTML only. Start with <!DOCTYPE html>. No markdown, no fences, no explanation.
- The very last characters must be </html>. Never truncate early — shorten copy first if needed.
- Never invent data (phone, price, review, URL, hours) not in the brief or research.
- Zero emoji. SVG icons only.
- All CSS is in the injected <style> block — do not write any additional CSS.
- One <script> tag at end of body for all JS.
- Zero external JS libraries.

INLINE JS (one <script> at end of <body>):
1. IntersectionObserver: document.querySelectorAll('.fade-up').forEach(el=>{new IntersectionObserver(([e])=>{if(e.isIntersecting){e.target.classList.add('visible')}},{threshold:.15}).observe(el)})
2. Nav scroll: window.addEventListener('scroll',()=>document.querySelector('nav').classList.toggle('scrolled',scrollY>50))
3. Hamburger: wire .hamburger button to toggle .mobile-menu.open and aria-expanded
4. Mobile menu: close on any link click inside .mobile-menu
5. Count-up: only if .count-up elements exist in the page`;

  const pass2User = `BUILD THIS SITE using the design system classes. Write HTML only.

── BUSINESS ─────────────────────────────────────────────
Name: ${p.businessName || "Local Business"}
Owner: ${p.ownerName || "the owner"}
Type: ${typeLabel} (${subType})
${p.foundedYear  ? `Founded: Est. ${p.foundedYear}` : ""}
${p.tagline      ? `Tagline: ${p.tagline}` : ""}
City: ${p.city || "our community"}${p.neighborhood ? ` · ${p.neighborhood}` : ""}
Address: ${p.address || ""}
Phone: ${p.phone || ""}
${p.email        ? `Email: ${p.email}` : ""}
Hours: ${p.hours || ""}
${p.instagram    ? `Instagram: @${p.instagram.replace("@","")}` : ""}

── LOGO ──────────────────────────────────────────────────
${logoUrl
  ? logoUrl.endsWith(".svg")
    ? `SVG logo: <img src="${logoUrl}" alt="${p.businessName} logo" style="height:55px"> in nav + <img src="${logoUrl}" alt="${p.businessName} logo" style="height:70px"> in footer`
    : `Raster logo: footer only → <img src="${logoUrl}" alt="${p.businessName} logo" style="width:140px">
Nav: text wordmark "${p.businessName}" with class="nav-logo"`
  : `No logo. Nav: <a href="#home" class="nav-logo">${p.businessName}</a>`}

── COLORS ────────────────────────────────────────────────
${colorInstruction}
The design system :root already has --brand set correctly. Do not override CSS variables.

── VIBE ──────────────────────────────────────────────────
"${p.vibe || "Warm, welcoming, community-first"}"
${subType === "funeralhome" ? "TONE: Dignified, restrained, warm. No energetic CTAs. Families are grieving." : ""}
${subType === "church"      ? "LAYOUT: Section 3 = worship times + programs. Contact warmly invites new visitors." : ""}

── LAYOUT ────────────────────────────────────────────────
${typeLayout}

── ABOUT ─────────────────────────────────────────────────
${p.description || ""}
${p.differentiator ? `Differentiator (lead with this in hero or first section): ${p.differentiator}` : ""}
${p.about          ? `Origin story: ${p.about}` : ""}
${p.ownerName      ? `Use "${p.ownerName}" by name in about — personal, not corporate.` : ""}
${p.foundedYear    ? `Weave in "serving ${p.city||"the community"} since ${p.foundedYear}" naturally.` : ""}
${p.neighborhood   ? `Use "${p.neighborhood}" for hyper-local feel.` : ""}

── OWNER CONTENT ────────────────────────────────────────
${p.typeSpecific || "(none provided)"}

── PHOTOS ───────────────────────────────────────────────
${photoLayout}

── RESEARCH & SOCIAL PROOF ──────────────────────────────
${researchBlock}

── CONTENT SECTION (section 3) ─────────────────────────
${typeContent}

── CONTACT SECTION ──────────────────────────────────────
${contactSection}

── SEO ──────────────────────────────────────────────────
<title>: "${p.businessName} — ${p.industry || typeLabel} in ${p.city || "New York"}"
<meta name="description">: 150-160 chars, business name + service + city + differentiator
JSON-LD in <head>: @type ${p.businessType === "restaurant" ? "Restaurant" : p.businessType === "retail" ? "Store" : "LocalBusiness"}, name, address, telephone${p.hours ? ", openingHours" : ""}
<h1> includes city naturally. City name appears 3-4× total.
Every <img> has descriptive alt with business name and city.

── SECTION ORDER ────────────────────────────────────────
1. <head> with title, meta, JSON-LD, viewport, charset, and THIS EXACT style block injected verbatim
2. <nav>
3. <section id="home"> hero${research?.rating ? ` — MUST include <div class="rating-badge">★ ${research.rating}</div> below tagline` : ""}
4. ${research?.rating ? `<div class="proof-bar"> with rating` : "<!-- no proof bar — no verified rating -->"}
5. Content section (services/menu/specials)
6. <section id="about">
7. ${research?.reviews?.length >= 2 ? `<section id="testimonials"> ← REQUIRED, use exact quotes from research` : "<!-- no testimonials — fewer than 2 verified reviews -->"}
8. Contact section
9. <footer>
10. <script> (all JS)

── INJECT THIS STYLE BLOCK VERBATIM INTO <head> ─────────
${designSystem}`;

  console.log(`[${orderId}] Pass 2: HTML generation`);

  const pass2Data = await callClaude({
    model: "claude-opus-4-5",
    max_tokens: 14000,
    system: pass2System,
    messages: [{ role: "user", content: pass2User }],
  });

  let html = (pass2Data.content?.find(b => b.type === "text")?.text || "")
    .replace(/^```html?\n?/i, "").replace(/\n?```$/m, "").trim();

  // Truncation guard
  if (pass2Data.stop_reason === "max_tokens") {
    console.warn(`[${orderId}] Pass 2 truncated — repairing`);
    const lf  = html.lastIndexOf("</footer>");
    const ls  = html.lastIndexOf("</section>");
    const cut = lf > ls ? lf + 9 : ls + 10;
    if (cut > 1000) html = html.slice(0, cut) + "\n</body>\n</html>";
  }

  console.log(`[${orderId}] Pass 2 done. HTML: ${html.length} chars, stop: ${pass2Data.stop_reason}`);

  if (!html || html.length < 500) {
    return res.status(500).json({ error: "AI returned empty response" });
  }

  // ── Validation + surgical patching ────────────────────────────
  try {
    const valData = await callClaude({
      model: "claude-sonnet-4-5",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `Quality-check this website HTML for invented data and missing research.

OWNER PROVIDED:
- Phone: ${p.phone || "NONE"}
- Email: ${p.email || "NONE"}
- Hours: ${p.hours || "NONE"}
- Prices: ${p.typeSpecific?.includes("price") ? "some provided" : "NONE"}

VERIFIED RESEARCH:
${researchFindings || "none"}

HTML (first 4000 chars): ${html.slice(0, 4000)}

Check:
1. PHONE — any number differing from "${p.phone || "NONE"}"?
2. PRICES — dollar amounts not in owner content or research?
3. REVIEWS — quotes not in research data?
4. LINKS — delivery/booking URLs not found in research?
5. HOURS — hours differing from "${p.hours || "NONE"}"?
6. EMAIL — email differing from "${p.email || "NONE"}"?
7. COLOR — brand is "${brandColor || "none"}". Is the site a completely wrong hue (e.g. pink when brand is orange)?
8. RESEARCH_MISSING — rating "${research?.rating || "none"}" NOT visible in HTML? OR verified testimonials missing?

Respond ONLY:
PASS
or
ISSUES: [pipe-separated list of failing categories from: phone | prices | reviews | links | hours | email | color | research_missing]`,
      }],
    });

    const valResult = valData.content?.find(b => b.type === "text")?.text?.trim() || "PASS";
    console.log(`[${orderId}] Validation: ${valResult}`);

    if (valResult.startsWith("ISSUES:")) {
      const issues = valResult.replace("ISSUES:", "").split("|").map(s => s.trim().toLowerCase());
      console.warn(`[${orderId}] Patching: ${issues.join(", ")}`);

      if (issues.includes("prices"))
        html = html.replace(/"priceRange"\s*:\s*"[^"]*"/g, '"priceRange": "Contact for pricing"');

      if (issues.includes("hours") && !p.hours)
        html = html.replace(/"openingHours"\s*:\s*(\[[^\]]*\]|"[^"]*")\s*,?/g, "");
      else if (issues.includes("hours") && p.hours)
        html = html.replace(/"openingHours"\s*:\s*(\[[^\]]*\]|"[^"]*")/g, `"openingHours": "${p.hours}"`);

      if (issues.includes("phone") && p.phone) {
        html = html.replace(/"telephone"\s*:\s*"[^"]*"/g, `"telephone": "${p.phone}"`);
        html = html.replace(/href="tel:[^"]*"/g, `href="tel:${p.phone}"`);
      }

      if (issues.includes("email") && !p.email)
        html = html.replace(/<a\s+href="mailto:[^"]*"[^>]*>[^<]*<\/a>/gi, "");

      if (issues.includes("links")) {
        for (const d of ["doordash.com","ubereats.com","grubhub.com","seamless.com"]) {
          if (!researchFindings?.includes(d))
            html = html.replace(new RegExp(`<a[^>]*href="https?://[^"]*${d}[^"]*"[^>]*>.*?<\\/a>`,"gis"), "");
        }
      }

      if (issues.includes("color") && brandColor) {
        html = html.replace("</head>", `<style>
/* Brand color correction override */
:root{--brand:${brandColor};--brand-dark:color-mix(in srgb,${brandColor} 72%,#000);--brand-light:color-mix(in srgb,${brandColor} 70%,#fff)}
.btn-primary,.nav-cta,.rating-badge{background:${brandColor}!important;border-color:${brandColor}!important}
.btn-primary:hover,.nav-cta:hover{background:color-mix(in srgb,${brandColor} 72%,#000)!important}
.eyebrow,.proof-number,.map-link,.nav-logo{color:${brandColor}!important}
.btn-secondary{color:${brandColor}!important;border-color:${brandColor}!important}
.service-icon,.contact-icon{background:color-mix(in srgb,${brandColor} 12%,transparent)!important}
.service-icon svg,.contact-icon svg{stroke:${brandColor}!important}
input:focus,textarea:focus{border-color:${brandColor}!important}
</style>\n</head>`);
      }

      // Research missing — inject fallback HTML directly
      if (issues.includes("research_missing") && research) {
        if (research.rating && !html.includes(research.rating)) {
          console.log(`[${orderId}] Injecting missing rating badge`);
          html = html.replace(
            /(<\/h1>)/i,
            `$1\n<div class="rating-badge" style="display:inline-flex;align-items:center;gap:.4rem;background:var(--brand,${brandColor||"#c87927"});color:#fff;padding:.3rem .9rem;border-radius:999px;font-weight:700;font-size:.875rem;margin-top:1rem">★ ${research.rating}</div>`
          );
        }

        if (research.reviews.length >= 2 && !html.includes("testimonial-card")) {
          console.log(`[${orderId}] Injecting missing testimonials section`);
          const testimonialsHtml = `
<section id="testimonials" style="padding:5rem 1.25rem;background:var(--bg-secondary,#f7f5f0)">
  <div style="max-width:1200px;margin:auto;padding:0 1.25rem">
    <p style="font-size:.8rem;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:var(--brand,${brandColor||"#c87927"});margin-bottom:.5rem">What People Say</p>
    <h2 style="font-size:clamp(1.8rem,4vw,3rem);margin-bottom:2.5rem">Real Reviews</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:2rem">
      ${research.reviews.map(r => `
      <div style="background:var(--bg-card,#fff);border-radius:12px;box-shadow:0 2px 16px rgba(0,0,0,.07);padding:2rem">
        <span style="font-size:4rem;line-height:0;display:block;margin-bottom:.75rem;color:var(--brand,${brandColor||"#c87927"})">"</span>
        <p style="font-style:italic;line-height:1.75;margin-bottom:1.25rem">${r.quote}</p>
        <p style="font-weight:600;font-size:.875rem;color:var(--text-secondary,#666)">— ${r.attribution}</p>
      </div>`).join("")}
    </div>
  </div>
</section>`;
          const insertAt = html.indexOf(`id="contact"`) > -1
            ? Math.max(0, html.indexOf(`id="contact"`) - 20)
            : html.lastIndexOf("<footer");
          if (insertAt > 0)
            html = html.slice(0, insertAt) + testimonialsHtml + "\n" + html.slice(insertAt);
        }
      }
    }
  } catch (e) {
    console.log(`[${orderId}] Validation failed: ${e.message} — continuing`);
  }

  // ── Deliver ───────────────────────────────────────────────────
  const htmlB64 = Buffer.from(html, "utf8").toString("base64");
  const bizSlug = (p.businessName || "website").toLowerCase().replace(/\s+/g, "-");

  // Upstash
  const upstashUrl   = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) {
    try {
      const payload = Buffer.from(JSON.stringify({
        htmlB64, businessName: p.businessName, city: p.city,
        email: p.email, packageId: p.packageId, orderId,
      })).toString("base64");
      await fetch(`${upstashUrl}/set/order:${orderId}?ex=259200`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${upstashToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ value: payload }),
      });
      console.log(`[${orderId}] Upstash saved`);
    } catch (e) { console.error(`[${orderId}] Upstash error: ${e.message}`); }
  }

  // Owner email
  const resendKey  = process.env.RESEND_API_KEY;
  const ownerEmail = process.env.OWNER_EMAIL;
  const fromEmail  = process.env.FROM_EMAIL || "BlockSite <hello@blocksitebuilder.com>";
  if (resendKey && ownerEmail) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: fromEmail, to: ownerEmail,
          subject: `[BlockSite] Preview — ${p.businessName || "Unknown"} · ${orderId}`,
          html: `<div style="font-family:sans-serif;padding:24px;max-width:700px">
            <h2 style="color:#1c1a14;margin:0 0 4px">New Preview Generated</h2>
            <p style="color:#666;font-size:14px;margin:0 0 4px">Customer has not paid yet.</p>
            <p style="color:#c4813a;font-size:13px;margin:0 0 8px">Upstash: order:${orderId} · 72hr TTL</p>
            <p style="font-size:12px;color:#888;margin:0 0 20px">
              Brand color: <strong style="color:${brandColor||"#999"}">${brandColor||"none"}</strong> ·
              Rating: <strong>${research?.rating||"none"}</strong> ·
              Reviews: <strong>${research?.reviews?.length||0}</strong> ·
              Press: <strong>${research?.press||"none"}</strong>
            </p>
            ${researchFindings
              ? `<div style="background:#f9f9f9;border-radius:8px;padding:14px;margin-bottom:20px;font-family:monospace;font-size:12px;white-space:pre-wrap;border:1px solid #e2ddd0">${researchFindings.slice(0,600)}</div>`
              : `<p style="color:#999;font-style:italic;margin-bottom:20px">No research found — new business.</p>`}
            <table style="font-size:14px;border-collapse:collapse;width:100%">
              ${[["Business",p.businessName],["Type",typeLabel],["City",p.city],["Phone",p.phone],
                 ["Email",p.email],["Address",p.address],["Hours",p.hours],
                 ["Photos",`${photoCount} uploaded`],["Package",p.packageId],["Vibe",`"${p.vibe}"`]]
                .map(([k,v],i)=>`<tr${i%2===1?' style="background:#f9f9f9"':''}><td style="padding:7px 8px;font-weight:bold;color:#666;width:110px">${k}</td><td style="padding:7px 8px">${v||"—"}</td></tr>`)
                .join("")}
            </table>
          </div>`,
          attachments: [{ filename: `${bizSlug}.html`, content: htmlB64 }],
        }),
      });
      console.log(`[${orderId}] Owner email sent`);
    } catch (e) { console.error(`[${orderId}] Email error: ${e.message}`); }
  }

  return res.status(200).json({ htmlB64, orderId });
}
