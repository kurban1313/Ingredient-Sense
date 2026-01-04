import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import type { AnalysisResult, AnalysisCard, IngredientAnalysis } from "@/services/aiReasoning";
import { X, Check, AlertTriangle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnalysisResultProps {
    result: AnalysisResult | null;
    onDismiss: () => void;
}

const AnalysisResultView = ({ result, onDismiss }: AnalysisResultProps) => {
    if (!result) return null;

    const getRiskColor = (level: string) => {
        switch (level) {
            case 'safe': return 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]';
            case 'danger': return 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]';
            case 'caution': return 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]';
            default: return 'bg-gray-500';
        }
    };

    return (
        <AnimatePresence>
            {result && (
                <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="fixed inset-x-0 bottom-0 z-50 h-[85vh] rounded-t-[32px] bg-zinc-950/95 backdrop-blur-md border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col"
                    style={{ willChange: 'transform' }}
                >
                    <div className="w-full flex justify-center pt-4 pb-2" onClick={onDismiss}>
                        <div className="w-16 h-1.5 rounded-full bg-white/10" />
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 pt-2 no-scrollbar">
                        {/* Header Section */}
                        <div className="flex flex-col items-center mb-8">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className={cn("w-32 h-32 mb-6 rounded-full flex items-center justify-center relative border-4 border-white/10",
                                    result.riskLevel === 'safe' ? "bg-green-500/20 text-green-400 border-green-500/50" :
                                        result.riskLevel === 'caution' ? "bg-amber-500/20 text-amber-400 border-amber-500/50" :
                                            "bg-red-500/20 text-red-500 border-red-500/50"
                                )}
                            >
                                <div className={cn("absolute inset-0 rounded-full blur-2xl opacity-40",
                                    result.riskLevel === 'safe' ? "bg-green-500" :
                                        result.riskLevel === 'caution' ? "bg-amber-500" : "bg-red-500")}
                                />

                                <div className="z-10 transform scale-150">
                                    {result.riskLevel === 'safe' && <Check size={48} strokeWidth={3} />}
                                    {result.riskLevel === 'caution' && <span className="text-5xl font-black">!</span>}
                                    {result.riskLevel === 'danger' && <X size={48} strokeWidth={3} />}
                                </div>
                            </motion.div>

                            <h1 className="text-3xl font-bold text-white text-center leading-tight mb-2 max-w-xs">
                                {result.productName}
                            </h1>
                            <div
                                className={cn("px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-white/90 shadow-lg border border-white/20", getRiskColor(result.riskLevel))}
                            >
                                {result.riskLevel === 'safe' ? 'Generally Safe' : result.riskLevel.toUpperCase()}
                            </div>
                        </div>

                        <div className="flex justify-end absolute top-6 right-6">
                            <button onClick={onDismiss} className="p-2 text-white/50 hover:text-white bg-white/5 rounded-full transition">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Summary */}
                        <div className="bg-white/5 border border-white/5 p-5 rounded-3xl mb-8">
                            <p className="text-lg text-white/80 font-medium leading-relaxed">
                                {result.summary}
                            </p>
                        </div>

                        {/* Warning Summary */}
                        {result.warningSummary && result.warningSummary.length > 0 && (
                            <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-3xl mb-8">
                                <div className="flex items-center gap-3 mb-3">
                                    <AlertTriangle className="text-red-500 w-5 h-5" />
                                    <h3 className="text-sm font-bold text-red-400 uppercase tracking-widest">
                                        Health Concerns
                                    </h3>
                                </div>
                                <ul className="list-disc pl-4 space-y-2 text-red-200/80 text-sm">
                                    {result.warningSummary.map((warning, i) => (
                                        <li key={i} className="leading-snug">{warning}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Interactive Ingredients Analysis */}
                        {result.detailedIngredients && result.detailedIngredients.length > 0 && (
                            <div className="mb-24">
                                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 pl-1">
                                    Detailed Analysis ({result.detailedIngredients.length})
                                </h3>
                                <div className="space-y-3">
                                    {result.detailedIngredients.map((ing, i) => (
                                        <IngredientRow key={i} ingredient={ing} />
                                    ))}
                                </div>
                            </div>
                        )}


                    </div>

                    {/* Action Bar */}
                    <div className="p-6 pt-4 bg-zinc-950 border-t border-white/5 shrink-0">
                        <button
                            onClick={onDismiss}
                            className="w-full h-14 rounded-2xl bg-white text-black font-bold text-lg shadow-lg active:scale-95 transition-transform"
                        >
                            Done
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

const IngredientRow = ({ ingredient }: { ingredient: IngredientAnalysis }) => {
    const [expanded, setExpanded] = useState(false);

    const getDotColor = (risk: string) => {
        switch (risk) {
            case 'safe': return 'bg-green-500';
            case 'caution': return 'bg-amber-500';
            case 'danger': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    return (
        <div
            onClick={() => setExpanded(!expanded)}
            className={cn(
                "rounded-2xl border border-white/5 overflow-hidden transition-all duration-300",
                expanded ? "bg-white/10 ring-1 ring-white/20" : "bg-white/5"
            )}
        >
            <div className="flex items-center p-4 gap-4 cursor-pointer">
                <div className={cn("w-3 h-3 rounded-full shrink-0 shadow-lg", getDotColor(ingredient.risk))} />
                <div className="flex-1">
                    <span className="font-bold text-white text-lg block">{ingredient.name}</span>
                    {!expanded && ingredient.commonName && ingredient.commonName !== ingredient.name && (
                        <span className="text-xs text-white/50 block">{ingredient.commonName}</span>
                    )}
                </div>
                <div className="text-white/50">
                    {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-4 pb-4 pt-0 text-white/80 text-sm space-y-3 border-t border-white/5"
                    >
                        <div className="pt-2">
                            {ingredient.commonName && ingredient.commonName !== ingredient.name && (
                                <div className="mb-2">
                                    <span className="text-xs font-bold text-white/40 uppercase block mb-0.5">Common Name</span>
                                    <span className="text-white font-medium">{ingredient.commonName}</span>
                                </div>
                            )}

                            <div className="mb-2">
                                <span className="text-xs font-bold text-white/40 uppercase block mb-0.5">What is it?</span>
                                <span>{ingredient.explanation}</span>
                            </div>

                            <div>
                                <span className="text-xs font-bold text-white/40 uppercase block mb-0.5">Health Impact</span>
                                <span className={cn(
                                    ingredient.risk === 'danger' ? "text-red-300" :
                                        ingredient.risk === 'caution' ? "text-amber-300" : "text-green-300"
                                )}>
                                    {ingredient.healthImpact}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AnalysisResultView;
