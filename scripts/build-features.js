// Generates src/features/*.json: class features PF1 doesn't ship (e.g. Solar bloodline powers).
// Descriptions come verbatim from the saved rules text in "../Rules Text".
// flags["pf1e-revamp"].grants lists trait grants applied at runtime by module/subclass.mjs.
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const rid = (seed, n) => crypto.createHash("sha1").update(seed).digest("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, n);
const RULES = path.join(__dirname, "..", "..", "Rules Text");

/** Paragraphs of a power's rules text: from its "Name (Su)" heading to the next heading. */
function powerText(file, name) {
  const text = fs.readFileSync(path.join(RULES, file), "utf8");
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `${name} (Su)` || l.trim() === `${name} (Ex)` || l.trim() === `${name} (Sp)`);
  if (start < 0) throw new Error(`${name} not found in ${file}`);
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (/^[A-Z][\w' -]+ \((Su|Ex|Sp)\)$/.test(line.trim())) break;
    if (line.trim()) body.push(`<p>${line.trim()}</p>`);
  }
  return body.join("");
}

/** A link to a related feature below the power's own text (link only, no copied rules). */
function referenceHtml(ref) {
  if (!ref) return "";
  return `<p><strong>See also:</strong> @UUID[${ref.uuid}]{${ref.label}}. <em>${ref.note}</em></p>`;
}

const SOR = "max(@class.level, @classes.sorcerer.level)";
const SOLAR = "Sorcerer Bloodline - Solar.txt";
const SOLAR_IMG = "systems/pf1/icons/skills/light_01.jpg";

const features = [
  {
    name: "Sunsight",
    file: SOLAR,
    tags: ["Bloodline Power", "Solar Bloodline"],
    level: 1,
    changeFlags: { lowLightVision: true },
    notes: [["allSavingThrows", "+[[4]] on saves vs. blindness effects (Sunsight; only if you already had low-light vision)"]],
    grants: [{ trait: "ci", type: "dazzle" }], // PF1 condition-immunity id; maps to the dazzled condition
  },
  {
    name: "Friend of Fire",
    file: SOLAR,
    tags: ["Bloodline Power", "Solar Bloodline"],
    level: 3,
    grants: [
      { trait: "eres", type: "fire", amount: `ifelse(gte(${SOR}, 9), 20, 10)`, maxLevel: 19 },
      { trait: "di", type: "fire", minLevel: 20 },
    ],
  },
  {
    name: "Cleansing Flame",
    file: SOLAR,
    tags: ["Bloodline Power", "Solar Bloodline"],
    level: 9,
    uses: { per: "day", maxFormula: `ifelse(gte(${SOR}, 20), 3, 2)` },
    actions: [
      {
        name: "Healing touch",
        actionType: "heal",
        activation: { type: "standard", unchained: { type: "action", cost: 2 } },
        range: { units: "touch" },
        target: { value: "you or creature touched" },
        damage: { parts: [{ formula: "2d8 + @attributes.hd.total", types: ["untyped"] }] },
        notes: { effect: ["May also remove one: 1d6 ability damage, blinded, confused, dazzled, deafened, diseased, exhausted, fatigued, nauseated, poisoned, or sickened."] },
      },
    ],
  },
  {
    name: "Healing Fire",
    file: SOLAR,
    tags: ["Bloodline Power", "Solar Bloodline"],
    level: 15,
    // Healing Fire works "as a cleric of half your level", so carry the Channel Energy rules for reference
    reference: {
      label: "Channel Energy",
      uuid: "Compendium.pf1.class-abilities.Item.kXXz1lO4i7CibHJ9",
      note: "Healing Fire channels as a cleric of half your sorcerer level.",
    },
    uses: { per: "day", maxFormula: "2" },
    actions: (() => {
      const dice = `(ceil(floor(${SOR} / 2) / 2))d6`;
      const dc = `10 + floor(floor(${SOR} / 2) / 2) + @abilities.cha.mod`;
      const base = {
        activation: { type: "standard", unchained: { type: "action", cost: 2 } },
        measureTemplate: { type: "circle", size: "30" },
        range: { units: "ft", value: "30" },
        duration: { units: "inst" },
      };
      return [
        { ...base, name: "Heal living", actionType: "heal", target: { value: "living creatures" }, damage: { parts: [{ formula: dice, types: ["positive"] }] } },
        { ...base, name: "Harm undead", actionType: "save", target: { value: "undead" }, damage: { parts: [{ formula: dice, types: ["positive"] }] }, save: { type: "will", dc, description: "Will halves" } },
        { ...base, name: "Fire damage", actionType: "save", target: { value: "creatures in area" }, damage: { parts: [{ formula: dice, types: ["fire"] }] }, save: { type: "will", dc, description: "Will halves" } },
      ];
    })(),
  },
];

const out = path.join(__dirname, "..", "src", "features");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const f of features) {
  const id = rid(`feature:${f.name}`, 16);
  const item = {
    _id: id,
    _key: `!items!${id}`,
    name: f.name,
    type: "feat",
    img: SOLAR_IMG,
    system: {
      description: { value: powerText(f.file, f.name) + referenceHtml(f.reference), instructions: "" },
      subType: "classFeat",
      abilityType: "su",
      associations: { classes: ["Sorcerer"] },
      tags: f.tags,
      changeFlags: f.changeFlags ?? {},
      contextNotes: (f.notes ?? []).map(([target, text]) => ({ target, text })),
      uses: f.uses ? { value: null, autoDeductChargesCost: "", rechargeFormula: "", ...f.uses } : undefined,
      actions: (f.actions ?? []).map((a, i) => ({ _id: rid(`action:${f.name}:${i}`, 16), ...a })),
    },
    flags: { "pf1e-revamp": { level: f.level, levelFormula: SOR, ...(f.grants ? { grants: f.grants } : {}) } },
    effects: [],
    ownership: { default: 0 },
  };
  if (!item.system.uses) delete item.system.uses;
  fs.writeFileSync(path.join(out, f.name.replace(/[^A-Za-z0-9]+/g, "_") + ".json"), JSON.stringify(item, null, 2));
}
console.log("wrote", features.length, "features");
