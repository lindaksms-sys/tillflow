import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScanLine, X } from "lucide-react";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export default function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    setError("");

    const start = async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        // Prefer back camera
        const backCam = devices.find(d => /back|rear|environment/i.test(d.label));
        const deviceId = backCam?.deviceId || devices[0]?.deviceId;

        if (!deviceId) {
          setError("No camera found");
          return;
        }

        await reader.decodeFromVideoDevice(deviceId, videoRef.current!, (result) => {
          if (result) {
            const code = result.getText();
            onScan(code);
            onClose();
          }
        });
      } catch (e: any) {
        setError(e.message || "Camera access denied");
      }
    };

    start();

    return () => {
      if (readerRef.current) {
        // Stop all tracks on the video element
        const stream = videoRef.current?.srcObject as MediaStream;
        stream?.getTracks().forEach(t => t.stop());
        readerRef.current = null;
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

        <div className="relative aspect-[4/3] bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
          {/* Scan overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-3/5 h-1/3 border-2 border-primary/60 rounded-lg" />
          </div>
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <p className="text-sm text-destructive text-center px-4">{error}</p>
            </div>
          )}
        </div>

        <div className="p-4 pt-2">
          <Button variant="outline" className="w-full" onClick={onClose}>
            <X className="w-4 h-4 mr-2" /> Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
