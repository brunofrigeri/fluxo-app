"use client";

import { useEffect, useState, useTransition } from "react";
import { getDialogClientsAction } from "@/app/(app)/actions";
import { AddBookingDialog } from "./AddBookingDialog";
import { AgendaEvent } from "./AgendaEvent";
import { Icon } from "@fluxo/ui-web";
import type { AgendaBooking } from "@/lib/queries/agenda";
import { weekdayShortUpper, dayNumber } from "@fluxo/domain";
import type { DialogClient } from "@/lib/queries/agenda";
import type { Modality } from "@/lib/modalities";

type Add = { date: string; hour: number; clientId?: string; missId?: string; slotCount?: number; modalityId?: string };

export function AgendaBoard({
  colsCls, days, byDate, today, nowTop, hours, rowPx, compact, initialAdd, initialClients, modalities, filterModalityId, isAdmin, chipInstructor, belowHeader,
}: {
  colsCls: string;
  days: string[];
  byDate: Map<string, AgendaBooking[]>;
  today: string;
  nowTop: number;
  hours: number[];
  rowPx: number;
  compact: boolean;
  initialAdd: Add | null;
  initialClients: DialogClient[] | null;
  modalities: Modality[];
  /** The agenda's modality filter: new bookings start in it. */
  filterModalityId?: string;
  isAdmin: boolean;
  /** Show each booking's instructor on its chip (admin looking at everyone). */
  chipInstructor: boolean;
  /** Rendered between the day headings and the hours (the "Vencem" strip of the payments chip). */
  belowHeader?: React.ReactNode;
}) {
  const [add, setAdd] = useState<Add | null>(initialAdd);
  const [clients, setClients] = useState<DialogClient[] | null>(initialClients);
  const [, startLoad] = useTransition();
  const cameFromUrl = initialAdd !== null;

  // Load the client list as soon as the agenda is on screen, so "+" opens the dialog with it ready
  // instead of waiting on the server after the tap.
  useEffect(() => {
    if (clients === null) {
      startLoad(async () => {
        const c = await getDialogClientsAction();
        setClients(c);
      });
    }
  }, [clients]);

  function openAdd(date: string, hour: number) {
    const slotCount = (byDate.get(date) ?? []).filter((b) => b.hour === hour).length;
    setAdd({ date, hour, slotCount, modalityId: filterModalityId });
  }

  function close() {
    setAdd(null);
    if (cameFromUrl && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("novo");
      url.searchParams.delete("cliente");
      url.searchParams.delete("reposicao");
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }
  }

  return (
    <>
      <div className={colsCls} style={{ display: "grid", borderBottom: "1px solid var(--line)" }}>
        <div />
        {days.map((day) => {
          const isToday = day === today;
          return (
            <div key={day} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "10px 4px", borderLeft: "1px solid var(--line)" }}>
              <span className={`t-tiny ${isToday ? "" : "faint"}`}>{weekdayShortUpper(day)}</span>
              <span className={isToday ? "tdy" : ""} style={{ minWidth: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 18 }}>
                {dayNumber(day)}
              </span>
            </div>
          );
        })}
      </div>

      {belowHeader}

      <div className={colsCls} style={{ display: "grid", paddingTop: 10 }}>
        <div className="hours">
          {hours.map((h) => (
            <div key={h}>{String(h).padStart(2, "0")}:00</div>
          ))}
        </div>
        {days.map((day) => {
          const list = byDate.get(day) ?? [];
          const isToday = day === today;
          return (
            <div key={day} className={`daycol${isToday ? " today" : ""}`}>
              {isToday && nowTop >= 0 && nowTop <= hours.length * rowPx && <div className="nowline" style={{ top: nowTop }} />}
              {hours.map((h) => {
                const slot = list.filter((b) => b.hour === h);
                const row = h - hours[0] + 1;
                return slot.length > 0 ? (
                  <AgendaEvent key={h} bookings={slot} compact={compact} onAdd={() => openAdd(day, h)} row={row} isAdmin={isAdmin} chipInstructor={chipInstructor} />
                ) : (
                  <button
                    key={h}
                    type="button"
                    onClick={() => openAdd(day, h)}
                    className={`addslot gr${row}`}
                    aria-label={`Adicionar cliente em ${day.slice(8)}/${day.slice(5, 7)}, ${String(h).padStart(2, "0")}:00`}
                  >
                    <Icon name="plus" size={20} />
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {add && (
        <AddBookingDialog
          key={`${add.date}_${add.hour}-${add.clientId ?? ""}-${add.missId ?? ""}`}
          onClose={close}
          onCreated={close}
          clients={clients}
          initialDate={add.date}
          initialHour={add.hour}
          initialClientId={add.clientId}
          initialMissId={add.missId}
          slotCount={add.slotCount}
          modalities={modalities}
          initialModalityId={add.modalityId}
        />
      )}
    </>
  );
}
