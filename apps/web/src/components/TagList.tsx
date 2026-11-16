"use client";

import { useState } from "react";
import { Icon } from "@fluxo/ui-web";

/** Editable list of short texts (doenças, cirurgias). Values travel as hidden inputs of the client form. */
export function TagList({ title, name, formId, initial, placeholder }: { title: string; name: string; formId: string; initial: string[]; placeholder: string }) {
  const [items, setItems] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim();
    if (!value || items.includes(value)) return setDraft("");
    setItems([...items, value]);
    setDraft("");
  }

  return (
    <>
      <h2 className="t-h3">{title}</h2>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {items.length === 0 && <span className="t-small muted">Nada registrado.</span>}
        {items.map((item) => (
          <span className="tag" key={item}>
            {item}
            <button type="button" aria-label={`Remover ${item}`} onClick={() => setItems(items.filter((i) => i !== item))}>
              <Icon name="x" size={14} />
            </button>
            <input type="hidden" name={name} value={item} form={formId} />
          </span>
        ))}
      </div>
      <div className="inwrap">
        <input
          className="input"
          aria-label={placeholder}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          style={{ height: 40, paddingRight: 44 }}
        />
        <button className="ibtn trail" type="button" aria-label="Adicionar" onClick={add} style={{ width: 32, height: 32, right: 4 }}>
          <Icon name="plus" size={16} />
        </button>
      </div>
    </>
  );
}
