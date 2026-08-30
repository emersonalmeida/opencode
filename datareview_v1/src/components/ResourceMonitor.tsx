import { useEffect, useState } from "react";
import { Cpu, MemoryStick, CircuitBoard, Wifi, Monitor, Timer } from "lucide-react";

/**
 * Monitor de recursos em tempo real — o que o browser expõe, honestamente.
 * CPU (threads), RAM do dispositivo, heap JS (Chrome), GPU via WebGL,
 * rede, tela e uptime. Atualiza a cada 2s. Sem poll de mensagens desnecessário.
 */

interface ResourceInfo {
  cpuThreads: string;
  deviceMemory: string;
  jsHeap: { used: number; total: number; limit: number } | null;
  gpu: string;
  network: string;
  screen: string;
  uptime: string;
}

let cachedGpu: string | null = null;

function detectGpu(): string {
  if (cachedGpu) return cachedGpu;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return "WebGL indisponível";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) : (gl.getParameter(gl.RENDERER) as string);
    cachedGpu = renderer || "GPU não identificada";
  } catch {
    cachedGpu = "GPU não detectada";
  }
  return cachedGpu;
}

function readResources(): ResourceInfo {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string; downlink?: number; rtt?: number };
  };
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
  };
  const conn = nav.connection;
  const mb = (n: number) => `${(n / 1048576).toFixed(0)} MB`;
  return {
    cpuThreads: nav.hardwareConcurrency ? `${nav.hardwareConcurrency} threads` : "—",
    deviceMemory: nav.deviceMemory ? `~${nav.deviceMemory} GB` : "não exposta",
    jsHeap: perf.memory
      ? { used: perf.memory.usedJSHeapSize, total: perf.memory.totalJSHeapSize, limit: perf.memory.jsHeapSizeLimit }
      : null,
    gpu: detectGpu(),
    network: conn
      ? `${conn.effectiveType ?? "?"}${conn.downlink ? ` · ${conn.downlink} Mb/s` : ""}${conn.rtt != null ? ` · ${conn.rtt} ms` : ""}`
      : "—",
    screen: `${window.screen.width}×${window.screen.height}`,
    uptime: formatUptime(performance.now()),
  };
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : m > 0 ? `${m}min ${s % 60}s` : `${s}s`;
}

function Row({ icon: Icon, label, value, hint }: { icon: typeof Cpu; label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-[10px] text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="text-[10px] font-mono text-foreground truncate" title={hint ?? value}>{value}</span>
    </div>
  );
}

export function ResourceMonitor() {
  const [info, setInfo] = useState<ResourceInfo>(() => readResources());

  useEffect(() => {
    const id = setInterval(() => setInfo(readResources()), 2000);
    return () => clearInterval(id);
  }, []);

  const heapPct = info.jsHeap ? Math.min(100, (info.jsHeap.used / info.jsHeap.limit) * 100) : null;

  return (
    <div className="px-3 py-2 space-y-1.5">
      <Row icon={Cpu} label="CPU" value={info.cpuThreads} />
      <Row icon={MemoryStick} label="RAM (dispositivo)" value={info.deviceMemory} />
      <div className="py-1">
        <div className="flex items-center gap-2">
          <MemoryStick className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[10px] text-muted-foreground w-24 shrink-0">Heap JS</span>
          <span className="text-[10px] font-mono text-foreground">
            {info.jsHeap ? `${(info.jsHeap.used / 1048576).toFixed(0)} / ${(info.jsHeap.limit / 1048576).toFixed(0)} MB` : "só Chrome"}
          </span>
        </div>
        {heapPct != null && (
          <div className="mt-1 ml-5 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${heapPct > 80 ? "bg-status-warning" : "bg-status-success"}`}
              style={{ width: `${heapPct}%` }}
            />
          </div>
        )}
      </div>
      <Row icon={CircuitBoard} label="GPU" value={info.gpu} hint={info.gpu} />
      <Row icon={Wifi} label="Rede" value={info.network} />
      <Row icon={Monitor} label="Tela" value={info.screen} />
      <Row icon={Timer} label="Uptime da página" value={info.uptime} />
      <p className="text-[9px] text-muted-foreground/70 leading-relaxed pt-1">
        Somente o que o browser expõe com segurança. VRAM exata não é acessível; o nome da GPU vem via WebGL.
      </p>
    </div>
  );
}
