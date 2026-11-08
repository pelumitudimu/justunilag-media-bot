"use strict";
const { json, adminAuth, supabase } = require("../../lib/server");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  if (!adminAuth(req, res)) return;
  try {
    const members = await supabase("members?select=registration_id,phone,name,registered_at,last_seen_at&order=created_number.asc");
    return json(res, 200, { total: members.length, members });
  } catch {
    return json(res, 503, { error: "Member database is unavailable" });
  }
};
