'use client';

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { format, isValid } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
  color: 'hsl(var(--foreground))',
};

export function CallTypeChart({
  data,
}: {
  data: { call_type: string; cost: string | number }[];
}) {
  const rows = data.map((d) => ({ name: d.call_type.replace(/_/g, ' '), cost: Number(d.cost) }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost by call type</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No calls in range.</p>
        ) : (
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v) => `$${Number(v).toFixed(3)}`}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  formatter={(v: number) => [`$${v.toFixed(5)}`, 'Cost']}
                />
                <Bar dataKey="cost" fill="hsl(var(--accent))" radius={[0, 3, 3, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SpendOverTimeChart({
  data,
}: {
  data: { day: string; cost: string | number }[];
}) {
  const rows = data.map((d) => {
    const parsed = new Date(d.day);
    return {
      day: isValid(parsed) ? format(parsed, 'dd MMM') : d.day,
      cost: Number(d.cost),
    };
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spend over time</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No spend in range.</p>
        ) : (
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [`$${v.toFixed(5)}`, 'Cost']}
                />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="hsl(var(--accent))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
