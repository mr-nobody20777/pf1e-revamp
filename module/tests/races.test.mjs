// Racial traits: the race's pf-content traits added on review, alternate traits replacing standard
// ones (including the bonus on the race item itself), the "+2 to one ability of your choice", real
// fire resistance for Ifrits, and resistances that don't stack.

import { createTestActor, fromPack, cleanup } from "./helpers.mjs";
import { promptRacialTraits, revertRacialTraits } from "../races.mjs";

const MODULE_ID = "pf1e-revamp";

async function withRace(name, raceName) {
  const actor = await createTestActor(name, { abilities: { str: 10, dex: 10 }, items: [["pf1.classes", "Sorcerer", { system: { level: 1 } }]] });
  const [race] = await actor.createEmbeddedDocuments("Item", [await fromPack("pf1.races", raceName)], { pf1eRevampNoPrompt: true });
  return { actor, race };
}

const fireResistance = (actor) => (actor.system.traits.eres?.value ?? []).filter((e) => e.types?.includes("fire"));

export function registerRaceTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.races",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Racial traits", function () {
        this.timeout(30000);
        if (!game.packs.get("pf-content.pf-racial-traits")) return;
        let messagesBefore;
        const actors = [];
        before(() => (messagesBefore = new Set(game.messages.keys())));
        after(async () => cleanup(actors, messagesBefore));

        it("Human: +2 to the chosen ability; Skilled and Bonus Feat don't count twice", async () => {
          const { actor, race } = await withRace("Quench Human", "Human");
          actors.push(actor);
          const strBefore = actor.system.abilities.str.total;
          const ranksBefore = actor.system.details?.skills?.bonusRanks ?? null;
          await promptRacialTraits(actor, race, { choose: { abilities: { "+2 to One Ability Score (Human)": ["str"] } } });
          assert.equal(actor.system.abilities.str.total, strBefore + 2);
          const skilled = actor.items.getName("Skilled (Human)");
          assert.ok(skilled, "trait on the sheet");
          assert.isEmpty(skilled.system.changes, "its skill ranks stay on the race only");
          assert.isEmpty(actor.items.getName("Bonus Feat (Human)").system.changes);
          // its "Replaced Trait(s)" label is split across two bold tags in pf-content
          assert.isUndefined(actor.items.getName("Adoptive Parentage (Weapon Focus)"), "an alternate trait, not standard");
          void ranksBefore;
        });

        it("Human with Heart of the Fey: Skilled is replaced, including the race's extra skill ranks", async () => {
          const { actor, race } = await withRace("Quench Fey Human", "Human");
          actors.push(actor);
          const refBefore = actor.system.attributes.savingThrows.ref.total;
          await promptRacialTraits(actor, race, { choose: { alternates: ["Heart of the Fey"], abilities: { "+2 to One Ability Score (Human)": ["str"] } } }); // not Dex: that would move Reflex too
          assert.isUndefined(actor.items.getName("Skilled (Human)"));
          assert.isFalse(race.system.changes.some((c) => c.target === "bonusSkillRanks"), "race's skilled ranks removed");
          assert.equal(actor.system.attributes.savingThrows.ref.total, refBefore + 1);
          assert.equal(race.getFlag(MODULE_ID, "racialTraits").dropped[0], "Skilled (Human)");
        });

        it("Ifrit: fire resistance 5 (real), darkvision 60, Burning Hands 1/day", async () => {
          const { actor, race } = await withRace("Quench Ifrit", "Ifrit");
          actors.push(actor);
          await promptRacialTraits(actor, race, { choose: {} });
          assert.deepEqual(fireResistance(actor).map((e) => e.amount), [5]);
          assert.equal(actor.system.traits.senses.dv.total, 60);
          assert.ok(actor.items.getName("Spell-Like Ability (Ifrit)")?.actions.size);
        });

        it("resistances don't stack: a hand-entered fire 10 and the racial fire 5 leave one fire 10", async () => {
          const actor = actors.find((a) => a.name === "Quench Ifrit");
          await actor.update({ "system.traits.eres.value": [{ amount: 10, operator: true, types: ["fire", ""] }] });
          assert.deepEqual(fireResistance(actor).map((e) => e.amount), [10]);
        });

        it("Ifrit with Wildfire Heart: +4 initiative instead of fire resistance; removing restores", async () => {
          const { actor, race } = await withRace("Quench Wildfire Ifrit", "Ifrit");
          actors.push(actor);
          const initBefore = actor.system.attributes.init.total;
          await promptRacialTraits(actor, race, { choose: { alternates: ["Wildfire Heart"] } });
          assert.isEmpty(fireResistance(actor));
          assert.equal(actor.system.attributes.init.total, initBefore + 4);
          await revertRacialTraits(actor, race);
          assert.isUndefined(actor.items.getName("Wildfire Heart"));
          assert.equal(actor.system.attributes.init.total, initBefore);
        });
      });
    },
    { displayName: "PF1e Revamp: Racial Traits" }
  );
}
