# Testing and Reviews

How PF1e Revamp is checked before each release.

## Who builds it
PF1e Revamp is written by **Claude**, Anthropic's AI, working in Claude Code. Claude writes the code, tests and documentation, and runs all the testing described below in a live Foundry world. The project lead, **mr-nobody20777**, decides what gets built and how it should play at the table, sets the design rules, and reviews the results. Every commit is co-authored by Claude.

## Rules first
Every automation starts from the **full rules text** of the ability, feat, trait or spell, and the rule is quoted at the top of the code that implements it. When PF1's or Pathfinder 1e Content's data disagrees with the rules, the rules win and the item's note says so. Examples: the auras' always-on bonuses, and Magical Knack's missing Hit Dice cap.

## Automated tests
The module includes a test suite of **over 240 tests in 29 groups**, run with the **Quench** module. Each group:
1. creates throwaway characters, tokens and combats on a dedicated test scene;
2. uses features through PF1's real actions and rolls, the same way a player would;
3. checks the results on the chat cards and character sheets;
4. deletes everything it created.

New features ship with their tests, and the **whole suite runs before every release**.

To run it yourself: install and enable **Quench**, open it from the sidebar, select the *PF1e Revamp* groups and click **Run**. Use a test world, since tests briefly create and delete characters, tokens and chat messages.

## Playing as a player
Most automated tests run as a GM, and a GM can change anything, so permission problems would never show up there. Before release, every feature that touches another character was also played through **logged in as a regular player**, with a separate GM connected. That covered buffs on allies, channel energy, spontaneous casting, Prescience, Rewind, Forewarned, raging songs, Studied Target, miss chances, sneak attack talents, and spells cast by and at a player (saves rolled from the card, templates placed on the map). All worked. See [Compatibility](Compatibility#multiplayer) for how the GM's client handles those changes.

## Performance reviews
After every **ten new features**, the code gets a review aimed at keeping games running smoothly, without the slowdowns that make people refresh Foundry mid-session:
- removing duplicated code and unused work;
- checking for memory leaks: listeners added repeatedly, caches that grow forever;
- keeping the busiest moments light: chat messages being rendered, characters being recalculated, dice being rolled.

Each review is measured with a benchmark (`module/tests/benchmark.mjs`). It simulates a busy session (hundreds of character recalculations and chat renders, dozens of attacks, saves, skill checks and buff toggles) and times every one of the module's handlers:

| Review | The module's share of the session |
|---|---|
| #1 | 0.53% → **0.17%** |
| #2 | 0.29% → **0.20%** (after ten more features) |
| #3 | 0.23% → **0.22%** (after ten more features, including the roll windows' buff manager) |

Every handler costs well under a millisecond per call, and memory showed no growth.

## Technical notes (for the curious)
- **Your existing items.** Automation recognizes PF1's and Pathfinder 1e Content's own items in place, by compendium source, tag or name, so there's nothing to swap in or keep in sync.
- **State on items.** Ongoing effects live on items and buffs, so they survive a page refresh and show on the sheet.
- **Derived bonuses.** Granted traits like energy resistance are added while PF1 calculates the character, never written into the character's data. Removing the source removes the effect.
- **Undo.** Archetypes, racial traits and subclass powers record exactly what they changed on their own item and restore it when removed.
- **Hooks.** The module hooks into PF1 through its documented hooks (`pf1PreAttackRoll`, `pf1PreActorRollSave`, `pf1PostActionUse` and others). The few places it wraps PF1's code go through libWrapper, registered once per method and shared by all features.
