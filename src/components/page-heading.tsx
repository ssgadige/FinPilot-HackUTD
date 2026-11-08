import type { ReactNode } from "react";

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const concise:Record<string,string>={
    "A clearer next move starts here":"Your balances, bills and next steps.",
    "Your recurring costs, made visible":"Track subscriptions and review your options.",
    "Your priorities, coordinated":"Set goals and review your progress.",
    "Give every payment a purpose":"Review debt and compare payment options.",
    "Your financial team, with visible evidence":"Financial insights, with the details behind them.",
    "Rehearse the unexpected":"See how a change could affect your cash.",
    "Your month, before it happens":"Upcoming bills and projected balances.",
    "Connect your financial picture":"Manage the institutions behind your accounts.",
  };
  return (
    <div className="page-heading">
      <div>

        <h1>{title}</h1>
        <p className="muted">{concise[title] ?? (description.length>105 ? description.split(".")[0].split(" ").slice(0,13).join(" ")+"." : description)}</p>
      </div>
      {action}
    </div>
  );
}
