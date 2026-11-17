// Natural-attack riders: reading "plus grab" and friends, automatic riders applied on a seen hit (with
// Undo) and not on a miss, immunities, energy drain doubled on a critical, and the monster's maneuvers
// (grab, hold, trip, constrict, size limits).

import { createTestActor, cleanup, useTestScene, placeToken, deleteTokens, setTargets, waitFor } from "./helpers.mjs";
import { _test } from "../natural-riders.mjs";
import { settled } from "../util.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerNaturalRiderTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.natural-riders",
    (context) => {
      const { describe, it, assert, before, after, afterEach } = context;

      describe("Natural-attack riders", function () {
        this.timeout(60000);
        let monster, victim, undead, big, tokens, sceneCtl, messagesBefore;
        const originalRandom = CONFIG.Dice.randomUniform;
        const bite = (notes) => ({
          name: "Bite",
          type: "attack",
          system: {
            subType: "natural",
            effectNotes: notes,
            actions: [{ _id: foundry.utils.randomID(), name: "Attack", actionType: "mwak", activation: { type: "attack" }, damage: { parts: [{ formula: "1d6", types: ["piercing"] }] }, ability: { attack: "str", damage: "str" } }],
          },
        });
        /** Attack `target` with an attack carrying `notes`; `natural`: force the attack's d20 only. */
        const attack = async (notes, target, natural = 20) => {
          const [item] = await monster.createEmbeddedDocuments("Item", [bite(notes)]);
          setTargets([target]);
          const before = new Set(game.messages.keys());
          CONFIG.Dice.randomUniform = () => (natural === 20 ? 0.001 : 0.999);
          // After the attack's own rolls, the riders' saves roll natural 1s: every test here expects a failed
          // save against DC 40, and a real natural 20 would pass it (1 run in 20)
          Hooks.once("pf1PreDisplayActionUse", () => (CONFIG.Dice.randomUniform = () => 0.999));
          let card;
          try {
            await item.use({ skipDialog: true });
            card = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.getFlag(MODULE_ID, _test.FLAG)));
            await settled();
            await new Promise((r) => setTimeout(r, 1500)); // the GM's automatic riders
          } finally {
            CONFIG.Dice.randomUniform = originalRandom;
          }
          await item.delete();
          return game.messages.get(card.id);
        };
        const forced = async (value, fn) => {
          CONFIG.Dice.randomUniform = () => value;
          try {
            return await fn();
          } finally {
            CONFIG.Dice.randomUniform = originalRandom;
          }
        };
        const entry = (card, key) => card.getFlag(MODULE_ID, _test.FLAG).applied?.[0]?.[card.getFlag(MODULE_ID, _test.FLAG).riders.findIndex((r) => r.key === key)];
        const riderIndex = (card, key) => card.getFlag(MODULE_ID, _test.FLAG).riders.findIndex((r) => r.key === key);

        before(async function () {
          if (!game.users.activeGM?.isSelf) this.skip();
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          monster = await createTestActor("Quench Ghoulish Monster", { abilities: { str: 14, con: 12 } });
          victim = await createTestActor("Quench Rider Victim", { abilities: { con: 1, str: 1, dex: 1 } });
          undead = await createTestActor("Quench Rider Undead", { items: [["pf1.racial-hd", "Undead", { system: { level: 1 } }]] });
          big = await createTestActor("Quench Rider Giant", { system: { traits: { size: "huge" } } });
          tokens = {
            monster: await placeToken(monster, 2, 2, { disposition: -1 }),
            victim: await placeToken(victim, 3, 2),
            undead: await placeToken(undead, 2, 3),
            big: await placeToken(big, 4, 4),
          };
        });
        afterEach(async () => {
          CONFIG.Dice.randomUniform = originalRandom;
          for (const a of [victim, undead, big, monster]) {
            const on = ["paralyzed", "grappled", "prone", "bleed"].filter((s) => a.statuses.has(s));
            if (on.length) await a.setConditions(Object.fromEntries(on.map((s) => [s, false])));
          }
          await victim.update({ "system.attributes.energyDrain": 0, "system.attributes.hp.value": victim.system.attributes.hp.max });
          await monster.update({ "system.attributes.hp.temp": 0 });
        });
        after(async () => {
          setTargets([]);
          await deleteTokens(Object.values(tokens ?? {}));
          await cleanup([monster, victim, undead, big], messagesBefore);
          await sceneCtl?.restore();
        });

        it("reads riders from the notes and the attack's name", () => {
          const read = (notes, name = "Bite") => [..._test.ridersOf({ name, system: { effectNotes: notes, attackNotes: [] } }, null).keys()];
          assert.sameMembers(read(["plus bleed and grab"]), ["bleed", "grab"]);
          assert.sameMembers(read([], "Bite (plus Grab)"), ["grab"]);
          assert.sameMembers(read(["plus @Use[Poison]"]), ["poison"]);
          assert.sameMembers(read(["plus energy drain (2 levels)"]), ["energyDrain"]);
          assert.sameMembers(read(["Reach 10 ft."]), []);
        });

        it("paralysis is applied on a hit (DC and duration from the note), and Undo removes it", async () => {
          const card = await attack(["plus paralysis (1d4+1 rounds, DC 40)"], tokens.victim);
          assert.match(entry(card, "paralysis").text, /failed \(Fortitude DC 40\): paralyzed \d round/);
          assert.isTrue(victim.statuses.has("paralyzed"));
          await _test.runRider(card, 0, riderIndex(card, "paralysis"), "undo");
          assert.isFalse(victim.statuses.has("paralyzed"));
        });

        it("nothing is applied on a miss (natural 1)", async () => {
          const card = await attack(["plus paralysis (1d4 rounds, DC 40)"], tokens.victim, 1);
          assert.isUndefined(entry(card, "paralysis"));
          assert.isFalse(victim.statuses.has("paralyzed"));
        });

        it("undead are immune to paralysis", async () => {
          const card = await attack(["plus paralysis (1d4 rounds, DC 40)"], tokens.undead);
          assert.equal(entry(card, "paralysis").text, "immune to paralysis");
        });

        it("energy drain on a confirmed critical: twice the negative levels, 5 temporary hit points each", async () => {
          const card = await attack(["plus energy drain"], tokens.victim); // natural 20, confirmed with a natural 20
          assert.equal(victim.system.attributes.energyDrain, 2);
          assert.equal(monster.system.attributes.hp.temp, 10);
          assert.match(entry(card, "energyDrain").text, /critical: doubled/);
        });

        it("poison: only the first save, then the effect to apply by hand", async () => {
          const card = await attack(["plus poison (Fort DC 40; effect 1d2 Str damage)"], tokens.victim);
          assert.match(entry(card, "poison").text, /failed \(Fortitude DC 40\).*apply the poison by hand/);
        });

        it("grab is the monster's choice: a button; success grapples both, a hold only the target; constrict deals its damage", async () => {
          let card = await attack(["plus grab"], tokens.victim);
          const r = riderIndex(card, "grab");
          assert.isUndefined(entry(card, "grab"), "not automatic");
          await forced(0.001, () => _test.runRider(card, 0, r, "maneuver"));
          assert.isTrue(victim.statuses.has("grappled"));
          assert.isTrue(monster.statuses.has("grappled"));
          card = game.messages.get(card.id);
          const hp = victim.system.attributes.hp.value;
          await _test.runRider(card, 0, r, "constrict");
          assert.isBelow(victim.system.attributes.hp.value, hp, "constrict (the attack's damage) was dealt");
          await victim.setConditions({ grappled: false });
          await monster.setConditions({ grappled: false });
          card = await attack(["plus grab"], tokens.victim);
          await forced(0.001, () => _test.runRider(card, 0, r, "hold"));
          assert.isTrue(victim.statuses.has("grappled"));
          assert.isFalse(monster.statuses.has("grappled"));
        });

        it("trip knocks prone on a success; grab and trip fail against a target too big", async () => {
          let card = await attack(["plus trip"], tokens.victim);
          await forced(0.001, () => _test.runRider(card, 0, riderIndex(card, "trip"), "maneuver"));
          assert.isTrue(victim.statuses.has("prone"));
          card = await attack(["plus grab"], tokens.big);
          const result = await forced(0.001, () => _test.runRider(card, 0, riderIndex(card, "grab"), "maneuver"));
          assert.match(result.text, /too big/);
        });
      });
    },
    { displayName: "PF1e Revamp: Natural-attack riders" }
  );
}
