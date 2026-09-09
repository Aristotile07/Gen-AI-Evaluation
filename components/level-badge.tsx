import { Badge } from '@/components/ui/badge';
import type { AiUseLevel } from '@/lib/types';

const MAP: Record<string, 'high' | 'medium' | 'low' | 'na'> = {
  High: 'high',
  Medium: 'medium',
  Low: 'low',
  'N/A': 'na',
};

export default function LevelBadge({ level }: { level: AiUseLevel | string | null | undefined }) {
  if (!level) return <span className="text-muted-foreground">—</span>;
  return <Badge variant={MAP[level] ?? 'na'}>{level}</Badge>;
}
