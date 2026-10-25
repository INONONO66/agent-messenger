import { z } from 'zod';
declare const EventSchema: z.ZodObject<{
    '@type': z.ZodString;
    '@client_id': z.ZodOptional<z.ZodNumber>;
    '@extra': z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export type TdEvent = z.infer<typeof EventSchema>;
export interface TdBinding {
    createClientId(): number;
    send(clientId: number, query: Record<string, unknown>): void;
    receive(timeoutSeconds: number): Promise<unknown> | unknown;
}
export declare class TdReceiver {
    private readonly binding;
    private static readonly receivers;
    private readonly clients;
    private readonly pending;
    private sequence;
    private running;
    private failure?;
    static for(binding: TdBinding): TdReceiver;
    private constructor();
    on(clientId: number, handler: (event: TdEvent) => void): () => void;
    request(clientId: number, query: Record<string, unknown>, timeoutMs?: number): Promise<TdEvent>;
    private start;
    private pump;
}
export {};
//# sourceMappingURL=receiver.d.ts.map