'use client';

type BadgeRole = 'host' | 'guest';

interface BadgeProps {
  role: BadgeRole;
  className?: string;
}

const roleStyles: Record<BadgeRole, { bg: string; text: string; icon: string }> = {
  host: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    icon: '👑',
  },
  guest: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    icon: '👤',
  },
};

export function Badge({ role, className = '' }: BadgeProps) {
  const styles = roleStyles[role];

  return (
    <span
      className={`
        inline-flex items-center gap-1
        px-2 py-0.5 rounded-full
        text-xs font-medium
        ${styles.bg} ${styles.text}
        ${className}
      `}
    >
      <span>{styles.icon}</span>
      <span>{role === 'host' ? '호스트' : '게스트'}</span>
    </span>
  );
}
