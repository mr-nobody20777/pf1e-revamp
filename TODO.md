# PF1e Revamp – Roadmap

Planned work for PF1e Revamp, grouped by status. Completed work is recorded in the [CHANGELOG](CHANGELOG.md); design rulings are recorded in [DECISIONS](DECISIONS.md).

## In progress

### Roll windows and chat cards
The roll-window buff manager ("Buffs on a roll") is released in the Unreleased section of the changelog. Remaining work:
- **Mark applied reminders on save cards.** PF1 prints reminder notes such as "+3 vs fear effects" on save cards even when PF1e Revamp has already added that bonus to the roll, so a player could add it twice. Notes the module applied should be marked as applied.
- **Debuffs cast by another creature.** Penalties from buffs cast by someone else (for example *Bane*) should be locked like conditions, so only the GM can remove them from a roll. PF1 buffs don't record their caster, so this needs a way to track the source.
- **Compatibility with Roll Bonuses.** Confirm that bonuses added by the Roll Bonuses module are never counted twice.
- **Clearer locked rows.** In the dark theme, a locked condition and a locked Not Applied row look alike; give locked rows a distinct style.
- **Cleaner chat-card labels.** When a buff is turned off for a roll, the card shows both PF1's "+1 [Haste]" and the correction "−1 [Buffs: Haste off]". Both are correct, but a single line would read better.

## Planned

### Interface (from the PF2e design study, `docs/PF2E-UX-STUDY.md`)
- **Richer chat cards.** Show the margin on saves against a DC ("Success by 3"), include a draggable buff link in channel energy and spell notes, and color damage by type.
- **Empty-slot rows and pending-choice highlights.** Show open choices on the character sheet (talent slots, combat style feats, unmade selections) rather than opening dialogs.
- **A unified rules layer.** Several features keep their own rule tables (archetype rules, next-roll effects, buff grants, trait rules, save-bonus keywords). Merging them into one data format ("this item grants X when Y") would let new features be added as data rather than code, and would give the roll window a single source for every situational bonus.

### Combat
- **Sneak attack.** PF1 does not automate sneak attack. Apply it when the target is flanked, flat-footed or denied its Dexterity bonus, or within 30 ft for ranged attacks, and not when the target is immune to precision damage or concealed. Dice come from class levels (rogue, ninja, slayer from 3rd level). Then support the sneak attack talents (Bleeding Attack, Slowing Strike, Deadly Range, Powerful Sneak, Assassinate, Shadow's Chill, Knockout Blow), one per attack. Check overlap with Nevela's flanking detection and Roll Bonuses first.
- **Skald Damage Reduction (9th level).** PF1's item has no mechanics. "Subtract 1 from the damage ... from a weapon or a natural attack. At 14th and 19th levels ... increases by 1 ... the skald grants this DR to all allies affected by his inspired rage." Grant scaling DR/— to the skald and share it through Inspired Rage.
- **Extra Channel.** "You can channel energy two additional times per day." PF1's feat has no mechanics; add two uses of Channel Energy per instance of the feat.
- **Foretell (Foresight subschool, 8th level).** An aura that either aids allies (+2 luck bonus on ability checks, attack rolls, caster level checks, saving throws and skill checks within 30 ft) or hinders enemies (−2), at the wizard's choice, for rounds per day equal to wizard level. This can reuse the Raging Song engine (target checklist, one round spent per round).
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
- **Creature-type combat bonuses.** Hatred (+1 on attack rolls against certain subtypes) and Defensive Training (+4 dodge bonus to AC against giants, shown on attack cards like alignment wards). The same mechanism covers trait and feat bonuses against favored enemies.
- **Elven Magic.** +2 on caster level checks to overcome spell resistance.
- **Half-orc Ferocity.** Remain conscious below 0 hit points while staggered; must work alongside Nevela's dying and unconscious handling.
- **Heritages that replace Base Statistics** (Sunsoul ifrit, angelkin aasimar and others) should swap the race's ability modifiers. They are currently marked "adjust by hand".

### Buffs and spells
- **Alignment-specific bonuses** using the existing ward engine: *Dispel Evil/Good/Law/Chaos* (+4 deflection against that alignment), *Angelic Aspect, Lesser*, and the "against evil" part of *Halo*.
- **Next-roll penalties** using the existing next-roll engine: *Bungle* (−20 on the next roll), *Ill Omen* and *Misfortune* (roll twice and take the worse result, for a number of rolls).
- **Missing buffs:** *Freedom of Movement*, *Shield Other* (half the damage transferred to the caster, which can be automated), *False Life*, *Deathless*, *Transformation*, *Lesser Spell Immunity*.
- **Weapon-specific buffs:** *Align Weapon* (bypasses alignment-based DR) and *Bless Weapon* (automatic critical confirmation against evil). PF1 buffs can't target a single weapon, so these need a design.
- **Save bonuses against non-spell effects.** Monster abilities carry no descriptors in PF1, so a bonus "vs mind-affecting effects" currently applies only against spells. These abilities need a way to declare their descriptors.

### Traits
- **Historian (Human).** Not included in Pathfinder 1e Content; consider shipping it in the module's compendium.
- **Oppressive Expectations and Dependent.** Both trigger on a failed check, so they can only be automated where checks have a DC entered.

## Backlog

### Content coverage
- **Foundry vs. Archives of Nethys.** Compare the number of entries per category in Foundry's compendiums with Archives of Nethys to find published content missing from Foundry; content must exist as an item before it can be automated. Reference counts (2026-10-23, about 45,000 entries including about 32,000 items): class features 11,598; feats 3,644; spells 3,111; traits 2,045; racial traits 1,677; archetypes 1,268; prestige classes 119; races 85; base classes 49; equipment about 7,000; monster rules about 2,350; buffs 344; monster and NPC stat blocks 10,387 (journals), 427 actors and 92 traps and haunts.

### Interface research
- **Continue the PF2e comparison.** The first study (`docs/PF2E-UX-STUDY.md`) covers the character sheet, level-up, roll windows and chat cards. Remaining areas: the effects panel, targeting, and how item sheets present their rules.

## Quality and release

### Testing
- **Map-based tests.** Several features need tokens placed by a GM and haven't yet been verified with the full party: Raging Song (Inspired Rage, Marching, Strength), Studied Target scaling (+3 at 10th level, additional targets), Bit of Luck, Resistant Touch with the +3 domain bonus, Good Fortune, Aura of Protection, Forewarned on initiative, and Luck variant channeling on the party.
- **Manual test coverage.** Still to be checked by hand: other races, trait choices, two-weapon fighting variants, harmful channel energy with saves and Selective Channeling, studied target cleanup, archetype removal, player permissions, and several connected clients.
- **Two-Weapon Rend.** Add an automated test for its click-to-roll button.
- **Test tooling.** Nevela's Automation Suite cancels targeted buff spells (such as *Haste*) cast without a target, so tests that cast spells must set a target or use a non-buff spell.

### Known issues
- **Channel Energy refunds.** When a channel is cancelled or the cleric has no token, the use is refunded, but PF1's chat card still shows the uses remaining before the refund.

### Release readiness
- **Per-feature settings and localization.** On/off settings for each feature and translatable text, for a wider audience.
- **Foundry package listing.** Foundry's AI policy requires human-written item and description text for a listing on foundryvtt.com.
- **Documentation.** Keep the wiki (`wiki/`, published to the repository wiki) current with every feature.
- **Next performance review** after ten more features (0 of 10 so far). Review #3 was completed on 2026-10-24.
