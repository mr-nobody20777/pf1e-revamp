// Worn magic: the amulet of mighty fists (its bonus on unarmed strikes, against DR, its abilities on unarmed
// strikes and natural weapons, its +5 limit, name and price) and the armor abilities applied while worn
// (shadow, slick, energy resistance, spell resistance, invulnerability).

import { createTestActor, cleanup, addItems } from "./helpers.mjs";
import * as MA from "../magic-arms.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerWornMagicTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.worn-magic",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Amulet of mighty fists and armor abilities", function () {
        this.timeout(60000);
        let actor, target, messagesBefore;
        const choose = (item, flag) => item.setFlag(MODULE_ID, MA.FLAG, flag);
        const armor = async (base, extra = {}) => (await addItems(actor, [["pf1.armors-and-shields", base, foundry.utils.mergeObject({ system: { equipped: true } }, extra)]]))[0];
        const amulet = async (bonus = 3, extra = {}) => (await addItems(actor, [["pf1.items", `Amulet of Mighty Fists +${bonus}`, foundry.utils.mergeObject({ system: { equipped: true } }, extra)]]))[0];
        const unarmed = async () => (await addItems(actor, [["pf1.monster-abilities", "Unarmed Strike"]]))[0];
        const claw = async () => (await actor.createEmbeddedDocuments("Item", [{ name: "Claw", type: "attack", system: { subType: "natural", actions: [{ _id: "clawclawclawclaw", name: "Attack", actionType: "mwak", damage: { parts: [{ formula: "1d4", types: ["slashing"] }] } }] } }]))[0];
        const evaluate = (item) => {
          const instance = Object.assign(new pf1.models.action.DamagePartModel({ formula: "0", types: ["bludgeoning"] }), { value: 10 });
          return new pf1.applications.ApplyDamage({ value: 10, instances: [instance], action: item.defaultAction, targets: [target] });
        };
        const ours = (list) => list.filter((c) => MA.isAmulet(c.parent));

        before(async function () {
          if (!game.packs.get("pf-content.pf-special-qualities")) this.skip();
          messagesBefore = new Set(game.messages.keys());
          actor = await createTestActor("Quench Worn Magic", { abilities: { str: 14, dex: 14 }, items: [["pf1.classes", "Fighter", { system: { level: 5 } }]] });
          target = await createTestActor("Quench Worn Target", { system: { details: { alignment: "tn" } } });
          await MA.loadCatalog();
        });
        afterEach(async () => {
          const ids = actor?.items.filter((i) => ["weapon", "equipment", "attack"].includes(i.type)).map((i) => i.id) ?? [];
          if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
        });
        after(async () => {
          await cleanup([actor, target], messagesBefore);
        });

        it("reads armor abilities from the name", () => {
          const read = MA._test.armorFromName;
          assert.deepEqual(read("+1 Greater Shadow Leather Armor"), ["Shadow, Greater"]);
          assert.deepEqual(read("+2 Improved Fire Resistance Breastplate"), ["Energy Resistance, Improved"]);
          assert.deepEqual(read("+1 Slick Spell Resistance (15) Chainmail"), ["Slick", "Spell Resistance (15)"]);
          assert.deepEqual(read("+3 Invulnerability Full Plate"), ["Invulnerability"]);
          assert.deepEqual(read("+1 Shadow Blending Leather"), []);
          const fake = { type: "equipment", name: "+2 Improved Fire Resistance Breastplate", _source: { name: "+2 Improved Fire Resistance Breastplate" }, system: { subType: "armor" }, flags: {} };
          assert.equal(MA.qualitiesOf(fake).energy, "fire");
        });

        it("shadow armor: +5 competence on Stealth while worn, not when taken off", async () => {
          const before = actor.system.skills.ste.mod;
          const leather = await armor("Leather Armor", { system: { armor: { enh: 1 } } });
          await choose(leather, { qualities: ["Shadow"] });
          assert.equal(actor.system.skills.ste.mod, before + 5);
          await leather.update({ "system.equipped": false });
          assert.equal(actor.system.skills.ste.mod, before);
        });

        it("energy resistance armor resists its chosen energy, and asks for one until chosen", async () => {
          const plate = await armor("Breastplate", { system: { armor: { enh: 1 } } });
          await choose(plate, { qualities: ["Energy Resistance, Improved"] });
          assert.match((await MA.problemsOf(plate)).join(" "), /choose the energy type/);
          await choose(plate, { qualities: ["Energy Resistance, Improved"], energy: "fire" });
          const fire = actor.system.traits.eres.value.find((e) => e.types?.includes("fire"));
          assert.equal(fire?.amount, 20);
          assert.equal(plate.name, "+1 Improved Fire Resistance Breastplate");
        });

        it("spell resistance and invulnerability armor", async () => {
          const plate = await armor("Full Plate", { system: { armor: { enh: 3 } } });
          await choose(plate, { qualities: ["Spell Resistance (15)", "Invulnerability"] });
          assert.equal(actor.system.attributes.sr.total, 15);
          const dr = actor.system.traits.dr.value.find((e) => e.amount === 5 && e.types?.includes("magic"));
          assert.isOk(dr, JSON.stringify(actor.system.traits.dr.value));
        });

        it("amulet: its bonus reaches unarmed strikes (natural weapons get it from PF1, once) and bypasses DR as a +3 weapon", async () => {
          const fist = await unarmed();
          const nat = await claw();
          assert.lengthOf(ours(fist.defaultAction.attackSources), 0, "no amulet yet");
          await amulet(3);
          assert.lengthOf(ours(fist.defaultAction.attackSources), 1, "unarmed strike: +3 on attack");
          assert.lengthOf(ours(fist.defaultAction.damageSources ?? []), 1, "and on damage");
          assert.lengthOf(ours(nat.defaultAction.attackSources), 1, "a natural weapon: once");
          const app = evaluate(fist);
          assert.isTrue(app.isMagic);
          assert.isTrue(app.materials.has("coldIron") && app.materials.has("alchemicalSilver"));
          assert.isFalse(app.materials.has("adamantine"));
        });

        it("amulet abilities apply to unarmed strikes and natural weapons; +5 limit; no piercing/slashing abilities; name and price", async () => {
          const fist = await unarmed();
          const nat = await claw();
          const a = await amulet(3);
          await choose(a, { qualities: ["Flaming"] });
          assert.isTrue(MA.qualitiesOf(fist).ids.has("flaming"));
          assert.isTrue(MA.qualitiesOf(nat).ids.has("flaming"));
          assert.equal(a.name, "+3 Flaming Amulet of Mighty Fists");
          assert.equal((await MA.priceOf(a, 0)).total, 64000);
          assert.lengthOf(await MA.problemsOf(a), 0, "no +1 rule, +4 total is fine");
          await choose(a, { qualities: ["Flaming", "Holy", "Keen"] });
          const problems = (await MA.problemsOf(a)).join(" ");
          assert.match(problems, /\+7: an amulet of mighty fists allows no more than \+5/);
          assert.match(problems, /Keen can't be applied to unarmed attacks/);
          assert.isFalse(MA._test.amuletFits("Keen"));
          assert.isFalse(MA.qualitiesOf(nat).ids.has("keen"), "keen never reaches the claw");
        });

        it("a plain amulet keeps its name; one taken off gives nothing", async () => {
          const fist = await unarmed();
          const a = await amulet(2);
          assert.equal(a.name, "Amulet of Mighty Fists +2");
          await a.update({ "system.equipped": false });
          assert.lengthOf(ours(fist.defaultAction.attackSources), 0);
          assert.lengthOf(MA.temporaryOf(fist), 0);
        });
      });
    },
    { displayName: "PF1e Revamp: Amulet of mighty fists and armor abilities" },
  );
}
