// Situational bonuses (phase 2A): notes whose bonus depends on a situation, checked in the roll window.

import { createTestActor, cleanup, addItems } from "./helpers.mjs";
import * as SB from "../situational-bonuses.mjs";
import { creatureBonuses } from "../creature-bonuses.mjs";
import { notesOf, rollSaveAgainst } from "../util.mjs";

export function registerSituationalBonusTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.situational-bonuses",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Situational bonuses", function () {
        this.timeout(30000);
        let actor, sword, messagesBefore;
        const feat = async (name, text, target = "attack") => (await actor.createEmbeddedDocuments("Item", [{ name, type: "feat", system: { subType: "misc", contextNotes: [{ text, target }] } }]))[0];
        const attack = (flags = {}) => SB._test.collect(actor, { kind: "attack", action: sword.defaultAction, flags });
        const entry = (list, name) => list.find((e) => e.label === name);

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          actor = await createTestActor("Quench Situations", { items: [["pf1.classes", "Fighter", { system: { level: 5 } }]] });
          [sword] = await addItems(actor, [["pf1.weapons-and-ammo", "Longsword", { system: { equipped: true } }]]);
        });
        afterEach(async () => {
          const ids = actor.itemTypes.feat.filter((f) => /^Quench/.test(f.name)).map((f) => f.id);
          if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
          await actor.update({ "system.attributes.hp.value": actor.system.attributes.hp.max });
        });
        after(async () => {
          await cleanup([actor], messagesBefore);
        });

        it("reads the situation from a note; a plain bonus or a creature note isn't situational", () => {
          assert.deepEqual(SB._test.parseLine("+[[1]] on attack rolls when flanking.").situations.map((s) => s.situation.id), ["flanking"]);
          assert.isNull(SB._test.parseLine("+[[2]] Competence"));
          assert.isNull(SB._test.parseLine("+[[1]] Racial vs Humanoids (Orc, Goblinoid)"));
          const jump = SB._test.parseLine("+[[4]] to jump after a running start");
          assert.isOk(jump);
          assert.lengthOf(jump.situations, 0, "a situation the module can't check");
          assert.deepEqual(SB._test.parseLine("+[[2]] bonus if at or below half hp and with no conscious ally within 30 ft").situations.map((s) => s.situation.id).sort(), ["halfHp", "noAllyNear"]);
        });

        it("flanking: applies when the attack window's Flanking is ticked, listed otherwise", async () => {
          await feat("Quench Flanker", "+[[2]] on attack rolls when flanking.");
          const off = entry(attack({ flanking: false }), "Quench Flanker");
          assert.isFalse(off.applies);
          assert.match(off.reason, /when flanking/);
          const on = entry(attack({ flanking: true }), "Quench Flanker");
          assert.isTrue(on.applies);
          assert.equal(on.atk, 2);
        });

        it("at negative hit points: attack and damage", async () => {
          await feat("Quench Feral", "+[[2]] bonus on attacks and damage when at negative hit points.", "meleeWeapon");
          assert.isFalse(entry(attack(), "Quench Feral").applies);
          await actor.update({ "system.attributes.hp.value": -1 });
          const e = entry(attack(), "Quench Feral");
          assert.isTrue(e.applies);
          assert.equal(e.atk, 2);
          assert.equal(e.dmg, 2);
        });

        it("a situation the module can't check stays listed to tick", async () => {
          await feat("Quench Opportunist", "+[[2]] bonus on attacks of opportunity.");
          const e = entry(attack(), "Quench Opportunist");
          assert.isFalse(e.applies);
          assert.match(e.reason, /tick it/);
        });

        it("description bonuses (reviewed table): Night Stalker against a flat-footed target", async () => {
          await actor.createEmbeddedDocuments("Item", [{ name: "Night Stalker", type: "feat", system: { subType: "feat" } }]);
          assert.lengthOf(notesOf(actor.items.getName("Night Stalker")), 1, "the table's note");
          const e = entry(attack(), "Night Stalker");
          assert.isFalse(e.applies, "no target");
          await actor.items.getName("Night Stalker").delete();
        });

        it("description bonuses against creatures go to the creature reader (Ancient Tradition vs magical beasts)", async () => {
          await actor.createEmbeddedDocuments("Item", [{ name: "Ancient Tradition", type: "feat", system: { subType: "feat" } }]);
          const b = creatureBonuses(actor, ["attack"]).find((x) => x.item.name === "Ancient Tradition");
          assert.isOk(b);
          assert.equal(b.part, "dmg");
          assert.deepEqual(b.spec.types, ["magicalbeast"]);
          assert.isUndefined(entry(attack(), "Ancient Tradition"), "not listed twice");
          await actor.items.getName("Ancient Tradition").delete();
        });

        it("a recognized situation with something else in the note stays to tick (sunder, but only against larger targets)", () => {
          const p = SB._test.parseLine("+[[4]] on sunder checks against targets larger than you");
          assert.deepEqual(p.situations.map((s) => s.situation.id), ["maneuver"]);
          assert.isTrue(p.unchecked);
          assert.isFalse(SB._test.parseLine("+[[2]] on combat maneuver checks to grapple").unchecked);
          assert.isFalse(SB._test.parseLine("+[[1]] on attack rolls when flanking.").unchecked);
        });

        it("description save bonuses go to the save reader: Pure Faith's +4 sacred on a save against poison", async () => {
          await actor.createEmbeddedDocuments("Item", [{ name: "Pure Faith", type: "feat", system: { subType: "trait" } }]);
          const message = await rollSaveAgainst(actor, "fort", ["poison"], { dc: 10 });
          assert.match(message?.rolls?.[0]?.formula ?? "", /4\[Pure Faith\]/);
          await actor.items.getName("Pure Faith").delete();
        });

        it("features the module automates on their own are skipped (no double count)", async () => {
          await feat("Studied Target", "+[[1]] to attack and damage against studied target", "meleeWeapon");
          assert.isUndefined(entry(attack(), "Studied Target"));
        });
      });
    },
    { displayName: "PF1e Revamp: Situational bonuses" },
  );
}
