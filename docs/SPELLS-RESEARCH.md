# Cantrips and 1st-level spells: research

Research for automating 0- and 1st-level spells (2026-10-25). It covers what PF1, Nevela's Automation Suite and this module already do, the rules every spell shares, and each Core Rulebook spell's needs.

## Scope

The PF1 spell compendium (`pf1.spells`) has 3,029 spells. **568** are 0 or 1st level for at least one class: 53 cantrips/orisons and 515 1st-level spells.

| Source | Spells at 0–1 |
|---|---|
| Core Rulebook | 118 |
| Advanced Player's Guide | 59 |
| Ultimate Magic | 37 |
| Ultimate Combat | 33 |
| Advanced Class Guide | 31 |
| Advanced Race Guide | 30 |
| Occult Adventures | 20 |
| Other books (about 70 titles) | 240 |

By how they resolve, from the compendium data: 323 call for a saving throw, 15 make a spell attack (10 ranged touch, 5 melee touch), 13 heal, and 214 have no roll. Only 27 have a damage formula. Most 0–1st level spells are utility (detection, light, communication, illusions) and need nothing beyond what PF1 already shows.

## What already exists

**PF1 (11.11)**
- Rolls spell attacks (touch, ranged touch) and damage with types, places the measured template, and puts a save DC button on the card. Each player clicks it to roll their own save.
- Doesn't decide who is inside a template, apply the result of a save, check spell resistance, or put a condition or buff on a target.
- Has a condition registry with durations (`setCondition(id, { duration: { rounds } })`): blind, confused, cowering, dazed, dazzled, deaf, entangled, exhausted, fascinated, fatigued, frightened, grappled, helpless, immobilized, nauseated, panicked, paralyzed, prone, shaken, sickened, sleep, slowed, staggered, stunned, unconscious and more. It also has condition immunities.

**Data gaps found in the compendium**
- *Chill Touch* has no damage formula (1d6 negative energy, Fort or 1 Strength damage, once per caster level).
- *Ray of Enfeeblement* has no penalty (1d6 + 1 per two caster levels, maximum +5, Strength penalty; Fort halves).
- *Magic Missile* rolls one missile (1d4+1); it should be one more for every two caster levels beyond 1st, maximum five at 9th.
- *Disrupt Undead* damages any target (it only harms undead).
- *Cure* spells heal undead and *Inflict* spells harm them; the rule is the reverse, with a Will save for half.

**Buffs.** 68 of the 568 spells have a matching buff in a compendium (pf-content, PF1, Nevela): Bless, Bane, Shield of Faith, Mage Armor, Shield, Divine Favor, Enlarge Person, Reduce Person, Magic Weapon, Longstrider, Expeditious Retreat, Jump, Resistance, Virtue, Faerie Fire, Entropic Shield, Sanctuary, Remove Fear, Death Knell and others. Spells that only cause a condition (Doom, Daze, Flare, Touch of Fatigue, Color Spray, Sleep) have no buff and need none: the condition is the effect.

**Nevela's Automation Suite (2.2.9)**
- Puts a buff on targets when an action is used, gated by the target's save, for actions where this is enabled (off by default, per action).
- Handles metamagic, prepared-spell slots, damage absorption (Stoneskin, Resist Energy, Protection from Energy and Arrows), Fire Shield, Mirror Image, temporary HP pools, and several conditions' ongoing effects (confusion, entangled, nauseated, grappled).
- Has code for damage vulnerability (×1.5). This is a possible answer to the vulnerability gap noted during sneak attack work; it needs checking.

**This module**
- *Protection from Evil* and the alignment auras; *Guidance*, *True Strike*; miss chances (Blur, Entropic Shield); Bit of Luck; energy resistance.
- Channel energy already does what spells need: lists the creatures in the area, has the GM's client roll each one's save, and applies full or half damage. That flow is the model for spells.

## Rules every spell shares

1. **Targets.** Three shapes:
   - Single or multiple targets: the user's targets.
   - Areas from a template: cone, line, burst, spread. Creatures in the template are affected.
   - Bursts centered on the caster: Bless (allies within 50 ft) and Bane (enemies within 50 ft). These place no template.
2. **Saving throws.** The spell sets the save and its result: negates, half, partial (a lesser effect), or disbelief. A creature can give up a save willingly, which matters for "harmless" spells cast on allies. PF1 marks harmless spells.
3. **Spell resistance.** "Spell Resistance: yes" spells need a caster level check (1d20 + caster level) at least equal to the target's SR, or they have no effect on it. Harmless spells don't check SR on a willing target.
4. **Immunities.**
   - *Mind-affecting:* undead, constructs, vermin and most oozes and plants are immune.
   - *Hit Dice limits:* Daze affects 4 HD or less; Cause Fear, 5 HD or less (6 or more is immune); Color Spray depends on HD; Sleep and Hypnotism share a pool of HD.
   - *Creature type:* "person" spells affect humanoids only; Disrupt Undead affects undead only; Daze, humanoids only.
   - *Senses:* sightless creatures ignore Color Spray and Flare.
   - *Living only:* Color Spray's unconsciousness, Bleed, Stabilize.
   - *Already affected:* Touch of Fatigue doesn't affect a fatigued creature; Flare doesn't affect a dazzled one; Daze gives a minute of immunity.
   - *Racial:* elves are immune to sleep; dwarves add +2 against spells.
   - Several of these already exist in the module (`isUndead`, creature types, condition immunities).
5. **Durations.** Rounds, minutes or hours per caster level, often capped. A condition with a duration ends by itself through PF1. Some effects change over time (Color Spray: unconscious + blinded + stunned, then blinded + stunned, then stunned).
6. **Caster level and DC.** These come from PF1's roll data (`@cl`, `shared.saveDC`).
7. **Penalties that don't stack with themselves.** Ray of Enfeeblement keeps the highest penalty, not the sum.
8. **Healing and undead.** Positive energy heals the living and harms undead; negative energy is the reverse.
9. **Touch spells.** A touch spell can be held, and Chill Touch allows one touch per caster level. Rays and touch spells can score critical hits on their damage.
10. **Magic Missile.** It needs no attack roll and never misses. Missiles can be split between targets, and each one is resisted separately.

## Core Rulebook spells by what they need

**A. Damage with a save or attack: data fixes and save resolution**
- *Burning Hands* (Reflex half)
- *Acid Splash*, *Ray of Frost* (ranged touch; already fine)
- *Shocking Grasp* (+3 to hit against metal armor or weapons)
- *Magic Missile* (missile count, split targets)
- *Chill Touch* (damage and Strength damage; panics undead)
- *Disrupt Undead* (undead only)
- *Cure* and *Inflict Light Wounds* (reversed on undead, Will half)
- *Produce Flame* (1d6 + CL, maximum +5; melee or thrown)
- *Magic Stone* (1d6+1, 2d6+2 against undead)

**B. A condition on a failed save (or on a hit)**
- *Daze:* dazed 1 round; humanoids of 4 HD or less; then a minute of immunity.
- *Flare:* dazzled 1 minute; Fort negates.
- *Touch of Fatigue:* fatigued 1 round per level; Fort negates.
- *Cause Fear:* frightened 1d4 rounds, or shaken 1 round on a save; 6 or more HD immune.
- *Doom:* shaken 1 minute per level.
- *Color Spray:* by HD, as above.
- *Sleep:* 4 HD total, fewest HD first, then nearest; asleep 1 minute per level.
- *Hypnotism:* 2d4 HD; fascinated; +2 on the save in combat.
- *Hideous Laughter:* prone and can't act; Intelligence 2 or less unaffected; +4 on the save for a different creature type; a new save each turn.
- *Lesser Confusion:* confused 1 round.
- *Command:* the chosen command (Fall: prone; Halt; Approach; Flee; Drop).
- *Entangle:* entangled; a new save each turn while in the area.
- *Grease:* Reflex or fall prone.
- *Calm Animals*, *Charm Person*, *Charm Animal*, *Daze Monster* (5 HD or less), *Animate Rope*, *Bleed*, *Stabilize*.

**C. A buff or penalty on targets**
- *On allies:* Bless (allies in 50 ft), Shield of Faith, Mage Armor, Shield (the caster), Divine Favor, Enlarge Person, Reduce Person, Magic Weapon, Magic Fang, Bless Weapon, Longstrider, Expeditious Retreat, Jump, Resistance, Virtue, Remove Fear, Entropic Shield, Sanctuary, Protection from Chaos, Evil, Good and Law (done), True Strike (done), Guidance (done), Resist Energy (Nevela).
- *On enemies:* Bane (enemies in 50 ft, Will negates), Faerie Fire, Ray of Enfeeblement.
- *Healing:* Death Knell, Lesser Restoration.

**D. No automation needed (utility; the card text is enough)**
Arcane Mark, Create Water, Dancing Lights, Detect Magic, Detect Poison, Ghost Sound, Know Direction, Light, Lullaby (Perception penalty only), Mage Hand, Mending, Message, Open/Close, Prestidigitation, Purify Food and Drink, Read Magic, Summon Instrument, Alarm, Animal Messenger, Bless Water, Comprehend Languages, Curse Water, Deathwatch, Delay Poison, the Detect spells, Disguise Self, Endure Elements, Erase, Feather Fall, Floating Disk, Goodberry, Hide from Animals, Hide from Undead, Hold Portal, Identify, Magic Aura, Magic Mouth, Mount, Obscure Object, Obscuring Mist, Pass without Trace, Shillelagh, Silent Image, Speak with Animals, Summon Monster I, Summon Nature's Ally I, Undetectable Alignment, Unseen Servant, Ventriloquism.

**Totals.** About 15 damage spells, 20 condition spells and 30 buff spells need something in the Core Rulebook. The other ~50 need nothing.

## How Pathfinder 2e does it (for reference)
- A spell card has a save button.
- The PF2e Toolbelt "target helper" adds a row per target on the card. The target's owner rolls their save there (the GM rolls for NPCs), and the row shows the degree of success.
- The damage Apply buttons on each row are scaled to the result (full, half, none, double).
- Effects such as *Bless* are links on the card, dragged onto tokens or applied by an aura.
- Immunities are resolved when the effect is applied, not revealed beforehand. This matches the rule already chosen here for precision immunity.

## Other books (later phases)
These use the same engine as the Core Rulebook spells, once it exists. Most common:
- *Advanced Player's Guide:* Ray of Sickening, Ear-Piercing Scream, Jolt, Snapdragon Fireworks, Dancing Lantern, Lock Gaze, Liberating Command, Hydraulic Push, Compel Hostility, Forbid Action, Murderous Command, Stone Fist, Timely Inspiration, Long Arm.
- *Ultimate Magic:* Bungle, Ill Omen, Unprepared Combatant, Ray of Sickening.
- *Ultimate Combat:* Gravity Bow, Lead Blades, Bullet Shield, Abundant Ammunition, Aspect of the Falcon (done).
- *Advanced Class Guide:* Linebreaker, Unerring Weapon, Heightened Awareness.
- Racial and setting spells.
