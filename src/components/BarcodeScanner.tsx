import { useEffect, useRef, useState } from "react";
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
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [scanKey, setScanKey] = useState(0);

  // Increment scanKey each time modal opens to force fresh DOM element
  useEffect(() => {
    if (open) {
      setScanKey((k) => k + 1);
    }
  }, [open]);

  // Initialize scanner when scanKey changes and modal is open
  useEffect(() => {
    if (!open || scanKey === 0) return;

    let cancelled = false;

    const startScanner = async () => {
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;

      const instance = new Html5Qrcode("barcode-reader");
      html5QrCodeRef.current = instance;

      try {
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          async (decodedText) => {
            try {
              await instance.stop();
              instance.clear();
            } catch (e) {
              console.warn("Scanner stop error on scan:", e);
            }
            html5QrCodeRef.current = null;
            onScan(decodedText);
            onClose();
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
      const ref = html5QrCodeRef.current;
      if (ref) {
        (async () => {
          try {
            if (ref.isScanning) {
              await ref.stop();
            }
            ref.clear();
          } catch (e) {
            console.warn("Scanner cleanup error:", e);
          }
        })();
        html5QrCodeRef.current = null;
      }
    };
  }, [scanKey, open]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-sm p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-4 h-4" /> Scan Barcode
          </DialogTitle>
        </DialogHeader>

        <div id="barcode-reader" key={scanKey} style={{ minHeight: "250px" }} className="w-full" />

        <div className="p-4 pt-2">
          <Button variant="outline" className="w-full" onClick={onClose}>
            <X className="w-4 h-4 mr-2" /> Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
