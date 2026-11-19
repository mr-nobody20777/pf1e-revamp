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
//   fullAC     the attack rolled for it is a normal attack against full AC, not a touch attack (Nauseating Dart)
//   initialSave  false: no save when cast, only the new saves to end it (Mudball)
//   onHit      { damage: { formula, type } } applied on a hit, before the save (PF1's card has none)
//   undead     fields that replace these for undead creatures, e.g. { save: "will", effect }
//   saveModifiers  [{ when, value, label, reason }] ticked in the save window: when "inCombat",
//              "aloneOutOfCombat" (the only creature affected, not in combat) or "differentType" (not
//              of the caster's type)
//   tiers      effect by Hit Dice: [[up to HD, effect], ...] (Color Spray)
//   utility    nothing to apply to creatures (Mending, Prestidigitation): no rows on its card
//   selfIfNone the caster is the subject when nothing is targeted (Light: usually the caster's own gear)
//   effect.damage       { formula, type }: hit point damage on a failed save (Brand)
//   effect.endsOnDamage the spell's buff ends when its subject takes damage (Haunted Fey Aspect)
//   effect.light        { bright, dim } in feet: the subject's token sheds light for the duration (Light)
//   effect.casterGains  { buff, changes, tempHp, roundsPerHD }: the caster gets the buff (plus these changes and
//              temporary hit points) for that many rounds per Hit Die of the creature (Death Knell)
//   save       the save its text calls for when PF1's data has none ("ref"), at the spell's DC (Animate Rope)
//   effect.attack       { damage, type, range, perUse }: an attack item (melee touch, ranged touch) while the
//              spell's buff lasts; each use takes perUse seconds off the buff (Produce Flame)
//   effect.restore      { damage }: Lesser Restoration's fatigue, exhaustion and one ability score (spells.mjs)
//   energy     the caster chooses an energy type when casting (Resist Energy); effect.energy puts it on the
//              spell's buff, whose resistance defenses.mjs applies
// Durations: "@cl" rounds per level; a minute is 10 rounds.

export const SPELLS = {
  /* Cantrips and orisons ------------------------------------------------------------------------- */
  daze: { types: ["humanoid"], hdMax: 4, cooldown: 10, effect: { conditions: [["dazed", "1"]] } },
  flare: { sighted: true, unless: "dazzled", effect: { conditions: [["dazzled", "10"]] } },
  "touch of fatigue": { unless: "fatigued", effect: { conditions: [["fatigued", "@cl"]] } },
  "disrupt undead": { types: ["undead"] },
  resistance: { effect: { buff: "Resistance" } },
  virtue: { effect: { buff: "Virtue" } },
  lullaby: { living: true, effect: { buff: "Lullaby" } }, // "Area living creatures within a 10-ft.-radius burst"
  stabilize: { living: true, dying: true, effect: { conditions: [["stable", null]] } },
  bleed: { living: true, dying: true, effect: { remove: ["stable"] } },
  // "inflicting 1 point of damage"
  brand: { effect: { damage: { formula: "1" }, marker: true } },
  // "You gain DR 1/cold iron against a single opponent until the end of the spell, or until you take damage"
  "haunted fey aspect": { self: true, effect: { marker: true, endsOnDamage: true, note: "DR 1/cold iron against one chosen opponent; ends when you take damage" } },
  // "shedding normal light in a 20-foot radius ... and increasing the light level for an additional 20 feet"
  light: { selfIfNone: true, effect: { marker: true, light: { bright: 20, dim: 40 } } },
  // Nothing to apply to creatures: PF1's card is all they need
  "arcane mark": { utility: true },
  "create water": { utility: true },
  "dancing lights": { utility: true },
  "detect magic": { utility: true },
  "detect poison": { utility: true },
  "ghost sound": { utility: true },
  "know direction": { utility: true },
  "mage hand": { utility: true },
  mending: { utility: true },
  message: { utility: true },
  "open/close": { utility: true },
  prestidigitation: { utility: true },
  "purify food and drink": { utility: true },
  "putrefy food and drink": { utility: true },
  "read magic": { utility: true },
  sift: { utility: true },
  spark: { utility: true },
  "summon instrument": { utility: true },
  // 1st level, Core Rulebook: nothing to apply to creatures (objects, senses, summons, illusions whose
  // save is a disbelief only when interacted with)
  alarm: { utility: true },
  "animal messenger": { utility: true },
  "bless water": { utility: true },
  "curse water": { utility: true },
  deathwatch: { utility: true },
  "detect animals or plants": { utility: true },
  "detect chaos": { utility: true },
  "detect evil": { utility: true },
  "detect good": { utility: true },
  "detect law": { utility: true },
  "detect secret doors": { utility: true },
  "detect snares and pits": { utility: true },
  "detect undead": { utility: true },
  erase: { utility: true },
  "floating disk": { utility: true },
  goodberry: { utility: true },
  "hold portal": { utility: true },
  identify: { utility: true },
  "magic aura": { utility: true },
  "magic mouth": { utility: true },
  "magic stone": { utility: true },
  mount: { utility: true },
  "obscure object": { utility: true },
  "silent image": { utility: true },
  "summon monster i": { utility: true },
  "summon nature's ally i": { utility: true },
  "unseen servant": { utility: true },
  ventriloquism: { utility: true },
  // 1st level, Core Rulebook: tracked for their duration, with what they do as a reminder
  "comprehend languages": { self: true, effect: { marker: true, note: "understands the spoken words of creatures and reads written messages" } },
  "speak with animals": { self: true, effect: { marker: true, note: "can ask questions of and receive answers from animals" } },
  // "you get a +10 bonus on the Disguise check"
  "disguise self": { self: true, effect: { changes: [{ target: "skill.dis", formula: "10", type: "untyped" }], note: "+10 on the Disguise check; the disguise can be disbelieved (Will) when interacted with" } },
  "endure elements": { effect: { marker: true, note: "comfortable between -50 and 140 degrees Fahrenheit: no Fortitude saves against heat or cold environments" } },
  "feather fall": { effect: { marker: true, note: "falls 60 feet per round and takes no falling damage while it lasts" } },
  "hide from animals": { effect: { marker: true, note: "animals can't sense it; ends for all recipients if one touches an animal or attacks" } },
  "hide from undead": { effect: { marker: true, note: "undead can't sense it (intelligent undead: Will save); ends for all recipients if one attacks, touches an undead or channels positive energy" } },
  // "touch a living creature that has -1 or fewer hit points. If the subject fails its saving throw, it dies, and
  // you gain 1d8 temporary hit points and a +2 enhancement bonus to Strength. Additionally, your effective caster
  // level goes up by +1 ... These effects last for 10 minutes per HD of the subject creature."
  "death knell": { living: true, dying: true, effect: { conditions: [["dead", null]], casterGains: { buff: "Death Knell", changes: [{ target: "cl", formula: "1", type: "untyped" }], tempHp: "1d8", roundsPerHD: 100 } } },
  // "dispels any magical effects reducing one of the subject's ability scores or cures 1d4 points of temporary
  // ability damage to one of the subject's ability scores. It also eliminates any fatigue ... and improves an
  // exhausted condition to fatigued."
  "restoration, lesser": { effect: { restore: { damage: "1d4" } } },
  // "it must be thrown near the intended target. Doing so requires a successful ranged touch attack roll ... it can
  // be used ... to cause a single opponent that fails a Reflex saving throw to become entangled ... A typical
  // 1-inch-diameter hemp rope has 2 hit points, AC 10, and requires a DC 23 Strength check to burst it."
  "animate rope": { save: "ref", touchAttack: "ranged", effect: { conditions: [["entangled", null]], note: "until it bursts the rope (DC 23 Strength; the rope has AC 10, 2 hit points) or escapes; a bound spellcaster needs a concentration check to cast" } },
  // "fire damage equal to 1d6 + 1 point per caster level (maximum +5) ... hurl the flames up to 120 feet ...
  // Each attack you make reduces the remaining duration by 1 minute"
  "produce flame": { self: true, effect: { marker: true, attack: { damage: "1d6 + min(@cl, 5)", type: "fire", range: 120, perUse: 60 } } },
  // "Your own nonmagical club or quarterstaff becomes a weapon with a +1 enhancement bonus on attack and damage
  // rolls ... It deals damage as if it were two size categories larger" (weapon-spells.mjs binds it and sizes it)
  shillelagh: { self: true, effect: { changes: [{ target: "attack", formula: "1", type: "enh" }, { target: "wdamage", formula: "1", type: "enh" }], note: "on your club or quarterstaff: +1, damage as if two sizes larger" } },
  // "grants a creature limited protection from damage of whichever one of five energy types you select"
  "resist energy": { energy: true, effect: { marker: true, energy: true } },
  "resist energy, communal": { energy: true, effect: { marker: true, energy: true } },
  // 1st level, Advanced Player's Guide, Ultimate Magic, Ultimate Combat: nothing to apply to creatures
  // (objects, senses, summons, corpses, a choice made later, or a reroll granted at once)
  "abundant ammunition": { utility: true },
  "alter winds": { utility: true },
  "borrow skill": { utility: true },
  bowstaff: { utility: true },
  break: { utility: true },
  "call animal": { utility: true },
  "damp powder": { utility: true },
  "dancing lantern": { utility: true },
  "decompose corpse": { utility: true },
  "detect aberration": { utility: true },
  "diagnose disease": { utility: true },
  "expeditious excavation": { utility: true },
  "fabricate bullets": { utility: true },
  "hero's defiance": { utility: true },
  "horn of pursuit": { utility: true },
  "jury-rig": { utility: true },
  "know the enemy": { utility: true },
  "liberating command": { utility: true },
  "mask dweomer": { utility: true },
  peacebond: { utility: true },
  "play instrument": { utility: true },
  "polypurpose panacea": { utility: true },
  "rally point": { utility: true },
  "reinforce armaments": { utility: true },
  "residual tracking": { utility: true },
  "restore corpse": { utility: true },
  "returning weapon": { utility: true },
  "sanctify corpse": { utility: true },
  "saving finale": { utility: true },
  "sculpt corpse": { utility: true },
  "solid note": { utility: true },
  "summon minor ally": { utility: true },
  "summon minor monster": { utility: true },
  "timely inspiration": { utility: true },
  "weaken powder": { utility: true },
  "word of resolve": { utility: true },
  "youthful appearance": { utility: true },
  // 1st level, Advanced Player's Guide, Ultimate Magic, Ultimate Combat: tracked for their duration, with a reminder
  "abjuring step": { self: true, effect: { marker: true, note: "two 5-foot steps a round; casting doesn't provoke; ends on an attack, a harmful spell or moving more than 5 feet" } },
  "air bubble": { effect: { marker: true, note: "breathes underwater or without air" } },
  "bomber's eye": { self: true, effect: { marker: true, note: "+1 insight on attack rolls with thrown weapons; thrown weapons' range +10 feet" } },
  bristle: { effect: { marker: true, note: "each round (swift action) may trade natural armor for an enhancement bonus on natural attack damage, up to 1 per 3 caster levels" } },
  "cloak of shade": { effect: { marker: true, note: "sun heat one step less; penalties from sunlight reduced by 1" } },
  "compel hostility": { self: true, effect: { marker: true, note: "immediate action: a threatening creature attacking an ally attacks you instead (spell resistance, Will negates)" } },
  // "takes a -5 penalty on all Craft skill checks"
  "crafter's curse": { effect: { changes: [{ target: "skill.crf", formula: "-5", type: "untyped" }] } },
  "feather step": { effect: { marker: true, note: "ignores difficult terrain's movement effects; can 5-foot step in it" } },
  // "The target gains a +4 circumstance bonus on Stealth checks"
  "forced quiet": { effect: { changes: [{ target: "skill.ste", formula: "4", type: "circumstance" }], note: "can't yell; its sonic effects' DCs -2; +2 on saves against sonic effects" } },
  fumbletongue: { effect: { marker: true, note: "can't speak intelligibly: 20% failure for spells with verbal components and command words" } },
  glide: { self: true, effect: { marker: true, note: "no falling damage; glides 5 feet horizontally per foot fallen; ends on landing" } },
  grace: { self: true, effect: { marker: true, note: "movement doesn't provoke until the end of your turn" } },
  "healing thief": { effect: { marker: true, note: "healing spells and supernatural healing on it: half to it, half to the caster (within 25 ft + 5 ft per two levels; up to 5 hp per caster level)" } },
  "hex ward": { effect: { marker: true, note: "+4 resistance on saves against witch hexes" } },
  "honeyed tongue": { self: true, effect: { marker: true, note: "Diplomacy to change attitude: roll twice, take the higher; or +5 competence to gather information" } },
  "illusion of calm": { self: true, effect: { marker: true, note: "casting, thrown attacks and moving out of your first square don't provoke; a creature that hits you can disbelieve (Will)" } },
  innocence: { self: true, effect: { buff: "Innocence" } },
  interrogation: { effect: { marker: true, note: "one question per two caster levels: answer or take 1d4 + your Wisdom bonus damage; -4 on Bluff to lie to you" } },
  invigorate: { effect: { marker: true, note: "no penalties from fatigued or exhausted; when it ends: 1d6 nonlethal and the conditions return" } },
  "lend judgment": { effect: { marker: true, note: "gains one of the caster's active judgments" } },
  "litany of sloth": { effect: { marker: true, note: "can't make attacks of opportunity or cast defensively; can't be the target of another litany" } },
  "mirror strike": { self: true, effect: { marker: true, note: "next melee attack before the end of your next turn: compare against two foes in reach (+2 if they flank you); hit both for half damage each" } },
  "moment of greatness": { affects: "allies", effect: { marker: true, note: "once: double a morale bonus on one roll, chosen before rolling" } },
  "persuasive goad": { effect: { marker: true, note: "the caster has +4 circumstance on Intimidate against it for 1 minute" } },
  "remove sickness": { effect: { marker: true, note: "+4 morale on saves against disease, nausea and sickened; such effects already on it are suppressed" } },
  "restful sleep": { effect: { marker: true, note: "a full night's rest heals as a full day of bed rest (a full day's rest: three times its level); waking ends it" } },
  "see alignment": { self: true, effect: { marker: true, note: "creatures of the chosen alignment glow for you" } },
  "share language": { effect: { marker: true, note: "can use one language the caster knows (one more per 5 caster levels)" } },
  "stone fist": { self: true, effect: { marker: true, note: "unarmed strikes don't provoke, deal 1d6 lethal bludgeoning (1d4 Small), and ignore hardness below 8" } },
  "sun metal": { effect: { marker: true, note: "the weapon deals +1d4 fire on a hit (not multiplied on a critical); doesn't stack with flaming" } },
  "tactical acumen": { affects: "allies", effect: { marker: true, note: "+1 insight on positional attack and AC bonuses (flanking, higher ground, cover), +1 per 5 caster levels above 5th (max +4)" } },
  "targeted bomb admixture": { self: true, effect: { marker: true, note: "bombs don't splash and deal base damage plus double your Intelligence modifier" } },
  "tireless pursuit": { self: true, effect: { marker: true, note: "half damage from hustling and forced marches; ignore the fatigue from them" } },
  "unnatural lust": { effect: { marker: true, note: "next turn: rushes to the chosen creature or object to kiss or caress it, nothing else (+4 on the save if it wouldn't normally desire it)" } },
  "vocal alteration": { effect: { marker: true, note: "voice altered: +10 on Disguise checks against listeners" } },
  "warding weapon": { self: true, effect: { marker: true, note: "casting doesn't provoke (except from creatures with Disruptive)" } },
  "wartrain mount": { effect: { marker: true, note: "trained for combat (general purpose) for the duration" } },
  "negate aroma": { effect: { marker: true, note: "no scent: can't be tracked or noticed by scent" } },
  wrath: { self: true, effect: { marker: true, note: "+1 morale per three caster levels (max +3) on attack and weapon damage rolls and spell penetration against the chosen enemy; Improved Critical against it at 12th level" } },
  // "Creatures in the target square take 1d4 points of fire damage and are dazzled for 1 round (Reflex half, a
  // successful save negates the dazzled condition)"
  "snapdragon fireworks": { effect: { conditions: [["dazzled", 1]] } },
  "pass without trace": { effect: { buff: "Pass Without Trace" } },
  "undetectable alignment": { effect: { marker: true, note: "alignment can't be detected by divinations" } },

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
    living: true, // "Area several living creatures"
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
  // "giving it fast healing 1" (greater: 4), for the spell's duration: a buff named after the spell that
  // fast-healing.mjs reads
  "infernal healing": { effect: { marker: true } },
  "infernal healing, greater": { effect: { marker: true } },
  "celestial healing": { effect: { marker: true } },
  "celestial healing, greater": { effect: { marker: true } },
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
  "magic weapon, greater": { effect: { buff: "Magic Weapon, Greater" } },
  // Afflictions (afflictions.mjs): a caster level check against each affliction of the kind; the two buffs by name
  "neutralize poison": { effect: { cure: "poison" } },
  "remove disease": { effect: { cure: "disease" } },
  "remove curse": { effect: { cure: "curse" } },
  "delay poison": { effect: { marker: true } },
  "pernicious poison": { effect: { marker: true } },
  "bless weapon": { effect: { buff: "Bless Weapon" } },
  "keen edge": { effect: { marker: true } },
  "align weapon": { effect: { marker: true } },
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
  ironbeard: { effect: { changes: [{ target: "aac", formula: "1", type: "untyped" }], note: "an armor bonus that stacks with worn armor (not against touch attacks); 20% spell failure for verbal components" } },
  // "as though you had fired a dart from a blowgun. You must succeed at a ranged attack to hit your target": a
  // normal ranged attack (full AC), 1d2 piercing, then Fortitude or nauseated 1 round
  "nauseating dart": { touchAttack: "ranged", fullAC: true, onHit: { damage: { formula: "1d2", type: "piercing" } }, effect: { conditions: [["nauseated", "1"]] } },
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
