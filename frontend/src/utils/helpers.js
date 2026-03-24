import { formatDistanceToNow, format, isToday, isYesterday, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

export function formatMessageTime(dateStr) {
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  return format(date, 'HH:mm');
}

export function formatMessageDate(dateStr) {
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  if (isToday(date)) return 'Bugün';
  if (isYesterday(date)) return 'Dün';
  return format(date, 'dd MMMM yyyy', { locale: tr });
}

export function formatRelativeTime(dateStr) {
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  return formatDistanceToNow(date, { addSuffix: true, locale: tr });
}

export function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export function getAvatarColor(str = '') {
  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
    'bg-lime-500', 'bg-green-500', 'bg-teal-500', 'bg-cyan-500',
    'bg-sky-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500',
    'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

