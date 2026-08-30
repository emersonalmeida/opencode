import { describe, expect, it } from "vitest";
import {
  deriveStatus,
  isCloudflareBlock,
  parseCompanyComplaints,
  parseCompanyProfile,
  parseCompanySearch,
  parseTermSearch,
} from "../../server/lib/reclameAquiCore";

describe("reclameAquiCore — deriveStatus (idêntico ao web client RA)", () => {
  it("resolvido quando avaliada e solved", () => {
    expect(deriveStatus({ evaluated: true, solved: true })).toBe("Resolvido");
  });
  it("não resolvido quando avaliada e !solved", () => {
    expect(deriveStatus({ evaluated: true, solved: false })).toBe("Não resolvido");
  });
  it("réplica quando não avaliada com 2+ interações", () => {
    expect(deriveStatus({ evaluated: false, interactions: [{}, {}] })).toBe("Réplica");
  });
  it("respondido quando ANSWERED", () => {
    expect(deriveStatus({ evaluated: false, status: "ANSWERED", interactions: [] })).toBe("Respondido");
  });
  it("não respondido quando PENDING", () => {
    expect(deriveStatus({ evaluated: false, status: "PENDING" })).toBe("Não respondido");
  });
});

describe("reclameAquiCore — parseCompanySearch", () => {
  const payload = {
    companies: [
      { id: 928, name: "Nubank", shortname: "nubank", location: { city: "SAO PAULO", state: "SP" } },
      { id: 1, name: "Nu Pagamentos", shortname: "nu-pagamentos" },
    ],
  };
  it("normaliza empresas com url canônica", () => {
    const out = parseCompanySearch(payload);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      id: "928", name: "Nubank", shortname: "nubank",
      state: "SP", url: "https://www.reclameaqui.com.br/empresa/nubank/",
    });
  });
  it("payload sem companies → []", () => {
    expect(parseCompanySearch({})).toEqual([]);
    expect(parseCompanySearch(null)).toEqual([]);
  });
});

describe("reclameAquiCore — parseCompanyComplaints", () => {
  const payload = {
    complainResult: {
      complains: {
        count: 12345,
        data: [
          {
            id: "abc123", title: "Cobrança indevida", description: "Cobraram duas vezes.",
            created: "2026-08-20T10:00:00", status: "ANSWERED", evaluated: false,
            userCity: "Recife", userState: "PE", interactions: [{}, {}],
          },
          {
            id: "def456", title: "App fora do ar", description: "Não consigo acessar.",
            created: "2026-08-21T11:00:00", status: "ANSWERED", evaluated: true, solved: true,
            dealAgain: true, score: 9, userCity: "SP", userState: "SP", interactions: [{}],
          },
        ],
      },
    },
  };
  it("normaliza reclamações com status derivado e total", () => {
    const { complaints, total } = parseCompanyComplaints(payload, 25);
    expect(total).toBe(12345);
    expect(complaints).toHaveLength(2);
    expect(complaints[0].status).toBe("Réplica");
    expect(complaints[1].status).toBe("Resolvido");
    expect(complaints[1].dealAgain).toBe(true);
    expect(complaints[1].score).toBe(9);
    expect(complaints[0].url).toBe("https://www.reclameaqui.com.br/reclamar/abc123/");
  });
  it("respeita limit", () => {
    const { complaints } = parseCompanyComplaints(payload, 1);
    expect(complaints).toHaveLength(1);
  });
  it("url relativa vira absoluta", () => {
    const p = { complainResult: { complains: { data: [{ id: "x9", title: "t", url: "/empresa/nubank/reclamacoes/x9/" }] } } };
    const { complaints } = parseCompanyComplaints(p, 10);
    expect(complaints[0].url).toBe("https://www.reclameaqui.com.br/empresa/nubank/reclamacoes/x9/");
  });
  it("estrutura ausente → vazio", () => {
    expect(parseCompanyComplaints({}, 10)).toEqual({ complaints: [], total: 0 });
  });
});

describe("reclameAquiCore — parseTermSearch", () => {
  it("normaliza a busca livre (shape real: complainResult.complains.data)", () => {
    const out = parseTermSearch({
      complainResult: {
        complains: {
          data: [
            { id: "ab1", titleMasked: "Cobrança indevida", description: "Relato<br/>aqui", created: "2026-08-25T10:00:00", status: "PENDING", userCity: "Recife", userState: "PE", companyName: "Loja X", url: "/cobranca-indevida_ab1" },
            { id: "ab2", titleMasked: "Estorno", created: "2026-08-24T10:00:00", status: "ANSWERED", evaluated: true, solved: true, score: 9, companyName: "Loja Y" },
          ],
        },
      },
    }, 10);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: "ab1", title: "Cobrança indevida", status: "Não respondido", city: "Recife", state: "PE", companyName: "Loja X" });
    expect(out[0].text).toBe("Relato\naqui");
    expect(out[0].url).toBe("https://www.reclameaqui.com.br/cobranca-indevida_ab1");
    expect(out[1]).toMatchObject({ id: "ab2", status: "Resolvido", score: 9, companyName: "Loja Y" });
  });
  it("payload sem complainResult → []", () => {
    expect(parseTermSearch({}, 10)).toEqual([]);
    expect(parseTermSearch({ complainResult: { complains: {} } }, 10)).toEqual([]);
  });
});

describe("reclameAquiCore — parseCompanyProfile", () => {
  it("extrai perfil", () => {
    const p = parseCompanyProfile({ id: 928, name: "Nubank", shortname: "nubank", finalScore: 7.4, status: "RA1000" });
    expect(p).toMatchObject({ id: "928", name: "Nubank", shortname: "nubank", finalScore: 7.4, status: "RA1000" });
  });
  it("sem id/name → null", () => {
    expect(parseCompanyProfile({})).toBeNull();
    expect(parseCompanyProfile(null)).toBeNull();
  });
});

describe("reclameAquiCore — isCloudflareBlock", () => {
  it("detecta challenge do Cloudflare", () => {
    expect(isCloudflareBlock(403, "<!DOCTYPE html><title>Just a moment...</title>")).toBe(true);
    expect(isCloudflareBlock(503, "challenges.cloudflare.com")).toBe(true);
  });
  it("403 sem marca de challenge não é CF", () => {
    expect(isCloudflareBlock(403, '{"error":"forbidden"}')).toBe(false);
    expect(isCloudflareBlock(200, "ok")).toBe(false);
  });
});
