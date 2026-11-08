import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="page-stack">
      <PageHeading
        title="Page not found"
        description="This page is not part of the FinPilot workspace."
      />
      <div>
        <Link className={buttonClass()} href="/">
          Return to command center
        </Link>
      </div>
    </div>
  );
}
