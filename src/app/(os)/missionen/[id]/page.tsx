import { notFound } from 'next/navigation';
import { MissionDetail } from '@/features/missions/MissionDetail';
import { getMessages } from '@/i18n';

type Params = Promise<{ id: string }>;

export const metadata = { title: `${getMessages().nav.missions} · METHACity` };

/** Ids de misión generados en el navegador (`m-…`); cualquier otra cosa no existe. */
const MISSION_ID = /^m-[a-z0-9]{1,20}-[a-z0-9]{1,16}$/;

export default async function MissionPage({ params }: Readonly<{ params: Params }>) {
  const { id } = await params;
  if (!MISSION_ID.test(id)) notFound();
  return <MissionDetail m={getMessages()} missionId={id} />;
}
