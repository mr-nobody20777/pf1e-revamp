# PF1e Revamp – Design decisions

Rulings made with the project lead, so later changes don't quietly undo them. Read the entries for a
feature before changing it. Newest first within each section. Format: **decision**: why (date).

## General UX
- **Every window the module opens names the creature it acts for** (`util.titleFor`: "Title – Name", PF1's style), and **every control that can't act says why** (tooltip or message), never silently doing nothing. PF1's card save button rolls for the selected token: warn (don't block) when that isn't a card target. From the PF2e study, where a save rolled for the wrong creature unnoticed (2026-10-23).
- **Any dropdown or list the module adds with more than 10 options gets a search box** (`util.addSearch` / `searchSelects`): long lists are painful to scroll (2026-10-23).
- **Every picker option has a 📖 icon that opens the full compendium entry**: players need to read an option before choosing it (2026-10-23).
- **Optional rules are GM opt-in world settings, off by default** (e.g. variant channeling): tables that don't use them never see extra choices (2026-10-23).
- **Prefer streamlined character-builder flow**: choices happen where PF1 already asks (the level-up window), with a one-time catch-up button on the feature for existing characters (2026-10-23).
- **Don't rewrite players' item descriptions**: they may hold flavor text; show automation in footnotes or separate items instead (2026-10-23).

## Rolls and buffs
- **Roll windows: a buff manager instead of a list in the window** (after mocking chips, folds and badges on a level-15 fighter with 14 buffs/conditions, all too busy). Up to a per-player threshold (default 4 effects) the effects show as one row of on/off chips in the roll window. Above it, the window shows one summary line ("Attack +7 · Damage +8 · from 10 sources · 6 not applied · Manage…") and **Manage…** opens a small window with a row per effect (checkbox, value, bonus type) in sections Attack only / Damage only / Attack and damage (saves and skills: one section), then **Not Applied**. Ability-score changes merge into one row per ability that expands to its sources. Changes apply to this roll only. **One-roll bonuses (Guidance, True Strike, Luck channel) always keep their checkbox in the roll window**, even above the threshold: they're used up, so it's a real choice every roll (2026-10-23).
- **Not Applied** lists bonuses that don't stack (with the higher bonus that beats them) and bonuses that don't apply to this roll (with the reason), only for rolls they could apply to. A non-stacking bonus can be ticked only after the bonus beating it is turned off, and **it never moves up on its own: the player ticks it**. "Doesn't apply" bonuses (studied target, quarry not targeted) **can be ticked by anyone**, for theater-of-mind play (2026-10-23).
- **Penalties are on by default. Ones the character chose (Fighting Defensively, Rage, TWF, their own buffs) can be unticked by anyone; imposed ones (conditions, armor check penalty, non-proficiency, debuffs cast by someone else) only by the GM** (players see a 🔒): mistakes and GM hand-waving are easy to fix, but players can't quietly drop their own conditions. If the module can't tell, a buff counts as chosen (2026-10-23).
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
