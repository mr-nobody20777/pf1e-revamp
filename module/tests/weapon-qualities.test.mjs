// Weapon qualities (phase 4a): read from the name or chosen on the weapon; energy dice on a hit, burst dice
// on a critical hit (once per multiplier step), aligned and bane dice against the right targets, keen's
// doubled threat range, merciful's nonlethal card, vicious's 1d6 to the wielder, aligned DR bypass.

import { createTestActor, cleanup, useTestScene, placeToken, deleteTokens, addItems, setTargets, useAndCollect, waitFor } from "./helpers.mjs";
import { _test } from "../weapon-qualities.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerWeaponQualityTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.weapon-qualities",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Weapon qualities", function () {
        this.timeout(60000);
        let fighter, goblin, priest, skeleton, tokens, sceneCtl, messagesBefore;
        const originalRandom = CONFIG.Dice.randomUniform;
        const fake = (name, flag = null) => ({ type: "weapon", name, getFlag: () => flag });
        const ids = (name, flag) => [..._test.qualitiesOf(fake(name, flag)).ids].sort();
        /** A weapon on the fighter, named for its qualities. */
        const weapon = async (base, name, extra = {}) => (await addItems(fighter, [["pf1.weapons-and-ammo", base, { name, system: { equipped: true }, ...extra }]]))[0];
        const damage = async (item, critical = false) => {
          const action = item.defaultAction;
          return (await action.rollDamage({ data: action.getRollData(), critical })).map((r) => ({ formula: r.formula, types: [...(r.options.damageType ?? [])] }));
        };
        const text = (rolls) => rolls.map((r) => r.formula).join(" + ");
        /** Attack `target` with every d20 a natural `n`. */
        const attackWith = async (item, target, n) => {
          setTargets(target ? [target] : []);
          CONFIG.Dice.randomUniform = () => (21 - n) / 20 - 0.001;
          try {
            const [card] = await useAndCollect(item);
            return card;
          } finally {
            CONFIG.Dice.randomUniform = originalRandom;
          }
        };

        before(async function () {
          if (!game.users.activeGM?.isSelf) this.skip();
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          fighter = await createTestActor("Quench WQ Fighter", { abilities: { str: 14 }, items: [["pf1.classes", "Fighter", { system: { level: 5 } }]] });
          goblin = await createTestActor("Quench WQ Neutral", { abilities: { con: 10 }, system: { details: { alignment: "tn" } } });
          priest = await createTestActor("Quench WQ Evil", { system: { details: { alignment: "ne" } } });
          skeleton = await createTestActor("Quench WQ Undead", { items: [["pf1.racial-hd", "Undead", { system: { level: 1 } }]], system: { details: { alignment: "ne" } } });
          tokens = {
            fighter: await placeToken(fighter, 2, 2),
            goblin: await placeToken(goblin, 3, 2, { disposition: -1 }),
            priest: await placeToken(priest, 3, 3, { disposition: -1 }),
            skeleton: await placeToken(skeleton, 2, 3, { disposition: -1 }),
          };
        });
        afterEach(async () => {
          CONFIG.Dice.randomUniform = originalRandom;
          setTargets([]);
          const weapons = fighter?.itemTypes.weapon.map((w) => w.id) ?? [];
          if (weapons.length) await fighter.deleteEmbeddedDocuments("Item", weapons);
          await fighter?.update({ "system.attributes.hp.value": fighter.system.attributes.hp.max });
        });
        after(async () => {
          setTargets([]);
          await deleteTokens(Object.values(tokens ?? {}));
          await cleanup([fighter, goblin, priest, skeleton], messagesBefore);
          await sceneCtl?.restore();
        });

        it("reads qualities from the name; a burst brings its base quality; unholy isn't holy", () => {
          assert.deepEqual(ids("+1 Flaming Burst Longsword"), ["flaming", "flamingBurst"]);
          assert.deepEqual(ids("+1 Shocking Burst Rapier"), ["shock", "shockingBurst"]);
          assert.deepEqual(ids("+2 Unholy Keen Scimitar"), ["keen", "unholy"]);
          assert.deepEqual(ids("Frost Brand"), ["frost"]);
          assert.deepEqual(ids("Longsword"), []);
        });

        it("reads a bane weapon's designated foe from the name", () => {
          assert.deepEqual(_test.qualitiesOf(fake("+1 Undead Bane Longsword")).bane, { types: ["undead"], subtypes: [] });
          assert.deepEqual(_test.qualitiesOf(fake("+1 Orc-Bane Greataxe")).bane, { types: [], subtypes: ["orc"] });
          assert.deepEqual(_test.qualitiesOf(fake("+1 Magical Beast Bane Spear")).bane, { types: ["magicalbeast"], subtypes: [] });
          assert.isNull(_test.qualitiesOf(fake("+1 Bane Longsword")).bane);
        });

        it("qualities chosen on the weapon win over the name", () => {
          assert.deepEqual(ids("+1 Flaming Longsword", { list: ["frost"] }), ["frost"]);
          assert.deepEqual(_test.qualitiesOf(fake("+1 Bane Longsword", { list: ["bane"], bane: { types: ["dragon"], subtypes: [] } })).bane, { types: ["dragon"], subtypes: [] });
        });

        it("flaming: +1d6 fire in normal damage, never multiplied on a critical hit", async () => {
          const sword = await weapon("Longsword", "+1 Flaming Longsword");
          const normal = await damage(sword);
          const fire = normal.find((r) => /1d6\[Flaming\]/.test(r.formula));
          assert.isOk(fire, text(normal));
          assert.deepEqual(fire.types, ["fire"]);
          assert.notMatch(text(await damage(sword, true)), /Flaming/);
        });

        it("flaming isn't added twice when the action already has 1d6 fire typed in", async () => {
          const sword = await weapon("Longsword", "+1 Flaming Longsword");
          await sword.defaultAction.update({ "damage.nonCritParts": [{ formula: "1d6", types: ["fire"] }] });
          assert.notMatch(text(await damage(sword)), /\[Flaming\]/);
        });

        it("flaming burst: 1d10 fire per multiplier step on a critical hit (2d10 with a ×3 battleaxe)", async () => {
          const axe = await weapon("Battle Axe", "+1 Flaming Burst Battle Axe");
          const card = await attackWith(axe, tokens.goblin, 20);
          const crit = card.systemRolls.attacks[0].critDamage ?? [];
          const bursts = crit.filter((r) => /Flaming Burst/.test(r.formula));
          assert.equal(bursts.length, 2, crit.map((r) => r.formula).join(" | "));
          assert.deepEqual([...bursts[0].options.damageType], ["fire"]);
          assert.notMatch((card.systemRolls.attacks[0].damage ?? []).map((r) => r.formula).join(" + "), /Flaming Burst/);
        });

        it("holy: +2d6 against an evil target only", async () => {
          const mace = await weapon("Heavy Mace", "+1 Holy Heavy Mace");
          setTargets([tokens.priest]);
          assert.match(text(await damage(mace)), /2d6\[Holy\]/);
          setTargets([tokens.goblin]);
          assert.notMatch(text(await damage(mace)), /Holy/);
        });

        it("holy weapons count as good against DR in PF1's damage math", async () => {
          const mace = await weapon("Heavy Mace", "+1 Holy Heavy Mace");
          const instance = Object.assign(new pf1.models.action.DamagePartModel({ formula: "0", types: ["bludgeoning"] }), { value: 10 });
          const app = new pf1.applications.ApplyDamage({ value: 10, instances: [instance], action: mace.defaultAction, targets: [priest] });
          assert.isTrue(app.materials.has("good"));
        });

        it("bane: +2 attack and damage and +2d6 against the designated foe only", async () => {
          const sword = await weapon("Longsword", "+1 Undead Bane Longsword");
          let card = await attackWith(sword, tokens.skeleton, 10);
          assert.match(card.systemRolls.attacks[0].attack.formula, /2\[Bane \(undead\)\]/);
          assert.match((card.systemRolls.attacks[0].damage ?? []).map((r) => r.formula).join(" + "), /2d6\[Bane \(undead\)\]/);
          card = await attackWith(sword, tokens.goblin, 10);
          assert.notMatch(card.systemRolls.attacks[0].attack.formula, /Bane/);
        });

        it("keen doubles a slashing weapon's threat range, and not a club's", async () => {
          const sword = await weapon("Longsword", "+1 Keen Longsword");
          let card = await attackWith(sword, tokens.goblin, 17);
          assert.isOk(card.systemRolls.attacks[0].critConfirm, "17 threatens with a keen longsword (17–20)");
          const club = await weapon("Club", "+1 Keen Club");
          assert.isFalse(_test.keenWorks(club.defaultAction));
          card = await attackWith(club, tokens.goblin, 19);
          assert.notOk(card.systemRolls.attacks[0].critConfirm, "a club stays 20 only");
        });

        it("merciful: +1d6 and the whole card's damage is nonlethal", async () => {
          const sword = await weapon("Longsword", "+1 Merciful Longsword");
          const card = await attackWith(sword, tokens.goblin, 10);
          assert.isTrue(!!card.system.config?.nonlethal);
          assert.match((card.systemRolls.attacks[0].damage ?? []).map((r) => r.formula).join(" + "), /1d6\[Merciful\]/);
        });

        it("vicious: +2d6, and the wielder takes 1d6 on a hit the module can see", async () => {
          const sword = await weapon("Longsword", "+1 Vicious Longsword");
          const before = fighter.system.attributes.hp.value;
          const card = await attackWith(sword, tokens.goblin, 20);
          assert.match((card.systemRolls.attacks[0].damage ?? []).map((r) => r.formula).join(" + "), /2d6\[Vicious\]/);
          const applied = await waitFor(() => card.getFlag(MODULE_ID, _test.FLAG)?.vicious?.applied?.[0], { what: "vicious damage" });
          assert.isAtLeast(applied.total, 1);
          assert.equal(fighter.system.attributes.hp.value, before - applied.total);
        });
      });
    },
    { displayName: "PF1e Revamp: weapon qualities" },
  );
}
