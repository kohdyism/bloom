"use client";

import { useTransition } from "react";
import { UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/overlay";
import { removeStudentAction } from "../actions";

export function RemoveStudentButton({ classId, studentId, name }: { classId: string; studentId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Remove ${name} from class`}><UserMinus /></Button>
      </DialogTrigger>
      <DialogContent title={`Remove ${name}?`} description="They'll leave this class. Their account and work in other classes are kept.">
        <div className="flex justify-end gap-2">
          <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
          <Button variant="danger" pending={pending} onClick={() => start(() => removeStudentAction(classId, studentId))}>Remove</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
