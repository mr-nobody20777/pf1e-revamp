// Summon Monster and Summon Nature's Ally: casting opens a picker of the spell's creatures, then Foundry Summons
// places each one with a crosshair limited to the spell's range. The creatures come from this module's Summons
// compendium (Bestiary stat blocks); the summoner's player owns them; they vanish when the spell ends.
//
// Rules (Core Rulebook, Summon Monster I; Summon Monster II-IX, Summon Nature's Ally):
//   - "It appears where you designate and acts immediately, on your turn." Range close (25 ft. + 5 ft./2 levels);
//     duration 1 round/level. The creature must appear where the caster has line of effect.
//   - Summon Monster N: "one creature from the Nth-level list, 1d3 creatures of the same kind from the (N-1)th-level
//     list, or 1d4+1 creatures of the same kind from a lower-level list."
//   - "Creatures on Table 10-1 marked with an '*' are summoned with the celestial template, if you are good, and the
//     fiendish template, if you are evil. If you are neutral, you may choose which template to apply."
//   - Celestial (Bestiary): darkvision 60 ft.; resist acid, cold and electricity 5 (1-4 HD), 10 (5-10 HD) or 15
//     (11+ HD); DR 5/evil (5-10 HD) or 10/evil (11+ HD); SR equal to its new CR + 5 (CR +1 with 5 or more HD);
//     smite evil 1/day. Fiendish: the same with resist cold and fire, DR/good and smite good.
//   - Augment Summoning: "Each creature you conjure with any summon spell gains a +4 enhancement bonus to Strength
//     and Constitution for the duration of the spell that summoned it."
// Summons have no turn of their own in the combat tracker: they act on the summoner's turn (the project lead's
// ruling); the summoner's owner gets a reminder of them at the start of that turn.

import { MODULE_ID } from "./const.mjs";
import { esc, gmWhisper, onGmRequest, isActiveGM } from "./util.mjs";
import { baseSpellName, metamagicOf, extendFactor, metamagicRange } from "./metamagic.mjs";

const PACK = `${MODULE_ID}.summons`;
export const FLAG = "summon"; // summoned actor flag: { summoner, spell, endsAt, message }
export const CARD = "summonCard"; // card flag: { tokens: [uuid], summoner }

// The tables (creature, celestial/fiendish template?); names as the compendium has them
const E = (size) => ["Air", "Earth", "Fire", "Water"].map((k) => [`${size} ${k} Elemental`, false]);
const MEPHITS = ["Air", "Dust", "Earth", "Fire", "Ice", "Magma", "Ooze", "Salt", "Steam", "Water"].map((k) => [`${k} Mephit`, false]);
const t = (...names) => names.map((n) => [n, true]);
const n = (...names) => names.map((x) => [x, false]);
export const LISTS = {
  monster: [
    null,
    t("Dire Rat", "Dog", "Dolphin", "Eagle", "Fire Beetle", "Poison Frog", "Pony", "Viper"),
    [...t("Giant Ant", "Giant Centipede", "Giant Frog", "Giant Spider", "Goblin Dog", "Horse", "Hyena", "Octopus", "Squid", "Wolf"), ...E("Small"), ...n("Lemure")],
    [...t("Giant Ant", "Gorilla", "Aurochs", "Boar", "Cheetah", "Constrictor Snake", "Crocodile", "Dire Bat", "Electric Eel", "Leopard", "Monitor Lizard", "Shark", "Wolverine"), ...n("Dretch", "Lantern Archon")],
    [...t("Giant Ant", "Bison", "Deinonychus", "Dire Ape", "Dire Boar", "Dire Wolf", "Giant Scorpion", "Giant Wasp", "Grizzly Bear", "Lion", "Pteranodon", "Rhinoceros"), ...E("Medium"), ...n("Hell Hound", "Hound Archon"), ...MEPHITS],
    [...t("Ankylosaurus", "Dire Lion", "Giant Moray Eel", "Orca", "Woolly Rhinoceros"), ...E("Large"), ...n("Babau", "Bearded Devil", "Bralani Azata", "Kyton", "Salamander", "Xill")],
    [...t("Dire Bear", "Dire Tiger", "Elasmosaurus", "Elephant", "Giant Octopus", "Triceratops"), ...E("Huge"), ...n("Erinyes Devil", "Invisible Stalker", "Lillend", "Shadow Demon", "Succubus")],
    [...t("Brachiosaurus", "Dire Crocodile", "Dire Shark (Megalodon)", "Giant Squid", "Mastodon Elephant", "Roc", "Tyrannosaurus"), ...E("Greater"), ...n("Bebilith", "Bone Devil", "Vrock")],
    [...E("Elder"), ...n("Barbed Devil", "Hezrou")],
    n("Astral Deva", "Ghaele Azata", "Glabrezu", "Ice Devil", "Nalfeshnee", "Trumpet Archon"),
  ],
  nature: [
    null,
    n("Dire Rat", "Dog", "Dolphin", "Eagle", "Giant Centipede", "Fire Beetle", "Mite", "Poison Frog", "Pony", "Stirge", "Viper"),
    [...n("Giant Ant", "Giant Frog", "Giant Spider", "Goblin Dog", "Horse", "Hyena", "Octopus", "Squid", "Wolf"), ...E("Small")],
    n("Giant Ant", "Gorilla", "Aurochs", "Boar", "Cheetah", "Constrictor Snake", "Crocodile", "Dire Bat", "Electric Eel", "Giant Crab", "Leopard", "Monitor Lizard", "Shark", "Wolverine"),
    [...n("Giant Ant", "Bison", "Deinonychus", "Dire Ape", "Dire Boar", "Dire Wolf", "Giant Scorpion", "Giant Stag Beetle", "Giant Wasp", "Griffon", "Grizzly Bear", "Lion", "Owlbear", "Pteranodon", "Rhinoceros", "Satyr", "Tiger"), ...E("Medium"), ...MEPHITS],
    [...n("Ankylosaurus", "Cyclops", "Dire Lion", "Orca", "Ettin", "Giant Moray Eel", "Girallon", "Manticore", "Woolly Rhinoceros"), ...E("Large")],
    [...n("Bulette", "Dire Bear", "Dire Tiger", "Elasmosaurus", "Elephant", "Giant Octopus", "Hill Giant", "Stegosaurus", "Stone Giant", "Triceratops"), ...E("Huge")],
    [...n("Brachiosaurus", "Dire Crocodile", "Dire Shark (Megalodon)", "Fire Giant", "Frost Giant", "Giant Squid", "Mastodon Elephant", "Roc", "Tyrannosaurus"), ...E("Greater")],
    [...n("Cloud Giant", "Purple Worm"), ...E("Elder")],
    n("Pixie", "Storm Giant"),
  ],
};
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };

/** The summoning spell of a card: { list, level }, or null. */
export function summonSpell(name) {
  const m = String(name ?? "").toLowerCase().match(/^summon (monster|nature's ally) (i|ii|iii|iv|v|vi|vii|viii|ix)$/);
  return m ? { list: m[1] === "monster" ? "monster" : "nature", level: ROMAN[m[2]] } : null;
}
export const summonsActive = () => !!game.modules.get("foundry-summons")?.active && !!window.foundrySummons && !!game.packs.get(PACK);

/* -------------------------------------------- */
/*  Templates                                   */
/* -------------------------------------------- */

/** Which template the caster's alignment gives (null: neutral, the caster picks). */
function templateFor(caster) {
  const a = String(caster?.system?.details?.alignment ?? "").toLowerCase();
  if (a.endsWith("g")) return "celestial";
  if (a.endsWith("e")) return "fiendish";
  return null;
}

/** The actor data changed by the celestial or fiendish template (Bestiary simple templates). */
function templateData(source, kind) {
  const hd = source.system.attributes?.hd?.total ?? source.items.filter((i) => i.type === "class").reduce((s, c) => s + (c.system.level ?? 0), 0);
  const resist = hd >= 11 ? 15 : hd >= 5 ? 10 : 5;
  const dr = hd >= 11 ? 10 : hd >= 5 ? 5 : 0;
  const good = kind === "celestial";
  const types = good ? ["acid", "cold", "electric"] : ["cold", "fire"];
  const cr = (source.system.details?.cr?.base ?? 0) + (hd >= 5 ? 1 : 0);
  const traits = foundry.utils.deepClone(source.toObject().system.traits ?? {});
  const eres = traits.eres?.value ?? [];
  for (const type of types) {
    const old = eres.find((r) => r.types?.includes(type));
    if (old) old.amount = Math.max(old.amount, resist);
    else eres.push({ amount: resist, types: [type, ""], operator: true });
  }
  traits.eres = { ...(traits.eres ?? {}), value: eres };
  if (dr) traits.dr = { ...(traits.dr ?? {}), value: [...(traits.dr?.value ?? []), { amount: dr, types: [good ? "evil" : "good", ""], operator: true }] };
  traits.senses = { ...(traits.senses ?? {}), dv: { value: Math.max(60, traits.senses?.dv?.value ?? 0) } };
  const smite = {
    name: good ? "Smite Evil (Celestial)" : "Smite Good (Fiendish)", type: "feat", img: "icons/svg/sword.svg",
    system: {
      subType: "template", abilityType: "su",
      description: { value: `<p>Once per day, as a swift action, the creature adds its Charisma bonus to attack rolls and its Hit Dice (${hd}) to damage rolls against ${good ? "evil" : "good"} foes; the smite persists until the target is dead or the creature rests.</p>` },
      uses: { per: "day", maxFormula: "1", value: 1 },
    },
  };
  return {
    name: `${good ? "Celestial" : "Fiendish"} ${source.name}`,
    system: { traits, attributes: { sr: { formula: String(cr + 5) } }, details: { cr: { base: cr } } },
    item: smite,
  };
}

/* -------------------------------------------- */
/*  Casting                                     */
/* -------------------------------------------- */

/** Ask which option the spell allows: [level, count formula]. */
async function chooseOption(spell) {
  const N = spell.level;
  const options = [[N, "1", `1 creature from the ${N}${ord(N)}-level list`]];
  if (N >= 2) options.push([N - 1, "1d3", `1d3 creatures of the same kind from the ${N - 1}${ord(N - 1)}-level list`]);
  for (let L = N - 2; L >= 1; L--) options.push([L, "1d4+1", `1d4+1 creatures of the same kind from the ${L}${ord(L)}-level list`]);
  if (options.length === 1) return options[0];
  const i = await foundry.applications.api.DialogV2.wait({
    window: { title: "Summon: how many" },
    content: `<select name="opt">${options.map((o, i) => `<option value="${i}">${esc(o[2])}</option>`).join("")}</select>`,
    buttons: [{ action: "ok", label: "Choose", default: true, callback: (e, b) => Number(b.form.elements.opt.value) }],
    rejectClose: false,
  });
  return i == null ? null : options[i];
}
const ord = (n) => (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");

/** Pick the creature from a level's list (with a search box: dropdown search rule). */
async function chooseCreature(list, level) {
  const entries = LISTS[list][level];
  return foundry.applications.api.DialogV2.wait({
    window: { title: `Summon: ${level}${ord(level)}-level list` },
    content: `<input type="search" name="q" placeholder="Search..." autocomplete="off" style="margin-bottom:4px">
      <select name="creature" size="12" style="width:100%">${entries.map(([name, tpl], i) => `<option value="${i}"${i === 0 ? " selected" : ""}>${esc(name)}${tpl ? " *" : ""}</option>`).join("")}</select>
      <p style="font-size:smaller">* celestial or fiendish, by your alignment</p>`,
    render: (event, dialog) => {
      const root = dialog.element ?? dialog;
      const q = root.querySelector("input[name=q]");
      const select = root.querySelector("select[name=creature]");
      q?.addEventListener("input", () => {
        const term = q.value.toLowerCase();
        for (const o of select.options) o.hidden = !o.text.toLowerCase().includes(term);
        const first = [...select.options].find((o) => !o.hidden);
        if (first) select.value = first.value;
      });
    },
    buttons: [{ action: "ok", label: "Summon", default: true, callback: (e, b) => entries[Number(b.form.elements.creature.value)] }],
    rejectClose: false,
  });
}

async function chooseTemplate() {
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Summon: template" },
    content: "<p>You are neutral: which template?</p>",
    buttons: [{ action: "celestial", label: "Celestial", default: true }, { action: "fiendish", label: "Fiendish" }],
    rejectClose: false,
  });
}

export const closeRange = (cl) => 25 + 5 * Math.floor(cl / 2);

/** Cast: choose, then place each creature (the caster's game). */
export async function castSummon(message, spell) {
  const caster = ChatMessage.implementation.getSpeakerActor(message.speaker);
  const casterToken = caster?.getActiveTokens(false, false).find((tk) => tk.scene === canvas.scene);
  if (!caster || !casterToken) return ui.notifications.warn("Summon: the caster's token must be on this scene.");
  const cl = message.system.config?.cl ?? 1;
  const option = await chooseOption(spell);
  if (!option) return;
  const [level, countFormula] = option;
  const pick = await chooseCreature(spell.list, level);
  if (!pick) return;
  const [name, takesTemplate] = pick;
  const pack = game.packs.get(PACK);
  const entry = pack.index.find((e) => e.name === name);
  if (!entry) return ui.notifications.error(`Summon: ${name} isn't in the Summons compendium.`);
  const source = await pack.getDocument(entry._id);
  let kind = null;
  if (takesTemplate && spell.list === "monster") kind = templateFor(caster) ?? (await chooseTemplate());
  const count = (await new Roll(countFormula).evaluate()).total;
  const mm = metamagicOf(message);
  const endsAt = game.time.worldTime + cl * (CONFIG.time.roundTime || 6) * extendFactor(mm);
  const tpl = kind ? templateData(source, kind) : null;
  const items = [];
  if (tpl) items.push(tpl.item);
  // Augment Summoning: +4 enhancement to Strength and Constitution
  if (caster.items.some((i) => i.type === "feat" && /^augment summoning$/i.test(i.name))) {
    items.push({ name: "Augment Summoning", type: "buff", img: "icons/svg/upgrade.svg", system: { active: true, subType: "perm", changes: [{ target: "str", formula: "4", type: "enh" }, { target: "con", formula: "4", type: "enh" }] } });
  }
  const updateData = {
    ...(tpl ? { name: tpl.name, system: tpl.system } : {}),
    items: [...source.toObject().items, ...items],
    prototypeToken: { name: tpl?.name ?? source.name, disposition: casterToken.document.disposition, actorLink: true },
  };
  // tcal replaces the flags of the creatures it creates: ours are set once each is placed
  const flag = { summoner: caster.uuid, spell: message.itemSource?.name, endsAt, message: message.uuid };
  const range = metamagicRange("close", cl, mm);
  const placed = [];
  for (let i = 0; i < count; i++) {
    const tokenDoc = await placeOne(source.uuid, updateData, casterToken, range, `${tpl?.name ?? name} ${i + 1}/${count}`);
    if (!tokenDoc) break;
    const actor = tokenDoc.actor ?? game.actors.get(tokenDoc.actorId);
    await actor?.setFlag(MODULE_ID, FLAG, flag);
    placed.push(tokenDoc.uuid);
  }
  if (!placed.length) return;
  await ChatMessage.implementation.create({
    speaker: message.speaker,
    content: `<p><strong>${esc(message.itemSource?.name ?? "Summon")}</strong>: ${placed.length} ${esc(tpl?.name ?? name)}${placed.length > 1 ? "s" : ""} for ${cl * extendFactor(mm)} round${cl * extendFactor(mm) === 1 ? "" : "s"}. ${placed.length > 1 ? "They act" : "It acts"} on ${esc(caster.name)}'s turn.</p><button type="button" data-action="${MODULE_ID}-dismiss">Dismiss</button>`,
    flags: { [MODULE_ID]: { [CARD]: { tokens: placed, summoner: caster.uuid } } },
  });
}

/** Place one creature with the crosshair, within range and line of effect; asks again when a wall is in the way. */
export async function placeOne(uuid, updateData, casterToken, range, label) {
  for (let attempt = 0; attempt < 5; attempt++) {
    let tokenDoc;
    try {
      tokenDoc = await window.foundrySummons.pick({
        uuid,
        updateData: foundry.utils.deepClone(updateData),
        crosshairParameters: {
          label: { text: label },
          location: { obj: casterToken, limitMaxRange: range, showRange: true, displayRangePoly: true, rangePolyLineColor: 0x7b5d38, rangePolyFillColor: 0x7b5d38 },
        },
      });
    } catch {
      return null; // cancelled
    }
    // On a player's game the token comes back from the GM's as plain data: find the scene's own document
    const id = tokenDoc?._id ?? tokenDoc?.id;
    if (!(tokenDoc instanceof TokenDocument)) {
      tokenDoc = null;
      for (let i = 0; i < 20 && !tokenDoc; i++) {
        tokenDoc = canvas.scene.tokens.get(id) ?? null;
        if (!tokenDoc) await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (!tokenDoc) return null;
    const center = tokenDoc.object?.center ?? { x: tokenDoc.x + (tokenDoc.width * canvas.grid.size) / 2, y: tokenDoc.y + (tokenDoc.height * canvas.grid.size) / 2 };
    const blocked = CONFIG.Canvas.polygonBackends.move.testCollision(casterToken.center, center, { type: "move", mode: "any" });
    if (!blocked) return tokenDoc;
    ui.notifications.warn("A wall blocks the line of effect to that spot: place it again.");
    await requestDismiss([tokenDoc.uuid]);
  }
  return null;
}

/* -------------------------------------------- */
/*  Ending                                      */
/* -------------------------------------------- */

/** Remove summoned tokens (the GM's game), and their temporary actors with them. */
async function dismiss(tokenUuids) {
  for (const uuid of tokenUuids) {
    const token = fromUuidSync(uuid);
    if (token) await token.delete();
  }
}
export async function requestDismiss(tokenUuids) {
  if (game.user.isGM) return dismiss(tokenUuids);
  return ChatMessage.implementation.create({ whisper: gmWhisper(), content: "<p>Dismiss summons</p>", flags: { [MODULE_ID]: { summonDismiss: { tokens: tokenUuids } } } });
}
onGmRequest("summonDismiss", async (request, { tokens }) => {
  // Only the summoner's owner (or a GM) may dismiss them
  const ok = tokens.every((uuid) => {
    const actor = fromUuidSync(uuid)?.actor;
    const summoner = fromUuidSync(actor?.flags?.[MODULE_ID]?.[FLAG]?.summoner ?? "");
    // A token just placed behind a wall has no summon flag yet: its own temporary actor's owner may remove it
    const freshSummon = !!actor && !!game.tcal?.isTransientActor?.(actor) && actor.testUserPermission(request.author, "OWNER");
    return request.author?.isGM || (summoner && summoner.testUserPermission(request.author, "OWNER")) || freshSummon;
  });
  await request.delete();
  if (ok) await dismiss(tokens);
});

// A summoned creature's last token gone: its temporary actor goes too (tcal only cleans up when the world loads)
Hooks.on("deleteToken", async (token) => {
  if (!isActiveGM()) return;
  const actor = game.actors.get(token.actorId);
  if (!actor?.flags?.[MODULE_ID]?.[FLAG] || !game.tcal?.isTransientActor?.(actor)) return;
  if (game.scenes.some((s) => s.tokens.some((tk) => tk.actorId === actor.id))) return;
  await actor.delete();
});

// The spell's duration ends: its summons vanish
Hooks.on("updateWorldTime", () => {
  if (!isActiveGM()) return;
  // Summons are linked world actors: check the actors, then find their tokens by id (reading token.actor on every
  // unlinked token in every scene would build a synthetic actor for each)
  const ended = new Set(game.actors.filter((a) => a.flags?.[MODULE_ID]?.[FLAG]?.endsAt != null && game.time.worldTime >= a.flags[MODULE_ID][FLAG].endsAt).map((a) => a.id));
  if (!ended.size) return;
  const expired = game.scenes.contents.flatMap((scene) => scene.tokens.filter((t) => ended.has(t.actorId)));
  if (!expired.length) return;
  (async () => {
    const names = expired.map((tk) => tk.name);
    await dismiss(expired.map((tk) => tk.uuid));
    await ChatMessage.implementation.create({ whisper: gmWhisper(), content: `<p>The summoning ends: ${esc(names.join(", "))} vanish${names.length === 1 ? "es" : ""}.</p>` });
  })();
});

// The summoner's turn: a reminder of the creatures that act on it
Hooks.on("combatTurnChange", async (combat, prior, current) => {
  if (!isActiveGM()) return;
  const summoner = combat.combatants.get(current?.combatantId)?.actor;
  if (!summoner) return;
  const mine = (combat.scene ?? canvas.scene)?.tokens.filter((tk) => tk.actor?.flags?.[MODULE_ID]?.[FLAG]?.summoner === summoner.uuid) ?? [];
  if (!mine.length) return;
  const owners = game.users.filter((u) => !u.isGM && summoner.testUserPermission(u, "OWNER")).map((u) => u.id);
  await ChatMessage.implementation.create({ whisper: [...owners, ...gmWhisper()], content: `<p>${esc(summoner.name)}'s summons act now: ${esc(mine.map((tk) => tk.name).join(", "))}.</p>` });
});

// Casting: the caster's game runs the summoning
Hooks.on("createChatMessage", async (message, options, userId) => {
  if (userId !== game.user.id || message.type !== "action" || !summonsActive()) return;
  const item = message.itemSource;
  const name = item?.type === "spell" ? baseSpellName(item) : item?.system?.spellName ?? item?.name;
  const spell = summonSpell(String(name ?? "").replace(/^(scroll|wand) of /i, ""));
  if (spell) await castSummon(message, spell);
});

// The card's Dismiss button: the summoner's owner and the GM
Hooks.on("renderChatMessageHTML", (message, html) => {
  const data = message.getFlag(MODULE_ID, CARD);
  const button = data && html.querySelector(`[data-action="${MODULE_ID}-dismiss"]`);
  if (!button) return;
  const summoner = fromUuidSync(data.summoner);
  if (!game.user.isGM && !summoner?.isOwner) return void button.remove();
  button.addEventListener("click", async () => {
    button.disabled = true;
    await requestDismiss(data.tokens.filter((uuid) => fromUuidSync(uuid)));
  });
});

export const _test = { LISTS, summonSpell, templateData, closeRange, dismiss, FLAG };
