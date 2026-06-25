import { createFileRoute } from "@tanstack/react-router";
import { ScanLine, QrCode, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusPill, statusToTone } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { scanEvents } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/scanning")({
  head: () => ({
    meta: [{ title: "Scan tracking — FlowOps" }, { name: "description", content: "Barcode and QR scan audit trail across stations." }],
  }),
  component: ScanningPage,
});

function ScanningPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("scanning.title")}
        description={t("scanning.description")}
        actions={
          <>
            <Button variant="outline" size="sm">{t("common.exportLog")}</Button>
            <Button size="sm" disabled>{t("scanning.connectScanner")}</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("scanning.kpis.scansToday")} value="3,182" delta={4} hint={t("scanning.kpis.scansHint")} icon={<ScanLine className="h-4 w-4" />} />
        <StatCard label={t("scanning.kpis.matchRate")} value="98.4%" delta={1} hint={t("scanning.kpis.matchHint")} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label={t("scanning.kpis.mismatches")} value="22" delta={-12} hint={t("scanning.kpis.mismatchHint")} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label={t("scanning.kpis.activeStations")} value="6 / 8" hint={t("scanning.kpis.stationHint")} icon={<QrCode className="h-4 w-4" />} />
      </div>

      <div className="rounded-lg border bg-info/10 p-4 text-sm flex items-start gap-3">
        <QrCode className="h-4 w-4 mt-0.5 text-info" />
        <div>
          <div className="font-medium text-foreground">{t("scanning.notice.title")}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {t("scanning.notice.body")}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{t("scanning.recent")}</h3>
          <span className="text-xs text-muted-foreground">{t("common.updatedJustNow")}</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("scanning.columns.time")}</TableHead>
                <TableHead>{t("scanning.columns.type")}</TableHead>
                <TableHead>{t("scanning.columns.code")}</TableHead>
                <TableHead>{t("scanning.columns.order")}</TableHead>
                <TableHead>{t("scanning.columns.station")}</TableHead>
                <TableHead>{t("scanning.columns.scannedBy")}</TableHead>
                <TableHead className="text-right">{t("scanning.columns.result")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scanEvents.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{s.timestamp}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      {s.type === "qr" ? <QrCode className="h-3.5 w-3.5" /> : <ScanLine className="h-3.5 w-3.5" />}
                      {s.type.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.code}</TableCell>
                  <TableCell className="font-mono text-xs">{s.order}</TableCell>
                  <TableCell className="text-sm">{s.station}</TableCell>
                  <TableCell>{s.scannedBy}</TableCell>
                  <TableCell className="text-right">
                    <StatusPill tone={statusToTone(s.result)}>{s.result}</StatusPill>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
