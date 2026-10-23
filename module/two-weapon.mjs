// Two-weapon fighting. PF1 has none: its TWF feats are text only and a full attack is always one
// weapon. Rules: Rules Text/Two-Weapon Fighting.txt.
//   - PF1's attack dialog gets a "Two-Weapon Fighting" checkbox and an off-hand weapon dropdown
//     (melee and thrown attacks), remembered per main weapon.
//   - On a full attack with it checked, main-hand attacks take the main-hand penalty; then the
//     off-hand weapon attacks automatically: 1 attack (+1 at −5 with Improved, +1 at −10 with
//     Greater) instead of BAB iteratives, the off-hand penalty, held off-hand (½ Str damage and ½
//     Power Attack), or full Str with Double Slice. Power Attack and flanking carry over.
//   - Penalties: −6/−10, light off-hand −4/−8, TWF feat −4/−4, both −2/−2. Light = light weapon,
//     light shield, unarmed strike, or heavy shield with Shield-Trained.
//   - Only the full-attack action is penalized, so attacks of opportunity are normal (FAQ).
//   - Two-Weapon Defense: +1 shield AC (+2 while fighting defensively/total defense) until the
//     start of your next turn. Two-Weapon Rend: a button on the off-hand card, once per round.
//   - Macros and tests can skip the dialog: item.use({ skipDialog: true, options: { twfOffhand: offHandItemId } }).

import { MODULE_ID } from "./const.mjs";
import { isBashShield, bashCountsAsLight } from "./shield-trained.mjs";
import { esc, norm, wrapMethod, addSearch } from "./util.mjs";

const FIELD_ON = `${MODULE_ID}-twf`;
const FIELD_OFF = `${MODULE_ID}-twf-offhand`;
const MARK = "pf1eRevampTwf"; // key on roll data / use options
const TWF_ACTIONS = ["mwak", "twak"];

const FEAT = "Compendium.pf1.feats.Item.";
const FEATS = {
  twf: { name: "Two-Weapon Fighting", source: `${FEAT}Ee7JHADKEK37tTHs` },
  improved: { name: "Improved Two-Weapon Fighting", source: `${FEAT}3fNdl7eIUJ5d5fwg` },
  greater: { name: "Greater Two-Weapon Fighting", source: `${FEAT}ieltigobtFrlTXIt` },
  doubleSlice: { name: "Double Slice", source: `${FEAT}VK8TgwfjeomMwGjd` },
  defense: { name: "Two-Weapon Defense", source: `${FEAT}YDqp3yrAsuXh103W` },
  rend: { name: "Two-Weapon Rend", source: `${FEAT}tGDNVHHZnNFPPgiY` },
};
const DEFENSIVE_BUFFS = ["Compendium.pf1.buffs.Item.V8cRFtOQA6ltklEl", "Compendium.pf1.buffs.Item.DvcRWaWndZ1s2tB4"]; // Fighting Defensively, Total Defense

function hasFeat(actor, key) {
  const { name, source } = FEATS[key];
  return !!actor?.itemTypes.feat.some((f) => f.isActive && (f._stats?.compendiumSource === source || norm(f.name) === norm(name)));
}

/* -------------------------------------------- */
/*  Weapons and penalties                       */
/* -------------------------------------------- */

function attackAction(item) {
  return item.actions?.find((a) => TWF_ACTIONS.includes(a.actionType)) ?? null;
}

function isLight(item, actor) {
  if (/unarmed/i.test(item.name)) return true;
  if (item.type === "weapon") return item.system.weaponSubtype === "light";
  if (item.type === "attack") return item.system.weapon?.type === "light";
  if (isBashShield(item)) return bashCountsAsLight(item, actor);
  return false;
}

/** Candidate off-hand weapons: weapons, weapon attacks and bash-able shields with a melee or thrown attack. */
function offhandCandidates(actor, mainItem) {
  return actor.items
    .filter((i) => i !== mainItem && attackAction(i))
    .filter((i) => i.type === "weapon" || (i.type === "attack" && i.subType !== "natural") || isBashShield(i))
    .map((i) => ({ item: i, light: isLight(i, actor) }));
}

/** [main-hand, off-hand] penalties per the Two-Weapon Fighting Penalties table. */
function penalties(actor, offLight) {
  let main = -6, off = -10;
  if (offLight) { main += 2; off += 2; }
  if (hasFeat(actor, "twf")) { main += 2; off += 6; }
  return [main, off];
}

function describe(actor, offLight) {
  const [main, off] = penalties(actor, offLight);
  const why = [offLight ? "light off-hand" : null, hasFeat(actor, "twf") ? "Two-Weapon Fighting" : null].filter(Boolean).join(", ");
  return `Main hand ${main} / off-hand ${off}${why ? ` (${why})` : ""}`;
}

/* -------------------------------------------- */
/*  Attack dialog controls                      */
/* -------------------------------------------- */

Hooks.on("renderAttackDialog", (app, html) => {
  const root = html[0] ?? html;
  const action = app.action;
  const item = action?.item;
  const actor = item?.actor;
  if (!actor || !TWF_ACTIONS.includes(action.actionType) || item.subType === "natural") return;
  const candidates = offhandCandidates(actor, item);
  if (!candidates.length) return;

  const flags = root.querySelector(".form-group.flags");
  if (!flags || root.querySelector(`[name="${FIELD_ON}"]`)) return;

  app._pf1eRevampTwf ??= {
    on: false,
    off: actor.getFlag(MODULE_ID, `twfOffhand.${item.id}`) ?? candidates[0].item.id,
  };
  const state = app._pf1eRevampTwf;
  if (!candidates.some((c) => c.item.id === state.off)) state.off = candidates[0].item.id;

  const wrap = document.createElement("div");
  wrap.className = `${MODULE_ID}-twf`;
  wrap.style.cssText = "flex: 0 0 100%; margin-top: 0.25em;";
  wrap.innerHTML = `
    <label class="checkbox"><input type="checkbox" name="${FIELD_ON}" ${state.on ? "checked" : ""}> Two-Weapon Fighting</label>
    <select name="${FIELD_OFF}" style="width: 100%; margin-top: 2px;">
      ${candidates.map((c) => `<option value="${c.item.id}" ${c.item.id === state.off ? "selected" : ""}>Off-hand: ${esc(c.item.name)}${c.light ? " (light)" : ""}</option>`).join("")}
    </select>
    <p class="hint" style="margin: 2px 0 0 0; font-size: 11px;"></p>`;
  flags.append(wrap);

  const checkbox = wrap.querySelector("input");
  const select = addSearch(wrap.querySelector("select"));
  const hint = wrap.querySelector(".hint");
  const update = () => {
    state.on = checkbox.checked;
    state.off = select.value;
    const pick = candidates.find((c) => c.item.id === state.off);
    select.disabled = !state.on;
    hint.textContent = state.on ? `${describe(actor, pick?.light)}. Full attack only; the off-hand attacks follow automatically.` : "";
  };
  checkbox.addEventListener("change", update);
  select.addEventListener("change", update);
  update();
  app.setPosition?.({ height: "auto" });
});

/* -------------------------------------------- */
/*  Action use wrappers                         */
/* -------------------------------------------- */

Hooks.once("setup", () => {
  const register = wrapMethod;

  // Mark the action use as main- or off-hand once the dialog choices are known
  register("pf1.actionUse.ActionUse.prototype.alterRollData", function (wrapped, formData = {}) {
    const offUse = this.shared.useOptions?.[MARK];
    if (offUse?.role === "off") formData.held = "oh"; // ½ Str damage and ½ Power Attack
    const result = wrapped(formData);

    const actor = this.actor;
    if (offUse?.role === "off") {
      this.shared.rollData[MARK] = { role: "off", penalty: offUse.penalty };
    } else if (actor && this.shared.fullAttack && ((formData[FIELD_ON] && formData[FIELD_OFF]) || this.shared.useOptions?.twfOffhand)) {
      const offItem = actor.items.get(formData[FIELD_ON] ? formData[FIELD_OFF] : this.shared.useOptions.twfOffhand);
      if (offItem) {
        const [main, off] = penalties(actor, isLight(offItem, actor));
        this.shared.rollData[MARK] = {
          role: "main",
          penalty: main,
          offId: offItem.id,
          offPenalty: off,
          carry: { powerAttack: !!formData["power-attack"], flanking: !!formData.flanking, highGround: !!formData.highGround },
        };
      }
    }
    return result;
  });

  // Off-hand full attack: 1 attack, +1 at −5 (Improved), +1 at −10 (Greater), instead of BAB iteratives
  register("pf1.actionUse.ActionUse.prototype.generateAttacks", function (wrapped, ...args) {
    const attacks = wrapped(...args);
    if (this.shared.useOptions?.[MARK]?.role !== "off" || !attacks?.length) return attacks;
    const actor = this.actor;
    const Attack = attacks[0].constructor;
    const bonuses = ["0", hasFeat(actor, "improved") ? "-5" : null, hasFeat(actor, "greater") ? "-10" : null].filter(Boolean);
    const offAttacks = bonuses.map((bonus, i) => {
      const atk = new Attack(`Off-hand${i ? ` ${i + 1}` : ""}`, bonus === "0" ? "0" : `${bonus}[Off-hand iterative]`);
      atk.ammo = attacks[0].ammo;
      return atk;
    });
    this.shared.attacks = offAttacks;
    return offAttacks;
  });
});

/* -------------------------------------------- */
/*  Roll adjustments                            */
/* -------------------------------------------- */

Hooks.on("pf1PreAttackRoll", (action, config, rollData, rollOptions, parts) => {
  const twf = rollData[MARK];
  if (twf?.penalty) parts.push(`${twf.penalty}[Two-Weapon Fighting]`);
});

// Double Slice: full Strength on off-hand damage (the off-hand held setting applies only half)
Hooks.on("pf1PreDamageRoll", (action, rollData, parts) => {
  if (rollData[MARK]?.role !== "off" || !parts[0] || !hasFeat(action.actor, "doubleSlice")) return;
  const str = rollData.abilities?.str?.mod ?? 0;
  const extra = str - Math.floor(str * 0.5);
  if (str > 0 && extra > 0) parts[0].extra.push(`${extra}[Double Slice]`);
});

/* -------------------------------------------- */
/*  After the main hand: off-hand, defense      */
/* -------------------------------------------- */

Hooks.on("pf1PostActionUse", async (actionUse) => {
  const twf = actionUse.shared?.rollData?.[MARK];
  const actor = actionUse.actor;
  if (twf?.role !== "main" || !actor) return;

  await actor.setFlag(MODULE_ID, `twfOffhand.${actionUse.item.id}`, twf.offId);
  if (hasFeat(actor, "defense")) await applyDefense(actor);

  const offItem = actor.items.get(twf.offId);
  const offAction = offItem && attackAction(offItem);
  if (!offAction) return ui.notifications.warn("Two-Weapon Fighting: the off-hand weapon has no melee or thrown attack.");
  await offItem.use({
    actionId: offAction.id,
    skipDialog: true,
    token: actionUse.token,
    options: { ...twf.carry, [MARK]: { role: "off", penalty: twf.offPenalty } },
  });
});

/** Two-Weapon Defense: +1 shield bonus to AC (+2 fighting defensively / total defense) until your next turn. */
async function applyDefense(actor) {
  const defensive = actor.itemTypes.buff.some(
    (b) => b.isActive && (DEFENSIVE_BUFFS.includes(b._stats?.compendiumSource) || /^(Fighting Defensively|Total Defense)$/i.test(b.name))
  );
  const value = defensive ? 2 : 1;
  const data = {
    name: "Two-Weapon Defense",
    type: "buff",
    img: "icons/skills/melee/weapons-crossed-swords-yellow.webp",
    system: {
      subType: "feat",
      active: true,
      changes: [{ target: "sac", type: "base", formula: String(value) }],
      duration: { value: "1", units: "round", end: "turnStart" },
      description: { value: `<p>+${value} shield bonus to AC from Two-Weapon Defense while two-weapon fighting (until the start of your next turn).</p>` },
    },
    flags: { [MODULE_ID]: { twfDefense: true } },
  };
  const existing = actor.itemTypes.buff.find((b) => b.getFlag(MODULE_ID, "twfDefense"));
  if (existing) await existing.update({ "system.active": true, "system.changes": data.system.changes, "system.description": data.system.description });
  else await actor.createEmbeddedDocuments("Item", [data]);
}

/* -------------------------------------------- */
/*  Two-Weapon Rend                             */
/* -------------------------------------------- */

// Off-hand cards of a rend-capable character get a Rend button. The card is created right after
// pf1PreActionUse, so remember the actor there and tag its next action card.
const rendPending = new Set();

Hooks.on("pf1PreActionUse", (actionUse) => {
  if (actionUse.shared?.rollData?.[MARK]?.role === "off" && hasFeat(actionUse.actor, "rend")) rendPending.add(actionUse.actor.uuid);
});

Hooks.on("preCreateChatMessage", (message) => {
  if (message.type !== "action") return;
  const actor = ChatMessage.implementation.getSpeakerActor(message.speaker);
  if (!actor || !rendPending.delete(actor.uuid)) return;
  message.updateSource({ [`flags.${MODULE_ID}.twfRend`]: true });
});

Hooks.on("renderChatMessagePF", (message, html) => {
  if (!message.getFlag(MODULE_ID, "twfRend")) return;
  const card = html.querySelector(".card-content") ?? html.querySelector(".message-content");
  if (!card || card.querySelector(`.${MODULE_ID}-rend`)) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `${MODULE_ID}-rend`;
  button.textContent = "Two-Weapon Rend (both hands hit)";
  button.style.cssText = "margin: 0.25em 0; width: 100%;";
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    const actor = ChatMessage.implementation.getSpeakerActor(message.speaker);
    if (!actor?.isOwner) return;
    const round = game.combat ? `${game.combat.id}:${game.combat.round}` : null;
    if (round && actor.getFlag(MODULE_ID, "rendRound") === round) {
      return ui.notifications.warn("Two-Weapon Rend can only deal its extra damage once each round.");
    }
    const str = actor.system.abilities?.str?.mod ?? 0;
    const roll = await new Roll(`1d10 + ${Math.floor(str * 1.5)}`).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.implementation.getSpeaker({ actor }),
      flavor: "Two-Weapon Rend: extra damage (1d10 + 1½× Str), once per round",
    });
    if (round) await actor.setFlag(MODULE_ID, "rendRound", round);
  });
  card.append(button);
});
