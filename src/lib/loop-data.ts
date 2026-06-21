export type {
  Mastery,
  QuizQuestion,
  SkillNode,
  Skill,
  SessionRecord,
  LoopState,
} from "../../shared/types";

export const MASTERY_ORDER: import("../../shared/types").Mastery[] = [
  "unseen", "intro", "practiced", "shaky", "mastered",
];

export const MASTERY_LABEL: Record<import("../../shared/types").Mastery, string> = {
  unseen: "Not seen",
  intro: "Introduced",
  practiced: "Practiced",
  shaky: "Shaky",
  mastered: "Mastered",
};

export const MASTERY_VAR: Record<import("../../shared/types").Mastery, string> = {
  unseen: "var(--mastery-unseen)",
  intro: "var(--mastery-intro)",
  practiced: "var(--mastery-practiced)",
  shaky: "var(--mastery-shaky)",
  mastered: "var(--mastery-mastered)",
};

export {
  getSkills,
  getAllNodes,
  getSkill,
  nodeById,
  registerNode,
  loadSkillsCatalog,
  fetchNode,
  generateTopicNode,
  personalizeNode,
  skillForNode,
  isContentLoaded,
} from "./content-api";
