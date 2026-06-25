"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { playTap } from "@/lib/use-sound";
import { useMagnetic } from "@/components/motion/magnetic";

// "Editorial FUI" buttons — squarer geometry, cobalt fill or hairline frame,
// mono micro-label tracking. (Replaces the old pop-art click-burst variants.)
const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium tracking-[0.02em] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.985] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:brightness-110",
        outline:
          "border border-border bg-transparent text-foreground hover:border-primary hover:text-primary",
        ghost: "text-foreground hover:bg-surface-2",
        accent: "bg-accent text-white hover:brightness-110",
        // kept name for back-compat; now an editorial hairline/cobalt button
        pop: "border border-primary bg-transparent text-primary hover:bg-primary hover:text-primary-foreground",
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
    VariantProps<typeof buttonVariants> {
  /** Cursor-following magnetic drift (default on for the large CTA size). */
  magnetic?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, magnetic, onClick, children, ...props }, ref) => {
    const isMagnetic = magnetic ?? size === "lg";
    const magRef = useMagnetic<HTMLButtonElement>(isMagnetic ? 0.35 : 0);

    // Merge the magnetic ref with any forwarded ref.
    const setRefs = React.useCallback(
      (node: HTMLButtonElement | null) => {
        (magRef as React.MutableRefObject<HTMLButtonElement | null>).current =
          node;
        if (typeof ref === "function") ref(node);
        else if (ref)
          (ref as React.MutableRefObject<HTMLButtonElement | null>).current =
            node;
      },
      [magRef, ref],
    );

    function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
      if (!props.disabled) {
        playTap(); // subtle UI blip + haptic (no-op when disabled in Settings)
      }
      onClick?.(e);
    }

    return (
      <button
        ref={setRefs}
        className={cn(buttonVariants({ variant, size }), className)}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
