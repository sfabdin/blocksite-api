// api/generate.js - Vercel serverless function
// Max duration: 300 seconds (set in vercel.json)
// v8 — three-pass architecture:
//   Pass 0 (Haiku,  parallel): content plan JSON — services, icons, sections, palette, layout
//   Pass 1 (Sonnet, parallel): design system CSS + SVG symbol library keyed to Pass 0
//   Pass 2 (Opus):             HTML using exact class names + SVG symbols from Pass 0/1
//   Validation (Sonnet):       surgical patch pass

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  const p       = req.body;
  const orderId = `BS-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  console.log(`[${orderId}] v8 generating: ${p.businessName}, photos: ${p.photoCount || 0}`);

  // ── Shared Claude wrapper ──────────────────────────────────────
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
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 300)}`);
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
  // Only runs when a real logo is detected. Result feeds Pass 0.
  let extractedColor = null;
  if (logoUrl && !logoUrl.endsWith(".svg")) {
    try {
      const buf    = Buffer.from(await (await fetch(logoUrl)).arrayBuffer());
      const isPNG  = buf[0] === 0x89 && buf[1] === 0x50;
      const stride = isPNG ? 4 : 3;
      const step   = Math.max(stride, Math.floor(buf.length / (800 * stride)) * stride);
      const buckets = Array.from({ length: 36 }, () => ({ r: 0, g: 0, b: 0, score: 0 }));

      for (let i = 0; i < buf.length - stride + 1; i += step) {
        if (isPNG && buf[i + 3] < 128) continue;
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
        buckets[bi].r += r * score; buckets[bi].g += g * score;
        buckets[bi].b += b * score; buckets[bi].score += score;
      }
      const merged = buckets.map((bk, i) => {
        const pv = buckets[(i + 35) % 36], nx = buckets[(i + 1) % 36];
        return { r: bk.r + pv.r * .5 + nx.r * .5, g: bk.g + pv.g * .5 + nx.g * .5,
                 b: bk.b + pv.b * .5 + nx.b * .5, score: bk.score + pv.score * .5 + nx.score * .5 };
      });
      const w = merged.reduce((best, cur) => cur.score > best.score ? cur : best, merged[0]);
      if (w.score > 0.5) {
        const hex = v => Math.round(v / w.score).toString(16).padStart(2, "0");
        extractedColor = `#${hex(w.r)}${hex(w.g)}${hex(w.b)}`;
        console.log(`[${orderId}] Extracted color: ${extractedColor} (PNG: ${isPNG})`);
      }
    } catch (e) { console.log(`[${orderId}] Color extraction failed: ${e.message}`); }
  }

  // Owner-provided color always wins (from intake form field p.brandColor)
  const confirmedColor = p.brandColor || extractedColor || null;

  // ── Research (fires immediately) ───────────────────────────────
  console.log(`[${orderId}] Firing Pass 0 + research in parallel`);

  const researchPromise = (async () => {
    try {
      const data = await callClaude({
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        beta: "web-search-2025-03-05",
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: "Business research tool. First characters of response must be 'FOUND:'. No preamble.",
        messages: [{
          role: "user",
          content: `Search for "${p.businessName}" at ${p.address || ""} ${p.city || "New York"}.
Start with FOUND: immediately — no preamble.

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

  // ════════════════════════════════════════════════════════════════
  // PASS 0 — Content Plan (Haiku, ~600 tokens)
  // Fires in parallel with research. Produces a JSON blueprint that
  // locks every structural decision before Pass 1 and Pass 2 run.
  // Neither downstream pass infers structure from prose anymore.
  // ════════════════════════════════════════════════════════════════
  const pass0Promise = (async () => {
    try {
      const data = await callClaude({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        system: `You are a content planning tool for a local business website generator.
Output ONLY valid JSON — no markdown fences, no explanation, no preamble.
The JSON must be parseable by JSON.parse() with no modifications.`,
        messages: [{
          role: "user",
          content: `Create a content plan for this business:

Name: ${p.businessName}
Type: ${typeLabel} · subType: ${subType}
City: ${p.city || "New York"}
Vibe: "${p.vibe || "Warm, welcoming, community-first"}"
Description: ${p.description || ""}
Owner content: ${p.typeSpecific || ""}
Photos available: ${sitePhotoCount} site photos + ${logoUrl ? "1 logo" : "no logo"}
Confirmed brand color: ${confirmedColor || "none — choose by archetype"}
Founded: ${p.foundedYear || "unknown"}

Output this exact JSON shape (fill in all values, no nulls for arrays):

{
  "heroHeadline": "short punchy headline, 4-7 words",
  "heroTagline": "one sentence, 12-18 words, specific to this business",
  "palette": {
    "accent": "hex color — use confirmedColor if provided, else choose deliberately by archetype. Auto body = charcoal+orange-red. Salon = warm gold or rose. Pharmacy = trust blue. Restaurant = deep red or warm amber. Church = deep burgundy or navy. Law = deep navy. Nail salon = soft blush or teal. Never default to generic blue unless type demands it.",
    "background": "hex — dark near-black for industrial/moody types, warm off-white for soft types",
    "isDark": true or false
  },
  "sections": ["hero", then section ids in order — choose from: services, menu, specials, portfolio, worship, programs, about, testimonials, contact],
  "contentSection": {
    "id": "services|menu|specials|portfolio|worship|programs",
    "heading": "section heading",
    "items": [
      {
        "name": "service/item name",
        "icon": "one of: car-damage | spray-gun | tow-truck | car-window-tint | car-restoration | clipboard-check | scissors | comb | razor | nail-polish | spray-bottle | washing-machine | needle-thread | abc-blocks | open-book | lotus | dumbbell | fork-knife | cake | food-truck | serving-dish | flower | dove | arch-door | camera | mortar-pestle | storefront | shopping-basket | scales | document-stamp | passport | clock | shield | phone | pin | star | check-circle | quote",
        "desc": "one sentence description"
      }
    ]
  },
  "contactLayout": {
    "primaryCTA": { "label": "CTA label", "type": "tel|url|anchor", "value": "${p.phone || "#contact"}" },
    "infoItems": [
      { "icon": "phone|pin|clock|shield|mail|globe", "label": "label", "value": "display value", "link": "href value or null" }
    ],
    "showForm": true or false,
    "formLabel": "Send us a message | Request a Quote | Get a Free Assessment | etc"
  },
  "footer": {
    "tagline": "short brand tagline",
    "columns": ["brand", "links", "contact"]
  },
  "navLinks": ["Services|Menu|Specials|Portfolio|Worship|Programs", "About", "Contact"],
  "logoTreatment": "${logoUrl ? (logoUrl.endsWith(".svg") ? "svg-both" : "raster-footer-only") : "wordmark"}",
  "photoLayout": {
    "hero": "${sitePhotos[0] || null}",
    "about": "${sitePhotos[1] || null}",
    "gallery": ${JSON.stringify(sitePhotos.slice(2, 4))}
  }
}`,
        }],
      });
      const raw  = data.content?.find(b => b.type === "text")?.text || "{}";
      const clean = raw.replace(/^```(?:json)?\n?/im, "").replace(/\n?```$/m, "").trim();
      const plan  = JSON.parse(clean);
      console.log(`[${orderId}] Pass 0 done. Accent: ${plan.palette?.accent}, Services: ${plan.contentSection?.items?.length}`);
      return plan;
    } catch (e) {
      console.log(`[${orderId}] Pass 0 failed: ${e.message} — using fallback`);
      // Fallback plan so the pipeline never breaks
      return {
        heroHeadline: p.tagline || p.businessName,
        heroTagline:  `${typeLabel} serving ${p.city || "the community"}.`,
        palette: { accent: confirmedColor || "#c87927", background: "#1a1816", isDark: true },
        sections: ["hero", "services", "about", "contact"],
        contentSection: {
          id: "services", heading: "What We Offer",
          items: [{ name: "Our Services", icon: "check-circle", desc: "Quality service you can trust." }],
        },
        contactLayout: {
          primaryCTA: { label: "Call Us", type: "tel", value: p.phone || "" },
          infoItems: [
            { icon: "phone", label: "Phone", value: p.phone || "", link: `tel:${p.phone || ""}` },
            { icon: "pin",   label: "Address", value: p.address || "", link: null },
            { icon: "clock", label: "Hours",   value: p.hours || "",   link: null },
          ],
          showForm: !!p.email, formLabel: "Send us a message",
        },
        footer: { tagline: "", columns: ["brand", "links", "contact"] },
        navLinks: ["Services", "About", "Contact"],
        logoTreatment: logoUrl ? (logoUrl.endsWith(".svg") ? "svg-both" : "raster-footer-only") : "wordmark",
        photoLayout: { hero: sitePhotos[0] || null, about: sitePhotos[1] || null, gallery: sitePhotos.slice(2, 4) },
      };
    }
  })();

  // ── Await Pass 0 + research in parallel ───────────────────────
  const [researchRaw, plan] = await Promise.all([researchPromise, pass0Promise]);

  // Enforce owner/extracted color over Pass 0's palette suggestion
  if (confirmedColor) plan.palette.accent = confirmedColor;

  const accent     = plan.palette.accent     || "#c87927";
  const bgPrimary  = plan.palette.background || "#1a1816";
  const isDark     = plan.palette.isDark !== false;

  // ── Parse research ─────────────────────────────────────────────
  function parseResearch(text) {
    if (!text) return null;
    const get = key => {
      const m = text.match(new RegExp(`${key}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, "si"));
      return m ? m[1].trim() : null;
    };
    const found = get("FOUND");
    if (!found || found.toLowerCase().startsWith("no")) return null;
    const reviewsRaw = get("REVIEWS");
    const reviews = [];
    if (reviewsRaw && !reviewsRaw.toLowerCase().includes("none")) {
      for (const m of reviewsRaw.matchAll(/"([^"]+)"\s*[—–-]\s*([^\n,]+)/g))
        reviews.push({ quote: m[1].trim(), attribution: m[2].trim() });
    }
    const rating        = get("RATING");
    const orderingLinks = get("ORDERING_LINKS");
    const bookingLinks  = get("BOOKING_LINKS");
    const press         = get("PRESS");
    const social        = get("SOCIAL");
    const history       = get("HISTORY");
    return {
      rating:        (rating        && !rating.toLowerCase().includes("none"))        ? rating        : null,
      reviews:       reviews.length >= 2 ? reviews : [],
      orderingLinks: (orderingLinks && orderingLinks !== "n/a")                       ? orderingLinks : null,
      bookingLinks:  (bookingLinks  && bookingLinks  !== "n/a")                       ? bookingLinks  : null,
      press:         (press  && !press.toLowerCase().includes("none"))                ? press         : null,
      social:        (social && !social.toLowerCase().includes("none"))               ? social        : null,
      history:       (history && !history.toLowerCase().includes("none"))             ? history       : null,
      raw: text,
    };
  }

  const researchFindings = researchRaw;
  const research         = parseResearch(researchFindings);
  console.log(`[${orderId}] Research: ${research ? "found" : "none"} | Rating: ${research?.rating || "—"} | Reviews: ${research?.reviews?.length || 0}`);

  // Add testimonials to section order if we have real reviews
  if (research?.reviews?.length >= 2 && !plan.sections.includes("testimonials")) {
    const ci = plan.sections.indexOf("contact");
    plan.sections.splice(ci > -1 ? ci : plan.sections.length, 0, "testimonials");
  }

  // ════════════════════════════════════════════════════════════════
  // PASS 1 — Design System + SVG Symbol Library (Sonnet)
  // Receives the content plan. Produces:
  //   1. <style> block with all CSS using plan's palette
  //   2. <svg style="display:none"> symbol block with every icon
  //      named exactly as plan.contentSection.items[].icon
  //      and plan.contactLayout.infoItems[].icon
  // Pass 2 references symbols by <use href="#icon-NAME"> — no invention.
  // ════════════════════════════════════════════════════════════════
  console.log(`[${orderId}] Pass 1: design system + SVG symbols`);

  // Collect every icon name Pass 2 will need
  const allIconNames = [
    ...(plan.contentSection?.items || []).map(i => i.icon),
    ...(plan.contactLayout?.infoItems || []).map(i => i.icon),
    "phone", "pin", "clock", "mail", "external-link", "instagram", "arrow-right",
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  // Canonical SVG paths for every possible icon key
  const iconPaths = {
    "car-damage":       `<rect x="2" y="8" width="20" height="10" rx="2"/><path d="M6 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M9 12l2-2 2 2 2-2"/>`,
    "spray-gun":        `<path d="M3 12h10M8 7v10M13 7h5a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-5"/><circle cx="6" cy="12" r="3"/><path d="M18 12h.01"/>`,
    "tow-truck":        `<path d="M14 18V9a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9"/><path d="M14 9l4 2v7"/><circle cx="7" cy="18" r="2"/><circle cx="16" cy="18" r="2"/><path d="M18 9h2l1 2v1h-3"/>`,
    "car-window-tint":  `<rect x="3" y="6" width="18" height="12" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="7" y1="6" x2="5" y2="18"/><line x1="12" y1="6" x2="10" y2="18"/><line x1="17" y1="6" x2="15" y2="18"/>`,
    "car-restoration":  `<path d="M14 18V9a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9"/><circle cx="7" cy="18" r="2"/><circle cx="15" cy="18" r="2"/><path d="M14 12h5l1 5"/><path d="M9 5l1-3h4l1 3"/>`,
    "clipboard-check":  `<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12l2 2 4-4"/>`,
    "scissors":         `<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>`,
    "comb":             `<path d="M4 4v16"/><path d="M8 4v8"/><path d="M12 4v8"/><path d="M16 4v8"/><path d="M20 4v8"/><path d="M4 20h16"/>`,
    "razor":            `<path d="M5 12h14"/><path d="M8 4l-3 8 3 8"/><path d="M16 4l3 8-3 8"/><rect x="8" y="8" width="8" height="8" rx="1"/>`,
    "nail-polish":      `<path d="M9 3h6l2 5H7z"/><rect x="8" y="8" width="8" height="13" rx="2"/><line x1="12" y1="11" x2="12" y2="17"/>`,
    "spray-bottle":     `<path d="M3 3h4v4H3z"/><path d="M7 5h3l5 7H7z"/><rect x="7" y="12" width="8" height="9" rx="2"/><path d="M19 5l-2 2"/>`,
    "washing-machine":  `<rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M7 7h.01M11 7h2"/>`,
    "needle-thread":    `<path d="M12 3v8"/><path d="M8 7l4-4 4 4"/><path d="M12 11c0 4.4-3.6 8-8 8"/><path d="M12 11c0 4.4 3.6 8 8 8"/>`,
    "abc-blocks":       `<rect x="2" y="12" width="10" height="10" rx="1"/><rect x="12" y="12" width="10" height="10" rx="1"/><rect x="7" y="2" width="10" height="10" rx="1"/><path d="M7 7h2m2 0h2M9 5v4"/>`,
    "open-book":        `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`,
    "lotus":            `<path d="M12 22V12"/><path d="M12 12C12 7 8 3 3 3c0 5 4 9 9 9"/><path d="M12 12c0-5 4-9 9-9 0 5-4 9-9 9"/><path d="M12 12C7 12 3 16 3 21c5 0 9-4 9-9"/><path d="M12 12c5 0 9 4 9 9-5 0-9-4-9-9"/>`,
    "dumbbell":         `<path d="M6 5v14"/><path d="M18 5v14"/><path d="M6 8H2v8h4"/><path d="M18 8h4v8h-4"/><line x1="6" y1="12" x2="18" y2="12"/>`,
    "fork-knife":       `<path d="M3 11l19-9-9 19-2-8-8-2z"/>`,
    "cake":             `<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v2"/><path d="M12 8v2"/><path d="M17 8v2"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/>`,
    "food-truck":       `<path d="M4 18V9a1 1 0 0 1 1-1h11l3 4v6"/><circle cx="7" cy="18" r="2"/><circle cx="15" cy="18" r="2"/><path d="M4 13h12"/>`,
    "serving-dish":     `<path d="M2 12h20"/><path d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8"/><path d="M4 19h16"/><path d="M12 4v2"/>`,
    "flower":           `<circle cx="12" cy="12" r="3"/><path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4z" opacity=".4"/><path d="M12 12a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4z" opacity=".4"/><path d="M2 12a4 4 0 0 1 4-4 4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4z" opacity=".4"/><path d="M14 12a4 4 0 0 1 4-4 4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4z" opacity=".4"/>`,
    "dove":             `<path d="M16 13h5a1 1 0 0 0 .7-1.7L20 10c-1-1-2.5-1-3.5 0l-3 3"/><path d="M16 13l-8 8H3l5-5"/><path d="M16 13l-4-4-2 2"/>`,
    "arch-door":        `<path d="M3 21V8a9 9 0 0 1 18 0v13"/><path d="M9 21v-6a3 3 0 0 1 6 0v6"/>`,
    "camera":           `<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>`,
    "mortar-pestle":    `<path d="M2 14h20"/><ellipse cx="12" cy="14" rx="9" ry="4"/><path d="M12 14v6"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M15 4l2-2"/>`,
    "storefront":       `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
    "shopping-basket":  `<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>`,
    "scales":           `<path d="M12 3v18"/><path d="M3 9l9-6 9 6"/><path d="M3 15h6l-3 5-3-5z"/><path d="M15 15h6l-3 5-3-5z"/>`,
    "document-stamp":   `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="12" cy="15" r="3"/><path d="M9 18h6"/>`,
    "passport":         `<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="11" r="3"/><path d="M7 19h10"/>`,
    "clock":            `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
    "shield":           `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
    "phone":            `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.13 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3 1.13h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/>`,
    "pin":              `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>`,
    "mail":             `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>`,
    "globe":            `<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
    "instagram":        `<rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>`,
    "external-link":    `<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>`,
    "arrow-right":      `<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>`,
    "check-circle":     `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
    "quote":            `<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>`,
    "star":             `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
  };

  // Build SVG symbol block for all needed icons
  const svgSymbols = allIconNames.map(name => {
    const paths = iconPaths[name] || iconPaths["check-circle"];
    return `<symbol id="icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${paths}</symbol>`;
  }).join("\n  ");

  const svgSpriteBlock = `<svg style="display:none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  ${svgSymbols}
</svg>`;

  // ── Pass 1: Design system CSS ──────────────────────────────────
  const pass1Data = await callClaude({
    model: "claude-sonnet-4-5",
    max_tokens: 3500,
    system: `You are a brand designer. Output ONLY a <style> block — raw CSS, no markdown, no explanation.
Start with <style> and end with </style>. Nothing else.
Mobile-first. All sizing rem/em/%. Borders and shadows may use px.`,
    messages: [{
      role: "user",
      content: `Design system for:
Name: ${p.businessName}
Type: ${typeLabel} · ${subType}
Vibe: "${p.vibe || "Warm, welcoming, community-first"}"
Accent color: ${accent} (NON-NEGOTIABLE — use exactly this hex for --brand)
Background: ${bgPrimary} (use for --bg-primary)
Dark theme: ${isDark}
Font pairing: choose 2 from Playfair Display, DM Sans, Fraunces, Lora — match the vibe

Output a <style> block containing:

/* FONTS */ — Google Fonts @import for exactly 2 families

/* TOKENS */
:root {
  --brand: ${accent};
  --brand-dark: [darken ${accent} by 20%];
  --brand-light: [lighten ${accent} by 20%];
  --bg-primary: ${bgPrimary};
  --bg-secondary: [slightly lighter/darker than bg-primary];
  --bg-card: [card background];
  --text-primary: [${isDark ? "#f5f3f0 or similar warm white" : "#1a1816 or similar warm dark"}];
  --text-secondary: [muted version];
  --text-on-brand: [readable on --brand bg];
  --border: [subtle border];
  --shadow-sm: [small shadow];
  --shadow-md: [medium shadow];
  --radius: [8-10px];
  --radius-lg: [12-16px];
  --font-display: [chosen display font];
  --font-body: [chosen body font];
  --space-xs:.25rem; --space-sm:.5rem; --space-md:1rem; --space-lg:1.5rem; --space-xl:2.5rem; --space-2xl:4rem;
  --section-pad: 5rem 1.25rem;
  --container: 1200px;
}

/* RESET */ — box-sizing, margin/padding reset, smooth scroll, body, img, a defaults

/* TYPOGRAPHY */ — h1-h4 with font-display, clamp sizes. .eyebrow, .display-xl, .lead

/* NAV */
nav { position:fixed; top:0; left:0; right:0; z-index:100; padding:.875rem 1.25rem; transition:background .3s,box-shadow .3s; }
nav.scrolled { background:var(--bg-primary); box-shadow:0 2px 20px rgba(0,0,0,.12); }
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
.btn-primary { display:inline-flex; align-items:center; gap:.5rem; background:var(--brand); color:var(--text-on-brand); padding:.875rem 2rem; border-radius:var(--radius); font-weight:600; font-size:1rem; border:2px solid var(--brand); cursor:pointer; transition:background .2s,transform .2s,box-shadow .2s; text-decoration:none; }
.btn-primary:hover { background:var(--brand-dark); border-color:var(--brand-dark); transform:scale(1.02); box-shadow:var(--shadow-md); }
.btn-secondary { display:inline-flex; align-items:center; gap:.5rem; background:transparent; color:var(--brand); padding:.875rem 2rem; border-radius:var(--radius); font-weight:600; font-size:1rem; border:2px solid var(--brand); cursor:pointer; transition:background .2s,color .2s; text-decoration:none; }
.btn-secondary:hover { background:var(--brand); color:var(--text-on-brand); }

/* HERO */
.hero { position:relative; min-height:100svh; display:flex; align-items:center; overflow:hidden; }
.hero-bg { position:absolute; inset:0; background-size:cover; background-position:center; }
.hero-overlay { position:absolute; inset:0; background:linear-gradient(135deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,.38) 100%); }
.hero-content { position:relative; z-index:1; max-width:var(--container); margin:auto; padding:6rem 1.25rem 4rem; }
.hero h1,.hero .display-xl { color:#fff; }
.hero .lead { color:rgba(255,255,255,.85); margin:1rem 0 2rem; }
.hero-ctas { display:flex; gap:1rem; flex-wrap:wrap; align-items:center; }
.rating-badge { display:inline-flex; align-items:center; gap:.4rem; background:var(--brand); color:var(--text-on-brand); padding:.3rem .9rem; border-radius:999px; font-weight:700; font-size:.875rem; margin-top:1rem; }

/* PROOF BAR */
.proof-bar { background:var(--bg-secondary); padding:1rem 1.25rem; border-bottom:1px solid var(--border); }
.proof-bar-inner { max-width:var(--container); margin:auto; display:flex; gap:2.5rem; flex-wrap:wrap; justify-content:center; align-items:center; }
.proof-item { display:flex; align-items:center; gap:.5rem; font-size:.9rem; color:var(--text-secondary); }
.proof-number { font-size:1.4rem; font-weight:800; color:var(--brand); line-height:1; }

/* LAYOUT */
.container { max-width:var(--container); margin:auto; padding:0 1.25rem; }
section { padding:var(--section-pad); }
.section-alt { background:var(--bg-secondary); }
.section-dark { background:#0f0e0c; color:#fff; }
.section-header { margin-bottom:3rem; }
.grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:2.5rem; align-items:center; }
.grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:1.5rem; }
.grid-auto { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:1.5rem; }

/* CARDS */
.card { background:var(--bg-card); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); overflow:hidden; transition:box-shadow .25s,transform .25s; }
.card:hover { box-shadow:var(--shadow-md); transform:translateY(-3px); }
.card-body { padding:1.5rem; }

/* SERVICE ICONS — use SVG <use> elements, sized and colored via these classes */
.service-icon { width:56px; height:56px; border-radius:var(--radius); background:color-mix(in srgb,var(--brand) 12%,transparent); display:flex; align-items:center; justify-content:center; margin-bottom:1.25rem; flex-shrink:0; }
.service-icon svg { width:28px; height:28px; color:var(--brand); }

/* TESTIMONIALS */
.testimonials { background:var(--bg-secondary); }
.testimonial-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:2rem; margin-top:2.5rem; }
.testimonial-card { background:var(--bg-card); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:2rem; }
.quote-mark { font-size:4rem; line-height:0; display:block; margin-bottom:.75rem; color:var(--brand); font-family:var(--font-display),serif; }
.testimonial-text { font-style:italic; line-height:1.75; font-size:1.05rem; }
.testimonial-author { margin-top:1.25rem; font-weight:600; font-size:.875rem; color:var(--text-secondary); }

/* ABOUT */
.about-img img { width:100%; border-radius:var(--radius-lg); object-fit:cover; max-height:500px; }
.pull-quote { font-size:1.25rem; font-style:italic; line-height:1.65; border-left:4px solid var(--brand); padding-left:1.5rem; margin:2rem 0; }
.press-mention { display:inline-flex; align-items:center; gap:.5rem; font-size:.875rem; font-weight:600; color:var(--text-secondary); margin-top:1rem; }

/* CONTACT */
.contact-grid { display:grid; grid-template-columns:1fr 1.2fr; gap:3rem; align-items:start; }
.contact-info-item { display:flex; gap:1rem; margin-bottom:1.75rem; align-items:flex-start; }
.contact-icon { width:44px; height:44px; min-width:44px; border-radius:50%; background:color-mix(in srgb,var(--brand) 12%,transparent); display:flex; align-items:center; justify-content:center; }
.contact-icon svg { width:20px; height:20px; color:var(--brand); }
.contact-form { background:var(--bg-card); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:2rem; }
.form-group { margin-bottom:1.25rem; }
.form-group label { display:block; font-size:.875rem; font-weight:600; margin-bottom:.4rem; color:var(--text-secondary); }
input,textarea,select { width:100%; padding:.75rem 1rem; border:1.5px solid var(--border); border-radius:var(--radius); background:var(--bg-primary); color:var(--text-primary); font-family:var(--font-body),sans-serif; font-size:1rem; transition:border-color .2s; }
input:focus,textarea:focus { outline:none; border-color:var(--brand); }
textarea { resize:vertical; min-height:120px; }
.map-link { display:inline-flex; align-items:center; gap:.4rem; color:var(--brand); font-weight:500; transition:opacity .2s; }
.map-link:hover { opacity:.8; }
.platform-btn { display:inline-flex; align-items:center; gap:.5rem; padding:.6rem 1.25rem; border:2px solid var(--border); border-radius:999px; font-weight:600; font-size:.875rem; transition:border-color .2s,background .2s; margin:.25rem; }
.platform-btn:hover { border-color:var(--brand); }
.hours-list { list-style:none; }
.hours-list li { display:flex; justify-content:space-between; padding:.4rem 0; border-bottom:1px solid var(--border); font-size:.9rem; }

/* FOOTER */
footer { background:var(--bg-primary); border-top:1px solid var(--border); padding:4rem 1.25rem 2rem; }
.footer-inner { max-width:var(--container); margin:auto; display:grid; grid-template-columns:2fr 1fr 1fr; gap:3rem; margin-bottom:2.5rem; }
.footer-logo-text { font-family:var(--font-display),serif; font-weight:800; font-size:1.5rem; color:var(--brand); margin-bottom:.75rem; display:block; }
.footer-tagline { font-style:italic; color:var(--text-secondary); font-size:.9rem; margin-bottom:1rem; }
.footer-col h4 { font-size:.8rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--text-secondary); margin-bottom:1rem; }
.footer-col a { display:block; color:var(--text-secondary); font-size:.9rem; margin-bottom:.5rem; transition:color .2s; }
.footer-col a:hover { color:var(--brand); }
.footer-bottom { max-width:var(--container); margin:auto; border-top:1px solid var(--border); padding-top:1.5rem; display:flex; justify-content:space-between; align-items:center; color:var(--text-secondary); font-size:.8rem; flex-wrap:wrap; gap:.5rem; }

/* ANIMATIONS */
.fade-up { opacity:0; transform:translateY(24px); transition:opacity .6s ease,transform .6s ease; }
.fade-up.visible { opacity:1; transform:none; }
.stagger-1{transition-delay:.1s} .stagger-2{transition-delay:.2s} .stagger-3{transition-delay:.3s} .stagger-4{transition-delay:.4s}
@media(prefers-reduced-motion:reduce){.fade-up{opacity:1;transform:none}}

/* RESPONSIVE */
@media(max-width:768px){
  .nav-links{display:none}
  .hamburger{display:flex}
  .grid-2,.grid-3,.contact-grid,.footer-inner{grid-template-columns:1fr}
  .hero-ctas{flex-direction:column;align-items:flex-start}
  .proof-bar-inner{gap:1.5rem}
}`,
    }],
  });

  let designSystem = (pass1Data.content?.find(b => b.type === "text")?.text || "")
    .replace(/^```(?:css|html)?\n?/im, "").replace(/\n?```$/m, "").trim();
  if (!designSystem.startsWith("<style>")) designSystem = `<style>\n${designSystem}`;
  if (!designSystem.endsWith("</style>")) designSystem = `${designSystem}\n</style>`;

  console.log(`[${orderId}] Pass 1 done: ${designSystem.length} chars`);

  // ── Build research block ───────────────────────────────────────
  const researchBlock = (() => {
    if (!research) return `RESEARCH: Not found online — this is their internet debut. Do NOT invent ratings, reviews, or platform links. No testimonials section. No proof bar.`;
    const lines = [`VERIFIED RESEARCH — surface ALL of this:`];
    if (research.rating) {
      lines.push(`RATING: ${research.rating}
→ Hero: <div class="rating-badge">★ ${research.rating}</div> immediately after the tagline paragraph
→ Proof bar after hero: <div class="proof-bar"><div class="proof-bar-inner"><div class="proof-item"><span class="proof-number">★ ${research.rating}</span><span>on Google</span></div></div></div>`);
    }
    if (research.reviews.length >= 2) {
      lines.push(`TESTIMONIALS SECTION — place between about and contact:
${research.reviews.map((r, i) => `Quote ${i+1}: "${r.quote}" — ${r.attribution}`).join("\n")}`);
    } else {
      lines.push(`TESTIMONIALS: Fewer than 2 verified quotes — skip this section entirely.`);
    }
    if (research.press)         lines.push(`PRESS: "${research.press}" — mention in about section`);
    if (research.social)        lines.push(`SOCIAL: ${research.social} — show in footer + contact`);
    if (research.history)       lines.push(`HISTORY: "${research.history}" — weave into about copy`);
    if (research.orderingLinks) lines.push(`ORDERING LINKS: ${research.orderingLinks} — .platform-btn buttons in contact`);
    if (research.bookingLinks)  lines.push(`BOOKING LINK: ${research.bookingLinks} — primary CTA in contact`);
    return lines.join("\n\n");
  })();

  // ── Build pre-written structural skeleton ──────────────────────
  // These are the invariant structural pieces where class names must
  // be exact. We write them in JS and Pass 2 fills in content only.

  // Contact info items — exact class names, exact icon references
  const contactInfoHTML = (plan.contactLayout?.infoItems || []).map(item => `
        <div class="contact-info-item">
          <div class="contact-icon">
            <svg width="20" height="20" aria-hidden="true"><use href="#icon-${item.icon}"/></svg>
          </div>
          <div>
            <p style="font-weight:600;margin-bottom:.2rem">${item.label}</p>
            ${item.link
              ? `<a href="${item.link}" ${item.icon === "pin" ? `class="map-link" target="_blank" rel="noopener"` : `style="color:var(--brand);font-weight:600"`}>${item.value}</a>`
              : `<p style="color:var(--text-secondary)">${item.value}</p>`}
          </div>
        </div>`).join("");

  // Footer columns — exact class names and column count
  const footerColCount = plan.footer?.columns?.length || 3;
  const footerGridCols = footerColCount === 2 ? "1fr 1fr" : "2fr 1fr 1fr";

  // Service/content items — exact icon references
  const serviceCardsHTML = (plan.contentSection?.items || []).map((item, i) => `
        <article class="card fade-up stagger-${Math.min(i + 1, 4)}">
          <div class="card-body">
            <div class="service-icon">
              <svg width="28" height="28" aria-hidden="true"><use href="#icon-${item.icon}"/></svg>
            </div>
            <h3>${item.name}</h3>
            <p style="color:var(--text-secondary);margin-top:.5rem;line-height:1.6">${item.desc}</p>
          </div>
        </article>`).join("");

  // Testimonials — exact markup if we have real reviews
  const testimonialsHTML = research?.reviews?.length >= 2
    ? `<section id="testimonials" class="testimonials fade-up" style="padding:var(--section-pad)">
    <div class="container">
      <div class="section-header">
        <span class="eyebrow">What People Say</span>
        <h2>Real Reviews</h2>
      </div>
      <div class="testimonial-grid">
        ${research.reviews.map(r => `<div class="testimonial-card">
          <span class="quote-mark">"</span>
          <p class="testimonial-text">${r.quote}</p>
          <p class="testimonial-author">— ${r.attribution}</p>
        </div>`).join("\n        ")}
      </div>
    </div>
  </section>`
    : "";

  // Rating badge — exact markup if we have a rating
  const ratingBadgeHTML = research?.rating
    ? `<div class="rating-badge">★ ${research.rating}</div>`
    : "";

  // Proof bar — exact markup if we have a rating
  const proofBarHTML = research?.rating
    ? `<div class="proof-bar">
    <div class="proof-bar-inner">
      <div class="proof-item">
        <span class="proof-number">★ ${research.rating}</span>
        <span>on Google</span>
      </div>
    </div>
  </div>`
    : "";

  // Hero photo — direct tag injection
  const heroBgStyle = plan.photoLayout?.hero
    ? `style="background-image:url('${plan.photoLayout.hero}')"`
    : `style="background:linear-gradient(135deg,${bgPrimary} 0%,color-mix(in srgb,${accent} 20%,${bgPrimary}) 100%)"`;

  // About photo
  const aboutPhotoHTML = plan.photoLayout?.about
    ? `<div class="about-img fade-up">
        <img src="${plan.photoLayout.about}" alt="${p.businessName} in ${p.city || "our community"}" loading="lazy">
      </div>`
    : "";

  // Logo treatment
  const navLogoHTML = plan.logoTreatment === "svg-both"
    ? `<a href="#home"><img src="${logoUrl}" alt="${p.businessName} logo" style="height:52px"></a>`
    : `<a href="#home" class="nav-logo">${p.businessName}</a>`;

  const footerLogoHTML = (plan.logoTreatment === "svg-both" || plan.logoTreatment === "raster-footer-only") && logoUrl
    ? `<img src="${logoUrl}" alt="${p.businessName} logo" style="width:140px;margin-bottom:1rem">`
    : `<span class="footer-logo-text">${p.businessName}</span>`;

  // ════════════════════════════════════════════════════════════════
  // PASS 2 — HTML (Opus, ~12000 tokens)
  // Receives locked design system + pre-written skeleton pieces.
  // Only writes: head meta/SEO, copy, about section, contact form,
  // footer text, and stitches pre-written blocks in correct order.
  // All icons, photos, class names for structural elements are
  // already decided — Pass 2 cannot deviate.
  // ════════════════════════════════════════════════════════════════
  console.log(`[${orderId}] Pass 2: HTML`);

  const pass2User = `Build a complete website HTML file. Output raw HTML only — start with <!DOCTYPE html>, end with </html>, no markdown fences.

The structural pieces below are PRE-WRITTEN. Inject them VERBATIM at the locations marked. Do not modify them.
Write all other content (copy, about text, SEO tags, form, footer text, JS) yourself.

═══ BUSINESS INFO ═══════════════════════════════════════
Name: ${p.businessName}
Owner: ${p.ownerName || ""}
Type: ${typeLabel} · ${subType}
${p.foundedYear  ? `Founded: ${p.foundedYear}` : ""}
${p.tagline      ? `Tagline: ${p.tagline}` : ""}
City: ${p.city || "our community"}${p.neighborhood ? ` · ${p.neighborhood}` : ""}
Address: ${p.address || ""}
Phone: ${p.phone || ""}
${p.email   ? `Email: ${p.email}` : ""}
Hours: ${p.hours || ""}
${p.instagram ? `Instagram: @${p.instagram.replace("@","")}` : ""}
Vibe: "${p.vibe || "Warm, welcoming, community-first"}"
${subType === "funeralhome" ? "TONE: Dignified, restrained. No energetic CTAs." : ""}
About: ${p.description || ""}
${p.differentiator ? `Differentiator: ${p.differentiator}` : ""}
${p.about ? `Origin: ${p.about}` : ""}
${p.typeSpecific ? `Owner content: ${p.typeSpecific}` : ""}

═══ RESEARCH ════════════════════════════════════════════
${researchBlock}

═══ PRE-WRITTEN BLOCKS — INJECT VERBATIM ════════════════

[DESIGN_SYSTEM] — inject into <head> (this is the entire <style> block):
${designSystem}

[SVG_SPRITE] — inject as first child of <body>:
${svgSpriteBlock}

[HERO_BG] — use as the .hero-bg div attribute:
${heroBgStyle}

[RATING_BADGE] — inject immediately after hero tagline <p> (omit if empty):
${ratingBadgeHTML}

[PROOF_BAR] — inject immediately after closing </section> of hero (omit if empty):
${proofBarHTML}

[SERVICE_CARDS] — inject inside the .grid-auto div in the content section:
${serviceCardsHTML}

[ABOUT_PHOTO] — inject as first child of the about .grid-2 div (omit if empty):
${aboutPhotoHTML}

[TESTIMONIALS] — inject between about section and contact section (omit if empty):
${testimonialsHTML}

[CONTACT_INFO_ITEMS] — inject inside .contact-info div (left column of contact):
${contactInfoHTML}

[NAV_LOGO] — inject as logo element in nav:
${navLogoHTML}

[FOOTER_LOGO] — inject as first element in first footer column:
${footerLogoHTML}

═══ WHAT YOU WRITE ══════════════════════════════════════

1. <head>: charset, viewport, title, meta description, JSON-LD schema, [DESIGN_SYSTEM]
   - title: "${p.businessName} — ${p.industry || typeLabel} in ${p.city || "New York"}"
   - description: 150-160 chars, business name + service + city + differentiator
   - JSON-LD @type: ${p.businessType === "restaurant" ? "Restaurant" : p.businessType === "retail" ? "Store" : "AutoRepair"}
   - Include name, address, telephone${p.hours ? ", openingHours" : ""}

2. <nav>: [NAV_LOGO] on left. Nav links: ${(plan.navLinks || ["Services","About","Contact"]).join(", ")}. Primary CTA button: "${plan.contactLayout?.primaryCTA?.label || "Contact Us"}". Hamburger button. .mobile-menu div.

3. <section id="home" class="hero">:
   - <div class="hero-bg" [HERO_BG]></div>
   - <div class="hero-overlay"></div>
   - hero-content with: eyebrow (city + type), <h1>${plan.heroHeadline}</h1>, <p class="lead tagline">${plan.heroTagline}</p>, [RATING_BADGE], .hero-ctas with primary + secondary CTA buttons

4. [PROOF_BAR]

5. <section id="${plan.contentSection?.id || "services"}" class="section-alt">:
   - section-header with eyebrow + h2: "${plan.contentSection?.heading || "What We Offer"}" + lead
   - <div class="grid-auto">[SERVICE_CARDS]</div>
   - CTA button at bottom: "${plan.contactLayout?.primaryCTA?.label}"

6. <section id="about">:
   - <div class="grid-2">[ABOUT_PHOTO] + text column</div>
   - Text: eyebrow "About Us", h2, 2-3 paragraphs with real copy using owner info
   - ${p.ownerName ? `Use "${p.ownerName}" by name` : ""}
   - ${p.foundedYear ? `Weave in "since ${p.foundedYear}"` : ""}
   - ${research?.press ? `Include: <p class="press-mention">✦ ${research.press}</p>` : ""}
   - ${p.about ? `Pull quote from origin story using .pull-quote class` : ""}

7. [TESTIMONIALS]

8. <section id="contact"${plan.sections.indexOf("contact") % 2 === 0 ? " class=\"section-alt\"" : ""}>:
   - section-header: eyebrow + h2 + lead
   - <div class="contact-grid">
       <div class="contact-info">[CONTACT_INFO_ITEMS]</div>
       ${plan.contactLayout?.showForm
         ? `<form class="contact-form card fade-up" action="#" method="POST">
              name, email, message fields + submit button "${plan.contactLayout.formLabel || "Send Message"}"
            </form>`
         : `<div class="fade-up">Primary CTA: large "${plan.contactLayout?.primaryCTA?.label}" button → ${plan.contactLayout?.primaryCTA?.type === "tel" ? `tel:${plan.contactLayout.primaryCTA.value}` : plan.contactLayout?.primaryCTA?.value || "#"}</div>`}
     </div>

9. <footer>:
   - <div class="footer-inner" style="grid-template-columns:${footerGridCols}">
   - Column 1: [FOOTER_LOGO] + .footer-tagline "${plan.footer?.tagline}" + address + phone
   - Column 2: <h4>Navigate</h4> + nav links
   - ${footerColCount >= 3 ? `Column 3: <h4>Hours</h4> + hours info${p.instagram ? ` + Instagram link` : ""}` : ""}
   - .footer-bottom: copyright + city tagline

10. <script>: All JS inline:
   - IntersectionObserver for .fade-up → adds .visible (threshold 0.15)
   - Nav scroll: toggle .scrolled at scrollY > 50
   - Hamburger: toggle .mobile-menu.open + aria-expanded
   - Mobile menu: close on link click

SEO: <h1> includes city. City appears 3-4× total. Every <img> has descriptive alt with business name + city.`;

  const pass2Data = await callClaude({
    model: "claude-opus-4-5",
    max_tokens: 13000,
    system: `You are a senior front-end developer. Build the HTML file exactly as specified.
RULES:
- Raw HTML only. Start <!DOCTYPE html>. End </html>. No markdown, no fences.
- Inject PRE-WRITTEN blocks VERBATIM — do not paraphrase or restructure them.
- Use only CSS classes defined in the design system. Do not add inline styles except where explicitly instructed.
- Never invent data not in the brief (phone, price, review, URL, hours).
- Zero emoji. All icons via <use href="#icon-NAME"> referencing the SVG sprite.
- One <script> tag at end of <body> for all JS.`,
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

  console.log(`[${orderId}] Pass 2 done: ${html.length} chars, stop: ${pass2Data.stop_reason}`);

  if (!html || html.length < 500)
    return res.status(500).json({ error: "AI returned empty response" });

  // ── Validation — only data integrity now, structure is pre-locked
  try {
    const valData = await callClaude({
      model: "claude-sonnet-4-5",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `Data integrity check for a website.

OWNER PROVIDED:
Phone: ${p.phone || "NONE"} | Email: ${p.email || "NONE"} | Hours: ${p.hours || "NONE"}
Prices: ${p.typeSpecific?.includes("price") ? "some" : "NONE"}

VERIFIED RESEARCH: ${researchFindings ? researchFindings.slice(0, 500) : "none"}

HTML (first 3000 chars): ${html.slice(0, 3000)}

Check ONLY:
1. PHONE — any number differing from "${p.phone || "NONE"}"?
2. PRICES — dollar amounts not in owner content or research?
3. REVIEWS — quotes not in research data?
4. LINKS — delivery/booking URLs not found in research?
5. HOURS — hours differing from "${p.hours || "NONE"}"?
6. EMAIL — email differing from "${p.email || "NONE"}"?

Respond ONLY: PASS  or  ISSUES: phone|prices|reviews|links|hours|email`,
      }],
    });

    const valResult = valData.content?.find(b => b.type === "text")?.text?.trim() || "PASS";
    console.log(`[${orderId}] Validation: ${valResult}`);

    if (valResult.startsWith("ISSUES:")) {
      const issues = valResult.replace("ISSUES:", "").split("|").map(s => s.trim().toLowerCase());

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
      console.log(`[${orderId}] Patches applied: ${issues.join(", ")}`);
    }
  } catch (e) { console.log(`[${orderId}] Validation failed: ${e.message} — continuing`); }

  // ── Deliver ────────────────────────────────────────────────────
  const htmlB64 = Buffer.from(html, "utf8").toString("base64");
  const bizSlug = (p.businessName || "website").toLowerCase().replace(/\s+/g, "-");

  const upstashUrl   = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) {
    try {
      await fetch(`${upstashUrl}/set/order:${orderId}?ex=259200`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${upstashToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ value: Buffer.from(JSON.stringify({
          htmlB64, businessName: p.businessName, city: p.city,
          email: p.email, packageId: p.packageId, orderId,
        })).toString("base64") }),
      });
      console.log(`[${orderId}] Upstash saved`);
    } catch (e) { console.error(`[${orderId}] Upstash: ${e.message}`); }
  }

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
            <h2 style="color:#1c1a14;margin:0 0 8px">New Preview Generated</h2>
            <p style="color:#666;font-size:14px;margin:0 0 4px">Not paid yet.</p>
            <p style="color:#c4813a;font-size:13px;margin:0 0 8px">order:${orderId} · 72hr TTL</p>
            <p style="font-size:12px;color:#888;margin:0 0 20px">
              Accent: <strong style="color:${accent}">${accent}</strong> (${confirmedColor ? "owner/extracted" : "Pass 0 chosen"}) ·
              Rating: <strong>${research?.rating||"—"}</strong> ·
              Reviews: <strong>${research?.reviews?.length||0}</strong> ·
              Services: <strong>${plan.contentSection?.items?.length||0}</strong>
            </p>
            ${researchFindings
              ? `<pre style="background:#f9f9f9;border-radius:8px;padding:14px;margin-bottom:20px;font-size:12px;white-space:pre-wrap;border:1px solid #e2ddd0;overflow:auto">${researchFindings.slice(0,600)}</pre>`
              : `<p style="color:#999;font-style:italic;margin-bottom:20px">No research — new business.</p>`}
            <table style="font-size:14px;border-collapse:collapse;width:100%">
              ${[["Business",p.businessName],["Type",`${typeLabel} · ${subType}`],["City",p.city],
                 ["Phone",p.phone],["Email",p.email],["Address",p.address],["Hours",p.hours],
                 ["Photos",`${photoCount} uploaded`],["Package",p.packageId],["Vibe",`"${p.vibe}"`]]
                .map(([k,v],i)=>`<tr${i%2===1?' style="background:#f9f9f9"':''}><td style="padding:7px 8px;font-weight:bold;color:#666;width:120px">${k}</td><td style="padding:7px 8px">${v||"—"}</td></tr>`)
                .join("")}
            </table>
          </div>`,
          attachments: [{ filename: `${bizSlug}.html`, content: htmlB64 }],
        }),
      });
      console.log(`[${orderId}] Email sent`);
    } catch (e) { console.error(`[${orderId}] Email: ${e.message}`); }
  }

  return res.status(200).json({ htmlB64, orderId });
}
