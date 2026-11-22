// Polymorph: Monstrous Physique and Undead Anatomy's size tables, the size-changing spells blocked while
// polymorphed, PF1 Mighty Morphin's picker opened for a creature, and its form reverted when the spell's buff ends.

import { createTestActor, cleanup, useTestScene, placeToken, deleteTokens, waitFor } from "./helpers.mjs";
import { _test as poly, openPicker, morphinActive } from "../polymorph.mjs";

export function registerPolymorphTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.polymorph",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Polymorph", function () {
        this.timeout(60000);
        let shifter, token, ctl, messagesBefore;

        before(async function () {
          if (!game.users.activeGM?.isSelf) this.skip();
          messagesBefore = new Set(game.messages.keys());
          ctl = await useTestScene();
          shifter = await createTestActor("Quench Polymorph Shifter", { items: [["pf1.races", "Human"], ["pf1.classes", "Wizard", { system: { level: 9 } }]] });
          token = await placeToken(shifter, 2, 2);
        });
        afterEach(async () => {
          if (morphinActive() && shifter.flags["pf1-mighty-morphin"]?.["beast-shape"]) await game.mightyMorphin.revert({ actor: shifter, buff: "Beast Shape" });
          const buffs = shifter.itemTypes.buff.map((b) => b.id);
          if (buffs.length) await shifter.deleteEmbeddedDocuments("Item", buffs);
        });
        after(async () => {
          await deleteTokens([token]);
          await cleanup([shifter], messagesBefore);
          await ctl?.restore();
        });

        it("Monstrous Physique II as a Large form: +4 size Str, -2 Dex, +4 natural armor, one size larger; size spells then do nothing", async () => {
          const str = shifter.system.abilities.str.total;
          const dex = shifter.system.abilities.dex.total;
          const buff = await poly.ownForm(shifter, "Monstrous Physique II", 9, { size: "lg" });
          assert.equal(buff.name, "Monstrous Physique II (Large)");
          assert.equal(shifter.system.abilities.str.total, str + 4);
          assert.equal(shifter.system.abilities.dex.total, dex - 2);
          assert.equal(shifter.system.traits.size.value, 5, "Large");
          await waitFor(() => canvas.scene.tokens.get(token.id).width === 2, { what: "the token grows" });
          assert.match(poly.sizeBlocked("Enlarge Person", shifter), /polymorphed/);
          assert.isNull(poly.sizeBlocked("Bull's Strength", shifter));
          await buff.delete();
          await waitFor(() => canvas.scene.tokens.get(token.id).width === 1, { what: "back to its size" });
        });

        it("Undead Anatomy IV keeps its own Tiny and Large bonuses and adds the save bonus", async () => {
          const con = shifter.system.abilities.con.total;
          await poly.ownForm(shifter, "Undead Anatomy IV", 15, { size: "lg" });
          assert.equal(shifter.system.abilities.con.total, con + 2);
          const buff = shifter.itemTypes.buff[0];
          assert.include(buff.system.contextNotes.map((n) => n.target), "allSavingThrows");
          assert.equal(poly.OWN["undead anatomy i"].sizes.med.find(([t]) => t === "nac")[1], 2);
        });

        it("Mighty Morphin: the picker opens for the creature; its form ends with the spell's buff", async function () {
          if (!morphinActive()) this.skip();
          await openPicker(shifter, "beastShape", 2, 9, { nameOverride: "Polymorph" });
          const app = await waitFor(() => [...Object.values(ui.windows)].find((w) => w.actorId === shifter.uuid), { what: "the picker" });
          await app.close();
          // A form applied as the picker would, then the buff deleted: the form reverts
          token.object.control({ releaseOthers: true });
          await game.mightyMorphin.beastShape({ level: 2, durationLevel: 9, form: "Wolf", nameOverride: "Polymorph" });
          token.object.release();
          const buff = await waitFor(() => shifter.itemTypes.buff.find((b) => b.name === "Polymorph (Wolf)"), { what: "the form's buff" });
          await waitFor(() => poly.polymorphOf(shifter) === "Polymorph", { what: "Mighty Morphin's record of the form" });
          await waitFor(() => buff.effects.size > 0, { what: "PF1's effect on the buff (deleting before it exists errors)" });
          await buff.delete();
          await waitFor(() => !shifter.itemTypes.attack.length && !Object.keys(shifter.flags["pf1-mighty-morphin"] ?? {}).some((k) => k === "beast-shape"), { what: "the form reverted" });
        });
      });
    },
    { displayName: "PF1e Revamp: Polymorph" },
  );
}
