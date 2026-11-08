import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { navigation } from "@/lib/navigation";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { DataState } from "@/components/ui/data-state";
import { buttonClass } from "@/components/ui/button";

export function generateStaticParams() {
  return navigation.map((item) => ({ section: item.href.slice(1) }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  return {
    title:
      navigation.find((item) => item.href === `/${section}`)?.label ??
      "Page not found",
  };
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const item = navigation.find((entry) => entry.href === `/${section}`);
  if (!item) notFound();
  return (
    <div className="page-stack">
      <PageHeading title={item.label} description={item.description} />
      <Card>
        <DataState state="empty" title="This section is not connected yet">
          <p>
            This destination is part of the shared navigation preview.{" "}
            {item.label} functionality will be delivered separately from FP-01.
          </p>
          <p>
            No financial records, authenticated session or agent service are
            available here.
          </p>
        </DataState>
        <div className="inline-actions">
          <Link href="/" className={buttonClass("secondary")}>
            Back to command center
          </Link>
          <Link href="/ui" className={buttonClass()}>
            Explore shared UI
          </Link>
        </div>
      </Card>
    </div>
  );
}
