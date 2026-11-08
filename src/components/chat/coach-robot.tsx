"use client";

import { lazy, Suspense, useEffect, useRef, useSyncExternalStore } from "react";
import { Bot } from "lucide-react";

// three.js is only downloaded when a WebGL-capable browser shows the coach.
const RobotAvatar = lazy(() => import("@/components/ui/robot-avatar"));

let webglSupport: boolean | undefined;
function supportsWebGL() {
  return (webglSupport ??= detectWebGL());
}
function detectWebGL() {
  // jsdom and very old browsers have no WebGL constructor; skip before touching a canvas.
  if (typeof window === "undefined" || !("WebGLRenderingContext" in window))
    return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

const noSubscribe = () => () => {};
const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia?.(REDUCED);
  query?.addEventListener?.("change", onChange);
  return () => query?.removeEventListener?.("change", onChange);
}
const prefersMotion = () => !window.matchMedia?.(REDUCED).matches;

/** Decorative 3D coach that follows the pointer and pulses while a reply is pending. */
export function CoachRobot({ thinking }: { thinking: boolean }) {
  const stage = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  // Server render and first hydration use the fallback icon; the client then upgrades.
  const webgl = useSyncExternalStore(noSubscribe, supportsWebGL, () => false);
  const animate = useSyncExternalStore(subscribeMotion, prefersMotion, () => false);

  useEffect(() => {
    if (!webgl || !animate) return;
    const move = (event: PointerEvent) => {
      const rect = stage.current?.getBoundingClientRect();
      if (!rect) return;
      const clamp = (v: number) => Math.max(-1.4, Math.min(1.4, v));
      pointer.current = {
        x: clamp(((event.clientX - rect.left) / rect.width) * 2 - 1),
        y: clamp(-(((event.clientY - rect.top) / rect.height) * 2 - 1)),
      };
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [webgl, animate]);

  return (
    <div className={`coach-robot${thinking ? " coach-robot--thinking" : ""}`}>
      <div className="coach-robot-stage" ref={stage} aria-hidden="true">
        {webgl ? (
          <Suspense fallback={<Bot className="coach-robot-fallback" size={56} />}>
            <RobotAvatar pointer={pointer} mood={thinking ? "thinking" : "idle"} animate={animate} />
          </Suspense>
        ) : (
          <Bot className="coach-robot-fallback" size={56} />
        )}
      </div>
      <div className="coach-robot-copy">
        <p className="coach-robot-name">FinPilot coach</p>
        <p className="coach-robot-state">
          <span className="coach-robot-dot" aria-hidden="true" />
          {thinking ? "Reading your records…" : "Ready when you are"}
        </p>
        <p className="coach-robot-note small">
          Answers come from your selected simulated accounts and saved findings.
        </p>
      </div>
    </div>
  );
}
