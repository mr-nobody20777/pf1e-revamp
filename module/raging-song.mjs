// Raging Song (Skald): PF1 ships the songs as text with an empty action, and tracks the rounds pool
// on the Raging Song feature. This makes them work:
//   - Starting a song (the song's Use action or its footnote button) picks targets in range,
//     spends 1 round, and records the active song on the Raging Song item.
//   - The active GM's client mirrors that as linked buffs: an indicator on the skald and a buff with
//     the song's real effects on each target. Removing the skald's buff ends the song; removing a
//     target's buff releases only that target.
//   - In combat, each of the skald's turns spends another round; at 0 the song ends.
// Only one raging song is active at a time; starting another replaces it.

import { MODULE_ID } from "./const.mjs";
import { registerFootnote, footnoteButton, refreshFootnotes } from "./footnote.mjs";
import { classLevel, isActiveGM, allActors, linkedBuffs, createQueue, stillExists, deleteIfExists, esc, onSceneCatchUp } from "./util.mjs";

const FLAG = "ragingSong";
const LINK = "songLink";
const PF1 = "Compendium.pf1.class-abilities.Item.";
const POOL_SOURCE = `${PF1}sPqP7QFldieWEADi`;

const SONGS = {
  inspiredRage: {
    label: "Inspired Rage",
    source: `${PF1}1HQUUhQhowqKfmCA`,
    range: 60,
    side: "allies",
    includeSelf: true,
    perRound: true,
    effect(level) {
      const strCon = 2 + 2 * (level >= 8) + 2 * (level >= 16);
      const will = 1 + Math.floor(level / 4);
      return {
        changes: [["str", "morale", strCon], ["con", "morale", strCon], ["will", "morale", will], ["ac", "untyped", -1]],
        summary: `+${strCon} morale to Str and Con, +${will} morale on Will saves, −1 AC`,
        details:
          "Allies other than the skald can't use Charisma-, Dexterity- or Intelligence-based skills (except Acrobatics, Fly, Intimidate and Ride) or abilities that require patience or concentration. Not fatigued afterwards. An ally with her own rage ability may use her own bonuses instead.",
      };
    },
  },
  songOfStrength: {
    label: "Song of Strength",
    source: `${PF1}xqWYyijR7PxZGI69`,
    range: 60,
    side: "allies",
    includeSelf: false,
    perRound: true,
    effect(level) {
      const bonus = Math.floor(level / 2);
      const note = `+[[${bonus}]] to one Strength check or Strength-based skill check per round (Song of Strength)`;
      return {
        notes: [["strChecks", note], ["strSkills", note]],
        summary: `+${bonus} to one Strength check or Strength-based skill check each round`,
      };
    },
  },
  songOfMarching: {
    label: "Song of Marching",
    source: `${PF1}jR8RFYhHsjRzzmB0`,
    range: 60,
    side: "allies",
    includeSelf: true,
    perRound: false, // 1 round covers the whole hour
    duration: { value: "1", units: "hour" },
    effect() {
      return { summary: "may hustle for the next hour; it counts as a walk for nonlethal damage and fatigue" };
    },
  },
  dirgeOfDoom: {
    label: "Dirge of Doom",
    source: `${PF1}pmWnRksUzrKvNOvy`,
    range: 30,
    side: "enemies",
    includeSelf: false,
    perRound: true,
    effect() {
      return {
        conditions: ["shaken"],
        summary: "shaken while within 30 ft and able to see and hear the song",
        details: "This can't make a creature frightened or panicked, even if it's already shaken from another effect.",
      };
    },
  },
};

/* -------------------------------------------- */
/*  Lookup                                      */
/* -------------------------------------------- */

function songKeyFor(item) {
  if (item.type !== "feat") return null;
  const source = item._stats?.compendiumSource;
  return Object.keys(SONGS).find((key) => SONGS[key].source === source || SONGS[key].label === item.name) ?? null;
}

function isPool(item) {
  return item.type === "feat" && (item.system.tag === "classFeat_ragingSong" || item._stats?.compendiumSource === POOL_SOURCE || item.name === "Raging Song");
}

export function findPool(actor) {
  return actor?.items.find(isPool) ?? null;
}

function skaldLevel(item) {
  return classLevel(item, "skald");
}

function roundsLeft(pool) {
  return pool.system.uses?.value ?? 0;
}

/** Deafened by the PF1 condition, a buff that applies it, or an active buff named like it. */
function isDeaf(actor) {
  if (actor.statuses?.has("deaf")) return true;
  return actor.itemTypes.buff.some((b) => b.isActive && /^deaf(ened)?\b/i.test(b.name));
}

/* -------------------------------------------- */
/*  Starting and ending                         */
/* -------------------------------------------- */

function candidatesInRange(skaldToken, def) {
  const disposition = skaldToken.document.disposition;
  return canvas.tokens.placeables
    .filter((t) => t.actor && !t.document.hidden)
    .filter((t) => {
      if (t === skaldToken) return def.side === "allies";
      return def.side === "allies" ? t.document.disposition === disposition : t.document.disposition === -disposition;
    })
    .map((t) => ({ token: t, distance: t === skaldToken ? 0 : canvas.grid.measurePath([skaldToken.center, t.center]).distance }))
    .filter((c) => c.distance <= def.range)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * @param {boolean} [prepaid] The round was already spent by PF1 (Raging Song's own Use action);
 *   don't spend another, and refund it if the song isn't started.
 * @param {Token[]} [targets] Skip the checklist and affect these tokens (macros, tests).
 */
export async function startSong(actor, songItem, { prepaid = false, targets = null } = {}) {
  const key = songKeyFor(songItem);
  const def = SONGS[key];
  const pool = findPool(actor);
  if (!pool) return ui.notifications.warn(`${actor.name} has no Raging Song feature to spend rounds from.`);
  const refund = () => prepaid && pool.update({ "system.uses.value": roundsLeft(pool) + 1 });
  if (!prepaid && roundsLeft(pool) < 1) return ui.notifications.warn(`${actor.name} has no rounds of raging song left.`);

  const skaldToken = actor.getActiveTokens()[0];
  if (!skaldToken) {
    await refund();
    return ui.notifications.warn(`${actor.name}'s token must be on the scene to start a song.`);
  }

  const level = skaldLevel(songItem);
  const effect = def.effect(level);
  const candidates = candidatesInRange(skaldToken, def);
  const rows = candidates
    .map(
      (c, i) => `<label style="display:block"><input type="checkbox" name="target" value="${i}" ${c.token !== skaldToken || def.includeSelf ? "checked" : ""}>
        ${esc(c.token.name)} <span style="opacity:0.7">(${c.token === skaldToken ? "you" : `${Math.round(c.distance)} ft`})</span></label>`
    )
    .join("");

  const chosen = targets ?? await foundry.applications.api.DialogV2.wait({
    window: { title: `${def.label}: choose ${def.side}` },
    content: `<p><strong>${esc(def.label)}</strong>: ${esc(effect.summary)}.</p>
      <p style="font-size:11px; opacity:0.8">${def.side === "allies" ? "Allies" : "Enemies"} within ${def.range} ft. Uncheck anyone who declines or can't hear. ${prepaid ? "1 round already spent" : "Costs 1 round"}${def.perRound ? ", then 1 more each of your turns in combat" : " for the hour"}. Rounds left: ${roundsLeft(pool)}.</p>
      ${isDeaf(actor) ? '<p style="color:#c00"><i class="fa-solid fa-ear-deaf"></i> Deafened: 20% chance the song fails to start (the round is still spent).</p>' : ""}
      ${rows || `<p>No ${def.side} within ${def.range} ft.</p>`}`,
    buttons: [
      {
        action: "start",
        label: "Start song",
        icon: "fa-solid fa-music",
        default: true,
        callback: (event, button) => [...button.form.querySelectorAll('input[name="target"]:checked')].map((el) => candidates[el.value].token),
      },
      { action: "cancel", label: "Cancel" },
    ],
    rejectClose: false,
  });
  if (!Array.isArray(chosen)) return refund();

  const left = prepaid ? roundsLeft(pool) : roundsLeft(pool) - 1;
  if (!prepaid) await pool.update({ "system.uses.value": left });
  // The combat the skald is actually in (not necessarily the one on the scene being viewed)
  const combat = game.combats.find((c) => c.started && c.combatants.some((cb) => cb.actor === actor)) ?? null;

  // A deaf performer has a 20% chance to fail an audible performance; the round is still spent.
  if (isDeaf(actor)) {
    const roll = await new Roll("1d100").evaluate();
    const failed = roll.total <= 20;
    await roll.toMessage({
      speaker: ChatMessage.implementation.getSpeaker({ actor }),
      flavor: `${def.label}: deafened, 20% chance to fail (fails on 1–20) — <strong>${failed ? "FAILED" : "succeeded"}</strong>`,
    });
    if (failed) {
      if (pool.getFlag(MODULE_ID, FLAG)) await endSong(pool, "replaced by a failed performance");
      return ChatMessage.implementation.create({
        speaker: ChatMessage.implementation.getSpeaker({ actor }),
        content: `<p><strong>${esc(def.label)}</strong> fails to start (deafened). The round is still spent. Rounds of raging song left: ${left}.</p>`,
      });
    }
  }
  await pool.setFlag(MODULE_ID, FLAG, {
    song: key,
    songItem: songItem.uuid,
    level,
    targets: chosen.map((t) => t.document.uuid),
    combatId: combat?.id ?? null,
    paidRound: combat?.round ?? null,
  });

  ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }),
    content: `<p><strong>${esc(def.label)}</strong> begins: ${esc(effect.summary)}.</p><p>Affecting: ${esc(chosen.map((t) => t.name).join(", ") || "nobody")}. Rounds of raging song left: ${left}.</p>`,
  });
}

export async function endSong(pool, reason) {
  const state = pool.getFlag(MODULE_ID, FLAG);
  if (!state) return;
  await pool.unsetFlag(MODULE_ID, FLAG);
  ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor: pool.actor }),
    content: `<p><strong>${esc(SONGS[state.song]?.label ?? "Raging song")}</strong> ends${reason ? ` (${esc(reason)})` : ""}.</p>`,
  });
}

/** Raging Song's own Use (PF1 already spent the round): pick which song, then targets. */
async function chooseSong(actor, pool) {
  const songs = actor.items.filter((i) => songKeyFor(i));
  const refund = () => pool.update({ "system.uses.value": roundsLeft(pool) + 1 });
  if (!songs.length) {
    await refund();
    return ui.notifications.warn(`${actor.name} has no raging songs to perform.`);
  }

  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: "Raging Song: choose a song" },
    content: `<p>Which song? ${pool.getFlag(MODULE_ID, FLAG) ? "This replaces the current song." : ""}</p>`,
    buttons: [
      ...songs.map((song, i) => ({
        action: `song${i}`,
        label: SONGS[songKeyFor(song)].label,
        icon: "fa-solid fa-music",
        default: i === 0,
        callback: () => song,
      })),
      { action: "cancel", label: "Cancel" },
    ],
    rejectClose: false,
  });
  if (!picked || typeof picked === "string") return refund();
  return startSong(actor, picked, { prepaid: true });
}

Hooks.on("pf1PostActionUse", (actionUse) => {
  const item = actionUse.item;
  if (!item?.actor) return;
  if (isPool(item)) chooseSong(item.actor, item);
  else if (songKeyFor(item)) startSong(item.actor, item);
});

/* -------------------------------------------- */
/*  Linked buffs (active GM only)               */
/* -------------------------------------------- */

const enqueue = createQueue("Raging Song");

function buffData(name, img, description, link, effect = {}, duration) {
  return {
    name,
    type: "buff",
    img,
    system: {
      subType: "temp",
      active: true,
      description: { value: description },
      changes: (effect.changes ?? []).map(([target, type, formula]) => ({ target, type, formula: String(formula) })),
      contextNotes: (effect.notes ?? []).map(([target, text]) => ({ target, text })),
      conditions: effect.conditions ?? [],
      ...(duration ? { duration } : {}),
    },
    flags: { [MODULE_ID]: { [LINK]: link } },
  };
}

/** Make the song buffs everywhere match the pool's active song. */
async function reconcile(pool) {
  if (!stillExists(pool)) return;
  const actor = pool.actor;
  if (!actor) return;
  const state = pool.getFlag(MODULE_ID, FLAG);
  const def = state && SONGS[state.song];
  const wanted = (link) =>
    def && link.song === state.song && (link.role === "song" || state.targets.includes(link.target));

  // Remove anything that no longer matches (other song, released target, song ended)
  for (const other of allActors()) {
    for (const buff of linkedBuffs(other, LINK, pool.uuid)) {
      if (!wanted(buff.getFlag(MODULE_ID, LINK))) await deleteIfExists(buff);
    }
  }
  if (!def) return;

  const songItem = fromUuidSync(state.songItem);
  const img = songItem?.img ?? pool.img;
  const effect = def.effect(state.level);
  const description = `<p>${esc(effect.summary)}.</p>${effect.details ? `<p>${esc(effect.details)}</p>` : ""}`;

  if (!linkedBuffs(actor, LINK, pool.uuid).some((b) => b.getFlag(MODULE_ID, LINK).role === "song")) {
    const link = { source: pool.uuid, target: null, role: "song", song: state.song };
    const text = `<p>${esc(actor.name)} is performing ${esc(def.label)}. Delete or deactivate this buff to end the song for everyone.</p>${description}`;
    await actor.createEmbeddedDocuments("Item", [buffData(`Raging Song: ${def.label}`, img, text, link, {}, def.duration)]);
  }

  for (const uuid of state.targets) {
    const target = fromUuidSync(uuid)?.actor;
    if (!target || linkedBuffs(target, LINK, pool.uuid, uuid).some((b) => b.getFlag(MODULE_ID, LINK).role === "effect")) continue;
    const link = { source: pool.uuid, target: uuid, role: "effect", song: state.song };
    const text = `<p>From ${esc(actor.name)}'s ${esc(def.label)}. Delete or deactivate this buff to leave the song.</p>${description}`;
    await target.createEmbeddedDocuments("Item", [buffData(`${def.label} (${actor.name})`, img, text, link, effect, def.duration)]);
  }
}

/** A song buff went away: the skald's ends the song, a target's releases that target. */
async function unlink(link) {
  const pool = fromUuidSync(link.source);
  const state = pool?.getFlag(MODULE_ID, FLAG);
  if (!state || state.song !== link.song) return;
  if (link.role === "song") return endSong(pool, "stopped");
  if (state.targets.includes(link.target)) {
    await pool.setFlag(MODULE_ID, `${FLAG}.targets`, state.targets.filter((u) => u !== link.target));
  }
}

Hooks.on("updateItem", (item, changes) => {
  if (isPool(item)) refreshFootnotes(item); // rounds left / active song live in the pool's footnote
  if (!isActiveGM()) return;
  if (isPool(item) && foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`)) enqueue(() => reconcile(item));
  const link = item.getFlag(MODULE_ID, LINK);
  if (link && changes.system?.active === false) enqueue(() => unlink(link));
});

Hooks.on("deleteItem", (item) => {
  if (!isActiveGM()) return;
  const link = item.getFlag(MODULE_ID, LINK);
  if (link) enqueue(() => unlink(link));
  if (isPool(item)) {
    enqueue(async () => {
      for (const other of allActors()) for (const buff of linkedBuffs(other, LINK, item.uuid)) await deleteIfExists(buff);
    });
  }
});

// Catch up on songs started while no GM was connected.
onSceneCatchUp((item) => {
  if (isPool(item) && item.getFlag(MODULE_ID, FLAG)) enqueue(() => reconcile(item));
});

/* -------------------------------------------- */
/*  Spending rounds in combat (active GM only)  */
/* -------------------------------------------- */

// Maintaining the song is paid at the END of each of the skald's turns (when the turn passes from
// them), except the turn the song was started, which was already paid.
Hooks.on("combatTurnChange", (combat, prior, current) => {
  if (!isActiveGM()) return;
  const backwards = current.round < prior.round || (current.round === prior.round && current.turn < prior.turn);
  if (backwards) return;

  const actor = combat.combatants.get(prior.combatantId)?.actor;
  const pool = findPool(actor);
  const state = pool?.getFlag(MODULE_ID, FLAG);
  if (!state || !SONGS[state.song]?.perRound) return;
  if (state.combatId === combat.id && state.paidRound === prior.round) return;

  enqueue(async () => {
    if (roundsLeft(pool) < 1) return endSong(pool, "out of rounds");
    await pool.update({
      "system.uses.value": roundsLeft(pool) - 1,
      [`flags.${MODULE_ID}.${FLAG}.combatId`]: combat.id,
      [`flags.${MODULE_ID}.${FLAG}.paidRound`]: prior.round,
    });
  });
});

/* -------------------------------------------- */
/*  Footnotes                                   */
/* -------------------------------------------- */

function startButton(actor, songItem) {
  return footnoteButton(`Start ${SONGS[songKeyFor(songItem)].label}`, "Choose targets and spend 1 round", () => startSong(actor, songItem));
}

registerFootnote((item) => {
  if (!item.actor || !isPool(item)) return null;
  const state = item.getFlag(MODULE_ID, FLAG);
  const content = [`Rounds left: ${roundsLeft(item)}/${item.system.uses?.max ?? "?"}. `];
  if (state) {
    const names = state.targets.map((u) => fromUuidSync(u)?.name ?? "unknown");
    content.push(`Performing ${SONGS[state.song].label} for ${names.join(", ") || "nobody"}.`);
    if (item.isOwner) content.push(footnoteButton("End song", "End the raging song for everyone", () => endSong(item, "stopped")));
  } else {
    content.push("No song active.");
    if (item.isOwner) for (const song of item.actor.items.filter((i) => songKeyFor(i))) content.push(" ", startButton(item.actor, song));
  }
  return content;
});

registerFootnote((item) => {
  const key = songKeyFor(item);
  if (!key) return null;
  const def = SONGS[key];
  const effect = def.effect(item.actor ? skaldLevel(item) : 1);
  const content = [
    `Spends raging song rounds${def.perRound ? " each round" : " (1 per hour)"}. Affects chosen ${def.side} within ${def.range} ft: ${effect.summary}. Applied as linked buffs; removing the skald's buff ends the song.`,
  ];
  if (item.actor && item.isOwner && findPool(item.actor)) content.push(" ", startButton(item.actor, item));
  return content;
});
