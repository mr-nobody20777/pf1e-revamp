// Damage reduction, energy resistance and immunities from PF1 features and templates: scaling, choices,
// conditions (raging, armor), DR that applies only to nonlethal damage, only the best DR counting, and
// DR on quick-applied damage.

import { createTestActor, cleanup, addItems, waitFor, waitForItem } from "./helpers.mjs";
import { immunitiesOf } from "../defenses.mjs";

const MODULE_ID = "pf1e-revamp";
const SETTING = "quickApplyResistance";

export function registerDefenseTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.defenses",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Damage reduction, resistances and immunities from features", function () {
        this.timeout(60000);
        const actors = [];
        let messagesBefore, settingBefore;
        const make = async (...args) => {
          const a = await createTestActor(...args);
          actors.push(a);
          return a;
        };
        const drs = (a) => a.system.traits.dr.value.map((e) => `${e.amount}/${e.types.filter(Boolean).join(e.operator ? "|" : "&") || "-"}`);
        const eres = (a, type) => Math.max(0, ...a.system.traits.eres.value.filter((e) => e.types.includes(type)).map((e) => e.amount));
        const part = (types) => new pf1.models.action.DamagePartModel({ formula: "0", types });
        /** PF1's dialog math without showing it: what each target's reductions come to. */
        const dialog = (actor, hits) => {
          const instances = hits.map(([value, types]) => Object.assign(part(types), { value }));
          const app = new pf1.applications.ApplyDamage({ value: hits.reduce((t, [v]) => t + v, 0), instances, targets: [actor] });
          return app.targets.get(actor.uuid);
        };

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          settingBefore = game.settings.get(MODULE_ID, SETTING);
          await game.settings.set(MODULE_ID, SETTING, true);
        });
        after(async () => {
          await game.settings.set(MODULE_ID, SETTING, settingBefore);
          await cleanup(actors, messagesBefore);
        });

        it("Barbarian Damage Reduction: DR 1/— at 7th, 2/— at 10th, 3/— at 13th", async () => {
          const barb = await make("Quench Barbarian DR", { abilities: { con: 14 }, items: [["pf1.classes", "Barbarian", { system: { level: 10 } }]] });
          await waitForItem(barb, "Damage Reduction");
          await waitFor(() => drs(barb).includes("2/-"));
          await barb.itemTypes.class[0].update({ "system.level": 13 });
          await waitFor(() => drs(barb).includes("3/-"));
          assert.notInclude(drs(barb), "2/-", "DR from one feature isn't listed twice");
        });

        it("only the best DR counts: DR 5/— and DR 10/magic against a mundane sword stop 10, not 15", async () => {
          const a = await make("Quench Two DRs");
          await a.update({ "system.traits.dr": { value: [{ amount: 5, operator: true, types: ["", ""] }, { amount: 10, operator: true, types: ["magic", ""] }], custom: "" } });
          const target = dialog(a, [[20, ["slashing"]]]);
          assert.equal(target.reduction.physical, 10);
          assert.deepEqual(target.dr.map((e) => e.value - e.available), [0, 10], "only the best DR is shown as used");
        });

        it("quick-applied damage: DR 5/— takes 5 off a 12-point slashing hit", async () => {
          const a = await make("Quench Quick DR", { abilities: { con: 30 }, items: [["pf1.classes", "Fighter", { system: { level: 5 } }]] });
          await a.update({ "system.traits.dr": { value: [{ amount: 5, operator: true, types: ["", ""] }], custom: "" } });
          const start = a.system.attributes.hp.value;
          await a.applyDamage(12, { instances: [part(["slashing"])] });
          assert.equal(a.system.attributes.hp.value, start - 7);
          const note = await waitFor(() => game.messages.contents.findLast((m) => m.content.includes("Quench Quick DR</strong> resists")));
          assert.match(note.content, /DR 5\/.*\(−5\).*Took 7\./);
        });

        it("Death's Gift (3rd): cold resistance 5 and DR 5/— only against nonlethal damage", async () => {
          const sorc = await make("Quench Undead Sorcerer", { items: [["pf1.classes", "Sorcerer", { system: { level: 3 } }]] });
          await addItems(sorc, [["pf1.class-abilities", "Death's Gift", { system: { class: "sorcerer" } }]]);
          assert.equal(eres(sorc, "cold"), 5);
          assert.notInclude(drs(sorc), "5/-", "not a general DR");
          assert.equal(dialog(sorc, [[8, ["bludgeoning", "nonlethal"]]]).reduction.physical, 5);
          assert.equal(dialog(sorc, [[8, ["bludgeoning"]]]).reduction.physical, 0);
          const asNonlethal = new pf1.applications.ApplyDamage({ value: 8, instances: [Object.assign(part(["bludgeoning"]), { value: 8 })], targets: [sorc], asNonlethal: true });
          assert.equal(asNonlethal.targets.get(sorc.uuid).reduction.physical, 5, "damage applied as nonlethal");
        });

        it("Armor Mastery: DR 5/— only while wearing armor", async () => {
          const f = await make("Quench Armor Master");
          await addItems(f, [["pf1.class-abilities", "Armor Mastery"]]);
          assert.notInclude(drs(f), "5/-");
          await f.createEmbeddedDocuments("Item", [{ name: "Quench Plate", type: "equipment", system: { subType: "armor", equipped: true } }]);
          assert.include(drs(f), "5/-");
        });

        it("rage power Energy Resistance: the chosen energy, half barbarian level, only while raging", async () => {
          const b = await make("Quench Raging Barbarian", { items: [["pf1.classes", "Barbarian", { system: { level: 8 } }]] });
          const [power] = await b.createEmbeddedDocuments("Item", [game.items.fromCompendium(await fromUuid("Compendium.pf1.class-abilities.Item.4SnRYolTwZqq5Nbw"))], { pf1eRevampNoPrompt: true });
          await power.update({ "system.class": "barbarian" });
          await power.setFlag(MODULE_ID, "energyType", "fire");
          assert.equal(eres(b, "fire"), 0, "not raging");
          await b.itemTypes.buff.find((x) => x.name === "Rage").update({ "system.active": true }); // the Barbarian class adds PF1's Rage buff
          assert.equal(eres(b, "fire"), 4);
        });

        it("a skald's rage power Energy Resistance uses the skald level, though PF1 files it under barbarian", async () => {
          const k = await make("Quench Raging Skald", { items: [["pf1.classes", "Skald", { system: { level: 10 } }]] });
          const [power] = await k.createEmbeddedDocuments("Item", [game.items.fromCompendium(await fromUuid("Compendium.pf1.class-abilities.Item.4SnRYolTwZqq5Nbw"))], { pf1eRevampNoPrompt: true });
          await power.update({ "system.class": "barbarian" });
          await power.setFlag(MODULE_ID, "energyType", "cold");
          await k.createEmbeddedDocuments("Item", [{ name: "Inspired Rage (Skald)", type: "buff", system: { active: true } }]);
          assert.equal(eres(k, "cold"), 5);
        });

        it("Draconic bloodline: the energy type chosen once for the bloodline, 10 at 9th level", async () => {
          const s = await make("Quench Draconic", { items: [["pf1.classes", "Sorcerer", { system: { level: 9 } }]] });
          await s.createEmbeddedDocuments("Item", [game.items.fromCompendium(await fromUuid("Compendium.pf1.class-abilities.Item.zRjCUXkADqaG0hXj"))], { pf1eRevampNoPrompt: true });
          await s.items.getName("Dragon Resistances").update({ "system.class": "sorcerer" });
          assert.equal(eres(s, "cold"), 0, "no energy chosen yet");
          await s.setFlag(MODULE_ID, "energyType.draconic", "cold");
          assert.equal(eres(s, "cold"), 10);
        });

        it("paladin: Divine Health (disease), Aura of Courage (fear), Aura of Resolve (charm), Aura of Righteousness (DR 5/evil, compulsion)", async () => {
          const p = await make("Quench Paladin Defenses");
          await addItems(p, [
            ["pf1.class-abilities", "Divine Health"],
            ["pf1.class-abilities", "Aura of Courage"],
            ["pf1.class-abilities", "Aura of Resolve"],
            ["pf1.class-abilities", "Aura of Righteousness"],
          ]);
          assert.isTrue(p.system.traits.ci.total.has("disease"));
          assert.isTrue(p.system.traits.ci.total.has("fear"));
          assert.sameMembers([...immunitiesOf(p)], ["charm", "compulsion"]);
          assert.include(drs(p), "5/evil");
        });

        it("Fiendish template at 6 HD: cold and fire resistance 10, DR 5/good; Lich: DR 15/bludgeoning and magic", async () => {
          const m = await make("Quench Fiendish", { items: [["pf1.classes", "Fighter", { system: { level: 6 } }]] });
          await addItems(m, [["pf1.monster-templates", "Fiendish"]]);
          assert.equal(eres(m, "cold"), 10);
          assert.equal(eres(m, "fire"), 10);
          assert.include(drs(m), "5/good");
          await addItems(m, [["pf1.monster-templates", "Lich"]]);
          assert.include(drs(m), "15/bludgeoning&magic");
          assert.equal(dialog(m, [[20, ["bludgeoning"]]]).reduction.physical, 15, "a mundane club isn't magic: DR 15 is the best, not 15 + 5");
        });
      });
    },
    { displayName: "PF1e Revamp: Damage reduction, resistances and immunities" }
  );
}
