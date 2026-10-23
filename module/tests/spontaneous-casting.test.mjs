// Cleric spontaneous casting: lose a prepared spell (not an orison or domain spell) to cast a cure
// spell of its level or lower; evil clerics get inflict spells.

import { createTestActor, addItems, waitFor, cleanup } from "./helpers.mjs";
import { canConvert, convert, spellOptions } from "../spontaneous-casting.mjs";

export function registerSpontaneousCastingTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.spontaneous-casting",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Spontaneous casting (cleric)", function () {
        this.timeout(30000);
        let cleric, bless, light, domainSpell, messagesBefore;
        const prepared = (value) => ({ system: { spellbook: "primary", preparation: { value, max: value } } });

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          cleric = await createTestActor("Quench Spontaneous Cleric", {
            abilities: { wis: 16 },
            system: { details: { alignment: "ng" } },
            items: [["pf1.classes", "Cleric", { system: { level: 3 } }]],
          });
          [bless, light, domainSpell] = await addItems(cleric, [
            ["pf1.spells", "Bless", foundry.utils.mergeObject(prepared(2), { system: { level: 1 } })],
            ["pf1.spells", "Light", foundry.utils.mergeObject(prepared(3), { system: { level: 0 } })],
            ["pf1.spells", "Shield Other", foundry.utils.mergeObject(prepared(1), { system: { level: 2, domain: true } })],
          ]);
        });

        after(async () => cleanup([cleric], messagesBefore));

        it("orisons and domain spells can't be converted", () => {
          assert.isTrue(canConvert(bless));
          assert.isFalse(canConvert(light), "orison");
          assert.isFalse(canConvert(domainSpell), "domain spell");
        });

        it("losing Bless casts Cure Light Wounds without spending a slot of its own", async () => {
          const before = new Set(game.messages.keys());
          await convert(bless, { spellName: "Cure Light Wounds", skipDialog: true });
          assert.equal(bless.system.preparation.value, 1, "one Bless lost");
          const cure = cleric.itemTypes.spell.find((s) => s.name === "Cure Light Wounds");
          assert.ok(cure, "added to the spellbook");
          assert.equal(cure.system.preparation.value, 0);
          await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.itemSource === cure));
        });

        it("offers cure spells of the lost spell's level or lower only", async () => {
          const level1 = (await spellOptions("cure", 1)).map((o) => o.entry.name);
          assert.include(level1, "Cure Light Wounds");
          assert.notInclude(level1, "Cure Moderate Wounds");
          const level2 = (await spellOptions("cure", 2)).map((o) => o.entry.name);
          assert.includeMembers(level2, ["Cure Light Wounds", "Cure Moderate Wounds"]);
          assert.equal(level2[0], "Cure Moderate Wounds", "highest first");
        });

        it("evil clerics convert to inflict spells", async () => {
          await cleric.update({ "system.details.alignment": "ne" });
          await convert(bless, { spellName: "Inflict Light Wounds", skipDialog: true });
          assert.ok(cleric.itemTypes.spell.find((s) => s.name === "Inflict Light Wounds"));
          assert.equal(bless.system.preparation.value, 0);
        });
      });
    },
    { displayName: "PF1e Revamp: Spontaneous Casting" }
  );
}
