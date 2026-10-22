import { format, type Messages } from '@/i18n';
import type { Mission } from '@/os/missions/contract';
import { progress } from '@/os/missions/mission';

const TONE: Record<Mission['status'], 'working' | 'waiting' | 'idle' | 'done' | 'off'> = {
  planning: 'working', 'awaiting-plan': 'waiting', running: 'working', 'awaiting-result': 'waiting', done: 'done', rejected: 'off', cancelled: 'off',
};

export function MissionStatusChip({ m, mission }: Readonly<{ m: Messages; mission: Mission }>) {
  return <span className={`mission-chip ${TONE[mission.status]}`} data-status={mission.status}>{m.missions.status[mission.status]}</span>;
}

/** Barra de progreso con texto «n von N Schritten». */
export function MissionProgress({ m, mission }: Readonly<{ m: Messages; mission: Mission }>) {
  const { done, total } = progress(mission);
  const label = format(m.missions.steps, { done, total });
  return (
    <div className="mission-progress">
      <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={label}>
        <span style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <small>{label}</small>
    </div>
  );
}
