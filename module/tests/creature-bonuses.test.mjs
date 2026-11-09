// Bonuses against kinds of creatures: notes read from items, applied against the targets (attacks),
// the attacker (AC), or the effect's source (saves); per-target totals when only some targets qualify.

import { createTestActor, fromPack, useAndCollect, formulas, cleanup, useTestScene, placeToken, setTargets, deleteTokens } from "./helpers.mjs";
import { _test as effects } from "../roll-effects.mjs";
import { _test as bonuses, creatureBonuses } from "../creature-bonuses.mjs";
import { parseNote, saveBonuses } from "../save-bonuses.mjs";

const MODULE_ID = "pf1e-revamp";
const NO_PROMPT = { pf1eRevampNoPrompt: true };

export function registerCreatureBonusTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.creature-bonuses",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Bonuses against creatures", function () {
        this.timeout(45000);
        let dwarf, goblin, human, giant, outsider, tokens, sceneCtl, messagesBefore;
        const actors = [];
        const make = async (name, entries, extra = []) => {
          const actor = await createTestActor(name);
          actors.push(actor);
          const data = [];
          for (const [pack, itemName] of entries) data.push(await fromPack(pack, itemName));
          await actor.createEmbeddedDocuments("Item", [...data, ...extra], NO_PROMPT);
          return actor;
        };
        const feat = (name, notes) => ({ name, type: "feat", system: { subType: "feat", contextNotes: notes.map(([target, text]) => ({ target, text })) } });
        const entries = (actor) => effects.buildModel(actor, { kind: "attack", action: actor.items.getName("Longsword").defaultAction, flags: {} }).provided.filter((p) => String(p.id).startsWith("creature-vs."));

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          sceneCtl = await useTestScene();
          dwarf = await make("Quench Dwarf", [["pf1.races", "Dwarf"], ["pf1.weapons-and-ammo", "Longsword"]], [feat("Quench Goblin Bane", [["attack", "+[[2]] Trait bonus on damage rolls against goblinoids"]])]);
          goblin = await make("Quench Goblin", [["pf1.races", "Goblin"]]);
          human = await make("Quench Human", [["pf1.races", "Human"]]);
          giant = await make("Quench Giant", [["pf1.weapons-and-ammo", "Longsword"]], [{ name: "Quench Giant Race", type: "race", system: { creatureTypes: ["humanoid"], creatureSubtypes: ["giant"] } }]);
          outsider = await make("Quench Outsider", [], [{ name: "Quench Outsider Race", type: "race", system: { creatureTypes: ["outsider"], creatureSubtypes: ["native"] } }]);
          tokens = {
            dwarf: await placeToken(dwarf, 2, 2),
            goblin: await placeToken(goblin, 3, 2, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE }),
            human: await placeToken(human, 3, 3, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE }),
            giant: await placeToken(giant, 1, 2, { disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE }),
          };
        });

        after(async () => {
          await deleteTokens(Object.values(tokens ?? {}));
          await cleanup(actors, messagesBefore);
          await sceneCtl?.restore();
        });

        it("reads the creatures a note names, and leaves conditions it can't check", () => {
          const hatred = bonuses.parseLine("+[[1]] Racial vs Humanoids (Orc, Goblinoid)");
          assert.deepEqual(hatred.spec.types, ["humanoid"]);
          assert.sameMembers(hatred.spec.subtypes, ["orc", "goblinoid"]);
          assert.isFalse(hatred.conditional);
          assert.equal(bonuses.parseLine("+[[4]] Dodge vs Giants").type, "dodge");
          assert.deepEqual(bonuses.parseLine("+[[1]] Racial vs Humanoids (Reptillian, Goblinoid)").spec.subtypes, ["reptilian", "goblinoid"]);
          assert.isTrue(bonuses.parseLine("+[[1]] Trait bonus to slashing weapon damage against all aberrations.").conditional);
          assert.isNull(bonuses.parseLine("+[[5]] Circumstance vs cold weather effects"), "not about a creature");
        });

        it("a single goblin target: Hatred and the damage bonus apply", () => {
          setTargets([tokens.goblin]);
          const list = entries(dwarf);
          const hatred = list.find((e) => e.label === "Dwarf");
          assert.isTrue(hatred?.applies);
          assert.equal(hatred.atk, 1);
          assert.isTrue(list.find((e) => e.label === "Quench Goblin Bane")?.applies);
        });

        it("a human target: Not Applied, with the reason", () => {
          setTargets([tokens.human]);
          const hatred = entries(dwarf).find((e) => e.label === "Dwarf");
          assert.isFalse(hatred.applies);
          assert.match(hatred.reason, /Quench Human isn't/);
        });

        it("a goblin and a human together: the roll goes without it, the card gives the goblin its own total and damage", async () => {
          setTargets([tokens.goblin, tokens.human]);
          const hatred = entries(dwarf).find((e) => e.label === "Dwarf");
          assert.isTrue(hatred.perTarget);
          const [card] = await useAndCollect(dwarf.items.getName("Longsword"));
          assert.notMatch(formulas(card)[0].attack, /\[Dwarf\]/);
          const data = card.getFlag(MODULE_ID, "creatureBonuses");
          const g = data.targets.find((t) => t.name === "Quench Goblin");
          assert.equal(g.atk, 1);
          assert.equal(g.dmg, 2);
          assert.isUndefined(data.targets.find((t) => t.name === "Quench Human"));
          // The goblin's extra damage is added when the card's damage is applied to it
          const hp = goblin.system.attributes.hp.value;
          await goblin.applyDamage(3, { message: card });
          assert.equal(goblin.system.attributes.hp.value, hp - 5);
          const humanHp = human.system.attributes.hp.value;
          await human.applyDamage(3, { message: card });
          assert.equal(human.system.attributes.hp.value, humanHp - 3);
        });

        it("Defensive Training: +4 dodge AC against a giant's attack, not in flat-footed AC", async () => {
          setTargets([tokens.dwarf]);
          const [card] = await useAndCollect(giant.items.getName("Longsword"));
          const ac = card.getFlag(MODULE_ID, "creatureAC")?.[tokens.dwarf.uuid.replaceAll(".", "_")];
          assert.equal(ac?.dodge, 4);
          assert.equal(ac?.all, 0);
        });

        it("saves: '+2 vs fear effects created by outsiders' counts only when the source is an outsider", async () => {
          const parsed = parseNote("+[[2]] Trait bonus vs fear effects created by outsiders");
          assert.deepEqual(parsed.creatures.types, ["outsider"]);
          assert.isFalse(parsed.conditional);
          await dwarf.createEmbeddedDocuments("Item", [feat("Quench Fear Ward", [["allSavingThrows", "+[[2]] Trait bonus vs fear effects created by outsiders"]])], NO_PROMPT);
          const fear = { name: "Cause Fear", text: "Cause Fear fear", school: "nec", subschools: new Set(), descriptors: new Set(["fear", "mindAffecting"]), isSpell: true, isSLA: false, isPoison: false };
          const ward = (source) => saveBonuses(dwarf, "will", fear, { source }).find((b) => b.label === "Quench Fear Ward");
          assert.equal(ward(outsider)?.value, 2);
          assert.isUndefined(ward(human));
          assert.isUndefined(saveBonuses(dwarf, "will", { ...fear, descriptors: new Set(["fire"]) }, { source: outsider }).find((b) => b.label === "Quench Fear Ward"));
        });

        it("chosen creatures: nothing until chosen, then the choice", async () => {
          const [item] = await dwarf.createEmbeddedDocuments("Item", [feat("Defensive Training, Lesser", [["ac", "+[[4]] Dodge bonus to AC against humanoids of the chosen subtype."]])], NO_PROMPT);
          let b = creatureBonuses(dwarf, ["ac"]).find((x) => x.item === item);
          assert.isTrue(b.needsChoice);
          await item.setFlag(MODULE_ID, "creatureChoice", { types: [], subtypes: ["goblinoid"] });
          b = creatureBonuses(dwarf, ["ac"]).find((x) => x.item === item);
          assert.isFalse(b.needsChoice);
          assert.deepEqual(b.spec.subtypes, ["goblinoid"]);
        });
      });
    },
    { displayName: "PF1e Revamp: Bonuses against creatures" }
  );
}
