import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays, addMonths, ageFrom, formatLong, formatMonthYear, formatShort, greeting, initialsOf, isPresent, isStatus,
  isValidISO, maskPhone, mondayOf, todayISO, waitSchema, weekdayOf,
} from "../src";

test("dates are plain calendar dates", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addMonths("2026-12-15", 1), "2027-01-01");
  assert.equal(weekdayOf("2026-10-05"), 1); // Monday
  assert.equal(mondayOf("2026-10-11"), "2026-10-05"); // Sunday -> previous Monday
  assert.equal(isValidISO("2026-02-30"), false);
  assert.equal(isValidISO("2026-02-28"), true);
});

test("dates are written in pt-BR", () => {
  assert.equal(formatShort("2026-10-05"), "Seg 05/10");
  assert.equal(formatLong("2026-10-05"), "Segunda-feira, 05/10/2026");
  assert.equal(formatLong("2026-10-10"), "Sábado, 10/10/2026");
  assert.equal(formatMonthYear("2026-10-05"), "Outubro de 2026");
});

test("today and greeting use the studio time zone (America/Sao_Paulo)", () => {
  const lateUtc = new Date("2026-10-06T01:30:00Z"); // 22:30 on the 5th in Sao Paulo
  assert.equal(todayISO(lateUtc), "2026-10-05");
  assert.equal(greeting(lateUtc), "Boa noite");
  assert.equal(greeting(new Date("2026-10-05T12:00:00Z")), "Bom dia"); // 09:00
});

test("age counts whole years", () => {
  assert.equal(ageFrom("2000-10-06", "2026-10-05"), 25);
  assert.equal(ageFrom("2000-10-05", "2026-10-05"), 26);
  assert.equal(ageFrom(null, "2026-10-05"), null);
  assert.equal(initialsOf("maria da silva souza"), "MD");
});

test("phone mask", () => {
  assert.equal(maskPhone("11900001234"), "(11) 90000-1234");
  assert.equal(maskPhone("1130001234"), "(11) 3000-1234");
  assert.equal(maskPhone(""), "");
});

test("attendance rules", () => {
  assert.equal(isPresent("REPLACEMENT"), true);
  assert.equal(isPresent("JUSTIFIED_MISS"), false);
  assert.equal(isPresent(null), false);
  assert.equal(isStatus("NOPE"), false);
});

test("wait list schema reports pt-BR messages", () => {
  const r = waitSchema.safeParse({ name: "A", phone: "12", period: "X", modalityId: "no" });
  assert.equal(r.success, false);
  if (!r.success) {
    const m = r.error.issues.map((i) => i.message);
    assert.ok(m.includes("Informe o nome.") && m.includes("Informe um telefone válido.") && m.includes("Escolha o período."));
  }
});

import { daysOverdue, dueDateIn, isOverdue, isValidBillingDay, nextDueDate } from "../src";

test("payment due dates follow the billing day, and the last day of shorter months", () => {
  assert.equal(dueDateIn("2026-03-15", 10), "2026-03-10");
  assert.equal(dueDateIn("2026-02-01", 31), "2026-02-28");
  assert.equal(dueDateIn("2028-02-01", 31), "2028-02-29");
  assert.equal(dueDateIn("2026-04-01", 31), "2026-04-30");
  assert.equal(nextDueDate(10, "2026-03-10"), "2026-03-10"); // due today is still ahead
  assert.equal(nextDueDate(10, "2026-03-11"), "2026-04-10");
  assert.equal(nextDueDate(31, "2026-12-31"), "2026-12-31");
  assert.equal(nextDueDate(5, "2026-12-20"), "2027-01-05");
  assert.equal(nextDueDate(31, "2027-01-31"), "2027-01-31");
  assert.equal(nextDueDate(30, "2027-01-31"), "2027-02-28");
});

test("overdue is past due and not paid; an explicit 'unpaid' is still owed", () => {
  assert.equal(isOverdue("2026-03-10", "pending", "2026-03-11"), true);
  assert.equal(isOverdue("2026-03-10", "unpaid", "2026-03-11"), true);
  assert.equal(isOverdue("2026-03-10", "paid", "2026-03-11"), false);
  assert.equal(isOverdue("2026-03-10", "pending", "2026-03-10"), false); // due today is not late yet
  assert.equal(daysOverdue("2026-03-10", "2026-03-13"), 3);
  assert.equal(daysOverdue("2026-03-10", "2026-03-10"), 0);
  assert.equal(isValidBillingDay(31) && !isValidBillingDay(32) && !isValidBillingDay(0) && !isValidBillingDay(1.5), true);
});
