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
//   intMax     creatures with a higher Intelligence are unaffected (Animal Trance: 1 or 2)
//   choice     { title, options: { id: label }, effects: { id: effect } }: the caster picks the effect when
//              casting (Blindness/Deafness, Bestow Curse); it replaces `effect`
//   effect.tempHp  formula: temporary hit points on the spell's buff, gone when it ends (Aid, False Life)
//   effect.roll    { key: formula }: rolled once; @key in conditions, penalties and changes (Touch of Idiocy)
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
  // 2nd level, Core Rulebook
  aid: { effect: { buff: "Aid", tempHp: "1d8 + min(@cl, 10)" } },
  barkskin: { effect: { buff: "Barkskin" } },
  "bear's endurance": { effect: { buff: "Bear's Endurance" } },
  "bull's strength": { effect: { buff: "Bull's Strength" } },
  "cat's grace": { effect: { buff: "Cat's Grace" } },
  "eagle's splendor": { effect: { buff: "Eagle's Splendor" } },
  "fox's cunning": { effect: { buff: "Fox's Cunning" } },
  "owl's wisdom": { effect: { buff: "Owl's Wisdom" } },
  darkvision: { effect: { buff: "Darkvision" } },
  haste: { effect: { buff: "Haste" } },
  heroism: { effect: { buff: "Heroism" } },
  invisibility: { effect: { buff: "Invisibility" } },
  "protection from arrows": { effect: { buff: "Protection From Arrows" } },
  "see invisibility": { self: true, effect: { buff: "See Invisibility" } },
  blur: { effect: { buff: "Blur" } },
  // "can take only a single move action or standard action each turn ... -1 penalty on attack rolls, AC, and Reflex
  // saves ... moves at half its normal speed": PF1's buff, and staggered for the duration
  slow: { effect: { buff: "Slow", conditions: [["staggered", "@cl"]] } },
  // "+2 morale bonus to Strength and Constitution, a +1 morale bonus on Will saves, and a -2 penalty to AC" (PF1's
  // Rage buff is the barbarian's)
  rage: { living: true, effect: { changes: [{ target: "str", formula: "2", type: "morale" }, { target: "con", formula: "2", type: "morale" }, { target: "will", formula: "1", type: "morale" }, { target: "ac", formula: "-2", type: "untyped" }], note: "as a barbarian's rage, but not fatigued afterward" } },
  // "Roll 2d6 to determine the total number of HD ... Only a creature with an Intelligence score of 1 or 2"
  "animal trance": { types: ["animal", "magicalbeast"], intMin: 1, intMax: 2, pool: "2d6", effect: { conditions: [["fascinated", null]], marker: true, note: "while you concentrate" } },
  "blindness/deafness": { living: true, choice: { title: "Blinded or deafened", options: { blind: "Blinded", deaf: "Deafened" }, effects: { blind: { conditions: [["blind", null]] }, deaf: { conditions: [["deaf", null]] } } } },
  "bestow curse": {
    choice: {
      title: "Which curse",
      options: { ability: "-6 to an ability score", rolls: "-4 on attacks, saves, ability and skill checks", action: "50% chance each turn to take no action" },
      effects: {
        ability: { marker: true, note: "-6 to one ability score (minimum 1): add it to the buff for the score chosen" },
        rolls: { changes: [{ target: "attack", formula: "-4", type: "untyped" }, { target: "allSavingThrows", formula: "-4", type: "untyped" }, { target: "allChecks", formula: "-4", type: "untyped" }, { target: "skills", formula: "-4", type: "untyped" }] },
        action: { marker: true, note: "each turn, 50% chance to act normally; otherwise it takes no action" },
      },
    },
  },
  "calm emotions": { effect: { marker: true, note: "can't take violent actions; morale bonuses, rage and fear suppressed; confusion removed; ends for all if one is attacked or damaged" } },
  "command undead": { types: ["undead"], effect: { marker: true, note: "friendly toward you; follows orders (opposed Charisma check for what it wouldn't do)" } },
  enthrall: { effect: { marker: true, note: "friendly (4 HD or more, or Wisdom 16+: indifferent); takes no action while you speak and for 1d3 rounds after" } },
  // "paralyze a single living humanoid ... A paralyzed subject exudes a carrion stench"
  "ghoul touch": { living: true, types: ["humanoid"], effect: { conditions: [["paralyzed", "1d6 + 2"]], note: "living creatures within 10 feet: Fortitude or sickened (a poison effect)" } },
  // "Each round at the end of their turn blinded creatures may attempt new saving throws ... -40 penalty on Stealth"
  glitterdust: { effect: { conditions: [["blind", "@cl"]], changes: [{ target: "skill.ste", formula: "-40", type: "untyped" }], resave: { every: true, save: "will", removes: ["blind"], action: "at the end of its turn" } }, onSave: { changes: [{ target: "skill.ste", formula: "-40", type: "untyped" }] } },
  // "Each round on its turn, the subject may attempt a new saving throw to end the effect. This is a full-round action"
  "hold person": { types: ["humanoid"], effect: { conditions: [["paralyzed", "@cl"]], marker: true, resave: { every: true, save: "will", removes: ["paralyzed"], action: "a full-round action" } } },
  "hold animal": { types: ["animal"], effect: { conditions: [["paralyzed", "@cl"]], marker: true, resave: { every: true, save: "will", removes: ["paralyzed"], action: "a full-round action" } } },
  // "Roll 2d4 and add your caster level (maximum 10) ... Sightless creatures are not affected"
  "hypnotic pattern": { pool: "2d4 + min(@cl, 10)", sighted: true, effect: { conditions: [["fascinated", null]], marker: true, note: "while you concentrate, and 2 rounds after" } },
  // "functions like cause fear, except that it causes all targeted creatures of less than 6 HD to become frightened"
  scare: { living: true, hdMax: 5, effect: { conditions: [["frightened", "@cl"]] }, onSave: { conditions: [["shaken", "1"]] } },
  "sound burst": { effect: { conditions: [["stunned", "1"]], note: "a creature that can't hear isn't stunned" } },
  suggestion: { effect: { marker: true, note: "follows the suggested course of action" } },
  // "a 1d6 penalty to the target's Intelligence, Wisdom, and Charisma scores"
  "touch of idiocy": { effect: { roll: { p: "1d6" }, changes: [{ target: "int", formula: "-@p", type: "untyped" }, { target: "wis", formula: "-@p", type: "untyped" }, { target: "cha", formula: "-@p", type: "untyped" }] } },
  "remove paralysis": { effect: { remove: ["paralyzed", "staggered"], note: "on two or more creatures, each instead gets a new save (+4 for two, +2 for three or four)" } },
  // "+1 deflection bonus to AC and a +1 resistance bonus on saves ... takes only half damage"
  "shield other": { effect: { changes: [{ target: "ac", formula: "1", type: "deflection" }, { target: "allSavingThrows", formula: "1", type: "resist" }], note: "half of its hit point damage goes to the caster" } },
  // "a climb speed of 20 feet and a +8 racial bonus on Climb skill checks"
  "spider climb": { effect: { changes: [{ target: "skill.clm", formula: "8", type: "racial" }], note: "climb speed 20 feet, no Climb checks to move on walls and ceilings" } },
  "water walk": { effect: { marker: true, note: "walks on liquids as on firm ground" } },
  levitate: { effect: { marker: true, note: "moves up or down 20 feet a round (move action); attacks: -1, -2... up to -5" } },
  tongues: { effect: { marker: true, note: "speaks and understands any intelligent creature's language" } },
  status: { effect: { marker: true, note: "the caster knows its direction, distance and condition" } },
  "undeath sense": { effect: { marker: true, note: "aware of undead auras within 60 feet" } },
  "zone of truth": { effect: { marker: true, note: "can't speak deliberate lies in the area" } },
  "find traps": { self: true, effect: { marker: true, note: "Perception to find traps as a rogue's trapfinding, +1/2 caster level (max +10) insight" } },
  "speak with plants": { self: true, effect: { marker: true } },
  "tree shape": { self: true, effect: { marker: true, note: "takes the form of a tree: AC (natural armor +10, Dex 0) and senses per the spell" } },
  "alter self": { self: true, effect: { marker: true, note: "polymorph (beast shape of a humanoid): apply the form's changes by hand" } },
  "mirror image": { self: true, effect: { marker: true, note: "1d4 + 1 per three caster levels images (max 8): an attack that hits may strike an image" } },
  "reduce animal": { effect: { marker: true, note: "one size smaller, as reduce person" } },
  nondetection: { effect: { marker: true, note: "divinations against it need a caster level check (DC 11 + caster level)" } },
  // "temporary hit points equal to 1d10 + 1 per caster level (maximum +10)"
  "false life": { self: true, effect: { marker: true, tempHp: "1d10 + min(@cl, 10)" } },
  "protection from energy": { energy: true, effect: { marker: true, energy: true, note: "immune to the chosen energy until it absorbs 12 points per caster level (max 120)" } },
  // "deals 1d8 points of fire damage + 1 point per two caster levels (maximum +10) ... your Strength modifier does not apply"
  "flame blade": { self: true, effect: { marker: true, attack: { damage: "1d8 + min(floor(@cl / 2), 10)", type: "fire" } } },
  // Nothing to apply to creatures
  "arcane lock": { utility: true },
  augury: { utility: true },
  "clairaudience/clairvoyance": { utility: true },
  "continual flame": { utility: true },
  "fire trap": { utility: true },
  "gentle repose": { utility: true },
  "helping hand": { utility: true },
  knock: { utility: true },
  "locate object": { utility: true },
  "minor image": { utility: true },
  misdirection: { utility: true },
  "phantom steed": { utility: true },
  "phantom trap": { utility: true },
  "rope trick": { utility: true },
  snare: { utility: true },
  "soften earth and stone": { utility: true },
  "speak with dead": { utility: true },
  "spectral hand": { utility: true },
  "summon monster ii": { utility: true },
  "summon nature's ally ii": { utility: true },
  "summon swarm": { utility: true },
  "warp wood": { utility: true },
  "whispering wind": { utility: true },
  "wind wall": { utility: true },
  "wood shape": { utility: true },
  // 2nd level, Advanced Player's Guide, Ultimate Magic, Ultimate Combat: nothing to apply to the creatures in the
  // rows (objects, weapons, senses, summons, areas the GM places, or an effect used later)
  "accelerate poison": { utility: true },
  "alchemical allocation": { utility: true },
  allfood: { utility: true },
  "animate dead, lesser": { utility: true },
  "arrow eruption": { utility: true },
  "blood biography": { utility: true },
  "blood transcription": { utility: true },
  "campfire wall": { utility: true },
  "create treasure map": { utility: true },
  "destabilize powder": { utility: true },
  "discovery torch": { utility: true },
  "distracting cacophony": { utility: true },
  "divine arrow": { utility: true },
  "eagle eye": { utility: true },
  "enter image": { utility: true },
  "evolution surge, lesser": { utility: true },
  "gallant inspiration": { utility: true },
  "guiding star": { utility: true },
  "hide campsite": { utility: true },
  "magic siege engine": { utility: true },
  "mask dweomer, communal": { utility: true },
  "masterwork transformation": { utility: true },
  "mount, communal": { utility: true },
  "oracle's burden": { utility: true },
  "paladin's sacrifice": { utility: true },
  "pilfering hand": { utility: true },
  "recoil fire": { utility: true },
  "reinforce armaments, communal": { utility: true },
  "reloading hands": { utility: true },
  "restore eidolon, lesser": { utility: true },
  "returning weapon, communal": { utility: true },
  "ricochet shot": { utility: true },
  "scent trail": { utility: true },
  "sculpt simulacrum": { utility: true },
  "seek thoughts": { utility: true },
  "share memory": { utility: true },
  "stabilize powder": { utility: true },
  "summon eidolon": { utility: true },
  "symbol of mirroring": { utility: true },
  "telekinetic assembly": { utility: true },
  "thunder fire": { utility: true },
  "toxic gift": { utility: true },
  "transmute potion to poison": { utility: true },
  "vomit swarm": { utility: true },
  "wake of light": { utility: true },
  "web shelter": { utility: true },
  "wilderness soldiers": { utility: true },
  "brow gasher": { utility: true },
  "instrument of agony": { utility: true },
  "flames of the faithful": { utility: true },
  "badger's ferocity": { utility: true },
  "vestment of the champion": { utility: true },
  "versatile weapon": { utility: true },
  "stone call": { utility: true },
  // 2nd level, Advanced Player's Guide, Ultimate Magic, Ultimate Combat
  "aspect of the bear": { self: true, effect: { buff: "Aspect of the Bear" } },
  "blessing of courage and life": { effect: { buff: "Blessing of Courage and Life" } },
  "chameleon stride": { self: true, effect: { buff: "Chameleon Stride" } },
  "perceive cues": { self: true, effect: { buff: "Perceive Cues" } },
  "acute senses": { effect: { buff: "Acute Senses" } },
  "certain grip": { effect: { buff: "Certain Grip" } },
  "bullet shield": { effect: { buff: "Bullet Shield" } },
  "hunter's eye": { self: true, effect: { buff: "Hunter's Eye" } },
  "weapon of awe": { effect: { buff: "Weapon of Awe" } },
  // "You gain the benefits of the spell haste for as long as you maintain that bardic performance"
  allegro: { self: true, effect: { buff: "Haste", note: "while you maintain your bardic performance" } },
  "protection from chaos, communal": { effect: { buff: "Protection From Chaos" } },
  "protection from evil, communal": { effect: { buff: "Protection From Evil" } },
  "protection from good, communal": { effect: { buff: "Protection From Good" } },
  "protection from law, communal": { effect: { buff: "Protection From Law" } },
  "endure elements, communal": { effect: { marker: true, note: "comfortable between -50 and 140 degrees Fahrenheit: no Fortitude saves against heat or cold environments" } },
  "water walk, communal": { effect: { marker: true, note: "walks on liquids as on firm ground" } },
  "share language, communal": { effect: { marker: true, note: "can use one language the caster knows (one more per 5 caster levels)" } },
  "ant haul, communal": { effect: { marker: true, note: "carrying capacity tripled" } },
  // "gains the nauseated condition for the duration of the spell"
  "cacophonous call": { effect: { conditions: [["nauseated", "@cl"]] } },
  // "On a failed save, the target cowers with fear. On a successful save, it is shaken for 1 round. Each round on its
  // turn, a cowering subject may attempt a new save to end the effect."
  castigate: { living: true, effect: { conditions: [["cowering", "@cl"]], marker: true, resave: { every: true, save: "will", removes: ["cowering"], action: "on its turn" } }, onSave: { conditions: [["shaken", "1"]] } },
  // "Creatures in the area must make a Fortitude save or become fatigued"
  "dust of twilight": { effect: { conditions: [["fatigued", null]] } },
  fester: { living: true, effect: { marker: true, note: "spell resistance 12 + caster level against healing and temporary hit points; other healing halved" }, onSave: { marker: true, note: "for 1 round only: spell resistance against healing; other healing halved" } },
  // "1d6 points of nonlethal damage per round ... sickened for the spell's duration ... +4 circumstance bonus on
  // Intimidate checks against the target"
  "pain strike": { living: true, effect: { conditions: [["sickened", "min(@cl, 10)"]], marker: true, note: "1d6 nonlethal damage each round; the caster has +4 on Intimidate against it" } },
  // "The target is sickened and takes a -4 penalty to Dexterity"
  "pox pustules": { effect: { conditions: [["sickened", "10 * @cl"]], changes: [{ target: "dex", formula: "-4", type: "untyped" }], note: "a move action scratching removes sickened until the start of its next turn" } },
  "severed fate": { living: true, effect: { conditions: [["shaken", "10 * @cl"]], marker: true, note: "can't use hero points" } },
  // "Targets must save or gain the sickened condition. Creatures that are immune to critical hits are immune"
  "distressing tone": { living: true, effect: { conditions: [["sickened", "@cl"]] } },
  // "Your melee touch attack deals 4d6 points of cold damage and causes the target to be staggered for 1 round"
  "frigid touch": { effect: { conditions: [["staggered", "1"]], note: "staggered 1 minute on a critical hit" } },
  "piercing shriek": { effect: { conditions: [["staggered", "@cl"]], note: "no effect on a deaf creature" } },
  // "-2 penalty to AC, attacks, melee damage rolls, and Reflex saving throws"
  "howling agony": { living: true, effect: { changes: [{ target: "ac", formula: "-2", type: "untyped" }, { target: "attack", formula: "-2", type: "untyped" }, { target: "ref", formula: "-2", type: "untyped" }], note: "-2 on melee damage; concentration to cast; a move action screaming removes the penalties for that turn" } },
  // "-2 penalty on Will saving throws, caster level checks, Intelligence-based skill checks, and Wisdom-based skill checks"
  "mad hallucination": { types: ["humanoid"], effect: { changes: [{ target: "will", formula: "-2", type: "untyped" }], note: "-2 on caster level checks and Intelligence- and Wisdom-based skill checks" } },
  // "a -10 penalty on its ability checks, skill checks, and concentration checks"
  qualm: { effect: { changes: [{ target: "allChecks", formula: "-10", type: "untyped" }, { target: "skills", formula: "-10", type: "untyped" }], note: "-10 on concentration; ends if it spends a whole turn doing nothing" } },
  "litany of eloquence": { effect: { conditions: [["fascinated", "1"]] } },
  "litany of entanglement": { effect: { conditions: [["entangled", "1"]], note: "no effect on a flying creature" } },
  "frost fall": { effect: { conditions: [["staggered", "1"]] } },
  // "The target takes one of the following penalties. -2 decrease to an ability score ... -2 penalty on attack rolls
  // or saving throws. Land speed reduced by 5 feet."
  "disfiguring touch": {
    choice: {
      title: "Which disfigurement",
      options: { ability: "-2 to an ability score", attack: "-2 on attack rolls", saves: "-2 on saving throws", speed: "-5 feet land speed" },
      effects: {
        ability: { marker: true, note: "-2 to one ability score (minimum 1): add it to the buff for the score chosen" },
        attack: { changes: [{ target: "attack", formula: "-2", type: "untyped" }] },
        saves: { changes: [{ target: "allSavingThrows", formula: "-2", type: "untyped" }] },
        speed: { changes: [{ target: "landSpeed", formula: "-5", type: "untyped" }] },
      },
    },
  },
  // "a sacred bonus to its saving throws equal to its Charisma bonus"
  "bestow grace": { effect: { changes: [{ target: "allSavingThrows", formula: "max(0, @abilities.cha.mod)", type: "sacred" }] } },
  "disguise other": { effect: { changes: [{ target: "skill.dis", formula: "10", type: "untyped" }], note: "+10 on the Disguise check; the disguise can be disbelieved (Will) when interacted with" } },
  "litany of righteousness": { effect: { marker: true, note: "if evil: double damage from attacks by creatures with a good aura; with the evil subtype, also dazzled 1d4 rounds when hit by them" } },
  "hostile levitation": { effect: { marker: true, note: "half speed; -4 CMD against bull rush, drag and reposition; attacks -1, -2... up to -5" } },
  "twisted space": { effect: { marker: true, note: "its melee attacks go to a random creature it threatens" } },
  "oppressive boredom": { effect: { marker: true, note: "a Will save to take each action; ends on a successful one" } },
  "compassionate ally": { effect: { marker: true, note: "rushes to heal an injured ally and stays by it" } },
  "reckless infatuation": { effect: { marker: true, note: "stays within 30 feet of the chosen creature; staggered while farther" } },
  "unadulterated loathing": { effect: { marker: true, note: "stays at least 60 feet from the chosen creature; nauseated while closer" } },
  "feast of ashes": { effect: { marker: true, note: "starves (nonlethal damage); eating nauseates for 1 round (DC 12 Fortitude)" } },
  "boiling blood": { effect: { marker: true, note: "1 fire damage each round (an orc instead gets +2 morale to Strength)" } },
  "unshakable chill": { effect: { marker: true, note: "severe cold: 1d6 nonlethal cold now and a save every 10 minutes" } },
  confess: { effect: { marker: true, note: "must answer truthfully on its next action or take 1d6 per two caster levels and be sickened 2d4 rounds" } },
  "steal voice": { effect: { marker: true, note: "the caster croak spellblight" } },
  "spontaneous immolation": { effect: { marker: true, note: "catches fire: 1d6 fire each round on the caster's turn until a save (the spell's DC) puts it out" } },
  "corruption resistance": { effect: { marker: true, note: "5 less damage (10 at 7th level, 15 at 11th) from effects that harm the chosen alignment" } },
  "protective penumbra": { effect: { marker: true, note: "ignores light blindness, light sensitivity and sunlight vulnerability penalties; +2 on saves against bright light hazards" } },
  "delay pain": { effect: { marker: true, note: "pain effects don't affect it until the spell ends" } },
  "cushioning bands": { effect: { marker: true, note: "DR 2/piercing or slashing; half damage from constriction, falling and crushing (until 12 points per caster level are blocked)" } },
  "imbue with aura": { effect: { marker: true, note: "radiates the caster's aura for alignment effects" } },
  "miserable pity": { effect: { marker: true, note: "as sanctuary; attackers who failed get +2 morale to attack it for 1 minute if it attacks" } },
  "ablative barrier": { effect: { marker: true, note: "+2 armor bonus to AC; the first 5 lethal damage of each attack becomes nonlethal (up to 5 per caster level)" } },
  "kinetic reverberation": { effect: { marker: true, note: "a weapon that hits it in melee: Fortitude or takes the damage dealt" } },
  "righteous vigor": { effect: { marker: true, note: "each melee hit on the same foe: +1 morale on attacks (max +4) and 1d8 temporary hit points (max 20); a miss resets the bonus" } },
  "natural rhythm": { effect: { marker: true, note: "each natural attack hit on the same foe: +1 damage against it (max +5); a miss resets it" } },
  lockjaw: { effect: { marker: true, note: "one natural attack gains grab (+4 on grapple checks)" } },
  "heroic fortune": { effect: { marker: true, note: "1 hero point to spend before the spell ends" } },
  "sacred bond": { effect: { marker: true, note: "touch healing spells between the two at close range" } },
  "hidden speech": { effect: { marker: true, note: "+10 competence on Bluff to pass secret messages; -5 for others to decipher them" } },
  slipstream: { effect: { marker: true, note: "speed +10 feet on level ground (+20 downhill); swim speed +20 feet (or 20 feet)" } },
  "forest friend": { effect: { marker: true, note: "ignores undergrowth in forests; +5 circumstance on Acrobatics and Climb among trees" } },
  "bestow weapon proficiency": { effect: { marker: true, note: "proficient with the weapon it holds" } },
  "aura of greater courage": { self: true, effect: { marker: true, note: "allies in your aura of courage are immune to fear" } },
  bloodhound: { self: true, effect: { marker: true, note: "scent; +8 Perception by smell, +4 Survival to track by scent; -4 on saves against odors" } },
  "burning gaze": { self: true, effect: { marker: true, note: "standard action: a creature within 30 feet, Fortitude or 1d6 fire (then Reflex or catch fire)" } },
  "elemental speech": { self: true, effect: { marker: true } },
  "elemental touch": { self: true, effect: { marker: true, note: "melee touch: 1d6 of the chosen energy plus its effect; also on unarmed strikes" } },
  "fire breath": { self: true, effect: { marker: true, note: "up to three cones: 4d6, then 2d6, then 1d6 fire (Reflex half)" } },
  "follow aura": { self: true, effect: { marker: true } },
  "instant armor": { self: true, effect: { marker: true, note: "armor of force replaces worn armor" } },
  "light lance": { self: true, effect: { marker: true, note: "a +1 holy lance of light" } },
  "protective spirit": { self: true, effect: { marker: true, note: "attacks of opportunity against you: the spirit rolls to make them miss (Dexterity bonus times)" } },
  "saddle surge": { self: true, effect: { marker: true, note: "+1 Ride and +1 morale damage per 5 feet the mount moved this round" } },
  "effortless armor": { self: true, effect: { marker: true, note: "armor doesn't reduce speed; armor check penalty -1 (+1 per five caster levels, max 5)" } },
  "litany of defense": { self: true, effect: { marker: true, note: "armor's enhancement bonus doubled; immune to fear" } },
  "litany of warding": { self: true, effect: { marker: true, note: "two extra attacks of opportunity this round; +2 sacred AC against them" } },
  "locate weakness": { self: true, effect: { marker: true, note: "critical hits: roll the weapon's damage dice twice, take the higher" } },
  "touch injection": { self: true, effect: { marker: true, note: "deliver the held substance with a melee touch" } },
  "shadow bomb admixture": { self: true, effect: { marker: true } },
  "ghostly disguise": { self: true, effect: { marker: true } },
  "holy shield": { self: true, effect: { marker: true, note: "swift action: an ally within 30 feet gets your shield's bonus to AC until your next turn" } },
  "defensive shock": { self: true, effect: { marker: true, note: "a creature touching or striking you takes 1d6 electricity per two caster levels (max 6d6), halved each time" } },
  "surmount affliction": { self: true, effect: { marker: true, note: "one condition's effects suspended" } },
  skinsend: { self: true, effect: { marker: true } },
  "animal aspect": { self: true, effect: { marker: true, note: "the chosen animal's benefits (frog, gorilla, kangaroo, monkey, mole, octopus...): apply them by hand" } },
  // "the target is entangled ... A target that saves against this spell is affected for only 1 round"
  "fire of entanglement": { effect: { conditions: [["entangled", "@cl"]], note: "starting its turn adjacent to you, it can't move" }, onSave: { conditions: [["entangled", "1"]] } },
  "silk to steel": { self: true, effect: { marker: true, note: "each round: +2 shield bonus, or attack with it as a whip" } },
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
