const STATUS_COLORS = {
  online: 'bg-green-500',
  busy: 'bg-yellow-500',
  idle: 'bg-yellow-400',
  offline: 'bg-gray-500',
};

export default function StatusBadge({ status = 'offline', className = '' }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.offline;
  return (
    <span className={`w-2.5 h-2.5 ${color} rounded-full border-2 border-gray-800 inline-block ${className}`} />
  );
}

