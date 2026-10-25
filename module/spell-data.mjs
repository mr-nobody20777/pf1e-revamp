// What each automated spell does to the creatures it affects (see spells.mjs for how it's applied).
// Keyed by the spell's name in lower case. Fields:
//   affects    "allies" / "enemies": only those creatures among the targets (Bless, Bane); default all
//   self       the caster is the subject (Shield, Divine Favor...), with or without targets
//   types      only creatures of these types or subtypes are affected ("person" spells: humanoid)
//   hdMax      creatures with more Hit Dice are unaffected
//   pool       a number of Hit Dice affected in total, fewest HD first, then nearest (Sleep)
//   living     only living creatures (not undead or constructs)
//   dying      only a creature below 0 hit points (Stabilize, Bleed)
//   wounded    only a creature below its maximum hit points (Touch of Bloodletting)
//   sighted    sightless creatures are unaffected
//   intMin     creatures with a lower Intelligence (or none) are unaffected
//   unless     a condition that makes the creature unaffected (Flare: already dazzled)
//   cooldown   rounds during which a creature affected once can't be affected again (Daze: 1 minute)
//   effect     what happens on a failed save (or, with no save, to every affected creature):
//              conditions  [[condition id, duration in rounds (formula, @cl = caster level)], ...]
//              buff        name of the spell's buff in the compendiums (its duration and caster level
//                          come from the spell)
//              penalty     { target, formula, half }: a Strength or other penalty, the highest only
//              remove      condition ids removed
//              changes     bonuses or penalties on a buff named after the spell ([{ target, formula, type }])
//              marker      a buff with no changes, named after the spell, to track it for its duration
//              abilityDamage  { str: 1 }: ability damage
//              resave      a new save on the creature's next turn in combat ends it (Hideous Laughter);
//                          { every, save, removes, action }: every turn until it succeeds, with that save,
//                          removing these conditions, taking this action
//              note        text for the GM where the rest isn't automated
//   onSave     the effect on a successful save ("partial"), same fields
//   autoHit    no attack roll is needed (Magic Missile), whatever PF1 rolls
//   touchAttack  true / "ranged": the touch attack is rolled here; a spell with a range of touch and no
//              attack roll of its own gets a melee touch attack anyway (Mudball: "ranged")
//   initialSave  false: no save when cast, only the new saves to end it (Mudball)
//   onHit      { damage: { formula, type } } applied on a hit, before the save (PF1's card has none)
//   undead     fields that replace these for undead creatures, e.g. { save: "will", effect }
//   saveModifiers  [{ when, value, label, reason }] ticked in the save window: when "inCombat",
//              "aloneOutOfCombat" (the only creature affected, not in combat) or "differentType" (not
//              of the caster's type)
//   tiers      effect by Hit Dice: [[up to HD, effect], ...] (Color Spray)
// Durations: "@cl" rounds per level; a minute is 10 rounds.

export const SPELLS = {
  /* Cantrips and orisons ------------------------------------------------------------------------- */
  daze: { types: ["humanoid"], hdMax: 4, cooldown: 10, effect: { conditions: [["dazed", "1"]] } },
  flare: { sighted: true, unless: "dazzled", effect: { conditions: [["dazzled", "10"]] } },
  "touch of fatigue": { unless: "fatigued", effect: { conditions: [["fatigued", "@cl"]] } },
  "disrupt undead": { types: ["undead"] },
  resistance: { effect: { buff: "Resistance" } },
  virtue: { effect: { buff: "Virtue" } },
  lullaby: { effect: { buff: "Lullaby" } },
  stabilize: { living: true, dying: true, effect: { conditions: [["stable", null]] } },
  bleed: { living: true, dying: true, effect: { remove: ["stable"] } },

  /* 1st level ------------------------------------------------------------------------------------- */
  bane: { affects: "enemies", effect: { buff: "Bane" } },
  "magic missile": { autoHit: true, effect: { note: "hits automatically; the missiles (1d4+1 each) can be split between targets" } },
  bless: { affects: "allies", effect: { buff: "Bless" } },
  "cause fear": { living: true, hdMax: 5, effect: { conditions: [["frightened", "1d4"]] }, onSave: { conditions: [["shaken", "1"]] } },
  doom: { effect: { conditions: [["shaken", "10 * @cl"]] } },
  "color spray": {
    sighted: true,
    tiers: [
      [2, { conditions: [["unconscious", "@a"], ["blind", "@a + @b"], ["stunned", "@a + @b + 1"]], roll: { a: "2d4", b: "1d4" }, livingOnly: ["unconscious"] }],
      [4, { conditions: [["blind", "@b"], ["stunned", "@b + 1"]], roll: { b: "1d4" } }],
      [Infinity, { conditions: [["stunned", "1"]] }],
    ],
  },
  sleep: { pool: "4", unless: "unconscious", effect: { conditions: [["sleep", "10 * @cl"]] } },
  hypnotism: {
    pool: "2d4",
    saveModifiers: [
      { when: "inCombat", value: 2, label: "in combat", reason: "only in combat" },
      { when: "aloneOutOfCombat", value: -2, label: "alone, not in combat", reason: "only when it's the only creature affected and isn't in combat" },
    ],
    effect: { conditions: [["fascinated", "2d4"]] },
  },
  "hideous laughter": {
    intMin: 3,
    saveModifiers: [{ when: "differentType", value: 4, label: "a different type from the caster", reason: "only for a creature whose type differs from the caster's" }],
    effect: { conditions: [["prone", null]], marker: true, resave: { action: "a full-round action that doesn't provoke" }, note: "laughing: can take no actions (not helpless); a new save on its next turn ends it" },
  },
  "chill touch": {
    touchAttack: true,
    onHit: { damage: { formula: "1d6", type: "negative energy" } },
    effect: { abilityDamage: { str: 1 }, note: "one touch per caster level" },
    undead: { save: "will", onHit: null, effect: { conditions: [["panicked", "1d4 + @cl"]] } },
  },
  "confusion, lesser": { effect: { conditions: [["confused", "1"]] } },
  command: { effect: { marker: true, note: "obeys the command for 1 round (Approach, Drop, Fall: prone, Flee, Halt)" } },
  entangle: { effect: { conditions: [["entangled", "10 * @cl"]], note: "in the area: a new save at the end of the caster's turn; breaking free is a move action (Strength or Escape Artist against the spell's DC)" } },
  grease: { effect: { conditions: [["prone", null]], note: "moving through: DC 10 Acrobatics at half speed" } },
  "charm person": { types: ["humanoid"], effect: { marker: true } },
  "charm animal": { types: ["animal"], effect: { marker: true } },
  "calm animals": { types: ["animal"], effect: { marker: true } },
  "daze monster": { living: true, hdMax: 5, cooldown: 10, effect: { conditions: [["dazed", "1"]] } },
  "faerie fire": { effect: { buff: "Faerie Fire" } },
  "ray of enfeeblement": { effect: { penalty: { target: "str", formula: "1d6 + min(5, floor(@cl / 2))" } }, onSave: { penalty: { target: "str", formula: "1d6 + min(5, floor(@cl / 2))", half: true } } },
  "shield of faith": { effect: { buff: "Shield of Faith" } },
  "mage armor": { effect: { buff: "Mage Armor" } },
  shield: { self: true, effect: { buff: "Shield" } },
  "divine favor": { self: true, effect: { buff: "Divine Favor" } },
  "true strike": { self: true, effect: { buff: "True Strike" } },
  "entropic shield": { self: true, effect: { buff: "Entropic Shield" } },
  "expeditious retreat": { self: true, effect: { buff: "Expeditious Retreat" } },
  longstrider: { self: true, effect: { buff: "Longstrider" } },
  "enlarge person": { types: ["humanoid"], effect: { buff: "Enlarge Person" } },
  "reduce person": { types: ["humanoid"], effect: { buff: "Reduce Person" } },
  "magic fang": { effect: { buff: "Magic Fang" } },
  "magic weapon": { effect: { buff: "Magic Weapon" } },
  "bless weapon": { effect: { buff: "Bless Weapon" } },
  jump: { effect: { buff: "Jump" } },
  sanctuary: { effect: { buff: "Sanctuary" } },
  "remove fear": { effect: { buff: "Remove Fear", note: "a fear effect it's already under is suppressed for the duration" } },
  "protection from chaos": { effect: { buff: "Protection From Chaos" } },
  "protection from evil": { effect: { buff: "Protection From Evil" } },
  "protection from good": { effect: { buff: "Protection From Good" } },
  "protection from law": { effect: { buff: "Protection From Law" } },

  /* Advanced Player's Guide ----------------------------------------------------------------------- */
  "ant haul": { effect: { buff: "Ant Haul" } },
  "aspect of the falcon": { self: true, effect: { buff: "Aspect of the Falcon" } },
  "beguiling gift": { effect: { marker: true, note: "uses or consumes the offered item at once" } },
  "challenge evil": { effect: { marker: true, note: "+2 sacred on the caster's melee attacks against it; sickened at the end of its turn if it didn't attack the caster" } },
  "crafter's fortune": { effect: { buff: "Crafter's Fortune" } },
  "flare burst": { sighted: true, unless: "dazzled", effect: { conditions: [["dazzled", "10"]] } },
  "ghostbane dirge": { types: ["incorporeal"], effect: { buff: "Ghostbane Dirge" } },
  "hunter's howl": { effect: { marker: true, note: "treated as the caster's favored enemy (+2); shaken instead if it already is one" } },
  "ill omen": { effect: { buff: "Ill Omen" } },
  "keen senses": { effect: { buff: "Keen Senses" } },
  "knight's calling": { effect: { marker: true, note: "moves its speed toward the caster on its turn and attacks if it can" } },
  "lead blades": { self: true, effect: { buff: "Lead Blades" } },
  "touch of gracelessness": {
    effect: { penalty: { target: "dex", formula: "1d6 + min(5, floor(@cl / 2))" }, note: "falls prone if it moves more than half its speed" },
    onSave: { penalty: { target: "dex", formula: "1d6 + min(5, floor(@cl / 2))", half: true } },
  },
  "touch of the sea": { effect: { buff: "Touch of the Sea" } },
  "unwitting ally": { effect: { marker: true, note: "counts as the caster's ally for flanking; no hostile action against the caster's enemies" } },
  vanish: { effect: { conditions: [["invisible", "min(5, @cl)"]], note: "ends if it attacks" } },
  "veil of positive energy": { self: true, effect: { buff: "Veil of Positive Energy" } },

  /* Ultimate Magic -------------------------------------------------------------------------------- */
  "anticipate peril": { effect: { buff: "Anticipate Peril" } },
  bungle: { hdMax: 10, effect: { buff: "Bungle" } },
  "delusional pride": { effect: { changes: [{ target: "attack", formula: "-2", type: "untyped" }, { target: "skills", formula: "-2", type: "untyped" }], note: "+2 morale on saves against charm and compulsion" } },
  "ear-piercing scream": { effect: { conditions: [["dazed", "1"]] } },
  "forbid action": { effect: { marker: true, note: "won't take the forbidden kind of action" } },
  frostbite: { effect: { conditions: [["fatigued", null]], note: "fatigued until the nonlethal damage is healed" } },
  "murderous command": { effect: { marker: true, note: "attacks its nearest ally on its next turn" } },
  "ray of sickening": { effect: { conditions: [["sickened", "10 * @cl"]] } },
  "unprepared combatant": { effect: { buff: "Unprepared Combatant" } },

  /* Ultimate Combat ------------------------------------------------------------------------------- */
  adoration: { self: true, effect: { buff: "Adoration" } },
  "deadeye's lore": { self: true, effect: { buff: "Deadeye's Lore" } },
  "gravity bow": { self: true, effect: { buff: "Gravity Bow" } },
  "litany of weakness": { effect: { conditions: [["fatigued", "1"]] } },
  "lock gaze": { effect: { marker: true, note: "looks only at the caster: other creatures have concealment against its attacks" } },
  longshot: { effect: { buff: "Longshot" } },
  "negative reaction": { effect: { changes: [{ target: "skill.blf", formula: "-10", type: "untyped" }, { target: "skill.dip", formula: "-10", type: "untyped" }, { target: "skill.int", formula: "-10", type: "untyped" }] } },
  "shock shield": { self: true, effect: { buff: "Shock Shield" } },
  "unerring weapon": { effect: { buff: "Unerring Weapon" } },

  /* Other books ----------------------------------------------------------------------------------- */
  // Advanced Race Guide
  "delay disease": { effect: { buff: "Delay Disease" } },
  jitterbugs: { effect: { buff: "Jitterbugs" } },
  linebreaker: { effect: { buff: "Linebreaker" } },
  "marid's mastery": { effect: { buff: "Marid's Mastery" } },
  mudball: {
    touchAttack: "ranged",
    initialSave: false,
    effect: { conditions: [["blind", null]], marker: true, resave: { every: true, save: "ref", removes: ["blind"], action: "at the start of its turn" }, note: "an adjacent creature can wipe it off as a standard action" },
  },
  "unlock flesh": {
    living: true,
    effect: { conditions: [["staggered", "@cl"]], marker: true, resave: { every: true, removes: ["staggered"], action: "a standard action that doesn't provoke" } },
  },
  // Advanced Class Guide
  "heightened awareness": { effect: { buff: "Heightened Awareness" } },
  "long arm": { effect: { buff: "Long Arm" } },
  "monkey fish": { effect: { buff: "Monkey Fish" } },
  "stunning barrier": { effect: { buff: "Stunning Barrier" } },
  // Occult Adventures and others
  hobble: { effect: { buff: "Hobble" } },
  fumblestep: { effect: { buff: "Fumblestep" } },
  "swallow your fear": { effect: { buff: "Swallow Your Fear" } },
  chastise: { effect: { buff: "Chastise" } },
  "unbreakable heart": { effect: { buff: "Unbreakable Heart" } },
  "aspect of the nightingale": { effect: { buff: "Aspect of the Nightingale" } },
  "haze of dreams": { effect: { buff: "Haze of Dreams" } },
  "tap inner beauty": { effect: { buff: "Tap Inner Beauty" } },
  "weapons against evil": { effect: { buff: "Weapons Against Evil" } },
  "sotto voce": { living: true, hdMax: 4, effect: { conditions: [["shaken", "1"]] } },
  "endothermic touch": { effect: { conditions: [["staggered", "@cl"]], note: "moves at half speed" } },
  "touch of blindness": { effect: { conditions: [["blind", "1"]], note: "one touch per caster level" } },
  "shadow trap": {
    effect: { conditions: [["entangled", "@cl"]], marker: true, resave: { every: true, removes: ["entangled"], action: "a full-round action" }, note: "can't move more than 5 feet from where it was" },
  },
  "itching curse": {
    effect: { changes: [{ target: "attack", formula: "-1", type: "untyped" }, { target: "allSavingThrows", formula: "-1", type: "untyped" }, { target: "skills", formula: "-1", type: "untyped" }, { target: "allChecks", formula: "-1", type: "untyped" }], note: "none of it on a turn it scratches (a move action)" },
  },
  ironbeard: { effect: { changes: [{ target: "ac", formula: "1", type: "untyped" }], note: "+1 armor bonus that stacks with worn armor; 20% spell failure for verbal components" } },
  "nauseating dart": { effect: { conditions: [["nauseated", "1"]], note: "only if the dart hit (a ranged attack, 1d2 piercing)" } },
  "touch of bloodletting": { wounded: true, effect: { conditions: [["exhausted", "@cl"]], note: "1 bleed each round; a DC 15 Heal check or any healing spell ends it" } },
  "hairline fractures": { types: ["earth"], effect: { changes: [{ target: "ac", formula: "-2", type: "untyped" }] } },
  paranoia: { effect: { marker: true, note: "treats every creature as an enemy and must make attacks of opportunity; -2 on attacks, weapon damage, checks and saves when adjacent to two or more creatures" } },
  "advanced scurvy": {
    living: true,
    effect: {
      conditions: [["fatigued", null]],
      changes: ["strSkills", "dexSkills", "strChecks", "dexChecks"].map((target) => ({ target, formula: "-1", type: "untyped" })),
      note: "heals naturally at half rate; +1 to bleed it takes",
    },
  },
};
