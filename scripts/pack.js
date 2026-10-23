// Compiles each src/<pack>/*.json folder into packs/<pack> (LevelDB, Foundry v13 format).
const fs = require("fs"), path = require("path");
const { ClassicLevel } = require("classic-level");
const root = path.join(__dirname, "..");
(async () => {
  for (const pack of fs.readdirSync(path.join(root, "src"))) {
    const src = path.join(root, "src", pack), out = path.join(root, "packs", pack);
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });
    const db = new ClassicLevel(out, { keyEncoding: "utf8", valueEncoding: "json" });
    const files = fs.readdirSync(src);
    for (const f of files) {
      const { _key, ...doc } = JSON.parse(fs.readFileSync(path.join(src, f)));
      doc._stats = { coreVersion: "13.351", systemId: "pf1", systemVersion: "11.11" };
      await db.put(_key, doc);
    }
    await db.close();
    console.log("packed", pack, files.length);
  }
})();
