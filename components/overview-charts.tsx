'use client';

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const LEVEL_COLOR: Record<string, string> = {
  High: 'hsl(var(--danger))',
  Medium: 'hsl(var(--warn))',
  Low: 'hsl(var(--ok))',
  'N/A': 'hsl(var(--neutral))',
};

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
  color: 'hsl(var(--foreground))',
};

export function AiUseDonut({ data }: { data: { level: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI reliance breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No evaluations yet.</p>
        ) : (
          <div className="flex items-center gap-6">
            <div className="h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="count"
                    nameKey="level"
                    innerRadius={44}
                    outerRadius={70}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {data.map((d) => (
                      <Cell key={d.level} fill={LEVEL_COLOR[d.level] ?? 'hsl(var(--neutral))'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-sm">
              {data.map((d) => (
                <li key={d.level} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: LEVEL_COLOR[d.level] ?? 'hsl(var(--neutral))' }}
                  />
                  <span className="text-muted-foreground">{d.level}</span>
                  <span className="ml-auto font-medium tabular-nums">{d.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ScoreHistogram({ data }: { data: { label: string; count: number }[] }) {
  const hasData = data.some((d) => d.count > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project score distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No scores yet.</p>
        ) : (
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted))' }} />
                <Bar dataKey="count" fill="hsl(var(--accent))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LinkStatusBars({ data }: { data: { status: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Link status</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <ul className="space-y-3">
            {data.map((d) => (
              <li key={d.status} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{d.status}</span>
                  <span className="font-medium tabular-nums">{d.count}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(d.count / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
