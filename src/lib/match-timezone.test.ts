import {expect,it} from "vitest";
import {getMatchTimezone,setMatchTimezone} from "./match-timezone";
it("adopts a connection timezone, including a VPN exit zone, and clears stale location on fallback",()=>{
 setMatchTimezone("America/New_York");expect(getMatchTimezone()).toBe("America/New_York");
 const time = new Intl.DateTimeFormat("en-US",{timeZone:getMatchTimezone(),hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date("2026-10-28T14:30:00Z"));
 expect(time).toBe("10:30");
 setMatchTimezone("Asia/Kuwait");expect(new Intl.DateTimeFormat("en-US",{timeZone:getMatchTimezone(),hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date("2026-10-28T14:30:00Z"))).toBe("17:30");
 setMatchTimezone(null);expect(getMatchTimezone()).toBeUndefined();
});