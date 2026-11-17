// Weapon spells (temporary qualities, phase 1): magic weapon, greater magic weapon, keen edge, align weapon
// and bless weapon act on one weapon, but their buffs (Pathfinder 1e Content's, or the spell rows' marker)
// sit on the creature: Magic Weapon's "+1 enhancement" change reached every weapon it used. Each buff is
// bound to one weapon (a flag on the buff): its changes count for that weapon only, and what it adds shows in
// the weapon's Magic Qualities section and counts for the automation and the +10 limit. Rulings: DECISIONS.md,
// "Weapon spells".
//
// Rules (Core Rulebook, Advanced Player's Guide; verbatim where quoted):
//   - Magic weapon: "gives a weapon a +1 enhancement bonus on attack and damage rolls ... You can't cast this
//     spell on a natural weapon, such as an unarmed strike ... A monk's unarmed strike is considered a weapon".
//     Greater: "+1 per four caster levels (maximum +5). This bonus does not allow a weapon to bypass damage
//     reduction aside from magic." Enhancement bonuses don't stack: the higher of the weapon's own and the
//     spell's counts (PF1 works that out from the buff's typed changes).
//   - Keen edge: "doubles the threat range of the weapon ... can be cast only on piercing or slashing weapons
//     ... Multiple effects that increase a weapon's threat range ... don't stack." Not on a natural weapon.
//   - Align weapon: "makes a weapon chaotic, evil, good, or lawful, as you choose ... no effect on a weapon that
//     already has an alignment." Not on a natural weapon.
//   - Bless weapon: "treated as having a +1 enhancement bonus for the purpose of bypassing the DR of evil
//     creatures or striking evil incorporeal creatures (though the spell doesn't grant an actual enhancement
//     bonus). The weapon also becomes good-aligned ... (This effect overrides and suppresses any other
//     alignment the weapon might have.) ... all critical hit rolls against evil foes are automatically
//     successful ... This last effect does not apply to any weapon that already has a magical effect related to
//     critical hits, such as a keen weapon or a vorpal sword."
// Which weapon: the creature's only fitting weapon on its own; with several, the first is used and its owner
// gets a whisper to change it (as defending's). Align weapon cast without an alignment asks for one.

import { MODULE_ID } from "./const.mjs";
import { esc, ownerWhisper, wrapMethod } from "./util.mjs";
import { registerTemporary, temporaryOf, qualitiesOf } from "./magic-arms.mjs";
import { hasAlignment } from "./creature-types.mjs";
import { registerFootnote, footnoteButton, refreshFootnotes } from "./footnote.mjs";

export const FLAG = "weaponTarget"; // buff flag: the weapon's item id
const ALIGN_FLAG = "alignWeapon"; // buff flag: the alignment chosen for align weapon
const ALIGNMENTS = ["lawful", "chaotic", "good", "evil"];

const SPELLS = [
  { key: "magicWeapon", re: /^magic weapon$/i, enh: () => 1 },
  { key: "greaterMagicWeapon", re: /^(magic weapon, greater|greater magic weapon)$/i, enh: (b) => Math.min(5, Math.max(1, Math.floor((b.system.level || 1) / 4))), magicOnly: true },
  { key: "keenEdge", re: /^keen edge$/i, qualities: ["Keen"] },
  { key: "alignWeapon", re: /^align weapon(?: \((lawful|chaotic|good|evil)\))?$/i, align: true },
  { key: "blessWeapon", re: /^bless weapon$/i, bless: true },
];

/** The weapon spell a buff is, or null. */
export function spellOf(buff) {
  if (buff?.type !== "buff") return null;
  for (const s of SPELLS) {
    const match = buff.name.match(s.re);
    if (match) return { ...s, match };
  }
  return null;
}

const alignmentOf = (buff, spell) => spell.match?.[1]?.toLowerCase() ?? buff.flags?.[MODULE_ID]?.[ALIGN_FLAG] ?? null;
const isNatural = (w) => w.system?.subType === "natural";
const damageTypes = (w) => (w.defaultAction?.damage?.parts ?? []).flatMap((p) => [...(p.types ?? [])]);

/** Can the spell be cast on this weapon? */
function fits(spell, w) {
  if (!["weapon", "attack"].includes(w?.type)) return false;
  if (!spell.bless && isNatural(w)) return false; // "You can't cast this spell on a natural weapon"
  if (spell.key === "keenEdge") return damageTypes(w).some((t) => t === "piercing" || t === "slashing");
  return true;
}
const candidates = (actor, spell) => [...(actor?.itemTypes?.weapon ?? []), ...(actor?.itemTypes?.attack ?? [])].filter((w) => (w.type === "attack" || w.system.equipped) && fits(spell, w));
const boundTo = (buff) => buff.actor?.items.get(buff.flags?.[MODULE_ID]?.[FLAG]) ?? null;

/** Does the weapon already have an alignment (its own, from PF1's boxes or a holy/unholy/axiomatic/anarchic quality)? */
function aligned(weapon) {
  const own = ALIGNMENTS.some((a) => weapon.system?.alignments?.[a]);
  const q = qualitiesOf(weapon, { own: true });
  return own || ["holy", "unholy", "axiomatic", "anarchic"].some((id) => q?.ids.has(id));
}

// What each spell puts on its weapon while its buff is on
registerTemporary((item) => {
  const out = [];
  for (const buff of item.actor.itemTypes?.buff ?? []) {
    if (!buff.isActive || buff.flags?.[MODULE_ID]?.[FLAG] !== item.id) continue;
    const s = spellOf(buff);
    if (!s) continue;
    const e = { source: buff.name };
    if (s.enh) Object.assign(e, { enh: s.enh(buff), magic: true, magicOnly: !!s.magicOnly, label: `+${s.enh(buff)} enhancement` });
    if (s.qualities) Object.assign(e, { qualities: s.qualities, label: s.qualities.join(", ") });
    if (s.align) {
      const a = alignmentOf(buff, s);
      if (!a) e.label = "choose the alignment";
      else if (aligned(item)) e.label = `no effect: the weapon already has an alignment`;
      else Object.assign(e, { align: [a], label: `${a}-aligned` });
    }
    if (s.bless) Object.assign(e, { align: ["good"], bless: true, label: "good-aligned; +1 against evil creatures' DR; criticals against evil foes confirmed" });
    out.push(e);
  }
  return out;
});

// A bound buff's changes (Magic Weapon's +1 enhancement) count for its weapon only. At init: items are
// prepared before setup.
Hooks.once("init", () => {
  wrapMethod("pf1.documents.item.ItemPF.prototype.getContextChanges", function (wrapped, ...args) {
    const changes = wrapped(...args);
    return changes.some((c) => c.parent?.flags?.[MODULE_ID]?.[FLAG]) ? changes.filter((c) => { const id = c.parent?.flags?.[MODULE_ID]?.[FLAG]; return !id || id === this.id; }) : changes;
  });
});

// Against damage reduction (PF1's damage math reads only the weapon's own enhancement and alignment boxes):
// magic weapon makes the weapon magic, and greater magic weapon's bonus "does not allow a weapon to bypass
// damage reduction aside from magic"; align weapon adds its alignment; bless weapon makes it good-aligned
// (suppressing any other alignment) and, against evil creatures only, magic.
Hooks.once("setup", () => {
  wrapMethod("pf1.applications.ApplyDamage.prototype._evaluateAttack", function (wrapped, ...args) {
    const result = wrapped(...args);
    const temps = temporaryOf(this.options?.action?.item);
    if (!temps.length) return result;
    if (temps.some((t) => t.magic)) {
      this.isMagic = true;
      this.materials?.add("magic");
    }
    for (const t of temps) for (const a of t.align ?? []) this.materials?.add(a);
    if (temps.some((t) => t.bless)) {
      for (const a of ["lawful", "chaotic", "evil"]) this.materials?.delete(a);
      const targets = this.options?.targets ?? [];
      if (targets.length && targets.every((a) => hasAlignment(a, "evil") === true)) {
        this.isMagic = true;
        this.materials?.add("magic");
      }
    }
    return result;
  });
});

/* -------------------------------------------- */
/*  Which weapon                                */
/* -------------------------------------------- */

/** Bind the buff to a weapon (its only fitting one, or the first), and offer the choice when there's one to make. */
async function bind(buff) {
  const s = spellOf(buff);
  const actor = buff.actor;
  if (!s || !actor) return;
  const options = candidates(actor, s);
  const current = boundTo(buff);
  if (current && options.includes(current) && (!s.align || alignmentOf(buff, s))) return;
  const pick = current && options.includes(current) ? current : options[0] ?? null;
  if (pick && pick !== current) await buff.setFlag(MODULE_ID, FLAG, pick.id);
  if (options.length > 1 || !pick || (s.align && !alignmentOf(buff, s))) await offer(buff, s, options, pick);
}

async function offer(buff, spell, options, pick) {
  const actor = buff.actor;
  const weapons = options.length > 1 ? `<p>Weapon: ${options.map((w) => `<button type="button" data-ws-weapon="${w.id}" data-buff="${buff.uuid}" style="width:auto; padding:0 6px; ${w === pick ? "font-weight:bold; border-width:2px" : ""}">${esc(w.name)}</button>`).join(" ")}</p>` : "";
  const align = spell.align && !spell.match?.[1] ? `<p>Alignment: ${ALIGNMENTS.map((a) => `<button type="button" data-ws-align="${a}" data-buff="${buff.uuid}" style="width:auto; padding:0 6px; ${alignmentOf(buff, spell) === a ? "font-weight:bold; border-width:2px" : ""}">${a}</button>`).join(" ")}</p>` : "";
  const where = pick ? `is on the <strong>${esc(pick.name)}</strong>` : spell.key === "keenEdge" ? "has no piercing or slashing weapon to go on (equip one, then choose it on the buff)" : "has no weapon to go on (equip one, then choose it on the buff)";
  await ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    whisper: ownerWhisper(actor),
    content: `<div class="${MODULE_ID}-weapon-spell"><p><strong>${esc(buff.name)}</strong> ${where}.</p>${weapons}${align}</div>`,
  });
}

Hooks.on("createItem", (item, options, userId) => {
  if (userId === game.user.id && spellOf(item)) bind(item);
});
Hooks.on("updateItem", (item, changes, options, userId) => {
  if (userId === game.user.id && changes.system?.active === true && spellOf(item)) bind(item);
});

async function choose(buff, { weapon, alignment }) {
  if (!buff?.isOwner) return ui.notifications.warn("Only the creature's owner can choose.");
  if (weapon) await buff.setFlag(MODULE_ID, FLAG, weapon);
  if (alignment) await buff.setFlag(MODULE_ID, ALIGN_FLAG, alignment);
  refreshFootnotes(buff);
}

Hooks.on("renderChatMessageHTML", (message, html) => {
  html.querySelectorAll?.("[data-ws-weapon], [data-ws-align]").forEach((b) =>
    b.addEventListener("click", async (event) => {
      event.preventDefault();
      const buff = fromUuidSync(b.dataset.buff);
      await choose(buff, { weapon: b.dataset.wsWeapon, alignment: b.dataset.wsAlign });
      const group = b.dataset.wsWeapon ? "[data-ws-weapon]" : "[data-ws-align]";
      html.querySelectorAll(group).forEach((x) => (x.style.fontWeight = x === b ? "bold" : ""));
    })
  );
});

// On the buff: which weapon it's on, with buttons to change it
registerFootnote((item) => {
  const s = spellOf(item);
  if (!s || !item.actor) return null;
  const weapon = boundTo(item);
  const parts = [weapon ? `On the ${weapon.name}.` : "On no weapon yet."];
  if (s.align && !s.match?.[1]) parts[0] += ` Alignment: ${alignmentOf(item, s) ?? "not chosen"}.`;
  if (!item.isOwner) return parts;
  for (const w of candidates(item.actor, s)) if (w !== weapon) parts.push(footnoteButton(w.name, `Put ${item.name} on the ${w.name}`, () => choose(item, { weapon: w.id })));
  if (s.align && !s.match?.[1]) for (const a of ALIGNMENTS) parts.push(footnoteButton(a, `Make the weapon ${a}`, () => choose(item, { alignment: a })));
  return parts;
});

/* -------------------------------------------- */
/*  Bless weapon's criticals against evil       */
/* -------------------------------------------- */

/** Bless weapon: is a critical threat with this item against this creature confirmed automatically? */
export function blessConfirms(item, defender) {
  if (!defender || hasAlignment(defender, "evil") !== true) return false;
  if (!temporaryOf(item).some((t) => t.bless)) return false;
  // "does not apply to any weapon that already has a magical effect related to critical hits"
  const q = qualitiesOf(item);
  return !(q?.ids.has("keen") || q?.ids.has("vorpal"));
}

Hooks.on("renderChatMessagePF", (message, html) => {
  const item = message.itemSource;
  if (!item || !["weapon", "attack"].includes(item.type) || !temporaryOf(item).some((t) => t.bless)) return;
  const targets = message.system?.targets ?? [];
  const defender = targets.length === 1 ? fromUuidSync(targets[0])?.actor : null;
  if (!blessConfirms(item, defender)) return;
  (message.systemRolls?.attacks ?? []).forEach((attack, i) => {
    if (!attack?.critConfirm) return;
    const el = html.querySelector(`.chat-attack[data-index="${i}"]`);
    if (!el || el.querySelector(`.${MODULE_ID}-bless`)) return;
    const note = document.createElement("div");
    note.className = `${MODULE_ID}-bless`;
    note.style.cssText = "margin: 0.25em 0; padding: 0 4px; border-left: 3px solid #a85;";
    note.innerHTML = `<strong>Bless Weapon:</strong> the critical hit is confirmed against an evil foe.`;
    const table = el.querySelector("table");
    table ? table.after(note) : el.append(note);
  });
});

export const _test = { SPELLS, spellOf, candidates, bind, FLAG, ALIGN_FLAG };
