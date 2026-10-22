import { CAMPUS_UNITS, ORCHESTRATOR_AGENT } from '@/features/city/model/campus';
import { specialistById } from '@/features/city/model/specialists';
import { format, type Messages } from '@/i18n';

/** Ficha de un agente (F4): tipo, responsabilidades, memoria resumida y archivos de ejemplo. */
export interface AgentProfile {
  readonly kind: 'orchestrator' | 'unit' | 'specialist';
  readonly responsibilities: readonly string[];
  readonly memory: readonly string[];
  readonly files: readonly string[];
}

type ProfileKey = keyof Messages['profiles'];

const fileName = (name: string) => name.replace(/\s*\/\s*/g, '-').replace(/[^\p{L}\p{N}-]+/gu, '_');

export function profileOf(agentId: string, m: Messages): AgentProfile {
  const role = specialistById(agentId);
  if (role) {
    const unit = CAMPUS_UNITS.find((u) => u.id === role.unitId)?.name ?? role.unitId;
    const name = m.specialists[role.id].name;
    const vars = { role: m.specialists[role.id].description, unit };
    return {
      kind: 'specialist',
      responsibilities: m.specialistProfile.responsibilities.map((t) => format(t, vars)),
      memory: m.specialistProfile.memory.map((t) => format(t, vars)),
      files: [format(m.profile.fileReport, { name: fileName(name) })],
    };
  }
  const own = (m.profiles as Readonly<Record<string, Messages['profiles'][ProfileKey]>>)[agentId];
  const name = agentId === ORCHESTRATOR_AGENT ? m.agents.chief : (CAMPUS_UNITS.find((u) => (u.agent ?? u.id) === agentId)?.name ?? agentId);
  return {
    kind: agentId === ORCHESTRATOR_AGENT ? 'orchestrator' : 'unit',
    responsibilities: own?.responsibilities ?? [],
    memory: own?.memory ?? [],
    files: [format(m.profile.fileReport, { name: fileName(name) }), format(m.profile.fileList, { name: fileName(name) })],
  };
}
