# PF1e Revamp – Design decisions

Rulings made with the project lead, so later changes don't quietly undo them. Read the entries for a
feature before changing it. Newest first within each section. Format: **decision**: why (date).

## General UX
- **Any dropdown or list the module adds with more than 10 options gets a search box** (`util.addSearch` / `searchSelects`): long lists are painful to scroll (2026-10-23).
- **Every picker option has a 📖 icon that opens the full compendium entry**: players need to read an option before choosing it (2026-10-23).
- **Optional rules are GM opt-in world settings, off by default** (e.g. variant channeling): tables that don't use them never see extra choices (2026-10-23).
- **Prefer streamlined character-builder flow**: choices happen where PF1 already asks (the level-up window), with a one-time catch-up button on the feature for existing characters (2026-10-23).
- **Don't rewrite players' item descriptions**: they may hold flavor text; show automation in footnotes or separate items instead (2026-10-23).

## Rolls and buffs
- **Halved damage and healing never go below 1, everywhere** (PF1's ½ buttons and dialog ratio, saves for half, variant channeling): core rule "damage and hit points have a minimum of 1". Bonuses like ½ level are not damage and can be 0; resistance can still reduce damage to 0 (2026-10-23).
- **One-roll bonuses (Guidance, True Strike, Luck channel) show as a ticked box in every roll window**; unticked, the roll goes without it and the buff waits. No "arm" buttons (judged clunky). Rolls without a window use it automatically. A bonus is used up only if it ended up in the roll (2026-10-23).
- **Bit of Luck: always take the better of two d20s automatically**: taking the better roll is never worse (2026-10-22).

## Cleric / channel energy
- **No summary chat message after a channel**: PF1's card shows the amount and saves have their own cards; the GM request is whispered and deleted once applied (2026-10-23).
- **Variant channeling halves per the rules as written**: roll the normal dice and halve the total on PF1's own card (one number in chat), **minimum 1** ("damage and hit points have a minimum of 1") (2026-10-23).
- **Variant channeling is chosen at creation (new-cleric level-up window) or once from Channel Energy's note, then locked; GM-only reset.** The choice shows on the sheet as a "Variant Channeling (portfolio)" class feature (2026-10-23).
- **Luck variant bonus goes to every creature the channel affects**, including those already at full HP (the rules give it to "affected creatures") (2026-10-23).
- **Clerics are prepared casters**; spontaneous casting converts prepared spells (2026-10-22).

## Classes
- **Shared rogue talents are offered to slayers only through the Rogue Talent talent**, not listed directly (2026-10-23).
- **Talent and feat pickers: our own searchable picker plus a "Browse all feats…" button to PF1's Feat Browser**, with a note that the browser can't check prerequisites (2026-10-23).
- **Archetype-altered features are renamed "Feature (Archetype)" and their mechanics changed**, not just annotated (2026-10-22).

## Process
- **Testing budget**: targeted test batches while building, one full suite run before each commit, time-boxed flake hunting (2026-10-23).
- **Performance review every 10 features** (2026-10-22).
- **Read the full rules text and propose a design before building** a new automation (standing). The design must include a rules check: who, when, whose choice, duration, stacking/bonus type, rounding and minimums, and the general rules that apply (2026-10-23).
