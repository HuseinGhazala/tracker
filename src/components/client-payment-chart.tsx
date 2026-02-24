
"use client"

import * as React from "react"
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts" // Changed imports

import {
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale'; // Import Arabic locale for date display

import type { Currency } from '@/app/page'; // Import Currency type
const CURRENCIES = {
  EGP: 'جنيه مصري',
  SAR: 'ريال سعودي',
  USD: 'دولار أمريكي',
  CAD: 'دولار كندي',
  EUR: 'يورو',
} as const;

// Define the expected structure for cumulative income data points
export type CumulativeChartData = {
  date: Date; // Original Date object for the point in time
  dateFormatted: string; // Formatted date string for display ('d MMM' in Arabic)
  cumulativeAmountUSD: number; // Cumulative income amount in USD up to this date
  // Optional: Include details of the last payment that contributed to this point
  paymentAmountUSD?: number;
  clientName?: string;
  originalAmount?: number;
  originalCurrency?: Currency;
}

interface ClientPaymentChartProps {
  data: CumulativeChartData[];
}

const chartConfig = {
  cumulativeIncome: { // Updated key for clarity
    label: "الدخل التراكمي (USD)", // Legend label
    color: "hsl(var(--chart-1))", // Use theme color
  },
} satisfies ChartConfig

// Format currency using en-US locale for English numbers and standard symbols
const formatCurrency_en = (amount: number | null | undefined, currency: string) => {
    if (amount === null || amount === undefined) return '-';
    const options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    };
    const locale = 'en-US'; // Use 'en-US' for standard formatting

    try {
        const displayAmount = Object.is(amount, -0) ? 0 : amount;
        return displayAmount.toLocaleString(locale, options);
    } catch (e) {
        // Basic fallback with English numerals
        const symbols: { [key: string]: string } = { EGP: 'EGP', SAR: 'SAR', USD: '$', CAD: 'CA$', EUR: '€' };
        return `${symbols[currency] || currency} ${amount.toFixed(2)}`;
    }
};

export function ClientPaymentChart({ data }: ClientPaymentChartProps) {
   // Format currency for tooltip and axis using en-US locale (English numbers)
   const formatCurrencyUSD_en = (value: number) => {
     try {
       // Format with no decimal places for cleaner axis/tooltip, using en-US locale
       return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
     } catch (e) {
       return `USD ${value.toFixed(0)}`; // Fallback with English numerals
     }
   }

  // Calculate domain for axes
  const timeDomain: [number, number] | ['auto', 'auto'] = React.useMemo(() => {
      if (data.length === 0) return ['auto', 'auto'];
      const dates = data.map(d => d.date.getTime());
      const minTime = Math.min(...dates);
      const maxTime = Math.max(...dates);
      return [minTime, maxTime];
  }, [data]);

  // Y-axis domain starts at 0 for cumulative income
  const amountDomain: [number, number | string] | ['auto', 'auto'] = React.useMemo(() => {
      if (data.length === 0) return [0, 'auto'];
       // Ensure the domain starts at 0
       return [0, 'auto']; // Let Recharts handle the max, but start at 0
  }, [data]);


  return (
    <ChartContainer config={chartConfig} className="min-h-[350px] w-full pr-5">
          <AreaChart
            data={data}
            margin={{ top: 20, right: 20, bottom: 60, left: 20 }} // Adjusted margins
          >
            <defs>
                <linearGradient id="fillCumulative" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--chart-1))" // Use theme color
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--chart-1))" // Use theme color
                    stopOpacity={0.1}
                  />
                </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />{/* Optionally hide vertical lines */}
            <XAxis
              type="number" // Use number for time-based axis
              dataKey="date" // Use the original Date object's time value
              domain={timeDomain}
              tickFormatter={(unixTime) => format(new Date(unixTime), 'd MMM', { locale: arSA })} // Format ticks as dates
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              angle={-45} // Angle ticks for better readability
              textAnchor="end" // Adjust anchor for angled text
              interval="preserveStartEnd" // Show first and last tick, adjust others automatically
              name="التاريخ" // Axis name
            />
             <YAxis
                type="number"
                dataKey="cumulativeAmountUSD" // Use cumulative amount for Y-axis
                domain={amountDomain} // Start at 0
                tickFormatter={formatCurrencyUSD_en} // Use English USD formatter for Y-axis numbers
                tickLine={false}
                axisLine={false}
                tickMargin={5}
                name="الدخل التراكمي (USD)" // Axis name
                // allowDataOverflow={true} // Allow points slightly outside domain if needed
             />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={
                  <ChartTooltipContent
                      // Hide the default indicator (dot/line) provided by ChartTooltipContent
                      indicator="line" // Show line indicator for area chart
                      // Custom formatter to display cumulative details
                      formatter={(value, name, props) => {
                           // props.payload contains the data for the hovered point
                           const payload = props.payload as CumulativeChartData | undefined;
                           if (!payload || name !== 'cumulativeIncome') return null;

                           return (
                             <div className="flex flex-col items-end text-xs p-1" dir="ltr"> {/* LTR for alignment */}
                                 <span className="font-semibold mb-1">
                                    {formatCurrency_en(payload.cumulativeAmountUSD, 'USD')}
                                 </span>
                                  <span className="text-muted-foreground">في {payload.dateFormatted}</span>
                                 {/* Optionally show details of the last payment contributing to this point */}
                                 {payload.paymentAmountUSD && payload.paymentAmountUSD > 0 && payload.clientName && (
                                     <span className="text-muted-foreground text-[10px] mt-1">
                                        (+{formatCurrency_en(payload.paymentAmountUSD, 'USD')} من {payload.clientName})
                                     </span>
                                 )}
                             </div>
                           );
                      }}
                      // Hide the generic label derived from dataKey
                       labelFormatter={() => "الدخل التراكمي"}
                   />
                }
            />
             {/* Changed to Area component */}
            <Area
                dataKey="cumulativeAmountUSD" // Data key for the area
                type="monotone" // Smooth curve
                fill="url(#fillCumulative)" // Use the gradient fill
                fillOpacity={1}
                stroke="hsl(var(--chart-1))" // Use theme color for the line
                strokeWidth={2}
                stackId="a" // Required for AreaChart, even with one area
                name="cumulativeIncome" // Match the key in chartConfig
             />
          </AreaChart>
    </ChartContainer>
  )
}
