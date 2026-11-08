"use strict";
const { json, adminAuth, supabase } = require("../../lib/server");

function csvCell(value) {
  return '"' + String(value ?? "").replace(/"/g, '""') + '"';
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  if (!adminAuth(req, res)) return;
  try {
    const members = await supabase("members?select=registration_id,phone,name,registered_at,last_seen_at&order=created_number.asc");
    const rows = [["Registration ID", "Phone", "Name", "Registered At", "Last Seen"]];
    for (const m of members) rows.push([m.registration_id, m.phone, m.name, m.registered_at, m.last_seen_at]);
    const csv = rows.map(row => row.map(csvCell).join(",")).join("\r\n");
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="justunilag-members.csv"');
    return res.end(csv);
  } catch {
    return json(res, 503, { error: "Member database is unavailable" });
  }
};
