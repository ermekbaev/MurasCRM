import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "secondary";
}

const variants = {
  default: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200",
  success: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400",
  warning: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400",
  danger: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400",
  info: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400",
  secondary: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400",
};

export default function Badge({ children, className, variant = "default" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
