# PF1e Revamp – Roadmap

Planned work for PF1e Revamp, grouped by status. Completed work is recorded in the [CHANGELOG](CHANGELOG.md); design rulings are recorded in [DECISIONS](DECISIONS.md).

## In progress

### Roll windows and chat cards
Remaining work on the roll-window buff manager ("Buffs on a roll"):
- **Debuffs applied by other modules.** Penalties from another creature's spell are locked when the spell was applied by this module's spell rows; buffs applied by hand or by Nevela's Automation Suite don't record their caster, so they stay unlocked.


### Next priorities
Next, the focus moves to:
- **Ranged combat** (research: `docs/RANGED-COMBAT-RESEARCH.md`). Phases: range and Point-Blank Shot (done), defenses against ranged attacks (done; wind left to the GM), action economy (done: loaded weapons and reloading, opt-in), special shots and firearms (done). Cover is deferred and stays manual for now.
  - **Conditional range changes**, left out of the first phase because they depend on something the module can't see yet: Strong Arm, Supple Wrist (+10 ft after moving 10 ft), Ki Range and the zen archer's ki pool (ki spent for range), Unfolding Wind Strike (Perfect Style active), the musket master's steady aim (a move action), and Bull's Eye (a cursed target).
  - **Thrown weapons at the full rate of attacks.** PF1 gives a full attack with a thrown weapon only one attack, even with Quick Draw ("may throw weapons at his full normal rate of attacks"); allow the iterative attacks when the character has Quick Draw, the quick throwing spell, or a returning weapon.
  - **Later ranged combat work**: gunslinger deeds (Deadeye, Sharp Shoot and others) and misfires with the broken condition; Snap Shot and attacks of opportunity with ranged weapons; ranged combat maneuvers (Ranged Trip, Ranged Disarm, Hammer Throw, Sliding Axe Throw, driving weapons); teamwork shots (Enfilading Fire, Volley Fire, Target of Opportunity, Covering Fire); critical-hit riders (Impact Critical Shot, Penetrating Shot); arcane archer abilities (Seeker Arrow, Phase Arrow, Hail of Arrows, imbue arrow).
  - **Cover-dependent abilities** (with cover deferred): Improved Precise Shot, Pinpoint Targeting (its armor and shield part is done), Lob Shot, Low Profile, Combat Sandals, Volley Fire, Covered Sniper, veering weapons.
- **Cantrips and 1st-level spells** (research: `docs/SPELLS-RESEARCH.md`). Done for the Core Rulebook, Advanced Player's Guide, Ultimate Magic and Ultimate Combat. Still to do:
  - **Other books**: the combat-relevant spells are done; what's left is mostly utility (skill bonuses in narrow situations). Spells whose effect depends on what the creature does (Coward's Cowl, Halfling Vengeance, Veil of Heaven, Burst of Adrenaline) need a design.
  - **Effects that repeat**: afflictions are done (contracting, onset, saves on schedule, effects, cure, poison doses, poisoned weapons, cure spells, Delay and Pernicious Poison, Heal treatment, no natural healing while afflicted); left: *Break Enchantment* against curses and neutralizing a poisonous creature or object. Also: creatures entering or leaving a lasting area (emanations), Entangle's save at the end of each of the caster's turns while in the area, Grease's Acrobatics checks. Chill Touch's further touches (one per caster level).
  - **Higher-level spells**: they already get the rows (spell resistance and saves); their effects come after the 1st-level spells are complete.

## Planned

### Shared engines (ranked by coverage)
The design reference gives every feat, trait, class and archetype feature, racial trait, template, item and spell a rules checklist. Grouping those checklists by the mechanic they share shows which reusable engines would automate the most content. Counts are approximate (pattern matching over about 28,000 entries) and include only entries not automated yet.
1. **Conditional bonuses** (about 3,400 entries). Phase 1 is done: bonuses against creature types, subtypes and alignments written as context notes (attack rolls, weapon damage, AC, CMD, combat maneuver, skill and ability checks, and saves against effects from a kind of creature). Remaining: bonuses with other conditions (opposed checks, critical hits, specific maneuvers, terrain), bonuses to spell DCs, caster level and spell resistance against a kind of creature (with the spells engine), items whose bonus has no context note (Creature Focus, Vengeful Banisher, Planewalker's Insight), and situational bonuses that don't name a creature. Absorbs Alignment-specific bonuses (Buffs and spells), Save bonuses against non-spell effects, and the unified rules layer (Interface).
2. **Damage reduction, energy resistance and immunities granted by features** (about 2,200 entries). Phase 1 is done: core class features, the paladin and antipaladin defenses, sorcerer bloodline resistances and 20th-level powers, and the common templates, with only the best DR counting and DR applied on damage from the card. Remaining: archetype and prestige class features, feats, traits, oracle and other class revelations, magic items, the immunities a creature type gives (undead, construct), immunity to critical hits and sneak attacks (PF1 has no field for it), and DR that the text says stacks.
3. **Save-or-condition effects outside spells** (about 900 entries). Done: abilities with a save get the spell rows, with the effect read from their text. Remaining: effects whose text isn't read yet (about 650 abilities still show "apply by hand"; add corrections as they're found), descriptors for these abilities (mind-affecting, fear) so immunities and save bonuses apply to them, and abilities triggered by another attack's hit (a monster's paralysis on its bite) rather than used on their own.
4. **Healing, temporary hit points and fast healing** (about 900 entries). Fast healing and regeneration are done (applied at the start of the creature's turn). Temporary hit points are left to Nevela's Automation Suite and healing abilities to PF1's buttons; remaining: per-target rows for abilities that heal several creatures, and regeneration stopped by alignment or material (PF1 doesn't type damage by them).
5. **Auras** (about 900 entries, a third of them monster abilities). Phase 1 is done: an aura engine (linked buffs on the creatures inside, kept up to date as tokens move) with paladin and antipaladin auras, Foretell, the enchanter's Aura of Despair, and cleric Aura of Heroism, Protection and Menace. Remaining: auras that force a save or deal damage on entering or at the end of a turn (stench, frightful presence, Heat Aura, Demonic Aura), auras that change how attacks work (Aura of Faith, Aura of Justice, Aura of Sin), the bearer's own benefits from its auras (Aura of Courage's fear immunity, Aura of Righteousness's DR 5/evil), the +2 on caster level checks from Foretell, and drawing the aura's radius on the map.
6. **On-hit riders** (about 730 entries). Phases 1 to 3 are done: critical feats on the card (one per critical, two with Critical Mastery); monster natural-attack riders (grab, trip, pull, push, constrict, paralysis, poison and disease's first save, bleed, attach, energy drain); burn, rend, and the grapple on later rounds (maintain, rake, swallow whole, blood drain). Weapon qualities phase 4a is done (damage qualities, keen, alignment against DR), with the Magic Qualities section on weapons, armor and shields. Phase 4b is done too (wounding, disruption, thundering's deafness, vorpal for the GM, brilliant energy, seeking). Ghost touch is done with the incorporeal damage rule, and phase 4c (speed, furious, defending) too. Remaining: qualities on ammunition and those a launcher passes to it; bane's +2 enhancement counting against damage reduction; the holy and unholy wielder's negative level; extra damage riders (Precise Strike, Vital Strike, Elemental Fist); class features triggered by a confirmed critical (Killing Blow and others); and the mythic versions of the critical feats.
7. **Combat maneuver modifiers** (about 730 entries). Bonuses to specific maneuvers and to CMD against them; largely a case of the conditional bonus engine.
8. **Spell-like abilities granted** (about 700 entries). Create the spell-like ability entries (uses per day, caster level) when the feature, trait or racial trait is added.
9. **Immediate-action reactions** (about 640 entries). Offer the reaction on the triggering event (being attacked, failing a save) with the cost and effect applied.
10. **Activated buffs** (about 600 entries). Using the ability applies its bonus for its duration and spends the use or pool point; generalize the buff-grant engine.
11. **Rerolls and rolling twice** (about 450 entries). Extend the next-roll engine to the remaining feats, class features and traits.
12. **Afflictions** (about 370 entries). The engine is done (see Effects that repeat); individual curses with unusual effects stay manual.

### Magic items
- **Temporary qualities from class features.** Divine bond, arcane pool, sacred weapon and inquisitor bane add abilities or enhancement for a time; they count toward the +10 limit and show in the Magic Qualities section, as the weapon spells already do. Also: weapon spells cast on 50 projectiles.
- **Ammunition.** Qualities and materials on arrows and bolts, the launcher's qualities passing to its ammunition, prices for 50 pieces, and the rule that the launcher's and ammunition's enhancement bonuses don't stack.
- **More armor and shield abilities.** Fortification, shadow, slick, energy resistance, spell resistance and invulnerability are done; next are champion, arrow deflection (with immediate-action reactions), bashing, ghost touch armor and wild.
- **Double weapons.** Each end has its own enhancement, abilities and material (a double weapon with one cold iron end costs 50% more).
- **Adamantine against hardness.** Adamantine weapons ignore hardness below 20 when sundering or attacking objects.
- **Mithral and darkwood on other items.** Priced by weight (500 gp and 10 gp per pound) on items that aren't weapons or armor.

### Interface (from the PF2e design study, `docs/PF2E-UX-STUDY.md`)
- **Spell cards (round 5 of the study).** Hide NPC save totals from players (they see saved or failed); a GM button that rolls every NPC row's save; the save margin in each row; a template helper (target enemies, allies or all inside a placed template, then remove it); retargeting a posted card; draggable condition links in the effect line.
- **Modifiers that mattered.** Note on the card when a ticked bonus changed the outcome ("Bless made this hit", "the +2 against fear made the save").
- **An effects panel.** The selected token's buffs and conditions with time left, click to change a value, right-click to remove, and a tooltip with the source.
- **Concentration reminders.** For spells with a concentration duration, a reminder on the caster's turn that maintaining it is a standard action, with an End button.
- **Richer chat cards.** Show the margin on saves against a DC ("Success by 3"), include a draggable buff link in channel energy and spell notes, and color damage by type.
- **Empty-slot rows and pending-choice highlights.** Show open choices on the character sheet (talent slots, combat style feats, unmade selections) rather than opening dialogs.
- **A unified rules layer.** Several features keep their own rule tables (archetype rules, next-roll effects, buff grants, trait rules, save-bonus keywords). Merging them into one data format ("this item grants X when Y") would let new features be added as data rather than code, and would give the roll window a single source for every situational bonus.

### Combat
- **Skald Damage Reduction (9th level).** PF1's item has no mechanics. "Subtract 1 from the damage ... from a weapon or a natural attack. At 14th and 19th levels ... increases by 1 ... the skald grants this DR to all allies affected by his inspired rage." Grant scaling DR/— to the skald and share it through Inspired Rage.
- **Extra Channel.** "You can channel energy two additional times per day." PF1's feat has no mechanics; add two uses of Channel Energy per instance of the feat.
- **Quarry: automatic critical confirmation** against the quarry, using the same chat-attack integration as Swordlord's Page.

### Classes
- **Bonus spells on level-up.** Add bloodline, mystery, discipline and bloodrager bonus spells at the right class level, and cleric/druid domain spells once they can be cast, using PF1's spell links and domain flag. Witch patron spells and shaman spirit magic need separate handling.
- **Blossoming Light.** 7th level: an extra channel use for a daylight effect. 10th level: *atonement* as a spell-like ability.
- **Battle Scion: Battle Prowess (3rd level and up).** A combat or teamwork feat in place of a rage power, which the skald can grant to allies under inspired rage at a cost of 2 rounds of song per round.
- **Studied Ally (slayer talent).** Study an ally for a bonus on aid another; counts against the slayer's studied targets.
- **Missing bloodline and domain power lists.** 36 PF1 bloodline entries (Orc, Shadow, Phoenix, Djinni and others) and 4 domains don't name their powers, although the power items exist. A curated list mapping each bloodline to its powers is needed, along with power items PF1 lacks (Frog, Aquatic, Swamp and Cave domains, among others).
- **Underwater combat style.** Dolphin Dart, Dolphin Circle, Shark Tear and Shark Leap require their style feat; the combat style picker currently ignores all prerequisites.
- **Variant channeling.** Automate further portfolios as players choose them (Luck is automated; the others display their rules text). The +50% healing or damage against certain creature types is currently a note.
- **Bloodline, domain and school special rules.** Powers are granted automatically, but most of their special rules are reminders. Prioritize the ones in active use.
- **Archetypes.** Structural changes work for all archetypes; add mechanical bonuses to the archetype rules as players choose archetypes.
- **Slayer: Trapfinding talent.** The talent's PF1 item also links Trap Sense. Check the rules text and grant only what the talent provides.
- **Battle Scion: Song of Questing (10th level).** Described within the archetype's Raging Song and mostly narrative; consider listing it in the song picker as a reminder.

### Races
- **Elven Magic.** +2 on caster level checks to overcome spell resistance.
- **Half-orc Ferocity.** Remain conscious below 0 hit points while staggered; must work alongside Nevela's dying and unconscious handling.
- **Heritages that replace Base Statistics** (Sunsoul ifrit, angelkin aasimar and others) should swap the race's ability modifiers. They are currently marked "adjust by hand".

### Buffs and spells
- **Evasion on spell rows.** Apply evasion and improved evasion automatically to Reflex-half rows (no damage on a successful save; half on a failure with improved evasion), only in light or no armor and not while helpless.
- **Multi-ray spells.** Give each ray of scorching ray and similar spells its own attack roll and row, with a target per ray; damage bonuses and sneak attack apply to one ray only (Core Rulebook FAQ), and energy resistance to each.
- **Summoning.** Place summoned creatures when a summoning spell is cast and remove them when it ends, is dispelled, or they drop to 0 hit points; spells they cast end with them. Choosing the creature, its statistics and duration make this a feature of its own. Prior art to study: PF2e Summons Assistant (ChasarooniZ/pf2e-summons-assistant), built on the Foundry Summons module.
- **Held touch spell charges.** A touch spell not discharged in the round it is cast is held until the caster touches something, even by accident, or casts another spell. Show a reminder on the caster while a charge is held, naming the spell and what ends it; touching an enemy in a later round is a standard action and can't be part of a full attack (Core Rulebook FAQ).
- **Alignment-specific bonuses** using the existing ward engine: *Dispel Evil/Good/Law/Chaos* (+4 deflection against that alignment), *Angelic Aspect, Lesser*, and the "against evil" part of *Halo*.
- **Next-roll penalties** using the existing next-roll engine: *Bungle* (−20 on the next roll), *Ill Omen* and *Misfortune* (roll twice and take the worse result, for a number of rolls).
- **Missing buffs:** *Freedom of Movement*, *Shield Other* (half the damage transferred to the caster, which can be automated), *False Life*, *Deathless*, *Transformation*, *Lesser Spell Immunity*.
- **Weapon-specific buffs:** *Align Weapon* (bypasses alignment-based DR) and *Bless Weapon* (automatic critical confirmation against evil). PF1 buffs can't target a single weapon, so these need a design.
- **Save bonuses against non-spell effects.** Monster abilities carry no descriptors in PF1, so a bonus "vs mind-affecting effects" currently applies only against spells. These abilities need a way to declare their descriptors.

### Traits
- **Historian (Human).** Not included in Pathfinder 1e Content; consider shipping it in the module's compendium.
- **Oppressive Expectations and Dependent.** Both trigger on a failed check, so they can only be automated where checks have a DC entered.

## Backlog

### Separate projects
- **Creature Builder (separate module).** Conditional bonuses ("+1 on attack rolls against goblinoids", "+2 against evil creatures") depend on accurate creature types, subtypes and alignment, and NPC sheets built by hand often lack them: a new NPC defaults to true neutral, and some compendium NPCs have no race at all. A separate module would build NPC sheets from stat blocks, PDFs and JSON, and require the values that rules automation depends on (type, subtypes, alignment, templates) before the sheet is created. The existing PF1 Statblock Converter already parses stat blocks and should be evaluated as a starting point.

### Content coverage
- **Foundry vs. Archives of Nethys.** Compare the number of entries per category in Foundry's compendiums with Archives of Nethys to find published content missing from Foundry; content must exist as an item before it can be automated. Reference counts (2026-10-23, about 45,000 entries including about 32,000 items): class features 11,598; feats 3,644; spells 3,111; traits 2,045; racial traits 1,677; archetypes 1,268; prestige classes 119; races 85; base classes 49; equipment about 7,000; monster rules about 2,350; buffs 344; monster and NPC stat blocks 10,387 (journals), 427 actors and 92 traps and haunts.
- **Hero points (optional rule).** Hero points (Advanced Player's Guide) have no rules entry in the design reference yet. Add one covering how they are earned, spent and capped, then link the feats, class features, racial traits and items that grant or spend them, such as Reaver's Scythe, which grants 1 hero point on a kill that is lost if unused within 1 hour.

### Interface research
- **Continue the PF2e comparison.** The study (`docs/PF2E-UX-STUDY.md`) covers the character sheet, level-up, roll windows, chat cards, spells and abilities, and the effects panel. Remaining: how item sheets present their rules.

## Quality and release

### Testing
- **Map-based tests.** Verified with the full party on 2026-10-24: Raging Song (Inspired Rage, Song of Strength, Song of Marching, costs per round, switching and ending), Studied Target at 10th level, Bit of Luck, Resistant Touch, Luck variant channeling on the party, Forewarned and the Prescience offer. Good Fortune and Aura of Protection are handled by PF1 itself.
- **Manual test coverage.** Still to be checked by hand: other races, trait choices, two-weapon fighting variants, harmful channel energy with saves and Selective Channeling, studied target cleanup, archetype removal, player permissions, and several connected clients.
- **Two-Weapon Rend.** Add an automated test for its click-to-roll button.
- **Console error during the quarry tests.** The full suite logs "id … does not exist in the EmbeddedCollection" from the server once per run: a linked buff deleted twice during the quarry tests' cleanup. The tests pass; find which delete races and guard it.
- **Test tooling.** Nevela's Automation Suite cancels targeted buff spells (such as *Haste*) cast without a target, so tests that cast spells must set a target or use a non-buff spell.

### Known issues
- **Test flake: the locked-penalty roll-window test.** "A penalty from another creature's spell is locked like a condition" occasionally fails in a full run (about one run in three) and passes on its own; its failure message now reports the row, the user's GM state and the change's value, to find the cause next time.
- **Snap Shot archers don't threaten.** With Snap Shot, an archer threatens squares within 5 feet (more with Improved Snap Shot), which affects flanking and the warning for shooting while threatened. The Snap Shot feat is also missing from the installed compendiums (only the rogue talent of the same name exists).

### Release readiness
- **Per-feature settings and localization.** On/off settings for each feature and translatable text, for a wider audience.
- **Foundry package listing.** Foundry's AI policy requires human-written item and description text for a listing on foundryvtt.com.
- **Documentation.** Keep the wiki (`wiki/`, published to the repository wiki) current with every feature.
- **Next performance review** after ten more features (0 of 10 so far). Review #4 was completed on 2026-11-16.
