# Spells and Buffs

PF1e Revamp recognizes the spell buffs from PF1 and **Pathfinder 1e Content** by name, so there's nothing special to use. Put the buff on the character as usual, and it now does what the spell says.

- [Miss chances](#miss-chances)
- [Alignment wards](#alignment-wards)
- [One-roll buffs](#one-roll-buffs)
- [Buffs applied for you](#buffs-applied-for-you)
- [Save bonuses from buffs](#save-bonuses-from-buffs)
- [Buff Library compendium](#buff-library-compendium)

---

## Miss chances

**Before:** Blur, Displacement and similar buffs only printed a reminder; the miss chance had to be rolled by hand.

**Now:** when someone attacks a creature with one of these buffs, the miss chance is **rolled for every attack** and shown under each attack on the card. A red bar means the attack misses; green means it doesn't.

| Buff | Miss chance |
|---|---|
| **Blur** | 20% |
| **Displacement** | 50% |
| **Blink** | 50% against attacks; 20% if the attacker sees invisible creatures or uses a ghost touch or force attack; none if both. Single-target spells cast at a blinking creature have a 50% chance to fail. The blinker's own attacks have a 20% miss chance. |
| **Entropic Shield** | 20%, ranged attacks only |
| **Crystalline Dust** | 20% |
| Target is **invisible** (and the attacker can't see invisible) | 50% |
| Attacker is **blinded** | 50% |

The rules details are handled for you:
- **Miss chances don't stack**: only the highest one is rolled.
- **True seeing** negates Blur and Displacement; **see invisibility** doesn't, but does reduce Blink.
- **Blind-Fight** rerolls a concealment miss in melee. See [Feats](Feats#blind-fight).
- With **Nevela's Automation Suite**, its *Concealed* condition is left to Nevela. If a buff gives a higher miss chance, Nevela's roll is struck through so only one counts.

## Alignment wards

**Before:** pf-content's ward buffs either did nothing automatically or, for the auras, gave their bonus against **everyone**.

**Now:** Protection from Evil / Good / Chaos / Law (+2) and Holy Aura, Unholy Aura, Shield of Law and Cloak of Chaos (+4):
- **AC:** when a creature of the opposed alignment attacks, the target's AC on the attack card includes the deflection bonus. Hover it to see the breakdown.
- **Saves:** saves rolled against that creature's effects get the resistance bonus.
- **No stacking:** if the character already has a higher deflection or resistance bonus, nothing extra is added.
- The auras' always-on bonuses are removed from the character's copy, so they only apply against the right alignment.

## One-roll buffs

| Buff | What happens |
|---|---|
| **True Strike** | +20 on your next attack roll (the first attack only, if you make several), then the buff switches off. |
| **Guidance** | +1 on your next attack roll, saving throw or skill check, then it switches off. |
| **Bit of Luck** (Luck domain) | For a round, every d20 you roll is rolled twice and the better result kept. See [Classes](Classes#luck-domain-bit-of-luck). |
| **Prescience** (Foresight wizard) | A stored d20 you choose when to use. See [Classes](Classes#foresight-subschool-prescience). |

If you cancel a roll's dialog, the buff isn't used up.

## Buffs applied for you

Casting **Guidance**, or using **Bit of Luck** or **Resistant Touch**, puts the buff on your **target** (yourself if nobody is targeted; Resistant Touch needs an ally targeted). Recasting on someone who already has it switches it back on. If Nevela's Automation Suite is set to apply a buff for that action itself, PF1e Revamp lets Nevela do it.

## Save bonuses from buffs

Buffs that give a save bonus against a kind of effect apply it automatically when the save is rolled from that effect's chat card:
- **Remove Fear**: +4 morale vs fear
- **Death Ward**: +4 morale vs death spells and death effects
- **Mind Blank**: +8 resistance vs mind-affecting spells and effects, minus any resistance bonus you already have

Details and rules in [Combat Rules](Combat-Rules#save-bonuses-against-effects).

## Buff Library compendium

The module's **Buff Library** compendium has buffs not found in PF1 or pf-content: **Protection from Spells**, **Spider Climb** (climb speed 20 ft) and **True Strike**.
