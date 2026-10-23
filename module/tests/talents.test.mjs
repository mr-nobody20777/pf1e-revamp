// Slayer talents and ranger combat styles: options and requirements, rogue talents only through the
// Rogue Talent talent, follow-up choices (combat style, rogue talent, bonus feats), undo, slots, the
// ranger's style feats, and the picker's search box.

import { createTestActor, addItems, waitFor, waitForItem, cleanup } from "./helpers.mjs";
import { talentOptions, chooseSlayerTalent, chooseRangerStyleFeat, applyPlan, slayerSlots, rangerSlots, requirementsOf } from "../talents.mjs";

const MODULE_ID = "pf1e-revamp";

/** Scripted answers: each question is answered with the next label (matched by start of label). */
const scripted = (answers) => async ({ rows }) => {
  const want = answers.shift();
  const row = rows.find((r) => r.label === want) ?? rows.find((r) => r.label.startsWith(want));
  if (!row) throw new Error(`"${want}" not offered (offered: ${rows.slice(0, 15).map((r) => r.label).join(", ")}…)`);
  return row.id;
};

export function registerTalentTests(quench) {
  quench.registerBatch(
    "pf1e-revamp.talents",
    (context) => {
      const { describe, it, assert, before, after } = context;

      describe("Slayer talents and combat styles", function () {
        this.timeout(60000);
        let slayer, messagesBefore;
        const actors = [];
        const names = (opts) => opts.map((o) => o.name);

        before(async () => {
          messagesBefore = new Set(game.messages.keys());
          slayer = await createTestActor("Quench Talented Slayer", { abilities: { int: 12, dex: 16, str: 14 }, items: [["pf1.classes", "Slayer", { system: { level: 2 } }]] });
          actors.push(slayer);
          await waitForItem(slayer, "Studied Target");
        });
        after(async () => cleanup(actors, messagesBefore));

        it("options at 2nd level: no advanced talents, rogue talents only through Rogue Talent, requirements marked", async () => {
          const opts = await talentOptions(slayer, 2);
          assert.include(names(opts), "Ranger Combat Style");
          assert.include(names(opts), "Rogue Talent (SLA)");
          assert.notInclude(names(opts), "Bleeding Attack", "shared rogue talent, only via Rogue Talent");
          assert.notOk(opts.some((o) => o.advanced), "no advanced talents before 10th");
          const range = opts.find((o) => o.name.startsWith("Deadly Range"));
          assert.equal(range.check.status, "unmet");
          assert.match(range.check.why.join(), /level 4/);
          const pounce = opts.find((o) => o.name === "Jaguar's Pounce");
          assert.equal(pounce.check.status, "unmet");
          assert.deepEqual(pounce.check.why, ["needs jaguar's grace"]);
        });

        it("talent requirements are read from every phrasing", () => {
          assert.deepEqual(requirementsOf("The slayer must be at least 6th level and have the poison use talent to select this talent.").talents, ["poison use"]);
          assert.deepEqual(requirementsOf("A slayer must have the armored marauder slayer talent to select this talent.").talents, ["armored marauder"]);
          assert.deepEqual(requirementsOf("The character must have cold resistance from a racial trait and the shadow's chill talent before choosing this talent.").talents, ["shadow's chill"]);
        });

        it("Ranger Combat Style: choose the style, then a feat with prerequisites ignored", async () => {
          const plan = await chooseSlayerTalent(slayer, { level: 2, pick: scripted(["Ranger Combat Style", "Two-Weapon Combat", "Two-Weapon Fighting"]) });
          const { talent, feats } = await applyPlan(slayer, plan, 2);
          assert.equal(talent.name, "Ranger Combat Style (Two-Weapon Combat)");
          assert.equal(feats[0].name, "Two-Weapon Fighting");
          assert.equal(feats[0].getFlag(MODULE_ID, "grantedBy"), talent.id);
        });

        it("taking it again needs 6th level; then the style is fixed and the 6th-level feats open up", async () => {
          const again = (await talentOptions(slayer, 2)).find((o) => o.name === "Ranger Combat Style");
          assert.equal(again.check.status, "unmet");
          let offered = [];
          const plan = await chooseSlayerTalent(slayer, {
            level: 6,
            pick: async ({ rows, title }) => {
              if (/slayer talent/.test(title)) return rows.find((r) => r.label === "Ranger Combat Style").id;
              offered = rows.map((r) => r.label); // the feat question, with no style question first
              return rows.find((r) => r.label === "Improved Two-Weapon Fighting").id;
            },
          });
          assert.include(offered, "Improved Two-Weapon Fighting");
          assert.notInclude(offered, "Two-Weapon Fighting", "already has it");
          assert.equal(plan.style, "Two-Weapon Combat");
        });

        it("Rogue Talent → Combat Trick → a combat feat; deleting the talent removes the feat", async () => {
          const plan = await chooseSlayerTalent(slayer, { level: 2, pick: scripted(["Rogue Talent (SLA)", "Combat Trick", "Power Attack"]) });
          assert.equal(plan.via, "Rogue Talent (SLA)");
          const { talent, feats } = await applyPlan(slayer, plan, 4);
          assert.equal(talent.name, "Combat Trick");
          assert.equal(feats[0].name, "Power Attack");
          await talent.delete();
          await waitFor(() => !slayer.items.getName("Power Attack"));
        });

        it("Rogue Talent → Finesse Rogue adds Weapon Finesse automatically", async () => {
          const plan = await chooseSlayerTalent(slayer, { level: 2, pick: scripted(["Rogue Talent (SLA)", "Finesse Rogue"]) });
          const { feats } = await applyPlan(slayer, plan, 4);
          assert.equal(feats[0]?.name, "Weapon Finesse");
        });

        it("slots: 2nd level has one, filled; the Rogue Talent pick counts once", async () => {
          const s = slayerSlots(slayer);
          assert.equal(s.total, 1);
          assert.isAtLeast(s.used, 1);
          assert.isNull(s.next);
        });

        it("the picker's search box filters the list", async () => {
          const open = chooseSlayerTalent(slayer, { level: 2 });
          const dialog = await waitFor(() => [...foundry.applications.instances.values()].find((a) => a.rendered && /slayer talent/.test(a.title ?? "")));
          const search = dialog.element.querySelector(".pfr-search");
          const visible = () => [...dialog.element.querySelectorAll(".pfr-row")].filter((r) => r.style.display !== "none").length;
          const all = visible();
          search.value = "jaguar";
          search.dispatchEvent(new Event("input"));
          assert.isAbove(all, 10);
          assert.isAtLeast(visible(), 1);
          assert.isBelow(visible(), all);
          dialog.element.querySelector('button[data-action="cancel"]').click();
          assert.isNull(await open);
        });

        describe("Ranger", function () {
          let ranger;
          before(async () => {
            ranger = await createTestActor("Quench Style Ranger", { abilities: { dex: 16 }, items: [["pf1.classes", "Ranger", { system: { level: 6 } }]] });
            actors.push(ranger);
            await waitForItem(ranger, "Combat Style Feat");
          });

          it("chooses the style once, then feats from the lists unlocked at their level", async () => {
            let offered = [];
            const first = await chooseRangerStyleFeat(ranger, { level: 6, pick: async ({ rows, title }) => (/choose a combat style/.test(title) ? rows.find((r) => r.label === "Archery").id : ((offered = rows.map((r) => r.label)), rows.find((r) => r.label === "Manyshot").id)) });
            assert.include(offered, "Manyshot", "6th-level list");
            assert.notInclude(offered, "Pinpoint Targeting", "10th-level list not yet");
            await applyPlan(ranger, first, 2);
            assert.equal(ranger.items.getName("Combat Style Feat").getFlag(MODULE_ID, "combatStyle"), "Archery");
            assert.ok(ranger.items.getName("Manyshot"));

            const second = await chooseRangerStyleFeat(ranger, { level: 6, pick: scripted(["Point-Blank Shot"]) }); // no style question now
            await applyPlan(ranger, second, 6);
            assert.deepInclude(rangerSlots(ranger), { total: 2, used: 2, next: null });
          });
        });
      });
    },
    { displayName: "PF1e Revamp: Slayer Talents and Combat Styles" }
  );
}
