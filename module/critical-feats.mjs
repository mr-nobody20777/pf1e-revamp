// Critical feats: on an attack that threatens a critical hit, the card lists the attacker's critical feats
// under that attack, one button each. Once the critical is confirmed, the attacker (or the GM) picks one,
// two with Critical Mastery, and its effect is applied to the creature hit: its save rolled, the condition
// or bleed applied. PF1 shows these feats as notes at the bottom of the card, for the whole card and with
// no limit; those notes are hidden for the feats handled here, so nothing is applied twice.
//
// Rules (Core Rulebook and others):
//   - "You can only apply the effects of one critical feat to a given critical hit unless you possess
//     Critical Mastery." Critical Mastery: "you can apply the effects of two critical feats". The attacker
//     chooses after the critical is confirmed (no feat says the choice is made before the roll).
//   - Save DCs: "10 + your base attack bonus" (Fortitude).
//   - Staggering, Stunning and Sickening Critical: "The effects of this feat do not stack. Additional hits
//     instead add to the duration." Bleeding Critical: "The effects of this feat stack." Flaying Critical:
//     "This penalty is cumulative, but cannot reduce an opponent's natural armor bonus below 0."
//   - Undead and constructs ignore effects that require a Fortitude save (unless harmless), and PF1's
//     condition immunities count. A critical hit negated by fortification carries no critical feat.
// Rulings (DECISIONS.md, 2026-11-10): buttons on the card, chosen by the attacker after confirmation; feats
// the module can't resolve are still offered, count toward the limit, and say to resolve them by hand;
// Crippling Critical lowers each speed by half its value when the hit lands.

import { MODULE_ID } from "./const.mjs";
import { esc, timed, saveResult, onGmRequest, requestedByOwner, isActiveGM, applyCondition } from "./util.mjs";
import { creatureTypes } from "./creature-types.mjs";
import { setBleed } from "./bleed.mjs";
import { negatedSneak } from "./fortification.mjs";

const FLAG = "criticalFeats";
const ROUND = () => CONFIG.time.roundTime || 6;
const roll = async (formula) => (await new Roll(formula).evaluate()).total;
const SPEEDS = ["land", "climb", "swim", "burrow", "fly"];

/* -------------------------------------------- */
/*  Conditions and buffs                        */
/* -------------------------------------------- */

const condition = applyCondition; // util.mjs

/** A buff on the target named for the feat; an older one of the same name is replaced. */
async function featBuff(actor, { name, img, rounds = null, text, changes = [], flags = {} }) {
  const old = actor.itemTypes.buff.filter((b) => b.name === name).map((b) => b.id);
  if (old.length) await actor.deleteEmbeddedDocuments("Item", old);
  await actor.createEmbeddedDocuments("Item", [
    {
      type: "buff",
      name,
      img: img ?? "icons/skills/wounds/injury-pain-body-orange.webp",
      system: {
        subType: "temp",
        active: true,
        ...(rounds ? { duration: { value: String(rounds), units: "round" } } : {}),
        description: { value: `<p>${esc(text)}</p>` },
        changes: changes.map(([target, formula]) => ({ target, formula: String(formula), type: "untyped", operator: "add" })),
      },
      flags: { [MODULE_ID]: flags },
    },
  ]);
}

/* -------------------------------------------- */
/*  The feats                                   */
/* -------------------------------------------- */

/**
 * apply({ attacker, target, saved }) → result text. `save`: the target's Fortitude save against 10 + BAB.
 * `manual`: the module can't resolve it; choosing it counts toward the limit. `when(info)`: offered only
 * then (Bleeding Critical: slashing or piercing weapons). `note`: shown with the button.
 */
const FEATS = {
  "staggering critical": {
    save: "fort",
    text: "staggered 1d4+1 rounds (Fortitude: 1 round); more hits add to the duration",
    apply: async ({ target, saved }) => condition(target, "staggered", saved ? 1 : await roll("1d4+1"), { extend: true }),
  },
  "stunning critical": {
    save: "fort",
    text: "stunned 1d4 rounds (Fortitude: staggered 1d4 rounds); more hits add to the duration",
    apply: async ({ target, saved }) => condition(target, saved ? "staggered" : "stunned", await roll("1d4"), { extend: true }),
  },
  "sickening critical": {
    text: "sickened 1 minute; more hits add to the duration",
    apply: ({ target }) => condition(target, "sickened", 10, { extend: true }),
  },
  "tiring critical": {
    text: "fatigued (no effect on a fatigued or exhausted creature)",
    apply: async ({ target }) => (target.statuses.has("fatigued") || target.statuses.has("exhausted") ? "no effect: already fatigued or exhausted" : condition(target, "fatigued", null)),
  },
  "exhausting critical": {
    text: "exhausted (no effect on an exhausted creature)",
    apply: async ({ target }) => {
      if (target.statuses.has("exhausted")) return "no effect: already exhausted";
      if (target.statuses.has("fatigued")) await target.setConditions({ fatigued: false });
      return condition(target, "exhausted", null);
    },
  },
  "blinding critical": {
    save: "fort",
    text: "blinded permanently (Fortitude: dazzled 1d4 rounds); not against creatures that don't rely on eyes or have more than two",
    apply: async ({ target, saved }) => (saved ? condition(target, "dazzled", await roll("1d4")) : condition(target, "blind", null)),
  },
  "deafening critical": {
    save: "fort",
    text: "deafened permanently (Fortitude: 1 round); no effect on deaf creatures",
    skip: (target) => (target.statuses.has("deaf") ? "no effect: already deaf" : null),
    apply: async ({ target, saved }) => condition(target, "deaf", saved ? 1 : null),
  },
  "bleeding critical": {
    text: "2d6 bleed each round (stacks)",
    when: (info) => info.slashingOrPiercing,
    apply: async ({ target, attacker }) => setBleed(target, await roll("2d6"), `Bleeding Critical (${attacker?.name ?? "?"})`, { stack: true }),
  },
  "censoring critical": {
    save: "fort",
    text: "can't speak for 1d4+1 rounds, so no spells with verbal components (Fortitude: 1 round)",
    apply: async ({ target, saved }) => {
      const rounds = saved ? 1 : await roll("1d4+1");
      await featBuff(target, { name: "Censored (Censoring Critical)", rounds, text: "Unable to speak: no spells with verbal components." });
      return `can't speak for ${rounds} round${rounds === 1 ? "" : "s"}`;
    },
  },
  "crippling critical": {
    save: "fort",
    text: "speed halved for 1 minute (Fortitude: 1d4 rounds); a flying creature makes a DC 10 Fly check to stay airborne",
    apply: async ({ target, saved }) => {
      const speeds = target.system.attributes?.speed ?? {};
      const changes = SPEEDS.filter((s) => (speeds[s]?.total ?? 0) > 0).map((s) => [`${s}Speed`, -Math.floor(speeds[s].total / 2)]);
      const rounds = saved ? await roll("1d4") : 10;
      await featBuff(target, { name: "Crippled (Crippling Critical)", rounds, changes, text: "Speed halved. A flying creature must make a DC 10 Fly check to remain airborne." });
      return `speed halved for ${rounds} round${rounds === 1 ? "" : "s"}${speeds.fly?.total ? "; DC 10 Fly check to stay airborne" : ""}`;
    },
  },
  "flaying critical": {
    text: "−1 natural armor for the encounter (cumulative, not below 0)",
    apply: async ({ target }) => {
      const name = "Flayed (Flaying Critical)";
      const old = target.itemTypes.buff.find((b) => b.name === name);
      const already = Number(old?.getFlag(MODULE_ID, "flayed") ?? 0);
      const natural = (target.system.ac?.natural?.total ?? 0) + already; // before this feat's penalty
      const penalty = Math.min(already + 1, Math.max(0, natural));
      if (penalty === already) return "no effect: no natural armor left";
      await featBuff(target, { name, changes: [["nac", -penalty]], flags: { flayed: penalty, encounter: true }, text: `−${penalty} natural armor until the end of the encounter.` });
      return `−${penalty} natural armor until the encounter ends`;
    },
  },
  "destroy identity": {
    text: "2 Charisma damage and staggered 1 round",
    apply: async ({ target }) => {
      const damage = target.system.abilities?.cha?.damage ?? 0;
      await target.update({ "system.abilities.cha.damage": damage + 2 });
      return `2 Charisma damage, ${await condition(target, "staggered", 1, { extend: true })}`;
    },
  },
  // Offered so they count toward the limit; the GM resolves them
  "impaling critical": { manual: true, text: "impaled on the weapon (resolve by hand)" },
  "dirty critical hit": { manual: true, text: "a dirty trick's condition for 1 round (resolve by hand)" },
  "impact critical shot": { manual: true, ranged: true, text: "bull rush or trip if the confirmation beats its CMD (resolve by hand)" },
  "dispelling critical": { manual: true, text: "a targeted dispel magic as a swift action (resolve by hand)" },
  "accursed critical": { manual: true, text: "bestow curse or major curse as an immediate action (resolve by hand)" },
  "banishing critical": { manual: true, text: "a summoned creature is dismissed on a failed Will save (resolve by hand)" },
  "entreating critical": { manual: true, text: "a Diplomacy check as with Call Truce (resolve by hand)" },
  "blighted critical": { manual: true, text: "a random minor spellblight (resolve by hand)" },
  "sin-sharing critical": { manual: true, text: "one of your curses also affects it, Will negates (resolve by hand)" },
};

const featKey = (item) => (item?.type === "feat" && item.isActive !== false && FEATS[item.name.toLowerCase()] ? item.name.toLowerCase() : null);
const limitOf = (actor) => (actor.itemTypes.feat.some((f) => f.isActive !== false && /^critical mastery$/i.test(f.name)) ? 2 : 1);

/* -------------------------------------------- */
/*  The attack card                             */
/* -------------------------------------------- */

Hooks.on("pf1PreDisplayActionUse", (use) => {
  const actor = use.actor;
  if (!actor || !use.shared.chatAttacks?.length) return;
  const keys = actor.itemTypes.feat.map(featKey).filter(Boolean);
  if (!keys.length) return;
  const types = new Set((use.action?.damage?.parts ?? []).flatMap((p) => [...(p.types ?? [])]));
  const info = { slashingOrPiercing: types.has("slashing") || types.has("piercing"), ranged: ["rwak", "rsak", "twak", "rcman"].includes(use.action?.actionType) };
  const feats = actor.itemTypes.feat
    .filter((i) => featKey(i))
    .map((i) => ({ key: featKey(i), name: i.name }))
    .filter(({ key }) => (!FEATS[key].when || FEATS[key].when(info)) && (!FEATS[key].ranged || info.ranged));
  if (!feats.length) return;
  use.shared.chatData[`flags.${MODULE_ID}.${FLAG}`] = {
    feats,
    limit: limitOf(actor),
    dc: 10 + (actor.system.attributes?.bab?.total ?? 0),
    attacker: actor.uuid,
    target: use.shared.targets?.[0]?.document?.uuid ?? null,
    hidden: actor.itemTypes.feat.filter((i) => featKey(i)).map((i) => i.name), // PF1's notes for these go
    applied: {},
  };
});

/** Attacks on the card that threaten a critical hit (PF1 rolled a confirmation for them). */
const threats = (message) => (message.systemRolls?.attacks ?? []).map((a, i) => (a?.critConfirm ? i : -1)).filter((i) => i >= 0);

Hooks.on("renderChatMessagePF", (message, html) => {
  const data = message.getFlag(MODULE_ID, FLAG);
  if (!data?.feats) return;
  // PF1's own notes for these feats, at the bottom of the card
  for (const tag of html.querySelectorAll(".footnotes .tag")) {
    if (data.hidden.some((n) => tag.dataset.tooltip === `Source: ${n}`)) tag.remove();
  }
  for (const group of html.querySelectorAll(".footnotes")) if (!group.querySelector(".tag")) group.remove();
  const attacker = fromUuidSync(data.attacker);
  const canChoose = game.user.isGM || !!attacker?.isOwner;
  for (const i of threats(message)) {
    const el = html.querySelector(`.chat-attack[data-index="${i}"]`);
    if (!el) continue;
    const chosen = data.applied?.[i] ?? [];
    const div = document.createElement("div");
    div.className = `${MODULE_ID}-critical-feats`;
    div.style.cssText = "margin: 0.25em 0; padding: 0 4px; border-left: 3px solid #a55;";
    const left = data.limit - chosen.length;
    div.innerHTML = `<strong>Critical feat</strong> (if the critical is confirmed; ${data.limit === 1 ? "choose one" : "choose two, Critical Mastery"}, DC ${data.dc}):${chosen.map((c) => `<div>· <strong>${esc(c.name)}</strong>: ${esc(c.result)}</div>`).join("")}`;
    if (canChoose && left > 0) {
      for (const [f, feat] of data.feats.entries()) {
        if (chosen.some((c) => c.name === feat.name)) continue;
        const def = FEATS[feat.key];
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = feat.name;
        button.dataset.tooltip = `${def.text}${def.save ? ` (Fortitude DC ${data.dc} rolled for the target)` : ""}`;
        button.style.cssText = "width: auto; line-height: 1.4; margin: 2px 0.25em; padding: 0 6px;";
        button.addEventListener("click", async (event) => {
          event.preventDefault();
          div.querySelectorAll("button").forEach((b) => (b.disabled = true));
          if (game.user.isGM) await applyFeat(message, f, i);
          else await ChatMessage.implementation.create({ whisper: game.users.filter((u) => u.isGM).map((u) => u.id), content: `<p>Applying ${esc(feat.name)}…</p>`, flags: { [MODULE_ID]: { applyCriticalFeat: { message: message.id, feat: f, index: i } } } });
        });
        div.append(button);
      }
    }
    const table = el.querySelector("table");
    table ? table.after(div) : el.append(div);
  }
});

/** Apply the card's feat `f` to attack `index`'s target (the GM's client). Returns the result line. */
export async function applyFeat(message, f, index) {
  const data = message.getFlag(MODULE_ID, FLAG);
  const feat = data?.feats?.[f];
  const def = FEATS[feat?.key];
  const chosen = data?.applied?.[index] ?? [];
  if (!def || chosen.length >= data.limit || chosen.some((c) => c.name === feat.name)) return null;
  const attacker = fromUuidSync(data.attacker);
  const target = fromUuidSync(data.target)?.actor ?? null;
  let result;
  if (def.manual) result = def.text;
  else if (!target) result = "no target";
  else if (negatedSneak(message, index)) result = "no effect: the critical hit was negated";
  else {
    const { types } = creatureTypes(target);
    const skip = def.skip?.(target);
    if (skip) result = skip;
    else if (def.save === "fort" && (types.has("undead") || types.has("construct"))) result = "no effect: undead and constructs ignore Fortitude effects";
    else {
      let saved = false;
      if (def.save) {
        const save = await target.rollSavingThrow(def.save, { skipDialog: true, dc: data.dc, reference: message.uuid });
        saved = saveResult(save, data.dc).passed;
      }
      result = await def.apply({ attacker, target, saved });
      if (def.save) result = `${saved ? "saved" : "failed"}: ${result}`;
    }
  }
  if (message.isOwner) await message.update({ [`flags.${MODULE_ID}.${FLAG}.applied.${index}`]: [...chosen, { name: feat.name, result }] });
  return result;
}

onGmRequest("applyCriticalFeat", async (request, { message, feat, index }) => {
  const card = game.messages.get(message);
  const attacker = fromUuidSync(card?.getFlag(MODULE_ID, FLAG)?.attacker);
  if (card && requestedByOwner(request, attacker)) await applyFeat(card, feat, index);
  await request.delete();
});

// Flaying Critical lasts "for the duration of the encounter"
Hooks.on("deleteCombat", async () => {
  if (!isActiveGM()) return;
  for (const actor of new Set([...game.actors, ...(canvas.scene?.tokens.map((t) => t.actor).filter(Boolean) ?? [])])) {
    const ids = actor.itemTypes.buff.filter((b) => b.getFlag(MODULE_ID, "encounter")).map((b) => b.id);
    if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
  }
});

export const _test = { FEATS, FLAG, applyFeat, threats };
