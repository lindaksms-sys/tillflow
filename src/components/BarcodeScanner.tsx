import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScanLine, X } from "lucide-react";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export default function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const startScanner = async () => {
      // Small delay to ensure the DOM element is mounted
      await new Promise((r) => setTimeout(r, 300));
      if (cancelled) return;

      const html5QrCode = new Html5Qrcode("barcode-reader");
      scannerRef.current = html5QrCode;

      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            if (isScanningRef.current) return;
            isScanningRef.current = true;
            onScan(decodedText);
            html5QrCode.stop().then(() => {
              scannerRef.current = null;
              isScanningRef.current = false;
              onClose();
            });
          },
          undefined
        );
      } catch (err) {
        console.error("Scanner start error:", err);
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      isScanningRef.current = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-sm p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-4 h-4" /> Scan Barcode
          </DialogTitle>
        </DialogHeader>

        <div id="barcode-reader" className="min-h-64 w-full" />

        <div className="p-4 pt-2">
          <Button variant="outline" className="w-full" onClick={onClose}>
            <X className="w-4 h-4 mr-2" /> Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
