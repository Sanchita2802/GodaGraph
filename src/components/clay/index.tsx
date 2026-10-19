import React from 'react';

// Reusable Claymorphism Design System Components

export interface ClayCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'accent' | 'subtle' | 'sunlit';
  squishy?: boolean;
}

export const ClayCard: React.FC<ClayCardProps> = ({
  children,
  className = '',
  variant = 'default',
  squishy = false,
  ...props
}) => {
  const variantStyles = {
    default:
      'bg-white/90 dark:bg-[#1F1B2B]/90 border border-black/5 dark:border-white/10 shadow-[0_16px_32px_-8px_rgba(138,98,77,0.12),inset_0_2px_4px_rgba(255,255,255,0.9),inset_0_-3px_6px_rgba(186,155,140,0.2)] dark:shadow-[0_16px_36px_-8px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.12),inset_0_-3px_6px_rgba(10,8,15,0.7)]',
    accent:
      'bg-gradient-to-br from-[#FFEFEA] to-[#FFD9C7] dark:from-[#2E1E28] dark:to-[#1F1B2B] border border-[#E0554B]/20 shadow-[0_16px_32px_-8px_rgba(224,85,75,0.2),inset_0_2px_4px_rgba(255,255,255,0.9),inset_0_-3px_6px_rgba(224,85,75,0.25)]',
    subtle:
      'bg-[#FBF8F5] dark:bg-[#191624] border border-black/5 dark:border-white/5 shadow-[0_10px_20px_-6px_rgba(0,0,0,0.06),inset_0_1px_3px_rgba(255,255,255,0.8)]',
    sunlit:
      'bg-gradient-to-br from-[#FFF9E6] to-[#FFF1B8]/60 dark:from-[#2B261D] dark:to-[#1F1B2B] border border-[#F59E0B]/20 shadow-[0_14px_28px_-6px_rgba(245,158,11,0.15),inset_0_2px_4px_rgba(255,255,255,0.9)]',
  };

  return (
    <div
      className={`rounded-[28px] p-6 transition-all duration-200 ${
        squishy ? 'hover:scale-[1.01] active:scale-[0.98]' : ''
      } ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export interface ClayButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'mint' | 'amber' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  icon?: React.ReactNode;
}

export const ClayButton: React.FC<ClayButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  icon,
  disabled,
  ...props
}) => {
  const sizeStyles = {
    sm: 'px-4 py-2 text-xs font-semibold gap-1.5',
    md: 'px-6 py-3 text-sm font-semibold gap-2',
    lg: 'px-8 py-4 text-base font-bold gap-3',
  };

  const variantStyles = {
    primary:
      'bg-gradient-to-b from-[#E7635A] to-[#D94C42] text-white shadow-[0_8px_20px_-4px_rgba(224,85,75,0.4),inset_0_2px_3px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(150,30,25,0.4)] hover:brightness-105 active:scale-[0.97]',
    secondary:
      'bg-white dark:bg-[#282336] text-[#3B2F4A] dark:text-[#F2EEF9] border border-black/5 dark:border-white/10 shadow-[0_8px_18px_-4px_rgba(0,0,0,0.08),inset_0_2px_3px_rgba(255,255,255,0.9),inset_0_-2px_4px_rgba(0,0,0,0.08)] hover:bg-neutral-50 dark:hover:bg-[#302B40] active:scale-[0.97]',
    mint:
      'bg-gradient-to-b from-[#7EE2B8] to-[#55CCA0] text-[#134E3A] shadow-[0_8px_20px_-4px_rgba(85,204,160,0.35),inset_0_2px_3px_rgba(255,255,255,0.6),inset_0_-2px_4px_rgba(19,78,58,0.3)] hover:brightness-105 active:scale-[0.97]',
    amber:
      'bg-gradient-to-b from-[#FFCF6B] to-[#FBBF24] text-[#78350F] shadow-[0_8px_20px_-4px_rgba(251,191,36,0.35),inset_0_2px_3px_rgba(255,255,255,0.6),inset_0_-2px_4px_rgba(120,53,15,0.3)] hover:brightness-105 active:scale-[0.97]',
    ghost:
      'bg-transparent text-[#3B2F4A] dark:text-[#F2EEF9] hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.97]',
  };

  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-full cursor-pointer select-none transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};

export interface ClayInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  clearButton?: React.ReactNode;
}

export const ClayInput = React.forwardRef<HTMLInputElement, ClayInputProps>(
  ({ icon, clearButton, className = '', ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {icon && <div className="absolute left-4 text-[#7E708E] pointer-events-none">{icon}</div>}
        <input
          ref={ref}
          className={`w-full py-3.5 ${
            icon ? 'pl-11' : 'pl-5'
          } ${clearButton ? 'pr-11' : 'pr-5'} rounded-[20px] bg-white/95 dark:bg-[#252033]/95 border border-[#E0554B]/15 dark:border-white/10 text-[#3B2F4A] dark:text-[#F2EEF9] placeholder:text-[#9E94B3] shadow-[inset_0_2px_4px_rgba(0,0,0,0.04),0_2px_4px_rgba(255,255,255,0.8)] dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_1px_2px_rgba(255,255,255,0.04)] focus:outline-none focus:border-[#E0554B] dark:focus:border-[#FF7A6B] focus:ring-3 focus:ring-[#E0554B]/20 dark:focus:ring-[#FF7A6B]/25 transition-all text-sm font-medium ${className}`}
          {...props}
        />
        {clearButton && <div className="absolute right-3.5">{clearButton}</div>}
      </div>
    );
  }
);
ClayInput.displayName = 'ClayInput';

export interface ClayChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  count?: number | string;
  color?: 'default' | 'coral' | 'amber' | 'mint' | 'lilac';
}

export const ClayChip: React.FC<ClayChipProps> = ({
  label,
  active = false,
  onClick,
  icon,
  count,
  color = 'default',
}) => {
  const colorMap = {
    default: active
      ? 'bg-[#E0554B] text-white shadow-[0_4px_12px_rgba(224,85,75,0.3)]'
      : 'bg-white/80 dark:bg-[#282336] text-[#3B2F4A] dark:text-[#F2EEF9] border border-black/5 dark:border-white/10 shadow-[0_2px_6px_rgba(0,0,0,0.05),inset_0_1px_2px_rgba(255,255,255,0.8)]',
    coral: active
      ? 'bg-[#E0554B] text-white shadow-[0_4px_12px_rgba(224,85,75,0.35)]'
      : 'bg-[#FFEDE8] text-[#9A2D25] dark:bg-[#341F25] dark:text-[#FFAAA3]',
    amber: active
      ? 'bg-[#F59E0B] text-white shadow-[0_4px_12px_rgba(245,158,11,0.35)]'
      : 'bg-[#FEF3C7] text-[#92400E] dark:bg-[#36271A] dark:text-[#FCD34D]',
    mint: active
      ? 'bg-[#10B981] text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)]'
      : 'bg-[#D1FAE5] text-[#065F46] dark:bg-[#163028] dark:text-[#6EE7B7]',
    lilac: active
      ? 'bg-[#8B5CF6] text-white shadow-[0_4px_12px_rgba(139,92,246,0.35)]'
      : 'bg-[#EDE9FE] text-[#5B21B6] dark:bg-[#281F3E] dark:text-[#C4B5FD]',
  };

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all active:scale-[0.96] select-none ${colorMap[color]}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
            active ? 'bg-white/25 text-white' : 'bg-black/5 dark:bg-white/10'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
};

export interface ClayToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
}

export const ClayToggle: React.FC<ClayToggleProps> = ({
  checked,
  onChange,
  label,
  description,
}) => {
  return (
    <label className="inline-flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] flex items-center ${
          checked ? 'bg-[#E0554B]' : 'bg-[#D4CEE0] dark:bg-[#38314A]'
        }`}
      >
        <div
          className={`w-4.5 h-4.5 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-transform duration-200 ${
            checked ? 'translate-x-5.5' : 'translate-x-0'
          }`}
        />
      </div>
      {(label || description) && (
        <div className="flex flex-col text-left">
          {label && <span className="text-xs font-bold text-[#3B2F4A] dark:text-[#F2EEF9]">{label}</span>}
          {description && (
            <span className="text-[11px] text-[#7E708E] dark:text-[#9E94B3]">{description}</span>
          )}
        </div>
      )}
    </label>
  );
};

export interface ClayModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const ClayModal: React.FC<ClayModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-[32px] bg-white dark:bg-[#1F1B2B] p-6 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.3),inset_0_2px_4px_rgba(255,255,255,0.9)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.15)] border border-black/5 dark:border-white/10 overflow-hidden"
      >
        <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/5">
          <h3 className="font-display text-lg font-bold text-[#3B2F4A] dark:text-[#F2EEF9]">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/5 text-[#7E708E] hover:text-[#3B2F4A] dark:hover:text-[#F2EEF9] hover:bg-black/10 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="pt-4 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
