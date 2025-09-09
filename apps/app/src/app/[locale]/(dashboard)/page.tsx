"use client";

import { SignOut } from "@/components/sign-out";
import { Posts } from "@/components/posts";
import { useI18n } from "@/locales/client";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@v1/firebase";
import { Button } from "@v1/ui/button";
import { Textarea } from "@v1/ui/textarea";
import { createPostAction } from "@/actions/user/create-post-action";
import { useRef } from "react";

export default function Page() {
  const [user] = useAuthState(auth);
  const t = useI18n();
  const formRef = useRef<HTMLFormElement>(null);

  const handleCreatePost = async (formData: FormData) => {
    const text = formData.get("text") as string;
    if (!text) return;

    const result = await createPostAction({ text });

    if (result?.serverError) {
      alert(`Server Error: ${result.serverError}`);
    } else {
      // Reset the form on successful post creation
      formRef.current?.reset();
    }
  };

  return (
    <main className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">
          {t("welcome", { name: user?.email ?? "User" })}
        </h1>
        <SignOut />
      </div>

      <div className="max-w-md mx-auto">
        <form ref={formRef} action={handleCreatePost} className="space-y-4 mb-8">
          <Textarea
            name="text"
            placeholder="What's on your mind?"
            required
            className="font-mono"
          />
          <Button type="submit" className="font-mono w-full">
            Post
          </Button>
        </form>

        <Posts />
      </div>
    </main>
  );
}
