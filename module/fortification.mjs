// Fortification: a chance to negate a critical hit or sneak attack against the defender, "and damage is
// instead rolled normally" (the critical hit isn't multiplied, the sneak attack dice drop). Rolled once
// per attack against the single target, before its damage is rolled, and shown on the card to
// everyone (a result after the attack, like a miss chance). Rulings: DECISIONS.md.
//
// Rules:
//   - Light / moderate / heavy fortification (armor or shield): 25 / 50 / 75%. The monster quality
//     "fortification (50%)" gives its percentage. Shield of Fortification 25%, greater 50%; Twisted
//     Innards 25%, 50% from caster level 7, 75% from 13; Armor Master's fortification (light, moderate
//     from 13th level); Phantom Fortification 50%; Dormant Defense 25% while dazed, stunned or helpless.
//   - These don't stack: the highest counts. Secured Armor's 25% "stacks with the light fortification
//     and moderate fortification armor special abilities".
//   - Anatomical Savant (attacker) reduces the chance by 25%.
//   - One-off negations the defender chooses after the hit (Bracelet of Second Chances, 7 beads; Jingasa
//     of the Fortunate Soldier, once; Fortified): a button on the card for the target's owner or the GM.

import { MODULE_ID, ATTACK_ACTIONS } from "./const.mjs";
import { esc, classLevel, onGmRequest } from "./util.mjs";
import { rollPlan, registerDamageFilter } from "./roll-effects.mjs";

const KEY = `${MODULE_ID}Fortification`; // on the action use's roll data: attack index → roll
const FLAG = "fortification";
const LEVELS = { light: 25, moderate: 50, heavy: 75 };

const feat = (actor, re) => (actor?.itemTypes?.feat ?? []).find((f) => f.isActive !== false && re.test(f.name)) ?? null;
const buff = (actor, re) => (actor?.itemTypes?.buff ?? []).find((b) => b.isActive && re.test(b.name)) ?? null;
const worn = (actor, re) => actor?.items.find((i) => i.type === "equipment" && i.system.equipped && re.test(i.name)) ?? null;

/** The defender's chance to negate a critical hit or sneak attack: { chance, label } or null. */
export function fortificationOf(defender) {
  if (!defender) return null;
  const found = [];
  const level = (name) => LEVELS[name.match(/\b(light|moderate|heavy)\b/i)?.[1]?.toLowerCase()] ?? 0;
  const armor = worn(defender, /fortification/i);
  if (armor && level(armor.name)) found.push({ chance: level(armor.name), label: armor.name, armor: true });
  const quality = feat(defender, /^fortification \((light|moderate|heavy)\)/i);
  if (quality) found.push({ chance: level(quality.name), label: quality.name, armor: true });
  const monster = feat(defender, /^fortification(\s*\(\d+%\))?$/i);
  if (monster) found.push({ chance: Number(monster.name.match(/(\d+)%/)?.[1] ?? 50), label: monster.name });
  const master = feat(defender, /^fortification \(armor master\)/i);
  if (master) found.push({ chance: classLevel(master) >= 13 ? 50 : 25, label: master.name, armor: true });
  if (feat(defender, /^phantom fortification/i)) found.push({ chance: 50, label: "Phantom Fortification" });
  const shield = buff(defender, /^shield of fortification/i);
  if (shield) found.push({ chance: /greater/i.test(shield.name) ? 50 : 25, label: shield.name });
  const innards = buff(defender, /^twisted innards/i);
  if (innards) {
    const cl = innards.system.level ?? 1;
    found.push({ chance: cl >= 13 ? 75 : cl >= 7 ? 50 : 25, label: innards.name });
  }
  if (feat(defender, /^dormant defense/i) && ["dazed", "stunned", "helpless"].some((id) => defender.statuses?.has(id))) found.push({ chance: 25, label: "Dormant Defense" });
  let best = found.reduce((a, b) => (!a || b.chance > a.chance ? b : a), null);
  if (feat(defender, /^secured armor/i)) {
    best = best?.armor && best.chance <= 50 ? { chance: best.chance + 25, label: `${best.label} + Secured Armor` } : best && best.chance >= 25 ? best : { chance: 25, label: "Secured Armor" };
  }
  return best;
}

const d100 = () => Math.ceil(CONFIG.Dice.randomUniform() * 100) || 1;

// Roll once per attack, before its rolls (the attack roll comes first; a crit confirmation reuses it)
Hooks.on("pf1PreAttackRoll", (action, config, rollData) => {
  if (!ATTACK_ACTIONS.includes(action.actionType)) return;
  const index = rollData.attackCount ?? 0;
  const results = (rollData[KEY] ??= {});
  if (index in results) return;
  const targets = [...game.user.targets];
  const fort = targets.length === 1 ? fortificationOf(targets[0].actor) : null;
  const savant = feat(action.actor, /^anatomical savant/i) ? 25 : 0;
  const chance = fort ? Math.min(100, fort.chance - savant) : 0;
  if (chance <= 0) return void (results[index] = null);
  const roll = d100();
  results[index] = { chance, label: fort.label, savant: !!savant, roll, negated: roll <= chance };
});

// A negated hit: no critical damage (PF1 rolls it separately from the normal damage), no precision dice
registerDamageFilter((rollData, parts) => {
  if (!rollData[KEY]?.[rollData.attackCount ?? 0]?.negated) return;
  if (rollData.critMult > 1) {
    for (const part of parts) Object.assign(part, { base: "0", extra: [] });
    return;
  }
  for (let k = parts.length - 1; k > 0; k--) if ([...(parts[k].damageType ?? [])].includes("precision")) parts.splice(k, 1);
});

/* -------------------------------------------- */
/*  The card                                    */
/* -------------------------------------------- */

const hasSneak = (use) => !!rollPlan(use.shared.rollData)?.provided.some((p) => p.id === "sneak-attack" && p.dice?.dmg);

// One-off negations the defender can choose: { label, left } or null
function oneOffs(defender) {
  const out = [];
  const bracelet = worn(defender, /bracelet of second chances/i);
  if (bracelet) out.push({ key: "bracelet", label: bracelet.name, uuid: bracelet.uuid, left: bracelet.getFlag(MODULE_ID, "beads") ?? 7 });
  const jingasa = worn(defender, /jingasa of the fortunate soldier/i);
  if (jingasa) out.push({ key: "jingasa", label: jingasa.name, uuid: jingasa.uuid, left: jingasa.getFlag(MODULE_ID, "used") ? 0 : 1 });
  const fortified = feat(defender, /^fortified\b/i);
  if (fortified) {
    const uses = fortified.system.uses;
    out.push({ key: "fortified", label: fortified.name, uuid: fortified.uuid, left: uses?.per && uses.maxFormula && uses.value != null ? uses.value : null });
  }
  return out.filter((o) => o.left !== 0);
}

Hooks.on("pf1PreDisplayActionUse", (use) => {
  const results = use.shared.rollData?.[KEY];
  const target = use.shared.targets?.length === 1 ? use.shared.targets[0] : null;
  if (!target?.actor) return;
  const sneak = hasSneak(use);
  const attacks = {};
  use.shared.chatAttacks.forEach((a, i) => {
    if (!a.hasCritConfirm && !(sneak && a.type !== "manyshot")) return; // neither a threat nor a sneak attack
    const roll = results?.[i] ?? null;
    attacks[i] = { roll, crit: !!a.hasCritConfirm, sneak: sneak && a.type !== "manyshot" };
  });
  if (!Object.values(attacks).some((a) => a.roll) && !oneOffs(target.actor).length) return;
  use.shared.chatData[`flags.${MODULE_ID}.${FLAG}`] = { target: target.document.uuid, attacks, negated: {} };
});

function what({ crit, sneak }) {
  return [crit ? "critical hit" : null, sneak ? "sneak attack" : null].filter(Boolean).join(" and ");
}

Hooks.on("renderChatMessagePF", (message, html) => {
  const data = message.getFlag(MODULE_ID, FLAG);
  if (!data) return;
  const target = fromUuidSync(data.target)?.actor;
  for (const [i, a] of Object.entries(data.attacks)) {
    const el = html.querySelector(`.chat-attack[data-index="${i}"]`);
    if (!el) continue;
    const lines = [];
    const line = (text, ok) => {
      const div = document.createElement("div");
      div.className = `${MODULE_ID}-fortification`;
      div.style.cssText = `margin: 0.25em 0; padding: 0 4px; border-left: 3px solid ${ok ? "#5a5" : "#b33"};`;
      div.innerHTML = text;
      lines.push(div);
      return div;
    };
    if (a.roll) {
      const outcome = a.roll.negated ? `<strong>${esc(what(a))} negated</strong>: damage rolled normally` : `not negated`;
      line(`${esc(a.roll.label)} ${a.roll.chance}%${a.roll.savant ? " (Anatomical Savant −25%)" : ""}: rolled ${a.roll.roll} → ${outcome}`, !a.roll.negated);
    }
    const done = data.negated?.[i];
    if (done) line(`<strong>${esc(done.by)}</strong>: ${esc(what(a))} negated, normal damage ${done.amount}`, false);
    else if (!a.roll?.negated && target && (game.user.isGM || target.isOwner)) {
      for (const option of oneOffs(target)) {
        const div = line(`${esc(target.name)} can negate the ${esc(what(a))}:`, true);
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `${option.label}${option.left != null ? ` (${option.left} left)` : ""}`;
        button.style.cssText = "width: auto; line-height: 1.4; margin: 2px 0.25em; padding: 0 6px;";
        button.addEventListener("click", async (event) => {
          event.preventDefault();
          button.disabled = true;
          if (game.user.isGM) await negate(message, i, option.key);
          else await ChatMessage.implementation.create({ whisper: game.users.filter((u) => u.isGM).map((u) => u.id), content: `<p>${esc(target.name)} negates a ${esc(what(a))} (${esc(option.label)})…</p>`, flags: { [MODULE_ID]: { negateHit: { message: message.id, index: i, key: option.key } } } });
        });
        div.append(button);
      }
    }
    if (done && game.user.isGM && !done.applied) {
      const apply = line(`Apply the normal damage to ${esc(target?.name ?? "the target")}:`, true);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `Apply ${done.amount}`;
      button.style.cssText = "width: auto; line-height: 1.4; margin: 2px 0.25em; padding: 0 6px;";
      button.addEventListener("click", async () => {
        button.disabled = true;
        await target?.applyDamage(done.amount, { forceDialog: false });
        await message.update({ [`flags.${MODULE_ID}.${FLAG}.negated.${i}.applied`]: true });
      });
      apply.append(button);
    }
    const table = el.querySelector("table");
    table ? table.after(...lines) : el.append(...lines);
  }
});

/** The defender negates attack `index` with a one-off (GM): spend it, and work out the normal damage. */
export async function negate(message, index, key) {
  const data = message.getFlag(MODULE_ID, FLAG);
  const target = fromUuidSync(data?.target)?.actor;
  const option = target && oneOffs(target).find((o) => o.key === key);
  if (!option || data.negated?.[index]) return null;
  const item = fromUuidSync(option.uuid);
  if (key === "bracelet") {
    await item.setFlag(MODULE_ID, "beads", option.left - 1);
    if (option.left - 1 <= 0) ChatMessage.implementation.create({ speaker: ChatMessage.implementation.getSpeaker({ actor: target }), content: `<p>${esc(item.name)}: its last bead shatters and the bracelet crumbles into powder.</p>` });
  } else if (key === "jingasa") await item.setFlag(MODULE_ID, "used", true);
  else if (option.left != null) await item.update({ "system.uses.value": option.left - 1 });
  // Normal damage: the damage rolls without precision damage, and no critical damage
  const rolls = message.systemRolls?.attacks?.[index]?.damage ?? [];
  const amount = rolls.filter((r) => ![...(r.options?.damageType ?? [])].includes("precision")).reduce((t, r) => t + (r.total ?? 0), 0);
  const result = { by: option.label, amount };
  await message.update({ [`flags.${MODULE_ID}.${FLAG}.negated.${index}`]: result });
  return result;
}

onGmRequest("negateHit", async (request, { message, index, key }) => {
  const card = game.messages.get(message);
  if (card) await negate(card, index, key);
  await request.delete();
});

export const _test = { KEY, FLAG, fortificationOf, negate };
