export type AgentName = 'ice' | 'baka' | 'child';
export type Emotion = 
| 'neutral' | 'smug' | 'angry' //ice
| 'point' | 'nervous' | 'happy' //baka
| 'confused' | 'amazed' | 'sleep';//child

export interface DialogueLine {
    id: number;
    speaker: AgentName;
    emotion: Emotion;
    text: string;
    action?: 'shake' | 'flash';
}
