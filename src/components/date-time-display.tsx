
'use client';

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, CalendarDays } from 'lucide-react';

export const DateTimeDisplay: FC = () => {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    // Set initial time
    setCurrentTime(new Date());
    // Update time every second
    const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
    // Cleanup timer on component unmount
    return () => clearInterval(timerId);
  }, []);

  if (!currentTime) {
    return (
        <Card className="mb-6 shadow-md border border-primary/20 bg-primary/5 rounded-lg">
            <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row justify-between items-center text-foreground">
                    <div className="flex items-center mb-2 sm:mb-0">
                        <CalendarDays className="h-5 w-5 mr-2 animate-pulse" />
                        <span className="font-medium">جاري تحميل التاريخ...</span>
                    </div>
                    <div className="flex items-center">
                        <Clock className="h-5 w-5 mr-2 animate-pulse" />
                        <span className="font-mono font-medium text-lg">--:--:--</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
  }

  const formattedTime = format(currentTime, 'HH:mm:ss', { locale: arSA });
  const formattedDate = format(currentTime, 'EEEE, d MMMM yyyy', { locale: arSA });

  return (
    <Card className="mb-6 shadow-md border border-primary/20 bg-primary/5 rounded-lg">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row justify-between items-center text-foreground">
          <div className="flex items-center mb-2 sm:mb-0">
            <CalendarDays className="h-5 w-5 mr-2" />
            <span className="font-medium">{formattedDate}</span>
          </div>
          <div className="flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            <span className="font-mono font-medium text-lg">{formattedTime}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
