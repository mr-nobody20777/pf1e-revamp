// Variant channeling portfolios (Pathfinder RPG Ultimate Magic, Open Game Content): the heal and harm
// effect of each, as published. Generated from the rules text; see variant-channeling.mjs.

export const VARIANTS = {
  "Air/Sky/Wind": {
    "heal": "Creatures gain a channel bonus on Acrobatics and Fly checks, saving throws against wind effects, and effects with the air descriptor until the end of your next turn.",
    "harm": "Creatures are buffeted with wind until the end of your next turn; this wind gives them a channel penalty on ranged attacks, and their movement is halved if they move toward you."
  },
  "Ale/Wine": {
    "heal": "Creatures ignore the nauseated and sickened conditions, as well as ability damage and drain from poison, until the end of your next turn. This does not bring back to life creatures killed by Constitution damage.",
    "harm": "Creatures are nauseated for 1 round."
  },
  "Art/Music": {
    "heal": "Creatures gain a channel bonus on Perform checks and on saving throws against illusions, sonic effects, and language-dependent effects for 1 minute.",
    "harm": "Creatures take a channel penalty on saving throws against illusions, sonic effects, and language-dependent effects for 1 minute."
  },
  "Battle/Wrath": {
    "heal": "Creatures gain a channel bonus on weapon damage and critical hit confirmation rolls until the end of your next turn.",
    "harm": "Creatures take a channel penalty on weapon damage and critical hit confirmation rolls until the end of your next turn."
  },
  "Beauty/Love/Lust": {
    "heal": "Creatures gain a channel bonus on saving throws against charm effects and abilities based on fascination or physical attractiveness (such as a nymph's blinding beauty and stunning glance abilities) for 1 minute.",
    "harm": "Creatures gain a channel penalty on saving throws against charm effects and effects that fascinate for 1 minute."
  },
  "Bravery/Valor": {
    "heal": "Creatures affected by fear may attempt another saving throw and receive a channel bonus on the roll. A creature unaffected by fear gains a channel bonus to its Armor Class until the end of your next turn and on its attack roll if it makes a charge attack before your next turn.",
    "harm": "This works like a standard channel (not halved)."
  },
  "Cities": {
    "heal": "Creatures gain a channel bonus on attack rolls when flanking and to Armor Class when flanked until the end of your next turn.",
    "harm": "All creatures' squares and threatened areas are treated as difficult terrain until the start of your next turn (these areas move with the creatures rather than being fixed in place at the time of the channeling). Until the end of your next turn, creatures gain a channel penalty on Acrobatics checks and overrun attempts to move through these squares."
  },
  "Contracts/Oaths": {
    "heal": "Creatures gain a channel bonus on saves against compulsion effects until the end of your next turn.",
    "harm": "Creatures gain a channel penalty on saving throws against compulsions until the end of your next turn."
  },
  "Darkness": {
    "heal": "Creatures gain low-light vision until the end of your next turn. At cleric level 5, they gain darkvision 30 feet as well, increasing this range by 30 feet for every 5 cleric levels thereafter.",
    "harm": "The illumination level in the area drops by 1 step, as darkness, for 1 minute. At cleric level 10, the light level drops by 2 steps. At cleric level 15, it drops by 3 steps, and areas of dim light or darkness become supernaturally dark (even creatures with darkvision cannot see within it)."
  },
  "Death": {
    "heal": "Creatures gain a channel bonus on stabilization checks when dying and on saves against death effects for 1 minute.",
    "harm": "Creatures gain a channel penalty on stabilization checks when dying for 1 minute, and subtract the channel penalty from all healing magic, fast healing, and regeneration."
  },
  "Destruction": {
    "heal": "Creatures gain a channel bonus on attack and damage rolls against objects, CMB for sunder attempts, and Strength checks to break objects until the end of your next turn.",
    "harm": "Unattended objects take full channel damage (not half)."
  },
  "Disease": {
    "heal": "Creatures heal a number of points of ability damage to one ability score (your choice) equal to your channel bonus.",
    "harm": "Creatures are sickened until the end of your next turn, plus a number of rounds equal to your channel penalty. At cleric level 10, you may select one creature as the target of a contagion in addition to the effects of the channeled energy. At cleric level 20, all creatures in the area are subject to contagion in addition to the effects of the channeled energy."
  },
  "Dreams": {
    "heal": "Creatures affected by sleep effects may attempt another saving throw and apply the channel bonus on the roll. Willingly sleeping creatures gain a channel bonus on saving throws and Perception checks for up to 8 hours (this bonus ends if the creature awakens).",
    "harm": "Creatures gain a channel penalty on Perception checks and saving throws against exhaustion, fatigue, and sleep effects for 1 minute."
  },
  "Earth": {
    "heal": "Creatures gain a DR 1/adamantine until the end of your next turn. This DR improves by 1 at 5th level and every 5 levels thereafter. This does not allow recipients to overcome DR/adamantine with their own attacks.",
    "harm": "All squares in the area are treated as difficult terrain for 1 minute."
  },
  "Envy": {
    "heal": "Creatures gain a channel bonus on disarm and steal combat maneuvers, Bluff checks, and Sleight of Hand checks for 1 minute.",
    "harm": "Creatures must attempt a steal combat maneuver on their next turn against an adjacent enemy. This is a compulsion effect."
  },
  "Farming": {
    "heal": "Creatures ignore fatigue (but not exhaustion) for 1 minute. The healing effect is enhanced for plant creatures.",
    "harm": "The damage effect is enhanced for plant creatures. Creatures are fatigued, as if experiencing starvation."
  },
  "Fate": {
    "heal": "Creatures gain a channel bonus on one d20 roll made during their next readied action as long as it is taken before the end of your next turn.",
    "harm": "Creatures gain a channel penalty on ability checks and skill checks for 1 minute."
  },
  "Fire": {
    "heal": "The healing effect is enhanced for creatures with the fire subtype.",
    "harm": "The damage effect is enhanced for creatures with the cold subtype. Affected creatures who fail their saves catch on fire."
  },
  "Forge": {
    "heal": "Creatures in metal armor gain a channel bonus to Armor Class until the end of your next turn. Alternatively, you may repair damage to metal objects and metal constructs as if they were creatures, and this healing is enhanced.",
    "harm": "The damage effect is enhanced against metal constructs and unattended metal objects."
  },
  "Freedom": {
    "heal": "Creatures gain a channel bonus on Escape Artist checks, CMB checks to escape a grapple, and saving throws against becoming entangled, paralyzed, or slowed.",
    "harm": "Creatures are slowed (as slow) until the end of your next turn."
  },
  "Hunting": {
    "heal": "Creatures gain a channel bonus on Survival checks and ranged attack rolls until the end of your next turn.",
    "harm": "Creatures gain a –5 penalty on Stealth checks for 1 minute and temporarily lose effects or special abilities that reduce or negate tracks for that duration."
  },
  "Justice/Law": {
    "heal": "Lawful creatures gain a channel bonus on Perception and Sense Motive checks, attack rolls, and saving throws until the end of your next turn.",
    "harm": "Creatures are affected by zone of truth until the end of your next turn."
  },
  "Knowledge": {
    "heal": "Creatures gain a channel bonus on Knowledge and Perception checks until the end of your next turn.",
    "harm": "Sentient creatures (Intelligence 3+) who fail their saves take 1d2 points of Intelligence damage. A successful save negates this Intelligence damage."
  },
  "Luck": {
    "heal": "Creatures gain a channel bonus or a luck bonus (creature's choice) on one roll (attack roll, CMB check, saving throw, or skill check) made before the end of your next turn.",
    "harm": "Creatures take a channel penalty on all d20 rolls until the end of your next turn."
  },
  "Madness": {
    "heal": "Creatures gain a channel bonus on saving throws against confusion, insanity, rage, and similar effects.",
    "harm": "Creatures are confused until the end of your next turn."
  },
  "Magic": {
    "heal": "Creatures gain a channel bonus on caster level checks and concentration checks until the end of your next turn.",
    "harm": "All creatures must make concentration checks (DC = channel energy DC plus spell level) to use spells or spell-like abilities until the end of your next turn."
  },
  "Monsters": {
    "heal": "The healing effect is enhanced for aberrations, dragons, magical beasts, and monstrous humanoids.",
    "harm": "Creatures gain a channel penalty on attack and damage rolls against summoned and called creatures."
  },
  "Murder": {
    "heal": "Creatures that critically hit before the end of your next turn add a bleed effect equal to your channel bonus.",
    "harm": "Creatures gain a bleed effect equal to your channel penalty."
  },
  "Nature": {
    "heal": "The healing effect is enhanced for animals and fey. Creatures gain a channel bonus on Handle Animal and wild empathy checks for 1 minute.",
    "harm": "The harmful effect is enhanced for animals and fey."
  },
  "Nightmares": {
    "heal": "Creatures gain a channel bonus on charm and compulsion saves for 1 minute.",
    "harm": "Creatures gain a channel penalty on concentration checks and saves against fear and phantasms."
  },
  "Pain": {
    "heal": "Creatures gain a channel bonus on pain effect saves for 1 minute.",
    "harm": "Creatures are sickened until the end of your next turn, plus a number of rounds equal to your channel penalty. At cleric level 10, you may select one creature to be nauseated in addition to the effects of the channeled energy."
  },
  "Poison": {
    "heal": "Creatures gain a channel bonus on poison saves for 1 minute.",
    "harm": "Creatures take 1 point of Strength, Dexterity, or Constitution damage (your choice) as a poison effect."
  },
  "Protection": {
    "heal": "Creatures gain a channel bonus to Armor Class until the end of your next turn.",
    "harm": "Creatures gain a channel penalty to Armor Class until the end of your next turn."
  },
  "Revenge/Vengeance": {
    "heal": "This works like a standard channel (not halved).",
    "harm": "Creatures gain a channel penalty on attack rolls until the end of your next turn."
  },
  "Rulership": {
    "heal": "Creatures gain a channel bonus on Diplomacy checks and to the DC of their language-dependent and charm effects until the end of your next turn.",
    "harm": "Creatures are dazed for 1 round."
  },
  "Ocean/Sea/Water": {
    "heal": "Creatures gain a channel bonus on Climb and Swim checks and Constitution checks to hold their breath; this bonus lasts for 1 minute. Creatures ignore fatigue from thirst and pressure damage from deep water for 1 minute.",
    "harm": "The harming effect is enhanced for creatures with the aquatic or water subtypes."
  },
  "Secrets": {
    "heal": "Creatures gain a channel bonus on Sense Motive checks and caster level checks and to save DCs of their divination spells until the end of your next turn.",
    "harm": "Creatures gain a channel penalty on saving throws against divinations for 1 minute. Creatures using Sense Motive against affected creatures for the next minute gain a channel bonus on Sense Motive checks. Self-Perfection: Heal—Creatures may ignore one temporary condition of their choice until the end of your next turn. Harm—Creatures gain a channel penalty on attempts to dispel, remove, or make additional saving throws against all ongoing conditions for 1 minute (this does not apply to any initial saving throw allowed against such an effect but does apply to effects that begin during this duration)."
  },
  "Slavery/Tyranny": {
    "heal": "Creatures ignore fatigue and exhaustion for 1 minute.",
    "harm": "Creatures gain a channel penalty on saves against compulsions, pain, and stun for 1 minute."
  },
  "Strategy": {
    "heal": "Until your next turn, creatures using aid another add your channel bonus to the aided creature's roll in addition to the normal aid another bonus.",
    "harm": "Creatures may not take attacks of opportunity until the end of your next turn."
  },
  "Strength": {
    "heal": "Creatures gain a channel bonus on all Strength-based attacks, combat maneuver checks that rely on Strength, Strength-based skills, and Strength checks until the end of your next turn.",
    "harm": "Creatures gain a channel penalty on all Strength-based rolls and to Strength-based game statistics (such as CMD) until the end of your next turn."
  },
  "Sun": {
    "heal": "The illumination level in the area increases by one step, and creatures gain a channel bonus on saves against blindness and light-based effects.",
    "harm": "Creatures are dazzled for 1 minute; creatures with light blindness or light sensitivity are blinded instead of dazzled."
  },
  "Trickery": {
    "heal": "Creatures gain a channel bonus on Bluff, Disguise, Sleight of Hand, and Stealth checks for 1 minute.",
    "harm": "Creatures gain a channel penalty on Perception and Sense Motive checks for 1 minute."
  },
  "Undeath": {
    "heal": "This works like a standard channel (not halved).",
    "harm": "The healing effect is enhanced for undead creatures and those with negative energy affinity."
  },
  "Weapons": {
    "heal": "Creatures gain a channel bonus on attack rolls until the end of your next turn when wielding your deity's favored weapon.",
    "harm": "Creatures gain a channel penalty on attack and damage rolls until the end of your next turn when wielding manufactured weapons."
  },
  "Weather": {
    "heal": "Creatures gain a channel bonus on saving throws against electricity, sonic, and wind effects.",
    "harm": "Each time you channel energy, you may change half the channeled energy damage to electricity or sonic damage."
  }
};
