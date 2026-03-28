"use client";

import { useFormStatus } from "react-dom";
import { deleteBoxAction } from "@/app/boxes/[boxId]/actions";

type DeleteBoxFormProps = {
  boxId: string;
  ui: Record<string, string>;
};

function SubmitButton({ ui }: { ui: Record<string, string> }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="button secondary" disabled={pending}>
      {pending ? ui.deleting : ui.delete}
    </button>
  );
}

export function DeleteBoxForm({ boxId, ui }: DeleteBoxFormProps) {
  return (
    <form
      action={deleteBoxAction}
      className="action-row"
      onSubmit={(event) => {
        if (!window.confirm(ui.confirm)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="boxId" value={boxId} />
      <SubmitButton ui={ui} />
    </form>
  );
}
