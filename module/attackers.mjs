// Spell-created attackers: Spiritual Weapon, Spiritual Ally, Mage's Sword, Twilight Knife and Chain of Perdition.
// Each is placed like a summoned creature (summons.mjs: within the spell's range and line of effect, owned by the
// caster's player, gone when the spell ends, acting on the caster's turn), from a template in the Summons
// compendium; its attack is built at the casting from the caster's numbers.
//
// Rules (the spells' text):
//   - Spiritual weapon (medium range): "dealing 1d8 force damage per hit, + 1 point per three caster levels (maximum
//     +5 at 15th level) ... has the same threat range and critical multipliers as a real weapon of its form ... It
//     uses your base attack bonus (possibly allowing it multiple attacks per round in subsequent rounds) plus your
//     Wisdom modifier as its attack bonus. It strikes as a spell, not as a weapon ... Your feats or combat actions
//     do not affect the weapon ... A spiritual weapon's AC against touch attacks is 12 ... chaos (battleaxe), evil
//     (light flail), good (warhammer), law (longsword)."
//   - Spiritual ally (medium): "uses your base attack bonus (gaining extra attacks if your base attack bonus is high
//     enough) plus your Wisdom bonus ... 1d10 points of force damage + 1 point of damage per 3 caster levels (maximum
//     +5 at 15th level) ... speed of 30 feet, and a fly speed of 30 feet (perfect maneuverability) ... AC against
//     touch attacks is 10." It threatens, flanks and makes attacks of opportunity.
//   - Mage's sword (close): "attack bonus is equal to your caster level + your Intelligence bonus or your Charisma
//     bonus (for wizards or sorcerers, respectively) with an additional +3 enhancement bonus ... 4d6+3 points of force
//     damage, with a threat range of 19-20 and a critical multiplier of x2 ... The sword's AC is 13."
//   - Twilight knife (close): "uses your base attack bonus modified by either your Intelligence or Charisma bonus
//     (whichever is higher) ... 1d4 points of force damage ... the same threat range and critical multipliers as a
//     normal dagger ... sneak attacks as a rogue, inflicting an extra 1d6 points of force damage per four caster
//     levels ... AC against touch attacks is 12 (10 + size bonus for Tiny object) plus your Dexterity modifier."
//   - Chain of perdition (close): "dirty trick (blind or entangle), drag, reposition, and trip combat maneuvers,
//     using your caster level in place of your Combat Maneuver Bonus, and your Charisma modifier (sorcerer),
//     Intelligence modifier (wizard), or Wisdom modifier (cleric) in place of your Strength or Dexterity modifier
//     ... 10-foot reach ... AC against touch attacks is 10 + your [casting] modifier."
//   - Spell resistance: "the first time [it] strikes it" a caster level check; resisted, the spell is dispelled.
// FAQ (Paizo): special abilities that require attack rolls "benefit and suffer from all modifiers affecting attack
// rolls ... unless the spell specifically calls out that it doesn't apply them (for instance spiritual weapon calls
// out that it isn't affected by feats and combat actions)"; "effects that affect weapons work on these spells"
// (mage's sword, spiritual weapon). So each attack takes the caster's attack and weapon damage modifiers from buffs
// and conditions at the moment it's rolled, never the caster's feats. FAQ: an oracle "has to use her Wisdom
// modifier" for spiritual weapon.

import { MODULE_ID } from "./const.mjs";
import { esc, gmWhisper } from "./util.mjs";
import { baseSpellName, metamagicOf, extendFactor, metamagicRange } from "./metamagic.mjs";
import { FLAG, CARD, placeOne, closeRange, summonsActive, shareWithOwners } from "./summons.mjs";

const PACK = `${MODULE_ID}.summons`;
const mediumRange = (cl) => 100 + 10 * cl;
const plusCL3 = (cl) => Math.min(5, Math.floor(cl / 3));
const bonus = (mod) => Math.max(0, mod);
// The spellbook's casting ability (Int for a wizard, Cha for a sorcerer, Wis for a cleric)
const castingMod = (item, caster) => caster.system.abilities?.[item?.spellbook?.ability ?? "int"]?.mod ?? 0;

/** Iterative attacks from a base attack bonus: PF1's manual extra attacks at -5, -10, -15. */
const iteratives = (bab) => Array.from({ length: Math.max(0, Math.min(3, Math.floor((bab - 1) / 5))) }, (_, i) => ({ name: `Attack ${i + 2}`, formula: String(-5 * (i + 1)) }));

/** A melee attack item of force: its bonus, damage and critical fixed at the casting. */
function forceAttack(name, img, { attack, damage, critRange = 20, critMult = 2, extra = [], reach = null, notes = [] }) {
  return {
    name, type: "attack", img,
    system: {
      subType: "misc",
      attackNotes: notes,
      actions: [{
        _id: foundry.utils.randomID(16), name: "Attack", actionType: "mwak", attackBonus: String(attack),
        ability: { attack: "", damage: "", critRange, critMult },
        damage: { parts: [{ formula: damage, types: ["force"] }] },
        extraAttacks: extra.length ? { type: "custom", manual: extra, formula: {} } : { type: "custom", manual: [], formula: {} },
        range: reach ? { units: "ft", value: String(reach) } : { units: "melee" },
        activation: { type: "attack", cost: 1, unchained: { type: "attack", cost: 1 } },
      }],
    },
  };
}

/** A combat maneuver (Chain of Perdition): a CMB check with the given bonus. */
function maneuver(name, img, cmb, reach) {
  return {
    name, type: "attack", img,
    system: {
      subType: "misc",
      actions: [{ _id: foundry.utils.randomID(16), name, actionType: "mcman", attackBonus: String(cmb), ability: { attack: "", damage: "", critRange: 20, critMult: 2 }, range: { units: "ft", value: String(reach) }, activation: { type: "standard", cost: 1, unchained: { type: "action", cost: 1 } } }],
    },
  };
}

/** A note of the spell's own words on the sheet (what can't be automated). */
const ruleNote = (name, text) => ({ name, type: "feat", img: "icons/svg/mage-shield.svg", system: { subType: "misc", description: { value: `<p>${text}</p>` } } });
const UNHARMED = "“cannot be attacked or harmed by physical attacks, but dispel magic, disintegrate, a sphere of annihilation, or a rod of cancellation affects it.”";

// The alignment's weapon for spiritual weapon (and ally) without a deity
function defaultForm(caster) {
  const a = String(caster?.system?.details?.alignment ?? "").toLowerCase();
  if (a.startsWith("l")) return "Longsword";
  if (a.startsWith("c")) return "Battleaxe";
  if (a.endsWith("g")) return "Warhammer";
  if (a.endsWith("e")) return "Flail, Light";
  return "Warhammer";
}

/** The weapon forms (PF1's simple, martial and exotic weapons: name, threat range, multiplier), loaded once. */
let FORMS = null;
async function weaponForms() {
  if (FORMS) return FORMS;
  const pack = game.packs.get("pf1.weapons-and-ammo");
  if (!pack) return [];
  const index = await pack.getIndex({ fields: ["system.subType", "system.actions"] });
  const forms = new Map();
  for (const w of index) {
    if (w.type !== "weapon" || !["simple", "martial", "exotic"].includes(w.system?.subType) || forms.has(w.name)) continue;
    const a = w.system?.actions?.[0]?.ability ?? {};
    forms.set(w.name, { name: w.name, critRange: a.critRange ?? 20, critMult: a.critMult ?? 2 });
  }
  FORMS = [...forms.values()].sort((x, y) => x.name.localeCompare(y.name));
  return FORMS;
}

async function chooseForm(caster) {
  const forms = await weaponForms();
  if (!forms.length) return { name: defaultForm(caster), critRange: 20, critMult: 2 };
  const def = forms.findIndex((f) => f.name === defaultForm(caster));
  const label = (f) => `${f.name} (${f.critRange < 20 ? `${f.critRange}-20/` : ""}x${f.critMult})`;
  const i = await foundry.applications.api.DialogV2.wait({
    window: { title: "The weapon's form" },
    content: `<p>A weapon favored by your deity (or your alignment's: chaos battleaxe, evil light flail, good warhammer, law longsword).</p>
      <input type="search" name="q" placeholder="Search..." autocomplete="off" style="margin-bottom:4px">
      <select name="form" size="10" style="width:100%">${forms.map((f, i) => `<option value="${i}"${i === Math.max(0, def) ? " selected" : ""}>${esc(label(f))}</option>`).join("")}</select>`,
    render: (event, dialog) => {
      const root = dialog.element ?? dialog;
      const q = root.querySelector("input[name=q]");
      const select = root.querySelector("select[name=form]");
      select.options[Math.max(0, def)]?.scrollIntoView?.({ block: "center" });
      q?.addEventListener("input", () => {
        const term = q.value.toLowerCase();
        for (const o of select.options) o.hidden = !o.text.toLowerCase().includes(term);
        const first = [...select.options].find((o) => !o.hidden);
        if (first) select.value = first.value;
      });
    },
    buttons: [{ action: "ok", label: "Choose", default: true, callback: (e, b) => Number(b.form.elements.form.value) }],
    rejectClose: false,
  });
  return i == null ? null : forms[i];
}

// Each spell: its template, range, and the data built from the caster
export const ATTACKERS = {
  "spiritual weapon": {
    template: "Spiritual Weapon", range: mediumRange, form: true,
    build: ({ caster, cl, form }) => {
      const bab = caster.system.attributes.bab.total;
      const attack = bab + (caster.system.abilities.wis?.mod ?? 0);
      return {
        name: `Spiritual Weapon (${form.name})`, ac: 2,
        items: [
          forceAttack(`Spiritual ${form.name}`, "icons/weapons/hammers/hammer-war-spiked.webp", { attack, damage: `1d8 + ${plusCL3(cl)}`, critRange: form.critRange, critMult: form.critMult, extra: iteratives(bab), notes: [{ text: "It gets one attack on a round it switches targets; strikes as a spell (bypasses DR); no flanking" }] }),
          ruleNote("Force weapon", `A spiritual weapon ${UNHARMED} Its AC against touch attacks is 12.`),
        ],
      };
    },
  },
  "spiritual ally": {
    template: "Spiritual Ally", range: mediumRange, form: true,
    build: ({ caster, cl, form }) => {
      const bab = caster.system.attributes.bab.total;
      const attack = bab + bonus(caster.system.abilities.wis?.mod ?? 0);
      return {
        name: `Spiritual Ally (${form.name})`, ac: 0,
        items: [
          forceAttack(form.name, "icons/magic/holy/angel-winged-humanoid-blue.webp", { attack, damage: `1d10 + ${plusCL3(cl)}`, critRange: form.critRange, critMult: form.critMult, extra: iteratives(bab), notes: [{ text: "Strikes as a spell (bypasses DR, affects incorporeal creatures)" }] }),
          ruleNote("Force ally", `The spiritual ally ${UNHARMED} Its AC against touch attacks is 10. It threatens adjacent squares and can flank and make attacks of opportunity; you can move it as a swift action (speed 30 ft., fly 30 ft., perfect).`),
        ],
      };
    },
  },
  "mage's sword": {
    template: "Mage's Sword", range: closeRange,
    build: ({ caster, cl, item }) => ({
      name: "Mage's Sword", ac: 3,
      items: [
        forceAttack("Mage's Sword", "icons/weapons/swords/greatsword-blue.webp", { attack: cl + bonus(castingMod(item, caster)) + 3, damage: "4d6 + 3", critRange: 19, critMult: 2, notes: [{ text: "Strikes ethereal and incorporeal creatures; no flanking" }] }),
        ruleNote("Force sword", `The sword ${UNHARMED} The sword's AC is 13 (10, +0 size bonus for Medium object, +3 deflection bonus).`),
      ],
    }),
  },
  "twilight knife": {
    template: "Twilight Knife", range: closeRange,
    build: ({ caster, cl }) => {
      const bab = caster.system.attributes.bab.total;
      const mod = Math.max(caster.system.abilities.int?.mod ?? 0, caster.system.abilities.cha?.mod ?? 0);
      const dice = Math.max(0, Math.floor(cl / 4));
      return {
        name: "Twilight Knife", ac: 2 + (caster.system.abilities.dex?.mod ?? 0),
        items: [
          forceAttack("Twilight Knife", "icons/weapons/daggers/dagger-blue.webp", { attack: bab + bonus(mod), damage: "1d4", critRange: 19, critMult: 2 }),
          // "sneak attacks as a rogue": the module's sneak attack adds the dice when the target is flanked or denied Dex
          ...(dice ? [{ name: "Sneak Attack", type: "feat", img: "icons/svg/dice-target.svg", system: { subType: "classFeat", tag: "sneakAttack", actions: [{ _id: foundry.utils.randomID(16), name: "Sneak Attack", actionType: "other", damage: { parts: [{ formula: `${dice}d6`, types: ["force"] }] } }] } }] : []),
          ruleNote("Force knife", `A twilight knife ${UNHARMED} Its AC against touch attacks is 12 (10 + size bonus for Tiny object) plus your Dexterity modifier. It attacks the same creature as you each round.`),
        ],
      };
    },
  },
  "chain of perdition": {
    template: "Chain of Perdition", range: closeRange,
    build: ({ caster, cl, item }) => {
      const mod = castingMod(item, caster);
      const img = "icons/commodities/metal/chain-silver.webp";
      return {
        name: "Chain of Perdition", ac: mod,
        items: [
          ...["Dirty Trick", "Drag", "Reposition", "Trip"].map((m) => maneuver(m, img, cl + mod, 10)),
          ruleNote("Force chain", `Physical attacks cannot hit or harm the chain of perdition, but dispel magic, disintegrate, a sphere of annihilation, or a rod of cancellation affects it normally. The chain's AC against touch attacks is 10 + your casting modifier. It doesn't provoke attacks of opportunity for its maneuvers; move it up to 30 feet as a move action.`),
        ],
      };
    },
  },
};

/** Cast one of these spells: choose the form (if any), then place it (the caster's game). */
export async function castAttacker(message, key) {
  const def = ATTACKERS[key];
  const caster = ChatMessage.implementation.getSpeakerActor(message.speaker);
  const casterToken = caster?.getActiveTokens(false, false).find((tk) => tk.scene === canvas.scene);
  if (!caster || !casterToken) return ui.notifications.warn(`${message.itemSource?.name}: the caster's token must be on this scene.`);
  const pack = game.packs.get(PACK);
  const entry = pack?.index.find((e) => e.name === def.template);
  if (!entry) return ui.notifications.error(`${def.template} isn't in the Summons compendium.`);
  const cl = message.system.config?.cl ?? 1;
  const item = message.itemSource;
  const form = def.form ? await chooseForm(caster) : null;
  if (def.form && !form) return;
  const built = def.build({ caster, cl, form, item });
  const source = await pack.getDocument(entry._id);
  const mm = metamagicOf(message);
  const endsAt = game.time.worldTime + cl * (CONFIG.time.roundTime || 6) * extendFactor(mm);
  const changes = built.ac ? [{ target: "ac", formula: String(built.ac), type: "untyped" }] : [];
  const updateData = {
    name: built.name,
    items: [...source.toObject().items, ...built.items, ...(changes.length ? [{ name: "Spell's AC", type: "buff", img: "icons/svg/shield.svg", system: { active: true, subType: "perm", changes } }] : [])],
    prototypeToken: { name: built.name, disposition: casterToken.document.disposition, actorLink: true },
  };
  const tokenDoc = await placeOne(source.uuid, updateData, casterToken, metamagicRange(def.range === closeRange ? "close" : "medium", cl, mm), built.name);
  if (!tokenDoc) return;
  const actor = tokenDoc.actor ?? game.actors.get(tokenDoc.actorId);
  await actor?.setFlag(MODULE_ID, FLAG, { summoner: caster.uuid, spell: item?.name, endsAt, message: message.uuid, attacker: key, cl, srChecked: [] });
  await shareWithOwners(actor, caster);
  await ChatMessage.implementation.create({
    speaker: message.speaker,
    content: `<p><strong>${esc(item?.name ?? built.name)}</strong>: ${esc(built.name)} for ${cl * extendFactor(mm)} round${cl * extendFactor(mm) === 1 ? "" : "s"}. It acts on ${esc(caster.name)}'s turn: open its sheet from the token to attack.</p><button type="button" data-action="${MODULE_ID}-dismiss">Dismiss</button>`,
    flags: { [MODULE_ID]: { [CARD]: { tokens: [tokenDoc.uuid], summoner: caster.uuid } } },
  });
}

/* -------------------------------------------- */
/*  The caster's modifiers on each attack       */
/* -------------------------------------------- */

const STACKING = new Set(["untyped", "dodge", "circumstance", "untypedPerm", "penalty"]);
/** The caster's modifiers to these targets from buffs and conditions (not feats), stacked by bonus type. */
export function casterModifiers(caster, targets) {
  const best = new Map();
  let sum = 0;
  for (const c of caster?.changes ?? []) {
    if (!targets.includes(c.target) || !Number.isFinite(c.value) || !c.value) continue;
    const from = c.parent;
    // Buffs (spells, songs) and conditions (changes without an item); feats, gear and class features don't count
    if (from && from.type !== "buff") continue;
    if (c.value < 0 || STACKING.has(c.type)) sum += c.value;
    else best.set(c.type, Math.max(best.get(c.type) ?? 0, c.value));
  }
  for (const v of best.values()) sum += v;
  return sum;
}
const attackerOf = (action) => action?.actor?.flags?.[MODULE_ID]?.[FLAG]?.attacker ? action.actor : null;
const summonerOf = (actor) => fromUuidSync(actor.flags[MODULE_ID][FLAG].summoner ?? "");

Hooks.on("pf1PreAttackRoll", (action, config, rollData, rollOptions, parts) => {
  const actor = attackerOf(action);
  if (!actor) return;
  const caster = summonerOf(actor);
  const mod = casterModifiers(caster, action.actionType === "mcman" ? ["attack", "mattack", "cmb"] : ["attack", "mattack"]);
  if (mod) parts.push(`${mod}[${caster.name}'s modifiers]`);
});
Hooks.on("pf1PreDamageRoll", (action, rollData, parts) => {
  const actor = attackerOf(action);
  if (!actor || !parts?.length) return;
  const caster = summonerOf(actor);
  const mod = casterModifiers(caster, ["damage", "wdamage", "mwdamage"]);
  if (mod) parts.push({ base: `${mod}[${caster.name}'s modifiers]`, damageType: parts[0].damageType ?? parts[0].types ?? ["force"], type: "normal" });
});

/* -------------------------------------------- */
/*  Spell resistance on the first strike        */
/* -------------------------------------------- */

// The first attack against a creature with spell resistance: a caster level check; resisted, the spell ends
Hooks.on("createChatMessage", async (message, options, userId) => {
  if (userId !== game.user.id || message.type !== "action") return;
  const actor = ChatMessage.implementation.getSpeakerActor(message.speaker);
  const data = actor?.flags?.[MODULE_ID]?.[FLAG];
  if (!data?.attacker) return;
  const checked = new Set(data.srChecked ?? []);
  const lines = [];
  let resisted = false;
  for (const uuid of message.system.targets ?? []) {
    const target = fromUuidSync(uuid)?.actor;
    const sr = target?.system.attributes?.sr?.total ?? 0;
    if (!sr || checked.has(uuid)) continue;
    checked.add(uuid);
    const roll = await new Roll(`1d20 + ${data.cl ?? 1}`).evaluate();
    const passed = roll.total >= sr;
    lines.push(`${target.name}: caster level check ${roll.total} vs SR ${sr}: ${passed ? "it takes full effect" : "resisted, the spell is dispelled"}`);
    if (!passed) resisted = true;
  }
  if (!lines.length) return;
  await actor.setFlag(MODULE_ID, FLAG, { ...data, srChecked: [...checked] });
  await ChatMessage.implementation.create({
    speaker: message.speaker,
    content: `<p><strong>${esc(actor.name)}</strong>, spell resistance (the first strike):</p><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>${resisted ? `<button type="button" data-action="${MODULE_ID}-dismiss">Dismiss</button>` : ""}`,
    flags: resisted ? { [MODULE_ID]: { [CARD]: { tokens: actor.getActiveTokens(false, true).map((t) => t.uuid), summoner: data.summoner } } } : {},
  });
});

// Casting
Hooks.on("createChatMessage", async (message, options, userId) => {
  if (userId !== game.user.id || message.type !== "action" || !summonsActive()) return;
  const item = message.itemSource;
  const name = String(item?.type === "spell" ? baseSpellName(item) : item?.system?.spellName ?? item?.name ?? "").toLowerCase().replace(/^(scroll|wand) of /, "");
  if (ATTACKERS[name]) await castAttacker(message, name);
});

export const _test = { ATTACKERS, casterModifiers, iteratives, defaultForm, weaponForms };
