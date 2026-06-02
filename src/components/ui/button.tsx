import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(135deg,#f97360_0%,#ec4899_55%,#8b5cf6_100%)] text-primary-foreground shadow-[0_18px_36px_-18px_rgba(249,115,96,0.55)] hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-18px_rgba(236,72,153,0.45)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_16px_32px_-18px_rgba(239,68,68,0.45)] hover:-translate-y-0.5 hover:bg-destructive/95",
        outline:
          "border border-input/90 bg-white/72 text-foreground shadow-[0_10px_24px_-20px_rgba(15,23,42,0.35)] hover:-translate-y-0.5 hover:border-primary/25 hover:bg-white",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] hover:-translate-y-0.5 hover:bg-secondary/86",
        ghost: "text-muted-foreground hover:bg-white/70 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-3.5 text-xs",
        lg: "h-12 rounded-xl px-8 text-sm",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
