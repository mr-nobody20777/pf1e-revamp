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

## From leveling the party to 10 as a player (2026-10-23)
- ⬜ **Skald Damage Reduction (9th)**: PF1's item has no mechanics. RAW: "Subtract 1 from the damage ... from a weapon or a natural attack. At 14th and 19th levels ... increases by 1 ... the skald grants this DR to all allies affected by his inspired rage." Grant DR 1/— (scaling) on the skald and share it through Inspired Rage. Needs a design (rules check first).
- ⬜ **Extra Channel**: "You can channel energy two additional times per day." PF1's feat has no mechanics and PF1's channel formula ignores it. Count +2 per Extra Channel in Channel Energy's uses.
- ⬜ **Foretell aura (Foresight, 8th)**: aid (+2 luck on ability/attack/CL/save/skill for you and allies within 30 ft) or hinder (−2 for enemies), the wizard's choice, rounds/day = wizard level (uses now fixed). Could reuse the raging-song engine: checklist, 1 round per round. Needs a design.
- ⬜ **Slayer Trapfinding talent also adds Trap Sense** (PF1 item links). Check the RAW text: the talent grants trapfinding only?
- ⬜ **Song of Questing (Battle Scion, 10th)** is described inside the archetype's Raging Song; it's narrative (like geas/quest). Maybe list it in the song picker as a reminder (4 rounds).
- ⬜ **Map-phase tests still pending** (players can't place tokens in this world; needs the GM to place the party): Raging Song (Inspired Rage, Marching, Strength), Studied Target scaling (+3 at 10th, more targets), Bit of Luck, Resistant Touch with the +3 domain bonus, Good Fortune, Aura of Protection, Forewarned on initiative, channel with the Luck variant on the party.
- ⬜ Test tooling: Nevela's suite cancels targeted buff spells (e.g. Haste) without a target; cast-tests need a target or a non-buff spell.

## From manual QA (2026-10-23, QA/2026-10-23/MANUAL-QA.md)
- ⬜ Channel Energy refunded (no token / cancelled checklist): PF1's chat card still shows the pre-refund uses (e.g. 2/3).
- ⬜ Pickers: clicking Choose with nothing selected silently does nothing; say "Pick one first".
- ⬜ QA coverage still pending: other races, trait choices, two-weapon variants, channel harm/saves/Selective Channeling, studied target cleanup, archetype removal, player permissions, multi-client.

## Architecture and UX research
- ⬜ **One data-driven rules layer, PF2e "rule element" style** (user: "very, very good point", 2026-10-23). We keep five separate rule tables (ARCHETYPE_RULES, fortune NEXT_ROLL, buff-grants GRANTS, traits RULES, save-bonus KEYWORDS). Merge them into one format ("this item gives X when Y", with conditions as data) so new features become data entries instead of code. Look at it during performance review #3.
- ⬜ **Compare PF1e vs PF2e in Foundry: UI design and automation** (user's focus). How PF2e presents things to players: the roll/modifier dialog with toggles, chat cards (degree of success, apply-damage buttons), effect/condition panel, character builder (ABC), targeting, item sheets' rule displays. List what we can borrow for PF1e Revamp's UI.

- ⬜ **Coverage gap check: Foundry vs. Archives of Nethys** (user asked, 2026-10-23). Compare Foundry's compendium counts per category with AoN's to find published content missing from Foundry entirely (it can't be automated until it exists as an item; e.g. 36 bloodlines' power links, "Historian (Human)", domains without power items). Foundry counts on 2026-10-23 (this world's packs, ~45,000 entries, ~32,000 items): class features 11,598 (PF1 4,651, archetype features 4,824, prestige features 1,308, pf-content 767); feats 3,644; spells 3,111; traits 2,045; racial traits 1,677; races 85; archetypes 1,268; prestige classes 119; base classes 49; equipment ~7,000; monster rules ~2,350; buffs 344; monster/NPC statblocks 10,387 (journals) plus 427 actors and 92 traps/haunts.

## Quality and release
- ⬜ **Performance review #3** at 10 features since review #2 (count: opposition schools, Blossoming Light L3, racial traits, save bonuses, character traits, slayer talents/ranger styles, variant channeling = 7/10).
- ⬜ Test Two-Weapon Rend's click-to-roll button (never covered by a test).
- ⬜ Per-feature on/off settings and localizable strings (for a wider audience).
- ⬜ If ever listing on foundryvtt.com: Foundry's AI policy requires human-written item and description text.
- ⬜ Keep the wiki in step with every feature (source: `wiki/`, pushed to the `.wiki.git` repo).
