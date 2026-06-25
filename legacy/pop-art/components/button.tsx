"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { playTap } from "@/lib/use-sound";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:brightness-110 shadow-[0_4px_0_0_#15803d] active:translate-y-[2px] active:shadow-none",
        outline:
          "border border-border bg-surface hover:bg-surface-2 text-foreground",
        ghost: "hover:bg-surface-2 text-foreground",
        accent: "bg-accent text-white hover:brightness-110 shadow-sm",
        pop:
          "border-2 border-primary bg-surface text-primary hover:bg-surface-2 shadow-[0_4px_0_0_#15803d] active:translate-y-[2px] active:shadow-none",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

/** A single click-burst: shapes flying outward from the click point. */
type Burst = {
  id: number;
  x: number;
  y: number;
  bits: {
    dx: number;
    dy: number;
    rot: number;
    color: string;
    shape: Shape;
    size: number;
  }[];
};

type Shape = "circle" | "square" | "diamond" | "triangle" | "plus";

const POP_COLORS = [
  "var(--pop-pink)",
  "var(--pop-yellow)",
  "var(--pop-cyan)",
  "var(--pop-orange)",
  "var(--pop-purple)",
  "var(--primary)",
];
const SHAPES: Shape[] = ["circle", "square", "diamond", "triangle", "plus"];

const CLIP: Partial<Record<Shape, string>> = {
  triangle: "polygon(50% 0%, 100% 100%, 0% 100%)",
  plus: "polygon(35% 0,65% 0,65% 35%,100% 35%,100% 65%,65% 65%,65% 100%,35% 100%,35% 65%,0 65%,0 35%,35% 35%)",
};

function makeBurst(id: number, x: number, y: number): Burst {
  const n = 11;
  const bits = Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2 + Math.random() * 0.6;
    const dist = 46 + Math.random() * 36;
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      rot: (Math.random() - 0.5) * 320,
      color: POP_COLORS[Math.floor(Math.random() * POP_COLORS.length)],
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      size: 10 + Math.round(Math.random() * 8),
    };
  });
  return { id, x, y, bits };
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, onClick, children, ...props }, ref) => {
    const [bursts, setBursts] = React.useState<Burst[]>([]);
    const nextId = React.useRef(0);

    function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
      if (!props.disabled) {
        const rect = e.currentTarget.getBoundingClientRect();
        // Keyboard activation reports no coordinates — burst from the center.
        const x = e.clientX > 0 ? e.clientX - rect.left : rect.width / 2;
        const y = e.clientY > 0 ? e.clientY - rect.top : rect.height / 2;
        const id = nextId.current++;
        setBursts((b) => [...b, makeBurst(id, x, y)]);
        window.setTimeout(
          () => setBursts((b) => b.filter((bu) => bu.id !== id)),
          550,
        );
        playTap(); // subtle UI blip + haptic (no-op when disabled in Settings)
      }
      onClick?.(e);
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        onClick={handleClick}
        {...props}
      >
        {children}
        {/* Click-burst overlay — decorative, never blocks pointer/layout. */}
        <span className="pointer-events-none absolute inset-0 overflow-visible">
          <AnimatePresence>
            {bursts.map((burst) =>
              burst.bits.map((bit, i) => (
                <motion.span
                  key={`${burst.id}-${i}`}
                  initial={{ x: burst.x, y: burst.y, scale: 1, opacity: 1, rotate: 0 }}
                  animate={{
                    x: burst.x + bit.dx,
                    y: burst.y + bit.dy,
                    scale: 0,
                    opacity: 0,
                    rotate: bit.rot,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="absolute left-0 top-0"
                  style={{
                    width: bit.size,
                    height: bit.size,
                    background: bit.color,
                    borderRadius: bit.shape === "circle" ? "9999px" : "2px",
                    clipPath: CLIP[bit.shape],
                  }}
                />
              )),
            )}
          </AnimatePresence>
        </span>
      </button>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
