import { z } from 'zod';
const SlackListItemSchema = z.object({
    id: z.string(),
    list_id: z.string(),
    fields: z
        .array(z.object({
        column_id: z.string().optional(),
        key: z.string(),
        text: z.string().optional(),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
    }))
        .default([]),
});
export function mapSlackListItem(input) {
    const item = SlackListItemSchema.parse(input);
    return {
        id: item.id,
        listId: item.list_id,
        fields: item.fields.map((field) => ({
            key: field.key,
            ...(field.column_id === undefined ? {} : { columnId: field.column_id }),
            ...(field.text === undefined ? {} : { text: field.text }),
            ...(field.value === undefined ? {} : { value: field.value }),
        })),
    };
}
//# sourceMappingURL=slack-api-types.js.map