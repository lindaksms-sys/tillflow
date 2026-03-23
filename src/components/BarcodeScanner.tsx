import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScanLine, X, Flashlight, FlashlightOff, Keyboard } from "lucide-react";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export default function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [scanKey, setScanKey] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    if (open) {
      setScanKey((k) => k + 1);
      setManualEntry(false);
      setManualCode("");
      setTorchOn(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || scanKey === 0) return;

    let cancelled = false;

    const startScanner = async () => {
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;

      const instance = new Html5Qrcode("barcode-reader", {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false,
      });
      html5QrCodeRef.current = instance;

      try {
        await instance.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: { width: 300, height: 80 },
            aspectRatio: 1.5,
          } as any,
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

        // Check torch support
        try {
          const track = instance.getRunningTrackCameraCapabilities?.();
          if (track?.torchFeature?.()?.isSupported?.()) {
            setTorchSupported(true);
          }
        } catch {
          // Try alternative method
          try {
            const settings = (instance as any)?.getRunningTrackSettings?.();
            if (settings && "torch" in settings) {
              setTorchSupported(true);
            }
          } catch {
            setTorchSupported(false);
          }
        }
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
            if (ref.isScanning) await ref.stop();
            ref.clear();
          } catch (e) {
            console.warn("Scanner cleanup error:", e);
          }
        })();
        html5QrCodeRef.current = null;
      }
    };
  }, [scanKey, open]);

  const toggleTorch = async () => {
    const instance = html5QrCodeRef.current;
    if (!instance) return;
    try {
      const track = instance.getRunningTrackCameraCapabilities?.();
      const torch = track?.torchFeature?.();
      if (torch) {
        await torch.apply(!torchOn);
        setTorchOn(!torchOn);
      }
    } catch (e) {
      console.warn("Torch toggle error:", e);
    }
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (code) {
      onScan(code);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-sm p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="w-4 h-4" /> Scan Barcode
            </DialogTitle>
            {torchSupported && (
              <Button variant="ghost" size="icon" onClick={toggleTorch} className="h-8 w-8">
                {torchOn ? (
                  <Flashlight className="w-4 h-4 text-yellow-400" />
                ) : (
                  <FlashlightOff className="w-4 h-4 text-muted-foreground" />
                )}
              </Button>
            )}
          </div>
        </DialogHeader>

        <div id="barcode-reader" key={scanKey} style={{ minHeight: "250px" }} className="w-full" />

        <div className="px-4 py-2 space-y-2">
          <p className="text-[11px] text-muted-foreground text-center leading-snug">
            💡 Dry the label, hold steady 15–20cm away, align bottom of label with the green box
          </p>

          {!manualEntry ? (
            <button
              onClick={() => setManualEntry(true)}
              className="w-full text-xs text-primary hover:text-primary/80 flex items-center justify-center gap-1.5 py-1.5 transition-colors"
            >
              <Keyboard className="w-3.5 h-3.5" />
              Can't scan? Enter barcode manually
            </button>
          ) : (
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Enter barcode number"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                className="text-sm"
                autoFocus
              />
              <Button size="sm" onClick={handleManualSubmit} disabled={!manualCode.trim()}>
                Go
              </Button>
            </div>
          )}
        </div>

        <div className="p-4 pt-1">
          <Button variant="outline" className="w-full" onClick={onClose}>
            <X className="w-4 h-4 mr-2" /> Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
