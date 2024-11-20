"use client";

import React from 'react'
import { Card, CardContent, CardTitle, Form, useToast } from "@myorganizer/web-ui";
import TodoForm from "./todo-form";
import { useState } from "react";
import TodoItem from "./todo-item";
import { Todo } from "@myorganizer/core";

const TodoContent = () => {
    const { toast } = useToast();

    const [todos, setTodos] = useState<Todo[]>([]);
    
    const handleAddTodo = (todo: string) => {
        setTodos([...todos, {todo, id: Math.random().toString()}]);
        toast({
            title: 'Todo added',
            description: 'Your todo has been added',
        })
    }

  return (
    <div className="flex sm:flex-row flex-col sm:justify-between gap-2 flex-1 p-2 pt-0">
    <Card className="sm:w-1/2 w-full p-3 bg-slate-100">
        <CardTitle className="text-center text-lg pt-3">Create to do item</CardTitle>
        <CardContent className="mt-8">
            <TodoForm onAddTodo={handleAddTodo} />
        </CardContent>
    </Card>

    <Card className="sm:w-1/2 w-full">
        <CardTitle className="text-center text-lg pt-3">Todo List</CardTitle>
        <CardContent className="py-3 space-y-2">
            {todos.map((todo) => (
                <TodoItem key={todo.id} todo={todo} onDeleteTodo={(id) => setTodos(todos.filter((todo) => todo.id.toString() !== id))} />
            ))}
        </CardContent>
    </Card>
</div>
  )
}

export default TodoContent