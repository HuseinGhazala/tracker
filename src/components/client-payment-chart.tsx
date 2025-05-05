"use client"

import * as React from "react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts" // Import ResponsiveContainer

import {
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"

export type ChartData = {
  date: string; // Represents the day (e.g., '1 May', '2 May')
  total: number; // Represents cumulative total in USD for that day
}

interface ClientPaymentChartProps {
  data: ChartData[];
}

const chartConfig = {
  total: {
    label: "الدخل التراكمي (USD)", // Label updated to reflect cumulative USD
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export function ClientPaymentChart({ data }: ClientPaymentChartProps) {
  // Format currency for tooltip and axis (always USD now)
  const formatCurrencyUSD = (value: number) => {
     try {
       // Format with no decimal places for cleaner axis/tooltip
       return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
     } catch (e) {
       return `USD ${value.toFixed(0)}`; // Fallback
     }
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[300px] w-full pr-5"> {/* Increased min-height and added padding */}
       {/* Use ResponsiveContainer for better adaptability */}
       <ResponsiveContainer width="100%" height={300}>
          <LineChart accessibilityLayer data={data} margin={{ top: 5, right: 10, left: 10, bottom: 40 }}> {/* Adjusted margins */}
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date" // Use the formatted date string ('d MMM')
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value} // Display the formatted date directly
              angle={-45} // Angle ticks for better readability
              textAnchor="end" // Adjust anchor for angled text
              interval="preserveStartEnd" // Show first and last tick, adjust others automatically
            />
             <YAxis
                tickFormatter={formatCurrencyUSD} // Use USD formatter
                tickLine={false}
                axisLine={false}
                tickMargin={5} // Adjust margin
                domain={['auto', 'auto']} // Let Recharts determine the domain, starting near 0
                allowDataOverflow={false} // Prevent overflow
                // Ensure Y-axis starts from 0 or slightly below the min value if appropriate
                // domain={[0, 'auto']} // Force start at 0
             />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }} // Customize cursor style
              content={
                  <ChartTooltipContent
                      formatter={(value, name, props) => {
                           // Use the label (date) from the payload
                          const dateLabel = props.payload?.date;
                          return (
                            <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">{dateLabel}</span>
                                <span className="font-semibold">{formatCurrencyUSD(value as number)}</span>
                            </div>
                          );
                      }}
                      // Explicitly hide the default label which shows the dataKey 'total'
                      labelFormatter={() => null}
                      indicator="dot" // Show dot indicator
                   />
                }
            />
            <Line
                type="monotone" // Smooth line
                dataKey="total"
                stroke="var(--color-total)"
                strokeWidth={2}
                dot={false} // Hide dots on the line for cleaner look
                activeDot={{ r: 6, fill: "var(--color-total)" }} // Style for active dot on hover
                connectNulls={false} // Do not connect points if there's missing data (though we generate all days)
                isAnimationActive={true} // Enable animation
            />
          </LineChart>
       </ResponsiveContainer>
    </ChartContainer>
  )
}
