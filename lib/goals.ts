/**
 * Сборка задачи месяца из данных: OKR, подпроекты, шаги, прогресс, состояние.
 *
 * Одно место на все экраны — иначе «Месяц» и «Задача месяца» начнут показывать
 * разные числа по одному и тому же проекту, а это худшее, что может случиться
 * с пультом.
 */
import { db } from "@/lib/db";
import { goalProgress, goalState, type SimpleState } from "@/lib/simple";

const dayMs = 86_400_000;

export interface StepView {
  id: string;
  title: string;
  status: string;
  firstStep: string | null;
  estimateMin: number | null;
  becomesTrue: string | null;
}

export interface SubprojectView {
  id: string;
  title: string;
  nextStep: string | null;
  ownerName: string | null;
  steps: StepView[];
  openCount: number;
  doneCount: number;
}

export interface GoalView {
  id: string;
  title: string;
  icon: string | null;
  status: string;
  becomesTrue: string | null;
  owner: string | null;
  potentialUsd: number | null;
  metricName: string | null;
  metricTarget: number | null;
  metricFact: number;
  krs: { id: string; name: string; current: number; target: number; unit: string | null }[];
  subprojects: SubprojectView[];
  progress: number;
  state: SimpleState;
  silentDays: number | null;
  looseSteps: StepView[];
}

const stepView = (t: {
  id: string; title: string; status: string; firstStep: string | null;
  estimateMin: number | null; becomesTrue: string | null;
}): StepView => ({
  id: t.id, title: t.title, status: t.status,
  firstStep: t.firstStep, estimateMin: t.estimateMin, becomesTrue: t.becomesTrue,
});

/** Все задачи месяца разом. Тяжёлых запросов в цикле нет — всё берётся четырьмя выборками. */
export async function loadGoals(): Promise<GoalView[]> {
  const now = Date.now();
  const month = new Date().toISOString().slice(0, 7);
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const monthPercent = Math.round((new Date().getDate() / daysInMonth) * 100);

  const [projects, contracts, krs, streams, steps, facts] = await Promise.all([
    db.project.findMany({ orderBy: [{ status: "asc" }, { potentialUsd: "desc" }] }),
    db.monthContract.findMany({ where: { month } }),
    db.kR.findMany(),
    db.stream.findMany({ where: { active: true }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }] }),
    db.task.findMany({
      where: { status: { not: "frozen" }, projectId: { not: null } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    }),
    db.activity.groupBy({ by: ["projectId"], _max: { createdAt: true } }),
  ]);

  const lastFact = new Map(facts.map((f) => [f.projectId, f._max.createdAt]));

  return projects.map((p) => {
    const contract = contracts.find((c) => c.projectId === p.id);
    const myKrs = krs.filter((k) => k.projectId === p.id);
    const mySteps = steps.filter((s) => s.projectId === p.id);
    const last = lastFact.get(p.id) ?? null;
    const silentDays = last ? Math.floor((now - last.getTime()) / dayMs) : null;

    const subprojects: SubprojectView[] = streams
      .filter((s) => s.projectId === p.id)
      .map((s) => {
        const inside = mySteps.filter((t) => t.streamId === s.id);
        return {
          id: s.id,
          title: s.title,
          nextStep: s.nextStep,
          ownerName: s.ownerName,
          steps: inside.map(stepView),
          openCount: inside.filter((t) => t.status !== "done").length,
          doneCount: inside.filter((t) => t.status === "done").length,
        };
      });

    const progress = goalProgress(myKrs);

    return {
      id: p.id,
      title: p.title,
      icon: p.icon,
      status: p.status,
      becomesTrue: p.monthGoal,
      owner: p.owner,
      potentialUsd: p.potentialUsd,
      metricName: contract?.leadMetric ?? null,
      metricTarget: contract?.leadTarget ?? null,
      metricFact: contract?.leadFact ?? 0,
      krs: myKrs.map((k) => ({ id: k.id, name: k.name, current: k.current, target: k.target, unit: k.unit })),
      subprojects,
      progress,
      state: goalState(progress, monthPercent, silentDays),
      silentDays,
      // шаги, привязанные к задаче месяца, но ещё не разложенные по подпроектам
      looseSteps: mySteps.filter((t) => !t.streamId).map(stepView),
    };
  });
}

/** Строки для подсказки места: всё, что уже накоплено вокруг задачи месяца. */
export function placementCorpus(g: GoalView): string {
  return [
    g.becomesTrue ?? "",
    g.metricName ?? "",
    ...g.krs.map((k) => k.name),
    ...g.subprojects.map((s) => `${s.title} ${s.nextStep ?? ""}`),
    ...g.subprojects.flatMap((s) => s.steps.map((t) => t.title)),
    ...g.looseSteps.map((t) => t.title),
  ].join(" ");
}
