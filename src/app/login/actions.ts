"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createUserClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/redirects";

export type LoginState = { error?: string; email?: string } | null;

const LoginSchema = z.object({
  email: z.email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(72),
  next: z.string().optional(),
});

export async function logIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  const email = typeof formData.get("email") === "string" ? (formData.get("email") as string) : "";
  if (!parsed.success) return { error: "Enter your email and password.", email };

  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    if (error.status === 429) return { error: "Too many attempts. Please wait a few minutes.", email };
    if (error.code === "email_not_confirmed") {
      return { error: "Confirm your email first. Check your inbox for the link.", email };
    }
    return { error: "Email or password is incorrect.", email };
  }
  redirect(safeNext(parsed.data.next));
}

export async function signOut() {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  redirect("/");
}
