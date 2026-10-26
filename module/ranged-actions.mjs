// Ranged combat, phase 3: action economy. Loaded weapons and reloading (an opt-in world setting), and the
// warning for shooting or reloading while threatened (always on). Full attacks with thrown weapons: PF1
// already gives them a single attack (Quick Draw doesn't add more; see TODO.md).
// Research: docs/RANGED-COMBAT-RESEARCH.md; rulings: DECISIONS.md.
//
// Rules (Core Rulebook and Ultimate Combat weapon entries):
//   - Bows draw ammunition as a free action. Hand and light crossbows, slings and halfling sling staves
//     load as a move action; heavy crossbows as a full-round action; a repeating crossbow's 5-bolt case
//     is replaced as a full-round action. Loading provokes attacks of opportunity. Without a free reload,
//     a full attack gets one shot per loaded round.
//   - Firearms (Ultimate Combat): early firearms load each barrel as a standard action (one-handed) or a
//     full-round action (two-handed); advanced firearms load to capacity as a move action. Loading
//     provokes.
//   - Rapid Reload: hand and light crossbow (and slings, staves) a free action, heavy crossbow a move
//     action, firearms one step faster; Crossbow Mastery: any crossbow a free action; Crossbow Training
//     (elves): light free, heavy move; Warslinger and Juggle Load: slings free. A feat chosen for one
//     weapon ("Rapid Reload (Light Crossbow)") applies to that weapon only.
//   - A ranged attack provokes from creatures threatening the attacker, and so does loading. Not with:
//     Point-Blank Master (chosen weapon), safe shot (archer with bows, crossbowman with crossbows),
//     Close-Quarters Thrower (thrown), nimble shot weapons, Sword and Pistol, Deft Shootist and Art of
//     the Gun (firearms); for loading: Ammo Drop, Juggle Load and Slipslinger Style (slings), Crossbow
//     Mastery, Protective Line (firearms).

import { MODULE_ID, RANGED_ATTACKS } from "./const.mjs";
import { esc, wrapMethod, tokenDistance, isActiveGM } from "./util.mjs";
import { registerFootnote, footnoteButton } from "./footnote.mjs";

const SETTING = "trackLoadedWeapons";
const LOADED = "loaded";
const tracking = () => game.settings.settings.has(`${MODULE_ID}.${SETTING}`) && game.settings.get(MODULE_ID, SETTING);

function registerSetting() {
  if (game.settings.settings.has(`${MODULE_ID}.${SETTING}`)) return;
  game.settings.register(MODULE_ID, SETTING, {
    name: "Track loaded ranged weapons",
    hint: "Crossbows, slings and firearms keep track of being loaded: firing an empty one is refused until it's reloaded (a button on the weapon and on the attack card), and full attacks get only the loaded shots. Weapons reload when combat ends.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
}

const feat = (actor, re) => (actor?.itemTypes?.feat ?? []).find((f) => f.isActive !== false && re.test(f.name)) ?? null;
const namesOf = (item) => [item?.name ?? "", ...(item?.system?.baseTypes ?? [])].join(" ").toLowerCase();

// Reload step names, slowest first
const STEPS = ["full-round", "standard", "move", "swift", "free"];
const faster = (step, by = 1) => STEPS[Math.min(STEPS.length - 1, STEPS.indexOf(step) + by)];

/** A feat chosen for one kind of weapon ("Rapid Reload (Light Crossbow)") counts only for that kind. */
function featFor(actor, re, names) {
  const f = feat(actor, re);
  if (!f) return null;
  const choice = f.name.match(/\(([^)]+)\)/)?.[1]?.toLowerCase();
  return !choice || /mythic/.test(choice) || names.includes(choice) || choice.split(/\s+/).every((w) => names.includes(w)) ? f : null;
}

/**
 * How this weapon loads: { capacity, step, provokes, firearm, advanced } (step: the action to reload it fully,
 * after feats), or null for weapons that don't load (bows, thrown weapons).
 */
export function loading(actor, item) {
  if (item?.type !== "weapon" && item?.type !== "attack") return null;
  const n = namesOf(item);
  let capacity = 1, step, firearm = false, advanced = false;
  if (/crossbow/.test(n)) {
    capacity = /repeating/.test(n) ? 5 : /double crossbow/.test(n) ? 2 : 1;
    step = /heavy|repeating|crank/.test(n) ? "full-round" : "move";
    if (feat(actor, /^crossbow mastery/i)) step = "free";
    else {
      if (featFor(actor, /^rapid reload\b/i, n)) step = /heavy/.test(n) ? "move" : "free";
      if (feat(actor, /^crossbow training/i)) step = /heavy/.test(n) ? (step === "move" ? "free" : "move") : "free";
    }
  } else if (/sling/.test(n)) {
    capacity = /double/.test(n) ? 2 : 1;
    step = "move";
    if (feat(actor, /^(warslinger|juggle load)/i) || featFor(actor, /^rapid reload\b/i, n)) step = "free";
    else if (feat(actor, /^ammo drop/i)) step = "swift";
  } else if (/pistol|musket|rifle|revolver|pepperbox|blunderbuss|gun\b/.test(n)) {
    firearm = true;
    advanced = /revolver|^rifle|\brifle\b(?!.*pepperbox)|nagant|mosin|radium/.test(n) && !/pepperbox|cylinder/.test(n);
    capacity = /double-barreled|double barreled/.test(n) ? 2 : /pepperbox|revolver/.test(n) ? 6 : /cylinder/.test(n) ? 5 : 1;
    const twoHanded = /musket|rifle|blunderbuss/.test(n);
    step = advanced ? "move" : twoHanded ? "full-round" : "standard";
    if (featFor(actor, /^rapid reload\b/i, n)) step = advanced ? "free" : faster(step);
  } else return null;
  const quietReload = (step === "free" && !firearm) || feat(actor, /^(ammo drop|juggle load|slipslinger style)/i) && /sling/.test(n) || (/crossbow/.test(n) && feat(actor, /^crossbow mastery/i)) || (firearm && feat(actor, /^protective line/i));
  return { capacity, step, provokes: !quietReload, firearm, advanced };
}

export const loadedShots = (item, info) => item.getFlag(MODULE_ID, LOADED) ?? info.capacity;

/* -------------------------------------------- */
/*  Loaded weapons (opt-in)                     */
/* -------------------------------------------- */

// The action use's weapon, if it's one this tracks (and doesn't reload for free)
function trackedWeapon(use) {
  if (!tracking() || !RANGED_ATTACKS.includes(use.action?.actionType)) return null;
  const info = loading(use.actor, use.item);
  return info && info.step !== "free" ? info : null;
}

// Refuse to fire an empty weapon: returning false here stops PF1 before the card is posted and before any
// ammunition is used
Hooks.on("pf1PreActionUse", (use) => {
  const info = trackedWeapon(use);
  if (!info || loadedShots(use.item, info) > 0) return;
  ui.notifications.warn(`${use.item.name} isn't loaded: reload it first (${info.step} action).`);
  return false;
});

function registerWrappers() {
  // Full attacks: only the loaded shots
  wrapMethod("pf1.actionUse.ActionUse.prototype.alterRollData", async function (wrapped, ...args) {
    const result = await wrapped(...args);
    const info = trackedWeapon(this);
    if (!info || !this.shared.fullAttack || !this.shared.attacks?.length) return result;
    const max = Math.max(1, loadedShots(this.item, info));
    if (this.shared.attacks.length > max) {
      this.shared.attacks = this.shared.attacks.slice(0, max);
      ui.notifications.info(`Full attack limited: ${this.item.name} has ${max} loaded shot${max === 1 ? "" : "s"}.`);
    }
    return result;
  });
}

// Registered at init/setup. Loaded after init (the tests, before Foundry is restarted to load a new
// script), it does both at once: the quick-apply resistance setting is registered at init, so its presence
// shows init has passed.
if (game.ready || game.settings?.settings?.has(`${MODULE_ID}.quickApplyResistance`)) {
  registerSetting();
  registerWrappers();
} else {
  Hooks.once("init", registerSetting);
  Hooks.once("setup", registerWrappers);
}

// Shots fired use up the load
Hooks.on("pf1PostActionUse", (use) => {
  const info = trackedWeapon(use);
  if (!info || !use.item?.isOwner) return;
  const fired = use.shared.chatAttacks?.length ?? 1;
  use.item.setFlag(MODULE_ID, LOADED, Math.max(0, loadedShots(use.item, info) - fired));
});

/** Reload a weapon to capacity; the chat note names the action and whether it provokes. */
export async function reload(item) {
  const info = loading(item.actor, item);
  if (!info) return;
  await item.setFlag(MODULE_ID, LOADED, info.capacity);
  const threats = threatening(item.actor?.getActiveTokens()[0]);
  const warn = info.provokes && threats.length ? ` Reloading while threatened by ${threats.map((t) => t.name).join(", ")} provokes attacks of opportunity.` : "";
  await ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor: item.actor }),
    content: `<p>Reloads the <strong>${esc(item.name)}</strong> (${info.step} action${info.provokes ? ", provokes" : ""}).${esc(warn)}</p>`,
    flags: { [MODULE_ID]: { reloaded: item.uuid } },
  });
}

registerFootnote((item) => {
  if (!tracking() || !item?.actor?.isOwner) return null;
  const info = loading(item.actor, item);
  if (!info || info.step === "free") return null;
  const shots = loadedShots(item, info);
  return [`Loaded: ${shots}/${info.capacity}. `, footnoteButton(`Reload (${info.step} action${info.provokes ? ", provokes" : ""})`, "Loads the weapon to capacity", () => reload(item))];
});

// When combat ends, there's time to reload everything
Hooks.on("deleteCombat", (combat) => {
  if (!isActiveGM() || !tracking()) return;
  for (const c of combat.combatants) {
    for (const item of c.actor?.items ?? []) if (item.getFlag(MODULE_ID, LOADED) != null) item.unsetFlag(MODULE_ID, LOADED);
  }
});

/* -------------------------------------------- */
/*  Attacks of opportunity (always on)          */
/* -------------------------------------------- */

const UNABLE = ["helpless", "unconscious", "paralyzed", "stunned", "dead", "dying", "pinned", "petrified", "sleep", "cowering"];

/** Hostile creatures adjacent to this token that can act (and so threaten it). */
export function threatening(token) {
  if (!token) return [];
  const doc = token.document ?? token;
  return canvas.tokens.placeables.filter((t) => {
    if (t.id === doc.id || !t.actor || t.document.hidden) return false;
    if (t.document.disposition * doc.disposition !== -1) return false; // opposite sides only
    if (UNABLE.some((id) => t.actor.statuses?.has(id))) return false;
    const d = tokenDistance(token.object ?? token, t);
    return d != null && d <= 5;
  });
}

/** Does this ranged attack provoke (no ability says otherwise)? */
function shotProvokes(actor, action) {
  const n = namesOf(action.item);
  const thrown = action.actionType === "twak" && !/sling/.test(n);
  if (featFor(actor, /^point-blank master/i, n)) return false;
  if (/\bbow\b/.test(n) && !/crossbow/.test(n) && feat(actor, /^safe shot \(archer\)/i)) return false;
  if (/crossbow/.test(n) && feat(actor, /^safe shot \(crossbowman\)/i)) return false;
  if (thrown && featFor(actor, /^close-quarters thrower/i, n)) return false;
  if (/nimble shot/.test(n)) return false;
  if (/pistol|musket|rifle|revolver|pepperbox|blunderbuss/.test(n) && feat(actor, /^(deft shootist|art of the gun)/i)) return false;
  if (/crossbow|pistol|musket|rifle/.test(n) && feat(actor, /^sword and pistol/i)) return false;
  return true;
}

Hooks.on("pf1PreDisplayActionUse", (use) => {
  const action = use.action;
  if (!["rwak", "twak"].includes(action?.actionType) || !use.actor) return;
  const token = use.token?.object ?? use.token ?? use.actor.getActiveTokens()[0];
  const threats = threatening(token);
  if (!threats.length || !shotProvokes(use.actor, action)) return;
  use.shared.chatData[`flags.${MODULE_ID}.provokes`] = threats.map((t) => t.name);
});

Hooks.on("renderChatMessagePF", (message, html) => {
  const names = message.getFlag(MODULE_ID, "provokes");
  const content = html.querySelector(".card-content") ?? html.querySelector(".message-content");
  if (names?.length && content) {
    const div = document.createElement("div");
    div.className = `${MODULE_ID}-provokes`;
    div.style.cssText = "margin: 0.25em 0; padding: 0 4px; border-left: 3px solid #c90;";
    div.textContent = `Shooting while threatened by ${names.join(", ")}: provokes attacks of opportunity.`;
    content.prepend(div);
  }
  // An empty weapon after this attack: a Reload button for its owner
  const item = message.itemSource;
  const info = tracking() && item && loading(item.actor, item);
  if (!info || info.step === "free" || !item.isOwner || !content || message.type !== "action") return;
  if (loadedShots(item, info) > 0 || message.id !== game.messages.contents.findLast((m) => m.itemSource === item)?.id) return;
  const div = document.createElement("div");
  div.className = `${MODULE_ID}-reload`;
  div.append(`${item.name} is empty. `, footnoteButton(`Reload (${info.step} action${info.provokes ? ", provokes" : ""})`, "Loads the weapon to capacity", async () => (await reload(item), ui.chat.render?.())));
  content.append(div);
});

export const _test = { loading, threatening, shotProvokes, SETTING, LOADED };
