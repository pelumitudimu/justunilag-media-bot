"use strict";

const {
  json, env, supabase, sendWhatsAppText,
  verifyMetaSignature, readRawBody
} = require("../lib/server");

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token && token === process.env.VERIFY_TOKEN) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain");
      return res.end(challenge || "");
    }
    return json(res, 403, { error: "Webhook verification failed" });
  }

  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  let rawBody;
  try {
    rawBody = await readRawBody(req);
    if (!verifyMetaSignature(rawBody, req.headers["x-hub-signature-256"])) {
      return json(res, 401, { error: "Invalid webhook signature" });
    }
  } catch (error) {
    console.error("Webhook verification error:", error.message);
    return json(res, 401, { error: "Webhook verification unavailable" });
  }

  let payload;
  try { payload = JSON.parse(rawBody.toString("utf8")); }
  catch { return json(res, 400, { error: "Invalid JSON" }); }

  // Acknowledge Meta promptly. Processing remains bounded to this function invocation.
  if (payload.object !== "whatsapp_business_account") return json(res, 200, { received: true });

  try {
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const profiles = new Map((value.contacts || []).map(c => [c.wa_id, c.profile?.name || ""]));
        for (const msg of value.messages || []) {
          if (!msg.from || msg.type !== "text" || !msg.id) continue;
          const command = String(msg.text?.body || "").trim().toUpperCase();
          if (!["JOIN", "REGISTER"].includes(command)) continue;

          const rows = await supabase("rpc/register_whatsapp_member", {
            method: "POST",
            body: JSON.stringify({
              p_event_id: msg.id,
              p_phone: String(msg.from).replace(/\D/g, ""),
              p_name: profiles.get(msg.from) || ""
            })
          });
          const result = Array.isArray(rows) ? rows[0] : rows;
          if (!result || result.duplicate) continue;
          const greeting = result.name ? `Hello ${result.name}!` : "Hello!";
          const reply = result.is_new
            ? `${greeting} Welcome to *JUSTUNILAG MEDIA*! 👋\n\nYou're connected to campus news, entertainment, trends, scholarships and opportunities.\n\n🇳🇬 YOUR REGISTRATION ID: *${result.registration_id}*\n\nYour number has been registered because you sent JOIN. Keep this ID for future reference.\n\n*Your Campus. Your Entertainment. Your Updates.*\n\nReply STOP if you want us to stop using this number for member updates.`
            : `${greeting} Welcome back to JUSTUNILAG MEDIA.\n\nYour registration ID is *${result.registration_id}*. It remains the same.\n\n*Your Campus. Your Entertainment. Your Updates.*`;
          await sendWhatsAppText(msg.from, reply);
        }
      }
    }
    return json(res, 200, { received: true });
  } catch (error) {
    console.error("Webhook processing failed:", error.message);
    return json(res, 500, { error: "Webhook processing failed" });
  }
};

module.exports.config = { api: { bodyParser: false } };
