"use client";
import Link from "next/link";
import {Button} from "./ui/button";
import {Card} from "./ui/card";
export function DecisionControls(){return <Card><h2>Need a hand?</h2><p className="muted">Review your accounts or ask a question.</p><div className="inline-actions"><Link className="button button--secondary" href="/accounts">View accounts</Link><Button onClick={()=>window.dispatchEvent(new Event("finpilot:open-chat"))}>Ask FinPilot</Button></div></Card>;}
