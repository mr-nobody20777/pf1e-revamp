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
//   - Smoke (burning entanglement): "Creatures can see things in the smoke within 5 feet clearly, but attacks
//     against anything farther away in the smoke must contend with concealment (20% miss chance)".
//   - Concealment (flashfire's smoke): "providing concealment within" (20%, near or far).
//   - Fog cloud (obscuring mist, solid fog, stinking cloud, cloudkill): "A creature within 5 feet has
//     concealment (attacks have a 20% miss chance). Creatures farther away have total concealment (50% miss
//     chance". Fog between the two counts as well as fog around either.
//   - Acid fog: "like the solid fog spell ... Each round on your turn, starting when you cast the spell, the fog
//     deals 2d6 points of acid damage to each creature and object within it."
//   - Incendiary cloud: "The smoke obscures all sight as a fog cloud does ... deal 6d6 points of fire damage to
//     everything within the cloud on your turn each round. All targets can make Reflex saves each round to take
//     half damage. As with a cloudkill spell, the smoke moves away from you at 10 feet per round."
//   - Spike stones: as spike growth, "1d8 points of piercing damage for each 5 feet of movement".
//   - Ice storm, volcanic storm: the damage "only occurs once, when the spell is cast" (PF1's card); then
//     "Creatures inside this area take a -4 penalty on Perception skill checks and the entire area is treated
//     as difficult terrain."
//   - Web cloud: "billows and flows much like a cloudkill spell ... Creatures trapped in the webbing remain
//     trapped even after the cloud passes ... The cloud otherwise acts like a web spell. A creature in the cloud
//     at the start of its turn must save against the cloud or be affected."
//   - Plague storm: "Creatures in the area must save or contract one of the following diseases ... Unlike a fog
//     cloud, the plague storm moves away from you at 10 feet per round" (the casting's rows are spells.mjs's;
//     a creature the cloud reaches later saves once).
//   - Drift (cloudkill, incendiary cloud, web cloud, plague storm): "Figure out the cloud's new spread each round
//     based on its new point of origin, which is 10 feet farther away from the point of origin where you cast
//     the spell." On the caster's turn, before the cloud acts, its center moves 10 feet along the line from where
//     the caster stood at the casting through the cloud's center; a wall in the way stops it there (the spread
//     still flows around corners: area-reach.mjs). A cloud cast on the caster's own square has no direction until
//     the GM drags it once. Rulings: DECISIONS.md, "Drifting clouds".
//   - Wall of fire: "One side of the wall, selected by you, sends forth waves of heat, dealing 2d4 points of fire
//     damage to creatures within 10 feet and 1d4 points of fire damage to those past 10 feet but within 20 feet.
//     The wall deals this damage when it appears, and to all creatures in the area on your turn each round. In
//     addition, the wall deals 2d6 points of fire damage + 1 point of fire damage per caster level (maximum +20)
//     to any creature passing through it. The wall deals double damage to undead creatures. If you evoke the wall
//     so that it appears where creatures are, each creature takes damage as if passing through the wall."
//   - Blade barrier: "Any creature passing through the wall takes 1d6 points of damage per caster level (maximum
//     15d6), with a Reflex save for half damage. If you evoke the barrier so that it appears where creatures
//     are, each creature takes damage as if passing through the wall. Each such creature can avoid the wall
//     (ending up on the side of its choice) and thus take no damage by making a successful Reflex save."
//   Walls are a line template (a ring when the GM makes it a circle). A creature passes through when its move
//   crosses the line, or ends in the wall's own squares (within half a square of it); leaving the wall's squares
//   isn't another crossing. The hot side of a wall of fire is the side away from the caster unless the GM
//   switches it (a button on its card).
//   - Flaming sphere: "It moves 30 feet per round ... If it enters a space with a creature, it stops moving for the
//     round and deals 3d6 points of fire damage to that creature, though a successful Reflex save negates that
//     damage." A small template the GM (or caster) drags; it strikes a creature when it's moved into its space
//     (the template's center inside the creature's squares), not when a creature walks into it.
// Rulings (2026-11-17): the template is removed when the spell ends, with a note to the GM; entering creatures'
// saves and checks are rolled automatically, with an Undo; (phase 2, movement through an area: the straight
// line from where the move started to where it ended).

import { MODULE_ID } from "./const.mjs";
import { esc, isActiveGM, saveResult, rollTotal, timed, dealDamage, restoreDamage, activeBuff, gmWhisper, turnActors } from "./util.mjs";
import { baseSpellName, metamagicOf, extendFactor, metamagicFormula } from "./metamagic.mjs";
import { creatureTypes, isLiving } from "./creature-types.mjs";
import { registerMissSource } from "./miss-chance.mjs";
import { reaches } from "./area-reach.mjs";
import { setBurning } from "./burning.mjs";
import { setBleed } from "./bleed.mjs";
import { contractFromSpell } from "./spells.mjs";
import { SPELLS as SPELL_DATA } from "./spell-data.mjs";

const FLAG = "lastingArea"; // template flag: the area's state (below)
const LINK = "lastingAreaLink"; // buff flag: the template's uuid
const CARD = "lastingAreaCard"; // chat message flag: { undo: [{ actor, conditions, damage, con }] }
const UNIT_SECONDS = { round: 6, minute: 60, hour: 3600 };
const living = (actor) => isLiving(actor);
const poisonImmune = (actor) => !living(actor) || (actor.system.traits?.ci?.total ?? new Set()).has?.("poison");
const hdOf = (actor) => actor.system.attributes?.hd?.total ?? 0;
const SAVE = { fort: "Fortitude", ref: "Reflex", will: "Will" };

/* -------------------------------------------- */
/*  The spells                                  */
/* -------------------------------------------- */

// Each: when it acts. enter(ctx) for creatures inside at the casting and those entering; casterTurnStart /
// casterTurnEnd for each creature inside; leave and end for each creature leaving or still inside at the end.
// ctx: { zone, actor, token, save(type), note(text), hold(conditions), release(conditions, duration) }
// lingers: { condition: rounds formula | null }: held conditions that outlast the area (null: until ended otherwise),
// applied when the template is deleted by hand (leaving the area does it in the spell's leave handler)
const SPELLS = {
  // Thorny Entanglement "functions as entangle" (its thorn volleys are rolled by hand)
  entangle: {
    names: ["entangle", "thorny entanglement"],
    enter: async (c) => c.saveOrHold("ref", ["entangled"]),
    casterTurnEnd: async (c) => (c.holds("entangled") ? null : c.saveOrHold("ref", ["entangled"])),
    leave: async (c) => c.release(["entangled"]),
  },
  // Impossible Angles: "Any creature entering the area must succeed at a Will save or become disoriented. Disoriented
  // characters treat the area as difficult terrain and are sickened ... An affected creature can attempt a new Will save
  // each round to end the disoriented effect. A creature that leaves the area and re-enters must attempt the saving
  // throw again" (the random direction of its first 5 feet each round: by hand)
  impossibleAngles: {
    names: ["impossible angles"],
    enter: async (c) => c.saveOrHold("will", ["sickened"]),
    ownTurnStart: async (c) => (c.holds("sickened") && (await c.save("will")) ? c.release(["sickened"]) : null),
    leave: async (c) => c.release(["sickened"]),
  },
  // Thirsting Entanglement: "functions as entangle, except ... Any creature that fails a save to avoid becoming
  // entangled or fails a check to break free takes 1d2 points of Constitution damage" (the checks to break free: by hand)
  thirstingEntanglement: {
    names: ["thirsting entanglement"],
    enter: async (c) => c.thirst(),
    casterTurnEnd: async (c) => (c.holds("entangled") ? null : c.thirst()),
    leave: async (c) => c.release(["entangled"]),
  },
  // Sickening Entanglement: "functions as entangle, except ... Any creature that enters the area or ends its turn
  // there must succeed at a Fortitude save or be sickened as long as it remains in the area and for 1d4 rounds
  // afterward. This is a poison effect."
  sickeningEntanglement: {
    names: ["sickening entanglement"],
    lingers: { sickened: "1d4" },
    enter: async (c) => {
      await c.saveOrHold("ref", ["entangled"]);
      if (poisonImmune(c.actor)) c.note("immune to poison");
      else await c.saveOrHold("fort", ["sickened"]);
    },
    casterTurnEnd: async (c) => (c.holds("entangled") ? null : c.saveOrHold("ref", ["entangled"])),
    ownTurnEnd: async (c) => (poisonImmune(c.actor) || c.holds("sickened") ? null : c.saveOrHold("fort", ["sickened"])),
    leave: async (c) => {
      await c.release(["entangled"]);
      await c.release(["sickened"], "1d4");
    },
  },
  // Burning Entanglement: "functions as per entangle, except it sets the foliage on fire. A creature that begins its
  // turn entangled by the spell takes 4d6 points of fire damage (Reflex half), and a creature that begins its turn in
  // the area but is not entangled takes 2d6 points of fire damage (Reflex negates). Smoke ... Creatures can see things
  // in the smoke within 5 feet clearly, but attacks against anything farther away in the smoke must contend with
  // concealment (20% miss chance)"
  burningEntanglement: {
    names: ["burning entanglement"],
    fog: "smoke",
    enter: async (c) => c.saveOrHold("ref", ["entangled"]),
    casterTurnEnd: async (c) => (c.holds("entangled") ? null : c.saveOrHold("ref", ["entangled"])),
    ownTurnStart: async (c) => {
      if (c.holds("entangled")) await c.damage("4d6", "fire", { half: "ref" });
      else if (!(await c.save("ref"))) await c.damage("2d6", "fire");
    },
    leave: async (c) => c.release(["entangled"]),
  },
  // Flashfire: "These flames deal 1d6 points of fire damage for every 3 caster levels you have (maximum 5d6) to each
  // creature that enters a burning area or begins its turn in the area; these creatures also catch on fire. A creature
  // that succeeds at a Reflex save negates the damage and avoids catching on fire. The area ... smoky, providing
  // concealment within"
  flashfire: {
    names: ["flashfire"],
    fog: "concealment",
    enter: async (c) => c.flashfire(),
    ownTurnStart: async (c) => c.flashfire(),
  },
  stinkingCloud: {
    names: ["stinking cloud"],
    fog: "fog",
    lingers: { nauseated: "1d4+1" },
    enter: async (c) => (!living(c.actor) ? c.note("not living: unaffected") : poisonImmune(c.actor) ? c.note("immune to poison") : c.saveOrHold("fort", ["nauseated"])),
    casterTurnStart: async (c) => (!living(c.actor) || poisonImmune(c.actor) || c.holds("nauseated") ? null : c.saveOrHold("fort", ["nauseated"])),
    leave: async (c) => c.release(["nauseated"], "1d4+1"),
  },
  // Drunkard's Breath "functions like Stinking Cloud" but "is barely visible and does not obscure vision"
  drunkardsBreath: {
    names: ["drunkard's breath"],
    lingers: { nauseated: "1d4+1" },
    enter: async (c) => (!living(c.actor) ? c.note("not living: unaffected") : poisonImmune(c.actor) ? c.note("immune to poison") : c.saveOrHold("fort", ["nauseated"])),
    casterTurnStart: async (c) => (!living(c.actor) || poisonImmune(c.actor) || c.holds("nauseated") ? null : c.saveOrHold("fort", ["nauseated"])),
    leave: async (c) => c.release(["nauseated"], "1d4+1"),
  },
  // Euphoric Cloud: "a bank of fog similar to that created by fog cloud except its vapors are intoxicating. Living
  // creatures in the cloud become fascinated. This condition lasts as long as a creature is in the cloud and for 1d4+1
  // rounds after it leaves. Any creature that succeeds at its save but remains in the cloud must continue to save"
  euphoricCloud: {
    names: ["euphoric cloud"],
    fog: "fog",
    lingers: { fascinated: "1d4+1" },
    enter: async (c) => (!living(c.actor) ? c.note("not living: unaffected") : c.saveOrHold("fort", ["fascinated"])),
    casterTurnStart: async (c) => (!living(c.actor) || c.holds("fascinated") ? null : c.saveOrHold("fort", ["fascinated"])),
    leave: async (c) => c.release(["fascinated"], "1d4+1"),
  },
  // Cloud of Seasickness: "functions like stinking cloud ... the vapors make creatures sickened instead of nauseated"
  cloudOfSeasickness: {
    names: ["cloud of seasickness"],
    fog: "fog",
    lingers: { sickened: "1d4+1" },
    enter: async (c) => (!living(c.actor) ? c.note("not living: unaffected") : poisonImmune(c.actor) ? c.note("immune to poison") : c.saveOrHold("fort", ["sickened"])),
    casterTurnStart: async (c) => (!living(c.actor) || poisonImmune(c.actor) || c.holds("sickened") ? null : c.saveOrHold("fort", ["sickened"])),
    leave: async (c) => c.release(["sickened"], "1d4+1"),
  },
  cloudkill: {
    names: ["cloudkill"],
    fog: "fog",
    drift: true,
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
  // Poisonous Cloud [poison]: "a bank of fog like that created by fog cloud, except that the vapors are toxic. The cloud
  // deals 1d2 points of Constitution damage per round to living creatures that fail their Fortitude saves. A creature
  // that succeeds at its save but remains in the cloud must continue to attempt a new saving throw each round on your turn"
  poisonousCloud: {
    names: ["poisonous cloud"],
    fog: "fog",
    enter: async (c) => c.poisonousCloud(),
    casterTurnStart: async (c) => c.poisonousCloud(),
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
  // Greater Grease "functions like Grease" over more squares
  grease: {
    names: ["grease", "grease, greater"],
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
  // Sawtooth Terrain: "Any creature in the area when the spell is first cast must attempt a Reflex save to avoid taking
  // 3d8 points of piercing damage from the blades and an additional 2d6 points of bleed damage. A creature that fails the
  // save also has its speed reduced by half for 24 hours or until the injured creature benefits from a 'cure' spell ...
  // any creature that moves into or through the area takes 1d8 points of piercing damage"
  sawtoothTerrain: {
    names: ["sawtooth terrain"],
    enter: async (c) => (c.atCasting ? c.sawtooth() : c.damage("1d8", "piercing")),
  },
  createPit: {
    names: ["create pit"],
    enter: async (c) => (c.atCasting ? c.saveOrPit(0) : c.pit("walked into the pit")),
    adjacentTurnEnd: async (c) => c.saveOrPit(2),
  },
  acidFog: {
    names: ["acid fog"],
    fog: "fog",
    buff: { changes: [{ formula: "-2", target: "mattack", type: "untyped" }, { formula: "-2", target: "mdamage", type: "untyped" }], note: "half speed; no 5-foot step; ranged weapon attacks don't work (rays do)" },
    enter: async (c) => (c.atCasting ? c.damage("2d6", "acid") : null),
    casterTurnStart: async (c) => c.damage("2d6", "acid"),
  },
  incendiaryCloud: {
    names: ["incendiary cloud"],
    fog: "fog",
    drift: true,
    reminder: "it can move up to 60 feet a round while the caster concentrates (drag it); the part beyond the caster's range dissipates; wind disperses it",
    enter: async (c) => (c.atCasting ? c.damage("6d6", "fire", { half: "ref" }) : null),
    casterTurnStart: async (c) => c.damage("6d6", "fire", { half: "ref" }),
  },
  spikeStones: {
    names: ["spike stones"],
    enter: async (c) => (c.atCasting ? null : c.spikes(8, "Spike Stones")),
    moved: async (c) => c.spikes(8, "Spike Stones"),
  },
  iceStorm: {
    // Gravel Vortex: "This damage is dealt only once ... Creatures other than stone giants inside this area take a -4
    // penalty on Perception skill checks, and the entire area is treated as difficult terrain"
    names: ["ice storm", "volcanic storm", "gravel vortex"],
    buff: { changes: [{ formula: "-4", target: "skill.per", type: "untyped" }], note: "difficult terrain (heavy snow, sleet or ash)" },
  },
  webCloud: {
    names: ["web cloud"],
    // "Creatures trapped in the webbing remain trapped even after the cloud passes"
    lingers: { grappled: null },
    drift: true,
    // Rolled over by the cloud (or there at the casting): a Reflex save; walking in: as web
    enter: async (c) => (c.atCasting || c.drifted ? c.saveOrHold("ref", ["grappled"]) : c.webMove()),
    ownTurnStart: async (c) => (c.holds("grappled") ? null : c.saveOrHold("ref", ["grappled"])),
    // "Creatures trapped in the webbing remain trapped even after the cloud passes": no leave
  },
  plagueStorm: {
    names: ["plague storm"],
    drift: true,
    rows: true, // the casting's saves and diseases are the spell card's rows
    enter: async (c) => (c.atCasting || c.marked("exposed") ? null : c.plague()),
  },
  wallOfFire: {
    names: ["wall of fire"],
    wall: true,
    // Passing through: 2d6 + caster level (max +20), double for undead
    cross: async (c) => c.damage(`2d6 + ${Math.min(20, c.zone.cl)}`, "fire", { undeadDouble: true }),
    // Within 10 feet of the hot side 2d4, within 20 feet 1d4 (when it appears and on the caster's turn)
    heat: async (c) => c.damage(c.feet <= 10 ? "2d4" : "1d4", "fire", { undeadDouble: true }),
  },
  bladeBarrier: {
    names: ["blade barrier"],
    wall: true,
    // Caught where it appears: a Reflex save avoids it entirely; otherwise as passing through, unhalved
    appear: async (c) => ((await c.save("ref")) ? c.note("avoids the wall (ends on the side of its choice)") : c.damage(`${Math.min(15, c.zone.cl)}d6`, null)),
    cross: async (c) => c.damage(`${Math.min(15, c.zone.cl)}d6`, null, { half: "ref" }),
    reminder: "cover through it (+4 AC, +2 on Reflex saves) against attacks made through the wall",
  },
  // Wall of Clockwork: "Any creature passing through the wall takes 1d6 points of piercing and slashing damage per 2
  // caster levels (maximum 10d6); a successful Reflex save halves the damage. The wall cannot be conjured so that it
  // occupies the same space as a creature ... provides cover (+4 bonus to AC, +2 bonus on Reflex saves)"
  wallOfClockwork: {
    names: ["wall of clockwork"],
    wall: true,
    appear: async (c) => c.note("the wall can't appear in a creature's space: place it again"),
    cross: async (c) => c.damage(`${Math.min(10, Math.max(1, Math.floor(c.zone.cl / 2)))}d6`, null, { half: "ref" }),
    reminder: "cover through it (+4 AC, +2 on Reflex saves) against attacks made through the wall",
  },
  flamingSphere: {
    names: ["flaming sphere"],
    sphere: true,
    strikes: "Reflex negates 3d6 fire",
    strike: async (c) => ((await c.save("ref")) ? null : c.damage("3d6", "fire")),
    reminder: "it stops for the round when it strikes a creature; moving it is the caster's move action (30 feet); it sheds light as a torch",
  },
  // Flaming Sphere, Greater: "deals 6d6 points of fire damage to any creature it strikes. Any creature that fails its
  // save against the sphere catches on fire ... the DC to extinguish the flames is equal to the DC of this spell"
  flamingSphereGreater: {
    names: ["flaming sphere, greater"],
    sphere: true,
    strikes: "Reflex negates 6d6 fire and catching fire",
    strike: async (c) => {
      if (await c.save("ref")) return;
      await c.damage("6d6", "fire");
      await setBurning(c.actor, { formula: "1d6", dc: c.zone.dc, source: c.zone.name });
      c.note("catches fire");
    },
    reminder: "it stops for the round when it strikes a creature; moving it is the caster's move action (30 feet); it sheds light as a torch",
  },
  // Aggressive Thundercloud: "If it enters a space that contains a creature, the storm stops moving for the round and
  // deals 3d6 points of electricity damage to that creature, though a successful Reflex save negates that damage. It
  // provides concealment (20% miss chance) to anything within it". Greater: "6d6 ... The first creature damaged by the
  // cloud is also stunned for 1 round (Fortitude negates)"
  aggressiveThundercloud: {
    names: ["aggressive thundercloud"],
    sphere: true,
    strikes: "Reflex negates 3d6 electricity",
    fog: "concealment",
    strike: async (c) => ((await c.save("ref")) ? null : c.damage("3d6", "electric")),
    reminder: "it stops for the round when it strikes a creature; moving it is the caster's move action (fly 20 feet, perfect); winds move it as a Small creature",
  },
  aggressiveThundercloudGreater: {
    names: ["aggressive thundercloud, greater"],
    sphere: true,
    strikes: "Reflex negates 6d6 electricity",
    fog: "concealment",
    strike: async (c) => ((await c.save("ref")) ? null : c.damage("6d6", "electric")),
    reminder: "the first creature it damages is also stunned for 1 round (Fortitude negates); it stops for the round when it strikes a creature; moving it is the caster's move action (fly 20 feet, perfect)",
  },
  fogCloud: { names: ["fog cloud"], fog: "fog" },
  obscuringMist: { names: ["obscuring mist"], fog: "fog" },
  // Barrow Haze: "a bank of fog similar to that created by fog cloud ... The vapors do not interfere with your vision"
  barrowHaze: { names: ["barrow haze"], fog: "fog", casterSees: true },
  // Virulent Miasma: "creates fog like fog cloud ... Living creatures take a -4 penalty on saving throws against disease
  // effects as long as they remain within the cloud and for 1d4+1 rounds after leaving ... a Fortitude save to negate"
  virulentMiasma: {
    names: ["virulent miasma"],
    fog: "fog",
    enter: async (c) => (!living(c.actor) ? c.note("not living: unaffected") : (await c.save("fort")) ? null : c.note("-4 on saves against disease while inside, and 1d4+1 rounds after")),
  },
  // Hungry Darkness: "as deeper darkness ... Any creatures beginning its turn within the hungry darkness is gnawed ...
  // dealing 3d6 points of force damage and 2 points of Constitution damage per round. Once a creature leaves the cloud,
  // it continues to take 1d6 points of bleed damage each round until it receives magical healing or enters an area of
  // bright light" (the darkness itself: Foundry's light by hand)
  hungryDarkness: {
    names: ["hungry darkness"],
    ownTurnStart: async (c) => {
      await c.damage("3d6", "force");
      await c.con(2);
    },
    leave: async (c) => c.note("bleeds 1d6 each round until it receives magical healing or enters bright light"),
  },
  // Twilight Haze: "a gray haze that obscures sight (as fog cloud)"; an illusion, so wind doesn't move it
  twilightHaze: { names: ["twilight haze"], fog: "fog" },
  // Winter Grasp: "A creature that begins its turn in the affected area takes 1d6 points of cold damage and takes a
  // -2 penalty on saving throws against" cold; the ice (2 squares of movement, Acrobatics DC +5) is the GM's
  winterGrasp: {
    names: ["winter grasp"],
    ownTurnStart: async (c) => c.damage("1d6", "cold"),
  },
  solidFog: {
    names: ["solid fog"],
    fog: "fog",
    buff: { changes: [{ formula: "-2", target: "mattack", type: "untyped" }, { formula: "-2", target: "mdamage", type: "untyped" }], note: "half speed; no 5-foot step; ranged weapon attacks don't work (rays do)" },
  },
  // Condensed Ether: "move at only half their normal speed and can't take 5-foot steps. This slowing of movement doesn't
  // stack with solid fog ... a -2 penalty to Armor Class and on Reflex saves, and condensed ether prevents effective
  // ranged weapon attacks. Even magic rays ... suffer a 20% miss chance ... not based on concealment"
  condensedEther: {
    names: ["condensed ether"],
    buff: { changes: [{ formula: "-2", target: "ac", type: "untyped" }, { formula: "-2", target: "ref", type: "untyped" }], note: "half speed (even incorporeal); no 5-foot step; ranged weapon attacks don't work; rays 20% miss chance (not concealment)" },
  },
  silence: {
    names: ["silence"],
    buff: { changes: [], note: "no sound: spells with verbal components can't be cast" },
  },
};
const BY_NAME = new Map(Object.entries(SPELLS).flatMap(([key, s]) => s.names.map((n) => [n, key])));
/** The lasting-area spells (their spell rows are left to this engine, unless the spell keeps them). */
export const LASTING_SPELLS = new Set([...BY_NAME].filter(([, key]) => !SPELLS[key].rows).map(([name]) => name));

/* -------------------------------------------- */
/*  Who is inside                               */
/* -------------------------------------------- */

/**
 * Is the token's center inside the template, and does the area reach it past the walls (area-reach.mjs)?
 * Circles and rectangles by their numbers; other shapes by the canvas.
 */
export function insideTemplate(template, token) {
  const size = template.parent.grid.size;
  // A flaming sphere is in a creature's space: its center within the creature's squares
  if (SPELLS[zoneOf(template)?.key]?.sphere) return template.x >= token.x - 1 && template.x <= token.x + token.width * size + 1 && template.y >= token.y - 1 && template.y <= token.y + token.height * size + 1;
  return insidePoint(template, token.x + (token.width * size) / 2, token.y + (token.height * size) / 2) && reaches(template, token);
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
    zone, actor, token, atCasting, drifted: !!opts.drifted, feet: opts.feet?.[token.id] ?? null,
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
    /** Typed damage from the area, halved on a successful save when `half` names one; doubled for undead if asked. */
    async damage(formula, type, { half = null, undeadDouble = false } = {}) {
      // Empower and Maximize: the area's damage is the spell's variable number
      let amount = await rollTotal(metamagicFormula(formula, zone.metamagic));
      if (half && (await c.save(half))) amount = Math.floor(amount / 2);
      const undead = undeadDouble && creatureTypes(actor).types.has("undead");
      if (undead) amount *= 2;
      const taken = amount > 0 ? await hurt(amount, type ? [type] : []) : 0;
      line(`${amount}${type ? ` ${type}` : ""} damage${undead ? " (doubled: undead)" : ""}${taken < amount ? ` (${taken} after resistance)` : ""}`);
    },
    /** Thirsting entanglement: a failed Reflex save entangles and drains 1d2 Con. */
    async thirst() {
      if (await c.save("ref")) return;
      await c.hold(["entangled"]);
      await c.con(await rollTotal("1d2"));
    },
    /** Poisonous cloud: living creatures not immune to poison, a Fortitude save or 1d2 Con damage. */
    async poisonousCloud() {
      if (!living(actor) || poisonImmune(actor)) return line("unaffected (not living, or immune to poison)");
      if (!(await c.save("fort"))) await c.con(await rollTotal("1d2"));
    },
    /** Flashfire: Reflex negates the fire damage and catching fire. */
    async flashfire() {
      if (await c.save("ref")) return;
      await c.damage(`${Math.min(5, Math.max(1, Math.floor(zone.cl / 3)))}d6`, "fire");
      await setBurning(actor, { formula: "1d6", dc: 15, source: zone.name });
      line("catches fire");
    },
    /** Plague storm reaching a creature after the casting: a Fortitude save or the caster's disease. */
    async plague() {
      c.mark("exposed");
      if (!living(c.actor)) return line("not living: unaffected");
      if (await c.save("fort")) return;
      const message = fromUuidSync(zone.message ?? "");
      const choice = message?.getFlag(MODULE_ID, "spellChoice");
      const how = SPELL_DATA["plague storm"].choice.effects[choice]?.contract;
      line(how ? await contractFromSpell(actor, how, { choice, name: zone.name, save: { dc: zone.dc } }) : "the caster hasn't chosen the disease: expose it by hand");
    },
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
    /** Spike growth (spike stones: d8): 1d4 piercing per 5 feet moved through the area, then a Reflex save or half land speed for 24 hours. */
    async spikes(die = 4, name = "Spike Growth") {
      const to = centerOf(token);
      const from = opts.from ?? to;
      const feet = Math.max(5, Math.round(feetInside(template, from.x, from.y, to.x, to.y)));
      const n = Math.max(1, Math.floor(feet / 5));
      const dmg = await rollTotal(`${n}d${die}`);
      const taken = await hurt(dmg, ["piercing"]);
      line(`${feet} feet through the spikes: ${dmg} piercing damage${taken < dmg ? ` (${taken} after DR)` : ""}`);
      if (!taken) return; // "Any creature that takes damage from this spell must also succeed on a Reflex save"
      if (activeBuff(actor, /^spike (growth|stones) injury/i)) return;
      if (await c.save("ref")) return;
      await actor.createEmbeddedDocuments("Item", [{ name: `${name} injury`, type: "buff", img: "icons/svg/trap.svg", system: { active: true, subType: "temp", duration: { value: "24", units: "hour" }, contextNotes: [{ text: `Land speed halved (feet and legs injured by ${name.toLowerCase()}) until the 24 hours pass or a cure spell heals it`, target: "attack" }] } }]);
      line("land speed halved for 24 hours");
    },
    /** Sawtooth terrain at the casting: Reflex negates 3d8 piercing, 2d6 bleed and half speed for 24 hours. */
    async sawtooth() {
      if (await c.save("ref")) return;
      await c.damage("3d8", "piercing");
      line(await setBleed(actor, await rollTotal("2d6"), zone.name));
      await actor.createEmbeddedDocuments("Item", [{ name: `${zone.name} injury`, type: "buff", img: "icons/svg/trap.svg", system: { active: true, subType: "temp", duration: { value: "24", units: "hour" }, contextNotes: [{ text: `Speed halved (cut by ${zone.name.toLowerCase()}) until the 24 hours pass, a cure spell heals it, or a Heal check against the spell's DC`, target: "attack" }] } }]);
      line("speed halved for 24 hours");
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
    whisper: gmWhisper(),
    content: `<p><strong>${esc(zone.name)}</strong>${title ? ` (${esc(title)})` : ""}${zone.roll && spell.roll ? `, tentacles' roll ${zone.roll}` : ""}:</p><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>${undo.some((u) => u.conditions.length || u.lost?.hp || u.lost?.temp || u.con) ? `<button type="button" data-action="${MODULE_ID}-area-undo">Undo</button>` : ""}`,
    flags: { [MODULE_ID]: { [CARD]: { undo } } },
  });
}

async function addBuff(token, template, zone) {
  const actor = tokenActor(token);
  if (!actor || actor.itemTypes.buff.some((b) => b.flags?.[MODULE_ID]?.[LINK] === template.uuid)) return;
  const b = SPELLS[zone.key].buff;
  await actor.createEmbeddedDocuments("Item", [{
    // The spell's own icon (Foundry has no cloud icon)
    name: `${zone.name} (area)`, type: "buff", img: fromUuidSync(zone.message ?? "")?.itemSource?.img ?? "icons/svg/daze.svg",
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
  const name = (item?.type === "spell" ? baseSpellName(item) : item?.system?.spellName ?? item?.name ?? "").toLowerCase().replace(/^(scroll|wand|potion) of /, "");
  return BY_NAME.get(name) ?? null;
}

async function durationSeconds(message) {
  const item = message.itemSource;
  const action = item?.actions?.get(message.system.action?.id) ?? item?.defaultAction;
  const d = action?.duration;
  const per = UNIT_SECONDS[{ round: "round", rounds: "round", minute: "minute", hour: "hour" }[d?.units] ?? ""];
  if (!per || !d?.value) return null;
  const cl = message.system.config?.cl ?? item.system?.cl ?? 1;
  // Extend Spell: twice as long
  return (await rollTotal(String(d.value).replace(/@cl/g, cl))) * per * extendFactor(metamagicOf(message));
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
    metamagic: metamagicOf(message),
  };
  if (SPELLS[key].sphere) zone.at = { x: template.x, y: template.y };
  // Drifting clouds: away from where the caster stands now, through the cloud's center
  if (SPELLS[key].drift) {
    zone.at = { x: template.x, y: template.y };
    const from = caster?.getActiveTokens?.(false, true).find((t) => t.parent === template.parent);
    zone.drift = from ? directionOf(centerOf(from), zone.at, template.parent.grid.size / 2) : null;
  }
  if (SPELLS[key].wall) return castWall(template, zone, caster);
  await template.update({ [`flags.${MODULE_ID}.${FLAG}`]: zone });
  const inside = template.parent.tokens.filter((t) => tokenActor(t) && !t.hidden && insideTemplate(template, t));
  await template.update({ [`flags.${MODULE_ID}.${FLAG}.inside`]: inside.map((t) => t.id) });
  if (inside.length) await act(template, inside, "enter", "cast", { atCasting: true, newRound: true });
  if (SPELLS[key].sphere) await ChatMessage.implementation.create({ whisper: gmWhisper(), content: `<p><strong>${esc(zone.name)}</strong>: drag the sphere onto a creature to strike it (${esc(SPELLS[key].strikes)}); ${esc(SPELLS[key].reminder)}.</p>` });
});

/** Recheck who is inside a template: those entering and those leaving. */
async function recheck(template, { drifted = false } = {}) {
  const zone = zoneOf(template);
  if (!zone) return;
  if (SPELLS[zone.key].wall) return wallMoves(template);
  // A flaming sphere moved onto creatures strikes them (creatures walking into it don't count)
  const sphereMoved = !!SPELLS[zone.key].sphere && !!zone.at && (zone.at.x !== template.x || zone.at.y !== template.y);
  if (sphereMoved) await template.update({ [`flags.${MODULE_ID}.${FLAG}.at`]: { x: template.x, y: template.y } });
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
  for (const token of entered) {
    if (sphereMoved) await act(template, [token], "strike", "the sphere rolled into it");
    else await act(template, [token], "enter", drifted ? "the cloud reached it" : "entered the area", { from: lastPos.get(token.uuid), drifted });
  }
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
// Where everyone stands when the scene is shown: the start of their first move (walls)
Hooks.on("canvasReady", (canvas) => {
  for (const token of canvas.scene?.tokens ?? []) lastPos.set(token.uuid, centerOf(token));
});
Hooks.on("updateMeasuredTemplate", async (template, changes, options) => {
  if (["x", "y", "distance", "direction", "width"].some((k) => k in changes)) soon(template.parent);
  // A drifting cloud dragged by the GM: it goes on from there (its first drag sets its direction if it had none)
  const zone = zoneOf(template);
  if (!isActiveGM() || options[DRIFTED] || !zone?.at || !SPELLS[zone.key]?.drift || !("x" in changes || "y" in changes)) return;
  const update = { [`flags.${MODULE_ID}.${FLAG}.at`]: { x: template.x, y: template.y } };
  if (!zone.drift) update[`flags.${MODULE_ID}.${FLAG}.drift`] = directionOf(zone.at, template, 1);
  await template.update(update, { [DRIFTED]: true });
});

/* -------------------------------------------- */
/*  Walls                                       */
/* -------------------------------------------- */

const SIDE_CARD = "wallSide"; // card flag: the wall's template uuid (the GM's switch of the hot side)
/** A line wall's ends, in pixels; null for a ring. */
function wallEnds(template) {
  if (template.t !== "ray") return null;
  const len = (template.distance / template.parent.grid.distance) * template.parent.grid.size;
  const a = Math.toRadians(template.direction);
  return [{ x: template.x, y: template.y }, { x: template.x + len * Math.cos(a), y: template.y + len * Math.sin(a) }];
}
const toFeet = (template, px) => (px / template.parent.grid.size) * template.parent.grid.distance;
/** How far a point is from the wall, in feet, and on which side (+1 / -1; a ring: -1 inside, +1 outside). */
function wallPlace(template, p) {
  const ends = wallEnds(template);
  if (!ends) {
    const r = (template.distance / template.parent.grid.distance) * template.parent.grid.size;
    const d = Math.hypot(p.x - template.x, p.y - template.y);
    return { feet: toFeet(template, Math.abs(d - r)), side: d < r ? -1 : 1, along: true };
  }
  const [a, b] = ends;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  const q = { x: a.x + Math.clamp(t, 0, 1) * dx, y: a.y + Math.clamp(t, 0, 1) * dy };
  return { feet: toFeet(template, Math.hypot(p.x - q.x, p.y - q.y)), side: dx * (p.y - a.y) - dy * (p.x - a.x) < 0 ? -1 : 1, along: t >= 0 && t <= 1 };
}
/** In the wall's own squares: within half a square of it. */
const inWall = (template, p) => {
  const w = wallPlace(template, p);
  return w.along && w.feet < template.parent.grid.distance / 2;
};
/** Does a move from a to b pass through the wall? Into its squares, or across it from one side to the other. */
function crosses(template, a, b) {
  if (inWall(template, a)) return false; // leaving the wall's squares isn't another crossing
  if (inWall(template, b)) return true;
  const ends = wallEnds(template);
  if (!ends) return wallPlace(template, a).side !== wallPlace(template, b).side;
  return foundry.utils.lineSegmentIntersects(a, b, ends[0], ends[1]);
}
/** The creatures the heat reaches: on the hot side (or in the wall), within 20 feet. */
function heated(template, zone) {
  const feet = {};
  const tokens = template.parent.tokens.filter((t) => {
    if (!tokenActor(t) || t.hidden) return false;
    const p = centerOf(t);
    const w = wallPlace(template, p);
    if (!w.along || w.feet > 20 || (w.side !== zone.hot && !inWall(template, p))) return false;
    feet[t.id] = w.feet;
    return true;
  });
  return { tokens, feet };
}

/** A wall is raised: creatures where it appears pass through it, the heat goes out, and the GM gets its card. */
async function castWall(template, zone, caster) {
  const from = caster?.getActiveTokens?.(false, true).find((t) => t.parent === template.parent);
  zone.hot = from ? -wallPlace(template, centerOf(from)).side : 1;
  await template.update({ [`flags.${MODULE_ID}.${FLAG}`]: zone });
  for (const token of template.parent.tokens) lastPos.set(token.uuid, centerOf(token));
  const spell = SPELLS[zone.key];
  const caught = template.parent.tokens.filter((t) => tokenActor(t) && !t.hidden && inWall(template, centerOf(t)));
  if (caught.length) await act(template, caught, spell.appear ? "appear" : "cross", "where it appears", { atCasting: true });
  if (spell.heat) {
    const { tokens, feet } = heated(template, zoneOf(template));
    if (tokens.length) await act(template, tokens, "heat", "its heat", { atCasting: true, feet });
  }
  const lines = [spell.heat ? `The heat faces the side away from the caster${from ? "" : " (no caster token: one side)"}.` : null, spell.reminder ? `${spell.reminder[0].toUpperCase()}${spell.reminder.slice(1)}.` : null].filter(Boolean);
  if (lines.length) {
    await ChatMessage.implementation.create({
      whisper: gmWhisper(),
      content: `<p><strong>${esc(zone.name)}</strong>: ${lines.map(esc).join(" ")}</p>${spell.heat ? `<button type="button" data-action="${MODULE_ID}-wall-side">Switch the hot side</button>` : ""}`,
      flags: { [MODULE_ID]: { [SIDE_CARD]: template.uuid } },
    });
  }
}

/** Creatures that moved since the last check: those whose move passed through the wall. */
async function wallMoves(template) {
  for (const token of template.parent.tokens) {
    const from = lastPos.get(token.uuid);
    const to = centerOf(token);
    if (!from || !tokenActor(token) || token.hidden || (from.x === to.x && from.y === to.y)) continue;
    if (crosses(template, from, to)) await act(template, [token], "cross", "passed through it");
  }
}

Hooks.on("renderChatMessageHTML", (message, html) => {
  const uuid = message.getFlag(MODULE_ID, SIDE_CARD);
  const button = uuid && html.querySelector(`[data-action="${MODULE_ID}-wall-side"]`);
  if (!button) return;
  const template = fromUuidSync(uuid);
  if (!game.user.isGM || !zoneOf(template)) return void button.remove();
  button.addEventListener("click", async () => {
    const hot = -zoneOf(template).hot;
    await template.update({ [`flags.${MODULE_ID}.${FLAG}.hot`]: hot });
    ui.notifications.info(`${zoneOf(template).name}: the heat now faces the other side.`);
  });
});

/* -------------------------------------------- */
/*  Drifting clouds                             */
/* -------------------------------------------- */

const DRIFTED = `${MODULE_ID}.drifted`; // update option: the module moved the cloud (not the GM)
/** The unit direction from a to b, or null when they're closer than `min` pixels. */
function directionOf(a, b, min) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  return d < min ? null : { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
}

/** The cloud moves 10 feet away along its direction, stopping at a wall; then who's inside is checked. */
async function drift(template) {
  const zone = zoneOf(template);
  const scene = template.parent;
  if (!zone.drift) return `${zone.name}: no direction yet (cast on the caster's square); drag the template once to send it on its way`;
  const step = (10 / scene.grid.distance) * scene.grid.size;
  const from = { x: template.x, y: template.y };
  let to = { x: from.x + zone.drift.x * step, y: from.y + zone.drift.y * step };
  let note = null;
  const hit = CONFIG.Canvas.polygonBackends.move.testCollision(from, to, { type: "move", mode: "closest" });
  if (hit) {
    // Stop just short of the wall
    const back = Math.max(0, Math.hypot(hit.x - from.x, hit.y - from.y) - 2);
    to = { x: from.x + zone.drift.x * back, y: from.y + zone.drift.y * back };
    if (!zone.stopped) note = `${zone.name} reached a wall and stops there (it still spreads around corners)`;
  }
  if (Math.hypot(to.x - from.x, to.y - from.y) >= 1) {
    await template.update({ x: to.x, y: to.y, [`flags.${MODULE_ID}.${FLAG}.at`]: to, [`flags.${MODULE_ID}.${FLAG}.stopped`]: !!hit }, { [DRIFTED]: true });
  } else if (!zone.stopped) await template.update({ [`flags.${MODULE_ID}.${FLAG}.stopped`]: true }, { [DRIFTED]: true });
  await recheck(template, { drifted: true });
  return note;
}

// The caster's turn: start and end
Hooks.on("updateCombat", async (combat, changes, options) => {
  if (!isActiveGM() || !("turn" in changes || "round" in changes) || options.direction === -1) return;
  const scene = combat.scene ?? game.scenes.viewed;
  const zones = zonesIn(scene);
  if (!zones.length) return;
  const ended = combat.previous?.combatantId ? combat.combatants.get(combat.previous.combatantId)?.actor : null;
  const started = combat.combatant?.actor;
  for (const template of zones) {
    let zone = zoneOf(template);
    const spell = SPELLS[zone.key];
    // A drifting cloud moves first on the caster's turn (then acts on the creatures in its new spread)
    if (spell.drift && started?.uuid === zone.caster) {
      const note = await drift(template);
      const reminder = spell.reminder && !zone.reminded ? `<p><em>${esc(zone.name)}: ${esc(spell.reminder)}.</em></p>` : "";
      if (note || reminder) await ChatMessage.implementation.create({ whisper: gmWhisper(), content: `${note ? `<p>${esc(note)}.</p>` : ""}${reminder}` });
      if (reminder) await template.update({ [`flags.${MODULE_ID}.${FLAG}.reminded`]: true }, { [DRIFTED]: true });
      zone = zoneOf(template);
    }
    // Wall of fire: the heat on the caster's turn
    if (spell.heat && started?.uuid === zone.caster) {
      const { tokens, feet } = heated(template, zone);
      if (tokens.length) await act(template, tokens, "heat", "its heat, the caster's turn", { feet });
    }
    const inside = (zone.inside ?? []).map((id) => scene.tokens.get(id)).filter(Boolean);
    // Web cloud: a creature in the cloud at the start of its own turn
    if (spell.ownTurnStart && started) {
      const turn = turnActors(combat);
      const own = inside.filter((t) => turn.includes(t.actor));
      if (own.length) await act(template, own, "ownTurnStart", "start of its turn");
    }
    // Sickening entanglement: a creature in the area at the end of its own turn
    if (spell.ownTurnEnd && ended) {
      const turn = turnActors(combat, combat.combatants.get(combat.previous.combatantId));
      const own = inside.filter((t) => turn.includes(t.actor));
      if (own.length) await act(template, own, "ownTurnEnd", "end of its turn");
    }
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
  await ChatMessage.implementation.create({ whisper: gmWhisper(), content: `<p><strong>${esc(zone.name)}</strong> has ended; its area is removed.</p>` });
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
    // What lasts after leaving lasts here too (Stinking Cloud's nausea: 1d4+1 rounds; Web Cloud's webbing: until escaped)
    const lingers = SPELLS[zone.key]?.lingers ?? {};
    const ends = still.filter((c) => !(c in lingers));
    if (ends.length) await actor.setConditions(Object.fromEntries(ends.map((c) => [c, false])));
    for (const c of still.filter((c) => lingers[c])) {
      const rounds = await rollTotal(lingers[c]);
      // PF1 doesn't give a duration to a condition the creature already has: lift it, then set it timed
      await actor.setConditions({ [c]: false });
      await actor.setConditions({ [c]: { duration: timed(rounds) } });
    }
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
    if (SPELLS[zone.key].casterSees && tokenActor(attacker)?.uuid === zone.caster) continue;
    const through = insidePoint(template, a.x, a.y) || insidePoint(template, d.x, d.y) || feetInside(template, a.x, a.y, d.x, d.y) > 0;
    if (!through) continue;
    const near = (distance ?? Infinity) <= 5;
    // Smoke (Burning Entanglement): clear within 5 feet, concealment beyond
    if (fog === "smoke" && near) continue;
    const chance = fog === "smoke" || fog === "concealment" ? 20 : fog === "total" || !near ? 50 : 20;
    out.push({ chance, label: `${zone.name} (${chance === 50 ? "total concealment" : "concealment"})`, concealment: true });
  }
  return out;
});

export const _test = { FLAG, SPELLS, insideTemplate, insidePoint, feetInside, recheck, endZone, act, zoneOf, drift, castWall, crosses, heated };
