
'use client';

import type { FC } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface MonthNavigationProps {
  selectedDate: Date;
  onMonthChange: (newDate: Date) => void;
}

export const MonthNavigation: FC<MonthNavigationProps> = ({ selectedDate, onMonthChange }) => {
  const handlePreviousMonth = () => {
    onMonthChange(subMonths(selectedDate, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(addMonths(selectedDate, 1));
  };

  const formattedMonthYear = format(selectedDate, 'MMMM yyyy', { locale: arSA });

  return (
    <Card className="mb-6 shadow-sm border border-border rounded-lg">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" onClick={handlePreviousMonth} aria-label="الشهر السابق">
            <ChevronRight className="h-5 w-5" />
          </Button>
          <span className="text-lg font-semibold text-foreground">
            {formattedMonthYear}
          </span>
          <Button variant="outline" size="icon" onClick={handleNextMonth} aria-label="الشهر التالي">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
