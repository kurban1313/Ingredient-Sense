import { useState, useRef, useCallback, useEffect } from "react";
// Removed Webcam import as we use Native Camera
import { SwitchCamera, Zap, ZapOff, Sun, Clock, MessageCircle, Camera as CameraIcon, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { analyzeIngredients, type AnalysisResult, type PipelineStage } from "@/services/aiReasoning";
import AnalysisResultView from "./AnalysisResult";
import ProcessingView from "./ProcessingView";
import { cn } from "@/lib/utils";
import { BarcodeScanner, BarcodeFormat, LensFacing, type BarcodesScannedEvent } from '@capacitor-mlkit/barcode-scanning';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';
import { App } from '@capacitor/app';
import type { ScanMode } from "@/services/visionService";
import Logo from "../ui/Logo";
import HistoryView from "./HistoryView";
import ChatView from "./ChatView";
import { saveScan } from "@/services/historyService";

// SAFE DEFAULT: Use standard resolution (Only for Ingredients Mode / Webcam)
const videoConstraints = {
    facingMode: "environment"
};

const CameraView = () => {
    // -------------------------------------------------------------------------
    // STATE
    // -------------------------------------------------------------------------
    // No webcamRef needed anymore
    const webcamRef = useRef<any>(null);
    const [pipelineStage, setPipelineStage] = useState<PipelineStage>('idle');
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

    // Camera State
    const [lensFacing, setLensFacing] = useState<LensFacing>(LensFacing.Back);
    const [error, setError] = useState<string | null>(null);
    const [scanMode, setScanMode] = useState<ScanMode>('barcode');

    // Scanner State
    const [isNativeScanning, setIsNativeScanning] = useState(false);
    const lastScanTime = useRef<number>(0);

    // Feature State
    const [showHistory, setShowHistory] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [showCameraMenu, setShowCameraMenu] = useState(false);

    // Flash State (For Ingredients Mode)
    const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
    const [showFlashMenu, setShowFlashMenu] = useState(false);
    const [isTorchOn, setIsTorchOn] = useState(false);

    // -------------------------------------------------------------------------
    // HELPERS
    // -------------------------------------------------------------------------

    const getStatusText = () => {
        if (pipelineStage !== 'idle') return 'Processing...';
        return scanMode === 'barcode' ? 'Scanning...' : 'Ready to Capture';
    };

    const toggleCamera = () => {
        setLensFacing(prev => prev === LensFacing.Back ? LensFacing.Front : LensFacing.Back);
    };

    // -------------------------------------------------------------------------
    // NATIVE SCANNER LOGIC (Barcode Mode)
    // -------------------------------------------------------------------------

    const startNativeScan = async () => {
        try {
            // Check Permissions
            const status = await BarcodeScanner.checkPermissions();
            if (status.camera !== 'granted') {
                const requested = await BarcodeScanner.requestPermissions();
                if (requested.camera !== 'granted') {
                    setError("Camera permission denied");
                    return;
                }
            }

            // Transparency
            document.body.style.backgroundColor = "transparent";
            document.documentElement.style.backgroundColor = "transparent"; // Ensure hierarchy is clear
            setIsNativeScanning(true);

            // Start Scanner
            await BarcodeScanner.startScan({
                formats: [BarcodeFormat.UpcA, BarcodeFormat.UpcE, BarcodeFormat.Ean13, BarcodeFormat.QrCode, BarcodeFormat.Code128],
                lensFacing: lensFacing
            });

            // Listen
            await BarcodeScanner.removeAllListeners(); // Safety clear
            await BarcodeScanner.addListener('barcodesScanned', async (result: BarcodesScannedEvent) => {
                const now = Date.now();
                // DEBOUNCE: 1.5s
                if (now - lastScanTime.current < 1500) return;

                if (result.barcodes.length > 0 && result.barcodes[0].rawValue) {
                    lastScanTime.current = now;
                    handleSmartCapture(undefined, result.barcodes[0].rawValue);
                }
            });

        } catch (err: any) {
            console.error("Scanner Failed", err);
            setError("Scanner Error: " + (err.message || err));
            setIsNativeScanning(false);
        }
    };

    const stopNativeScan = async () => {
        try {
            await BarcodeScanner.removeAllListeners();
            await BarcodeScanner.stopScan();
            document.body.style.backgroundColor = "";
            document.documentElement.style.backgroundColor = "";
            setIsNativeScanning(false);
        } catch (e) { /* ignore */ }
    };

    // Toggle Scanner based on Mode & Lens
    useEffect(() => {
        const manageScanner = async () => {
            if (scanMode === 'barcode' && !analysisResult && !showHistory && !showChat) {
                // If already scanning, stop first to switch lens
                await stopNativeScan();
                // Short timeout to ensure stop finishes? Await should handle it.
                await startNativeScan();
            } else {
                await stopNativeScan();
            }
        };
        manageScanner();

        return () => { stopNativeScan(); };
    }, [scanMode, analysisResult, showHistory, showChat, lensFacing]);

    // Cleanup on unmount
    useEffect(() => {
        return () => { stopNativeScan(); };
    }, []);


    // -------------------------------------------------------------------------
    // WEBCAM LOGIC (Ingredients Mode - NOW NATIVE CAMERA)
    // -------------------------------------------------------------------------

    // Flash Logic (Ingredients Mode Only - Native Scanner manages its own flash usually, or we use enableTorch)
    const applyTorch = async (on: boolean) => {
        if (scanMode === 'barcode' && lensFacing === LensFacing.Back) {
            try {
                if (on) await BarcodeScanner.enableTorch();
                else await BarcodeScanner.disableTorch();
                setIsTorchOn(on);
            } catch (e) { }
            return;
        }
        // Native Camera handles flash in its own UI usually.
    };

    useEffect(() => {
        applyTorch(flashMode === 'on');
    }, [flashMode, scanMode, lensFacing]);


    // -------------------------------------------------------------------------
    // CAPTURE PIPELINE
    // -------------------------------------------------------------------------

    const handleSmartCapture = async (forceImage?: string, barcodeValue?: string) => {
        if (pipelineStage !== 'idle') return;

        try {
            // Stop scanning logic if active
            if (barcodeValue) {
                await stopNativeScan(); // Freeze UI
            }

            // Capture logic
            let imageSrc = forceImage;

            // Native Capture for Ingredients
            if (scanMode === 'ingredients' && !imageSrc && !barcodeValue) {
                try {
                    const photo = await Camera.getPhoto({
                        quality: 90,
                        allowEditing: false,
                        resultType: CameraResultType.Base64,
                        source: CameraSource.Camera,
                        direction: lensFacing === LensFacing.Front ? CameraDirection.Front : CameraDirection.Rear
                    });

                    if (photo.base64String) {
                        // Fix formatting for Vision Service
                        imageSrc = `data:image/${photo.format};base64,${photo.base64String}`;
                        // DIRECT PROCESSING (No Crop)
                    } else {
                        // Canceled or failed
                        return;
                    }
                } catch (cameraErr) {
                    console.log("User cancelled camera or failed", cameraErr);
                    return; // Exit
                }
            }

            // (This part runs for barcodes OR if we passed forceImage aka cropped)
            processImage(imageSrc || null, barcodeValue);

        } catch (err: any) {
            console.error("Analysis Failed", err);
            setError(err.message || "Failed to analyze");
            setPipelineStage('idle');
            // Resume scan if needed
            if (scanMode === 'barcode' && !barcodeValue) startNativeScan();
        }
    };

    // Actual Logic after Capture/Crop
    const processImage = async (imageSrc: string | null, barcodeValue?: string) => {
        setAnalysisResult(null);

        // If barcode, stage is handled inside analyzeIngredients usually but we can set identifying here
        if (barcodeValue) setPipelineStage('identifying');
        else setPipelineStage('extracting');

        try {
            const result = await analyzeIngredients(
                imageSrc,
                scanMode,
                setPipelineStage,
                barcodeValue
            );

            setAnalysisResult(result);
            saveScan(result);
            setPipelineStage('idle');
        } catch (err: any) {
            console.error("Analysis Failed", err);
            setError(err.message || "Failed to analyze");
            setPipelineStage('idle');
            if (scanMode === 'barcode' && !barcodeValue) startNativeScan();
        }
    };

    // Gallery Handler
    const handleGalleryPick = async () => {
        try {
            const photo = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.Base64,
                source: CameraSource.Photos, // GALLERY SOURCE
            });

            if (photo.base64String) {
                const imageSrc = `data:image/${photo.format};base64,${photo.base64String}`;
                processImage(imageSrc); // DIRECT PROCESSING
            }
        } catch (e) {
            console.log("Gallery cancelled");
        }
    };

    // -------------------------------------------------------------------------
    // RENDER UI
    // -------------------------------------------------------------------------

    return (
        <div className={cn("relative h-screen w-full overflow-hidden flex flex-col", isNativeScanning ? "bg-transparent" : "bg-black")}>

            {/* 1. CAMERA LAYERS */}

            {/* A. Barcode Mode: Transparent background to show Native Scanner */}

            {/* B. Ingredients Mode: Placeholder / Prompt to Open Camera */}
            {scanMode === 'ingredients' && (
                <div className="absolute inset-0 z-0 flex flex-col items-center justify-center bg-zinc-900 text-white p-6 text-center">
                    <CameraIcon size={64} className="text-zinc-700 mb-4" />
                    <h3 className="text-xl font-bold mb-2">Detailed Analysis</h3>
                    <p className="text-zinc-400">Tap the shutter button to take a photo of the ingredients list.</p>
                </div>
            )}


            {/* 2. OVERLAYS */}
            <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
                {/* Barcode Guide Overlay */}
                {scanMode === 'barcode' && !analysisResult && (
                    <div className="relative w-full h-full flex flex-col items-center justify-center bg-black/30">
                        <div className="relative w-72 h-48 rounded-2xl ring-1 ring-white/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] overflow-hidden">
                            {/* Scanning Laser */}
                            <motion.div
                                animate={{ top: ["0%", "100%", "0%"] }}
                                transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                                className="absolute left-0 right-0 h-0.5 bg-green-400 shadow-[0_0_15px_rgba(74,222,128,0.8)]"
                            />
                            {/* Corners */}
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />
                        </div>
                        <p className="mt-6 text-white/90 font-medium text-sm tracking-widest uppercase bg-black/40 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">
                            Align code within box
                        </p>
                    </div>
                )}
            </div>

            {/* 3. TOP CONTROLS */}
            <div className="absolute top-6 left-6 z-20">
                <Logo size="sm" className="drop-shadow-lg" />
            </div>

            <div className="absolute top-6 right-6 z-20 flex flex-col items-end gap-3">
                {/* Flash Button (Only for Barcode Mode now, as Native Camera has own UI) */}
                {scanMode === 'barcode' && (
                    <div className="relative">
                        <button
                            onClick={() => setShowFlashMenu(!showFlashMenu)}
                            className={cn(
                                "p-3 rounded-full backdrop-blur-md border transition active:scale-95",
                                flashMode === 'off' ? "bg-black/40 text-white border-white/10 hover:bg-black/60" : "bg-yellow-500/80 text-black border-yellow-400 font-bold"
                            )}
                        >
                            {flashMode === 'auto' ? <Sun size={24} /> : (flashMode === 'on' ? <Zap size={24} fill="currentColor" /> : <ZapOff size={24} />)}
                        </button>
                        {/* Flash Menu ... */}
                        <AnimatePresence>
                            {showFlashMenu && (
                                <motion.div
                                    initial={{ opacity: 0, x: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: 10, scale: 0.95 }}
                                    className="absolute top-0 right-14 flex gap-2 bg-black/60 backdrop-blur-md p-1 rounded-full border border-white/10"
                                >
                                    <button onClick={() => { setFlashMode('on'); setShowFlashMenu(false); }} className={cn("p-2 rounded-full", flashMode === 'on' ? "bg-white text-black" : "text-white")}><Zap size={20} /></button>
                                    <button onClick={() => { setFlashMode('off'); setShowFlashMenu(false); }} className={cn("p-2 rounded-full", flashMode === 'off' ? "bg-white text-black" : "text-white")}><ZapOff size={20} /></button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* Camera Switch Button */}
                <button
                    onClick={toggleCamera}
                    className="p-3 rounded-full bg-black/40 text-white backdrop-blur-md border border-white/10 hover:bg-black/60 transition active:scale-95"
                >
                    <SwitchCamera size={24} />
                </button>
            </div>

            {/* 4. BOTTOM DOCK */}
            <div className="absolute bottom-0 inset-x-0 z-20 pb-8 pt-24 bg-gradient-to-t from-black via-black/80 to-transparent">
                <div className="flex flex-col items-center gap-6">
                    {/* Mode Switcher */}
                    <div className="flex bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/5 pointer-events-auto">
                        <button onClick={() => setScanMode('barcode')} className={cn("px-5 py-2 rounded-full text-sm font-bold transition-all", scanMode === 'barcode' ? "bg-white text-black shadow-lg scale-105" : "text-white/60 hover:text-white")}>BARCODE</button>
                        <button onClick={() => setScanMode('ingredients')} className={cn("px-5 py-2 rounded-full text-sm font-bold transition-all", scanMode === 'ingredients' ? "bg-white text-black shadow-lg scale-105" : "text-white/60 hover:text-white")}>INGREDIENTS</button>
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center gap-8 pointer-events-auto">
                        <button onClick={() => setShowHistory(true)} className="p-4 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 text-white hover:bg-white/20 active:scale-95 transition"><Clock size={24} /></button>

                        {/* Shutter / Scan Button (Hidden in Barcode Mode as it Autos-cans) */}
                        {scanMode === 'ingredients' && (
                            <div className="flex items-center gap-6">
                                {/* Gallery Button (New) */}
                                <button onClick={handleGalleryPick} className="p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 active:scale-95 transition">
                                    <ImageIcon size={20} className="w-5 h-5" />
                                </button>

                                <button onClick={() => handleSmartCapture()} className="relative group active:scale-95 transition">
                                    <div className="absolute inset-0 bg-white/20 rounded-full blur-xl group-hover:bg-green-400/30 transition" />
                                    <div className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center relative z-10">
                                        <div className="w-16 h-16 rounded-full bg-white transition group-active:scale-90" />
                                    </div>
                                </button>
                            </div>
                        )}

                        <button onClick={() => setShowChat(true)} className="p-4 rounded-full bg-green-500 border border-green-400 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] active:scale-95 transition hover:bg-green-400"><MessageCircle size={24} /></button>
                    </div>
                </div>
            </div>

            {/* 5. MODALS & RESULTS */}

            <AnimatePresence>
                {(pipelineStage !== 'idle' || !!error) && (
                    <ProcessingView stage={pipelineStage} error={error} onRetry={() => { setError(null); setPipelineStage('idle'); }} onCancel={() => setPipelineStage('idle')} />
                )}
            </AnimatePresence>

            <AnalysisResultView result={analysisResult} onDismiss={() => { setAnalysisResult(null); }} />

            <HistoryView isOpen={showHistory} onClose={() => setShowHistory(false)} onSelectFn={(res) => { setAnalysisResult(res); setShowHistory(false); }} onChatWithItem={(res) => { setAnalysisResult(res); setShowChat(true); }} />

            <ChatView isOpen={showChat} onClose={() => setShowChat(false)} contextResult={analysisResult} />
        </div>
    );
};

export default CameraView;
