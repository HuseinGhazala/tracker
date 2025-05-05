

"use client"

import * as React from "react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts" // Changed import to LineChart and Line

import {
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"

export type ChartData = {
  date: string; // Changed from month to date
  total: number; // Represents total in USD
}

interface ClientPaymentChartProps {
  data: ChartData[];
}

const chartConfig = {
  total: {
    label: "الدخل (USD)", // Label updated to USD
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export function ClientPaymentChart({ data }: ClientPaymentChartProps) {
  // Format currency for tooltip and axis (always USD now)
  const formatCurrencyUSD = (value: number) => {
     try {
       return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
     } catch (e) {
       return `USD ${value.toFixed(0)}`; // Fallback
     }
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
      {/* Changed BarChart to LineChart */}
      <LineChart accessibilityLayer data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date" // Changed dataKey from month to date
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => value} // Display full date string from data
          angle={-45} // Angle ticks for better readability if dates are long
          textAnchor="end" // Adjust anchor for angled text
          height={50} // Increase height to accommodate angled labels
        />
         <YAxis
            tickFormatter={formatCurrencyUSD} // Use USD formatter
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            // Removed width={80}
          />
        <Tooltip
          cursor={true} // Enable cursor for LineChart
          content={<ChartTooltipContent formatter={formatCurrencyUSD} hideLabel />} // Use USD formatter
        />
        {/* Changed Bar to Line */}
        <Line
            type="monotone" // Make the line smooth
            dataKey="total"
            stroke="var(--color-total)"
            strokeWidth={2}
            dot={false} // Optionally hide dots on the line
        />
      </LineChart>
    </ChartContainer>
  )
}

    
