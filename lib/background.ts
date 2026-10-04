import { after } from "next/server";

export function keepAlive(work: Promise<unknown>) {
  try {
    after(work);
  } catch {
    void work;
  }
}
