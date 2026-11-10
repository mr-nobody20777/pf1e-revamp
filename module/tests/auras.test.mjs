// Auras: who gets the linked buff (radius, allies or enemies, the bearer), moving in and out, the bearer
// unconscious or hidden, one buff for two sources, Despair and Cowardice not stacking, activated auras
// (rounds spent and given back, Foretell's choice), mind-affecting immunity, and opting a creature out.

import { createTestActor, cleanup, useTestScene, placeToken, deleteTokens, addItems, waitFor } from "./helpers.mjs";
import { activateAura, aurasSettled, auraKey, inPlay } from "../auras.mjs";
import { parseNote } from "../save-bonuses.mjs";

const MODULE_ID = "pf1e-revamp";
const HOSTILE = () => CONST.TOKEN_DISPOSITIONS.HOSTILE;

export function registerAuraTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.auras",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Auras", function () {
        this.timeout(60000);
        let paladin, cleric, wizard, ally, foe, golem, tokens, sceneCtl, messagesBefore;
        const auraBuffs = (actor) => actor.itemTypes.buff.filter((b) => b.getFlag(MODULE_ID, "auraLink")?.role === "effect");
        const named = (actor, re) => auraBuffs(actor).filter((b) => re.test(b.name));
        const move = async (token, col, row) => {
          const size = canvas.scene.grid.size;
          await token.update({ x: canvas.dimensions.sceneX + col * size, y: canvas.dimensions.sceneY + row * size }, { animate: false });
          await aurasSettled();
        };

        before(async function () {
          if (!game.users.activeGM?.isSelf) this.skip();
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          paladin = await createTestActor("Quench Paladin", { items: [["pf1.class-abilities", "Aura of Courage"]] });
          cleric = await createTestActor("Quench Aura Cleric", { abilities: { wis: 16 }, items: [["pf1.classes", "Cleric", { system: { level: 14 } }]] });
          wizard = await createTestActor("Quench Diviner", { abilities: { int: 18 }, items: [["pf1.classes", "Wizard", { system: { level: 8 } }]] });
          ally = await createTestActor("Quench Aura Ally");
          foe = await createTestActor("Quench Aura Foe");
          golem = await createTestActor("Quench Mindless Foe", { abilities: { int: 0 } });
          await addItems(cleric, [["pf1.class-abilities", "Aura of Protection (Domain Power)", { system: { class: "cleric" } }]]);
          await addItems(wizard, [["pf1.class-abilities", "Foretell", { system: { class: "wizard" } }], ["pf1.class-abilities", "Aura of Despair", { system: { class: "wizard" } }]]);
          tokens = {
            paladin: await placeToken(paladin, 2, 2),
            ally: await placeToken(ally, 3, 2),
            foe: await placeToken(foe, 2, 3, { disposition: HOSTILE() }),
          };
          await aurasSettled();
        });

        after(async () => {
          await deleteTokens(Object.values(tokens ?? {}));
          await aurasSettled();
          await cleanup([paladin, cleric, wizard, ally, foe, golem], messagesBefore);
          await sceneCtl?.restore();
        });

        it("Aura of Courage: allies within 10 ft (the paladin too) get +4 morale vs fear; enemies don't", async () => {
          assert.lengthOf(named(ally, /^Aura of Courage \(Quench Paladin\)$/), 1);
          assert.lengthOf(auraBuffs(paladin), 1, "you count as your own ally");
          assert.lengthOf(auraBuffs(foe), 0);
          const note = parseNote(named(ally, /Courage/)[0].system.contextNotes[0].text);
          assert.equal(note.type, "morale");
          assert.equal(note.formula, "(4)");
        });

        it("moving out of 10 ft removes it, moving back in gives it again", async () => {
          await move(tokens.ally, 5, 2); // 15 ft
          assert.lengthOf(auraBuffs(ally), 0);
          await move(tokens.ally, 4, 2); // 10 ft
          assert.lengthOf(auraBuffs(ally), 1);
        });

        it("an unconscious paladin gives no aura", async () => {
          await paladin.update({ "system.attributes.hp.value": -1 });
          await aurasSettled();
          assert.lengthOf(auraBuffs(ally), 0);
          await paladin.update({ "system.attributes.hp.value": paladin.system.attributes.hp.max });
          await aurasSettled();
          assert.lengthOf(auraBuffs(ally), 1);
        });

        it("a hidden paladin gives no aura; a deactivated buff stays off, a deleted one comes back", async () => {
          await tokens.paladin.update({ hidden: true });
          await aurasSettled();
          assert.lengthOf(auraBuffs(ally), 0);
          await tokens.paladin.update({ hidden: false });
          await aurasSettled();
          const [buff] = auraBuffs(ally);
          await buff.update({ "system.active": false });
          await move(tokens.ally, 3, 2);
          assert.isFalse(auraBuffs(ally)[0].isActive);
          await auraBuffs(ally)[0].delete();
          await aurasSettled();
          assert.isTrue(auraBuffs(ally)[0]?.isActive);
        });

        it("two paladins' Aura of Courage give one buff", async () => {
          const other = await createTestActor("Quench Paladin 2", { items: [["pf1.class-abilities", "Aura of Courage"]] });
          tokens.other = await placeToken(other, 3, 3);
          await aurasSettled();
          assert.lengthOf(named(ally, /Courage/), 1);
          await deleteTokens([tokens.other]);
          delete tokens.other;
          await aurasSettled();
          await other.delete();
        });

        it("Aura of Cowardice beside Aura of Despair: −4 vs fear in all, not −6", async () => {
          await addItems(paladin, [["pf1.class-abilities", "Aura of Cowardice"]]);
          await aurasSettled();
          assert.equal(named(foe, /Cowardice/)[0].system.contextNotes[0].text, "-[[4]] vs fear effects");
          await addItems(paladin, [["pf1.class-abilities", "Aura of Despair (APA)"]]);
          await aurasSettled();
          assert.equal(auraKey(paladin.items.getName("Aura of Despair (APA)")), "despairAntipaladin");
          assert.equal(named(foe, /Cowardice/)[0].system.contextNotes[0].text, "-[[2]] vs fear effects");
          assert.equal(named(foe, /Despair/)[0].system.changes[0].formula, "-2");
          await paladin.deleteEmbeddedDocuments("Item", paladin.items.filter((i) => /Cowardice|Despair/.test(i.name)).map((i) => i.id));
          await aurasSettled();
          assert.lengthOf(auraBuffs(foe), 0);
        });

        it("Aura of Protection (cleric 14): rounds spent, +2 deflection and resist 10; ending early gives the rest back", async () => {
          tokens.cleric = await placeToken(cleric, 6, 6);
          await move(tokens.ally, 8, 6); // 10 ft from the cleric, out of the paladin's aura
          const item = cleric.items.getName("Aura of Protection (Domain Power)");
          await item.update({ "system.uses.value": 14 });
          await activateAura(item, { answer: { rounds: 3 } });
          await aurasSettled();
          assert.equal(item.system.uses.value, 11);
          const [buff] = named(ally, /Protection/);
          assert.deepEqual(buff.system.changes.map((c) => [c.target, c.type, c.formula]), [["ac", "deflection", "2"]]);
          await waitFor(() => ally.system.traits.eres.value.some((e) => e.types.includes("fire") && e.amount === 10));
          assert.lengthOf(named(cleric, /Protection/), 1, "you and your allies");
          const indicator = cleric.itemTypes.buff.find((b) => b.getFlag(MODULE_ID, "auraLink")?.role === "aura");
          await indicator.update({ "system.active": false });
          await waitFor(() => item.system.uses.value === 13); // the round in progress counts as used
          await aurasSettled();
          assert.lengthOf(named(ally, /Protection/), 0);
          await waitFor(() => !cleric.items.has(indicator.id)); // ended for good: turning it back on can't restart it unpaid
        });

        it("Foretell: its uses are rounds per day equal to wizard level; hinder affects enemies only", async () => {
          const item = wizard.items.getName("Foretell");
          assert.equal(item.system.uses.maxFormula, "@class.level");
          tokens.wizard = await placeToken(wizard, 10, 10);
          await move(tokens.foe, 11, 10);
          await move(tokens.ally, 10, 11);
          await item.update({ "system.uses.value": 8 });
          await activateAura(item, { answer: { choice: "hinder", rounds: 2 } });
          await aurasSettled();
          assert.lengthOf(named(foe, /^Foretell \(hinder\)/), 1);
          assert.lengthOf(named(ally, /Foretell/), 0);
          assert.lengthOf(named(wizard, /Foretell/), 0);
          await wizard.itemTypes.buff.find((b) => b.getFlag(MODULE_ID, "auraLink")?.role === "aura").delete();
          await aurasSettled();
          assert.lengthOf(named(foe, /Foretell/), 0);
        });

        it("enchanter's Aura of Despair is mind-affecting: a mindless enemy isn't affected", async () => {
          tokens.golem = await placeToken(golem, 11, 11, { disposition: HOSTILE() });
          const item = wizard.items.getName("Aura of Despair");
          assert.equal(auraKey(item), "despairEnchanter");
          await item.update({ "system.uses.value": 8 });
          await activateAura(item, { answer: { rounds: 1 } });
          await aurasSettled();
          assert.lengthOf(named(foe, /Despair/), 1);
          assert.lengthOf(named(golem, /Despair/), 0);
        });

        it("auras work only on a scene in play (the active one, or one a connected user views)", async () => {
          const other = await Scene.create({ name: "Quench Aura Elsewhere", navigation: false });
          try {
            assert.isTrue(inPlay(canvas.scene));
            assert.isFalse(inPlay(other));
          } finally {
            await other.delete();
          }
        });

        it("a creature whose token leaves the scene loses its aura buffs", async () => {
          await deleteTokens([tokens.foe]);
          delete tokens.foe;
          await aurasSettled();
          assert.lengthOf(auraBuffs(foe), 0);
        });
      });
    },
    { displayName: "PF1e Revamp: Auras" }
  );
}
