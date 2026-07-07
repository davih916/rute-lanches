import { cn } from "@/lib/cn";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  dotClassName?: string;
}

export function Badge({ children, className, dotClassName }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        className
      )}
    >
      {dotClassName && <span className={cn("size-1.5 rounded-full", dotClassName)} />}
      {children}
    </span>
  );
}
