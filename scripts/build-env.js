const fs = require("node:fs");
const path = require("node:path");

const config = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
};

const output = `window.__APP_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`;
const outputPath = path.join(__dirname, "..", "env.js");

fs.writeFileSync(outputPath, output, "utf8");

if (!config.supabaseUrl || !config.supabaseAnonKey) {
  console.warn("Supabase env vars are not fully set. The app will fall back to local progress only.");
}
