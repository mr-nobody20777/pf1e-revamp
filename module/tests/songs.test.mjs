// Skald raging songs: rounds spent, linked buffs with real effects, one-to-many removal, song
// replacement, end-of-turn round costs in combat, and the deaf performer's flat check.

import { createTestActor, cleanup, useTestScene, placeToken, deleteTokens, waitFor, waitForItem, closeStrayWindows } from "./helpers.mjs";
import { startSong, endSong, findPool } from "../raging-song.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerSongTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.songs",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Skald raging songs", function () {
        this.timeout(45000);
        let skald, ally, enemy, tokens, sceneCtl, messagesBefore, pool;
        const rounds = () => pool.system.uses.value;
        const songBuffs = (actor) => actor.itemTypes.buff.filter((b) => b.getFlag(MODULE_ID, "songLink"));
        const refill = () => pool.update({ "system.uses.value": pool.system.uses.max });

        before(async function () {
          if (!game.users.activeGM?.isSelf) this.skip();
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          skald = await createTestActor("Quench Skald", { abilities: { cha: 16 }, items: [["pf1.classes", "Skald", { system: { level: 10 } }]] });
          ally = await createTestActor("Quench Ally", { abilities: { str: 12 } });
          enemy = await createTestActor("Quench Foe");
          await waitForItem(skald, "Dirge of Doom");
          pool = findPool(skald);
          tokens = {
            skald: await placeToken(skald, 2, 2),
            ally: await placeToken(ally, 3, 2),
            enemy: await placeToken(enemy, 4, 2, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE }),
          };
          await refill();
        });

        after(async () => {
          if (pool?.getFlag(MODULE_ID, "ragingSong")) await endSong(pool);
          await game.combats.find((c) => c.getFlag(MODULE_ID, "quench"))?.delete();
          await deleteTokens(Object.values(tokens ?? {}));
          await cleanup([skald, ally, enemy], messagesBefore);
          await sceneCtl?.restore();
        });

        it("Inspired Rage spends 1 round and gives targets the real bonuses (level 10)", async () => {
          const start = rounds();
          const strBefore = ally.system.abilities.str.total;
          await startSong(skald, skald.items.getName("Inspired Rage"), { targets: [tokens.skald.object, tokens.ally.object] });
          assert.equal(rounds(), start - 1);
          await waitFor(() => songBuffs(ally).length === 1 && songBuffs(skald).length === 2);
          const changes = Object.fromEntries(songBuffs(ally)[0].system.changes.map((c) => [`${c.target}:${c.type}`, Number(c.formula)]));
          assert.deepInclude(changes, { "str:morale": 4, "con:morale": 4, "will:morale": 3, "ac:untyped": -1 });
          await waitFor(() => ally.system.abilities.str.total === strBefore + 4);
        });

        it("removing one ally's buff releases only that ally", async () => {
          await songBuffs(ally)[0].delete();
          await waitFor(() => !pool.getFlag(MODULE_ID, "ragingSong").targets.includes(tokens.ally.uuid));
          assert.isOk(pool.getFlag(MODULE_ID, "ragingSong"), "song still going");
          assert.isTrue(songBuffs(skald).some((b) => b.getFlag(MODULE_ID, "songLink").role === "song"));
        });

        it("Dirge of Doom replaces the song and makes enemies shaken", async () => {
          await startSong(skald, skald.items.getName("Dirge of Doom"), { targets: [tokens.enemy.object] });
          await waitFor(() => enemy.statuses.has("shaken"));
          await waitFor(() => songBuffs(skald).length === 1 && songBuffs(skald)[0].name === "Raging Song: Dirge of Doom");
        });

        it("ending the song removes every linked buff", async () => {
          await endSong(pool, "test");
          await waitFor(() => !songBuffs(skald).length && !songBuffs(enemy).length);
          assert.isFalse(enemy.statuses.has("shaken"));
        });

        it("in combat, maintaining costs 1 round at the END of the skald's turn", async () => {
          await refill();
          const combat = await Combat.create({ scene: canvas.scene.id, active: true, flags: { [MODULE_ID]: { quench: true } } });
          await combat.createEmbeddedDocuments("Combatant", [
            { tokenId: tokens.skald.id, sceneId: canvas.scene.id, actorId: skald.id, initiative: 20 },
            { tokenId: tokens.ally.id, sceneId: canvas.scene.id, actorId: ally.id, initiative: 10 },
          ]);
          await combat.startCombat();
          assert.equal(combat.combatant.actor, skald, "skald acts first");

          await startSong(skald, skald.items.getName("Inspired Rage"), { targets: [tokens.ally.object] });
          const afterStart = rounds();
          await combat.nextTurn(); // end of the skald's starting turn: already paid
          await new Promise((r) => setTimeout(r, 500));
          assert.equal(rounds(), afterStart, "no charge for the turn the song started");
          await combat.nextTurn(); // round 2, skald's turn begins: no charge at turn start
          await new Promise((r) => setTimeout(r, 500));
          assert.equal(rounds(), afterStart);
          await combat.nextTurn(); // end of the skald's round 2 turn: charge
          await waitFor(() => rounds() === afterStart - 1);
          await endSong(pool);
          await combat.delete();
          await new Promise((r) => setTimeout(r, 300));
          await closeStrayWindows();
        });

        it("deafened: a visible d100 flat check is rolled when starting a song", async () => {
          await skald.setCondition("deaf", true);
          const before = new Set(game.messages.keys());
          await startSong(skald, skald.items.getName("Inspired Rage"), { targets: [tokens.ally.object] });
          const check = await waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && /deafened, 20% chance to fail/.test(m.flavor ?? "")));
          assert.ok(check);
          if (pool.getFlag(MODULE_ID, "ragingSong")) await endSong(pool);
          await skald.setCondition("deaf", false);
        });
      });
    },
    { displayName: "PF1e Revamp: Skald Songs" }
  );
}
