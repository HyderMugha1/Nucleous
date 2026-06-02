import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Circle, Database, Loader2, RefreshCcw, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TodoRow {
  id: string;
  name: string;
  is_complete: boolean;
  created_at: string;
}

export default function SupabaseTestPage() {
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTodoName, setNewTodoName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [workingTodoId, setWorkingTodoId] = useState<string | null>(null);

  async function loadTodos() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("todos")
      .select("id, name, is_complete, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setTodos([]);
      setLoading(false);
      return;
    }

    setTodos((data ?? []) as TodoRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadTodos();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = newTodoName.trim();
    if (!trimmedName || submitting) return;

    setSubmitting(true);
    setError(null);

    const { error } = await supabase.from("todos").insert({
      name: trimmedName,
    });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    setNewTodoName("");
    setSubmitting(false);
    await loadTodos();
  }

  async function handleToggle(todo: TodoRow) {
    setWorkingTodoId(todo.id);
    setError(null);

    const { error } = await supabase
      .from("todos")
      .update({ is_complete: !todo.is_complete })
      .eq("id", todo.id);

    if (error) {
      setError(error.message);
      setWorkingTodoId(null);
      return;
    }

    setTodos((currentTodos) =>
      currentTodos.map((currentTodo) =>
        currentTodo.id === todo.id ? { ...currentTodo, is_complete: !currentTodo.is_complete } : currentTodo,
      ),
    );
    setWorkingTodoId(null);
  }

  async function handleDelete(todoId: string) {
    setWorkingTodoId(todoId);
    setError(null);

    const { error } = await supabase.from("todos").delete().eq("id", todoId);

    if (error) {
      setError(error.message);
      setWorkingTodoId(null);
      return;
    }

    setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== todoId));
    setWorkingTodoId(null);
  }

  const completedCount = todos.filter((todo) => todo.is_complete).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold premium-heading tracking-tight flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Supabase Test
        </h1>
        <p className="text-sm text-soft">
          This page checks whether the app can read from your Supabase `todos` table.
        </p>
      </div>

      <div className="glass-premium rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary">Connection Check</p>
            <p className="text-sm text-soft">Reading and writing `public.todos` directly with the React Supabase client.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
              {loading ? "Loading" : error ? "Needs Attention" : "Connected"}
            </span>
            <Button variant="outline" size="sm" onClick={() => void loadTodos()} disabled={loading || submitting || !!workingTodoId}>
              <RefreshCcw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total Rows</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{todos.length}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Completed</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{completedCount}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pending</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{Math.max(todos.length - completedCount, 0)}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-border/40 bg-muted/20 p-4 md:flex-row">
          <Input
            value={newTodoName}
            onChange={(event) => setNewTodoName(event.target.value)}
            placeholder="Add a new todo to Supabase"
            disabled={submitting}
          />
          <Button type="submit" disabled={!newTodoName.trim() || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Add Todo
          </Button>
        </form>

        {loading && (
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-sm text-muted-foreground">
            Loading todos from Supabase...
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            <p className="font-medium mb-1">Unable to read from Supabase.</p>
            <p>{error}</p>
            <p className="mt-2 text-xs text-red-100/80">
              Make sure the `todos` table exists and your RLS policies allow select, insert, update, and delete for this test page.
            </p>
          </div>
        )}

        {!loading && !error && todos.length === 0 && (
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-sm text-muted-foreground">
            Connection worked, but the `todos` table is empty. Add your first row above.
          </div>
        )}

        {!loading && !error && todos.length > 0 && (
          <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Todos</h2>
            <ul className="space-y-2">
              {todos.map((todo) => (
                <li
                  key={todo.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-sm text-foreground"
                >
                  <button
                    type="button"
                    className="flex flex-1 items-center gap-3 text-left"
                    onClick={() => void handleToggle(todo)}
                    disabled={workingTodoId === todo.id}
                  >
                    {todo.is_complete ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className={todo.is_complete ? "text-muted-foreground line-through" : ""}>{todo.name}</span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleDelete(todo.id)}
                    disabled={workingTodoId === todo.id}
                    aria-label={`Delete ${todo.name}`}
                  >
                    {workingTodoId === todo.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
