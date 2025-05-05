
"use client"

import * as React from "react"
import { ScatterChart, Scatter, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ZAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale'; // Import Arabic locale for date display

import type { Currency } from '@/app/page'; // Import Currency type if needed, or define locally
const CURRENCIES = {
  EGP: 'جنيه مصري',
  SAR: 'ريال سعودي',
  USD: 'دولار أمريكي',
  CAD: 'دولار كندي',
  EUR: 'يورو',
} as const;

// Define the expected structure for individual payment data points
export type ChartData = {
  id: string; // Unique identifier for the payment point (e.g., date-index)
  date: Date; // Original Date object for the payment
  dateFormatted: string; // Formatted date string for display ('d MMM' in Arabic)
  amountUSD: number; // Payment amount converted to USD
  clientName: string; // Name of the client making the payment
  originalAmount: number; // Original payment amount
  originalCurrency: Currency; // Original payment currency
}

interface ClientPaymentChartProps {
  data: ChartData[];
}

const chartConfig = {
  payments: {
    label: "الدفعات (USD)", // Legend label
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
      // Add some padding to the start/end dates if desired
      const minTime = Math.min(...dates);
      const maxTime = Math.max(...dates);
       // Example padding: 1 day before and after
      // const padding = 24 * 60 * 60 * 1000;
      // return [minTime - padding, maxTime + padding];
      return [minTime, maxTime];
  }, [data]);

  const amountDomain: [number, number] | ['auto', 'auto'] = React.useMemo(() => {
      if (data.length === 0) return [0, 'auto']; // Start at 0 if no data
      const amounts = data.map(d => d.amountUSD);
      // Ensure the domain starts at 0
      // const maxAmount = Math.max(...amounts);
      // const padding = maxAmount * 0.1; // 10% padding at the top
      // return [0, maxAmount + padding];
       return [0, 'auto']; // Let Recharts handle the max, but start at 0
  }, [data]);


  return (
    <ChartContainer config={chartConfig} className="min-h-[350px] w-full pr-5"> {/* Increased height */}
       <ResponsiveContainer width="100%" height={350}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 20 }}> {/* Adjusted margins */}
            <CartesianGrid strokeDasharray="3 3" />
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
                dataKey="amountUSD"
                domain={amountDomain} // Start at 0
                tickFormatter={formatCurrencyUSD_en} // Use English USD formatter for Y-axis numbers
                tickLine={false}
                axisLine={false}
                tickMargin={5}
                name="المبلغ (USD)" // Axis name
                // allowDataOverflow={true} // Allow points slightly outside domain if needed
             />
             {/* ZAxis is typically used for bubble size, not needed for basic scatter */}
             {/* <ZAxis type="number" range={[50, 50]} /> */}
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={
                  <ChartTooltipContent
                      // Hide the default indicator (dot/line) provided by ChartTooltipContent
                      hideIndicator={true}
                      // Custom formatter to display payment details
                      formatter={(value, name, props) => {
                           // props.payload contains the data for the hovered point
                           const payload = props.payload as ChartData | undefined;
                           if (!payload) return null;

                           return (
                             <div className="flex flex-col items-end text-xs p-1" dir="ltr"> {/* LTR for alignment */}
                                 <span className="font-semibold mb-1">{payload.clientName}</span>
                                 <span className="text-muted-foreground">{payload.dateFormatted}</span>
                                 <span className="font-medium">{formatCurrency_en(payload.amountUSD, 'USD')}</span>
                                 <span className="text-muted-foreground text-[10px]">
                                    ({formatCurrency_en(payload.originalAmount, payload.originalCurrency)})
                                 </span>
                             </div>
                           );
                      }}
                      // Hide the generic label usually derived from dataKey
                       labelFormatter={() => null}
                   />
                }
            />
            <Scatter
                name="الدفعات" // Name for the legend/tooltip series
                data={data}
                fill="var(--color-payments)" // Use theme color
                // shape="circle" // Default shape
                // You can customize the shape if needed, e.g., make it larger
                // shape={<circle r={6} />}
             />
          </ScatterChart>
       </ResponsiveContainer>
    </ChartContainer>
  )
}
