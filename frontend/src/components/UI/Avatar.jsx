import { useState } from 'react';
import { getInitials, getAvatarColor } from '../../utils/helpers';

const SIZES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
};

export default function Avatar({ user, size = 'md', className = '' }) {
  const [imgError, setImgError] = useState(false);

  const sizeClass = SIZES[size] || SIZES.md;
  const name = typeof user === 'object' ? user?.username : String(user || '');
  const initials = getInitials(name);
  const colorClass = getAvatarColor(name);
  const avatarUrl = typeof user === 'object' ? user?.avatarUrl : null;

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
    >
      {initials || '?'}
    </div>
  );
}
