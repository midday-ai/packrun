"use client";

import { db } from "@v1/firebase";
import { collection, orderBy, query } from "firebase/firestore";
import { useCollection } from "react-firebase-hooks/firestore";
import { Icons } from "@v1/ui/icons";

export function Posts() {
  const [value, loading, error] = useCollection(
    query(collection(db, "posts"), orderBy("createdAt", "desc"))
  );

  if (error) {
    return <p className="text-red-500">Error: {error.message}</p>;
  }

  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <Icons.Spinner className="size-6 animate-spin" />
      </div>
    );
  }

  if (!value || value.docs.length === 0) {
    return <p className="text-center p-4">No posts yet. Be the first to post!</p>;
  }

  return (
    <div className="space-y-4 p-4 border rounded-md">
      {value.docs.map((doc) => (
        <div key={doc.id} className="p-2 border-b">
          <p>{doc.data().text}</p>
          <p className="text-xs text-gray-500">
            {new Date(doc.data().createdAt.seconds * 1000).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
