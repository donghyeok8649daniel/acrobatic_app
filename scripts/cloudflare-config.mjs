import fs from 'node:fs';
import path from 'node:path';

export function readCloudflareDeployment(root = process.cwd()) {
  const file = path.join(root, '.sites-runtime', 'cloudflare.json');
  if (!fs.existsSync(file)) throw Error('개인 Cloudflare 배포 설정이 없습니다. DEPLOY-CLOUDFLARE.md를 확인하세요.');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!/^[a-f0-9]{32}$/i.test(config.accountId || '')) throw Error('유효한 Cloudflare accountId가 필요합니다.');
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(config.databaseId || '') || config.databaseId === '00000000-0000-4000-8000-000000000000') throw Error('실제 D1 databaseId를 설정하세요.');
  for (const key of ['workerName', 'databaseName', 'bucketName']) {
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(config[key] || '')) throw Error('올바른 리소스 이름이 필요합니다: ' + key);
  }
  return config;
}

export function cloudflareBindings(config) {
  return {
    name: config.workerName,
    account_id: config.accountId,
    workers_dev: true,
    triggers: {crons:['*/5 * * * *']},
    preview_urls: false,
    d1_databases: [{ binding: 'DB', database_name: config.databaseName, database_id: config.databaseId }],
    r2_buckets: config.videoStorageEnabled === false ? [] : [{ binding: 'BUCKET', bucket_name: config.bucketName }],
  };
}
