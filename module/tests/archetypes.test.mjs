// Archetypes: the party's three (Battle Scion, Blossoming Light, Chronomancer) applied to fresh
// characters. Archetype features get their mechanics, altered base features are renamed and
// changed, restatements merge into the base feature, and removing the archetype puts it all back.

import { createTestActor, fromPack, cleanup, waitFor, waitForItem } from "./helpers.mjs";
import { promptApply } from "../archetypes.mjs";
import { findPool } from "../raging-song.mjs";

const MODULE_ID = "pf1e-revamp";
const ARCH_PACK = "pf1e-archetypes.pf-archetypes";

async function applyArchetype(actor, name) {
  const data = await fromPack(ARCH_PACK, name);
  const [item] = await actor.createEmbeddedDocuments("Item", [data], { pf1eRevampNoPrompt: true });
  await promptApply(actor, item, { acceptDefaults: true });
  return item;
}

/** Delete an applied archetype and wait for the revert to finish (class links are restored last). */
async function removeArchetype(actor, archetype) {
  const record = archetype.getFlag(MODULE_ID, "archetype");
  const classItem = actor.items.get(record.classId);
  await archetype.delete();
  const links = (c) => JSON.stringify((c.system.links.classAssociations ?? []).map((l) => l.uuid));
  const expected = JSON.stringify(record.links.map((l) => l.uuid));
  await waitFor(() => links(classItem) === expected);
  await new Promise((r) => setTimeout(r, 200)); // let PF1 re-prepare the actor
}

const changeTargets = (item) => item.system.changes.map((c) => c.target).sort();

export function registerArchetypeTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.archetypes",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Archetypes", function () {
        this.timeout(60000);
        if (!game.modules.get("pf1e-archetypes")?.active) return;
        let messagesBefore;
        const actors = [];
        const character = async (name, cls, level, abilities = {}) => {
          const actor = await createTestActor(name, { abilities, items: [["pf1.classes", cls, { system: { level } }]] });
          actors.push(actor);
          return actor;
        };

        before(() => (messagesBefore = new Set(game.messages.keys())));
        after(async () => cleanup(actors, messagesBefore));

        describe("Skald (Battle Scion)", function () {
          let skald, archetype, bardicBefore, intimidateBefore;

          before(async () => {
            skald = await character("Quench Battle Scion", "Skald", 2);
            await waitForItem(skald, "Bardic Knowledge");
            bardicBefore = skald.items.getName("Bardic Knowledge").system.changes.length;
            intimidateBefore = skald.system.skills.int.mod;
            archetype = await applyArchetype(skald, "Skald (Battle Scion)");
          });

          it("Courtly Presence added, with +1/2 character level to Intimidate", async () => {
            const cp = await waitForItem(skald, "Courtly Presence (Battle Scion)");
            assert.deepEqual(changeTargets(cp), ["skill.int"]);
            assert.equal(skald.system.skills.int.mod, intimidateBefore + 1, "character level 2: +1");
          });

          it("Bardic Knowledge renamed and limited to geography, history, local, nobility", () => {
            const bk = skald.items.find((i) => i.system.tag === "bardicKnowledge");
            assert.equal(bk.name, "Bardic Knowledge (Battle Scion)");
            assert.deepEqual(changeTargets(bk), ["skill.kge", "skill.khi", "skill.klo", "skill.kno"]);
            assert.include(bk.system.description.value, "Courtly Presence (Battle Scion)");
          });

          it("Raging Song (Battle Scion) merged into Raging Song, which still runs songs", () => {
            const songs = skald.items.filter((i) => /^Raging Song/.test(i.name));
            assert.lengthOf(songs, 1, "no duplicate Raging Song");
            assert.equal(songs[0].name, "Raging Song (Battle Scion)");
            assert.equal(findPool(skald)?.id, songs[0].id);
          });

          it("removing the archetype restores the skald", async () => {
            await removeArchetype(skald, archetype);
            const bk = skald.items.getName("Bardic Knowledge");
            assert.lengthOf(bk.system.changes, bardicBefore);
            assert.isUndefined(skald.items.getName("Courtly Presence (Battle Scion)"));
            assert.ok(skald.items.getName("Raging Song"));
          });
        });

        describe("Cleric (Blossoming Light)", function () {
          let cleric, archetype;
          const book = () => Object.values(cleric.system.attributes.spells.spellbooks).find((b) => b.class === "cleric");

          before(async () => {
            cleric = await character("Quench Blossoming Light", "Cleric", 2, { cha: 14 });
            await waitForItem(cleric, "Channel Energy");
            archetype = await applyArchetype(cleric, "Cleric (Blossoming Light)");
          });

          it("Channel Energy: 5 + Cha + 1 per 2 levels uses per day", () => {
            const channel = cleric.items.find((i) => i.system.tag === "classFeat_channelEnergy");
            assert.equal(channel.name, "Channel Energy (Blossoming Light)");
            assert.equal(channel.system.uses.max, 5 + 2 + 1);
          });

          it("no domain spell slot, Domains renamed", () => {
            assert.equal(book().domainSlotValue, 0);
            assert.equal(cleric.items.find((i) => i.system.tag === "domains")?.name, "Domains (Blossoming Light)");
          });

          it("no armor or shield proficiency; Promise of Faith and Luminous Font on the sheet", () => {
            const cls = cleric.itemTypes.class[0];
            assert.isEmpty(cls._source.system.armorProf ?? []);
            assert.ok(cleric.items.getName("Promise of Faith (Blossoming Light)"));
            assert.ok(cleric.items.getName("Luminous Font (Blossoming Light)")?.system.contextNotes.some((n) => n.target === "skill.dip"));
          });

          it("removing the archetype restores channel uses, the domain slot and armor", async () => {
            await removeArchetype(cleric, archetype);
            assert.equal(cleric.items.getName("Channel Energy").system.uses.max, 3 + 2);
            assert.equal(book().domainSlotValue, 1);
            assert.isNotEmpty(cleric.itemTypes.class[0]._source.system.armorProf);
          });
        });

        describe("Wizard (Chronomancer)", function () {
          let wizard, archetype;

          before(async () => {
            wizard = await character("Quench Chronomancer", "Wizard", 1, { int: 16 });
            await waitForItem(wizard, "Arcane Bond");
            archetype = await applyArchetype(wizard, "Wizard (Chronomancer)");
          });

          it("Arcane Bond replaced by a Temporal Pool of 1/2 level + Int (min 1)", async () => {
            assert.isUndefined(wizard.items.getName("Arcane Bond"));
            const pool = await waitForItem(wizard, "Temporal Pool (Chronomancer)");
            assert.equal(pool.system.uses.max, 3);
          });

          it("removing the archetype restores Arcane Bond", async () => {
            await removeArchetype(wizard, archetype);
            assert.ok(wizard.items.getName("Arcane Bond"));
            assert.isUndefined(wizard.items.getName("Temporal Pool (Chronomancer)"));
          });
        });
      });
    },
    { displayName: "PF1e Revamp: Archetypes" }
  );
}
