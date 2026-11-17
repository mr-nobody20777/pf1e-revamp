// Magic arms and materials: the quality catalog and its prices, the price from parts (masterwork,
// materials, bonus, cold iron's enchanting fee), the rules checks, the generated name, what materials do
// (hardness, hit points, weight, armor statistics, mithral's lighter category, masterwork, adamantine
// armor's DR, alchemical silver's −1), fortification chosen on the panel, and the Details tab panel.

import { createTestActor, cleanup, addItems, useTestScene, placeToken, deleteTokens, setTargets, useAndCollect, waitFor } from "./helpers.mjs";
import * as MA from "../magic-arms.mjs";
import { fortificationOf } from "../fortification.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerMagicArmsTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.magic-arms",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Magic arms and materials", function () {
        this.timeout(60000);
        let actor, messagesBefore;
        const weapon = async (base, extra = {}) => (await addItems(actor, [["pf1.weapons-and-ammo", base, foundry.utils.mergeObject({ system: { equipped: true } }, extra)]]))[0];
        const armor = async (base, extra = {}) => (await addItems(actor, [["pf1.armors-and-shields", base, extra]]))[0];
        const choose = (item, flag) => item.setFlag(MODULE_ID, MA.FLAG, flag);
        const total = async (item) => (await MA.priceOf(item, item._source.system.price)).total;

        before(async function () {
          if (!game.packs.get("pf-content.pf-special-qualities")) this.skip();
          messagesBefore = new Set(game.messages.keys());
          actor = await createTestActor("Quench Magic Arms", { abilities: { str: 14 }, items: [["pf1.classes", "Fighter", { system: { level: 5 } }]] });
        });
        afterEach(async () => {
          const ids = actor?.items.filter((i) => ["weapon", "equipment"].includes(i.type)).map((i) => i.id) ?? [];
          if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
        });
        after(async () => {
          await cleanup([actor], messagesBefore);
        });

        it("prices from the quality catalog, picking a variant's own line", async () => {
          const cat = await MA.loadCatalog();
          assert.isAbove(cat.size, 300);
          assert.deepEqual(cat.get("flaming").price, { bonus: 1 });
          assert.deepEqual(cat.get("shadow").price, { gp: 3750 });
          const levels = "light (+1 bonus), moderate (+3 bonus), heavy (+5 bonus)";
          assert.deepEqual(MA.parsePrice("Fortification (moderate)", levels), { bonus: 3 });
          assert.deepEqual(MA.parsePrice("Spell Resistance (15)", "13 (+2 bonus), 15 (+3 bonus), 17 (+4 bonus), 19 (+5 bonus)"), { bonus: 3 });
          const aqua = "(+3,750 gp), Improved (+15,000 gp), Greater (+33,750 gp)";
          assert.deepEqual(MA.parsePrice("Aquadynamic", aqua), { gp: 3750 });
          assert.deepEqual(MA.parsePrice("Improved Aquadynamic", aqua), { gp: 15000 });
          assert.deepEqual(MA.parsePrice("Buoyant (medium/heavy armor)", "light armor (+1,000 gp), shield (+1,000 gp), medium/heavy armor (+2,000 gp)"), { gp: 2000 });
        });

        it("price: +1 flaming cold iron longsword is 10,330 gp (cold iron ×2, masterwork, +2 bonus, +2,000 enchanting)", async () => {
          const sword = await weapon("Longsword", { system: { enh: 1, material: { normal: { value: "coldIron" } } } });
          await choose(sword, { qualities: ["Flaming"] });
          const p = await MA.priceOf(sword, 15);
          assert.equal(p.total, 10330, p.lines.map((l) => `${l.label} ${l.gp}`).join("; "));
        });

        it("price: adamantine longsword 3,015 gp (masterwork included); alchemical silver longsword 105 gp; darkwood longbow 405 gp", async () => {
          assert.equal(await total(await weapon("Longsword", { system: { material: { normal: { value: "adamantine" } } } })), 3015);
          assert.equal(await total(await weapon("Longsword", { system: { material: { addon: ["alchemicalSilver"] } } })), 105);
          assert.equal(await total(await weapon("Longbow", { system: { material: { normal: { value: "darkwood" } } } })), 405);
        });

        it("price: +1 mithral full plate 11,500 gp; dragonhide full plate 3,300 gp; +3 shadow chain shirt 13,000 gp", async () => {
          assert.equal(await total(await armor("Full Plate", { system: { armor: { enh: 1, material: { normal: { value: "mithral" } } } } })), 11500);
          assert.equal(await total(await armor("Full Plate", { system: { armor: { material: { normal: { value: "dragonhide" } } } } })), 3300);
          const shirt = await armor("Chain Shirt", { system: { armor: { enh: 3 } } });
          await choose(shirt, { qualities: ["Shadow"] });
          assert.equal(await total(shirt), 100 + 150 + 9000 + 3750);
        });

        it("the Update price window sets the item's price and remembers the plain item's", async () => {
          const sword = await weapon("Longsword", { system: { enh: 1 } });
          const done = MA.updatePrice(sword);
          const dialog = await waitFor(() => [...document.querySelectorAll(".application.dialog")].find((d) => /: price/.test(d.querySelector(".window-title")?.textContent ?? "")));
          assert.equal(Number(dialog.querySelector("input[name=base]").value), 15, "the compendium item's price");
          dialog.querySelector("button[data-action=apply]").click();
          assert.equal(await done, 2315);
          assert.equal(sword.system.price, 2315);
          assert.equal(sword.getFlag(MODULE_ID, MA.FLAG).basePrice, 15);
        });

        it("checks: an ability needs +1 enhancement; no more than +10; keen only on piercing or slashing melee", async () => {
          const plain = await weapon("Longsword");
          await choose(plain, { qualities: ["Flaming"] });
          assert.match((await MA.problemsOf(plain)).join(" "), /at least a \+1 enhancement/);
          const big = await weapon("Longsword", { system: { enh: 5 } });
          await choose(big, { qualities: ["Vorpal", "Speed"] });
          assert.match((await MA.problemsOf(big)).join(" "), /\+13: no more than \+10/);
          const club = await weapon("Club", { system: { enh: 1 } });
          await choose(club, { qualities: ["Keen"] });
          assert.match((await MA.problemsOf(club)).join(" "), /Keen works only on piercing or slashing melee weapons/);
          await choose(club, { qualities: ["Keen"], specific: true });
          assert.deepEqual(await MA.problemsOf(club), [], "a specific magic item isn't checked");
        });

        it("names an item that keeps its stock name, and leaves custom and specific names alone", async () => {
          const sword = await weapon("Longsword", { system: { enh: 1, material: { normal: { value: "coldIron" } } } });
          await choose(sword, { qualities: ["Flaming", "Keen"] });
          assert.equal(sword.name, "+1 Flaming Keen Cold Iron Longsword");
          await choose(sword, { qualities: ["Flaming"], specific: true });
          assert.equal(sword.name, "Longsword");
          const named = await weapon("Longsword", { name: "Oathkeeper", system: { enh: 1 } });
          assert.equal(named.name, "Oathkeeper");
          const plate = await armor("Full Plate", { system: { armor: { enh: 2 } } });
          await choose(plate, { qualities: ["Fortification (moderate)"] });
          assert.equal(plate.name, "+2 Moderate Fortification Full Plate");
          const mw = await weapon("Longsword", { system: { masterwork: true } });
          assert.equal(mw.name, "Masterwork Longsword");
        });

        it("saving the sheet doesn't store the generated name (it keeps following the item's parts)", async () => {
          const sword = await weapon("Longsword", { system: { enh: 1 } });
          await sword.sheet.render(true);
          try {
            await waitFor(() => (sword.sheet.element?.[0] ?? sword.sheet.element)?.querySelector?.("input[name='name']"));
            await sword.sheet.submit();
            assert.equal(sword._source.name, "Longsword");
            await sword.update({ "system.enh": 2 });
            assert.equal(sword.name, "+2 Longsword");
            await sword.update({ name: "Oathkeeper" });
            assert.equal(sword.name, "Oathkeeper", "a real rename still works");
          } finally {
            await sword.sheet.close();
          }
        });

        it("materials: adamantine sets hardness 20 and a third more hit points; +1 adds +2 and +10", async () => {
          const sword = await weapon("Longsword", { system: { material: { normal: { value: "adamantine" } } } });
          assert.equal(sword.system.hardness.total, 20);
          assert.equal(sword.system.hp.max, Math.floor(5 * 40 / 30));
          assert.isTrue(sword.system.masterwork, "adamantine is masterwork");
          await sword.update({ "system.enh": 1 });
          assert.equal(sword.system.hardness.total, 22);
          assert.equal(sword.system.hp.max, Math.floor(5 * 40 / 30) + 10);
          const silver = await weapon("Longsword", { system: { material: { addon: ["alchemicalSilver"] } } });
          assert.equal(silver.system.hardness.total, 10, "silvering keeps the steel's hardness");
        });

        it("mithral full plate: hardness 15, half weight, ACP −3 (and −1 masterwork), max Dex +2, spell failure −10%", async () => {
          const plate = await armor("Full Plate", { system: { equipped: true, armor: { material: { normal: { value: "mithral" } } } } });
          assert.equal(plate.system.hardness.total, 15);
          assert.equal(plate.system.weight.total, 25);
          assert.equal(plate.system.armor.acp, 3);
          assert.isTrue(plate.system.masterwork);
          assert.equal(plate.system.armor.dex, 3);
          assert.equal(plate.system.spellFailure, 25);
          const withMithral = actor.system.attributes.acp.total;
          await plate.update({ "system.armor.material.normal.value": "" });
          assert.equal(actor.system.attributes.acp.total - withMithral, 4, "3 for mithral and 1 for masterwork (the fighter's armor training applies to both)");
        });

        it("mithral armor is one category lighter for speed (a mithral breastplate doesn't slow), not for proficiency", async () => {
          // A creature without armor training, which would let a fighter move at full speed in medium armor
          const walker = await createTestActor("Quench Magic Arms Walker");
          try {
            const [plate] = await addItems(walker, [["pf1.armors-and-shields", "Breastplate", { system: { equipped: true } }]]);
            const slowed = walker.system.attributes.speed.land.total;
            await plate.update({ "system.armor.material.normal.value": "mithral" });
            assert.isAbove(walker.system.attributes.speed.land.total, slowed);
            assert.equal(plate.system.equipmentSubtype, "mediumArmor", "the armor itself stays medium");
          } finally {
            await walker.delete();
          }
        });

        it("darkwood heavy shield: armor check penalty 2 less; adamantine full plate gives DR 3/—", async () => {
          const shield = await armor("Heavy Wooden Shield", { system: { armor: { material: { normal: { value: "darkwood" } } } } });
          assert.equal(shield.system.armor.acp, Math.max(0, shield._source.system.armor.acp - 2));
          await armor("Full Plate", { system: { equipped: true, armor: { material: { normal: { value: "adamantine" } } } } });
          assert.isOk(actor.system.traits.dr.value.find((e) => e.amount === 3 && !e.types.filter(Boolean).length));
        });

        it("fortification chosen on a custom-named armor's panel counts (moderate: 50%)", async () => {
          const plate = await armor("Full Plate", { name: "Brann's Plate", system: { equipped: true, armor: { enh: 3 } } });
          await choose(plate, { qualities: ["Fortification (moderate)"] });
          assert.equal(fortificationOf(actor)?.chance, 50);
        });

        it("alchemical silver: −1 on damage with a slashing weapon (imposed), none with a bludgeoning one", async () => {
          const sword = await weapon("Longsword", { system: { material: { addon: ["alchemicalSilver"] } } });
          const formula = async (item) => (await item.defaultAction.rollDamage({ data: item.defaultAction.getRollData() })).map((r) => r.formula).join(" + ");
          assert.match(await formula(sword), /-\s*1\[Alchemical silver\]/);
          const mace = await weapon("Heavy Mace", { system: { material: { addon: ["alchemicalSilver"] } } });
          assert.notMatch(await formula(mace), /Alchemical silver/);
        });

        it("the Details tab panel: add from the catalog (starting from the name's), remove, mark as specific", async () => {
          const sword = await weapon("Longsword", { name: "+1 Keen Longsword", system: { enh: 1 } });
          await sword.sheet.render(true);
          try {
            const panel = async () => waitFor(() => (sword.sheet.element?.[0] ?? sword.sheet.element)?.querySelector?.(`.${MODULE_ID}-magic [data-wq-add]`)?.closest(`.${MODULE_ID}-magic`));
            let p = await panel();
            assert.match(p.textContent, /Keen/);
            // Choosing from the list fires a change, which PF1's sheet would save and redraw on, losing the choice
            const select = p.querySelector("[data-wq-add]");
            select.value = "Flaming";
            select.dispatchEvent(new Event("change", { bubbles: true }));
            await new Promise((r) => setTimeout(r, 800));
            assert.isTrue(select.isConnected, "the sheet wasn't redrawn");
            assert.equal(select.value, "Flaming");
            p.querySelector("[data-wq-add-button]").click();
            await waitFor(() => sword.getFlag(MODULE_ID, MA.FLAG)?.qualities?.length === 2);
            assert.deepEqual(sword.getFlag(MODULE_ID, MA.FLAG).qualities, ["Keen", "Flaming"]);
            p = await waitFor(async () => { const x = await panel(); return x?.querySelector("[data-wq-remove='0']") && /Flaming/.test(x.textContent) ? x : null; });
            p.querySelector("[data-wq-remove='0']").click();
            await waitFor(() => sword.getFlag(MODULE_ID, MA.FLAG)?.qualities?.length === 1);
            assert.deepEqual(sword.getFlag(MODULE_ID, MA.FLAG).qualities, ["Flaming"]);
            p = await panel();
            p.querySelector("[data-wq-specific]").click();
            await waitFor(() => sword.getFlag(MODULE_ID, MA.FLAG)?.specific);
          } finally {
            await sword.sheet.close();
          }
        });
      });
    },
    { displayName: "PF1e Revamp: Magic arms and materials" },
  );
}
