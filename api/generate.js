import { useState, useRef, useEffect } from "react";

// ─── FONT SYSTEM (two fonts, used everywhere, no exceptions) ──────
// Playfair Display → all headlines, wordmark, display type
// DM Sans → all body, UI, labels, buttons, captions, navigation

const BLOCKSITE_LOGO = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxODUwIDM2MCIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsbGVkYnk9InRpdGxlIGRlc2MiPgogIDx0aXRsZSBpZD0idGl0bGUiPkJMT0NLU2l0ZSBsb2dvPC90aXRsZT4KICA8ZGVzYyBpZD0iZGVzYyI+QSBjaXR5IGJsb2NrIGljb24gd2l0aCBzdG9yZWZyb250IGFuZCBidWlsZGluZ3MgYmVzaWRlIHRoZSBCTE9DS1NpdGUgd29yZG1hcmsuPC9kZXNjPgogIDxkZWZzPgogICAgPHN0eWxlPgogICAgICAuaW5re2ZpbGw6bm9uZTtzdHJva2U6IzFkMWExNDtzdHJva2Utd2lkdGg6ODtzdHJva2UtbGluZWNhcDpyb3VuZDtzdHJva2UtbGluZWpvaW46cm91bmR9CiAgICAgIC5pbmstZmlsbHtmaWxsOiMxZDFhMTR9CiAgICAgIC5nb2xkLXN0cm9rZXtmaWxsOm5vbmU7c3Ryb2tlOiNjODc5Mjc7c3Ryb2tlLXdpZHRoOjEwO3N0cm9rZS1saW5lY2FwOnJvdW5kO3N0cm9rZS1saW5lam9pbjpyb3VuZH0KICAgICAgLnRhZ3tmb250LWZhbWlseTpBcmlhbCwgSGVsdmV0aWNhLCBzYW5zLXNlcmlmO2ZvbnQtc2l6ZTozMnB4O2xldHRlci1zcGFjaW5nOjdweDtmaWxsOiMxZDFhMTR9CiAgICAgIC50YWctZ29sZHtmaWxsOiNjODc5Mjd9CiAgICAgIC53b3JkLWRhcmt7Zm9udC1mYW1pbHk6R2VvcmdpYSwgJ1RpbWVzIE5ldyBSb21hbicsIHNlcmlmO2ZvbnQtc2l6ZToxNTBweDtmb250LXdlaWdodDo3MDA7ZmlsbDojMWQxYTE0fQogICAgICAud29yZC1nb2xke2ZvbnQtZmFtaWx5Okdlb3JnaWEsICdUaW1lcyBOZXcgUm9tYW4nLCBzZXJpZjtmb250LXNpemU6MTUwcHg7Zm9udC13ZWlnaHQ6NzAwO2ZpbGw6I2M4NzkyN30KICAgIDwvc3R5bGU+CiAgPC9kZWZzPgoKICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg1NSA0NSkiPgogICAgPHBhdGggY2xhc3M9ImdvbGQtc3Ryb2tlIiBkPSJNMzQgMTI4IEMzNCA1NiA5MSAxMiAxNTggMTIgQzIyMiAxMiAyNzAgNTQgMjg0IDExMSIgLz4KICAgIDxwYXRoIGNsYXNzPSJpbmsiIGQ9Ik0wIDI1OCBIMzIyIiAvPgogICAgPHBhdGggY2xhc3M9ImluayIgZD0iTTMyIDI1OCBWMTY4IiAvPgogICAgPHBhdGggY2xhc3M9ImluayIgZD0iTTIwIDE2OCBINDQgTDM4IDE0NSBIMjYgWiIgLz4KICAgIDxwYXRoIGNsYXNzPSJpbmsiIGQ9Ik0yNiAxNDUgQzI2IDEzMyAzOCAxMzMgMzggMTQ1IiAvPgogICAgPHBhdGggY2xhc3M9ImluayIgZD0iTTc0IDI1OCBWMTU4IEgxNTYgVjI1OCIgLz4KICAgIDxwYXRoIGNsYXNzPSJpbmsiIGQ9Ik02NiAxNTggSDE2NCIgLz4KICAgIDxwYXRoIGNsYXNzPSJpbmsiIGQ9Ik03OCAxNTggTDY2IDE5NiBIMTcwIEwxNTggMTU4IiAvPgogICAgPHBhdGggY2xhc3M9ImluayIgZD0iTTgyIDE1OCBWMTk2IE0xMDYgMTU4IFYxOTYgTTEzMCAxNTggVjE5NiBNMTU0IDE1OCBWMTk2IiAvPgogICAgPHBhdGggY2xhc3M9ImluayIgZD0iTTEwMiAyNTggVjIyMiBIMTMxIFYyNTgiIC8+CiAgICA8cmVjdCBjbGFzcz0iaW5rLWZpbGwiIHg9Ijc5IiB5PSIyMTEiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgcng9IjIiIC8+CiAgICA8cGF0aCBjbGFzcz0iaW5rIiBkPSJNMTY0IDI1OCBWNjAgSDI0MiBWMjU4IiAvPgogICAgPHBhdGggY2xhc3M9ImluayIgZD0iTTE2NCA2MCBIMjQyIiAvPgogICAgPHJlY3QgY2xhc3M9ImluayIgeD0iMTg0IiB5PSI4NCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjI0IiByeD0iMiIgLz4KICAgIDxyZWN0IGNsYXNzPSJpbmsiIHg9IjIxMSIgeT0iODQiIHdpZHRoPSIxNiIgaGVpZ2h0PSIyNCIgcng9IjIiIC8+CiAgICA8cmVjdCBjbGFzcz0iaW5rIiB4PSIxODQiIHk9IjEyNyIgd2lkdGg9IjE2IiBoZWlnaHQ9IjI0IiByeD0iMiIgLz4KICAgIDxyZWN0IGNsYXNzPSJpbmsiIHg9IjIxMSIgeT0iMTI3IiB3aWR0aD0iMTYiIGhlaWdodD0iMjQiIHJ4PSIyIiAvPgogICAgPHJlY3QgY2xhc3M9ImluayIgeD0iMTg0IiB5PSIxNzAiIHdpZHRoPSIxNiIgaGVpZ2h0PSIyNCIgcng9IjIiIC8+CiAgICA8cmVjdCBjbGFzcz0iaW5rIiB4PSIyMTEiIHk9IjE3MCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjI0IiByeD0iMiIgLz4KICAgIDxyZWN0IGNsYXNzPSJpbmsiIHg9IjE4NCIgeT0iMjEzIiB3aWR0aD0iMTYiIGhlaWdodD0iMjQiIHJ4PSIyIiAvPgogICAgPHJlY3QgY2xhc3M9ImluayIgeD0iMjExIiB5PSIyMTMiIHdpZHRoPSIxNiIgaGVpZ2h0PSIyNCIgcng9IjIiIC8+CiAgICA8cGF0aCBjbGFzcz0iaW5rIiBkPSJNMjQyIDI1OCBWMTI5IEgzMDAgVjI1OCIgLz4KICAgIDxwYXRoIGNsYXNzPSJpbmsiIGQ9Ik0yNDIgMTI5IEgzMDAiIC8+CiAgICA8cGF0aCBjbGFzcz0iaW5rIiBkPSJNMjYwIDI1OCBWMTc0IEMyNjAgMTU2IDI4MiAxNTYgMjgyIDE3NCBWMjU4IiAvPgogICAgPHBhdGggY2xhc3M9ImluayIgZD0iTTMyMyAyNTggVjIxMCIgLz4KICAgIDxwYXRoIGNsYXNzPSJpbmsiIGQ9Ik0zMDUgMjE0IEMyOTMgMTk2IDMwMSAxNzQgMzIyIDE2NiBDMzQyIDE3NCAzNTAgMTk2IDMzOCAyMTQgQzMzMCAyMjYgMzEzIDIyNiAzMDUgMjE0IFoiIC8+CiAgPC9nPgoKICA8cGF0aCBkPSJNNDQwIDcyIFYyNzYiIHN0cm9rZT0iIzFkMWExNCIgc3Ryb2tlLXdpZHRoPSI1IiBzdHJva2UtbGluZWNhcD0icm91bmQiIC8+CgogIDwhLS0gU2luZ2xlIHdvcmRtYXJrIHRleHQgZWxlbWVudCBzbyBCTE9DSyBhbmQgU2l0ZSByZW5kZXIgYXMgb25lIHdvcmQgd2l0aG91dCBvdmVybGFwIC0tPgogIDx0ZXh0IHg9IjQ4NSIgeT0iMTkwIiBjbGFzcz0id29yZC1kYXJrIj5CTE9DSzx0c3BhbiBjbGFzcz0id29yZC1nb2xkIj5TaXRlPC90c3Bhbj48L3RleHQ+CgogIDx0ZXh0IHg9IjQ5MCIgeT0iMjYwIiBjbGFzcz0idGFnIiB0ZXh0TGVuZ3RoPSIxMTkwIiBsZW5ndGhBZGp1c3Q9InNwYWNpbmdBbmRHbHlwaHMiPkhFTFBJTkcgQlVTSU5FU1NFUyA8dHNwYW4gY2xhc3M9InRhZy1nb2xkIj5PTiBUSEUgQkxPQ0s8L3RzcGFuPiBHRVQgT05MSU5FLjwvdGV4dD4KPC9zdmc+Cg==";
const FONTS_URL = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap";
const FD = "'Playfair Display', Georgia, serif";   // display
const FB = "'DM Sans', system-ui, sans-serif";     // body

// ─── COLOR SYSTEM ─────────────────────────────────────────────────
const C = {
  ink:    "#1c1a14",   // near-black — primary text, BLOCK word
  cream:  "#faf8f3",   // page background
  paper:  "#f2efe6",   // section alt background
  warm:   "#fffef9",   // card background
  amber:  "#c4813a",   // accent — neighborhood light
  amberL: "#fdf0d8",   // amber tint
  amberD: "#8a5515",   // amber dark for text on amberL
  green:  "#3a6e4f",   // support tier
  navy:   "#253060",   // full service tier
  mid:    "#6b6355",   // secondary text
  rule:   "#e2ddd0",   // borders/rules
  muted:  "#a89880",   // placeholder, hints
};

// ─── GLOBAL CSS ───────────────────────────────────────────────────
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
  body {
    font-family: ${FB};
    -webkit-font-smoothing: antialiased;
    background: ${C.cream};
    color: ${C.ink};
    overflow-x: hidden;
    line-height: 1.6;
  }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: ${C.paper}; }
  ::-webkit-scrollbar-thumb { background: #c8bfa8; border-radius: 3px; }

  /* ── Form elements ── */
  input, textarea, select {
    font-family: ${FB};
    font-size: 16px;
    width: 100%;
    padding: 13px 16px;
    border: 1.5px solid ${C.rule};
    border-radius: 10px;
    background: ${C.warm};
    color: ${C.ink};
    outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
    -webkit-appearance: none;
    appearance: none;
    line-height: 1.5;
  }
  input:focus, textarea:focus, select:focus {
    border-color: ${C.amber};
    box-shadow: 0 0 0 3px ${C.amber}22;
  }
  textarea { resize: vertical; line-height: 1.7; min-height: 100px; }
  select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23968770' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    padding-right: 36px;
    cursor: pointer;
  }
  input::placeholder, textarea::placeholder { color: ${C.muted}; font-style: italic; }

  /* ── Animations ── */
  @keyframes fadeUp   { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
  @keyframes bounce   { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-10px)} }
  @keyframes marquee  { from { transform:translateX(0); } to { transform:translateX(-50%); } }
  @keyframes pulse    { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.85)} }
  @keyframes ellipsis { 0%{opacity:0.3} 50%{opacity:1} 100%{opacity:0.3} }
  @keyframes spin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

  .fu  { animation: fadeUp 0.45s cubic-bezier(.22,.68,0,1.2) both; }
  .fu1 { animation-delay:.06s; }
  .fu2 { animation-delay:.12s; }
  .fu3 { animation-delay:.18s; }
  .fu4 { animation-delay:.24s; }
  .fi  { animation: fadeIn 0.5s ease both; }

  /* ── Responsive utilities ── */
  @media(max-width:640px){
    .hide-sm  { display:none!important; }
    .col-sm   { grid-template-columns:1fr!important; gap:20px!important; }
    .px-sm    { padding-left:20px!important; padding-right:20px!important; }
    .text-sm-center { text-align:center!important; }
  }
`;

// ─── PACKAGES ─────────────────────────────────────────────────────
const PACKAGES = [
  {
    id:"basic", name:"Just the Site", price:149, emoji:"🌱",
    tagline:"A professional foundation to launch yourself, hand off, or build from.",
    color: C.amber,
    features:["Custom AI-designed website","Matched to your exact vibe","Your real photos in the gallery","Mobile-ready out of the box","Contact form included","Clean, commented code — ready to hand off","No proprietary platform, no lock-in","Deploy it yourself or give it to any developer"],
    notIncluded:["Revision rounds","Domain purchase","We launch it for you — upgrade for that"],
    stripeLink:"https://buy.stripe.com/aFaaEXbQ24gd5dVa19efC01",
  },
  {
    id:"support", name:"Site + Revisions", price:299, emoji:"🤝",
    tagline:"Not happy with the result? We fix it until it's right.",
    color: C.green, badge:"Most Popular",
    features:["Everything in Just the Site","One full revision round","Personal email support (48h response)","Change colors, layout, copy — anything","Order saved 60 days so we can revisit"],
    notIncluded:["Domain purchase","We launch it for you"],
    stripeLink:"https://buy.stripe.com/5kQ6oH07kfYV49R6OXefC02",
  },
  {
    id:"fullservice", name:"Full Service", price:699, emoji:"🚀",
    tagline:"Done for you, start to finish. You just show up.",
    color: C.navy,
    features:["Everything in Site + Revisions","We buy & set up your domain","We deploy your site on Netlify","We connect your custom domain","We set up your Google Business Profile","We test everything on mobile","You get a live URL — nothing to do","30-day follow-up support"],
    notIncluded:[],
    stripeLink:"https://buy.stripe.com/5kQcN51boeURcGn0qzefC00",
  },
];

// ─── BUSINESS TYPE ICONS ──────────────────────────────────────────
const BT_ICONS = {
  restaurant: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  ),
  retail: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  ),
  service: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  ),
};
// ─── SERVICE SUB-TYPES ────────────────────────────────────────────
const SERVICE_SUBTYPES = {
  autobody: {
    label: "Auto Body / Mechanic",
    description: "Collision repair, bodywork, oil changes, tires, detailing",
    pages: ["Home","Our Services","About Us","Gallery","Schedule a Drop-Off","FAQ","Contact"],
    defaultPages: ["Home","Our Services","About Us","Gallery","Contact"],
    differentiator: "We're the only shop in the neighborhood that does same-day estimates and never touches your car without your approval",
    about: "My father opened this shop in 1987 with one lift and a set of tools. Three decades later we're still on the same block, still doing the same honest work.",
    services: "Collision repair\nPaint & bodywork\nDent removal\nFrame straightening\nOil changes\nTire rotation & replacement\nDetailing",
    priceRange: "Free estimates · Most repairs starting from $200",
    bookingMethod: "Call us at (718) 000-0000 · Walk-ins welcome for estimates Mon–Sat",
    credentials: "ASE Certified since 2005 · 20 years serving the Bronx · Allstate and Geico preferred shop",
    vibe: `Examples:\n• "No-nonsense and tough — dark greys, bold orange, industrial but professional. The kind of shop you trust with your car."\n• "Clean and modern — white and navy, sharp. We want people to feel like they walked into somewhere legit."\n• "Old school neighborhood shop — warm brick tones, that lived-in feeling. Been here forever and proud of it."`,
  },
  barbershop: {
    label: "Barbershop",
    description: "Fades, cuts, lineups, shaves, beard grooming",
    pages: ["Home","Our Services","About Us","Gallery","Testimonials","Book an Appointment","Contact"],
    defaultPages: ["Home","Our Services","About Us","Testimonials","Contact"],
    differentiator: "Every cut is precise, every client leaves looking right — no rushing, no excuses",
    about: "I picked up a clipper at 16 and never put it down. I opened this shop because I wanted a place where men in this neighborhood could come in, sit down, and leave feeling like themselves.",
    services: "Fades & tapers\nLineups & shape-ups\nBeard trims & shaves\nKids cuts\nHair designs\nHot towel shaves",
    priceRange: "Cuts from $25 · Fades from $30 · Beard trim from $15",
    bookingMethod: "Walk-ins welcome · Call (718) 000-0000 to book · Book online at our website",
    credentials: "Licensed barber since 2008 · Master barber certification",
    vibe: `Examples:\n• "Classic barbershop — dark wood, leather chairs, old school cool. The kind of place where you stay and talk after your cut."\n• "Modern and sharp — clean blacks and whites, bold signage. Professional but comfortable."\n• "Community hub energy — warm, welcoming, neighborhood pride on every wall."`,
  },
  catering: {
    label: "Catering",
    description: "Event catering, corporate meals, private parties, meal prep",
    pages: ["Home","Our Menu","About Us","Gallery","Testimonials","Request a Quote","Contact"],
    defaultPages: ["Home","Our Menu","About Us","Testimonials","Contact"],
    differentiator: "We cook everything fresh the day of — no reheated trays, no shortcuts",
    about: "I spent 15 years cooking in restaurant kitchens before I started catering. I wanted to bring that same quality to people's special moments — weddings, graduations, family reunions.",
    services: "Wedding & event catering\nCorporate lunch & dinner\nPrivate parties & celebrations\nFamily reunions\nMeal prep services\nPopup dining experiences",
    priceRange: "Events from $25/person · Contact us for a custom quote",
    bookingMethod: "Contact us for availability and a free tasting · Book at least 2 weeks in advance",
    credentials: "NYC Food Handler certified · ServSafe certified · 200+ events catered",
    vibe: `Examples:\n• "Warm and celebratory — rich jewel tones, gold accents. Should feel like a special occasion."\n• "Clean and professional — white and black with a pop of color. Trusted, high-quality, reliable."\n• "Vibrant and community-rooted — bright colors, Caribbean or Southern energy. Food that feels like home."`,
  },
  childcare: {
    label: "Childcare / Daycare",
    description: "Daycare, after-school, tutoring, summer programs",
    pages: ["Home","Our Programs","About Us","Gallery","Testimonials","FAQ","Contact"],
    defaultPages: ["Home","Our Programs","About Us","Testimonials","Contact"],
    differentiator: "Every child gets individual attention — we never exceed 6 kids per caregiver",
    about: "After 15 years teaching in public schools I opened this center because I wanted to create the environment I always wished my own kids had.",
    services: "Full-day childcare (ages 6 weeks–5 years)\nAfter-school care (ages 5–12)\nSummer program\nHoliday care\nDrop-in care (by appointment)",
    priceRange: "Full-day from $250/week · After-school from $150/week · Sibling discounts available",
    bookingMethod: "Call to schedule a tour — we'd love to meet your family",
    credentials: "Licensed by NY State OCFS · CPR certified staff · 15 years in early childhood education",
    vibe: `Examples:\n• "Warm, bright, and joyful — primary colors but not chaotic. Safe and welcoming to parents and kids alike."\n• "Calm and nurturing — soft yellows, sage green. Like a home, not an institution."\n• "Professional and trustworthy — clean blues and whites. Parents need to feel confident leaving their child."`,
  },
  church: {
    label: "Church / House of Worship",
    description: "Church, mosque, temple, or other house of worship",
    pages: ["Home","Worship Times","Ministries & Programs","About Us","Gallery","Giving","Contact"],
    defaultPages: ["Home","Worship Times","About Us","Contact"],
    differentiator: "We are more than a place of worship — we are a community anchor for everyone on this block",
    about: "This congregation was founded in 1952 by families who came north looking for something better. We've been here through everything this neighborhood has faced — and we're still here.",
    services: "Sunday worship services\nWednesday Bible study\nYouth ministry\nCommunity outreach programs\nFood pantry\nCounseling & support",
    priceRange: "All are welcome · No admission · Donations appreciated",
    bookingMethod: "Join us any Sunday at 10am · Call (718) 000-0000 for pastoral appointments",
    credentials: "Established 1952 · Active congregation of 300+ members · Fully accredited ministry",
    vibe: `Examples:\n• "Warm and welcoming — deep burgundy and gold, traditional but not stiff. Should feel like home."\n• "Modern and uplifting — bright whites, bold colors, contemporary. A church for this generation."\n• "Community-rooted and proud — strong, warm tones. The anchor of the neighborhood for 70 years."`,
  },
  cleaning: {
    label: "Cleaning Service",
    description: "Residential, commercial, move-out, deep cleaning",
    pages: ["Home","Our Services","About Us","Testimonials","Request a Quote","FAQ","Contact"],
    defaultPages: ["Home","Our Services","About Us","Testimonials","Contact"],
    differentiator: "We use eco-friendly products and every cleaner is background-checked and insured",
    about: "I started cleaning homes on my own in 2015 to support my family. Word spread fast. Now we're a full team serving the whole area.",
    services: "Residential cleaning\nDeep cleaning\nMove-in / move-out cleaning\nCommercial office cleaning\nPost-construction cleanup\nAirbnb turnovers",
    priceRange: "Studios from $90 · 1BR from $120 · Deep cleans from $180",
    bookingMethod: "Call or text for a free quote · Online booking available",
    credentials: "Fully insured and bonded · Background-checked staff · 500+ happy clients",
    vibe: `Examples:\n• "Clean, fresh, trustworthy — sky blue and white. Should feel like a deep breath of fresh air."\n• "Professional and warm — green and cream, eco-friendly energy. Not corporate, not cold."\n• "Bright and confident — bold colors, no-nonsense. We show up and we get it done."`,
  },
  florist: {
    label: "Florist",
    description: "Fresh flowers, arrangements, weddings, events, delivery",
    pages: ["Home","Our Arrangements","About Us","Gallery","Testimonials","Contact"],
    defaultPages: ["Home","Our Arrangements","About Us","Gallery","Contact"],
    differentiator: "Every arrangement is made by hand with fresh flowers — we never use artificial fillers",
    about: "Flowers have been in my family for three generations. My grandmother sold them from a cart on Fordham Road. I opened this shop to carry on what she started.",
    services: "Fresh flower arrangements\nWedding & event florals\nFuneral arrangements\nHoliday & seasonal designs\nCustom orders\nLocal delivery",
    priceRange: "Arrangements from $35 · Wedding packages from $500 · Custom quotes available",
    bookingMethod: "Walk-ins welcome · Call (718) 000-0000 to pre-order · Same-day delivery available",
    credentials: "Certified floral designer · 20+ years experience · Wedding specialist",
    vibe: `Examples:\n• "Fresh and botanical — deep greens, cream, natural textures. Should feel like walking into a garden."\n• "Romantic and warm — blush, ivory, gold. Perfect for the wedding and event work."\n• "Bold and colorful — vibrant, celebratory, full of life. The kind of shop that makes you smile walking past."`,
  },
  funeralhome: {
    label: "Funeral Home",
    description: "Funeral services, cremation, burial, grief support",
    pages: ["Home","Our Services","About Us","Pre-Need Planning","Testimonials","FAQ","Contact"],
    defaultPages: ["Home","Our Services","About Us","Contact"],
    differentiator: "We've been serving families in this community for generations — we understand what it means to grieve here",
    about: "My family has been serving this community through some of its hardest moments for over 40 years. We don't just provide a service — we walk alongside families when they need it most.",
    services: "Traditional funeral services\nCremation services\nGraveside services\nMemorial services\nPre-need planning\nGrief support resources",
    priceRange: "Services vary · Payment plans available · Pre-need arrangements accepted",
    bookingMethod: "Available 24 hours a day, 7 days a week · Call (718) 000-0000",
    credentials: "Licensed funeral director · 40+ years serving this community · Member of NFDA",
    vibe: `Examples:\n• "Dignified and warm — deep navy or burgundy, gold accents. Serious but not cold. Should feel like a place of comfort."\n• "Soft and peaceful — cream and sage, gentle. Calm and welcoming for families in pain."\n• "Traditional and respectful — classic colors, clear and professional. Families should feel they are in good hands."`,
  },
  laundromat: {
    label: "Laundromat",
    description: "Self-service laundry, wash & fold, dry cleaning drop-off",
    pages: ["Home","Our Services","About Us","Hours & Location","Contact"],
    defaultPages: ["Home","Our Services","About Us","Hours & Location","Contact"],
    differentiator: "We're open 7 days, always clean, and our wash & fold is back the same day",
    about: "I've been running this laundromat for over 20 years. In that time I've gotten to know hundreds of families in this neighborhood. It's more than a laundromat — it's a community stop.",
    services: "Self-service washers & dryers\nWash & fold (drop-off)\nDry cleaning drop-off\nLarge item washing (comforters, rugs)\nAlterations & tailoring",
    priceRange: "Wash & fold from $1.25/lb · Self-service from $3.50/load",
    bookingMethod: "Walk-in anytime · Wash & fold drop-off accepted all day",
    credentials: "Family-owned and operated · Open 7 days · 20+ years serving the neighborhood",
    vibe: `Examples:\n• "Clean and fresh — bright whites and sky blue. Should feel clean and welcoming, not dingy."\n• "Warm neighborhood spot — cream and warm tones. The kind of place people linger and chat."\n• "Simple and functional — clear, easy to read, no frills. Just tells people what they need to know."`,
  },
  legal: {
    label: "Law Office / Professional Services",
    description: "Law, accounting, insurance, financial services",
    pages: ["Home","Our Services","About Us","Testimonials","Free Consultation","FAQ","Contact"],
    defaultPages: ["Home","Our Services","About Us","FAQ","Contact"],
    differentiator: "We return every call within 24 hours — no chasing, no runaround",
    about: "I grew up in this neighborhood. When I passed the bar I came back because I knew these streets needed someone who actually understood the community.",
    services: "Immigration law\nFamily law\nPersonal injury\nCriminal defense\nSmall business formation\nWills & estate planning",
    priceRange: "Free initial consultation · Payment plans available",
    bookingMethod: "Call (718) 000-0000 for a free consultation · Available evenings and weekends",
    credentials: "Licensed in New York State since 2010 · Member of the NY State Bar Association",
    vibe: `Examples:\n• "Professional and trustworthy — deep navy and gold. Serious but approachable."\n• "Warm and community-rooted — not the cold corporate law firm. Earthy tones, human."\n• "Clean and confident — black and white, bold type. No clutter, no confusion. Just results."`,
  },
  nailsalon: {
    label: "Nail Salon",
    description: "Manicures, pedicures, acrylics, gel, nail art",
    pages: ["Home","Our Services","About Us","Gallery","Testimonials","Book an Appointment","Contact"],
    defaultPages: ["Home","Our Services","About Us","Testimonials","Contact"],
    differentiator: "We use only high-quality, non-toxic products and take the time to do it right every time",
    about: "I've been doing nails for over 15 years. I opened this salon because I wanted a clean, comfortable place in this neighborhood where women could come and feel taken care of.",
    services: "Manicures & pedicures\nAcrylic sets & fills\nGel manicures\nDip powder\nNail art & designs\nParaffin wax treatments",
    priceRange: "Manicure from $20 · Pedicure from $30 · Acrylic set from $45",
    bookingMethod: "Walk-ins welcome · Call (718) 000-0000 to book an appointment",
    credentials: "Licensed nail technician · 15+ years experience · Sanitized tools for every client",
    vibe: `Examples:\n• "Clean and feminine — soft pinks and whites, bright and airy. Should feel like a little luxury in the middle of the day."\n• "Bold and fun — bright colors, lots of personality. A place where people come to express themselves."\n• "Modern and sleek — neutral tones, minimalist. Feels upscale without being intimidating."`,
  },
  photography: {
    label: "Photography / Videography",
    description: "Portraits, events, weddings, commercial, content creation",
    pages: ["Home","Portfolio","About Us","Testimonials","Book an Appointment","Contact"],
    defaultPages: ["Home","Portfolio","About Us","Testimonials","Contact"],
    differentiator: "We don't just take photos — we tell your story. Every image is intentional.",
    about: "I picked up my first camera at 17 and I've never stopped. I've photographed hundreds of weddings, graduations, and business portraits — and every single one has meant something to me.",
    services: "Portrait photography\nWedding & event coverage\nNewborn & family sessions\nCommercial & branding photography\nContent creation for social media\nVideography & reels",
    priceRange: "Portraits from $150 · Events from $500 · Contact for custom packages",
    bookingMethod: "Book a consultation at (718) 000-0000 · Limited weekend dates available",
    credentials: "10+ years professional experience · 500+ sessions booked · Featured in [publication]",
    vibe: `Examples:\n• "Editorial and moody — dark backgrounds, film-inspired tones. Should feel like a magazine."\n• "Warm and natural — soft light, earthy tones. The kind of photographer families trust with their moments."\n• "Bold and modern — clean whites, strong contrast. Commercial feel, professional and sharp."`,
  },
  salon: {
    label: "Hair Salon",
    description: "Natural hair, braiding, locs, cuts, color, protective styles",
    pages: ["Home","Our Services","About Us","Gallery","Testimonials","Book an Appointment","Contact"],
    defaultPages: ["Home","Our Services","About Us","Testimonials","Contact"],
    differentiator: "We never double-book and we never rush — your appointment is yours",
    about: "I started braiding in my grandmother's kitchen at 14. After getting licensed I opened this shop because I wanted a place where people could sit in a chair and feel seen.",
    services: "Natural hair braiding\nLoc maintenance & retwist\nKids styles\nWedding & event styling\nColor & highlights\nProtective styles",
    priceRange: "Braids start at $120 · Locs from $85 · Kids styles from $60",
    bookingMethod: "Call or text (718) 000-0000 · Walk-ins welcome Tuesday–Friday",
    credentials: "Licensed cosmetologist since 2011 · 13 years serving the community",
    vibe: `Examples:\n• "Warm and bold — deep plum or burgundy, gold accents. Luxurious but approachable. Think candlelight and crown molding."\n• "Clean and bright — white walls, natural light, minimal. A calm place where people feel pampered."\n• "Bold Black-owned energy — dark background, gold, strong. Pride on every wall."`,
  },
  tailoring: {
    label: "Tailoring / Alterations",
    description: "Clothing alterations, custom tailoring, repairs, hemming",
    pages: ["Home","Our Services","About Us","Gallery","Testimonials","Contact"],
    defaultPages: ["Home","Our Services","About Us","Testimonials","Contact"],
    differentiator: "Every alteration is done by hand — we never rush a stitch",
    about: "I learned to sew from my mother in Trinidad. I've been altering and tailoring clothes in this neighborhood for over 25 years. Every piece that comes through my door gets the same care.",
    services: "Hemming & alterations\nTaking in & letting out\nZipper repair & replacement\nCustom tailoring\nWedding dress alterations\nLeather & specialty fabric work",
    priceRange: "Hems from $15 · Most alterations $20–$60 · Custom work priced by project",
    bookingMethod: "Walk-ins welcome Mon–Sat · Call (718) 000-0000 for fitting appointments",
    credentials: "25+ years experience · Wedding specialist · All fabric types accepted",
    vibe: `Examples:\n• "Old world craft — warm cream and deep teal, vintage feeling. Skilled hands, trusted work."\n• "Clean and professional — simple, organized. Lets the work speak for itself."\n• "Warm neighborhood shop — earthy tones, lived-in. The kind of place you've been going for years."`,
  },
  taxnotary: {
    label: "Tax Preparer / Notary / Immigration",
    description: "Tax preparation, notary services, immigration forms, ITIN",
    pages: ["Home","Our Services","About Us","Testimonials","FAQ","Contact"],
    defaultPages: ["Home","Our Services","About Us","FAQ","Contact"],
    differentiator: "We speak your language — literally. We serve this community in English, Spanish, and Creole.",
    about: "I started doing taxes at my kitchen table for neighbors who didn't know where to turn. 15 years later we've helped over 2,000 families navigate the system.",
    services: "Individual & business tax preparation\nITIN applications\nNotary public services\nImmigration form assistance\nTranslation services\nBookkeeping",
    priceRange: "Individual returns from $75 · Business returns from $150 · Notary from $10",
    bookingMethod: "Walk-ins welcome · Call (718) 000-0000 · Evening and weekend hours available",
    credentials: "IRS VITA certified · Notary Public · 15 years serving this community · Multilingual staff",
    vibe: `Examples:\n• "Trustworthy and professional — navy and gold, clean. Should feel like a place where your information is safe."\n• "Warm and community-rooted — approachable, not intimidating. We're here to help, not judge."\n• "Clear and simple — bright, organized, easy to navigate. People should feel confident walking in."`,
  },
  tutoring: {
    label: "Tutoring / Test Prep",
    description: "Academic tutoring, SAT/ACT prep, homework help, enrichment",
    pages: ["Home","Our Services","About Us","Testimonials","Free Consultation","FAQ","Contact"],
    defaultPages: ["Home","Our Services","About Us","Testimonials","Contact"],
    differentiator: "We work with each student individually — no group sessions, no one-size-fits-all curriculum",
    about: "I was a public school teacher for 12 years before I opened this center. I've seen too many kids fall through the cracks. We exist to make sure that doesn't happen.",
    services: "One-on-one tutoring\nSAT & ACT prep\nRegents exam prep\nHomework help\nReading & writing support\nMath from elementary through calculus",
    priceRange: "Individual sessions from $60/hr · Packages available",
    bookingMethod: "Call (718) 000-0000 for a free assessment · Evening and weekend sessions available",
    credentials: "NYS certified teachers · 10+ years experience · 95% of students improved their grade",
    vibe: `Examples:\n• "Warm and encouraging — blues and yellows, optimistic. Should feel like a place where kids actually want to be."\n• "Professional and focused — clean, organized, no distractions. Parents trust it immediately."\n• "Community-rooted — neighborhood pride, approachable, not intimidating. We're here for every kid."`,
  },
  wellness: {
    label: "Wellness / Spa / Fitness",
    description: "Massage, acupuncture, yoga, fitness, therapy, spa",
    pages: ["Home","Our Services","About Us","Gallery","Testimonials","Book an Appointment","Contact"],
    defaultPages: ["Home","Our Services","About Us","Testimonials","Contact"],
    differentiator: "Every session is customized — we don't do cookie-cutter treatments",
    about: "I became a licensed massage therapist after recovering from a sports injury that changed how I thought about my own body. I opened this practice to help others feel that same transformation.",
    services: "Swedish & deep tissue massage\nAromatherapy\nCupping therapy\nPrenatal massage\nHot stone massage\nReflexology",
    priceRange: "60 min from $90 · 90 min from $130 · Packages available",
    bookingMethod: "Book online or call (718) 000-0000 · Same-week appointments usually available",
    credentials: "Licensed massage therapist since 2014 · 500-hour certification · Member of ABMP",
    vibe: `Examples:\n• "Calm and healing — soft neutrals, warm candlelight tones. The stress leaves your body just looking at it."\n• "Modern wellness — clean whites and sage green. Spa-like but approachable."\n• "Warm and earthy — terracotta, natural wood tones. Grounded and holistic."`,
  },
  other: {
    label: "Other Service Business",
    description: "Any local service not listed above",
    pages: ["Home","Our Services","About Us","Gallery","Testimonials","FAQ","Contact"],
    defaultPages: ["Home","Our Services","About Us","Testimonials","Contact"],
    differentiator: "We take pride in every job and stand behind our work",
    about: "I started this business because I saw a need in my community and I knew I could fill it.",
    services: "List your services here — one per line",
    priceRange: "Contact us for a free quote",
    bookingMethod: "Call or text us to get started",
    credentials: "Years of experience serving this community",
    vibe: `Examples:\n• "Professional but warm — trustworthy colors, clean layout. A business that knows what it's doing."\n• "Bold and community-rooted — strong colors, neighborhood pride. Not corporate."\n• "Clean and modern — simple, confident, easy to navigate."`,
  },
};

const RESTAURANT_SUBTYPES = {
  african: { label: "West African / African",      cuisine: "West African, Nigerian, Ghanaian, Senegalese" },
  american: { label: "American / Diner",            cuisine: "Classic American, diner food, burgers, comfort food" },
  asian: { label: "Asian",                       cuisine: "Chinese, Thai, Vietnamese, Korean, Japanese" },
  bakery: { label: "Bakery / Café",               cuisine: "Bakery, café, pastries, coffee" },
  caribbean: { label: "Caribbean / West Indian",    cuisine: "Caribbean, Jamaican, Trinidadian, West Indian" },
  catering: { label: "Catering Only",               cuisine: "Catering, events, private dining" },
  foodTruck: { label: "Food Truck / Pop-Up",         cuisine: "Food truck, street food, pop-up" },
  italian: { label: "Italian / Pizza",             cuisine: "Italian, pizza, pasta" },
  mexican: { label: "Mexican / Latin",             cuisine: "Mexican, Dominican, Puerto Rican, Latin" },
  seafood: { label: "Seafood",                     cuisine: "Seafood, fish fry, crab, shrimp" },
  soulFood: { label: "Soul Food / Southern",        cuisine: "Soul food, Southern comfort cooking" },
  vegan: { label: "Vegan / Vegetarian",          cuisine: "Vegan, vegetarian, plant-based" },
  other: { label: "Other",                       cuisine: "" },
};

const RETAIL_SUBTYPES = {
  beauty: { label: "Beauty Supply",              description: "Hair care, cosmetics, beauty products, wigs" },
  boutique: { label: "Clothing / Boutique",        description: "Clothing, shoes, accessories, fashion" },
  cornerStore: { label: "Corner Store / Bodega",      description: "Corner store, bodega, convenience, deli" },
  electronics: { label: "Electronics / Phone Repair", description: "Phone repair, electronics, accessories" },
  furniture: { label: "Furniture / Home Goods",     description: "Furniture, home decor, appliances" },
  giftShop: { label: "Gift Shop / Florist",        description: "Gifts, flowers, candles, specialty items" },
  grocery: { label: "Grocery / Market",           description: "Grocery, fresh produce, specialty foods, market" },
  pharmacy: { label: "Pharmacy / Drug Store",      description: "Independent pharmacy, drug store, health products" },
  sportswear: { label: "Sportswear / Sneakers",      description: "Athletic wear, sneakers, streetwear" },
  other: { label: "Other",                      description: "Any other retail business" },
};

// ─── COLOR SWATCHES ───────────────────────────────────────────────
const COLOR_SWATCHES = [
  { hex:"#c87927", name:"Warm amber",    desc:"Classic neighborhood energy", vibes:["warm","bold"] },
  { hex:"#d4501a", name:"Brick orange",  desc:"Bold, confident, strong",     vibes:["bold","warm"] },
  { hex:"#b83232", name:"Deep red",      desc:"Rich, powerful, passionate",  vibes:["bold","classic"] },
  { hex:"#8b2e2e", name:"Burgundy",      desc:"Dignified, warm, refined",    vibes:["classic","warm"] },
  { hex:"#c44569", name:"Rose",          desc:"Warm, feminine, inviting",    vibes:["soft","warm"] },
  { hex:"#9b59b6", name:"Purple",        desc:"Creative, luxurious, bold",   vibes:["bold","calm"] },
  { hex:"#2c3e8c", name:"Deep navy",     desc:"Trustworthy, professional",   vibes:["classic","calm"] },
  { hex:"#1a6b8a", name:"Ocean blue",    desc:"Clean, calm, coastal",        vibes:["calm"] },
  { hex:"#2980b9", name:"Bright blue",   desc:"Fresh, modern, open",         vibes:["calm","soft"] },
  { hex:"#16a085", name:"Teal",          desc:"Fresh, balanced, healing",    vibes:["calm","soft"] },
  { hex:"#27ae60", name:"Forest green",  desc:"Natural, growth, community",  vibes:["calm","soft"] },
  { hex:"#3a6e4f", name:"Deep green",    desc:"Trustworthy, grounded",       vibes:["classic","calm"] },
  { hex:"#7d6b4f", name:"Mocha",         desc:"Warm, cozy, approachable",    vibes:["warm","soft"] },
  { hex:"#5d4037", name:"Espresso",      desc:"Rich, grounded, artisan",     vibes:["warm","classic"] },
  { hex:"#546e7a", name:"Slate",         desc:"Modern, calm, professional",  vibes:["calm","classic"] },
  { hex:"#37474f", name:"Charcoal",      desc:"Bold, industrial, strong",    vibes:["bold","classic"] },
  { hex:"#e91e8c", name:"Hot pink",      desc:"Vibrant, energetic, fun",     vibes:["bold","soft"] },
  { hex:"#ff7043", name:"Coral",         desc:"Warm, friendly, lively",      vibes:["warm","soft"] },
  { hex:"#f4c430", name:"Gold",          desc:"Celebratory, premium",        vibes:["warm","bold"] },
  { hex:"#6d4c9e", name:"Violet",        desc:"Spiritual, creative, unique", vibes:["bold","calm"] },
];
const isLight = hex => {
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return (0.299*r+0.587*g+0.114*b)/255>0.5;
};

// ─── BUSINESS TYPES ───────────────────────────────────────────────
const BUSINESS_TYPES = [
  {
    id:"restaurant", label:"Restaurant / Food", icon:"restaurant",
    description:"Restaurant, café, bakery, food truck, catering",
    pages:["Home","Our Menu","About Us","Gallery","Hours & Location","Order / Reserve","Contact"],
    defaultPages:["Home","Our Menu","About Us","Hours & Location","Contact"],
    contentFields:[
      {key:"menuCategories",label:"Menu Categories",placeholder:"Appetizers, Mains, Desserts, Drinks, Daily Specials",type:"input"},
      {key:"menuHighlights",label:"Signature Dishes (your best 4–6)",hint:"One per line — name and a short description",placeholder:"Oxtail Stew — slow-cooked 6 hours, rice & peas\nJerk Chicken Platter — our #1 seller since 1998",type:"textarea"},
      {key:"priceRange",label:"Price Range",type:"select",options:["$ — Under $10","$$ — $10–$25","$$$ — $25–$50","$$$$ — Fine dining"]},
      {key:"cuisine",label:"Cuisine / Food Style",placeholder:"Caribbean, soul food, Dominican, West African…",type:"input"},
    ],
  },
  {
    id:"retail", label:"Store / Retail", icon:"retail",
    description:"Corner store, boutique, pharmacy, gift shop, grocery",
    pages:["Home","Our Products","Sales & Specials","About Us","Gallery","Contact"],
    defaultPages:["Home","Our Products","Sales & Specials","About Us","Contact"],
    contentFields:[
      {key:"productCategories",label:"What Do You Sell?",placeholder:"Prescriptions, vitamins, personal care, snacks, household",type:"input"},
      {key:"currentSpecials",label:"Current Specials / Deals",hint:"These appear as featured promotions on your site",placeholder:"10% off vitamins this week\nFree delivery on orders over $30",type:"textarea"},
      {key:"bestSellers",label:"Best-Selling Products (top 3–5)",placeholder:"Blood pressure monitors\nChildren's vitamins\nOrganic snack packs",type:"textarea"},
      {key:"deliveryInfo",label:"Delivery / Pickup Info",placeholder:"Free local delivery within 2 miles. Same-day pickup available.",type:"input"},
    ],
  },
  {
    id:"service", label:"Specialty Service", icon:"service",
    description:"Salon, law office, auto shop, cleaning, childcare, wellness",
    pages:["Home","Our Services","About Us","Gallery / Portfolio","Testimonials","Book an Appointment","FAQ","Contact"],
    defaultPages:["Home","Our Services","About Us","Testimonials","Contact"],
    contentFields:[
      {key:"services",label:"Your Services",hint:"One per line or comma-separated",placeholder:"Natural hair braiding\nLoc maintenance\nKids styles\nWedding & event styling",type:"textarea"},
      {key:"priceRange",label:"General Price Range",placeholder:"Braids start at $80 · Full sets from $150",type:"input"},
      {key:"bookingMethod",label:"How Do Clients Book?",placeholder:"Call or text (914) 555-0000 · Walk-ins welcome weekdays",type:"input"},
      {key:"credentials",label:"Credentials / Experience",hint:"Years in business, certifications, awards",placeholder:"Licensed cosmetologist since 2008. Featured in Essence Magazine.",type:"input"},
    ],
  },
];

// ─── LOADING MESSAGES ─────────────────────────────────────────────
// 5 high-level stages shown as pills. Each has 4 subtexts that
// rotate every 10s while that stage is active.
const LOADING_MESSAGES = [
  {
    label: "Researching",
    subtexts: [
      "Scanning Google for your business listing...",
      "Checking Yelp, TripAdvisor, and review sites...",
      "Looking for real customer quotes to feature...",
      "Finding your delivery and booking links...",
    ],
  },
  {
    label: "Planning",
    subtexts: [
      "Mapping out your sections and page structure...",
      "Choosing fonts and color palette for your vibe...",
      "Deciding which content goes where...",
      "Locking in your icon set and layout system...",
    ],
  },
  {
    label: "Designing",
    subtexts: [
      "Building your CSS design system from scratch...",
      "Drawing custom SVG icons for your services...",
      "Defining spacing, shadows, and card styles...",
      "Setting up animations and hover states...",
    ],
  },
  {
    label: "Building",
    subtexts: [
      "Writing your hero section and headline...",
      "Laying out your menu, services, or products...",
      "Composing your about section and origin story...",
      "Wiring up contact, hours, and directions...",
    ],
  },
  {
    label: "Polishing",
    subtexts: [
      "Checking every pixel and spacing detail...",
      "Making sure it works on a 6-inch screen...",
      "Adding SEO tags and Google schema data...",
      "Final quality check before delivery...",
    ],
  },
];

// ─── SHARED COMPONENTS ────────────────────────────────────────────

// The BLOCKSITE logo — real image, scales cleanly
function Logo({ height = 32, light = false }) {
  return (
    <img
      src={BLOCKSITE_LOGO}
      alt="BlockSite"
      style={{
        height,
        width: "auto",
        display: "block",
        // Invert for light backgrounds — logo is dark by default
        filter: light ? "brightness(0) invert(1)" : "none",
        userSelect: "none",
      }}
    />
  );
}

// Keep Wordmark as fallback text version
function Wordmark({ size = 24, light = false }) {
  return (
    <span style={{ fontFamily: FD, fontWeight: 900, fontSize: size, letterSpacing: "-0.02em", lineHeight: 1, color: light ? C.cream : C.ink, userSelect: "none" }}>
      BLOCK<span style={{ color: C.amber }}>SITE</span>
    </span>
  );
}

function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return m;
}

function Label({ children, hint }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontFamily: FB, fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: C.mid }}>{children}</div>
      {hint && <div style={{ fontFamily: FB, fontSize: 12, color: C.muted, marginTop: 3, fontStyle: "italic" }}>{hint}</div>}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Label hint={hint}>{label}</Label>
      {children}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", disabled, full, style = {} }) {
  const base = {
    fontFamily: FB, fontWeight: 600, fontSize: 15,
    padding: "13px 24px", borderRadius: 10, border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    width: full ? "100%" : "auto",
    transition: "opacity 0.18s, transform 0.18s",
    letterSpacing: "0.01em", display: "inline-block", textAlign: "center",
    ...style,
  };
  const variants = {
    primary:  { background: disabled ? "#ccc" : C.ink,   color: C.cream },
    amber:    { background: C.amber,  color: "#fff" },
    green:    { background: C.green,  color: "#fff" },
    navy:     { background: C.navy,   color: "#fff" },
    ghost:    { background: "transparent", color: C.mid, border: `1.5px solid ${C.rule}` },
    outline:  { background: C.warm,   color: C.ink,  border: `1.5px solid ${C.ink}` },
    stripe:   { background: "#635BFF", color: "#fff" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>{children}</button>;
}

function ErrorScreen({ errorDetails, onRetry, onEdit }) {
  return (
    <div className="fu">
      <div style={{ background: "#FEF2F2", border: `1.5px solid #EF4444`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
          <div>
            <div style={{ fontFamily: FB, fontWeight: 700, fontSize: 15, color: "#991B1B", marginBottom: 6 }}>Something went wrong</div>
            <div style={{ fontFamily: FB, fontSize: 14, color: "#7F1D1D", lineHeight: 1.7, marginBottom: 10 }}><strong>What happened:</strong> {errorDetails.message}</div>
            <div style={{ fontFamily: FB, fontSize: 14, color: "#7F1D1D", background: "#FEE2E2", borderRadius: 8, padding: "10px 14px", lineHeight: 1.7 }}><strong>What to do:</strong> {errorDetails.hint}</div>
            {errorDetails.raw && (
              <details style={{ marginTop: 10 }}>
                <summary style={{ fontFamily: FB, fontSize: 12, color: "#9B1C1C", cursor: "pointer" }}>Technical details</summary>
                <div style={{ fontFamily: "monospace", fontSize: 11, color: "#9B1C1C", marginTop: 6, background: "#FEE2E2", padding: "8px 10px", borderRadius: 6, wordBreak: "break-all" }}>{errorDetails.raw}</div>
              </details>
            )}
          </div>
        </div>
      </div>
      <div style={{ background: "#F0FDF4", border: `1.5px solid ${C.green}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 18 }}>🔒</span>
        <div style={{ fontFamily: FB, fontSize: 13, color: "#166534" }}>Your info is saved. You have not been charged. Fix the issue and retry.</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Btn onClick={onRetry} full>🔄 Try Again</Btn>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <Btn variant="ghost" onClick={() => onEdit(3)} style={{ fontSize: 13, padding: "9px 12px" }}>✏️ Edit Vibe</Btn>
          <Btn variant="ghost" onClick={() => onEdit(4)} style={{ fontSize: 13, padding: "9px 12px" }}>Photos</Btn>
          <Btn variant="ghost" onClick={() => onEdit(2)} style={{ fontSize: 13, padding: "9px 12px" }}>📝 Edit Info</Btn>
        </div>
        <div style={{ textAlign: "center" }}>
          <a href="mailto:hello@blocksitebuilder.com" style={{ fontFamily: FB, fontSize: 13, color: C.mid, textDecoration: "underline" }}>Still stuck? Email us — we'll fix it for free.</a>
        </div>
      </div>
    </div>
  );
}

// ─── PHOTO UPLOADER ───────────────────────────────────────────────
function PhotoUploader({ photos, setPhotos }) {
  const ref = useRef();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const compress = (file) => new Promise(resolve => {
    const originalSize = file.size;
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let { width: w, height: h } = img;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        const dataUrl = c.toDataURL("image/jpeg", 0.85);
        const compressedKB = Math.round(dataUrl.length * 0.75 / 1024);
        const originalMB = (originalSize / 1024 / 1024).toFixed(1);
        resolve({ dataUrl, name: file.name, originalMB, compressedKB });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  const uploadToBlob = async (compressed) => {
    try {
      const res = await fetch("https://blocksite-api.vercel.app/api/upload-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoBase64: compressed.dataUrl,
          fileName: compressed.name,
          mimeType: "image/jpeg",
        }),
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      return data.url;
    } catch(e) {
      console.error("Blob upload error:", e.message);
      return compressed.dataUrl; // fallback to base64
    }
  };

  const handleFiles = async (files) => {
    const slots = 6 - photos.length;
    const incoming = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, slots);
    if (!incoming.length) return;
    setUploading(true);
    const results = [];
    for (let i = 0; i < incoming.length; i++) {
      setUploadStatus(`Uploading photo ${i + 1} of ${incoming.length}…`);
      const compressed = await compress(incoming[i]);
      const url = await uploadToBlob(compressed);
      results.push({
        url,
        preview: compressed.dataUrl,
        name: compressed.name,
        originalMB: compressed.originalMB,
        compressedKB: compressed.compressedKB,
        isHosted: url.startsWith("https://"),
      });
    }
    setPhotos(prev => [...prev, ...results]);
    setUploading(false);
    setUploadStatus(`${results.length} photo${results.length > 1 ? "s" : ""} ready`);
    setTimeout(() => setUploadStatus(""), 3000);
  };

  return (
    <div>
      <div
        onClick={() => !uploading && ref.current.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        style={{
          border: `2px dashed ${dragging ? C.amber : uploading ? C.green : C.rule}`,
          borderRadius: 14, padding: "28px 20px", textAlign: "center",
          cursor: uploading ? "wait" : "pointer",
          background: dragging ? C.amberL : uploading ? "#f0fdf4" : C.warm,
          transition: "all 0.2s", marginBottom: 14,
        }}
      >
        {uploading ? (
          <>
            <div style={{ width: 28, height: 28, border: `3px solid ${C.green}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
            <div style={{ fontFamily: FB, fontSize: 14, color: C.green, fontWeight: 600 }}>{uploadStatus}</div>
          </>
        ) : (
          <>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 8 }}>
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <div style={{ fontFamily: FD, fontSize: 17, color: C.ink, marginBottom: 4, fontWeight: 700 }}>Drop photos here, or tap to upload</div>
            <div style={{ fontFamily: FB, fontSize: 12, color: C.muted }}>Up to 6 photos · Optimized & hosted · Go right into your site</div>
          </>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />

      {uploadStatus && !uploading && (
        <div style={{ fontFamily: FB, fontSize: 13, color: C.green, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          {uploadStatus}
        </div>
      )}

      {photos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {photos.map((p, i) => (
            <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", border: `1.5px solid ${C.rule}` }}>
              <img src={p.preview || p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))} style={{ position: "absolute", top: 5, right: 5, width: 24, height: 24, borderRadius: "50%", background: "#1c1a14cc", color: "#fff", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#1c1a14bb", padding: "3px 6px" }}>
                <div style={{ fontFamily: FB, fontSize: 9, color: p.isHosted ? "#4ade80" : "#fbbf24", textAlign: "center" }}>
                  {p.isHosted ? `${p.originalMB}MB → ${p.compressedKB}KB ✓ hosted` : `${p.compressedKB}KB`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PACKAGE PICKER ───────────────────────────────────────────────
function PackagePicker({ selected, onSelect }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {PACKAGES.map((pkg, idx) => {
        const isSel = selected === pkg.id;
        return (
          <div key={pkg.id} onClick={() => onSelect(pkg.id)}
            style={{
              border: `2px solid ${isSel ? pkg.color : C.rule}`,
              borderRadius: 16, padding: "24px 22px",
              cursor: "pointer",
              background: isSel ? `${pkg.color}08` : C.warm,
              transition: "all 0.2s",
              boxShadow: isSel ? `0 0 0 4px ${pkg.color}16` : "none",
              position: "relative", overflow: "hidden",
            }}
          >
            {/* Accent bar */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: isSel ? pkg.color : "transparent", transition: "all 0.2s" }} />

            {pkg.badge && (
              <div style={{ position: "absolute", top: -1, right: 16, background: pkg.color, color: "#fff", fontFamily: FB, fontSize: 11, fontWeight: 700, padding: "4px 14px", borderRadius: "0 0 8px 8px", letterSpacing: "0.06em", textTransform: "uppercase" }}>{pkg.badge}</div>
            )}

            {/* Radio + name row */}
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 2, border: `2px solid ${isSel ? pkg.color : C.rule}`, background: isSel ? pkg.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                {isSel && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 4 }}>
                  <div>
                    <div style={{ fontFamily: FB, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: pkg.color, marginBottom: 4 }}>{pkg.name}</div>
                    <div style={{ fontFamily: FD, fontSize: 42, fontWeight: 900, color: pkg.color, lineHeight: 1 }}>${pkg.price}</div>
                  </div>
                  <div style={{ fontFamily: FB, fontSize: 13, color: C.mid, fontStyle: "italic", maxWidth: 200, textAlign: "right", lineHeight: 1.5, paddingTop: 4 }}>{pkg.tagline}</div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: C.rule, marginBottom: 16 }} />

            {/* Features */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: pkg.notIncluded.length ? 12 : 0 }}>
              {pkg.features.map(f => (
                <div key={f} style={{ display: "flex", gap: 10, fontFamily: FB, fontSize: 13, color: C.ink, alignItems: "flex-start" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={pkg.color} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="20 6 9 17 4 12"/></svg>
                  <span>{f}</span>
                </div>
              ))}
            </div>

            {/* Not included */}
            {pkg.notIncluded.length > 0 && (
              <div style={{ borderTop: `1px dashed ${C.rule}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontFamily: FB, fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Not included</div>
                {pkg.notIncluded.map(f => (
                  <div key={f} style={{ display: "flex", gap: 10, fontFamily: FB, fontSize: 12, color: C.muted, alignItems: "flex-start" }}>
                    <span style={{ flexShrink: 0, marginTop: 1 }}>–</span><span>{f}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── DEPLOY GUIDE ─────────────────────────────────────────────────
function StepIllustration({ type }) {
  const base = { borderRadius: 10, overflow: "hidden", border: `1.5px solid ${C.rule}`, marginBottom: 12, background: C.warm };
  const bar = (color) => <div style={{ background: color, height: 28, display: "flex", alignItems: "center", padding: "0 12px", gap: 6 }}>
    {["#ff5f57","#febc2e","#28c840"].map((c,i) => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
  </div>;

  if (type === "email") return (
    <div style={base}>
      {bar("#e8e8e8")}
      <div style={{ padding: "12px 16px" }}>
        <div style={{ fontFamily: FB, fontSize: 11, color: C.muted, marginBottom: 6 }}>From: BlockSite {"<"}hello@blocksitebuilder.com{">"}</div>
        <div style={{ fontFamily: FB, fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Your BlockSite website is ready!</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.paper, borderRadius: 6, padding: "8px 12px" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <div>
            <div style={{ fontFamily: FB, fontSize: 11, fontWeight: 700, color: C.ink }}>yourbusiness.html</div>
            <div style={{ fontFamily: FB, fontSize: 10, color: C.muted }}>Your website — click to save</div>
          </div>
          <div style={{ marginLeft: "auto", background: C.amber, color: "#fff", fontFamily: FB, fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 4 }}>Save</div>
        </div>
      </div>
    </div>
  );

  if (type === "netlify-signup") return (
    <div style={base}>
      {bar("#00ad9f")}
      <div style={{ padding: "16px", textAlign: "center" }}>
        <div style={{ fontFamily: FB, fontSize: 13, fontWeight: 700, color: "#00ad9f", marginBottom: 12 }}>netlify.com</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 220, margin: "0 auto" }}>
          <div style={{ background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 6, padding: "8px 12px", fontFamily: FB, fontSize: 12, color: C.muted, textAlign: "left" }}>your@email.com</div>
          <div style={{ background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 6, padding: "8px 12px", fontFamily: FB, fontSize: 12, color: C.muted, textAlign: "left" }}>password</div>
          <div style={{ background: "#00ad9f", borderRadius: 6, padding: "10px", fontFamily: FB, fontSize: 12, fontWeight: 700, color: "#fff" }}>Sign up free →</div>
        </div>
      </div>
    </div>
  );

  if (type === "netlify-deploy") return (
    <div style={base}>
      {bar("#00ad9f")}
      <div style={{ padding: "16px" }}>
        <div style={{ border: `2px dashed #00ad9f`, borderRadius: 8, padding: "20px", textAlign: "center", background: "#f0fdf9" }}>
          <div style={{ fontFamily: FB, fontSize: 12, fontWeight: 700, color: "#00ad9f", marginBottom: 4 }}>Drop your site file here</div>
          <div style={{ fontFamily: FB, fontSize: 11, color: C.muted, marginBottom: 10 }}>or click to browse</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.warm, border: `1px solid ${C.rule}`, borderRadius: 6, padding: "6px 12px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>
            <span style={{ fontFamily: FB, fontSize: 11, color: C.ink }}>yourbusiness.html</span>
          </div>
        </div>
        <div style={{ marginTop: 10, background: "#f0fdf9", borderRadius: 6, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00ad9f" }} />
          <div style={{ fontFamily: FB, fontSize: 11, color: "#166534" }}>Site is live at <span style={{ fontWeight: 700 }}>happy-star-12345.netlify.app</span></div>
        </div>
      </div>
    </div>
  );

  if (type === "domain") return (
    <div style={base}>
      {bar("#e8e8e8")}
      <div style={{ padding: "12px 16px" }}>
        <div style={{ fontFamily: FB, fontSize: 11, color: C.muted, marginBottom: 8 }}>namecheap.com</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, background: C.paper, border: `1px solid ${C.rule}`, borderRadius: 6, padding: "8px 10px", fontFamily: FB, fontSize: 12, color: C.ink }}>rosaскаяkitchen.com</div>
          <div style={{ background: C.ink, color: C.cream, borderRadius: 6, padding: "8px 12px", fontFamily: FB, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Search</div>
        </div>
        <div style={{ background: "#f0fdf4", borderRadius: 6, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: FB, fontSize: 12, fontWeight: 700, color: "#166534" }}>yourbusiness.com ✓</div>
            <div style={{ fontFamily: FB, fontSize: 11, color: C.muted }}>Available!</div>
          </div>
          <div style={{ fontFamily: FB, fontSize: 12, fontWeight: 700, color: C.green }}>$10.98/yr</div>
        </div>
      </div>
    </div>
  );

  if (type === "google") return (
    <div style={base}>
      {bar("#e8e8e8")}
      <div style={{ padding: "12px 16px" }}>
        <div style={{ fontFamily: FB, fontSize: 11, color: C.muted, marginBottom: 8 }}>business.google.com</div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "#4285f4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          </div>
          <div>
            <div style={{ fontFamily: FB, fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 2 }}>Your Business Name</div>
            <div style={{ fontFamily: FB, fontSize: 11, color: C.muted, marginBottom: 6 }}>123 Main St · Open now · ⭐⭐⭐⭐⭐</div>
            <div style={{ background: "#f0fdf4", borderRadius: 4, padding: "4px 8px", display: "inline-block" }}>
              <div style={{ fontFamily: FB, fontSize: 10, fontWeight: 700, color: "#166534" }}>✓ Verified by Google</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return null;
}

function DeployGuide({ businessName, packageId }) {
  if (packageId === "fullservice") {
    return (
      <div style={{ background: "#f0fdf4", border: `1.5px solid ${C.green}`, borderRadius: 12, padding: "24px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.green, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>
            <div style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, color: "#166534", marginBottom: 6 }}>We handle everything — you're done.</div>
            <div style={{ fontFamily: FB, fontSize: 14, color: "#166534", lineHeight: 1.75 }}>
              You'll receive an email from us within 24 hours to confirm your details and kick off your launch. We'll handle the domain, hosting, and Google Business updates. All you need to do is watch your inbox.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const steps = [
    {
      n: "1", illustration: "email",
      title: "Save your website file",
      body: "Your website is being emailed to the address you provided. When it arrives, you'll see a file attached. Save it to your Desktop — double-click it anytime to see exactly what your live site looks like.",
      tip: "Can't find the email? Check your spam folder and search for 'BlockSite'.",
    },
    {
      n: "2", illustration: "netlify-signup",
      title: "Create a free Netlify account",
      body: "Go to netlify.com and sign up with your email and a password. No credit card. Takes 2 minutes.",
      tip: "Use your regular email address — this is where Netlify will send you updates about your site.",
    },
    {
      n: "3", illustration: "netlify-deploy",
      title: "Drag your file to go live",
      body: "In Netlify, find the \"Deploy manually\" section and drag your website file into the box. In under 60 seconds you'll have a real web address anyone can visit. Your site is live.",
      tip: "Write down or copy that web address — you'll need it for the next steps.",
    },
    {
      n: "4", illustration: "domain",
      title: "Get a real domain name (recommended)",
      body: "Go to namecheap.com, search your business name, and buy a .com — about $10–12/year, less than a chopped cheese. Buy 5–10 years upfront if you can: locks in the price, you never worry about it expiring, and even 10 years costs less than a case of Corona. Netlify walks you through connecting it — no technical knowledge needed.",
      tip: "If yourbusiness.com is taken, try yourbusinessnyc.com, myyourbusiness.com, or yourbusiness.net.",
    },
    {
      n: "5", illustration: "google",
      title: "Get on Google — most important step",
      body: "Free and the #1 thing that gets you found when people search nearby. Here's exactly how:",
      substeps: [
        "Go to business.google.com and sign in with your Google account (same one you use for Gmail)",
        "Click 'Add your business' and search your business name",
        "Choose your business category and fill in your address, phone, and hours",
        "Add your new website address (your Netlify link or custom domain)",
        "Click Verify — Google mails a postcard to your address with a code (5–14 days)",
        "When the postcard arrives, log back in and enter the code",
        "Add at least 5 photos — storefront, products, your team",
        "Ask your first regulars to leave you a Google review — even 5 reviews makes a big difference",
      ],
      tip: "Once verified, you show up on Google Maps and in local searches. This is the whole game.",
    },
    {
      n: "6",
      title: "Check it on your phone",
      body: "Open your live site on your actual phone. Tap every button. Try submitting the contact form with a test message. If anything looks off, email us at hello@blocksitebuilder.com and we'll sort it out.",
      tip: "Show it to a friend or family member — fresh eyes catch things you miss.",
    },
  ];

  return (
    <div>
      <div style={{ background: "#f0fdf4", border: `1px solid ${C.green}40`, borderRadius: 10, padding: "14px 18px", marginBottom: 28, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}><polyline points="20 6 9 17 4 12"/></svg>
        <div>
          <div style={{ fontFamily: FB, fontWeight: 700, color: "#166534", fontSize: 13, marginBottom: 2 }}>No coding. No tech experience needed.</div>
          <div style={{ fontFamily: FB, fontSize: 12, color: "#166534", lineHeight: 1.6 }}>These steps are designed for someone doing this for the first time. If you get stuck at any point, email us at hello@blocksitebuilder.com — we'll walk you through it personally.</div>
        </div>
      </div>

      {steps.map((s, idx) => (
        <div key={s.n} style={{ marginBottom: 36 }}>
          {/* Step header */}
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.ink, color: C.cream, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FB, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{s.n}</div>
            <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 17, color: C.ink, lineHeight: 1.3 }}>{s.title}</div>
          </div>

          {/* Illustration */}
          {s.illustration && <StepIllustration type={s.illustration} />}

          {/* Body */}
          <div style={{ fontFamily: FB, fontSize: 14, color: C.mid, lineHeight: 1.85, marginBottom: s.substeps ? 12 : 0 }}>{s.body}</div>

          {/* Substeps */}
          {s.substeps && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "12px 0", paddingLeft: 4 }}>
              {s.substeps.map((sub, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: C.amberL, color: C.amberD, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FB, fontWeight: 700, fontSize: 11, flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                  <div style={{ fontFamily: FB, fontSize: 13, color: C.ink, lineHeight: 1.75 }}>{sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tip */}
          {s.tip && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: C.amberL, borderRadius: 8, padding: "10px 14px", marginTop: 12 }}>
              <div style={{ fontFamily: FB, fontSize: 11, fontWeight: 700, color: C.amberD, flexShrink: 0, marginTop: 1 }}>TIP</div>
              <div style={{ fontFamily: FB, fontSize: 13, color: C.amberD, lineHeight: 1.6 }}>{s.tip}</div>
            </div>
          )}

          {/* Divider */}
          {idx < steps.length - 1 && <div style={{ height: 1, background: C.rule, marginTop: 28 }} />}
        </div>
      ))}
    </div>
  );
}

// ─── WATERMARKED PREVIEW ──────────────────────────────────────────
function WatermarkedPreview({ html, businessName }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: `2px solid ${C.rule}`, boxShadow: "0 8px 40px #1c1a1418" }}>
      {/* Browser chrome */}
      <div style={{ background: C.paper, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.rule}` }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["#EF4444","#F59E0B","#10B981"].map((col, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: col }} />)}
        </div>
        <div style={{ flex: 1, background: C.warm, borderRadius: 6, padding: "4px 12px", fontFamily: FB, fontSize: 11, color: C.muted, border: `1px solid ${C.rule}` }}>
          {(businessName || "yourbusiness").toLowerCase().replace(/\s+/g, "")}.com — preview
        </div>
      </div>

      {/* iframe */}
      <div style={{ position: "relative" }}>
        <iframe srcDoc={html} style={{ width: "100%", height: isMobile ? 400 : 520, border: "none", display: "block" }} title="Preview" />
        {/* Watermark */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", userSelect: "none" }}>
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: 0.20, pointerEvents: "none" }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} style={{ position: "absolute", top: `${i * 16 - 8}%`, left: "-20%", width: "140%", fontFamily: FD, fontWeight: 900, fontSize: 18, color: C.ink, transform: "rotate(-18deg)", whiteSpace: "nowrap", letterSpacing: "1.8em" }}>
                BLOCKSITE PREVIEW ONLY ·{"\u00a0"}BLOCKSITE PREVIEW ONLY·{"\u00a0"}
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", inset: 0, cursor: "default", pointerEvents: "none" }} title="Choose a package below to download" />
        </div>
      </div>

      <div style={{ background: C.amberL, borderTop: `1px solid ${C.amber}40`, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: FB, fontSize: 13, color: C.amberD, fontWeight: 500 }}>Preview only — choose a package below to get your site</div>
        <div style={{ fontFamily: FB, fontSize: 12, color: C.amber }}>Watermark removed after payment</div>
      </div>
    </div>
  );
}

// ─── LANDING PAGE ─────────────────────────────────────────────────
// ─── PHOTOS ───────────────────────────────────────────────────────
// Unsplash free-to-use images — neighborhood / local business feel
const PHOTOS = {
  // Hero: moody barbershop interior — warm, neighborhood, dark enough for text
  hero: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1600&q=80&fit=crop",
  // Story section: warm local business owner / counter scene
  story: "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=900&q=80&fit=crop",
  // Community break: NYC neighborhood street level
  community: "https://shopyourcity.cityofnewyork.us/wp-content/uploads/2022/03/Roosevelt-QN-scaled.jpg",
};

function LandingPage({ onStart }) {
  const isMobile = useIsMobile();

  const storyRef   = useRef(null);
  const howRef     = useRef(null);
  const pricingRef = useRef(null);

  const scrollTo = (ref) => {
    if (ref.current) ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const sectionPad = { padding: isMobile ? "72px 20px" : "100px 40px" };

  return (
    <div style={{ fontFamily: FB, color: C.ink, background: C.cream, overflowX: "hidden" }}>
      <style>{`
        .scroll-inner { display:flex; gap:40px; animation: marquee 28s linear infinite; white-space:nowrap; }
        @keyframes marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .pkg-card { transition: transform 0.22s ease, box-shadow 0.22s ease; }
        .pkg-card:hover { transform: translateY(-5px); box-shadow: 0 20px 60px #1c1a1422; }
        .nav-btn { background:none; border:none; cursor:pointer; font-family:${FB}; font-size:14px; color:${C.mid}; font-weight:500; padding:6px 0; transition:color 0.18s; letter-spacing:0.01em; }
        .nav-btn:hover { color:${C.ink}; }
        .cta-primary { transition: transform 0.18s, box-shadow 0.18s; }
        .cta-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 36px #1c1a1438; }
        .step-row { transition: background 0.2s; border-radius: 12px; }
        .step-row:hover { background: ${C.paper}; }
        .testimonial-card { transition: transform 0.2s; }
        .testimonial-card:hover { transform: translateY(-3px); }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 200,
        background: `${C.cream}f0`,
        backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
        borderBottom: `1px solid ${C.rule}`,
        padding: "0 24px", height: 62,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <Logo height={isMobile ? 48 : 60} />
        {!isMobile && (
          <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
            <button className="nav-btn" onClick={() => scrollTo(storyRef)}>Our Story</button>
            <button className="nav-btn" onClick={() => scrollTo(howRef)}>How It Works</button>
            <button className="nav-btn" onClick={() => scrollTo(pricingRef)}>Pricing</button>
          </div>
        )}
        <button onClick={onStart} className="cta-primary" style={{
          fontFamily: FB, fontWeight: 600, fontSize: isMobile ? 13 : 14,
          background: C.ink, color: C.cream, border: "none", borderRadius: 8,
          padding: isMobile ? "9px 16px" : "10px 22px", cursor: "pointer",
          whiteSpace: "nowrap", flexShrink: 0, letterSpacing: "0.01em",
        }}>
          {isMobile ? "Get Started →" : "Preview My Site Free →"}
        </button>
      </nav>

      {/* ── HERO — full bleed photo with dark overlay ── */}
      <div style={{
        minHeight: "100svh",
        position: "relative",
        display: "flex", flexDirection: "column",
        justifyContent: "flex-end",
        overflow: "hidden",
      }}>
        {/* Background photo */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${PHOTOS.hero})`,
          backgroundSize: "cover", backgroundPosition: "center 60%",
        }} />
        {/* Gradient overlay — darker for barbershop photo + text legibility */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(28,26,20,0.55) 0%, rgba(28,26,20,0.80) 55%, rgba(28,26,20,0.97) 100%)",
        }} />

        {/* Content — bottom-anchored editorial layout */}
        <div style={{
          position: "relative", zIndex: 2,
          padding: isMobile ? "0 20px 56px" : "0 60px 72px",
          maxWidth: 1100,
        }}>
          <div className="fu" style={{
            fontFamily: FB, fontSize: isMobile ? 11 : 12, fontWeight: 600,
            letterSpacing: "0.2em", textTransform: "uppercase",
            color: C.amber, marginBottom: 20,
          }}>
            Your Block · Your Story · Your Site
          </div>

          <h1 style={{
            fontFamily: FD, fontWeight: 900,
            fontSize: isMobile ? "clamp(48px, 12vw, 56px)" : "clamp(64px, 8vw, 108px)",
            lineHeight: 1.02, letterSpacing: "-0.03em",
            color: C.cream, marginBottom: 0,
          }}>
            Put your business
          </h1>
          <h1 style={{
            fontFamily: FD, fontWeight: 900,
            fontSize: isMobile ? "clamp(48px, 12vw, 56px)" : "clamp(64px, 8vw, 108px)",
            lineHeight: 1.02, letterSpacing: "-0.03em",
            color: C.cream, marginBottom: 28,
          }}>
            on the <em style={{ color: C.amber }}>block.</em>
          </h1>

          <p style={{
            fontFamily: FB, fontSize: isMobile ? 17 : 20,
            color: `${C.cream}bb`, maxWidth: 560,
            lineHeight: 1.75, fontWeight: 300, marginBottom: 40,
          }}>
            Someone just walked past your store and pulled out their phone.
            They're searching for you right now. Do they find you?
          </p>

          <div style={{
            display: "flex", flexDirection: isMobile ? "column" : "row",
            gap: 12, alignItems: isMobile ? "stretch" : "center",
            marginBottom: 52,
          }}>
            <button onClick={onStart} className="cta-primary" style={{
              fontFamily: FB, fontWeight: 700, fontSize: isMobile ? 16 : 17,
              background: C.amber, color: "#fff", border: "none",
              borderRadius: 12, padding: isMobile ? "17px 24px" : "18px 40px",
              cursor: "pointer", letterSpacing: "0.01em",
            }}>
              Preview My Website — Free →
            </button>
            <button onClick={() => scrollTo(storyRef)} style={{
              fontFamily: FB, fontWeight: 500, fontSize: 15,
              background: "transparent", color: `${C.cream}cc`,
              border: `1.5px solid ${C.cream}40`, borderRadius: 12,
              padding: isMobile ? "16px 24px" : "18px 28px", cursor: "pointer",
            }}>
              Read our story ↓
            </button>
          </div>

          {/* Trust row */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: isMobile ? 16 : 32,
          }}>
            {["Free preview — no card needed","Real photos, your story","Mobile-ready out of the box","Live same day"].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.amber, flexShrink: 0 }} />
                <span style={{ fontFamily: FB, fontSize: 13, color: `${C.cream}80` }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TICKER ── */}
      <div style={{ background: C.ink, padding: "13px 0", overflow: "hidden" }}>
        <div style={{ display: "flex" }}>
          <div className="scroll-inner">
            {Array.from({ length: 2 }).map((_, set) =>
              ["Restaurants","Pharmacies","Hair Salons","Auto Shops","Bakeries","Cleaning Services","Childcare","Boutiques","Corner Stores","Barbershops","Food Trucks","Nail Salons","Florists","Caterers","Laundromats"].map((biz, i) => (
                <span key={`${set}-${i}`} style={{
                  fontFamily: FB, fontWeight: 600, fontSize: 12,
                  color: i % 5 === 0 ? C.amber : `${C.cream}55`,
                  letterSpacing: "0.12em", flexShrink: 0, textTransform: "uppercase",
                }}>{biz}{"\u00a0"}·{"\u00a0"} </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── OUR STORY — editorial split layout ── */}
      <div ref={storyRef} style={{ ...sectionPad, background: C.cream }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Label */}
          <div style={{ fontFamily: FB, fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: C.amber, marginBottom: 20 }}>Why We Built This</div>

          {/* Desktop: 2-col split. Mobile: stacked */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: isMobile ? 40 : 80,
            alignItems: "start",
          }}>

            {/* Left — text */}
            <div>
              <h2 style={{
                fontFamily: FD, fontWeight: 900,
                fontSize: isMobile ? 34 : 52,
                lineHeight: 1.12, letterSpacing: "-0.02em", marginBottom: 28,
              }}>
                The block is changing.<br />
                <em style={{ color: C.amber }}>Is your business keeping up?</em>
              </h2>

              <p style={{ fontFamily: FB, fontSize: isMobile ? 16 : 18, color: C.mid, lineHeight: 1.9, marginBottom: 20 }}>
                Someone walks past your business. They're curious. Before they reach for the door, they reach for their phone. If nothing comes up — <strong style={{ color: C.ink }}>they keep walking.</strong>
              </p>
              <p style={{ fontFamily: FB, fontSize: isMobile ? 16 : 18, color: C.mid, lineHeight: 1.9, marginBottom: 32 }}>
                <strong style={{ color: C.ink }}>BLOCKSITE</strong> closes that gap. We build community-rooted websites that tell your story to the person standing right outside — curious, phone in hand, deciding whether to come in.
              </p>

              {/* Pull quote */}
              <blockquote style={{
                fontFamily: FD, fontSize: isMobile ? 18 : 22, fontWeight: 700,
                color: C.ink, lineHeight: 1.5, marginBottom: 32,
                borderLeft: `4px solid ${C.amber}`, paddingLeft: 22, marginLeft: 0,
              }}>
                "If they can't find you on their phone, you don't exist to them."
              </blockquote>

              {/* Note from us */}
              <div style={{
                background: C.ink, borderRadius: 14,
                padding: isMobile ? "24px 20px" : "28px 32px",
                color: C.cream,
              }}>
                <div style={{ fontFamily: FB, fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: C.amber, marginBottom: 10 }}>A Note From Us</div>
                <div style={{ fontFamily: FD, fontSize: isMobile ? 17 : 20, fontWeight: 700, lineHeight: 1.4, marginBottom: 10 }}>
                  This website was built with the same tool we're offering you.
                </div>
                <div style={{ fontFamily: FB, fontSize: 14, color: `${C.cream}99`, lineHeight: 1.85 }}>
                  We used our own generator to build BLOCKSITE's site — and we're opening it up to every local business. If it's good enough for us, it's good enough for you.
                </div>
                <div style={{ fontFamily: FB, fontSize: 13, color: C.amber, marginTop: 14, fontStyle: "italic" }}>— The BlockSite Team</div>
              </div>
            </div>

            {/* Right — photo + stat cards */}
            <div>
              {/* Street photo */}
              <div style={{
                borderRadius: 16, overflow: "hidden",
                aspectRatio: "4/5",
                position: "relative", marginBottom: 20,
                boxShadow: "0 24px 60px #1c1a1420",
              }}>
                <img
                  src={PHOTOS.story}
                  alt="Local business owner"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                {/* Caption overlay */}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  background: "linear-gradient(to top, rgba(28,26,20,0.85), transparent)",
                  padding: "32px 24px 20px",
                }}>
                  <div style={{ fontFamily: FB, fontSize: 12, color: `${C.cream}cc`, letterSpacing: "0.06em" }}>
                    Your virtual greeter — meeting customers before you do.
                  </div>
                </div>
              </div>

              {/* Stat cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { stat: "81%", label: "of shoppers look up a business online before they visit" },
                  { stat: "$149", label: "starting price — less than a week of social media ads" },
                  { stat: "30 min", label: "average time from filling out the form to seeing your site" },
                  { stat: "100%", label: "yours — we hand it over and you're never locked in" },
                ].map(({ stat, label }) => (
                  <div key={stat} style={{
                    background: C.paper, borderRadius: 12,
                    padding: "18px 16px",
                    border: `1px solid ${C.rule}`,
                  }}>
                    <div style={{ fontFamily: FD, fontWeight: 900, fontSize: 28, color: C.amber, lineHeight: 1, marginBottom: 6 }}>{stat}</div>
                    <div style={{ fontFamily: FB, fontSize: 12, color: C.mid, lineHeight: 1.6 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── COMMUNITY PHOTO BREAK ── */}
      <div style={{
        position: "relative", height: isMobile ? 260 : 380, overflow: "hidden",
      }}>
        <img
          src={PHOTOS.community}
          alt="NYC neighborhood street"
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 75%" }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to right, rgba(28,26,20,0.82) 0%, rgba(28,26,20,0.4) 60%, rgba(28,26,20,0.1) 100%)",
          display: "flex", alignItems: "center",
          padding: isMobile ? "0 24px" : "0 80px",
        }}>
          <div style={{ maxWidth: 520 }}>
            <div style={{ fontFamily: FB, fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: C.amber, marginBottom: 14 }}>Built for this block</div>
            <div style={{ fontFamily: FD, fontWeight: 900, fontSize: isMobile ? 26 : 42, color: C.cream, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
              Every business deserves to be found.
            </div>
          </div>
        </div>
      </div>

      {/* ── WHAT WE BUILD ── */}
      <div style={{ ...sectionPad, background: C.paper }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 52 }}>
            <div style={{ fontFamily: FB, fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: C.amber, marginBottom: 14 }}>What We Build</div>
            <h2 style={{ fontFamily: FD, fontWeight: 900, fontSize: isMobile ? 32 : 48, letterSpacing: "-0.02em", lineHeight: 1.15, maxWidth: 640 }}>
              Every kind of business<br />
              <em style={{ color: C.amber }}>on the block.</em>
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 20 }}>
            {[
              {
                label: "Restaurant / Food",
                description: "Restaurant, café, bakery, food truck, catering",
                pages: ["Home","Our Menu","About Us","Hours & Location","Contact"],
                accent: "#8B3A2F",
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
                  </svg>
                ),
              },
              {
                label: "Store / Retail",
                description: "Corner store, boutique, pharmacy, gift shop, grocery",
                pages: ["Home","Our Products","Sales & Specials","About Us","Contact"],
                accent: C.green,
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
                  </svg>
                ),
              },
              {
                label: "Specialty Service",
                description: "Salon, law office, auto shop, cleaning, childcare, wellness",
                pages: ["Home","Our Services","About Us","Testimonials","Contact"],
                accent: C.navy,
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                  </svg>
                ),
              },
            ].map(bt => (
              <div key={bt.label} style={{
                background: C.warm, borderRadius: 16,
                padding: "28px 24px",
                border: `1.5px solid ${C.rule}`,
                position: "relative", overflow: "hidden",
              }}>
                {/* Accent bar */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: bt.accent }} />
                <div style={{ color: bt.accent, marginBottom: 14 }}>{bt.icon}</div>
                <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{bt.label}</div>
                <div style={{ fontFamily: FB, fontSize: 13, color: C.mid, lineHeight: 1.7, marginBottom: 20 }}>{bt.description}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {bt.pages.map(p => (
                    <div key={p} style={{ display: "flex", gap: 8, fontFamily: FB, fontSize: 12, color: C.mid, alignItems: "center" }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: bt.accent, flexShrink: 0 }} />
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div ref={howRef} style={{ ...sectionPad, background: C.cream }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <div style={{ marginBottom: 52 }}>
            <div style={{ fontFamily: FB, fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: C.amber, marginBottom: 14 }}>The Process</div>
            <h2 style={{ fontFamily: FD, fontWeight: 900, fontSize: isMobile ? 32 : 48, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              See your site<br /><em style={{ color: C.amber }}>before you pay a cent.</em>
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {[
              { n: "01", title: "Fill out the form", body: "Tell us your business type, describe your vibe in plain words, and upload your photos. About 10 minutes." },
              { n: "02", title: "We generate your site", body: "Free. No payment info needed. Our AI reads your vibe and builds something real — not a template." },
              { n: "03", title: "See the actual preview", body: "Your real site appears right in the builder. Scroll through it. It's not a mockup or a demo." },
              { n: "04", title: "Pick your package", body: "Starting at $149. Pay only if you love what you see. Full refund within 48 hours if you don't." },
              { n: "05", title: "Go live today", body: "We walk you through getting your site online step by step — no tech experience needed. Or choose Full Service and we handle everything for you." },
            ].map((s, i) => (
              <div key={s.n} className="step-row" style={{
                display: "flex", gap: 24, padding: "22px 16px",
                borderBottom: i < 4 ? `1px solid ${C.rule}` : "none",
                alignItems: "flex-start",
              }}>
                <div style={{
                  fontFamily: FD, fontWeight: 900, fontSize: 13,
                  color: C.amber, lineHeight: 1, flexShrink: 0,
                  width: 32, paddingTop: 3, letterSpacing: "0.04em",
                }}>{s.n}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FD, fontSize: isMobile ? 18 : 20, fontWeight: 700, marginBottom: 6 }}>{s.title}</div>
                  <div style={{ fontFamily: FB, fontSize: 14, color: C.mid, lineHeight: 1.75 }}>{s.body}</div>
                </div>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  border: `1.5px solid ${C.rule}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, color: C.muted,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </div>
            ))}
          </div>

          {/* CTA after steps */}
          <div style={{ marginTop: 44, textAlign: "center" }}>
            <button onClick={onStart} className="cta-primary" style={{
              fontFamily: FB, fontWeight: 700, fontSize: 16,
              background: C.ink, color: C.cream, border: "none",
              borderRadius: 12, padding: "17px 40px", cursor: "pointer",
            }}>
              Start my free preview →
            </button>
            <div style={{ fontFamily: FB, fontSize: 13, color: C.muted, marginTop: 12 }}>No account. No credit card. Just your site.</div>
          </div>
        </div>
      </div>

      {/* ── TESTIMONIALS ── */}
      <div style={{ ...sectionPad, background: C.ink }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontFamily: FB, fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: C.amber, marginBottom: 14 }}>What People Are Saying</div>
            <h2 style={{ fontFamily: FD, fontWeight: 900, fontSize: isMobile ? 32 : 46, letterSpacing: "-0.02em", lineHeight: 1.15, color: C.cream }}>
              Real businesses.<br /><em style={{ color: C.amber }}>Real results.</em>
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 20 }}>
            {[
              {
                quote: "I've been running my pharmacy for 8 years without a website. BlockSite had me online in an afternoon. My customers can finally find my hours on their phone.",
                name: "Sher E.",
                business: "4th Avenue Pharmacy · Mount Vernon, NY",
                initial: "S",
              },
              {
                quote: "The site looks better than places that spent thousands. I described my vibe and they nailed it — warm, Caribbean, exactly us. My regulars were shocked.",
                name: "Rosa D.",
                business: "Rosa's Kitchen · Astoria, Queens",
                initial: "R",
              },
              {
                quote: "I was skeptical. Free preview? No card? I thought there was a catch. There wasn't. You can see my storefront, photos and reviews, and I've already got a few new customers who said they saw it.",
                name: "Keisha W.",
                business: "Crown & Glory Studio · Bronx, NY",
                initial: "K",
              },
            ].map(({ quote, name, business, initial }) => (
              <div key={name} className="testimonial-card" style={{
                background: `${C.cream}08`,
                border: `1px solid ${C.cream}14`,
                borderRadius: 16, padding: "28px 24px",
              }}>
                {/* Stars */}
                <div style={{ display: "flex", gap: 3, marginBottom: 18 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={C.amber} stroke="none">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  ))}
                </div>
                <p style={{ fontFamily: FB, fontSize: 15, color: `${C.cream}cc`, lineHeight: 1.8, marginBottom: 24, fontStyle: "italic" }}>
                  "{quote}"
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: C.amber,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: FD, fontWeight: 700, fontSize: 16, color: "#fff",
                    flexShrink: 0,
                  }}>{initial}</div>
                  <div>
                    <div style={{ fontFamily: FB, fontWeight: 600, fontSize: 14, color: C.cream }}>{name}</div>
                    <div style={{ fontFamily: FB, fontSize: 12, color: `${C.cream}55` }}>{business}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PRICING ── */}
      <div ref={pricingRef} style={{ ...sectionPad, background: C.paper }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 52 }}>
            <div style={{ fontFamily: FB, fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: C.amber, marginBottom: 14 }}>Pricing</div>
            <h2 style={{ fontFamily: FD, fontWeight: 900, fontSize: isMobile ? 32 : 48, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              One price.<br /><em style={{ color: C.amber }}>No surprises.</em>
            </h2>
            <div style={{ fontFamily: FB, fontSize: 15, color: C.mid, marginTop: 12 }}>
              You see your actual site before paying anything. Free. No card needed. Starting at $149.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 20 }}>
            {PACKAGES.map((pkg, idx) => (
              <div key={pkg.id} className="pkg-card" style={{
                background: C.warm, borderRadius: 18,
                padding: isMobile ? "28px 22px" : "36px 28px",
                border: idx === 1 ? `2px solid ${pkg.color}` : `1.5px solid ${C.rule}`,
                position: "relative",
                boxShadow: idx === 1 ? `0 8px 40px ${pkg.color}20` : "none",
              }}>
                {pkg.badge && (
                  <div style={{
                    position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
                    background: pkg.color, color: "#fff",
                    fontFamily: FB, fontSize: 11, fontWeight: 700,
                    padding: "4px 18px", borderRadius: 20,
                    whiteSpace: "nowrap", letterSpacing: "0.08em", textTransform: "uppercase",
                  }}>{pkg.badge}</div>
                )}
                {/* Tier label */}
                <div style={{
                  display: "inline-block",
                  fontFamily: FB, fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: pkg.color, background: `${pkg.color}12`,
                  padding: "4px 10px", borderRadius: 6, marginBottom: 16,
                }}>{pkg.name}</div>
                <div style={{ fontFamily: FD, fontSize: 52, fontWeight: 900, color: pkg.color, lineHeight: 1, marginBottom: 4 }}>${pkg.price}</div>
                <div style={{ fontFamily: FB, fontSize: 13, color: C.muted, marginBottom: 24, fontStyle: "italic", lineHeight: 1.6 }}>{pkg.tagline}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
                  {pkg.features.map(f => (
                    <div key={f} style={{ display: "flex", gap: 10, fontFamily: FB, fontSize: 13, color: C.ink, alignItems: "flex-start" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={pkg.color} strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="20 6 9 17 4 12"/></svg>
                      <span>{f}</span>
                    </div>
                  ))}
                  {pkg.notIncluded.map(f => (
                    <div key={f} style={{ display: "flex", gap: 10, fontFamily: FB, fontSize: 12, color: C.muted, alignItems: "flex-start" }}>
                      <span style={{ flexShrink: 0, marginTop: 1 }}>–</span><span>{f}</span>
                    </div>
                  ))}
                </div>
                <button onClick={onStart} style={{
                  width: "100%", background: idx === 1 ? pkg.color : "transparent",
                  color: idx === 1 ? "#fff" : pkg.color,
                  border: `2px solid ${pkg.color}`,
                  borderRadius: 10, padding: "14px 16px",
                  fontFamily: FB, fontSize: 14, fontWeight: 600,
                  cursor: "pointer", transition: "all 0.18s",
                }}>
                  Start Free Preview →
                </button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, textAlign: "center", fontFamily: FB, fontSize: 13, color: C.muted }}>
            Full refund within 48 hours if you're not happy. No questions asked.
          </div>

          {/* Developer callout */}
          <div style={{ marginTop: 40, background: C.warm, border: `1.5px solid ${C.rule}`, borderRadius: 14, padding: isMobile ? "24px 20px" : "28px 32px", display: "flex", gap: 20, alignItems: "flex-start" }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>👨‍💻</div>
            <div>
              <div style={{ fontFamily: FD, fontSize: isMobile ? 17 : 20, fontWeight: 700, color: C.ink, marginBottom: 8 }}>
                Have a developer — or plan to hire one?
              </div>
              <div style={{ fontFamily: FB, fontSize: 14, color: C.mid, lineHeight: 1.85 }}>
                <strong style={{ color: C.ink }}>Just the Site</strong> was built for exactly that. Instead of handing someone a blank page and a vision, hand them a working, professionally designed website and say <em>"make it yours."</em> Clean HTML, no proprietary platform, no monthly fees. A $149 head start that saves your developer hours — and saves you money.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ background: C.ink, color: C.cream, padding: isMobile ? "52px 20px" : "64px 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            alignItems: isMobile ? "flex-start" : "flex-end",
            gap: 32, marginBottom: 40, paddingBottom: 40,
            borderBottom: `1px solid ${C.cream}12`,
          }}>
            <div style={{ maxWidth: 360 }}>
              <div style={{ marginBottom: 12 }}><Logo height={64} light /></div>
              <div style={{ fontFamily: FB, fontSize: 14, color: `${C.cream}55`, lineHeight: 1.75 }}>
                Your virtual greeter. For every business on the block. Built by a small business, for small businesses.
              </div>
            </div>
            <div style={{ display: "flex", gap: isMobile ? 32 : 48 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  ["Our Story", storyRef],
                  ["How It Works", howRef],
                  ["Pricing", pricingRef],
                ].map(([label, ref]) => (
                  <button key={label} className="nav-btn" onClick={() => scrollTo(ref)} style={{ color: `${C.cream}55`, fontSize: 13, textAlign: "left" }}>{label}</button>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button className="nav-btn" onClick={onStart} style={{ color: `${C.cream}55`, fontSize: 13, textAlign: "left" }}>Get Started</button>
                <a href="mailto:hello@blocksitebuilder.com" style={{ fontFamily: FB, fontSize: 13, color: `${C.cream}55`, textDecoration: "none" }}>hello@blocksitebuilder.com</a>
                <button className="nav-btn" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} style={{ color: `${C.cream}55`, fontSize: 13, textAlign: "left" }}>Back to top ↑</button>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontFamily: FB, fontSize: 12, color: `${C.cream}28` }}>
              © {new Date().getFullYear()} BlockSite · hello@blocksitebuilder.com
            </div>
            <div style={{ fontFamily: FB, fontSize: 12, color: `${C.cream}28` }}>
              Made with our own tool — on the block.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// ─── MAIN APP ─────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]       = useState("landing");
  const [step, setStep]           = useState(1);
  const [photos, setPhotos]       = useState([]);
  const [generating, setGenerating] = useState(false);
  const [previewHTML, setPreviewHTML] = useState("");
  const [orderId, setOrderId]     = useState(null);
  const [selectedPackage, setSelectedPackage] = useState("support");
  const [paid, setPaid]           = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showDeploy, setShowDeploy] = useState(true); // open by default after payment
  const [loadingStep, setLoadingStep] = useState(0);
  const [blkSequence, setBlkSequence] = useState("");
  const [colorFilter, setColorFilter] = useState("all");
  const [elapsed, setElapsed] = useState(0);
  const isMobile = useIsMobile();

  // Loading step advances based on real stream events in handleGeneratePreview
  // tickerStep cycles subtexts within each stage
  useEffect(() => {
    if (!generating) { setLoadingStep(0); setElapsed(0); return; }
  }, [generating]);

  // Elapsed timer — counts up every second while generating
  useEffect(() => {
    if (!generating) { setElapsed(0); return; }
    setElapsed(0);
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, [generating]);

  // Cycle subtexts every 10s within the current stage
  const [tickerStep, setTickerStep] = useState(0);
  useEffect(() => {
    if (!generating) { setTickerStep(0); return; }
    let t = 0;
    const interval = setInterval(() => {
      t = (t + 1) % 4;
      setTickerStep(t);
    }, 10000);
    return () => clearInterval(interval);
  }, [generating]);

  // BLK keyboard shortcut — bypass payment for testing
  useEffect(() => {
    const handleKey = (e) => {
      if (step !== 8 || paid || generating) return;
      const key = e.key.toUpperCase();
      if (!"BLK".includes(key)) { setBlkSequence(""); return; }
      const next = blkSequence + key;
      if ("BLK".startsWith(next)) {
        setBlkSequence(next);
        if (next === "BLK") {
          setBlkSequence("");
          handlePostPayment();
        }
      } else {
        setBlkSequence(key === "B" ? "B" : "");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [step, paid, generating, blkSequence]);

  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem("blocksite-form");
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return {
    businessType: "", businessName: "", industry: "", tagline: "",
    description: "", about: "", phone: "", email: "", address: "",
    city: "", neighborhood: "", hours: "", vibe: "", pages: [],
    subType: "",
    foundedYear: "", ownerName: "", differentiator: "", instagram: "",
    menuCategories: "", menuHighlights: "", priceRange: "", cuisine: "",
    productCategories: "", currentSpecials: "", bestSellers: "", deliveryInfo: "",
    services: "", bookingMethod: "", credentials: "",
    brandColor: "",
    };
  });

  const set = key => val => setData(d => {
    const next = { ...d, [key]: val };
    try { localStorage.setItem("blocksite-form", JSON.stringify(next)); } catch(e) {}
    return next;
  });
  const togglePage = page => setData(d => ({
    ...d, pages: d.pages.includes(page) ? d.pages.filter(p => p !== page) : [...d.pages, page]
  }));
  const selectedType = BUSINESS_TYPES.find(bt => bt.id === data.businessType);
  const selectedPkg  = PACKAGES.find(p => p.id === selectedPackage);

  const selectBusinessType = typeId => {
    const bt = BUSINESS_TYPES.find(b => b.id === typeId);
    setData(d => {
      const next = { ...d, businessType: typeId, pages: bt.defaultPages, subType: "" };
      try { localStorage.setItem("blocksite-form", JSON.stringify(next)); } catch(e) {}
      return next;
    });
  };

  // ── Build form payload ────────────────────────────────────────
  const buildPayload = () => {
    const bt = BUSINESS_TYPES.find(b => b.id === data.businessType);
    const typeSpecific = bt?.contentFields.map(f => `${f.label}: ${data[f.key] || "not provided"}`).join("\n") || "";
    return {
      businessName: data.businessName, businessType: data.businessType,
      industry: data.industry, tagline: data.tagline, description: data.description,
      about: data.about, vibe: data.vibe, pages: data.pages,
      phone: data.phone, email: data.email, address: data.address,
      city: data.city, hours: data.hours, typeSpecific,
      photos: photos.map(p => p.url),
      packageId: selectedPackage,
    };
  };

  // ── Call Vercel API directly — 60s timeout, no polling needed ──
  const handleGeneratePreview = async () => {
    setGenerating(true);
    setErrorDetails(null);
    setLoadingStep(0);

    try {
      const bt = BUSINESS_TYPES.find(b => b.id === data.businessType);
      const typeSpecific = bt?.contentFields.map(f => `${f.label}: ${data[f.key] || "not provided"}`).join("\n") || "";

      const formData = {
        businessName: data.businessName, businessType: data.businessType,
        industry: data.industry, tagline: data.tagline, description: data.description,
        about: data.about, vibe: data.vibe, pages: data.pages,
        phone: data.phone, email: data.email, address: data.address,
        city: data.city, neighborhood: data.neighborhood, hours: data.hours,
        ownerName: data.ownerName, foundedYear: data.foundedYear,
        differentiator: data.differentiator, instagram: data.instagram,
        subType: data.subType, typeSpecific,
        photoCount: photos.length,
        photoUrls: photos.map(p => p.url).filter(u => u.startsWith("https://")),
        brandColor: data.brandColor || "",
        packageId: selectedPackage,
      };

      const res = await fetch("https://blocksite-api.vercel.app/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const txt = await res.text();
        let parsed; try { parsed = JSON.parse(txt); } catch { parsed = { error: txt }; }
        throw new Error(parsed.error || `Server error ${res.status}`);
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let htmlChunks = [];
      let streamedOrderId = null;
      let completed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const event = JSON.parse(raw);

            if (event.type === "orderId") {
              streamedOrderId = event.orderId;
              setOrderId(event.orderId);
              setLoadingStep(0); // Researching
            }

            if (event.type === "status") {
              if (event.message?.includes("Building")) setLoadingStep(1);
            }

            if (event.type === "stage") {
              if (event.stage !== undefined) setLoadingStep(event.stage);
            }

            if (event.type === "html") {
              htmlChunks.push(event.chunk);
              // Advance loading step based on actual content arriving
              const totalLen = htmlChunks.join("").length;
              // Stage 0=Researching(server), 1=Planning, 2=Designing, 3=Building, 4=Polishing
              // html chunks start arriving at stage 2 (Designing)
              // Progress through 2→3→4 based on content length
              if (totalLen < 3000) setLoadingStep(2);
              else if (totalLen < 12000) setLoadingStep(3);
              else setLoadingStep(4);
            }

            if (event.type === "complete") {
              completed = true;
              // Decode final validated HTML
              const bytes = Uint8Array.from(atob(event.htmlB64), c => c.charCodeAt(0));
              let finalHtml = new TextDecoder("utf-8").decode(bytes);

              // Inject any remaining photo placeholders
              photos.forEach((photo, i) => {
                const url = photo.url || photo.preview;
                finalHtml = finalHtml.replace(new RegExp(`PHOTO_${i+1}_PLACEHOLDER`, "g"), url);
              });
              if (photos[0]) {
                finalHtml = finalHtml.replace(/HERO_PHOTO_PLACEHOLDER/g, photos[0].url || photos[0].preview);
              }

              setPreviewHTML(finalHtml);
              setGenerating(false);
              setStep(8);
            }

            if (event.type === "error") {
              throw new Error(event.message || "Generation failed");
            }
          } catch(parseErr) {
            if (parseErr.message && parseErr.message !== "Generation failed") {
              // Skip malformed lines silently
            } else {
              throw parseErr;
            }
          }
        }
      }

      // Stream closed without sending complete event — something went wrong server-side
      if (!completed) {
        throw new Error("Generation was interrupted. Please try again.");
      }

    } catch (err) {
      console.error("Generation error:", err.message);
      let message = err.message || "Something went wrong.";
      let hint = "Hit Generate again — this usually resolves on a second attempt.";
      if (message.toLowerCase().includes("network") || message.toLowerCase().includes("failed to fetch")) {
        message = "Network error — couldn't reach the server.";
        hint = "Check your internet connection and try again.";
      } else if (message.includes("overload") || message.includes("529")) {
        message = "The AI is temporarily overloaded.";
        hint = "Wait 30 seconds and hit Generate again.";
      } else if (message.includes("401") || message.includes("403")) {
        message = "API key error.";
        hint = "Check that ANTHROPIC_API_KEY is set in Vercel environment variables.";
      }
      setErrorDetails({ message, hint, raw: err.message });
      setGenerating(false);
    }
  };


  const handleRetry = () => { setErrorDetails(null); handleGeneratePreview(); };
  const handleEditAfterError = targetStep => { setErrorDetails(null); setStep(targetStep); };
  const handlePostPayment = async () => {
    setPaid(true);
    if (orderId && data.email && selectedPackage) {
      try {
        await fetch("https://blocksite-api.vercel.app/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            packageId: selectedPackage,
            customerEmail: data.email,
          }),
        });
      } catch(e) {
        console.log("Send email error:", e.message);
      }
    }
  };

  const handleDownload = () => {
    const slug = (data.businessName || "website").toLowerCase().replace(/\s+/g, "-");
    const blob = new Blob([previewHTML], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${slug}.html`; a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setScreen("landing"); setStep(1); setPhotos([]); setGenerating(false);
    setPreviewHTML(""); setOrderId(null); setPaid(false);
    setErrorDetails(null); setShowDeploy(false); setSelectedPackage("support");
    setData({ businessType: "", businessName: "", industry: "", tagline: "", description: "", about: "", phone: "", email: "", address: "", city: "", neighborhood: "", hours: "", vibe: "", pages: [], subType: "", foundedYear: "", ownerName: "", differentiator: "", instagram: "", menuCategories: "", menuHighlights: "", priceRange: "", cuisine: "", productCategories: "", currentSpecials: "", bestSellers: "", deliveryInfo: "", services: "", bookingMethod: "", credentials: "", brandColor: "" });
  };

  if (screen === "landing") return <LandingPage onStart={() => setScreen("form")} />;

  // ── FORM CHROME ───────────────────────────────────────────────
  const stepTitles = [
    "What kind of business?",
    "The basics",
    "Menu, services & details",
    "Describe your vibe",
    "Upload your photos",
    "Your pages",
    "Contact & location",
    "Your site preview",
  ];
  const TOTAL_STEPS = 7;
  const card = { background: C.warm, borderRadius: 16, padding: isMobile ? "24px 18px" : "32px 28px", border: `1px solid ${C.rule}`, boxShadow: "0 2px 20px #1c1a1406", marginBottom: 20 };

  return (
    <div style={{ minHeight: "100vh", background: C.cream, fontFamily: FB, overflowX: "hidden" }}>
      <style>{GLOBAL_CSS}</style>
      <link rel="stylesheet" href={FONTS_URL} />

      {/* Form header */}
      <div style={{ background: C.warm, borderBottom: `1px solid ${C.rule}`, padding: "0 20px", height: 68, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><Logo height={48} /></button>
        {!paid && step < 8 && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: FB, fontSize: 12, color: C.muted }}>Step {step} of {TOTAL_STEPS}</div>
            <div style={{ fontFamily: FB, fontSize: 11, color: C.amber }}>Your site generates free at the end</div>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 660, margin: "0 auto", padding: isMobile ? "24px 16px 80px" : "40px 20px 80px" }}>

        {/* Progress bar */}
        {step < 8 && !generating && (
          <div style={{ display: "flex", gap: 4, marginBottom: 28 }}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < step ? C.ink : C.rule, transition: "background 0.3s" }} />
            ))}
          </div>
        )}

        {/* Step header */}
        {step < 8 && !generating && (
          <div style={{ marginBottom: 24 }} className="fu">
            <div style={{ fontFamily: FB, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.amber, marginBottom: 6 }}>Step {step} of {TOTAL_STEPS}</div>
            <h2 style={{ fontFamily: FD, fontWeight: 900, fontSize: isMobile ? 26 : 32, lineHeight: 1.2, letterSpacing: "-0.01em" }}>{stepTitles[step - 1]}</h2>
          </div>
        )}

        {/* ── GENERATING ── */}
        {generating && (
          <div className="fi" style={{ padding: "52px 0 40px" }}>

            {/* Progress bar */}
            <div style={{ marginBottom: 36 }}>
              <div style={{ height: 3, background: C.rule, borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
                <div style={{
                  height: "100%",
                  borderRadius: 2,
                  background: C.amber,
                  width: `${Math.round(((loadingStep + 1) / LOADING_MESSAGES.length) * 100)}%`,
                  transition: "width 1.2s cubic-bezier(.4,0,.2,1)",
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FB, fontSize: 11, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                <span>Step {loadingStep + 1} of {LOADING_MESSAGES.length}</span>
                <span>{Math.round(((loadingStep + 1) / LOADING_MESSAGES.length) * 100)}%</span>
              </div>
            </div>

            {/* Current step label */}
            <div style={{ marginBottom: 32 }}>
              <h2 key={loadingStep} style={{ fontFamily: FD, fontWeight: 900, fontSize: isMobile ? 26 : 32, letterSpacing: "-0.02em", marginBottom: 10, lineHeight: 1.2, animation: "fadeUp 0.35s ease both" }}>
                {LOADING_MESSAGES[loadingStep].label}
                <span style={{ display: "inline-block", animation: "ellipsis 1.4s ease-in-out infinite" }}>…</span>
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", animation: "pulse 1.2s ease-in-out infinite", flexShrink: 0 }} />
                <span style={{ fontFamily: FB, fontSize: 13, color: C.mid }}>
                  Active · {Math.floor(elapsed / 60) > 0 ? `${Math.floor(elapsed / 60)}m ` : ""}{elapsed % 60}s elapsed · usually 90–120 seconds total
                </span>
              </div>
            </div>

            {/* Stage pills — just 5 */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 36 }}>
              {LOADING_MESSAGES.map((msg, i) => (
                <div key={i} style={{
                  fontFamily: FB, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
                  padding: "5px 12px", borderRadius: 20, textTransform: "uppercase",
                  background: i < loadingStep ? C.ink : i === loadingStep ? C.amber : C.rule,
                  color: i <= loadingStep ? "#fff" : C.muted,
                  transition: "all 0.4s ease",
                }}>
                  {i < loadingStep ? "✓ " : ""}{msg.label}
                </div>
              ))}
            </div>

            {/* Rotating subtext — 4 per stage, cycles every 10s */}
            <div style={{ borderTop: `1px solid ${C.rule}`, paddingTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.amber, animation: "pulse 1.6s ease-in-out infinite", flexShrink: 0 }} />
              <p key={`${loadingStep}-${tickerStep}`} style={{ fontFamily: FB, fontSize: 13, color: C.muted, fontStyle: "italic", margin: 0, animation: "fadeIn 0.4s ease both" }}>
                {LOADING_MESSAGES[loadingStep].subtexts[tickerStep]}
              </p>
            </div>

          </div>
        )}

        {/* ── STEP 7: PREVIEW + PAY ── */}
        {step === 8 && !generating && (
          <div className="fu">
            {errorDetails ? (
              <ErrorScreen errorDetails={errorDetails} onRetry={handleRetry} onEdit={handleEditAfterError} />
            ) : paid ? (
              /* ── PAID / SUCCESS ── */
              <div>
                <div style={{ background: "#f0fdf4", border: `1.5px solid ${C.green}`, borderRadius: 14, padding: "24px", marginBottom: 20, textAlign: "center" }}>
                  <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 22, color: "#166534", marginBottom: 6 }}>You're on the block.</div>
                  <div style={{ fontFamily: FB, fontSize: 14, color: "#166534", marginBottom: orderId ? 12 : 0 }}>Your website is ready. We're emailing it to you now — check your inbox.</div>
                  {orderId && <div style={{ fontFamily: FB, fontSize: 12, color: "#166534", background: "#dcfce7", borderRadius: 6, padding: "3px 10px", display: "inline-block", fontWeight: 600 }}>Order ID: {orderId}</div>}
                  {selectedPackage === "fullservice" && <div style={{ marginTop: 12, fontFamily: FB, fontSize: 13, color: "#166534", background: "#fff", border: `1px solid ${C.green}40`, borderRadius: 8, padding: "10px 14px" }}><strong>Full Service:</strong> We'll email you within 24 hours to kick off your launch.</div>}
                  {selectedPackage === "support" && <div style={{ marginTop: 12, fontFamily: FB, fontSize: 13, color: "#166534", background: "#fff", border: `1px solid ${C.green}40`, borderRadius: 8, padding: "10px 14px" }}><strong>Revisions included:</strong> Reply to your receipt email with what you'd like changed.</div>}
                </div>

                <div style={card}>
                  <Btn onClick={handleDownload} variant="amber" full style={{ fontSize: 16, padding: "16px" }}>Save My Website →</Btn>
                  <div style={{ fontFamily: FB, marginTop: 10, fontSize: 12, color: C.muted, textAlign: "center" }}>Also being emailed to {data.email || "you"} — check your inbox</div>
                </div>

                {/* Deploy guide — open by default */}
                <div onClick={() => setShowDeploy(!showDeploy)} style={{ ...card, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottomLeftRadius: showDeploy ? 0 : 16, borderBottomRightRadius: showDeploy ? 0 : 16, marginBottom: showDeploy ? 0 : 20 }}>
                  <div>
                    <div style={{ fontFamily: FD, fontWeight: 700, fontSize: 17, marginBottom: 2 }}>How to get your site live</div>
                    <div style={{ fontFamily: FB, fontSize: 12, color: C.muted, fontStyle: "italic" }}>Step-by-step · no coding required · includes Google Business setup</div>
                  </div>
                  <span style={{ fontFamily: FB, fontSize: 18, color: C.rule }}>{showDeploy ? "▲" : "▼"}</span>
                </div>
                {showDeploy && (
                  <div style={{ ...card, borderRadius: "0 0 16px 16px", marginTop: 0, borderTop: "none" }}>
                    <DeployGuide businessName={data.businessName} packageId={selectedPackage} />
                  </div>
                )}

                <a href={`mailto:hello@blocksitebuilder.com?subject=Question about my order ${orderId || ""}&body=Hi BlockSite team,%0A%0AI have a question about my website for ${encodeURIComponent(data.businessName || "my business")}.%0A%0A`}
                  style={{
                    display: "block", textAlign: "center", marginTop: 16,
                    fontFamily: FB, fontSize: 14, color: C.mid,
                    textDecoration: "none", padding: "14px",
                    border: `1.5px solid ${C.rule}`, borderRadius: 10,
                    background: C.warm,
                  }}>
                  Have a question? Email us →
                </a>
              </div>
            ) : (
              /* ── PREVIEW + PACKAGE SELECTION ── */
              <div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontFamily: FB, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: C.amber, marginBottom: 6 }}>Your site is ready</div>
                  <h2 style={{ fontFamily: FD, fontWeight: 900, fontSize: isMobile ? 24 : 30, letterSpacing: "-0.01em", marginBottom: 4 }}>
                    {data.businessName || "Your Business"} — live preview
                  </h2>
                  <div style={{ fontFamily: FB, fontSize: 14, color: C.mid, fontStyle: "italic" }}>Scroll through it. This is your actual site.</div>
                </div>

                <div style={{ marginBottom: 28 }}>
                  <WatermarkedPreview html={previewHTML} businessName={data.businessName} />
                </div>

                {/* Breathing room — let them absorb it */}
                <div style={{ background: C.paper, borderRadius: 12, padding: "18px 20px", marginBottom: 28, borderLeft: `3px solid ${C.amber}` }}>
                  <div style={{ fontFamily: FB, fontSize: 14, color: C.ink, lineHeight: 1.8 }}>
                    Take a minute to scroll through it. This is your actual site — not a mockup, not a demo. If you want anything changed after you purchase, your revision round covers it.
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontFamily: FD, fontWeight: 700, fontSize: isMobile ? 20 : 24, marginBottom: 6, letterSpacing: "-0.01em" }}>Love it? Choose your package.</h3>
                  <div style={{ fontFamily: FB, fontSize: 14, color: C.mid, fontStyle: "italic", marginBottom: 20 }}>Pay only if you're happy with what you see.</div>
                  <PackagePicker selected={selectedPackage} onSelect={setSelectedPackage} />
                </div>

                {/* Order summary + pay */}
                <div style={card}>
                  <div style={{ fontFamily: FB, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted, marginBottom: 14 }}>Your Order</div>
                  {[
                    ["Business", data.businessName || "—"],
                    ["Package", selectedPkg?.name || "—"],
                    ["Type", selectedType?.label || "—"],
                    ["Photos", `${photos.length} uploaded`],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", gap: 12, paddingBottom: 8, marginBottom: 8, borderBottom: `1px solid ${C.paper}`, fontFamily: FB, fontSize: 14 }}>
                      <span style={{ width: 72, fontFamily: FB, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.muted, paddingTop: 2, flexShrink: 0 }}>{k}</span>
                      <span style={{ color: C.ink }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, marginBottom: 20 }}>
                    <span style={{ fontFamily: FB, fontWeight: 700, fontSize: 16 }}>Total</span>
                    <span style={{ fontFamily: FD, fontWeight: 900, fontSize: 34, color: selectedPkg?.color || C.ink, lineHeight: 1 }}>${selectedPkg?.price}</span>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <Label>Confirm your email — we'll send your website here</Label>
                    <input value={data.email} onChange={e => set("email")(e.target.value)} type="email" placeholder="you@example.com" />
                  </div>

                  <a
                    href={`${selectedPkg?.stripeLink || "#"}?client_reference_id=${orderId || ""}&prefilled_email=${encodeURIComponent(data.email || "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block", width: "100%", textAlign: "center",
                      background: "#635BFF", color: "#fff", borderRadius: 10,
                      padding: "16px", fontFamily: FB, fontSize: 16, fontWeight: 600,
                      textDecoration: "none", marginBottom: 10, boxSizing: "border-box",
                      letterSpacing: "0.01em",
                    }}
                  >
                    💳 Pay ${selectedPkg?.price} with Stripe
                  </a>
                  <div style={{ fontFamily: FB, fontSize: 12, color: C.muted, textAlign: "center", lineHeight: 1.7 }}>
                    Secured by Stripe · One-time · No subscriptions · Full refund within 48 hours if you're not happy
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <Btn variant="ghost" onClick={() => { setStep(7); }}>← Edit my info</Btn>
                  <Btn variant="ghost" onClick={() => { setPreviewHTML(""); handleGeneratePreview(); }}>Regenerate</Btn>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {[
                    { label: "Edit vibe", s: 4 },
                    { label: "Change photos", s: 5 },
                    { label: "Edit details", s: 3 },
                    { label: "Edit basics", s: 2 },
                  ].map(({ label, s }) => (
                    <button key={s} onClick={() => setStep(s)} style={{
                      fontFamily: FB, fontSize: 12, color: C.muted,
                      background: "transparent", border: `1px solid ${C.rule}`,
                      borderRadius: 6, padding: "5px 10px", cursor: "pointer",
                    }}>{label}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── FORM STEPS 1–6 ── */}
        {step < 8 && !generating && (
          <>
            <div style={card}>

              {/* STEP 1 — Type */}
              {step === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {BUSINESS_TYPES.map((bt, i) => {
                    const isSel = data.businessType === bt.id;
                    return (
                      <div key={bt.id} onClick={() => selectBusinessType(bt.id)} className={`fu fu${i + 1}`}
                        style={{ border: `2px solid ${isSel ? C.ink : C.rule}`, borderRadius: 14, padding: "18px 20px", cursor: "pointer", background: isSel ? C.paper : C.warm, display: "flex", gap: 16, alignItems: "flex-start", transition: "all 0.15s", boxShadow: isSel ? `0 0 0 4px ${C.ink}10` : "none" }}
                      >
                        <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 2, border: `2px solid ${isSel ? C.ink : C.rule}`, background: isSel ? C.ink : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                          {isSel && <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.cream }} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 8, color: isSel ? C.cream : C.ink }}>{BT_ICONS[bt.id]}</div>
                          <span style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, color: C.ink }}> {bt.label}</span>
                          <div style={{ fontFamily: FB, fontSize: 13, color: C.mid, marginTop: 4, marginBottom: 10 }}>{bt.description}</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {bt.defaultPages.map(p => (
                              <span key={p} style={{ fontFamily: FB, fontSize: 11, background: isSel ? C.ink : C.paper, color: isSel ? C.cream : C.mid, borderRadius: 20, padding: "3px 10px", fontWeight: 600, letterSpacing: "0.04em" }}>{p}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Subtype dropdown — appears after selecting a type */}
                  {data.businessType && (
                    <div className="fu" style={{ background: C.amberL, borderRadius: 12, padding: "18px 20px", border: `1px solid ${C.amber}40` }}>
                      <Label hint="This helps us tailor your form and examples to your specific business">
                        {data.businessType === "restaurant" ? "What type of restaurant?" :
                         data.businessType === "retail" ? "What type of store?" :
                         "What kind of service business?"}
                      </Label>
                      <select
                        value={data.subType}
                        onChange={e => {
                          const val = e.target.value;
                          set("subType")(val);
                          // Auto-fill industry and pages based on subtype
                          if (data.businessType === "restaurant" && RESTAURANT_SUBTYPES[val]) {
                            set("industry")(RESTAURANT_SUBTYPES[val].cuisine);
                          }
                          if (data.businessType === "service" && SERVICE_SUBTYPES[val]) {
                            const st = SERVICE_SUBTYPES[val];
                            if (st.defaultPages) {
                              setData(d => {
                                const next = { ...d, subType: val, pages: st.defaultPages };
                                try { localStorage.setItem("blocksite-form", JSON.stringify(next)); } catch(e) {}
                                return next;
                              });
                            }
                          }
                        }}
                        style={{ marginTop: 4 }}
                      >
                        <option value="">Select one…</option>
                        {data.businessType === "restaurant" && Object.entries(RESTAURANT_SUBTYPES).sort(([a,av],[b,bv]) => a==="other"?1:b==="other"?-1:av.label.localeCompare(bv.label)).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                        {data.businessType === "retail" && Object.entries(RETAIL_SUBTYPES).sort(([a,av],[b,bv]) => a==="other"?1:b==="other"?-1:av.label.localeCompare(bv.label)).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                        {data.businessType === "service" && Object.entries(SERVICE_SUBTYPES).sort(([a,av],[b,bv]) => a==="other"?1:b==="other"?-1:av.label.localeCompare(bv.label)).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                      {data.subType && data.businessType === "service" && SERVICE_SUBTYPES[data.subType] && (
                        <div style={{ fontFamily: FB, fontSize: 12, color: C.amberD, marginTop: 8, fontStyle: "italic" }}>
                          {SERVICE_SUBTYPES[data.subType].description}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2 — Basics */}
              {step === 2 && (() => {
                const st = data.businessType === "service" ? SERVICE_SUBTYPES[data.subType] : null;
                const rt = data.businessType === "restaurant" ? RESTAURANT_SUBTYPES[data.subType] : null;
                const rlt = data.businessType === "retail" ? RETAIL_SUBTYPES[data.subType] : null;
                return (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <Field label="Business Name *">
                    <input value={data.businessName} onChange={e => set("businessName")(e.target.value)} placeholder={
                      data.businessType === "restaurant" ? (
                        data.subType === "caribbean" ? "e.g. Rosa's Caribbean Kitchen" :
                        data.subType === "bakery" ? "e.g. Sweet Life Bakery & Café" :
                        data.subType === "soulFood" ? "e.g. Mama's Southern Table" :
                        data.subType === "mexican" ? "e.g. El Rancho Restaurant" :
                        data.subType === "african" ? "e.g. Accra Kitchen" :
                        data.subType === "foodTruck" ? "e.g. The Rolling Jerk Food Truck" :
                        data.subType === "seafood" ? "e.g. Captain's Fish Fry" :
                        data.subType === "vegan" ? "e.g. Roots & Greens" :
                        "e.g. Rosa's Caribbean Kitchen"
                      ) :
                      data.businessType === "retail" ? (
                        data.subType === "cornerStore" ? "e.g. Melrose Corner Deli & Grocery" :
                        data.subType === "pharmacy" ? "e.g. 4th Avenue Drug Store" :
                        data.subType === "boutique" ? "e.g. Crown Boutique" :
                        data.subType === "beauty" ? "e.g. Queen's Beauty Supply" :
                        data.subType === "grocery" ? "e.g. Tremont Fresh Market" :
                        data.subType === "electronics" ? "e.g. Bronx Phone & Tech Repair" :
                        data.subType === "furniture" ? "e.g. Casa Home Furniture" :
                        data.subType === "giftShop" ? "e.g. The Gifted Corner" :
                        data.subType === "sportswear" ? "e.g. Block Sneakers & Streetwear" :
                        "e.g. your store name"
                      ) :
                      data.subType === "autobody" ? "e.g. Bronx Auto Body & Repair" :
                      data.subType === "salon" ? "e.g. Crown & Glory Hair Studio" :
                      data.subType === "barbershop" ? "e.g. Elegant Barber Shop" :
                      data.subType === "nailsalon" ? "e.g. Luxe Nail Bar" :
                      data.subType === "cleaning" ? "e.g. Spotless Cleaning Services" :
                      data.subType === "childcare" ? "e.g. Little Stars Learning Center" :
                      data.subType === "tutoring" ? "e.g. Bronx Academic Center" :
                      data.subType === "wellness" ? "e.g. Serenity Wellness Studio" :
                      data.subType === "laundromat" ? "e.g. Sunshine Laundromat" :
                      data.subType === "florist" ? "e.g. Petal & Bloom Florist" :
                      data.subType === "photography" ? "e.g. Visión Photography" :
                      data.subType === "catering" ? "e.g. Flavor Events Catering" :
                      data.subType === "tailoring" ? "e.g. Master Stitch Tailoring" :
                      data.subType === "taxnotary" ? "e.g. Bronx Tax & Notary Services" :
                      data.subType === "legal" ? "e.g. Rodriguez Law Office" :
                      data.subType === "church" ? "e.g. Greater Love Tabernacle" :
                      data.subType === "funeralhome" ? "e.g. Grace Funeral Home" :
                      "e.g. your business name"
                    } />
                  </Field>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="col-sm">
                    <Field label="Your first name" hint="We'll use it to personalize your story section">
                      <input value={data.ownerName} onChange={e => set("ownerName")(e.target.value)} placeholder="e.g. Marcus" />
                    </Field>
                    <Field label="Year founded" hint="Establishes trust and roots">
                      <input value={data.foundedYear} onChange={e => set("foundedYear")(e.target.value)} placeholder="e.g. 2005" type="number" min="1900" max={new Date().getFullYear()} />
                    </Field>
                  </div>
                  <Field label={data.businessType === "restaurant" ? "Cuisine / Type of food" : data.businessType === "retail" ? "What kind of store?" : "What kind of service?"} hint="Be specific — this shapes the whole design">
                    <input value={data.industry} onChange={e => set("industry")(e.target.value)} placeholder={rt ? rt.cuisine : rlt ? rlt.description : st ? st.description : "Describe your type of business"} />
                  </Field>
                  <Field label="Tagline or slogan" hint="Optional — but if you have one, use it">
                    <input value={data.tagline} onChange={e => set("tagline")(e.target.value)} placeholder={
                      data.businessType === "restaurant" ? (
                        data.subType === "caribbean" ? "Real food, made with love, since 1998" :
                        data.subType === "bakery" ? "Fresh from the oven, every single morning" :
                        data.subType === "soulFood" ? "Cooked with love, served with pride" :
                        data.subType === "foodTruck" ? "Find us on the block — we're worth the hunt" :
                        "Good food, honest price, right here on the block"
                      ) :
                      data.businessType === "retail" ? (
                        data.subType === "cornerStore" ? "Your neighborhood's favorite stop since day one" :
                        data.subType === "pharmacy" ? "Your neighborhood pharmacy since 1994" :
                        data.subType === "boutique" ? "Style that tells your story" :
                        data.subType === "beauty" ? "Everything you need, right in the neighborhood" :
                        data.subType === "grocery" ? "Fresh, local, and always stocked" :
                        data.subType === "electronics" ? "Fast repairs, fair prices, no hassle" :
                        "Your community store — always here when you need us"
                      ) :
                      data.subType === "autobody" ? "Honest work. Fair prices. Since 1987." :
                      data.subType === "salon" ? "Where your hair tells your story" :
                      data.subType === "barbershop" ? "Every cut, every client, every time." :
                      data.subType === "nailsalon" ? "A little luxury, right in your neighborhood" :
                      data.subType === "cleaning" ? "We clean it like it's our own" :
                      data.subType === "childcare" ? "Where every child is seen and celebrated" :
                      data.subType === "tutoring" ? "Every student deserves to succeed" :
                      data.subType === "wellness" ? "Feel better. Live better. Start here." :
                      data.subType === "florist" ? "Every arrangement, made with care" :
                      data.subType === "legal" ? "Your community. Your advocate." :
                      "Your motto or tagline"
                    } />
                  </Field>
                  <Field label="Tell us about yourself *" hint="2–4 sentences. Who you are, who you serve, what makes you worth visiting.">
                    <textarea value={data.description} onChange={e => set("description")(e.target.value)} rows={4} placeholder={
                      data.businessType === "restaurant" ? (
                        data.subType === "caribbean" ? "We've been cooking authentic Caribbean food in this neighborhood since 1998. Everything is made from scratch every morning — oxtail, curry chicken, stewed peas. No shortcuts, no microwave, no frozen anything." :
                        data.subType === "bakery" ? "We bake everything fresh every morning — breads, pastries, cakes, and coffee. We've been the neighborhood's morning stop for over a decade." :
                        data.subType === "soulFood" ? "We cook the food our grandmothers made — slow, careful, with real ingredients. No shortcuts, no chains, just soul food the way it's supposed to taste." :
                        data.subType === "foodTruck" ? "We bring the flavors of the islands directly to your block. Fresh, bold, and made to order — no reheating, no compromises." :
                        "We've been serving this community with fresh, honest food for years. Everything we make is made with care — because you deserve better than fast food."
                      ) :
                      data.businessType === "retail" ? (
                        data.subType === "cornerStore" ? "We've been the heartbeat of this block for over 20 years. Cold drinks, fresh deli, everyday essentials — open early, close late, always here when you need us." :
                        data.subType === "pharmacy" ? "We're an independent pharmacy that's been serving this neighborhood for over 25 years. Family-owned, no chains, no attitude. We know your name and your prescriptions." :
                        data.subType === "boutique" ? "We curate pieces that speak to women in this community — bold, affordable, and always on point. Every item we carry is chosen with our customers in mind." :
                        data.subType === "beauty" ? "We carry everything the community needs — hair care, cosmetics, wigs, and more. Family-owned and stocked for our neighbors, by our neighbors." :
                        data.subType === "grocery" ? "We're an independent market committed to fresh produce, quality goods, and fair prices for everyone in this neighborhood." :
                        data.subType === "electronics" ? "Fast, honest phone and device repair — most repairs done same day. We've been fixing the neighborhood's tech for years, no appointment needed." :
                        "We're a neighborhood store built around our community. Walk in, tell us what you need — we'll take care of you."
                      ) :
                      st ? `We've been ${st.label.toLowerCase()} in this neighborhood for years. We take pride in every job and we stand behind our work. Every customer is treated like family.` :
                      "Tell us who you are, who you serve, and what makes your business worth visiting."
                    } />
                  </Field>
                  <Field label="What makes you different?" hint="One sentence. Why come to you instead of someone else?">
                    <input value={data.differentiator} onChange={e => set("differentiator")(e.target.value)} placeholder={
                      data.businessType === "restaurant" ? (
                        data.subType === "caribbean" ? "Everything is made from scratch — we don't own a microwave" :
                        data.subType === "bakery" ? "Everything is baked fresh here, every morning — nothing sits overnight" :
                        data.subType === "foodTruck" ? "We cook to order — you'll never get a reheated plate from us" :
                        "We cook everything fresh and we know every regular by name"
                      ) :
                      data.businessType === "retail" ? (
                        data.subType === "cornerStore" ? "We've been here 20 years — we know our neighbors and we keep what they need in stock" :
                        data.subType === "pharmacy" ? "We've been here 30 years and we know every customer by name" :
                        data.subType === "boutique" ? "We don't carry anything we wouldn't wear ourselves" :
                        data.subType === "electronics" ? "Most repairs done same day — no appointment, no runaround" :
                        "We're not a chain — we actually know our customers"
                      ) :
                      st ? st.differentiator :
                      "What sets you apart from everyone else?"
                    } />
                  </Field>
                  <Field label="How did you get started?" hint="Optional — the story behind the business. Even one sentence helps.">
                    <textarea value={data.about} onChange={e => set("about")(e.target.value)} rows={3} placeholder={
                      data.businessType === "restaurant" ? (
                        data.subType === "caribbean" ? "My grandmother brought her recipes from Trinidad and never wrote a single one down. I learned by watching her hands…" :
                        data.subType === "bakery" ? "I started baking out of my home kitchen for neighbors and friends. When the orders wouldn't stop, I knew it was time to open a real shop…" :
                        data.subType === "soulFood" ? "My mother cooked for everyone — family, neighbors, strangers. Opening this restaurant was the only way to honor what she gave us…" :
                        "I saw a gap in this neighborhood and I knew I could fill it with something real…"
                      ) :
                      data.businessType === "retail" ? (
                        data.subType === "cornerStore" ? "My father opened this store in 1987 with nothing but a handshake loan and a belief that this block needed a place to call home…" :
                        data.subType === "pharmacy" ? "After 20 years working at a chain pharmacy, I opened my own because I wanted to actually know my patients…" :
                        data.subType === "boutique" ? "I started selling pieces out of my apartment because the women in my neighborhood deserved better options closer to home…" :
                        "I opened this store because I saw what was missing in my community and decided to be the one to fill it…"
                      ) :
                      st ? st.about :
                      "I started this business because I saw a need in my community and I knew I could fill it…"
                    } />
                  </Field>
                  <div style={{ background: C.amberL, borderRadius: 10, padding: "12px 16px", border: `1px solid ${C.amber}40` }}>
                    <div style={{ fontFamily: FB, fontSize: 13, color: C.amberD, lineHeight: 1.7 }}>
                      <strong>Next:</strong> We'll ask for your {data.businessType === "restaurant" ? "menu details" : data.businessType === "retail" ? "products and deals" : "services and pricing"}.
                    </div>
                  </div>
                </div>
                );
              })()}

              {/* STEP 3 — Type-specific content */}
              {step === 3 && selectedType && (() => {
                const st = data.businessType === "service" ? SERVICE_SUBTYPES[data.subType] : null;
                return (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ fontFamily: FB, fontSize: 13, color: C.mid, lineHeight: 1.7, padding: "12px 16px", background: C.paper, borderRadius: 10 }}>
                    The more detail you give us here, the more your site will feel like yours. Skip anything that doesn't apply.
                  </div>
                  {selectedType.contentFields.map(f => (
                    <Field key={f.key} label={f.label} hint={f.hint}>
                      {f.type === "textarea" ? (
                        <textarea value={data[f.key]} onChange={e => set(f.key)(e.target.value)}
                          placeholder={st && st[f.key] ? st[f.key] : f.placeholder} rows={4} />
                      ) : f.type === "select" ? (
                        <select value={data[f.key]} onChange={e => set(f.key)(e.target.value)}>
                          <option value="">Select…</option>
                          {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input value={data[f.key]} onChange={e => set(f.key)(e.target.value)}
                          placeholder={st && st[f.key] ? st[f.key] : f.placeholder} />
                      )}
                    </Field>
                  ))}
                </div>
                );
              })()}

              {/* STEP 4 — Vibe */}
              {step === 4 && (() => {
                const st = data.businessType === "service" ? SERVICE_SUBTYPES[data.subType] : null;
                return (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <Field label="Describe the vibe you want *" hint="Use your own words. The more personal and specific, the better.">
                    <textarea value={data.vibe} onChange={e => set("vibe")(e.target.value)} rows={7}
                      placeholder={
                        data.businessType === "restaurant" ? `Examples:\n• "Warm and cozy, like eating at grandma's — deep reds, warm wood, candlelight"\n• "Vibrant and tropical — bright colors, Caribbean summer energy"\n• "Clean and modern, black and gold, upscale but welcoming"` :
                        data.businessType === "retail" ? `Examples:\n• "Friendly neighborhood vibe — blues and whites, clean and simple"\n• "Warm and community-rooted, earthy tones, not corporate at all"\n• "Bold and colorful — people feel welcome the second they land"` :
                        st ? st.vibe :
                        `Examples:\n• "Professional but warm — trustworthy colors, clean layout"\n• "Bold and community-rooted — strong colors, neighborhood pride"\n• "Clean and modern — simple, confident, easy to navigate"`
                      }
                      style={{ fontSize: 14 }} />
                  </Field>
                  <div style={{ background: C.amberL, borderRadius: 12, padding: "16px 18px", border: `1px solid ${C.amber}40` }}>
                    <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: C.amberD, marginBottom: 8 }}>Tips for a great result</div>
                    <ul style={{ fontFamily: FB, fontSize: 13, color: C.mid, lineHeight: 1.9, paddingLeft: 16, margin: 0 }}>
                      <li>Mention specific colors if you have them</li>
                      <li>Compare to a feeling, a place, or a business you admire</li>
                      <li>Say what you <em>don't</em> want ("not too corporate", "nothing too plain")</li>
                      <li>Include cultural identity or neighborhood roots if it matters</li>
                    </ul>
                  </div>
                </div>
                );
              })()}

              {/* STEP 5 — Photos */}
              {step === 5 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {/* Logo callout */}
                  <div style={{ background: C.ink, borderRadius: 12, padding: "16px 18px" }}>
                    <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: C.amber, marginBottom: 6 }}>Have a logo? Upload it first.</div>
                    <div style={{ fontFamily: FB, fontSize: 13, color: `${C.cream}cc`, lineHeight: 1.75 }}>
                      Upload your logo as the <strong style={{ color: C.cream }}>first photo</strong> and we'll use it in your nav, footer, and build your whole color palette around it.
                    </div>
                    <div style={{ marginTop: 10, fontFamily: FB, fontSize: 12, color: C.amber, lineHeight: 1.7 }}>
                      <strong>Best format: SVG</strong> — looks sharp at any size, on any screen. Most logos were made in Figma, Illustrator, or Canva — all of them can export SVG. Just ask whoever made your logo for the SVG file.
                    </div>
                    <div style={{ marginTop: 6, fontFamily: FB, fontSize: 12, color: `${C.cream}55`, fontStyle: "italic" }}>
                      PNG or JPG works too — we'll still extract your brand color and use it throughout the site.
                    </div>
                  </div>

                  {/* Color picker */}
                  <div style={{ background: C.paper, borderRadius: 12, padding: "18px 20px", border: `1px solid ${C.rule}` }}>
                    <Label hint="Optional — skip it and we'll choose a color that fits your business">
                      What's your main color?
                    </Label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, marginTop: 6 }}>
                      {[["All colors","all"],["Warm & earthy","warm"],["Bold & strong","bold"],["Calm & cool","calm"],["Soft & inviting","soft"],["Classic & formal","classic"]].map(([label, key]) => (
                        <button key={key} onClick={() => setColorFilter(key)} style={{
                          fontFamily: FB, fontSize: 11, padding: "4px 12px", borderRadius: 999,
                          border: `1.5px solid ${colorFilter === key ? C.ink : C.rule}`,
                          background: colorFilter === key ? C.ink : C.warm,
                          color: colorFilter === key ? C.cream : C.mid,
                          cursor: "pointer", transition: "all 0.15s",
                        }}>{label}</button>
                      ))}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {COLOR_SWATCHES.filter(c => colorFilter === "all" || c.vibes.includes(colorFilter)).map(c => (
                        <button key={c.hex} onClick={() => set("brandColor")(data.brandColor === c.hex ? "" : c.hex)}
                          title={`${c.name} — ${c.desc}`}
                          style={{ width: 44, height: 44, borderRadius: 10, background: c.hex, border: `3px solid ${data.brandColor === c.hex ? C.ink : "transparent"}`, cursor: "pointer", flexShrink: 0, transform: data.brandColor === c.hex ? "scale(1.1)" : "scale(1)", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {data.brandColor === c.hex && <span style={{ color: isLight(c.hex) ? "#000" : "#fff", fontSize: 18, lineHeight: 1 }}>✓</span>}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.rule}` }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: data.brandColor || C.rule, border: `1px solid ${C.rule}` }} />
                      <div>
                        <div style={{ fontFamily: FB, fontSize: 13, color: C.ink }}>
                          {data.brandColor ? `${COLOR_SWATCHES.find(c => c.hex === data.brandColor)?.name} — ${COLOR_SWATCHES.find(c => c.hex === data.brandColor)?.desc}` : "No color selected — we'll choose for you"}
                        </div>
                        {data.brandColor && <button onClick={() => set("brandColor")("")} style={{ fontFamily: FB, fontSize: 12, color: C.muted, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", marginTop: 2 }}>Clear</button>}
                      </div>
                    </div>
                    <div style={{ fontFamily: FB, fontSize: 12, color: C.muted, fontStyle: "italic", marginTop: 10 }}>Don't worry about this — skip it and we'll pick the right color for your business.</div>
                  </div>

                  <PhotoUploader photos={photos} setPhotos={setPhotos} />
                  <div style={{ background: C.amberL, borderRadius: 12, padding: "16px 18px", border: `1px solid ${C.amber}40` }}>
                    <div style={{ fontFamily: FD, fontSize: 15, fontWeight: 700, color: C.amberD, marginBottom: 8 }}>What else to upload</div>
                    <ul style={{ fontFamily: FB, fontSize: 13, color: C.mid, lineHeight: 1.9, paddingLeft: 16, margin: 0 }}>
                      {selectedType?.id === "restaurant" ? <><li>Your best dishes, plated and looking good</li><li>Inside your restaurant or dining area</li><li>You or your team in the kitchen</li><li>Your storefront or signage</li></>
                        : selectedType?.id === "retail" ? <><li>Your storefront or front window</li><li>Inside your store — shelves, displays</li><li>Your best-selling products</li><li>You or your team</li></>
                          : <><li>Your workspace or studio</li><li>Examples of your work</li><li>You working with a client</li><li>Your storefront or signage</li></>}
                    </ul>
                    <div style={{ fontFamily: FB, fontSize: 12, color: C.amber, marginTop: 10, fontStyle: "italic" }}>No photos yet? Sites without photos still look great — we use bold color and typography instead. You can always add photos later.</div>
                  </div>
                </div>
              )}

              {/* STEP 6 — Pages */}
              {step === 6 && selectedType && (() => {
                const st = data.businessType === "service" ? SERVICE_SUBTYPES[data.subType] : null;

                // Build page list — subtype overrides if available
                const allPages = st?.pages || selectedType.pages;
                const defaultPages = st?.defaultPages || selectedType.defaultPages;

                const descriptions = {
                  "Home": "Your hero section — first impression, main CTA",
                  "Our Menu": "Show your dishes, categories, and specialties",
                  "Our Products": "Highlight what you sell and any current deals",
                  "Sales & Specials": "Feature your best deals and promotions",
                  "Our Services": "List what you offer with descriptions and pricing",
                  "About Us": "Tell your story and introduce your team",
                  "Gallery": "Show photos of your space, work, or products",
                  "Gallery / Portfolio": "Showcase your best work with photos",
                  "Testimonials": "Share what happy customers are saying",
                  "Hours & Location": "Your hours, address, and a map",
                  "Book an Appointment": "A clear call-to-action to book your services",
                  "Schedule a Drop-Off": "Let customers schedule when to bring their car",
                  "Request a Quote": "A form for customers to request pricing",
                  "Free Consultation": "Invite prospects to schedule a free call",
                  "Order / Reserve": "Link to ordering or reservation platforms",
                  "Worship Times": "Service schedule, location, and how to join",
                  "Ministries & Programs": "Youth group, outreach, community programs",
                  "Giving": "Online giving and donation information",
                  "Portfolio": "Showcase your photography or video work",
                  "FAQ": "Answer the questions you get asked most",
                  "Pre-Need Planning": "Information about planning ahead",
                  "Contact": "Phone, address, and a way to reach you",
                };

                return (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ fontFamily: FB, fontSize: 13, color: C.mid, lineHeight: 1.7, padding: "12px 16px", background: C.paper, borderRadius: 10 }}>
                    Home and Contact are always included. Check anything else you want on your site.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {allPages.map(page => {
                      const locked = page === "Home" || page === "Contact";
                      const selected = data.pages.includes(page);
                      return (
                        <div key={page} onClick={() => !locked && togglePage(page)}
                          style={{ border: `1.5px solid ${selected ? C.ink : C.rule}`, borderRadius: 10, padding: "12px 16px", cursor: locked ? "default" : "pointer", background: selected ? C.paper : C.warm, display: "flex", alignItems: "center", gap: 12, opacity: locked ? 0.5 : 1, transition: "all 0.15s" }}
                        >
                          <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selected ? C.ink : C.rule}`, background: selected ? C.ink : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {selected && <span style={{ color: C.cream, fontSize: 10, fontWeight: 700 }}>✓</span>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: FB, fontSize: 13, fontWeight: 600, color: C.ink }}>{page}</div>
                            {descriptions[page] && <div style={{ fontFamily: FB, fontSize: 11, color: C.muted, marginTop: 2 }}>{descriptions[page]}</div>}
                          </div>
                          {locked && <span style={{ fontFamily: FB, fontSize: 10, color: C.muted, flexShrink: 0 }}>always on</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })()}

              {/* STEP 7 — Contact */}
              {step === 7 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="col-sm">
                    <Field label="Phone *"><input value={data.phone} onChange={e => set("phone")(e.target.value)} type="tel" placeholder="(914) 000-0000" /></Field>
                    <Field label="Email"><input value={data.email} onChange={e => set("email")(e.target.value)} type="email" placeholder="info@yourbiz.com" /></Field>
                  </div>
                  <Field label="Street Address *"><input value={data.address} onChange={e => set("address")(e.target.value)} placeholder="26 S 4th Ave, Mount Vernon, NY 10550" /></Field>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="col-sm">
                    <Field label="City *" hint="Goes in your community section"><input value={data.city} onChange={e => set("city")(e.target.value)} placeholder="Mount Vernon, NY" /></Field>
                    <Field label="Neighborhood / cross streets" hint="Optional — adds local flavor">
                      <input value={data.neighborhood} onChange={e => set("neighborhood")(e.target.value)} placeholder="Unionport, corner of Melrose & 161st" />
                    </Field>
                  </div>
                  <Field label="Business Hours *" hint="Exactly as you want them displayed">
                    <input value={data.hours} onChange={e => set("hours")(e.target.value)} placeholder="Mon–Fri 9am–6pm · Sat 10am–4pm · Closed Sunday" />
                  </Field>
                  <Field label="Instagram handle" hint="Optional — we'll link it on your site">
                    <input value={data.instagram} onChange={e => set("instagram")(e.target.value)} placeholder="@yourbusiness" />
                  </Field>
                  <div style={{ background: C.amberL, borderRadius: 12, padding: "14px 16px", border: `1px solid ${C.amber}40` }}>
                    <div style={{ fontFamily: FB, fontSize: 13, color: C.amberD, lineHeight: 1.7 }}>
                      <strong>Almost there.</strong> After this we'll research your business and build your site — free, no payment yet. You'll see the real thing before you decide anything.
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Nav buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Show any error right above the button on step 6 */}
              {step === 7 && errorDetails && (
                <div style={{ background: "#FEF2F2", border: "1.5px solid #EF4444", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontFamily: FB, fontWeight: 700, fontSize: 14, color: "#991B1B", marginBottom: 4 }}>⚠️ {errorDetails.message}</div>
                  <div style={{ fontFamily: FB, fontSize: 13, color: "#7F1D1D", lineHeight: 1.6 }}>{errorDetails.hint}</div>
                  {errorDetails.raw && (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ fontFamily: FB, fontSize: 11, color: "#9B1C1C", cursor: "pointer" }}>Technical details</summary>
                      <div style={{ fontFamily: "monospace", fontSize: 11, color: "#9B1C1C", marginTop: 4, wordBreak: "break-all" }}>{errorDetails.raw}</div>
                    </details>
                  )}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <Btn variant="ghost" onClick={() => step === 1 ? setScreen("landing") : setStep(s => s - 1)}>
                  ← {step === 1 ? "Back to home" : "Back"}
                </Btn>
                {step < 7 ? (
                  <Btn onClick={() => setStep(s => s + 1)} disabled={step === 1 && (!data.businessType || !data.subType)}>
                    Continue →
                  </Btn>
                ) : previewHTML ? (
                  // Preview already exists — don't let them silently regenerate, send back
                  <Btn variant="amber" onClick={() => setStep(8)}>
                    Back to my preview →
                  </Btn>
                ) : (
                  <Btn variant="amber" onClick={() => {
                    const missing = [];
                    if (!data.businessName) missing.push("business name");
                    if (!data.phone) missing.push("phone number");
                    if (!data.address) missing.push("address");
                    if (!data.city) missing.push("city");
                    if (missing.length > 0) {
                      alert(`Almost there! Please go back and add your ${missing.join(", ")} — these are needed to build your site.`);
                      return;
                    }
                    handleGeneratePreview();
                  }}>
                    Generate my free preview →
                  </Btn>
                )}
              </div>
            </div>
          </>
        )}

      </div>

      {/* ── Slim form footer ── */}
      <div style={{ borderTop: `1px solid ${C.rule}`, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, maxWidth: 660, margin: "32px auto 0" }}>
        <Logo height={32} />
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <a href="mailto:hello@blocksitebuilder.com" style={{ fontFamily: FB, fontSize: 12, color: C.muted, textDecoration: "none" }}>hello@blocksitebuilder.com</a>
          <span style={{ fontFamily: FB, fontSize: 12, color: C.rule }}>·</span>
          <span style={{ fontFamily: FB, fontSize: 12, color: C.muted }}>© {new Date().getFullYear()} BlockSite</span>
        </div>
      </div>

    </div>
  );
}
