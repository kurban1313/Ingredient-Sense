import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Bot, Menu, MessageSquare, Plus, Trash2, ChevronLeft, Edit2, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sendChatMessage, getSessions, saveSession, createSession, deleteSession, updateSession, type ChatMessage, type ChatSession } from "@/services/chatService";
import { cn } from "@/lib/utils";

interface ChatViewProps {
    isOpen: boolean;
    onClose: () => void;
    contextResult?: any;
}

const ChatView = ({ isOpen, onClose, contextResult }: ChatViewProps) => {
    const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [showSessions, setShowSessions] = useState(false);
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [contextSession, setContextSession] = useState<ChatSession | null>(null);

    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Initial Load
    useEffect(() => {
        if (isOpen) {
            setSessions(getSessions());
            if (contextResult) {
                // If opening with context, create a NEW session for this context immediately
                const newSession = createSession(contextResult);
                setCurrentSession(newSession);
                setSessions(getSessions()); // Refresh list
            } else if (!currentSession) {
                // If no session active, try load most recent or create empty
                const all = getSessions();
                if (all.length > 0) {
                    setCurrentSession(all[0]);
                } else {
                    const newSession = createSession();
                    setCurrentSession(newSession);
                    setSessions(getSessions());
                }
            }
        }
    }, [isOpen, contextResult]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [currentSession?.messages, isLoading]);

    const handleSend = async () => {
        if (!input.trim() || isLoading || !currentSession) return;

        const userMsg: ChatMessage = { role: 'user', content: input };
        const updatedSession = {
            ...currentSession,
            messages: [...currentSession.messages, userMsg]
        };

        setCurrentSession(updatedSession);
        saveSession(updatedSession); // Save state
        setInput("");
        setIsLoading(true);

        try {
            // Use provided context or fall back to the session's persisted context
            const contextToUse = contextResult || currentSession.contextData;
            const response = await sendChatMessage(updatedSession.messages, contextToUse);

            const botMsg: ChatMessage = { role: 'assistant', content: response };
            const finalSession = {
                ...updatedSession,
                messages: [...updatedSession.messages, botMsg]
            };
            setCurrentSession(finalSession);
            saveSession(finalSession);
            setSessions(getSessions()); // Update title potentially
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNewChat = () => {
        const newSession = createSession();
        setCurrentSession(newSession);
        setSessions(getSessions());
        setShowSessions(false);
    };

    const handleSelectSession = (s: ChatSession) => {
        setCurrentSession(s);
        setShowSessions(false);
    };

    const handleStartEdit = () => {
        if (contextSession) {
            setEditingSessionId(contextSession.id);
            setEditTitle(contextSession.title);
            setContextSession(null);
        }
    };

    const handleDeleteSession = () => {
        if (contextSession) {
            deleteSession(contextSession.id);
            const remaining = getSessions();
            setSessions(remaining);
            if (currentSession?.id === contextSession.id) {
                setCurrentSession(remaining.length > 0 ? remaining[0] : null);
            }
            setContextSession(null);
        }
    };

    const handleSaveEdit = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (editTitle.trim()) {
            updateSession(id, { title: editTitle.trim() });
            setSessions(getSessions());
            if (currentSession?.id === id) {
                setCurrentSession({ ...currentSession, title: editTitle.trim() });
            }
        }
        setEditingSessionId(null);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed inset-0 z-50 bg-black flex flex-col"
                >
                    {/* Header */}
                    <div className="h-16 flex items-center justify-between px-4 bg-zinc-900/50 backdrop-blur-md border-b border-white/5 shrink-0 z-20">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowSessions(!showSessions)}
                                className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition"
                            >
                                {showSessions ? <X size={20} /> : <Menu size={20} />}
                            </button>
                            <div>
                                <h2 className="font-bold text-white flex items-center gap-2">
                                    <Bot className="text-green-400" size={18} />
                                    Dr. AI
                                </h2>
                                <p className="text-xs text-white/40 truncate max-w-[150px]">
                                    {currentSession?.title || "New Conversation"}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white transition">
                            <ChevronLeft size={24} />
                        </button>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 relative overflow-hidden flex">

                        {/* Session Sidebar (Overlay for mobile) */}
                        <AnimatePresence>
                            {showSessions && (
                                <motion.div
                                    initial={{ x: -300, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    exit={{ x: -300, opacity: 0 }}
                                    className="absolute inset-y-0 left-0 w-64 bg-zinc-900 border-r border-white/10 z-30 flex flex-col shadow-2xl"
                                >
                                    <div className="p-4 border-b border-white/5">
                                        <button
                                            onClick={handleNewChat}
                                            className="w-full py-3 px-4 rounded-xl bg-green-500 text-white font-semibold shadow-lg shadow-green-900/20 active:scale-95 transition flex items-center justify-center gap-2"
                                        >
                                            <Plus size={18} /> New Chat
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                        {sessions.map(s => (
                                            <div
                                                key={s.id}
                                                className={cn(
                                                    "w-full text-left p-3 rounded-xl text-sm transition flex items-center justify-between group select-none relative",
                                                    currentSession?.id === s.id ? "bg-white/10 text-white font-medium" : "text-white/50 hover:bg-white/5 hover:text-white"
                                                )}
                                                onClick={() => handleSelectSession(s)}
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    setContextSession(s);
                                                }}
                                            >
                                                {editingSessionId === s.id ? (
                                                    <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            value={editTitle}
                                                            onChange={(e) => setEditTitle(e.target.value)}
                                                            className="bg-black/50 text-white rounded px-2 py-1 w-full outline-none border border-green-500/50"
                                                            autoFocus
                                                        />
                                                        <button onClick={(e) => handleSaveEdit(e, s.id)} className="text-green-400 p-1"><Check size={14} /></button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3 truncate flex-1">
                                                        <MessageSquare size={16} className={currentSession?.id === s.id ? "text-green-400" : "opacity-50"} />
                                                        <span className="truncate">{s.title}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Chat Messages */}
                        <div className="flex-1 flex flex-col bg-background">
                            <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
                                {!currentSession?.messages.length && (
                                    <div className="h-full flex flex-col items-center justify-center text-white/30 space-y-4">
                                        <Bot size={48} className="opacity-20" />
                                        <p>Ask me anything about your health!</p>
                                    </div>
                                )}

                                {currentSession?.messages.map((msg, i) => (
                                    <div key={i} className={cn("flex gap-3 max-w-full", msg.role === 'user' ? "justify-end" : "justify-start")}>
                                        {msg.role === 'assistant' && (
                                            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 border border-green-500/30">
                                                <Bot size={14} className="text-green-400" />
                                            </div>
                                        )}
                                        <div className={cn(
                                            "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                                            msg.role === 'assistant'
                                                ? "bg-zinc-800/80 border border-white/5 text-zinc-100 rounded-tl-sm backdrop-blur-sm"
                                                : "bg-[#10B981] text-black font-medium rounded-tr-sm shadow-green-900/20"
                                        )}>
                                            {msg.role === 'assistant' ? (
                                                <div className="prose prose-invert prose-sm max-w-none break-words [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>strong]:text-green-400">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {msg.content}
                                                    </ReactMarkdown>
                                                </div>
                                            ) : (
                                                msg.content
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 border border-green-500/30">
                                            <Bot size={14} className="text-green-400" />
                                        </div>
                                        <div className="bg-zinc-800/50 rounded-2xl px-4 py-3 rounded-tl-sm flex items-center gap-1">
                                            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                                            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                                            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Input Area */}
                            <div className="p-4 bg-zinc-900/80 backdrop-blur-xl border-t border-white/5 shrink-0">
                                <div className="flex gap-2 items-end max-w-2xl mx-auto">
                                    <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl overflow-hidden focus-within:ring-1 focus-within:ring-green-500/50 transition">
                                        <textarea
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder="Ask Dr. AI..."
                                            className="w-full bg-transparent text-white p-3 max-h-32 min-h-[44px] outline-none resize-none placeholder:text-white/20"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSend();
                                                }
                                            }}
                                            rows={1}
                                        />
                                    </div>
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim() || isLoading}
                                        className="p-3 rounded-full bg-green-500 text-black font-bold shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:shadow-none hover:bg-green-400 active:scale-95 transition flex items-center justify-center"
                                    >
                                        <Send size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
            {/* Simple Context Menu for Session */}
            {contextSession && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" onClick={() => setContextSession(null)}>
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="absolute bottom-0 left-0 right-0 bg-zinc-900 border-t border-x border-white/10 rounded-t-2xl p-4 shadow-2xl flex flex-col gap-2 pb-10"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-2" />
                        <div className="p-2 text-center mb-2">
                            <h3 className="text-white font-bold text-lg truncate max-w-[80%] mx-auto">{contextSession.title}</h3>
                            <p className="text-white/40 text-sm">Manage Conversation</p>
                        </div>
                        <button
                            onClick={handleStartEdit}
                            className="p-4 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center gap-3 font-medium transition text-base active:scale-95"
                        >
                            <Edit2 size={20} className="text-green-400" /> Rename Chat
                        </button>
                        <button
                            onClick={handleDeleteSession}
                            className="p-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center gap-3 font-medium transition text-base active:scale-95"
                        >
                            <Trash2 size={20} /> Delete Chat
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ChatView;
