// Auras: effects on the creatures within a radius of the aura's bearer, kept up to date as tokens move.
// PF1 ships these features as text only. Each aura here is checked against its own rules text.
//
// How it works (the shape follows the PF2e system's auras, simplified):
//   - The aura is a PF1 feature on the bearer, recognized by its compendium source or name (AURAS below).
//     Passive auras are on while the feature is active (and, where the text says so, while the bearer
//     is conscious). Activated auras are on while the bearer's indicator buff is active: the feature's
//     Use button (or its footnote) starts them, spending rounds per day from the feature's own uses;
//     turning the buff off ends the aura and gives back the rounds not yet used ("these rounds do not
//     need to be consecutive").
//   - Each creature inside an aura gets a linked buff with the aura's effects (changes, save notes,
//     energy resistance). One buff per aura per creature: two paladins' Aura of Courage give one buff,
//     from the stronger source, so the same aura never stacks with itself.
//   - The active GM's client keeps each scene in sync: one recheck per scene, run shortly after a burst
//     of changes (tokens placed, moved, hidden or removed; a bearer's feature, buff, hit points or
//     conditions changing). The recheck works out which buffs each creature should have, then creates,
//     updates or deletes only the difference, so running it twice changes nothing.
//   - A target's aura buff that is deactivated stays off until the creature leaves the aura (the GM's
//     way to exclude someone); a deleted one comes back while the creature is still inside.
// "Allies" includes the bearer (PF1 FAQ: you count as your own ally unless the text says otherwise);
// allies and enemies are told apart by token disposition. Hidden tokens neither give nor receive auras.

import { MODULE_ID } from "./const.mjs";
import { registerFootnote, footnoteButton } from "./footnote.mjs";
import { classLevel, isActiveGM, createQueue, settled, stillExists, esc, onSceneCatchUp, titleFor, tokenDistance } from "./util.mjs";
import { mindAffectingImmune } from "./spells.mjs";

const LINK = "auraLink";
const PF1 = "Compendium.pf1.class-abilities.Item.";
const SAVES = "allSavingThrows";
const ELEMENTS = ["acid", "cold", "electric", "fire", "sonic"];
const ROLLS = ["attack", SAVES, "skills"];
const SYNC = { [`${MODULE_ID}AuraSync`]: true }; // the recheck's own writes, which mustn't trigger another recheck

/** Effects as [target, type, value] changes, [target, text] notes and energy resistance. */
const effect = (summary, { changes = [], notes = [], resist = 0, details = "" } = {}) => ({ summary, changes, notes, resist, details });

const AURAS = {
  courage: {
    label: "Aura of Courage",
    sources: [`${PF1}RNIkkvqaq2iVrahs`],
    name: /^aura of courage\b/i,
    radius: 10,
    side: "allies",
    conscious: true,
    effect: () => effect("+4 morale bonus on saving throws against fear effects", { notes: [[SAVES, "+[[4]] Morale vs fear effects"]] }),
  },
  resolve: {
    label: "Aura of Resolve",
    sources: [`${PF1}jiBCmy0kP1Uwaz0D`],
    name: /^aura of resolve\b/i,
    radius: 10,
    side: "allies",
    conscious: true,
    effect: () => effect("+4 morale bonus on saving throws against charm effects", { notes: [[SAVES, "+[[4]] Morale vs charm effects"]] }),
  },
  righteousness: {
    label: "Aura of Righteousness",
    sources: [`${PF1}iFq0EX4yovswIox9`],
    name: /^aura of righteousness\b/i,
    radius: 10,
    side: "allies",
    conscious: true,
    effect: () => effect("+4 morale bonus on saving throws against compulsion effects", { notes: [[SAVES, "+[[4]] Morale vs compulsion effects"]] }),
  },
  despairAntipaladin: {
    label: "Aura of Despair",
    sources: [`${PF1}31CVgcirb74C3ieQ`],
    name: /^aura of despair \(apa\)/i,
    radius: 10,
    side: "enemies",
    conscious: true,
    effect: () => effect("−2 penalty on all saving throws", { changes: [[SAVES, "untyped", -2]] }),
  },
  cowardice: {
    label: "Aura of Cowardice",
    sources: [`${PF1}dhBZs1g1QQNQM3vm`],
    name: /^aura of cowardice\b/i,
    radius: 10,
    side: "enemies",
    conscious: true,
    // "This penalty does not stack with the penalty from aura of cowardice" (Aura of Despair): with both,
    // a save against fear takes −4 in all, so this adds only the part beyond Despair's −2.
    effect: (level, others) =>
      others.has("despairAntipaladin")
        ? effect("−4 penalty on saving throws against fear effects (−2 here, with Aura of Despair's −2, which doesn't stack with it)", {
            notes: [[SAVES, "-[[2]] vs fear effects"]],
            details: "Creatures normally immune to fear lose that immunity while within 10 feet.",
          })
        : effect("−4 penalty on saving throws against fear effects", {
            notes: [[SAVES, "-[[4]] vs fear effects"]],
            details: "Creatures normally immune to fear lose that immunity while within 10 feet.",
          }),
  },
  depravity: {
    label: "Aura of Depravity",
    sources: [`${PF1}LkbGAZaa2KDrnS89`],
    name: /^aura of depravity\b/i,
    radius: 10,
    side: "enemies",
    conscious: true,
    effect: () => effect("−4 penalty on saving throws against compulsion effects", { notes: [[SAVES, "-[[4]] vs compulsion effects"]] }),
  },
  foretell: {
    label: "Foretell",
    sources: [`${PF1}vQ6i4zS5T7z1UNOM`],
    name: /^foretell$/i,
    classTag: "wizard",
    radius: 30,
    activated: true,
    choices: {
      aid: {
        label: "aid",
        side: "allies",
        effect: () =>
          effect("+2 luck bonus on ability checks, attack rolls, caster level checks, saving throws and skill checks", {
            changes: [["allChecks", "luck", 2], ...ROLLS.map((t) => [t, "luck", 2])],
            details: "Add the +2 to caster level checks by hand.",
          }),
      },
      hinder: {
        label: "hinder",
        side: "enemies",
        effect: () =>
          effect("−2 penalty on ability checks, attack rolls, caster level checks, saving throws and skill checks", {
            changes: [["allChecks", "untyped", -2], ...ROLLS.map((t) => [t, "untyped", -2])],
            details: "Apply the −2 to caster level checks by hand.",
          }),
      },
    },
  },
  despairEnchanter: {
    label: "Aura of Despair",
    sources: [`${PF1}75Y2PY8Uha3o0fHE`],
    name: /^aura of despair$/i,
    classTag: "wizard",
    radius: 30,
    side: "enemies",
    activated: true,
    mindAffecting: true,
    effect: () =>
      effect("−2 penalty on ability checks, attack rolls, damage rolls, saving throws and skill checks (mind-affecting)", {
        changes: [["allChecks", "untyped", -2], ["damage", "untyped", -2], ...ROLLS.map((t) => [t, "untyped", -2])],
      }),
  },
  heroism: {
    label: "Aura of Heroism",
    sources: [`${PF1}Lzhedjmay1oc4ktw`],
    name: /^aura of heroism\b/i,
    classTag: "cleric",
    radius: 30,
    side: "allies",
    activated: true,
    // "Allies in the area are treated as if they were under the effects of heroism"
    effect: () => effect("+2 morale bonus on attack rolls, saves and skill checks (as heroism)", { changes: ROLLS.map((t) => [t, "morale", 2]) }),
  },
  protection: {
    label: "Aura of Protection",
    sources: [`${PF1}kHXw5V06TkymXxF3`],
    name: /^aura of protection(?! \(blessing\))/i,
    classTag: "cleric",
    radius: 30,
    side: "allies",
    activated: true,
    effect(level) {
      const deflection = 1 + Math.floor(Math.max(0, level - 8) / 4);
      const resist = level >= 14 ? 10 : 5;
      return effect(`+${deflection} deflection bonus to AC and resistance ${resist} against acid, cold, electricity, fire and sonic`, {
        changes: [["ac", "deflection", deflection]],
        resist,
      });
    },
  },
  protectionBlessing: {
    label: "Aura of Protection",
    sources: [`${PF1}azFolTaFreo2QCdu`],
    name: /^aura of protection \(blessing\)/i,
    classTag: "warpriest",
    radius: 30,
    side: "allies",
    activated: true,
    minutes: 1, // "for 1 minute", paid from the warpriest's blessings, not in rounds
    effect(level) {
      const resist = level >= 15 ? 20 : 10;
      return effect(`resistance ${resist} against acid, cold, electricity, fire and sonic`, { resist });
    },
  },
  menace: {
    label: "Aura of Menace",
    sources: [`${PF1}j8Z4O8Z7otvM8yXE`],
    name: /^aura of menace\b/i,
    classTag: "cleric",
    radius: 30,
    side: "enemies",
    activated: true,
    effect: () => effect("−2 penalty to AC and on attack rolls and saving throws", { changes: [["ac", "untyped", -2], ["attack", "untyped", -2], [SAVES, "untyped", -2]] }),
  },
};

/* -------------------------------------------- */
/*  Lookup                                      */
/* -------------------------------------------- */

const BY_SOURCE = new Map(Object.entries(AURAS).flatMap(([key, def]) => def.sources.map((s) => [s, key])));

/** The aura a feature is, or null. Enchanter's Aura of Despair and the antipaladin's share a name. */
export function auraKey(item) {
  if (item?.type !== "feat") return null;
  const bySource = BY_SOURCE.get(item._stats?.compendiumSource);
  if (bySource) return bySource;
  const key = Object.keys(AURAS).find((k) => AURAS[k].name.test(item.name)) ?? null;
  if (key === "despairEnchanter" && (item.system.associations?.classes ?? []).some((c) => /antipaladin/i.test(c))) return "despairAntipaladin";
  return key;
}

/** The bearer's indicator buff for an activated aura. */
const indicatorOf = (item) =>
  item.actor?.itemTypes.buff.find((b) => {
    const link = b.flags[MODULE_ID]?.[LINK];
    return link?.role === "aura" && link.source === item.uuid;
  }) ?? null;

/** The variant of an aura (Foretell: aid or hinder) as { side, effect, label }. */
function variantOf(def, choice) {
  const v = def.choices?.[choice];
  return v ? { side: v.side, effect: v.effect, label: `${def.label} (${v.label})` } : { side: def.side, effect: def.effect, label: def.label };
}

function levelOf(item, def) {
  const level = classLevel(item, def.classTag ?? "paladin");
  if (level) return level;
  // Antipaladin, inquisitor or another class that grants it: its highest class level
  return Math.max(0, ...(item.actor?.itemTypes.class ?? []).map((c) => c.system.level ?? 0));
}

/**
 * "This ability functions only while the paladin is conscious, not if she is unconscious or dead."
 * Below 0 hit points a creature is dying and unconscious (unless it has Diehard or ferocity), and
 * nonlethal damage above its hit points knocks it out.
 */
export function isConscious(actor) {
  const statuses = actor.statuses ?? new Set();
  if (statuses.has("dead") || statuses.has("unconscious") || statuses.has("dying")) return false;
  const hp = actor.system.attributes?.hp ?? {};
  if ((hp.nonlethal ?? 0) > (hp.value ?? 0) && (hp.value ?? 0) >= 0) return false;
  if ((hp.value ?? 0) < 0) return actor.itemTypes.feat.some((i) => i.isActive !== false && /^(diehard|ferocity)\b/i.test(i.name));
  return true;
}

/* -------------------------------------------- */
/*  Who should have which aura buffs            */
/* -------------------------------------------- */

/** The auras given off on a scene: [{ token, actor, item, key, def, choice, level, variant }]. */
function emittersOn(scene) {
  const out = [];
  for (const token of scene.tokens) {
    const actor = token.actor;
    if (!actor || token.hidden) continue;
    for (const item of actor.itemTypes.feat) {
      const key = auraKey(item);
      if (!key) continue;
      const def = AURAS[key];
      let choice = null;
      if (def.activated) {
        const indicator = indicatorOf(item);
        if (!indicator?.isActive) continue;
        choice = indicator.flags[MODULE_ID][LINK].choice ?? null;
      } else if (item.isActive === false) continue;
      if (def.conscious && !isConscious(actor)) continue;
      out.push({ token, actor, item, key, def, choice, level: levelOf(item, def), variant: variantOf(def, choice) });
    }
  }
  return out;
}

// Friendly (1) and hostile (−1) are enemies of each other; neutral and secret tokens are nobody's enemy
const sameSide = (a, b) => a.disposition === b.disposition;
const opposed = (a, b) => a.disposition * b.disposition === -1;

/**
 * What each creature on the scene should get: Map<actor, Map<effectKey, emitter>>. A creature with several
 * tokens is inside if any of them is; of several sources of the same aura, the highest level gives it.
 */
export function wantedOn(scene) {
  const wanted = new Map();
  const emitters = emittersOn(scene);
  if (!emitters.length) return wanted;
  const tokens = scene.tokens.filter((t) => t.actor && !t.hidden);
  for (const e of emitters) {
    const effectKey = e.choice ? `${e.key}.${e.choice}` : e.key;
    for (const token of tokens) {
      const self = token === e.token;
      if (e.variant.side === "allies" ? !(self || sameSide(token, e.token)) : self || !opposed(token, e.token)) continue;
      if (!self && tokenDistance(e.token, token) > e.def.radius) continue;
      if (e.def.mindAffecting && mindAffectingImmune(token.actor)) continue;
      if (!wanted.has(token.actor)) wanted.set(token.actor, new Map());
      const mine = wanted.get(token.actor);
      const current = mine.get(effectKey);
      if (!current || e.level > current.level) mine.set(effectKey, e);
    }
  }
  return wanted;
}

/** The target buff for an emitter, given the other aura effects the creature is under. */
function targetBuff(e, effectKey, others, scene) {
  const fx = e.variant.effect(e.level, others);
  const text = [
    `<p>From ${esc(e.actor.name)}'s ${esc(e.variant.label)}: ${esc(fx.summary)}.</p>`,
    fx.details ? `<p>${esc(fx.details)}</p>` : "",
    `<p>Applied while within ${e.def.radius} ft and removed on leaving. Deactivating this buff keeps it off until the creature leaves the aura.</p>`,
  ].join("");
  const system = {
    subType: "temp",
    active: true,
    description: { value: text },
    changes: fx.changes.map(([target, type, value]) => ({ target, type, formula: String(value) })),
    contextNotes: fx.notes.map(([target, note]) => ({ target, text: note })),
  };
  const grants = fx.resist ? ELEMENTS.map((type) => ({ trait: "eres", type, amount: String(fx.resist) })) : null;
  const name = `${e.variant.label} (${e.actor.name})`;
  const sig = JSON.stringify([name, system.changes, system.contextNotes, grants]);
  return {
    name,
    type: "buff",
    img: e.item.img,
    system,
    flags: { [MODULE_ID]: { [LINK]: { role: "effect", source: e.item.uuid, key: effectKey, scene: scene.id, sig }, ...(grants ? { grants } : {}) } },
  };
}

/** Make every aura buff tied to this scene match what the auras on it give. */
export async function syncScene(scene) {
  if (!scene || !game.scenes.has(scene.id)) return;
  const wanted = wantedOn(scene);
  const actors = new Set([...game.actors, ...scene.tokens.map((t) => t.actor).filter(Boolean)]);
  const toCreate = new Map(); // actor → [data]

  for (const actor of actors) {
    const mine = wanted.get(actor) ?? new Map();
    const others = new Set([...mine.keys()]);
    const done = new Set();
    for (const buff of actor.itemTypes.buff) {
      const link = buff.flags[MODULE_ID]?.[LINK];
      if (link?.role !== "effect") continue;
      if (link.scene !== scene.id && game.scenes.has(link.scene)) continue; // another scene's aura
      const e = mine.get(link.key);
      if (!e || e.item.uuid !== link.source || done.has(link.key)) {
        if (stillExists(buff)) await buff.delete(SYNC);
        continue;
      }
      done.add(link.key);
      const data = targetBuff(e, link.key, others, scene);
      const flags = data.flags[MODULE_ID];
      if (link.sig !== flags[LINK].sig) {
        // Only the aura's own fields: a deactivated buff stays off
        await buff.update(
          {
            name: data.name,
            "system.changes": data.system.changes,
            "system.contextNotes": data.system.contextNotes,
            "system.description.value": data.system.description.value,
            [`flags.${MODULE_ID}.${LINK}`]: flags[LINK],
            ...(flags.grants ? { [`flags.${MODULE_ID}.grants`]: flags.grants } : { [`flags.${MODULE_ID}.-=grants`]: null }),
          },
          SYNC
        );
      }
    }
    for (const [key, e] of mine) {
      if (done.has(key)) continue;
      if (!toCreate.has(actor)) toCreate.set(actor, []);
      toCreate.get(actor).push(targetBuff(e, key, others, scene));
    }
  }
  for (const [actor, data] of toCreate) await actor.createEmbeddedDocuments("Item", data, SYNC);
}

/* -------------------------------------------- */
/*  Rechecking (active GM only)                 */
/* -------------------------------------------- */

const enqueue = createQueue("Auras");
const timers = new Map(); // scene id → pending recheck

function recheck(scene) {
  if (!scene || !isActiveGM()) return;
  clearTimeout(timers.get(scene.id));
  timers.set(
    scene.id,
    setTimeout(() => {
      timers.delete(scene.id);
      enqueue(() => syncScene(scene));
    }, 150)
  );
}

/** Resolves once pending rechecks have run (tests). */
export async function aurasSettled() {
  while (timers.size) await new Promise((r) => setTimeout(r, 50));
  await settled();
}

/** Scenes where the actor has a token. */
const scenesOf = (actor) => (actor?.isToken ? [actor.token.parent] : game.scenes.filter((s) => s.tokens.some((t) => t.actorLink && t.actorId === actor?.id)));
const hasAura = (actor) => !!actor?.itemTypes?.feat.some((i) => auraKey(i));
const recheckActor = (actor) => scenesOf(actor).forEach(recheck);

const TOKEN_FIELDS = ["x", "y", "hidden", "disposition", "width", "height", "actorLink", "actorId"];
Hooks.on("createToken", (token) => recheck(token.parent));
Hooks.on("deleteToken", (token) => recheck(token.parent));
Hooks.on("updateToken", (token, changes) => {
  if (TOKEN_FIELDS.some((f) => f in changes)) recheck(token.parent);
});

function itemChanged(item, ...args) {
  const actor = item.actor;
  const options = args.length === 3 ? args[1] : args[0]; // updateItem passes (changes, options, userId)
  if (!actor || options?.[`${MODULE_ID}AuraSync`]) return;
  const link = item.flags?.[MODULE_ID]?.[LINK];
  if (auraKey(item) || link?.role === "aura") recheckActor(actor);
  else if (link?.role === "effect" && game.scenes.has(link.scene)) recheck(game.scenes.get(link.scene));
}
Hooks.on("createItem", itemChanged);
Hooks.on("updateItem", itemChanged);
Hooks.on("deleteItem", itemChanged);

// A bearer's hit points or conditions (conscious or not)
Hooks.on("updateActor", (actor, changes) => {
  if (changes.system && hasAura(actor)) recheckActor(actor);
});
const effectChanged = (effect) => hasAura(effect.parent) && recheckActor(effect.parent);
Hooks.on("createActiveEffect", effectChanged);
Hooks.on("deleteActiveEffect", effectChanged);

Hooks.on("canvasReady", () => recheck(canvas.scene));

/* -------------------------------------------- */
/*  Activated auras                             */
/* -------------------------------------------- */

const usesLeft = (item) => item.system.uses?.value ?? 0;
const paysRounds = (item, def) => !def.minutes && !!item.system.uses?.per;
const roundTime = () => CONFIG.time.roundTime || 6;

/** Rounds of an indicator not yet used: the round in progress counts as used. */
function roundsUnused(indicator) {
  const link = indicator.flags[MODULE_ID][LINK];
  if (!link.rounds) return 0;
  const used = Math.floor(Math.max(0, game.time.worldTime - (link.start ?? 0)) / roundTime()) + 1;
  return Math.max(0, link.rounds - used);
}

/**
 * Start an activated aura: choose its variant and how many rounds to spend, then put the indicator buff on
 * the bearer. An aura already running is replaced (its unused rounds are given back first).
 * @param {boolean} [prepaid] PF1's Use already spent 1 round; refunded if cancelled.
 * @param {object} [answer] Skip the dialog: { choice, rounds } (macros, tests).
 */
export async function activateAura(item, { prepaid = false, answer = null } = {}) {
  const key = auraKey(item);
  const def = AURAS[key];
  const actor = item.actor;
  if (!def?.activated || !actor) return;
  const pays = paysRounds(item, def);
  const refundPrepaid = () => prepaid && pays && item.update({ "system.uses.value": usesLeft(item) + 1 });
  const current = indicatorOf(item);
  const back = current?.isActive ? roundsUnused(current) : 0;
  const available = usesLeft(item) + back + (prepaid ? 1 : 0);
  if (pays && available < 1) return ui.notifications.warn(`${actor.name} has no rounds of ${def.label} left today.`);

  const level = levelOf(item, def);
  answer ??= await foundry.applications.api.DialogV2.wait({
    window: { title: titleFor(def.label, actor) },
    content: [
      def.choices
        ? Object.entries(def.choices)
            .map(([c, v], i) => `<label style="display:block"><input type="radio" name="choice" value="${c}" ${i ? "" : "checked"}> <strong>${esc(v.label)}</strong> (${v.side}): ${esc(v.effect(level, new Set()).summary)}</label>`)
            .join("")
        : `<p><strong>${esc(def.label)}</strong>: ${def.side} within ${def.radius} ft get ${esc(def.effect(level, new Set()).summary)}.</p>`,
      pays
        ? `<label style="display:block; margin-top:6px">Rounds: <input type="number" name="rounds" min="1" max="${available}" value="${available}" style="width:4em"></label>
           <p style="font-size:11px; opacity:0.8">Rounds left today: ${available}${back ? ` (${back} given back from the aura running now)` : ""}. Turn the buff off to end the aura early; the rounds not yet used are given back.</p>`
        : `<p style="font-size:11px; opacity:0.8">Lasts ${def.minutes} minute.</p>`,
      current?.isActive ? `<p style="font-size:11px">This replaces the aura running now.</p>` : "",
    ].join(""),
    buttons: [
      {
        action: "start",
        label: "Start",
        icon: "fa-solid fa-circle-radiation",
        default: true,
        callback: (event, button) => ({
          choice: button.form.querySelector('input[name="choice"]:checked')?.value ?? null,
          rounds: Number(button.form.querySelector('input[name="rounds"]')?.value) || 1,
        }),
      },
      { action: "cancel", label: "Cancel" },
    ],
    rejectClose: false,
  });
  if (!answer || typeof answer !== "object") return refundPrepaid();

  const rounds = pays ? Math.max(1, Math.min(available, Math.floor(answer.rounds ?? 1))) : null;
  if (current) await current.delete({ [`${MODULE_ID}AuraReplaced`]: true });
  if (pays) await item.update({ "system.uses.value": available - rounds });

  const variant = variantOf(def, answer.choice);
  const fx = variant.effect(level, new Set());
  const duration = pays ? { value: String(rounds), units: "round" } : { value: String(def.minutes), units: "minute" };
  await actor.createEmbeddedDocuments("Item", [
    {
      name: variant.label,
      type: "buff",
      img: item.img,
      system: {
        subType: "temp",
        active: true,
        duration,
        description: {
          value: `<p>${esc(actor.name)}'s ${esc(variant.label)}: ${variant.side} within ${def.radius} ft get ${esc(fx.summary)}.</p><p>Turn this buff off or delete it to end the aura${pays ? "; the rounds not yet used are given back" : ""}.</p>`,
        },
      },
      flags: { [MODULE_ID]: { [LINK]: { role: "aura", source: item.uuid, key, choice: answer.choice ?? null, rounds, start: game.time.worldTime } } },
    },
  ]);
  ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    content: `<p><strong>${esc(variant.label)}</strong> begins: ${variant.side} within ${def.radius} ft get ${esc(fx.summary)}.</p><p>${pays ? `${rounds} round${rounds === 1 ? "" : "s"}; rounds left today: ${usesLeft(item)}.` : `For ${def.minutes} minute.`}</p>`,
  });
}

/** The aura's indicator went off: give back the unused rounds, and say so. Run by whoever turned it off. */
async function ended(indicator) {
  const link = indicator.flags[MODULE_ID][LINK];
  const item = fromUuidSync(link.source);
  const back = roundsUnused(indicator);
  if (back && item?.isOwner) await item.update({ "system.uses.value": usesLeft(item) + back });
  const actor = indicator.actor;
  ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    content: `<p><strong>${esc(indicator.name)}</strong> ends.${back ? ` ${back} unused round${back === 1 ? "" : "s"} given back; rounds left today: ${usesLeft(item)}.` : ""}</p>`,
  });
}

Hooks.on("updateItem", (item, changes, options, userId) => {
  if (userId !== game.user.id || changes.system?.active !== false) return;
  if (item.flags[MODULE_ID]?.[LINK]?.role === "aura") ended(item);
});
Hooks.on("deleteItem", (item, options, userId) => {
  if (userId !== game.user.id) return;
  const link = item.flags[MODULE_ID]?.[LINK];
  if (link?.role === "aura" && item.isActive && !options[`${MODULE_ID}AuraReplaced`]) ended(item);
  // The feature itself removed: its indicator goes too
  if (auraKey(item) && item.actor) {
    const indicator = item.actor.itemTypes.buff.find((b) => b.flags[MODULE_ID]?.[LINK]?.role === "aura" && b.flags[MODULE_ID][LINK].source === item.uuid);
    if (indicator) indicator.delete({ [`${MODULE_ID}AuraReplaced`]: true });
  }
});

// The feature's Use button starts it (PF1 has already spent 1 round from the feature's uses)
Hooks.on("pf1PostActionUse", (actionUse) => {
  const item = actionUse.item;
  const def = AURAS[auraKey(item)];
  if (def?.activated && item.actor) activateAura(item, { prepaid: true });
});

/* -------------------------------------------- */
/*  Foretell's rounds per day                   */
/* -------------------------------------------- */

// PF1's Foretell counts its uses from the Intelligence modifier, but the text says "a number of rounds
// per day equal to your wizard level" (the Intelligence count belongs to Prescience, the 1st-level power).
const FORETELL_WRONG_MAX = "@abilities.int.mod";
const fixForetell = (item) => auraKey(item) === "foretell" && item.system.uses?.maxFormula === FORETELL_WRONG_MAX;
Hooks.on("preCreateItem", (item) => {
  if (fixForetell(item)) item.updateSource({ "system.uses.maxFormula": "@class.level" });
});
onSceneCatchUp((item) => {
  if (fixForetell(item)) item.update({ "system.uses.maxFormula": "@class.level" });
});

/* -------------------------------------------- */
/*  Footnotes                                   */
/* -------------------------------------------- */

registerFootnote((item) => {
  const key = auraKey(item);
  if (!key) return null;
  const def = AURAS[key];
  const level = item.actor ? levelOf(item, def) : 8;
  const variants = def.choices ? Object.keys(def.choices).map((c) => variantOf(def, c)) : [variantOf(def, null)];
  const what = variants.map((v) => `${v.side} within ${def.radius} ft get ${v.effect(level, new Set()).summary}`).join("; or ");
  const content = [`Aura, applied automatically as linked buffs on the creatures inside: ${what}.`];
  if (def.conscious) content.push(" Only while the bearer is conscious.");
  if (def.activated) {
    const indicator = item.actor ? indicatorOf(item) : null;
    if (indicator?.isActive) content.push(` Active (${indicator.name}); turn its buff off to end it.`);
    else content.push(" Start it with Use or the button.");
    if (item.actor && item.isOwner) content.push(" ", footnoteButton(`Start ${def.label}`, "Choose and start the aura", () => activateAura(item)));
  }
  return content;
});

export const _test = { AURAS, emittersOn, roundsUnused };
