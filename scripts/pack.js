// Compiles each src/<pack>/*.json folder into packs/<pack> (LevelDB, Foundry v13 format).
// Actors keep their items and effects as separate entries ("!actors.items!<actor>.<item>"), as Foundry stores them.
const fs = require("fs"), path = require("path");
const { ClassicLevel } = require("classic-level");
const root = path.join(__dirname, "..");
const STATS = { coreVersion: "13.351", systemId: "pf1", systemVersion: "11.11" };
(async () => {
  for (const pack of fs.readdirSync(path.join(root, "src"))) {
    const src = path.join(root, "src", pack), out = path.join(root, "packs", pack);
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });
    const db = new ClassicLevel(out, { keyEncoding: "utf8", valueEncoding: "json" });
    const files = fs.readdirSync(src);
    for (const f of files) {
      const { _key, ...doc } = JSON.parse(fs.readFileSync(path.join(src, f)));
      doc._stats = { ...(doc._stats ?? {}), ...STATS };
      if (_key.startsWith("!actors!")) {
        for (const item of doc.items ?? []) {
          for (const effect of item.effects ?? []) await db.put(`!actors.items.effects!${doc._id}.${item._id}.${effect._id}`, effect);
          item.effects = (item.effects ?? []).map((e) => e._id);
          item._stats = { ...(item._stats ?? {}), ...STATS };
          await db.put(`!actors.items!${doc._id}.${item._id}`, item);
        }
        for (const effect of doc.effects ?? []) await db.put(`!actors.effects!${doc._id}.${effect._id}`, effect);
        doc.items = (doc.items ?? []).map((i) => i._id);
        doc.effects = (doc.effects ?? []).map((e) => e._id);
      }
      await db.put(_key, doc);
    }
    await db.close();
    console.log("packed", pack, files.length);
  }
})();
