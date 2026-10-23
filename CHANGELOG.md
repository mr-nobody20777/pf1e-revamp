# Changelog

## 0.17.0: first public test release

The first release for testing at a real table. Built and tested on Foundry VTT v13 (build 351) with the Pathfinder 1e system 11.11.

### What's included

**Character options**
- Archetype application with real mechanical changes: altered features are renamed "Feature (Archetype)" and changed, restatements are merged instead of duplicated, and removal restores everything. Mechanics are written out for Battle Scion, Blossoming Light and Chronomancer.
- Bloodline, domain, arcane school and subschool powers granted at the right levels. Specialist wizards pick opposition schools, whose spells cost two slots.
- Racial trait review with standard and alternate traits, the "+2 to one ability of your choice" picker, real energy resistance from racial traits, and no double-counted race bonuses.
- Energy resistances to the same energy never stack (highest only).
- Character traits: Criminal, Dilettante Artist, Magical Knack (with its Hit Dice cap), Gifted Adept, Swordlord's Page, Student of Philosophy ("with Int" second total).

**Combat**
- Two-weapon fighting (penalties, off-hand attacks, Improved/Greater TWF, Double Slice, Two-Weapon Defense, Two-Weapon Rend).
- Shield bashes: fixes PF1's −4 penalty; Shield-Trained; Weapon Finesse with light bashes.
- Miss chances rolled on attack cards (Blur, Displacement, Blink, Entropic Shield and more), with true seeing, see invisibility and Blind-Fight handled.
- Alignment wards: AC and save bonuses against the opposed alignment only.
- Save bonuses against effects (fear, poison, enchantment, charm, mind-affecting, death, spells...) from racial traits, character traits and buffs, following PF1's stacking rules. A racial bonus stated on both the race and one of its traits counts once.
- Next-roll effects: True Strike, Guidance, Bit of Luck, Prescience.
- Energy resistance and immunity on quick-applied damage.

**Class features**
- Cleric: Channel Energy (burst targeting, automatic healing and Will saves, Selective Channeling, Blossoming Light), Spontaneous Casting, Bit of Luck, Resistant Touch.
- Skald: Raging Song with target checklist, per-round costs and deafness failure.
- Slayer: Studied Target, Quarry, Improved Quarry.
- Sorcerer: bloodline powers (Solar fully supported), bloodline bonus-feat picker.
- Wizard: Chronomancer Temporal Pool (Forewarned, Rewind), Foresight subschool, opposition schools.

### Testing
- 113 automated tests (Quench), all passing.
- GM-relay features played through as a non-GM player.
- Two performance reviews: the module's share of a simulated session is 0.20%.

### Known limitations
- Save bonuses only apply when the save is rolled from the effect's chat card (PF1's save button).
- Blossoming Light's channel energy can't detect "worshipers of chaotic evil deities"; the GM applies those by hand.
- Oppressive Expectations and Dependent stay as reminder notes, since they trigger on a failed check and most checks in play have no DC entered.
- Archetypes other than Battle Scion, Blossoming Light and Chronomancer get structural changes and renamed features, but their bonuses aren't written out yet.
