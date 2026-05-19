// api/upload-photo.js
// Receives a base64 photo from the client, uploads to Vercel Blob, returns public URL
// Vercel Blob docs: https://vercel.com/docs/storage/vercel-blob

export const config = {
  api: { bodyParser: { sizeLimit: "5mb" } },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { photoBase64, fileName, mimeType } = req.body;

  if (!photoBase64 || !fileName) {
    return res.status(400).json({ error: "Missing photoBase64 or fileName" });
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    return res.status(500).json({ error: "BLOB_READ_WRITE_TOKEN not configured" });
  }

  try {
    // Convert base64 to buffer
    const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Upload to Vercel Blob
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase();
    const uniqueName = `photos/${Date.now()}-${safeName}`;

    const uploadRes = await fetch(`https://blob.vercel-storage.com/${uniqueName}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${blobToken}`,
        "Content-Type": mimeType || "image/jpeg",
        "x-content-type": mimeType || "image/jpeg",
        "x-add-random-suffix": "1",
      },
      body: buffer,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.error("Blob upload error:", err.slice(0, 200));
      return res.status(500).json({ error: "Failed to upload photo" });
    }

    const blobData = await uploadRes.json();
    console.log(`Photo uploaded: ${blobData.url}`);

    return res.status(200).json({ url: blobData.url });

  } catch(err) {
    console.error("Upload error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
