import { expect, it } from "vitest";
import { adoptProfileTimeFormat, getTimeFormat, initTimeFormat, setTimeFormat } from "./time-format";
it("keeps 24 hours when settings reloads an older 12-hour profile", () => {
  const values = new Map<string,string>();
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}});
  setTimeFormat("24"); adoptProfileTimeFormat("12"); initTimeFormat();
  expect(getTimeFormat()).toBe("24");
  setTimeFormat("12"); adoptProfileTimeFormat("24");
  expect(getTimeFormat()).toBe("12");
});