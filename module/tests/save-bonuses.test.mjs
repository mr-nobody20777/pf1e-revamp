// Save bonuses against kinds of effects, read from the save's chat card: racial (halfling vs fear,
// dwarf vs poison/spells, elf vs enchantment), buffs (Remove Fear, Mind Blank), stacking.

import { createTestActor, fromPack, addItems, waitFor, cleanup } from "./helpers.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerSaveBonusTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.save-bonuses",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Save bonuses against effects", function () {
        this.timeout(45000);
        let caster, cards = {}, messagesBefore;
        const actors = [];

        async function withRace(name, raceName) {
          const actor = await createTestActor(name, { items: [["pf1.classes", "Fighter", { system: { level: 1 } }]] });
          actors.push(actor);
          if (raceName) await actor.createEmbeddedDocuments("Item", [await fromPack("pf1.races", raceName)], { pf1eRevampNoPrompt: true });
          return actor;
        }
        const saveFormula = async (actor, card, save = "will") =>
          (await actor.rollSavingThrow(save, { skipDialog: true, reference: card?.uuid })).rolls[0].formula;

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          caster = await createTestActor("Quench Effect Caster", { abilities: { int: 18 }, items: [["pf1.classes", "Wizard", { system: { level: 7 } }]] });
          actors.push(caster);
          const book = (level) => ({ system: { spellbook: "primary", level, preparation: { value: 1, max: 1 } } });
          const spells = await addItems(caster, [["pf1.spells", "Cause Fear", book(1)], ["pf1.spells", "Charm Person", book(1)], ["pf1.spells", "Poison", book(4)], ["pf1.spells", "Magic Missile", book(1)]]);
          for (const spell of spells) {
            const before = new Set(game.messages.keys());
            await spell.use({ skipDialog: true, cost: 0 });
            cards[spell.name] = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.itemSource === spell));
          }
        });

        after(async () => cleanup(actors, messagesBefore));

        it("halfling: +2 racial vs fear (Cause Fear), nothing vs Charm Person", async () => {
          const halfling = await withRace("Quench Halfling", "Halfling");
          assert.match(await saveFormula(halfling, cards["Cause Fear"]), /2\[Halfling\]/);
          // (the +1 there is PF1's own Halfling Luck on all saves)
          assert.notMatch(await saveFormula(halfling, cards["Charm Person"]), /2\[Halfling\]/);
        });

        it("halfling with the Fearless trait too: the race's +2 vs fear still counts once", async () => {
          const halfling = await withRace("Quench Fearless Halfling", "Halfling");
          const pack = game.packs.get("pf-content.pf-racial-traits");
          const fearless = await pack.getDocument((await pack.getIndex()).find((e) => e.name === "Fearless (Halfling)")._id);
          await halfling.createEmbeddedDocuments("Item", [game.items.fromCompendium(fearless)]);
          const formula = await saveFormula(halfling, cards["Cause Fear"]);
          assert.lengthOf(formula.match(/2\[(Halfling|Fearless[^\]]*)\]/g) ?? [], 1);
        });

        it("dwarf: +2 vs poison and vs spells (Charm Person), from the same note", async () => {
          const dwarf = await withRace("Quench Dwarf", "Dwarf");
          assert.match(await saveFormula(dwarf, cards["Poison"], "fort"), /2\[Dwarf\]/);
          assert.match(await saveFormula(dwarf, cards["Charm Person"]), /2\[Dwarf\]/);
        });

        it("elf: +2 vs enchantment (Charm Person), not vs necromancy fear (Cause Fear)", async () => {
          const elf = await withRace("Quench Elf", "Elf");
          assert.match(await saveFormula(elf, cards["Charm Person"]), /2\[Elf\]/);
          assert.notMatch(await saveFormula(elf, cards["Cause Fear"]), /\[Elf\]/);
        });

        it("Remove Fear: +4 morale vs fear; no card, no bonus", async () => {
          const human = await withRace("Quench Brave Human");
          await addItems(human, [["pf-content.pf-buffs", "Remove Fear", { system: { active: true } }]]);
          assert.match(await saveFormula(human, cards["Cause Fear"]), /4\[Remove Fear\]/);
          assert.notMatch(await saveFormula(human, null), /Remove Fear/);
        });

        it("Mind Blank +8 resistance vs mind-affecting spells only adds what's above an existing +1 resistance", async () => {
          const human = await withRace("Quench Mind Blank Human");
          await addItems(human, [["pf-content.pf-buffs", "Mind Blank", { system: { active: true } }]]);
          await human.createEmbeddedDocuments("Item", [{ name: "Cloak of Resistance +1", type: "buff", system: { active: true, changes: [{ _id: foundry.utils.randomID(8), target: "allSavingThrows", type: "resist", formula: "1" }] } }]);
          assert.match(await saveFormula(human, cards["Charm Person"]), /7\[Mind Blank\]/);
          assert.notMatch(await saveFormula(human, cards["Magic Missile"], "ref"), /Mind Blank/, "not mind-affecting");
        });
      });
    },
    { displayName: "PF1e Revamp: Save Bonuses vs Effects" }
  );
}
