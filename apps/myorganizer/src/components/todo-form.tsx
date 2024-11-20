'use client';

import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Form, FormControl, FormField, FormItem, FormLabel, FormMessage, Input } from '@myorganizer/web-ui'


const todoFormSchema = z.object({
    todo: z.string().min(1),
})

const TodoForm = ({ onAddTodo }: { onAddTodo: (todo: string) => void;}) => {
    const form = useForm<z.infer <typeof todoFormSchema>>({
        resolver: zodResolver(todoFormSchema),
        defaultValues: {
            todo: '',
        }
    })

    const onSubmit = (values: z.infer<typeof todoFormSchema>) => {
        onAddTodo(values.todo)
        form.reset()
    }

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            <FormField 
                control={form.control}
                name='todo'
                render={({field}) => (
                    <FormItem>
                        <FormLabel htmlFor="todo">Todo</FormLabel>
                        <FormControl>
                            <Input placeholder='Your todo' {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        
        <Button type="submit" className='w-full'>Add</Button>
        </form>
    </Form>
  )
}

export default TodoForm