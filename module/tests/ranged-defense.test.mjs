// Ranged combat, phase 2: AC against ranged attacks, deflecting, damage reduction against ranged
// weapons, ranged-only miss chances, and shooting while prone.

import { createTestActor, addItems, cleanup, useTestScene, placeToken, setTargets, deleteTokens, waitFor } from "./helpers.mjs";
import { _test as defense } from "../ranged-defense.mjs";
import { missChances } from "../miss-chance.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerRangedDefenseTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.ranged-defense",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Ranged combat: defenses", function () {
        this.timeout(45000);
        let archer, goblin, archerToken, goblinToken, sceneCtl, messagesBefore;
        const made = [];
        const give = async (actor, data) => {
          const [doc] = await actor.createEmbeddedDocuments("Item", [data]);
          made.push(doc);
          return doc;
        };
        const buff = (name, level = 1) => ({ type: "buff", name, system: { subType: "spell", active: true, level } });
        const worn = (name, subType = "wondrous") => ({ type: "equipment", name, system: { subType, equipped: true } });
        const bow = () => archer.items.getName("Longbow").defaultAction;
        const sword = () => archer.items.getName("Longsword").defaultAction;
        async function shoot() {
          const before = new Set(game.messages.keys());
          await archer.items.getName("Longbow").use({ skipDialog: true });
          return waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.type === "action"));
        }

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          archer = await createTestActor("Quench Defense Archer", { abilities: { dex: 16 }, items: [["pf1.classes", "Fighter", { system: { level: 1 } }], ["pf1.weapons-and-ammo", "Longbow"], ["pf1.weapons-and-ammo", "Arrow", { system: { quantity: 50 } }], ["pf1.weapons-and-ammo", "Longsword"]] });
          goblin = await createTestActor("Quench Defense Goblin", { abilities: { con: 30 }, items: [["pf1.classes", "Fighter", { system: { level: 3 } }]] });
          archerToken = await placeToken(archer, 1, 1);
          goblinToken = await placeToken(goblin, 5, 1, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
          setTargets([goblinToken]);
        });
        afterEach(async () => {
          for (const doc of made.splice(0)) if (doc.parent?.items.has(doc.id)) await doc.delete();
          for (const id of ["prone", "flatFooted"]) for (const a of [archer, goblin]) if (a.statuses.has(id)) await a.setCondition(id, false);
          await goblin.unsetFlag(MODULE_ID, "deflected");
          setTargets([goblinToken]);
        });
        after(async () => {
          await deleteTokens([archerToken, goblinToken]);
          await cleanup([archer, goblin], messagesBefore);
          await sceneCtl?.restore();
        });

        it("AC against ranged attacks: prone, Prone Shooter, deflection that doesn't stack, Low Profile", async () => {
          assert.deepEqual(defense.acAgainstRanged(goblin, bow()), []);
          await goblin.setCondition("prone", true);
          assert.deepInclude(defense.acAgainstRanged(goblin, bow()), { value: 4, label: "prone" });
          await addItems(goblin, [["pf-content.pf-feats", "Prone Shooter"]]).then((d) => made.push(...d));
          assert.equal(defense.acAgainstRanged(goblin, bow())[0].value, 6);
          await goblin.setCondition("prone", false);
          await give(goblin, buff("Bullet Shield", 10));
          assert.equal(defense.acAgainstRanged(goblin, bow()).find((c) => /deflection/.test(c.label)).value, 6, "+4, +1 per 5 caster levels");
          await give(goblin, { type: "buff", name: "Ring of Protection +2", system: { subType: "item", active: true, changes: [{ formula: "2", target: "ac", type: "deflection", operator: "add" }] } });
          assert.equal(defense.acAgainstRanged(goblin, bow()).find((c) => /deflection/.test(c.label)).value, 4, "only the part above the ring's +2");
          assert.isUndefined(defense.acAgainstRanged(goblin, sword()).find((c) => /deflection/.test(c.label)), "melee attacks: nothing");
        });

        it("the card: the AC line for a prone target, to everyone", async () => {
          await goblin.setCondition("prone", true);
          const card = await shoot();
          const data = card.getFlag(MODULE_ID, defense.FLAG);
          assert.equal(data.targets[0].changes[0].value, 4);
          const text = (await card.renderHTML()).querySelector(".pf1e-revamp-ranged-defense")?.textContent ?? "";
          assert.match(text, /AC \d+ against this ranged attack \(\+4 prone\): \d+ (hits|misses)/);
        });

        it("Deflect Arrows: offered on the card, once per round, not when flat-footed", async () => {
          await addItems(goblin, [["pf1.feats", "Deflect Arrows"]]).then((d) => made.push(...d));
          assert.equal(defense.deflectorOf(goblin, bow())?.label, "Deflect Arrows");
          assert.isNull(defense.deflectorOf(goblin, sword()), "not melee");
          await goblin.setCondition("flatFooted", true);
          assert.isNull(defense.deflectorOf(goblin, bow()), "not when flat-footed");
          await goblin.setCondition("flatFooted", false);
          const combat = await Combat.create({ scene: canvas.scene.id, active: true, flags: { [MODULE_ID]: { quench: true } } });
          try {
            await combat.createEmbeddedDocuments("Combatant", [{ tokenId: archerToken.id, sceneId: canvas.scene.id, actorId: archer.id, initiative: 20 }, { tokenId: goblinToken.id, sceneId: canvas.scene.id, actorId: goblin.id, initiative: 10 }]);
            await combat.startCombat();
            // Nevela makes creatures flat-footed until they act; this goblin is ready for it
            await new Promise((r) => setTimeout(r, 300));
            if (goblin.statuses.has("flatFooted")) await goblin.setCondition("flatFooted", false);
            const card = await shoot();
            assert.deepInclude(await defense.deflect(card, 0, 0), { by: "Deflect Arrows" });
            assert.match((await card.renderHTML()).textContent, /deflected it \(Deflect Arrows\): no damage/);
            const second = await shoot();
            assert.isNull(await defense.deflect(second, 0, 0), "once per round");
          } finally {
            await combat.delete();
          }
        });

        it("Protection from Arrows: DR 10/magic against ranged weapons, used up after 10 per caster level", async () => {
          const ward = await give(goblin, buff("Protection from Arrows", 2));
          await goblin.update({ "system.attributes.hp.value": goblin.system.attributes.hp.max });
          const start = goblin.system.attributes.hp.value;
          await goblin.applyDamage(14, { action: bow(), forceDialog: false });
          assert.equal(goblin.system.attributes.hp.value, start - 4, "10 absorbed");
          assert.equal(ward.getFlag(MODULE_ID, "absorbLeft"), 10, "20 points for caster level 2");
          await goblin.applyDamage(14, { action: sword(), forceDialog: false });
          assert.equal(goblin.system.attributes.hp.value, start - 18, "melee: no DR");
          await goblin.applyDamage(14, { action: bow(), forceDialog: false });
          assert.isFalse(ward.isActive, "discharged");
          await archer.items.getName("Longbow").update({ "system.enh": 1 });
          try {
            assert.isNull(defense.rangedDR(goblin, bow()), "a +1 bow overcomes /magic");
          } finally {
            await archer.items.getName("Longbow").update({ "system.enh": 0 });
          }
        });

        it("miss chances against ranged attacks only: Wind Ward by level, Arrow-Collecting armor for projectiles", async () => {
          await give(goblin, buff("Wind Ward", 16));
          assert.deepInclude(missChances(goblin, archer, bow().item, "rwak").map((c) => [c.label, c.chance]), ["Wind Ward", 50]);
          assert.isEmpty(missChances(goblin, archer, sword().item, "mwak"));
          made.splice(0).forEach((d) => d.delete());
          await waitFor(() => !goblin.itemTypes.buff.length);
          await give(goblin, worn("Arrow-Collecting Chainmail", "armor"));
          assert.deepInclude(missChances(goblin, archer, bow().item, "rwak").map((c) => c.chance), 20);
          assert.isEmpty(missChances(goblin, archer, bow().item, "twak"), "not thrown weapons");
        });

        it("shooting while prone: a warning for bows", async () => {
          await archer.setCondition("prone", true);
          const warnings = [];
          const original = ui.notifications.warn;
          ui.notifications.warn = (msg, ...rest) => (warnings.push(String(msg)), original.call(ui.notifications, msg, ...rest));
          try {
            await shoot();
          } finally {
            ui.notifications.warn = original;
          }
          assert.isTrue(warnings.some((w) => /is prone/.test(w)));
        });
      });
    },
    { displayName: "PF1e Revamp: Ranged Defenses" }
  );
}
