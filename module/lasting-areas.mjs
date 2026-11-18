// Lasting areas (phase 1): a spell whose area stays for its duration keeps working on the creatures in it.
// The spell's template is tracked from its casting (caster, caster level, DC, end time); the active GM's
// client checks who is inside when tokens move or the template does, and on the caster's turns. Rules map:
// blocks-delivery > emanation, spread; the spells' own entries. Rulings: DECISIONS.md, "Lasting areas".
//
// Rules (PF1 compendium text, verbatim where quoted):
//   - Emanation: "Creatures entering the area become subject to it; leaving ends it for them."
//   - Entangle (Reflex partial): "Creatures that fail their save gain the entangled condition. Creatures that
//     make their save can move as normal, but those that remain in the area must save again at the end of your
//     turn. Creatures that move into the area must save immediately."
//   - Stinking cloud (Fortitude negates): "Living creatures in the cloud become nauseated. This condition lasts
//     as long as the creature is in the cloud and for 1d4+1 rounds after it leaves ... Any creature that
//     succeeds on its save but remains in the cloud must continue to save each round on your turn. This is a
//     poison effect."
//   - Cloudkill: "automatically kill any living creature with 3 or fewer HD (no save). A living creature with 4
//     to 6 HD is slain unless it succeeds on a Fortitude save (in which case it takes 1d4 points of
//     Constitution damage on your turn each round while in the cloud). A living creature with more than 6 HD
//     takes 1d4 points of Constitution damage on your turn each round while in the cloud (a successful
//     Fortitude save halves this damage) ... creatures immune to poison are unaffected."
//   - Black tentacles: "Every creature within the area of the spell is the target of a combat maneuver check
//     made to grapple each round at the beginning of your turn, including the round that black tentacles is
//     cast. Creatures that enter the area of effect are also automatically attacked ... the tentacles use your
//     caster level as their base attack bonus and receive a +4 bonus due to their Strength and a +1 size bonus.
//     Roll only once for the entire spell effect each round ... If the tentacles succeed in grappling a foe,
//     that foe takes 1d6+4 points of damage and gains the grappled condition ... +5 bonus on grapple checks made
//     against opponents it is already grappling".
//   - Web: "Anyone in the effect's area when the spell is cast must make a Reflex save. If this save succeeds,
//     the creature is inside the web but is otherwise unaffected. If the save fails, the creature gains the
//     grappled condition ... Anyone moving through the webs must make a combat maneuver check or Escape Artist
//     check as part of their move action, with a DC equal to the spell's DC. Creatures that fail lose their
//     movement and become grappled".
//   - Solid fog: "Creatures moving through a solid fog move at half their normal speed and take a -2 penalty on
//     all melee attack and melee damage rolls ... A creature cannot take a 5-foot-step while in solid fog."
//   - Silence: "spells with verbal components cannot be cast" in the area.
//   - Grease: "Any creature in the area when the spell is cast must make a successful Reflex save or fall. A
//     creature can walk within or through the area of grease at half normal speed with a DC 10 Acrobatics
//     check. Failure means it can't move that round (and must then make a Reflex save or fall), while failure
//     by 5 or more means it falls". Sleet storm: the same check, without the Reflex save; "blocks all sight".
//   - Spike growth: "Any creature moving on foot into or through the spell's area takes 1d4 points of piercing
//     damage for each 5 feet of movement through the spiked area. Any creature that takes damage from this
//     spell must also succeed on a Reflex save or suffer injuries to its feet and legs that slow its land speed
//     by half. This speed penalty lasts for 24 hours".
//   - Create pit: "Any creature standing in the area where you first conjured the pit must make a Reflex saving
//     throw to avoid falling into it ... any creature ending its turn on a square adjacent to the pit must make
//     a Reflex saving throw with a +2 bonus to avoid falling into it ... Creatures who fall into the pit take
//     falling damage as normal." Depth: 10 feet per two caster levels (maximum 30 feet).
//   - Fog cloud (obscuring mist, solid fog, stinking cloud, cloudkill): "A creature within 5 feet has
//     concealment (attacks have a 20% miss chance). Creatures farther away have total concealment (50% miss
//     chance". Fog between the two counts as well as fog around either.
// Rulings (2026-11-17): the template is removed when the spell ends, with a note to the GM; entering creatures'
// saves and checks are rolled automatically, with an Undo; (phase 2, movement through an area: the straight
// line from where the move started to where it ended).

import { MODULE_ID } from "./const.mjs";
import { esc, isActiveGM, saveResult, rollTotal, timed, dealDamage, restoreDamage } from "./util.mjs";
import { creatureTypes } from "./creature-types.mjs";
import { registerMissSource } from "./miss-chance.mjs";

const FLAG = "lastingArea"; // template flag: the area's state (below)
const LINK = "lastingAreaLink"; // buff flag: the template's uuid
const CARD = "lastingAreaCard"; // chat message flag: { undo: [{ actor, conditions, damage, con }] }
const UNIT_SECONDS = { round: 6, minute: 60, hour: 3600 };
const living = (actor) => { const { types } = creatureTypes(actor); return !types.has("undead") && !types.has("construct"); };
const poisonImmune = (actor) => !living(actor) || (actor.system.traits?.ci?.total ?? new Set()).has?.("poison");
const hdOf = (actor) => actor.system.attributes?.hd?.total ?? 0;
const SAVE = { fort: "Fortitude", ref: "Reflex", will: "Will" };

/* -------------------------------------------- */
/*  The spells                                  */
/* -------------------------------------------- */

// Each: when it acts. enter(ctx) for creatures inside at the casting and those entering; casterTurnStart /
// casterTurnEnd for each creature inside; leave and end for each creature leaving or still inside at the end.
// ctx: { zone, actor, token, save(type), note(text), hold(conditions), release(conditions, duration) }
const SPELLS = {
  entangle: {
    names: ["entangle"],
    enter: async (c) => c.saveOrHold("ref", ["entangled"]),
    casterTurnEnd: async (c) => (c.holds("entangled") ? null : c.saveOrHold("ref", ["entangled"])),
    leave: async (c) => c.release(["entangled"]),
  },
  stinkingCloud: {
    names: ["stinking cloud"],
    fog: "fog",
    enter: async (c) => (!living(c.actor) ? c.note("not living: unaffected") : poisonImmune(c.actor) ? c.note("immune to poison") : c.saveOrHold("fort", ["nauseated"])),
    casterTurnStart: async (c) => (!living(c.actor) || poisonImmune(c.actor) || c.holds("nauseated") ? null : c.saveOrHold("fort", ["nauseated"])),
    leave: async (c) => c.release(["nauseated"], "1d4+1"),
  },
  cloudkill: {
    names: ["cloudkill"],
    fog: "fog",
    enter: async (c) => {
      if (!living(c.actor) || poisonImmune(c.actor)) return c.note("unaffected (not living, or immune to poison)");
      const hd = hdOf(c.actor);
      if (hd <= 3) return c.kill("3 or fewer Hit Dice: killed, no save");
      if (hd <= 6) {
        if (!(await c.save("fort"))) return c.kill("4 to 6 Hit Dice, failed: slain");
        c.mark("survived");
        return c.note("survived; 1d4 Con on the caster's turn while inside");
      }
      return c.note("more than 6 Hit Dice: 1d4 Con on the caster's turn while inside (Fortitude halves)");
    },
    casterTurnStart: async (c) => {
      if (!living(c.actor) || poisonImmune(c.actor)) return null;
      const hd = hdOf(c.actor);
      if (hd <= 6 && !c.marked("survived")) return c.enter(); // inside without having been checked yet
      let amount = await rollTotal("1d4");
      if (hd > 6 && (await c.save("fort"))) amount = Math.floor(amount / 2);
      return c.con(amount);
    },
  },
  blackTentacles: {
    names: ["black tentacles"],
    // The round's single roll, rolled at the start of the caster's turn (and at the casting)
    roll: async (zone) => (await new Roll(`1d20 + ${zone.cl} + 4 + 1`).evaluate()).total,
    enter: async (c) => c.grapple(),
    casterTurnStart: async (c) => c.grapple(),
    leave: async (c) => c.release(["grappled"]),
  },
  web: {
    names: ["web"],
    enter: async (c) => (c.atCasting ? c.saveOrHold("ref", ["grappled"]) : c.webMove()),
    leave: async (c) => c.release(["grappled"]),
  },
  grease: {
    names: ["grease"],
    enter: async (c) => (c.atCasting ? c.saveOrFall("ref") : c.footing({ save: true })),
    moved: async (c) => c.footing({ save: true }),
  },
  sleetStorm: {
    names: ["sleet storm"],
    fog: "total",
    enter: async (c) => (c.atCasting ? null : c.footing({ save: false })),
    moved: async (c) => c.footing({ save: false }),
  },
  spikeGrowth: {
    names: ["spike growth"],
    enter: async (c) => (c.atCasting ? null : c.spikes()),
    moved: async (c) => c.spikes(),
  },
  createPit: {
    names: ["create pit"],
    enter: async (c) => (c.atCasting ? c.saveOrPit(0) : c.pit("walked into the pit")),
    adjacentTurnEnd: async (c) => c.saveOrPit(2),
  },
  fogCloud: { names: ["fog cloud"], fog: "fog" },
  obscuringMist: { names: ["obscuring mist"], fog: "fog" },
  solidFog: {
    names: ["solid fog"],
    fog: "fog",
    buff: { changes: [{ formula: "-2", target: "mattack", type: "untyped" }, { formula: "-2", target: "mdamage", type: "untyped" }], note: "half speed; no 5-foot step; ranged weapon attacks don't work (rays do)" },
  },
  silence: {
    names: ["silence"],
    buff: { changes: [], note: "no sound: spells with verbal components can't be cast" },
  },
};
const BY_NAME = new Map(Object.entries(SPELLS).flatMap(([key, s]) => s.names.map((n) => [n, key])));
/** The lasting-area spells (their spell rows are left to this engine). */
export const LASTING_SPELLS = new Set(BY_NAME.keys());

/* -------------------------------------------- */
/*  Who is inside                               */
/* -------------------------------------------- */

/** Is the token's center inside the template? Circles and rectangles by their numbers; other shapes by the canvas. */
export function insideTemplate(template, token) {
  const size = template.parent.grid.size;
  return insidePoint(template, token.x + (token.width * size) / 2, token.y + (token.height * size) / 2);
}
/** Is a point (canvas pixels) inside the template? `pad` widens it (pixels): next to the area. */
export function insidePoint(template, cx, cy, pad = 0) {
  const scene = template.parent;
  const toPx = (d) => (d / scene.grid.distance) * scene.grid.size;
  const t = template.t;
  if (t === "circle") return Math.hypot(cx - template.x, cy - template.y) <= toPx(template.distance) + 1 + pad;
  if (t === "rect") {
    const len = toPx(template.distance);
    const a = Math.toRadians(template.direction);
    const x2 = template.x + len * Math.cos(a);
    const y2 = template.y + len * Math.sin(a);
    const p = 1 + pad;
    return cx >= Math.min(template.x, x2) - p && cx <= Math.max(template.x, x2) + p && cy >= Math.min(template.y, y2) - p && cy <= Math.max(template.y, y2) + p;
  }
  const shape = template.object?.shape;
  return !!shape?.contains?.(cx - template.x, cy - template.y);
}

/** How many feet of the straight line from (x1, y1) to (x2, y2) run inside the template. */
function feetInside(template, x1, y1, x2, y2) {
  const scene = template.parent;
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (!len) return 0;
  const steps = Math.max(1, Math.ceil(len / (scene.grid.size / 10)));
  let inside = 0;
  for (let i = 0; i < steps; i++) {
    const f = (i + 0.5) / steps;
    if (insidePoint(template, x1 + (x2 - x1) * f, y1 + (y2 - y1) * f)) inside++;
  }
  return (inside / steps) * (len / scene.grid.size) * scene.grid.distance;
}

// Where each token stood at the last recheck: the start of its next move (for Spike Growth)
const lastPos = new Map(); // token uuid → { x, y } (center)
const centerOf = (token) => {
  const size = token.parent.grid.size;
  return { x: token.x + (token.width * size) / 2, y: token.y + (token.height * size) / 2 };
};

const zoneOf = (template) => template?.flags?.[MODULE_ID]?.[FLAG] ?? null;
const zonesIn = (scene) => (scene?.templates ?? []).filter((t) => zoneOf(t));
const tokenActor = (token) => token?.actor ?? null;

/* -------------------------------------------- */
/*  Acting on one creature                      */
/* -------------------------------------------- */

/** The context a spell's handlers get for one creature; collects what happened for the card and its Undo. */
function context(template, zone, token, { atCasting = false, lines, undo, ...opts }) {
  const actor = tokenActor(token);
  const state = (zone.creatures ??= {})[token.id] ??= { held: [], marks: [] };
  const record = { actor: actor.uuid, conditions: [], lost: { hp: 0, temp: 0 }, con: 0 };
  /** Typed damage (resistances and DR apply), recorded for the Undo. */
  const hurt = async (amount, types) => {
    const lost = await dealDamage(actor, amount, types);
    record.lost.hp += lost.hp;
    record.lost.temp += lost.temp;
    return lost.hp + lost.temp;
  };
  undo.push(record);
  const line = (text) => lines.push(`${token.name}: ${text}`);
  const c = {
    zone, actor, token, atCasting,
    async save(type) {
      const result = await actor.rollSavingThrow(type, { skipDialog: true, dc: zone.dc, reference: zone.message });
      const r = saveResult(result, zone.dc);
      line(`${SAVE[type]} ${r.total ?? "?"} vs DC ${zone.dc}: ${r.passed ? "saved" : "failed"}`);
      return r.passed;
    },
    holds: (id) => state.held.includes(id),
    marked: (m) => state.marks.includes(m),
    mark: (m) => state.marks.push(m),
    note: (text) => line(text),
    async hold(ids) {
      const add = ids.filter((id) => !actor.statuses.has(id));
      if (add.length) await actor.setConditions(Object.fromEntries(add.map((id) => [id, true])));
      state.held.push(...ids.filter((id) => !state.held.includes(id)));
      record.conditions.push(...add);
      line(ids.join(", "));
    },
    async saveOrHold(type, ids) {
      if (!(await c.save(type))) await c.hold(ids);
    },
    async release(ids, after = null) {
      const mine = ids.filter((id) => state.held.includes(id) && actor.statuses.has(id));
      state.held = state.held.filter((id) => !ids.includes(id));
      if (!mine.length) return;
      if (after) {
        const rounds = await rollTotal(after);
        // PF1 doesn't give a duration to a condition the creature already has: lift it, then set it timed
        await actor.setConditions(Object.fromEntries(mine.map((id) => [id, false])));
        await actor.setConditions(Object.fromEntries(mine.map((id) => [id, { duration: timed(rounds) }])));
        line(`${mine.join(", ")} for ${rounds} more round${rounds === 1 ? "" : "s"}`);
      } else {
        await actor.setConditions(Object.fromEntries(mine.map((id) => [id, false])));
        line(`no longer ${mine.join(", ")}`);
      }
    },
    async kill(text) {
      if (!actor.statuses.has("dead")) {
        await actor.setConditions({ dead: true });
        record.conditions.push("dead");
      }
      line(text);
    },
    async con(amount) {
      await actor.update({ "system.abilities.con.damage": (actor.system.abilities.con.damage ?? 0) + amount });
      record.con += amount;
      line(`${amount} Con damage`);
    },
    async grapple() {
      const roll = zone.roll ?? (zone.roll = await SPELLS.blackTentacles.roll(zone));
      const cmd = actor.system.attributes?.cmd?.total ?? 10;
      const total = roll + (c.holds("grappled") ? 5 : 0);
      if (total < cmd) return line(`tentacles ${total} vs CMD ${cmd}: no grapple`);
      if (!c.holds("grappled")) await c.hold(["grappled"]);
      const dmg = await rollTotal("1d6+4");
      const taken = await hurt(dmg, ["bludgeoning"]);
      line(`tentacles ${total} vs CMD ${cmd}: grappled, ${dmg} bludgeoning damage${taken < dmg ? ` (${taken} after DR)` : ""}`);
    },
    async webMove() {
      // Combat maneuver check or Escape Artist, whichever is better, against the spell's DC
      const cmb = actor.system.attributes?.cmb?.total ?? 0;
      const esc = actor.system.skills?.esc?.mod ?? 0;
      const bonus = Math.max(cmb, esc);
      const total = (await new Roll(`1d20 + ${bonus}`).evaluate()).total;
      line(`moving into the web: ${total} (${bonus === cmb ? "CMB" : "Escape Artist"}) vs DC ${zone.dc}`);
      if (total < zone.dc) await c.hold(["grappled"]);
    },
    enter: () => SPELLS[zone.key].enter?.(c),
    async fall(text) {
      if (!actor.statuses.has("prone")) {
        await actor.setConditions({ prone: true });
        record.conditions.push("prone");
      }
      line(text);
    },
    async saveOrFall(type) {
      if (!(await c.save(type))) await c.fall("falls prone");
    },
    /** Grease, sleet storm: DC 10 Acrobatics to move; failing stops it (and with grease a Reflex save or a fall), by 5 or more it falls. */
    async footing({ save }) {
      const check = await actor.rollSkill("acr", { skipDialog: true });
      const total = check?.rolls?.[0]?.total ?? check?.total ?? 0;
      line(`Acrobatics ${total} vs DC 10`);
      if (total >= 10) return;
      if (total <= 5) return c.fall("fails by 5 or more: falls prone");
      line("can't move this round");
      if (save) await c.saveOrFall("ref");
    },
    /** Spike growth: 1d4 piercing per 5 feet moved through the area, then a Reflex save or half land speed for 24 hours. */
    async spikes() {
      const to = centerOf(token);
      const from = opts.from ?? to;
      const feet = Math.max(5, Math.round(feetInside(template, from.x, from.y, to.x, to.y)));
      const n = Math.max(1, Math.floor(feet / 5));
      const dmg = await rollTotal(`${n}d4`);
      const taken = await hurt(dmg, ["piercing"]);
      line(`${feet} feet through the spikes: ${dmg} piercing damage${taken < dmg ? ` (${taken} after DR)` : ""}`);
      if (!taken) return; // "Any creature that takes damage from this spell must also succeed on a Reflex save"
      if (actor.itemTypes.buff.some((b) => b.isActive && /^spike growth injury/i.test(b.name))) return;
      if (await c.save("ref")) return;
      await actor.createEmbeddedDocuments("Item", [{ name: "Spike Growth injury", type: "buff", img: "icons/svg/trap.svg", system: { active: true, subType: "temp", duration: { value: "24", units: "hour" }, contextNotes: [{ text: "Land speed halved (feet and legs injured by spike growth) until the 24 hours pass or a cure spell heals it", target: "attack" }] } }]);
      line("land speed halved for 24 hours");
    },
    /** Create pit: falling in (1d6 per 10 feet of depth) and prone. */
    async pit(text) {
      const depth = Math.min(30, 10 * Math.max(1, Math.floor(zone.cl / 2)));
      const dmg = await rollTotal(`${depth / 10}d6`);
      await hurt(dmg, ["bludgeoning"]); // falling damage
      await c.fall(`${text}: falls ${depth} feet, ${dmg} damage, prone`);
    },
    async saveOrPit(bonus) {
      const result = await actor.rollSavingThrow("ref", { skipDialog: true, dc: zone.dc, reference: zone.message, bonus: bonus ? `${bonus}[Pit's edge]` : undefined });
      const r = saveResult(result, zone.dc);
      line(`Reflex ${r.total ?? "?"} vs DC ${zone.dc}${bonus ? " (+2 at the edge)" : ""}: ${r.passed ? "saved" : "failed"}`);
      if (!r.passed) await c.pit("falls into the pit");
    },
  };
  return c;
}

/** Run a handler for some creatures, save the area's state and post one card (with an Undo). */
async function act(template, tokens, handler, title, opts = {}) {
  const zone = foundry.utils.deepClone(zoneOf(template));
  const spell = SPELLS[zone.key];
  const lines = [];
  const undo = [];
  if (spell.roll && opts.newRound) zone.roll = await spell.roll(zone);
  for (const token of tokens) {
    if (!tokenActor(token)) continue;
    const fn = typeof handler === "function" ? handler : spell[handler];
    if (fn) await fn(context(template, zone, token, { ...opts, lines, undo }));
    if (spell.buff) await (handler === "leave" || handler === "end" ? removeBuff(token, template) : opts.buffless ? null : addBuff(token, template, zone));
  }
  if (template.parent?.templates?.has(template.id)) await template.update({ [`flags.${MODULE_ID}.${FLAG}`]: zone });
  if (!lines.length) return;
  await ChatMessage.implementation.create({
    whisper: game.users.filter((u) => u.isGM).map((u) => u.id),
    content: `<p><strong>${esc(zone.name)}</strong>${title ? ` (${esc(title)})` : ""}${zone.roll && spell.roll ? `, tentacles' roll ${zone.roll}` : ""}:</p><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>${undo.some((u) => u.conditions.length || u.lost?.hp || u.lost?.temp || u.con) ? `<button type="button" data-action="${MODULE_ID}-area-undo">Undo</button>` : ""}`,
    flags: { [MODULE_ID]: { [CARD]: { undo } } },
  });
}

async function addBuff(token, template, zone) {
  const actor = tokenActor(token);
  if (!actor || actor.itemTypes.buff.some((b) => b.flags?.[MODULE_ID]?.[LINK] === template.uuid)) return;
  const b = SPELLS[zone.key].buff;
  await actor.createEmbeddedDocuments("Item", [{
    name: `${zone.name} (area)`, type: "buff", img: "icons/svg/cloud.svg",
    system: { active: true, subType: "spell", changes: b.changes, contextNotes: b.note ? [{ text: b.note, target: "attack" }] : [] },
    flags: { [MODULE_ID]: { [LINK]: template.uuid } },
  }]);
}
async function removeBuff(token, template) {
  const actor = tokenActor(token);
  const ids = actor?.itemTypes.buff.filter((b) => b.flags?.[MODULE_ID]?.[LINK] === template.uuid).map((b) => b.id) ?? [];
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
}

/* -------------------------------------------- */
/*  Casting, moving, turns, ending              */
/* -------------------------------------------- */

/** The area's lasting spell, if this card's spell has one. */
function spellKey(message) {
  const item = message.itemSource;
  const name = (item?.type === "spell" ? item.name : item?.system?.spellName ?? item?.name ?? "").toLowerCase().replace(/^(scroll|wand|potion) of /, "");
  return BY_NAME.get(name) ?? null;
}

async function durationSeconds(message) {
  const item = message.itemSource;
  const action = item?.actions?.get(message.system.action?.id) ?? item?.defaultAction;
  const d = action?.duration;
  const per = UNIT_SECONDS[{ round: "round", rounds: "round", minute: "minute", hour: "hour" }[d?.units] ?? ""];
  if (!per || !d?.value) return null;
  const cl = message.system.config?.cl ?? item.system?.cl ?? 1;
  return (await rollTotal(String(d.value).replace(/@cl/g, cl))) * per;
}

// A lasting-area spell cast with a template: track it, and act on the creatures inside
Hooks.on("createChatMessage", async (message) => {
  if (!isActiveGM() || message.type !== "action") return;
  const key = spellKey(message);
  const template = key ? fromUuidSync(message.system.template ?? "") : null;
  if (!template) return;
  const caster = ChatMessage.implementation.getSpeakerActor(message.speaker);
  const seconds = await durationSeconds(message);
  const zone = {
    key, name: message.itemSource.name, caster: caster?.uuid ?? null, message: message.uuid,
    dc: message.system.save?.dc ?? null, cl: message.system.config?.cl ?? 1,
    endsAt: seconds ? game.time.worldTime + seconds : null,
    inside: [], creatures: {},
  };
  await template.update({ [`flags.${MODULE_ID}.${FLAG}`]: zone });
  const inside = template.parent.tokens.filter((t) => tokenActor(t) && !t.hidden && insideTemplate(template, t));
  await template.update({ [`flags.${MODULE_ID}.${FLAG}.inside`]: inside.map((t) => t.id) });
  if (inside.length) await act(template, inside, "enter", "cast", { atCasting: true, newRound: true });
});

/** Recheck who is inside a template: those entering and those leaving. */
async function recheck(template) {
  const zone = zoneOf(template);
  if (!zone) return;
  const now = template.parent.tokens.filter((t) => tokenActor(t) && !t.hidden && insideTemplate(template, t)).map((t) => t.id);
  const entered = now.filter((id) => !zone.inside.includes(id)).map((id) => template.parent.tokens.get(id));
  const left = zone.inside.filter((id) => !now.includes(id)).map((id) => template.parent.tokens.get(id)).filter(Boolean);
  // Creatures that stayed inside but moved (grease, sleet storm, spike growth)
  const pos = zone.pos ?? {};
  const key = (t) => `${Math.round(t.x)},${Math.round(t.y)}`;
  const moved = SPELLS[zone.key].moved ? now.filter((id) => zone.inside.includes(id) && pos[id] && pos[id] !== key(template.parent.tokens.get(id))).map((id) => template.parent.tokens.get(id)) : [];
  const nextPos = Object.fromEntries(now.map((id) => [id, key(template.parent.tokens.get(id))]));
  if (!entered.length && !left.length && !moved.length) {
    if (JSON.stringify(nextPos) !== JSON.stringify(pos)) await template.update({ [`flags.${MODULE_ID}.${FLAG}.pos`]: nextPos });
    return;
  }
  await template.update({ [`flags.${MODULE_ID}.${FLAG}.inside`]: now, [`flags.${MODULE_ID}.${FLAG}.-=pos`]: null });
  await template.update({ [`flags.${MODULE_ID}.${FLAG}.pos`]: nextPos });
  if (left.length) await act(template, left, "leave", "left the area");
  for (const token of entered) await act(template, [token], "enter", "entered the area", { from: lastPos.get(token.uuid) });
  for (const token of moved) await act(template, [token], "moved", "moved in the area", { from: lastPos.get(token.uuid) });
}

const pending = new Map(); // scene id → timer: one recheck after a burst of movement
function soon(scene) {
  if (!isActiveGM() || !zonesIn(scene).length) return;
  clearTimeout(pending.get(scene.id));
  pending.set(scene.id, setTimeout(async () => {
    pending.delete(scene.id);
    for (const template of zonesIn(scene)) await recheck(template);
    for (const token of scene.tokens) lastPos.set(token.uuid, centerOf(token));
  }, 300));
}
Hooks.on("updateToken", (token, changes) => {
  if ("x" in changes || "y" in changes || "hidden" in changes) soon(token.parent);
});
Hooks.on("createToken", (token) => soon(token.parent));
Hooks.on("updateMeasuredTemplate", (template, changes) => {
  if (["x", "y", "distance", "direction", "width"].some((k) => k in changes)) soon(template.parent);
});

// The caster's turn: start and end
Hooks.on("updateCombat", async (combat, changes, options) => {
  if (!isActiveGM() || !("turn" in changes || "round" in changes) || options.direction === -1) return;
  const scene = combat.scene ?? game.scenes.viewed;
  const zones = zonesIn(scene);
  if (!zones.length) return;
  const ended = combat.previous?.combatantId ? combat.combatants.get(combat.previous.combatantId)?.actor : null;
  const started = combat.combatant?.actor;
  for (const template of zones) {
    const zone = zoneOf(template);
    const inside = zone.inside.map((id) => scene.tokens.get(id)).filter(Boolean);
    const spell = SPELLS[zone.key];
    // Create pit: a creature ending its turn next to the pit (not in it)
    if (spell.adjacentTurnEnd && ended) {
      const pad = scene.grid.size;
      const next = scene.tokens.filter((t) => t.actor === ended && !zone.inside.includes(t.id) && insidePoint(template, centerOf(t).x, centerOf(t).y, pad));
      if (next.length) await act(template, next, "adjacentTurnEnd", "ended its turn at the edge");
    }
    if (ended?.uuid === zone.caster && spell.casterTurnEnd && inside.length) await act(template, inside, "casterTurnEnd", "end of the caster's turn");
    if (started?.uuid === zone.caster && (spell.casterTurnStart || spell.roll) && inside.length) await act(template, inside, "casterTurnStart", "the caster's turn", { newRound: true });
  }
});

/** The spell ends: release everyone inside, remove the template, and tell the GM. */
async function endZone(template) {
  const zone = zoneOf(template);
  const inside = zone.inside.map((id) => template.parent.tokens.get(id)).filter(Boolean);
  if (inside.length) await act(template, inside, SPELLS[zone.key].leave ?? "leave", "the spell ended");
  for (const t of inside) await removeBuff(t, template);
  await template.delete();
  await ChatMessage.implementation.create({ whisper: game.users.filter((u) => u.isGM).map((u) => u.id), content: `<p><strong>${esc(zone.name)}</strong> has ended; its area is removed.</p>` });
}

// Every change of game time: the check is synchronous, and only an ended spell starts anything async
Hooks.on("updateWorldTime", () => {
  if (!isActiveGM()) return;
  const ended = [];
  for (const scene of game.scenes) for (const template of zonesIn(scene)) {
    const zone = zoneOf(template);
    if (zone.endsAt !== null && game.time.worldTime >= zone.endsAt) ended.push(template);
  }
  if (ended.length) (async () => { for (const t of ended) await endZone(t); })();
});

// A template deleted by hand: what it held ends
Hooks.on("deleteMeasuredTemplate", async (template, options, userId) => {
  const zone = zoneOf(template);
  if (!zone || game.user.id !== userId) return;
  for (const id of zone.inside ?? []) {
    const token = template.parent.tokens.get(id);
    const actor = tokenActor(token);
    if (!actor) continue;
    await removeBuff(token, template);
    const held = zone.creatures?.[id]?.held ?? [];
    const still = held.filter((c) => actor.statuses.has(c));
    if (still.length && zone.key !== "stinkingCloud") await actor.setConditions(Object.fromEntries(still.map((c) => [c, false])));
  }
});

// Undo a card
Hooks.on("renderChatMessageHTML", (message, html) => {
  const data = message.getFlag(MODULE_ID, CARD);
  const button = data && html.querySelector(`[data-action="${MODULE_ID}-area-undo"]`);
  if (!button) return;
  if (!game.user.isGM || message.getFlag(MODULE_ID, "undone")) return void button.remove();
  button.addEventListener("click", async () => {
    button.remove();
    for (const u of data.undo ?? []) {
      const actor = fromUuidSync(u.actor);
      if (!actor) continue;
      if (u.conditions.length) await actor.setConditions(Object.fromEntries(u.conditions.map((c) => [c, false])));
      if (u.lost) await restoreDamage(actor, u.lost);
      if (u.con) await actor.update({ "system.abilities.con.damage": Math.max(0, (actor.system.abilities.con.damage ?? 0) - u.con) });
    }
    await message.setFlag(MODULE_ID, "undone", true);
  });
});

// Fogs: concealment for creatures in, or seen through, a fog's area (miss-chance.mjs rolls it)
registerMissSource((defender, attacker, { distance }) => {
  const scene = defender.parent;
  if (!scene || attacker.parent !== scene) return [];
  const a = centerOf(attacker);
  const d = centerOf(defender);
  const out = [];
  for (const template of zonesIn(scene)) {
    const zone = zoneOf(template);
    const fog = SPELLS[zone.key]?.fog;
    if (!fog) continue;
    const through = insidePoint(template, a.x, a.y) || insidePoint(template, d.x, d.y) || feetInside(template, a.x, a.y, d.x, d.y) > 0;
    if (!through) continue;
    const near = (distance ?? Infinity) <= 5;
    const chance = fog === "total" || !near ? 50 : 20;
    out.push({ chance, label: `${zone.name} (${chance === 50 ? "total concealment" : "concealment"})`, concealment: true });
  }
  return out;
});

export const _test = { FLAG, SPELLS, insideTemplate, insidePoint, feetInside, recheck, endZone, act, zoneOf };
