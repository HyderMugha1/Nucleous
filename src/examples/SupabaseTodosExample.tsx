import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Todo {
  id: string;
  name: string;
}

export default function SupabaseTodosExample() {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    async function getTodos() {
      const { data: todos } = await supabase.from("todos").select();

      if (todos) {
        setTodos(todos as Todo[]);
      }
    }

    void getTodos();
  }, []);

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.name}</li>
      ))}
    </ul>
  );
}
