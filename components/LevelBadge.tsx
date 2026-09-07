export default function LevelBadge({ level }: { level: string }) {
  const cls =
    level === 'High' ? 'badge-high' : level === 'Medium' ? 'badge-medium' : level === 'Low' ? 'badge-low' : 'badge-na';
  return <span className={`text-xs px-2 py-1 rounded-full font-medium ${cls}`}>{level}</span>;
}
