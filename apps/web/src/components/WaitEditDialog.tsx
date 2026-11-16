"use client";

import { useCallback, useState } from "react";
import { updateWaitEntry } from "@/app/(app)/espera/actions";
import type { Period } from "@/lib/waitlist";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { WaitForm } from "./WaitForm";

/** The edit button of a wait list row and its dialog. Opens and closes from local state, so it is instant. */
export function WaitEditDialog({
  id, name, phone, period, modalityId, modalities,
}: {
  id: string;
  name: string;
  phone: string;
  period: Period;
  modalityId: string;
  modalities: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" className="ibtn" aria-label={`Editar ${name}`} onClick={() => setOpen(true)}>
        <Icon name="edit" />
      </button>
      {open && (
        <Modal title="Editar pessoa da lista" onClose={close} width={520}>
          <WaitForm action={updateWaitEntry.bind(null, id)} initial={{ name, phone, period, modalityId }} modalities={modalities} onClose={close} />
        </Modal>
      )}
    </>
  );
}
