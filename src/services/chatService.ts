import OpenAI from "openai";

// Reuse the configuration from analysisService if possible, or duplicate safely
const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || "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";

const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: API_KEY,
    dangerouslyAllowBrowser: true
});

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface ChatSession {
    id: string;
    title: string;
    timestamp: number;
    messages: ChatMessage[];
    contextSummary?: string; // Short summary of the product context if any
    contextData?: any; // Full analysis result for context persistence
}

const HISTORY_KEY = 'chat_sessions';

export const getSessions = (): ChatSession[] => {
    try {
        const stored = localStorage.getItem(HISTORY_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

export const saveSession = (session: ChatSession) => {
    try {
        const sessions = getSessions();
        const index = sessions.findIndex(s => s.id === session.id);
        if (index !== -1) {
            sessions[index] = session;
        } else {
            sessions.unshift(session); // Newest first
        }
        localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
    } catch (e) {
        console.error("Failed to save session", e);
    }
};

export const createSession = (initialContext?: any): ChatSession => {
    const title = initialContext?.productName
        ? `Chat: ${initialContext.productName}`
        : `New Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    let content = "Hello! I'm **Dr. AI**. Ask me anything about ingredients, nutrition, or health safety.";

    if (initialContext) {
        content = `I've analyzed **${initialContext.productName}**.\n\n` +
            `**Risk Level:** ${initialContext.riskLevel?.toUpperCase()}\n` +
            `**Summary:** ${initialContext.summary}\n\n` +
            `**Ingredients:** ${initialContext.ingredients?.slice(0, 5).join(', ')}${initialContext.ingredients?.length > 5 ? '...' : ''}\n\n` +
            `How can I help you understand this better?`;
    }

    const initialMessage: ChatMessage = {
        role: 'assistant',
        content: content
    };

    const newSession: ChatSession = {
        id: crypto.randomUUID(),
        title: title,
        timestamp: Date.now(),
        messages: [initialMessage],
        contextSummary: initialContext?.productName,
        contextData: initialContext
    };
    saveSession(newSession);
    return newSession;
};

export const updateSession = (id: string, updates: Partial<ChatSession>) => {
    const sessions = getSessions();
    const index = sessions.findIndex(s => s.id === id);
    if (index !== -1) {
        sessions[index] = { ...sessions[index], ...updates };
        localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
    }
};

export const deleteSession = (id: string) => {
    const sessions = getSessions().filter(s => s.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions));
};

export const sendChatMessage = async (messages: ChatMessage[], context?: any): Promise<string> => {
    try {
        let systemPrompt = "You are Dr. AI, a helpful health assistant. Answer questions concisely and professionally. Format your response with Markdown (bold, lists) for readability.";

        if (context) {
            systemPrompt += `\n\nCurrent Context: The user is looking at a product analysis.\n${JSON.stringify(context).slice(0, 1000)}...`;
        }

        const completion = await openai.chat.completions.create({
            model: "openai/gpt-oss-120b:free", // Use the same powerful model
            messages: [
                { role: "system", content: systemPrompt },
                ...messages
            ],
            temperature: 0.7,
            max_tokens: 3500,
        });

        return completion.choices[0].message.content || "I couldn't generate a response.";
    } catch (e) {
        console.error("Chat error", e);
        return "Sorry, I'm having trouble connecting to my brain right now.";
    }
};
