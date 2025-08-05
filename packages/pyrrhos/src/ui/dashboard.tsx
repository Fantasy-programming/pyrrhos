import type { JSX } from "hono/jsx";
import type { Storage, QueryResult } from "../storage";
import type { Theme } from "./theme";
import { lightTheme, darkTheme } from "./theme";

export interface DashboardProps {
  storage: Storage;
  apiKey?: string;
  theme?: Theme;
  title?: string;
  timeRange?: {
    start: number;
    end: number;
  };
}

export interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
    period: string;
  };
  icon?: string;
  theme: Theme;
}

export interface ChartData {
  timestamp: number;
  value: number;
  label?: string;
}

export interface TimeSeriesChartProps {
  data: ChartData[];
  title: string;
  color?: string;
  theme: Theme;
}

export function MetricCard({ title, value, change, icon, theme }: MetricCardProps): JSX.Element {
  const changeColor = change?.type === 'increase' ? theme.colors.success : theme.colors.error;
  const changeSymbol = change?.type === 'increase' ? '+' : '-';

  return (
    <div style={{
      backgroundColor: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      boxShadow: theme.shadows.sm,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing.sm,
      }}>
        <h3 style={{
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.medium,
          color: theme.colors.text.secondary,
          margin: 0,
        }}>
          {title}
        </h3>
        {icon && (
          <span style={{
            fontSize: theme.typography.fontSize.lg,
            color: theme.colors.text.muted,
          }}>
            {icon}
          </span>
        )}
      </div>
      
      <div style={{
        fontSize: theme.typography.fontSize['2xl'],
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.xs,
      }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>

      {change && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          fontSize: theme.typography.fontSize.sm,
          color: changeColor,
        }}>
          <span>{changeSymbol}{Math.abs(change.value).toFixed(1)}%</span>
          <span style={{
            marginLeft: theme.spacing.xs,
            color: theme.colors.text.muted,
          }}>
            vs {change.period}
          </span>
        </div>
      )}
    </div>
  );
}

export function SimpleLineChart({ data, title, color, theme }: TimeSeriesChartProps): JSX.Element {
  if (data.length === 0) {
    return (
      <div style={{
        backgroundColor: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.lg,
        boxShadow: theme.shadows.sm,
        textAlign: 'center',
      }}>
        <h3 style={{
          fontSize: theme.typography.fontSize.lg,
          fontWeight: theme.typography.fontWeight.semibold,
          color: theme.colors.text.primary,
          marginBottom: theme.spacing.md,
        }}>
          {title}
        </h3>
        <p style={{ color: theme.colors.text.muted }}>No data available</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  // Generate SVG path for line chart
  const width = 400;
  const height = 200;
  const padding = 20;

  const pathData = data.map((point, index) => {
    const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((point.value - minValue) / range) * (height - 2 * padding);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <div style={{
      backgroundColor: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      boxShadow: theme.shadows.sm,
    }}>
      <h3 style={{
        fontSize: theme.typography.fontSize.lg,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.md,
      }}>
        {title}
      </h3>
      
      <svg width={width} height={height} style={{ width: '100%', height: 'auto' }}>
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={theme.colors.border} strokeWidth="1" opacity="0.3"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Chart line */}
        <path
          d={pathData}
          fill="none"
          stroke={color || theme.colors.primary}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Data points */}
        {data.map((point, index) => {
          const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
          const y = height - padding - ((point.value - minValue) / range) * (height - 2 * padding);
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="3"
              fill={color || theme.colors.primary}
            />
          );
        })}
      </svg>
    </div>
  );
}

export function TopPagesTable({ pages, theme }: { pages: Array<{ path: string; views: number; visitors: number }>, theme: Theme }): JSX.Element {
  return (
    <div style={{
      backgroundColor: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      boxShadow: theme.shadows.sm,
    }}>
      <h3 style={{
        fontSize: theme.typography.fontSize.lg,
        fontWeight: theme.typography.fontWeight.semibold,
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.md,
      }}>
        Top Pages
      </h3>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
              <th style={{
                padding: theme.spacing.sm,
                textAlign: 'left',
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text.secondary,
              }}>
                Page
              </th>
              <th style={{
                padding: theme.spacing.sm,
                textAlign: 'right',
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text.secondary,
              }}>
                Views
              </th>
              <th style={{
                padding: theme.spacing.sm,
                textAlign: 'right',
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text.secondary,
              }}>
                Visitors
              </th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page, index) => (
              <tr key={index} style={{
                borderBottom: index < pages.length - 1 ? `1px solid ${theme.colors.border}` : 'none',
              }}>
                <td style={{
                  padding: theme.spacing.sm,
                  fontSize: theme.typography.fontSize.sm,
                  color: theme.colors.text.primary,
                }}>
                  {page.path}
                </td>
                <td style={{
                  padding: theme.spacing.sm,
                  textAlign: 'right',
                  fontSize: theme.typography.fontSize.sm,
                  color: theme.colors.text.primary,
                }}>
                  {page.views.toLocaleString()}
                </td>
                <td style={{
                  padding: theme.spacing.sm,
                  textAlign: 'right',
                  fontSize: theme.typography.fontSize.sm,
                  color: theme.colors.text.primary,
                }}>
                  {page.visitors.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export async function Dashboard({ storage, apiKey, theme = lightTheme, title = "Analytics Dashboard", timeRange }: DashboardProps): Promise<JSX.Element> {
  const now = Date.now();
  const defaultTimeRange = {
    start: now - (24 * 60 * 60 * 1000), // Last 24 hours
    end: now,
  };

  const actualTimeRange = timeRange || defaultTimeRange;
  
  // Fetch analytics data
  const results = await storage.queryEvents({
    start: actualTimeRange.start,
    end: actualTimeRange.end,
    limit: 10000,
  });

  const events = results.events || [];
  
  // Calculate metrics
  const totalEvents = events.length;
  const pageViews = events.filter(e => e.type === 'page_view' || e.type === 'pageview').length;
  const uniqueVisitors = new Set(events.map(e => e.sessionId)).size;
  const uniqueUsers = new Set(events.map(e => e.userId || e.sessionId)).size;
  
  // Calculate bounce rate
  const sessionPageViews = new Map<string, number>();
  events.forEach(event => {
    if (event.type === 'page_view' || event.type === 'pageview') {
      const sessionId = event.sessionId || 'unknown';
      sessionPageViews.set(sessionId, (sessionPageViews.get(sessionId) || 0) + 1);
    }
  });
  
  const bounceRate = sessionPageViews.size > 0 
    ? (Array.from(sessionPageViews.values()).filter(count => count === 1).length / sessionPageViews.size) * 100
    : 0;

  // Calculate top pages
  const pageViewCounts = new Map<string, { views: number; visitors: Set<string> }>();
  events.forEach(event => {
    if (event.type === 'page_view' || event.type === 'pageview') {
      const path = event.url ? new URL(event.url).pathname : event.properties?.path || 'Unknown';
      const sessionId = event.sessionId || 'unknown';
      
      if (!pageViewCounts.has(path)) {
        pageViewCounts.set(path, { views: 0, visitors: new Set() });
      }
      
      const pageData = pageViewCounts.get(path)!;
      pageData.views++;
      pageData.visitors.add(sessionId);
    }
  });

  const topPages = Array.from(pageViewCounts.entries())
    .map(([path, data]) => ({
      path,
      views: data.views,
      visitors: data.visitors.size,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  // Generate time series data (hourly buckets)
  const timeSeriesData: ChartData[] = [];
  const hourMs = 60 * 60 * 1000;
  const startHour = Math.floor(actualTimeRange.start / hourMs) * hourMs;
  const endHour = Math.floor(actualTimeRange.end / hourMs) * hourMs;

  for (let time = startHour; time <= endHour; time += hourMs) {
    const hourEvents = events.filter(e => 
      e.timestamp >= time && e.timestamp < time + hourMs &&
      (e.type === 'page_view' || e.type === 'pageview')
    );
    
    timeSeriesData.push({
      timestamp: time,
      value: hourEvents.length,
      label: new Date(time).toLocaleTimeString(),
    });
  }

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <style>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: ${theme.colors.background};
            color: ${theme.colors.text.primary};
            line-height: 1.5;
          }
          
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: ${theme.spacing.xl};
          }
          
          .header {
            margin-bottom: ${theme.spacing.xl};
            padding-bottom: ${theme.spacing.lg};
            border-bottom: 1px solid ${theme.colors.border};
          }
          
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: ${theme.spacing.lg};
            margin-bottom: ${theme.spacing.xl};
          }
          
          .charts-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: ${theme.spacing.lg};
            margin-bottom: ${theme.spacing.xl};
          }
          
          @media (max-width: 768px) {
            .charts-grid {
              grid-template-columns: 1fr;
            }
            
            .container {
              padding: ${theme.spacing.md};
            }
          }
        `}</style>
      </head>
      <body>
        <div class="container">
          <header class="header">
            <h1 style={{
              fontSize: theme.typography.fontSize['3xl'],
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.primary,
            }}>
              {title}
            </h1>
            <p style={{
              fontSize: theme.typography.fontSize.base,
              color: theme.colors.text.secondary,
              marginTop: theme.spacing.sm,
            }}>
              {new Date(actualTimeRange.start).toLocaleDateString()} - {new Date(actualTimeRange.end).toLocaleDateString()}
            </p>
          </header>
          
          <div class="metrics-grid">
            <MetricCard
              title="Total Page Views"
              value={pageViews}
              icon="📊"
              theme={theme}
            />
            <MetricCard
              title="Unique Visitors"
              value={uniqueVisitors}
              icon="👥"
              theme={theme}
            />
            <MetricCard
              title="Total Events"
              value={totalEvents}
              icon="⚡"
              theme={theme}
            />
            <MetricCard
              title="Bounce Rate"
              value={`${bounceRate.toFixed(1)}%`}
              icon="📈"
              theme={theme}
            />
          </div>
          
          <div class="charts-grid">
            <SimpleLineChart
              data={timeSeriesData}
              title="Page Views Over Time"
              color={theme.colors.primary}
              theme={theme}
            />
            <TopPagesTable
              pages={topPages}
              theme={theme}
            />
          </div>
        </div>
      </body>
    </html>
  );
}