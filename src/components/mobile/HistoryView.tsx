import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Trash2, Calendar, Edit2, MessageCircle, Check } from "lucide-react";
import { getHistory, clearHistory, updateHistoryItem, type ScanHistoryItem } from "@/services/historyService";

interface HistoryViewProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectFn: (result: any) => void;
    onChatWithItem: (result: any) => void;
}

const HistoryView = ({ isOpen, onClose, onSelectFn, onChatWithItem }: HistoryViewProps) => {
    const [history, setHistory] = useState<ScanHistoryItem[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [contextItem, setContextItem] = useState<ScanHistoryItem | null>(null);

    useEffect(() => {
        if (isOpen) {
            setHistory(getHistory());
            setEditingId(null);
        }
    }, [isOpen]);

    const handleClear = () => {
        if (confirm("Clear all history?")) {
            clearHistory();
            setHistory([]);
        }
    };

    const startEditing = () => {
        if (contextItem) {
            setEditingId(contextItem.id);
            setEditName(contextItem.result?.productName || "Unknown Product");
            setContextItem(null); // Close menu
        }
    };

    const saveEdit = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (editingId) {
            updateHistoryItem(id, { result: { productName: editName } });
            setHistory(getHistory()); // Refresh
            setEditingId(null);
        }
    };

    const handleAskAI = (e: React.MouseEvent, result: any) => {
        e.stopPropagation();
        onChatWithItem(result);
        onClose();
    };

    const formatDate = (ts: number) => {
        return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-md z-40"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: "-100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "-100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className="absolute inset-y-0 left-0 w-[85%] max-w-sm bg-zinc-950 border-r border-white/10 z-50 flex flex-col shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-zinc-950">
                            <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-green-500/10 text-green-400">
                                    <Calendar size={20} />
                                </div>
                                History
                            </h2>
                            <div className="flex gap-2">
                                {history.length > 0 && (
                                    <button onClick={handleClear} className="p-2 text-white/40 hover:text-red-400 transition hover:bg-red-500/10 rounded-full">
                                        <Trash2 size={20} />
                                    </button>
                                )}
                                <button onClick={onClose} className="p-2 text-white/60 hover:text-white transition rounded-full bg-white/5">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {history.length === 0 ? (
                                <div className="text-center py-20 text-white/30 flex flex-col items-center gap-4">
                                    <div className="p-4 rounded-full bg-white/5">
                                        <Search size={32} className="opacity-50" />
                                    </div>
                                    <p>No scans yet.</p>
                                </div>
                            ) : (
                                history.map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => onSelectFn(item.result)}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            setContextItem(item);
                                        }}
                                        className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl p-4 flex items-center gap-4 transition active:scale-[0.98] group relative select-none"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-black/50 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden font-bold text-lg text-white/30">
                                            {/* Try to show image if saved, else icon */}
                                            {item.result?.productName ? (
                                                item.result.productName[0].toUpperCase()
                                            ) : <Search size={20} />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            {editingId === item.id ? (
                                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        value={editName}
                                                        onChange={e => setEditName(e.target.value)}
                                                        className="bg-black text-white text-base rounded-lg px-3 py-2 w-full border border-green-500/50 outline-none shadow-[0_0_10px_rgba(74,222,128,0.3)]"
                                                        autoFocus
                                                    />
                                                    <button onClick={(e) => saveEdit(e, item.id)} className="p-2 bg-green-500 text-black rounded-lg hover:bg-green-400">
                                                        <Check size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <h3 className="text-base font-bold text-white truncate pr-6 mb-1">
                                                        {item.result?.productName || "Unknown Product"}
                                                    </h3>
                                                    <p className="text-xs text-white/40 font-medium tracking-wide">
                                                        {formatDate(item.timestamp)}
                                                    </p>
                                                </>
                                            )}
                                        </div>

                                        {/* Quick Action: Chat only (Edit/Delete moved to Long Press) */}
                                        {/* Actually user said "Edit or Delete should come on long press", implying Chat might still be visible or everything moved? */}
                                        {/* Let's keep Chat visible as it's a primary action, but move Edit/Delete to menu */}
                                        <div className="flex items-center gap-2">
                                            {editingId !== item.id && (
                                                <button
                                                    onClick={(e) => handleAskAI(e, item.result)}
                                                    className="p-2 text-green-400/50 hover:text-green-300 hover:bg-green-500/20 rounded-full transition"
                                                    title="Ask AI about this"
                                                >
                                                    <MessageCircle size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                </>
            )}
            {/* Context Menu Modal */}
            <AnimatePresence>
                {contextItem && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-sm"
                            onClick={() => setContextItem(null)}
                        />
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="absolute bottom-0 left-0 right-0 z-[70] bg-zinc-900 border-t border-white/10 rounded-t-2xl p-4 shadow-2xl flex flex-col gap-2 pb-10"
                        >
                            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-2" />
                            <div className="p-2 text-center mb-2">
                                <h3 className="text-white font-bold text-lg truncate max-w-[80%] mx-auto">{contextItem.result?.productName}</h3>
                                <p className="text-white/40 text-sm">Select an action</p>
                            </div>
                            <button
                                onClick={startEditing}
                                className="p-4 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center gap-3 font-medium transition text-base active:scale-95"
                            >
                                <Edit2 size={20} className="text-green-400" /> Rename
                            </button>
                            <button
                                onClick={() => {
                                    // Handle delete logic here directly
                                    const newHistory = history.filter(h => h.id !== contextItem.id);
                                    localStorage.setItem('scan_history', JSON.stringify(newHistory));
                                    setHistory(newHistory);
                                    setContextItem(null);
                                }}
                                className="p-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center gap-3 font-medium transition text-base active:scale-95"
                            >
                                <Trash2 size={20} /> Delete
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </AnimatePresence>
    );
};

export default HistoryView;
