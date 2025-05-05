
"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts"

import {
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ChartConfig } from "@/components/ui/chart"

export type ChartData = {
  month: string;
  total: number;
}

interface ClientPaymentChartProps {
  data: ChartData[];
}

const chartConfig = {
  total: {
    label: "الدخل",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export function ClientPaymentChart({ data }: ClientPaymentChartProps) {
  // Format currency for tooltip and axis
  const formatCurrency = (value: number) => {
    return value.toLocaleString('ar-SA', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }); // Keep USD, adjust as needed
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
      <BarChart accessibilityLayer data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => value} // Display full month name from data
        />
         <YAxis
            tickFormatter={formatCurrency}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            width={80} // Adjust width if needed for currency format
          />
        <Tooltip
          cursor={false}
          content={<ChartTooltipContent formatter={formatCurrency} hideLabel />} // Use custom formatter
        />
        <Bar dataKey="total" fill="var(--color-total)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
