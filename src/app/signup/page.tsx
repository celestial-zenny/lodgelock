import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Sign up — LodgeLock" };

export default function SignupPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Book verified lodges near FUTO. Your rent is held until you get the keys and confirm.
      </p>
      <SignupForm />
    </main>
  );
}
