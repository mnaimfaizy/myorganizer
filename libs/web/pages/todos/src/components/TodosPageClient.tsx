'use client';

import type { Todo } from '@myorganizer/core';
import { randomId } from '@myorganizer/core';
import { useToast } from '@myorganizer/web-ui';
import {
  loadDecryptedData,
  normalizeTodos,
  saveEncryptedData,
} from '@myorganizer/web-vault';
import { VaultGate } from '@myorganizer/web-vault-ui';
import { useEffect, useState } from 'react';

import TodoForm from './todo-form';
import TodoItem from './todo-item';

function TodosInner(props: { masterKeyBytes: Uint8Array }) {
  const { toast } = useToast();

  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    loadDecryptedData<unknown>({
      masterKeyBytes: props.masterKeyBytes,
      type: 'todos',
      defaultValue: [],
    })
      .then(async (raw) => {
        const normalized = normalizeTodos(raw);
        setTodos(normalized.value);
        if (normalized.changed) {
          await saveEncryptedData({
            masterKeyBytes: props.masterKeyBytes,
            type: 'todos',
            value: normalized.value,
          });
        }
      })
      .catch(() => {
        toast({
          title: 'Failed to load todos',
          description: 'Could not decrypt saved data.',
          variant: 'destructive',
        });
      });
  }, [props.masterKeyBytes, toast]);

  async function persist(next: Todo[]) {
    setTodos(next);
    try {
      await saveEncryptedData({
        masterKeyBytes: props.masterKeyBytes,
        type: 'todos',
        value: next,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toast({
        title: 'Failed to save',
        description: message,
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="flex sm:flex-row flex-col sm:justify-between gap-2 flex-1 p-2 pt-0">
      <div className="sm:w-1/2 w-full p-3 bg-slate-100 rounded-lg">
        <h2 className="text-center text-lg pt-3 font-semibold">
          Create to do item
        </h2>
        <div className="mt-8">
          <TodoForm
            onAddTodo={async (todoText) => {
              const nextItem: Todo = {
                id: randomId(),
                todo: todoText,
              };
              await persist([nextItem, ...todos]);
              toast({
                title: 'Todo added',
                description: 'Your todo has been added (encrypted).',
              });
            }}
          />
        </div>
      </div>

      <div className="sm:w-1/2 w-full rounded-lg border bg-white">
        <h2 className="text-center text-lg pt-3 font-semibold">Todo List</h2>
        <div className="py-3 space-y-2 px-3">
          {todos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onDeleteTodo={async (id) => {
                const next = todos.filter((t) => t.id !== id);
                await persist(next);
                toast({
                  title: 'Todo deleted',
                  description: 'Your todo has been deleted.',
                });
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TodosPageClient() {
  return (
    <VaultGate title="Todos">
      {({ masterKeyBytes }) => <TodosInner masterKeyBytes={masterKeyBytes} />}
    </VaultGate>
  );
}
