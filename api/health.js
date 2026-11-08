"use strict";
const { json } = require("../lib/server");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  return json(res, 200, { ok: true, app: "JustUNILAG Media Bot", hosting: "Vercel" });
};
