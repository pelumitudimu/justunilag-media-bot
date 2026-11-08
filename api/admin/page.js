"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { adminAuth, json } = require("../../lib/server");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  if (!adminAuth(req, res)) return;
  const html = fs.readFileSync(path.join(process.cwd(), "public", "admin.html"));
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(html);
};
