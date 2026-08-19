import { useEffect, useState } from "react";

export interface Route {
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
}

function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "");
  const pathPart = raw.split("?")[0] ?? "";
  const queryPart = raw.split("?")[1] ?? "";
  const segments = pathPart.split("/").filter(Boolean);
  const params: Record<string, string> = {};

  if (segments[0] === "conversations" && segments[1]) {
    params.id = segments[1];
  }

  return {
    path: `/${segments.join("/")}`,
    params,
    query: new URLSearchParams(queryPart ?? ""),
  };
}

function read(): Route {
  return parseHash(window.location.hash);
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read);

  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}

export function navigate(path: string): void {
  window.location.hash = path;
}

export function href(path: string): string {
  return `#${path}`;
}
