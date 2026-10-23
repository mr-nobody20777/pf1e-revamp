// The party's character traits: choice traits (Criminal, Magical Knack, Gifted Adept), Magical
// Knack's Hit Dice cap, Gifted Adept's +1 caster level, Swordlord's Page on crit confirmation, and
// Lonely's penalty vs charm spells only.

import { createTestActor, addItems, useAndCollect, waitFor, cleanup } from "./helpers.mjs";
import { chooseTrait } from "../traits.mjs";

const TRAITS = "pf-content.pf-traits";

async function trait(actor, name) {
  const pack = game.packs.get(TRAITS);
  const entry = (await pack.getIndex()).find((e) => e.name === name);
  const data = game.items.fromCompendium(await pack.getDocument(entry._id), { clearFolder: true });
  const [item] = await actor.createEmbeddedDocuments("Item", [data], { pf1eRevampNoPrompt: true });
  return item;
}

export function registerTraitTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.traits",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Character traits", function () {
        this.timeout(45000);
        if (!game.packs.get(TRAITS)) return;
        let messagesBefore;
        const actors = [];
        const actor = async (name, items, abilities = {}) => {
          const a = await createTestActor(name, { abilities, items });
          actors.push(a);
          return a;
        };
        before(() => (messagesBefore = new Set(game.messages.keys())));
        after(async () => cleanup(actors, messagesBefore));

        it("Criminal: +1 trait bonus on the chosen skill, and it's a class skill", async () => {
          const rogue = await actor("Quench Criminal", [["pf1.classes", "Sorcerer", { system: { level: 1 } }]]);
          const before = rogue.system.skills.int.mod;
          await chooseTrait(await trait(rogue, "Criminal"), { picks: { skill: "int" } });
          assert.equal(rogue.system.skills.int.mod, before + 1 + (rogue.system.skills.int.rank > 0 ? 3 : 0));
          assert.isTrue(rogue.system.skills.int.cs);
        });

        it("Magical Knack: nothing for a single-class caster; +2 once Hit Dice exceed the class level", async () => {
          const wizard = await actor("Quench Knack Wizard", [["pf1.classes", "Wizard", { system: { level: 1 } }]], { int: 16 });
          const book = () => Object.values(wizard.system.attributes.spells.spellbooks).find((b) => b.class === "wizard");
          const clBefore = book().cl.total;
          await chooseTrait(await trait(wizard, "Magical Knack"), { picks: { class: "wizard" } });
          assert.equal(book().cl.total, clBefore, "single class: no bonus");
          await addItems(wizard, [["pf1.classes", "Fighter", { system: { level: 2 } }]]);
          await waitFor(() => wizard.system.attributes.hd.total === 3);
          assert.equal(book().cl.total, clBefore + 2, "HD 3, wizard 1: +2");
        });

        it("Gifted Adept: the chosen spell's effects use +1 caster level", async () => {
          const wizard = await actor("Quench Gifted Adept", [["pf1.classes", "Wizard", { system: { level: 1 } }]], { int: 16 });
          // Shocking Grasp: (min(5, CL))d6, and no area template to place
          const [grasp] = await addItems(wizard, [["pf1.spells", "Shocking Grasp", { system: { spellbook: "primary", level: 1, preparation: { value: 2, max: 2 } } }]]);
          const damage = async () => {
            const before = new Set(game.messages.keys());
            await grasp.use({ skipDialog: true });
            const card = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.itemSource === grasp));
            return card.systemRolls.attacks[0].damage[0].formula;
          };
          // PF1 keeps the formula with the caster level filled in: "(min(5,1))d6"
          assert.match(await damage(), /min\(5,\s*1\)\)d6/, "CL 1");
          await chooseTrait(await trait(wizard, "Gifted Adept"), { picks: { spell: "Shocking Grasp" } });
          assert.match(await damage(), /min\(5,\s*2\)\)d6/, "CL 2 with Gifted Adept");
        });

        it("Swordlord's Page: +1 on the longsword's crit confirmation, not on the attack", async () => {
          const page = await actor("Quench Swordlord's Page", [["pf1.classes", "Fighter", { system: { level: 1 } }], ["pf1.weapons-and-ammo", "Longsword"]]);
          await trait(page, "Swordlord's Page (Brevoy)");
          const random = CONFIG.Dice.randomUniform;
          CONFIG.Dice.randomUniform = () => 0.001; // Foundry dice use 1 − u: a natural 20, so a threat and a confirmation roll
          let card;
          try {
            [card] = await useAndCollect(page.items.getName("Longsword"));
          } finally {
            CONFIG.Dice.randomUniform = random;
          }
          const atk = card.systemRolls.attacks[0];
          assert.notMatch(atk.attack.formula, /Swordlord/);
          assert.match(atk.critConfirm.formula, /1\[Swordlord's Page\]/);
        });

        it("Student of Philosophy: Diplomacy card also shows the total with Int", async () => {
          const sage = await actor("Quench Philosopher", [["pf1.classes", "Wizard", { system: { level: 1 } }]], { int: 18, cha: 10 });
          await trait(sage, "Student of Philosophy");
          const message = await sage.rollSkill("dip", { skipDialog: true });
          assert.equal(message.flags["pf1e-revamp"]?.altAbility?.delta, 4, "Int +4 vs Cha +0");
          const html = await message.renderHTML();
          assert.match(html.querySelector(".pf1e-revamp-alt-total")?.textContent ?? "", new RegExp(`${message.rolls[0].total + 4}`));
          const perception = await sage.rollSkill("per", { skipDialog: true });
          assert.notOk(perception.flags["pf1e-revamp"]?.altAbility, "other skills unaffected");
        });

        it("Lonely: −2 vs charm spells, not vs other spells", async () => {
          const lonely = await actor("Quench Lonely", [["pf1.classes", "Fighter", { system: { level: 1 } }]]);
          await trait(lonely, "Lonely");
          const caster = await actor("Quench Charmer", [["pf1.classes", "Wizard", { system: { level: 3 } }]], { int: 16 });
          const spells = await addItems(caster, [["pf1.spells", "Charm Person", { system: { spellbook: "primary", level: 1 } }], ["pf1.spells", "Cause Fear", { system: { spellbook: "primary", level: 1 } }]]);
          const cards = {};
          for (const s of spells) {
            const before = new Set(game.messages.keys());
            await s.use({ skipDialog: true, cost: 0 });
            cards[s.name] = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.itemSource === s));
          }
          const save = async (card) => (await lonely.rollSavingThrow("will", { skipDialog: true, reference: card.uuid })).rolls[0].formula;
          assert.match(await save(cards["Charm Person"]), /-\s*2\[Lonely\]/); // PF1 writes "+ -2" as "- 2"
          assert.notMatch(await save(cards["Cause Fear"]), /Lonely/);
        });
      });
    },
    { displayName: "PF1e Revamp: Character Traits" }
  );
}
