export type AgentName = 'ice' | 'baka' | 'child' | 'narrator';
export type Emotion = 
| 'neutral' | 'smug' | 'angry' //ice
| 'point' | 'nervous' | 'happy' //baka
| 'confused' | 'amazed' | 'sleep' //child
| 'shocked' //ice + baka
| 'annoyed' //child
| 'idle';//narrator

export interface DialogueLine {
    id: number;
    speaker: AgentName;
    emotion: Emotion;
    text: string;
    action?: 'shake' | 'flash';
}
