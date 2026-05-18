// api/send-email.js
// Called by BLK bypass to send the correct customer email without Stripe

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { orderId, packageId, customerEmail } = req.body;
  console.log(`send-email called: orderId=${orderId}, pkg=${packageId}, email=${customerEmail}`);

  if (!orderId || !packageId || !customerEmail) {
    return res.status(400).json({ error: "Missing orderId, packageId, or customerEmail" });
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || "BlockSite <hello@blocksitebuilder.com>";
  const ownerEmail = process.env.OWNER_EMAIL;

  // ── Fetch job data from Upstash ───────────────────────────────
  let htmlB64 = null;
  let businessName = "Your Business";
  let city = "";
  let bizSlug = "website";

  if (upstashUrl && upstashToken) {
    try {
      const upstashRes = await fetch(`${upstashUrl}/get/order:${orderId}`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
      });
      const upstashData = await upstashRes.json();
      console.log(`Upstash response status: ${upstashRes.status}, has result: ${!!upstashData.result}`);

      if (upstashData.result) {
        const decoded = JSON.parse(Buffer.from(upstashData.result, "base64").toString("utf8"));
        htmlB64 = decoded.htmlB64;
        businessName = decoded.businessName || "Your Business";
        city = decoded.city || "";
        bizSlug = businessName.toLowerCase().replace(/\s+/g, "-");
        console.log(`Got job data: business=${businessName}, htmlB64 length=${htmlB64?.length || 0}`);
      } else {
        console.error(`No Upstash result for order:${orderId}`);
      }
    } catch(e) {
      console.error("Upstash fetch error:", e.message);
    }
  } else {
    console.error("Missing Upstash env vars");
  }

  // ── Shared email components ───────────────────────────────────
  const header = `<div style="background:#1c1a14;padding:28px 32px;border-radius:12px 12px 0 0">
    <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.02em">BLOCK<span style="color:#c4813a">SITE</span></div>
  </div>`;

  const footer = `
    <div style="background:#1c1a14;border-radius:10px;padding:24px;margin-bottom:24px;text-align:center">
      <p style="margin:0 0 8px;font-size:15px;color:#faf8f3;line-height:1.7">Questions? Just reply to this email.</p>
      <a href="mailto:hello@blocksitebuilder.com" style="color:#c4813a;font-size:15px;font-weight:600">hello@blocksitebuilder.com</a>
    </div>
    <p style="font-size:13px;color:#a89880;text-align:center;margin:0">© ${new Date().getFullYear()} BlockSite · blocksitebuilder.com</p>`;

  const deploySteps = `
    <div style="background:#fff;border:1px solid #e2ddd0;border-radius:10px;padding:24px;margin-bottom:12px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c4813a;text-transform:uppercase;letter-spacing:0.08em">Step 1 — Save your website file</p>
      <p style="margin:0;font-size:15px;line-height:1.8">Your website is attached to this email. Save it to your Desktop. Double-click it anytime — it opens in your browser and shows you exactly what your live site looks like.</p>
    </div>
    <div style="background:#fff;border:1px solid #e2ddd0;border-radius:10px;padding:24px;margin-bottom:12px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c4813a;text-transform:uppercase;letter-spacing:0.08em">Step 2 — Create a free Netlify account</p>
      <p style="margin:0;font-size:15px;line-height:1.8">Go to <a href="https://netlify.com" style="color:#c4813a">netlify.com</a> and sign up with your email and a password. No credit card. Takes 2 minutes.</p>
    </div>
    <div style="background:#fff;border:1px solid #e2ddd0;border-radius:10px;padding:24px;margin-bottom:12px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c4813a;text-transform:uppercase;letter-spacing:0.08em">Step 3 — Drag your file to go live</p>
      <p style="margin:0;font-size:15px;line-height:1.8">In Netlify, find the <strong>"Deploy manually"</strong> section and drag your website file into the box. In under 60 seconds you'll have a real web address anyone can visit. Your site is live.</p>
    </div>
    <div style="background:#fff;border:1px solid #e2ddd0;border-radius:10px;padding:24px;margin-bottom:12px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c4813a;text-transform:uppercase;letter-spacing:0.08em">Step 4 — Get a real domain name (recommended)</p>
      <p style="margin:0;font-size:15px;line-height:1.8">Go to <a href="https://namecheap.com" style="color:#c4813a">namecheap.com</a>, search your business name, and buy a .com — about $10–12/year, less than a chopped cheese. Buy 5–10 years upfront if you can: locks in the price, never worry about it expiring, and even 10 years costs less than a case of Corona. Netlify walks you through connecting it — no technical knowledge needed.</p>
    </div>
    <div style="background:#fff;border:1px solid #3a6e4f40;border-radius:10px;padding:24px;margin-bottom:12px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#3a6e4f;text-transform:uppercase;letter-spacing:0.08em">Step 5 — Get on Google (most important)</p>
      <p style="margin:0 0 10px;font-size:15px;line-height:1.8">Free and the #1 thing that gets you found when people search nearby${city ? ` in ${city}` : ""}.</p>
      <ol style="margin:0;padding-left:20px;font-size:14px;line-height:2.2;color:#1c1a14">
        <li>Go to <a href="https://business.google.com" style="color:#c4813a">business.google.com</a> and sign in with your Google account</li>
        <li>Click "Add your business" and search your business name</li>
        <li>Choose your business category and fill in your address, phone, and hours</li>
        <li>Add your new website address (your Netlify link or custom domain)</li>
        <li>Click Verify — Google mails a postcard to your address with a code (5–14 days)</li>
        <li>When the postcard arrives, log back in and enter the code</li>
        <li>Add at least 5 photos — storefront, products, your team</li>
        <li>Ask your first regulars to leave you a Google review — even 5 reviews makes a big difference</li>
      </ol>
    </div>
    <div style="background:#fff;border:1px solid #e2ddd0;border-radius:10px;padding:24px;margin-bottom:20px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c4813a;text-transform:uppercase;letter-spacing:0.08em">Step 6 — Check it on your phone</p>
      <p style="margin:0;font-size:15px;line-height:1.8">Open your live site on your actual phone. Tap every button. Try submitting the contact form with a test message. If anything looks off, reply to this email and we'll sort it out.</p>
    </div>`;

  const wrap = (inner) => `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1c1a14">
    ${header}
    <div style="background:#faf8f3;padding:32px;border:1px solid #e2ddd0;border-top:none;border-radius:0 0 12px 12px">
      ${inner}
      ${footer}
    </div>
  </div>`;

  // ── Build email per package ───────────────────────────────────
  let subject, html, attachments = [];

  if (packageId === "basic") {
    subject = `Your BlockSite website is ready — ${businessName}`;
    html = wrap(`
      <h2 style="font-size:24px;font-weight:700;margin:0 0 8px">Your website is ready!</h2>
      <p style="color:#6b6355;margin:0 0 8px">Order ID: <strong>${orderId}</strong></p>
      <p style="color:#6b6355;margin:0 0 28px;font-size:13px">Package: Just the Site</p>
      <p style="font-size:16px;line-height:1.8;margin:0 0 24px">Your BlockSite website for <strong>${businessName}</strong> is attached to this email. Follow the steps below to get it live — no tech experience needed.</p>
      ${deploySteps}
    `);
    if (htmlB64) attachments = [{ filename: `${bizSlug}.html`, content: htmlB64 }];

  } else if (packageId === "support") {
    subject = `Your BlockSite website is ready — ${businessName}`;
    html = wrap(`
      <h2 style="font-size:24px;font-weight:700;margin:0 0 8px">Your website is ready!</h2>
      <p style="color:#6b6355;margin:0 0 8px">Order ID: <strong>${orderId}</strong></p>
      <p style="color:#6b6355;margin:0 0 28px;font-size:13px">Package: Site + Revisions</p>
      <p style="font-size:16px;line-height:1.8;margin:0 0 16px">Your BlockSite website for <strong>${businessName}</strong> is attached.</p>
      <div style="background:#f0fdf4;border:1px solid #3a6e4f40;border-radius:10px;padding:20px;margin-bottom:24px">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#3a6e4f;text-transform:uppercase;letter-spacing:0.08em">Your revision round is included</p>
        <p style="margin:0;font-size:15px;line-height:1.8;color:#1c1a14">Not happy with the colors, layout, or copy? Reply to this email within 60 days with what you'd like changed. We fix it until it's right.</p>
      </div>
      ${deploySteps}
    `);
    if (htmlB64) attachments = [{ filename: `${bizSlug}.html`, content: htmlB64 }];

  } else {
    // fullservice
    subject = `We're on it — ${businessName} · BlockSite Full Service`;
    html = wrap(`
      <h2 style="font-size:24px;font-weight:700;margin:0 0 8px">We're on it.</h2>
      <p style="color:#6b6355;margin:0 0 8px">Order ID: <strong>${orderId}</strong></p>
      <p style="color:#6b6355;margin:0 0 28px;font-size:13px">Package: Full Service</p>
      <p style="font-size:16px;line-height:1.8;margin:0 0 24px">Thank you for choosing Full Service for <strong>${businessName}</strong>. You don't need to do anything — we handle everything from here.</p>
      <div style="background:#1c1a14;border-radius:12px;padding:28px;margin-bottom:24px;color:#faf8f3">
        <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#c4813a;text-transform:uppercase;letter-spacing:0.08em">What happens next</p>
        ${["We'll reach out within 24 hours to confirm your details and kick off your launch.",
           "We purchase and set up your domain — nothing needed from you.",
           "We deploy your site and handle all technical setup.",
           "We create your Google Business Profile so you show up in local searches.",
           "We send you your live URL. Nothing left to do but share it with your customers.",
           "30 days of follow-up support after launch. Reply to this email anytime."]
          .map((s, i) => `<div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:14px">
            <div style="min-width:24px;height:24px;border-radius:50%;background:#c4813a;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center">${i+1}</div>
            <p style="margin:0;font-size:15px;line-height:1.6;color:#faf8f3bb">${s}</p>
          </div>`).join("")}
      </div>
    `);

    // Alert owner
    if (ownerEmail) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: fromEmail, to: ownerEmail,
            subject: `[BlockSite] ACTION — Full Service — ${businessName} · ${orderId}`,
            html: `<div style="font-family:sans-serif;padding:24px;max-width:600px">
              <h2 style="color:#c4813a">Full Service Payment — Action Required</h2>
              <p><strong>Business:</strong> ${businessName}</p>
              <p><strong>Customer:</strong> ${customerEmail}</p>
              <p><strong>Order ID:</strong> ${orderId}</p>
              <p style="color:#666;margin-top:16px">Reach out within 24 hours to kick off their launch.</p>
            </div>`,
            attachments: htmlB64 ? [{ filename: `${bizSlug}.html`, content: htmlB64 }] : [],
          }),
        });
      } catch(e) { console.error("Owner alert error:", e.message); }
    }
  }

  // ── Send customer email ───────────────────────────────────────
  try {
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
      body: JSON.stringify({ from: fromEmail, to: customerEmail, subject, html, attachments }),
    });
    const emailData = await emailRes.json();
    console.log(`Customer email sent: ${emailRes.status}`, emailData);
    return res.status(200).json({ sent: true, hasAttachment: !!htmlB64 });
  } catch(err) {
    console.error("Resend error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
