// Subclass powers, using the Solar bloodline: granting links powers into the class at their levels,
// trait grants scale with level, Bloodline Arcana adds +1 per die to fire spells, removal reverts.

import { createTestActor, fromPack, useAndCollect, formulas, cleanup, waitFor, waitForItem } from "./helpers.mjs";
import { promptApply } from "../subclass.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerSolarTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.solar",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Subclass powers: Solar bloodline", function () {
        this.timeout(45000);
        let sorc, sorcClass, bloodline, messagesBefore;
        const fire = () => sorc.system.traits.eres?.value?.find((e) => e.types?.includes("fire"))?.amount ?? 0;
        const powerNames = ["Sunsight", "Friend of Fire", "Cleansing Flame", "Healing Fire", "Solar Ascension"];

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          sorc = await createTestActor("Quench Sorcerer", { abilities: { cha: 16 }, items: [["pf1.classes", "Sorcerer", { system: { level: 3 } }]] });
          sorcClass = sorc.itemTypes.class[0];
          const data = await fromPack("pf1.class-abilities", "Solar Bloodline");
          [bloodline] = await sorc.createEmbeddedDocuments("Item", [data], { [`${MODULE_ID}NoPrompt`]: true });
          await promptApply(sorc, bloodline, { grantAll: true });
        });

        after(async () => cleanup([sorc], messagesBefore));

        it("links all five Solar powers into the class at their levels", async () => {
          const links = sorcClass.system.links.classAssociations;
          const linked = await Promise.all(links.map(async (l) => ({ name: (await fromUuid(l.uuid))?.name, level: l.level })));
          const expected = { Sunsight: 1, "Friend of Fire": 3, "Cleansing Flame": 9, "Healing Fire": 15, "Solar Ascension": 20 };
          for (const [name, level] of Object.entries(expected)) assert.deepInclude(linked, { name, level });
        });

        it("adds only the powers reached at level 3", () => {
          assert.ok(sorc.items.getName("Sunsight"));
          assert.ok(sorc.items.getName("Friend of Fire"));
          assert.notOk(sorc.items.getName("Cleansing Flame"));
        });

        it("Sunsight: dazzled immunity; Friend of Fire: fire resistance 10", () => {
          assert.isTrue(sorc.system.traits.ci.total.has("dazzle"));
          assert.equal(fire(), 10);
        });

        it("leveling to 9 adds Cleansing Flame and raises fire resistance to 20", async () => {
          await sorcClass.update({ "system.level": 9 });
          await waitForItem(sorc, "Cleansing Flame");
          await waitFor(() => fire() === 20);
        });

        it("Bloodline Arcana: fire spells get +1 per damage die, others don't", async () => {
          const book = Object.keys(sorc.system.attributes.spells.spellbooks).find((k) => sorc.system.attributes.spells.spellbooks[k].inUse) ?? "primary";
          const spells = [];
          for (const name of ["Burning Hands", "Magic Missile"]) {
            const spell = await fromPack("pf1.spells", name);
            spell.system.spellbook = book;
            spell.system.atWill = true;
            spells.push(spell);
          }
          await sorc.createEmbeddedDocuments("Item", spells);
          const noTemplate = { options: { measureTemplate: false } }; // don't wait for a cone to be placed
          const [burning] = await useAndCollect(sorc.items.getName("Burning Hands"), noTemplate);
          const damage = formulas(burning)[0]?.damage ?? burning.systemRolls?.attacks?.[0]?.damage?.map((d) => d.formula).join(" + ");
          assert.match(damage, /5\[Bloodline Arcana\]/, "5d4 at caster level 9");
          const [missile] = await useAndCollect(sorc.items.getName("Magic Missile"), noTemplate);
          assert.notMatch(JSON.stringify(formulas(missile)), /Bloodline Arcana/);
        });

        it("deleting the bloodline removes its powers and unlinks them", async () => {
          await bloodline.delete();
          await waitFor(() => !powerNames.some((n) => sorc.items.getName(n) && n !== "Solar Ascension"));
          // The class's links are updated after the items are removed
          const linkedPower = async () => (await Promise.all(sorcClass.system.links.classAssociations.map((l) => fromUuid(l.uuid)))).some((d) => ["Sunsight", "Friend of Fire", "Cleansing Flame"].includes(d?.name));
          await waitFor(async () => !(await linkedPower()), { what: "the powers to be unlinked" });
          assert.equal(fire(), 0);
        });
      });
    },
    { displayName: "PF1e Revamp: Subclass Powers (Solar)" }
  );
}
