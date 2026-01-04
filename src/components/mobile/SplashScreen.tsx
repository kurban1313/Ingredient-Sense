import { motion } from "framer-motion";
import { useEffect } from "react";

export const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onComplete();
        }, 2200); // 2.2 seconds splash
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background"
        >
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative w-40 h-40 mb-6"
            >
                {/* Logo Image */}
                <img
                    src="/logo.png"
                    alt="IngredientSense Logo"
                    className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                />
            </motion.div>

            <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="text-3xl font-bold tracking-tight text-foreground"
            >
                Ingredient<span className="text-green-500">Sense</span>
            </motion.h1>

            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="text-sm text-muted-foreground mt-2 font-medium"
            >
                AI-Native Food Intelligence
            </motion.p>
        </motion.div>
    );
};
