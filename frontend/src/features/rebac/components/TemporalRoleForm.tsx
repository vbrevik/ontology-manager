

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Save } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

const formSchema = z.object({
    validFrom: z.date().optional(),
    validUntil: z.date().optional(),
    scheduleCron: z.string().optional(),
});

interface TemporalRoleFormProps {
    initialData?: {
        validFrom?: Date;
        validUntil?: Date;
        scheduleCron?: string;
    };
    onSubmit: (data: z.infer<typeof formSchema>) => void;
    isLoading?: boolean;
}

const CRON_PRESETS = [
    { label: "Business Hours (M-F 9-5)", value: "0 9-17 * * 1-5" },
    { label: "Weekends Only", value: "0 0 * * 6,0" },
    { label: "Night Shift (10pm-6am)", value: "0 22-6 * * *" },
];

export function TemporalRoleForm({ initialData, onSubmit, isLoading }: TemporalRoleFormProps) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            validFrom: initialData?.validFrom,
            validUntil: initialData?.validUntil,
            scheduleCron: initialData?.scheduleCron || '',
        },
    });

    function handleSubmit(values: z.infer<typeof formSchema>) {
        onSubmit(values);
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="validFrom"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Valid From</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full pl-3 text-left font-normal",
                                                    !field.value && "text-muted-foreground"
                                                )}
                                            >
                                                {field.value ? (
                                                    format(field.value, "PPP")
                                                ) : (
                                                    <span>Pick a date</span>
                                                )}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            initialFocus
                                            className="rounded-md border"
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormDescription>
                                    Role becomes active on this date.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="validUntil"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Valid Until</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full pl-3 text-left font-normal",
                                                    !field.value && "text-muted-foreground"
                                                )}
                                            >
                                                {field.value ? (
                                                    format(field.value, "PPP")
                                                ) : (
                                                    <span>Pick a date</span>
                                                )}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            initialFocus
                                            className="rounded-md border"
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormDescription>
                                    Role expires on this date.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="space-y-4">
                    <FormField
                        control={form.control}
                        name="scheduleCron"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Recurring Schedule (CRON)</FormLabel>
                                <div className="flex gap-2">
                                    <FormControl>
                                        <Input placeholder="* * * * *" {...field} />
                                    </FormControl>
                                    <Select onValueChange={field.onChange}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Presets" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CRON_PRESETS.map((p) => (
                                                <SelectItem key={p.value} value={p.value}>
                                                    {p.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <FormDescription>
                                    Standard CRON expression for recurring active windows.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <Button type="submit" disabled={isLoading} className="w-full">
                    <Save className="mr-2 h-4 w-4" /> Save Schedule
                </Button>
            </form>
        </Form>
    );
}
