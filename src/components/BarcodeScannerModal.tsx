import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, ScanLine, AlertCircle, ArrowRight } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (foodQuery: string) => void;
}

const DEMO_BARCODES = [
  { code: '041196910759', name: 'Chobani Greek Yogurt Plain Non-Fat' },
  { code: '030000010204', name: 'Quaker Rolled Oats' },
  { code: '025293600270', name: 'Silk Unsweetened Almond Milk' },
  { code: '850005753001', name: 'Pure Protein Chocolate Deluxe Bar' },
  { code: '051500255162', name: 'Jif Natural Creamy Peanut Butter' }
];

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({ isOpen, onClose, onDetected }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    let activeStream: MediaStream | null = null;
    async function startCamera() {
      try {
        setCameraError(null);
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        activeStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }

        // Check if BarcodeDetector is supported
        if ('BarcodeDetector' in window) {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code', 'code_128']
          });

          const interval = setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState === 4) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  const rawVal = barcodes[0].rawValue;
                  clearInterval(interval);
                  handleBarcodeFound(rawVal);
                }
              } catch (e) {
                // frame processing
              }
            }
          }, 400);

          return () => clearInterval(interval);
        }
      } catch (err: any) {
        setCameraError('Camera access unavailable. You can enter or select a barcode below.');
      }
    }

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen]);

  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    onClose();
  };

  const handleBarcodeFound = (code: string) => {
    const match = DEMO_BARCODES.find(b => b.code === code);
    const query = match ? match.name : `UPC ${code}`;
    handleClose();
    onDetected(query);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleBarcodeFound(manualCode.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl relative flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-teal-400" />
            <span className="text-sm font-semibold text-zinc-100">Barcode Scanner</span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100"
            aria-label="Close scanner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera Viewfinder */}
        <div className="my-4 relative bg-zinc-950 rounded-xl overflow-hidden aspect-video border border-zinc-800 flex items-center justify-center">
          {cameraError ? (
            <div className="p-4 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
              <AlertCircle className="w-6 h-6 text-zinc-500" />
              <span>{cameraError}</span>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              <div className="absolute inset-4 border-2 border-teal-400/60 rounded-lg pointer-events-none flex items-center justify-center">
                <div className="w-full h-0.5 bg-teal-400/80 animate-pulse shadow-sm shadow-teal-400" />
              </div>
            </>
          )}
        </div>

        {/* Manual Barcode Input */}
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <div className="relative">
            <ScanLine className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Or enter barcode numbers..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-12 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 px-2.5 py-1 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold text-xs rounded-lg flex items-center gap-1 transition-colors"
            >
              Scan
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </form>

        {/* Test Barcode Quick Select */}
        <div className="mt-4 pt-3 border-t border-zinc-800">
          <span className="text-[11px] font-medium text-zinc-400 block mb-2">
            Sample Product Barcodes:
          </span>
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {DEMO_BARCODES.map((item) => (
              <button
                key={item.code}
                onClick={() => handleBarcodeFound(item.code)}
                className="w-full text-left p-2 rounded-lg bg-zinc-950/60 hover:bg-zinc-800/80 border border-zinc-800 text-[11px] text-zinc-300 flex items-center justify-between transition-colors"
              >
                <span className="truncate pr-2">{item.name}</span>
                <span className="font-mono text-[10px] text-teal-400 shrink-0">{item.code}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
