// Channel Energy: everyone of the affected type within 30 ft, healing applied up to max HP,
// harmed creatures roll Will for half.

import { createTestActor, waitFor, waitForItem, cleanup, useTestScene, placeToken, deleteTokens } from "./helpers.mjs";
import { creaturesInBurst, isUndead } from "../channel-energy.mjs";
import { setVariant, clearVariant } from "../variant-channeling.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerChannelEnergyTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.channel-energy",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Channel Energy", function () {
        this.timeout(30000);
        let cleric, ally, farAlly, zombie, channelItem, tokens, sceneCtl, messagesBefore;

        // Use one of Channel Energy's actions on the given tokens; returns the summary message once applied
        async function use(actionPrefix, targets) {
          const before = new Set(game.messages.keys());
          const actionId = channelItem.actions.find((a) => a.name.startsWith(actionPrefix)).id;
          await channelItem.use({ skipDialog: true, actionId, options: { channelTargets: targets } });
          return waitFor(() => game.messages.contents.find((m) => !before.has(m.id) && m.getFlag(MODULE_ID, "channel")?.results));
        }

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          cleric = await createTestActor("Quench Channeler", { abilities: { cha: 14 }, items: [["pf1.classes", "Cleric", { system: { level: 3 } }]] });
          ally = await createTestActor("Quench Hurt Ally", { items: [["pf1.classes", "Fighter", { system: { level: 3 } }]] });
          farAlly = await createTestActor("Quench Far Ally", { items: [["pf1.classes", "Fighter", { system: { level: 1 } }]] });
          zombie = await createTestActor("Quench Zombie", { items: [["pf1.classes", "Fighter", { system: { level: 1 } }]] });
          await zombie.createEmbeddedDocuments("Item", [{ name: "Zombie", type: "race", system: { creatureTypes: ["undead"] } }]);
          channelItem = await waitForItem(cleric, "Channel Energy");
          await channelItem.update({ "system.uses.value": 5 });
          tokens = {
            cleric: await placeToken(cleric, 2, 2),
            ally: await placeToken(ally, 3, 2),
            zombie: await placeToken(zombie, 2, 4, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE }),
            far: await placeToken(farAlly, 12, 2), // 50 ft away
          };
        });

        after(async () => {
          await deleteTokens(Object.values(tokens));
          await cleanup([cleric, ally, farAlly, zombie], messagesBefore);
          await sceneCtl.restore();
        });

        it("burst: living within 30 ft for healing, undead for harm; nobody beyond 30 ft", () => {
          assert.isTrue(isUndead(zombie));
          const living = creaturesInBurst(tokens.cleric.object, false).map((c) => c.token.actor);
          assert.includeMembers(living, [cleric, ally]);
          assert.notInclude(living, zombie);
          assert.notInclude(living, farAlly);
          assert.deepEqual(creaturesInBurst(tokens.cleric.object, true).map((c) => c.token.actor), [zombie]);
        });

        it("Blossoming Light: harm undead also hits chaotic evil outsiders and evil creatures with light blindness", async () => {
          const demon = await createTestActor("Quench CE Outsider", { system: { details: { alignment: "ce" } }, items: [["pf1.classes", "Fighter", { system: { level: 1 } }]] });
          const drow = await createTestActor("Quench Drow", { system: { details: { alignment: "ne" } }, items: [["pf1.classes", "Fighter", { system: { level: 1 } }]] });
          try {
            await demon.createEmbeddedDocuments("Item", [{ name: "Demon", type: "race", system: { creatureTypes: ["outsider"] } }]);
            await drow.createEmbeddedDocuments("Item", [{ name: "Light Blindness", type: "feat", system: { subType: "racial" } }]);
            const extra = [await placeToken(demon, 4, 2), await placeToken(drow, 4, 3)];
            const harmed = (blossoming) => creaturesInBurst(tokens.cleric.object, true, { blossoming }).map((c) => c.token.actor);
            assert.sameMembers(harmed(false), [zombie]);
            assert.sameMembers(harmed(true), [zombie, demon, drow]);
            await deleteTokens(extra);
          } finally {
            await demon.delete();
            await drow.delete();
          }
        });

        it("Luck variant channeling: half healing, then a +1 on the creature's next roll", async () => {
          await setVariant(channelItem, "Luck");
          assert.ok(cleric.items.getName("Variant Channeling (Luck)"), "shown on the sheet as a class feature");
          try {
            await ally.update({ "system.attributes.hp.value": 1 });
            const msg = await use("Positive - Heal living", [tokens.ally.object]);
            const { variant, amount } = msg.getFlag(MODULE_ID, "channel");
            assert.equal(amount, Math.floor(variant.rolled / 2), "halved");
            assert.equal(ally.system.attributes.hp.value, 1 + amount);
            const buff = await waitFor(() => ally.itemTypes.buff.find((b) => b.flags[MODULE_ID]?.channelLuck?.bonus === 1 && b.isActive));
            const save = await ally.rollSavingThrow("will", { skipDialog: true });
            assert.match(save.rolls[0].formula, /1\[Luck channel\]/);
            await waitFor(() => !buff.isActive, { what: "the bonus to be used up" });
          } finally {
            await clearVariant(channelItem);
          }
          assert.isUndefined(cleric.items.getName("Variant Channeling (Luck)"), "reset removes it");
        });

        it("heal living: applied to the targets, never above max HP, and spends a use", async () => {
          const max = ally.system.attributes.hp.max;
          await ally.update({ "system.attributes.hp.value": max - 1 });
          const usesBefore = channelItem.system.uses.value;
          const message = await use("Positive - Heal", [tokens.ally.object]);
          assert.equal(ally.system.attributes.hp.value, max, "capped at max");
          assert.equal(channelItem.system.uses.value, usesBefore - 1);
          assert.match(message.content, /\+1 \(to max\)/);
        });

        it("harm undead: Will save rolled, full or half damage applied", async () => {
          const max = zombie.system.attributes.hp.max;
          await zombie.update({ "system.attributes.hp.value": max });
          const message = await use("Positive - Harm", [tokens.zombie.object]);
          const [result] = message.getFlag(MODULE_ID, "channel").results;
          const { amount } = message.getFlag(MODULE_ID, "channel");
          const expected = /saved/.test(result.text) ? Math.floor(amount / 2) : amount;
          assert.equal(zombie.system.attributes.hp.value, max - expected);
        });
      });
    },
    { displayName: "PF1e Revamp: Channel Energy" }
  );
}
