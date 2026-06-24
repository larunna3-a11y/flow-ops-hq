import { createFileRoute } from "@tanstack/react-router";
import { ScanLine, QrCode, AlertTriangle, CheckCircle2 } from "lucide-react";
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
  return (
    <div className="space-y-6">
      <PageHeader
        title="Barcode & QR scan tracking"
        description="Every scan across pack stations and returns bays, fully audited."
        actions={
          <>
            <Button variant="outline" size="sm">Export log</Button>
            <Button size="sm" disabled>Connect scanner</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Scans today" value="3,182" delta={4} hint="Barcodes + QR" icon={<ScanLine className="h-4 w-4" />} />
        <StatCard label="Match rate" value="98.4%" delta={1} hint="Last 24h" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Mismatches" value="22" delta={-12} hint="Awaiting review" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Active stations" value="6 / 8" hint="2 offline" icon={<QrCode className="h-4 w-4" />} />
      </div>

      <div className="rounded-lg border bg-info/10 p-4 text-sm flex items-start gap-3">
        <QrCode className="h-4 w-4 mt-0.5 text-info" />
        <div>
          <div className="font-medium text-foreground">Scanner hardware not connected yet</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            This module shows the audit trail UI. Live barcode capture will be enabled in the next release.
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Recent scans</h3>
          <span className="text-xs text-muted-foreground">Updated just now</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Station</TableHead>
                <TableHead>Scanned by</TableHead>
                <TableHead className="text-right">Result</TableHead>
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
