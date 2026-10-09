import { redirect } from "next/navigation";

/**
 * The app opens on the quote list - the screen staff actually need when a
 * customer is standing in front of them. The product catalog lives at /catalog.
 */
export default function Home() {
  redirect("/quotes");
}
