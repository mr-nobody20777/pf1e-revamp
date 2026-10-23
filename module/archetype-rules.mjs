// Mechanics for archetype features. pf1e-archetypes ships them as text only, so the bonuses an
// archetype feature grants, and how it changes the base features it alters, are written out here.
// Every archetype applied gets the generic treatment regardless (altered base features are renamed
// "Feature (Archetype)" and link to what altered them); entries here add the mechanics.
//
// Keyed by the archetype feature's name. Fields (all optional):
//   changes / notes  added to the archetype feature: [target, type, formula] / [target, text]
//   uses             the archetype feature's own uses: { per, maxFormula }
//   alters           by base feature tag: how that base feature changes
//                      changeTargets: keep only the base feature's changes with these targets
//                      uses:          new max uses formula
//                      summary:       the rules sentence describing the change (from the archetype text)
//   spellbook        set on the class's spellbook (e.g. { domainSlotValue: 0 })
//   armorProf / weaponProf  preselected proficiencies in the review dialog

export const ARCHETYPE_RULES = {
  /* Skald (Battle Scion) */
  "Courtly Presence (Battle Scion)": {
    changes: [["skill.int", "untyped", "floor(@attributes.hd.total / 2)"]],
    notes: [["skill.int", "Courtly Presence: starts any verbal duel with an extra edge for the presence tactic (unless at a significant or extreme disadvantage)."]],
    alters: {
      bardicKnowledge: {
        changeTargets: ["skill.kge", "skill.khi", "skill.klo", "skill.kno"],
        summary: "Bardic knowledge applies to only Knowledge (geography), Knowledge (history), Knowledge (local), and Knowledge (nobility).",
      },
    },
  },

  /* Cleric (Blossoming Light) */
  "Promise of Faith (Blossoming Light)": {
    armorProf: [],
  },
  "Luminous Font (Blossoming Light)": {
    notes: [["skill.dip", "Luminous Font: +[[floor(@class.level / 2)]] on Diplomacy checks against good creatures, or to convince an evil creature to take an action against its evil nature."]],
    alters: {
      classFeat_channelEnergy: {
        uses: "5 + @abilities.cha.mod + floor(@class.level / 2)",
        summary: "Channel energy is usable a number of times per day equal to 5 + her Charisma modifier, plus one use at 2nd level and every 2 levels thereafter.",
      },
      domains: {
        summary: "Still selects domains and retains access to domain powers, but does not gain domain spell slots.",
      },
    },
    spellbook: { domainSlotValue: 0 },
  },

  /* Wizard (Chronomancer) */
  "Temporal Pool (Chronomancer)": {
    uses: { per: "day", maxFormula: "max(1, floor(@class.level / 2) + @abilities.int.mod)" },
  },
};
