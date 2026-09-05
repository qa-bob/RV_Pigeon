// Applied to every model so API responses expose a plain `id` string
// (matching shared/src/types) instead of Mongo's `_id`/`__v`. Deliberately
// left untyped (no SchemaOptions annotation) — annotating this with
// mongoose's generic SchemaOptions["toJSON"] type widens what TypeScript
// infers for `new Schema(fields, { ..., toJSON: toJSONOptions })`, which in
// turn erases field-level typing on `this` inside schema.pre() callbacks.
export const toJSONOptions = {
  virtuals: true,
  versionKey: false,
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = (ret._id as { toString(): string }).toString();
    delete ret._id;
    return ret;
  },
};
