import { describe, it, expect, beforeEach } from "vitest";
import { STATUS_META, isActiveStatus } from "@/lib/statusSystem";
import {
  logActivity, listActivities, clearAll,
  taskStart, taskEnd, listTasks,
} from "@/lib/activityStore";
import {
  listAllAgents, listCustomAgents, saveCustomAgent, deleteCustomAgent,
  getAgent, BUILTIN_AGENTS,
} from "@/lib/agents";
import { buildKnowledgeDigest } from "@/lib/aiKnowledge";
import { setAISettings } from "@/lib/aiSettings";

describe("statusSystem", () => {
  it("cobre todos os 7 status", () => {
    for (const s of ["idle", "queued", "running", "done", "error", "cancelled", "skipped"]) {
      expect(STATUS_META[s as keyof typeof STATUS_META].label).toBeTruthy();
    }
  });
  it("isActiveStatus: running/queued ativos; done/error não", () => {
    expect(isActiveStatus("running")).toBe(true);
    expect(isActiveStatus("queued")).toBe(true);
    expect(isActiveStatus("done")).toBe(false);
    expect(isActiveStatus("error")).toBe(false);
  });
});

describe("activityStore", () => {
  beforeEach(() => {
    clearAll();
  });

  it("logActivity registra eventos", () => {
    logActivity("canvas", "start", "Nó X começou");
    const list = listActivities();
    expect(list.length).toBe(1);
    expect(list[0].message).toBe("Nó X começou");
    expect(list[0].source).toBe("canvas");
  });

  it("tasks: start → end vira done com completedAt", () => {
    const id = taskStart(null, "Tarefa", "canvas");
    let tasks = listTasks();
    expect(tasks.length).toBe(1);
    expect(tasks[0].status).toBe("running");
    taskEnd(id, "done", "ok");
    tasks = listTasks();
    expect(tasks[0].status).toBe("done");
    expect(tasks[0].endedAt).toBeDefined();
  });

  it("logActivity registra detalhe opcional", () => {
    logActivity("pipeline", "start", "Etapa", "detalhe-x");
    const ev = listActivities()[0];
    expect(ev.detail).toBe("detalhe-x");
  });
});

describe("agents", () => {
  it("7 agentes builtin", () => {
    expect(BUILTIN_AGENTS.length).toBe(7);
    for (const a of BUILTIN_AGENTS) {
      expect(a.builtin).toBe(true);
      expect(a.pipeline.length).toBeGreaterThan(0);
    }
  });

  it("save/list/delete custom agent", () => {
    const agent = saveCustomAgent({
      label: "Teste",
      segment: "produto",
      tagline: "tag",
      description: "desc",
      pipeline: [{ section: "custom", label: "Teste", prompt: "analise" }],
      icon: BUILTIN_AGENTS[0].icon,
    });
    expect(listCustomAgents().some((a) => a.id === agent.id)).toBe(true);
    expect(getAgent(agent.id)?.label).toBe("Teste");
    deleteCustomAgent(agent.id);
    expect(listCustomAgents().some((a) => a.id === agent.id)).toBe(false);
  });

  it("listAllAgents = builtins + custom", () => {
    const base = listAllAgents().length;
    const agent = saveCustomAgent({
      label: "T2",
      segment: "customizado",
      tagline: "t",
      description: "d",
      pipeline: [{ section: "custom", label: "T2", prompt: "p" }],
      icon: BUILTIN_AGENTS[0].icon,
    });
    expect(listAllAgents().length).toBe(base + 1);
    deleteCustomAgent(agent.id);
  });
});

describe("aiKnowledge", () => {
  it("digest vazio quando desligado ou sem conhecimento", () => {
    setAISettings({ feedbackEnabled: false });
    expect(buildKnowledgeDigest()).toBe("");
  });
});
