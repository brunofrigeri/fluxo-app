"use client";

import { useCallback, useState } from "react";
import { inviteUser, updateUser } from "@/app/(app)/usuarios/actions";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { UserForm, type UserValues } from "./UserForm";

type Props = {
  modalities: { id: string; name: string }[];
} & ({ mode: "invite" } | { mode: "edit"; userId: string; name: string; values: UserValues });

/** The invite / edit button and its dialog. Opens and closes from local state, so it is instant. */
export function UserDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const invite = props.mode === "invite";

  return (
    <>
      {invite ? (
        <button type="button" className="btn pri" onClick={() => setOpen(true)}>
          <Icon name="plus" size={16} />
          Convidar usuário
        </button>
      ) : (
        <button type="button" className="ibtn" aria-label="Editar" onClick={() => setOpen(true)}>
          <Icon name="edit" />
        </button>
      )}
      {open && (
        <Modal title={invite ? "Convidar usuário" : `Editar ${props.name}`} onClose={close}>
          {props.mode === "invite" ? (
            <UserForm mode="invite" action={inviteUser} values={{ name: "", email: "", role: "instructor", working_hours: "", modality_ids: [] }} modalities={props.modalities} onClose={close} />
          ) : (
            <UserForm mode="edit" action={updateUser.bind(null, props.userId)} values={props.values} modalities={props.modalities} onClose={close} />
          )}
        </Modal>
      )}
    </>
  );
}
