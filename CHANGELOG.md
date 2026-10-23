# Changelog

## Unreleased

### New
- **Variant channeling** (optional rule from *Ultimate Magic*, off by default under Settings). New clerics choose standard channel energy or one of 45 portfolio variants in the level-up window; existing channelers choose once from Channel Energy's note, and the choice locks (the GM can reset it). Healing with positive energy or harming with negative energy is halved per the rules (on PF1's own card, so chat shows one number), and the summary shows the portfolio's effect. The choice appears on the sheet as a "Variant Channeling (portfolio)" class feature with its rules text. **Luck** is fully automated: healed creatures get a one-roll bonus, and the negative-energy version applies a d20 penalty unless the save succeeds.
- **Searchable dropdowns everywhere.** Any list the module adds with more than 10 options has a search box: bloodlines, domains, arcane schools, the new channeling choice, and long trait choices (like Gifted Adept's spell list).

- **One-roll bonuses are the player's choice.** Guidance, True Strike and the Luck channel bonus show as a ticked box in every roll window (attack, save, skill, ability check); untick it to roll without it and keep the bonus for later.

### Fixed
- The arcane school picker for a new wizard only listed subschools; the nine regular schools are back.
- Opposition schools no longer offer "Miscellaneous", which isn't a school.

## 0.18.0: slayer talents, ranger styles, read-before-you-choose, and a round of fixes

### New
- **Slayer talent picker.** It appears in PF1's level-up window at every even slayer level, and on the Slayer Talents feature for catching up.
  - It has a search box, and marks each talent with requirements met / not met / check manually. Advanced talents show from 10th level.
  - Follow-up choices are asked right away:
    - **Ranger Combat Style**: the style, then a feat with prerequisites ignored; the 6th- and 10th-level lists open when it's taken again.
    - **Rogue Talent**, plus the advanced and catfolk variants. Shared rogue talents are only offered through it.
    - **Combat Trick** and **Feat**: feat picker with prerequisite marks, plus a "Browse all feats" button that opens PF1's Feat Browser.
    - Grit, Toxin Training, Focusing Attack and Terrain Mastery ask their own question.
  - Talents that grant a specific feat add it. Deleting a talent removes the feats it brought.
- **Read before you choose.** Every option in the module's pickers has a 📖 icon that opens the full entry: talents, feats, combat styles, racial traits, archetype features, bloodline/domain/school powers. Level-up dropdowns get one icon for the selected entry.
- **Ranger combat style feats** at 2nd/6th/10th/14th/18th level: choose the style once, then feats from the lists unlocked at your level, prerequisites ignored.

### Fixed
- From manual QA:
  - Racial trait review: **Not now** after "Review again…" no longer removes your existing traits and ability bonus. The old choice is undone only when a new one is applied, and the review opens with your current choices ticked.
  - Two alternate traits that replace the same trait (Heart of the Mountains and Heart of the Streets) can't both be taken; ticking one unticks the other, and unticking an alternate gives back what it replaced.
  - Dual Talent and other "two different ability scores" picks start on different abilities and can't be set to the same one (it gave +4 to one score).
  - Channel Energy's use dialog no longer starts with "Measure Template" ticked.
- Found by sweeping every compendium entry through the module's parsers:
  - Feat prerequisites: skill ranks, races, size, base saves, Hit Dice, "ability to cast … spells", class features and "X or Y" are now checked. Things that aren't feats are no longer marked ✗ "feat not found" (1,302 wrong marks across 3,564 feats). Feat names containing "and" (Craft Magic Arms and Armor) are no longer split in two.
  - Rogue and Ninja Advanced Talents now offers Evasion (Trick) and, as the rules allow, any rogue advanced talent. The talent lists are read from the entries' links instead of matching names.
  - Underhanded and Underwater combat styles were missing their first feat list.
  - Racial trait review: alternates that replace several traits separated by semicolons now replace all of them. "Language" matches "Languages". Replaced items that aren't trait items ("Base Statistics", or a trait pf-content lacks) are marked "adjust by hand".
  - Bloodline/domain/school review: power names no longer pick up headings ("Solitude Domain Powers Resistant Touch"); powers found under a slightly different name aren't reported missing; Fey Bloodline's Woodland Stride arrives at 3rd level, not 1st.
  - Bloodlines whose PF1 entry doesn't list its powers (Orc, Shadow and 34 others) now say so, instead of opening an empty review.
- Feat prerequisite marks:
  - Shield, armor, simple and martial weapon proficiency now count however you got them, not only as a feat (a slayer's class shield proficiency qualifies for Shield Focus).
  - "8th-level fighter" checks fighter levels, not character level.
  - "Light Armor Proficiency, Medium Armor Proficiency" is read correctly.
  - Requirements that depend on your choice ("Weapon Focus with selected weapon") say "check manually" instead of ✗.
- Level-up choices (slayer talent, ranger style feat, sorcerer bonus feat, a new class's bloodline/domain/school) could be lost when leveling the same class twice within about 10 seconds: closing the previous level-up window cleared the next one's choice.
- Racial trait review: Adoptive Parentage (Weapon Focus) and 14 Changeling and Dhampir heritage traits showed as standard traits instead of alternates, because their "Replaced Trait(s)" label is formatted differently in pf-content.
- Archetype features and bloodline/domain/school powers added together could occasionally be recorded at each other's levels, because Foundry doesn't always return new items in the order they were requested. Leveling down then removed the wrong ones.

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
