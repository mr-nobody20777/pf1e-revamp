# Combat Rules

- [Buffs on a roll](#buffs-on-a-roll)
- [Save bonuses against effects](#save-bonuses-against-effects)
- [Energy resistance](#energy-resistance)
- [Miss chances](#miss-chances)

---

## Buffs on a roll

**Before:** PF1 adds up every buff and condition into one number. You couldn't see which ones counted, which lost to a higher bonus of the same type, or leave one out for a single roll without switching the buff off.

**Now:** attack, save, skill and ability-check windows have a **Buffs** line.

- **A few effects** (4 or fewer by default) show right in the window as small chips. Untick one to leave it out of this roll.
- **More than that**, the line shows the totals instead, e.g. *Attack +7 · Damage +8 from 8 effects · 4 not applied*, and a **Manage…** button opens a small window listing every effect:
  - grouped into **Attack only**, **Damage only** and **Attack and damage** (saves and skills have one group), with each effect's value and bonus type;
  - ability-score buffs combine into one row per ability (*Strength +8*), which expands to its sources (Rage, Bull's Strength, Enlarge Person);
  - **Not Applied** lists bonuses that don't stack (*Bless · Heroism is higher*) and situational bonuses that don't apply right now (*Studied Target · your target isn't studied*).
- **Changes apply to that one roll only.** The chat card shows them as one labeled part, e.g. *−2 [Buffs: Heroism, Greater off; Heroism on]*.

### The rules it follows
- Stacking is PF1's own: bonuses of the same type don't stack (the highest counts); dodge, untyped, circumstance and racial bonuses stack; penalties always stack.
- A bonus that loses to a higher one can be ticked only after everything beating it is turned off, and it never moves up on its own.
- **Conditions** (shaken, sickened...) are marked 🔒: only the GM can turn them off for a roll. Everything else, anyone can change.
- Situational bonuses that don't apply right now can be ticked by anyone, for theater-of-mind play: Studied Target or Quarry when that creature isn't targeted, an alignment ward when the save's source isn't known or isn't of that alignment, a bonus "vs fear" on a save that isn't against fear.
- The module's own bonuses follow the same stacking: Quarry's insight bonus doesn't add to True Strike's (only the +20 counts on that attack).
- The Weapon Finesse shield penalty (armor check penalty on a finessed shield bash) is imposed by the rules: 🔒, GM only.
- Rolls made without a window (shift-click) use PF1's totals plus the situational bonuses that apply.

How many effects show as chips is a per-player setting: see [Settings](Settings).

## Save bonuses against effects

**Before:** bonuses like *"+2 racial bonus on saves vs. fear"* or *"+4 morale vs. death spells"* appeared as reminders on the save, to be added by hand.

**Now:** when a save is rolled **from the effect's chat card** (the save button on a spell's card), PF1e Revamp looks at what the effect is: its school, subschool and descriptors, and whether it's a spell or a spell-like ability. Every matching bonus the character has is then added to the roll.

It understands bonuses against:

| Kind | Examples |
|---|---|
| **Descriptors** | fear, mind-affecting, emotion, death, poison, disease, curse, pain, fire, cold, acid, electricity, sonic |
| **Schools and subschools** | enchantment, illusion, necromancy (and the other schools), charm, compulsion, polymorph |
| **Spells and spell-like abilities** | "against spells", "against spell-like abilities" |

The bonuses can come from anywhere on the character: race, racial traits, character traits, feats and buffs. Some examples:

- **Halfling** +2 vs fear: applies against *Cause Fear*, not against *Charm Person*.
- **Dwarf** +2 vs poison, spells and spell-like abilities: applies against *Poison*, and against any spell.
- **Elf / Half-Elf** +2 vs enchantment: applies against *Charm Person*, not against *Cause Fear*.
- **Remove Fear** +4 vs fear; **Death Ward** +4 vs death spells; **Mind Blank** +8 vs mind-affecting.
- The **Lonely** drawback: −2 vs charm spells and spell-like abilities.

### Stacking follows the rules
- **Racial, untyped, dodge and circumstance** bonuses stack. Halfling *Fearless* stacks with Halfling Luck, as the trait says.
- **Every other type** (morale, resistance, luck, sacred…) only uses the **highest**, and only the part above a bonus of that type the character already has. *Mind Blank*'s +8 resistance on top of a *Cloak of Resistance +1* adds 7.
- The same racial bonus stated on both the race and one of its racial traits counts **once**.

### Reminder notes on the card
PF1 lists an item's save notes under the roll ("+2 vs fear effects"). When PF1e Revamp has already added that bonus to the roll, the note is ticked and faded, with "already added to this roll" on hover, so nobody adds it a second time.

### Rolling for the right creature
PF1's save button on a card rolls for whatever token you have selected (or your own character). If that isn't one of the card's targets, PF1e Revamp warns you who it's rolling for. The roll still goes ahead, so the GM can roll for anyone on purpose.

### When it doesn't apply
- **Saves rolled without the effect's card** (typed in or rolled from the sheet) get no automatic bonus. The reminders still show on the roll.
- **Bonuses against creatures** ("vs. evil creatures") are handled by the alignment wards, not here.
- **Conditional bonuses** ("when adjacent to an ally", "once per day") and notes about immunities or rerolls are left as reminders, because the module can't know whether the condition is met.

## Energy resistance

### Resistances never stack
Several resistances against the same energy don't add up. Only the highest counts. A character with racial fire resistance 5 and fire resistance 10 from their bloodline has **fire resistance 10**, not 15. This holds wherever the resistances come from, including values typed in by hand, and for both ways of applying damage below.

### Quick-applied damage
**Before:** PF1 only applies energy resistance and immunity through its **Apply Damage** dialog. Clicking the damage buttons on a chat card applied the full amount.

**Now:** damage applied straight from a card is also reduced by the target's best matching energy resistance, or ignored if they're immune. A private message tells the target's owner and the GM what was resisted. This is a world setting, on by default; see [Settings](Settings). Damage through PF1's dialog is left to PF1, so it's never reduced twice.

### Halving and resistance
The rules don't say whether a saving throw for half damage or energy resistance applies first, and there's no official ruling. PF1e Revamp halves first, then applies resistance, which is the most common reading and the order most favorable to the creature. For example, 20 fire damage, saved for half, against fire resistance 10 is fully resisted (20 → 10 → 0), rather than leaving 5. Doubled damage (the ×2 button) keeps resistance first, for the same reason.

### Where resistance comes from
Racial traits (*"you have fire resistance 5"*), bloodline powers (Solar), and anything PF1 already tracks. With **Nevela's Automation Suite**, its *Resist Energy* and *Protection from Energy* buffs are handled by Nevela and work alongside this.

## Halving: minimum 1
The core rules: *"if you wind up with a fraction, round down… Exception: Certain rolls, such as damage and hit points, have a minimum of 1."* Whenever damage or healing is halved (PF1's **½** buttons, a ratio in the Apply Damage dialog, a save for half, or variant channeling), the result is rounded down but never below 1. Energy resistance can still reduce damage to nothing.

## Miss chances

Miss chances from Blur, Displacement, Blink, Entropic Shield, invisibility and blindness are rolled on attack cards. See [Spells and Buffs](Spells-and-Buffs#miss-chances).
