# Classes

- [Bloodlines, domains and arcane schools](#bloodlines-domains-and-arcane-schools)
- [Cleric](#cleric)
- [Ranger](#ranger)
- [Skald](#skald)
- [Slayer](#slayer)
- [Sorcerer](#sorcerer)
- [Wizard](#wizard)

For archetypes (Battle Scion, Blossoming Light, Chronomancer and others), see [Archetypes](Archetypes).

---

## Bloodlines, domains and arcane schools

**Before:** PF1's bloodline, domain and school items are mostly text. Their powers usually aren't added to the character, and many don't exist as items at all.

**Now:** dropping a bloodline, domain, arcane school or subschool onto a character opens a short review listing its powers and the level each one arrives at. Confirming it:

- **links the powers into the class**, so PF1 grants each one automatically when the character reaches its level;
- **adds the powers the character already qualifies for**;
- skips anything already on the sheet (characters set up by hand aren't duplicated);
- leaves out powers that belong to another class. PF1 tags warpriest blessings with domain names, for example.

Removing the bloodline, domain or school removes the powers it added. The item's note has a button to review again.

**Subschools** keep their parent school's powers except the ones they replace. *Foresight*, for example, keeps Divination's *Forewarned* and replaces Diviner's Fortune and Scrying Adept with *Prescience* and *Foretell*.

**Missing powers.** Powers PF1 doesn't have as items (most of the Solar bloodline's, for example) are provided in the module's *Class Features* compendium and granted the same way.

---

## Cleric

### Channel Energy
**Before:** PF1 rolls the healing or damage and asks you to place a 30-ft template. Picking who's affected, applying it and rolling everyone's saves was by hand.

**Now:** press **Use** on Channel Energy and choose the version (heal living, harm undead, and so on). There's no template to place, because the burst is always centered on the cleric.

- A checklist shows **every creature of the affected type within 30 ft**. The rules say a channel affects *all* of them, so only the cleric can be unchecked ("you can choose whether or not to include yourself").
- With **Selective Channeling**, you can also uncheck up to your Charisma modifier in other creatures.
- **Healing** is applied to everyone checked, never above their maximum HP.
- **Harm**: each creature rolls its Will save (DC 10 + ½ cleric level + Cha) and takes full or half damage.
- One summary appears in chat, e.g. *"Positive – Heal living (6): Valeros +4 (to max) · Seelah already full"*.
- Cancelling the checklist gives the use back.

The cleric's token must be on the scene. Applying the results needs a GM logged in (see [Compatibility](Compatibility#multiplayer)).

### Spontaneous Casting
**Before:** losing a prepared spell to cast a cure spell meant adjusting the spellbook by hand.

**Now:** on the **Spells** tab, every prepared spell that can be lost gets a small **hand icon** next to its Use button. Orisons and domain spells don't get one, as the rules exclude them. Clicking it:
1. offers the cure spells of that spell's level or lower;
2. spends one preparation of the lost spell;
3. casts the cure through PF1 as normal, without using a slot of its own. The cure spell is added to the spellbook (0 prepared) the first time, so it's there next time.

Good clerics get **cure** spells and evil clerics get **inflict** spells. A neutral cleric is asked once which they channel, and the choice is remembered. If you cancel PF1's casting dialog, the prepared spell isn't lost.

### Luck domain: Bit of Luck
**Target the ally** you touch (or nobody, for yourself) and press **Use**. The ally gets a **Bit of Luck** buff for 1 round. While it lasts, **every d20 they roll is rolled twice, keeping the better result**: attacks, saves, skill and ability checks. The rules say "may roll twice"; taking the better roll is never worse, so it's automatic.

### Protection domain: Resistant Touch
**Target the ally** you touch and press **Use**. The ally gets your domain's resistance bonus on saves for 1 minute (*Resistant Touch* buff), and you lose it for that minute (*Resistant Touch (lent)* buff on you). When your buff ends, expires or is removed, your bonus comes back. The domain's base +1 resistance on saves is applied by PF1 itself.

---

## Ranger

### Combat style feats
**Before:** the ranger's combat style and its bonus feats were picked by hand from the style's text.

**Now:** at each combat style feat level (2nd, 6th, 10th, 14th, 18th), PF1's level-up window has a **Combat style feat** section with a **Choose…** button:
1. The first time, pick your **combat style** (Archery, Two-Weapon Combat, Weapon and Shield and the rest). It's fixed after that, as the rules say.
2. Pick a feat from the style's lists **unlocked at your level**: the first list, plus the 6th-level list from 6th, plus the 10th-level list from 10th. **Prerequisites are ignored**, as the class feature allows, and feats you already have aren't offered.

The **Combat Style Feat** feature's note shows your style and how many style feats you've chosen, with a **Choose feat…** button to catch up. It also reminds you that the feats only work in light, medium or no armor.

---

## Skald

### Raging Song
**Before:** PF1 tracks the rounds per day; everything else was by hand.

**Now:** press **Use** on Raging Song and pick a song. *Inspired Rage*, *Song of Strength*, *Song of Marching* and *Dirge of Doom* are supported, once the skald has them. Then:

- A checklist shows the creatures in range, allies or (for Dirge of Doom) enemies. Uncheck anyone who doesn't want it or can't hear.
- Starting spends a round. The skald gets a *Raging Song: …* buff, and each target gets the song's buff with its real bonuses (e.g. *Inspired Rage (Skald)*).
- **In combat, maintaining costs 1 round at the end of the skald's turn**, matching the rules (maintaining is a free action on your turn). The round the song started is already paid.
- A **deafened** skald has a 20% chance the song fails to start, rolled in chat. The round is still spent.
- Starting a new song replaces the old one. The song's note has an **End song** button, and removing a target's buff takes them out of the song.

Songs can also be started from the song item's own Use button or its note's *Start* button.

---

## Slayer

### Slayer talents
**Before:** talents were picked by hand from the compendium, with no check of their requirements. Talents that lead to another choice (Ranger Combat Style, Rogue Talent, Combat Trick) were also done by hand.

**Now:** at every even slayer level, PF1's level-up window has a **Slayer talent** section with a **Choose…** button. The talent is added when you click Finish. The **Slayer Talents** feature's note shows how many talents you've chosen ("3 of 4") and has a **Choose talent…** button for catching up.

The talent picker:
- has a **search box**, and a 📖 icon on every option that opens its full text;
- marks each talent **✓** (you meet its requirements), **✗** (you don't, with why, e.g. *needs slayer level 4* or *needs jaguar's grace*) or **?** (the module can't tell, e.g. *needs dimension door as a spell-like ability*);
- shows **advanced talents** from 10th level;
- hides talents you already have, unless the talent can be taken more than once (Deadly Range, Terrain Mastery, Toxin Training and others).

**Talents that lead to another choice** ask right away:

| Talent | What it asks |
|---|---|
| **Rogue Talent** | Which rogue talent, from its list (Bleeding Attack, Combat Trick, Fast Stealth, Weapon Training…), with requirement marks. Shared rogue talents are only offered this way, as the rules say. *Rogue and Ninja Advanced Talents* and *Catfolk Rogue Talent* work the same way. |
| **Ranger Combat Style** | Your combat style (the first time only), then a feat from its first list, **ignoring prerequisites**. Taken again at 6th level, the style's 6th-level feats are added to the list; again at 10th, its 10th-level feats. |
| **Combat Trick** | Any combat feat, with ✓/✗ prerequisite marks. |
| **Feat** (advanced) | Any feat, with ✓/✗ prerequisite marks. |
| **Grit** | A grit feat; Amateur Gunslinger is added too. |
| **Toxin Training** | An ability score (a different one each time). |
| **Focusing Attack** | A condition: confused, shaken or sickened (a different one each time). |
| **Terrain Mastery** | A favored terrain. |

**Talents that hand you a specific feat** add it for you: Weapon Training (Weapon Focus), Finesse Rogue (Weapon Finesse), Firearm Training, Sticks and Stones (Catch Off-Guard), Unbalancing Trick (Improved Trip), Underhanded Trick (Improved Dirty Trick), Blinding Strike (Blinding Critical).

**Long feat lists** (Combat Trick, Feat) also have a **Browse all feats…** button that opens PF1's Feat Browser, for its filters. Drag the feat you want onto your sheet and it's linked to the talent. **The Feat Browser can't check prerequisites**, so make sure you qualify.

**Undoing:** deleting a talent also removes the feats it brought.

### Studied Target
**Before:** PF1 lists the bonuses as reminders; you add them by hand.

**Now:** **target the creature** and press **Use** on Studied Target.
- The slayer gets *Studied Target: Goblin* and the creature gets *Studied by (slayer)*.
- Whenever the slayer **attacks with a weapon or rolls Bluff, Knowledge, Perception, Sense Motive or Survival with the studied creature targeted**, the Studied Target bonus is added.
- The number of creatures you can study at once follows your slayer level. Studying a new one beyond the limit replaces the oldest.
- **To stop studying:** turn off or delete either buff, or use the **×** next to the creature's name in Studied Target's note. Deleting the creature's token ends it too.

### Quarry and Improved Quarry
Target the creature and press **Use** to make it your quarry. You get +2 insight on attacks against it (+4 with Improved Quarry), shown as linked buffs on both of you like Studied Target. A note on the attack card reminds you that critical threats against your quarry are confirmed automatically. The quarry's note tracks the waiting time before you can pick a new one, and has a **Dismiss quarry** button.

---

## Sorcerer

### Bloodlines
Bloodline powers are granted as described [above](#bloodlines-domains-and-arcane-schools). The **Solar** bloodline is fully supported:
- the bloodline powers PF1 is missing are included;
- the fire resistance and dazzled immunity its powers grant are applied automatically as you level;
- **Bloodline Arcana**: fire spells deal +1 damage per die.

### Level-up helpers
- **Taking a new class** that picks a bloodline, domain or school offers the choice right in PF1's level-up window.
- **Bloodline bonus feats** at 7th, 13th and 19th level: the level-up window offers your bloodline's bonus feats, with a check for whether you meet each one's prerequisites.

---

## Wizard

### Arcane schools and opposition schools
School and subschool powers are granted as described [above](#bloodlines-domains-and-arcane-schools). A **specialist** is then asked for their **two opposition schools**. Spells from those schools **cost two slots to prepare**, and the spellbook's slot count reflects it. Each such spell's note says so, along with the −4 penalty on crafting items that need it. Change the choice anytime from the school's note.

### Foresight subschool: Prescience
*"At the beginning of your turn, you may, as a free action, roll a single d20. At any point before your next turn, you may use the result of this roll as the result of any d20 roll you are required to make."*

1. **In combat**, at the start of the wizard's turn, the player gets a private card: **Roll Prescience (X left today)**. Outside combat, use the Prescience item's Use button.
2. Rolling it spends a use and stores the result on a **Prescience: 17** buff.
3. When you want it, click **Use it on my next roll** (on the card or the buff). Your **next d20 roll** of any kind is exactly that number, and the buff disappears.
4. An unused result is lost at the start of your next turn.

### Chronomancer
The Chronomancer's Temporal Pool (Forewarned and Rewind) is described on the [Archetypes](Archetypes#chronomancer-wizard) page.
