# PF1e Revamp – Pathfinder 1e Automation for Foundry VTT

PF1e Revamp makes the **class features, archetypes, racial traits, character traits, feats and spells** you already use in Pathfinder 1e *do what their text says*. Bonuses land on the right rolls, miss chances get rolled for you, channel energy heals exactly the creatures in its burst, archetypes really change the features they alter, and fiddly rules like two-weapon fighting or a skald's raging song are handled from the normal **Use** button. It works with the PF1 items you already have, with no replacement copies, and steps aside wherever another module already does the job.

![Version](https://img.shields.io/github/v/release/mr-nobody20777/pf1e-revamp?label=version)
![Downloads](https://img.shields.io/github/downloads/mr-nobody20777/pf1e-revamp/total)
![Foundry v13](https://img.shields.io/badge/Foundry-v13-orange)
![PF1 11.x](https://img.shields.io/badge/PF1-11.x-blue)
![Built with Claude Code](https://img.shields.io/badge/built%20with-Claude%20Code-D97757)

📖 **Documentation:** [the Wiki](https://github.com/mr-nobody20777/pf1e-revamp/wiki) explains, in plain language, exactly how each feature works now.

---

## ✨ Highlights

- **Classes.** Cleric channel energy that targets the burst and rolls the saves; spontaneous cure casting in one click; skald raging songs with per-round costs; slayer studied target, quarry and a **searchable slayer-talent picker** (including Ranger Combat Style and Rogue Talent choices); ranger combat style feats; sorcerer bloodline powers; chronomancer temporal pool. → [Classes](https://github.com/mr-nobody20777/pf1e-revamp/wiki/Classes)
- **Archetypes.** Add an archetype and it actually changes the class: replaced features go, new ones arrive at the right levels, and altered features are renamed and changed. Removing it puts everything back. → [Archetypes](https://github.com/mr-nobody20777/pf1e-revamp/wiki/Archetypes)
- **Races.** Pick standard or alternate racial traits from a checklist; the "+2 to any ability" gets a picker; racial fire resistance actually reduces fire damage. → [Races](https://github.com/mr-nobody20777/pf1e-revamp/wiki/Races)
- **Traits.** Traits with a choice ask for it, and traits whose PF1 version was wrong (like Magical Knack) follow the rules. → [Traits](https://github.com/mr-nobody20777/pf1e-revamp/wiki/Traits)
- **Feats.** Full two-weapon fighting (PF1 has none), shield bashes, Blind-Fight, Selective Channeling and more. → [Feats](https://github.com/mr-nobody20777/pf1e-revamp/wiki/Feats)
- **Spells and buffs.** Blur and Displacement roll their miss chance; Protection from Evil only works against evil; Remove Fear applies against fear; True Strike and Guidance are used up by the roll they help. → [Spells and Buffs](https://github.com/mr-nobody20777/pf1e-revamp/wiki/Spells-and-Buffs)
- **Combat rules.** Save bonuses against fear, poison, charm and other effects apply automatically; energy resistances never stack; resistance applies even to quick-applied damage. → [Combat Rules](https://github.com/mr-nobody20777/pf1e-revamp/wiki/Combat-Rules)

Every automated item gets a small **PF1e Revamp** note on its sheet and chat card explaining what's automated, often with buttons for the choices it offers. Every option in a picker has a 📖 icon that opens its full text, so you can read it before choosing.

---

## ✅ Requirements

- **Foundry VTT** v13
- **Pathfinder 1e** game system 11.x

That's all that's required.

## 🧩 Recommended modules

- **[libWrapper](https://foundryvtt.com/packages/lib-wrapper)**: lets PF1e Revamp hook into PF1 safely alongside other modules.
- **[Pathfinder 1e Content](https://foundryvtt.com/packages/pf-content)**: racial traits, character traits and the spell buffs PF1e Revamp recognizes.
- **[Pathfinder 1e Archetypes and Abilities](https://foundryvtt.com/packages/pf1e-archetypes)**: the archetypes PF1e Revamp applies.
- **Nevela's Automation Suite** works well alongside: PF1e Revamp defers to it where they overlap. See [Compatibility](https://github.com/mr-nobody20777/pf1e-revamp/wiki/Compatibility).

## 🔌 Installation

1. In Foundry's setup screen, open **Add-on Modules → Install Module**.
2. Paste this into **Manifest URL** and click **Install**:
   ```
   https://github.com/mr-nobody20777/pf1e-revamp/releases/latest/download/module.json
   ```
3. In your world, enable **PF1e Revamp** under **Game Settings → Manage Modules**.

Updates appear through Foundry's normal module update check.

## 🧪 Quality

Every feature ships with automated tests (149 and counting, run before every release), has been played through as a non-GM player, and goes through a performance review every ten features. The module's share of a busy session's processing is about 0.2%. Details: [Testing and Reviews](https://github.com/mr-nobody20777/pf1e-revamp/wiki/Testing-and-Reviews).

## 🐞 Issues and suggestions

Found a bug or a rule that isn't handled the way it should be? [Open an issue](https://github.com/mr-nobody20777/pf1e-revamp/issues). It helps to include the item name, what you expected and what happened.

## 🤖 How this was made

PF1e Revamp was written by **Claude**, Anthropic's AI, working in [Claude Code](https://claude.com/claude-code). Claude wrote the code, the automated tests and this documentation; read each ability's rules text before automating it; and tested every feature in a live Foundry world, including as a non-GM player. **[mr-nobody20777](https://github.com/mr-nobody20777)** came up with the project, decided what to build and how it should play at the table, set the design rules, and reviewed the results. Every commit in this repository is co-authored by Claude.

## 📜 License and credits

- Code: [MIT License](LICENSE).
- This module uses trademarks and/or copyrights owned by Paizo Inc., used under Paizo's Community Use Policy (paizo.com/communityuse). We are expressly prohibited from charging you to use or access this content. This module is not published, endorsed, or specifically approved by Paizo. For more information about Paizo Inc. and Paizo products, visit paizo.com.
- Game rules text is Open Game Content, used under the Open Game License v1.0a.
- Built on the excellent [Pathfinder 1e system for Foundry VTT](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1).
