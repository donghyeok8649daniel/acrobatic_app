import type {TeamState} from './domain';
export type TrainingManual={id:string;title:string;minimum:number;goal:string;steps:string;titleEn?:string;goalEn?:string;stepsEn?:string;diagram:'none'|'ab'|'rally';updatedAt:string};
export type WeeklyDiary={id:string;weekStart:string;title:string;diary:string;timetable:string;author:string;updatedAt:string};
export function manualText(state:TeamState,eventId:string){const event=state.events.find(e=>e.id===eventId);if(!event)return '';return (event.manualIds||[]).map(id=>state.trainingManuals?.find(m=>m.id===id)).filter(Boolean).map(m=>`${m!.title}\n${m!.goal}\n${m!.steps}`).join('\n\n');}
