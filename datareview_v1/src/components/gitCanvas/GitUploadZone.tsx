/**
 * Git Canvas — zona de upload de arquivos git.
 *
 * Quando o usuário não consegue conectar o repo local no navegador (File
 * System Access API limitada) nem o GitHub (sem token), ele sobe arquivos
 * com dados de verdade do Git (log, reflog, stash, tags, tree, status, diff)
 * e o sistema constrói o canvas a partir deles.
 */
import { useCallback, useRef, useState } from "react";
import { Upload, FileText, Folder, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildProjectMapFromUpload, type GitUploadResult } from "@/lib/gitCanvas/gitUpload";

export interface GitUploadZoneProps {
  onParsed: (result: GitUploadResult) => void;
  onError?: (message: string) => void;
}

export function GitUploadZone({ onParsed, onError }: GitUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<GitUploadResult | null>(null);

  const readFiles = useCallback(async (files: FileList | File[]) => {
    setLoading(true);
    setLastResult(null);
    try {
      const inputs: { name: string; relativePath?: string; text: string }[] = [];
      for (const f of Array.from(files)) {
        // só lê arquivos pequenos e de texto
        if (f.size > 5 * 1024 * 1024) continue; // pula > 5MB
        const text = await f.text();
        // webkitRelativePath quando vem de pasta; senão só o nome
        const relativePath = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
        inputs.push({ name: f.name, relativePath, text });
      }
      if (inputs.length === 0) {
        onError?.("Nenhum arquivo de texto válido encontrado (máx. 5MB cada).");
        return;
      }
      const result = buildProjectMapFromUpload(inputs);
      setLastResult(result);
      if (result.filesRead === 0) {
        onError?.("Nenhum arquivo git reconhecido. Envie saídas de `git log`, `git reflog`, etc.");
        return;
      }
      onParsed(result);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Erro ao ler arquivos.");
    } finally {
      setLoading(false);
    }
  }, [onParsed, onError]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) readFiles(e.dataTransfer.files);
  }, [readFiles]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <Card className="border-dashed border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Upload className="h-5 w-5" />
          Enviar arquivos do Git
        </CardTitle>
        <CardDescription>
          Não conseguiu conectar o repositório local ou o GitHub? Suba arquivos com dados reais
          do seu Git e o canvas é gerado a partir deles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center hover:border-primary/50 transition-colors"
        >
          <p className="text-sm text-muted-foreground mb-3">
            Arraste arquivos aqui, ou escolha uma opção:
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              <FileText className="mr-2 h-4 w-4" />
              Arquivos (.txt, .json, .log)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => dirInputRef.current?.click()}
              disabled={loading}
            >
              <Folder className="mr-2 h-4 w-4" />
              Pasta do repositório
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.json,.log,.out"
            className="hidden"
            onChange={(e) => e.target.files && readFiles(e.target.files)}
          />
          <input
            ref={dirInputRef}
            type="file"
            // @ts-expect-error — webkitdirectory é suportado em todos os browsers modernos
            webkitdirectory="true"
            className="hidden"
            onChange={(e) => e.target.files && readFiles(e.target.files)}
          />
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Como gerar os arquivos (no terminal do seu repo):</p>
          <pre className="bg-muted p-2 rounded text-[11px] overflow-x-auto">
{`git log --format="%H|%P|%an|%aI|%s" --numstat --all > git-log.txt
git reflog > git-reflog.txt
git stash list > git-stash.txt
git tag --list > git-tags.txt
git ls-tree -r HEAD --long > git-tree.txt
git status --porcelain > git-status.txt
git diff --shortstat > git-diff.txt`}
          </pre>
        </div>

        {lastResult && (
          <div className="rounded-lg bg-muted p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>
                <strong>{lastResult.name}</strong>: {lastResult.filesRead} arquivo(s) lidos
                {lastResult.commits.length > 0 && `, ${lastResult.commits.length} commits`}
                {lastResult.branches.length > 0 && `, ${lastResult.branches.length} branches`}
              </span>
            </div>
            {lastResult.gaps.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Faltando: {lastResult.gaps.join(", ")}. O canvas mostrará só o que foi enviado.
                </span>
              </div>
            )}
            {lastResult.issues.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {lastResult.issues.length} arquivo(s) não reconhecido(s).
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
