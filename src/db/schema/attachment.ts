import { bigint, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { attachmentKindEnum } from './enums';
import { order } from './order';
import { user } from './user';

export const attachment = pgTable(
  'attachment',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedByDefaultAsIdentity({ name: 'attachment_id_seq' }),
    orderId: bigint('order_id', { mode: 'number' })
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    kind: attachmentKindEnum('kind').notNull(),
    storagePath: text('storage_path').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => user.id),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orderIdx: index('idx_attachment_order').on(t.orderId),
  }),
);

export type Attachment = typeof attachment.$inferSelect;
export type NewAttachment = typeof attachment.$inferInsert;
