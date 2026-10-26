# What makes PF2e in Foundry feel good: a UX study

2026-10-23. A character ("Claude", Human Skilled Human / Acolyte / Fighter) was built from a blank sheet in the project lead's real PF2e game (Year of Exploration on The Forge: Foundry v14.367, PF2e 8.6.1, 46 modules). The goal was to study design and ease of use, not rules. Everything below is the PF2e system itself unless marked (module).

## Principles

1. **The sheet is the guide.** A blank sheet shows empty Ancestry / Heritage / Background / Class / Deity slots in build order, each with a 🔍. You never need to know where to drag something.
2. **Never block; flag what's pending.** Choosing an ancestry opens no dialog. The sheet updates in place, and unfinished parts are marked: an "UNALLOCATED" chip on Languages, a **glowing orange Edit** on Attribute Modifiers. The glow disappears when the task is done, so the sheet works as a self-clearing checklist.
3. **Leveling is a number.** No level-up wizard. Change the level and HP/AC/saves recalculate, and new choices appear as **"2 · Empty Slot 🔍" rows** in the Feats tab, at the level they belong to.
4. **One generic choice dialog, driven by item data.** Any item with a choice (Skilled Human's skill, Fighter's skill) uses the same tiny dialog: the item's name, one question, one control. The control **adapts to the number of options**: two big one-click buttons for 2 options, a type-to-filter dropdown (with highlighted matches) for many.
5. **Only legal options are clickable.** The attribute-boost grid enables just the valid cells per source (Acolyte: Int or Wis, then a free boost; Fighter key: Str or Dex) and fades the rest. Counters show picks remaining per row, and future levels are visible but disabled.
6. **Live preview.** While assigning boosts, the sheet behind updates in real time (HP, AC, Perception).
7. **One browser, context presets.** An empty feat slot opens the general Compendium Browser **pre-filtered for that slot** (trait FIGHTER, DEDICATION excluded, category Class Feat, level ≤ 1). Filters are editable chips (negate ⊘ / remove ×, All/Any). You add an entry by dragging it onto the slot, and a toast confirms where it went ("Sudden Charge was added to Class Feats").
8. **Show provenance.** Granted items nest under their source with a connector line (Shield Block under the Shield Block class feature). The background's skill feat is labeled **BG**, and a choice is written into the item name ("Skilled Human (Athletics)").
9. **Itemized, toggleable modifiers.** The roll dialog lists every modifier on its own line with an ON/OFF switch and a **type badge** (ATTRIBUTE, PROFICIENCY). Unused alternatives are shown struck through (Dexterity, when Str applies). You can add a typed one-off modifier, pick Keep Higher / Normal / Keep Lower, and the Roll button shows the total ("Roll (+8)").
10. **Precompute the common cases.** Each strike is a row of buttons: STRIKE +8 · +4 (MAP −4) · +0 (MAP −8) · DAMAGE · CRITICAL.
11. **A consistent visual language.** Trait/rarity **chips** are everywhere (sheet, browser, item sheet, chat card). Proficiency badges are color-coded (grey untrained, blue trained, purple expert). Action-cost glyphs (◆◆, ↺) and a pinned red sidebar for core stats.
12. **Compact chat cards with next steps.** Trait chips, modifier chips (Strength +3 · Expert +5), the formula, a big total, then Damage / Critical buttons. A gentle nudge instead of a block ("Please target before you attack"); with a target, the result is graded against AC.
13. **Pickers read well.** Portrait art, name, source book, rarity badge, ✓ choose and 📄 read buttons; common entries first. Context-aware ordering: the Heritage list shows Human heritages first, then versatile ones.

## Round 2: playing with the sheet (gear, conditions, combat)

14. **Browse buttons know what you want.** Each inventory section's Browse opens the Compendium Browser already filtered (Weapons → weapon + shield). A bulk bar and an "Invested 0/10" counter keep the limits visible.
15. **Carry state is one click, with context.** A hand icon on each item opens a small popover: Held in 1 / 2 hands, Worn, Stowed, Dropped. Armor gets "Worn (Armor)" (the slot that counts). Choosing it updates AC (15 → 18) and bulk right away, and a worn shield adds its own sidebar block (Hardness, HP, Broken).
16. **Every number explains itself.** Hovering AC shows a tooltip listing each modifier with its type, plus a row to add a typed custom modifier on the spot. The tooltip doubles as the editor.
17. **Valued conditions have steppers.** Frightened 1 appears with + / − / 🗑 on the Effects tab. The penalty lands everywhere it applies (strikes, skills, AC) and shows up by name in every roll dialog and chat card ("Frightened 1 −1", type STATUS).
18. **Rule-blocked modifiers stay visible.** In the Athletics dialog, Armor Check Penalty −2 is listed **struck through and OFF**, because Claude's Strength meets the armor's requirement. The player sees the rule was considered and why it doesn't apply, and can override it.
19. **Item actions sit next to the item, with action costs.** Each strike row carries its own small buttons with action glyphs: SHEATHE ◆, DROP ◇, RAISE ◆ (shield), CHANGE GRIP (2H) ◆. They are contextual: RAISE disappears once the shield is raised.
20. **One click does the whole action.** Raise a Shield adds the effect, raises AC by 2 (17 → 19) and posts a one-line narrative card ("Claude raises their Steel Shield.").
21. **The damage dialog mirrors the attack dialog.** Base dice, then a row to add dice (count, die, damage type), typed modifiers with ON/OFF, and a row to add a modifier with a damage type. The button shows the formula ("1d8 + 3").
22. **Damage cards finish the job.** The card shows a red min–max bar (4 … 11) under the formula, then one-click apply buttons: **Damage, Half, Double, Block** (Block applies the shield's hardness), plus a target button. The degree of success is in the title ("Damage Roll: Longsword (Hit)").
23. **Tabs follow play modes.** The Actions tab splits into Encounter / Exploration / Downtime, and character options appear as toggles at the top ("Student of the Canon" checkbox) instead of hidden settings.

## Round 3: PF2e Level-Up Wizard (module `pf2e-level-up-wizard` 1.1.0)

A wizard-hat button next to the level badge on the sheet opens one window for the next level (2 → 3 for a fighter, with the Gradual Ability Boosts variant on).

24. **One page, only what this level gives.** Big heading "Claude leveled up to 3!", a link to the class, then only the sections that apply: General Feats, Skill Increases, Attribute Boosts, New Class Features (Bravery's full text, with a working @Check link to Frightened). Nothing to page through.
25. **Each choice uses the right control.** Feat: a button that opens a feat picker and then shows the choice in place, highlighted ("Toughness | 1"). Skill: a plain dropdown. Boosts: a row of six toggle buttons that turn green and preview the new modifier (+3 → +4). Once the allowed number is picked, the other attributes fade out.
26. **The feat picker is a focused browser.** Search by name, order by level/name, min/max level, "Hide Skill Feats", filter by skills, rarity badges (UNCOMMON), level column, a hover "View Feat" link, a send-to-chat icon and a ✓ to choose. Only feats legal at this level appear.
27. **Submit is gated, then confirmed.** Submit stays disabled until every section is complete, then a small "Are you sure?" Yes/No.
28. **A summary in chat and a toast.** "Claude has leveled up to level 3! Selected Feats: Toughness. Skill Increase: Athletics skill rank increased to Expert." plus a "level up complete" notification. The sheet updated in one go: HP 34 → 53, Will trained → expert (+5 → +8), Athletics expert (+6 → +10), Str and Con +4.

**Where it fell short (lessons for us):**
- **Submit was disabled with no reason given.** The boost heading said "Select one Attribute to boost", but the wizard wanted **two**: it was catching up the level-2 boost I skipped when I changed the level by hand. Nothing said what was missing; I had to read the module's code. *Lesson: a disabled button must say why ("1 boost left"), and counts must be real ("Select 2 (1 from level 2)").*
- The skill dropdown lists all 16 skills with no current rank and no search (our over-10 rule would add one).
- The chat summary leaves out the attribute boosts.
- A duplicate Shield Block on the sheet wasn't flagged.

**Compared with PF1e Revamp:** we inject our choices (talent, bloodline, variant channeling) into PF1's own level-up window, which is close to this one-page model. Worth borrowing: a "leveled up" summary card in chat, a gated Finish button with a visible reason, and a "New class features" section that shows each new feature's full text.

## Round 4: spell cards in chat (Guidance and Daze, posted by the project lead)

29. **Spell cards carry their effects as draggable links.** Guidance's card ends with "Spell Effect: Guidance" and "Effect: Guidance Immunity". Dragging the first onto Claude's sheet added the effect: no targeting step, no dialog. Daze's card links "Stunned 1" the same way, inline in the rules text.
30. **One-roll bonuses use the same idea as our Guidance, but opt-in.** The effect is a +1 status modifier tied to a "guidance" roll option, marked "remove after roll if enabled". In the Athletics dialog it appeared as a Guidance row, **OFF by default**. Switching it on changed the button to "Roll (+11)", the chat card listed "Guidance +1", and the effect deleted itself after the roll. (PF1e Revamp ticks it automatically, per the project lead's ruling; PF2e leaves it to the player.)
31. **Save buttons carry the DC and the save type.** "Save DC 17 basic Will" rolls the save for the **selected token** and the result card reads "DC 17 · Result: Success by +3": degree of success **and margin**.
32. **Spell damage looks like weapon damage.** Roll Damage opens the same damage dialog (add dice, typed modifiers). The card shows a range bar colored by damage type (orange for mental, red for slashing), a damage-type icon in the formula, and the same Damage / Half / Double / Block buttons.

**Pitfall seen:** with no token for Claude, the save button opened a Will save for the GM's **selected token (Ruby Star)**, with her modifiers and no hint whose roll it was beyond the numbers. *Lesson for our channel energy / save cards: always name the creature in the roll window title, and warn when the roller isn't the expected target.*

**Compared with PF1e Revamp:** PF1's spell cards already have save buttons and buff links, and our next-roll bonuses work like PF2e's removeAfterRoll. Worth borrowing:
- Show the margin on save results ("Success by +3").
- Put the buff link right in our channel/spell footnotes, so a player can drag the effect onto a sheet when targeting wasn't used.
- Color damage by type on our cards.

### Ideas from round 2
- **Struck-through, explained modifiers** (#18): in our roll-window toggles, list bonuses that don't apply right now (wrong alignment for a ward, out of range for studied target) greyed out with the reason, instead of hiding them.
- **Damage/Half/Double/Block on PF1's damage card** (#22): PF1 already has apply buttons; worth checking what's missing (a min–max hint, a "block" equivalent for DR/resistance that we already compute).
- **Item-row action buttons** (#19, #20): Raging Song, Studied Target, Channel Energy could get a small inline "Use" button on the attack/feature row that does everything and posts one short narrative line.
- **Typed modifier tooltips with inline add** (#16): hovering AC/saves in PF1 to see each bonus with its type would make stacking visible.

## Round 5: spells and abilities (2026-10-26)

Read-only this time: the game's sheets and existing chat cards were inspected and spell cards were rendered without posting them, and the PF2e system and PF2e Toolbelt source code was read (local clones in `reference/`, outside this repository). Game: PF2e 8.6.1 on Foundry v14.

**The spellcasting tab**

33. **Each spell row carries what you need to pick it**: action-cost glyphs (a range for variable spells: "Harm ⯁–⯁⯁⯁"), a **Defense** column ("basic Will", "AC", "Fortitude"), range, and a **Cast** button. The entry's header shows the spell DC and attack bonus, the tradition and proficiency, and a Spell Preparation button; expended prepared slots are toggled in place.

**Spell cards**

34. **Outcomes are laid out by degree of success** (Critical Success / Success / Failure / Critical Failure), each with its condition as an **inline, draggable link carrying its value** ("Frightened 2", "Stunned 1"). Traits are tags with tooltips; Range / Targets / Defense / Duration are one line each; heightening is its own line.
35. **Buttons name what they roll**: "Save DC 17 basic Will"; for spell attacks, "Attack / MAP −5 / MAP −10" then "Roll Damage".

**Per-target rows (PF2e Toolbelt's target helper)**

36. **A row per target** under the card: a PC or NPC icon, the save as an icon with a d20 button for the token's owner, the **degree of success color-coded**, and a tooltip with the DC, "Success by 3" and every modifier. A ping button finds the token on the map.
37. **Players don't see NPC save results**: they see a "?" where the GM sees the number.
38. **"Roll NPC Saves"**: one GM button rolls every NPC row's save at once (each still a real roll). **"Set targets"** lets the card's author change the targets after posting.
39. **Rerolls from the row** (hero points, fortune effects), and the row keeps both results.
40. **Damage per target**: the damage card repeats PF2e's Damage / Half / Double / Block buttons on each target's row; the one matching the save (a basic save's success = half) is highlighted, and a row greys out once applied. Shift-click adjusts the amount. The card's own buttons hide behind a toggle.
41. **Template Helper**: after placing a template, a small dialog targets the tokens inside it: Enemies / Allies / All, include self, include neutral, remove the template.
42. **Damage cards** show the modifiers as chips ("1d6 Slashing", "Strength +2"), a **range bar colored by damage type** showing where the roll fell between minimum and maximum, and the outcome in the header ("Critical Hit").

**Abilities**

43. **The Actions tab** splits Encounter / Exploration / Downtime, puts **toggles** at the top as checkboxes, and lists Strikes with **MAP built into the buttons** ("+6 / +1 (MAP −5) / −4 (MAP −10)"), then Damage / Critical, then **weapon handling chips with their action cost** (Change Grip ⯁, Sheathe ⯁, Reload ⯁).
44. **"Use" appears only where it does something**: on actions with a self-effect or a frequency. Using one posts a card with an **Apply Effect** button; the effect records its origin (actor, token, item, roll options), and the button turns into "applied". Per-day uses count down on use.

**Effects**

45. **The effects panel** lists the selected token's effects and conditions: left-click raises a value (Frightened 1 → 2), right-click lowers or removes it; each shows its time left in words ("3 rounds", "Until encounter ends", "Expired"); the tooltip has the description, an Edit button and, for persistent damage, a recovery button.
46. **Durations can end at the start or end of the caster's turn**, or at the end of the round (`turn-start` / `turn-end` / `round-end`), and every effect knows who applied it and from what, so its DC and roll options come from the caster.

**Modules around spells and abilities in this game**

- **Modifiers Matter**: highlights when a buff, debuff or condition changed a roll's outcome ("Frightened turned a hit into a miss").
- **Sustain Reminder**: reminds the caster each turn about spells that need sustaining.
- **Extempore Effects**: makes a temporary effect from any chat card, for spells that have none.
- **Ctrl-click Effects**: Ctrl-clicking a condition link in chat applies it to the selected tokens.
- **Afflictioner**: poisons and diseases with onset, stages, saves on schedule and treatment.
- **Summons Assistant**: places summoned creatures.

**Compared with PF1e Revamp's spell rows**: our rows already do what Toolbelt does for saves (a row per creature, saves rolled against the card, spell resistance, immunities found at resolution), and go further on effects (applied automatically, durations, Hit Dice pools, new saves each turn). Missing are the conveniences (a GM button for NPC saves, retargeting, a template dialog, pings), the **hidden NPC results**, and the **save margin**.

### Ideas from round 5 (ranked by value/effort)

| Idea | PF2e pattern | Where it fits in PF1e Revamp |
|---|---|---|
| **Hide NPC save totals from players** | #37 | Spell rows: players see "saved / failed", the GM sees the total. Matches our rule that enemy statistics stay hidden (a save total reveals the bonus). |
| **"Roll NPC saves" for the GM** | #38 | One button on the spell card rolls every NPC row's save; still a click, as the saves ruling requires. |
| **Save margin in the row** | #36 | "Will 14: failed by 1" (the DC is on the card already). |
| **Modifiers that mattered** | Modifiers Matter | Our roll window knows each ticked bonus: note on the card when one changed the result ("Bless made this hit", "the +2 vs fear made the save"), for the GM where AC is involved. |
| **Template helper** | #41 | After placing a spell's template: Enemies / Allies / All, include self, then remove the template. |
| **Retarget a posted card** | #38 | "Set targets" on our spell card rebuilds its rows from the current targets. |
| **Condition links on our cards** | #34, Ctrl-click Effects | Write the effect line with draggable condition links ("Shaken 1 round"); Ctrl-click applies to selected tokens. |
| **Concentration reminder** | Sustain Reminder | PF1 spells with a concentration duration (Detect Magic, Silent Image, Lullaby): at the caster's turn, a reminder that maintaining it is a standard action, with an End button. |
| **Effects panel for PF1** | #45 | A strip of the selected token's buffs and conditions with time left, click to change a value, right-click to remove, tooltip with source and description. |
| **Poisons and diseases** | Afflictioner | PF1 afflictions: onset, frequency, saves on schedule, cure after N consecutive saves, ability damage per failed save. |
| **Effect ends on the caster's turn** | #46 | Spell buffs that last "until your next turn" end at the start of the caster's turn, not the target's. |

## What PF1e Revamp could borrow (ranked by value/effort)

| Idea | PF2e pattern | Where it fits in PF1e Revamp |
|---|---|---|
| **Pending-choice glow** | #2 | Mark features with unmade choices (racial review not done, talent slots open, variant not chosen) instead of popping dialogs on drop. |
| **Empty-slot rows** | #3, #7 | Show "Slayer talent (lvl 4): Empty slot 🔍" rows on the Features tab instead of a "3 of 4" note; same for bloodline feats, ranger style feats, rage powers. |
| **One generic choice dialog, adaptive control** | #4 | Unify traits.mjs choices, talent follow-ups, Toxin Training etc.: buttons for ≤4 options, a type-to-filter combobox above that (replaces our separate search box). Pairs with the planned rules layer. |
| **Itemized roll dialog with toggles + type badges** | #9 | Extend the one-roll checkbox into a list of all situational/conditional bonuses with ON/OFF and bonus type (stacking visible). |
| **Provenance labels** | #8 | Nest granted feats under the talent/feature that granted them; label "from Rogue Talent", "BG", etc. |
| **Context-preset browser** | #7 | Open PF1's own browser pre-filtered (feat type, combat, level) from a slot, instead of only our custom picker. |
| **Precomputed attack buttons** | #10 | Iterative attacks / TWF variants as buttons on the attack card (PF1 has full attack; check what's missing). |
| **Live preview** | #6 | Racial review and archetype dialogs could show the resulting stats before Apply. |

## Notes
- Some polish comes from modules (Dice So Nice 3D dice, Svelecte comboboxes are PF2e's own, chat notices from Splatter/Sequencer); the build flow, pickers, boosts grid, slots, roll dialog and chat cards are the PF2e system.
- The test character was left at level 2 for the project lead to delete.
