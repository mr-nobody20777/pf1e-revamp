// A monster's grapple after its grab (on-hit riders, phase 3): each of its turns while it holds the creature
// it grabbed, the GM gets a card to maintain the grapple (with the grab attack's damage and constrict), rake,
// swallow whole or let go. Also swallowed creatures' damage, and blood drain at the end of the turn.
//
// Rules (Bestiary universal monster rules and Core Rulebook, verbatim where quoted):
//   - Grab: "+4 bonus on combat maneuver checks made to start and maintain a grapple"; a hold with the body
//     part "takes a −20 penalty on its CMB check to make and maintain the grapple, but does not gain the
//     grappled condition itself"; "each successful grapple check it makes during successive rounds
//     automatically deals the damage indicated for the attack that established the hold", plus constrict.
//   - Grapple: "you must continue to make a check each round, as a standard action, to maintain the hold. If
//     your target does not break the grapple, you get a +5 circumstance bonus on grapple checks made against
//     the same target in subsequent rounds." A failed check ends the grapple.
//   - Rake: "two free claw attacks that it can use only against a grappled foe… must begin its turn already
//     grappling to use its rake—it can't begin a grapple and rake in the same turn" (format "rake (2 claws
//     +8, 1d4+2)").
//   - Swallow whole: "If a creature with this special attack begins its turn with an opponent grappled in its
//     mouth (see Grab), it can attempt a new combat maneuver check (as though attempting to pin the
//     opponent). If it succeeds, it swallows its prey, and the opponent takes bite damage. Unless otherwise
//     noted, the opponent can be up to one size category smaller… A swallowed creature keeps the grappled
//     condition, while the creature that did the swallowing does not." Cutting free takes "1/10 the
//     creature's total hit points"; the interior's AC is "10 + 1/2 its natural armor bonus".
//   - Blood drain: "drains blood at the end of its turn if it grapples a foe, inflicting Constitution damage."
// Rulings (DECISIONS.md, 2026-11-10): the card's buttons are the monster's choice; a swallowed creature takes
// its damage at the start of the swallower's turn; blood drain is applied by itself, with an Undo. The
// grapple is forgotten once either creature stops being grappled (an escape, by hand).

import { MODULE_ID } from "./const.mjs";
import { dealDamage, esc, isActiveGM, oncePerRound, ownerWhisper, plainText, rollTotal, steppedBack } from "./util.mjs";

const FLAG = "monsterGrapple";
const CARD = "monsterGrappleTurn";
const DICE = String.raw`\d+d\d+(?:\s*[+-]\s*\d+)?`;
const NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const ABILITY = { strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" };
const gmIds = () => game.users.filter((u) => u.isGM).map((u) => u.id);

/* -------------------------------------------- */
/*  The creature's entry                        */
/* -------------------------------------------- */

/** A special attack ("Rend (2 claws, 1d8+9)", "Swallow Whole"): the item and its "(…)" detail, from its name or text. */
export function specialAttack(actor, name) {
  const re = new RegExp(`^${name}\\b`, "i");
  const item = actor?.items.find((i) => i.type === "feat" && re.test(i.name));
  if (!item) return null;
  const text = `${item.name} ${plainText(item.system.description?.value ?? "")}`;
  return { item, text, detail: text.match(new RegExp(`${name}\\s*\\(([^)]*)\\)`, "i"))?.[1] ?? "" };
}

/** Constrict's damage: its "(1d8+6)", else its own damage formula; null without constrict, "" when it gives none. */
export function constrictFormula(actor) {
  const c = specialAttack(actor, "constrict");
  if (!c) return null;
  return c.detail.match(new RegExp(DICE))?.[0] ?? c.item.defaultAction?.damage?.parts?.[0]?.formula ?? "";
}

const SIZES = () => Object.keys(pf1.config.sizeChart);
export const sizeOf = (actor) => SIZES().indexOf(actor.system.traits?.size?.base ?? actor.system.traits?.size ?? "med");

/** A combat maneuver check against the target's CMD, posted to chat. Returns { total, success }. */
export async function maneuverCheck(attacker, target, bonus, flavor) {
  const cmd = target.system.attributes.cmd;
  const against = target.statuses.has("flatFooted") ? cmd.flatFootedTotal : cmd.total;
  const check = await new Roll(`1d20 + ${attacker.system.attributes.cmb.total}${bonus ? ` + ${bonus}` : ""}`).evaluate();
  const natural = check.dice[0]?.total;
  const success = natural === 20 || (natural !== 1 && check.total >= against);
  await check.toMessage({ speaker: ChatMessage.implementation.getSpeaker({ actor: attacker }), flavor: `${flavor}: combat maneuver check — <strong>${success ? "succeeds" : "fails"}</strong>` });
  return { total: check.total, success };
}

/* -------------------------------------------- */
/*  The grapple                                 */
/* -------------------------------------------- */

/**
 * Remember the grapple a grab (or attach) started: `target` is the held token's uuid; `formula` and `types`
 * the grab attack's damage; `hold` a hold with the body part; `bite` made with a bite (swallow whole).
 */
export async function recordGrapple(attacker, record) {
  await attacker.setFlag(MODULE_ID, FLAG, record);
}

/** The grapple it holds, while both creatures are still grappled (the holder only for attach; the target only for a hold or once swallowed). */
export function grappleOf(actor) {
  const g = actor?.getFlag(MODULE_ID, FLAG);
  const target = g && fromUuidSync(g.target)?.actor;
  if (!target) return null;
  if (g.attach) return actor.statuses.has("grappled") ? g : null;
  if (!target.statuses.has("grappled")) return null;
  if (!g.hold && !g.swallowed && !actor.statuses.has("grappled")) return null;
  return g;
}

/** Forget the grapple; `release` also removes the grappled condition from both. */
export async function endGrapple(actor, { release = false } = {}) {
  const g = actor.getFlag(MODULE_ID, FLAG);
  if (!g) return;
  await actor.unsetFlag(MODULE_ID, FLAG);
  const target = fromUuidSync(g.target)?.actor;
  const swallowed = target?.effects.filter((e) => e.getFlag(MODULE_ID, "swallowedBy") === actor.uuid) ?? [];
  if (swallowed.length) await target.deleteEmbeddedDocuments("ActiveEffect", swallowed.map((e) => e.id));
  if (!release) return;
  if (target?.statuses.has("grappled")) await target.setConditions({ grappled: false });
  if (actor.statuses.has("grappled")) await actor.setConditions({ grappled: false });
}

/** Maintain the grapple: +4 (grab), +5 (later rounds), −20 for a hold. Success deals the grab attack's damage and constrict; failure ends it. */
export async function maintain(actor) {
  const g = grappleOf(actor);
  const target = g && fromUuidSync(g.target)?.actor;
  if (!target) return "not grappling";
  const { total, success } = await maneuverCheck(actor, target, 9 + (g.hold ? -20 : 0), `Maintain the grapple on ${target.name}${g.hold ? " (hold, −20)" : ""}`);
  if (!success) {
    await endGrapple(actor, { release: true });
    return `${total}: fails, and the grapple ends`;
  }
  const parts = [];
  if (g.formula) {
    const damage = await rollTotal(g.formula);
    await dealDamage(target, damage, g.types ?? []);
    parts.push(`${damage} damage (${g.attack ?? "the grab attack"})`);
  }
  const constrict = constrictFormula(actor);
  if (constrict) {
    const damage = await rollTotal(constrict);
    await dealDamage(target, damage, ["bludgeoning"]);
    parts.push(`constricts for ${damage} bludgeoning damage`);
  } else if (constrict === "") parts.push("constrict: its entry gives no damage");
  return `${total}: holds ${target.name}${parts.length ? `; ${parts.join("; ")}` : ""}`;
}

/** Rake: its free claw attacks against the creature it holds ("2 claws +8, 1d4+2"). */
export async function rake(actor) {
  const g = grappleOf(actor);
  const target = g && fromUuidSync(g.target)?.actor;
  const r = specialAttack(actor, "rake");
  if (!target || !r) return "can't rake";
  const n = r.detail.match(/^\s*(\d+|one|two|three|four)/i)?.[1]?.toLowerCase();
  const count = Number(n) || NUMBERS[n] || 2;
  const bonus = Number(r.detail.match(/(?:^|\s)([+-]\d+)\b/)?.[1]);
  const formula = r.detail.match(new RegExp(DICE, "g"))?.pop();
  if (!Number.isFinite(bonus) || !formula) return "rake: its entry gives no attack bonus or damage, roll it by hand";
  const claw = actor.items.find((i) => i.type === "attack" && /claw/i.test(i.name));
  const types = claw?.defaultAction?.damage?.parts?.[0]?.types ?? ["bludgeoning", "slashing"];
  const ac = target.system.attributes.ac.normal.total;
  const rolls = [];
  const lines = [];
  for (let i = 0; i < count; i++) {
    const attack = await new Roll(`1d20 + ${bonus}`).evaluate();
    const natural = attack.dice[0]?.total;
    const hit = natural === 20 || (natural !== 1 && attack.total >= ac);
    rolls.push(attack);
    if (!hit) {
      lines.push(`${attack.total}: misses`);
      continue;
    }
    const damage = await new Roll(formula).evaluate();
    rolls.push(damage);
    await dealDamage(target, damage.total, types);
    lines.push(`${attack.total}: hits for ${damage.total}`);
  }
  await ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    rolls,
    content: `<p><strong>Rake</strong> (${esc(r.detail)}) against ${esc(target.name)} (AC ${ac}):</p><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`,
  });
  return `rake: ${lines.join("; ")}`;
}

/** What swallow whole does inside: "(5d6 acid damage, AC 15, 18 hp)", with the rules' defaults for AC and hit points. */
function swallowDetails(actor, s) {
  const damage = s.detail.match(new RegExp(`(${DICE}|\\d+)\\s*(?:points? of\\s+)?([a-z]+)?`, "i"));
  const type = damage?.[2]?.toLowerCase();
  return {
    formula: damage?.[1] ?? null,
    types: type && pf1.registry.damageTypes.get(type) ? [type] : ["bludgeoning"],
    ac: Number(s.detail.match(/AC\s*(\d+)/i)?.[1]) || 10 + Math.floor((actor.system.attributes.ac?.natural?.total ?? 0) / 2),
    hp: Number(s.detail.match(/(\d+)\s*hp/i)?.[1]) || Math.max(1, Math.floor((actor.system.attributes.hp?.max ?? 0) / 10)),
  };
}

/** Can it try to swallow the creature it holds (a bite grab, one size smaller or less)? */
export function canSwallow(actor) {
  const g = grappleOf(actor);
  const target = g && fromUuidSync(g.target)?.actor;
  return !!(target && g.bite && !g.swallowed && specialAttack(actor, "swallow whole") && sizeOf(target) < sizeOf(actor));
}

/** Swallow whole: a check as for a pin; success deals bite damage, and the target is inside (grappled; the swallower isn't). */
export async function swallow(actor) {
  if (!canSwallow(actor)) return "can't swallow";
  const g = grappleOf(actor);
  const target = fromUuidSync(g.target).actor;
  const { total, success } = await maneuverCheck(actor, target, 9 + (g.hold ? -20 : 0), `Swallow ${target.name} whole`);
  if (!success) return `${total}: fails to swallow ${target.name} (still grappled)`;
  const inside = swallowDetails(actor, specialAttack(actor, "swallow whole"));
  let text = `${total}: swallows ${target.name}`;
  if (g.formula) {
    const damage = await rollTotal(g.formula);
    await dealDamage(target, damage, g.types ?? []);
    text += ` (bite: ${damage} damage)`;
  }
  if (actor.statuses.has("grappled")) await actor.setConditions({ grappled: false });
  await recordGrapple(actor, { ...g, swallowed: inside });
  await target.createEmbeddedDocuments("ActiveEffect", [
    {
      name: `Swallowed (${actor.name})`,
      img: "icons/creatures/abilities/mouth-teeth-long-red.webp",
      description: `<p>Inside ${esc(actor.name)}: ${inside.formula ? `${esc(inside.formula)} ${esc(inside.types.join(", "))} damage` : "damage"} at the start of each of its turns. Cut free with a light slashing or piercing weapon (${inside.hp} damage against AC ${inside.ac}), or escape the grapple (back in its mouth).</p>`,
      flags: { [MODULE_ID]: { swallowedBy: actor.uuid } },
    },
  ]);
  return text;
}

/** The start of the swallower's turn: the swallowed creature's damage. */
async function swallowedDamage(actor, g) {
  const target = fromUuidSync(g.target)?.actor;
  if (!target || !g.swallowed.formula) return null;
  const damage = await rollTotal(g.swallowed.formula);
  await dealDamage(target, damage, g.swallowed.types);
  return `${target.name} takes ${damage} ${g.swallowed.types.join(", ")} damage inside ${actor.name}`;
}

/* -------------------------------------------- */
/*  Blood drain                                 */
/* -------------------------------------------- */

/** "blood drain (1d2 Constitution)" or "1 point of Constitution damage": { formula, ability }. */
function bloodDrainOf(actor) {
  const b = specialAttack(actor, "blood drain");
  if (!b) return null;
  const m = b.detail.match(/(\d+d\d+|\d+)\s+(?:points?\s+of\s+)?([a-z]+)/i) ?? b.text.match(/(\d+d\d+|\d+)\s+points?\s+of\s+([a-z]+)\s+damage/i);
  const ability = ABILITY[m?.[2]?.toLowerCase()];
  return m && ability ? { formula: m[1], ability, name: m[2] } : { formula: null };
}

/** The end of its turn, while it grapples or is attached: the drain is applied, with an Undo. */
export async function bloodDrain(actor) {
  const drain = bloodDrainOf(actor);
  const g = drain && grappleOf(actor);
  const target = g && fromUuidSync(g.target)?.actor;
  if (!target) return null;
  if (!drain.formula) {
    await ChatMessage.implementation.create({ whisper: gmIds(), speaker: ChatMessage.implementation.getSpeaker({ actor }), content: `<p><strong>Blood drain</strong>: ${esc(actor.name)} drains ${esc(target.name)} (its entry gives no amount: apply it by hand).</p>` });
    return null;
  }
  const amount = await rollTotal(drain.formula);
  const path = `system.abilities.${drain.ability}.damage`;
  await target.update({ [path]: (foundry.utils.getProperty(target, path) ?? 0) + amount });
  await ChatMessage.implementation.create({
    whisper: [...new Set([...gmIds(), ...ownerWhisper(target)])],
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    content: `<p><strong>Blood drain</strong>: ${esc(target.name)} takes ${amount} ${esc(drain.name)} damage.</p>`,
    flags: { [MODULE_ID]: { bloodDrain: { target: g.target, ability: drain.ability, amount } } },
  });
  return amount;
}

/* -------------------------------------------- */
/*  The turn card                               */
/* -------------------------------------------- */

const ACTIONS = {
  maintain: { label: "Maintain", tooltip: "Combat maneuver check (+4 grab, +5 later rounds; −20 for a hold): deals the grab attack's damage and constrict, or the grapple ends", run: maintain },
  rake: { label: "Rake", tooltip: "Its free claw attacks against the creature it holds", run: rake },
  swallow: { label: "Swallow whole", tooltip: "Combat maneuver check as for a pin: swallows the creature (bite damage)", run: swallow },
  release: { label: "Let go", tooltip: "Release the grapple (a free action)", run: async (actor) => (await endGrapple(actor, { release: true }), "lets go") },
  free: { label: "Cut free or escaped", tooltip: "The swallowed creature is out", run: async (actor) => (await endGrapple(actor, { release: true }), "the swallowed creature is out") },
};

/** The start of its turn: the swallowed creature's damage, or the card with what it can do with its hold. */
export async function grappleTurn(actor) {
  if (actor.getFlag(MODULE_ID, FLAG) && !grappleOf(actor)) await endGrapple(actor);
  const g = grappleOf(actor);
  if (!g || g.attach) return null;
  const target = fromUuidSync(g.target).actor;
  let text;
  let actions;
  if (g.swallowed) {
    text = (await swallowedDamage(actor, g)) ?? `${target.name} is inside ${actor.name} (its entry gives no damage: apply it by hand)`;
    actions = ["free"];
  } else {
    text = `${actor.name} holds ${target.name}${g.hold ? ` with its ${g.attack ?? "attack"} (a hold)` : ""}.`;
    actions = ["maintain", ...(specialAttack(actor, "rake") ? ["rake"] : []), ...(canSwallow(actor) ? ["swallow"] : []), "release"];
  }
  return ChatMessage.implementation.create({
    whisper: gmIds(),
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    content: `<p><strong>Grapple</strong>: ${esc(text)}</p>`,
    flags: { [MODULE_ID]: { [CARD]: { actor: actor.uuid, actions, done: [] } } },
  });
}

/** Run one of the card's actions (the GM's client). */
export async function runGrappleAction(message, key) {
  const data = message.getFlag(MODULE_ID, CARD);
  const actor = fromUuidSync(data?.actor);
  if (!actor || !data.actions.includes(key) || data.done.some((d) => d.key === key)) return null;
  const text = await ACTIONS[key].run(actor);
  await message.update({ [`flags.${MODULE_ID}.${CARD}.done`]: [...data.done, { key, text }] });
  return text;
}

Hooks.on("combatTurnChange", async (combat, prior, current) => {
  if (!isActiveGM() || steppedBack(prior, current)) return;
  // The end of the previous creature's turn: blood drain
  const before = prior && combat.combatants.get(prior.combatantId)?.actor;
  if (before && specialAttack(before, "blood drain") && grappleOf(before) && (await oncePerRound(before, "bloodDrainTick", combat, prior.round))) await bloodDrain(before);
  // The start of this one's
  const actor = combat.combatants.get(current?.combatantId)?.actor;
  if (actor?.getFlag(MODULE_ID, FLAG) && (await oncePerRound(actor, "grappleTick", combat))) await grappleTurn(actor);
});

Hooks.on("renderChatMessageHTML", (message, html) => {
  const data = message.getFlag(MODULE_ID, CARD);
  if (data && game.user.isGM) {
    const div = document.createElement("div");
    for (const d of data.done) div.insertAdjacentHTML("beforeend", `<p>· <strong>${ACTIONS[d.key].label}</strong>: ${esc(d.text)}</p>`);
    // Maintaining and swallowing are each the creature's check for the round: one or the other
    const used = new Set(data.done.map((d) => d.key));
    const checked = used.has("maintain") || used.has("swallow");
    if (!used.has("release") && !used.has("free")) {
      for (const key of data.actions) {
        if (used.has(key) || (checked && ["maintain", "swallow"].includes(key))) continue;
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = ACTIONS[key].label;
        b.dataset.tooltip = ACTIONS[key].tooltip;
        b.style.cssText = "width: auto; line-height: 1.4; margin: 2px 0.25em; padding: 0 6px;";
        b.addEventListener("click", () => {
          b.disabled = true;
          runGrappleAction(message, key);
        });
        div.append(b);
      }
    }
    html.querySelector(".message-content")?.append(div);
  }
  const drain = message.getFlag(MODULE_ID, "bloodDrain");
  if (drain && game.user.isGM && !drain.undone) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "Undo";
    b.addEventListener("click", async () => {
      b.disabled = true;
      const target = fromUuidSync(drain.target)?.actor;
      const path = `system.abilities.${drain.ability}.damage`;
      if (target) await target.update({ [path]: Math.max(0, (foundry.utils.getProperty(target, path) ?? 0) - drain.amount) });
      await message.update({ [`flags.${MODULE_ID}.bloodDrain.undone`]: true });
    });
    html.querySelector(".message-content")?.append(b);
  }
});

export const _test = { FLAG, CARD, grappleOf, grappleTurn, runGrappleAction, bloodDrain, specialAttack, swallowDetails };
