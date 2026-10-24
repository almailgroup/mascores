import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

export const connectionTimezone = createServerFn({ method: "GET" }).handler(() => {
  setResponseHeader("Cache-Control", "private, no-store");
  const request = getRequest() as Request & { cf?: { timezone?: string } };
  const timezone = request.cf?.timezone;
  if (!timezone) return null;
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }); return timezone; } catch { return null; }
});