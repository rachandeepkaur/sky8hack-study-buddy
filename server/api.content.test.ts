import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "./app.js";
import { cacheCustomNode } from "./hydra.js";
import { buildTopicNode } from "./topic-builder.js";
import { validateNodeContent } from "./content-quality.js";

describe("content API", () => {
  it("GET /api/content/skills returns full catalog", async () => {
    const res = await request(app).get("/api/content/skills");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].nodes.length).toBeGreaterThan(0);
  });

  it("GET /api/content/nodes/pods returns Pods content", async () => {
    const res = await request(app).get("/api/content/nodes/pods");
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Pods");
    expect(res.body.lesson.length).toBeGreaterThan(0);
    expect(res.body.quiz.length).toBeGreaterThan(0);
    expect(validateNodeContent(res.body).ok).toBe(true);
  });

  it("GET /api/content/skills/kubernetes returns kubernetes skill only", async () => {
    const res = await request(app).get("/api/content/skills/kubernetes");
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("kubernetes");
    expect(res.body.name).toBe("Kubernetes");
  });

  it("GET /api/content/nodes/missing returns 404", async () => {
    const res = await request(app).get("/api/content/nodes/does-not-exist");
    expect(res.status).toBe(404);
  });

  it("POST /api/content/topics requires topic body", async () => {
    const res = await request(app).post("/api/content/topics").send({});
    expect(res.status).toBe(400);
  });
});

describe("POST /api/content/topics (mocked via cache)", () => {
  beforeAll(() => {
    const node = buildTopicNode("Docker", [
      "Docker packages applications into containers — isolated processes sharing the host kernel.",
      "Images are immutable templates; containers are running instances of images.",
    ]);
    cacheCustomNode(node, "test-user");
  });

  it("serves generated custom node by id", async () => {
    const res = await request(app)
      .get("/api/content/nodes/custom:docker")
      .set("X-Loop-User", "test-user");
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Docker");
    expect(res.body.lesson.join(" ")).toMatch(/container/i);
    expect(validateNodeContent(res.body).ok).toBe(true);
  });
});

describe("memory API", () => {
  it("GET /api/memory/state returns default state for new user", async () => {
    const res = await request(app)
      .get("/api/memory/state")
      .set("X-Loop-User", "test-user-vitest");
    expect(res.status).toBe(200);
    expect(res.body.activeSkillId).toBe("kubernetes");
    expect(res.body.mastery.pods).toBe("mastered");
  });
});
