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
