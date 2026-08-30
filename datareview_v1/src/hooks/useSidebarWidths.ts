import { useEffect, useState } from "react";
import {
  COLUMN_SIZE_EVENT, SIDEBARS, getSidebarWidth, sidebarMax, type SidebarSide,
} from "@/lib/sidebarSizing";

/**
 * Larguras atuais das sidebars do sistema, reativas: re-lê o localStorage
 * quando `setSidebarWidth` dispara COLUMN_SIZE_EVENT ou quando o viewport
 * muda (re-clampe ao 25%).
 */
export function useColumnWidths(): Record<SidebarSide, { width: number; max: number }> {
  const read = (): Record<SidebarSide, { width: number; max: number }> => ({
    left: { width: getSidebarWidth("left"), max: sidebarMax("left") },
    right: { width: getSidebarWidth("right"), max: sidebarMax("right") },
  });
  const [values, setValues] = useState(read);

  useEffect(() => {
    const refresh = () => setValues(read());
    window.addEventListener(COLUMN_SIZE_EVENT, refresh);
    window.addEventListener("resize", refresh);
    return () => {
      window.removeEventListener(COLUMN_SIZE_EVENT, refresh);
      window.removeEventListener("resize", refresh);
    };
  }, []);

  return values;
}
