/**
 * Atalhos globais + central de ajuda — eficiência para usuários avançados
 * (Cmd/Ctrl+K busca) e descobribilidade ("?" lista tudo). Montado uma vez
 * no AppShell. Navegação g+<letra> para as páginas principais (sequência
 * estilo Vim: pressione "g" e depois a letra).
 */
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useKeyboardShortcuts } from "@/hooks/useUx";
import { ShortcutsDialog } from "@/components/ux/UxPrimitives";
import type { ShortcutDef } from "@/lib/ux";

/** Atalhos de navegação "g + letra" (prefixo g, depois a tecla). */
const NAV_SHORTCUTS: Array<{ key: string; path: string; label: string }> = [
  { key: "h", path: "/", label: "Início" },
  { key: "d", path: "/dashboard", label: "Dashboard" },
  { key: "c", path: "/chat", label: "Chat" },
  { key: "i", path: "/ia", label: "Central de IA" },
  { key: "x", path: "/canvas", label: "Canvas" },
  { key: "s", path: "/search", label: "Busca" },
  { key: "o", path: "/configuracoes", label: "Configurações" },
];

export function GlobalShortcuts() {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingNav = useRef(false);

  const shortcuts = useMemo<ShortcutDef[]>(
    () => [
      {
        key: "k", mod: true, label: "Busca global", group: "Navegação",
        run: () => {
          const input = document.querySelector<HTMLInputElement>('form[role="search"] input, input[type="search"]');
          input?.focus();
          input?.select();
        },
      },
      {
        key: "?", shift: true, label: "Mostrar atalhos", group: "Ajuda",
        run: () => setHelpOpen((v) => !v),
      },
      // prefixo "g" inicia navegação por duas teclas
      {
        key: "g", label: "Ir para… (pressione g + letra)", group: "Navegação",
        run: () => { pendingNav.current = true; setTimeout(() => { pendingNav.current = false; }, 1200); },
      },
    ],
    [],
  );

  // Navegação g+letra
  useKeyboardShortcuts(
    useMemo<ShortcutDef[]>(
      () =>
        NAV_SHORTCUTS.map((n) => ({
          key: n.key,
          label: `Ir para ${n.label} (g ${n.key})`,
          group: "Navegação",
          when: () => pendingNav.current,
          run: () => { pendingNav.current = false; navigate(n.path); },
        })),
      [navigate],
    ),
  );

  useKeyboardShortcuts(shortcuts);

  const allShortcuts = useMemo<ShortcutDef[]>(
    () => [
      ...shortcuts.filter((s) => s.key !== "g"),
      ...NAV_SHORTCUTS.map((n) => ({
        key: n.key, label: `Ir para ${n.label}`, group: "Navegação (g + tecla)",
        run: () => {},
      })),
    ],
    [shortcuts],
  );

  return <ShortcutsDialog shortcuts={allShortcuts} open={helpOpen} onClose={() => setHelpOpen(false)} />;
}
