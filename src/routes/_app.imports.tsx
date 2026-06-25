import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill, statusToTone } from "@/components/status-pill";
import { useImports } from "@/lib/use-orders-data";

export const Route = createFileRoute("/_app/imports")({
  head: () => ({ meta: [{ title: "Sync History — FlowOps" }] }),
  component: ImportsPage,
});

function ImportsPage() {
  const { t } = useTranslation();
  const imports = useImports();

  return (
    <div className="space-y-6">
      <PageHeader title={t("imports.title")} description={t("imports.description")} />
      <div className="rounded-lg border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("imports.columns.time")}</TableHead>
              <TableHead>{t("imports.columns.importedBy")}</TableHead>
              <TableHead>{t("imports.columns.filename")}</TableHead>
              <TableHead className="text-right">{t("imports.columns.total")}</TableHead>
              <TableHead className="text-right">{t("imports.columns.success")}</TableHead>
              <TableHead className="text-right">{t("imports.columns.failed")}</TableHead>
              <TableHead className="text-right">{t("imports.columns.duplicates")}</TableHead>
              <TableHead>{t("imports.columns.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(imports.data ?? []).map((i) => (
              <TableRow key={i.id}>
                <TableCell className="text-xs">{new Date(i.created_at).toLocaleString()}</TableCell>
                <TableCell>{i.imported_by_name ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{i.filename ?? "—"}</TableCell>
                <TableCell className="text-right">{i.total_rows}</TableCell>
                <TableCell className="text-right text-success">{i.success_count}</TableCell>
                <TableCell className="text-right text-destructive">{i.failed_count}</TableCell>
                <TableCell className="text-right">{i.duplicate_count}</TableCell>
                <TableCell><StatusPill tone={statusToTone(i.status)}>{i.status}</StatusPill></TableCell>
              </TableRow>
            ))}
            {!(imports.data ?? []).length && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                  {t("imports.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
