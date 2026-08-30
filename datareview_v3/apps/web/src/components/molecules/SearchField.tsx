import { Search, X } from "lucide-react";
import { Input } from "../atoms/Input";
import { IconButton } from "../atoms/IconButton";
import styles from "./SearchField.module.css";

type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SearchField({ value, onChange, placeholder = "Buscar..." }: SearchFieldProps) {
  return (
    <div className={styles.search}>
      <span className={styles.icon} aria-hidden="true"><Search /></span>
      <Input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Buscar"
        className={styles.input}
      />
      {value ? (
        <IconButton label="Limpar busca" onClick={() => onChange("")}>
          <X aria-hidden="true" />
        </IconButton>
      ) : null}
    </div>
  );
}
