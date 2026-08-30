/**
 * PrimaryColorSwatches — grade de cores principais AGRUPADA (coloridas por
 * escala + monocromáticas). Componente único usado no SettingsPanel e no
 * ThemeToggle — sempre reflete a paleta do ThemeProvider.
 */
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

const GROUP_META: Array<{ id: "colorida" | "monocromatica"; label: string }> = [
  { id: "colorida", label: "Coloridas" },
  { id: "monocromatica", label: "Monocromáticas" },
];

export function PrimaryColorSwatches({ columns = 8 }: { columns?: number }) {
  const { primaryColor, setPrimaryColor, primaryColors } = useTheme();
  return (
    <div className="space-y-2">
      {GROUP_META.map((g) => {
        const items = primaryColors.filter((c) => c.group === g.id);
        if (items.length === 0) return null;
        return (
          <div key={g.id}>
            <p className="text-[9px] font-medium text-muted-foreground/80 uppercase tracking-wider mb-1">
              {g.label} · {items.length}
            </p>
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
              role="group"
              aria-label={`Cores principais ${g.label.toLowerCase()}`}
            >
              {items.map((c) => (
                <button
                  key={c.hsl}
                  onClick={() => setPrimaryColor(c.hsl)}
                  title={c.name}
                  aria-label={`Cor principal ${c.name}`}
                  aria-pressed={primaryColor === c.hsl}
                  className={cn(
                    "w-full aspect-square rounded-md transition-all",
                    primaryColor === c.hsl
                      ? "ring-2 ring-foreground ring-offset-1 ring-offset-popover scale-110"
                      : "hover:scale-110",
                  )}
                  style={{ backgroundColor: `hsl(${c.hsl})` }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
