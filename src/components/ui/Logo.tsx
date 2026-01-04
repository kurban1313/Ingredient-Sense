import { ScanLine, Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
    className?: string;
    size?: "sm" | "md" | "lg";
}

const Logo = ({ className, size = "md" }: LogoProps) => {
    const getSize = () => {
        switch (size) {
            case "sm": return { icon: 16, text: "text-lg" };
            case "lg": return { icon: 32, text: "text-3xl" };
            default: return { icon: 24, text: "text-2xl" };
        }
    };

    const s = getSize();

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <div className="relative flex items-center justify-center">
                <ScanLine className={cn("text-white/80", size === 'lg' ? "w-10 h-10" : "w-8 h-8")} />
                <Leaf className={cn("absolute text-green-400 fill-green-400/20", size === 'lg' ? "w-5 h-5" : "w-4 h-4")} />
            </div>
            <h1 className={cn("font-bold tracking-tight text-white", s.text)}>
                Ingredient<span className="text-green-400">Sense</span>
            </h1>
        </div>
    );
};

export default Logo;
