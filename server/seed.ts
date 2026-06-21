import "dotenv/config";
import { SKILLS } from "./content-data.js";
import { ensureTenant, ingestKnowledgeEntry } from "./hydra.js";

function nodeDocument(skillId: string, skillName: string, node: (typeof SKILLS)[0]["nodes"][0]) {
  const lines = [
    `# ${node.title}`,
    `Skill: ${skillName} (${skillId})`,
    `Blurb: ${node.blurb}`,
    `Prerequisites: ${node.prereqs.join(", ") || "none"}`,
    "",
    "## Lesson",
    ...node.lesson.map((p) => `- ${p}`),
    "",
    "## Quiz",
    ...node.quiz.map(
      (q, i) =>
        `Q${i + 1}: ${q.q}\nOptions: ${q.options.join(" | ")}\nAnswer: ${q.options[q.answer]}\nExplanation: ${q.explanation}`,
    ),
  ];
  return lines.join("\n");
}

async function main() {
  console.log("[seed] Ensuring Hydra tenant…");
  await ensureTenant();

  console.log("[seed] Ingesting skills catalog…");
  await ingestKnowledgeEntry({
    id: "skills-catalog",
    title: "Loop skills catalog",
    body: JSON.stringify(
      SKILLS.map((s) => ({ id: s.id, name: s.name, nodeIds: s.nodes.map((n) => n.id) })),
    ),
    metadata: { kind: "catalog" },
  });

  for (const skill of SKILLS) {
    for (const node of skill.nodes) {
      console.log(`[seed]   ${skill.id} / ${node.id}`);
      await ingestKnowledgeEntry({
        id: `node:${node.id}`,
        title: `${skill.name} — ${node.title}`,
        body: nodeDocument(skill.id, skill.name, node),
        metadata: { kind: "node", skill_id: skill.id, node_id: node.id },
      });
    }
  }

  console.log("[seed] Done. Content is indexing in Hydra (async).");
}

main().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
