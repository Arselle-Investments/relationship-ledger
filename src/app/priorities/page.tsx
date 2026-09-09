import { redirect } from "next/navigation";

// Priorities was split into Target Companies and Target Contacts — this
// route stays around only so old bookmarks/links still land somewhere.
export default function PrioritiesRedirect() {
  redirect("/target-companies");
}
