import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, GripVertical, UserRound } from "lucide-react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { cn, currency } from "@/lib/utils";
import type { CrmLead, CrmPipelineStage, CrmProject, CrmProjectStatus } from "@/types/crm";

export const pipelineColumns: Array<{ id: CrmPipelineStage; title: string }> = [
  { id: "LEAD_RECEIVED", title: "Leads de Entrada" },
  { id: "FIRST_CONTACT", title: "Primeiro Contato" },
  { id: "QUALIFICATION", title: "Convite para Agendar" },
  { id: "DEMONSTRATION", title: "Agendado" },
  { id: "PROPOSAL_SENT", title: "Proposta Enviada" },
  { id: "NEGOTIATION", title: "Negociacao" },
  { id: "APPROVAL", title: "Fechamento" },
  { id: "IMPLEMENTATION", title: "Acompanhamento" },
  { id: "SALE_COMPLETED", title: "Vendido" },
  { id: "LOST", title: "Perdido" }
];

export const projectColumns: Array<{ id: CrmProjectStatus; title: string }> = [
  { id: "NOT_STARTED", title: "Nao Iniciado" },
  { id: "PLANNING", title: "Planejamento" },
  { id: "IN_DEVELOPMENT", title: "Em Desenvolvimento" },
  { id: "IN_TESTS", title: "Em Testes" },
  { id: "IN_APPROVAL", title: "Em Homologacao" },
  { id: "IN_DEPLOYMENT", title: "Em Implantacao" },
  { id: "IN_TRAINING", title: "Em Treinamento" },
  { id: "COMPLETED", title: "Concluido" },
  { id: "CANCELLED", title: "Cancelado" }
];

function dateLabel(value: string | null): string {
  return value ? format(new Date(value), "dd/MM/yyyy") : "Sem data";
}

function LeadCard({ lead, onOpenLead }: { lead: CrmLead; onOpenLead?: (lead: CrmLead) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("rounded-xl border border-slate-700 bg-sidebar p-3 shadow-sm", onOpenLead && "cursor-pointer hover:border-accent/60", isDragging && "z-10 opacity-70")}
      onClick={() => onOpenLead?.(lead)}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div><p className="text-sm font-medium">{lead.name}</p><p className="text-xs text-slate-400">{lead.company ?? "Sem empresa"}</p></div>
        <button {...listeners} {...attributes} aria-label="Arrastar lead" onClick={(event) => event.stopPropagation()}><GripVertical className="text-slate-500" size={17} /></button>
      </div>
      <div className="space-y-2 text-xs text-slate-400">
        <p className="flex items-center gap-1"><UserRound size={13} /> {lead.responsible}</p>
        <p>{currency(Number(lead.estimatedValue ?? 0))}</p>
        <p>Ultima interacao: {dateLabel(lead.lastInteractionAt)}</p>
        <p>Proximo follow-up: {dateLabel(lead.nextFollowUpAt)}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={cn("rounded-full px-2 py-1 text-[11px]", lead.priority === "URGENT" || lead.priority === "HIGH" ? "bg-red-500/15 text-red-300" : "bg-blue-500/15 text-blue-300")}>{lead.priority}</span>
        <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-300">{lead.score}</span>
      </div>
    </article>
  );
}

function PipelineColumn({ column, leads, onOpenLead }: { column: { id: CrmPipelineStage; title: string }; leads: CrmLead[]; onOpenLead?: (lead: CrmLead) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <Card ref={setNodeRef} className={cn("min-h-[520px] min-w-72 p-4", isOver && "border-accent")}>
      <header className="mb-4 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">{column.title}</h2><span className="rounded-full bg-sidebar px-2 py-0.5 text-xs text-slate-400">{leads.length}</span></header>
      <div className="space-y-3">{leads.map((lead) => <LeadCard key={lead.id} lead={lead} onOpenLead={onOpenLead} />)}</div>
    </Card>
  );
}

export function CrmPipelineKanban({ leads, onMove, onOpenLead }: { leads: CrmLead[]; onMove: (lead: CrmLead, stage: CrmPipelineStage) => void; onOpenLead?: (lead: CrmLead) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  function onDragEnd({ active, over }: DragEndEvent) {
    const lead = leads.find((item) => item.id === active.id);
    const stage = pipelineColumns.find((item) => item.id === over?.id)?.id;
    if (lead && stage && lead.stage !== stage) onMove(lead, stage);
  }
  return <DndContext sensors={sensors} onDragEnd={onDragEnd}><div className="flex gap-4 overflow-x-auto pb-4">{pipelineColumns.map((column) => <PipelineColumn key={column.id} column={column} leads={leads.filter((lead) => lead.stage === column.id)} onOpenLead={onOpenLead} />)}</div></DndContext>;
}

function ProjectCard({ project }: { project: CrmProject }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: project.id });
  return (
    <article ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} className={cn("rounded-xl border border-slate-700 bg-sidebar p-3 shadow-sm", isDragging && "z-10 opacity-70")}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div><p className="text-sm font-medium">{project.name}</p><p className="text-xs text-slate-400">{project.client.name}</p></div>
        <button {...listeners} {...attributes} aria-label="Arrastar projeto"><GripVertical className="text-slate-500" size={17} /></button>
      </div>
      <div className="mb-3 flex justify-between text-xs text-slate-400"><span>{project.progress}% concluido</span><span>{Number(project.executedHours ?? 0)}h</span></div>
      <div className="h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full bg-accent" style={{ width: `${project.progress}%` }} /></div>
      <p className="mt-3 flex items-center gap-1 text-xs text-slate-400"><CalendarClock size={13} /> {dateLabel(project.endDate)}</p>
    </article>
  );
}

function ProjectColumn({ column, projects }: { column: { id: CrmProjectStatus; title: string }; projects: CrmProject[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <Card ref={setNodeRef} className={cn("min-h-[460px] min-w-72 p-4", isOver && "border-accent")}>
      <header className="mb-4 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">{column.title}</h2><span className="rounded-full bg-sidebar px-2 py-0.5 text-xs text-slate-400">{projects.length}</span></header>
      <div className="space-y-3">{projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div>
    </Card>
  );
}

export function CrmProjectKanban({ projects, onMove }: { projects: CrmProject[]; onMove: (project: CrmProject, status: CrmProjectStatus) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  function onDragEnd({ active, over }: DragEndEvent) {
    const project = projects.find((item) => item.id === active.id);
    const status = projectColumns.find((item) => item.id === over?.id)?.id;
    if (project && status && project.status !== status) onMove(project, status);
  }
  return <DndContext sensors={sensors} onDragEnd={onDragEnd}><div className="flex gap-4 overflow-x-auto pb-4">{projectColumns.map((column) => <ProjectColumn key={column.id} column={column} projects={projects.filter((project) => project.status === column.id)} />)}</div></DndContext>;
}
