import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import GitObjectNode, { KIND_ICON, KIND_LABEL, STATUS_DOT } from "@/components/gitCanvas/GitObjectNode";
import { GIT_CANVAS_VIEWS } from "@/lib/gitCanvas/types";
import type { GitNodeKind, ObjectStatus } from "@/lib/gitCanvas/types";

function renderNode(data: Record<string, unknown>, selected = false) {
  return render(
    <ReactFlowProvider>
      <GitObjectNode
        id="n1"
        data={data as never}
        selected={selected}
        type="gitObject"
        dragging={false}
        zIndex={0}
        isConnectable
        positionAbsoluteX={0}
        positionAbsoluteY={0}
        draggable
        selectable
        deletable
      />
    </ReactFlowProvider>,
  );
}

describe("GitObjectNode — linguagem visual única (§30)", () => {
  it("todo kind do spec §6 tem ícone e rótulo definidos", () => {
    const kinds: GitNodeKind[] = [
      "project", "repository", "remote", "local-repository", "branch", "commit",
      "file", "folder", "diff", "pull-request", "issue", "review", "agent",
      "workflow", "build", "deployment", "environment", "release", "test",
      "package", "documentation", "person", "task", "terminal",
    ];
    for (const k of kinds) {
      expect(KIND_ICON[k], `ícone de ${k}`).toBeTruthy();
      expect(KIND_LABEL[k]?.trim().length, `rótulo de ${k}`).toBeGreaterThan(0);
    }
  });

  it("todo status tem cor de dot mapeada", () => {
    const statuses: ObjectStatus[] = ["ok", "running", "pending", "warning", "error", "offline", "unknown"];
    for (const s of statuses) expect(STATUS_DOT[s]).toBeTruthy();
  });

  it("renderiza label, sub e badges", () => {
    renderNode({
      kind: "branch",
      label: "main",
      sub: "9aac58e · ↑0 ↓2",
      status: "warning",
      badges: ["default", "local"],
    });
    expect(screen.getByText("main")).toBeTruthy();
    expect(screen.getByText("9aac58e · ↑0 ↓2")).toBeTruthy();
    expect(screen.getByText("default")).toBeTruthy();
    expect(screen.getByText("Branch")).toBeTruthy();
  });

  it("mostra o status no dot acessível", () => {
    renderNode({ kind: "agent", label: "✦ OpenHands", status: "running" });
    expect(screen.getByLabelText("status: running")).toBeTruthy();
  });

  it("seleção aplica ring visual", () => {
    const { container } = renderNode({ kind: "commit", label: "c", status: "ok" }, true);
    expect(container.querySelector(".ring-2")).toBeTruthy();
  });

  it("as 7 visões têm rótulo e hint", () => {
    for (const v of GIT_CANVAS_VIEWS) {
      expect(v.label.trim().length).toBeGreaterThan(0);
      expect(v.hint.trim().length).toBeGreaterThan(0);
    }
  });
});
