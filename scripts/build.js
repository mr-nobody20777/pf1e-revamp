// Generates src/buffs/*.json from data.js, then compiles them into packs/buffs (LevelDB).
// Usage: node scripts/build.js <path to pf1 spells.json dump>   (spell dump used only for @UUID links)
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const defs = require("./data.js");
const spells = fs.existsSync(process.argv[2] || "") ? JSON.parse(fs.readFileSync(process.argv[2])) : [];
const rid = (seed, n) => crypto.createHash("sha1").update(seed).digest("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, n);

const items = defs.map((d) => {
  const sp = spells.find((s) => s.name === d.spell);
  const link = sp ? `<p>See @UUID[Compendium.pf1.spells.Item.${sp._id}]{${d.spell}} for full details.</p>` : "";
  const src = sp?.system.sources?.[0];
  return {
    _id: rid("item:" + d.name, 16),
    name: d.name,
    type: "buff",
    img: d.img,
    system: {
      description: { value: `<p>Applies the mechanical bonuses of <em>${d.spell}</em>.</p>${d.note ? `<p>${d.note}</p>` : ""}${link}`, instructions: "" },
      changes: d.changes.map(([target, type, formula], i) => ({ _id: rid(`chg:${d.name}:${i}`, 8), target, type, formula })),
      contextNotes: (d.notes || []).map(([target, text]) => ({ target, text })),
      subType: "spell",
      active: false,
      level: d.level,
      duration: { value: d.dur[0], units: d.dur[1], end: d.dur[2] ?? "turnStart" },
      sources: src ? [{ id: src.id, pages: src.pages }] : [],
    },
    effects: [], flags: d.flags ? { "pf1e-revamp": d.flags } : {}, ownership: { default: 0 },
    _key: "!items!" + rid("item:" + d.name, 16),
  };
});

const srcDir = path.join(__dirname, "..", "src", "buffs");
fs.rmSync(srcDir, { recursive: true, force: true });
fs.mkdirSync(srcDir, { recursive: true });
for (const it of items) fs.writeFileSync(path.join(srcDir, it.name.replace(/[^A-Za-z0-9]+/g, "_") + ".json"), JSON.stringify(it, null, 2));
console.log("wrote", items.length, "source files");

