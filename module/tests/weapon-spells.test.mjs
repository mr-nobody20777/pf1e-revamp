// Weapon spells: magic weapon, greater magic weapon, keen edge, align weapon and bless weapon bind to one
// weapon; their bonus and qualities count for that weapon only, against DR, and toward the +10 limit, and
// never change the weapon's own name or price.

import { createTestActor, cleanup, useTestScene, placeToken, deleteTokens, addItems, setTargets, useAndCollect, waitFor } from "./helpers.mjs";
import { _test, blessConfirms } from "../weapon-spells.mjs";
import * as MA from "../magic-arms.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerWeaponSpellTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.weapon-spells",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Weapon spells", function () {
        this.timeout(60000);
        let fighter, neutral, evil, tokens, sceneCtl, messagesBefore;
        const originalRandom = CONFIG.Dice.randomUniform;
        const weapon = async (base, name, extra = {}) => (await addItems(fighter, [["pf1.weapons-and-ammo", base, { name, system: { equipped: true }, ...extra }]]))[0];
        /** A weapon spell's buff on the fighter, bound to `on` (or left to bind itself). */
        const buff = async (name, { level = 5, changes = [], on = null, alignment = null } = {}) => {
          const flags = { [MODULE_ID]: { ...(on ? { [_test.FLAG]: on.id } : {}), ...(alignment ? { [_test.ALIGN_FLAG]: alignment } : {}) } };
          const [b] = await fighter.createEmbeddedDocuments("Item", [{ name, type: "buff", system: { subType: "spell", active: true, level, changes }, flags }]);
          await waitFor(() => b.getFlag(MODULE_ID, _test.FLAG), { what: `${name} bound to a weapon` });
          return b;
        };
        const enhChanges = [{ formula: "1", target: "attack", type: "enh" }, { formula: "1", target: "wdamage", type: "enh" }];
        const evaluate = (item, target) => {
          const instance = Object.assign(new pf1.models.action.DamagePartModel({ formula: "0", types: ["slashing"] }), { value: 10 });
          return new pf1.applications.ApplyDamage({ value: 10, instances: [instance], action: item.defaultAction, targets: [target] });
        };

        before(async function () {
          if (!game.users.activeGM?.isSelf) this.skip();
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          fighter = await createTestActor("Quench WS Fighter", { abilities: { str: 14 }, items: [["pf1.classes", "Fighter", { system: { level: 5 } }]] });
          neutral = await createTestActor("Quench WS Neutral", { system: { details: { alignment: "tn" } } });
          evil = await createTestActor("Quench WS Evil", { system: { details: { alignment: "ne" } } });
          tokens = { fighter: await placeToken(fighter, 2, 2), neutral: await placeToken(neutral, 3, 2, { disposition: -1 }), evil: await placeToken(evil, 3, 3, { disposition: -1 }) };
        });
        afterEach(async () => {
          CONFIG.Dice.randomUniform = originalRandom;
          setTargets([]);
          const ids = fighter?.items.filter((i) => ["weapon", "buff"].includes(i.type)).map((i) => i.id) ?? [];
          if (ids.length) await fighter.deleteEmbeddedDocuments("Item", ids);
        });
        after(async () => {
          setTargets([]);
          await deleteTokens(Object.values(tokens ?? {}));
          await cleanup([fighter, neutral, evil], messagesBefore);
          await sceneCtl?.restore();
        });

        it("magic weapon binds to the first weapon, offers the choice, and counts for that weapon only", async () => {
          const sword = await weapon("Longsword", "Longsword");
          const axe = await weapon("Battle Axe", "Battle Axe");
          const before = game.messages.size;
          const b = await buff("Magic Weapon", { changes: enhChanges });
          assert.equal(b.getFlag(MODULE_ID, _test.FLAG), sword.id);
          await waitFor(() => game.messages.contents.slice(before).some((m) => m.content.includes("data-ws-weapon")), { what: "the choice whisper" });
          const own = (w) => w.defaultAction.attackSources.filter((c) => c.parent === b);
          assert.lengthOf(own(sword), 1, "the bound sword gets the +1");
          assert.lengthOf(own(axe), 0, "the axe doesn't");
          assert.isTrue(evaluate(sword, neutral).materials.has("magic"));
          assert.isTrue(evaluate(sword, neutral).isMagic);
          assert.isFalse(evaluate(axe, neutral).isMagic);
          // The weapon's own name and price don't change
          assert.equal(sword.name, "Longsword");
          assert.lengthOf(MA.qualitiesOf(sword, { own: true }).names, 0);
        });

        it("greater magic weapon: +1 per four caster levels, and only magic against DR", async () => {
          const sword = await weapon("Longsword", "Longsword");
          await buff("Magic Weapon, Greater", { level: 12, changes: enhChanges });
          const [t] = MA.temporaryOf(sword);
          assert.equal(t.enh, 3);
          const app = evaluate(sword, neutral);
          assert.isTrue(app.materials.has("magic"));
          assert.isFalse(app.materials.has("coldIron"), "+3 from the spell doesn't bypass cold iron");
        });

        it("keen edge: keen for a slashing weapon only, without renaming or pricing it", async () => {
          const club = await weapon("Club", "Club");
          const sword = await weapon("Longsword", "Longsword");
          assert.deepEqual(_test.candidates(fighter, _test.SPELLS.find((s) => s.key === "keenEdge")).map((w) => w.id), [sword.id]);
          await buff("Keen Edge");
          assert.isTrue(MA.qualitiesOf(sword).ids.has("keen"));
          assert.isFalse(MA.qualitiesOf(club).ids.has("keen"));
          assert.equal(MA.generatedName(sword) ?? sword.name, "Longsword");
          setTargets([tokens.neutral]);
          CONFIG.Dice.randomUniform = () => 4 / 20 - 0.001; // a natural 17
          const [card] = await useAndCollect(sword);
          assert.isOk(card.systemRolls.attacks[0].critConfirm, "17 threatens (19–20 doubled)");
        });

        it("keen edge counts toward the +10 limit", async () => {
          const sword = await weapon("Longsword", "+5 Holy Speed Longsword", { system: { equipped: true, enh: 5 }, flags: { [MODULE_ID]: { magicArms: { qualities: ["Holy", "Speed"] } } } });
          assert.lengthOf(await MA.problemsOf(sword), 0);
          await buff("Keen Edge");
          assert.match((await MA.problemsOf(sword)).join(" "), /\+11/);
        });

        it("align weapon adds its alignment against DR, and nothing to a weapon that already has one", async () => {
          const sword = await weapon("Longsword", "Longsword");
          await buff("Align Weapon", { alignment: "lawful" });
          assert.isTrue(evaluate(sword, neutral).materials.has("lawful"));
          await fighter.deleteEmbeddedDocuments("Item", fighter.itemTypes.buff.map((b) => b.id));
          await sword.update({ [`flags.${MODULE_ID}.magicArms`]: { qualities: ["Holy"] }, "system.enh": 1 });
          await buff("Align Weapon", { alignment: "lawful", on: sword });
          assert.isFalse(evaluate(sword, neutral).materials.has("lawful"));
          assert.match(MA.temporaryOf(sword)[0].label, /no effect/);
        });

        it("bless weapon: good-aligned, magic against evil only, criticals against evil confirmed unless keen", async () => {
          const sword = await weapon("Longsword", "Longsword", { system: { equipped: true, alignments: { evil: true } } });
          await buff("Bless Weapon");
          let app = evaluate(sword, evil);
          assert.isTrue(app.materials.has("good"));
          assert.isFalse(app.materials.has("evil"), "its other alignment is suppressed");
          assert.isTrue(app.isMagic, "magic against an evil creature");
          assert.isFalse(evaluate(sword, neutral).isMagic);
          assert.isTrue(blessConfirms(sword, evil));
          assert.isFalse(blessConfirms(sword, neutral));
          await fighter.createEmbeddedDocuments("Item", [{ name: "Keen Edge", type: "buff", system: { active: true, level: 5 }, flags: { [MODULE_ID]: { [_test.FLAG]: sword.id } } }]);
          assert.isFalse(blessConfirms(sword, evil), "a keen weapon already has a critical effect");
        });

        it("shillelagh: only a nonmagical club or quarterstaff; +1 and damage two sizes larger on it alone", async () => {
          const sword = await weapon("Longsword", "Longsword");
          const club = await weapon("Club", "Club");
          const size = (w) => w.defaultAction.getRollData().size;
          const before = size(club);
          const b = await buff("Shillelagh", { changes: enhChanges });
          assert.equal(b.getFlag(MODULE_ID, _test.FLAG), club.id, "the club, not the sword");
          assert.equal(size(club), before + 2);
          assert.equal(size(sword), before, "the sword is unchanged");
          assert.isTrue(evaluate(club, neutral).isMagic);
          await b.update({ "system.active": false });
          assert.equal(size(club), before);
        });

        it("lead blades: every melee weapon deals damage one size larger, not more with shillelagh", async () => {
          const sword = await weapon("Longsword", "Longsword");
          const club = await weapon("Club", "Club");
          const size = (w) => w.defaultAction.getRollData().size;
          const before = size(sword);
          await fighter.createEmbeddedDocuments("Item", [{ name: "Lead Blades", type: "buff", system: { subType: "spell", active: true, level: 5 } }]);
          assert.equal(size(sword), before + 1);
          await buff("Shillelagh", { changes: enhChanges, on: club });
          assert.equal(size(club), before + 2, "the larger increase only");
        });

        it("strong jaw: natural attacks deal damage two sizes larger, weapons don't", async () => {
          const sword = await weapon("Longsword", "Longsword");
          const [bite] = await fighter.createEmbeddedDocuments("Item", [{ name: "Bite", type: "attack", system: { subType: "natural", actions: [{ _id: foundry.utils.randomID(16), name: "Bite", actionType: "mwak", damage: { parts: [{ formula: "sizeRoll(1, 6, @size)", types: ["piercing"] }] } }] } }]);
          const size = (w) => w.defaultAction.getRollData().size;
          const before = size(bite);
          await fighter.createEmbeddedDocuments("Item", [{ name: "Strong Jaw", type: "buff", system: { subType: "spell", active: true, level: 5 } }]);
          assert.equal(size(bite), before + 2);
          assert.equal(size(sword), before, "not on manufactured weapons");
          await bite.delete();
        });

        it("a buff turned off takes its effects with it", async () => {
          const sword = await weapon("Longsword", "Longsword");
          const b = await buff("Keen Edge");
          assert.isTrue(MA.qualitiesOf(sword).ids.has("keen"));
          await b.update({ "system.active": false });
          assert.isFalse(MA.qualitiesOf(sword).ids.has("keen"));
        });
      });
    },
    { displayName: "PF1e Revamp: Weapon spells" }
  );
}
