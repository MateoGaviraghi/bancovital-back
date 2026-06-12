import 'dotenv/config';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';

interface BucketSpec {
  name: string;
  fileSizeLimit: number;
  allowedMimeTypes: string[];
}

const BUCKETS: BucketSpec[] = [
  {
    name: 'reports',
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['application/pdf'],
  },
  {
    name: 'assets',
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  },
];

async function ensureBucket(client: SupabaseClient, spec: BucketSpec): Promise<void> {
  const { data: buckets, error: listErr } = await client.storage.listBuckets();
  if (listErr) throw new Error(`listBuckets failed: ${listErr.message}`);

  const exists = buckets?.some((b) => b.name === spec.name);
  console.log(`Bucket "${spec.name}" exists: ${exists ? 'YES' : 'NO'}`);
  if (exists) return;

  console.log(`Creating bucket "${spec.name}" (private)...`);
  const { error } = await client.storage.createBucket(spec.name, {
    public: false,
    fileSizeLimit: spec.fileSizeLimit,
    allowedMimeTypes: spec.allowedMimeTypes,
  });
  if (error) throw new Error(`createBucket "${spec.name}" failed: ${error.message}`);
  console.log(`Created "${spec.name}".`);
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing');

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const spec of BUCKETS) {
    await ensureBucket(client, spec);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
