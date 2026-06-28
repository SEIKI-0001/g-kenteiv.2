const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..");
const outputDir = path.join(rootDir, "public");
const config = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
};

const output = `window.__APP_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`;

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

for (const entry of ["index.html", "app.js", "styles.css", "assets", "data"]) {
  fs.cpSync(path.join(rootDir, entry), path.join(outputDir, entry), { recursive: true });
}

fs.writeFileSync(path.join(rootDir, "env.js"), output, "utf8");
fs.writeFileSync(path.join(outputDir, "env.js"), output, "utf8");

if (!config.supabaseUrl || !config.supabaseAnonKey) {
  console.warn("Supabase env vars are not fully set. The app will fall back to local progress only.");
}
