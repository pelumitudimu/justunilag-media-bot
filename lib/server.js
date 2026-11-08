"use strict";

const crypto = require("node:crypto");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error("Missing environment variable: " + name);
  return value;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function adminAuth(req, res) {
  const expectedUser = process.env.ADMIN_USER || "";
  const expectedPass = process.env.ADMIN_PASSWORD || "";
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  let valid = false;
  if (scheme === "Basic" && encoded && expectedUser && expectedPass.length >= 16) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const split = decoded.indexOf(":");
    valid = split >= 0 &&
      safeEqual(decoded.slice(0, split), expectedUser) &&
      safeEqual(decoded.slice(split + 1), expectedPass);
  }
  if (valid) return true;
  res.setHeader("WWW-Authenticate", 'Basic realm="JustUNILAG Media Admin"');
  json(res, 401, { error: "Admin login required." });
  return false;
}

async function supabase(path, options = {}) {
  const base = env("SUPABASE_URL").replace(/\/$/, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(base + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  if (!response.ok) {
    console.error("Database request failed:", response.status, text.slice(0, 500));
    throw new Error("Database request failed");
  }
  return text ? JSON.parse(text) : null;
}

async function sendWhatsAppText(to, body) {
  const token = env("WHATSAPP_TOKEN");
  const phoneNumberId = env("PHONE_NUMBER_ID");
  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  const response = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body }
      })
    }
  );
  if (!response.ok) {
    const detail = await response.text();
    console.error("WhatsApp send failed:", response.status, detail.slice(0, 500));
    throw new Error("WhatsApp message failed");
  }
}

function verifyMetaSignature(rawBody, signature) {
  const secret = env("META_APP_SECRET");
  if (!signature || !signature.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return safeEqual(signature, expected);
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

module.exports = { json, env, adminAuth, supabase, sendWhatsAppText, verifyMetaSignature, readRawBody };
