// Subclass powers for the party: the Foresight subschool (keeps Divination's Forewarned, replaces
// Diviner's Fortune and Scrying Adept with Prescience and Foretell) and the Luck and Protection
// domains (cleric powers only, never the warpriest blessings PF1 tags the same way).

import { createTestActor, fromPack, addItems, cleanup, waitFor, waitForItem } from "./helpers.mjs";
import { promptApply } from "../subclass.mjs";
import { setOpposition, specialtyOf } from "../opposition-schools.mjs";

const MODULE_ID = "pf1e-revamp";

async function grant(actor, name) {
  const data = await fromPack("pf1.class-abilities", name);
  const [item] = await actor.createEmbeddedDocuments("Item", [data], { [`${MODULE_ID}NoPrompt`]: true });
  await promptApply(actor, item, { grantAll: true });
  return item;
}

const linkedNames = async (classItem) => {
  const out = {};
  for (const link of classItem.system.links.classAssociations ?? []) out[(await fromUuid(link.uuid))?.name] = link.level;
  return out;
};

export function registerSubclassTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.subclass",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Subclass powers", function () {
        this.timeout(60000);
        let messagesBefore;
        const actors = [];
        before(() => (messagesBefore = new Set(game.messages.keys())));
        after(async () => cleanup(actors, messagesBefore));

        describe("Foresight subschool (wizard 1)", function () {
          let wizard, links;
          before(async () => {
            wizard = await createTestActor("Quench Foresight", { abilities: { int: 16 }, items: [["pf1.classes", "Wizard", { system: { level: 1 } }]] });
            actors.push(wizard);
            await waitForItem(wizard, "Arcane School");
            await grant(wizard, "Foresight Subschool");
            links = await linkedNames(wizard.itemTypes.class[0]);
          });

          it("Forewarned (from Divination) and Prescience at 1st, with Forewarned's initiative bonus", async () => {
            assert.equal(links["Forewarned"], 1);
            assert.equal(links["Prescience"], 1);
            await waitForItem(wizard, "Prescience");
            const forewarned = await waitForItem(wizard, "Forewarned");
            assert.ok(forewarned.system.changes.some((c) => c.target === "init"));
          });

          it("opposition schools: their spells cost two slots, including ones added later", async () => {
            const school = wizard.items.getName("Foresight Subschool");
            assert.equal(specialtyOf(school), "div");
            // PF1 sets up a new wizard's spellbook a moment after the class is added
            await waitFor(() => Object.values(wizard.system.attributes.spells.spellbooks).some((b) => b.inUse && b.class === "wizard"));
            const book = { system: { spellbook: "primary", level: 1 } };
            const [missile, armor] = await addItems(wizard, [["pf1.spells", "Magic Missile", book], ["pf1.spells", "Mage Armor", book]]);
            await setOpposition(wizard, school, ["evo", "nec"]);
            assert.equal(missile.slotCost, 2, "evocation is opposed");
            assert.equal(armor.slotCost, 1, "conjuration isn't");
            const [hands] = await addItems(wizard, [["pf1.spells", "Burning Hands", book]]);
            await waitFor(() => hands.slotCost === 2);
            await setOpposition(wizard, school, ["con", "nec"]);
            assert.equal(missile.slotCost, 1, "changed: evocation no longer opposed");
            assert.equal(armor.slotCost, 2);
          });

          it("Foretell, once added, lasts rounds per day equal to wizard level (PF1's data says Int mod)", async () => {
            const [foretell] = await wizard.createEmbeddedDocuments("Item", [await fromPack("pf1.class-abilities", "Foretell")]);
            await waitFor(() => foretell.system.uses.maxFormula === "@class.level", { what: "Foretell's uses to be corrected" });
            await foretell.delete();
          });

          it("Foretell at 8th; Diviner's Fortune and Scrying Adept replaced", () => {
            assert.equal(links["Foretell"], 8);
            assert.notProperty(links, "Diviner's Fortune");
            assert.notProperty(links, "Scrying Adept");
            assert.isUndefined(wizard.items.getName("Foretell"), "not yet at 1st level");
          });
        });

        describe("Luck and Protection domains (cleric 1)", function () {
          let cleric, links;
          before(async () => {
            cleric = await createTestActor("Quench Luck Protection", { items: [["pf1.classes", "Cleric", { system: { level: 1 } }]] });
            actors.push(cleric);
            await waitForItem(cleric, "Domains");
            await grant(cleric, "Luck Domain");
            await grant(cleric, "Protection Domain");
            links = await linkedNames(cleric.itemTypes.class[0]);
          });

          it("Bit of Luck and Resistant Touch on the sheet; Good Fortune at 6th, Aura of Protection at 8th", async () => {
            await waitForItem(cleric, "Bit of Luck");
            await waitForItem(cleric, "Resistant Touch");
            assert.equal(links["Good Fortune"], 6);
            assert.equal(links["Aura of Protection (Domain Power)"], 8);
          });

          it("the domains are tied to the Cleric class, so their formulas scale (Protection: +1, +1 per 5 levels)", () => {
            assert.equal(cleric.items.getName("Protection Domain").system.class, "cleric");
            assert.equal(cleric.items.getName("Luck Domain").system.class, "cleric");
          });

          it("no warpriest blessings", () => {
            for (const name of ["Lucky Presence", "Unlucky Enemy", "Increased Defense", "Luck Blessing", "Protection Blessing", "Aura of Protection (Blessing)"]) {
              assert.notProperty(links, name);
              assert.isUndefined(cleric.items.getName(name));
            }
          });
        });
      });
    },
    { displayName: "PF1e Revamp: Subclass Powers" }
  );
}
