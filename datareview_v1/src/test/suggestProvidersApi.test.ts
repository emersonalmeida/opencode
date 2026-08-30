
import { describe, expect, it, vi } from "vitest"
import { runAlternativeProvider } from "@/lib/suggest/suggestApi"

describe("runAlternativeProvider", () => {
  it("normaliza resposta do provedor num GatherResult", async () => {
    const body = {
      provider: "bing",
      query: "python",
      items: [
        { text: "python download", relevance: 1000 },
        { text: "python compiler", relevance: 900 }
      ]
    }
    const resp = new Response(
      JSON.stringify(body),
      {
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    )
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => resp)
    )
    const res = await runAlternativeProvider(
      "python",
      "bing",
      {}
    )
    const first = res.uniItems[0] as {
      meta?: Record<string, unknown>
    }
    expect(
      res.ok
    ).toBe(
      true
    )
    expect(
      res.rows.map((r) => r.text)
    ).toEqual(
      ["python download", "python compiler"]
    )
    expect(
      res.uniItems.length
    ).toBe(
      2
    )
    expect(
      res.observations.length
    ).toBe(
      2
    )
    expect(
      first.meta?.["provider"]
    ).toBe(
      "bing"
    )
    vi.unstubAllGlobals()
  })

  it("falha honesta quando o provedor responde erro", async () => {
    const resp = new Response(
      JSON.stringify({ error: "unknown provider" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 400
      }
    )
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => resp)
    )
    const res = await runAlternativeProvider(
      "python",
      "nao-existe",
      {}
    )
    expect(
      res.ok
    ).toBe(
      false
    )
    expect(
      res.error
    ).toContain(
      "unknown provider"
    )
    vi.unstubAllGlobals()
  })
})
