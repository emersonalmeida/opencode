import { execFile } from "node:child_process";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { isCloudflareBlock } from "./reclameAquiCore.js";

/**
 * Camada HTTP do ReclameAqui com fallback de impersonação TLS.
 *
 * O Cloudflare que protege iosearch/iosite barra o fingerprint TLS do Node
 * (Bot Fight Mode) — mesmo em rede residencial. Cadeia:
 *  1. fetch nativo (rápido; funciona onde o CF é leniente);
 *  2. curl_cffi via server/scripts/ra-fetch.py (impersona o handshake do
 *     Chrome — o mesmo do webapp do RA);
 *  3. erro honesto orientando a instalação/rede.
 */

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9",
  Referer: "https://www.reclameaqui.com.br/",
  Origin: "https://www.reclameaqui.com.br",
};

/** curl_cffi ausente — orienta a instalação do bypass de fingerprint. */
export const RA_CF_MSG =
  "ReclameAqui bloqueou o acesso (Cloudflare). Instale o bypass de fingerprint com `pip install curl_cffi` e tente de novo; se persistir, teste de outra rede.";

/** curl_cffi presente e mesmo assim 403 — reputação do IP (rate-limit/challenge). */
export const RA_CF_IP_MSG =
  "ReclameAqui recusou este IP (Cloudflare), mesmo impersonando o navegador. Aguarde alguns minutos ou tente de outra rede.";

const RA_SCRIPT = join(process.cwd(), "server", "scripts", "ra-fetch.py");
const RA_SCRIPT_PW = join(process.cwd(), "server", "scripts", "ra-fetch-pw.py");

function projectPython(): string {
  if (process.env.VOICE_PYTHON) return process.env.VOICE_PYTHON;
  const venv = join(process.cwd(), ".venv", "bin", "python");
  if (existsSync(venv)) return venv;
  return "python3";
}

interface RaScriptResult {
  ok: boolean;
  status?: number;
  body?: string;
  error?: string;
  debug?: string;
}

function runScript(script: string, url: string, timeoutMs: number): Promise<RaScriptResult> {
  return new Promise((resolve) => {
    execFile(
      projectPython(),
      [script, url],
      { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => {
        if (err && !stdout) {
          resolve({ ok: false, error: `${script.split("/").pop()} falhou: ${String(err.message || err)}` });
          return;
        }
        try {
          resolve(JSON.parse(stdout) as RaScriptResult);
        } catch {
          resolve({ ok: false, error: `${script.split("/").pop()} retornou saída inválida` });
        }
      },
    );
  });
}

function isChallenge(r: RaScriptResult): boolean {
  return !!(r.status === 403 || (r.body && looksLikeChallenge(r.body)) || r.error?.includes("body vazio"));
}

/**
 * curl do SISTEMA: usa o TLS stack do SO (OpenSSL + certifi do sistema), que
 * o Cloudflare aceita de IP residencial — diferente do BoringSSL do Node.
 * Determinístico (sem o challenge JS instável do Playwright).
 */
function runSystemCurl(url: string): Promise<RaScriptResult> {
  return new Promise((resolve) => {
    execFile(
      "curl",
      [
        "-sS", "--max-time", "30",
        "-H", `User-Agent: ${HEADERS["User-Agent"]}`,
        "-H", `Accept: ${HEADERS.Accept}`,
        "-H", `Accept-Language: ${HEADERS["Accept-Language"]}`,
        "-H", `Referer: ${HEADERS.Referer}`,
        "-H", `Origin: ${HEADERS.Origin}`,
        "-w", "\n__RA_STATUS__:%{http_code}",
        url,
      ],
      { timeout: 40_000, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => {
        if (err && !stdout) {
          resolve({ ok: false, error: `curl: ${String(err.message || err)}` });
          return;
        }
        const m = stdout.match(/\n__RA_STATUS__:(\d+)\s*$/);
        const status = m ? parseInt(m[1], 10) : 0;
        const body = m ? stdout.slice(0, m.index) : stdout;
        resolve({ ok: status === 200 && body.trim().length > 0, status, body });
      },
    );
  });
}

function looksLikeChallenge(body: string): boolean {
  return /just a moment|challenges\.cloudflare\.com|attention required|^\s*<!DOCTYPE html>/i.test(body);
}

/**
 * Serializa chamadas ao ReclameAqui: o CF devolve 200-com-body-vazio quando
 * duas requisições chegam em rajada (search + complaints no mesmo clique).
 * Uma fila simples com intervalo mínimo elimina o falso-bloqueio.
 */
let raChain: Promise<unknown> = Promise.resolve();
let raLastAt = 0;
const RA_MIN_INTERVAL_MS = 2500;

async function raThrottle<T>(fn: () => Promise<T>): Promise<T> {
  const run = raChain.then(async () => {
    const wait = RA_MIN_INTERVAL_MS - (Date.now() - raLastAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    raLastAt = Date.now();
    return fn();
  });
  raChain = run.catch(() => undefined);
  return run;
}

function logRa(msg: string): void {
  try {
    console.warn(`[raHttp] ${msg}`);
  } catch {
    /* logging é opcional */
  }
}

/** GET JSON com fallback de impersonação; lança Error com mensagem honesta. */
export async function raFetchJson(url: string): Promise<unknown> {
  return raThrottle(() => raFetchJsonInner(url));
}

async function raFetchJsonInner(url: string): Promise<unknown> {
  // Estratégia "IP-limpa-primeiro": o CF marca o IP quando martelamos com
  // várias camadas. Então tentamos na ordem que MENOS gasta reputação:
  //   1) curl do sistema (TLS do SO — passa de IP residencial limpo, 1 request)
  //   2) Playwright (navegador real, resolve o challenge — funciona com IP
  //      residencial mesmo após marcação leve)
  //   3) curl_cffi (último recurso)
  //   4) fetch nativo (Node — quase sempre 403 no RA; último dos últimos)
  // Parar na primeira que retorna JSON utilizável.

  // 1) curl do sistema
  {
    const sc = await runSystemCurl(url);
    logRa(`curl-sistema → ok=${String(sc.ok)} status=${String(sc.status)} lenBody=${sc.body?.length ?? 0}`);
    if (sc.ok && sc.body && !looksLikeChallenge(sc.body)) {
      try {
        return JSON.parse(sc.body);
      } catch { /* cai para a próxima camada */ }
    }
  }

  // 2) Playwright (navegador real)
  {
    logRa("curl-sistema falhou — tentando Playwright (navegador real)");
    const pw = await runScript(RA_SCRIPT_PW, url, 180_000);
    logRa(`playwright → ok=${String(pw.ok)} status=${String(pw.status)} lenBody=${pw.body?.length ?? 0}${pw.debug ? ` | ${pw.debug}` : ""}`);
    if (pw.ok && pw.body && !looksLikeChallenge(pw.body)) {
      try {
        return JSON.parse(pw.body);
      } catch { /* cai */ }
    }
  }

  // 3) curl_cffi
  {
    logRa("playwright falhou — tentando curl_cffi");
    const cc = await runScript(RA_SCRIPT, url, 120_000);
    logRa(`curl_cffi → ok=${String(cc.ok)} status=${String(cc.status)} lenBody=${cc.body?.length ?? 0}`);
    if (cc.ok && cc.body && !looksLikeChallenge(cc.body)) {
      try {
        return JSON.parse(cc.body);
      } catch { /* cai */ }
    }
  }

  // 4) fetch nativo (último)
  try {
    const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
    if (resp.ok) {
      const text = await resp.text();
      if (!looksLikeChallenge(text)) {
        try {
          return JSON.parse(text);
        } catch { /* cai */ }
      }
    }
  } catch { /* cai */ }

  // Nenhuma camada conseguiu — erro honesto.
  logRa("todas as camadas falharam");
  throw new Error(RA_CF_IP_MSG);
}
