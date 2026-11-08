"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 3000);
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "";
const API_VERSION = process.env.WHATSAPP_API_VERSION || "v23.0";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "members.json");
const PUBLIC_DIR = path.join(__dirname, "public");

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ nextId: 1, members: [] }, null, 2));

function readDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { return { nextId: 1, members: [] }; }
}
function writeDb(db) {
  const temp = DB_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(db, null, 2));
  fs.renameSync(temp, DB_FILE);
}
function normalisePhone(phone) { return String(phone || "").replace(/\D/g, ""); }
function allocateId(n) { return `NIGERIA ${String(n).padStart(3, "0")}`; }

function getOrCreateMember(phone, name) {
  const digits = normalisePhone(phone);
  if (!digits) return { member: null, isNew: false };
  const db = readDb();
  const existing = db.members.find(m => m.phone === digits);
  if (existing) {
    if (!existing.name && name) existing.name = name;
    existing.lastSeenAt = new Date().toISOString();
    writeDb(db);
    return { member: existing, isNew: false };
  }
  const now = new Date().toISOString();
  const member = {
    id: allocateId(db.nextId++),
    phone: digits,
    name: String(name || "").slice(0, 100),
    registeredAt: now,
    lastSeenAt: now,
    source: "WhatsApp"
  };
  db.members.push(member);
  writeDb(db);
  return { member, isNew: true };
}

function welcomeText(member, isNew) {
  const greeting = member.name ? `Hello ${member.name}!` : "Hello!";
  if (!isNew) {
    return `${greeting} Welcome back to JUSTUNILAG MEDIA.\n\nYour registration ID is *${member.id}*. It remains the same whenever you message us.\n\nYour Campus. Your Entertainment. Your Updates.`;
  }
  return `${greeting} Welcome to *JUSTUNILAG MEDIA*! 👋\n\nYou're connected to campus news, entertainment, trends, scholarships and opportunities.\n\n🇳🇬 YOUR REGISTRATION ID: *${member.id}*\n\nYour number has been registered. Keep this ID for future reference.\n\n*Your Campus. Your Entertainment. Your Updates.*`;
}

async function sendWhatsAppText(to, body) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.log(`[DRY RUN] Would send WhatsApp message to ${to}:\n${body}`);
    return;
  }
  const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body }
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("WhatsApp send failed:", response.status, result);
    throw new Error("WhatsApp API message failed");
  }
  return result;
}

function basicAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString();
    const splitAt = decoded.indexOf(":");
    const user = decoded.slice(0, splitAt);
    const pass = decoded.slice(splitAt + 1);
    const userOk = Buffer.byteLength(user) === Buffer.byteLength(ADMIN_USER) &&
      crypto.timingSafeEqual(Buffer.from(user), Buffer.from(ADMIN_USER));
    const passOk = Buffer.byteLength(pass) === Buffer.byteLength(ADMIN_PASSWORD) &&
      crypto.timingSafeEqual(Buffer.from(pass), Buffer.from(ADMIN_PASSWORD));
    if (userOk && passOk && ADMIN_PASSWORD.length >= 12) return next();
  }
  res.setHeader("WWW-Authenticate", 'Basic realm="JustUNILAG Media Admin"');
  res.statusCode = 401;
  res.end("Admin login required. Set ADMIN_PASSWORD to a unique password of at least 12 characters.");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, app: "JustUNILAG Media Bot" }));
  }

  // Meta webhook verification
  if (req.method === "GET" && url.pathname === "/webhook") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === VERIFY_TOKEN) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end(challenge || "");
    }
    res.writeHead(403);
    return res.end("Verification failed");
  }

  if (req.method === "POST" && url.pathname === "/webhook") {
    let raw = "";
    req.setEncoding("utf8");
    for await (const chunk of req) raw += chunk;
    let payload;
    try { payload = JSON.parse(raw); }
    catch { res.writeHead(400); return res.end("Invalid JSON"); }

    // Acknowledge quickly; process inbound text messages.
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("EVENT_RECEIVED");

    if (payload.object !== "whatsapp_business_account") return;
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const profiles = new Map((value.contacts || []).map(c => [c.wa_id, c.profile?.name || ""]));
        for (const msg of value.messages || []) {
          if (!msg.from || msg.type !== "text") continue;
          try {
            const { member, isNew } = getOrCreateMember(msg.from, profiles.get(msg.from));
            if (member) await sendWhatsAppText(msg.from, welcomeText(member, isNew));
          } catch (err) { console.error("Inbound message processing error:", err.message); }
        }
      }
    }
    return;
  }

  if (url.pathname.startsWith("/admin")) {
    return basicAuth(req, res, () => {
      const db = readDb();
      if (req.method === "GET" && url.pathname === "/admin/export.csv") {
        const rows = [["Registration ID", "Phone", "Name", "Registered At", "Last Seen"]];
        for (const m of db.members) rows.push([m.id, m.phone, m.name, m.registeredAt, m.lastSeenAt]);
        const csv = rows.map(row => row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
        res.writeHead(200, {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="justunilag-members.csv"'
        });
        return res.end(csv);
      }
      if (req.method === "GET" && url.pathname === "/admin/members.json") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ total: db.members.length, members: db.members }, null, 2));
      }
      if (req.method === "GET" && url.pathname === "/admin") {
        const html = fs.readFileSync(path.join(PUBLIC_DIR, "admin.html"));
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(html);
      }
      res.writeHead(404); return res.end("Not found");
    });
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`JustUNILAG Media Bot listening on port ${PORT}`);
  if (!VERIFY_TOKEN || !WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.log("Setup incomplete: configure .env before connecting the WhatsApp Cloud API.");
  }
});
