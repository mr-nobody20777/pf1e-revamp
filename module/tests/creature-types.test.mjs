// Creature types after templates: a template's type replaces the race's, subtypes follow the
// template's text, misspelled subtypes match, and two type-changing templates need a choice.

import { createTestActor, fromPack, cleanup } from "./helpers.mjs";
import { creatureTypes } from "../creature-types.mjs";

const MODULE_ID = "pf1e-revamp";
const NO_PROMPT = { pf1eRevampNoPrompt: true };

export function registerCreatureTypeTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.creature-types",
    (context) => {
      const { describe, it, assert, after } = context;

      describe("Creature types after templates", function () {
        this.timeout(30000);
        const actors = [];
        const messagesBefore = new Set(game.messages.keys());
        const build = async (name, entries) => {
          const actor = await createTestActor(name);
          actors.push(actor);
          const data = [];
          for (const [pack, itemName] of entries) data.push(await fromPack(pack, itemName));
          await actor.createEmbeddedDocuments("Item", data, NO_PROMPT);
          return actor;
        };
        const template = (actor, name) => actor.itemTypes.feat.find((i) => i.name === name);

        after(async () => cleanup(actors, messagesBefore));

        it("a half-fiend goblin is an outsider (native), not a humanoid, and keeps goblinoid", async () => {
          const actor = await build("Quench Half-Fiend Goblin", [["pf1.races", "Goblin"], ["pf1.monster-templates", "Half-Fiend"]]);
          const { types, subtypes } = creatureTypes(actor);
          assert.deepEqual([...types], ["outsider"]);
          assert.isTrue(subtypes.has("native"));
          assert.isTrue(subtypes.has("goblinoid"), "Half-Fiend's text doesn't drop subtypes");
        });

        it("a human zombie is undead and drops the human subtype; the GM can keep it on the template", async () => {
          const actor = await build("Quench Human Zombie", [["pf1.races", "Human"], ["pf1.monster-templates", "Zombie"]]);
          let read = creatureTypes(actor);
          assert.deepEqual([...read.types], ["undead"]);
          assert.isFalse(read.subtypes.has("human"));
          assert.isTrue(read.dropped.has("human"));
          await template(actor, "Zombie").update({ "system.creatureSubtypes": ["human"] }, NO_PROMPT);
          read = creatureTypes(actor);
          assert.isTrue(read.subtypes.has("human"), "a subtype on the template item is kept");
          assert.isFalse(read.dropped.has("human"));
        });

        it("a disabled template doesn't change the type", async () => {
          const actor = await build("Quench Disabled Zombie", [["pf1.races", "Human"], ["pf1.monster-templates", "Zombie"]]);
          await template(actor, "Zombie").update({ "system.disabled": true }, NO_PROMPT);
          assert.deepEqual([...creatureTypes(actor).types], ["humanoid"]);
        });

        it("PF1's misspelled 'Reptillian' subtype matches reptilian", async () => {
          const actor = await build("Quench Kobold", [["pf1.races", "Kobold"]]);
          assert.isTrue(creatureTypes(actor).subtypes.has("reptilian"));
        });

        it("two type-changing templates leave the type unknown until one is chosen", async () => {
          const actor = await build("Quench Half-Fiend Zombie", [["pf1.races", "Human"], ["pf1.monster-templates", "Half-Fiend"], ["pf1.monster-templates", "Zombie"]]);
          let read = creatureTypes(actor);
          assert.isTrue(read.unresolved);
          assert.equal(read.types.size, 0);
          await actor.setFlag(MODULE_ID, "typeTemplate", template(actor, "Zombie").id);
          read = creatureTypes(actor);
          assert.isFalse(read.unresolved);
          assert.deepEqual([...read.types], ["undead"]);
          assert.equal(read.typeFrom, template(actor, "Zombie"));
        });
      });
    },
    { displayName: "PF1e Revamp: Creature types and templates" }
  );
}
