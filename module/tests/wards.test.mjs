// Alignment wards (Protection from Chaos): AC on attack cards and saves vs. the opposed alignment,
// no bonus vs. other alignments, and no stacking with an existing deflection bonus.

import { createTestActor, addItems, useAndCollect, cleanup, useTestScene, placeToken, setTargets, deleteTokens, waitFor } from "./helpers.mjs";

const MODULE_ID = "pf1e-revamp";

export function registerWardTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.wards",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Alignment wards", function () {
        this.timeout(30000);
        let defender, attacker, defenderToken, attackerToken, sceneCtl, messagesBefore;
        const acBonus = (card) => Object.values(card.getFlag(MODULE_ID, "acBonus") ?? {})[0] ?? null;

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          defender = await createTestActor("Quench Ward Defender", { items: [["pf1.classes", "Fighter", { system: { level: 1 } }]] });
          // pf-content's own buff: recognized by name, no PF1e Revamp copy needed
          await addItems(defender, [["pf-content.pf-buffs", "Protection From Chaos", { system: { active: true } }]]);
          attacker = await createTestActor("Quench Ward Attacker", {
            system: { details: { alignment: "cn" } },
            items: [["pf1.classes", "Fighter", { system: { level: 1 } }], ["pf1.weapons-and-ammo", "Longsword"]],
          });
          defenderToken = await placeToken(defender, 2, 2);
          attackerToken = await placeToken(attacker, 3, 2, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
        });

        after(async () => {
          await deleteTokens([defenderToken, attackerToken]);
          await cleanup([defender, attacker], messagesBefore);
          await sceneCtl.restore();
        });

        let chaoticCard;

        it("chaotic attacker: +2 deflection recorded on the attack card", async () => {
          setTargets([defenderToken]);
          [chaoticCard] = await useAndCollect(attacker.items.getName("Longsword"));
          const bonus = acBonus(chaoticCard);
          assert.equal(bonus?.value, 2);
          assert.equal(bonus?.label, "Protection From Chaos");
        });

        it("save against the chaotic attacker's card gets +2 resistance", async () => {
          const message = await defender.rollSavingThrow("will", { skipDialog: true, reference: chaoticCard.uuid });
          assert.match(message.rolls[0].formula, /2\[Protection From Chaos\]/);
        });

        it("lawful attacker: no bonus", async () => {
          await attacker.update({ "system.details.alignment": "ln" });
          setTargets([defenderToken]);
          const [card] = await useAndCollect(attacker.items.getName("Longsword"));
          assert.isNull(acBonus(card));
          await attacker.update({ "system.details.alignment": "cn" });
        });

        it("pf-content's Holy Aura: always-on +4 removed from the copy, applied only vs. evil", async () => {
          const holyDefender = await createTestActor("Quench Holy Defender", { items: [["pf1.classes", "Fighter", { system: { level: 1 } }]] });
          let holyToken;
          try {
            const acBefore = holyDefender.system.attributes.ac.normal.total;
            const [aura] = await addItems(holyDefender, [["pf-content.pf-buffs", "Holy Aura", { system: { active: true } }]]);
            await waitFor(() => aura.getFlag(MODULE_ID, "wardFixed"));
            assert.isFalse(aura.system.changes.some((c) => c.target === "ac" || c.target === "allSavingThrows"), "flat ward changes removed");
            assert.equal(holyDefender.system.attributes.ac.normal.total, acBefore, "no AC bonus vs. everyone");
            holyToken = await placeToken(holyDefender, 4, 2); // adjacent to the attacker, or PF1 cancels the melee attack
            await attacker.update({ "system.details.alignment": "ce" });
            setTargets([holyToken]);
            const [card] = await useAndCollect(attacker.items.getName("Longsword"));
            assert.equal(acBonus(card)?.value, 4, "+4 vs. an evil attacker");
          } finally {
            await attacker.update({ "system.details.alignment": "cn" });
            await deleteTokens([holyToken]);
            await holyDefender.delete();
          }
        });

        it("doesn't stack with an existing deflection bonus (Shield of Faith)", async () => {
          await addItems(defender, [["pf1.buffs", "Shield of Faith", { system: { active: true } }]]);
          setTargets([defenderToken]);
          const [card] = await useAndCollect(attacker.items.getName("Longsword"));
          assert.isNull(acBonus(card));
        });
      });
    },
    { displayName: "PF1e Revamp: Alignment Wards" }
  );
}
