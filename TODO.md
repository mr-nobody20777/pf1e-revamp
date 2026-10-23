# PF1e Revamp – To Do

Ideas and planned work, so nothing gets lost. Newest decisions at the top of each section.
Status: ⬜ not started · 🟨 designed / in progress · ✅ done (move to CHANGELOG, then delete here)

## Next up

- ✅ **Slayer Talent picker + Ranger combat style feats**: built 2026-10-23 (`module/talents.mjs`, in CHANGELOG "Unreleased"). Notes kept below for reference until released.
- (reference) **Slayer Talent picker** (design approved 2026-10-23)
  - Offered in PF1's level-up window at every even slayer level, plus a "Choose talents…" button on the Slayer Talents feature that shows slots used (for catch-up).
  - Each talent gets a ✓ meets / ✗ missing (why) / ? can't tell mark. Advanced talents appear from 10th level. Taken talents are hidden unless repeatable, and talent chains are shown.
  - Follow-up choices happen right away:
    - Ranger Combat Style: style (first time only), then feats from the unlocked tiers, ignoring prerequisites.
    - Rogue Talent / Rogue and Ninja Advanced Talents / Catfolk Rogue Talent: pick from their named lists.
    - Combat Trick / Feat: feat picker with prerequisite marks.
    - Fixed-feat talents add their feat automatically.
    - Toxin Training, Focusing Attack and Terrain Mastery ask their small question.
  - **Shared rogue talents only through the Rogue Talent talent** (user's choice), not listed directly even though PF1 tags them "Slayer Talent".
  - Recorded per slot and undoable.
  - **Picker UI (user's choice, 2026-10-23):**
    - Our own picker with a **search box on every list**. Rogue Talent's 22 names are too many to scroll.
    - Feat lists also get a **"Browse all feats…" button** that opens PF1's Feat Browser, with a short note that the browser **can't check prerequisites**.
- (reference) **Ranger Combat Style** (user: "knock out Ranger too")
  - Style chosen at 2nd. Bonus feats at 2/6/10/14/18 from the unlocked style tiers (2/6/10), ignoring prerequisites.
  - Benefits only in light/medium/no armor, so add a reminder, maybe automate later.
  - Shares the style-list parser with the slayer's Ranger Combat Style talent.
- ⬜ **Sneak attack automation**: PF1 doesn't automate sneak attack at all (user: "add that to the list")
  - When it applies: flanking, target flat-footed or denied Dex, within 30 ft for ranged, not immune to precision damage / concealed.
  - Dice from class levels (rogue, slayer at 3rd+, ninja, etc.).
  - Then the sneak-attack talents: Bleeding Attack, Slowing Strike, Deadly Range, Powerful Sneak, Assassinate, Shadow's Chill, Knock-Out Blow... (only one per attack).
  - Check Nevela's flanking (it has `preEnableFlankingCheck`) and Roll Bonuses before building, to avoid overlap.

## Buffs and spells
- ⬜ Alignment-conditional bonuses, reusing the ward engine: Dispel Evil/Good/Law/Chaos (+4 deflection vs that alignment), Angelic Aspect (Lesser), Halo's "vs evil" part.
- ⬜ Next-roll effects, reusing fortune.mjs `NEXT_ROLL`: Bungle (−20 next roll), Ill Omen / Misfortune (roll twice, take the worse, N rolls).
- ⬜ Missing buffs: Freedom of Movement, Shield Other (half the damage moves to the caster: very automatable), False Life, Deathless, Transformation, Lesser Spell Immunity.
- ⬜ Weapon buffs: Align Weapon (bypass alignment DR), Bless Weapon (auto-confirm crits vs evil). PF1 buffs can't target one weapon, so this needs a design.
- ⬜ Save bonuses vs **non-spell** effects: monster abilities have no descriptors in PF1, so "vs mind-affecting effects" only matches spells. Find a way to describe abilities' descriptors.

## Classes
- ⬜ **Bonus spells on level-up** (designed 2026-10-22, tabled as lower priority): bloodline/mystery/discipline/bloodrager spells at class level; cleric/druid domain spells once castable. Parse PF1's @UUID spell lists and add with PF1's `system.domain` flag. Witch patron spells and shaman spirit magic need separate handling.
- ⬜ Foretell (Foresight, 8th level): PF1's uses formula is "Int mod" but RAW is rounds per day = wizard level. Fix before the party's wizard hits 8th.
- ⬜ Blossoming Light 7th level (extra channel use for a daylight effect) and 10th (atonement SLA).
- ⬜ Battle Scion Battle Prowess (3rd+): combat/teamwork feat instead of a rage power, grantable to allies under inspired rage at 2 rounds of song per round.
- ⬜ Studied Ally (slayer talent): study an ally; +bonus on aid another. Counts against studied targets.
- ⬜ Quarry: auto-confirm crits against the quarry. Now possible with the ChatAttack wrapper that Swordlord's Page uses (it was a reminder note before).
- ⬜ **Missing bloodline power lists** (data sweep 2026-10-23): 36 PF1 bloodline entries (Orc, Shadow, Phoenix, Djinni…) and 4 domains never name their powers; the power items exist but are untagged. Needs a hand-written bloodline → powers map (like `EXTRA_POWERS`). Also domain powers PF1 lacks as items (Frog, Aquatic, Swamp, Cave…).
- ⬜ Underwater combat style: Dolphin Dart/Circle and Shark Tear/Leap still need their style feat; the picker currently ignores all prerequisites.
- ⬜ Heritages that replace "Base Statistics" (Sunsoul Ifrit, Angelkin Aasimar…) should swap the race's ability modifiers; now flagged "adjust by hand".
- ⬜ Variant channeling: automate other portfolios as players pick them (only Luck is automated; the rest show their text). The +50% "enhanced" healing/damage vs creature types is a note only.
- ⬜ Other bloodlines/domains/schools: powers are granted, but their special rules are mostly reminders. Prioritize what players actually use.
- ⬜ Other archetypes: the structural changes work; write bonuses into `archetype-rules.mjs` as players pick them.

## Races
- ⬜ Creature-type combat bonuses: Dwarf/Gnome **Hatred** (+1 attack vs subtypes), **Defensive Training** (+4 dodge AC vs giants, shown like the wards on attack cards). Also covers trait/feat "vs favored enemy" bonuses.
- ⬜ Elven Magic: +2 on caster level checks to overcome spell resistance (automatic on SR checks?).
- ⬜ Half-Orc Ferocity (keep fighting below 0 HP, staggered). Interacts with Nevela's dying/unconscious handling.

## Traits
- ⬜ "Historian (Human)" (a party trait) isn't in pf-content; the player needs a hand-made item. Consider shipping it in the module's compendium.
- ⬜ Oppressive Expectations / Dependent: only if the table enters DCs on checks (both trigger on failure).

## From manual QA (2026-10-23, QA/2026-10-23/MANUAL-QA.md)
- ⬜ Channel Energy refunded (no token / cancelled checklist): PF1's chat card still shows the pre-refund uses (e.g. 2/3).
- ⬜ Pickers: clicking Choose with nothing selected silently does nothing; say "Pick one first".
- ⬜ QA coverage still pending: other races, trait choices, two-weapon variants, channel harm/saves/Selective Channeling, studied target cleanup, archetype removal, player permissions, multi-client.

## Quality and release
- ⬜ **Performance review #3** at 10 features since review #2 (count: opposition schools, Blossoming Light L3, racial traits, save bonuses, character traits, slayer talents/ranger styles, variant channeling = 7/10).
- ⬜ Test Two-Weapon Rend's click-to-roll button (never covered by a test).
- ⬜ Per-feature on/off settings and localizable strings (for a wider audience).
- ⬜ If ever listing on foundryvtt.com: Foundry's AI policy requires human-written item and description text.
- ⬜ Keep the wiki in step with every feature (source: `wiki/`, pushed to the `.wiki.git` repo).
