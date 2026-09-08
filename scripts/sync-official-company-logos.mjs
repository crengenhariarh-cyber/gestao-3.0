import fs from 'node:fs/promises';

const legacyUrl='https://nuigbsleackrwpoxwxdo.supabase.co';
const legacyAnonKey='sb_publishable_mui9_MiItgq_ySgyL_60MA_KLkA0Fe4';
const companies=[
  {id:'1ac1cde3-30fa-4fab-9ea0-8afbb34732e5',file:'public/company-cr.webp'},
  {id:'68e55f19-6d77-45cf-a86b-6a661f4c285a',file:'public/company-pr.webp'},
];

for(const company of companies){
  const response=await fetch(`${legacyUrl}/rest/v1/platform_companies?id=eq.${company.id}&select=logo_url`,{
    headers:{apikey:legacyAnonKey,Authorization:`Bearer ${legacyAnonKey}`},
  });
  if(!response.ok)throw new Error(`Failed to load ${company.id}: HTTP ${response.status}`);
  const rows=await response.json();
  const data=rows?.[0]?.logo_url;
  if(typeof data!=='string'||!data.startsWith('data:image/'))throw new Error(`Official logo missing for ${company.id}`);
  const comma=data.indexOf(',');
  if(comma<0)throw new Error(`Invalid data URI for ${company.id}`);
  const meta=data.slice(0,comma);
  const body=data.slice(comma+1);
  const bytes=meta.includes(';base64')?Buffer.from(body,'base64'):Buffer.from(decodeURIComponent(body),'utf8');
  await fs.writeFile(company.file,bytes);
  console.log(`Wrote ${company.file} (${bytes.length} bytes)`);
}
