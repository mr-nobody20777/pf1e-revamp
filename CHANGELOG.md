# Changelog

## Unreleased

### New
- **Buffs on a roll.** Attack, save and skill windows show what PF1's buffs and conditions add to the roll. A few show as chips you can untick; more than that (4 by default, a per-player setting) show as totals with a **Manage…** window that groups them by attack, damage or both, combines ability-score buffs, and lists what's **Not Applied**: bonuses beaten by a higher one of the same type, and situational ones that don't apply right now. Changes apply to that roll only and show on the chat card as one labeled part. Conditions can only be turned off by the GM. Ability checks get the same line. Alignment wards and save bonuses against effects ("+2 vs fear") are listed too: when the save isn't rolled from a matching effect's card they show as Not Applied with the reason, and can be ticked by hand.
- **Variant channeling** (optional rule from *Ultimate Magic*, off by default under Settings). New clerics choose standard channel energy or one of 45 portfolio variants in the level-up window; existing channelers choose once from Channel Energy's note, and the choice locks (the GM can reset it). Healing with positive energy or harming with negative energy is halved per the rules (on PF1's own card, so chat shows one number, and never below 1). The choice appears on the sheet as a "Variant Channeling (portfolio)" class feature with its rules text. **Luck** is fully automated: healed creatures get a one-roll bonus, and the negative-energy version applies a d20 penalty unless the save succeeds.
- **Searchable dropdowns everywhere.** Any list the module adds with more than 10 options has a search box: bloodlines, domains, arcane schools, the new channeling choice, and long trait choices (like Gifted Adept's spell list).

- **One-roll bonuses are the player's choice.** Guidance, True Strike and the Luck channel bonus show as a ticked box in every roll window (attack, save, skill, ability check); untick it to roll without it and keep the bonus for later.

### Changed
- **Every window the module opens names the creature it's for** ("Choose a slayer talent (level 4) – Kestrel", "Channel Positive Energy – Sister Aurel"), like PF1's own roll windows.
- **Controls that can't be used say why.** The talent/feat picker's Choose button stays off until you pick something ("Pick one first"); greyed-out archetype rows, channel-energy targets, racial ability choices and the off-hand weapon list explain themselves on hover.
- **Saving throws from a card warn when they'd roll for the wrong creature.** PF1's save button rolls for whatever token is selected; if that isn't one of the card's targets, you're told who it's rolling for (the roll still goes ahead).
- Studied Target, Quarry and the Weapon Finesse shield penalty appear in the roll window (the shield penalty only the GM can turn off). Studied Target and Quarry and can be left out of a roll. When no studied creature or quarry is targeted, they're listed as Not Applied and can be ticked by hand (for theater-of-mind play).
- **Halved damage and healing never go below 1.** PF1's ½ buttons (and any ratio in its Apply Damage dialog) used to turn 1 point into nothing; a save for half on channel energy too. Per the core rule, damage and hit points have a minimum of 1.
- Channel energy no longer posts its own summary message; PF1's card shows the amount and saves have their own cards. The request to the GM is whispered and removed once applied.

### Fixed
- **Halved damage against resistance with Nevela's Automation Suite.** Its chat-card damage buttons set the ½ ratio without recomputing PF1's reductions, so immunity, DR and energy resistance were worked out on the unhalved damage and then halved again: 6 slashing + 4 fire, halved, against fire resistance 10 dealt 1 instead of 3. Such targets are now recomputed with PF1's own method; PF1's normal path is unaffected.
- **Energy resistance on halved damage.** With the ½ button, damage is now halved before resistance is subtracted (the common reading, as the rules don't specify): 20 fire, saved for half, against fire resistance 10 is fully resisted instead of dealing 5. The private note now shows the damage actually taken. Damage of several types is split so each type gets its proportional share of the halved total (an immunity to one type no longer cancels the others); when PF1 doesn't say how much of each type there was, the amounts are read from the attack card, or the damage is left for the GM rather than guessed. Later hooks still see the ½ ratio.
- **Conditional save bonuses and penalties are no longer applied automatically.** Notes such as "+1 vs charm and compulsion effects if a partner is within 60 feet" (Tight Bonds), "−2 vs fear effects whenever the object of your attachment is threatened" (Attached) or "vs effects created by outsiders" were applied to every matching save. They now appear under Not Applied with their condition, to be ticked when it applies. Their "only vs …" text is also tidier.
- Double Slice uses the off-hand weapon's damage ability, and the Strength modifier after any buff left out of the roll in the roll window.
- Character trait choices: when a choice has nothing available yet, Save is greyed out and says why, instead of doing nothing.
- Racial trait review: a search box filters long trait lists (humans have dozens of alternate traits).
- Studied Target's indicator buffs escape creature names in their descriptions.
- **One-roll bonuses follow the stacking rules.** Guidance (+1 competence) adds nothing beside a higher competence bonus such as Inspire Courage, so it's no longer offered or used up on that roll; it waits for one where it helps. True Strike and the Luck channel bonus are capped the same way.
- Luck variant channeling: a creature harmed by two channels in a row had two penalties; the second channel now refreshes the first.
- Saves: a bonus vs fear beaten by a higher bonus of the same type (Bless's +1 morale beside Greater Heroism) said "only vs fear" even against a fear effect; it now says a higher morale bonus already applies.
- Racial trait review: a standard trait's ability choice is greyed out when the trait is unticked, including when an alternate unticks it for you.
- A feature granted twice at different levels by an archetype or subclass (the same item at, say, 1st and 5th) could have both copies recorded at one level.
- The one-time repair that ties older bloodlines, domains and schools to their class ran on every world load; it now runs once per world.
- **Quarry and True Strike no longer stack.** Both are insight bonuses, so only the higher counts: an attack with True Strike gets +20, not +22 (or +24 with Improved Quarry); Quarry still applies to the rest of a full attack. Quarry also defers to any other insight bonus on attacks the slayer already has.
- Bloodlines, domains and schools are now tied to their class, so their formulas scale: the Protection domain's resistance bonus stayed +1 instead of +1 per 5 levels (+3 at 10th). Existing characters are repaired when the GM next loads the world.
- Foretell (Foresight subschool) lasts rounds per day equal to wizard level; PF1's data used the Int modifier.
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
