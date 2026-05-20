// api/send-email.js
// Called by BLK bypass in the app to trigger the correct customer email
// without going through Stripe. Uses same logic as webhook.js.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { orderId, packageId, customerEmail } = req.body;

  if (!orderId || !packageId || !customerEmail) {
    return res.status(400).json({ error: "Missing orderId, packageId, or customerEmail" });
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || "BlockSite <hello@blocksitebuilder.com>";
  const ownerEmail = process.env.OWNER_EMAIL;

  // Fetch job data from Upstash
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
      console.log(`[${orderId}] Upstash result exists: ${!!upstashData.result}`);
      if (upstashData.result) {
        // Decode the outer base64 envelope
        let decoded;
        try {
          decoded = JSON.parse(Buffer.from(upstashData.result, "base64").toString("utf8"));
        } catch(e) {
          // Try without outer decode (old format)
          decoded = JSON.parse(upstashData.result);
        }
        htmlB64 = decoded.htmlB64;
        if (htmlB64 && typeof htmlB64 !== "string") htmlB64 = null;
        console.log(`[${orderId}] htmlB64 present: ${!!htmlB64}, length: ${htmlB64?.length || 0}`);
        businessName = decoded.businessName || "Your Business";
        city = decoded.city || "";
        bizSlug = businessName.toLowerCase().replace(/\s+/g, "-");
      } else {
        console.log(`[${orderId}] No Upstash data found for order — attachment will be missing`);
      }
    } catch(e) {
      console.error("Upstash fetch error:", e.message);
    }
  }

  const PACKAGE_NAMES = {
    basic: "Just the Site",
    support: "Site + Revisions",
    fullservice: "Full Service",
  };

  function emailHeader() {
    const logoB64 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxODUwIDM2MCIgcm9sZT0iaW1nIj4KICA8ZGVmcz4KICAgIDxzdHlsZT4KICAgICAgLmlua3tmaWxsOm5vbmU7c3Ryb2tlOiNmYWY4ZjM7c3Ryb2tlLXdpZHRoOjg7c3Ryb2tlLWxpbmVjYXA6cm91bmQ7c3Ryb2tlLWxpbmVqb2luOnJvdW5kfQogICAgICAuaW5rLWZpbGx7ZmlsbDojZmFmOGYzfQogICAgICAuZ29sZC1zdHJva2V7ZmlsbDpub25lO3N0cm9rZTojYzQ4MTNhO3N0cm9rZS13aWR0aDoxMDtzdHJva2UtbGluZWNhcDpyb3VuZDtzdHJva2UtbGluZWpvaW46cm91bmR9CiAgICAgIC53b3JkLWxpZ2h0e2ZvbnQtZmFtaWx5Okdlb3JnaWEsc2VyaWY7Zm9udC1zaXplOjE1MHB4O2ZvbnQtd2VpZ2h0OjcwMDtmaWxsOiNmYWY4ZjN9CiAgICAgIC53b3JkLWdvbGR7Zm9udC1mYW1pbHk6R2VvcmdpYSxzZXJpZjtmb250LXNpemU6MTUwcHg7Zm9udC13ZWlnaHQ6NzAwO2ZpbGw6I2M0ODEzYX0KICAgIDwvc3R5bGU+CiAgPC9kZWZzPgogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDU1IDQ1KSI+CiAgICA8cGF0aCBjbGFzcz0iZ29sZC1zdHJva2UiIGQ9Ik0zNCAxMjggQzM0IDU2IDkxIDEyIDE1OCAxMiBDMjIyIDEyIDI3MCA1NCAyODQgMTExIiAvPgogICAgPHBhdGggY2xhc3M9ImluayIgZD0iTTAgMjU4IEgzMjIiIC8+CiAgICA8cGF0aCBjbGFzcz0Imlua3NoIiBkPSJNMzIgMjU4IFYxNjgiIC8+CiAgICA8cGF0aCBjbGFzcz0iaW5rIiBkPSJNNzQgMjU4IFYxNTggSDE1NiBWMjU4IiAvPgogICAgPHBhdGggY2xhc3M9Imlua3NoIiBkPSJNMTY0IDI1OCBWNJBIIDI0MiBWMjU4IiAvPgogICAgPHBhdGggY2xhc3M9Imlua3NoIiBkPSJNMjQyIDI1OCBWMTI5IEgzMDAgVjI1OCIgLz4KICA8L2c+CiAgPHRleHQgeD0iNDg1IiB5PSIxOTAiIGNsYXNzPSJ3b3JkLWxpZ2h0Ij5CTE9DSzx0c3BhbiBjbGFzcz0id29yZC1nb2xkIj5TaXRlPC90c3Bhbj48L3RleHQ+Cjwvc3ZnPg==";
    return `<div style="background:#1c1a14;padding:28px 32px;border-radius:12px 12px 0 0;text-align:center">
      <img src="${logoB64}" alt="BlockSite" height="44" style="height:44px;width:auto;display:inline-block" />
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
      <p style="margin:0 0 10px;font-size:15px;line-height:1.7">Your website is attached to this email as a <strong>.txt file</strong>. Here's how to open it:</p>
      <ol style="margin:0;padding-left:20px;font-size:14px;line-height:2;color:#1c1a14">
        <li>Download the attached file to your Desktop</li>
        <li>Right-click it → Rename → change <strong>.txt</strong> to <strong>.html</strong></li>
        <li>Double-click it — your website opens in your browser</li>
      </ol>
      <p style="margin:10px 0 0;font-size:13px;color:#a89880;font-style:italic">Email providers block .html files for security — renaming it takes 5 seconds.</p>
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
      <p style="margin:0 0 10px;font-size:15px;line-height:1.7">Free and the #1 thing that gets you found when people search nearby${city ? ` in ${city}` : ""}.</p>
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

  try {
    let subject, html, attachments = [];

    if (packageId === "basic") {
      subject = `Your BlockSite website is ready — ${businessName}`;
      html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1c1a14">
        ${emailHeader()}
        <div style="background:#faf8f3;padding:32px;border:1px solid #e2ddd0;border-top:none;border-radius:0 0 12px 12px">
          <h2 style="font-size:24px;font-weight:700;margin:0 0 8px">Your website is ready!</h2>
          <p style="color:#6b6355;margin:0 0 24px">Order ID: <strong>${orderId}</strong> · Just the Site</p>
          <p style="font-size:16px;line-height:1.7;margin:0 0 24px">Your BlockSite website for <strong>${businessName}</strong> is attached. Here's how to get it live.</p>
          ${deploySteps(city)}
          ${emailFooter()}
        </div>
      </div>`;
      if (htmlB64) attachments = [{ filename: `${bizSlug}-website.txt`, content: htmlB64, content_type: "text/plain" }]; // Gmail blocks .html — rename to .txt

    } else if (packageId === "support") {
      subject = `Your BlockSite website is ready — ${businessName}`;
      html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1c1a14">
        ${emailHeader()}
        <div style="background:#faf8f3;padding:32px;border:1px solid #e2ddd0;border-top:none;border-radius:0 0 12px 12px">
          <h2 style="font-size:24px;font-weight:700;margin:0 0 8px">Your website is ready!</h2>
          <p style="color:#6b6355;margin:0 0 24px">Order ID: <strong>${orderId}</strong> · Site + Revisions</p>
          <p style="font-size:16px;line-height:1.7;margin:0 0 16px">Your BlockSite website for <strong>${businessName}</strong> is attached.</p>
          <div style="background:#f0fdf4;border:1px solid #3a6e4f40;border-radius:10px;padding:20px;margin-bottom:24px">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#3a6e4f;text-transform:uppercase;letter-spacing:0.08em">Your revision round is included</p>
            <p style="margin:0;font-size:15px;line-height:1.7">Not happy with something? Reply to this email within 60 days with what you'd like changed. We fix it until it's right.</p>
          </div>
          ${deploySteps(city)}
          ${emailFooter()}
        </div>
      </div>`;
      if (htmlB64) attachments = [{ filename: `${bizSlug}-website.txt`, content: htmlB64, content_type: "text/plain" }]; // Gmail blocks .html — rename to .txt

    } else {
      // fullservice
      subject = `We're on it — ${businessName} · BlockSite Full Service`;
      html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1c1a14">
        ${emailHeader()}
        <div style="background:#faf8f3;padding:32px;border:1px solid #e2ddd0;border-top:none;border-radius:0 0 12px 12px">
          <h2 style="font-size:24px;font-weight:700;margin:0 0 8px">We're on it.</h2>
          <p style="color:#6b6355;margin:0 0 24px">Order ID: <strong>${orderId}</strong> · Full Service</p>
          <p style="font-size:16px;line-height:1.7;margin:0 0 24px">Thank you for choosing Full Service for <strong>${businessName}</strong>. You don't need to do anything — we handle everything from here.</p>
          <div style="background:#1c1a14;border-radius:12px;padding:28px;margin-bottom:24px;color:#faf8f3">
            <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#c4813a;text-transform:uppercase;letter-spacing:0.08em">What happens next</p>
            ${["We'll reach out within 24 hours to confirm your details and kick off your launch.",
               "We purchase and set up your domain — nothing needed from you.",
               "We deploy your site and handle all technical setup.",
               "We create your Google Business Profile so you show up in local searches.",
               "We send you your live URL — nothing left to do but share it.",
               "30 days of follow-up support after launch. Reply to this email anytime."]
              .map((step, i) => `<div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:14px">
                <div style="width:24px;height:24px;border-radius:50%;background:#c4813a;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#faf8f3bb">${step}</p>
              </div>`).join("")}
          </div>
          ${emailFooter()}
        </div>
      </div>`;

      // Notify owner to take action
      if (ownerEmail && resendKey) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: fromEmail,
            to: ownerEmail,
            subject: `[BlockSite] ACTION NEEDED — Full Service — ${businessName} · ${orderId}`,
            html: `<div style="font-family:sans-serif;padding:24px;max-width:600px">
              <h2 style="color:#c4813a">Full Service — Action Required</h2>
              <p><strong>Business:</strong> ${businessName}</p>
              <p><strong>Customer:</strong> ${customerEmail}</p>
              <p><strong>Order ID:</strong> ${orderId}</p>
              <p style="color:#666;margin-top:16px">Reach out to this customer within 24 hours to kick off their launch.</p>
            </div>`,
            attachments: htmlB64 ? [{ filename: `${bizSlug}-website.txt`, content: htmlB64, content_type: "text/plain" }] : [],
          }),
        });
      }
    }

    // Send customer email
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
      body: JSON.stringify({ from: fromEmail, to: customerEmail, subject, html, attachments }),
    });
    const resendData = await resendRes.json();
    console.log(`[${orderId}] Resend response: ${JSON.stringify(resendData)} · attachments: ${attachments.length}`);
    if (!resendRes.ok) {
      return res.status(500).json({ error: `Resend error: ${JSON.stringify(resendData)}` });
    }

    console.log(`Email sent: ${packageId} → ${customerEmail}`);
    return res.status(200).json({ sent: true });

  } catch(err) {
    console.error("Send email error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
