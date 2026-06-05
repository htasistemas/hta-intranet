import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, Edit3, FolderKanban, GripVertical, Trash2 } from "lucide-react";
import { format } from "date-fns";
import type { Task, TaskStatus } from "@/types";
import { cn } from "@/lib/utils";

export interface TaskColumn { id: string; title: string; status: TaskStatus; position: number; }

const priorityLabels: Record<Task["priority"], string> = {
  LOW: "Baixa",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente"
};

const priorityStyles: Record<Task["priority"], string> = {
  LOW: "bg-slate-500/15 text-slate-300",
  MEDIUM: "bg-blue-500/15 text-blue-300",
  HIGH: "bg-amber-500/15 text-amber-300",
  URGENT: "bg-red-500/15 text-red-300"
};

function isOverdue(task: Task): boolean {
  return Boolean(task.dueDate && task.status !== "COMPLETED" && new Date(task.dueDate) < new Date());
}

function TaskCard({ task, onEdit, onDelete }: { task: Task; onEdit: (task: Task) => void; onDelete: (task: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("rounded-xl border border-slate-700 bg-card p-3 shadow-sm transition hover:border-slate-600", isDragging && "z-10 opacity-70 shadow-2xl")}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className={cn("rounded-full px-2 py-1 text-[11px]", priorityStyles[task.priority])}>{priorityLabels[task.priority]}</span>
        <div className="flex items-center gap-1">
          <button className="rounded-lg p-1 text-slate-400 transition hover:bg-white/5 hover:text-foreground" onClick={() => onEdit(task)} aria-label="Editar tarefa"><Edit3 size={15} /></button>
          <button className="rounded-lg p-1 text-red-300 transition hover:bg-red-500/10" onClick={() => onDelete(task)} aria-label="Excluir tarefa"><Trash2 size={15} /></button>
          <button className="rounded-lg p-1 text-slate-500 transition hover:bg-white/5 hover:text-foreground" {...listeners} {...attributes} aria-label="Arrastar tarefa"><GripVertical size={17} /></button>
        </div>
      </div>
      <h3 className="text-sm font-medium leading-5">{task.title}</h3>
      {task.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{task.description}</p>}
      <div className="mt-3 space-y-2 text-xs text-slate-400">
        {task.client && <p>{task.client.name}</p>}
        {task.project && <p className="flex items-center gap-1 text-accent"><FolderKanban size={13} /> {task.project.code} - {task.project.name}</p>}
        {task.dueDate && <p className={cn("flex items-center gap-1", isOverdue(task) && "text-red-300")}><CalendarClock size={13} /> {format(new Date(task.dueDate), "dd/MM/yyyy")}</p>}
      </div>
    </article>
  );
}

function Column({ column, tasks, onEdit, onDelete }: { column: TaskColumn; tasks: Task[]; onEdit: (task: Task) => void; onDelete: (task: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const completed = column.status === "COMPLETED";
  return (
    <section ref={setNodeRef} className={cn("flex min-h-[560px] w-[310px] shrink-0 flex-col rounded-xl border border-slate-700 bg-sidebar/70", isOver && "border-accent ring-1 ring-accent/40")}>
      <header className="sticky top-0 z-10 rounded-t-xl border-b border-slate-700 bg-sidebar/95 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{column.title}</h2>
          <span className={cn("rounded-full px-2 py-1 text-xs", completed ? "bg-emerald-500/15 text-emerald-300" : "bg-card text-slate-300")}>{tasks.length}</span>
        </div>
      </header>
      <div className="flex-1 space-y-3 p-3">
        {tasks.length === 0 ? (
          <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-slate-700 text-center text-xs text-slate-500">Solte uma tarefa aqui</div>
        ) : tasks.map((task) => <TaskCard task={task} key={task.id} onEdit={onEdit} onDelete={onDelete} />)}
      </div>
    </section>
  );
}

export function KanbanBoard({ columns, tasks, onMove, onEdit, onDelete }: { columns: TaskColumn[]; tasks: Task[]; onMove: (task: Task, column: TaskColumn) => void; onEdit: (task: Task) => void; onDelete: (task: Task) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const end = ({ active, over }: DragEndEvent): void => {
    const task = tasks.find((item) => item.id === active.id);
    const column = columns.find((item) => item.id === over?.id);
    if (task && column && task.columnId !== column.id) onMove(task, column);
  };
  const sortedColumns = [...columns].sort((left, right) => left.position - right.position);
  return (
    <DndContext sensors={sensors} onDragEnd={end}>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4">
          {sortedColumns.map((column) => <Column key={column.id} column={column} tasks={tasks.filter((task) => task.columnId === column.id)} onEdit={onEdit} onDelete={onDelete} />)}
        </div>
      </div>
    </DndContext>
  );
}
