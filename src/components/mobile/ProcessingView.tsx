import { motion } from "framer-motion";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import type { PipelineStage } from "@/services/aiReasoning";

interface ProcessingViewProps {
    stage: PipelineStage;
    onRetry: () => void;
    onCancel: () => void;
    error: string | null;
}

const ProcessingView = ({ stage, onRetry, onCancel, error }: ProcessingViewProps) => {

    // Derived text based on stage
    const getStatusInfo = () => {
        switch (stage) {
            case 'identifying':
                return { title: 'Applying Vision', desc: 'Is this a barcode or ingredients?' };
            case 'looking_up':
                return { title: 'Checking Database', desc: 'Searching 3M+ products...' };
            case 'extracting':
                return { title: 'Reading Text', desc: 'Extracting ingredients from image...' };
            case 'analyzing':
                return { title: 'Dr. AI is Thinking', desc: 'Analyzing health impact...' };
            default:
                return { title: 'Processing', desc: 'Please wait...' };
        }
    };

    const status = getStatusInfo();

    if (error) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center"
            >
                <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                    <AlertTriangle className="w-10 h-10 text-red-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Analysis Failed</h3>
                <p className="text-white/60 mb-8 max-w-xs">{error}</p>

                <div className="flex gap-4 w-full max-w-xs">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-4 rounded-xl bg-white/5 text-white font-medium hover:bg-white/10 active:scale-95 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onRetry}
                        className="flex-1 py-4 rounded-xl bg-white text-black font-bold hover:bg-gray-100 active:scale-95 transition flex items-center justify-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Retry
                    </button>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center"
        >
            <div className="relative">
                {/* Pulse Rings */}
                <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 rounded-full bg-green-500/20 blur-xl"
                />
                <div className="relative w-24 h-24 rounded-full bg-black border border-white/10 flex items-center justify-center shadow-2xl">
                    <Loader2 className="w-10 h-10 text-green-400 animate-spin" />
                </div>
            </div>

            <h3 className="mt-8 text-2xl font-bold text-white tracking-tight">
                {status.title}
            </h3>
            <p className="mt-2 text-white/50 text-sm font-medium tracking-wide">
                {status.desc}
            </p>

            {/* Progress Dots */}
            <div className="flex gap-2 mt-8">
                {['identifying', 'extracting', 'analyzing'].map((s, i) => (
                    <motion.div
                        key={s}
                        animate={{
                            scale: stage === s || (stage === 'looking_up' && i === 0) ? 1.5 : 1,
                            opacity: stage === s || (stage === 'looking_up' && i === 0) ? 1 : 0.3,
                            backgroundColor: stage === s || (stage === 'looking_up' && i === 0) ? "#4ade80" : "#FFFFFF"
                        }}
                        className="w-2 h-2 rounded-full"
                    />
                ))}
            </div>
        </motion.div>
    );
};

export default ProcessingView;
