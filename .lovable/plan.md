

## Problem

The "No camera found" error occurs because `BrowserMultiFormatReader.listVideoInputDevices()` often returns empty results until the browser has been granted camera permission via `getUserMedia`. The current code lists devices first (which fails), then never gets to request permission.

Additionally, the Lovable preview iframe may not have the `camera` permission policy enabled — testing on the published URL or a native device will work better.

## Fix

Refactor `BarcodeScanner.tsx` to skip device enumeration and instead use `decodeFromConstraints` with `facingMode: { ideal: 'environment' }`. This triggers the browser's camera permission prompt directly and selects the back camera automatically.

### Changes

**`src/components/BarcodeScanner.tsx`**
- Replace the `listVideoInputDevices` + `decodeFromVideoDevice` flow with a single `decodeFromConstraints` call:
  ```ts
  await reader.decodeFromConstraints(
    { video: { facingMode: { ideal: "environment" } } },
    videoRef.current!,
    (result) => { ... }
  );
  ```
- Remove the device listing logic entirely
- This triggers the native camera permission prompt and works without prior enumeration

No other files need changes.

## Note for testing

The preview iframe may block camera access. To test properly, publish the app or open the preview URL directly in a new browser tab.

