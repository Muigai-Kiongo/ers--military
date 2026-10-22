import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export default async function Page() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: todos, error } = await supabase.from("todos").select();

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Supabase Todos</h1>
      {error && <p style={{ color: "red" }}>Error: {error.message}</p>}
      <ul>
        {todos?.map((todo: { id: string | number; name?: string }) => (
          <li key={todo.id}>{todo.name}</li>
        ))}
      </ul>
    </div>
  );
}
