// api/webhook.js - Stripe webhook handler
// Fires after successful payment → sends correct email based on package

import crypto from "crypto";

// Verify Stripe webhook signature
function verifyStripeSignature(payload, signature, secret) {
  const parts = signature.split(",");
  const timestamp = parts.find(p => p.startsWith("t="))?.slice(2);
  const v1 = parts.find(p => p.startsWith("v1="))?.slice(3);
  if (!timestamp || !v1) return false;
  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}

// Upstash get
async function upstashGet(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const res = await fetch(`${url}/get/${key}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data.result) return null;
  try { return JSON.parse(Buffer.from(data.result, "base64").toString("utf8")); }
  catch { return null; }
}

// Upstash delete
async function upstashDel(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  await fetch(`${url}/del/${key}`, { headers: { Authorization: `Bearer ${token}` } });
}

// Send email via Resend
async function sendEmail({ to, subject, html, attachments = [] }) {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || "BlockSite <hello@blocksitebuilder.com>";
  const body = { from: fromEmail, to, subject, html };
  if (attachments.length) body.attachments = attachments;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
}

// Price ID → package info
const PRICE_MAP = {
  "price_1TYUcyDJ7Rg4CmDYO7a7hRyx": { id: "basic",       name: "Just the Site",    price: 149 },
  "price_1TYUcyDJ7Rg4CmDYarugn4l5": { id: "support",     name: "Site + Revisions", price: 299 },
  "price_1TYUcxDJ7Rg4CmDYxVBU55Jg": { id: "fullservice", name: "Full Service",      price: 699 },
};

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Read raw body for signature verification
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString("utf8");

  // Verify Stripe signature
  const sig = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return res.status(400).json({ error: "Missing signature or secret" });

  let valid;
  try { valid = verifyStripeSignature(rawBody, sig, secret); }
  catch { valid = false; }
  if (!valid) {
    console.error("Invalid Stripe signature");
    return res.status(400).json({ error: "Invalid signature" });
  }

  const event = JSON.parse(rawBody);
  console.log("Webhook event:", event.type);

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const orderId = session.client_reference_id;
  const customerEmail = session.customer_details?.email;
  const priceId = session.line_items?.data?.[0]?.price?.id;

  // If line_items not expanded, get from metadata
  const packageId = session.metadata?.packageId || priceId;
  const pkg = PRICE_MAP[packageId] || PRICE_MAP[priceId];

  console.log(`Payment complete — orderId: ${orderId}, email: ${customerEmail}, pkg: ${pkg?.name}`);

  if (!orderId || !customerEmail || !pkg) {
    console.error("Missing required data:", { orderId, customerEmail, pkg });
    return res.status(200).json({ received: true });
  }

  // Fetch the generated HTML from Upstash
  const jobData = orderId ? await upstashGet(`order:${orderId}`) : null;
  const htmlB64 = jobData?.htmlB64 || null;
  const businessName = jobData?.businessName || "Your Business";
  const bizSlug = businessName.toLowerCase().replace(/\s+/g, "-");
  const city = jobData?.city || "";

  try {
    // ── Send correct email based on package ──────────────────────

    if (pkg.id === "basic") {
      await sendEmail({
        to: customerEmail,
        subject: `Your BlockSite website is ready — ${businessName}`,
        html: basicEmail({ orderId, businessName, city }),
        attachments: htmlB64 ? [{ filename: `${bizSlug}.html`, content: htmlB64 }] : [],
      });

    } else if (pkg.id === "support") {
      await sendEmail({
        to: customerEmail,
        subject: `Your BlockSite website is ready — ${businessName}`,
        html: revisionsEmail({ orderId, businessName, city }),
        attachments: htmlB64 ? [{ filename: `${bizSlug}.html`, content: htmlB64 }] : [],
      });

    } else if (pkg.id === "fullservice") {
      await sendEmail({
        to: customerEmail,
        subject: `We're on it — ${businessName} · BlockSite Full Service`,
        html: fullServiceEmail({ orderId, businessName }),
      });

      // Also notify owner to kick off Full Service
      const ownerEmail = process.env.OWNER_EMAIL;
      if (ownerEmail) {
        await sendEmail({
          to: ownerEmail,
          subject: `[BlockSite] FULL SERVICE PAID — ${businessName} · ${orderId}`,
          html: `<div style="font-family:sans-serif;padding:24px;max-width:600px">
            <h2 style="color:#c4813a">Full Service Payment Received</h2>
            <p><strong>Business:</strong> ${businessName}</p>
            <p><strong>Customer email:</strong> ${customerEmail}</p>
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Amount:</strong> $699</p>
            <hr style="border:none;border-top:1px solid #e2ddd0;margin:20px 0"/>
            <p style="color:#666">Action required: reach out to this customer within 24 hours to kick off their launch.</p>
          </div>`,
          attachments: htmlB64 ? [{ filename: `${bizSlug}.html`, content: htmlB64 }] : [],
        });
      }
    }

    // Clean up Upstash
    if (orderId) await upstashDel(`order:${orderId}`);

    console.log(`Emails sent for ${orderId}`);
    return res.status(200).json({ received: true });

  } catch (err) {
    console.error("Webhook email error:", err.message);
    return res.status(200).json({ received: true }); // Always 200 to Stripe
  }
}

// ── Email templates ───────────────────────────────────────────────

function emailHeader() {
  return `<div style="background:#1c1a14;padding:28px 32px;border-radius:12px 12px 0 0">
    <div style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.02em">BLOCK<span style="color:#c4813a">SITE</span></div>
  </div>`;
}

function emailFooter() {
  return `<div style="background:#1c1a14;border-radius:10px;padding:24px;margin-bottom:24px;text-align:center">
    <p style="margin:0 0 8px;font-size:15px;color:#faf8f3;line-height:1.7">Questions? Just reply to this email.</p>
    <a href="mailto:hello@blocksitebuilder.com" style="color:#c4813a;font-size:15px;font-weight:600">hello@blocksitebuilder.com</a>
  </div>
  <p style="font-size:13px;color:#a89880;text-align:center;margin:0">© ${new Date().getFullYear()} BlockSite · blocksitebuilder.com</p>`;
}

function deploySteps(city = "") {
  return `
    <div style="background:#fff;border:1px solid #e2ddd0;border-radius:10px;padding:24px;margin-bottom:16px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c4813a;text-transform:uppercase;letter-spacing:0.08em">Step 1 — Save your website file</p>
      <p style="margin:0;font-size:15px;line-height:1.7">Your website is attached to this email. Save it to your Desktop. Double-click it anytime to see exactly what your live site looks like.</p>
    </div>
    <div style="background:#fff;border:1px solid #e2ddd0;border-radius:10px;padding:24px;margin-bottom:16px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c4813a;text-transform:uppercase;letter-spacing:0.08em">Step 2 — Create a free Netlify account</p>
      <p style="margin:0;font-size:15px;line-height:1.7">Go to <a href="https://netlify.com" style="color:#c4813a">netlify.com</a> and sign up. Just email and a password — no credit card needed.</p>
    </div>
    <div style="background:#fff;border:1px solid #e2ddd0;border-radius:10px;padding:24px;margin-bottom:16px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c4813a;text-transform:uppercase;letter-spacing:0.08em">Step 3 — Drag your file to go live</p>
      <p style="margin:0;font-size:15px;line-height:1.7">In Netlify, find <strong>"Deploy manually"</strong> and drag your website file into the box. In under 60 seconds you'll have a real web address. Your site is live.</p>
    </div>
    <div style="background:#fff;border:1px solid #e2ddd0;border-radius:10px;padding:24px;margin-bottom:16px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c4813a;text-transform:uppercase;letter-spacing:0.08em">Step 4 — Get a real domain name (recommended)</p>
      <p style="margin:0;font-size:15px;line-height:1.7">Go to <a href="https://namecheap.com" style="color:#c4813a">namecheap.com</a>, search your business name, and buy a .com — about $10–12/year, less than a chopped cheese. Buy 5–10 years upfront if you can: it locks in the price, you never worry about it expiring, and even 10 years costs less than a case of Corona. Netlify walks you through connecting it — no technical knowledge needed.</p>
    </div>
    <div style="background:#fff;border:1px solid #3a6e4f40;border-radius:10px;padding:24px;margin-bottom:16px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#3a6e4f;text-transform:uppercase;letter-spacing:0.08em">Step 5 — Get on Google (most important)</p>
      <p style="margin:0 0 10px;font-size:15px;line-height:1.7">This is free and the #1 thing that gets you found when people search nearby${city ? ` in ${city}` : ""}.</p>
      <ol style="margin:0;padding-left:20px;font-size:14px;line-height:2;color:#1c1a14">
        <li>Go to <a href="https://business.google.com" style="color:#c4813a">business.google.com</a> and sign in</li>
        <li>Click "Add your business" and search your name</li>
        <li>Fill in your address, phone, hours, and category</li>
        <li>Add your new website address</li>
        <li>Verify — Google mails a postcard with a code (5–14 days)</li>
        <li>Add photos once verified</li>
        <li>Ask regulars to leave a Google review — even 5 makes a big difference</li>
      </ol>
    </div>`;
}

function basicEmail({ orderId, businessName, city }) {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1c1a14">
  ${emailHeader()}
  <div style="background:#faf8f3;padding:32px;border:1px solid #e2ddd0;border-top:none;border-radius:0 0 12px 12px">
    <h2 style="font-size:24px;font-weight:700;margin:0 0 8px">Your website is ready!</h2>
    <p style="color:#6b6355;margin:0 0 24px">Order ID: <strong>${orderId}</strong> · Just the Site</p>
    <p style="font-size:16px;line-height:1.7;margin:0 0 24px">Your BlockSite website for <strong>${businessName}</strong> is attached. Here's how to get it live — no tech experience needed.</p>
    ${deploySteps(city)}
    ${emailFooter()}
  </div>
</div>`;
}

function revisionsEmail({ orderId, businessName, city }) {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1c1a14">
  ${emailHeader()}
  <div style="background:#faf8f3;padding:32px;border:1px solid #e2ddd0;border-top:none;border-radius:0 0 12px 12px">
    <h2 style="font-size:24px;font-weight:700;margin:0 0 8px">Your website is ready!</h2>
    <p style="color:#6b6355;margin:0 0 24px">Order ID: <strong>${orderId}</strong> · Site + Revisions</p>
    <p style="font-size:16px;line-height:1.7;margin:0 0 16px">Your BlockSite website for <strong>${businessName}</strong> is attached. Follow the steps below to get it live.</p>
    <div style="background:#f0fdf4;border:1px solid #3a6e4f40;border-radius:10px;padding:20px;margin-bottom:24px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#3a6e4f;text-transform:uppercase;letter-spacing:0.08em">Your revision round is included</p>
      <p style="margin:0;font-size:15px;line-height:1.7;color:#1c1a14">Not happy with the colors, layout, or copy? Just reply to this email within 60 days with what you'd like changed. We'll fix it until it's right.</p>
    </div>
    ${deploySteps(city)}
    ${emailFooter()}
  </div>
</div>`;
}

function fullServiceEmail({ orderId, businessName }) {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1c1a14">
  ${emailHeader()}
  <div style="background:#faf8f3;padding:32px;border:1px solid #e2ddd0;border-top:none;border-radius:0 0 12px 12px">
    <h2 style="font-size:24px;font-weight:700;margin:0 0 8px">We're on it.</h2>
    <p style="color:#6b6355;margin:0 0 24px">Order ID: <strong>${orderId}</strong> · Full Service</p>
    <p style="font-size:16px;line-height:1.7;margin:0 0 24px">Thank you for choosing Full Service for <strong>${businessName}</strong>. You don't need to do anything — we handle everything from here.</p>
    <div style="background:#1c1a14;border-radius:12px;padding:28px;margin-bottom:24px;color:#faf8f3">
      <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#c4813a;text-transform:uppercase;letter-spacing:0.08em">What happens next</p>
      <div style="display:flex;flex-direction:column;gap:16px">
        ${["We'll reach out within 24 hours to confirm your details and kick off your launch.",
           "We purchase and set up your domain — no action needed from you.",
           "We deploy your site and handle all the technical setup.",
           "We create your Google Business Profile so you show up in local searches.",
           "We send you your live URL — nothing left to do but share it with your customers.",
           "30 days of follow-up support after launch. Reply to this email anytime."]
          .map((step, i) => `<div style="display:flex;gap:14px;align-items:flex-start">
            <div style="width:24px;height:24px;border-radius:50%;background:#c4813a;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">${i+1}</div>
            <p style="margin:0;font-size:15px;line-height:1.6;color:#faf8f3bb">${step}</p>
          </div>`).join("")}
      </div>
    </div>
    ${emailFooter()}
  </div>
</div>`;
}
